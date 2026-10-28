import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame } from "remotion";
import { sceneSpeedOf } from "../duration";
import { objectViewBoxCss, sceneTransformCss } from "../layerGeometry";
import type { Scene, Zoom } from "../manifest";
import { useMediaErrorProps, useMediaSrc } from "../media";
import { ColorBox } from "./ColorBox";

const videoStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

/**
 * Style thẻ media của scene: `fit` (mặc định cover - đúng hành vi cũ) + crop
 * bằng `object-view-box` (cắt NGUỒN rồi mới fit, không để lại viền đen).
 * Không khai gì → trả đúng object `videoStyle` cũ.
 */
const mediaStyleOf = (scene: Scene): React.CSSProperties => {
  const viewBox = objectViewBoxCss(scene.crop);
  if (!viewBox && (scene.fit ?? "cover") === "cover") return videoStyle;
  return {
    ...videoStyle,
    objectFit: scene.fit ?? "cover",
    // csstype chưa có objectViewBox - Chromium (render + Chrome/Edge) hỗ trợ
    ...(viewBox ? ({ objectViewBox: viewBox } as React.CSSProperties) : {}),
  };
};

/** Hệ số âm lượng fade vào/ra tại frame `f` (tính từ đầu scene) */
export const fadeEnvelope = (
  f: number,
  durationInFrames: number,
  fps: number,
  fadeInSec?: number,
  fadeOutSec?: number,
): number => {
  const inF = (fadeInSec ?? 0) * fps;
  const outF = (fadeOutSec ?? 0) * fps;
  const a = inF > 0 ? Math.min(1, Math.max(0, f / inF)) : 1;
  const b = outF > 0 ? Math.min(1, Math.max(0, (durationInFrames - f) / outF)) : 1;
  return Math.min(a, b);
};

/**
 * Lớp KHUNG của scene: transform (dịch/cỡ/xoay/lật) + chỉnh màu timeline.
 * Không khai transform/color thì trả children nguyên vẹn - cây DOM cũ.
 */
const FrameWrapper: React.FC<{ scene: Scene; children: React.ReactNode }> = ({
  scene,
  children,
}) => {
  const transform = sceneTransformCss(scene.transform);
  const colored = <ColorBox adjust={scene.color}>{children}</ColorBox>;
  if (!transform) return colored;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform }}>{colored}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const easeFns: Record<string, (t: number) => number> = {
  linear: (t) => t,
  // power3.out — vào nhanh rồi ghì lại, dùng cho punch-in nhấn
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/**
 * Hệ số scale tại `frame` (tính từ đầu scene) theo các mốc zoom.
 * Ngoài mốc đầu/cuối thì giữ nguyên scale của mốc đó (clamp).
 */
const scaleAtFrame = (zoom: Zoom, frame: number): number => {
  const keys = [...zoom.keys].sort((a, b) => a.frame - b.frame);
  if (frame <= keys[0].frame) {
    return keys[0].scale;
  }
  for (let i = 0; i < keys.length - 1; i += 1) {
    const from = keys[i];
    const to = keys[i + 1];
    if (frame <= to.frame) {
      const span = to.frame - from.frame;
      if (span <= 0) {
        return to.scale;
      }
      const t = (frame - from.frame) / span;
      const ease = easeFns[from.ease ?? "inOut"] ?? easeFns.inOut;
      return from.scale + (to.scale - from.scale) * ease(t);
    }
  }
  return keys[keys.length - 1].scale;
};

/**
 * Lớp bọc camera-move: scale trên DIV, KHÔNG bao giờ animate width/height của
 * thẻ video (đóng băng frame — xem skill noti-tiktok-vn). `overflow: hidden` +
 * video `object-fit: cover` để scale ≥ 1 không lộ mép nền.
 */
const ZoomWrapper: React.FC<{ zoom?: Zoom; children: React.ReactNode }> = ({
  zoom,
  children,
}) => {
  const frame = useCurrentFrame(); // 0 tại đầu scene (đang trong <Sequence>)

  if (!zoom) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scaleAtFrame(zoom, frame)})`,
          transformOrigin: zoom.origin ?? "50% 38%",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Một scene trên timeline:
 * - scene có `render` (MP4 do HyperFrames render) → phát nguyên file.
 * - scene có `srcVideo` (footage) → phát đoạn [from, to] (giây → frame theo fps).
 * - scene có `srcImage` (ảnh tĩnh đã stage) → hiện full-bleed cover suốt scene.
 * - chưa có media nào (vd mở Studio với defaultProps demo) → placeholder tối
 *   hiện id scene, để Studio mở được mà không cần file trong staging.
 *
 * Mọi đường dẫn là đường dẫn tương đối trong public/ (staging) → staticFile()
 * (qua useMediaSrc - trình phát trong dashboard thay resolver, xem media.tsx).
 */
export const SceneClip: React.FC<{
  scene: Scene;
  fps: number;
  /** Độ dài scene (frame) - cho fade âm ra; bỏ trống = không fade ra */
  durationInFrames?: number;
}> = ({ scene, fps, durationInFrames }) => {
  const mediaSrc = useMediaSrc();
  const errorProps = useMediaErrorProps();
  const mediaStyle = mediaStyleOf(scene);

  if (scene.render) {
    return (
      <FrameWrapper scene={scene}>
        <ZoomWrapper zoom={scene.zoom}>
          <OffthreadVideo src={mediaSrc(scene.render)} style={mediaStyle} {...errorProps(scene.render)} />
        </ZoomWrapper>
      </FrameWrapper>
    );
  }

  if (scene.srcVideo) {
    const speed = sceneSpeedOf(scene);
    const startFrom = Math.round((scene.from ?? 0) * fps);
    // endAt là frame NGUỒN, KHÔNG quy đổi theo speed: từ Remotion 4.0.537 (bản
    // đang ghim) Sequence bọc trong OffthreadVideo đã tự chia (endAt - startFrom)
    // cho playbackRate. Quy đổi thêm ở đây là chia hai lần - speed 2 thì video
    // tắt ở giữa scene, nửa sau nền đen (bản Remotion cũ không chia nên từng cần
    // phép quy đổi này cho speed < 1).
    const endAt = scene.to != null ? Math.round(scene.to * fps) : undefined;
    const baseVolume = scene.volume ?? 1;
    const hasFade = (scene.fadeInSec ?? 0) > 0 || (scene.fadeOutSec ?? 0) > 0;
    // Callback nhận frame tính từ đầu scene (Remotion trừ sẵn startFrom).
    // Không khai volume/fade → không truyền gì, giống hệt trước.
    const volume = hasFade
      ? (f: number) =>
          baseVolume *
          fadeEnvelope(f, durationInFrames ?? Infinity, fps, scene.fadeInSec, scene.fadeOutSec)
      : scene.volume !== undefined
        ? baseVolume
        : undefined;
    return (
      <FrameWrapper scene={scene}>
        <ZoomWrapper zoom={scene.zoom}>
          <OffthreadVideo
            src={mediaSrc(scene.srcVideo)}
            startFrom={startFrom}
            endAt={endAt}
            muted={scene.muted ?? false}
            {...(speed !== 1 ? { playbackRate: speed } : {})}
            {...(volume !== undefined ? { volume } : {})}
            style={mediaStyle}
            {...errorProps(scene.srcVideo)}
          />
        </ZoomWrapper>
      </FrameWrapper>
    );
  }

  if (scene.srcImage) {
    return (
      <FrameWrapper scene={scene}>
        <ZoomWrapper zoom={scene.zoom}>
          <Img src={mediaSrc(scene.srcImage)} style={mediaStyle} {...errorProps(scene.srcImage)} />
        </ZoomWrapper>
      </FrameWrapper>
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#101113",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          color: "#ffffff",
          opacity: 0.5,
          fontFamily: "Inter, sans-serif",
          fontSize: 40,
          fontWeight: 600,
        }}
      >
        {scene.id} (chưa render)
      </div>
    </AbsoluteFill>
  );
};
