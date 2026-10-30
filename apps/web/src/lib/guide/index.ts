import type { Lang } from "@/lib/i18n";
import type { GuideContent, GuideId } from "@/lib/guide/types";
import * as start from "@/lib/guide/content/start";
import * as make from "@/lib/guide/content/make";
import * as library from "@/lib/guide/content/library";
import * as system from "@/lib/guide/content/system";

export type { GuideBlock, GuideContent, GuideId, GuideSection } from "@/lib/guide/types";

/**
 * Nhóm mục trong menu của bảng Hướng dẫn. Thứ tự bám theo thanh điều hướng
 * trái (NAV trong Shell.tsx) để người dùng tìm ở đâu trong menu cũng giống
 * tìm trên sidebar. `labelKey` là key trong locales.
 */
export const GUIDE_GROUPS: { labelKey: string; ids: GuideId[] }[] = [
  {
    labelKey: "guide.group.start",
    ids: ["overview", "dashboard", "projects", "project-detail", "editor"],
  },
  {
    labelKey: "guide.group.make",
    ids: ["images", "auto-cut", "text-to-video", "translate-video", "voices"],
  },
  {
    labelKey: "guide.group.library",
    ids: ["styles", "video-styles", "assets", "sfx", "prompts", "skills"],
  },
  {
    labelKey: "guide.group.system",
    ids: ["queue", "config", "connections", "phone-upload", "troubleshooting"],
  },
];

/** Thứ tự đọc tuần tự - nút "Mục trước / Mục sau" đi theo thứ tự này */
export const GUIDE_ORDER: GuideId[] = GUIDE_GROUPS.flatMap((g) => g.ids);

const CONTENT: Record<Lang, GuideContent> = {
  vi: { ...start.vi, ...make.vi, ...library.vi, ...system.vi },
  en: { ...start.en, ...make.en, ...library.en, ...system.en },
};

export function guideContent(lang: Lang): GuideContent {
  return CONTENT[lang];
}

/**
 * Trang đang mở → mục hướng dẫn tương ứng. Bấm "Hướng dẫn" ở trang nào thì
 * mở đúng mục của trang đó chứ không mở từ đầu.
 *
 * Trang chi tiết dùng chung mục với trang danh sách (vd /auto-cut/<id> vẫn là
 * "auto-cut") - riêng Videos Project tách ba mục vì danh sách, trang project và
 * trình chỉnh sửa là ba màn hình làm ba việc khác nhau.
 */
export function guideIdFor(pathname: string): GuideId {
  const parts = pathname.split("/").filter(Boolean);
  const [first, second, third] = parts;
  switch (first) {
    case undefined:
      return "dashboard";
    case "projects":
      if (!second) return "projects";
      return third === "editor" ? "editor" : "project-detail";
    case "images":
    case "auto-cut":
    case "text-to-video":
    case "translate-video":
    case "voices":
    case "styles":
    case "video-styles":
    case "assets":
    case "sfx":
    case "prompts":
    case "skills":
    case "queue":
    case "config":
    case "connections":
      return first;
    default:
      return "overview";
  }
}
