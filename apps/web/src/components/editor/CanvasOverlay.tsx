"use client";

/**
 * Lớp thao tác trực tiếp trên khung xem trước (docs/EDITOR-V2-PLAN.md §2.3).
 *
 * Nằm ĐÈ lên trình phát trong `.editor-stage` (stage là position:relative).
 * Trình phát được co vừa khung (letterbox) bên trong stage nên lớp này đo đúng
 * hình chữ nhật thật của Player (`.__remotion-player`) rồi đổi tọa độ:
 *   px trên màn hình = rect.left + px composition × (rect.width / compWidth).
 *
 * Hình học hộp lấy từ CHÍNH hàm engine dùng để vẽ (`layerBox`, `sceneBox` của
 * engines/remotion/src/layerGeometry.ts) - khung chọn khớp pixel với hình, không
 * có công thức thứ hai để lệch nhau. Cue (karaoke/phụ đề/highlight) tự dàn chữ
 * nên không có công thức: engine gắn `data-cue-kind`/`data-cue-index` lên hộp
 * chữ và lớp này đo thẳng hộp đó (components/cueTransform.ts).
 *
 * Thao tác: bấm chọn mục TRÊN CÙNG dưới con trỏ - cue nằm trên layer (đúng thứ
 * tự vẽ của Assemble), không trúng gì → chọn scene đang ở playhead; kéo thân
 * hộp = dời (Shift khóa trục); kéo góc = đổi cỡ giữ tỉ lệ; tay nắm tròn phía
 * trên = xoay (Shift bước 15°, cue không xoay). Nhấp đúp vào mục có chữ = sửa
 * chữ ở inspector. Trong lúc kéo gửi `onTransform(..., "preview")` (trang gộp
 * vào MỘT bước hoàn tác), nhả chuột gửi "commit". Khung đang có focus: mũi tên
 * dời 1px (Shift 10px) - phím tắt tua frame của trang không chạy khi đó.
 */

import { layerBox, sceneBox } from "@engine/layerGeometry";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Timeline, TimelineScene } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { EditorContext } from "./EditorContext";
import {
  CUE_KIND,
  cueTransformOf,
  isCueSel,
  layersOf,
  layerValuesAt,
  type CueSelKind,
  type Selection,
  type TimelineLayer,
} from "./ops";
import { computeSceneSpans } from "./timing";

/** Mục kéo được trên khung: scene/layer theo id, cue (karaoke/phụ đề/highlight) theo chỉ số */
export type CanvasTarget =
  | { kind: "scene"; id: string }
  | { kind: "layer"; id: string }
  | { kind: CueSelKind; index: number };

const sameTarget = (a: CanvasTarget, b: Selection | null): boolean => {
  if (!b || a.kind !== b.kind) return false;
  if ("id" in a) return "id" in b && a.id === b.id;
  return "index" in b && a.index === b.index;
};

export interface CanvasOverlayProps {
  timeline: Timeline;
  selection: Selection | null;
  fps: number;
  compWidth: number;
  compHeight: number;
  readOnly: boolean;
  /** Mục thuộc track đang khóa: vẫn chọn được để xem, không kéo/dời được */
  isLocked?: (target: CanvasTarget) => boolean;
  getFrame: () => number;
  /** Tỉ lệ rộng/cao đo được của file media (relPath trong project) */
  mediaAspect: (relPath: string) => number | undefined;
  onSelect: (sel: Selection) => void;
  /** Nhấp đúp vào mục có chữ (layer chữ, cue): trang đưa con trỏ vào ô sửa chữ của inspector */
  onEditText?: (sel: Selection) => void;
  /** transform = object transform MỚI trọn vẹn (đã gộp field cũ) */
  onTransform: (target: CanvasTarget, transform: Record<string, unknown>, phase: "preview" | "commit") => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Hộp trên composition (px) */
interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotate: number;
}

type DragMode = "move" | "scale" | "rotate";

interface DragState {
  mode: DragMode;
  target: CanvasTarget;
  pointerId: number;
  /** Điểm bấm (px composition) */
  start: { x: number; y: number };
  /** Tâm hộp lúc bấm (px composition) */
  center: { x: number; y: number };
  /** transform gốc (giữ field lạ, flip…) */
  base: Record<string, unknown>;
  /** Giá trị HIỆU LỰC lúc bấm (gồm keyframe) */
  x0: number;
  y0: number;
  scale0: number;
  rotate0: number;
  /** px composition cho mỗi đơn vị x / y */
  kx: number;
  ky: number;
  moved: boolean;
  last: Record<string, unknown> | null;
}

const HANDLE = 10;
const ROTATE_OFFSET = 24;
const SCALE_MIN = 0.1;
const SCALE_MAX = 5;
const noopSubscribe = () => () => {};

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const round = (v: number, digits: number): number => {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** Góc về -180..180 */
const normAngle = (deg: number): number => {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  if (a === -180) a = 180;
  return a;
};

/** Điểm (px composition) có nằm trong hộp đã xoay không */
function hitBox(box: Box, x: number, y: number): boolean {
  const rad = (-box.rotate * Math.PI) / 180;
  const dx = x - box.cx;
  const dy = y - box.cy;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(lx) <= box.w / 2 && Math.abs(ly) <= box.h / 2;
}

const sameBox = (a: Box | null, b: Box | null): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    Math.abs(a.cx - b.cx) < 0.5 &&
    Math.abs(a.cy - b.cy) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5);

const isLayerOk = (l: TimelineLayer | undefined): l is TimelineLayer =>
  !!l &&
  typeof l === "object" &&
  typeof l.id === "string" &&
  typeof l.from === "number" &&
  typeof l.durationInFrames === "number";

const CUE_KINDS: readonly CueSelKind[] = ["caption", "subtitle", "overlay"];

export function CanvasOverlay({
  timeline,
  selection,
  fps,
  compWidth,
  compHeight,
  readOnly,
  isLocked,
  getFrame,
  mediaAspect,
  onSelect,
  onEditText,
  onTransform,
}: CanvasOverlayProps) {
  const { t } = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<DragMode | null>(null);

  // Playhead: đăng ký store phát của editor (nếu có) để hộp đi theo keyframe /
  // hiệu ứng vào-ra lúc phát và lúc tua; ngoài editor thì vẽ tĩnh
  const editor = useContext(EditorContext);
  const frame = useSyncExternalStore(editor?.playback.subscribe ?? noopSubscribe, getFrame, () => 0);

  // ---- đo hình chữ nhật thật của Player trong stage ----
  const measure = useCallback(() => {
    const root = rootRef.current;
    const stage = root?.parentElement;
    if (!root || !stage) return false;
    const rootRect = root.getBoundingClientRect();
    const player = stage.querySelector<HTMLElement>(".__remotion-player");
    let next: Rect | null = null;
    if (player) {
      const r = player.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        next = { left: r.left - rootRect.left, top: r.top - rootRect.top, width: r.width, height: r.height };
      }
    }
    if (!next) {
      // Chưa thấy Player (đang gắn): tính như PreviewPlayer - vừa khung nội dung, căn giữa
      const cs = getComputedStyle(stage);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      const bw = stage.clientWidth - pl - pr;
      const bh = stage.clientHeight - pt - pb;
      if (bw <= 0 || bh <= 0 || compWidth <= 0 || compHeight <= 0) return false;
      const aspect = compWidth / compHeight;
      const w = Math.floor(Math.min(bw, bh * aspect));
      const h = Math.floor(w / aspect);
      next = { left: pl + (bw - w) / 2, top: pt + (bh - h) / 2, width: w, height: h };
    }
    setRect((prev) =>
      prev &&
      Math.abs(prev.left - next.left) < 0.5 &&
      Math.abs(prev.top - next.top) < 0.5 &&
      Math.abs(prev.width - next.width) < 0.5 &&
      Math.abs(prev.height - next.height) < 0.5
        ? prev
        : next,
    );
    return !!player;
  }, [compWidth, compHeight]);

  useLayoutEffect(() => {
    const stage = rootRef.current?.parentElement;
    if (!stage) return;
    let raf = 0;
    let tries = 0;
    // Player gắn vào DOM sau một hai lượt render của PreviewPlayer - thử lại vài khung
    const retry = () => {
      if (measure() || tries++ > 30) return;
      raf = requestAnimationFrame(retry);
    };
    retry();
    const observer = new ResizeObserver(() => {
      measure();
      const player = stage.querySelector(".__remotion-player");
      if (player) observer.observe(player);
    });
    observer.observe(stage);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Đổi timeline (thêm scene đầu tiên → Player mới gắn) thì đo lại
  useLayoutEffect(() => {
    measure();
  }, [measure, timeline]);

  const scaleK = rect && compWidth > 0 ? rect.width / compWidth : 0;

  // ---- hình học ----
  const layers = layersOf(timeline);

  const layerBoxAt = useCallback(
    (layer: TimelineLayer, f: number) => {
      const src = typeof layer.src === "string" ? layer.src : null;
      let aspect = src && (layer.kind === "image" || layer.kind === "video") ? mediaAspect(src) : undefined;
      if (layer.kind === "text") {
        // Chữ cao theo nội dung (tự xuống dòng) - layerBox chỉ ước lượng theo số
        // dòng. Engine gắn `data-layer-id` lên hộp thì đo thẳng hộp thật: offset*
        // là px COMPOSITION (Player co cả cây bằng transform, không đổi layout)
        const el = rootRef.current?.parentElement?.querySelector<HTMLElement>(
          `[data-layer-id="${CSS.escape(layer.id)}"]`,
        );
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) aspect = el.offsetWidth / el.offsetHeight;
      }
      return layerBox(layer as unknown as Parameters<typeof layerBox>[0], f, compWidth, compHeight, aspect, fps);
    },
    [compWidth, compHeight, fps, mediaAspect],
  );

  /**
   * Hộp cue ĐANG VẼ trong Player (px composition) - đo từ DOM. getBoundingClientRect
   * đã gồm mọi transform (dời/cỡ của cue, pop/trôi của animation, co của Player)
   * nên chỉ cần đổi từ px màn hình về px composition. null = cue không hiện ở frame này.
   */
  const cueBoxes = useCallback((): { kind: CueSelKind; index: number; box: Box; opacity: number }[] => {
    const root = rootRef.current;
    const stage = root?.parentElement;
    if (!root || !stage || !rect || scaleK <= 0) return [];
    const rootRect = root.getBoundingClientRect();
    const out: { kind: CueSelKind; index: number; box: Box; opacity: number }[] = [];
    stage.querySelectorAll<HTMLElement>("[data-cue-kind]").forEach((el) => {
      const kind = el.dataset.cueKind as CueSelKind;
      const index = Number(el.dataset.cueIndex);
      if (!CUE_KINDS.includes(kind) || !Number.isInteger(index)) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      // Mờ vào/ra nằm trên khung cha của hộp (AbsoluteFill của cue)
      const parent = el.parentElement;
      const opacity = parent ? parseFloat(getComputedStyle(parent).opacity) || 0 : 1;
      out.push({
        kind,
        index,
        opacity,
        box: {
          cx: (r.left + r.width / 2 - rootRect.left - rect.left) / scaleK,
          cy: (r.top + r.height / 2 - rootRect.top - rect.top) / scaleK,
          w: r.width / scaleK,
          h: r.height / scaleK,
          rotate: 0,
        },
      });
    });
    return out;
  }, [rect, scaleK]);

  const cueBoxOf = useCallback(
    (kind: CueSelKind, index: number): Box | null =>
      cueBoxes().find((c) => c.kind === kind && c.index === index)?.box ?? null,
    [cueBoxes],
  );

  // Khung chọn của cue phải đo SAU khi Player vẽ xong frame/timeline mới - đo
  // ngay trong lượt render là đo hộp của lần vẽ trước (khung chạy sau hình)
  const [selCueBox, setSelCueBox] = useState<Box | null>(null);
  const selCueKind = selection && isCueSel(selection.kind) ? selection.kind : null;
  const selCueIndex = selection && "index" in selection ? selection.index : -1;
  useEffect(() => {
    if (!selCueKind) {
      setSelCueBox(null);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const next = cueBoxOf(selCueKind, selCueIndex);
      setSelCueBox((prev) => (sameBox(prev, next) ? prev : next));
    });
    return () => cancelAnimationFrame(raf);
  }, [selCueKind, selCueIndex, cueBoxOf, frame, timeline]);

  const sceneAtFrame = (f: number): TimelineScene | null => {
    const spans = computeSceneSpans(timeline.scenes, fps);
    // Hai scene chồng nhau (chuyển cảnh): scene SAU nằm trên
    for (let i = spans.length - 1; i >= 0; i -= 1) {
      if (f >= spans[i].start && f < spans[i].end) return timeline.scenes[spans[i].index] ?? null;
    }
    return null;
  };

  const sceneBoxOf = (scene: TimelineScene): Box =>
    sceneBox(rec(scene.transform) as unknown as Parameters<typeof sceneBox>[0], compWidth, compHeight);

  /** Hộp của mục đang chọn tại playhead - null = không vẽ (ngoài khoảng thời gian) */
  let selected: { target: CanvasTarget; box: Box } | null = null;
  if (selection?.kind === "layer") {
    const layer = layers.find((l) => l?.id === selection.id);
    if (isLayerOk(layer)) {
      const b = layerBoxAt(layer, frame);
      if (b.visible) selected = { target: { kind: "layer", id: layer.id }, box: b };
    }
  } else if (selection?.kind === "scene") {
    const current = sceneAtFrame(frame);
    if (current && current.id === selection.id) {
      selected = { target: { kind: "scene", id: current.id }, box: sceneBoxOf(current) };
    }
  } else if (selCueKind && selCueBox) {
    selected = { target: { kind: selCueKind, index: selCueIndex }, box: selCueBox };
  }
  const selectedIsCue = !!selected && isCueSel(selected.target.kind);

  // ---- tọa độ ----
  const toComp = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const root = rootRef.current;
    if (!root || !rect || scaleK <= 0) return null;
    const r = root.getBoundingClientRect();
    return { x: (clientX - r.left - rect.left) / scaleK, y: (clientY - r.top - rect.top) / scaleK };
  };

  /** Layer trên cùng dưới điểm (px composition) - duyệt từ cuối mảng (lớp trên) xuống */
  const layerAt = (x: number, y: number): TimelineLayer | null => {
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const layer = layers[i];
      if (!isLayerOk(layer)) continue;
      const b = layerBoxAt(layer, frame);
      if (!b.visible || b.opacity <= 0.02) continue;
      if (hitBox(b, x, y)) return layer;
    }
    return null;
  };

  /** Mục trên cùng dưới điểm: cue (vẽ sau cùng, DOM sau = lớp trên) → layer → null */
  const targetAt = (x: number, y: number): CanvasTarget | null => {
    const cues = cueBoxes();
    for (let i = cues.length - 1; i >= 0; i -= 1) {
      // Cue đang mờ hẳn (frame đầu của hiệu ứng vào) không che được thứ bên dưới
      if (cues[i].opacity <= 0.05) continue;
      if (hitBox(cues[i].box, x, y)) return { kind: cues[i].kind, index: cues[i].index };
    }
    const layer = layerAt(x, y);
    return layer ? { kind: "layer", id: layer.id } : null;
  };

  /** Giá trị hiệu lực (gồm keyframe) + transform gốc của mục - điểm xuất phát của lượt kéo */
  const startValues = (target: CanvasTarget) => {
    if (target.kind === "layer") {
      const layer = layers.find((l) => l?.id === target.id);
      if (!isLayerOk(layer)) return null;
      const v = layerValuesAt(layer, frame - layer.from);
      // layerBox: cx = W/2·(1 + x) → 1 đơn vị x = W/2 px
      return {
        base: rec(layer.transform),
        x0: v.x,
        y0: v.y,
        scale0: v.scale,
        rotate0: v.rotate,
        kx: compWidth / 2,
        ky: compHeight / 2,
        box: layerBoxAt(layer, frame) as Box,
      };
    }
    if (target.kind === "scene") {
      const scene = timeline.scenes.find((s) => s.id === target.id);
      if (!scene) return null;
      const tr = rec(scene.transform);
      // sceneBox: cx = W/2 + x·W → 1 đơn vị x = W px
      return {
        base: tr,
        x0: num(tr.x, 0),
        y0: num(tr.y, 0),
        scale0: num(tr.scale, 1),
        rotate0: num(tr.rotate, 0),
        kx: compWidth,
        ky: compHeight,
        box: sceneBoxOf(scene),
      };
    }
    // Cue: x/y là phần của khung (cueTransform.ts) → 1 đơn vị x = W px
    const box = cueBoxOf(target.kind, target.index);
    if (!box) return null;
    const tr = cueTransformOf(timeline, CUE_KIND[target.kind], target.index);
    return {
      base: tr as Record<string, unknown>,
      x0: num(tr.x, 0),
      y0: num(tr.y, 0),
      scale0: num(tr.scale, 1),
      rotate0: 0,
      kx: compWidth,
      ky: compHeight,
      box,
    };
  };

  const beginDrag = (mode: DragMode, target: CanvasTarget, e: ReactPointerEvent, at: { x: number; y: number }) => {
    if (readOnly || isLocked?.(target)) return;
    if (mode === "rotate" && isCueSel(target.kind)) return;
    const v = startValues(target);
    if (!v) return;
    dragRef.current = {
      mode,
      target,
      pointerId: e.pointerId,
      start: at,
      center: { x: v.box.cx, y: v.box.cy },
      base: v.base,
      x0: v.x0,
      y0: v.y0,
      scale0: v.scale0,
      rotate0: v.rotate0,
      kx: v.kx,
      ky: v.ky,
      moved: false,
      last: null,
    };
    rootRef.current?.setPointerCapture(e.pointerId);
    setDragging(mode);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const at = toComp(e.clientX, e.clientY);
    if (!at) return;
    e.preventDefault();
    rootRef.current?.focus({ preventScroll: true });
    const hit: CanvasTarget | null =
      targetAt(at.x, at.y) ??
      (() => {
        const scene = sceneAtFrame(frame);
        return scene ? { kind: "scene", id: scene.id } : null;
      })();
    if (!hit) return;
    const already = sameTarget(hit, selection);
    if (!already) onSelect(hit);
    // Layer/cue: bấm-và-kéo dời luôn. Scene: phải đang chọn mới dời - bấm nhầm
    // vào nền không được xê dịch cả khung hình
    if (already || hit.kind !== "scene") beginDrag("move", hit, e, at);
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onEditText) return;
    const at = toComp(e.clientX, e.clientY);
    if (!at) return;
    const hit = targetAt(at.x, at.y);
    if (!hit || hit.kind === "scene") return;
    if (hit.kind === "layer" && layers.find((l) => l?.id === hit.id)?.kind !== "text") return;
    e.preventDefault();
    onEditText(hit);
  };

  const onHandleDown = (mode: DragMode) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !selected) return;
    e.stopPropagation();
    e.preventDefault();
    const at = toComp(e.clientX, e.clientY);
    if (!at) return;
    rootRef.current?.focus({ preventScroll: true });
    beginDrag(mode, selected.target, e, at);
  };

  const transformFrom = (
    base: Record<string, unknown>,
    changes: { x?: number; y?: number; scale?: number; rotate?: number },
  ) => {
    const next: Record<string, unknown> = { ...base };
    if (changes.x !== undefined) next.x = round(clamp(changes.x, -1, 1), 4);
    if (changes.y !== undefined) next.y = round(clamp(changes.y, -1, 1), 4);
    if (changes.scale !== undefined) next.scale = round(clamp(changes.scale, SCALE_MIN, SCALE_MAX), 3);
    if (changes.rotate !== undefined) next.rotate = round(normAngle(changes.rotate), 1);
    return next;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const at = toComp(e.clientX, e.clientY);
    if (!at) return;
    let next: Record<string, unknown>;
    if (d.mode === "move") {
      let dx = at.x - d.start.x;
      let dy = at.y - d.start.y;
      // Ngưỡng 2px màn hình: bấm chọn không bị tính là kéo
      if (!d.moved && Math.hypot(dx * scaleK, dy * scaleK) < 2) return;
      if (e.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      next = transformFrom(d.base, { x: d.x0 + dx / d.kx, y: d.y0 + dy / d.ky });
    } else if (d.mode === "scale") {
      const r0 = Math.hypot(d.start.x - d.center.x, d.start.y - d.center.y);
      const r1 = Math.hypot(at.x - d.center.x, at.y - d.center.y);
      if (r0 < 1) return;
      next = transformFrom(d.base, { scale: d.scale0 * (r1 / r0) });
    } else {
      const a0 = (Math.atan2(d.start.y - d.center.y, d.start.x - d.center.x) * 180) / Math.PI;
      const a1 = (Math.atan2(at.y - d.center.y, at.x - d.center.x) * 180) / Math.PI;
      let rot = d.rotate0 + (a1 - a0);
      if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      next = transformFrom(d.base, { rotate: rot });
    }
    d.moved = true;
    d.last = next;
    onTransform(d.target, next, "preview");
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDragging(null);
    if (rootRef.current?.hasPointerCapture(e.pointerId)) rootRef.current.releasePointerCapture(e.pointerId);
    if (d.moved && d.last) onTransform(d.target, d.last, "commit");
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (readOnly || !selected || dragRef.current || isLocked?.(selected.target)) return;
    const dirs: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const dir = dirs[e.key];
    if (!dir) return;
    // Mũi tên ở đây là DỜI hình, không lọt ra phím tua frame của trang
    e.preventDefault();
    e.stopPropagation();
    const v = startValues(selected.target);
    if (!v) return;
    const stepPx = e.shiftKey ? 10 : 1;
    const next = transformFrom(v.base, {
      x: v.x0 + (dir[0] * stepPx) / v.kx,
      y: v.y0 + (dir[1] * stepPx) / v.ky,
    });
    onTransform(selected.target, next, "commit");
  };

  // ---- vẽ ----
  const boxStyle = selected && rect
    ? {
        left: rect.left + (selected.box.cx - selected.box.w / 2) * scaleK,
        top: rect.top + (selected.box.cy - selected.box.h / 2) * scaleK,
        width: Math.max(1, selected.box.w * scaleK),
        height: Math.max(1, selected.box.h * scaleK),
        transform: `rotate(${selected.box.rotate}deg)`,
      }
    : null;

  const corners: { key: string; style: { left?: number; right?: number; top?: number; bottom?: number }; cursor: string }[] = [
    { key: "nw", style: { left: -HANDLE / 2, top: -HANDLE / 2 }, cursor: "nwse-resize" },
    { key: "ne", style: { right: -HANDLE / 2, top: -HANDLE / 2 }, cursor: "nesw-resize" },
    { key: "sw", style: { left: -HANDLE / 2, bottom: -HANDLE / 2 }, cursor: "nesw-resize" },
    { key: "se", style: { right: -HANDLE / 2, bottom: -HANDLE / 2 }, cursor: "nwse-resize" },
  ];

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[5]"
      style={{ cursor: dragging === "move" ? "grabbing" : undefined, touchAction: "none" }}
      tabIndex={0}
      role="application"
      aria-label={t("editor.canvas.label")}
      aria-roledescription={t("editor.canvas.role")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      {boxStyle && selected && (
        <div
          className="pointer-events-none absolute border border-[var(--primary)]"
          style={{ ...boxStyle, transformOrigin: "50% 50%" }}
          data-canvas-target={selected.target.kind}
        >
          {!readOnly && !isLocked?.(selected.target) && (
            <>
              <div
                className="pointer-events-auto absolute inset-0"
                style={{ cursor: dragging === "move" ? "grabbing" : "move" }}
                title={t("editor.canvas.move")}
                onPointerDown={(e) => {
                  if (e.button !== 0 || !selected) return;
                  const at = toComp(e.clientX, e.clientY);
                  if (!at) return;
                  // Có mục KHÁC nằm trên tại điểm bấm (hộp scene phủ cả khung) → để
                  // lớp gốc xử lý: chọn mục đó thay vì dời mục đang chọn
                  const top = targetAt(at.x, at.y);
                  if (top && !sameTarget(top, selection)) return;
                  e.stopPropagation();
                  e.preventDefault();
                  rootRef.current?.focus({ preventScroll: true });
                  beginDrag("move", selected.target, e, at);
                }}
              />
              {corners.map((c) => (
                <div
                  key={c.key}
                  className="pointer-events-auto absolute border border-[var(--primary)] bg-[var(--surface)]"
                  style={{ ...c.style, width: HANDLE, height: HANDLE, cursor: c.cursor }}
                  title={t("editor.canvas.scale")}
                  onPointerDown={onHandleDown("scale")}
                />
              ))}
              {!selectedIsCue && (
                <>
                  <div
                    className="pointer-events-none absolute left-1/2 w-px bg-[var(--primary)]"
                    style={{ top: -ROTATE_OFFSET, height: ROTATE_OFFSET - HANDLE / 2 }}
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-auto absolute left-1/2 rounded-full border border-[var(--primary)] bg-[var(--surface)]"
                    style={{
                      top: -ROTATE_OFFSET - HANDLE / 2,
                      width: HANDLE + 2,
                      height: HANDLE + 2,
                      marginLeft: -(HANDLE + 2) / 2,
                      cursor: dragging === "rotate" ? "grabbing" : "grab",
                    }}
                    title={t("editor.canvas.rotate")}
                    onPointerDown={onHandleDown("rotate")}
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
