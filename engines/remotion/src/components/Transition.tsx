import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { TransitionType } from "../manifest";

/**
 * Transition giữa hai scene. Mặc định cắt thẳng (overlap = 0).
 *
 * Scene TRƯỚC khai `transitionOverlap` = N frame (+ `transition.type`, mặc định
 * "fade") → scene SAU bắt đầu sớm N frame (Assemble trừ overlap khi cộng dồn
 * `from`) và nằm ĐÈ LÊN scene trước (Sequence render sau nằm trên).
 *
 * Mỗi scene được bọc một <Transition> biết CẢ HAI phía của nó:
 * - `enter` = chuyển cảnh ĐANG VÀO (lấy từ scene liền trước): chạy ở N frame đầu;
 * - `exit`  = chuyển cảnh ĐANG RA (của chính scene này sang scene kế): chạy ở N
 *   frame cuối. Chỉ các kiểu "đẩy" (slide/zoom/blur) mới đụng scene đang ra;
 *   fade/wipe/none chỉ làm ở scene đang vào (nó phủ lên trên).
 *
 * "fade" giữ ĐÚNG đường cong cũ (opacity tuyến tính 0 → 1 ở scene đang vào,
 * scene đang ra đứng yên) - project cũ không khai `transition` ra y hệt trước.
 * Tự viết bằng interpolate, không dùng @remotion/transitions (plan mục 1.1).
 */

export interface TransitionSide {
  type: TransitionType;
  /** Số frame chồng lấn (0 = cắt thẳng, không làm gì) */
  frames: number;
}

const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeInOut = Easing.inOut(Easing.cubic);

type Style = {
  opacity?: number;
  translateX?: number; // % bề rộng
  translateY?: number; // % chiều cao
  scale?: number;
  blur?: number; // px
  clipPath?: string;
};

/** Kiểu của scene ĐANG VÀO tại tiến độ p (0 = bắt đầu chồng, 1 = xong) */
export function enterStyle(type: TransitionType, p: number): Style {
  const e = easeInOut(p);
  switch (type) {
    case "fade":
      return { opacity: p };
    case "slide-left":
      return { translateX: (1 - e) * 100 };
    case "slide-right":
      return { translateX: -(1 - e) * 100 };
    case "slide-up":
      return { translateY: (1 - e) * 100 };
    case "slide-down":
      return { translateY: -(1 - e) * 100 };
    case "wipe-left":
      // Lộ dần từ mép PHẢI sang trái
      return { clipPath: `inset(0 0 0 ${(1 - e) * 100}%)` };
    case "wipe-right":
      return { clipPath: `inset(0 ${(1 - e) * 100}% 0 0)` };
    case "zoom-in":
      return { opacity: p, scale: 0.85 + 0.15 * e };
    case "zoom-out":
      return { opacity: p, scale: 1.2 - 0.2 * e };
    case "blur":
      return { opacity: p, blur: (1 - e) * 20 };
    case "none":
    default:
      return {};
  }
}

/** Kiểu của scene ĐANG RA tại tiến độ q (0 = bắt đầu chồng, 1 = scene kế phủ xong) */
export function exitStyle(type: TransitionType, q: number): Style {
  const e = easeInOut(q);
  switch (type) {
    case "slide-left":
      return { translateX: -e * 100 };
    case "slide-right":
      return { translateX: e * 100 };
    case "slide-up":
      return { translateY: -e * 100 };
    case "slide-down":
      return { translateY: e * 100 };
    case "zoom-in":
      return { scale: 1 + 0.2 * e };
    case "zoom-out":
      return { scale: 1 - 0.15 * e };
    case "blur":
      return { blur: e * 20 };
    default:
      // fade / wipe / none: scene đang vào phủ lên, scene đang ra đứng yên
      return {};
  }
}

function toCss(a: Style, b: Style): React.CSSProperties | undefined {
  const opacity = (a.opacity ?? 1) * (b.opacity ?? 1);
  const tx = (a.translateX ?? 0) + (b.translateX ?? 0);
  const ty = (a.translateY ?? 0) + (b.translateY ?? 0);
  const scale = (a.scale ?? 1) * (b.scale ?? 1);
  const blur = (a.blur ?? 0) + (b.blur ?? 0);
  const clipPath = a.clipPath ?? b.clipPath;
  const css: React.CSSProperties = {};
  if (opacity !== 1) css.opacity = opacity;
  const transforms: string[] = [];
  if (tx !== 0 || ty !== 0) transforms.push(`translate(${tx}%, ${ty}%)`);
  if (scale !== 1) transforms.push(`scale(${scale})`);
  if (transforms.length) css.transform = transforms.join(" ");
  if (blur > 0) css.filter = `blur(${blur}px)`;
  if (clipPath) css.clipPath = clipPath;
  return Object.keys(css).length ? css : undefined;
}

export const Transition: React.FC<{
  /** Chuyển cảnh đang vào (từ scene liền trước) - null/0 frame = cắt thẳng */
  enter?: TransitionSide | null;
  /** Chuyển cảnh đang ra (sang scene kế) - null/0 frame = không làm gì */
  exit?: TransitionSide | null;
  /** Độ dài scene (frame) - để biết N frame cuối bắt đầu ở đâu */
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ enter, exit, durationInFrames, children }) => {
  const frame = useCurrentFrame();

  let a: Style = {};
  if (enter && enter.frames > 0 && frame < enter.frames) {
    const p = interpolate(frame, [0, enter.frames], [0, 1], clampOpts);
    a = enterStyle(enter.type, p);
  }
  let b: Style = {};
  if (exit && exit.frames > 0) {
    const start = durationInFrames - exit.frames;
    if (frame >= start) {
      const q = interpolate(frame, [start, durationInFrames], [0, 1], clampOpts);
      b = exitStyle(exit.type, q);
    }
  }

  const style = toCss(a, b);
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
