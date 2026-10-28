/**
 * Hàm THUẦN tách thông tin đăng nhập người dùng dán vào trang Kết nối - không
 * đụng đĩa/mạng để test được (parse.test.ts). Người dùng dán đủ kiểu: nguyên
 * JSON của chatgpt.com/api/auth/session, chỉ accessToken, "Bearer ...", cả
 * chuỗi header Cookie copy từ DevTools, hay một dòng "__Secure-1PSID=...".
 */

/** JWT: ba khúc base64url, khúc đầu là header JSON nên luôn bắt đầu bằng "eyJ" */
const JWT_RE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function stripQuotes(s: string): string {
  return s.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

/**
 * accessToken từ thứ người dùng dán. null = không tìm thấy (route trả
 * 400 INVALID_SESSION). Không kiểm token còn hạn - đó là việc của gateway.
 */
export function parseChatgptSession(input: unknown): string | null {
  if (typeof input === "object" && input !== null) {
    return tokenFromObject(input as Record<string, unknown>);
  }
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      return tokenFromObject(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      // JSON hỏng (dán thiếu một đoạn) - vẫn thử móc "accessToken":"..." bằng regex
      const m = /"(?:accessToken|access_token)"\s*:\s*"([^"]+)"/.exec(raw);
      return m && JWT_RE.test(m[1]) ? m[1] : null;
    }
  }
  const bare = stripQuotes(raw.replace(/^authorization\s*:\s*/i, "").replace(/^bearer\s+/i, ""));
  return JWT_RE.test(bare) ? bare : null;
}

function tokenFromObject(obj: Record<string, unknown>): string | null {
  for (const key of ["accessToken", "access_token", "token"]) {
    const v = obj[key];
    if (typeof v === "string" && JWT_RE.test(v.trim())) return v.trim();
  }
  return null;
}

export interface GeminiCookies {
  psid: string;
  psidts: string | null;
}

/**
 * __Secure-1PSID (+ __Secure-1PSIDTS nếu có) từ body PUT cookies:
 * `{psid, psidts?}` hoặc `{cookie}` (cả chuỗi header Cookie, hay vài dòng
 * "tên=giá trị" / "tên<TAB>giá trị" chép từ bảng Cookies của DevTools).
 * null = không có PSID (route trả 400 INVALID_COOKIE).
 */
export function parseGeminiCookies(body: Record<string, unknown>): GeminiCookies | null {
  if (typeof body.psid === "string" && body.psid.trim()) {
    const psid = cleanCookieValue(body.psid.replace(/^__Secure-1PSID\s*[=:\t]\s*/i, ""));
    if (!validCookieValue(psid)) return null;
    const tsRaw =
      typeof body.psidts === "string"
        ? cleanCookieValue(body.psidts.replace(/^__Secure-1PSIDTS\s*[=:\t]\s*/i, ""))
        : "";
    return { psid, psidts: validCookieValue(tsRaw) ? tsRaw : null };
  }
  if (typeof body.cookie === "string") return parseCookieHeader(body.cookie);
  return null;
}

export function parseCookieHeader(header: string): GeminiCookies | null {
  const jar = new Map<string, string>();
  const text = header.replace(/^cookie\s*:\s*/i, "");
  // Tách theo ";" (header) VÀ xuống dòng (bảng DevTools) - mỗi mẩu "tên=giá trị"
  // hoặc "tên<TAB>giá trị<TAB>domain..."
  for (const piece of text.split(/[;\r\n]+/)) {
    const part = piece.trim();
    if (!part) continue;
    const m = /^([A-Za-z0-9_.-]+)\s*(?:=|\t)\s*([^\t]*)/.exec(part);
    if (!m) continue;
    jar.set(m[1], cleanCookieValue(m[2]));
  }
  const psid = jar.get("__Secure-1PSID") ?? "";
  if (!validCookieValue(psid)) return null;
  const psidts = jar.get("__Secure-1PSIDTS") ?? "";
  return { psid, psidts: validCookieValue(psidts) ? psidts : null };
}

function cleanCookieValue(v: string): string {
  return stripQuotes(v).replace(/;+$/, "").trim();
}

/** Giá trị cookie hợp lệ: không rỗng, không khoảng trắng/ký tự điều khiển, đủ dài */
function validCookieValue(v: string): boolean {
  return v.length >= 10 && v.length <= 4096 && !/[\s;,\u0000-\u001f]/.test(v);
}

/** Che bí mật: 6 đầu + 4 cuối (khớp maskKey của routes/connections.ts) */
export function maskSecret(v: string): string {
  if (v.length <= 12) return `${v.slice(0, 3)}…`;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}
