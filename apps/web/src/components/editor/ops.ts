/**
 * Mọi thao tác sửa timeline - HÀM THUẦN trên `Timeline` (không React, không
 * fetch, không Date.now). Store chỉ việc gọi chúng; kéo/thả, phím tắt và
 * inspector đều đi qua đây nên luật (kẹp độ dài, giữ field lạ…) nằm ở MỘT chỗ.
 *
 * Ba luật cho mọi hàm:
 * 1. Không bao giờ sửa object đầu vào - sao nông đúng nhánh bị đổi, phần còn
 *    lại giữ nguyên identity (trình phát và React so identity để biết cái gì đổi).
 * 2. Giữ NGUYÊN field lạ (meta.json là looseObject - agent hay ghi thêm field):
 *    sửa bằng spread trên bản cũ, không dựng object mới từ đầu. Tách đôi thì cả
 *    hai nửa đều mang đủ field lạ (structuredClone).
 * 3. Thao tác vô nghĩa (tách đúng mép, kéo 0 frame, chỉ số sai…) trả về CHÍNH
 *    timeline đầu vào - store dựa vào đó để không đẻ bước hoàn tác rỗng.
 *
 * Đơn vị theo hợp đồng (docs/EDITOR-PLAN.md mục 1): scene `from`/`to` là GIÂY
 * trong file nguồn; cue, `sfx.atFrame`, `words[].start/end` là FRAME TUYỆT ĐỐI.
 */

import type {
  Timeline,
  TimelineCaptionCue,
  TimelineHighlightCue,
  TimelineHighlightPart,
  TimelineMusic,
  TimelinePreview,
  TimelineScene,
  TimelineSfx,
  TimelineSubtitleCue,
  TimelineSubtitleStyle,
  TimelineZoom,
  TimelineZoomKey,
  TimelineCaptionWord,
  TimelineCueTransform,
} from "@/lib/api";
import { SPEED_MAX, SPEED_MIN, sceneSpeedOf as engineSceneSpeedOf } from "@engine/duration";
import { CUE_SCALE_MAX, CUE_SCALE_MIN } from "@engine/manifest";
import { keyframeValue, type LayerKeyframe as EngineLayerKeyframe } from "@engine/layerGeometry";
import { effectiveOverlap, sceneDurationFrames } from "./timing";

// ================================================================ kiểu chung

export type CueKind = "captions" | "subtitles" | "overlays";
export type CueSelKind = "caption" | "subtitle" | "overlay";

/**
 * Phần tử đang chọn. Scene và layer theo `id` (đổi thứ tự / đổi lớp không lạc),
 * phần còn lại theo chỉ số.
 */
export type Selection =
  | { kind: "scene"; id: string }
  | { kind: "layer"; id: string }
  | { kind: CueSelKind; index: number }
  | { kind: "sfx"; index: number }
  | { kind: "music" }
  | { kind: "voice" };

export const CUE_KIND: Record<CueSelKind, CueKind> = {
  caption: "captions",
  subtitle: "subtitles",
  overlay: "overlays",
};

export const isCueSel = (kind: Selection["kind"]): kind is CueSelKind =>
  kind === "caption" || kind === "subtitle" || kind === "overlay";

export const sameSelection = (a: Selection | null, b: Selection | null): boolean => {
  if (a === b) return true;
  if (!a || !b || a.kind !== b.kind) return false;
  if ("id" in a && "id" in b) return a.id === b.id;
  if ("index" in a && "index" in b) return a.index === b.index;
  return true;
};

/** Thông tin ngoài timeline mà vài thao tác cần (fps, độ dài file media thật). */
export interface OpsContext {
  fps: number;
  /** durationSec của file media (đường dẫn tương đối project); null = chưa biết */
  mediaDurationSec: (relPath: string) => number | null;
  /** File xem trước (render HyperFrames) của scene; null = chưa render */
  sceneRender: (scene: TimelineScene) => string | null;
}

export function contextFromPreview(preview: TimelinePreview, fps: number): OpsContext {
  return {
    fps,
    mediaDurationSec: (rel) => {
      const d = preview.media[rel]?.durationSec;
      return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : null;
    },
    sceneRender: (scene) => {
      if (isNonEmpty(scene.src)) return preview.sceneRenders[scene.id] ?? null;
      return isNonEmpty(scene.render) ? scene.render : null;
    },
  };
}

const isNonEmpty = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** Giây ghi vào meta: căn đúng lưới frame, đủ 6 chữ số để round(x*fps) ra lại đúng frame. */
const frameToSec = (frame: number, fps: number): number =>
  Math.round((frame / fps) * 1e6) / 1e6;

const clampInt = (v: number, lo: number, hi: number): number =>
  Math.round(Math.min(hi, Math.max(lo, v)));

/**
 * Áp patch NÔNG lên một object, giữ mọi field khác (kể cả field lạ). Giá trị
 * `undefined` trong patch = XÓA khóa đó (người dùng xóa trắng một ô tùy chọn).
 * Không có gì đổi thì trả lại chính object cũ.
 */
export function applyPatch<T extends object>(obj: T, patch: Partial<T>): T {
  let changed = false;
  const next = { ...obj };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      if (Reflect.has(next, key)) {
        Reflect.deleteProperty(next, key);
        changed = true;
      }
    } else if (Reflect.get(next, key) !== value) {
      Reflect.set(next, key, value);
      changed = true;
    }
  }
  return changed ? next : obj;
}

function replaceAt<T>(list: T[], index: number, item: T): T[] {
  if (list[index] === item) return list;
  const next = list.slice();
  next[index] = item;
  return next;
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ================================================================ scene

export type SceneKind = "footage" | "image" | "hyperframes" | "render" | "empty";

/**
 * Scene phát cái gì - đúng thứ tự ưu tiên của SceneClip sau khi
 * buildPreviewManifest đã gắn `render` cho scene HyperFrames.
 */
export function sceneKind(scene: TimelineScene): SceneKind {
  if (isNonEmpty(scene.src)) return "hyperframes";
  if (isNonEmpty(scene.srcVideo)) return "footage";
  if (isNonEmpty(scene.srcImage)) return "image";
  if (isNonEmpty(scene.render)) return "render";
  return "empty";
}

/**
 * File media có trên đĩa không, theo `preview.mediaVersions` (server chỉ ghi
 * khóa cho file TỒN TẠI). Không có mediaVersions (server cũ) = không biết →
 * coi như có, đừng báo động giả.
 */
export function isMediaMissing(preview: TimelinePreview, rel: unknown): boolean {
  if (typeof rel !== "string" || !rel) return false;
  const versions = preview.mediaVersions;
  return !!versions && !Object.prototype.hasOwnProperty.call(versions, rel);
}

/**
 * File nguồn của scene bị thiếu (footage/ảnh/render khai tay) - null = đủ.
 * Scene HyperFrames chưa render KHÔNG tính là thiếu (đó là "chưa render").
 */
export function sceneMissingMedia(scene: TimelineScene, preview: TimelinePreview): string | null {
  const kind = sceneKind(scene);
  const rel = kind === "footage" || kind === "image" || kind === "render" ? sceneSourcePath(scene) : null;
  return rel && isMediaMissing(preview, rel) ? rel : null;
}

/** Đường dẫn file mà scene hiển thị (để làm nhãn) - null nếu không có. */
export function sceneSourcePath(scene: TimelineScene): string | null {
  switch (sceneKind(scene)) {
    case "hyperframes":
      return scene.src ?? null;
    case "footage":
      return scene.srcVideo ?? null;
    case "image":
      return scene.srcImage ?? null;
    case "render":
      return scene.render ?? null;
    default:
      return null;
  }
}

/**
 * Độ dài TỐI ĐA (frame) của scene theo file thật: HyperFrames không dài hơn bản
 * render (SceneClip phát render từ frame 0, dài hơn là khung đen). null = không giới hạn.
 */
export function sceneMaxFrames(scene: TimelineScene, ctx: OpsContext): number | null {
  const kind = sceneKind(scene);
  if (kind !== "hyperframes" && kind !== "render") return null;
  const render = ctx.sceneRender(scene);
  const sec = render ? ctx.mediaDurationSec(render) : null;
  return sec === null ? null : Math.max(1, Math.floor(sec * ctx.fps + 1e-6));
}

/** Giới hạn tốc độ phát footage (docs/EDITOR-V2-PLAN.md mục 1.1) - nguồn: @engine/duration. */
export { SPEED_MAX, SPEED_MIN };

/**
 * Tốc độ phát hiệu lực của scene footage - ĐÚNG hàm của engine (vắng/sai kiểu/
 * ngoài khoảng = 1). Thời lượng trên timeline = (to - from) / speed, nên
 * trim/tách đổi frame TIMELINE ra frame FILE bằng hệ số này.
 */
export const sceneSpeedOf = (scene: TimelineScene): number =>
  engineSceneSpeedOf(scene as { speed?: unknown });

/** frame timeline → frame trong file footage (theo tốc độ). */
const toFileFrames = (frames: number, speed: number): number => Math.round(frames * speed);
/**
 * Độ dài trên timeline của đoạn [in, out) frame file - cùng công thức với
 * `footageDurationFrames` của engine (làm tròn từng đầu trước, rồi chia tốc độ).
 */
const toTimelineFrames = (fileFrames: number, speed: number): number =>
  Math.max(1, Math.round(fileFrames / speed));

/** Khung [inFrame, outFrame) trong file footage (frame FILE) - null nếu chưa đủ dữ liệu. */
export function footageWindow(
  scene: TimelineScene,
  fps: number,
): { inFrame: number; outFrame: number } | null {
  if (sceneKind(scene) !== "footage") return null;
  const inFrame = Math.round((scene.from ?? 0) * fps);
  if (typeof scene.to === "number") return { inFrame, outFrame: Math.round(scene.to * fps) };
  if (typeof scene.durationInFrames === "number") {
    return { inFrame, outFrame: inFrame + toFileFrames(scene.durationInFrames, sceneSpeedOf(scene)) };
  }
  return null;
}

export const sceneIndexById = (tl: Timeline, id: string): number =>
  tl.scenes.findIndex((s) => s.id === id);

/** Id chưa dùng: "a1" → "a1-2", "a1-3"… (bỏ hậu tố số cũ trước khi đếm). */
export function uniqueSceneId(scenes: TimelineScene[], base: string): string {
  const taken = new Set(scenes.map((s) => s.id));
  const stem = base.replace(/-\d+$/, "") || "scene";
  for (let n = 2; ; n += 1) {
    const candidate = `${stem}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function reorderScene(tl: Timeline, from: number, to: number): Timeline {
  const n = tl.scenes.length;
  if (from < 0 || from >= n) return tl;
  const target = clampInt(to, 0, n - 1);
  if (target === from) return tl;
  return { ...tl, scenes: moveItem(tl.scenes, from, target) };
}

/**
 * Dời scene `id` sớm hơn (-1) / muộn hơn (+1) một vị trí - bàn phím thay cho
 * kéo-thả đổi thứ tự (Alt+←/→). Đã ở đầu/cuối thì trả lại chính timeline.
 */
export function moveSceneBy(tl: Timeline, id: string, step: -1 | 1): Timeline {
  const from = sceneIndexById(tl, id);
  if (from < 0) return tl;
  const to = from + step;
  if (to < 0 || to >= tl.scenes.length) return tl;
  return reorderScene(tl, from, to);
}

/**
 * Kéo mép scene `delta` frame. Scene nối tuần tự nên đây là trim "ripple":
 * mọi scene phía sau tự dời theo.
 * - footage: mép đầu đổi `from`, mép cuối đổi `to` (giây, căn lưới frame), kẹp
 *   trong [0, độ dài file]; scene có cả `durationInFrames` thì cập nhật luôn cho
 *   khớp (engine ưu tiên durationInFrames).
 * - ảnh / scene chỉ có durationInFrames: đổi độ dài (mép nào cũng vậy).
 * - HyperFrames: chỉ mép cuối, không dài hơn bản render.
 * Luôn còn ít nhất 1 frame.
 */
export function trimScene(
  tl: Timeline,
  index: number,
  edge: "start" | "end",
  delta: number,
  ctx: OpsContext,
): Timeline {
  return withPunchInRetimed(tl, trimSceneRaw(tl, index, edge, delta, ctx), index, ctx.fps);
}

function trimSceneRaw(
  tl: Timeline,
  index: number,
  edge: "start" | "end",
  delta: number,
  ctx: OpsContext,
): Timeline {
  const scene = tl.scenes[index];
  if (!scene || !Number.isFinite(delta)) return tl;
  const d = Math.round(delta);
  if (d === 0) return tl;
  const { fps } = ctx;
  const kind = sceneKind(scene);

  if (kind === "footage") {
    const win = footageWindow(scene, fps);
    if (!win) return tl;
    const mediaSec = scene.srcVideo ? ctx.mediaDurationSec(scene.srcVideo) : null;
    const mediaFrames =
      mediaSec === null ? Number.POSITIVE_INFINITY : Math.floor(mediaSec * fps + 1e-6);
    // Kéo d frame TIMELINE = d × tốc độ frame trong FILE (tua nhanh 2x: kéo 1 frame ăn 2 frame file)
    const speed = sceneSpeedOf(scene);
    const fd = toFileFrames(d, speed);
    if (fd === 0) return tl;
    let { inFrame, outFrame } = win;
    const patch: Partial<TimelineScene> = {};
    if (edge === "start") {
      inFrame = clampInt(inFrame + fd, 0, outFrame - 1);
      if (inFrame === win.inFrame) return tl;
      patch.from = frameToSec(inFrame, fps);
      // Chưa có `to` (độ dài lấy từ durationInFrames) thì ghi `to` cũ để mép cuối đứng yên
      if (typeof scene.to !== "number") patch.to = frameToSec(outFrame, fps);
    } else {
      // Đã dài quá file sẵn (dữ liệu cũ) thì không cho dài thêm, nhưng vẫn cho co lại
      const upper = Math.max(outFrame, mediaFrames);
      outFrame = clampInt(outFrame + fd, inFrame + 1, upper);
      if (outFrame === win.outFrame) return tl;
      patch.to = frameToSec(outFrame, fps);
      if (typeof scene.from !== "number") patch.from = 0;
    }
    if (typeof scene.durationInFrames === "number") patch.durationInFrames = toTimelineFrames(outFrame - inFrame, speed);
    return { ...tl, scenes: replaceAt(tl.scenes, index, applyPatch(scene, patch)) };
  }

  if (typeof scene.durationInFrames !== "number") return tl;
  if ((kind === "hyperframes" || kind === "render") && edge === "start") return tl;
  const cur = scene.durationInFrames;
  const max = sceneMaxFrames(scene, ctx);
  const upper = max === null ? Number.POSITIVE_INFINITY : Math.max(max, cur);
  const next = clampInt(edge === "end" ? cur + d : cur - d, 1, upper);
  if (next === cur) return tl;
  return {
    ...tl,
    scenes: replaceAt(tl.scenes, index, applyPatch(scene, { durationInFrames: next })),
  };
}

// ---- zoom (camera move) - mirror của scaleAtFrame trong SceneClip

/**
 * Punch-in ĐƠN GIẢN (đúng 2 mốc: frame 0 và cuối scene - thứ inspector tạo ra)
 * phải đi theo độ dài scene: trim/đổi độ dài mà mốc cuối đứng yên thì scene
 * dài ra là zoom dừng sớm rồi đứng hình, ngắn đi là zoom bị cắt giữa chừng.
 * Mốc cuối "đang ở cuối" = frame dur-1 hoặc dur (bản cũ ghi dur). Zoom tùy
 * biến (nhiều mốc, AI viết) thì không đoán - giữ nguyên.
 */
function retimePunchIn(scene: TimelineScene, oldDur: number | null, newDur: number | null): TimelineScene {
  const keys = scene.zoom?.keys;
  if (!scene.zoom || !Array.isArray(keys) || keys.length !== 2 || oldDur === null || newDur === null) return scene;
  if (oldDur === newDur) return scene;
  const [a, b] = sortKeys(keys);
  if (!a || !b || a.frame !== 0 || (b.frame !== oldDur - 1 && b.frame !== oldDur)) return scene;
  const end = Math.max(1, newDur - 1);
  if (b.frame === end) return scene;
  return { ...scene, zoom: { ...scene.zoom, keys: [a, { ...b, frame: end }] } };
}

/** Bọc một thao tác đổi độ dài scene `index`: punch-in đơn giản đi theo (retimePunchIn). */
function withPunchInRetimed(before: Timeline, after: Timeline, index: number, fps: number): Timeline {
  if (after === before) return after;
  const old = before.scenes[index];
  const cur = after.scenes[index];
  if (!old || !cur) return after;
  const next = retimePunchIn(cur, sceneDurationFrames(old, fps), sceneDurationFrames(cur, fps));
  return next === cur ? after : { ...after, scenes: replaceAt(after.scenes, index, next) };
}

const EASE: Record<string, (t: number) => number> = {
  linear: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

const sortKeys = (keys: TimelineZoomKey[]): TimelineZoomKey[] =>
  [...keys].sort((a, b) => a.frame - b.frame);

/** Scale tại `frame` (tính từ đầu scene) - đúng công thức SceneClip. */
export function zoomScaleAt(zoom: TimelineZoom, frame: number): number {
  const keys = sortKeys(zoom.keys);
  if (keys.length === 0) return 1;
  if (frame <= keys[0].frame) return keys[0].scale;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.frame) {
      const span = b.frame - a.frame;
      if (span <= 0) return b.scale;
      const ease = EASE[a.ease ?? "inOut"] ?? EASE.inOut;
      return a.scale + (b.scale - a.scale) * ease((frame - a.frame) / span);
    }
  }
  return keys[keys.length - 1].scale;
}

const round4 = (v: number): number => Math.round(v * 1e4) / 1e4;

/** Sai số scale tối đa (tại frame nguyên) khi thay một đoạn ease bằng các mốc tuyến tính. */
const ZOOM_SAMPLE_TOLERANCE = 0.0015;
/** Bước lấy mẫu thưa nhất (frame) - đoạn zoom phẳng không cần mốc dày hơn. */
const ZOOM_SAMPLE_MAX_STEP = 5;
/** max |ease''(t)| trên [0,1] - dùng để chặn sai số nội suy tuyến tính. */
const EASE_MAX_CURVATURE: Record<string, number> = { out: 6, inOut: 12 };

/**
 * Đoạn a→b có ease cong mà điểm cắt rơi VÀO GIỮA: thay đoạn đó bằng các mốc
 * TUYẾN TÍNH lấy mẫu từ đường cong gốc (gồm cả đúng điểm cắt).
 *
 * Vì sao: ease áp cho cả đoạn từ mốc này tới mốc kế. Cắt đôi đoạn rồi để mỗi
 * nửa tự ease lại là ra HAI đường cong khác hẳn bản gốc - tách scene xong
 * camera giật/đổi nhịp dù người dùng không đụng gì tới zoom. Tuyến tính từng
 * khúc thì cắt ở đâu cũng giữ đúng đường.
 *
 * Bước lấy mẫu h chọn theo chặn sai số nội suy tuyến tính
 * |sai số| ≤ h²/8 · max|f''| với f'' = Δscale · ease'' / span², để mọi frame
 * nguyên lệch ≤ ZOOM_SAMPLE_TOLERANCE (đoạn ngắn/zoom mạnh → mốc từng frame,
 * khi đó khớp tuyệt đối tại mọi frame nguyên).
 */
function linearizeSegmentAt(zoom: TimelineZoom, keys: TimelineZoomKey[], cut: number): TimelineZoomKey[] {
  const i = keys.findIndex((k, j) => j < keys.length - 1 && k.frame < cut && cut < keys[j + 1].frame);
  if (i < 0) return keys;
  const a = keys[i];
  const b = keys[i + 1];
  const ease = a.ease ?? "inOut";
  if (ease === "linear") return keys; // tuyến tính: cắt thẳng đã đúng
  const span = b.frame - a.frame;
  const curvature = (EASE_MAX_CURVATURE[ease] ?? EASE_MAX_CURVATURE.inOut) * Math.abs(b.scale - a.scale);
  let step = ZOOM_SAMPLE_MAX_STEP;
  while (step > 1 && (step * step * curvature) / (8 * span * span) > ZOOM_SAMPLE_TOLERANCE) step -= 1;

  const frames = new Set<number>([cut]);
  for (let f = a.frame; f < b.frame; f += step) frames.add(f);
  const samples: TimelineZoomKey[] = [...frames]
    .sort((x, y) => x - y)
    .map((frame) =>
      // Mốc đầu giữ field lạ của `a`; mọi mốc mẫu đều tuyến tính
      frame === a.frame
        ? { ...a, ease: "linear" as const }
        : { frame, scale: round4(zoomScaleAt(zoom, frame)), ease: "linear" as const },
    );
  return [...keys.slice(0, i), ...samples, ...keys.slice(i + 1)];
}

/** Cắt zoom tại `cut` frame thành hai nửa, mỗi nửa ≥ 2 mốc (schema đòi). */
function splitZoom(
  zoom: TimelineZoom,
  cut: number,
  secondDuration: number,
): [TimelineZoom, TimelineZoom] {
  // Đường cong scale phải giữ nguyên qua điểm cắt (xem linearizeSegmentAt)
  const keys = linearizeSegmentAt(zoom, sortKeys(zoom.keys), cut);
  const scale = round4(zoomScaleAt(zoom, cut));
  const segment = [...keys].reverse().find((k) => k.frame <= cut);
  const firstKeys: TimelineZoomKey[] = [
    ...keys.filter((k) => k.frame < cut),
    { frame: cut, scale },
  ];
  if (firstKeys.length < 2) firstKeys.unshift({ frame: 0, scale });
  const secondKeys: TimelineZoomKey[] = [
    { frame: 0, scale, ...(segment?.ease ? { ease: segment.ease } : {}) },
    ...keys.filter((k) => k.frame > cut).map((k) => ({ ...k, frame: k.frame - cut })),
  ];
  if (secondKeys.length < 2) secondKeys.push({ frame: Math.max(1, secondDuration), scale });
  return [
    { ...zoom, keys: firstKeys },
    { ...structuredClone(zoom), keys: secondKeys },
  ];
}

/** Có tách được scene này không (footage / ảnh / scene chỉ có durationInFrames). */
export function canSplitScene(scene: TimelineScene, fps: number): boolean {
  const kind = sceneKind(scene);
  if (kind === "footage") return footageWindow(scene, fps) !== null;
  if (kind === "image" || kind === "empty") return typeof scene.durationInFrames === "number";
  // HyperFrames/render phát nguyên file từ frame 0 - nửa sau sẽ phát lại từ đầu
  return false;
}

/**
 * Điểm cắt (frame FILE) khi tách footage tại `cut` frame TIMELINE.
 * speed = 1: đúng `cut`. Khác 1: thử các frame file quanh cut × speed, chọn cái
 * cho nửa đầu (round(a / speed), cùng công thức engine) gần `cut` nhất mà nửa
 * sau vẫn đủ hình cho phần còn lại (`duration - nửa đầu`; OffthreadVideo của
 * Remotion phát (endAt - startFrom) / speed frame timeline) - không thì đuôi nửa sau đen.
 * Trả `cut` thực dùng để zoom và độ dài cắt cùng một frame.
 */
function footageCutPoint(
  win: { inFrame: number; outFrame: number },
  cut: number,
  duration: number,
  speed: number,
): { cutFrame: number; cut: number } | null {
  const span = win.outFrame - win.inFrame;
  if (speed === 1) return cut > 0 && cut < span ? { cutFrame: win.inFrame + cut, cut } : null;
  const lo = Math.max(1, Math.floor((cut - 1) * speed) - 1);
  const hi = Math.min(span - 1, Math.ceil((cut + 1) * speed) + 1);
  let best: { rel: number; first: number; score: number } | null = null;
  for (let rel = lo; rel <= hi; rel += 1) {
    const firstDur = toTimelineFrames(rel, speed);
    const secondDur = duration - firstDur;
    if (secondDur <= 0) continue;
    const covered = Math.ceil((span - rel) / speed) >= secondDur;
    const score = Math.abs(firstDur - cut) + (covered ? 0 : duration);
    if (!best || score < best.score) best = { rel, first: firstDur, score };
  }
  return best ? { cutFrame: win.inFrame + best.rel, cut: best.first } : null;
}

/**
 * Tách scene tại `offset` frame tính từ đầu scene. Nửa đầu giữ id cũ, nửa sau
 * nhận `newId`. Cả hai mang đủ field lạ; zoom được cắt liền mạch tại điểm tách;
 * nửa đầu cắt thẳng (overlap 0), nửa sau giữ chuyển cảnh cũ sang scene kế.
 */
export function splitSceneAt(
  tl: Timeline,
  index: number,
  offset: number,
  newId: string,
  ctx: OpsContext,
): Timeline {
  const scene = tl.scenes[index];
  if (!scene || !canSplitScene(scene, ctx.fps)) return tl;
  if (!newId || tl.scenes.some((s) => s.id === newId)) return tl;
  const duration = sceneDurationFrames(scene, ctx.fps);
  let cut = Math.round(offset);
  if (duration === null || cut <= 0 || cut >= duration) return tl;

  const first: TimelineScene = { ...scene };
  const second: TimelineScene = { ...structuredClone(scene), id: newId };

  if (sceneKind(scene) === "footage") {
    const win = footageWindow(scene, ctx.fps);
    if (!win) return tl;
    const speed = sceneSpeedOf(scene);
    // `cut` là frame TIMELINE; điểm cắt trong file chọn qua tốc độ phát, và
    // `cut` có thể nhích tới frame gần nhất cắt được (tua chậm: 1 frame file = nhiều frame timeline)
    const point = footageCutPoint(win, cut, duration, speed);
    if (!point) return tl;
    cut = point.cut;
    const cutFrame = point.cutFrame;
    first.from = frameToSec(win.inFrame, ctx.fps);
    first.to = frameToSec(cutFrame, ctx.fps);
    second.from = first.to;
    second.to = frameToSec(win.outFrame, ctx.fps);
    // Giữ nguyên giá trị gốc của mép không bị cắt (có thể không nằm đúng lưới frame)
    if (typeof scene.from === "number") first.from = scene.from;
    if (typeof scene.to === "number") second.to = scene.to;
    if (typeof scene.durationInFrames === "number") {
      first.durationInFrames = cut;
      second.durationInFrames = duration - cut;
    } else if (toTimelineFrames(win.outFrame - cutFrame, speed) !== duration - cut) {
      // Hai nửa phải cộng lại ĐÚNG độ dài cũ: lệch một frame là mọi scene phía
      // sau trượt khỏi phụ đề/sfx/layer (frame tuyệt đối). Làm tròn (to-from)/speed
      // từng nửa có thể lệch 1 → chốt độ dài nửa sau bằng durationInFrames.
      second.durationInFrames = duration - cut;
    }
  } else {
    first.durationInFrames = cut;
    second.durationInFrames = duration - cut;
  }

  // Điểm tách rơi vào vùng chuyển cảnh (transitionOverlap) với scene trước/sau:
  // nửa nằm trong vùng đó ngắn hơn độ chồng → phép kẹp overlap (trình phát,
  // assemble) co độ chồng lại → mọi scene phía sau trượt khỏi phụ đề/sfx/layer
  // (frame tuyệt đối). Không tách ở đó.
  const overlapIn = index > 0 ? effectiveOverlap(tl.scenes, index - 1, ctx.fps) : 0;
  const overlapOut = index < tl.scenes.length - 1 ? effectiveOverlap(tl.scenes, index, ctx.fps) : 0;
  if (cut < overlapIn || duration - cut < overlapOut) return tl;

  if (scene.zoom && Array.isArray(scene.zoom.keys) && scene.zoom.keys.length > 0) {
    const [z1, z2] = splitZoom(scene.zoom, cut, duration - cut);
    first.zoom = z1;
    second.zoom = z2;
  }
  if (typeof scene.transitionOverlap === "number") first.transitionOverlap = 0;

  const scenes = tl.scenes.slice();
  scenes.splice(index, 1, first, second);
  return { ...tl, scenes };
}

/**
 * Patch NÔNG một scene - theo `id` (hợp đồng v2: inspector/canvas gọi theo id)
 * hoặc theo chỉ số (nơi gọi cũ). Object lồng (transform, color, crop…) được
 * THAY NGUYÊN: nơi gọi tự spread giá trị cũ.
 */
export function patchScene(tl: Timeline, idOrIndex: string | number, patch: Partial<TimelineScene>): Timeline {
  const index = typeof idOrIndex === "number" ? idOrIndex : sceneIndexById(tl, idOrIndex);
  const scene = tl.scenes[index];
  if (!scene) return tl;
  const next = applyPatch(scene, patch);
  return next === scene ? tl : { ...tl, scenes: replaceAt(tl.scenes, index, next) };
}

/** Đặt in/out (frame trong file) cho scene footage - kẹp như trimScene. */
export function setFootageWindow(
  tl: Timeline,
  index: number,
  inFrame: number,
  outFrame: number,
  ctx: OpsContext,
): Timeline {
  const scene = tl.scenes[index];
  if (!scene || sceneKind(scene) !== "footage") return tl;
  const mediaSec = scene.srcVideo ? ctx.mediaDurationSec(scene.srcVideo) : null;
  const max = mediaSec === null ? Number.POSITIVE_INFINITY : Math.floor(mediaSec * ctx.fps + 1e-6);
  const a = clampInt(inFrame, 0, Math.max(0, max - 1));
  const b = clampInt(outFrame, a + 1, Math.max(a + 1, max));
  const patch: Partial<TimelineScene> = {
    from: frameToSec(a, ctx.fps),
    to: frameToSec(b, ctx.fps),
  };
  // in/out là frame FILE; durationInFrames (nếu có) là frame TIMELINE - qua tốc độ
  if (typeof scene.durationInFrames === "number") patch.durationInFrames = toTimelineFrames(b - a, sceneSpeedOf(scene));
  return withPunchInRetimed(tl, patchScene(tl, index, patch), index, ctx.fps);
}

/**
 * Đổi tốc độ phát scene footage (1 = xóa khóa). Engine ƯU TIÊN `durationInFrames`
 * và bỏ qua `speed` khi tính độ dài, nên scene có sẵn durationInFrames phải tính
 * lại cùng lúc = (out - in) / tốc độ mới - không thì Sequence giữ độ dài cũ
 * trong khi video kết thúc sớm (tua nhanh → đuôi đen) hoặc bị cắt (tua chậm).
 * Chưa có `to` (độ dài đang lấy từ durationInFrames × tốc độ cũ) thì chốt `to`
 * từ khung hiện tại trước, để đoạn file đã chọn đứng yên.
 */
export function setSceneSpeed(tl: Timeline, index: number, speed: number, ctx: OpsContext): Timeline {
  const scene = tl.scenes[index];
  if (!scene || sceneKind(scene) !== "footage" || !Number.isFinite(speed)) return tl;
  const v = Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed));
  const patch: Partial<TimelineScene> = { speed: v === 1 ? undefined : v };
  if (typeof scene.durationInFrames === "number") {
    const win = footageWindow(scene, ctx.fps);
    if (win) {
      if (typeof scene.from !== "number") patch.from = 0;
      if (typeof scene.to !== "number") patch.to = frameToSec(win.outFrame, ctx.fps);
      patch.durationInFrames = toTimelineFrames(win.outFrame - win.inFrame, v);
    }
  }
  return withPunchInRetimed(tl, patchScene(tl, index, patch), index, ctx.fps);
}

/** Đổi độ dài (frame) của scene ảnh/HyperFrames - kẹp [1, bản render]. */
export function setSceneDuration(
  tl: Timeline,
  index: number,
  frames: number,
  ctx: OpsContext,
): Timeline {
  const scene = tl.scenes[index];
  if (!scene || sceneKind(scene) === "footage") return tl;
  const max = sceneMaxFrames(scene, ctx);
  const cur = typeof scene.durationInFrames === "number" ? scene.durationInFrames : 1;
  const upper = max === null ? Number.POSITIVE_INFINITY : Math.max(max, cur);
  return withPunchInRetimed(tl, patchScene(tl, index, { durationInFrames: clampInt(frames, 1, upper) }), index, ctx.fps);
}

/** transitionOverlap sang scene kế (frame) - 0 = cắt thẳng thì xóa khóa. */
export function setTransitionOverlap(tl: Timeline, index: number, frames: number): Timeline {
  if (index < 0 || index >= tl.scenes.length) return tl;
  const v = Math.max(0, Math.round(frames));
  return patchScene(tl, index, { transitionOverlap: v > 0 ? v : undefined });
}

export interface PunchIn {
  startScale: number;
  endScale: number;
  ease: "linear" | "out" | "inOut";
}

/**
 * Punch-in đơn giản: hai mốc (đầu scene → cuối scene). Ghi đè `zoom.keys` nhưng
 * giữ `origin` và field lạ của zoom. null = bỏ zoom.
 */
export function setScenePunchIn(
  tl: Timeline,
  index: number,
  punch: PunchIn | null,
  ctx: OpsContext,
): Timeline {
  const scene = tl.scenes[index];
  if (!scene) return tl;
  if (punch === null) return patchScene(tl, index, { zoom: undefined });
  const duration = sceneDurationFrames(scene, ctx.fps) ?? 1;
  // Mốc cuối ở frame CUỐI của scene (dur-1): tới đúng khung cuối là đạt scale đích
  const keys: TimelineZoomKey[] = [
    { frame: 0, scale: punch.startScale, ease: punch.ease },
    { frame: Math.max(1, duration - 1), scale: punch.endScale },
  ];
  return patchScene(tl, index, { zoom: { ...(scene.zoom ?? {}), keys } });
}

/** Đọc punch-in từ zoom hiện có: null = không zoom; `custom` = nhiều hơn 2 mốc. */
export function readPunchIn(
  scene: TimelineScene,
): { punch: PunchIn; custom: boolean } | null {
  const keys = scene.zoom?.keys;
  if (!Array.isArray(keys) || keys.length === 0) return null;
  const sorted = sortKeys(keys);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    punch: { startScale: first.scale, endScale: last.scale, ease: first.ease ?? "inOut" },
    custom: sorted.length > 2 || first.frame !== 0,
  };
}

// ================================================================ cue

type BaseCue = { from: number; durationInFrames: number };

const cueEnd = (cue: BaseCue): number => cue.from + cue.durationInFrames;

/**
 * `words` của cue karaoke nếu đúng là mảng, không thì null. meta.json do AI ghi
 * tay có thể sai kiểu - thao tác nào chạm tới từ thì bỏ qua cue đó thay vì ném
 * lỗi (ném trong reducer là sập cả trình chỉnh sửa).
 */
export const captionWordsOf = (cue: TimelineCaptionCue | undefined): TimelineCaptionWord[] | null =>
  cue && Array.isArray(cue.words) ? cue.words : null;

/** `parts` của highlight nếu đúng là mảng (xem captionWordsOf). */
export const highlightPartsOf = (cue: TimelineHighlightCue | undefined): TimelineHighlightPart[] | null =>
  cue && Array.isArray(cue.parts) ? cue.parts : null;

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Cue/phần tử có hình dạng editor vẽ & sửa được không - false = dữ liệu lạ
 * (thường do AI ghi sai kiểu). Timeline vẫn vẽ nó (khối đánh dấu lỗi) và
 * inspector hiện banner thay vì form; người dùng xóa hoặc nhờ AI sửa.
 */
export function isWellFormed(tl: Timeline, sel: Selection): boolean {
  const timed = (c: { from?: unknown; durationInFrames?: unknown } | undefined | null): boolean =>
    !!c && typeof c === "object" && isFiniteNum(c.from) && isFiniteNum(c.durationInFrames);
  switch (sel.kind) {
    case "caption": {
      const cue = tl.captions[sel.index];
      const words = captionWordsOf(cue);
      return (
        timed(cue) &&
        !!words &&
        words.length > 0 &&
        words.every(
          (w) => !!w && typeof w === "object" && typeof w.text === "string" && isFiniteNum(w.start) && isFiniteNum(w.end),
        )
      );
    }
    case "subtitle": {
      const cue = tl.subtitles[sel.index];
      return timed(cue) && typeof cue.text === "string";
    }
    case "overlay": {
      const cue = tl.overlays[sel.index];
      const parts = highlightPartsOf(cue);
      return (
        timed(cue) &&
        !!parts &&
        parts.length > 0 &&
        parts.every((p) => !!p && typeof p === "object" && typeof p.t === "string") &&
        (cue.kicker === undefined || cue.kicker === null || typeof cue.kicker === "string")
      );
    }
    case "sfx": {
      const sfx = tl.audio.sfx[sel.index];
      return !!sfx && typeof sfx === "object" && typeof sfx.file === "string" && isFiniteNum(sfx.atFrame);
    }
    case "music": {
      const music = tl.audio.music;
      return !!music && typeof music === "object" && typeof music.file === "string";
    }
    case "voice":
      return tl.audio.voice === null || typeof tl.audio.voice === "string";
    case "scene": {
      const scene = tl.scenes[sceneIndexById(tl, sel.id)];
      return !!scene && typeof scene === "object" && typeof scene.id === "string";
    }
    case "layer":
      return isLayerWellFormed(layersOf(tl)[layerIndexById(tl, sel.id)]);
  }
}

function shiftWords(cue: TimelineCaptionCue, delta: number): TimelineCaptionCue {
  if (delta === 0 || !captionWordsOf(cue)) return cue;
  return {
    ...cue,
    words: cue.words.map((w) => ({
      ...w,
      start: Math.max(0, w.start + delta),
      end: Math.max(0, w.end + delta),
    })),
  };
}

/**
 * Kẹp mọi từ vào [from, end] của cue (mép cue vừa đổi) mà mỗi từ vẫn còn ≥ 1
 * frame, theo đúng thứ tự: kẹp thẳng thì các từ rơi ra ngoài dồn hết về một
 * frame - karaoke sáng cả cụm cùng lúc. resizeCue đã giữ cue dài ≥ số từ nên
 * luôn đủ chỗ. Từ nằm gọn bên trong và không chồng nhau thì giữ nguyên.
 */
function clampWords(cue: TimelineCaptionCue): TimelineCaptionCue {
  if (!captionWordsOf(cue)) return cue;
  const lo = cue.from;
  const hi = cueEnd(cue);
  const n = cue.words.length;
  if (hi - lo < n) {
    // Không đủ chỗ (dữ liệu cũ) - kẹp thẳng như trước, không chia được
    let changed = false;
    const words = cue.words.map((w) => {
      const start = Math.min(hi, Math.max(lo, w.start));
      const end = Math.min(hi, Math.max(start, w.end));
      if (start === w.start && end === w.end) return w;
      changed = true;
      return { ...w, start, end };
    });
    return changed ? { ...cue, words } : cue;
  }
  let changed = false;
  let cursor = lo;
  const words = cue.words.map((w, i) => {
    // chừa đúng 1 frame cho mỗi từ còn lại phía sau
    const start = Math.min(hi - (n - i), Math.max(cursor, lo, w.start));
    const end = Math.max(start + 1, Math.min(hi - (n - i - 1), w.end));
    cursor = end;
    if (start === w.start && end === w.end) return w;
    changed = true;
    return { ...w, start, end };
  });
  return changed ? { ...cue, words } : cue;
}

/** Độ dài tối thiểu của cue: karaoke cần ≥ 1 frame cho mỗi từ. */
function minCueFrames(tl: Timeline, kind: CueKind, index: number): number {
  if (kind !== "captions") return 1;
  return Math.max(1, captionWordsOf(tl.captions[index])?.length ?? 1);
}

/**
 * Sửa một cue theo loại - mỗi nhánh giữ đúng kiểu của mảng mình. `fn` trả về
 * chính cue cũ = không đổi; `captionFix` chạy thêm cho karaoke (từ đi theo cue).
 */
function editCue(
  tl: Timeline,
  kind: CueKind,
  index: number,
  fn: <C extends BaseCue>(cue: C) => C,
  captionFix?: (before: TimelineCaptionCue, after: TimelineCaptionCue) => TimelineCaptionCue,
): Timeline {
  switch (kind) {
    case "captions": {
      const cue = tl.captions[index];
      if (!cue) return tl;
      let next = fn(cue);
      if (next !== cue && captionFix) next = captionFix(cue, next);
      return next === cue ? tl : { ...tl, captions: replaceAt(tl.captions, index, next) };
    }
    case "subtitles": {
      const cue = tl.subtitles[index];
      if (!cue) return tl;
      const next = fn(cue);
      return next === cue ? tl : { ...tl, subtitles: replaceAt(tl.subtitles, index, next) };
    }
    case "overlays": {
      const cue = tl.overlays[index];
      if (!cue) return tl;
      const next = fn(cue);
      return next === cue ? tl : { ...tl, overlays: replaceAt(tl.overlays, index, next) };
    }
  }
}

export function cueList(tl: Timeline, kind: CueKind): BaseCue[] {
  return tl[kind];
}

/** Dời cue `delta` frame (không trước frame 0). Karaoke: từ đi theo cue. */
/**
 * `maxStart` (tùy chọn) = frame bắt đầu muộn nhất được phép (kéo trên timeline
 * truyền tổng frame - 1): kéo quá tay không đẩy cue ra sau hết video. Cue ĐÃ ở
 * ngoài từ trước thì không bị kéo giật về - chỉ không cho đi xa thêm.
 */
export function moveCue(
  tl: Timeline,
  kind: CueKind,
  index: number,
  delta: number,
  maxStart: number = Number.POSITIVE_INFINITY,
): Timeline {
  const d = Math.round(delta);
  if (!Number.isFinite(d) || d === 0) return tl;
  return editCue(
    tl,
    kind,
    index,
    (cue) => {
      const from = Math.min(Math.max(0, cue.from + d), Math.max(cue.from, maxStart));
      return from === cue.from ? cue : { ...cue, from };
    },
    (before, after) => shiftWords(after, after.from - before.from),
  );
}

/** Đặt mốc bắt đầu tuyệt đối (frame) - như moveCue. */
export function setCueStart(tl: Timeline, kind: CueKind, index: number, frame: number): Timeline {
  const cue = cueList(tl, kind)[index];
  if (!cue) return tl;
  return moveCue(tl, kind, index, Math.max(0, Math.round(frame)) - cue.from);
}

/**
 * Kéo mép cue. Mép đầu: đổi `from`, giữ mép cuối; mép cuối: đổi độ dài. Luôn
 * còn ≥ 1 frame. Karaoke: từ bị kẹp vào trong cue mới (không có từ nào lọt ra ngoài).
 */
export function resizeCue(
  tl: Timeline,
  kind: CueKind,
  index: number,
  edge: "start" | "end",
  delta: number,
): Timeline {
  const d = Math.round(delta);
  if (!Number.isFinite(d) || d === 0) return tl;
  const minDur = minCueFrames(tl, kind, index);
  return editCue(
    tl,
    kind,
    index,
    (cue) => {
      const end = cueEnd(cue);
      if (edge === "start") {
        // Karaoke: mép đầu dừng sớm để mỗi từ còn ≥ 1 frame (không dồn cụm)
        const from = clampInt(cue.from + d, 0, Math.max(cue.from, end - minDur));
        return from === cue.from ? cue : { ...cue, from, durationInFrames: end - from };
      }
      const durationInFrames = Math.max(Math.min(minDur, cue.durationInFrames), cue.durationInFrames + d, 1);
      return durationInFrames === cue.durationInFrames ? cue : { ...cue, durationInFrames };
    },
    (_before, after) => clampWords(after),
  );
}

/** Đặt độ dài tuyệt đối (frame). */
export function setCueDuration(tl: Timeline, kind: CueKind, index: number, frames: number): Timeline {
  const cue = cueList(tl, kind)[index];
  if (!cue) return tl;
  return resizeCue(tl, kind, index, "end", Math.max(1, Math.round(frames)) - cue.durationInFrames);
}

/**
 * Tách cue tại frame tuyệt đối `frame`. Phụ đề/highlight: hai nửa cùng nội
 * dung (người dùng sửa sau). Karaoke: từ bắt đầu trước điểm tách thuộc nửa đầu
 * (từ vắt qua bị cắt đuôi), phần còn lại sang nửa sau - nửa nào không còn từ
 * nào thì không tách.
 */
export function splitCueAt(tl: Timeline, kind: CueKind, index: number, frame: number): Timeline {
  const list = cueList(tl, kind);
  const cue = list[index];
  if (!cue) return tl;
  const at = Math.round(frame);
  if (at <= cue.from || at >= cueEnd(cue)) return tl;
  const local = at - cue.from;

  const halves = <C extends BaseCue>(c: C): [C, C] => [
    { ...c, durationInFrames: local },
    { ...structuredClone(c), from: at, durationInFrames: c.durationInFrames - local },
  ];

  switch (kind) {
    case "captions": {
      if (!captionWordsOf(tl.captions[index])) return tl;
      const [a, b] = halves(tl.captions[index]);
      const wordsA = a.words.filter((w) => w.start < at).map((w) => (w.end > at ? { ...w, end: at } : w));
      const wordsB = b.words.filter((w) => w.start >= at);
      if (wordsA.length === 0 || wordsB.length === 0) return tl;
      const captions = tl.captions.slice();
      captions.splice(index, 1, { ...a, words: wordsA }, { ...b, words: wordsB });
      return { ...tl, captions };
    }
    case "subtitles": {
      const subtitles = tl.subtitles.slice();
      subtitles.splice(index, 1, ...halves(tl.subtitles[index]));
      return { ...tl, subtitles };
    }
    case "overlays": {
      const overlays = tl.overlays.slice();
      overlays.splice(index, 1, ...halves(tl.overlays[index]));
      return { ...tl, overlays };
    }
  }
}

export function patchSubtitle(
  tl: Timeline,
  index: number,
  patch: Partial<TimelineSubtitleCue>,
): Timeline {
  const cue = tl.subtitles[index];
  if (!cue) return tl;
  const next = applyPatch(cue, patch);
  return next === cue ? tl : { ...tl, subtitles: replaceAt(tl.subtitles, index, next) };
}

export function patchOverlay(
  tl: Timeline,
  index: number,
  patch: Partial<TimelineHighlightCue>,
): Timeline {
  const cue = tl.overlays[index];
  if (!cue) return tl;
  const next = applyPatch(cue, patch);
  return next === cue ? tl : { ...tl, overlays: replaceAt(tl.overlays, index, next) };
}

export function patchHighlightPart(
  tl: Timeline,
  cueIndex: number,
  partIndex: number,
  patch: Partial<TimelineHighlightPart>,
): Timeline {
  const cue = tl.overlays[cueIndex];
  const part = highlightPartsOf(cue)?.[partIndex];
  if (!cue || !part) return tl;
  return patchOverlay(tl, cueIndex, {
    parts: replaceAt(cue.parts, partIndex, applyPatch(part, patch)),
  });
}

export function insertHighlightPart(
  tl: Timeline,
  cueIndex: number,
  afterIndex: number,
  text: string,
): Timeline {
  const cue = tl.overlays[cueIndex];
  if (!cue || !text || !highlightPartsOf(cue)) return tl;
  const parts = cue.parts.slice();
  parts.splice(Math.min(parts.length, Math.max(0, afterIndex + 1)), 0, { t: text });
  return patchOverlay(tl, cueIndex, { parts });
}

/** Bỏ một phần chữ - luôn còn ít nhất một phần (schema đòi parts ≥ 1). */
export function removeHighlightPart(tl: Timeline, cueIndex: number, partIndex: number): Timeline {
  const cue = tl.overlays[cueIndex];
  if (!cue || !highlightPartsOf(cue) || cue.parts.length <= 1 || !cue.parts[partIndex]) return tl;
  return patchOverlay(tl, cueIndex, { parts: cue.parts.filter((_, i) => i !== partIndex) });
}

export function patchCaptionWord(
  tl: Timeline,
  cueIndex: number,
  wordIndex: number,
  patch: Partial<TimelineCaptionWord>,
): Timeline {
  const cue = tl.captions[cueIndex];
  const word = captionWordsOf(cue)?.[wordIndex];
  if (!cue || !word) return tl;
  const next = applyPatch(word, patch);
  if (next === word) return tl;
  return {
    ...tl,
    captions: replaceAt(tl.captions, cueIndex, { ...cue, words: replaceAt(cue.words, wordIndex, next) }),
  };
}

/**
 * Chèn từ mới sau `afterIndex`: chiếm nửa sau khoảng thời gian của từ đứng
 * trước (từ đó co lại), nên karaoke không chồng chéo.
 */
export function insertCaptionWord(
  tl: Timeline,
  cueIndex: number,
  afterIndex: number,
  text: string,
): Timeline {
  const cue = tl.captions[cueIndex];
  if (!cue || !text || !captionWordsOf(cue)) return tl;
  const words = cue.words.slice();
  const at = Math.min(words.length, Math.max(0, afterIndex + 1));
  const prev = words[at - 1];
  let start: number;
  let end: number;
  if (prev) {
    const mid = Math.round((prev.start + prev.end) / 2);
    start = mid;
    end = prev.end;
    words[at - 1] = { ...prev, end: mid };
  } else {
    start = cue.from;
    end = words[0] ? words[0].start : cueEnd(cue);
  }
  words.splice(at, 0, { text, start, end: Math.max(start, end) });
  return { ...tl, captions: replaceAt(tl.captions, cueIndex, { ...cue, words }) };
}

/** Bỏ một từ - luôn còn ít nhất một từ (schema đòi words ≥ 1). */
export function removeCaptionWord(tl: Timeline, cueIndex: number, wordIndex: number): Timeline {
  const cue = tl.captions[cueIndex];
  if (!cue || !captionWordsOf(cue) || cue.words.length <= 1 || !cue.words[wordIndex]) return tl;
  return {
    ...tl,
    captions: replaceAt(tl.captions, cueIndex, {
      ...cue,
      words: cue.words.filter((_, i) => i !== wordIndex),
    }),
  };
}

export function setSubtitleStyle(
  tl: Timeline,
  patch: Partial<TimelineSubtitleStyle> | null,
): Timeline {
  if (patch === null) {
    if (tl.subtitleStyle === undefined) return tl;
    const next = { ...tl };
    delete next.subtitleStyle;
    return next;
  }
  const next = applyPatch(tl.subtitleStyle ?? {}, patch);
  return next === tl.subtitleStyle ? tl : { ...tl, subtitleStyle: next };
}

// ================================================================ vị trí cue

/** `transform` của cue nếu đúng là object (meta do AI ghi có thể sai kiểu). */
export function cueTransformOf(tl: Timeline, kind: CueKind, index: number): TimelineCueTransform {
  const t = (cueList(tl, kind)[index] as { transform?: unknown } | undefined)?.transform;
  return t && typeof t === "object" && !Array.isArray(t) ? (t as TimelineCueTransform) : {};
}

/**
 * Chuẩn hóa transform cue: kẹp trong giới hạn của schema, làm tròn, bỏ field
 * về mặc định (x/y 0, scale 1) - giữ field lạ. Rỗng hẳn thì trả null = xóa khóa.
 */
function normalizeCueTransform(t: TimelineCueTransform): TimelineCueTransform | null {
  const next: TimelineCueTransform = { ...t };
  const set = (key: "x" | "y" | "scale", v: unknown, lo: number, hi: number, digits: number, def: number) => {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      delete next[key];
      return;
    }
    const p = 10 ** digits;
    const r = Math.round(Math.min(hi, Math.max(lo, v)) * p) / p;
    if (r === def) delete next[key];
    else next[key] = r;
  };
  set("x", t.x, -1, 1, 4, 0);
  set("y", t.y, -1, 1, 4, 0);
  set("scale", t.scale, CUE_SCALE_MIN, CUE_SCALE_MAX, 3, 1);
  return Object.keys(next).length > 0 ? next : null;
}

const sameCueTransform = (a: unknown, b: TimelineCueTransform | null): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b);

function withCueTransform<C extends BaseCue>(cue: C, t: TimelineCueTransform | null): C {
  if (sameCueTransform((cue as { transform?: unknown }).transform, t)) return cue;
  const next = { ...cue } as C & { transform?: TimelineCueTransform };
  if (t) next.transform = t;
  else delete next.transform;
  return next;
}

/** Đặt transform TRỌN VẸN cho một cue (null = về vị trí mặc định của track). */
export function setCueTransform(
  tl: Timeline,
  kind: CueKind,
  index: number,
  transform: TimelineCueTransform | null,
): Timeline {
  const t = transform ? normalizeCueTransform(transform) : null;
  return editCue(tl, kind, index, (cue) => withCueTransform(cue, t));
}

/** Chép vị trí/cỡ của cue `index` sang MỌI cue cùng loại (cue nguồn ở mặc định = đưa tất cả về mặc định). */
export function applyCueTransformToAll(tl: Timeline, kind: CueKind, index: number): Timeline {
  if (!cueList(tl, kind)[index]) return tl;
  const t = normalizeCueTransform(cueTransformOf(tl, kind, index));
  const list = cueList(tl, kind);
  let changed = false;
  const next = list.map((cue) => {
    if (!cue || typeof cue !== "object") return cue;
    const out = withCueTransform(cue, t);
    if (out !== cue) changed = true;
    return out;
  });
  return changed ? ({ ...tl, [kind]: next } as Timeline) : tl;
}

/**
 * Sửa CẢ CÂU karaoke một lượt. Cùng số từ: chỉ thay chữ, giữ nguyên mốc từng
 * từ (sửa chính tả không làm lệch karaoke). Khác số từ: chia lại mốc trong cả
 * cue theo độ dài từng từ - từ dài được đọc lâu hơn, gần với giọng thật hơn
 * chia đều. Giữ `hi` của từ cùng vị trí; field lạ của cue giữ nguyên.
 */
export function setCaptionText(tl: Timeline, index: number, text: string): Timeline {
  const cue = tl.captions[index];
  const old = captionWordsOf(cue);
  if (!cue || !old) return tl;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return tl;
  let words: TimelineCaptionWord[];
  if (tokens.length === old.length) {
    words = old.map((w, i) => (w.text === tokens[i] ? w : { ...w, text: tokens[i] }));
    if (words.every((w, i) => w === old[i])) return tl;
  } else {
    const start = cue.from;
    const span = Math.max(tokens.length, cue.durationInFrames);
    const weights = tokens.map((tk) => Math.max(1, tk.length));
    const total = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    words = tokens.map((tk, i) => {
      const s = start + Math.round((acc / total) * span);
      acc += weights[i];
      const e = i === tokens.length - 1 ? start + span : start + Math.round((acc / total) * span);
      return { ...old[i], text: tk, start: s, end: Math.max(s, e) };
    });
  }
  return {
    ...tl,
    captions: replaceAt(tl.captions, index, { ...cue, words, durationInFrames: Math.max(cue.durationInFrames, tokens.length) }),
  };
}

// ================================================================ chuẩn hóa

/**
 * Bản server trả về đã điền mặc định, nhưng meta.json do agent ghi tay có thể
 * còn khóa `null` (captions/subtitles/overlays/audio/subtitleStyle) hoặc audio
 * thiếu nhánh. Coi `null` là VẮNG MẶT - giống server chuẩn hóa trước khi render -
 * để mọi thao tác phía sau khỏi phải phòng thủ. Đã chuẩn thì trả lại chính nó.
 */
export function normalizeTimeline(tl: Timeline): Timeline {
  const raw: Partial<Record<keyof Timeline, unknown>> = tl;
  const audioRaw: unknown = raw.audio;
  const audio = audioRaw !== null && typeof audioRaw === "object" ? tl.audio : null;
  const ok =
    Array.isArray(raw.scenes) &&
    Array.isArray(raw.captions) &&
    Array.isArray(raw.subtitles) &&
    Array.isArray(raw.overlays) &&
    audio !== null &&
    Array.isArray(audio.sfx) &&
    audio.voice !== undefined &&
    audio.music !== undefined &&
    raw.subtitleStyle !== null;
  if (ok) return tl;
  const next: Timeline = {
    ...tl,
    scenes: Array.isArray(raw.scenes) ? tl.scenes : [],
    captions: Array.isArray(raw.captions) ? tl.captions : [],
    subtitles: Array.isArray(raw.subtitles) ? tl.subtitles : [],
    overlays: Array.isArray(raw.overlays) ? tl.overlays : [],
    audio: {
      ...(audio ?? {}),
      voice: audio?.voice ?? null,
      sfx: audio && Array.isArray(audio.sfx) ? audio.sfx : [],
      music: audio?.music ?? null,
    },
  };
  if (raw.subtitleStyle === null) delete next.subtitleStyle;
  return next;
}

// ================================================================ audio

/** Như moveCue: `maxStart` chặn kéo sfx ra sau hết video. */
export function moveSfx(
  tl: Timeline,
  index: number,
  delta: number,
  maxStart: number = Number.POSITIVE_INFINITY,
): Timeline {
  const sfx = tl.audio.sfx[index];
  const d = Math.round(delta);
  if (!sfx || !Number.isFinite(d) || d === 0) return tl;
  const atFrame = Math.min(Math.max(0, sfx.atFrame + d), Math.max(sfx.atFrame, maxStart));
  if (atFrame === sfx.atFrame) return tl;
  return patchSfx(tl, index, { atFrame });
}

export function patchSfx(tl: Timeline, index: number, patch: Partial<TimelineSfx>): Timeline {
  const sfx = tl.audio.sfx[index];
  if (!sfx) return tl;
  const next = applyPatch(sfx, patch);
  if (next === sfx) return tl;
  return { ...tl, audio: { ...tl.audio, sfx: replaceAt(tl.audio.sfx, index, next) } };
}

export function patchMusic(tl: Timeline, patch: Partial<TimelineMusic>): Timeline {
  const music = tl.audio.music;
  if (!music) return tl;
  const next = applyPatch(music, patch);
  return next === music ? tl : { ...tl, audio: { ...tl.audio, music: next } };
}

// ================================================================ theo selection

/** Phần tử còn tồn tại trong timeline không (sau undo / AI sửa / xóa). */
export function selectionExists(tl: Timeline, sel: Selection | null): boolean {
  if (!sel) return false;
  switch (sel.kind) {
    case "scene":
      return sceneIndexById(tl, sel.id) >= 0;
    case "caption":
    case "subtitle":
    case "overlay":
      return sel.index >= 0 && sel.index < cueList(tl, CUE_KIND[sel.kind]).length;
    case "sfx":
      return sel.index >= 0 && sel.index < tl.audio.sfx.length;
    case "music":
      return tl.audio.music !== null;
    case "voice":
      return tl.audio.voice !== null;
    case "layer":
      return layerIndexById(tl, sel.id) >= 0;
  }
}

/** Xóa được không - scene cuối cùng và giọng đọc thì không (xem deleteSelection). */
export function canDelete(tl: Timeline, sel: Selection | null): boolean {
  if (!sel || !selectionExists(tl, sel)) return false;
  if (sel.kind === "scene") return tl.scenes.length > 1;
  return sel.kind !== "voice";
}

/**
 * Xóa phần tử đang chọn. Không xóa scene CUỐI CÙNG (composition cần ≥ 1 scene,
 * trình phát sẽ hỏng) và không xóa giọng đọc (xương sống đồng bộ - đổi giọng là
 * việc của AI/luồng TTS, không phải một phím Delete).
 */
export function deleteSelection(tl: Timeline, sel: Selection | null): Timeline {
  if (!sel || !canDelete(tl, sel)) return tl;
  switch (sel.kind) {
    case "scene":
      return { ...tl, scenes: tl.scenes.filter((s) => s.id !== sel.id) };
    case "caption":
      return { ...tl, captions: tl.captions.filter((_, i) => i !== sel.index) };
    case "subtitle":
      return { ...tl, subtitles: tl.subtitles.filter((_, i) => i !== sel.index) };
    case "overlay":
      return { ...tl, overlays: tl.overlays.filter((_, i) => i !== sel.index) };
    case "sfx":
      return { ...tl, audio: { ...tl.audio, sfx: tl.audio.sfx.filter((_, i) => i !== sel.index) } };
    case "music":
      return { ...tl, audio: { ...tl.audio, music: null } };
    case "layer":
      return removeLayer(tl, sel.id);
    case "voice":
      return tl;
  }
}

/**
 * Chỗ đặt bản nhân bản của cue `index` (dài `dur`): ngay sau bản gốc nếu lọt
 * trước cue kế tiếp trên CÙNG track, không thì khe trống đầu tiên đủ dài phía
 * sau, hết khe thì sau cue cuối. Đặt đè lên cue kế là hai câu chồng nhau.
 */
function freeSlotAfter(list: BaseCue[], index: number, dur: number): number {
  const self = list[index];
  let at = cueEnd(self);
  const others = list
    .filter((c, i) => i !== index && c && Number.isFinite(c.from) && Number.isFinite(c.durationInFrames))
    .sort((a, b) => a.from - b.from);
  for (const c of others) {
    if (cueEnd(c) <= at) continue; // nằm hẳn trước chỗ đang xét
    if (c.from >= at + dur) break; // khe [at, at+dur) trống
    at = Math.max(at, cueEnd(c));
  }
  return at;
}

/** Vị trí chèn theo thứ tự thời gian (cùng mốc thì đứng sau) - như addCue. */
const sortedInsertIndex = (list: BaseCue[], from: number): number => {
  const i = list.findIndex((c) => c && c.from > from);
  return i === -1 ? list.length : i;
};

export function canDuplicate(tl: Timeline, sel: Selection | null): boolean {
  if (!sel || !selectionExists(tl, sel)) return false;
  // Nhân bản dữ liệu lỗi chỉ đẻ thêm dữ liệu lỗi (và chặn lưu khóa đó)
  if (!isWellFormed(tl, sel)) return false;
  return sel.kind !== "music" && sel.kind !== "voice";
}

/**
 * Nhân bản phần tử đang chọn, trả về timeline mới + selection trỏ vào bản sao.
 * Scene: chèn ngay sau, id mới. Cue: đặt nối ngay sau cue gốc (karaoke dời từ
 * theo). Sfx: lùi 1 giây.
 */
export function duplicateSelection(
  tl: Timeline,
  sel: Selection | null,
  fps: number,
): { timeline: Timeline; selection: Selection | null } {
  if (!sel || !canDuplicate(tl, sel)) return { timeline: tl, selection: sel };
  switch (sel.kind) {
    case "scene": {
      const index = sceneIndexById(tl, sel.id);
      const copy: TimelineScene = {
        ...structuredClone(tl.scenes[index]),
        id: uniqueSceneId(tl.scenes, sel.id),
      };
      const scenes = tl.scenes.slice();
      scenes.splice(index + 1, 0, copy);
      return { timeline: { ...tl, scenes }, selection: { kind: "scene", id: copy.id } };
    }
    case "caption": {
      const cue = tl.captions[sel.index];
      const from = freeSlotAfter(tl.captions, sel.index, cue.durationInFrames);
      const copy = shiftWords({ ...structuredClone(cue), from }, from - cue.from);
      const at = sortedInsertIndex(tl.captions, from);
      const captions = tl.captions.slice();
      captions.splice(at, 0, copy);
      return { timeline: { ...tl, captions }, selection: { kind: "caption", index: at } };
    }
    case "subtitle": {
      const cue = tl.subtitles[sel.index];
      const from = freeSlotAfter(tl.subtitles, sel.index, cue.durationInFrames);
      const at = sortedInsertIndex(tl.subtitles, from);
      const subtitles = tl.subtitles.slice();
      subtitles.splice(at, 0, { ...structuredClone(cue), from });
      return { timeline: { ...tl, subtitles }, selection: { kind: "subtitle", index: at } };
    }
    case "overlay": {
      const cue = tl.overlays[sel.index];
      const from = freeSlotAfter(tl.overlays, sel.index, cue.durationInFrames);
      const at = sortedInsertIndex(tl.overlays, from);
      const overlays = tl.overlays.slice();
      overlays.splice(at, 0, { ...structuredClone(cue), from });
      return { timeline: { ...tl, overlays }, selection: { kind: "overlay", index: at } };
    }
    case "sfx": {
      const sfx = tl.audio.sfx[sel.index];
      const list = tl.audio.sfx.slice();
      list.splice(sel.index + 1, 0, {
        ...structuredClone(sfx),
        atFrame: sfx.atFrame + Math.max(1, Math.round(fps)),
      });
      return {
        timeline: { ...tl, audio: { ...tl.audio, sfx: list } },
        selection: { kind: "sfx", index: sel.index + 1 },
      };
    }
    case "layer": {
      // Bản sao nối ngay sau bản gốc (như cue), nằm NGAY TRÊN bản gốc về lớp
      const layers = layersOf(tl);
      const index = layerIndexById(tl, sel.id);
      const src = layers[index];
      const copy: TimelineLayer = {
        ...structuredClone(src),
        id: uniqueLayerId(layers, src.id),
        from: src.from + src.durationInFrames,
      };
      const next = layers.slice();
      next.splice(index + 1, 0, copy);
      return { timeline: { ...tl, layers: next }, selection: { kind: "layer", id: copy.id } };
    }
    default:
      return { timeline: tl, selection: sel };
  }
}

/**
 * Tách tại playhead: phần tử đang chọn nếu nó nằm dưới playhead, không thì
 * scene đang phát. Trả `null` khi không có gì tách được.
 */
export function splitAtPlayhead(
  tl: Timeline,
  sel: Selection | null,
  frame: number,
  spans: { id: string; start: number; end: number }[],
  ctx: OpsContext,
): { timeline: Timeline; selection: Selection | null } | null {
  if (sel && isCueSel(sel.kind) && "index" in sel) {
    const next = splitCueAt(tl, CUE_KIND[sel.kind], sel.index, frame);
    if (next !== tl) return { timeline: next, selection: sel };
  }
  if (sel?.kind === "layer") {
    // Layer đang chọn nằm dưới playhead thì tách nó; không thì rơi xuống scene như cũ
    const next = splitLayerAt(tl, sel.id, frame, uniqueLayerId(layersOf(tl), sel.id), ctx.fps);
    if (next !== tl) return { timeline: next, selection: sel };
  }
  // Scene: ưu tiên scene đang chọn nếu playhead nằm trong nó, không thì scene
  // trên cùng tại playhead (chỗ chồng lấn thì scene sau nằm trên)
  const under = spans.filter((s) => frame > s.start && frame < s.end);
  const chosen =
    (sel?.kind === "scene" ? under.find((s) => s.id === sel.id) : undefined) ??
    under[under.length - 1];
  if (!chosen) return null;
  const index = sceneIndexById(tl, chosen.id);
  const newId = uniqueSceneId(tl.scenes, chosen.id);
  const next = splitSceneAt(tl, index, frame - chosen.start, newId, ctx);
  if (next === tl) return null;
  return { timeline: next, selection: { kind: "scene", id: chosen.id } };
}

// ================================================================ thêm mới (thư viện, thêm tại playhead)

/**
 * Id scene kebab-case suy từ tên file ("Cảnh quay 1.mp4" → "canh-quay-1"), không
 * trùng id đang có (trùng thì "-2", "-3"…). Bỏ dấu tiếng Việt để id đọc được và
 * an toàn làm tên file render.
 */
export function sceneIdFromFile(scenes: TimelineScene[], relPath: string): string {
  const name = relPath.split(/[\\/]/).pop() ?? relPath;
  const stem = name.replace(/\.[^.]+$/, "");
  const kebab = stem
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  const base = kebab || "scene";
  return scenes.some((s) => s.id === base) ? uniqueSceneId(scenes, base) : base;
}

/** Độ dài (giây) của scene footage mới khi KHÔNG đo được thời lượng file. */
export const NEW_FOOTAGE_FALLBACK_SEC = 5;
/** Độ dài (giây) của scene ảnh mới. */
export const NEW_IMAGE_SEC = 3;

/**
 * Scene footage mới: NGUYÊN file, giữ tiếng gốc - người dùng thả video vào là
 * muốn thấy và nghe đúng video đó (bản cũ cắt còn 5 giây + tắt tiếng khiến clip
 * bị hụt và câm). Muốn ngắn hơn thì trim, muốn câm thì bật "Tắt tiếng" ở Inspector.
 * `durationSec` chưa biết thì tạm lấy 5 giây.
 */
export function newFootageScene(
  id: string,
  relPath: string,
  durationSec: number | null,
  fps: number,
): TimelineScene {
  const fileFrames =
    durationSec !== null && Number.isFinite(durationSec) && durationSec > 0
      ? Math.floor(durationSec * fps + 1e-6)
      : Math.round(NEW_FOOTAGE_FALLBACK_SEC * fps);
  const frames = Math.max(1, fileFrames);
  return { id, srcVideo: relPath, from: 0, to: frameToSec(frames, fps) };
}

/** Scene ảnh tĩnh mới - 3 giây. */
export function newImageScene(id: string, relPath: string, fps: number): TimelineScene {
  return { id, srcImage: relPath, durationInFrames: Math.max(1, Math.round(NEW_IMAGE_SEC * fps)) };
}

/**
 * Chèn scene vào vị trí `index` (kẹp [0, số scene]). Id trùng/rỗng → không làm
 * gì (trả về chính timeline) - id do nơi gọi sinh bằng sceneIdFromFile.
 */
export function addScene(tl: Timeline, index: number, scene: TimelineScene): Timeline {
  if (!scene.id || tl.scenes.some((s) => s.id === scene.id)) return tl;
  const at = clampInt(Number.isFinite(index) ? index : tl.scenes.length, 0, tl.scenes.length);
  const scenes = tl.scenes.slice();
  scenes.splice(at, 0, scene);
  return { ...tl, scenes };
}

/** Âm lượng mặc định của sfx thêm từ editor. */
export const NEW_SFX_VOLUME = 0.8;

/**
 * Thêm một sfx tại `atFrame` (frame tuyệt đối). Nối vào CUỐI mảng - thứ tự
 * trong mảng không ảnh hưởng lúc phát - nên chỉ số của sfx cũ không đổi
 * (selection đang trỏ vào chúng vẫn đúng). Trả kèm selection của sfx mới.
 */
export function addSfx(
  tl: Timeline,
  file: string,
  atFrame: number,
  volume: number = NEW_SFX_VOLUME,
): { timeline: Timeline; selection: Selection | null } {
  if (!file || !Number.isFinite(atFrame)) return { timeline: tl, selection: null };
  const sfx: TimelineSfx = {
    file,
    atFrame: Math.max(0, Math.round(atFrame)),
    volume: Math.min(1, Math.max(0, volume)),
  };
  const list = [...tl.audio.sfx, sfx];
  return {
    timeline: { ...tl, audio: { ...tl.audio, sfx: list } },
    selection: { kind: "sfx", index: list.length - 1 },
  };
}

/** Mức nhạc nền mặc định: nền nhẹ, hạ sâu dưới lời (skill background-music). */
export const NEW_MUSIC_DEFAULTS = { volume: 0.25, duckVolume: 0.1 } as const;

/**
 * Đặt nhạc nền. Chưa có nhạc → mức mặc định. Đã có → THAY FILE, giữ nguyên mức
 * âm lượng/duck người dùng đã chỉnh, các đoạn có lời (`speech` - tính từ
 * transcript, không phụ thuộc bài nhạc) và field lạ.
 */
export function setMusic(tl: Timeline, file: string): Timeline {
  if (!file) return tl;
  const cur = tl.audio.music;
  if (!cur) {
    return { ...tl, audio: { ...tl.audio, music: { file, ...NEW_MUSIC_DEFAULTS } } };
  }
  if (cur.file === file) return tl;
  return { ...tl, audio: { ...tl.audio, music: { ...cur, file } } };
}

/** Độ dài mặc định (giây) của cue thêm tại playhead. */
export const NEW_CUE_SEC = 2;

export type NewCue =
  | { kind: "overlay"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "caption"; word: string };

/**
 * Thêm một cue bắt đầu tại `from`, dài `durationInFrames`. Chèn theo thứ tự thời
 * gian (cue cùng mốc thì đứng sau) để danh sách trong meta.json vẫn dễ đọc.
 * - highlight: một mẩu chữ, key chính, màu nóng;
 * - phụ đề: một dòng chữ;
 * - karaoke: MỘT từ phủ hết cue (sửa/thêm từ trong inspector).
 * Trả kèm selection của cue mới để inspector mở ngay.
 */
export function addCue(
  tl: Timeline,
  cue: NewCue,
  from: number,
  durationInFrames: number,
): { timeline: Timeline; selection: Selection | null } {
  const start = Math.max(0, Math.round(from));
  const dur = Math.max(1, Math.round(durationInFrames));
  if (!Number.isFinite(start) || !Number.isFinite(dur)) return { timeline: tl, selection: null };
  const insertAt = (list: BaseCue[]): number => {
    const i = list.findIndex((c) => c.from > start);
    return i === -1 ? list.length : i;
  };
  switch (cue.kind) {
    case "overlay": {
      const text = cue.text.trim();
      if (!text) return { timeline: tl, selection: null };
      const at = insertAt(tl.overlays);
      const overlays = tl.overlays.slice();
      overlays.splice(at, 0, {
        from: start,
        durationInFrames: dur,
        parts: [{ t: text }],
        tier: "main",
        accent: "hot",
      });
      return { timeline: { ...tl, overlays }, selection: { kind: "overlay", index: at } };
    }
    case "subtitle": {
      const text = cue.text.trim();
      if (!text) return { timeline: tl, selection: null };
      const at = insertAt(tl.subtitles);
      const subtitles = tl.subtitles.slice();
      subtitles.splice(at, 0, { from: start, durationInFrames: dur, text });
      return { timeline: { ...tl, subtitles }, selection: { kind: "subtitle", index: at } };
    }
    case "caption": {
      const word = cue.word.trim();
      if (!word) return { timeline: tl, selection: null };
      const at = insertAt(tl.captions);
      const captions = tl.captions.slice();
      captions.splice(at, 0, {
        from: start,
        durationInFrames: dur,
        words: [{ text: word, start, end: start + dur }],
      });
      return { timeline: { ...tl, captions }, selection: { kind: "caption", index: at } };
    }
  }
}

/**
 * Chỗ đặt cue mới thêm tại playhead `frame`: mặc định dài 2 giây bắt đầu tại
 * playhead; gần cuối video thì co lại cho kết thúc cùng video; còn chưa tới nửa
 * giây (playhead ở End…) thì LÙI điểm bắt đầu về 2 giây trước cuối - cue vài
 * frame không ai đọc kịp, mà cue thò ra sau hết video thì không bao giờ hiện.
 * Video ngắn hơn 2 giây: phủ cả video (≥ 1 frame).
 */
export function newCuePlacement(
  frame: number,
  totalFrames: number,
  fps: number,
): { from: number; durationInFrames: number } {
  const total = Math.max(1, Math.round(totalFrames));
  const full = Math.max(1, Math.round(NEW_CUE_SEC * fps));
  const from = Math.min(Math.max(0, Math.round(frame)), total - 1);
  const remaining = total - from;
  if (remaining >= full) return { from, durationInFrames: full };
  if (remaining >= Math.round(fps / 2)) return { from, durationInFrames: remaining };
  const start = Math.max(0, total - full);
  return { from: start, durationInFrames: Math.max(1, total - start) };
}

/**
 * Vị trí chèn scene theo frame trên timeline: trước scene có điểm giữa nằm sau
 * `frame`, không có thì cuối cùng - cùng luật với kéo đổi thứ tự scene.
 */
export function sceneInsertIndexAt(spans: { start: number; end: number }[], frame: number): number {
  const i = spans.findIndex((s) => frame < (s.start + s.end) / 2);
  return i === -1 ? spans.length : i;
}

/**
 * Chèn scene vào ĐÚNG `frame` (ô "Tạo bằng AI tại đây" của timeline): mốc nằm
 * trong lòng một scene (cách hai mép ≥ nửa giây) thì tách scene đó tại mốc rồi
 * chèn vào giữa; sát mép thì chèn ở ranh giới như sceneInsertIndexAt.
 *
 * Scene chèn vào đẩy hình phía sau lùi lại. Không có track giọng đọc riêng thì
 * lời nằm trong footage và lùi theo hình - karaoke/phụ đề/highlight/layer/sfx BẮT
 * ĐẦU từ chỗ chèn cũng lùi đúng chừng đó, không thì lệch tiếng. Có `audio.voice`
 * thì giọng không lùi, cue bám giọng nên để nguyên. Track trong `locked` (người
 * dùng khóa ở timeline) không bao giờ bị dời.
 */
export function insertSceneAtFrame(
  tl: Timeline,
  scene: TimelineScene,
  frame: number,
  spans: { id: string; start: number; end: number }[],
  ctx: OpsContext,
  locked: ReadonlySet<string> = new Set(),
): Timeline {
  const margin = Math.round(ctx.fps / 2);
  const under = spans.filter((s) => frame - s.start >= margin && s.end - frame >= margin);
  const chosen = under[under.length - 1];
  let base = tl;
  let at = -1;
  let cut = 0;
  if (chosen) {
    const index = sceneIndexById(tl, chosen.id);
    const split = splitSceneAt(tl, index, frame - chosen.start, uniqueSceneId(tl.scenes, chosen.id), ctx);
    if (split !== tl) {
      base = split;
      at = index + 1;
      cut = Math.round(frame);
    }
  }
  if (at === -1) {
    at = sceneInsertIndexAt(spans, frame);
    cut = at < spans.length ? spans[at].start : (spans[spans.length - 1]?.end ?? 0);
  }
  const next = addScene(base, at, scene);
  if (next === base) return tl;
  const delta = sceneDurationFrames(scene, ctx.fps);
  if (tl.audio.voice || !delta) return next;
  return shiftTimedFrom(next, cut, delta, locked);
}

/**
 * Dời mọi cue / layer / sfx BẮT ĐẦU từ `at` trở đi thêm `delta` frame (giữ field
 * lạ). Track có tên trong `skip` giữ nguyên.
 */
function shiftTimedFrom(tl: Timeline, at: number, delta: number, skip: ReadonlySet<string>): Timeline {
  const late = (c: { from?: unknown } | null | undefined): boolean =>
    !!c && typeof c.from === "number" && c.from >= at;
  const shift = <T extends { from: number }>(c: T): T => ({ ...c, from: c.from + delta });
  const next: Timeline = { ...tl };
  if (!skip.has("caption")) next.captions = tl.captions.map((c) => (late(c) ? shiftWords(shift(c), delta) : c));
  if (!skip.has("subtitle")) next.subtitles = tl.subtitles.map((c) => (late(c) ? shift(c) : c));
  if (!skip.has("overlay")) next.overlays = tl.overlays.map((c) => (late(c) ? shift(c) : c));
  if (!skip.has("sfx")) {
    next.audio = {
      ...tl.audio,
      sfx: tl.audio.sfx.map((s) =>
        s && typeof s.atFrame === "number" && s.atFrame >= at ? { ...s, atFrame: s.atFrame + delta } : s,
      ),
    };
  }
  // `layers` là khóa tùy chọn - project chưa có thì không tự ghi `layers: []`
  if (Array.isArray(tl.layers) && !skip.has("layer")) next.layers = tl.layers.map((l) => (late(l) ? shift(l) : l));
  return next;
}

// ================================================================ layer (docs/EDITOR-V2-PLAN.md mục 1.2)
//
// `layers[]` là khóa top-level TÙY CHỌN: project cũ không có khóa này và phải
// giữ nguyên như vậy (không tự ghi `layers: []`). Đọc luôn qua layersOf - meta.json
// do AI ghi có thể để sai kiểu. `from`/`durationInFrames` là FRAME TUYỆT ĐỐI như
// cue; `keyframes[].frame` TƯƠNG ĐỐI so với `from`. Thứ tự mảng = thứ tự vẽ (phần
// tử sau nằm trên).

export type TimelineLayer = NonNullable<Timeline["layers"]>[number];
export type TimelineLayerKeyframe = NonNullable<TimelineLayer["keyframes"]>[number];
export type LayerKind = TimelineLayer["kind"];

const LAYER_KINDS: readonly string[] = ["image", "video", "text", "shape"];

/** Danh sách layer (rỗng khi vắng mặt hoặc sai kiểu). */
export const layersOf = (tl: Timeline): TimelineLayer[] => (Array.isArray(tl.layers) ? tl.layers : []);

export const layerIndexById = (tl: Timeline, id: string): number =>
  layersOf(tl).findIndex((l) => !!l && typeof l === "object" && l.id === id);

export const layerById = (tl: Timeline, id: string): TimelineLayer | null =>
  layersOf(tl)[layerIndexById(tl, id)] ?? null;

export function isLayerWellFormed(layer: TimelineLayer | undefined | null): layer is TimelineLayer {
  return (
    !!layer &&
    typeof layer === "object" &&
    typeof layer.id === "string" &&
    LAYER_KINDS.includes(layer.kind) &&
    isFiniteNum(layer.from) &&
    isFiniteNum(layer.durationInFrames)
  );
}

const layerEnd = (l: TimelineLayer): number => l.from + l.durationInFrames;

/** Ghi lại mảng layer (giữ identity khi không đổi). */
function withLayers(tl: Timeline, layers: TimelineLayer[]): Timeline {
  return layers === tl.layers ? tl : { ...tl, layers };
}

/** Thay layer `id` bằng kết quả của `fn` (fn trả chính layer cũ = không đổi). */
function editLayer(tl: Timeline, id: string, fn: (layer: TimelineLayer) => TimelineLayer): Timeline {
  const index = layerIndexById(tl, id);
  if (index < 0) return tl;
  const layers = layersOf(tl);
  const cur = layers[index];
  const next = fn(cur);
  return next === cur ? tl : withLayers(tl, replaceAt(layers, index, next));
}

/** Id layer chưa dùng: "text-1" → "text-2"… (bỏ hậu tố số cũ trước khi đếm). */
export function uniqueLayerId(layers: TimelineLayer[], base: string): string {
  const taken = new Set(layers.map((l) => l?.id));
  const stem = base.replace(/-\d+$/, "") || "layer";
  for (let n = 2; ; n += 1) {
    const candidate = `${stem}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Id cho layer MỚI: `<prefix>-1`, `<prefix>-2`… (prefix kebab-case). */
export function newLayerId(layers: TimelineLayer[], prefix: string): string {
  const taken = new Set(layers.map((l) => l?.id));
  const stem = prefix.replace(/-\d+$/, "") || "layer";
  for (let n = 1; ; n += 1) {
    const candidate = `${stem}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Id layer suy từ tên file ("Logo Meta.png" → "logo-meta-1"). */
export function layerIdFromFile(layers: TimelineLayer[], relPath: string): string {
  const stem = sceneIdFromFile([], relPath);
  return newLayerId(layers, stem === "scene" ? "media" : stem);
}

/**
 * Patch NÔNG một layer (hợp đồng v2): `undefined` = xóa khóa; object lồng
 * (transform, style, color, crop, animation) được THAY NGUYÊN - nơi gọi tự spread.
 */
export function patchLayer(tl: Timeline, id: string, patch: Partial<TimelineLayer>): Timeline {
  return editLayer(tl, id, (layer) => applyPatch(layer, patch));
}

/** Thêm layer lên TRÊN CÙNG (cuối mảng). Id rỗng/trùng → không làm gì. */
export function addLayer(tl: Timeline, layer: TimelineLayer): Timeline {
  if (!layer?.id || layerIndexById(tl, layer.id) >= 0) return tl;
  return { ...tl, layers: [...layersOf(tl), layer] };
}

export function removeLayer(tl: Timeline, id: string): Timeline {
  const index = layerIndexById(tl, id);
  if (index < 0) return tl;
  return { ...tl, layers: layersOf(tl).filter((_, i) => i !== index) };
}

const timeOverlaps = (a: TimelineLayer, b: TimelineLayer): boolean =>
  isLayerWellFormed(a) && isLayerWellFormed(b) && a.from < layerEnd(b) && b.from < layerEnd(a);

/**
 * Đưa layer lên (+1) / xuống (-1) một lớp. "Một lớp" = vượt qua layer GẦN NHẤT
 * theo hướng đó mà CHỒNG THỜI GIAN với nó - đổi chỗ với layer không cùng lúc
 * xuất hiện thì trên khung hình chẳng có gì đổi, người dùng tưởng phím hỏng.
 * Không còn layer nào chồng theo hướng đó → trả lại chính timeline.
 */
export function moveLayerZ(tl: Timeline, id: string, delta: 1 | -1): Timeline {
  const layers = layersOf(tl);
  const index = layerIndexById(tl, id);
  if (index < 0) return tl;
  const self = layers[index];
  let target = -1;
  for (let i = index + delta; i >= 0 && i < layers.length; i += delta) {
    if (timeOverlaps(self, layers[i])) {
      target = i;
      break;
    }
  }
  if (target < 0) return tl;
  return withLayers(tl, moveItem(layers, index, target));
}

/** Dời layer `delta` frame - như moveCue (`maxStart` chặn kéo ra sau hết video). */
export function moveLayer(
  tl: Timeline,
  id: string,
  delta: number,
  maxStart: number = Number.POSITIVE_INFINITY,
): Timeline {
  const d = Math.round(delta);
  if (!Number.isFinite(d) || d === 0) return tl;
  return editLayer(tl, id, (layer) => {
    if (!isLayerWellFormed(layer)) return layer;
    const from = Math.min(Math.max(0, layer.from + d), Math.max(layer.from, maxStart));
    return from === layer.from ? layer : { ...layer, from };
  });
}

/** Đặt mốc bắt đầu tuyệt đối (frame). */
export function setLayerStart(tl: Timeline, id: string, frame: number): Timeline {
  const layer = layerById(tl, id);
  if (!isLayerWellFormed(layer)) return tl;
  return moveLayer(tl, id, Math.max(0, Math.round(frame)) - layer.from);
}

// ---- keyframe

type KeyProp = "x" | "y" | "scale" | "rotate" | "opacity";
const KEY_PROPS: KeyProp[] = ["x", "y", "scale", "rotate", "opacity"];

export interface LayerKeyValues {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
}


const keyframesOf = (layer: TimelineLayer): TimelineLayerKeyframe[] =>
  Array.isArray(layer.keyframes)
    ? layer.keyframes.filter((k) => !!k && typeof k === "object" && isFiniteNum(k.frame))
    : [];

/**
 * Giá trị một thuộc tính tại frame tương đối `rel` - ĐÚNG hàm nội suy engine
 * dùng lúc vẽ (`keyframeValue` của @engine/layerGeometry), nên keyframe chèn
 * khi cắt/tách mang đúng giá trị hình đang hiện. undefined = không keyframe nào
 * có thuộc tính này.
 */
const keyValueAt = (kfs: TimelineLayerKeyframe[], prop: KeyProp, rel: number): number | undefined =>
  keyframeValue(kfs as EngineLayerKeyframe[], prop, rel);

/**
 * Vị trí/cỡ/xoay/độ mờ của layer tại frame TƯƠNG ĐỐI `rel`: keyframe nếu có,
 * không thì giá trị tĩnh (transform/opacity, mặc định 0/0/1/0/1). Dùng để thêm
 * keyframe "tại playhead" đúng chỗ hình đang đứng.
 */
export function layerValuesAt(layer: TimelineLayer, rel: number): LayerKeyValues {
  const tr: Record<string, unknown> = layer.transform && typeof layer.transform === "object" ? layer.transform : {};
  const base: LayerKeyValues = {
    x: isFiniteNum(tr.x) ? tr.x : 0,
    y: isFiniteNum(tr.y) ? tr.y : 0,
    scale: isFiniteNum(tr.scale) ? tr.scale : 1,
    rotate: isFiniteNum(tr.rotate) ? tr.rotate : 0,
    opacity: isFiniteNum(layer.opacity) ? layer.opacity : 1,
  };
  const kfs = keyframesOf(layer);
  for (const prop of KEY_PROPS) {
    const v = keyValueAt(kfs, prop, rel);
    if (v !== undefined) base[prop] = round4(v);
  }
  return base;
}

/**
 * Keyframe ở `frame` mang giá trị tại `rel` của mọi thuộc tính ĐANG có keyframe
 * (để đường đi không đổi qua điểm đó) - dùng khi cắt/tách layer.
 */
function sampleKeyframe(kfs: TimelineLayerKeyframe[], rel: number, frame: number): TimelineLayerKeyframe {
  const kf: TimelineLayerKeyframe = { frame };
  for (const prop of KEY_PROPS) {
    const v = keyValueAt(kfs, prop, rel);
    if (v !== undefined) kf[prop] = round4(v);
  }
  return kf;
}

/**
 * Keyframe sau khi đầu layer dời tới frame tương đối `offset` (cắt đầu / nửa
 * sau của lượt tách): keyframe trước `offset` bị bỏ, thay bằng MỘT keyframe tại 0
 * mang đúng giá trị lúc đó - hình không nhảy. Keyframe từ `offset` trở đi lùi về.
 */
function rebaseKeyframes(kfs: TimelineLayerKeyframe[], offset: number): TimelineLayerKeyframe[] {
  if (kfs.length === 0 || offset <= 0) return kfs;
  const kept = kfs.filter((k) => k.frame >= offset).map((k) => ({ ...k, frame: k.frame - offset }));
  if (!kept.some((k) => k.frame === 0)) {
    const before = [...kfs].sort((a, b) => a.frame - b.frame).reverse().find((k) => k.frame < offset);
    const sample = sampleKeyframe(kfs, offset, 0);
    if (before?.ease) sample.ease = before.ease;
    kept.unshift(sample);
  }
  return kept.sort((a, b) => a.frame - b.frame);
}

/** Thêm (hoặc gộp vào) keyframe tại frame tương đối `relFrame` - kẹp trong layer. */
export function addLayerKeyframe(
  tl: Timeline,
  id: string,
  relFrame: number,
  values: Partial<LayerKeyValues>,
): Timeline {
  return editLayer(tl, id, (layer) => {
    if (!isLayerWellFormed(layer) || !Number.isFinite(relFrame)) return layer;
    const frame = clampInt(relFrame, 0, Math.max(0, layer.durationInFrames - 1));
    const clean: Partial<LayerKeyValues> = {};
    for (const prop of KEY_PROPS) {
      const v = values[prop];
      if (isFiniteNum(v)) clean[prop] = round4(v);
    }
    const kfs: TimelineLayerKeyframe[] = Array.isArray(layer.keyframes) ? layer.keyframes : [];
    const at = kfs.findIndex((k) => k?.frame === frame);
    let next: TimelineLayerKeyframe[];
    if (at >= 0) {
      const merged = applyPatch(kfs[at], clean);
      if (merged === kfs[at]) return layer;
      next = replaceAt(kfs, at, merged);
    } else {
      next = [...kfs, { frame, ...clean }].sort((a, b) => (a?.frame ?? 0) - (b?.frame ?? 0));
    }
    return { ...layer, keyframes: next };
  });
}

/** Bỏ keyframe tại `relFrame`; hết keyframe thì xóa luôn khóa (về hành vi tĩnh). */
export function removeLayerKeyframe(tl: Timeline, id: string, relFrame: number): Timeline {
  return editLayer(tl, id, (layer) => {
    if (!Array.isArray(layer.keyframes)) return layer;
    const target = Math.round(relFrame);
    const next = layer.keyframes.filter((k) => k?.frame !== target);
    if (next.length === layer.keyframes.length) return layer;
    if (next.length > 0) return { ...layer, keyframes: next };
    const copy = { ...layer };
    delete copy.keyframes;
    return copy;
  });
}

/**
 * Ghi kết quả một lượt kéo trên khung xem trước vào layer. Thuộc tính đang có
 * keyframe (x/y/scale/rotate) thì keyframe THẮNG transform lúc vẽ (`layerBox`),
 * nên ghi vào transform sẽ không thấy gì - với các thuộc tính đó, thêm/cập nhật
 * keyframe tại playhead; phần còn lại (và flip) vào transform tĩnh như thường.
 * `absFrame` = frame tuyệt đối của playhead; ngoài khoảng layer thì chỉ ghi
 * phần tĩnh.
 */
export function applyLayerCanvasTransform(
  tl: Timeline,
  id: string,
  transform: Record<string, unknown>,
  absFrame: number,
): Timeline {
  const layer = layerById(tl, id);
  if (!isLayerWellFormed(layer)) return tl;
  const kfs = keyframesOf(layer);
  const keyed = (["x", "y", "scale", "rotate"] as const).filter((p) => kfs.some((k) => isFiniteNum(k[p])));
  if (keyed.length === 0) return patchLayer(tl, id, { transform: transform as TimelineLayer["transform"] });
  const rel = Math.round(absFrame) - layer.from;
  const inside = rel >= 0 && rel < layer.durationInFrames;
  const oldBase: Record<string, unknown> =
    layer.transform && typeof layer.transform === "object" ? layer.transform : {};
  const base: Record<string, unknown> = { ...transform };
  const keyValues: Partial<LayerKeyValues> = {};
  for (const p of keyed) {
    // Giữ nguyên giá trị tĩnh cũ của thuộc tính có keyframe
    if (p in oldBase) base[p] = oldBase[p];
    else delete base[p];
    const v = transform[p];
    if (isFiniteNum(v)) keyValues[p] = v;
  }
  let next = patchLayer(tl, id, { transform: base as TimelineLayer["transform"] });
  if (inside && Object.keys(keyValues).length > 0) next = addLayerKeyframe(next, id, rel, keyValues);
  return next;
}

// ---- kéo mép / tách

/** Độ dài tối đa (frame) của layer video theo file thật; null = không giới hạn. */
function layerMaxFrames(layer: TimelineLayer, ctx: OpsContext): number | null {
  if (layer.kind !== "video" || typeof layer.src !== "string") return null;
  const sec = ctx.mediaDurationSec(layer.src);
  if (sec === null) return null;
  const start = isFiniteNum(layer.mediaStart) ? layer.mediaStart : 0;
  return Math.max(1, Math.floor((sec - start) * ctx.fps + 1e-6));
}

/**
 * Kéo mép layer `delta` frame. Mép đầu: đổi `from` giữ mép cuối - layer video
 * cắt đầu file theo (`mediaStart`), keyframe giữ nguyên VỊ TRÍ TUYỆT ĐỐI (lùi
 * theo, phần bị cắt thay bằng keyframe tại 0). Mép cuối: đổi độ dài, layer video
 * không dài quá phần còn lại của file. Luôn còn ≥ 1 frame.
 */
export function resizeLayer(
  tl: Timeline,
  id: string,
  edge: "start" | "end",
  delta: number,
  ctx: OpsContext,
): Timeline {
  const d = Math.round(delta);
  if (!Number.isFinite(d) || d === 0) return tl;
  return editLayer(tl, id, (layer) => {
    if (!isLayerWellFormed(layer)) return layer;
    const end = layerEnd(layer);
    if (edge === "start") {
      const mediaStart = isFiniteNum(layer.mediaStart) ? layer.mediaStart : 0;
      const mediaStartFrames = Math.round(mediaStart * ctx.fps);
      // Video: không kéo đầu ra trước giây 0 của file
      const lower = layer.kind === "video" ? Math.max(0, layer.from - mediaStartFrames) : 0;
      const from = clampInt(layer.from + d, lower, end - 1);
      const shift = from - layer.from;
      if (shift === 0) return layer;
      const next: TimelineLayer = { ...layer, from, durationInFrames: end - from };
      if (layer.kind === "video") next.mediaStart = Math.max(0, frameToSec(mediaStartFrames + shift, ctx.fps));
      const kfs = keyframesOf(layer);
      if (kfs.length > 0) {
        next.keyframes = shift > 0 ? rebaseKeyframes(kfs, shift) : kfs.map((k) => ({ ...k, frame: k.frame - shift }));
      }
      return next;
    }
    const max = layerMaxFrames(layer, ctx);
    const upper = max === null ? Number.POSITIVE_INFINITY : Math.max(max, layer.durationInFrames);
    const dur = clampInt(layer.durationInFrames + d, 1, upper);
    return dur === layer.durationInFrames ? layer : { ...layer, durationInFrames: dur };
  });
}

/** Đặt độ dài tuyệt đối (frame). */
export function setLayerDuration(tl: Timeline, id: string, frames: number, ctx: OpsContext): Timeline {
  const layer = layerById(tl, id);
  if (!isLayerWellFormed(layer)) return tl;
  return resizeLayer(tl, id, "end", Math.max(1, Math.round(frames)) - layer.durationInFrames, ctx);
}

/**
 * Tách layer tại frame TUYỆT ĐỐI `frame`. Nửa đầu giữ id (bỏ hiệu ứng RA - chỗ
 * cắt không còn là điểm kết thúc), nửa sau nhận `newId` (bỏ hiệu ứng VÀO), nằm
 * ngay trên nửa đầu. Keyframe được cắt liền mạch tại điểm tách (nửa sau đánh lại
 * mốc từ 0); layer video nửa sau phát tiếp file từ đúng chỗ cắt.
 */
export function splitLayerAt(tl: Timeline, id: string, frame: number, newId: string, fps: number): Timeline {
  const index = layerIndexById(tl, id);
  const layer = layersOf(tl)[index];
  if (!isLayerWellFormed(layer)) return tl;
  if (!newId || layerIndexById(tl, newId) >= 0) return tl;
  const at = Math.round(frame);
  if (at <= layer.from || at >= layerEnd(layer)) return tl;
  const local = at - layer.from;

  const first: TimelineLayer = { ...layer, durationInFrames: local };
  const second: TimelineLayer = {
    ...structuredClone(layer),
    id: newId,
    from: at,
    durationInFrames: layer.durationInFrames - local,
  };
  const kfs = keyframesOf(layer);
  if (kfs.length > 0) {
    const head = kfs.filter((k) => k.frame <= local);
    if (!head.some((k) => k.frame === local)) head.push(sampleKeyframe(kfs, local, local));
    first.keyframes = head.sort((a, b) => a.frame - b.frame);
    second.keyframes = rebaseKeyframes(structuredClone(kfs), local);
  }
  if (layer.kind === "video") {
    const start = isFiniteNum(layer.mediaStart) ? layer.mediaStart : 0;
    second.mediaStart = frameToSec(Math.round(start * fps) + local, fps);
  }
  const anim = layer.animation && typeof layer.animation === "object" ? layer.animation : null;
  if (anim) {
    const a1 = { ...anim };
    delete a1.out;
    const a2 = { ...structuredClone(anim) };
    delete a2.in;
    first.animation = a1;
    second.animation = a2;
  }
  const layers = layersOf(tl).slice();
  layers.splice(index, 1, first, second);
  return { ...tl, layers };
}

// ---- layer mới

/** Độ dài mặc định (giây) của layer mới thêm tại playhead. */
export const NEW_LAYER_SEC = 3;
/** Layer video mới khi KHÔNG đo được thời lượng file (đo được thì lấy nguyên file). */
export const NEW_LAYER_VIDEO_FALLBACK_SEC = 5;

/**
 * Chỗ đặt layer mới tại playhead `frame` - cùng luật với cue (newCuePlacement):
 * không bao giờ thò ra sau hết video, gần cuối thì co lại / lùi điểm bắt đầu.
 */
export function newLayerPlacement(
  frame: number,
  totalFrames: number,
  fps: number,
  sec: number = NEW_LAYER_SEC,
): { from: number; durationInFrames: number } {
  const total = Math.max(1, Math.round(totalFrames));
  const full = Math.max(1, Math.round(sec * fps));
  const from = Math.min(Math.max(0, Math.round(frame)), total - 1);
  const remaining = total - from;
  if (remaining >= full) return { from, durationInFrames: full };
  if (remaining >= Math.round(fps / 2)) return { from, durationInFrames: remaining };
  const start = Math.max(0, total - full);
  return { from: start, durationInFrames: Math.max(1, total - start) };
}

/** Hiệu ứng vào/ra mặc định của layer mới - nhẹ, không gây chú ý hơn nội dung. */
const DEFAULT_LAYER_ANIMATION = { in: "fade", out: "fade" } as const;

/** Layer chữ mới: chữ trắng đậm căn giữa, hộp rộng 80% khung, nằm giữa khung. */
export function newTextLayer(
  id: string,
  text: string,
  from: number,
  durationInFrames: number,
  opts: { vertical?: boolean } = {},
): TimelineLayer {
  return {
    id,
    kind: "text",
    from: Math.max(0, Math.round(from)),
    durationInFrames: Math.max(1, Math.round(durationInFrames)),
    text,
    width: 0.8,
    style: {
      fontSizePx: opts.vertical ? 84 : 72,
      fontWeight: 700,
      color: "#ffffff",
      align: "center",
      lineHeight: 1.2,
      shadow: true,
    },
    animation: { ...DEFAULT_LAYER_ANIMATION },
  } as TimelineLayer;
}

/** Khối màu mới: chữ nhật bo góc 16:9, rộng 40% khung, màu chính của brand. */
export function newShapeLayer(id: string, from: number, durationInFrames: number, color = "#ed3c47"): TimelineLayer {
  return {
    id,
    kind: "shape",
    from: Math.max(0, Math.round(from)),
    durationInFrames: Math.max(1, Math.round(durationInFrames)),
    width: 0.4,
    aspect: 16 / 9,
    style: { backgroundColor: color, radiusPx: 24 },
    animation: { ...DEFAULT_LAYER_ANIMATION },
  } as TimelineLayer;
}

/**
 * Layer ảnh/video mới từ file trong project. Video: phát từ đầu file, GIỮ tiếng
 * (ghi `muted: false` tường minh - engine mặc định layer video là câm). Tỉ lệ
 * hộp lấy từ chính file lúc vẽ (không ghi `aspect`).
 */
export function newMediaLayer(
  id: string,
  kind: "image" | "video",
  src: string,
  from: number,
  durationInFrames: number,
): TimelineLayer {
  const layer: Record<string, unknown> = {
    id,
    kind,
    from: Math.max(0, Math.round(from)),
    durationInFrames: Math.max(1, Math.round(durationInFrames)),
    src,
    width: 0.5,
    animation: { ...DEFAULT_LAYER_ANIMATION },
  };
  if (kind === "video") {
    layer.mediaStart = 0;
    layer.muted = false;
  }
  return layer as TimelineLayer;
}

// ================================================================ sao chép / dán

/** Một món trong clipboard của editor (bản sao sâu - sửa timeline sau đó không đổi nó). */
export type ClipboardEntry =
  | { kind: "scene"; scene: TimelineScene }
  | { kind: "layer"; layer: TimelineLayer }
  | { kind: "caption"; cue: TimelineCaptionCue }
  | { kind: "subtitle"; cue: TimelineSubtitleCue }
  | { kind: "overlay"; cue: TimelineHighlightCue }
  | { kind: "sfx"; sfx: TimelineSfx };

/** Sao chép phần tử đang chọn - null khi không sao chép được (nhạc, giọng, dữ liệu lỗi). */
export function copySelection(tl: Timeline, sel: Selection | null): ClipboardEntry | null {
  if (!sel || !selectionExists(tl, sel) || !isWellFormed(tl, sel)) return null;
  switch (sel.kind) {
    case "scene":
      return { kind: "scene", scene: structuredClone(tl.scenes[sceneIndexById(tl, sel.id)]) };
    case "layer": {
      const layer = layerById(tl, sel.id);
      return layer ? { kind: "layer", layer: structuredClone(layer) } : null;
    }
    case "caption":
      return { kind: "caption", cue: structuredClone(tl.captions[sel.index]) };
    case "subtitle":
      return { kind: "subtitle", cue: structuredClone(tl.subtitles[sel.index]) };
    case "overlay":
      return { kind: "overlay", cue: structuredClone(tl.overlays[sel.index]) };
    case "sfx":
      return { kind: "sfx", sfx: structuredClone(tl.audio.sfx[sel.index]) };
    default:
      return null;
  }
}

/**
 * Dán tại playhead `frame`: scene chèn vào vị trí tương ứng (cùng luật thả từ
 * thư viện), layer/cue bắt đầu tại playhead (layer nằm trên cùng), sfx đặt tại
 * playhead. Id mới khi trùng. Mỗi lần dán là một bản sao mới (clipboard dùng lại được).
 */
export function pasteClipboard(
  tl: Timeline,
  clip: ClipboardEntry,
  frame: number,
  spans: { start: number; end: number }[],
): { timeline: Timeline; selection: Selection | null } | null {
  const at = Math.max(0, Math.round(frame));
  if (!Number.isFinite(at)) return null;
  switch (clip.kind) {
    case "scene": {
      const src = structuredClone(clip.scene);
      const id = tl.scenes.some((s) => s.id === src.id) ? uniqueSceneId(tl.scenes, src.id) : src.id;
      const next = addScene(tl, sceneInsertIndexAt(spans, at), { ...src, id });
      return next === tl ? null : { timeline: next, selection: { kind: "scene", id } };
    }
    case "layer": {
      const src = structuredClone(clip.layer);
      const layers = layersOf(tl);
      const id = layers.some((l) => l?.id === src.id) ? uniqueLayerId(layers, src.id) : src.id;
      const next = addLayer(tl, { ...src, id, from: at });
      return next === tl ? null : { timeline: next, selection: { kind: "layer", id } };
    }
    case "caption": {
      const src = structuredClone(clip.cue);
      const cue = shiftWords({ ...src, from: at }, at - src.from);
      const index = sortedInsertIndex(tl.captions, at);
      const captions = tl.captions.slice();
      captions.splice(index, 0, cue);
      return { timeline: { ...tl, captions }, selection: { kind: "caption", index } };
    }
    case "subtitle": {
      const index = sortedInsertIndex(tl.subtitles, at);
      const subtitles = tl.subtitles.slice();
      subtitles.splice(index, 0, { ...structuredClone(clip.cue), from: at });
      return { timeline: { ...tl, subtitles }, selection: { kind: "subtitle", index } };
    }
    case "overlay": {
      const index = sortedInsertIndex(tl.overlays, at);
      const overlays = tl.overlays.slice();
      overlays.splice(index, 0, { ...structuredClone(clip.cue), from: at });
      return { timeline: { ...tl, overlays }, selection: { kind: "overlay", index } };
    }
    case "sfx": {
      const list = [...tl.audio.sfx, { ...structuredClone(clip.sfx), atFrame: at }];
      return {
        timeline: { ...tl, audio: { ...tl.audio, sfx: list } },
        selection: { kind: "sfx", index: list.length - 1 },
      };
    }
  }
}

// ================================================================ cảnh trám (ảnh AI)

/** Độ phóng cuối của punch-in nhẹ cho cảnh trám - đủ để ảnh tĩnh "sống", không giật. */
export const FILLER_PUNCH_SCALE = 1.08;

/** Scene ảnh cảnh trám: ảnh tĩnh 3 giây + punch-in nhẹ (1 → 1.08). */
export function newFillerScene(id: string, relPath: string, fps: number): TimelineScene {
  const scene = newImageScene(id, relPath, fps);
  const dur = scene.durationInFrames ?? Math.round(NEW_IMAGE_SEC * fps);
  return {
    ...scene,
    zoom: {
      keys: [
        { frame: 0, scale: 1, ease: "inOut" },
        { frame: Math.max(1, dur - 1), scale: FILLER_PUNCH_SCALE },
      ],
    },
  };
}
