"use client";

/**
 * Trình chỉnh sửa video (/projects/[id]/editor) - ráp các mảnh lại với nhau:
 *
 *   store.ts      reducer: timeline + selection + hoàn tác + trạng thái lưu
 *   ops.ts        mọi thao tác sửa (thuần)       timing.ts  toán frame ↔ px
 *   playback.ts   playhead ngoài React state     PreviewPlayer  Remotion Player
 *   TimelinePanel / Inspector / Transport / EditorTopBar / EditorChat
 *
 * Trang này lo phần "nối dây" với server:
 * - tải GET /timeline, tải lại (throttle 1.5s) khi AI ghi file, khi job render
 *   scene xong, khi SSE nối lại;
 * - tự lưu 700ms sau thay đổi cuối (PUT kèm baseVersion), xung đột → banner
 *   "Tải bản mới" / "Giữ bản của tôi", lỗi validate → banner trỏ thẳng phần tử;
 * - chỉ đọc khi AI đang chạy trên project (lock.agentBusy + SSE agent);
 * - render draft/final qua render queue (lưu nốt thay đổi trước khi xếp job);
 * - thả FILE từ máy vào bất kỳ đâu: tải tuần tự vào assets (tiến độ theo SSE
 *   `upload`), thả lên track Video/Layer/SFX thì chèn luôn vào đó;
 * - sao chép/dán (Ctrl+C/V tại playhead), đổi lớp layer (Ctrl+] / Ctrl+[);
 * - phím tắt (không bao giờ khi đang gõ trong ô nhập).
 */

import { Clapperboard, FileDown, History, Keyboard, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LinkButton } from "@/components/LinkButton";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/Skeleton";
import {
  ApiError,
  getChatSessions,
  getJobs,
  getMediaInfo,
  getTimeline,
  getTimelineRevisions,
  importLibraryFile,
  restoreTimelineRevision,
  uploadAsset,
  saveTimeline,
  saveTimelineOnLeave,
  startEditorRender,
  timelineConflictOf,
  timelineExportUrl,
  timelineIssuesOf,
  type Job,
  type TimelineMediaInfo,
  type TimelineRevision,
  type Timeline,
  type TimelineIssue,
  type TimelineLock,
  type TimelinePreview,
  type TimelineProject,
  type TimelineScene,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useAgentEvents, useEvents, useJobEvents, useUploadEvents } from "@/lib/useEvents";
import { ProgressBar } from "@/components/ProgressBar";
import { AiImagePanel, type AiImagePurpose } from "./AiImagePanel";
import { CanvasOverlay, type CanvasTarget } from "./CanvasOverlay";
import { EditorChat } from "./EditorChat";
import { EditorContext, type EditorApi, type EditOptions } from "./EditorContext";
import { EditorTopBar, type EditorAiReview, type EditorMenuItem, type SaveState } from "./EditorTopBar";
import { HandoffModal } from "./HandoffModal";
import { EditorErrorBoundary } from "./EditorErrorBoundary";
import { EDITOR_OVERWRITE_LABEL, HistoryModal, type RestoreOutcome } from "./HistoryModal";
import { Inspector, primaryTextFieldId, type InspectorActions } from "./Inspector";
import {
  dropTracksOf,
  fileKindOf,
  isFileDrag,
  projectRelPath,
  type DropTarget,
  type LibraryItem,
} from "./library";
import { LibraryPanel, libraryItemKey } from "./LibraryPanel";
import {
  addCue,
  addLayer,
  addLayerKeyframe,
  addScene,
  insertSceneAtFrame,
  addSfx,
  applyLayerCanvasTransform,
  canDelete,
  canDuplicate,
  canSplitScene,
  CUE_KIND,
  contextFromPreview,
  copySelection,
  deleteSelection,
  duplicateSelection,
  isCueSel,
  layerById,
  layerIdFromFile,
  layersOf,
  layerValuesAt,
  moveLayerZ,
  moveSceneBy,
  newCuePlacement,
  newFillerScene,
  newFootageScene,
  newImageScene,
  newLayerId,
  newLayerPlacement,
  newMediaLayer,
  newShapeLayer,
  newTextLayer,
  NEW_LAYER_SEC,
  NEW_LAYER_VIDEO_FALLBACK_SEC,
  normalizeTimeline,
  pasteClipboard,
  patchLayer,
  patchScene,
  removeLayerKeyframe,
  sceneIdFromFile,
  sceneIndexById,
  sceneInsertIndexAt,
  setCueTransform,
  setMusic,
  splitAtPlayhead,
  type ClipboardEntry,
  type NewCue,
  type Selection,
  type TimelineLayer,
} from "./ops";
import { createPlaybackStore } from "./playback";
import { PreviewPlayer, type PlayerRef } from "./PreviewPlayer";
import { ShortcutsModal } from "./ShortcutsModal";
import {
  changedKeysPatch,
  editorReducer,
  initialEditorState,
  isDirty,
  TYPING_COALESCE_MS,
  type SaveProblem,
} from "./store";
import { TimelinePanel, type AddCueKind, type AddLayerKind } from "./TimelinePanel";
import { lockedChange, TRACK_LABEL_KEY, trackOfSelection, useTrackLocks, type LockableTrack } from "./locks";
import {
  jobWhat,
  spokenContextAt,
  TimelineAiPopover,
  useTimelineAiJobs,
  type TimelineAiAnchor,
  type TimelineAiJob,
  type TimelineAiMode,
} from "./TimelineAi";
import { Transport } from "./Transport";
import { computeSceneSpans, formatSeconds, totalFramesOf } from "./timing";

/** Tự lưu sau khi người dùng ngừng sửa ngần này (ms) */
const AUTOSAVE_MS = 700;
/** Tải lại timeline tối đa một lần mỗi khoảng này khi AI đang ghi file */
const REFETCH_THROTTLE_MS = 1500;
/** Hỏi lại version của server mỗi khoảng này (tab đang hiện) - bắt thay đổi từ tab khác */
const VERSION_POLL_MS = 15_000;
const TIMELINE_H_KEY = "aiev-editor-timeline-h";
/**
 * Vừa khít 8 track (32px, gồm track Layer một làn) + thước + thanh tiêu đề -
 * không cuộn dọc mà cũng không thừa chỗ: mỗi pixel bớt ở đây là trình phát
 * (khung dọc 9:16 bị giới hạn bởi CHIỀU CAO) to thêm. Màn thấp vẫn bị kẹp theo
 * 34% chiều cao cửa sổ (xem effect đọc TIMELINE_H_KEY).
 */
const TIMELINE_H_DEFAULT = 336;
const TIMELINE_H_MIN = 180;
/** Cột Thư viện gấp/mở - nhớ theo trình duyệt (chỉ là tiện ích, mất thì về mở) */
const LIBRARY_KEY = "aiev-editor-library";
/** Cửa sổ hẹp hơn mức này thì cột Thư viện tự gấp (xem toggleLibrary) */
const LIBRARY_AUTO_COLLAPSE_PX = 1360;
/** Nhãn lịch sử phiên bản cho mọi lần tự lưu (server gộp các PUT cùng nhãn trong 10s) */
const SAVE_LABEL = "editor";
/** Tool của agent có thể đã ghi meta.json → tải lại timeline */
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"]);

const isRenderJob = (job: Job): boolean =>
  job.type === "scene-draft" ||
  job.type === "scene-final" ||
  job.type === "assemble-draft" ||
  job.type === "assemble-final";

const isActive = (job: Job): boolean => job.status === "queued" || job.status === "running";

/** Một file đang/đã tải lên từ thả-file hoặc nút "Tải lên" của thư viện. */
interface UploadRow {
  id: number;
  name: string;
  status: "queued" | "uploading" | "done" | "error";
  received: number;
  /** 0 = chưa biết tổng (chưa có event tiến độ) → thanh vô định */
  total: number;
  error?: string;
}

/** Một file trong hàng đợi tải lên + chỗ chèn (null = chỉ vào thư viện). */
interface UploadJob {
  row: number;
  file: File;
  /** Dùng CHUNG cho mọi file của một lượt thả: chèn xong một file thì dời tiếp (scene kế / sau layer trước) */
  target: { drop: DropTarget; nextSceneIndex: number; nextFrame: number } | null;
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Body PUT = chỉ các khóa đã đổi so với bản đã lưu (xem store.changedKeysPatch). */
const toPatch = changedKeysPatch;

/** `scenes[2].from` → phần tử tương ứng để chọn khi bấm vào lỗi. */
function selectionFromIssuePath(path: string, tl: Timeline): Selection | null {
  const scene = /^scenes\[(\d+)\]/.exec(path);
  if (scene) {
    const id = tl.scenes[Number(scene[1])]?.id;
    return id ? { kind: "scene", id } : null;
  }
  const cue = /^(captions|subtitles|overlays)\[(\d+)\]/.exec(path);
  if (cue) {
    const index = Number(cue[2]);
    if (cue[1] === "captions") return { kind: "caption", index };
    if (cue[1] === "subtitles") return { kind: "subtitle", index };
    return { kind: "overlay", index };
  }
  const sfx = /^audio\.sfx\[(\d+)\]/.exec(path);
  if (sfx) return { kind: "sfx", index: Number(sfx[1]) };
  const layer = /^layers\[(\d+)\]/.exec(path);
  if (layer) {
    const id = layersOf(tl)[Number(layer[1])]?.id;
    return typeof id === "string" && id ? { kind: "layer", id } : null;
  }
  if (path.startsWith("audio.music")) return { kind: "music" };
  if (path.startsWith("audio.voice")) return { kind: "voice" };
  return null;
}

/** Gõ trong ô nhập thì phím tắt không được chạy. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

interface LoadError {
  message: string;
  detail?: string;
  notFound: boolean;
}

interface RenderProblem {
  message: string;
  detail?: string;
  issues: TimelineIssue[];
  /** Cổng QC chặn bản final - cho "Vẫn render" (force) */
  force: "final" | null;
}

export function VideoEditor({ projectId }: { projectId: string }) {
  const { t, tf } = useT();
  const router = useRouter();
  const { resyncTick } = useEvents();

  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const stateRef = useRef(state);
  stateRef.current = state;
  /** Track đang khóa (nhớ theo project trong trình duyệt) - edit() chặn mọi thao tác đổi chúng */
  const { locks, toggle: toggleLock } = useTrackLocks(projectId);
  const locksRef = useRef(locks);
  locksRef.current = locks;

  const [info, setInfo] = useState<{ project: TimelineProject; preview: TimelinePreview } | null>(null);
  const [lock, setLock] = useState<TimelineLock | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [renderStarting, setRenderStarting] = useState(false);
  const [renderProblem, setRenderProblem] = useState<RenderProblem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_H_DEFAULT);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  /** Món thư viện đang được thêm (chép file vào project / đo độ dài) */
  const [libraryBusy, setLibraryBusy] = useState<{ key: string; name: string; importing: boolean } | null>(null);
  const [libraryError, setLibraryError] = useState<{ message: string; detail?: string } | null>(null);
  /** Tăng = cột Thư viện tải lại danh sách file của project (vừa chép file mới vào) */
  const [assetsTick, setAssetsTick] = useState(0);
  /** Chờ xác nhận thay nhạc nền đang có */
  const [pendingMusic, setPendingMusic] = useState<LibraryItem | null>(null);
  const [exportProblem, setExportProblem] = useState<{ message: string; detail?: string } | null>(null);
  /** Ô "Tạo bằng AI tại đây" đang mở ở mốc nào (chuột phải / phím G trên timeline) */
  const [aiAnchor, setAiAnchor] = useState<TimelineAiAnchor | null>(null);
  /** Mốc dưới con trỏ trên timeline (TimelinePanel ghi) - phím G mở ô AI ở đó */
  const aiHoverRef = useRef<TimelineAiAnchor | null>(null);
  /** Việc giao thẳng cho chat AI từ timeline - EditorChat gửi ngay */
  const [chatQueued, setChatQueued] = useState<{ id: number; text: string } | null>(null);

  const playback = useMemo(() => createPlaybackStore(), []);
  /** Đang kéo khối trên timeline (TimelinePanel đặt) - xem EditorApi.dragActive */
  const dragActive = useRef(false);
  /** Bản sao của Ctrl+C - sống trong phiên, không qua clipboard hệ điều hành */
  const clipboardRef = useRef<ClipboardEntry | null>(null);
  const playerRef = useRef<PlayerRef | null>(null);
  const libraryBusyRef = useRef(false);
  const pendingTargetRef = useRef<DropTarget | null>(null);

  // Nguồn sự thật ĐỒNG BỘ cho lượt lưu: state của reducer chỉ cập nhật ở lượt
  // render sau, còn hai lượt lưu nối nhau thì cần version mới NGAY.
  const versionRef = useRef<string | null>(null);
  /** Object timeline đang nằm trên server ở versionRef (bản sao đồng bộ của state.savedTimeline) */
  const savedTimelineRef = useRef<Timeline | null>(null);
  const saveCountRef = useRef(0);
  const saveInFlight = useRef<Promise<boolean> | null>(null);

  const projectSessions = useRef(new Set<string>());
  const foreignSessions = useRef(new Set<string>());
  const classifying = useRef(new Set<string>());

  const fps = info?.project.fps ?? 30;
  const timeline = state.timeline;
  const readOnly = lock?.agentBusy === true;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  const spans = useMemo(() => (timeline ? computeSceneSpans(timeline.scenes, fps) : []), [timeline, fps]);
  const totalFrames = useMemo(() => totalFramesOf(spans), [spans]);
  const totalRef = useRef(totalFrames);
  totalRef.current = totalFrames;
  const opsCtx = useMemo(
    () => (info ? contextFromPreview(info.preview, fps) : contextFromPreview({ sceneRenders: {}, watermark: null, media: {} }, fps)),
    [info, fps],
  );

  // ================================================================ tải

  const loadRef = useRef<() => Promise<void>>(async () => {});
  const refetchTimer = useRef<number | null>(null);
  const lastFetchAt = useRef(0);

  const requestRefetch = useCallback(() => {
    if (refetchTimer.current !== null) return;
    const wait = Math.max(0, REFETCH_THROTTLE_MS - (Date.now() - lastFetchAt.current));
    refetchTimer.current = window.setTimeout(() => {
      refetchTimer.current = null;
      void loadRef.current();
    }, wait);
  }, []);

  useEffect(
    () => () => {
      if (refetchTimer.current !== null) window.clearTimeout(refetchTimer.current);
    },
    [],
  );

  /** Số thứ tự lượt tải - lượt về muộn của một request CŨ hơn thì bỏ */
  const loadSeqRef = useRef(0);

  const load = useCallback(async () => {
    lastFetchAt.current = Date.now();
    const savesBefore = saveCountRef.current;
    const seq = ++loadSeqRef.current;
    try {
      const res = await getTimeline(projectId);
      // Hai lượt tải chồng nhau (SSE nối lại + AI ghi file…) có thể về NGƯỢC thứ
      // tự: bản cũ về sau sẽ đè lên bản mới (lùi project/preview/khóa, thậm chí
      // nạp timeline cũ). Chỉ lượt gửi SAU CÙNG được áp.
      if (seq !== loadSeqRef.current) return;
      setLoadError(null);
      // Giữ identity khi không đổi: project/preview đổi là trình phát dựng lại
      setInfo((prev) => {
        if (prev && sameJson(prev.project, res.project) && sameJson(prev.preview, res.preview)) return prev;
        return {
          project: prev && sameJson(prev.project, res.project) ? prev.project : res.project,
          preview: prev && sameJson(prev.preview, res.preview) ? prev.preview : res.preview,
        };
      });
      setLock((prev) => (prev && sameJson(prev, res.lock) ? prev : res.lock));
      if (res.lock.sessionId) projectSessions.current.add(res.lock.sessionId);

      const s = stateRef.current;
      // Một lượt lưu đã chen vào giữa: bản vừa tải có thể CŨ hơn bản mình vừa ghi
      if (saveCountRef.current !== savesBefore || saveInFlight.current) {
        requestRefetch();
        return;
      }
      const incoming = normalizeTimeline(res.timeline);
      if (!s.timeline || (res.version !== versionRef.current && !isDirty(s))) {
        versionRef.current = res.version;
        savedTimelineRef.current = incoming;
        dispatch({ type: "loaded", version: res.version, timeline: incoming });
        return;
      }
      if (res.version !== versionRef.current) {
        // Người khác (AI / tab khác) đã đổi trong lúc mình còn bản chưa lưu
        dispatch({ type: "conflict", current: { version: res.version, timeline: incoming } });
      }
    } catch (err) {
      if (seq !== loadSeqRef.current) return; // đã có lượt tải mới hơn
      if (stateRef.current.timeline) return; // đang sửa được - lần tải sau sẽ bắt kịp
      setLoadError({
        message: err instanceof ApiError && err.status === 404 ? t("editor.load.not-found") : t("editor.load.error"),
        detail: err instanceof Error ? err.message : String(err),
        notFound: err instanceof ApiError && err.status === 404,
      });
    }
  }, [projectId, requestRefetch, t]);
  loadRef.current = load;

  useEffect(() => {
    void load();
    // resyncTick: SSE vừa nối lại - có thể đã lỡ event AI/job, tải lại cho chắc
  }, [load, resyncTick]);

  // Tab khác (hoặc ai đó sửa meta.json ngoài AI của project) lưu thì SSE không
  // báo gì - tab đang ngồi yên sẽ không bao giờ biết, tới lúc sửa mới đụng xung
  // đột. Hỏi lại server định kỳ (chỉ khi tab đang hiện) và ngay khi quay lại
  // tab: sạch thì nạp bản mới im lặng, đang bẩn thì banner xung đột hiện SỚM
  // (load() lo cả hai). GET /timeline rẻ: thông số ffprobe cache theo mtime.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && !saveInFlight.current) requestRefetch();
    };
    const timer = window.setInterval(tick, VERSION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") requestRefetch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [requestRefetch]);

  // Phiên AI của project (để lọc SSE agent) + job render đang có
  useEffect(() => {
    let alive = true;
    getChatSessions(projectId)
      .then((list) => list.forEach((s) => projectSessions.current.add(s.sessionId)))
      .catch(() => {});
    getJobs(50, projectId)
      .then((list) => {
        if (alive) setJobs(list.filter((j) => j.projectId === projectId && isRenderJob(j)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId, resyncTick]);

  // ================================================================ AI đang chạy

  const onProjectAgentEvent = useCallback(
    (kind: string, sessionId: string, toolName: string | undefined) => {
      if (kind === "done" || kind === "error") {
        requestRefetch();
        return;
      }
      setLock((l) => (l && !l.agentBusy ? { ...l, agentBusy: true, sessionId } : l));
      if (kind === "tool" && toolName && WRITE_TOOLS.has(toolName)) requestRefetch();
    },
    [requestRefetch],
  );

  useAgentEvents((e) => {
    const id = e.sessionId;
    if (!id || foreignSessions.current.has(id)) return;
    if (projectSessions.current.has(id)) {
      onProjectAgentEvent(e.kind, id, e.tool?.name);
      return;
    }
    // Phiên lạ: hỏi server MỘT lần xem có phải của project này không
    if (classifying.current.has(id)) return;
    classifying.current.add(id);
    getChatSessions(projectId)
      .then((list) => {
        list.forEach((s) => projectSessions.current.add(s.sessionId));
        if (projectSessions.current.has(id)) requestRefetch();
        else foreignSessions.current.add(id);
      })
      .catch(() => {})
      .finally(() => classifying.current.delete(id));
  });

  // ================================================================ job render

  useJobEvents((job) => {
    if (job.projectId !== projectId || !isRenderJob(job)) return;
    setJobs((prev) => {
      const i = prev.findIndex((j) => j.id === job.id);
      if (i === -1) return [job, ...prev];
      const next = prev.slice();
      next[i] = job;
      return next;
    });
    // Scene HyperFrames vừa render xong → trình phát có file xem trước mới
    if (job.status === "done" && (job.type === "scene-draft" || job.type === "scene-final")) {
      requestRefetch();
    }
  });

  const activeJobs = useMemo(
    () =>
      jobs
        .filter(isActive)
        .sort((a, b) => (a.status === b.status ? a.createdAt.localeCompare(b.createdAt) : a.status === "running" ? -1 : 1)),
    [jobs],
  );
  const lastOutput = useMemo(
    () =>
      jobs
        .filter((j) => (j.type === "assemble-draft" || j.type === "assemble-final") && j.status === "done" && j.outputPath)
        .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))[0] ?? null,
    [jobs],
  );
  const renderActive = activeJobs.length > 0;
  // Job của lượt render bấm từ editor - để báo lại nếu nó hỏng (hàng đợi chạy
  // nền, không báo thì người dùng chỉ thấy thanh tiến trình biến mất)
  const [renderBatch, setRenderBatch] = useState<string[]>([]);
  const failedJob = useMemo(
    () => jobs.find((j) => renderBatch.includes(j.id) && j.status === "failed") ?? null,
    [jobs, renderBatch],
  );
  // Có sửa gì SAU khi render bắt đầu không - chỉ khi đó mới cần báo
  const [renderBaseline, setRenderBaseline] = useState<number | null>(null);
  useEffect(() => {
    if (renderActive && renderBaseline === null) setRenderBaseline(state.revision);
    if (!renderActive && renderBaseline !== null) setRenderBaseline(null);
  }, [renderActive, renderBaseline, state.revision]);

  // ================================================================ lưu

  const doSave = useCallback(async (): Promise<boolean> => {
    while (saveInFlight.current) await saveInFlight.current;
    const s = stateRef.current;
    const base = versionRef.current;
    if (!s.timeline || !base) return false;
    if (s.timeline === savedTimelineRef.current) return true;
    if (s.problem?.kind === "conflict" || readOnlyRef.current) return false;
    const revision = s.revision;
    const sent = s.timeline;
    const payload = toPatch(sent, savedTimelineRef.current);
    // Lượt ghi đè sau "Giữ bản của tôi" mang nhãn riêng → server không gộp
    // snapshot của nó (= bản của tab khác/AI) vào snapshot tự lưu trước đó
    const label = s.overwrite ? EDITOR_OVERWRITE_LABEL : SAVE_LABEL;
    dispatch({ type: "saveStart", revision });
    const run = (async () => {
      try {
        const res = await saveTimeline(projectId, base, payload, label);
        saveCountRef.current += 1;
        versionRef.current = res.version;
        savedTimelineRef.current = sent;
        dispatch({ type: "saveOk", revision, version: res.version, timeline: sent });
        return true;
      } catch (err) {
        let problem: SaveProblem;
        const conflict = timelineConflictOf(err);
        const message = err instanceof Error ? err.message : String(err);
        if (conflict) {
          problem = { kind: "conflict", current: { version: conflict.version, timeline: normalizeTimeline(conflict.timeline) } };
        } else if (err instanceof ApiError && err.code === "INVALID_TIMELINE") {
          problem = { kind: "invalid", issues: timelineIssuesOf(err), message };
        } else if (err instanceof ApiError && err.code === "AGENT_BUSY") {
          problem = { kind: "locked", message };
          const sessionId = typeof err.data.sessionId === "string" ? err.data.sessionId : null;
          if (sessionId) projectSessions.current.add(sessionId);
          setLock((l) => (l ? { ...l, agentBusy: true, sessionId } : l));
        } else {
          problem = { kind: "error", message };
        }
        dispatch({ type: "saveFailed", revision, problem });
        return false;
      }
    })();
    saveInFlight.current = run;
    try {
      return await run;
    } finally {
      if (saveInFlight.current === run) saveInFlight.current = null;
    }
  }, [projectId]);

  const dirty = isDirty(state);
  const problem = state.problem;
  // Tự lưu: 700ms sau thay đổi cuối. Lượt lỗi thì chờ người dùng sửa tiếp
  // (revision đổi) hoặc bấm thử lại - không dội server bằng cùng một bản sai.
  useEffect(() => {
    if (!state.timeline || !dirty || state.savingRevision !== null || readOnly) return;
    if (problem && (problem.kind === "conflict" || problem.revision === state.revision)) return;
    const timer = window.setTimeout(() => void doSave(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [state.timeline, state.revision, state.savingRevision, dirty, problem, readOnly, doSave]);

  // AI xong mà mình còn bản chưa lưu (bị chặn AGENT_BUSY) → thử lưu lại; xung
  // đột (nếu AI đã sửa) sẽ hiện banner như thường
  useEffect(() => {
    if (!readOnly && problem?.kind === "locked") dispatch({ type: "clearProblem" });
  }, [readOnly, problem]);

  // ---------------------------------------------------------------- rời trình chỉnh sửa
  //
  // Tự lưu chạy 700ms sau lần sửa cuối - rời trang trong khoảng đó (bấm "← Project",
  // menu, link ở thanh bên, đóng tab) thì timer bị hủy cùng component. Nên:
  // - còn LƯU ĐƯỢC (không xung đột/lỗi/chỉ đọc): lưu nốt ngay lúc rời, không hỏi;
  // - KHÔNG lưu được: chặn lại hỏi trước khi bỏ thay đổi.

  /** Thay đổi chưa lưu không lưu được (xung đột / dữ liệu lỗi / lỗi lưu / AI đang khóa). */
  const leaveBlocked = dirty && (readOnly || problem !== null);
  const leaveBlockedRef = useRef(leaveBlocked);
  leaveBlockedRef.current = leaveBlocked;

  /**
   * Lưu nốt lúc rời (đồng bộ, không await - xem saveTimelineOnLeave). Đọc toàn
   * ref nên gọi được từ cleanup/pagehide. `dryRun` = chỉ hỏi "lúc đóng tab có
   * lưu chắc được không" (cho beforeunload).
   */
  const flushOnLeave = useCallback(
    (dryRun = false): "clean" | "sent" | "unsafe" => {
      const s = stateRef.current;
      const base = versionRef.current;
      if (!s.timeline || s.timeline === savedTimelineRef.current) return "clean";
      if (!base || readOnlyRef.current || s.problem !== null) return "unsafe";
      const sent = s.timeline;
      const res = saveTimelineOnLeave(
        projectId,
        base,
        toPatch(sent, savedTimelineRef.current),
        s.overwrite ? EDITOR_OVERWRITE_LABEL : SAVE_LABEL,
        { dryRun },
      );
      if (dryRun) return res.keepalive && !saveInFlight.current ? "sent" : "unsafe";
      // Trang còn sống (chuyển trang trong app, hoặc bfcache đưa trang quay lại):
      // nhận kết quả như một lượt lưu thường để version không lệch
      const done = (res.promise ?? Promise.reject(new Error("no request")))
        .then(async (r) => {
          if (!r.ok) return false;
          const body = (await r.json()) as { version?: string };
          if (typeof body.version !== "string") return false;
          saveCountRef.current += 1;
          versionRef.current = body.version;
          savedTimelineRef.current = sent;
          dispatch({ type: "saveOk", revision: s.revision, version: body.version, timeline: sent });
          return true;
        })
        .catch(() => false);
      saveInFlight.current = done;
      void done.finally(() => {
        if (saveInFlight.current === done) saveInFlight.current = null;
      });
      return "sent";
    },
    [projectId],
  );
  const flushOnLeaveRef = useRef(flushOnLeave);
  flushOnLeaveRef.current = flushOnLeave;

  useEffect(() => {
    // Đóng tab / tải lại / rời sang trang ngoài app: không còn React để chờ - bắn
    // một request keepalive
    const onPageHide = () => void flushOnLeaveRef.current();
    // Chỉ HỎI khi lúc đóng tab không lưu chắc được (lỗi lưu, xung đột, đang có
    // lượt lưu dở, bản quá lớn cho keepalive) - còn lại pagehide tự lưu
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (flushOnLeaveRef.current(true) !== "unsafe") return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Unmount = rời trình chỉnh sửa TRONG app (document vẫn sống). Đang có lượt
      // lưu dở thì đợi nó xong rồi mới lưu phần còn lại - gửi ngay là gửi với
      // version cũ → tự xung đột với chính mình.
      const pending = saveInFlight.current;
      if (pending) void pending.then(() => flushOnLeaveRef.current());
      else flushOnLeaveRef.current();
    };
  }, []);

  /** Đích đang chờ xác nhận "rời trang, bỏ thay đổi" */
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const leaveBypassRef = useRef(false);

  /** Chuyển trang trong app - hỏi trước nếu có thay đổi không lưu được. */
  const navigate = useCallback(
    (href: string) => {
      if (leaveBlockedRef.current && !leaveBypassRef.current) {
        setLeaveTarget(href);
        return;
      }
      router.push(href);
    },
    [router],
  );

  const confirmLeave = useCallback(() => {
    const href = leaveTarget;
    setLeaveTarget(null);
    if (!href) return;
    leaveBypassRef.current = true;
    router.push(href);
  }, [leaveTarget, router]);

  // Link trong app (nút "← Project", thanh bên của shell, link hàng đợi…) là
  // <a> của next/link - chặn ở pha CAPTURE của document, trước khi Link kịp
  // chuyển trang, rồi hỏi bằng modal. Link mở tab mới / tải file / sang trang
  // ngoài app thì để nguyên (trang này không bị rời, hoặc beforeunload lo).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!leaveBlockedRef.current || leaveBypassRef.current) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTarget(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const retrySave = useCallback(() => {
    dispatch({ type: "clearProblem" });
    void doSave();
  }, [doSave]);

  /** Lưu ngay nếu còn thay đổi chưa lưu (trước khi render / trước khi nhờ AI). */
  const flushSave = useCallback(async (): Promise<boolean> => {
    if (!isDirty(stateRef.current) && !saveInFlight.current) return true;
    return doSave();
  }, [doSave]);

  const loadLatest = useCallback(() => {
    const p = stateRef.current.problem;
    if (p?.kind !== "conflict") return;
    versionRef.current = p.current.version;
    savedTimelineRef.current = p.current.timeline;
    dispatch({ type: "loaded", version: p.current.version, timeline: p.current.timeline });
  }, []);

  const keepMine = useCallback(() => {
    const p = stateRef.current.problem;
    if (p?.kind !== "conflict") return;
    versionRef.current = p.current.version;
    // Không bản cục bộ nào còn là "đã lưu" (server đang giữ bản của người kia):
    // lượt lưu kế chắc chắn chạy và gửi đủ 6 khóa (xem store keepMine)
    savedTimelineRef.current = null;
    dispatch({ type: "keepMine" });
  }, []);

  // ================================================================ phát

  const seek = useCallback(
    (frame: number) => {
      const f = Math.max(0, Math.min(totalRef.current - 1, Math.round(frame)));
      playback.setFrame(f);
      playerRef.current?.seekTo(f);
    },
    [playback],
  );

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isPlaying()) {
      p.pause();
      return;
    }
    if (playback.getFrame() >= totalRef.current - 1) seek(0);
    p.play();
  }, [playback, seek]);

  const step = useCallback(
    (delta: number) => {
      playerRef.current?.pause();
      seek(playback.getFrame() + delta);
    },
    [playback, seek],
  );

  // Callback ref: Player chỉ có mặt sau khi đo khung (và biến mất khi timeline lỗi)
  const attachPlayer = useCallback(
    (p: PlayerRef | null) => {
      playerRef.current = p;
      if (!p) return;
      const onFrame = (e: { detail: { frame: number } }) => playback.setFrame(e.detail.frame);
      const onPlay = () => playback.setPlaying(true);
      const onPause = () => playback.setPlaying(false);
      p.addEventListener("frameupdate", onFrame);
      p.addEventListener("seeked", onFrame);
      p.addEventListener("play", onPlay);
      p.addEventListener("pause", onPause);
      p.addEventListener("ended", onPause);
      const keep = playback.getFrame();
      if (keep > 0) p.seekTo(Math.min(keep, totalRef.current - 1));
      return () => {
        p.removeEventListener("frameupdate", onFrame);
        p.removeEventListener("seeked", onFrame);
        p.removeEventListener("play", onPlay);
        p.removeEventListener("pause", onPause);
        p.removeEventListener("ended", onPause);
        playback.setPlaying(false);
        if (playerRef.current === p) playerRef.current = null;
      };
    },
    [playback],
  );

  // Timeline ngắn lại (xóa/trim) mà playhead nằm quá cuối → kéo về
  useEffect(() => {
    if (playback.getFrame() > totalFrames - 1) seek(totalFrames - 1);
  }, [totalFrames, playback, seek]);

  // ================================================================ sửa

  const edit = useCallback((apply: (tl: Timeline) => Timeline, options?: EditOptions) => {
    if (readOnlyRef.current) return;
    // Track đã khóa: chạy thử thao tác trên timeline hiện tại, đụng track khóa nào
    // là bỏ CẢ thao tác (ops thuần nên chạy thử không có tác dụng phụ)
    const cur = stateRef.current.timeline;
    if (cur && locksRef.current.size > 0) {
      const hit = lockedChange(cur, apply(cur), locksRef.current);
      if (hit) {
        lockBlockedRef.current(hit);
        return;
      }
    }
    dispatch({
      type: "edit",
      apply,
      coalesce: options?.coalesce ? { key: options.coalesce, windowMs: options.windowMs ?? null } : undefined,
      selection: options?.selection,
      now: Date.now(),
    });
  }, []);

  const select = useCallback((selection: Selection | null) => dispatch({ type: "select", selection }), []);
  const endCoalesce = useCallback(() => dispatch({ type: "endCoalesce" }), []);

  const flashNotice = useCallback((message: string) => setNotice(message), []);
  const lockBlockedRef = useRef<(track: LockableTrack) => void>(() => {});
  lockBlockedRef.current = (track) => flashNotice(tf("editor.lock.blocked", { track: t(TRACK_LABEL_KEY[track]) }));
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const splitAction = useCallback(() => {
    const s = stateRef.current;
    if (!s.timeline || readOnlyRef.current) return;
    const result = splitAtPlayhead(
      s.timeline,
      s.selection,
      playback.getFrame(),
      computeSceneSpans(s.timeline.scenes, fps),
      opsCtx,
    );
    if (!result) {
      flashNotice(t("editor.notice.cannot-split"));
      return;
    }
    edit(() => result.timeline, { selection: result.selection });
  }, [edit, fps, opsCtx, playback, flashNotice, t]);

  const duplicateAction = useCallback(() => {
    const s = stateRef.current;
    if (!s.timeline || !canDuplicate(s.timeline, s.selection)) return;
    const result = duplicateSelection(s.timeline, s.selection, fps);
    edit(() => result.timeline, { selection: result.selection });
  }, [edit, fps]);

  const deleteAction = useCallback(() => {
    const s = stateRef.current;
    if (!s.timeline || !s.selection) return;
    if (!canDelete(s.timeline, s.selection)) {
      flashNotice(
        s.selection.kind === "scene" ? t("editor.notice.last-scene") : t("editor.notice.cannot-delete"),
      );
      return;
    }
    const sel = s.selection;
    edit((tl) => deleteSelection(tl, sel), { selection: null });
  }, [edit, flashNotice, t]);

  /** Hoàn tác / làm lại cũng không được đổi track đã khóa (chúng không đi qua edit()) */
  const historyHitsLock = (target: Timeline | undefined): boolean => {
    const cur = stateRef.current.timeline;
    if (!cur || !target || locksRef.current.size === 0) return false;
    const hit = lockedChange(cur, target, locksRef.current);
    if (hit) lockBlockedRef.current(hit);
    return hit !== null;
  };
  const undo = useCallback(() => {
    if (readOnlyRef.current) return;
    const past = stateRef.current.past;
    if (historyHitsLock(past[past.length - 1]?.timeline)) return;
    dispatch({ type: "undo" });
  }, []);
  const redo = useCallback(() => {
    if (readOnlyRef.current) return;
    if (historyHitsLock(stateRef.current.future[0]?.timeline)) return;
    dispatch({ type: "redo" });
  }, []);

  // ================================================================ thêm tại playhead

  /** Menu "+" của track Layer: layer chữ / khối màu tại playhead (3 giây, không thò ra sau video). */
  const addLayerAtPlayhead = useCallback(
    (kind: AddLayerKind) => {
      const s = stateRef.current;
      if (!s.timeline || readOnlyRef.current) return;
      const place = newLayerPlacement(playback.getFrame(), totalRef.current, fps);
      const id = newLayerId(layersOf(s.timeline), kind === "text" ? "text" : "shape");
      const vertical = (info?.project.height ?? 0) > (info?.project.width ?? 0);
      const layer =
        kind === "text"
          ? newTextLayer(id, t("editor.layers.new-text"), place.from, place.durationInFrames, { vertical })
          : newShapeLayer(id, place.from, place.durationInFrames);
      edit((tl) => addLayer(tl, layer), { selection: { kind: "layer", id } });
    },
    [edit, fps, info, playback, t],
  );

  const addCueAtPlayhead = useCallback(
    (kind: AddCueKind) => {
      const s = stateRef.current;
      if (!s.timeline || readOnlyRef.current) return;
      const frame = playback.getFrame();
      const cue: NewCue =
        kind === "overlay"
          ? { kind, text: t("editor.add.highlight-text") }
          : kind === "subtitle"
            ? { kind, text: t("editor.add.subtitle-text") }
            : { kind, word: t("editor.caption.new-word") };
      // Không bao giờ đặt cue ra sau hết video (playhead ở End → lùi về 2s trước cuối)
      const place = newCuePlacement(frame, totalRef.current, fps);
      const result = addCue(s.timeline, cue, place.from, place.durationInFrames);
      if (result.timeline === s.timeline) return;
      edit(() => result.timeline, { selection: result.selection });
    },
    [edit, fps, playback, t],
  );

  // ================================================================ thư viện

  // Lựa chọn của người dùng (nhớ theo trình duyệt) + màn hẹp. Dưới
  // LIBRARY_AUTO_COLLAPSE_PX (1280px có panel chat mở), cột thư viện ăn mất
  // chỗ của trình phát → tự gấp, như thanh bên của shell trên route này: lần
  // gấp tự động KHÔNG ghi vào localStorage, người dùng mở lại trong lúc màn hẹp
  // thì chỉ có hiệu lực trong phiên (không đè lựa chọn cho màn rộng).
  const [libraryPref, setLibraryPref] = useState<boolean>(false);
  const [narrow, setNarrow] = useState(false);
  const [narrowOverride, setNarrowOverride] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(LIBRARY_KEY) === "collapsed") setLibraryPref(true);
    } catch {
      // localStorage bị chặn - cột mở như mặc định
    }
    const mq = window.matchMedia(`(max-width: ${LIBRARY_AUTO_COLLAPSE_PX - 1}px)`);
    const update = () => {
      setNarrow(mq.matches);
      setNarrowOverride(null);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setLibraryCollapsed(narrow ? (narrowOverride ?? true) : libraryPref);
  }, [narrow, narrowOverride, libraryPref]);

  const toggleLibrary = useCallback(
    (collapsed: boolean) => {
      if (narrow) {
        setNarrowOverride(collapsed);
        return;
      }
      setLibraryPref(collapsed);
      try {
        window.localStorage.setItem(LIBRARY_KEY, collapsed ? "collapsed" : "open");
      } catch {
        // không nhớ được - vẫn gấp/mở cho phiên này
      }
    },
    [narrow],
  );

  /** Ghi thông số file vừa thêm vào `preview.media` - trim/khối sfx biết độ dài ngay, không chờ tải lại. */
  const rememberMedia = useCallback((rel: string, media: TimelineMediaInfo) => {
    setInfo((prev) => {
      if (!prev) return prev;
      const versions = prev.preview.mediaVersions;
      // File vừa chép/đo xong chắc chắn CÓ trên đĩa: ghi luôn vào mediaVersions
      // (0 = chưa biết mtime, lần tải lại kế sẽ có số thật) - không thì khối mới
      // thêm bị đánh dấu "file không tồn tại" cho tới lần tải lại
      const needVersion = !!versions && !Object.prototype.hasOwnProperty.call(versions, rel);
      if (prev.preview.media[rel] && !needVersion) return prev;
      return {
        ...prev,
        preview: {
          ...prev.preview,
          media: prev.preview.media[rel] ? prev.preview.media : { ...prev.preview.media, [rel]: media },
          mediaVersions: needVersion ? { ...versions, [rel]: 0 } : versions,
        },
      };
    });
    // Lấy mtime thật + thông số đầy đủ từ server
    requestRefetch();
  }, [requestRefetch]);

  const measure = useCallback(
    async (rel: string): Promise<number | null> => {
      const known = info?.preview.media[rel]?.durationSec;
      if (typeof known === "number") return known;
      try {
        const media = await getMediaInfo(projectId, rel);
        rememberMedia(rel, media);
        return media.durationSec;
      } catch {
        return null;
      }
    },
    [info, projectId, rememberMedia],
  );

  /** Chép một file thư viện chung vào project (Remotion chỉ stage file trong project). */
  const importFromLibrary = useCallback(
    async (kind: "sfx" | "music", file: string): Promise<string> => {
      const res = await importLibraryFile(projectId, kind, file);
      rememberMedia(res.relPath, { durationSec: res.durationSec });
      setAssetsTick((n) => n + 1);
      return res.relPath;
    },
    [projectId, rememberMedia],
  );

  /**
   * Thêm một món thư viện vào timeline - từ thả chuột (`target` là chỗ thả) hoặc
   * nút "+" (không có target: tại playhead, track mặc định của món đó).
   * `confirmed` = người dùng đã đồng ý thay nhạc nền đang có.
   */
  const addLibraryItem = useCallback(
    async (item: LibraryItem, target?: DropTarget, confirmed = false) => {
      const s = stateRef.current;
      if (!s.timeline || readOnlyRef.current || libraryBusyRef.current) return;
      const track = target?.track ?? dropTracksOf(item)[0];
      const frame = target?.frame ?? playback.getFrame();
      const sceneIndex =
        target?.sceneIndex ?? sceneInsertIndexAt(computeSceneSpans(s.timeline.scenes, fps), frame);

      // Thay nhạc nền đang có: hỏi trước (trước cả khi chép file vào project)
      const musicFile = item.source === "project" ? item.relPath : item.source === "music" ? item.file : null;
      if (track === "music" && !confirmed && s.timeline.audio.music && musicFile) {
        const cur = s.timeline.audio.music.file;
        const same = item.source === "project" ? cur === item.relPath : cur.split("/").pop() === item.file;
        if (!same) {
          pendingTargetRef.current = target ?? null;
          setPendingMusic(item);
          return;
        }
      }

      const key = libraryItemKey(item);
      setLibraryError(null);
      setLibraryBusy({ key, name: item.name, importing: item.source !== "project" });
      libraryBusyRef.current = true;
      try {
        if (track === "layer" && item.source === "project" && item.kind !== "audio") {
          const rel = item.relPath;
          const kind = item.kind;
          // Đo cả ảnh: kích thước file (tỉ lệ hộp layer) vào preview.media
          const measured = await measure(rel);
          const sec = kind === "video" ? measured : null;
          const latest = stateRef.current.timeline;
          if (!latest || readOnlyRef.current) return;
          const place = newLayerPlacement(
            frame,
            totalRef.current,
            fps,
            kind === "video" ? (sec ?? NEW_LAYER_VIDEO_FALLBACK_SEC) : NEW_LAYER_SEC,
          );
          const id = layerIdFromFile(layersOf(latest), rel);
          const layer = newMediaLayer(id, kind, rel, place.from, place.durationInFrames);
          edit((tl) => addLayer(tl, layer), { selection: { kind: "layer", id } });
          return;
        }
        if (track === "scene" && item.source === "project" && item.kind !== "audio") {
          const rel = item.relPath;
          // Đo cả ảnh: measure → rememberMedia ghi file vào preview.mediaVersions,
          // không thì bản xem trước coi ảnh mới là "thiếu file" tới lần tải lại kế
          const measured = await measure(rel);
          const scene =
            item.kind === "video" ? newFootageScene("", rel, measured, fps) : newImageScene("", rel, fps);
          const latest = stateRef.current.timeline;
          if (!latest || readOnlyRef.current) return;
          const id = sceneIdFromFile(latest.scenes, rel);
          edit((tl) => addScene(tl, sceneIndex, { ...scene, id }), { selection: { kind: "scene", id } });
          return;
        }
        if (track === "sfx" && (item.source === "sfx" || (item.source === "project" && item.kind === "audio"))) {
          let rel: string;
          if (item.source === "project") {
            rel = item.relPath;
            await measure(rel);
          } else {
            rel = await importFromLibrary("sfx", item.file);
          }
          const latest = stateRef.current.timeline;
          if (!latest || readOnlyRef.current) return;
          const result = addSfx(latest, rel, frame);
          edit(() => result.timeline, { selection: result.selection });
          return;
        }
        if (track === "music" && musicFile) {
          const rel = item.source === "music" ? await importFromLibrary("music", item.file) : musicFile;
          if (readOnlyRef.current) return;
          edit((tl) => setMusic(tl, rel), { selection: { kind: "music" } });
        }
      } catch (err) {
        setLibraryError({
          message: tf("editor.library.add-error", { name: item.name }),
          detail: err instanceof Error ? err.message : String(err),
        });
      } finally {
        libraryBusyRef.current = false;
        setLibraryBusy(null);
      }
    },
    [edit, fps, importFromLibrary, measure, playback, tf],
  );

  // ================================================================ tải file lên (thả từ máy / nút "Tải lên")

  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const uploadQueue = useRef<UploadJob[]>([]);
  const uploadRunning = useRef(false);
  /** Dòng đang tải - event SSE `upload` của project (server nhận file) đổ tiến độ vào đây */
  const activeUploadRow = useRef<number | null>(null);
  const uploadSeq = useRef(0);
  /** Đang kéo file từ máy qua trình chỉnh sửa: "true" nhận được / "reject" chỉ đọc */
  const [fileDrag, setFileDrag] = useState<"true" | "reject" | null>(null);

  const patchUpload = useCallback((id: number, patch: Partial<UploadRow>) => {
    setUploads((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  // Tải tuần tự nên tại mỗi lúc chỉ có MỘT request của trang này đang gửi: mọi
  // event tiến độ của project trong lúc đó là của nó (tải từ điện thoại cùng lúc
  // thì có thể lẫn - chỉ là thanh tiến độ, file nào vẫn đúng file đó)
  useUploadEvents((e) => {
    const row = activeUploadRow.current;
    if (row === null || e.projectId !== projectId || e.done) return;
    patchUpload(row, { received: e.received ?? 0, total: e.total ?? 0 });
  });

  /** Chèn file vừa tải lên vào đúng track của lượt thả (null = chỉ vào thư viện). */
  const insertUploaded = useCallback(
    async (rel: string, kind: "video" | "image" | "audio" | "other", target: UploadJob["target"]) => {
      if (!target || kind === "other") return;
      const track = target.drop.track;
      const latest = () => (readOnlyRef.current ? null : stateRef.current.timeline);
      if (kind === "audio") {
        // Âm thanh thả lên Video/Layer/SFX đều thành hiệu ứng âm tại chỗ thả
        await measure(rel);
        const tl = latest();
        if (!tl) return;
        const result = addSfx(tl, rel, target.drop.frame);
        edit(() => result.timeline, { selection: result.selection });
        return;
      }
      if (track === "scene") {
        // Đo cả ảnh (như track Layer): file vừa tải lên phải vào preview.mediaVersions ngay
        const measured = await measure(rel);
        const scene = kind === "video" ? newFootageScene("", rel, measured, fps) : newImageScene("", rel, fps);
        const tl = latest();
        if (!tl) return;
        const id = sceneIdFromFile(tl.scenes, rel);
        const at = target.nextSceneIndex;
        target.nextSceneIndex += 1;
        edit((cur) => addScene(cur, at, { ...scene, id }), { selection: { kind: "scene", id } });
        return;
      }
      if (track === "layer") {
        const sec = await measure(rel);
        const tl = latest();
        if (!tl) return;
        const place = newLayerPlacement(
          target.nextFrame,
          totalRef.current,
          fps,
          kind === "video" ? (sec ?? NEW_LAYER_VIDEO_FALLBACK_SEC) : NEW_LAYER_SEC,
        );
        // Nhiều file một lượt thả: nối tiếp nhau trên track Layer
        target.nextFrame = place.from + place.durationInFrames;
        const id = layerIdFromFile(layersOf(tl), rel);
        const layer = newMediaLayer(id, kind, rel, place.from, place.durationInFrames);
        edit((cur) => addLayer(cur, layer), { selection: { kind: "layer", id } });
      }
      // Video/ảnh thả lên track SFX: chỉ vào thư viện (không có nghĩa trên track âm thanh)
    },
    [edit, fps, measure],
  );

  const runUploads = useCallback(async () => {
    if (uploadRunning.current) return;
    uploadRunning.current = true;
    try {
      for (let job = uploadQueue.current.shift(); job; job = uploadQueue.current.shift()) {
        activeUploadRow.current = job.row;
        patchUpload(job.row, { status: "uploading" });
        try {
          const saved = await uploadAsset(job.file, "project", projectId);
          activeUploadRow.current = null;
          patchUpload(job.row, { status: "done" });
          setAssetsTick((n) => n + 1);
          const rel = projectRelPath(saved.relPath, projectId);
          const kind = saved.kind !== "other" ? saved.kind : fileKindOf(job.file);
          await insertUploaded(rel, kind, job.target);
        } catch (err) {
          activeUploadRow.current = null;
          patchUpload(job.row, { status: "error", error: err instanceof Error ? err.message : String(err) });
        }
      }
    } finally {
      activeUploadRow.current = null;
      uploadRunning.current = false;
    }
  }, [insertUploaded, patchUpload, projectId]);

  /**
   * Tải các file vào assets của project, TUẦN TỰ (một file lớn không tranh băng
   * thông với file sau, tiến độ đọc được). `target` = chỗ thả trên timeline;
   * null = chỉ vào thư viện. Đang chỉ đọc (AI sửa) thì vẫn tải vào thư viện
   * nhưng không chèn gì vào timeline.
   */
  const uploadFiles = useCallback(
    (files: File[], target: DropTarget | null) => {
      if (files.length === 0) return;
      const shared =
        target && !readOnlyRef.current
          ? { drop: target, nextSceneIndex: target.sceneIndex, nextFrame: target.frame }
          : null;
      if (target && readOnlyRef.current) flashNotice(t("editor.drop.readonly"));
      const rows: UploadRow[] = files.map((f) => {
        uploadSeq.current += 1;
        return { id: uploadSeq.current, name: f.name, status: "queued", received: 0, total: f.size };
      });
      setUploads((cur) => [...cur.filter((r) => r.status !== "done"), ...rows]);
      files.forEach((file, i) => uploadQueue.current.push({ row: rows[i].id, file, target: shared }));
      void runUploads();
    },
    [flashNotice, runUploads, t],
  );

  // Dòng xong tự ẩn sau 4s; dòng lỗi ở lại tới khi người dùng đóng
  useEffect(() => {
    if (!uploads.some((r) => r.status === "done") || uploads.some((r) => r.status === "uploading" || r.status === "queued")) return;
    const timer = window.setTimeout(() => setUploads((cur) => cur.filter((r) => r.status !== "done")), 4000);
    return () => window.clearTimeout(timer);
  }, [uploads]);

  const uploadingNow = uploads.some((r) => r.status === "uploading" || r.status === "queued");

  // ================================================================ sao chép / dán

  const copyAction = useCallback((): boolean => {
    const s = stateRef.current;
    if (!s.timeline || !s.selection) return false;
    const clip = copySelection(s.timeline, s.selection);
    if (!clip) {
      flashNotice(t("editor.clipboard.cannot-copy"));
      return true;
    }
    clipboardRef.current = clip;
    flashNotice(t("editor.clipboard.copied"));
    return true;
  }, [flashNotice, t]);

  const pasteAction = useCallback((): boolean => {
    const s = stateRef.current;
    const clip = clipboardRef.current;
    if (!s.timeline || !clip || readOnlyRef.current) return false;
    const result = pasteClipboard(s.timeline, clip, playback.getFrame(), computeSceneSpans(s.timeline.scenes, fps));
    if (!result) return true;
    edit(() => result.timeline, { selection: result.selection });
    return true;
  }, [edit, fps, playback]);

  /** Ctrl+] / Ctrl+[: đưa layer đang chọn lên / xuống một lớp. */
  const layerZAction = useCallback(
    (delta: 1 | -1) => {
      const sel = stateRef.current.selection;
      if (sel?.kind !== "layer" || readOnlyRef.current) return;
      const tl = stateRef.current.timeline;
      if (!tl) return;
      const next = moveLayerZ(tl, sel.id, delta);
      if (next === tl) {
        flashNotice(delta > 0 ? t("editor.layers.already-top") : t("editor.layers.already-bottom"));
        return;
      }
      const id = sel.id;
      edit((cur) => moveLayerZ(cur, id, delta));
    },
    [edit, flashNotice, t],
  );

  // ================================================================ ảnh AI (tab "AI" của thư viện)

  /**
   * Ảnh AI đã nằm trong project: "cảnh trám" = scene ảnh 3s + punch-in nhẹ chèn
   * tại playhead (cùng luật chèn với thả từ thư viện), "layer" = layer ảnh tại
   * playhead. AI đang sửa project thì ảnh chỉ vào thư viện.
   */
  const onAiImageReady = useCallback(
    async ({ relPath, purpose, frame: at }: { relPath: string; purpose: AiImagePurpose; frame?: number }) => {
      setAssetsTick((n) => n + 1);
      // Đo kích thước ảnh (tỉ lệ hộp layer, khung chọn trên preview)
      await measure(relPath);
      const s = stateRef.current;
      if (!s.timeline) return;
      if (readOnlyRef.current) {
        flashNotice(t("editor.drop.readonly"));
        return;
      }
      // Lượt neo theo mốc timeline vào đúng mốc đó; tab AI của thư viện thì playhead
      const frame = at ?? playback.getFrame();
      if (purpose === "filler") {
        const id = sceneIdFromFile(s.timeline.scenes, relPath);
        const scene = newFillerScene(id, relPath, fps);
        if (at !== undefined) {
          // Neo theo mốc: tách scene tại đúng mốc rồi chèn (cue phía sau lùi theo)
          const locked = locksRef.current;
          edit((tl) => insertSceneAtFrame(tl, scene, at, computeSceneSpans(tl.scenes, fps), opsCtx, locked), {
            selection: { kind: "scene", id },
          });
          return;
        }
        const idx = sceneInsertIndexAt(computeSceneSpans(s.timeline.scenes, fps), frame);
        edit((tl) => addScene(tl, idx, scene), { selection: { kind: "scene", id } });
        return;
      }
      const place = newLayerPlacement(frame, totalRef.current, fps);
      const id = layerIdFromFile(layersOf(s.timeline), relPath);
      const layer = newMediaLayer(id, "image", relPath, place.from, place.durationInFrames);
      edit((tl) => addLayer(tl, layer), { selection: { kind: "layer", id } });
    },
    [edit, flashNotice, fps, measure, opsCtx, playback, t],
  );

  // ================================================================ AI tại một mốc trên timeline

  /** Chữ AI viết xong: layer chữ 3 giây tại mốc đã chọn (một bước hoàn tác). */
  const onAiTextReady = useCallback(
    (job: TimelineAiJob, text: string) => {
      const s = stateRef.current;
      if (!s.timeline) return;
      if (readOnlyRef.current) {
        flashNotice(tf("editor.tlai.text-readonly", { text }));
        return;
      }
      const place = newLayerPlacement(job.frame, totalRef.current, fps);
      const id = newLayerId(layersOf(s.timeline), "text");
      const vertical = (info?.project.height ?? 0) > (info?.project.width ?? 0);
      const layer = newTextLayer(id, text, place.from, place.durationInFrames, { vertical });
      edit((tl) => addLayer(tl, layer), { selection: { kind: "layer", id } });
    },
    [edit, flashNotice, fps, info, tf],
  );

  const aiJobs = useTimelineAiJobs({
    projectId,
    onImageReady: (job, relPath) =>
      void onAiImageReady({ relPath, purpose: job.mode === "filler" ? "filler" : "layer", frame: job.frame }),
    onTextReady: onAiTextReady,
  });
  const aiChatSeq = useRef(0);

  const onAiSubmit = useCallback(
    (mode: TimelineAiMode, prompt: string) => {
      const anchor = aiAnchor;
      const tl = stateRef.current.timeline;
      setAiAnchor(null);
      if (!anchor || !tl) return;
      const frame = anchor.frame;
      if (mode === "chat") {
        // Mốc ghi cả giây lẫn frame tuyệt đối - agent đọc meta.json theo frame
        aiChatSeq.current += 1;
        setChatQueued({
          id: aiChatSeq.current,
          text: tf("editor.tlai.chat-message", {
            time: formatSeconds(frame, fps),
            frame,
            fps,
            prompt,
          }),
        });
        return;
      }
      void aiJobs.start(mode, prompt, frame, { atSec: frame / fps, context: spokenContextAt(tl, frame, fps) });
    },
    [aiAnchor, aiJobs, fps, tf],
  );

  const closeAiPopover = useCallback(() => setAiAnchor(null), []);
  /** Ảnh / chữ vào track Layer, cảnh trám vào track Video - track khóa thì tắt chế độ đó */
  const aiLockedModes = useMemo(() => {
    const out = new Set<TimelineAiMode>();
    if (locks.has("layer")) {
      out.add("layer");
      out.add("text");
    }
    if (locks.has("scene")) out.add("filler");
    return out;
  }, [locks]);

  /** Phím G: mở ô AI tại mốc dưới con trỏ (đang rê trên timeline), không thì tại playhead. */
  const openAiAtHover = useCallback(() => {
    const hover = aiHoverRef.current;
    if (hover) {
      setAiAnchor(hover);
      return;
    }
    const box = document.querySelector(".editor-root .tl")?.getBoundingClientRect();
    setAiAnchor({
      frame: Math.min(playback.getFrame(), Math.max(0, totalRef.current - 1)),
      clientX: box ? box.left + box.width / 2 - 170 : window.innerWidth / 2,
      clientY: box ? box.top : window.innerHeight / 2,
    });
  }, [playback]);

  // ================================================================ thao tác trên khung xem trước

  /**
   * Một lượt kéo trên khung xem trước = MỘT bước hoàn tác: mọi "preview" của
   * lượt đó gộp chung một key (windowMs null - gộp suốt lượt), "commit" ghi bản
   * cuối rồi đóng bước. Lượt kế tiếp nhận key mới.
   */
  const canvasGesture = useRef<string | null>(null);
  const canvasSeq = useRef(0);
  const onCanvasTransform = useCallback(
    (target: CanvasTarget, transform: Record<string, unknown>, phase: "preview" | "commit") => {
      if (readOnlyRef.current) {
        canvasGesture.current = null;
        return;
      }
      if (!canvasGesture.current) {
        canvasSeq.current += 1;
        canvasGesture.current = `canvas:${canvasSeq.current}`;
      }
      const key = canvasGesture.current;
      const frame = playback.getFrame();
      let fn: (tl: Timeline) => Timeline;
      if (target.kind === "scene") {
        const id = target.id;
        fn = (tl) => patchScene(tl, id, { transform: transform as TimelineScene["transform"] });
      } else if (target.kind === "layer") {
        const id = target.id;
        fn = (tl) => applyLayerCanvasTransform(tl, id, transform, frame);
      } else {
        const kind = CUE_KIND[target.kind];
        const index = target.index;
        fn = (tl) => setCueTransform(tl, kind, index, transform);
      }
      edit(fn, { coalesce: key, windowMs: null });
      if (phase === "commit") {
        canvasGesture.current = null;
        endCoalesce();
      }
    },
    [edit, endCoalesce, playback],
  );

  /** Nhấp đúp trên khung: chọn mục rồi đưa con trỏ vào ô sửa chữ (inspector dựng form ở lượt render sau) */
  const onCanvasEditText = useCallback(
    (sel: Selection) => {
      if (readOnlyRef.current) return;
      select(sel);
      const id = primaryTextFieldId(sel);
      if (!id) return;
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.focus();
          el.select();
        }
      });
    },
    [select],
  );

  const mediaAspect = useCallback(
    (rel: string): number | undefined => {
      const m = info?.preview.media[rel];
      return m && typeof m.width === "number" && typeof m.height === "number" && m.width > 0 && m.height > 0
        ? m.width / m.height
        : undefined;
    },
    [info],
  );

  const confirmMusic = useCallback(() => {
    const item = pendingMusic;
    const target = pendingTargetRef.current;
    setPendingMusic(null);
    pendingTargetRef.current = null;
    if (item) void addLibraryItem(item, target ?? undefined, true);
  }, [pendingMusic, addLibraryItem]);

  // ================================================================ lịch sử phiên bản

  const restoreRevision = useCallback(
    async (rev: TimelineRevision): Promise<RestoreOutcome> => {
      if (readOnlyRef.current) {
        return { ok: false, message: t("editor.history.readonly"), reload: false };
      }
      // Thay đổi chưa lưu phải lên server trước: server chụp bản hiện tại vào
      // lịch sử rồi mới ghi đè, nên chúng vẫn khôi phục lại được
      if (!(await flushSave())) {
        return { ok: false, message: t("editor.history.save-first"), reload: false };
      }
      const base = versionRef.current;
      if (!base) return { ok: false, message: t("editor.history.error"), reload: true };
      try {
        const res = await restoreTimelineRevision(projectId, rev.rev, base);
        // Như loadLatest: version ref TRƯỚC rồi mới nạp; saveCount đổi để lượt
        // tải đang bay về (có thể là bản cũ hơn) tự bỏ kết quả và tải lại
        saveCountRef.current += 1;
        versionRef.current = res.version;
        const restored = normalizeTimeline(res.timeline);
        savedTimelineRef.current = restored;
        dispatch({ type: "loaded", version: res.version, timeline: restored });
        // Bản khôi phục có thể tham chiếu file khác - lấy lại thông số xem trước
        requestRefetch();
        setNotice(tf("editor.history.restored", { time: formatDateTime(rev.createdAt) }));
        return { ok: true };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        if (timelineConflictOf(err)) {
          // AI/tab khác vừa ghi: nạp bản mới vào editor rồi để người dùng chọn lại
          void loadRef.current();
          return { ok: false, message: t("editor.history.conflict"), detail, reload: true };
        }
        if (err instanceof ApiError && err.code === "AGENT_BUSY") {
          const sessionId = typeof err.data.sessionId === "string" ? err.data.sessionId : null;
          if (sessionId) projectSessions.current.add(sessionId);
          setLock((l) => (l ? { ...l, agentBusy: true, sessionId } : l));
          return { ok: false, message: t("editor.history.agent-busy"), detail, reload: false };
        }
        if (err instanceof ApiError && err.status === 404) {
          return { ok: false, message: t("editor.history.gone"), detail, reload: true };
        }
        return { ok: false, message: t("editor.history.error"), detail, reload: false };
      }
    },
    [flushSave, projectId, requestRefetch, t, tf],
  );

  // ================================================================ xuất XML

  const exportXml = useCallback(async () => {
    setExportProblem(null);
    // XML dựng từ meta.json trên server - thay đổi chưa lưu phải lên trước
    if (!(await flushSave())) {
      setExportProblem({ message: t("editor.export.save-first") });
      return;
    }
    try {
      const res = await fetch(timelineExportUrl(projectId), { credentials: "same-origin" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 500)}` : ""}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectId}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNotice(t("editor.export.done"));
    } catch (err) {
      setExportProblem({
        message: t("editor.export.error"),
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }, [flushSave, projectId, t]);

  // ================================================================ phím tắt

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return;
      // Modal đang mở: phím thuộc về modal (Esc đóng modal, không bỏ chọn)
      if (document.querySelector('[role="dialog"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;
      const onButton =
        e.target instanceof HTMLElement &&
        (e.target.tagName === "BUTTON" || e.target.tagName === "A") &&
        !e.target.hasAttribute("data-block");
      const arrow = key === "ArrowLeft" || key === "ArrowRight";

      // Đang kéo khối trên timeline: phím SỬA bị nuốt - chúng đổi timeline giữa
      // lượt kéo (xem TimelinePanel: lượt kéo dừng khi timeline đổi từ nơi khác)
      const bracket = mod && (e.code === "BracketRight" || e.code === "BracketLeft" || key === "]" || key === "[");
      const editingKey =
        ((key === "s" || key === "S") && !mod && !e.altKey) ||
        ((key === "Delete" || key === "Backspace") && !mod) ||
        (mod && ["d", "D", "z", "Z", "y", "Y", "v", "V"].includes(key)) ||
        bracket ||
        (arrow && e.altKey && !mod);
      if (editingKey && dragActive.current) {
        e.preventDefault();
        return;
      }

      if (arrow && e.altKey && !mod && !e.shiftKey) {
        // Alt+←/→: dời scene đang chọn sớm/muộn một vị trí - bàn phím thay cho
        // kéo-thả đổi thứ tự. Không chọn scene thì để trình duyệt làm việc của
        // nó (Alt+← = quay lại trang trước)
        const sel = stateRef.current.selection;
        if (sel?.kind !== "scene" || readOnlyRef.current) return;
        e.preventDefault();
        const id = sel.id;
        edit((tl) => moveSceneBy(tl, id, key === "ArrowLeft" ? -1 : 1));
      } else if (key === " " && !mod) {
        if (onButton) return; // Space trên nút = bấm nút đó (bàn phím/a11y)
        e.preventDefault();
        togglePlay();
      } else if ((key === "ArrowLeft" || key === "ArrowRight") && !mod && !e.altKey) {
        e.preventDefault();
        const unit = e.shiftKey ? Math.round(fps) : 1;
        step(key === "ArrowLeft" ? -unit : unit);
      } else if (key === "Home" && !mod) {
        e.preventDefault();
        seek(0);
      } else if (key === "End" && !mod) {
        e.preventDefault();
        seek(totalRef.current - 1);
      } else if ((key === "s" || key === "S") && !mod && !e.altKey) {
        e.preventDefault();
        splitAction();
      } else if ((key === "Delete" || key === "Backspace") && !mod) {
        if (!stateRef.current.selection) return;
        e.preventDefault();
        deleteAction();
      } else if (mod && (key === "d" || key === "D")) {
        e.preventDefault();
        duplicateAction();
      } else if (mod && !e.shiftKey && !e.altKey && (key === "c" || key === "C")) {
        // Đang bôi đen chữ trên trang thì để trình duyệt chép chữ như thường
        const textSel = window.getSelection();
        if (textSel && !textSel.isCollapsed && textSel.toString().trim()) return;
        if (copyAction()) e.preventDefault();
      } else if (mod && !e.shiftKey && !e.altKey && (key === "v" || key === "V")) {
        if (pasteAction()) e.preventDefault();
      } else if (bracket) {
        if (stateRef.current.selection?.kind !== "layer") return;
        e.preventDefault();
        layerZAction(e.code === "BracketRight" || key === "]" ? 1 : -1);
      } else if (mod && (key === "z" || key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && (key === "y" || key === "Y")) {
        e.preventDefault();
        redo();
      } else if (key === "Escape") {
        if (stateRef.current.selection) dispatch({ type: "select", selection: null });
      } else if (key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if ((key === "g" || key === "G") && !mod && !e.altKey) {
        e.preventDefault();
        openAiAtHover();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    fps,
    togglePlay,
    step,
    seek,
    splitAction,
    deleteAction,
    duplicateAction,
    copyAction,
    pasteAction,
    layerZAction,
    undo,
    redo,
    edit,
    dragActive,
    openAiAtHover,
  ]);

  // ================================================================ thả file từ máy

  // Thả trong trình chỉnh sửa do handler của `.editor-root` (và TimelinePanel cho
  // track Video/Layer/SFX) lo. Ở đây chỉ là LƯỚI AN TOÀN cho phần còn lại của
  // trang (thanh bên của shell, panel AI…): file thả ra ngoài editor mà không ai
  // nhận thì trình duyệt sẽ MỞ file thay trang - mất trình chỉnh sửa và mọi thay
  // đổi chưa lưu. Handler React chạy trước (gắn ở root của app) nên
  // `defaultPrevented` = đã có nơi nhận.
  useEffect(() => {
    const hasFiles = (e: DragEvent): boolean => !!e.dataTransfer && isFileDrag(Array.from(e.dataTransfer.types));
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    const onDrop = (e: DragEvent) => {
      if (hasFiles(e) && !e.defaultPrevented) e.preventDefault();
      setFileDrag(null);
    };
    const onDragEnd = () => setFileDrag(null);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, []);

  const onRootDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!isFileDrag([...e.dataTransfer.types])) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = readOnly ? "none" : "copy";
    const next = readOnly ? "reject" : "true";
    if (fileDrag !== next) setFileDrag(next);
  };
  const onRootDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    const to = e.relatedTarget;
    if (to instanceof Node && e.currentTarget.contains(to)) return;
    setFileDrag(null);
  };
  const onRootDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!isFileDrag([...e.dataTransfer.types])) return;
    e.preventDefault();
    setFileDrag(null);
    if (readOnly) {
      flashNotice(t("editor.drop.readonly-blocked"));
      return;
    }
    // Ngoài track Video/Layer/SFX (TimelinePanel đã chặn lan khi thả lên đó): chỉ vào thư viện
    uploadFiles(Array.from(e.dataTransfer.files), null);
  };

  // ================================================================ render

  const startRender = useCallback(
    async (quality: "draft" | "final", force = false) => {
      setRenderProblem(null);
      setRenderBatch([]);
      setRenderStarting(true);
      try {
        if (!(await flushSave())) {
          setRenderProblem({ message: t("editor.render.save-first"), issues: [], force: null });
          return;
        }
        const res = await startEditorRender(projectId, quality, { force });
        setRenderBatch(res.jobs.map((j) => j.id));
        // SSE có thể đã báo job TRƯỚC khi response về - giữ bản mới hơn của nó
        setJobs((prev) => [
          ...res.jobs.filter((n) => !prev.some((j) => j.id === n.id)),
          ...prev,
        ]);
      } catch (err) {
        const code = err instanceof ApiError ? err.code : "";
        const detail = err instanceof Error ? err.message : String(err);
        if (code === "DRAFT_REQUIRED") {
          setRenderProblem({ message: t("editor.render.draft-required"), detail, issues: [], force: null });
        } else if (code === "QC_REQUIRED" || code === "QC_FAILED") {
          setRenderProblem({
            message: code === "QC_FAILED" ? t("editor.render.qc-failed") : t("editor.render.qc-required"),
            detail,
            issues: [],
            force: "final",
          });
        } else if (code === "INVALID_TIMELINE") {
          setRenderProblem({ message: t("editor.render.invalid"), detail, issues: timelineIssuesOf(err), force: null });
        } else {
          setRenderProblem({ message: t("editor.render.error"), detail, issues: [], force: null });
        }
      } finally {
        setRenderStarting(false);
      }
    },
    [flushSave, projectId, t],
  );

  // ================================================================ kéo cao timeline

  useEffect(() => {
    let saved = 0;
    try {
      saved = Number(window.localStorage.getItem(TIMELINE_H_KEY) ?? 0);
    } catch {
      // localStorage bị chặn - dùng mặc định
    }
    if (Number.isFinite(saved) && saved >= TIMELINE_H_MIN) {
      setTimelineHeight(saved);
      return;
    }
    // Chưa chỉnh tay: màn THẤP (1280x720…) thì timeline mặc định thấp hơn -
    // 304px cố định ở đó chỉ chừa cho trình phát chưa tới 100px
    setTimelineHeight(
      Math.max(TIMELINE_H_MIN, Math.min(TIMELINE_H_DEFAULT, Math.round(window.innerHeight * 0.34))),
    );
  }, []);

  const maxTimelineHeight = () => Math.max(TIMELINE_H_MIN, Math.round(window.innerHeight * 0.65));
  // Giá trị lớn nhất cho aria-valuemax của tay nắm - theo cửa sổ hiện tại
  const [timelineMaxHeight, setTimelineMaxHeight] = useState(TIMELINE_H_DEFAULT);
  useEffect(() => {
    const update = () => setTimelineMaxHeight(maxTimelineHeight());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const persistHeight = (h: number) => {
    try {
      window.localStorage.setItem(TIMELINE_H_KEY, String(Math.round(h)));
    } catch {
      // không nhớ được - vẫn đổi cho phiên này
    }
  };
  const resizeRef = useRef<{ startY: number; startH: number; pointerId: number } | null>(null);
  const onResizeDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { startY: e.clientY, startH: timelineHeight, pointerId: e.pointerId };
    // Kéo tay nắm mà con trỏ lướt qua chữ là trình duyệt bôi đen cả trang -
    // tắt chọn chữ trên body suốt lượt kéo, trả lại khi nhả
    document.body.style.userSelect = "none";
  };
  const onResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    const h = Math.min(maxTimelineHeight(), Math.max(TIMELINE_H_MIN, r.startH - (e.clientY - r.startY)));
    setTimelineHeight(h);
  };
  const onResizeUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    resizeRef.current = null;
    document.body.style.userSelect = "";
    persistHeight(timelineHeight);
  };

  // ================================================================ khung

  const api = useMemo<EditorApi>(
    () => ({
      fps,
      vertical: (info?.project.height ?? 0) > (info?.project.width ?? 0),
      ops: opsCtx,
      readOnly,
      locks,
      toggleLock,
      selection: state.selection,
      edit,
      select,
      endCoalesce,
      seek,
      playback,
      dragActive,
    }),
    [fps, info, opsCtx, readOnly, locks, toggleLock, state.selection, edit, select, endCoalesce, seek, playback],
  );

  const selectedTrack = trackOfSelection(state.selection);
  const selectionLocked = selectedTrack !== null && locks.has(selectedTrack);
  const inspectorApi = useMemo<EditorApi>(
    () => (selectionLocked ? { ...api, readOnly: true } : api),
    [api, selectionLocked],
  );

  const menuItems = useMemo<EditorMenuItem[]>(
    () => [
      { id: "history", label: t("editor.menu.history"), icon: History, onSelect: () => setHistoryOpen(true) },
      {
        id: "export-xml",
        label: t("editor.menu.export-xml"),
        hint: t("editor.menu.export-xml-hint"),
        icon: FileDown,
        onSelect: () => void exportXml(),
      },
      { id: "shortcuts", label: t("editor.menu.shortcuts"), icon: Keyboard, onSelect: () => setShortcutsOpen(true) },
      {
        id: "project",
        label: t("editor.menu.project"),
        icon: LayoutDashboard,
        // Qua navigate: thay đổi không lưu được thì hỏi trước (lưu được thì
        // cleanup lúc unmount tự lưu nốt)
        onSelect: () => navigate(`/projects/${encodeURIComponent(projectId)}`),
      },
    ],
    [t, navigate, projectId, exportXml],
  );

  const onSessionStarted = useCallback(
    (id: string) => {
      projectSessions.current.add(id);
      foreignSessions.current.delete(id);
      onProjectAgentEvent("start", id, undefined);
      // Lượt AI có thể đã kết thúc trước khi 202 về (lỗi ngay ở bước đầu) - khi đó
      // SSE done đã trôi qua lúc phiên còn chưa được nhận diện; hỏi lại server
      // để khóa chỉ đọc không kẹt mãi
      requestRefetch();
    },
    [onProjectAgentEvent, requestRefetch],
  );

  // ================================================================ giao cho AI + duyệt kết quả

  const [handoffOpen, setHandoffOpen] = useState(false);
  /**
   * Phiên "Giao cho AI" đang theo dõi. Xong = khóa chỉ đọc (agentBusy) đã BẬT rồi
   * TẮT lại kể từ khi phiên mở - cùng cơ chế với mọi phiên AI (SSE agent + hỏi
   * lại version), không cần kênh riêng.
   */
  const handoffRef = useRef<{ sessionId: string; beforeRev: string | null; sawBusy: boolean } | null>(
    null,
  );
  const [aiReview, setAiReview] = useState<{ sessionId: string; beforeRev: string | null } | null>(null);
  const [aiUndoBusy, setAiUndoBusy] = useState(false);

  const onHandoffStarted = useCallback(
    (sessionId: string, beforeRev: string | null) => {
      handoffRef.current = { sessionId, beforeRev, sawBusy: false };
      setAiReview(null);
      onSessionStarted(sessionId);
    },
    [onSessionStarted],
  );

  useEffect(() => {
    const h = handoffRef.current;
    if (!h) return;
    if (readOnly) {
      h.sawBusy = true;
      return;
    }
    if (h.sawBusy) {
      handoffRef.current = null;
      setAiReview({ sessionId: h.sessionId, beforeRev: h.beforeRev });
    }
  }, [readOnly]);

  /**
   * Hoàn tác lượt AI: khôi phục ĐÚNG revision server trả về lúc giao (`beforeRev`);
   * thiếu (server không chụp được) mới lùi về `ai-before` mới nhất.
   */
  const undoAiHandoff = useCallback(async () => {
    setAiUndoBusy(true);
    try {
      const revs = await getTimelineRevisions(projectId);
      const wanted = aiReview?.beforeRev ?? null;
      const before =
        (wanted ? revs.find((r) => r.rev === wanted) : undefined) ??
        revs
          .filter((r) => r.source === "ai-before")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!before) {
        flashNotice(t("editor.history.ai-before-missing"));
        return;
      }
      const outcome = await restoreRevision(before);
      if (outcome.ok) setAiReview(null);
      else flashNotice(outcome.message);
    } catch (err) {
      setLibraryError({
        message: t("editor.history.error"),
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAiUndoBusy(false);
    }
  }, [aiReview, flashNotice, projectId, restoreRevision, t]);

  const aiReviewProps: EditorAiReview | null = aiReview
    ? {
        onKeep: () => setAiReview(null),
        onUndo: () => void undoAiHandoff(),
        onHistory: () => setHistoryOpen(true),
        busy: aiUndoBusy,
      }
    : null;

  const sel = state.selection;
  const inspectorActions: InspectorActions = {
    split: splitAction,
    duplicate: duplicateAction,
    remove: deleteAction,
    canSplit:
      !!timeline &&
      !!sel &&
      (isCueSel(sel.kind) ||
        sel.kind === "layer" ||
        (sel.kind === "scene" && sceneIndexById(timeline, sel.id) >= 0 && canSplitScene(timeline.scenes[sceneIndexById(timeline, sel.id)], fps))),
    canDuplicate: !!timeline && canDuplicate(timeline, sel),
    canDelete: !!timeline && canDelete(timeline, sel),
    // Ô số/thanh trượt truyền `coalesce`: các lần sửa liền nhau của cùng ô gộp
    // thành MỘT bước hoàn tác (cửa sổ gõ phím), như mọi ô của inspector
    patchScene: (id, patch, opts) =>
      edit(
        (tl) => patchScene(tl, id, patch),
        opts?.coalesce ? { coalesce: opts.coalesce, windowMs: TYPING_COALESCE_MS } : undefined,
      ),
    patchLayer: (id, patch, opts) =>
      edit(
        (tl) => patchLayer(tl, id, patch),
        opts?.coalesce ? { coalesce: opts.coalesce, windowMs: TYPING_COALESCE_MS } : undefined,
      ),
    // Thêm keyframe = chụp giá trị ĐANG HIỆN tại frame đó (vị trí/cỡ/xoay/độ mờ)
    layerKeyframe: (id, op, relFrame) =>
      edit((tl) => {
        if (op === "remove") return removeLayerKeyframe(tl, id, relFrame);
        const layer = layerById(tl, id);
        return layer ? addLayerKeyframe(tl, id, relFrame, layerValuesAt(layer, relFrame)) : tl;
      }),
    layerZ: (id, delta) => edit((tl) => moveLayerZ(tl, id, delta)),
  };

  // ---------------------------------------------------------------- trạng thái lỗi/tải

  if (loadError && !timeline) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner
          message={loadError.message}
          detail={loadError.detail}
          actions={
            loadError.notFound ? (
              <LinkButton href="/projects" small>
                {t("editor.load.back-projects")}
              </LinkButton>
            ) : (
              <Button variant="secondary" small onClick={() => void load()}>
                {t("common.retry")}
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (!timeline || !info) {
    return (
      <div className="editor-root" aria-busy="true" aria-label={t("editor.loading")}>
        <Skeleton className="h-9 w-full" />
        <div className="editor-main">
          <div className="editor-center">
            <Skeleton className="editor-stage w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <Skeleton className="editor-inspector h-64 w-full" />
        </div>
        <Skeleton className="w-full" height={TIMELINE_H_DEFAULT} />
      </div>
    );
  }

  let saveState: SaveState = "saved";
  if (readOnly) saveState = dirty ? "unsaved" : "readonly";
  else if (state.savingRevision !== null) saveState = "saving";
  else if (problem?.kind === "conflict") saveState = "conflict";
  else if (problem?.kind === "invalid") saveState = "invalid";
  else if (problem?.kind === "error") saveState = "error";
  else if (dirty) saveState = "unsaved";

  const project = info.project;
  const subtitle = `${project.width}×${project.height} · ${project.fps}fps`;
  const showRenderStale = renderActive && renderBaseline !== null && state.revision !== renderBaseline;

  return (
    <EditorContext.Provider value={api}>
      <div
        className="editor-root"
        data-filedrop={fileDrag ?? undefined}
        onDragOver={onRootDragOver}
        onDragLeave={onRootDragLeave}
        onDrop={onRootDrop}
      >
        <EditorTopBar
          projectId={projectId}
          name={project.name || project.id}
          subtitle={subtitle}
          saveState={saveState}
          onRetrySave={retrySave}
          canUndo={!readOnly && state.past.length > 0}
          canRedo={!readOnly && state.future.length > 0}
          onUndo={undo}
          onRedo={redo}
          activeJob={activeJobs[0] ?? null}
          activeCount={activeJobs.length}
          lastOutput={lastOutput}
          renderBusy={renderStarting}
          renderDisabled={problem?.kind === "conflict" || timeline.scenes.length === 0}
          onRender={(q) => void startRender(q)}
          menuItems={menuItems}
          onHandoff={() => setHandoffOpen(true)}
          handoffDisabled={readOnly || problem?.kind === "conflict" || timeline.scenes.length === 0}
          onExport={() => void startRender("final")}
          aiReview={aiReviewProps}
        />

        {readOnly && <Banner tone="info" message={t("editor.banner.agent-busy")} />}

        {problem?.kind === "conflict" && (
          <Banner
            tone="danger"
            message={t("editor.banner.conflict")}
            actions={
              <>
                <Button variant="secondary" small onClick={loadLatest}>
                  {t("editor.banner.load-latest")}
                </Button>
                <Button small onClick={keepMine}>
                  {t("editor.banner.keep-mine")}
                </Button>
              </>
            }
          />
        )}

        {problem?.kind === "invalid" && (
          <IssuesBanner
            message={t("editor.banner.invalid")}
            detail={problem.message}
            issues={problem.issues}
            onPick={(path) => {
              const target = selectionFromIssuePath(path, timeline);
              if (target) select(target);
            }}
          />
        )}

        {problem?.kind === "error" && (
          <ErrorBanner
            message={t("editor.banner.save-error")}
            detail={problem.message}
            actions={
              <Button variant="secondary" small onClick={retrySave}>
                {t("editor.save.retry")}
              </Button>
            }
          />
        )}

        {renderProblem &&
          (renderProblem.issues.length > 0 ? (
            <IssuesBanner
              message={renderProblem.message}
              detail={renderProblem.detail}
              issues={renderProblem.issues}
              onPick={(path) => {
                const target = selectionFromIssuePath(path, timeline);
                if (target) select(target);
              }}
              onDismiss={() => setRenderProblem(null)}
            />
          ) : (
            <Banner
              tone="danger"
              message={renderProblem.message}
              detail={renderProblem.detail}
              actions={
                <>
                  {renderProblem.force && (
                    <Button
                      variant="secondary"
                      small
                      disabled={renderStarting}
                      onClick={() => void startRender("final", true)}
                    >
                      {t("editor.render.force")}
                    </Button>
                  )}
                  <Button variant="secondary" small onClick={() => setRenderProblem(null)}>
                    {t("common.close")}
                  </Button>
                </>
              }
            />
          ))}

        {failedJob && (
          <Banner
            tone="danger"
            message={t("editor.render.failed")}
            detail={failedJob.step || null}
            actions={
              <>
                <LinkButton href="/queue" small>
                  {t("editor.render.open-queue")}
                </LinkButton>
                <Button variant="secondary" small onClick={() => setRenderBatch([])}>
                  {t("common.close")}
                </Button>
              </>
            }
          />
        )}

        {showRenderStale && <Banner tone="info" message={t("editor.banner.render-stale")} />}
        {libraryBusy?.importing && (
          <Banner tone="muted" message={tf("editor.library.importing", { name: libraryBusy.name })}>
            <div className="progress-indeterminate mt-2" aria-hidden="true" />
          </Banner>
        )}
        {libraryError && (
          <ErrorBanner
            message={libraryError.message}
            detail={libraryError.detail}
            actions={
              <Button variant="secondary" small onClick={() => setLibraryError(null)}>
                {t("common.close")}
              </Button>
            }
          />
        )}
        {aiJobs.jobs
          .filter((job) => job.status === "failed")
          .map((job) => (
            <ErrorBanner
              key={job.id}
              message={tf("editor.tlai.failed", {
                what: jobWhat(t, job),
                time: formatSeconds(job.frame, fps),
                reason: job.error?.message ?? "",
              })}
              detail={job.error?.detail}
              actions={
                <Button variant="secondary" small onClick={() => aiJobs.dismiss(job.id)}>
                  {t("common.close")}
                </Button>
              }
            />
          ))}
        {exportProblem && (
          <ErrorBanner
            message={exportProblem.message}
            detail={exportProblem.detail}
            actions={
              <Button variant="secondary" small onClick={() => setExportProblem(null)}>
                {t("common.close")}
              </Button>
            }
          />
        )}
        {uploads.length > 0 && (
          <Banner
            tone={uploads.some((r) => r.status === "error") ? "danger" : "muted"}
            message={
              uploadingNow
                ? tf("editor.drop.uploading", {
                    done: uploads.filter((r) => r.status === "done").length,
                    total: uploads.length,
                  })
                : uploads.some((r) => r.status === "error")
                  ? t("editor.drop.upload-failed")
                  : t("editor.drop.uploaded")
            }
            actions={
              !uploadingNow ? (
                <Button variant="secondary" small onClick={() => setUploads([])}>
                  {t("common.close")}
                </Button>
              ) : undefined
            }
          >
            <ul className="mt-2 flex max-h-32 flex-col gap-2 overflow-y-auto">
              {uploads.map((row) => (
                <li key={row.id} className="flex flex-col gap-1">
                  <span className="flex min-w-0 items-center justify-between gap-2 text-meta">
                    <span className="min-w-0 truncate" title={row.name}>
                      {row.name}
                    </span>
                    <span className="shrink-0 text-[var(--text-muted)]">
                      {row.status === "queued"
                        ? t("editor.drop.status-queued")
                        : row.status === "uploading"
                          ? t("editor.drop.status-uploading")
                          : row.status === "done"
                            ? t("editor.drop.status-done")
                            : t("editor.drop.status-error")}
                    </span>
                  </span>
                  {row.status === "uploading" &&
                    (row.total > 0 && row.received > 0 ? (
                      <ProgressBar progress={(row.received / row.total) * 100} />
                    ) : (
                      <div className="progress-indeterminate" aria-hidden="true" />
                    ))}
                  {row.status === "error" && row.error && (
                    <span className="text-meta text-[var(--danger)] [overflow-wrap:anywhere]">{row.error}</span>
                  )}
                </li>
              ))}
            </ul>
          </Banner>
        )}
        {/* Thông báo thoáng qua (4s): nổi bên trên, KHÔNG chen vào dòng chảy -
            chen vào là cả trình phát + timeline bị đẩy xuống rồi bật lên lại */}
        {fileDrag ? (
          <div className="editor-notice" role="status" aria-live="polite">
            <Banner
              tone={fileDrag === "reject" ? "danger" : "info"}
              message={fileDrag === "reject" ? t("editor.drop.readonly-blocked") : t("editor.drop.hint")}
            />
          </div>
        ) : (
          notice && (
            <div className="editor-notice" role="status" aria-live="polite">
              <Banner tone="muted" message={notice} />
            </div>
          )
        )}

        <div className="editor-main" data-library={libraryCollapsed ? "collapsed" : "open"}>
          <LibraryPanel
            projectId={projectId}
            collapsed={libraryCollapsed}
            onCollapsedChange={toggleLibrary}
            readOnly={readOnly}
            busyKey={libraryBusy?.key ?? null}
            refreshKey={assetsTick}
            onAdd={(item, track) =>
              void addLibraryItem(
                item,
                // Chỉ định track (nút "Thêm làm layer"): tại playhead; vị trí chèn scene không dùng tới
                track ? { track, frame: playback.getFrame(), sceneIndex: 0 } : undefined,
              )
            }
            onUpload={(files) => uploadFiles(files, null)}
            uploading={uploadingNow}
            aiPanel={
              <AiImagePanel projectId={projectId} readOnly={readOnly} onReady={(r) => void onAiImageReady(r)} />
            }
          />
          <div className="editor-center">
            <div className="editor-stage">
              {timeline.scenes.length > 0 ? (
                <>
                  <PreviewPlayer
                    ref={attachPlayer}
                    projectId={projectId}
                    timeline={timeline}
                    project={info.project}
                    preview={info.preview}
                    controls={false}
                  />
                  {/* Lớp kéo-thả trực tiếp trên hình (chọn/dời/đổi cỡ/xoay) - đè lên
                      trình phát, cùng hàm hình học layerBox với engine */}
                  <CanvasOverlay
                    timeline={timeline}
                    selection={state.selection}
                    fps={fps}
                    compWidth={project.width}
                    compHeight={project.height}
                    readOnly={readOnly}
                    isLocked={(target) => locks.has(target.kind)}
                    getFrame={playback.getFrame}
                    mediaAspect={mediaAspect}
                    onSelect={select}
                    onEditText={onCanvasEditText}
                    onTransform={onCanvasTransform}
                  />
                </>
              ) : (
                // Project chưa có scene: composition cần ≥ 1 scene, hiện lỗi
                // schema "scenes: Invalid input" ở đây là đúng mà vô ích
                <div className="flex h-full items-center justify-center">
                  <EmptyState
                    icon={Clapperboard}
                    title={t("editor.empty.title")}
                    description={t("editor.empty.body")}
                  />
                </div>
              )}
            </div>
            <Transport
              totalFrames={totalFrames}
              onToggle={togglePlay}
              onStep={step}
              disabled={timeline.scenes.length === 0}
            />
          </div>
          <EditorErrorBoundary
            area="inspector"
            resetKeys={[timeline, state.selection]}
            className="card editor-inspector flex flex-col gap-3"
          >
            <EditorContext.Provider value={inspectorApi}>
              <Inspector
                timeline={timeline}
                spans={spans}
                preview={info.preview}
                actions={inspectorActions}
                locked={
                  selectionLocked && selectedTrack && !readOnly
                    ? { track: t(TRACK_LABEL_KEY[selectedTrack]), onUnlock: () => toggleLock(selectedTrack) }
                    : null
                }
              />
            </EditorContext.Provider>
          </EditorErrorBoundary>
        </div>

        <div
          className="editor-resize"
          role="separator"
          aria-orientation="horizontal"
          aria-label={t("editor.timeline.resize")}
          aria-valuenow={Math.round(timelineHeight)}
          aria-valuemin={TIMELINE_H_MIN}
          aria-valuemax={timelineMaxHeight}
          aria-valuetext={tf("editor.timeline.resize-value", { px: Math.round(timelineHeight) })}
          tabIndex={0}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
          onLostPointerCapture={onResizeUp}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const h = Math.min(
              maxTimelineHeight(),
              Math.max(TIMELINE_H_MIN, timelineHeight + (e.key === "ArrowUp" ? 24 : -24)),
            );
            setTimelineHeight(h);
            persistHeight(h);
          }}
        />

        <EditorErrorBoundary area="timeline" resetKeys={[timeline]} className="tl p-3" style={{ height: timelineHeight }}>
          <TimelinePanel
            timeline={timeline}
            spans={spans}
            totalFrames={totalFrames}
            preview={info.preview}
            height={timelineHeight}
            onLibraryDrop={(item, target) => void addLibraryItem(item, target)}
            onFilesDrop={uploadFiles}
            onAddCue={addCueAtPlayhead}
            onAddLayer={addLayerAtPlayhead}
            onAiAt={setAiAnchor}
            aiJobs={aiJobs.jobs}
            onAiJobClick={(job) => aiJobs.dismiss(job.id)}
            hoverRef={aiHoverRef}
          />
        </EditorErrorBoundary>

        <EditorChat
          projectId={projectId}
          onSessionStarted={onSessionStarted}
          beforeSend={flushSave}
          queued={chatQueued}
        />
        {aiAnchor && (
          <TimelineAiPopover
            anchor={aiAnchor}
            fps={fps}
            readOnly={readOnly}
            lockedModes={aiLockedModes}
            onClose={closeAiPopover}
            onSubmit={onAiSubmit}
          />
        )}
        <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <HandoffModal
          open={handoffOpen}
          onClose={() => setHandoffOpen(false)}
          projectId={projectId}
          onStarted={onHandoffStarted}
          beforeStart={flushSave}
        />
        <HistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          projectId={projectId}
          currentVersion={state.version}
          readOnly={readOnly}
          onRestore={restoreRevision}
        />
        <Modal
          title={t("editor.music.replace-title")}
          open={pendingMusic !== null}
          onClose={() => setPendingMusic(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingMusic(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={confirmMusic}>{t("editor.music.replace")}</Button>
            </>
          }
        >
          <p className="text-sm">
            {tf("editor.music.replace-body", {
              current: String(timeline.audio.music?.file ?? "").split("/").pop() ?? "",
              next: pendingMusic?.name ?? "",
            })}
          </p>
          <p className="text-meta text-[var(--text-muted)]">{t("editor.music.replace-note")}</p>
        </Modal>
        <Modal
          title={t("editor.leave.title")}
          open={leaveTarget !== null}
          onClose={() => setLeaveTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setLeaveTarget(null)}>
                {t("editor.leave.stay")}
              </Button>
              <Button variant="destructive" onClick={confirmLeave}>
                {t("editor.leave.discard")}
              </Button>
            </>
          }
        >
          <p className="text-sm">
            {readOnly
              ? t("editor.leave.body-readonly")
              : problem?.kind === "conflict"
                ? t("editor.leave.body-conflict")
                : problem?.kind === "invalid"
                  ? t("editor.leave.body-invalid")
                  : t("editor.leave.body-error")}
          </p>
          <p className="text-meta text-[var(--text-muted)]">{t("editor.leave.note")}</p>
        </Modal>
      </div>
    </EditorContext.Provider>
  );
}

function IssuesBanner({
  message,
  detail,
  issues,
  onPick,
  onDismiss,
}: {
  message: string;
  detail?: string;
  issues: TimelineIssue[];
  onPick: (path: string) => void;
  onDismiss?: () => void;
}) {
  const { t } = useT();
  return (
    <Banner
      tone="danger"
      message={message}
      detail={detail}
      actions={
        onDismiss ? (
          <Button variant="secondary" small onClick={onDismiss}>
            {t("common.close")}
          </Button>
        ) : undefined
      }
    >
      <ul className="mt-2 flex max-h-32 flex-col gap-1 overflow-y-auto text-meta">
        {issues.slice(0, 20).map((issue, i) => (
          <li key={`${issue.path}-${i}`}>
            <button
              type="button"
              className="text-left underline-offset-2 hover:underline"
              onClick={() => onPick(issue.path)}
              title={t("editor.banner.issue-select")}
            >
              <span className="font-mono">{issue.path}</span>: {issue.message}
            </button>
          </li>
        ))}
      </ul>
    </Banner>
  );
}
