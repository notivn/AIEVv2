import { HttpError } from "../util.js";

/**
 * Mã lỗi chung của các nhà cung cấp tạo ảnh (docs/EDITOR-V2-PLAN.md §4.3) -
 * route nào gọi gateway cũng ném đúng bộ này để UI xử lý được một kiểu.
 * Thông báo LUÔN tiếng Việt; lỗi tiếng Trung của chatgpt2api đi qua
 * translateGatewayError trước khi tới đây.
 */
export type GatewayErrorCode =
  | "INVALID_SESSION"
  | "INVALID_COOKIE"
  | "GATEWAY_NOT_INSTALLED"
  | "GATEWAY_UNAVAILABLE"
  | "GATEWAY_AUTH_FAILED"
  | "GATEWAY_RATE_LIMITED"
  | "GATEWAY_TIMEOUT"
  | "GATEWAY_FAILED";

const STATUS: Record<GatewayErrorCode, number> = {
  INVALID_SESSION: 400,
  INVALID_COOKIE: 400,
  GATEWAY_NOT_INSTALLED: 503,
  GATEWAY_UNAVAILABLE: 503,
  GATEWAY_AUTH_FAILED: 401,
  GATEWAY_RATE_LIMITED: 429,
  GATEWAY_TIMEOUT: 504,
  GATEWAY_FAILED: 502,
};

export function gatewayError(code: GatewayErrorCode, message: string): HttpError {
  return new HttpError(STATUS[code], code, message);
}

export const NOT_INSTALLED_HINT =
  "Vào Cấu hình → mục \"Image gateway\" → Cài tự động (hoặc chạy `node start/doctor.mjs --fix-one image-gateway`).";

/**
 * Dịch/ẩn lỗi TIẾNG TRUNG của chatgpt2api. Chỉ khớp mẫu tiếng Trung (+ vài
 * code riêng của gateway) - không khớp từ tiếng Anh chung kẻo dịch nhầm thông
 * báo của chính AIEV. Còn sót chữ Hán mà chưa khớp luật nào → câu chung tiếng
 * Việt: KHÔNG BAO GIỜ để chữ Hán lọt ra UI.
 * (Bảng luật lấy từ repo SEO-GEO src/lib/gateway/zh.ts, đã chạy thật.)
 */
export function translateGatewayError(raw: string): string {
  const msg = (raw ?? "").trim();
  const map: Array<[RegExp, string]> = [
    [/密钥无效|重新登录|invalid_api_key/, "Khóa nội bộ của gateway không khớp - khởi động lại server AIEV."],
    [/检测到敏感词/, "Nội dung chứa từ nhạy cảm nên ChatGPT từ chối."],
    [/审核未通过/, "Nội dung không qua kiểm duyệt của ChatGPT."],
    [/审核服务暂时不可用/, "Dịch vụ kiểm duyệt tạm thời không khả dụng - thử lại sau."],
    [/需要管理员/, "Thao tác cần quyền quản trị gateway."],
    [/暂无可用账号|没有可用|无可用账号|账号池为空|no_available_account/, "Chưa có tài khoản ChatGPT nào dùng được - thêm tài khoản ở trang Kết nối."],
    [/额度|限流|配额/, "Tài khoản ChatGPT đang bị giới hạn/hết lượt tạo ảnh - thử lại sau hoặc thêm tài khoản khác."],
    [/超时/, "Yêu cầu quá lâu (timeout) - thử lại."],
    [/需要.*Plus|需要.*会员/, "Model này cần tài khoản ChatGPT Plus/Team/Pro."],
    [/失效|过期/, "Phiên đăng nhập ChatGPT đã hết hạn - lấy lại session và nhập lại."],
  ];
  for (const [re, vi] of map) if (re.test(msg)) return vi;
  if (/[㐀-鿿]/.test(msg)) {
    return "Gateway ChatGPT báo lỗi - kiểm tra tài khoản ở trang Kết nối.";
  }
  return msg;
}

/**
 * Mã lỗi (failure code) của chatgpt2api → mã + câu tiếng Việt của AIEV.
 * Bảng mã lấy từ services/image_failure.py (FAILURE_POLICIES) của upstream.
 */
export function chatgptFailure(
  code: string,
  status: number,
  message: string,
): { code: GatewayErrorCode; message: string } {
  const c = code.toLowerCase();
  if (c === "auth_invalid" || c === "invalid_access_token" || c === "refresh_token_invalid" || status === 401) {
    return {
      code: "GATEWAY_AUTH_FAILED",
      message:
        "Phiên ChatGPT không hợp lệ hoặc đã hết hạn - mở https://chatgpt.com/api/auth/session, chép lại toàn bộ JSON rồi nhập lại.",
    };
  }
  if (c === "no_available_account") {
    return {
      code: "GATEWAY_UNAVAILABLE",
      message: "Chưa có tài khoản ChatGPT nào dùng được - thêm tài khoản ở trang Kết nối.",
    };
  }
  if (
    c.includes("rate_limit") ||
    c.includes("quota") ||
    c === "file_upload_throttled" ||
    c === "insufficient_quota" ||
    status === 429
  ) {
    return {
      code: "GATEWAY_RATE_LIMITED",
      message: "Tài khoản ChatGPT đã hết lượt tạo ảnh hoặc đang bị giới hạn - thử lại sau.",
    };
  }
  if (c.includes("timeout") || status === 504) {
    return { code: "GATEWAY_TIMEOUT", message: "ChatGPT tạo ảnh quá lâu (timeout) - thử lại." };
  }
  if (c === "content_policy_violation") {
    return {
      code: "GATEWAY_FAILED",
      message: "ChatGPT từ chối mô tả này (chính sách nội dung) - sửa lại mô tả rồi thử lại.",
    };
  }
  const vi = translateGatewayError(message);
  return {
    code: "GATEWAY_FAILED",
    message: `ChatGPT không tạo được ảnh${c ? ` (${c})` : ""}${vi ? `: ${vi}` : ""}`,
  };
}
