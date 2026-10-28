import React, { useId } from "react";
import { AbsoluteFill } from "remotion";
import {
  ColorDefs,
  colorFilterCss,
  safeFilterId,
  vignetteAmount,
  vignetteBackground,
  type ColorAdjust,
} from "../color";

/**
 * Bọc nội dung một scene/layer bằng chỉnh màu timeline (color.ts): CSS filter
 * trên lớp bọc + <svg> filter cho nhiệt độ/tint + lớp vignette phủ trên.
 *
 * Không có `adjust` (hoặc toàn số 0) thì trả children NGUYÊN VẸN - project cũ
 * ra đúng cây DOM như trước, không thêm lớp nào.
 */
export const ColorBox: React.FC<{
  adjust?: ColorAdjust | null;
  children: React.ReactNode;
}> = ({ adjust, children }) => {
  const id = safeFilterId(useId());
  const filter = colorFilterCss(adjust, id);
  const vignette = vignetteAmount(adjust);
  if (!filter && vignette <= 0) return <>{children}</>;
  return (
    <AbsoluteFill>
      <ColorDefs id={id} adjust={adjust} />
      <AbsoluteFill style={filter ? { filter } : undefined}>{children}</AbsoluteFill>
      {vignette > 0 ? (
        <AbsoluteFill style={{ background: vignetteBackground(vignette), pointerEvents: "none" }} />
      ) : null}
    </AbsoluteFill>
  );
};
