// Chạy: npx tsx --test src/layerGeometry.test.ts (trong engines/remotion)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  animFrames,
  keyframeValue,
  layerBox,
  objectViewBoxCss,
  sceneBox,
  sceneTransformCss,
  type LayerGeometryInput,
} from "./layerGeometry";

const W = 1080;
const H = 1920;
const FPS = 30;
const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

const shape = (over: Partial<LayerGeometryInput> = {}): LayerGeometryInput => ({
  kind: "shape",
  from: 100,
  durationInFrames: 60,
  ...over,
});

test("mặc định: giữa khung, rộng 0.5, shape 16:9", () => {
  const b = layerBox(shape(), 110, W, H, null, FPS);
  assert.equal(b.cx, W / 2);
  assert.equal(b.cy, H / 2);
  assert.equal(b.w, 540);
  near(b.h, 540 / (16 / 9));
  assert.equal(b.opacity, 1);
  assert.equal(b.visible, true);
});

test("x/y = vị trí tâm, -1..1 tính từ tâm khung", () => {
  const b = layerBox(shape({ transform: { x: 1, y: -0.5 } }), 110, W, H, null, FPS);
  assert.equal(b.cx, W);
  assert.equal(b.cy, H / 4);
});

test("scale nhân vào w/h, baseW giữ nguyên; image lấy tỉ lệ file + crop", () => {
  const b = layerBox(
    { kind: "image", from: 0, durationInFrames: 30, width: 0.4, transform: { scale: 2 }, crop: { left: 0.25, right: 0.25 } },
    5,
    W,
    H,
    1, // ảnh vuông
    FPS,
  );
  assert.equal(b.baseW, 432);
  assert.equal(b.w, 864);
  // crop 50% chiều ngang → tỉ lệ còn 0.5 → cao gấp đôi rộng
  near(b.baseH, 864);
  assert.equal(b.scale, 2);
});

test("ngoài khoảng thời gian → visible=false", () => {
  assert.equal(layerBox(shape(), 99, W, H, null, FPS).visible, false);
  assert.equal(layerBox(shape(), 160, W, H, null, FPS).visible, false);
  assert.equal(layerBox(shape(), 159, W, H, null, FPS).visible, true);
});

test("fade vào/ra 0.4s @30fps = 12 frame", () => {
  const l = shape({ animation: { in: "fade", out: "fade" } });
  assert.deepEqual(animFrames(l, FPS), { inFrames: 12, outFrames: 12 });
  assert.equal(layerBox(l, 100, W, H, null, FPS).opacity, 0);
  near(layerBox(l, 106, W, H, null, FPS).opacity, 0.5);
  assert.equal(layerBox(l, 130, W, H, null, FPS).opacity, 1);
  assert.equal(layerBox(l, 159, W, H, null, FPS).opacity, 0); // frame cuối
});

test("hiệu ứng không chồng nhau trên layer ngắn", () => {
  const l = shape({ durationInFrames: 10, animation: { in: "pop", out: "zoom", durationSec: 1 } });
  assert.deepEqual(animFrames(l, FPS), { inFrames: 5, outFrames: 5 });
});

test("slide-up vào từ DƯỚI, ra đi LÊN", () => {
  const l = shape({ animation: { in: "slide-up", out: "slide-up" } });
  assert.ok(layerBox(l, 101, W, H, null, FPS).cy > H / 2);
  assert.ok(layerBox(l, 158, W, H, null, FPS).cy < H / 2);
  assert.equal(layerBox(l, 130, W, H, null, FPS).cy, H / 2);
});

test("keyframe thay giá trị tĩnh, nội suy + ease", () => {
  const l = shape({
    transform: { x: 0.9, scale: 3 },
    keyframes: [
      { frame: 0, x: -1 },
      { frame: 20, x: 1, ease: "linear" },
      { frame: 10, scale: 1, ease: "out" },
      { frame: 30, scale: 2 },
    ],
  });
  // x: keyframe thắng transform.x
  assert.equal(layerBox(l, 100, W, H, null, FPS).cx, 0);
  assert.equal(layerBox(l, 110, W, H, null, FPS).cx, W / 2);
  assert.equal(layerBox(l, 140, W, H, null, FPS).cx, W); // sau mốc cuối: giữ
  // scale: trước mốc đầu giữ giá trị mốc đầu; ease out ở giữa > tuyến tính
  assert.equal(layerBox(l, 100, W, H, null, FPS).scale, 1);
  assert.ok(layerBox(l, 120, W, H, null, FPS).scale > 1.5);
  assert.equal(keyframeValue(l.keyframes, "rotate", 5), undefined);
});

test("text: ước lượng chiều cao theo số dòng, hoặc dùng tỉ lệ đo được", () => {
  const t: LayerGeometryInput = {
    kind: "text",
    from: 0,
    durationInFrames: 30,
    text: "Dòng 1\nDòng 2",
    style: { fontSizePx: 100, lineHeight: 1, paddingPx: 10 },
  };
  near(layerBox(t, 0, W, H, null, FPS).baseH, 220);
  near(layerBox(t, 0, W, H, 2, FPS).baseH, 270);
});

test("crop / scene transform CSS", () => {
  assert.equal(objectViewBoxCss(undefined), undefined);
  assert.equal(objectViewBoxCss({ top: 0.1, left: 0.9 }), "inset(10% 0% 0% 45%)");
  assert.equal(sceneTransformCss(undefined), undefined);
  assert.equal(sceneTransformCss({ x: 0, scale: 1 }), undefined);
  assert.equal(sceneTransformCss({ x: 0.25, flipH: true }), "translate(25%, 0%) rotate(0deg) scale(-1, 1)");
  const b = sceneBox({ x: 0.5, scale: 2 }, W, H);
  assert.equal(b.cx, W);
  assert.equal(b.w, 2 * W);
});
