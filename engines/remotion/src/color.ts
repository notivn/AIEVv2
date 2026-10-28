import React from "react";

/**
 * Chỉnh màu TRÊN TIMELINE (scene + layer) - docs/EDITOR-V2-PLAN.md mục 1.3.
 *
 * Khác tính năng grade asset bằng ffmpeg (apps/server/src/color.ts - đổi FILE):
 * ở đây chỉ là CSS `filter` + một <svg><feColorMatrix> inline cho nhiệt độ/tint
 * + một lớp vignette radial-gradient, chạy GIỐNG HỆT ở trình phát của dashboard
 * và khi render CLI (cả hai đều là Chromium vẽ cùng cây React).
 *
 * File thuần (React.createElement, không JSX) để test chạy thẳng bằng
 * `npx tsx --test` và web import lại được (`@engine/color`).
 */

/** Kiểu dữ liệu `color` của scene/layer - mọi field tùy chọn, 0 = giữ nguyên */
export interface ColorAdjust {
  /** id preset của apps/server/src/color.ts (14 preset) - id lạ bị bỏ qua */
  preset?: string;
  /** -1..1 */
  brightness?: number;
  /** -1..1 */
  contrast?: number;
  /** -1..1 (-1 = đen trắng) */
  saturation?: number;
  /** -1..1 (âm = lạnh/xanh, dương = ấm/cam) */
  temperature?: number;
  /** -1..1 (âm = xanh lá, dương = hồng) */
  tint?: number;
  /** độ -180..180 */
  hue?: number;
  /** 0..1 */
  vignette?: number;
  /** px 0..20 (px của composition - trình phát co giãn theo cùng tỉ lệ) */
  blur?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------- xấp xỉ grade ffmpeg

/**
 * Thông số chỉnh tay kiểu ffmpeg (khớp GradeAdjust của apps/server/src/color.ts).
 * Dùng cho (1) xem trước realtime trong modal chỉnh màu asset
 * (ProjectAssetsCard) và (2) xấp xỉ 14 preset khi áp lên timeline.
 */
export interface GradeAdjustLike {
  /** -0.3..0.3, mặc định 0 (eq brightness - CỘNG) */
  brightness: number;
  /** 0.7..1.4, mặc định 1 */
  contrast: number;
  /** 0..2, mặc định 1 */
  saturation: number;
  /** 0.7..1.4, mặc định 1 */
  gamma: number;
  /** 4000..9500 (K), mặc định 6500 = không đổi */
  temperature: number;
  /** -0.5..0.5, mặc định 0 */
  vibrance: number;
}

const GRADE_DEFAULT: GradeAdjustLike = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  gamma: 1,
  temperature: 6500,
  vibrance: 0,
};

/**
 * Xấp xỉ một bộ thông số grade bằng CSS filter (chuyển nguyên từ `cssApprox`
 * của ProjectAssetsCard.tsx). Gamma/nhiệt độ màu chỉ gần đúng - CSS không có
 * filter tương ứng 1:1. undefined = không đổi gì.
 */
export function gradeAdjustCss(a: GradeAdjustLike): string | undefined {
  const f: string[] = [];
  // eq brightness của FFmpeg là cộng (-1..1) → xấp xỉ bằng brightness nhân của CSS
  if (a.brightness !== 0) f.push(`brightness(${(1 + a.brightness).toFixed(3)})`);
  if (a.contrast !== 1) f.push(`contrast(${a.contrast.toFixed(3)})`);
  // vibrance gộp tương đối vào saturate
  const sat = a.saturation * (1 + a.vibrance * 0.6);
  if (sat !== 1) f.push(`saturate(${Math.max(0, sat).toFixed(3)})`);
  // gamma > 1 sáng vùng mid → xấp xỉ nhẹ bằng brightness
  if (a.gamma !== 1) f.push(`brightness(${(1 + (a.gamma - 1) * 0.5).toFixed(3)})`);
  if (a.temperature !== 6500) {
    const k = (6500 - a.temperature) / 2500; // >0 = ấm hơn, <0 = lạnh hơn
    if (k > 0) f.push(`sepia(${Math.min(0.45, k * 0.45).toFixed(3)})`);
    else f.push(`hue-rotate(${(Math.max(-1.2, k) * -10).toFixed(1)}deg)`);
  }
  return f.length ? f.join(" ") : undefined;
}

/**
 * 14 preset của apps/server/src/color.ts quy về thông số grade để xấp xỉ bằng
 * CSS. curves/colorbalance (tách tông bóng/sáng) không có bản CSS - quy về
 * tương phản + nhiệt độ gần nhất. Thêm preset bên server thì thêm ở đây;
 * id thiếu ở đây = preset không có tác dụng trên timeline (không lỗi).
 */
export const PRESET_APPROX: Record<string, Partial<GradeAdjustLike>> = {
  "tu-nhien": { contrast: 1.06, saturation: 1.12 },
  "tuoi-sang": { brightness: 0.03, contrast: 1.08, saturation: 1.22, vibrance: 0.15 },
  vivid: { contrast: 1.12, saturation: 1.3, vibrance: 0.25 },
  cinematic: { contrast: 1.08, saturation: 1.05, temperature: 6300 },
  "teal-orange": { contrast: 1.1, saturation: 1.15, temperature: 6100 },
  "film-vintage": { contrast: 0.9, saturation: 0.85, temperature: 6000 },
  "mau-phim": { brightness: 0.01, contrast: 0.97, saturation: 0.9 },
  "golden-hour": { brightness: 0.02, saturation: 1.1, temperature: 4800 },
  am: { saturation: 1.08, temperature: 5200 },
  lanh: { saturation: 1.05, temperature: 8200 },
  "dem-xanh": { brightness: -0.03, contrast: 1.1, saturation: 0.95, temperature: 9000 },
  moody: { brightness: -0.04, contrast: 1.18, saturation: 0.8, temperature: 6900 },
  pastel: { brightness: 0.05, contrast: 0.92, saturation: 0.85 },
  "den-trang": { contrast: 1.15, saturation: 0 },
};

// ---------------------------------------------------------------- ColorAdjust → CSS

const num = (v: unknown, min: number, max: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.min(max, Math.max(min, v));
};

const fx = (v: number): string => String(Math.round(v * 1000) / 1000);

/** Có cần <svg><feColorMatrix> (nhiệt độ / tint khác 0) không */
export function needsColorMatrix(adj: ColorAdjust | null | undefined): boolean {
  if (!adj) return false;
  return num(adj.temperature, -1, 1) !== 0 || num(adj.tint, -1, 1) !== 0;
}

/**
 * Chuỗi `values` của feColorMatrix cho nhiệt độ/tint (ma trận đường chéo 4x5).
 * Nhiệt độ dương: đẩy đỏ lên, kéo xanh dương xuống (ấm); tint dương: kéo xanh
 * lá xuống, nhích đỏ + xanh dương (hồng). Biên độ ±15% - đủ thấy, chưa cháy màu.
 */
export function colorMatrixValues(adj: ColorAdjust): string {
  const t = num(adj.temperature, -1, 1);
  const m = num(adj.tint, -1, 1);
  const r = 1 + 0.15 * t + 0.05 * m;
  const g = 1 - 0.12 * m;
  const b = 1 - 0.15 * t + 0.05 * m;
  return `${fx(r)} 0 0 0 0 0 ${fx(g)} 0 0 0 0 0 ${fx(b)} 0 0 0 0 0 1 0`;
}

/**
 * CSS `filter` của một ColorAdjust: preset (xấp xỉ) TRƯỚC, rồi chỉnh tay chồng
 * lên - cùng thứ tự với grade ffmpeg (preset → chỉnh tay).
 *
 * `svgFilterId` = id của <filter> mà <ColorDefs> vẽ ra cạnh phần tử; chỉ được
 * tham chiếu khi nhiệt độ/tint khác 0. undefined = không đổi gì (không đặt
 * thuộc tính filter - DOM giống hệt bản không chỉnh màu).
 */
export function colorFilterCss(
  adj: ColorAdjust | null | undefined,
  svgFilterId?: string,
): string | undefined {
  if (!adj) return undefined;
  const parts: string[] = [];
  if (typeof adj.preset === "string" && PRESET_APPROX[adj.preset]) {
    const preset = gradeAdjustCss({ ...GRADE_DEFAULT, ...PRESET_APPROX[adj.preset] });
    if (preset) parts.push(preset);
  }
  const brightness = num(adj.brightness, -1, 1);
  const contrast = num(adj.contrast, -1, 1);
  const saturation = num(adj.saturation, -1, 1);
  const hue = num(adj.hue, -180, 180);
  const blur = num(adj.blur, 0, 20);
  if (brightness !== 0) parts.push(`brightness(${fx(1 + brightness)})`);
  if (contrast !== 0) parts.push(`contrast(${fx(1 + contrast)})`);
  if (saturation !== 0) parts.push(`saturate(${fx(1 + saturation)})`);
  if (hue !== 0) parts.push(`hue-rotate(${fx(hue)}deg)`);
  if (svgFilterId && needsColorMatrix(adj)) parts.push(`url(#${svgFilterId})`);
  if (blur !== 0) parts.push(`blur(${fx(blur)}px)`);
  return parts.length ? parts.join(" ") : undefined;
}

/** Độ đậm vignette 0..1 (0 = không vẽ lớp vignette) */
export const vignetteAmount = (adj: ColorAdjust | null | undefined): number =>
  adj ? num(adj.vignette, 0, 1) : 0;

/** Nền của lớp vignette - tối dần từ 45% bán kính ra mép */
export const vignetteBackground = (amount: number): string =>
  `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${fx(
    Math.min(1, Math.max(0, amount)) * 0.85,
  )}) 100%)`;

/** id an toàn cho url(#...) - useId() của React có ":" làm hỏng tham chiếu CSS */
export const safeFilterId = (raw: string): string =>
  `aiev-color-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

/**
 * <svg> ẩn chứa <filter id> cho nhiệt độ/tint - đặt CẠNH phần tử dùng
 * `colorFilterCss(adj, id)`. Không cần (nhiệt độ/tint = 0) thì không vẽ gì.
 */
export const ColorDefs: React.FC<{ id: string; adjust?: ColorAdjust | null }> = ({ id, adjust }) => {
  if (!adjust || !needsColorMatrix(adjust)) return null;
  return React.createElement(
    "svg",
    {
      width: 0,
      height: 0,
      "aria-hidden": true,
      style: { position: "absolute", width: 0, height: 0, overflow: "hidden" },
    },
    React.createElement(
      "defs",
      null,
      React.createElement(
        "filter",
        { id, colorInterpolationFilters: "sRGB" },
        React.createElement("feColorMatrix", { type: "matrix", values: colorMatrixValues(adjust) }),
      ),
    ),
  );
};
