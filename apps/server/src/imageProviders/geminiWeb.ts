import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { ensureDir, killTree } from "../util.js";
import { NOT_INSTALLED_HINT, gatewayError } from "./errors.js";
import { maskSecret, type GeminiCookies } from "./parse.js";
import { gatewayEnv, gatewayPaths, gatewayPython, geminiWebInstalled } from "./runtime.js";

/**
 * Gemini web (đăng nhập bằng cookie tài khoản Google) - phía Node của cây cầu
 * sang `gateways/gemini-web/worker.py` (AGPL-3.0, dùng gemini-webapi).
 *
 * Mẫu y hệt ttsLocal.ts + vieneu_worker.py: ĐÚNG MỘT worker sống lâu, giao
 * thức JSON lines, xếp hàng tuần tự. Sống lâu là bắt buộc chứ không phải để
 * nhanh: gemini_webapi xoay vòng cookie __Secure-1PSIDTS bằng tác vụ nền
 * (auto_refresh) - worker chết sau mỗi lần gọi thì cookie hết hạn sau vài giờ.
 *
 * Cookie người dùng dán lưu ở apps/server/data/gemini-web.json (gitignore,
 * không serve); cache cookie đã xoay vòng của thư viện ở .runtime/gemini-web/.
 * KHÔNG BAO GIỜ khởi tạo client với PSID rỗng (worker cũng chặn lần nữa):
 * thư viện sẽ mượn cookie cache mới nhất của một tài khoản khác.
 */

const INIT_TIMEOUT_MS = 120_000;
const PING_TIMEOUT_MS = 20_000;
/** Một ảnh Gemini web: 20-90s thường gặp; watchdog thư viện 120s/lần, có thể thử lại ngầm */
const GENERATE_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Kho cookie
// ---------------------------------------------------------------------------

interface StoredCookies {
  psid: string;
  psidts: string | null;
  savedAt: string;
  lastOkAt?: string | null;
  lastError?: { code: string; message: string; at: string } | null;
}

function readStore(): StoredCookies | null {
  try {
    const raw = JSON.parse(fs.readFileSync(gatewayPaths.geminiCookieFile, "utf8")) as Partial<StoredCookies>;
    if (typeof raw.psid !== "string" || !raw.psid.trim()) return null;
    return {
      psid: raw.psid.trim(),
      psidts: typeof raw.psidts === "string" && raw.psidts.trim() ? raw.psidts.trim() : null,
      savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date(0).toISOString(),
      lastOkAt: typeof raw.lastOkAt === "string" ? raw.lastOkAt : null,
      lastError: raw.lastError ?? null,
    };
  } catch {
    return null;
  }
}

function writeStore(data: StoredCookies): void {
  ensureDir(path.dirname(gatewayPaths.geminiCookieFile));
  const tmp = `${gatewayPaths.geminiCookieFile}.tmp`;
  // mode 0o600: chỉ chủ máy đọc được (POSIX) - đây là phiên đăng nhập Google
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, gatewayPaths.geminiCookieFile);
}

function patchStore(patch: Partial<StoredCookies>): void {
  const cur = readStore();
  if (cur) writeStore({ ...cur, ...patch });
}

export function geminiWebConfigured(): boolean {
  return readStore() !== null;
}

export interface GeminiWebInfo {
  installed: boolean;
  configured: boolean;
  psidMasked?: string | null;
  /** not-installed | not-configured | untested | ok | expired | error */
  status: string;
  lastOkAt?: string | null;
}

export function geminiWebInfo(): GeminiWebInfo {
  const installed = geminiWebInstalled();
  const store = readStore();
  let status: string;
  if (!installed) status = "not-installed";
  else if (!store) status = "not-configured";
  else if (store.lastError && (!store.lastOkAt || store.lastError.at > store.lastOkAt)) {
    status = store.lastError.code === "GATEWAY_AUTH_FAILED" ? "expired" : "error";
  } else status = store.lastOkAt ? "ok" : "untested";
  return {
    installed,
    configured: store !== null,
    psidMasked: store ? maskSecret(store.psid) : null,
    status,
    lastOkAt: store?.lastOkAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

interface WorkerRes {
  id: number;
  ok: boolean;
  code?: string;
  message?: string;
  [key: string]: unknown;
}

interface Pending {
  resolve: (r: WorkerRes) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

let worker: ChildProcess | null = null;
let stdoutBuf = "";
let stderrTail: string[] = [];
let nextId = 1;
const pending = new Map<number, Pending>();
/** Băm cookie mà client trong worker đang đăng nhập - đổi cookie thì init lại */
let initedFor: string | null = null;

const cookieHash = (c: GeminiCookies) =>
  crypto.createHash("sha256").update(`${c.psid}\u0000${c.psidts ?? ""}`).digest("hex");

function stopWorker(why: string): void {
  const proc = worker;
  worker = null;
  initedFor = null;
  stdoutBuf = "";
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    pending.delete(id);
    // Lỗi gateway có mã (mục 4.3 của plan) - không thì /generate-image báo
    // GENERATE_FAILED và /api/illustrations trả 500 chung chung
    p.reject(gatewayError("GATEWAY_UNAVAILABLE", `Worker Gemini web đã dừng (${why}) - thử lại.`));
  }
  if (proc) {
    console.log(`[gemini-web] tắt worker (${why})`);
    try {
      proc.stdin?.end();
    } catch {
      /* đã đóng */
    }
    killTree(proc);
  }
}

function startWorker(): ChildProcess {
  const python = gatewayPython();
  if (!python || !geminiWebInstalled()) {
    throw gatewayError("GATEWAY_NOT_INSTALLED", `Chưa cài gateway Gemini web. ${NOT_INSTALLED_HINT}`);
  }
  ensureDir(gatewayPaths.geminiCookieCache);
  // -I (isolated): không nạp module từ thư mục hiện tại/PYTHONPATH/user site
  const proc = spawn(python, ["-I", gatewayPaths.geminiWorker], {
    cwd: path.dirname(gatewayPaths.geminiWorker),
    windowsHide: true,
    env: gatewayEnv({ GEMINI_COOKIE_PATH: gatewayPaths.geminiCookieCache }),
  });
  worker = proc;
  stdoutBuf = "";
  stderrTail = [];
  proc.stdout?.setEncoding("utf8");
  proc.stdout?.on("data", (chunk: string) => {
    if (worker !== proc) return;
    stdoutBuf += chunk;
    let nl = stdoutBuf.indexOf("\n");
    while (nl >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (line) handleLine(line);
      nl = stdoutBuf.indexOf("\n");
    }
  });
  proc.stderr?.setEncoding("utf8");
  proc.stderr?.on("data", (chunk: string) => {
    for (const line of chunk.split(/\r?\n/)) {
      const t = line.replace(/\u001b\[[0-9;]*m/g, "").trim();
      if (!t) continue;
      stderrTail.push(t);
      if (stderrTail.length > 30) stderrTail.shift();
    }
  });
  proc.on("error", (err) => {
    if (worker !== proc) return;
    stopWorker(`không chạy được: ${err.message}`);
  });
  proc.on("close", (code) => {
    if (worker !== proc) return;
    const why = stderrTail.slice(-4).join("\n");
    stopWorker(`tiến trình thoát mã ${code}${why ? `: ${why}` : ""}`);
  });
  return proc;
}

function handleLine(line: string): void {
  let msg: WorkerRes;
  try {
    msg = JSON.parse(line) as WorkerRes;
  } catch {
    console.warn(`[gemini-web] bỏ qua dòng stdout không phải JSON: ${line.slice(0, 200)}`);
    return;
  }
  const p = pending.get(msg.id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(msg.id);
  p.resolve(msg);
}

function send(payload: Record<string, unknown>, timeoutMs: number): Promise<WorkerRes> {
  return new Promise((resolve, reject) => {
    let proc: ChildProcess;
    try {
      proc = worker && worker.exitCode === null && !worker.killed ? worker : startWorker();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      // Không cắt ngang được một lượt generate đang chạy - phải giết worker
      stopWorker("yêu cầu quá thời gian");
      reject(gatewayError("GATEWAY_TIMEOUT", `Gemini web không trả lời sau ${Math.round(timeoutMs / 1000)}s - thử lại.`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    proc.stdin?.write(`${JSON.stringify({ ...payload, id })}\n`, (err) => {
      if (!err) return;
      const p = pending.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(id);
      reject(gatewayError("GATEWAY_UNAVAILABLE", `Không gửi được lệnh cho worker Gemini web: ${err.message}`));
    });
  });
}

/** Hàng đợi tuần tự - một client Gemini, một hội thoại một lúc */
let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Phản hồi ok:false của worker → lỗi chuẩn của AIEV */
function workerError(res: WorkerRes): Error {
  const code = typeof res.code === "string" ? res.code : "FAILED";
  const raw = typeof res.message === "string" ? res.message : "";
  if (code === "NO_GEMINI_WEBAPI") {
    return gatewayError("GATEWAY_NOT_INSTALLED", `Venv gateway thiếu gói gemini-webapi. ${NOT_INSTALLED_HINT}`);
  }
  // Ở chế độ khách (cookie hỏng) Gemini trả lời bằng chữ "You might be signed out"
  if (code === "AUTH_FAILED" || /signed out|unauthenticated|cookies have expired/i.test(raw)) {
    return gatewayError(
      "GATEWAY_AUTH_FAILED",
      "Cookie Gemini sai hoặc đã hết hạn - mở gemini.google.com (đã đăng nhập), lấy lại __Secure-1PSID và __Secure-1PSIDTS rồi dán lại ở trang Kết nối.",
    );
  }
  if (code === "RATE_LIMITED") {
    return gatewayError(
      "GATEWAY_RATE_LIMITED",
      "Tài khoản Google đang bị giới hạn tạo ảnh (hết lượt hoặc tạm khóa) - thử lại sau.",
    );
  }
  if (code === "TIMEOUT") {
    return gatewayError("GATEWAY_TIMEOUT", "Gemini web tạo ảnh quá lâu (timeout) - thử lại.");
  }
  if (code === "NO_IMAGE") {
    return gatewayError(
      "GATEWAY_FAILED",
      `Gemini web không trả về ảnh nào (mô tả có thể bị từ chối, hoặc tài khoản/khu vực chưa bật tạo ảnh)${raw ? ` - Gemini nói: "${raw.slice(0, 200)}"` : ""}.`,
    );
  }
  return gatewayError("GATEWAY_FAILED", `Gemini web lỗi: ${raw.slice(0, 300) || code}`);
}

function recordResult(err: unknown): void {
  if (!err) {
    patchStore({ lastOkAt: new Date().toISOString(), lastError: null });
    return;
  }
  const code = (err as { code?: unknown }).code;
  patchStore({
    lastError: {
      code: typeof code === "string" ? code : "GATEWAY_FAILED",
      message: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    },
  });
}

/** Bảo đảm client trong worker đang đăng nhập đúng cookie đã lưu */
async function ensureInit(): Promise<void> {
  const store = readStore();
  if (!store) {
    throw gatewayError("INVALID_COOKIE", "Chưa nhập cookie Gemini - dán __Secure-1PSID ở trang Kết nối.");
  }
  const h = cookieHash(store);
  if (initedFor === h && worker) return;
  const res = await send({ cmd: "init", psid: store.psid, psidts: store.psidts ?? "" }, INIT_TIMEOUT_MS);
  if (!res.ok) throw workerError(res);
  initedFor = h;
}

// ---------------------------------------------------------------------------
// API cho routes
// ---------------------------------------------------------------------------

export function saveGeminiCookies(c: GeminiCookies): void {
  writeStore({ psid: c.psid, psidts: c.psidts, savedAt: new Date().toISOString(), lastOkAt: null, lastError: null });
  initedFor = null; // lần gọi kế tiếp init lại bằng cookie mới
}

export function deleteGeminiCookies(): void {
  fs.rmSync(gatewayPaths.geminiCookieFile, { force: true });
  stopWorker("đã xóa cookie");
  // Cache cookie xoay vòng của gemini_webapi (.cached_cookies_<PSID>.json) giữ
  // NGUYÊN phiên Google (PSID + PSIDTS + cookie phụ). Chỉ xóa file ở trên là UI
  // báo "đã xóa khỏi máy" mà phiên đăng nhập vẫn nằm trên đĩa.
  try {
    fs.rmSync(gatewayPaths.geminiCookieCache, { recursive: true, force: true, maxRetries: 3 });
  } catch (err) {
    console.warn(
      `[gemini-web] không xóa được cache cookie: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Đăng nhập thử bằng cookie đã lưu - không tạo ảnh (chậm, tốn lượt) */
export async function testGeminiWeb(): Promise<{ ok: boolean; message: string }> {
  if (!geminiWebInstalled()) {
    return { ok: false, message: `Chưa cài gateway Gemini web. ${NOT_INSTALLED_HINT}` };
  }
  if (!readStore()) return { ok: false, message: "Chưa nhập cookie Gemini." };
  try {
    await enqueue(async () => {
      initedFor = null; // ép đăng nhập lại thật, không tin client cũ
      await ensureInit();
    });
    recordResult(null);
    return { ok: true, message: "Cookie Gemini hợp lệ - sẵn sàng tạo ảnh bằng tài khoản Google web." };
  } catch (err) {
    recordResult(err);
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** Tạo một ảnh → đường dẫn file tạm (PNG/JPEG gốc của Gemini) trong outDir */
export async function generateGeminiWebImage(input: {
  prompt: string;
  width: number;
  height: number;
  outDir: string;
  model?: string;
}): Promise<string> {
  try {
    const file = await enqueue(async () => {
      await ensureInit();
      const res = await send(
        {
          cmd: "generate",
          prompt: input.prompt,
          size: `${input.width}x${input.height}`,
          outDir: input.outDir,
          model: input.model ?? "",
        },
        GENERATE_TIMEOUT_MS,
      );
      if (!res.ok) throw workerError(res);
      const f = typeof res.file === "string" ? res.file : "";
      if (!f || !fs.existsSync(f)) {
        throw gatewayError("GATEWAY_FAILED", "Gemini web báo xong nhưng không thấy file ảnh.");
      }
      return f;
    });
    recordResult(null);
    return file;
  } catch (err) {
    recordResult(err);
    throw err;
  }
}

/**
 * Bật worker sẵn khi server khởi động (nếu đã có cookie) để auto_refresh chạy
 * liên tục - không đợi tới lần tạo ảnh đầu, lúc đó cookie có thể đã chết.
 * Lỗi chỉ ghi log + lưu trạng thái, không bao giờ ném.
 */
export function warmGeminiWeb(): void {
  if (!geminiWebInstalled() || !readStore()) return;
  enqueue(() => ensureInit())
    .then(() => recordResult(null))
    .catch((err) => {
      recordResult(err);
      console.warn(`[gemini-web] đăng nhập lúc khởi động thất bại: ${err instanceof Error ? err.message : String(err)}`);
    });
}

/** Ping (dò worker sống + version gemini-webapi) - dùng cho kiểm thử */
export async function pingGeminiWeb(): Promise<WorkerRes> {
  return enqueue(() => send({ cmd: "ping" }, PING_TIMEOUT_MS));
}

export function shutdownGeminiWeb(): void {
  stopWorker("server tắt");
}

process.on("exit", () => {
  const proc = worker;
  worker = null;
  try {
    proc?.stdin?.end();
    proc?.kill();
  } catch {
    /* đã chết */
  }
});
