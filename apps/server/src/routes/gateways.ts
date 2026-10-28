import { Router } from "express";
import { HttpError } from "../util.js";
import {
  addChatgptAccount,
  chatgptAccountsKnown,
  chatgptGatewayRunning,
  chatgptGatewayUsed,
  deleteChatgptAccount,
  listChatgptAccounts,
  testChatgptGateway,
  type ChatgptAccount,
} from "../imageProviders/chatgptGateway.js";
import { NOT_INSTALLED_HINT } from "../imageProviders/errors.js";
import {
  deleteGeminiCookies,
  geminiWebInfo,
  saveGeminiCookies,
  testGeminiWeb,
  warmGeminiWeb,
} from "../imageProviders/geminiWeb.js";
import { parseChatgptSession, parseGeminiCookies } from "../imageProviders/parse.js";
import { chatgptGatewayInstalled, geminiWebInstalled } from "../imageProviders/runtime.js";

/**
 * Gateway tạo ảnh bằng tài khoản web (docs/EDITOR-V2-PLAN.md §4.3) - trang Kết nối.
 *
 * BẢO MẬT: token ChatGPT / cookie Google chỉ đi MỘT chiều (UI → server).
 * Không response nào trả lại giá trị thật - chỉ bản che (psidMasked) hoặc
 * thông tin tài khoản gateway đã soạn (email, gói, quota). Token ChatGPT
 * không lưu ở AIEV mà chuyển thẳng sang gateway.
 */
const router = Router();

// Bật worker Gemini web sẵn sau khi server ổn định (nếu đã có cookie) để
// auto_refresh cookie chạy liên tục - không đợi tới lần tạo ảnh đầu tiên.
setTimeout(() => warmGeminiWeb(), 20_000).unref?.();

// ---------------------------------------------------------------- ChatGPT web

// GET /api/gateways/chatgpt → {installed, running, accounts}
router.get("/chatgpt", async (_req, res) => {
  const installed = chatgptGatewayInstalled();
  let accounts: ChatgptAccount[] = [];
  let error: { code: string; message: string } | undefined;
  // Chỉ bật sidecar khi đã từng dùng (có DB tài khoản) - mở trang Kết nối lần
  // đầu không được tự kéo một tiến trình Python lên vô cớ
  // (DB có nhưng lần gần nhất đếm được 0 tài khoản thì cũng khỏi bật)
  if (installed && (chatgptGatewayRunning() || (chatgptGatewayUsed() && chatgptAccountsKnown() !== 0))) {
    try {
      accounts = await listChatgptAccounts();
    } catch (err) {
      error = {
        code: err instanceof HttpError ? err.code : "GATEWAY_FAILED",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
  res.json({ installed, running: chatgptGatewayRunning(), accounts, ...(error ? { error } : {}) });
});

// POST /api/gateways/chatgpt/accounts {session} → 201 account
router.post("/chatgpt/accounts", async (req, res) => {
  const session = ((req.body ?? {}) as Record<string, unknown>).session;
  const token = parseChatgptSession(session);
  if (!token) {
    throw new HttpError(
      400,
      "INVALID_SESSION",
      "Không tìm thấy accessToken. Đăng nhập chatgpt.com, mở https://chatgpt.com/api/auth/session rồi dán NGUYÊN nội dung JSON (hoặc chỉ giá trị accessToken).",
    );
  }
  if (!chatgptGatewayInstalled()) {
    throw new HttpError(503, "GATEWAY_NOT_INSTALLED", `Chưa cài gateway ChatGPT. ${NOT_INSTALLED_HINT}`);
  }
  const account = await addChatgptAccount(token);
  res.status(201).json(account);
});

// DELETE /api/gateways/chatgpt/accounts/:id → 204
router.delete("/chatgpt/accounts/:id", async (req, res) => {
  if (!chatgptGatewayInstalled()) {
    throw new HttpError(503, "GATEWAY_NOT_INSTALLED", `Chưa cài gateway ChatGPT. ${NOT_INSTALLED_HINT}`);
  }
  const removed = await deleteChatgptAccount(req.params.id);
  if (!removed) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản này trong gateway");
  res.status(204).end();
});

// POST /api/gateways/chatgpt/test → {ok, message}
router.post("/chatgpt/test", async (_req, res) => {
  if (!chatgptGatewayInstalled()) {
    res.json({ ok: false, message: `Chưa cài gateway ChatGPT. ${NOT_INSTALLED_HINT}` });
    return;
  }
  res.json(await testChatgptGateway());
});

// ---------------------------------------------------------------- Gemini web

// GET /api/gateways/gemini-web → {installed, configured, psidMasked?, status, lastOkAt?}
router.get("/gemini-web", (_req, res) => {
  res.json(geminiWebInfo());
});

// PUT /api/gateways/gemini-web/cookies {psid, psidts?} | {cookie} → {ok, message}
// Lưu xong đăng nhập thử luôn - người dùng biết ngay cookie dùng được hay không.
router.put("/gemini-web/cookies", async (req, res) => {
  const cookies = parseGeminiCookies((req.body ?? {}) as Record<string, unknown>);
  if (!cookies) {
    throw new HttpError(
      400,
      "INVALID_COOKIE",
      "Không tìm thấy cookie __Secure-1PSID. Mở gemini.google.com (đã đăng nhập) → F12 → Application → Cookies, chép giá trị __Secure-1PSID (và __Secure-1PSIDTS nếu có), hoặc dán cả chuỗi header Cookie.",
    );
  }
  saveGeminiCookies(cookies);
  if (!geminiWebInstalled()) {
    res.json({ ok: false, message: `Đã lưu cookie, nhưng chưa cài gateway Gemini web. ${NOT_INSTALLED_HINT}` });
    return;
  }
  const result = await testGeminiWeb();
  res.json(result.ok ? { ok: true, message: `Đã lưu cookie. ${result.message}` } : result);
});

// DELETE /api/gateways/gemini-web/cookies → 204
router.delete("/gemini-web/cookies", (_req, res) => {
  deleteGeminiCookies();
  res.status(204).end();
});

// POST /api/gateways/gemini-web/test → {ok, message}
router.post("/gemini-web/test", async (_req, res) => {
  res.json(await testGeminiWeb());
});

export default router;
