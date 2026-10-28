"use client";

/**
 * Timeline nhiều track: thước giờ, playhead, khối scene/cue/sfx, kéo-thả.
 *
 * Mọi tương tác con trỏ đi qua MỘT bộ xử lý trên khung cuộn (ủy quyền theo
 * `data-*`), có pointer capture trên chính khung đó - khung không bao giờ
 * unmount giữa lượt kéo, còn khối thì có thể render lại theo từng frame.
 *
 * Kéo luôn tính từ timeline LÚC BẤM CHUỘT (origin) + tổng độ dời, không cộng
 * dồn từng bước: kẹp và làm tròn không tích lũy sai số, và cả lượt kéo gộp
 * thành MỘT bước hoàn tác (coalesce key riêng cho từng lượt). Cập nhật đẩy vào
 * store tối đa một lần mỗi khung hình (requestAnimationFrame) để trình phát
 * không phải dựng lại composition nhiều hơn số khung màn hình vẽ được.
 */

import {
  AudioLines,
  Captions,
  Film,
  Highlighter,
  Image as ImageIcon,
  Layers,
  Lock,
  LockOpen,
  Maximize2,
  Mic,
  Music,
  Plus,
  Sparkles,
  Square,
  Subtitles,
  Type,
  Video,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Badge } from "@/components/Badge";
import { IconButton } from "@/components/IconButton";
import type { Timeline, TimelinePreview } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useEditor } from "./EditorContext";
import {
  acceptedTracks,
  FILE_DROP_TRACKS,
  isFileDrag,
  readDragData,
  type DropTarget,
  type DropTrack,
  type LibraryItem,
} from "./library";
import {
  CUE_KIND,
  captionWordsOf,
  highlightPartsOf,
  isCueSel,
  isMediaMissing,
  isLayerWellFormed,
  isWellFormed,
  layersOf,
  moveCue,
  moveLayer,
  moveSfx,
  reorderScene,
  resizeCue,
  resizeLayer,
  sceneIndexById,
  sceneInsertIndexAt,
  sceneKind,
  sceneMissingMedia,
  sceneSourcePath,
  trimScene,
  type Selection,
} from "./ops";
import { usePlayheadFrame } from "./playback";
import { useJobLabel, type TimelineAiAnchor, type TimelineAiJob } from "./TimelineAi";
import { dragOwns, dragStep, type DragSession } from "./store";
import {
  clampPps,
  contentEndFrame,
  formatRulerLabel,
  formatSeconds,
  frameToPx,
  packLanes,
  pxToFrame,
  rulerStep,
  ZOOM_MAX_PPS,
  ZOOM_MIN_PPS,
  type SceneSpan,
} from "./timing";

/** Cột tên track: icon + tên + nút "+" + nút khóa - hẹp hơn là tên bị cắt ("La…") */
const LABEL_W = 164;
/**
 * Bề ngang tối thiểu (px) của một khối - để còn bấm/kéo được. Ở mức zoom vừa
 * khung, cue 1-3 frame hay scene 1 frame chỉ rộng 1-2px: không ai bấm trúng.
 */
const BLOCK_MIN_PX = 6;
/** Scene không tính được độ dài: vẽ hẳn ra cho thấy (trước đây rộng 1 frame = biến mất) */
const BROKEN_BLOCK_MIN_PX = 24;
/** Đi được bao xa (px) thì mới coi là kéo - nhỏ hơn là một cú bấm chọn */
const DRAG_THRESHOLD = 3;
/** Khoảng hít (px trên màn hình, không phải frame - zoom nào cũng như nhau) */
const SNAP_PX = 8;
/** Vùng sát mép khung cuộn tự cuộn theo khi kéo */
const EDGE_SCROLL_PX = 32;

type TrackKey = "scene" | "layer" | "overlay" | "caption" | "subtitle" | "sfx" | "voice" | "music";

/** Track có nút "+" thêm cue tại playhead. */
export type AddCueKind = "overlay" | "caption" | "subtitle";

/** Menu "+" của track Layer: thêm layer chữ / khối màu tại playhead. */
export type AddLayerKind = "text" | "shape";

/** Chiều cao một làn (px) - bằng `.tl-row` để mọi track cùng nhịp. */
const LANE_H = 32;

type DragMode = "move" | "trim-start" | "trim-end" | "reorder" | "scrub";

interface DragState extends DragSession {
  pointerId: number;
  mode: DragMode;
  target: Selection | null;
  startX: number;
  startScroll: number;
  origin: Timeline;
  /** Mọi timeline lượt kéo đã đẩy vào store - xem store.ts DragSession */
  produced: WeakSet<Timeline>;
  /** Lượt kéo đã bị dừng vì timeline đổi từ nơi khác - không đẩy gì thêm */
  aborted: boolean;
  started: boolean;
  key: string;
  /** Mép của phần tử lúc bấm (frame) - dùng để hít */
  edges: number[];
  candidates: number[];
  sceneIndex: number;
}

interface DragView {
  target: Selection | null;
  mode: DragMode;
  snapAt: number | null;
  dropIndex: number | null;
  offsetPx: number;
}

const baseName = (path: unknown): string =>
  typeof path === "string" && path ? (path.split(/[\\/]/).pop() ?? path) : "";

/** Số hữu hạn hoặc `fallback` - cue/sfx sai kiểu vẫn vẽ được một khối (đánh dấu lỗi). */
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Chuỗi hoặc "" - nhãn khối không bao giờ ném lỗi vì dữ liệu lạ. */
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** pps (px/giây) ↔ vị trí thanh trượt 0..100 theo thang log - zoom đều tay. */
const ppsToSlider = (pps: number): number =>
  Math.round(
    (Math.log(pps / ZOOM_MIN_PPS) / Math.log(ZOOM_MAX_PPS / ZOOM_MIN_PPS)) * 100,
  );
const sliderToPps = (v: number): number =>
  ZOOM_MIN_PPS * Math.pow(ZOOM_MAX_PPS / ZOOM_MIN_PPS, v / 100);

function encodeSel(sel: Selection): Record<string, string> {
  if (sel.kind === "scene" || sel.kind === "layer") return { "data-kind": sel.kind, "data-id": sel.id };
  if ("index" in sel) return { "data-kind": sel.kind, "data-index": String(sel.index) };
  return { "data-kind": sel.kind };
}

function decodeSel(el: Element): Selection | null {
  const kind = el.getAttribute("data-kind");
  const index = Number(el.getAttribute("data-index"));
  switch (kind) {
    case "scene":
    case "layer": {
      const id = el.getAttribute("data-id");
      return id ? { kind, id } : null;
    }
    case "caption":
    case "subtitle":
    case "overlay":
    case "sfx":
      return Number.isInteger(index) ? { kind, index } : null;
    case "music":
    case "voice":
      return { kind };
    default:
      return null;
  }
}

/**
 * Trong cùng làn với `hit`, khối có [data-start, data-end) chứa `frame` và
 * NGẮN nhất (bấm vào chỗ cue chồng nhau là chọn đúng cue người dùng nhắm).
 * null = không khối nào chứa frame đó.
 */
function blockSpanContains(el: Element, frame: number): boolean {
  const start = Number(el.getAttribute("data-start"));
  const end = Number(el.getAttribute("data-end"));
  return Number.isFinite(start) && Number.isFinite(end) && frame >= start && frame < Math.max(end, start + 1);
}

function preciseBlockAt(hit: Element, frame: number): Element | null {
  const lane = hit.closest("[data-lane]");
  if (!lane) return null;
  let best: Element | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;
  lane.querySelectorAll("[data-block]").forEach((el) => {
    const start = Number(el.getAttribute("data-start"));
    const end = Number(el.getAttribute("data-end"));
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    if (frame < start || frame >= Math.max(end, start + 1)) return;
    if (end - start < bestSpan) {
      best = el;
      bestSpan = end - start;
    }
  });
  return best;
}

const selKey = (sel: Selection | null): string =>
  !sel ? "" : "id" in sel ? `${sel.kind}:${sel.id}` : "index" in sel ? `${sel.kind}:${sel.index}` : sel.kind;

export function TimelinePanel({
  timeline,
  spans,
  totalFrames,
  preview,
  height,
  onLibraryDrop,
  onFilesDrop,
  onAddCue,
  onAddLayer,
  onAiAt,
  aiJobs = [],
  onAiJobClick,
  hoverRef,
}: {
  timeline: Timeline;
  spans: SceneSpan[];
  totalFrames: number;
  preview: TimelinePreview;
  /** Chiều cao khung (px) - do tay nắm kéo của trang quyết định */
  height: number;
  /** Thả một món từ cột Thư viện lên timeline (trang lo chép file + sửa) */
  onLibraryDrop: (item: LibraryItem, target: DropTarget) => void;
  /**
   * Thả FILE từ máy lên timeline: `target` = track Video/Layer/SFX dưới con trỏ
   * (tải lên rồi chèn vào đó), null = chỗ khác (chỉ tải vào thư viện).
   */
  onFilesDrop: (files: File[], target: DropTarget | null) => void;
  /** Nút "+" ở nhãn track: thêm cue tại playhead */
  onAddCue: (kind: AddCueKind) => void;
  /** Menu "+" của track Layer: thêm layer chữ / khối màu tại playhead */
  onAddLayer: (kind: AddLayerKind) => void;
  /** Chuột phải trên thước/làn: "Tạo bằng AI tại đây" ở frame dưới con trỏ */
  onAiAt?: (anchor: TimelineAiAnchor) => void;
  /** Lượt AI neo theo mốc (đang chạy / lỗi) - vẽ thành mốc trên thước */
  aiJobs?: TimelineAiJob[];
  /** Bấm cờ của một lượt: đang chạy = thôi chờ, lỗi = đóng */
  onAiJobClick?: (job: TimelineAiJob) => void;
  /** Trang đọc mốc dưới con trỏ (phím G) - null khi chuột không ở trên làn */
  hoverRef?: MutableRefObject<TimelineAiAnchor | null>;
}) {
  const { t, tf } = useT();
  const editor = useEditor();
  const { fps, readOnly, selection, playback, locks, toggleLock } = editor;
  const jobLabel = useJobLabel();
  const runningAi = aiJobs.filter((j) => j.status === "running").length;
  // Timeline MỚI NHẤT đã render - khung kéo (requestAnimationFrame) đọc qua ref
  // để biết có ai sửa chen vào giữa lượt kéo không
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [pps, setPps] = useState(60);
  /** true tới khi người dùng tự zoom - trước đó timeline luôn vừa khít bề ngang */
  const autoFitRef = useRef(true);
  const [viewport, setViewport] = useState({ left: 0, width: 800 });
  const [dragView, setDragView] = useState<DragView | null>(null);
  /** Món thư viện đang được kéo ngang timeline - track sẽ nhận + vị trí */
  const [libDrop, setLibDrop] = useState<DropTarget | null>(null);
  /** Làn đang bị rê qua mà KHÔNG nhận được món đang kéo */
  const [libReject, setLibReject] = useState<TrackKey | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);
  const dragCounter = useRef(0);
  /** Giữ khung nhìn sau khi zoom: frame dưới con trỏ đứng yên */
  const zoomAnchorRef = useRef<{ frame: number; offset: number } | null>(null);

  const endFrame = Math.max(totalFrames, contentEndFrame(timeline, spans));
  const laneWidth = frameToPx(endFrame, pps, fps) + 160;
  const contentWidth = LABEL_W + laneWidth;
  const x = useCallback((frame: number) => frameToPx(frame, pps, fps), [pps, fps]);

  // ---- vừa khít lần đầu: cả video lọt vào bề ngang khung
  // Độ dài đọc qua ref: `fit` giữ identity ổn định, nên trim làm video dài/ngắn
  // đi KHÔNG kéo theo zoom lại giữa lúc đang kéo chuột
  const totalRef = useRef(totalFrames);
  totalRef.current = totalFrames;
  const fit = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.clientWidth <= 0) return;
    const usable = el.clientWidth - LABEL_W - 32;
    setPps(clampPps(usable / Math.max(1 / fps, totalRef.current / fps)));
    el.scrollLeft = 0;
  }, [fps]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setViewport({ left: el.scrollLeft, width: el.clientWidth });
      // Còn "tự vừa khung" (người dùng chưa tự zoom) thì khung đổi cỡ - panel
      // chat mở ra, kéo cửa sổ - là vừa lại theo bề ngang mới
      if (autoFitRef.current && el.clientWidth > 0) fit();
    };
    update();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [fit]);

  // ---- Ctrl/Cmd + lăn chuột: zoom quanh con trỏ (listener thật, không passive -
  // React gắn wheel ở chế độ passive nên preventDefault ở đó vô tác dụng)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const offset = e.clientX - rect.left;
      autoFitRef.current = false;
      setPps((cur) => {
        const frame = pxToFrame(el.scrollLeft + offset - LABEL_W, cur, fps);
        zoomAnchorRef.current = { frame: Math.max(0, frame), offset };
        return clampPps(cur * Math.exp(-e.deltaY * 0.0025));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fps]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = zoomAnchorRef.current;
    if (!el || !anchor) return;
    zoomAnchorRef.current = null;
    el.scrollLeft = Math.max(0, LABEL_W + frameToPx(anchor.frame, pps, fps) - anchor.offset);
  }, [pps, fps]);

  const zoomBy = (factor: number) => {
    autoFitRef.current = false;
    const el = scrollRef.current;
    if (el) {
      // Nút zoom: neo quanh playhead nếu nó đang trong khung, không thì giữa khung
      const playX = LABEL_W + frameToPx(playback.getFrame(), pps, fps) - el.scrollLeft;
      const offset =
        playX > LABEL_W && playX < el.clientWidth ? playX : LABEL_W + (el.clientWidth - LABEL_W) / 2;
      zoomAnchorRef.current = {
        frame: Math.max(0, pxToFrame(el.scrollLeft + offset - LABEL_W, pps, fps)),
        offset,
      };
    }
    setPps((cur) => clampPps(cur * factor));
  };

  // ---- playhead luôn trong tầm nhìn (lúc phát và lúc tua bằng phím)
  useEffect(() => {
    return playback.subscribe(() => {
      const el = scrollRef.current;
      if (!el || dragRef.current) return;
      const px = LABEL_W + frameToPx(playback.getFrame(), pps, fps);
      const left = el.scrollLeft + LABEL_W;
      const right = el.scrollLeft + el.clientWidth - 24;
      if (px < left || px > right) {
        // Lật trang như NLE: playhead về gần mép trái, không bám giữa giật liên tục
        el.scrollLeft = Math.max(0, px - LABEL_W - 48);
      }
    });
  }, [playback, pps, fps]);

  // ---------------------------------------------------------------- kéo

  const flush = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    pending?.();
  }, []);

  const schedule = useCallback(
    (fn: () => void) => {
      pendingRef.current = fn;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        pending?.();
      });
    },
    [],
  );

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  /** Frame dưới con trỏ (trục timeline, không âm). */
  const frameAtClient = (clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, pxToFrame(clientX - rect.left + el.scrollLeft - LABEL_W, pps, fps));
  };

  // ---- vạch giờ dưới con trỏ: cập nhật thẳng DOM - setState mỗi lần rê chuột là
  // dựng lại cả trăm khối timeline
  const hoverLineRef = useRef<HTMLSpanElement>(null);
  const hoverLabelRef = useRef<HTMLSpanElement>(null);
  const lastFrame = Math.max(0, totalFrames - 1);
  const hideHover = () => {
    if (hoverLineRef.current) hoverLineRef.current.style.display = "none";
    if (hoverRef) hoverRef.current = null;
  };
  const showHover = (clientX: number, clientY: number) => {
    const el = scrollRef.current;
    const line = hoverLineRef.current;
    if (!el || !line) return;
    const rect = el.getBoundingClientRect();
    if (dragRef.current || clientX < rect.left + LABEL_W) {
      hideHover();
      return;
    }
    const frame = Math.min(Math.round(frameAtClient(clientX)), lastFrame);
    line.style.display = "block";
    line.style.transform = `translateX(${LABEL_W + x(frame)}px)`;
    if (hoverLabelRef.current) hoverLabelRef.current.textContent = formatSeconds(frame, fps);
    if (hoverRef) hoverRef.current = { frame, clientX, clientY };
  };

  /** Chuột phải trên thước/làn → hỏi AI tại frame dưới con trỏ (nhãn track giữ menu của trình duyệt). */
  const onContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!onAiAt || !el || dragRef.current) return;
    if (e.clientX < el.getBoundingClientRect().left + LABEL_W) return;
    e.preventDefault();
    const frame = Math.min(Math.round(frameAtClient(e.clientX)), lastFrame);
    onAiAt({ frame, clientX: e.clientX, clientY: e.clientY });
  };

  /** Mọi mép có thể hít vào, trừ chính phần tử đang kéo. */
  const snapCandidates = (sel: Selection | null, mode: DragMode, sceneIndex: number): number[] => {
    const out = new Set<number>([0, playback.getFrame(), totalFrames]);
    spans.forEach((s) => {
      // Trim scene là "ripple": scene từ chỗ đó trở về sau dời theo nên không làm mốc
      if (sel?.kind === "scene" && mode !== "move" && s.index >= sceneIndex) return;
      out.add(s.start);
      out.add(s.end);
    });
    const addCues = (kind: "caption" | "subtitle" | "overlay") => {
      timeline[CUE_KIND[kind]].forEach((c, i) => {
        if (sel?.kind === kind && "index" in sel && sel.index === i) return;
        if (!c || !Number.isFinite(c.from) || !Number.isFinite(c.durationInFrames)) return;
        out.add(c.from);
        out.add(c.from + c.durationInFrames);
      });
    };
    addCues("caption");
    addCues("subtitle");
    addCues("overlay");
    timeline.audio.sfx.forEach((s, i) => {
      if (sel?.kind === "sfx" && sel.index === i) return;
      if (s && Number.isFinite(s.atFrame)) out.add(s.atFrame);
    });
    layersOf(timeline).forEach((l) => {
      if (!isLayerWellFormed(l) || (sel?.kind === "layer" && sel.id === l.id)) return;
      out.add(l.from);
      out.add(l.from + l.durationInFrames);
    });
    return [...out];
  };

  const snapDelta = (
    delta: number,
    edges: number[],
    candidates: number[],
    disabled: boolean,
  ): { delta: number; at: number | null } => {
    if (disabled || edges.length === 0) return { delta, at: null };
    const threshold = pxToFrame(SNAP_PX, pps, fps);
    let best: { d: number; at: number } | null = null;
    for (const edge of edges) {
      for (const c of candidates) {
        const d = c - (edge + delta);
        if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: c };
      }
    }
    return best ? { delta: delta + best.d, at: best.at } : { delta, at: null };
  };

  /** Thao tác (thuần) ứng với chế độ kéo + độ dời - luôn tính từ `origin` truyền vào. */
  const applyDrag = (drag: DragState, delta: number): ((origin: Timeline) => Timeline) | null => {
    const sel = drag.target;
    const lastFrame = Math.max(0, totalFrames - 1);
    if (!sel) return null;
    if (sel.kind === "scene") {
      if (drag.mode === "trim-start" || drag.mode === "trim-end") {
        const edge = drag.mode === "trim-start" ? "start" : "end";
        return (origin) => trimScene(origin, drag.sceneIndex, edge, delta, editor.ops);
      }
      return null;
    }
    if (isCueSel(sel.kind) && "index" in sel) {
      const kind = CUE_KIND[sel.kind];
      // Không kéo được ra sau hết video (cue đã ở ngoài từ trước thì để yên)
      if (drag.mode === "move") return (origin) => moveCue(origin, kind, sel.index, delta, lastFrame);
      if (drag.mode === "trim-start") return (origin) => resizeCue(origin, kind, sel.index, "start", delta);
      if (drag.mode === "trim-end") return (origin) => resizeCue(origin, kind, sel.index, "end", delta);
    }
    if (sel.kind === "sfx" && drag.mode === "move") return (origin) => moveSfx(origin, sel.index, delta, lastFrame);
    if (sel.kind === "layer") {
      const id = sel.id;
      if (drag.mode === "move") return (origin) => moveLayer(origin, id, delta, lastFrame);
      if (drag.mode === "trim-start") return (origin) => resizeLayer(origin, id, "start", delta, editor.ops);
      if (drag.mode === "trim-end") return (origin) => resizeLayer(origin, id, "end", delta, editor.ops);
    }
    return null;
  };

  const dropIndexAt = (frame: number): number => sceneInsertIndexAt(spans, frame);

  // ---------------------------------------------------------------- thả từ thư viện

  /**
   * Đích thả của một món thư viện tại con trỏ. Con trỏ trên MỘT làn nhận được
   * món này → làn đó; trên thước giờ / chỗ trống → track mặc định của món.
   * Con trỏ trên một làn KHÔNG nhận được (thả video vào làn Highlight…) →
   * "reject": con trỏ "cấm", làn đó viền cảnh báo, thả ra không làm gì - trước
   * đây món lặng lẽ rơi sang track khác, người dùng không hiểu nó đi đâu.
   */
  const libraryTargetAt = (e: ReactDragEvent<HTMLDivElement>): DropTarget | { reject: TrackKey } | null => {
    if (readOnly) return null;
    const accepted = acceptedTracks([...e.dataTransfer.types]);
    if (accepted.length === 0) return null;
    const row = e.target instanceof Element ? e.target.closest(".tl-row[data-track]") : null;
    const under = row?.getAttribute("data-track") as TrackKey | null | undefined;
    if (under && (!(accepted as string[]).includes(under) || locks.has(under))) return { reject: under };
    const track: DropTrack = under ? (under as DropTrack) : accepted[0];
    // Thả ngoài mọi hàng = vào track mặc định của món đó - track đó khóa thì cũng cấm
    if (locks.has(track)) return { reject: track };
    return dropTargetFor(track, e);
  };

  /** Frame + vị trí chèn của một lượt thả lên `track` - sfx/layer hít như khi kéo khối (Alt tắt hít). */
  const dropTargetFor = (track: DropTrack, e: ReactDragEvent<HTMLDivElement>): DropTarget => {
    let frame = Math.round(frameAtClient(e.clientX));
    if (track === "sfx" || track === "layer") {
      frame += snapDelta(0, [frame], snapCandidates(null, "move", -1), e.altKey).delta;
    }
    return { track, frame, sceneIndex: dropIndexAt(frame) };
  };

  /**
   * Đích của FILE kéo từ máy: track Video/Layer/SFX dưới con trỏ, còn lại null
   * (chỉ vào thư viện - không bao giờ "cấm": thả đâu trong editor cũng tải lên được).
   */
  const fileTargetAt = (e: ReactDragEvent<HTMLDivElement>): DropTarget | null => {
    const row = e.target instanceof Element ? e.target.closest(".tl-row[data-track]") : null;
    const under = row?.getAttribute("data-track") as DropTrack | null | undefined;
    // Track khóa: file chỉ vào thư viện, không chèn lên timeline
    if (!under || !FILE_DROP_TRACKS.includes(under) || locks.has(under)) return null;
    return dropTargetFor(under, e);
  };

  const onDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (isFileDrag([...e.dataTransfer.types])) {
      // File từ máy: trang (VideoEditor) lo gợi ý chung + chặn khi chỉ đọc; ở đây
      // chỉ tô làn sẽ nhận
      if (readOnly) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const target = fileTargetAt(e);
      setLibReject(null);
      setLibDrop((cur) =>
        cur && target && cur.track === target.track && cur.frame === target.frame && cur.sceneIndex === target.sceneIndex
          ? cur
          : target,
      );
      return;
    }
    const target = libraryTargetAt(e);
    if (!target) return;
    e.preventDefault();
    if ("reject" in target) {
      e.dataTransfer.dropEffect = "none";
      setLibDrop(null);
      setLibReject(target.reject);
      return;
    }
    setLibReject(null);
    e.dataTransfer.dropEffect = "copy";
    setLibDrop((cur) =>
      cur && cur.track === target.track && cur.frame === target.frame && cur.sceneIndex === target.sceneIndex
        ? cur
        : target,
    );
  };

  const onDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    // Rời hẳn khung timeline (không phải chỉ đi qua một khối con)
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    setLibDrop(null);
    setLibReject(null);
  };

  // Lượt kéo bị hủy (Esc, thả ngoài cửa sổ) không phải lúc nào cũng bắn dragleave
  // lên khung timeline - dọn chỉ báo ở dragend của cả trang cho chắc
  useEffect(() => {
    const clear = () => {
      setLibDrop(null);
      setLibReject(null);
    };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, []);

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (isFileDrag([...e.dataTransfer.types])) {
      setLibDrop(null);
      setLibReject(null);
      if (readOnly) return; // handler chung của trang báo "AI đang sửa"
      e.preventDefault();
      // Handler chung của trang (thả ngoài timeline = chỉ vào thư viện) không xử lý lại
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFilesDrop(files, fileTargetAt(e));
      return;
    }
    const target = libraryTargetAt(e);
    setLibDrop(null);
    setLibReject(null);
    if (!target || "reject" in target) return;
    e.preventDefault();
    const item = readDragData(e.dataTransfer);
    if (item) onLibraryDrop(item, target);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !(e.target instanceof Element)) return;
    const el = scrollRef.current;
    if (!el) return;
    const target = e.target;
    // Cờ lượt AI nằm trên thước - bấm cờ là bấm nút, không phải tua
    if (target.closest("[data-ai-mark]")) return;
    hideHover();
    let blockEl = target.closest("[data-block]");
    const edgeEl = target.closest("[data-edge]");
    const onRuler = target.closest("[data-ruler]") !== null;
    const onLane = target.closest("[data-lane]") !== null;

    let mode: DragMode | null = null;
    let sel: Selection | null = null;
    if (blockEl) {
      // Các khối cùng làn có thể chồng nhau (cue dày đặc ở mức zoom vừa khung,
      // khối được nới tới BLOCK_MIN_PX): khối nằm trên chưa chắc là khối người
      // dùng nhắm. Bấm vào THÂN khối (không phải mép kéo) thì chọn khối có
      // khoảng [start, end) chứa frame dưới con trỏ và ngắn nhất - chính xác
      // nhất. Không khối nào chứa (con trỏ ở phần được nới) thì giữ khối bị bấm.
      // (Con trỏ nằm ngoài khoảng frame của chính khối bị bấm = đang ở phần được
      // nới của một khối hẹp - khối hẹp vẽ trên cùng, đó đúng là khối người dùng nhắm.)
      if (!edgeEl) {
        const frame = frameAtClient(e.clientX);
        if (blockSpanContains(blockEl, frame)) blockEl = preciseBlockAt(blockEl, frame) ?? blockEl;
      }
      sel = decodeSel(blockEl);
      editor.select(sel);
      // preventDefault bên dưới (chặn bôi đen chữ lúc kéo) cũng chặn luôn việc
      // khối nhận focus - tự đưa focus vào để Enter/Delete/viền focus đúng khối
      if (blockEl instanceof HTMLElement) blockEl.focus({ preventScroll: true });
      // Track khóa: chọn để xem được, không kéo/cắt
      if (readOnly || blockEl.getAttribute("data-static") === "true") return;
      if (blockEl.closest(".tl-row")?.getAttribute("data-locked") === "true") return;
      const edge = edgeEl?.getAttribute("data-edge");
      if (edge === "start") mode = "trim-start";
      else if (edge === "end") mode = "trim-end";
      else mode = sel?.kind === "scene" ? "reorder" : "move";
    } else if (onRuler || onLane) {
      if (onLane) editor.select(null);
      mode = "scrub";
      editor.seek(Math.round(frameAtClient(e.clientX)));
    } else {
      return;
    }
    if (!mode) return;
    e.preventDefault();

    // Mép + mốc hít tính MỘT lần lúc bấm (từ origin)
    let edges: number[] = [];
    let sceneIndex = -1;
    if (sel?.kind === "scene") {
      sceneIndex = spans.findIndex((s) => s.id === sel.id);
      const span = spans[sceneIndex];
      if (span && mode === "trim-end") edges = [span.end];
    } else if (sel && isCueSel(sel.kind) && "index" in sel) {
      const cue = timeline[CUE_KIND[sel.kind]][sel.index];
      if (cue && Number.isFinite(cue.from) && Number.isFinite(cue.durationInFrames)) {
        const end = cue.from + cue.durationInFrames;
        edges = mode === "move" ? [cue.from, end] : mode === "trim-start" ? [cue.from] : [end];
      }
    } else if (sel?.kind === "sfx") {
      const sfx = timeline.audio.sfx[sel.index];
      if (sfx && Number.isFinite(sfx.atFrame)) edges = [sfx.atFrame];
    } else if (sel?.kind === "layer") {
      const layer = layersOf(timeline).find((l) => l?.id === sel.id);
      if (isLayerWellFormed(layer)) {
        const end = layer.from + layer.durationInFrames;
        edges = mode === "move" ? [layer.from, end] : mode === "trim-start" ? [layer.from] : [end];
      }
    }

    dragCounter.current += 1;
    dragRef.current = {
      pointerId: e.pointerId,
      mode,
      target: sel,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      origin: timeline,
      produced: new WeakSet(),
      aborted: false,
      started: mode === "scrub",
      key: `drag:${dragCounter.current}`,
      edges,
      candidates: snapCandidates(sel, mode, sceneIndex),
      sceneIndex,
    };
    // Phím tắt sửa (S, Delete, Ctrl+Z…) bị bỏ qua suốt lượt kéo - xem VideoEditor
    if (mode !== "scrub") editor.dragActive.current = true;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // con trỏ đã nhả trước khi kịp bắt - lượt kéo kết thúc ở pointerup
    }
  };

  /**
   * Timeline đã đổi từ nơi khác giữa lượt kéo: DỪNG lượt kéo, giữ nguyên mọi
   * thứ đang có (kể cả phần đã kéo tới giờ - nó đã là một bước hoàn tác). Con
   * trỏ vẫn đang giữ thì các lần di tiếp theo bị bỏ qua tới khi nhả chuột.
   */
  const abortDrag = (drag: DragState) => {
    if (drag.aborted) return;
    drag.aborted = true;
    pendingRef.current = null;
    editor.dragActive.current = false;
    editor.endCoalesce();
    setDragView(null);
  };

  /** Timeline đã render gần nhất là thứ lượt kéo "sở hữu" (origin hoặc một bản nó đã đẩy)? */
  const dragOwnsTimeline = (drag: DragState): boolean => dragOwns(drag, timelineRef.current);

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) showHover(e.clientX, e.clientY);
    const drag = dragRef.current;
    const el = scrollRef.current;
    if (!drag || !el || e.pointerId !== drag.pointerId || drag.aborted) return;

    if (drag.mode === "scrub") {
      editor.seek(Math.round(frameAtClient(e.clientX)));
      return;
    }

    // Tự cuộn khi con trỏ sát mép khung
    const rect = el.getBoundingClientRect();
    if (e.clientX < rect.left + LABEL_W + EDGE_SCROLL_PX) el.scrollLeft -= 12;
    else if (e.clientX > rect.right - EDGE_SCROLL_PX) el.scrollLeft += 12;

    const dx = e.clientX - drag.startX + (el.scrollLeft - drag.startScroll);
    if (!drag.started) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      drag.started = true;
    }
    const raw = Math.round(pxToFrame(dx, pps, fps));

    if (drag.mode === "reorder") {
      const frame = frameAtClient(e.clientX);
      setDragView({
        target: drag.target,
        mode: drag.mode,
        snapAt: null,
        dropIndex: dropIndexAt(frame),
        offsetPx: dx,
      });
      return;
    }

    if (!dragOwnsTimeline(drag)) {
      abortDrag(drag);
      return;
    }
    const snapped = snapDelta(raw, drag.edges, drag.candidates, e.altKey);
    const op = applyDrag(drag, snapped.delta);
    setDragView({
      target: drag.target,
      mode: drag.mode,
      snapAt: snapped.at,
      dropIndex: null,
      offsetPx: 0,
    });
    if (op) {
      schedule(() => {
        if (drag.aborted) return;
        // Kiểm lại ngay lúc đẩy (khung hình sau): giữa hai lần thứ khác có thể chen vào
        if (!dragOwnsTimeline(drag)) {
          abortDrag(drag);
          return;
        }
        // Store vẫn đang giữ bản của lượt kéo thì thay, khác thì để nguyên (một
        // lượt sửa khác vừa vào hàng trước lượt này - khung sau sẽ dừng kéo)
        editor.edit(dragStep(drag, op(drag.origin)), { coalesce: drag.key, windowMs: null });
      });
    }
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    editor.dragActive.current = false;
    const el = scrollRef.current;
    try {
      el?.releasePointerCapture(e.pointerId);
    } catch {
      // đã nhả
    }
    if (drag.aborted) {
      setDragView(null);
      return;
    }
    flush();
    if (!cancelled && drag.started && drag.mode === "reorder" && drag.target?.kind === "scene") {
      // Đổi thứ tự trên timeline HIỆN TẠI (theo id), không phải origin: thứ gì
      // chen vào lúc đang kéo (AI thêm scene, nút "+") vẫn còn nguyên
      const id = drag.target.id;
      const drop = dropIndexAt(frameAtClient(e.clientX));
      editor.edit((tl) => {
        const from = sceneIndexById(tl, id);
        if (from < 0) return tl;
        return reorderScene(tl, from, drop > from ? drop - 1 : drop);
      });
    }
    if (cancelled && drag.started && drag.mode !== "reorder" && drag.mode !== "scrub") {
      // pointercancel (mất con trỏ): trả về đúng trạng thái lúc bấm - chỉ khi
      // timeline vẫn là thứ lượt kéo tạo ra (không thì trả về là xóa thứ chen vào)
      const origin = drag.origin;
      editor.edit((tl) => (dragOwns(drag, tl) ? origin : tl), {
        coalesce: drag.key,
        windowMs: null,
      });
    }
    editor.endCoalesce();
    setDragView(null);
  };

  // ---------------------------------------------------------------- vẽ

  const selectedKey = selKey(selection);
  const draggingKey = dragView ? selKey(dragView.target) : "";

  const block = ({
    sel,
    start,
    end,
    label,
    title,
    icon: Icon,
    resizable,
    staticBlock = false,
    invalid = false,
    broken = false,
    offsetPx = 0,
    reactKey,
  }: {
    sel: Selection;
    start: number;
    end: number;
    label: string;
    title: string;
    icon?: LucideIcon;
    resizable: { start: boolean; end: boolean };
    staticBlock?: boolean;
    invalid?: boolean;
    /** Scene không tính được độ dài - vẽ rộng hẳn ra để thấy và bấm sửa được */
    broken?: boolean;
    offsetPx?: number;
    /** Key React riêng khi selection không định danh được khối (layer thiếu id) */
    reactKey?: string;
  }): ReactNode => {
    const key = selKey(sel);
    const left = x(start);
    const width = Math.max(broken ? BROKEN_BLOCK_MIN_PX : BLOCK_MIN_PX, x(end) - left);
    const selected = key === selectedKey;
    const dragging = key === draggingKey;
    const classes = [
      "tl-block",
      staticBlock ? "is-static" : "",
      readOnly ? "is-readonly" : "",
      dragging ? "is-dragging" : "",
      // Khối hẹp: bỏ padding/viền dày - không thì hộp tự nở ra ~20px, đè lên
      // khối bên cạnh và che mất chính vùng bấm của nó
      width < 24 ? "is-narrow" : "",
      invalid || broken ? "is-invalid" : "",
    ].join(" ");
    return (
      <div
        key={reactKey ?? key}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={title}
        title={title}
        data-block=""
        data-static={staticBlock ? "true" : undefined}
        data-selected={selected ? "true" : undefined}
        data-start={start}
        data-end={end}
        {...encodeSel(sel)}
        className={classes}
        style={{
          left,
          width,
          transform: offsetPx ? `translateX(${offsetPx}px)` : undefined,
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            editor.select(sel);
          }
        }}
      >
        {Icon && width > 36 && <Icon size={13} strokeWidth={2} aria-hidden="true" />}
        {width > 24 && <span className="tl-block-text">{label}</span>}
        {!readOnly && resizable.start && width > 12 && (
          <span className="tl-handle is-start" data-edge="start" aria-hidden="true" />
        )}
        {!readOnly && resizable.end && width > 12 && (
          <span className="tl-handle is-end" data-edge="end" aria-hidden="true" />
        )}
      </div>
    );
  };

  // Giây thập phân như inspector (không phải mm:ss.ff - hai cách viết cho cùng
  // một mốc thì người dùng phải tự quy đổi)
  const secLabel = (frames: number) => formatSeconds(frames, fps);

  // Scene HẸP (1 frame, scene lỗi độ dài - khối được nới rộng) vẽ sau cùng để
  // nằm trên scene kề; scene thường giữ đúng thứ tự phát trong DOM
  const isNarrowSpan = (sp: SceneSpan) => sp.invalid || x(sp.end) - x(sp.start) < 24;
  const sceneBlocks = [...spans.filter((sp) => !isNarrowSpan(sp)), ...spans.filter(isNarrowSpan)].map((span) => {
    const scene = timeline.scenes[span.index];
    const kind = sceneKind(scene);
    const icon = kind === "image" ? ImageIcon : kind === "hyperframes" ? Sparkles : Film;
    const name = kind === "hyperframes" ? scene.id : baseName(sceneSourcePath(scene)) || scene.id;
    const missing = sceneMissingMedia(scene, preview);
    const offset =
      dragView?.mode === "reorder" && dragView.target?.kind === "scene" && dragView.target.id === scene.id
        ? dragView.offsetPx
        : 0;
    return block({
      sel: { kind: "scene", id: scene.id },
      start: span.start,
      end: span.end,
      label: name,
      title: span.invalid
        ? tf("editor.timeline.block-scene-broken", { name })
        : missing
          ? tf("editor.timeline.block-missing", { name, file: missing })
          : tf("editor.timeline.block-scene", {
              name,
              start: secLabel(span.start),
              end: secLabel(span.end),
            }),
      icon,
      resizable: {
        start: kind === "footage" || kind === "image" || kind === "empty",
        end: true,
      },
      invalid: missing !== null,
      broken: span.invalid,
      offsetPx: offset,
    });
  });

  const overlaps = spans
    .filter((s) => s.overlapOut > 0)
    .map((s) => (
      <div
        key={`ov-${s.id}`}
        className="tl-overlap"
        style={{ left: x(s.end - s.overlapOut), width: Math.max(2, x(s.overlapOut)) }}
        title={tf("editor.timeline.transition", { sec: (s.overlapOut / fps).toFixed(2) })}
      />
    ));

  // Mọi lần đọc dữ liệu cue đều phòng thủ: meta.json do AI ghi có thể sai kiểu
  // (`words` là chuỗi, `text` là số…). Một `.map` trên thứ không phải mảng là
  // sập cả trình chỉnh sửa - ở đây nó chỉ thành một khối đánh dấu lỗi.
  // Khối NGẮN vẽ SAU (nằm trên): cue dày đặc chồng nhau thì khối nhỏ không bị
  // khối dài che mất. (z-index không dùng được: khối phải nằm dưới nhãn track
  // và playhead.) Key giữ nguyên nên React chỉ đổi thứ tự DOM.
  const byWidthDesc = <T extends { span: number }>(list: T[]): T[] => [...list].sort((a, b) => b.span - a.span);
  const cueBlocks = (kind: "caption" | "subtitle" | "overlay") =>
    byWidthDesc(
      timeline[CUE_KIND[kind]].map((cue, index) => ({
        cue,
        index,
        span: num(cue?.durationInFrames, 1),
      })),
    ).map(({ cue, index }) => {
      let label: string;
      if (kind === "caption") {
        const words = captionWordsOf(timeline.captions[index]) ?? [];
        label = words.map((w) => str(w?.text)).join(" ");
      } else if (kind === "subtitle") {
        label = str(timeline.subtitles[index]?.text).replace(/\n+/g, " / ");
      } else {
        const o = timeline.overlays[index];
        const kicker = str(o?.kicker);
        const parts = highlightPartsOf(o) ?? [];
        label = `${kicker ? `${kicker} · ` : ""}${parts.map((p) => str(p?.t)).join("")}`;
      }
      const start = num(cue?.from, 0);
      const end = start + Math.max(1, num(cue?.durationInFrames, 1));
      const sel: Selection = { kind, index };
      const ok = isWellFormed(timeline, sel);
      const shown = label || (ok ? "" : t("editor.malformed.short"));
      return block({
        sel,
        start,
        end,
        label: shown,
        title: `${shown} (${secLabel(start)} - ${secLabel(end)})`,
        // Kéo mép một cue lỗi chỉ đẻ thêm dữ liệu lỗi - vẫn chọn/xóa/dời được
        resizable: { start: ok, end: ok },
        invalid: !ok,
      });
    });

  const sfxBlocks = byWidthDesc(
    timeline.audio.sfx.map((sfx, index) => {
      const f = str(sfx?.file);
      const d = f ? preview.media[f]?.durationSec : undefined;
      return { sfx, index, span: typeof d === "number" ? d : 1 };
    }),
  ).map(({ sfx, index }) => {
    const file = str(sfx?.file);
    const media = file ? preview.media[file]?.durationSec : undefined;
    const lenSec =
      typeof media === "number" && media > 0 ? Math.max(0.1, media - num(sfx?.mediaStart, 0)) : 1;
    const sel: Selection = { kind: "sfx", index };
    const ok = isWellFormed(timeline, sel);
    const name = baseName(file) || t("editor.malformed.short");
    const at = num(sfx?.atFrame, 0);
    const missing = isMediaMissing(preview, file);
    return block({
      sel,
      start: at,
      end: at + Math.max(1, Math.round(lenSec * fps)),
      label: name,
      title: missing ? tf("editor.timeline.block-missing", { name, file }) : `${name} (${secLabel(at)})`,
      icon: AudioLines,
      resizable: { start: false, end: false },
      invalid: !ok || missing,
    });
  });

  // Track Layer: layer chồng thời gian tự xếp thành nhiều làn (packLanes) - làn
  // tính từ dữ liệu, không lưu: kéo một layer thì làn tự sắp lại
  const layerList = layersOf(timeline);
  const layerPack = packLanes(
    layerList.map((l) => {
      const start = num(l?.from, 0);
      return { start, end: start + Math.max(1, num(l?.durationInFrames, 1)) };
    }),
  );
  const layerLanes: ReactNode[][] = Array.from({ length: layerPack.count }, () => []);
  layerList.forEach((layer, index) => {
    const id = str(layer?.id);
    const kind = str(layer?.kind);
    const sel: Selection = { kind: "layer", id };
    const ok = !!id && isWellFormed(timeline, sel);
    const src = str(layer?.src);
    const label =
      kind === "text"
        ? str(layer?.text).replace(/\n+/g, " / ") || t("editor.layers.kind-text")
        : kind === "shape"
          ? t("editor.layers.kind-shape")
          : baseName(src) || t("editor.malformed.short");
    const start = num(layer?.from, 0);
    const end = start + Math.max(1, num(layer?.durationInFrames, 1));
    const missing = (kind === "image" || kind === "video") && isMediaMissing(preview, src);
    layerLanes[layerPack.lanes[index] ?? 0].push(
      block({
        sel,
        start,
        end,
        label,
        title: missing
          ? tf("editor.timeline.block-missing", { name: label, file: src })
          : `${label} (${secLabel(start)} - ${secLabel(end)})`,
        icon: kind === "text" ? Type : kind === "shape" ? Square : kind === "video" ? Video : ImageIcon,
        resizable: { start: ok, end: ok },
        invalid: !ok || missing,
        // Layer thiếu id thì không chọn/kéo được (selection theo id) - vẫn vẽ để thấy
        staticBlock: !id,
        reactKey: id ? undefined : `layer-broken-${index}`,
      }),
    );
  });

  const voice = typeof timeline.audio.voice === "string" ? timeline.audio.voice : null;
  const voiceSec = voice ? preview.media[voice]?.durationSec : null;
  const voiceEnd =
    typeof voiceSec === "number" && voiceSec > 0 ? Math.round(voiceSec * fps) : totalFrames;
  const music =
    timeline.audio.music && typeof timeline.audio.music === "object" ? timeline.audio.music : null;

  const tracks: {
    key: TrackKey;
    label: string;
    icon: LucideIcon;
    items: ReactNode[];
    extra?: ReactNode;
    /** Track nhiều làn (Layer): mỗi phần tử là khối của một làn */
    lanes?: ReactNode[][];
  }[] = [
    { key: "scene", label: t("editor.track.video"), icon: Film, items: sceneBlocks, extra: overlaps },
    { key: "layer", label: t("editor.track.layer"), icon: Layers, items: layerLanes.flat(), lanes: layerLanes },
    { key: "overlay", label: t("editor.track.highlight"), icon: Highlighter, items: cueBlocks("overlay") },
    { key: "caption", label: t("editor.track.karaoke"), icon: Captions, items: cueBlocks("caption") },
    { key: "subtitle", label: t("editor.track.subtitle"), icon: Subtitles, items: cueBlocks("subtitle") },
    { key: "sfx", label: t("editor.track.sfx"), icon: AudioLines, items: sfxBlocks },
    {
      key: "voice",
      label: t("editor.track.voice"),
      icon: Mic,
      items: voice
        ? [
            block({
              sel: { kind: "voice" },
              start: 0,
              end: Math.max(1, voiceEnd),
              label: baseName(voice),
              title: isMediaMissing(preview, voice)
                ? tf("editor.timeline.block-missing", { name: baseName(voice), file: voice })
                : baseName(voice),
              icon: Mic,
              resizable: { start: false, end: false },
              staticBlock: true,
              invalid: isMediaMissing(preview, voice),
            }),
          ]
        : [],
    },
    {
      key: "music",
      label: t("editor.track.music"),
      icon: Music,
      items: music
        ? [
            block({
              sel: { kind: "music" },
              start: 0,
              end: totalFrames,
              label: baseName(music.file),
              title: isMediaMissing(preview, music.file)
                ? tf("editor.timeline.block-missing", { name: baseName(music.file), file: String(music.file) })
                : baseName(music.file),
              icon: Music,
              resizable: { start: false, end: false },
              staticBlock: true,
              invalid: isMediaMissing(preview, music.file),
            }),
          ]
        : [],
    },
  ];

  // Vạch thước giờ - chỉ vẽ phần đang nhìn thấy (video dài × zoom sâu là hàng chục nghìn vạch)
  const ticks = useMemo(() => {
    const { major, minor } = rulerStep(pps);
    const fromSec = Math.max(0, pxToFrame(viewport.left - LABEL_W, pps, fps) / fps - major);
    const toSec = pxToFrame(viewport.left + viewport.width, pps, fps) / fps + major;
    const out: { sec: number; major: boolean }[] = [];
    const start = Math.floor(fromSec / minor) * minor;
    for (let s = start; s <= toSec; s += minor) {
      const sec = Math.round(s * 1000) / 1000;
      const isMajor = Math.abs(sec / major - Math.round(sec / major)) < 1e-6;
      out.push({ sec, major: isMajor });
    }
    return out;
  }, [pps, fps, viewport.left, viewport.width]);

  const sceneBoundaryX = (index: number): number =>
    x(index < spans.length ? spans[index].start : (spans[spans.length - 1]?.end ?? 0));
  const dropX =
    dragView?.dropIndex !== null && dragView?.dropIndex !== undefined
      ? sceneBoundaryX(dragView.dropIndex)
      : libDrop?.track === "scene"
        ? sceneBoundaryX(libDrop.sceneIndex)
        : null;
  const addCueLabel: Record<AddCueKind, string> = {
    overlay: t("editor.add.highlight"),
    caption: t("editor.add.karaoke"),
    subtitle: t("editor.add.subtitle"),
  };

  return (
    <section className="tl" style={{ height }} aria-label={t("editor.timeline.title")}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="text-sm font-semibold">{t("editor.timeline.title")}</h2>
          <span className="text-meta text-[var(--text-muted)] tabular-nums">
            {tf("editor.timeline.length", { time: formatSeconds(totalFrames, fps) })}
          </span>
          <span className="hidden text-meta text-[var(--text-muted)] lg:inline">
            {onAiAt ? t("editor.timeline.snap-ai-hint") : t("editor.timeline.snap-hint")}
          </span>
          {runningAi > 0 && (
            <Badge tone="running" label={tf("editor.tlai.running-count", { n: runningAi })} />
          )}
        </div>
        <div className="flex items-center gap-1">
          <IconButton label={t("editor.zoom-out")} onClick={() => zoomBy(1 / 1.5)} disabled={pps <= ZOOM_MIN_PPS}>
            <ZoomOut size={16} strokeWidth={1.75} />
          </IconButton>
          <input
            type="range"
            className="slider w-28 flex-none"
            min={0}
            max={100}
            step={1}
            value={ppsToSlider(pps)}
            aria-label={t("editor.zoom")}
            onChange={(e) => {
              autoFitRef.current = false;
              setPps(clampPps(sliderToPps(Number(e.target.value))));
            }}
          />
          <IconButton label={t("editor.zoom-in")} onClick={() => zoomBy(1.5)} disabled={pps >= ZOOM_MAX_PPS}>
            <ZoomIn size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label={t("editor.zoom-fit")}
            onClick={() => {
              autoFitRef.current = true;
              fit();
            }}
          >
            <Maximize2 size={16} strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="tl-scroll"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finishDrag(e, false)}
        onPointerCancel={(e) => finishDrag(e, true)}
        onLostPointerCapture={(e) => finishDrag(e, false)}
        onPointerLeave={hideHover}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="tl-content" style={{ width: contentWidth }}>
          <div className="tl-ruler">
            <div className="tl-label" style={{ width: LABEL_W }} aria-hidden="true" />
            <div className="tl-ruler-lane" data-ruler="" title={t("editor.timeline.ruler-hint")}>
              {ticks.map((tick) => (
                <span key={tick.sec}>
                  <span
                    className={`tl-tick ${tick.major ? "is-major" : ""}`}
                    style={{ left: frameToPx(tick.sec * fps, pps, fps) }}
                  />
                  {tick.major && (
                    <span className="tl-tick-label" style={{ left: frameToPx(tick.sec * fps, pps, fps) }}>
                      {formatRulerLabel(tick.sec)}
                    </span>
                  )}
                </span>
              ))}
              <PlayheadKnob pps={pps} />
              {aiJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  data-ai-mark=""
                  data-status={job.status}
                  className="tl-ai-flag"
                  style={{ left: x(job.frame) }}
                  title={jobLabel(job)}
                  aria-label={jobLabel(job)}
                  onClick={() => onAiJobClick?.(job)}
                >
                  <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          {tracks.map((track) => (
            <div
              key={track.key}
              className="tl-row"
              data-track={track.key}
              data-drop={libDrop?.track === track.key ? "true" : libReject === track.key ? "reject" : undefined}
              data-locked={locks.has(track.key) ? "true" : undefined}
              style={track.lanes && track.lanes.length > 1 ? { height: LANE_H * track.lanes.length } : undefined}
            >
              <div className="tl-label text-meta font-medium" style={{ width: LABEL_W }}>
                <span className="tl-label-swatch" aria-hidden="true" />
                <track.icon size={14} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{track.label}</span>
                {(track.key === "overlay" || track.key === "caption" || track.key === "subtitle") && (
                  <IconButton
                    label={addCueLabel[track.key]}
                    size="sm"
                    disabled={readOnly || locks.has(track.key)}
                    onClick={() => onAddCue(track.key as AddCueKind)}
                    data-add-cue={track.key}
                  >
                    <Plus size={13} strokeWidth={2} />
                  </IconButton>
                )}
                {track.key === "layer" && <AddLayerMenu disabled={readOnly || locks.has("layer")} onAdd={onAddLayer} />}
                <IconButton
                  label={tf(locks.has(track.key) ? "editor.lock.unlock-track" : "editor.lock.lock-track", {
                    track: track.label,
                  })}
                  size="sm"
                  aria-pressed={locks.has(track.key)}
                  className="tl-lock"
                  onClick={() => toggleLock(track.key)}
                >
                  {locks.has(track.key) ? (
                    <Lock size={13} strokeWidth={2} />
                  ) : (
                    <LockOpen size={13} strokeWidth={2} />
                  )}
                </IconButton>
              </div>
              {track.lanes ? (
                <div className="tl-lane tl-lanes">
                  {track.lanes.map((lane, i) => (
                    <div key={i} className="tl-sublane" data-lane="">
                      {lane}
                      {i === 0 && track.items.length === 0 && (
                        <span className="tl-empty" style={{ left: viewport.left + 8 }}>
                          {t("editor.layers.empty")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tl-lane" data-lane="">
                  {track.extra}
                  {track.items}
                  {track.items.length === 0 && (
                    <span className="tl-empty" style={{ left: viewport.left + 8 }}>
                      {t("editor.track.empty")}
                    </span>
                  )}
                  {track.key === "scene" && dropX !== null && (
                    <span className="tl-drop" style={{ left: dropX }} aria-hidden="true" />
                  )}
                </div>
              )}
            </div>
          ))}

          {(libDrop?.track === "sfx" || libDrop?.track === "layer") && (
            <span className="tl-snap" style={{ left: LABEL_W + x(libDrop.frame) }} aria-hidden="true" />
          )}
          {dragView?.snapAt !== null && dragView?.snapAt !== undefined && (
            <span
              className="tl-snap"
              style={{ left: LABEL_W + x(dragView.snapAt) }}
              aria-hidden="true"
            />
          )}
          {aiJobs.map((job) => (
            <span
              key={job.id}
              className="tl-ai-line"
              data-status={job.status}
              style={{ left: LABEL_W + x(job.frame) }}
              aria-hidden="true"
            />
          ))}
          <span ref={hoverLineRef} className="tl-hover" style={{ display: "none" }} aria-hidden="true">
            <span ref={hoverLabelRef} className="tl-hover-label" />
          </span>
          <PlayheadLine pps={pps} />
        </div>
      </div>
    </section>
  );
}

/**
 * Nút "+" của track Layer - menu hai mục (chữ / khối màu) theo mẫu menu-button
 * của WAI-ARIA như menu "Thêm" ở thanh trên. Menu đặt `position: fixed` theo
 * vị trí nút: nhãn track và khung cuộn đều cắt phần tràn (overflow), menu nằm
 * trong chúng là bị cắt mất.
 */
function AddLayerMenu({ disabled, onAdd }: { disabled: boolean; onAdd: (kind: AddLayerKind) => void }) {
  const { t } = useT();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  const items = (): HTMLButtonElement[] =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
  const close = useCallback((refocus: boolean) => {
    setPos(null);
    if (refocus) rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) return;
      if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
      close(false);
    };
    // Esc khi menu mở CHỈ đóng menu (bắt ở pha capture, chặn lan - không bỏ chọn)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    const onScroll = () => close(false);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, close]);

  const toggle = () => {
    if (open) {
      close(false);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setPos({ left: rect.left, top: rect.bottom + 4 });
  };

  const pick = (kind: AddLayerKind) => {
    close(true);
    onAdd(kind);
  };

  return (
    <span ref={rootRef} className="flex">
      <IconButton
        label={t("editor.layers.add")}
        size="sm"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <Plus size={13} strokeWidth={2} />
      </IconButton>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("editor.layers.add")}
          className="editor-menu tl-add-menu"
          style={{ left: pos.left, top: pos.top }}
          onKeyDown={(e) => {
            const list = items();
            const i = list.findIndex((el) => el === document.activeElement);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const next = e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
              list[next]?.focus();
            } else if (e.key === "Tab") {
              close(false);
            }
          }}
        >
          <button type="button" role="menuitem" className="editor-menu-item" onClick={() => pick("text")}>
            <Type size={16} strokeWidth={1.75} aria-hidden="true" />
            {t("editor.layers.add-text")}
          </button>
          <button type="button" role="menuitem" className="editor-menu-item" onClick={() => pick("shape")}>
            <Square size={16} strokeWidth={1.75} aria-hidden="true" />
            {t("editor.layers.add-shape")}
          </button>
        </div>
      )}
    </span>
  );
}

function PlayheadLine({ pps }: { pps: number }) {
  const { playback, fps } = useEditor();
  const frame = usePlayheadFrame(playback);
  return (
    <span
      className="tl-playhead"
      style={{ transform: `translateX(${LABEL_W + frameToPx(frame, pps, fps)}px)` }}
      aria-hidden="true"
    />
  );
}

function PlayheadKnob({ pps }: { pps: number }) {
  const { playback, fps } = useEditor();
  const frame = usePlayheadFrame(playback);
  return (
    <span
      className="tl-playhead-knob"
      style={{ transform: `translateX(${frameToPx(frame, pps, fps)}px)` }}
      aria-hidden="true"
    />
  );
}
