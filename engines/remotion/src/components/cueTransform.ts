import type { CueTransform } from "../manifest";

/**
 * `transform` của một cue (karaoke/phụ đề/highlight) -> phần CSS đặt TRƯỚC
 * animation vào-ra của hộp chữ. Dời tính theo khung composition (x · rộng,
 * y · cao), cỡ nhân chung với pop của animation - hộp vẫn nở từ chỗ neo cũ.
 *
 * Hộp mang `data-cue-kind` / `data-cue-index` (xem cueBoxAttrs): khung xem
 * trước của editor đo đúng hộp đang vẽ để bấm chọn và kéo, không đoán lại vị trí.
 */
export function cueOffsetCss(t: CueTransform | undefined, width: number, height: number): string {
  const x = (t?.x ?? 0) * width;
  const y = (t?.y ?? 0) * height;
  return x === 0 && y === 0 ? "" : `translate(${x}px, ${y}px) `;
}

export const cueScaleOf = (t: CueTransform | undefined): number => t?.scale ?? 1;

export const cueBoxAttrs = (kind: "caption" | "subtitle" | "overlay", index: number) => ({
  "data-cue-kind": kind,
  "data-cue-index": String(index),
});
