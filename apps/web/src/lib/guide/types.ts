/**
 * Kiểu dữ liệu của bảng Hướng dẫn (GuidePanel).
 *
 * Nội dung hướng dẫn KHÔNG nằm trong locales/vi.ts + en.ts: đó là hàng trăm câu
 * dài theo cấu trúc (bước, gạch đầu dòng, mẹo), nhét thành key phẳng thì không
 * ai đọc nổi và check-i18n sẽ phải đếm cả nghìn key. Ở đây mỗi mục là một object
 * có kiểu, và `GuideContent` là Record theo `GuideId` - thiếu một mục ở một ngôn
 * ngữ thì tsc báo lỗi ngay, không lọt ra giao diện.
 */

export const GUIDE_IDS = [
  "overview",
  "dashboard",
  "projects",
  "project-detail",
  "editor",
  "images",
  "auto-cut",
  "text-to-video",
  "translate-video",
  "voices",
  "styles",
  "video-styles",
  "assets",
  "sfx",
  "prompts",
  "skills",
  "queue",
  "config",
  "connections",
  "phone-upload",
  "troubleshooting",
] as const;

export type GuideId = (typeof GUIDE_IDS)[number];

/**
 * Một khối nội dung. Mọi field đều tùy chọn, khối vẽ theo thứ tự:
 * heading → paragraphs → steps → bullets → tip → warning.
 *
 * Trong chuỗi được dùng `**chữ đậm**` (thường là tên nút/ô trên giao diện) -
 * đó là định dạng DUY NHẤT được hỗ trợ, không phải markdown đầy đủ.
 */
export interface GuideBlock {
  heading?: string;
  paragraphs?: string[];
  /** Các bước làm theo thứ tự - vẽ thành danh sách đánh số */
  steps?: string[];
  bullets?: string[];
  /** Mẹo - vẽ bằng Banner tone="info" */
  tip?: string;
  /** Điều cần tránh / dễ sai - vẽ bằng Banner tone="danger" */
  warning?: string;
}

export interface GuideSection {
  title: string;
  /** Một hai câu: phần này dùng để làm gì */
  summary: string;
  blocks: GuideBlock[];
}

export type GuideContent = Record<GuideId, GuideSection>;
