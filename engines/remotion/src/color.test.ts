// Chạy: npx tsx --test src/color.test.ts (trong engines/remotion)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PRESET_APPROX,
  colorFilterCss,
  colorMatrixValues,
  gradeAdjustCss,
  needsColorMatrix,
  vignetteAmount,
} from "./color";

test("không chỉnh gì = undefined (không đặt filter)", () => {
  assert.equal(colorFilterCss(undefined), undefined);
  assert.equal(colorFilterCss({}), undefined);
  assert.equal(colorFilterCss({ brightness: 0, contrast: 0, blur: 0 }), undefined);
  assert.equal(colorFilterCss({ preset: "khong-co" }), undefined);
});

test("chỉnh tay → filter CSS đúng thứ tự", () => {
  assert.equal(
    colorFilterCss({ brightness: 0.2, contrast: -0.5, saturation: -1, hue: 30, blur: 4 }),
    "brightness(1.2) contrast(0.5) saturate(0) hue-rotate(30deg) blur(4px)",
  );
});

test("kẹp giá trị ngoài khoảng", () => {
  assert.equal(colorFilterCss({ brightness: 5, blur: 99 }), "brightness(2) blur(20px)");
});

test("nhiệt độ/tint chỉ tham chiếu svg filter khi có id", () => {
  assert.equal(needsColorMatrix({ temperature: 0.5 }), true);
  assert.equal(needsColorMatrix({ tint: 0 }), false);
  assert.equal(colorFilterCss({ temperature: 0.5 }), undefined);
  assert.equal(colorFilterCss({ temperature: 0.5 }, "f1"), "url(#f1)");
  assert.equal(colorMatrixValues({ temperature: 1 }), "1.15 0 0 0 0 0 1 0 0 0 0 0 0.85 0 0 0 0 0 1 0");
});

test("preset đi TRƯỚC chỉnh tay", () => {
  const css = colorFilterCss({ preset: "den-trang", brightness: 0.1 });
  assert.equal(css, "contrast(1.150) saturate(0.000) brightness(1.1)");
  for (const id of Object.keys(PRESET_APPROX)) {
    assert.ok(colorFilterCss({ preset: id }), `preset ${id} phải ra filter`);
  }
  assert.equal(Object.keys(PRESET_APPROX).length, 14);
});

test("gradeAdjustCss = cssApprox cũ của ProjectAssetsCard", () => {
  const base = { brightness: 0, contrast: 1, saturation: 1, gamma: 1, temperature: 6500, vibrance: 0 };
  assert.equal(gradeAdjustCss(base), undefined);
  assert.equal(gradeAdjustCss({ ...base, temperature: 4000 }), "sepia(0.450)");
  assert.equal(gradeAdjustCss({ ...base, temperature: 9000 }), "hue-rotate(10.0deg)");
});

test("vignette kẹp 0..1", () => {
  assert.equal(vignetteAmount({ vignette: 2 }), 1);
  assert.equal(vignetteAmount(undefined), 0);
});
