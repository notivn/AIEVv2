/**
 * Công thức thời lượng scene - THUẦN, không zod, không React, để mọi nơi cùng
 * import được (engine, trình phát của web qua `@engine/duration`).
 *
 * Bản sao song sinh: `sceneDurationFrames` trong apps/server/src/timeline.ts
 * (server không import được file ngoài `src/` của nó - rootDir của tsc). Sửa
 * công thức ở đây thì PHẢI sửa bên đó, lệch một frame là bản xem trước, bản
 * render và file XML xuất ra trượt khỏi nhau. Test: duration.test.ts.
 */

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;

/**
 * Tốc độ phát hiệu dụng của một scene footage: số hữu hạn trong
 * [SPEED_MIN, SPEED_MAX], còn lại (thiếu, sai kiểu, ngoài khoảng) = 1.
 * Validator của server từ chối giá trị ngoài khoảng trước khi lưu, nên nhánh
 * "rơi về 1" chỉ để engine không bao giờ chia cho 0 / số âm.
 */
export const sceneSpeedOf = (scene: { speed?: unknown }): number => {
  const v = scene.speed;
  return typeof v === "number" && Number.isFinite(v) && v >= SPEED_MIN && v <= SPEED_MAX ? v : 1;
};

/**
 * Số frame TIMELINE của một đoạn footage [from, to] (giây) phát ở `speed`.
 *
 * Làm tròn TỪNG ĐẦU trước (như SceneClip truyền startFrom/endAt cho
 * OffthreadVideo) rồi mới chia tốc độ: from=1.02, to=3.98 @30fps thì
 * round(2.96*30)=89 nhưng video chỉ phát 119-31=88 frame nguồn. speed = 1
 * → đúng công thức cũ từng frame (round của số nguyên là chính nó).
 */
export const footageDurationFrames = (
  from: number,
  to: number,
  fps: number,
  speed = 1,
): number => {
  const sourceFrames = Math.round(to * fps) - Math.round(from * fps);
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return Math.max(1, Math.round(sourceFrames / rate));
};

/**
 * Độ dài frame của một scene nhìn từ dữ liệu thô (không qua zod): ưu tiên
 * `durationInFrames`, rồi tới scene `srcVideo` có đủ from/to (tính cả `speed`).
 * null = chưa suy ra được (engine sẽ báo lỗi khi render).
 */
export const rawSceneDurationFrames = (
  scene: {
    durationInFrames?: unknown;
    srcVideo?: unknown;
    from?: unknown;
    to?: unknown;
    speed?: unknown;
  },
  fps: number,
): number | null => {
  if (typeof scene.durationInFrames === "number") return scene.durationInFrames;
  if (
    typeof scene.srcVideo === "string" &&
    scene.srcVideo &&
    typeof scene.from === "number" &&
    typeof scene.to === "number"
  ) {
    return footageDurationFrames(scene.from, scene.to, fps, sceneSpeedOf(scene));
  }
  return null;
};
