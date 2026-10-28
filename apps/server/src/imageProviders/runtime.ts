import fs from "node:fs";
import path from "node:path";
import { childEnv, paths, repoRoot } from "../config.js";

/**
 * Đường dẫn + môi trường chạy chung cho hai gateway tạo ảnh (ChatGPT web,
 * Gemini web). Cả hai là mã AGPL nằm ở <repo>/gateways/ và chạy thành TIẾN
 * TRÌNH RIÊNG bằng venv riêng `.runtime/venv-gateway` (Python >= 3.13) - không
 * trộn với `.runtime/venv` (torch, vieneu). Venv do `start/doctor.mjs` mục
 * "image-gateway" dựng; đổi đường dẫn ở đây là phải đổi cả bên đó.
 */

export const gatewayPaths = {
  gatewaysDir: path.join(repoRoot, "gateways"),
  chatgptDir: path.join(repoRoot, "gateways", "chatgpt"),
  chatgptLauncher: path.join(repoRoot, "gateways", "chatgpt", "aiev_launcher.py"),
  geminiWorker: path.join(repoRoot, "gateways", "gemini-web", "worker.py"),
  watermarkWorker: path.join(repoRoot, "gateways", "gemini-watermark-remover", "aiev-worker.mjs"),
  venv: path.join(paths.runtime.root, "venv-gateway"),
  /** Dữ liệu tài khoản ChatGPT của gateway (SQLite + file) - chứa token, gitignore qua .runtime/ */
  chatgptData: path.join(paths.runtime.root, "chatgpt-gateway"),
  /** Cache cookie xoay vòng của gemini_webapi (GEMINI_COOKIE_PATH) */
  geminiCookieCache: path.join(paths.runtime.root, "gemini-web"),
  /** Cookie Gemini người dùng dán - KHÔNG serve, apps/server/data/ đã gitignore */
  geminiCookieFile: path.join(paths.dataDir, "gemini-web.json"),
  /** Cấu hình chọn provider tạo ảnh (default) */
  providersFile: path.join(paths.dataDir, "image-providers.json"),
} as const;

/** Python của venv gateway, null nếu chưa dựng */
export function gatewayPython(): string | null {
  const exe =
    process.platform === "win32"
      ? path.join(gatewayPaths.venv, "Scripts", "python.exe")
      : path.join(gatewayPaths.venv, "bin", "python");
  return fs.existsSync(exe) ? exe : null;
}

/**
 * Đã cài chưa - chỉ kiểm có python + mã gateway trên đĩa (rẻ, gọi mỗi request
 * được). Thiếu gói Python thì tiến trình con tự báo khi khởi động, và trang
 * Cấu hình (doctor) mới là nơi dò kỹ từng module.
 */
export function chatgptGatewayInstalled(): boolean {
  return gatewayPython() !== null && fs.existsSync(gatewayPaths.chatgptLauncher);
}

export function geminiWebInstalled(): boolean {
  return gatewayPython() !== null && fs.existsSync(gatewayPaths.geminiWorker);
}

/** Biến môi trường có dạng bí mật - không đưa sang tiến trình bên thứ ba */
const SECRET_ENV_RE = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|COOKIE|PSID)/i;

/**
 * Env cho tiến trình gateway: childEnv() (TEMP/PIP cache về .runtime) nhưng
 * BỎ mọi biến trông như bí mật của AIEV (ANTHROPIC_API_KEY, GEMINI_API_KEY,
 * AIEV_API_TOKEN...). Gateway là mã bên thứ ba chạy riêng - nó chỉ cần đúng
 * những gì `extra` đưa vào.
 */
export function gatewayEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const base = childEnv();
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(base)) {
    if (SECRET_ENV_RE.test(k)) continue;
    env[k] = v;
  }
  return {
    ...env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
    // Không để Python mò sang site-packages của người dùng (~/.local, AppData)
    PYTHONNOUSERSITE: "1",
    ...extra,
  };
}
