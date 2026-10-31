import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { nanoid } from "nanoid";
import { upsertEnvVar } from "../config.js";
import { ensureDir } from "../util.js";
import { NOT_INSTALLED_HINT, chatgptFailure, gatewayError } from "./errors.js";
import { chatgptGatewayInstalled, gatewayEnv, gatewayPaths, gatewayPython } from "./runtime.js";

/**
 * ChatGPT web qua gateway chatgpt2api (gateways/chatgpt, AGPL-3.0) - phía Node.
 *
 * Gateway là một SIDECAR: server tự bật khi cần (`aiev_launcher.py` →
 * uvicorn main:app trên 127.0.0.1:6871), giữ sống, tự khởi động lại khi chết,
 * và chết theo server (launcher tự thoát khi stdin đóng - kể cả khi server bị
 * kill cứng, không kịp chạy handler nào).
 *
 * Xác thực: chatgpt2api dùng MỘT khóa (CHATGPT2API_AUTH_KEY) làm Bearer cho cả
 * API OpenAI (/v1/*) lẫn admin (/api/*). Khóa đó là CHATGPT_GATEWAY_KEY trong
 * .env, tự sinh lần đầu (giống AIEV_API_TOKEN). Gateway chỉ nghe loopback.
 *
 * Token tài khoản: AIEV KHÔNG lưu - chuyển thẳng sang admin API của gateway,
 * gateway giữ trong SQLite của nó ở .runtime/chatgpt-gateway/ (gitignore).
 */

const PORT = Number(process.env.CHATGPT_GATEWAY_PORT || 6871);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/** Khởi động đo được ~3s trên máy Windows này; máy lạnh/antivirus quét venv lần đầu chậm hơn nhiều */
const START_TIMEOUT_MS = 90_000;
const HEALTH_TIMEOUT_MS = 3_000;
const ADMIN_TIMEOUT_MS = 30_000;
/** Nhập tài khoản: gateway gọi chatgpt.com xác minh + lấy quota ngay (sync_after_import) */
const IMPORT_TIMEOUT_MS = 120_000;
/** Một ảnh ChatGPT web: thường 30-90s, xếp hàng/đông người có thể vài phút */
const IMAGE_TIMEOUT_MS = 10 * 60 * 1000;
/** Tự khởi động lại tối đa chừng này lần liên tiếp - quá thì chờ lần gọi kế tiếp */
const MAX_AUTO_RESTARTS = 3;

/**
 * Phần tử ĐẦU là mặc định (generateChatgptImage dùng khi không truyền model).
 * Gateway ánh xạ (openai_backend_api.py `_image_model_slug`): "gpt-image-2" ghim
 * cứng slug "gpt-5-3", còn "gpt-image-2.5" gửi "auto" = ChatGPT web tự chọn model
 * ảnh mới nhất của tài khoản - nên giữ "gpt-image-2" làm mặc định cho kết quả ổn
 * định, 2.5 chỉ dùng khi chọn đích danh.
 */
export const CHATGPT_IMAGE_MODELS = ["gpt-image-2", "gpt-image-2.5"] as const;

// ---------------------------------------------------------------------------
// Khóa + đường dẫn
// ---------------------------------------------------------------------------

function gatewayKey(): string {
  const fromEnv = (process.env.CHATGPT_GATEWAY_KEY ?? "").trim();
  if (fromEnv) return fromEnv;
  const generated = nanoid(40);
  try {
    upsertEnvVar("CHATGPT_GATEWAY_KEY", generated);
  } catch (err) {
    console.warn(
      `[chatgpt-gateway] Không ghi được CHATGPT_GATEWAY_KEY vào .env: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  process.env.CHATGPT_GATEWAY_KEY = generated;
  return generated;
}

const dataDir = () => path.join(gatewayPaths.chatgptData, "data");

/** Đã từng dùng gateway chưa (có DB tài khoản) - chưa thì GET trạng thái không bật sidecar */
export function chatgptGatewayUsed(): boolean {
  return fs.existsSync(path.join(dataDir(), "chatgpt2api.db"));
}

function sqliteUrl(abs: string): string {
  // SQLAlchemy: sqlite:///<đường dẫn tuyệt đối dạng /> - POSIX ra 4 gạch, Windows "sqlite:///F:/..."
  return `sqlite:///${abs.replace(/\\/g, "/")}`;
}

// ---------------------------------------------------------------------------
// Sidecar
// ---------------------------------------------------------------------------

let child: ChildProcess | null = null;
let starting: Promise<void> | null = null;
let stderrTail: string[] = [];
let autoRestarts = 0;
let shuttingDown = false;

function tailText(lines = 8): string {
  return stderrTail.slice(-lines).join("\n");
}

/** Lần thăm dò "ok" gần nhất (ms) - sidecar của chính mình vừa trả lời thì khỏi hỏi lại */
let lastHealthyAt = 0;
const HEALTH_CACHE_MS = 15_000;

/**
 * Thăm dò sidecar bằng POST /auth/login: chỉ so khóa Bearer TẠI CHỖ (khóa
 * CHATGPT2API_AUTH_KEY là danh tính admin cũ, không đụng mạng) - sai khóa = 401.
 * KHÔNG dùng /v1/models: route đó gọi chatgpt.com (trang chủ + /backend-anon/models hoặc /backend-api/models,
 * timeout 30s phía gateway), mạng tới chatgpt.com chậm là sidecar khỏe mạnh vẫn
 * bị coi là chết rồi bị giết sau START_TIMEOUT_MS.
 */
async function healthy(): Promise<"ok" | "unauthorized" | "down"> {
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { authorization: `Bearer ${gatewayKey()}` },
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (res.ok) {
      lastHealthyAt = Date.now();
      return "ok";
    }
    return res.status === 401 ? "unauthorized" : "down";
  } catch {
    return "down";
  }
}

export function chatgptGatewayRunning(): boolean {
  return child !== null && child.exitCode === null && !child.killed;
}

function spawnSidecar(): ChildProcess {
  const python = gatewayPython();
  if (!python || !chatgptGatewayInstalled()) {
    throw gatewayError("GATEWAY_NOT_INSTALLED", `Chưa cài gateway ChatGPT. ${NOT_INSTALLED_HINT}`);
  }
  ensureDir(dataDir());
  const proc = spawn(python, [gatewayPaths.chatgptLauncher, String(PORT)], {
    cwd: gatewayPaths.chatgptDir,
    windowsHide: true,
    // stdin GIỮ MỞ: launcher coi stdin đóng = server AIEV đã chết → tự thoát
    stdio: ["pipe", "pipe", "pipe"],
    env: gatewayEnv({
      CHATGPT2API_AUTH_KEY: gatewayKey(),
      CHATGPT2API_DATA_DIR: dataDir(),
      CHATGPT2API_CONFIG_FILE: path.join(gatewayPaths.chatgptData, "config.json"),
      DATABASE_URL: sqliteUrl(path.join(dataDir(), "chatgpt2api.db")),
      CHATGPT2API_BUILD_TYPE: "release",
    }),
  });
  child = proc;
  stderrTail = [];
  const collect = (chunk: Buffer) => {
    for (const line of chunk.toString("utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      stderrTail.push(t);
      if (stderrTail.length > 40) stderrTail.shift();
    }
  };
  proc.stdout?.on("data", collect);
  proc.stderr?.on("data", collect);
  proc.on("error", (err) => {
    if (child !== proc) return;
    child = null;
    console.warn(`[chatgpt-gateway] không chạy được: ${err.message}`);
  });
  proc.on("exit", (code) => {
    if (child !== proc) return;
    child = null;
    if (shuttingDown) return;
    console.warn(`[chatgpt-gateway] tiến trình thoát mã ${code}\n${tailText(6)}`);
    // Tự khởi động lại nếu chết khi đang chạy ổn (không phải chết ngay lúc khởi động)
    if (autoRestarts < MAX_AUTO_RESTARTS && !starting) {
      autoRestarts++;
      const timer = setTimeout(() => {
        ensureChatgptGateway().catch((err) =>
          console.warn(`[chatgpt-gateway] khởi động lại thất bại: ${err instanceof Error ? err.message : String(err)}`),
        );
      }, 3_000);
      timer.unref?.();
    }
  });
  return proc;
}

/** Bảo đảm sidecar đang chạy và trả lời đúng khóa - gọi trước mọi lời gọi gateway */
export async function ensureChatgptGateway(): Promise<void> {
  if (!chatgptGatewayInstalled()) {
    throw gatewayError("GATEWAY_NOT_INSTALLED", `Chưa cài gateway ChatGPT. ${NOT_INSTALLED_HINT}`);
  }
  if (starting) return starting;
  // Tiến trình con của mình vẫn sống và vừa trả lời xong: khỏi thăm dò lại mỗi lời gọi
  if (chatgptGatewayRunning() && Date.now() - lastHealthyAt < HEALTH_CACHE_MS) return;
  const state = await healthy();
  if (state === "ok") return;
  if (state === "unauthorized") {
    // Có thứ khác (hoặc một bản gateway cũ với khóa khác) đang giữ cổng
    throw gatewayError(
      "GATEWAY_UNAVAILABLE",
      `Cổng ${PORT} đang bị một chương trình khác dùng (khóa không khớp). Tắt nó, hoặc đặt CHATGPT_GATEWAY_PORT khác trong .env rồi khởi động lại server.`,
    );
  }
  starting = (async () => {
    const proc = chatgptGatewayRunning() && child ? child : spawnSidecar();
    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (proc.exitCode !== null || child !== proc) {
        const why = tailText();
        throw gatewayError(
          "GATEWAY_UNAVAILABLE",
          `Gateway ChatGPT không khởi động được.${why ? `\n${why}` : ""}\n` +
            `Nếu báo thiếu module: ${NOT_INSTALLED_HINT}`,
        );
      }
      if ((await healthy()) === "ok") {
        console.log(`[chatgpt-gateway] sẵn sàng tại ${BASE_URL}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    stopChatgptGateway("khởi động quá lâu");
    throw gatewayError(
      "GATEWAY_TIMEOUT",
      `Gateway ChatGPT không sẵn sàng sau ${START_TIMEOUT_MS / 1000}s.${tailText() ? `\n${tailText()}` : ""}`,
    );
  })();
  try {
    await starting;
    autoRestarts = 0;
  } finally {
    starting = null;
  }
}

export function stopChatgptGateway(why: string): void {
  const proc = child;
  child = null;
  if (!proc) return;
  console.log(`[chatgpt-gateway] tắt (${why})`);
  try {
    proc.stdin?.end();
    proc.kill();
  } catch {
    /* đã chết */
  }
}

// Tắt theo server. "exit" chạy đồng bộ - kill() là gửi tín hiệu, đủ nhanh. Bị
// kill cứng thì handler này không chạy, nhưng stdin đóng và launcher tự thoát.
process.on("exit", () => {
  shuttingDown = true;
  stopChatgptGateway("server tắt");
});

// ---------------------------------------------------------------------------
// HTTP tới gateway
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const asText = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";

async function gwFetch(p: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  await ensureChatgptGateway();
  const { timeoutMs, ...rest } = init;
  try {
    return await fetch(`${BASE_URL}${p}`, {
      ...rest,
      headers: {
        authorization: `Bearer ${gatewayKey()}`,
        "content-type": "application/json",
        ...(rest.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs ?? ADMIN_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw gatewayError("GATEWAY_TIMEOUT", "Gateway ChatGPT không trả lời kịp - thử lại.");
    }
    throw gatewayError(
      "GATEWAY_UNAVAILABLE",
      `Không kết nối được gateway ChatGPT: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Lỗi của gateway có hai dạng: OpenAI `{error:{message, code}}` (/v1/*) và
 * FastAPI `{detail:{error}}` / `{detail:"..."}` (/api/*).
 */
async function errorOf(res: Response): Promise<{ code: string; message: string }> {
  const raw = asObj(await res.json().catch(() => null));
  const err = asObj(raw.error);
  const detail = raw.detail;
  const message =
    asText(err.message) ||
    asText(asObj(detail).error) ||
    asText(detail) ||
    asText(raw.error) ||
    asText(raw.message);
  return { code: asText(err.code) || asText(asObj(detail).code), message };
}

async function throwFromResponse(res: Response, fallback: string): Promise<never> {
  const { code, message } = await errorOf(res);
  const mapped = chatgptFailure(code, res.status, message || fallback);
  throw gatewayError(mapped.code, mapped.message);
}

// ---------------------------------------------------------------------------
// Tài khoản
// ---------------------------------------------------------------------------

export interface ChatgptAccount {
  id: string;
  email?: string | null;
  plan?: string | null;
  /** ok | limited | expired | error | disabled */
  status: string;
  imageQuotaRemaining?: number | null;
  resetAt?: string | null;
  expiresAt?: string | null;
}

function isoOf(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    // Gateway trả unix GIÂY; phòng khi là mili giây
    return new Date(v > 1e12 ? v : v * 1000).toISOString();
  }
  if (typeof v === "string" && v.trim()) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  return null;
}

/** Hàng tài khoản của gateway (services/account_view.account_row) → shape của AIEV */
function toAccount(raw: unknown): ChatgptAccount | null {
  const o = asObj(raw);
  const id = asText(o.id);
  if (!id) return null;
  const category = asText(o.status_category);
  const accessStatus = asText(o.access_token_status).toLowerCase();
  const status =
    category === "normal"
      ? "ok"
      : category === "limited"
        ? "limited"
        : category === "disabled"
          ? "disabled"
          : accessStatus.includes("expired")
            ? "expired"
            : "error";
  const quota =
    o.quota_unlimited === true || o.quota_unknown === true
      ? null
      : typeof o.quota_remaining === "number"
        ? o.quota_remaining
        : null;
  return {
    id,
    email: asText(o.email) || null,
    plan: asText(o.plan).toLowerCase() || null,
    status,
    imageQuotaRemaining: quota,
    resetAt: isoOf(o.quota_reset_at),
    expiresAt: isoOf(o.access_token_expires_at),
  };
}

/**
 * Số tài khoản DÙNG ĐƯỢC lần gần nhất hỏi gateway - để GET /api/image-providers
 * (và chế độ "auto") biết ChatGPT web có dùng được không mà KHÔNG phải bật
 * sidecar / gọi mạng mỗi lần. Ghi ra đĩa để sống qua lần khởi động lại server:
 * chỉ giữ trong RAM thì sau mỗi lần restart "chưa biết" phải đoán là "có", và
 * chế độ auto đi bật gateway chỉ để nhận lỗi "chưa có tài khoản" (đã gặp khi test).
 * null = chưa hỏi gateway lần nào trên máy này.
 */
const countFile = () => path.join(gatewayPaths.chatgptData, "aiev-accounts.json");
let knownUsableAccounts: number | null | undefined;

export function chatgptAccountsKnown(): number | null {
  if (knownUsableAccounts === undefined) {
    try {
      const raw = JSON.parse(fs.readFileSync(countFile(), "utf8")) as { usable?: unknown };
      knownUsableAccounts = typeof raw.usable === "number" ? raw.usable : null;
    } catch {
      knownUsableAccounts = null;
    }
  }
  return knownUsableAccounts;
}

function rememberAccountCount(usable: number): void {
  knownUsableAccounts = usable;
  try {
    ensureDir(gatewayPaths.chatgptData);
    fs.writeFileSync(countFile(), JSON.stringify({ usable, at: new Date().toISOString() }) + "\n", "utf8");
  } catch {
    /* chỉ là bộ nhớ đệm */
  }
}

export async function listChatgptAccounts(): Promise<ChatgptAccount[]> {
  const res = await gwFetch("/api/accounts?page=1&page_size=500", { method: "GET" });
  if (!res.ok) await throwFromResponse(res, `Không đọc được danh sách tài khoản (HTTP ${res.status}).`);
  const raw = asObj(await res.json().catch(() => null));
  const items = Array.isArray(raw.items) ? raw.items : [];
  const accounts = items.map(toAccount).filter((a): a is ChatgptAccount => a !== null);
  rememberAccountCount(accounts.filter((a) => a.status === "ok" || a.status === "limited").length);
  return accounts;
}

/**
 * Nạp MỘT accessToken vào gateway (sync_after_import: gateway gọi chatgpt.com
 * xác minh + lấy quota ngay). Token hỏng/hết hạn: gateway tự gỡ tài khoản và
 * trả errors[] → ném GATEWAY_AUTH_FAILED kèm câu hướng dẫn tiếng Việt.
 */
export async function addChatgptAccount(accessToken: string): Promise<ChatgptAccount> {
  const res = await gwFetch("/api/accounts", {
    method: "POST",
    body: JSON.stringify({ tokens: [accessToken], sync_after_import: true, return_items: false }),
    timeoutMs: IMPORT_TIMEOUT_MS,
  });
  if (!res.ok) await throwFromResponse(res, `Gateway từ chối tài khoản (HTTP ${res.status}).`);
  const raw = asObj(await res.json().catch(() => null));
  const errors = Array.isArray(raw.errors) ? raw.errors.map(asObj) : [];
  const updated = (Array.isArray(raw.updated_ids) ? raw.updated_ids : []).map(asText).filter(Boolean);
  const removed = (Array.isArray(raw.removed_ids) ? raw.removed_ids : []).map(asText).filter(Boolean);
  if (errors.length > 0 && updated.length === 0) {
    const first = errors[0];
    const mapped = chatgptFailure(
      asText(first.code) || asText(first.failure_code),
      Number(first.status_code) || 0,
      asText(first.message),
    );
    // Lỗi tạm (mạng, chatgpt.com chập chờn) mà gateway chưa gỡ tài khoản thì để
    // nguyên - lần đồng bộ sau của gateway tự sửa; còn lỗi xác thực thì báo ngay.
    throw gatewayError(mapped.code, mapped.message);
  }
  const accounts = await listChatgptAccounts();
  const wanted = updated.find((id) => !removed.includes(id));
  const found = (wanted && accounts.find((a) => a.id === wanted)) || null;
  if (found) return found;
  // Token trùng tài khoản đã có (skipped): gateway không nói là tài khoản nào -
  // trả tài khoản dùng được đầu tiên thay vì báo lỗi oan
  if (Number(raw.skipped) > 0 && accounts.length > 0) {
    return accounts.find((a) => a.status === "ok") ?? accounts[0];
  }
  throw gatewayError(
    "GATEWAY_FAILED",
    "Gateway nhận token nhưng không thấy tài khoản sau khi đồng bộ - thử lại hoặc lấy session mới.",
  );
}

export async function deleteChatgptAccount(id: string): Promise<boolean> {
  const accounts = await listChatgptAccounts();
  if (!accounts.some((a) => a.id === id)) return false;
  const res = await gwFetch("/api/accounts", {
    method: "DELETE",
    body: JSON.stringify({ account_ids: [id] }),
  });
  if (!res.ok) await throwFromResponse(res, `Xóa tài khoản lỗi (HTTP ${res.status}).`);
  // Gateway xóa NỀN (trả progress_id) - hỏi lại ngay vẫn có thể thấy tài khoản cũ,
  // nên tự trừ bộ đếm; lần liệt kê sau sẽ chỉnh lại cho đúng
  const usableBefore = accounts.filter((a) => a.status === "ok" || a.status === "limited").length;
  const wasUsable = accounts.some((a) => a.id === id && (a.status === "ok" || a.status === "limited"));
  rememberAccountCount(Math.max(0, usableBefore - (wasUsable ? 1 : 0)));
  return true;
}

/** Kiểm tra kết nối: gateway chạy + có ít nhất một tài khoản dùng được */
export async function testChatgptGateway(): Promise<{ ok: boolean; message: string }> {
  try {
    const accounts = await listChatgptAccounts();
    if (accounts.length === 0) {
      return { ok: false, message: "Gateway đang chạy nhưng chưa có tài khoản ChatGPT nào - dán session để thêm." };
    }
    const usable = accounts.filter((a) => a.status === "ok");
    if (usable.length === 0) {
      return {
        ok: false,
        message: `Có ${accounts.length} tài khoản nhưng không tài khoản nào dùng được (hết hạn/bị giới hạn) - nhập lại session.`,
      };
    }
    const quota = usable
      .map((a) => a.imageQuotaRemaining)
      .filter((q): q is number => typeof q === "number")
      .reduce((s, q) => s + q, 0);
    return {
      ok: true,
      message:
        `Gateway ChatGPT sẵn sàng - ${usable.length}/${accounts.length} tài khoản dùng được` +
        (quota > 0 ? `, còn khoảng ${quota} lượt ảnh.` : "."),
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Tạo ảnh
// ---------------------------------------------------------------------------

/**
 * Một ảnh qua /v1/images/generations (chuẩn OpenAI, b64_json) → Buffer.
 *
 * KHÔNG gửi `size`: chatgpt2api nhồi một câu TIẾNG TRUNG ("输出图片尺寸为 …")
 * vào prompt khi có size (đã gặp ở SEO-GEO). Với ChatGPT web size chỉ là gợi
 * ý văn bản, nên tự thêm câu tỉ lệ tiếng Anh vào cuối prompt. Kích thước đúng
 * từng pixel do bước cover-fit bằng ffmpeg lo.
 *
 * `projectId` → `conversation_key`: mọi ảnh của MỘT project vào CHUNG một hội
 * thoại ChatGPT (gateway nhớ theo từng tài khoản, đặt tên "AIEV - <project>",
 * chạy lần lượt) thay vì mỗi ảnh một hội thoại làm rác lịch sử chat.
 */
export async function generateChatgptImage(input: {
  prompt: string;
  width: number;
  height: number;
  model?: string;
  projectId?: string;
}): Promise<Buffer> {
  const model = CHATGPT_IMAGE_MODELS.includes(input.model as (typeof CHATGPT_IMAGE_MODELS)[number])
    ? input.model
    : CHATGPT_IMAGE_MODELS[0];
  const orientation =
    input.width === input.height ? "square" : input.width > input.height ? "landscape" : "portrait";
  const g = gcd(input.width, input.height);
  const ratio = `${input.width / g}:${input.height / g}`;
  const res = await gwFetch("/v1/images/generations", {
    method: "POST",
    body: JSON.stringify({
      model,
      prompt: `${input.prompt}\n\nImage format: ${ratio} ${orientation} (${input.width}x${input.height} pixels), full-bleed, no borders.`,
      n: 1,
      response_format: "b64_json",
      ...(input.projectId
        ? { conversation_key: `aiev:${input.projectId}`, conversation_title: `AIEV - ${input.projectId}` }
        : {}),
    }),
    timeoutMs: IMAGE_TIMEOUT_MS,
  });
  if (!res.ok) await throwFromResponse(res, `ChatGPT không tạo được ảnh (HTTP ${res.status}).`);
  const raw = asObj(await res.json().catch(() => null));
  const first = asObj(Array.isArray(raw.data) ? raw.data[0] : null);
  const b64 = asText(first.b64_json);
  if (!b64) {
    throw gatewayError("GATEWAY_FAILED", "ChatGPT không trả về ảnh - thử lại hoặc đổi mô tả.");
  }
  return Buffer.from(b64, "base64");
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.max(1, a) : gcd(b, a % b);
}
