import React, { useId } from "react";
import { ColorDefs, colorFilterCss, safeFilterId } from "../color";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { defaultFontSizePx, LAYER_DEFAULTS, layerBox, objectViewBoxCss } from "../layerGeometry";
import type { Layer } from "../manifest";
import { useMediaErrorProps, useMediaSrc } from "../media";
import { ColorBox } from "./ColorBox";
import { resolveSubtitleFont } from "./SubtitleTrack";
import { useVietnameseFont } from "./vietnameseFont";

/**
 * Track layer chồng (docs/EDITOR-V2-PLAN.md mục 1.2): mỗi layer một
 * <Sequence from durationInFrames>, vẽ theo thứ tự mảng (phần tử sau nằm trên).
 *
 * Vị trí/cỡ/xoay/độ mờ/hiệu ứng/keyframe đều từ `layerBox` (layerGeometry.ts) -
 * CHÍNH hàm mà khung kéo-thả của trình chỉnh sửa dùng. Hộp đặt TÂM tại (cx, cy)
 * với kích thước gốc baseW x baseH rồi CSS scale(), để chữ phóng cùng hộp.
 *
 * Màu mặc định (chữ trắng, khối đỏ primary) là màu của nội dung video - không
 * phải UI dashboard - nên viết thẳng ở đây như các track overlay khác.
 */

const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_SHAPE_COLOR = "#ed3c47";

const LayerItem: React.FC<{ layer: Layer }> = ({ layer }) => {
  const frame = useCurrentFrame(); // 0 tại layer.from (đang trong <Sequence>)
  const { width, height, fps } = useVideoConfig();
  const mediaSrc = useMediaSrc();
  const errorProps = useMediaErrorProps();

  // opacity 0 (frame đầu của fade vào) vẫn GẮN phần tử - bỏ ra rồi gắn lại là
  // thẻ video trong trình phát nạp lại từ đầu
  const box = layerBox(layer, layer.from + frame, width, height, layer.mediaAspect, fps);

  const isText = layer.kind === "text";
  const sx = box.scale * (box.flipH ? -1 : 1);
  const sy = box.scale * (box.flipV ? -1 : 1);
  const outer: React.CSSProperties = {
    position: "absolute",
    left: box.cx,
    top: box.cy,
    width: box.baseW,
    // Chữ: cao theo nội dung (hộp vẫn căn TÂM nhờ translate -50%)
    ...(isText ? {} : { height: box.baseH }),
    transform: `translate(-50%, -50%) rotate(${box.rotate}deg) scale(${sx}, ${sy})`,
    transformOrigin: "50% 50%",
    opacity: box.opacity,
  };

  let content: React.ReactNode = null;
  const radius = layer.radiusPx ?? 0;

  if ((layer.kind === "image" || layer.kind === "video") && layer.src) {
    const viewBox = objectViewBoxCss(layer.crop);
    const mediaStyle: React.CSSProperties = {
      width: "100%",
      height: "100%",
      objectFit: layer.fit ?? "cover",
      display: "block",
      ...(viewBox ? ({ objectViewBox: viewBox } as React.CSSProperties) : {}),
    };
    content =
      layer.kind === "image" ? (
        <Img src={mediaSrc(layer.src)} style={mediaStyle} {...errorProps(layer.src)} />
      ) : (
        <OffthreadVideo
          src={mediaSrc(layer.src)}
          startFrom={Math.round((layer.mediaStart ?? 0) * fps)}
          muted={layer.muted ?? true}
          volume={layer.volume ?? 1}
          style={mediaStyle}
          {...errorProps(layer.src)}
        />
      );
    content = (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: radius }}>
        <ColorBox adjust={layer.color}>{content}</ColorBox>
      </div>
    );
  } else if (layer.kind === "shape") {
    const st = layer.style ?? {};
    content = (
      <ColorBox adjust={layer.color}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: st.backgroundColor ?? DEFAULT_SHAPE_COLOR,
            borderRadius: st.radiusPx ?? radius,
            boxSizing: "border-box",
            ...(st.strokeWidthPx
              ? { border: `${st.strokeWidthPx}px solid ${st.strokeColor ?? DEFAULT_TEXT_COLOR}` }
              : {}),
            ...(st.shadow ? { boxShadow: "0 12px 40px rgba(0,0,0,0.35)" } : {}),
          }}
        />
      </ColorBox>
    );
  } else if (isText) {
    content = <TextContent layer={layer} />;
  }

  // data-layer-id: khung chọn của trình chỉnh sửa (CanvasOverlay) đo hộp chữ THẬT
  // (tự xuống dòng) thay vì ước lượng theo số dòng - không ảnh hưởng lúc render
  return (
    <div style={outer} data-layer-id={layer.id}>
      {content}
    </div>
  );
};

const TextContent: React.FC<{ layer: Layer }> = ({ layer }) => {
  useVietnameseFont();
  const filterId = safeFilterId(useId());
  const { width, height } = useVideoConfig();
  const mediaSrc = useMediaSrc();
  const st = layer.style ?? {};
  const font = resolveSubtitleFont(st.fontFamily);
  const fontSize = st.fontSizePx ?? defaultFontSizePx(width, height);
  const text = (
    <div
      style={{
        // block (không flex): text node chỉ có khoảng trắng không bị bỏ - xem SubtitleTrack
        display: "block",
        position: "relative",
        boxSizing: "border-box",
        width: "100%",
        fontFamily: font.stack,
        fontSize,
        fontWeight: st.fontWeight ?? 700,
        color: st.color ?? DEFAULT_TEXT_COLOR,
        textAlign: st.align ?? "center",
        lineHeight: st.lineHeight ?? LAYER_DEFAULTS.lineHeight,
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        padding: st.paddingPx ?? 0,
        borderRadius: st.radiusPx ?? 0,
        ...(st.backgroundColor ? { backgroundColor: st.backgroundColor } : {}),
        ...(st.strokeWidthPx
          ? {
              WebkitTextStroke: `${st.strokeWidthPx}px ${st.strokeColor ?? "#000000"}`,
              paintOrder: "stroke fill",
            }
          : {}),
        ...(st.shadow ? { textShadow: "0 4px 18px rgba(0,0,0,0.55)" } : {}),
      }}
    >
      {layer.text ?? ""}
    </div>
  );
  // Chỉnh màu cho chữ: filter thẳng lên khối chữ (ColorBox là AbsoluteFill -
  // khối chữ cao theo nội dung nên không bọc được). Vignette bỏ qua với chữ.
  const filter = colorFilterCss(layer.color, filterId);
  return (
    <>
      <style>{font.faceCss(mediaSrc)}</style>
      <ColorDefs id={filterId} adjust={layer.color} />
      {filter ? <div style={{ filter }}>{text}</div> : text}
    </>
  );
};

export const LayerTrack: React.FC<{ layers: Layer[] }> = ({ layers }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {layers.map((layer, index) => (
      <Sequence
        key={`${layer.id}-${index}`}
        from={layer.from}
        durationInFrames={layer.durationInFrames}
        layout="none"
      >
        <LayerItem layer={layer} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
