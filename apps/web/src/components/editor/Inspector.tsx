"use client";

/**
 * Inspector - thuộc tính của phần tử đang chọn. Người dùng thấy GIÂY, timeline
 * lưu theo hợp đồng (scene from/to giây; cue, sfx frame tuyệt đối) - đổi đơn vị
 * nằm hết ở đây và ops.ts.
 *
 * Toàn bộ form nằm trong <fieldset disabled> lúc chỉ đọc (AI đang sửa project):
 * một chỗ khóa mọi ô, không ô nào phải tự nhớ.
 *
 * v2 (docs/EDITOR-V2-PLAN.md §2.4-2.5): khung hình / màu / âm thanh / tốc độ /
 * chuyển cảnh của scene và toàn bộ form layer. Các mục này ghi qua
 * `actions.patchScene` / `actions.patchLayer` (VideoEditor gộp bước hoàn tác theo
 * khóa `coalesce`); object lồng (transform, crop, color, style, animation) luôn
 * được dựng lại TRỌN từ bản cũ + thay đổi, giữ field lạ, bỏ field về mặc định.
 */

import {
  BringToFront,
  Copy,
  CopyCheck,
  Crosshair,
  FlipHorizontal2,
  FlipVertical2,
  Highlighter,
  MousePointerClick,
  Plus,
  RotateCcw,
  Scissors,
  SendToBack,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { defaultFontSizePx, LAYER_DEFAULTS } from "@engine/layerGeometry";
import { CUE_SCALE_MAX, CUE_SCALE_MIN } from "@engine/manifest";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Field, SwitchField } from "@/components/Field";
import { IconButton } from "@/components/IconButton";
import { Panel } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { FilterChip } from "@/components/Toolbar";
import {
  SUBTITLE_FONTS,
  type Timeline,
  type TimelineCaptionCue,
  type TimelineCueTransform,
  type TimelineHighlightCue,
  type TimelinePreview,
  type TimelineScene,
  type TimelineSfx,
  type TimelineSubtitleCue,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useEditor, type EditOptions } from "./EditorContext";
import {
  ColorField,
  fmtNumber,
  NumberField,
  ReadOnlyRow,
  SliderField,
  TextField,
  VolumeField,
} from "./fields";
import {
  applyCueTransformToAll,
  cueTransformOf,
  footageWindow,
  insertCaptionWord,
  isMediaMissing,
  isWellFormed,
  insertHighlightPart,
  layerById,
  setLayerDuration,
  setLayerStart,
  type TimelineLayer,
  type TimelineLayerKeyframe,
  patchCaptionWord,
  patchHighlightPart,
  patchMusic,
  patchOverlay,
  patchScene,
  patchSfx,
  patchSubtitle,
  readPunchIn,
  removeCaptionWord,
  removeHighlightPart,
  sceneIndexById,
  sceneKind,
  sceneMaxFrames,
  sceneMissingMedia,
  sceneSourcePath,
  setCaptionText,
  setCueDuration,
  setCueStart,
  setCueTransform,
  setFootageWindow,
  setSceneDuration,
  setScenePunchIn,
  setSceneSpeed,
  setSubtitleStyle,
  setTransitionOverlap,
  type CueKind,
  type PunchIn,
  type SceneKind,
  type Selection,
} from "./ops";
import { usePlayheadFrame } from "./playback";
import { TYPING_COALESCE_MS } from "./store";
import { sceneDurationFrames, type SceneSpan } from "./timing";

/** Tùy chọn ghi của patchScene/patchLayer - cùng khóa `coalesce` = cùng một bước hoàn tác. */
export interface InspectorPatchOptions {
  coalesce?: string;
}

export interface InspectorActions {
  split: () => void;
  duplicate: () => void;
  remove: () => void;
  canSplit: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  /** Patch NÔNG scene theo id (object lồng thay nguyên - inspector tự spread bản cũ) */
  patchScene: (id: string, patch: Partial<TimelineScene>, opts?: InspectorPatchOptions) => void;
  /** Patch NÔNG layer theo id */
  patchLayer: (id: string, patch: Partial<TimelineLayer>, opts?: InspectorPatchOptions) => void;
  /** Thêm keyframe (giá trị hiện tại) / xóa keyframe tại relFrame - frame TƯƠNG ĐỐI layer.from */
  layerKeyframe: (id: string, op: "add" | "remove", relFrame: number) => void;
  /** Đưa layer lên (+1) / xuống (-1) một lớp */
  layerZ: (id: string, delta: 1 | -1) => void;
}

const typing = (key: string): EditOptions => ({ coalesce: key, windowMs: TYPING_COALESCE_MS });

const baseName = (path: string | null | undefined): string =>
  path ? (path.split(/[\\/]/).pop() ?? path) : "";

/** Nhãn loại scene - key i18n tĩnh để cổng check-i18n đếm được. */
export function useSceneKindLabel(): (kind: SceneKind) => string {
  const { t } = useT();
  return (kind) => {
    switch (kind) {
      case "footage":
        return t("editor.scene.kind-footage");
      case "image":
        return t("editor.scene.kind-image");
      case "hyperframes":
        return t("editor.scene.kind-hyperframes");
      case "render":
        return t("editor.scene.kind-render");
      default:
        return t("editor.scene.kind-empty");
    }
  };
}

export function Inspector({
  timeline,
  spans,
  preview,
  actions,
  locked = null,
}: {
  timeline: Timeline;
  spans: SceneSpan[];
  preview: TimelinePreview;
  actions: InspectorActions;
  /** Phần tử đang chọn nằm trên track đã khóa - trang đã đặt readOnly cho inspector */
  locked?: { track: string; onUnlock: () => void } | null;
}) {
  const { t, tf } = useT();
  const { selection, readOnly } = useEditor();

  let body: ReactNode;
  let title = t("editor.inspector.title");
  if (!selection) {
    body = (
      <EmptyState
        icon={MousePointerClick}
        title={t("editor.inspector.empty-title")}
        description={t("editor.inspector.empty")}
      />
    );
  } else if (!isWellFormed(timeline, selection)) {
    // Dữ liệu sai kiểu (thường do AI ghi tay meta.json): không dựng form trên
    // nó - form đọc `.words`/`.parts`/`.text` là sập. Vẫn xóa được (nút thùng
    // rác ở trên) hoặc nhờ AI sửa.
    body = (
      <Banner
        tone="danger"
        message={t("editor.malformed.title")}
        detail={malformedDetail(timeline, selection)}
      />
    );
  } else {
    switch (selection.kind) {
      case "scene": {
        const index = sceneIndexById(timeline, selection.id);
        title = t("editor.inspector.scene");
        body =
          index >= 0 ? (
            <SceneForm
              key={selection.id}
              timeline={timeline}
              index={index}
              span={spans[index]}
              preview={preview}
              actions={actions}
            />
          ) : null;
        break;
      }
      case "caption":
        title = t("editor.inspector.caption");
        body = timeline.captions[selection.index] ? (
          <CaptionForm
            key={`c${selection.index}`}
            index={selection.index}
            cue={timeline.captions[selection.index]}
          />
        ) : null;
        break;
      case "subtitle":
        title = t("editor.inspector.subtitle");
        body = timeline.subtitles[selection.index] ? (
          <SubtitleForm
            key={`s${selection.index}`}
            index={selection.index}
            cue={timeline.subtitles[selection.index]}
            timeline={timeline}
          />
        ) : null;
        break;
      case "overlay":
        title = t("editor.inspector.overlay");
        body = timeline.overlays[selection.index] ? (
          <OverlayForm
            key={`o${selection.index}`}
            index={selection.index}
            cue={timeline.overlays[selection.index]}
          />
        ) : null;
        break;
      case "sfx":
        title = t("editor.inspector.sfx");
        body = timeline.audio.sfx[selection.index] ? (
          <SfxForm
            key={`x${selection.index}`}
            index={selection.index}
            sfx={timeline.audio.sfx[selection.index]}
            preview={preview}
          />
        ) : null;
        break;
      case "music":
        title = t("editor.inspector.music");
        body = timeline.audio.music ? <MusicForm timeline={timeline} preview={preview} /> : null;
        break;
      case "voice":
        title = t("editor.inspector.voice");
        body = <VoiceForm timeline={timeline} preview={preview} />;
        break;
      case "layer": {
        title = t("editor.inspector2.layer");
        const layer = layerById(timeline, selection.id);
        body = layer ? <LayerForm key={selection.id} layer={layer} actions={actions} /> : null;
        break;
      }
    }
  }

  // File nguồn không còn trên đĩa (xóa/đổi tên ngoài editor): trình phát chỉ
  // hiện khung trống, nói rõ ở đây cái gì thiếu
  let missingFile: string | null = null;
  if (selection?.kind === "scene") {
    const scene = timeline.scenes[sceneIndexById(timeline, selection.id)];
    missingFile = scene ? sceneMissingMedia(scene, preview) : null;
  } else if (selection?.kind === "sfx") {
    const file = timeline.audio.sfx[selection.index]?.file;
    missingFile = isMediaMissing(preview, file) ? String(file) : null;
  } else if (selection?.kind === "music") {
    const file = timeline.audio.music?.file;
    missingFile = isMediaMissing(preview, file) ? String(file) : null;
  } else if (selection?.kind === "voice") {
    const file = timeline.audio.voice;
    missingFile = isMediaMissing(preview, file) ? String(file) : null;
  } else if (selection?.kind === "layer") {
    const file = layerById(timeline, selection.id)?.src;
    missingFile = typeof file === "string" && isMediaMissing(preview, file) ? file : null;
  }

  return (
    <section
      className="card editor-inspector flex flex-col gap-3"
      aria-label={title}
      onKeyDown={(e) => {
        // Esc trong bất kỳ ô nhập nào của inspector: rời ô (phím tắt của trang
        // không chạy khi đang gõ, nên không có Esc thì không thoát ra được bằng bàn phím)
        const el = e.target;
        if (
          e.key === "Escape" &&
          el instanceof HTMLElement &&
          (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
        ) {
          e.preventDefault();
          el.blur();
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {selection && <SelectionActions actions={actions} selection={selection} />}
      </div>
      {locked && (
        <Banner
          tone="muted"
          message={tf("editor.lock.inspector", { track: locked.track })}
          actions={
            <Button variant="secondary" small onClick={locked.onUnlock}>
              {t("editor.lock.unlock")}
            </Button>
          }
        />
      )}
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-3">
        {missingFile && <Banner tone="danger" message={tf("editor.media.missing", { file: missingFile })} />}
        {body}
      </fieldset>
    </section>
  );
}

/** Nguyên văn phần tử lỗi (rút gọn) cho phần "chi tiết" của banner. */
function malformedDetail(timeline: Timeline, sel: Selection): string {
  let raw: unknown;
  if (sel.kind === "scene") raw = timeline.scenes[sceneIndexById(timeline, sel.id)];
  else if (sel.kind === "caption") raw = timeline.captions[sel.index];
  else if (sel.kind === "subtitle") raw = timeline.subtitles[sel.index];
  else if (sel.kind === "overlay") raw = timeline.overlays[sel.index];
  else if (sel.kind === "sfx") raw = timeline.audio.sfx[sel.index];
  else if (sel.kind === "music") raw = timeline.audio.music;
  else if (sel.kind === "layer") {
    raw = Array.isArray(timeline.layers) ? timeline.layers.find((l) => l?.id === sel.id) : undefined;
  } else raw = timeline.audio.voice;
  try {
    const text = JSON.stringify(raw, null, 2) ?? String(raw);
    return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
  } catch {
    return String(raw);
  }
}

function SelectionActions({
  actions,
  selection,
}: {
  actions: InspectorActions;
  selection: Selection;
}) {
  const { t } = useT();
  const { readOnly } = useEditor();
  if (selection.kind === "voice") return null;
  return (
    <div className="flex items-center gap-1">
      {selection.kind !== "music" && (
        <>
          <IconButton
            label={t("editor.action.split")}
            disabled={readOnly || !actions.canSplit}
            onClick={actions.split}
          >
            <Scissors size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label={t("editor.action.duplicate")}
            disabled={readOnly || !actions.canDuplicate}
            onClick={actions.duplicate}
          >
            <Copy size={16} strokeWidth={1.75} />
          </IconButton>
        </>
      )}
      {selection.kind === "layer" && (
        <>
          <IconButton
            label={t("editor.inspector2.z-up")}
            disabled={readOnly}
            onClick={() => actions.layerZ(selection.id, 1)}
          >
            <BringToFront size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label={t("editor.inspector2.z-down")}
            disabled={readOnly}
            onClick={() => actions.layerZ(selection.id, -1)}
          >
            <SendToBack size={16} strokeWidth={1.75} />
          </IconButton>
        </>
      )}
      <IconButton
        label={t("editor.action.delete")}
        tone="danger"
        disabled={readOnly || !actions.canDelete}
        onClick={actions.remove}
      >
        <Trash2 size={16} strokeWidth={1.75} />
      </IconButton>
    </div>
  );
}

// ================================================================ scene

function SceneForm({
  timeline,
  index,
  span,
  preview,
  actions,
}: {
  timeline: Timeline;
  index: number;
  span: SceneSpan | undefined;
  preview: TimelinePreview;
  actions: InspectorActions;
}) {
  const { t, tf } = useT();
  const { fps, ops, edit } = useEditor();
  const kindLabel = useSceneKindLabel();
  const scene: TimelineScene = timeline.scenes[index];
  const kind = sceneKind(scene);
  const source = sceneSourcePath(scene);
  const render = ops.sceneRender(scene);
  const duration = sceneDurationFrames(scene, fps);
  const sid = `scene-${index}`;
  const key = (field: string) => typing(`scene:${scene.id}:${field}`);
  const isLast = index === timeline.scenes.length - 1;
  const next = timeline.scenes[index + 1];
  const nextDuration = next ? sceneDurationFrames(next, fps) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="muted" dot={false} label={kindLabel(kind)} />
        <span className="min-w-0 text-meta text-[var(--text-muted)] [overflow-wrap:anywhere]">
          {tf("editor.scene.id", { id: scene.id })}
        </span>
      </div>

      {source && (
        <ReadOnlyRow label={t("editor.scene.source")}>
          <span className="text-meta">{source}</span>
          {kind === "footage" && scene.srcVideo && (
            <MediaLength path={scene.srcVideo} preview={preview} />
          )}
        </ReadOnlyRow>
      )}
      {(kind === "hyperframes" || kind === "render") && (
        <ReadOnlyRow label={t("editor.scene.preview-file")}>
          {render ? (
            <span className="text-meta">
              {render}
              <MediaLength path={render} preview={preview} />
            </span>
          ) : (
            <span className="text-meta text-[var(--text-muted)]">{t("editor.scene.not-rendered")}</span>
          )}
        </ReadOnlyRow>
      )}

      {span && (
        <p className="text-meta text-[var(--text-muted)]">
          {tf("editor.scene.position", {
            start: fmtNumber(span.start / fps),
            end: fmtNumber(span.end / fps),
          })}
        </p>
      )}

      {kind === "footage" ? (
        <FootageWindowFields timeline={timeline} index={index} idPrefix={sid} />
      ) : (
        <NumberField
          id={`${sid}-dur`}
          label={t("editor.scene.duration")}
          unit="s"
          value={(duration ?? 0) / fps}
          min={1 / fps}
          max={(() => {
            const max = sceneMaxFrames(scene, ops);
            return max === null ? Number.POSITIVE_INFINITY : Math.max(max, duration ?? 0) / fps;
          })()}
          hint={
            kind === "hyperframes" || kind === "render"
              ? t("editor.scene.duration-hint-hf")
              : undefined
          }
          onCommit={(sec) =>
            edit((tl) => setSceneDuration(tl, index, Math.round(sec * fps), ops), key("dur"))
          }
        />
      )}

      <FrameSection
        target={scene}
        idPrefix={sid}
        media={kind !== "empty"}
        patch={scenePatcher(actions, scene.id)}
      />

      <ColorSection target={scene} idPrefix={sid} patch={scenePatcher(actions, scene.id)} />

      {kind === "footage" && (
        <Panel title={t("editor.inspector2.audio")}>
          <SwitchField
            id={`${sid}-muted`}
            label={t("editor.scene.muted")}
            hint={t("editor.scene.muted-hint")}
            checked={scene.muted === true}
            onChange={(v) => edit((tl) => patchScene(tl, index, { muted: v ? true : undefined }))}
          />
          <AudioLevelFields
            target={scene}
            idPrefix={sid}
            disabled={scene.muted === true}
            withFades
            patch={scenePatcher(actions, scene.id)}
          />
        </Panel>
      )}

      {kind === "footage" && (
        <SpeedSection scene={scene} idPrefix={sid} />
      )}

      <Panel title={t("editor.inspector2.transition")}>
        <TransitionTypeField
          scene={scene}
          idPrefix={sid}
          disabled={isLast}
          onPick={(type) => {
            const overlap = scene.transitionOverlap ?? 0;
            // Chọn một kiểu chuyển mà độ chồng đang là 0 thì kiểu đó không bao giờ
            // hiện ra - đặt sẵn 0.5s (kẹp theo độ dài hai scene) để thấy được ngay
            let nextOverlap: number | undefined;
            if (type !== "none" && overlap <= 0 && duration !== null && nextDuration !== null) {
              nextOverlap = Math.max(1, Math.min(Math.round(fps / 2), duration - 1, nextDuration - 1));
            }
            scenePatcher(actions, scene.id)({
              transition: mergeNested(scene.transition, { type }, { type: "fade" }),
              ...(nextOverlap !== undefined ? { transitionOverlap: nextOverlap } : {}),
            });
          }}
        />
        <NumberField
          id={`${sid}-overlap`}
          label={t("editor.scene.transition")}
          unit="s"
          value={(scene.transitionOverlap ?? 0) / fps}
          min={0}
          max={
            isLast || duration === null || nextDuration === null
              ? Number.POSITIVE_INFINITY
              : Math.min(duration, nextDuration) / fps
          }
          disabled={isLast}
          hint={isLast ? t("editor.scene.transition-last") : t("editor.scene.transition-hint")}
          onCommit={(sec) =>
            edit((tl) => setTransitionOverlap(tl, index, Math.round(sec * fps)), key("overlap"))
          }
        />
      </Panel>

      <PunchInFields scene={scene} index={index} idPrefix={sid} />
    </>
  );
}

function MediaLength({ path, preview }: { path: string; preview: TimelinePreview }) {
  const { tf } = useT();
  const sec = preview.media[path]?.durationSec;
  if (typeof sec !== "number") return null;
  return (
    <span className="text-meta text-[var(--text-muted)]">
      {" · "}
      {tf("editor.media.length", { sec: fmtNumber(sec) })}
    </span>
  );
}

function FootageWindowFields({
  timeline,
  index,
  idPrefix,
}: {
  timeline: Timeline;
  index: number;
  idPrefix: string;
}) {
  const { t, tf } = useT();
  const { fps, ops, edit } = useEditor();
  const scene = timeline.scenes[index];
  const win = footageWindow(scene, fps);
  const mediaSec = scene.srcVideo ? ops.mediaDurationSec(scene.srcVideo) : null;
  if (!win) {
    return <Banner tone="danger" message={t("editor.scene.no-window")} />;
  }
  const max = mediaSec ?? Number.POSITIVE_INFINITY;
  const key = (field: string) => typing(`scene:${scene.id}:${field}`);
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField
        id={`${idPrefix}-in`}
        label={t("editor.scene.in")}
        unit="s"
        value={win.inFrame / fps}
        min={0}
        max={Math.max(0, max - 1 / fps)}
        validate={(v) =>
          Math.round(v * fps) >= win.outFrame ? t("editor.scene.in-after-out") : null
        }
        onCommit={(sec) =>
          edit((tl) => setFootageWindow(tl, index, Math.round(sec * fps), win.outFrame, ops), key("in"))
        }
      />
      <NumberField
        id={`${idPrefix}-out`}
        label={t("editor.scene.out")}
        unit="s"
        value={win.outFrame / fps}
        min={1 / fps}
        max={max}
        hint={tf("editor.scene.length", { sec: fmtNumber((win.outFrame - win.inFrame) / fps) })}
        validate={(v) =>
          Math.round(v * fps) <= win.inFrame ? t("editor.scene.out-before-in") : null
        }
        onCommit={(sec) =>
          edit((tl) => setFootageWindow(tl, index, win.inFrame, Math.round(sec * fps), ops), key("out"))
        }
      />
    </div>
  );
}

const DEFAULT_PUNCH: PunchIn = { startScale: 1, endScale: 1.12, ease: "out" };

function PunchInFields({
  scene,
  index,
  idPrefix,
}: {
  scene: TimelineScene;
  index: number;
  idPrefix: string;
}) {
  const { t, tf } = useT();
  const { ops, edit } = useEditor();
  const current = readPunchIn(scene);
  const punch = current?.punch ?? DEFAULT_PUNCH;
  const key = (field: string) => typing(`scene:${scene.id}:zoom-${field}`);
  const write = (next: PunchIn, field: string) =>
    edit((tl) => setScenePunchIn(tl, index, next, ops), key(field));

  return (
    <Panel title={t("editor.zoom.title")}>
      <SwitchField
        id={`${idPrefix}-zoom`}
        label={t("editor.zoom.enable")}
        hint={t("editor.zoom.hint")}
        checked={current !== null}
        onChange={(on) => edit((tl) => setScenePunchIn(tl, index, on ? DEFAULT_PUNCH : null, ops))}
      />
      {current && (
        <>
          {current.custom && (
            <p className="text-meta text-[var(--text-muted)]">
              {tf("editor.zoom.custom", { n: Array.isArray(scene.zoom?.keys) ? scene.zoom.keys.length : 0 })}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id={`${idPrefix}-zoom-start`}
              label={t("editor.zoom.start")}
              unit="×"
              value={punch.startScale}
              min={0.5}
              max={4}
              step={0.01}
              onCommit={(v) => write({ ...punch, startScale: v }, "start")}
            />
            <NumberField
              id={`${idPrefix}-zoom-end`}
              label={t("editor.zoom.end")}
              unit="×"
              value={punch.endScale}
              min={0.5}
              max={4}
              step={0.01}
              onCommit={(v) => write({ ...punch, endScale: v }, "end")}
            />
          </div>
          <Field label={t("editor.zoom.ease")}>
            <Segmented
              label={t("editor.zoom.ease")}
              value={punch.ease}
              onChange={(ease) => write({ ...punch, ease }, "ease")}
              options={[
                { value: "linear", label: t("editor.zoom.ease-linear") },
                { value: "out", label: t("editor.zoom.ease-out") },
                { value: "inOut", label: t("editor.zoom.ease-inout") },
              ]}
            />
          </Field>
        </>
      )}
    </Panel>
  );
}

// ================================================================ cue chung

function CueTimingFields({
  kind,
  index,
  from,
  duration,
  idPrefix,
}: {
  kind: "captions" | "subtitles" | "overlays";
  index: number;
  from: number;
  duration: number;
  idPrefix: string;
}) {
  const { t } = useT();
  const { fps, edit } = useEditor();
  const key = (field: string) => typing(`${kind}:${index}:${field}`);
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField
        id={`${idPrefix}-start`}
        label={t("editor.cue.start")}
        unit="s"
        value={from / fps}
        min={0}
        onCommit={(sec) => edit((tl) => setCueStart(tl, kind, index, Math.round(sec * fps)), key("start"))}
      />
      <NumberField
        id={`${idPrefix}-dur`}
        label={t("editor.cue.duration")}
        unit="s"
        value={duration / fps}
        min={1 / fps}
        onCommit={(sec) =>
          edit((tl) => setCueDuration(tl, kind, index, Math.max(1, Math.round(sec * fps))), key("dur"))
        }
      />
    </div>
  );
}

/**
 * Id ô sửa chữ CHÍNH của mục đang chọn - nhấp đúp trên khung xem trước đưa
 * con trỏ vào đây. Khớp id các form bên dưới; null = mục không có chữ.
 */
export function primaryTextFieldId(sel: Selection): string | null {
  switch (sel.kind) {
    case "caption":
      return `cap-${sel.index}-sentence`;
    case "subtitle":
      return `sub-${sel.index}-text`;
    case "overlay":
      return `ov-${sel.index}-p0`;
    case "layer":
      return `layer-${sel.id}-text`;
    default:
      return null;
  }
}

/**
 * Vị trí & cỡ của MỘT cue so với chỗ neo mặc định của track (engine:
 * components/cueTransform.ts). Kéo trên khung xem trước ghi cùng field này;
 * "Áp dụng cho tất cả" chép sang mọi cue cùng loại - karaoke cả trăm cụm thì
 * không ai kéo từng cụm.
 */
function CuePositionSection({
  kind,
  index,
  cue,
  idPrefix,
}: {
  kind: CueKind;
  index: number;
  cue: { transform?: unknown };
  idPrefix: string;
}) {
  const { t } = useT();
  const { edit } = useEditor();
  const tr = readRecord(cue.transform) as TimelineCueTransform;
  const x = typeof tr.x === "number" ? tr.x : 0;
  const y = typeof tr.y === "number" ? tr.y : 0;
  const scale = typeof tr.scale === "number" ? tr.scale : 1;
  const moved = x !== 0 || y !== 0 || scale !== 1;
  const key = (field: string) => typing(`${kind}:${index}:transform:${field}`);
  const set = (patch: { x?: number; y?: number; scale?: number }, field: string) =>
    edit((tl) => setCueTransform(tl, kind, index, { ...cueTransformOf(tl, kind, index), ...patch }), key(field));
  const allLabel =
    kind === "captions"
      ? t("editor.cue.apply-all-caption")
      : kind === "subtitles"
        ? t("editor.cue.apply-all-subtitle")
        : t("editor.cue.apply-all-overlay");

  return (
    <Panel
      title={t("editor.cue.position")}
      actions={moved ? <ResetButton onClick={() => edit((tl) => setCueTransform(tl, kind, index, null))} /> : undefined}
    >
      <p className="text-meta text-[var(--text-muted)]">{t("editor.cue.position-hint")}</p>
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          id={`${idPrefix}-x`}
          label={t("editor.cue.x")}
          unit="%"
          digits={1}
          step={0.5}
          value={x * 100}
          min={-100}
          max={100}
          onCommit={(v) => set({ x: v / 100 }, "x")}
        />
        <NumberField
          id={`${idPrefix}-y`}
          label={t("editor.cue.y")}
          unit="%"
          digits={1}
          step={0.5}
          value={y * 100}
          min={-100}
          max={100}
          onCommit={(v) => set({ y: v / 100 }, "y")}
        />
        <NumberField
          id={`${idPrefix}-scale`}
          label={t("editor.cue.scale")}
          unit="%"
          digits={0}
          step={1}
          value={scale * 100}
          min={CUE_SCALE_MIN * 100}
          max={CUE_SCALE_MAX * 100}
          onCommit={(v) => set({ scale: v / 100 }, "scale")}
        />
      </div>
      <div>
        <Button variant="secondary" small onClick={() => edit((tl) => applyCueTransformToAll(tl, kind, index))}>
          <CopyCheck size={14} strokeWidth={2} />
          {allLabel}
        </Button>
      </div>
    </Panel>
  );
}

// ================================================================ karaoke

/** Cả câu karaoke một lượt - giữ số từ thì giữ mốc, đổi số từ thì chia lại (ops.setCaptionText). */
function CaptionSentenceField({ index, cue, idPrefix }: { index: number; cue: TimelineCaptionCue; idPrefix: string }) {
  const { t } = useT();
  const { edit } = useEditor();
  return (
    <TextField
      id={`${idPrefix}-sentence`}
      label={t("editor.caption.sentence")}
      hint={t("editor.caption.sentence-hint")}
      // Ghi khi chốt: ghi sống thì chữ gõ dở (xóa hết một từ rồi gõ lại) đổi số
      // từ giữa chừng → mốc karaoke cả câu bị chia lại dù câu cuối vẫn đủ số từ
      commitOnBlur
      value={cue.words.map((w) => w.text).join(" ")}
      onCommit={(text) => edit((tl) => setCaptionText(tl, index, text), typing(`captions:${index}:sentence`))}
    />
  );
}

function CaptionForm({ index, cue }: { index: number; cue: TimelineCaptionCue }) {
  const { t, tf } = useT();
  const { fps, edit } = useEditor();
  const [wordIndex, setWordIndex] = useState(0);
  const safeIndex = Math.min(wordIndex, cue.words.length - 1);
  const word = cue.words[safeIndex];
  const id = `cap-${index}`;
  const key = (field: string) => typing(`captions:${index}:w${safeIndex}:${field}`);
  const cueEnd = cue.from + cue.durationInFrames;
  // Từ không được chồng lên từ bên cạnh: karaoke tô từng từ theo mốc, hai từ
  // chồng nhau là hai từ sáng cùng lúc
  const prevWord = cue.words[safeIndex - 1];
  const nextWord = cue.words[safeIndex + 1];
  const startMin = prevWord ? Math.max(cue.from, prevWord.end) : cue.from;
  const endMax = nextWord ? Math.min(cueEnd, nextWord.start) : cueEnd;

  useEffect(() => {
    if (wordIndex !== safeIndex) setWordIndex(safeIndex);
  }, [wordIndex, safeIndex]);

  return (
    <>
      <CaptionSentenceField index={index} cue={cue} idPrefix={id} />
      <CueTimingFields
        kind="captions"
        index={index}
        from={cue.from}
        duration={cue.durationInFrames}
        idPrefix={id}
      />
      <Field label={t("editor.caption.words")} hint={t("editor.caption.words-hint")}>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("editor.caption.words")}>
          {cue.words.map((w, i) => (
            <button
              key={i}
              type="button"
              className={`word-chip ${w.hi ? "is-hi" : ""}`}
              aria-pressed={i === safeIndex}
              onClick={() => setWordIndex(i)}
            >
              {w.text}
            </button>
          ))}
        </div>
      </Field>
      {word && (
        <Panel
          title={tf("editor.caption.word-n", { n: safeIndex + 1, total: cue.words.length })}
          actions={
            <div className="flex items-center gap-1">
              <IconButton
                label={t("editor.caption.add-word")}
                onClick={() => {
                  edit((tl) => insertCaptionWord(tl, index, safeIndex, t("editor.caption.new-word")));
                  setWordIndex(safeIndex + 1);
                }}
              >
                <Plus size={16} strokeWidth={1.75} />
              </IconButton>
              <IconButton
                label={t("editor.caption.remove-word")}
                tone="danger"
                disabled={cue.words.length <= 1}
                onClick={() => edit((tl) => removeCaptionWord(tl, index, safeIndex))}
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </IconButton>
            </div>
          }
        >
          <TextField
            id={`${id}-w-text`}
            label={t("editor.caption.word-text")}
            value={word.text}
            onCommit={(text) => edit((tl) => patchCaptionWord(tl, index, safeIndex, { text }), key("text"))}
          />
          <SwitchField
            id={`${id}-w-hi`}
            label={t("editor.caption.word-hi")}
            hint={t("editor.caption.word-hi-hint")}
            checked={word.hi === true}
            onChange={(on) =>
              edit((tl) => patchCaptionWord(tl, index, safeIndex, { hi: on ? true : undefined }))
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id={`${id}-w-start`}
              label={t("editor.caption.word-start")}
              unit="s"
              value={word.start / fps}
              min={startMin / fps}
              max={cueEnd / fps}
              validate={(v) =>
                Math.round(v * fps) > word.end ? t("editor.caption.start-after-end") : null
              }
              onCommit={(sec) =>
                edit((tl) => patchCaptionWord(tl, index, safeIndex, { start: Math.round(sec * fps) }), key("start"))
              }
            />
            <NumberField
              id={`${id}-w-end`}
              label={t("editor.caption.word-end")}
              unit="s"
              value={word.end / fps}
              min={cue.from / fps}
              max={endMax / fps}
              validate={(v) =>
                Math.round(v * fps) < word.start ? t("editor.caption.end-before-start") : null
              }
              onCommit={(sec) =>
                edit((tl) => patchCaptionWord(tl, index, safeIndex, { end: Math.round(sec * fps) }), key("end"))
              }
            />
          </div>
        </Panel>
      )}
      <CuePositionSection kind="captions" index={index} cue={cue} idPrefix={id} />
    </>
  );
}

// ================================================================ phụ đề

function SubtitleForm({
  index,
  cue,
  timeline,
}: {
  index: number;
  cue: TimelineSubtitleCue;
  timeline: Timeline;
}) {
  const { t } = useT();
  const { edit, vertical } = useEditor();
  const id = `sub-${index}`;
  const style = timeline.subtitleStyle ?? {};
  const styleKey = (field: string) => typing(`subtitleStyle:${field}`);
  const fonts = SUBTITLE_FONTS;
  const fontLabel = (f: (typeof SUBTITLE_FONTS)[number]): string => {
    switch (f) {
      case "vietnamese":
        return t("tv.font.vietnamese");
      case "sans":
        return t("tv.font.sans");
      case "serif":
        return t("tv.font.serif");
      case "mono":
        return t("tv.font.mono");
    }
  };
  const font = typeof style.fontFamily === "string" ? style.fontFamily : "vietnamese";

  return (
    <>
      <TextField
        id={`${id}-text`}
        label={t("editor.subtitle.text")}
        hint={t("editor.subtitle.text-hint")}
        multiline
        value={cue.text}
        onCommit={(text) => edit((tl) => patchSubtitle(tl, index, { text }), typing(`subtitles:${index}:text`))}
      />
      <CueTimingFields
        kind="subtitles"
        index={index}
        from={cue.from}
        duration={cue.durationInFrames}
        idPrefix={id}
      />
      <CuePositionSection kind="subtitles" index={index} cue={cue} idPrefix={id} />
      <Panel
        title={t("editor.subtitle.style")}
        actions={
          timeline.subtitleStyle ? (
            <Button variant="secondary" small onClick={() => edit((tl) => setSubtitleStyle(tl, null))}>
              <RotateCcw size={14} strokeWidth={2} />
              {t("editor.subtitle.style-reset")}
            </Button>
          ) : undefined
        }
      >
        <p className="text-meta text-[var(--text-muted)]">{t("editor.subtitle.style-hint")}</p>
        <Field label={t("tv.font")} htmlFor={`${id}-font`}>
          <select
            id={`${id}-font`}
            className="input"
            value={font}
            onChange={(e) => edit((tl) => setSubtitleStyle(tl, { fontFamily: e.target.value }))}
          >
            {!fonts.some((f) => f === font) && <option value={font}>{font}</option>}
            {fonts.map((f) => (
              <option key={f} value={f}>
                {fontLabel(f)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("tv.backdrop")}>
          <Segmented
            label={t("tv.backdrop")}
            value={style.backdrop ?? "blur"}
            onChange={(backdrop) => edit((tl) => setSubtitleStyle(tl, { backdrop }))}
            options={[
              { value: "blur", label: t("tv.backdrop.blur") },
              { value: "solid", label: t("tv.backdrop.solid") },
              { value: "none", label: t("tv.backdrop.none") },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id={`${id}-size`}
            label={t("editor.subtitle.size")}
            unit="px"
            digits={0}
            step={1}
            value={typeof style.fontSizePx === "number" ? style.fontSizePx : 62}
            min={16}
            max={160}
            onCommit={(v) => edit((tl) => setSubtitleStyle(tl, { fontSizePx: Math.round(v) }), styleKey("size"))}
          />
          <NumberField
            id={`${id}-bottom`}
            label={t("editor.subtitle.bottom")}
            unit="px"
            digits={0}
            step={1}
            value={typeof style.bottomPx === "number" ? style.bottomPx : vertical ? 320 : 130}
            min={0}
            max={600}
            onCommit={(v) => edit((tl) => setSubtitleStyle(tl, { bottomPx: Math.round(v) }), styleKey("bottom"))}
          />
        </div>
      </Panel>
    </>
  );
}

// ================================================================ highlight

function OverlayForm({ index, cue }: { index: number; cue: TimelineHighlightCue }) {
  const { t, tf } = useT();
  const { edit } = useEditor();
  const id = `ov-${index}`;
  const key = (field: string) => typing(`overlays:${index}:${field}`);

  return (
    <>
      <TextField
        id={`${id}-kicker`}
        label={t("editor.overlay.kicker")}
        hint={t("editor.overlay.kicker-hint")}
        required={false}
        value={cue.kicker ?? ""}
        onCommit={(kicker) =>
          edit((tl) => patchOverlay(tl, index, { kicker: kicker.trim() ? kicker : undefined }), key("kicker"))
        }
      />
      <Field label={t("editor.overlay.parts")} hint={t("editor.overlay.parts-hint")}>
        <div className="flex flex-col gap-2">
          {cue.parts.map((part, i) => (
            <PartRow key={i} cueIndex={index} partIndex={i} text={part.t} hi={part.hi === true} canRemove={cue.parts.length > 1} label={tf("editor.overlay.part-n", { n: i + 1 })} />
          ))}
          <div>
            <Button
              variant="secondary"
              small
              onClick={() =>
                edit((tl) => insertHighlightPart(tl, index, cue.parts.length - 1, t("editor.overlay.new-part")))
              }
            >
              <Plus size={14} strokeWidth={2} />
              {t("editor.overlay.add-part")}
            </Button>
          </div>
        </div>
      </Field>
      <div className="flex flex-col gap-3">
        <Field label={t("editor.overlay.tier")}>
          <Segmented
            label={t("editor.overlay.tier")}
            value={cue.tier ?? "main"}
            onChange={(tier) => edit((tl) => patchOverlay(tl, index, { tier }))}
            options={[
              { value: "main", label: t("editor.overlay.tier-main") },
              { value: "sub", label: t("editor.overlay.tier-sub") },
            ]}
          />
        </Field>
        <Field label={t("editor.overlay.accent")}>
          <Segmented
            label={t("editor.overlay.accent")}
            value={cue.accent ?? "hot"}
            onChange={(accent) => edit((tl) => patchOverlay(tl, index, { accent }))}
            options={[
              { value: "hot", label: t("editor.overlay.accent-hot") },
              { value: "cool", label: t("editor.overlay.accent-cool") },
            ]}
          />
        </Field>
      </div>
      <CueTimingFields
        kind="overlays"
        index={index}
        from={cue.from}
        duration={cue.durationInFrames}
        idPrefix={id}
      />
      <CuePositionSection kind="overlays" index={index} cue={cue} idPrefix={id} />
    </>
  );
}

function PartRow({
  cueIndex,
  partIndex,
  text,
  hi,
  canRemove,
  label,
}: {
  cueIndex: number;
  partIndex: number;
  text: string;
  hi: boolean;
  canRemove: boolean;
  label: string;
}) {
  const { t } = useT();
  const { edit, endCoalesce } = useEditor();
  const [value, setValue] = useState(text);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(false);
  const [synced, setSynced] = useState(text);
  if (!focused && text !== synced) {
    setSynced(text);
    setValue(text);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          id={`ov-${cueIndex}-p${partIndex}`}
          className="input min-w-0 flex-1"
          aria-label={label}
          aria-invalid={error || undefined}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setError(false);
            setValue(text);
            endCoalesce();
          }}
          onChange={(e) => {
            setValue(e.target.value);
            if (e.target.value === "") {
              setError(true);
              return;
            }
            setError(false);
            const next = e.target.value;
            edit((tl) => patchHighlightPart(tl, cueIndex, partIndex, { t: next }), typing(`overlays:${cueIndex}:p${partIndex}`));
          }}
        />
        <IconButton
          label={t("editor.overlay.part-hi")}
          aria-pressed={hi}
          className={hi ? "text-[var(--primary)]" : ""}
          onClick={() =>
            edit((tl) => patchHighlightPart(tl, cueIndex, partIndex, { hi: hi ? undefined : true }))
          }
        >
          <Highlighter size={16} strokeWidth={1.75} />
        </IconButton>
        <IconButton
          label={t("editor.overlay.remove-part")}
          tone="danger"
          disabled={!canRemove}
          onClick={() => edit((tl) => removeHighlightPart(tl, cueIndex, partIndex))}
        >
          <X size={16} strokeWidth={1.75} />
        </IconButton>
      </div>
      {error && <p className="text-meta text-[var(--danger)]">{t("editor.field.required")}</p>}
    </div>
  );
}

// ================================================================ âm thanh

function SfxForm({ index, sfx, preview }: { index: number; sfx: TimelineSfx; preview: TimelinePreview }) {
  const { t } = useT();
  const { fps, edit } = useEditor();
  const id = `sfx-${index}`;
  const key = (field: string) => typing(`sfx:${index}:${field}`);
  const mediaSec = preview.media[sfx.file]?.durationSec ?? null;
  return (
    <>
      <ReadOnlyRow label={t("editor.audio.file")}>
        <span className="text-meta">{sfx.file}</span>
        <MediaLength path={sfx.file} preview={preview} />
      </ReadOnlyRow>
      <NumberField
        id={`${id}-at`}
        label={t("editor.sfx.at")}
        unit="s"
        value={sfx.atFrame / fps}
        min={0}
        onCommit={(sec) => edit((tl) => patchSfx(tl, index, { atFrame: Math.max(0, Math.round(sec * fps)) }), key("at"))}
      />
      <VolumeField
        id={`${id}-vol`}
        label={t("editor.audio.volume")}
        hint={sfx.volume === undefined ? t("editor.sfx.volume-default") : undefined}
        value={sfx.volume ?? 0.3}
        onCommit={(volume) => edit((tl) => patchSfx(tl, index, { volume }), key("vol"))}
      />
      <NumberField
        id={`${id}-skip`}
        label={t("editor.sfx.media-start")}
        hint={t("editor.sfx.media-start-hint")}
        unit="s"
        value={sfx.mediaStart ?? 0}
        min={0}
        max={mediaSec ?? Number.POSITIVE_INFINITY}
        onCommit={(sec) =>
          edit((tl) => patchSfx(tl, index, { mediaStart: sec > 0 ? Math.round(sec * 1000) / 1000 : undefined }), key("skip"))
        }
      />
    </>
  );
}

function MusicForm({ timeline, preview }: { timeline: Timeline; preview: TimelinePreview }) {
  const { t, tf } = useT();
  const { edit } = useEditor();
  const music = timeline.audio.music;
  if (!music) return null;
  return (
    <>
      <ReadOnlyRow label={t("editor.audio.file")}>
        <span className="text-meta">{music.file}</span>
        <MediaLength path={music.file} preview={preview} />
      </ReadOnlyRow>
      <VolumeField
        id="music-vol"
        label={t("editor.music.volume")}
        hint={t("editor.music.volume-hint")}
        value={music.volume ?? 0.35}
        onCommit={(volume) => edit((tl) => patchMusic(tl, { volume }), typing("music:vol"))}
      />
      <VolumeField
        id="music-duck"
        label={t("editor.music.duck")}
        hint={t("editor.music.duck-hint")}
        value={music.duckVolume ?? 0.12}
        onCommit={(duckVolume) => edit((tl) => patchMusic(tl, { duckVolume }), typing("music:duck"))}
      />
      <p className="text-meta text-[var(--text-muted)]">
        {tf("editor.music.speech", { n: Array.isArray(music.speech) ? music.speech.length : 0 })}
      </p>
    </>
  );
}

function VoiceForm({ timeline, preview }: { timeline: Timeline; preview: TimelinePreview }) {
  const { t } = useT();
  const voice = timeline.audio.voice;
  if (!voice) return null;
  return (
    <>
      <ReadOnlyRow label={t("editor.audio.file")}>
        <span className="text-meta">{baseName(voice)}</span>
        <MediaLength path={voice} preview={preview} />
      </ReadOnlyRow>
      <p className="text-meta text-[var(--text-muted)]">{t("editor.voice.hint")}</p>
    </>
  );
}

// ================================================================ v2: phần dùng chung scene + layer

/** Ghi một patch NÔNG; `coalesce` = tên ô (cùng tên liên tiếp = một bước hoàn tác). */
type Patcher = (patch: Record<string, unknown>, coalesce?: string) => void;

const scenePatcher =
  (actions: InspectorActions, id: string): Patcher =>
  (patch, coalesce) =>
    actions.patchScene(
      id,
      patch as unknown as Partial<TimelineScene>,
      coalesce ? { coalesce: `scene:${id}:${coalesce}` } : undefined,
    );

const layerPatcher =
  (actions: InspectorActions, id: string): Patcher =>
  (patch, coalesce) =>
    actions.patchLayer(
      id,
      patch as unknown as Partial<TimelineLayer>,
      coalesce ? { coalesce: `layer:${id}:${coalesce}` } : undefined,
    );

/** Object lồng đọc phòng thủ (meta.json do AI ghi có thể sai kiểu). */
function readRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

const readNum = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const readStr = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/**
 * Object lồng mới = bản cũ (giữ field lạ) + thay đổi; field `undefined` hoặc
 * bằng mặc định bị bỏ; rỗng hết → undefined (patch xóa luôn khóa - meta.json
 * không đọng `transform: {}` sau khi người dùng kéo về chỗ cũ).
 */
function mergeNested(
  old: unknown,
  changes: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const next: Record<string, unknown> = { ...readRecord(old), ...changes };
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined || (k in defaults && defaults[k] === v)) delete next[k];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

const TRANSFORM_DEFAULTS = { x: 0, y: 0, scale: 1, rotate: 0, flipH: false, flipV: false };
const CROP_DEFAULTS = { top: 0, right: 0, bottom: 0, left: 0 };
const COLOR_DEFAULTS = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  hue: 0,
  vignette: 0,
  blur: 0,
};
const ANIM_DEFAULTS = { in: "none", out: "none", durationSec: LAYER_DEFAULTS.animationSec };

/**
 * Màu mặc định ENGINE vẽ khi field vắng mặt - là DỮ LIỆU của video (ô chọn màu
 * cần một giá trị #rrggbb để hiện), không phải màu giao diện.
 */
const VIDEO_WHITE = "#ffffff";
const VIDEO_BLACK = "#000000";
const VIDEO_SHAPE = "#ed3c47";
/**
 * Cỡ chữ engine vẽ khi layer chữ chưa khai: 6% cạnh ngắn của khung. Mọi khung
 * project (1080x1920, 1920x1080, 1080x1080, 1080x1350) đều có cạnh ngắn 1080.
 */
const DEFAULT_TEXT_PX = defaultFontSizePx(1080, 1080);

/** 14 preset của apps/server/src/color.ts - thứ tự giữ như server. */
const COLOR_PRESETS = [
  "tu-nhien",
  "tuoi-sang",
  "vivid",
  "cinematic",
  "teal-orange",
  "film-vintage",
  "mau-phim",
  "golden-hour",
  "am",
  "lanh",
  "dem-xanh",
  "moody",
  "pastel",
  "den-trang",
] as const;

function usePresetLabel(): (id: string) => string {
  const { t } = useT();
  const labels: Record<string, string> = {
    "tu-nhien": t("editor.inspector2.preset.tu-nhien"),
    "tuoi-sang": t("editor.inspector2.preset.tuoi-sang"),
    vivid: t("editor.inspector2.preset.vivid"),
    cinematic: t("editor.inspector2.preset.cinematic"),
    "teal-orange": t("editor.inspector2.preset.teal-orange"),
    "film-vintage": t("editor.inspector2.preset.film-vintage"),
    "mau-phim": t("editor.inspector2.preset.mau-phim"),
    "golden-hour": t("editor.inspector2.preset.golden-hour"),
    am: t("editor.inspector2.preset.am"),
    lanh: t("editor.inspector2.preset.lanh"),
    "dem-xanh": t("editor.inspector2.preset.dem-xanh"),
    moody: t("editor.inspector2.preset.moody"),
    pastel: t("editor.inspector2.preset.pastel"),
    "den-trang": t("editor.inspector2.preset.den-trang"),
  };
  return (id) => labels[id] ?? id;
}

const TRANSITION_TYPES = [
  "fade",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "wipe-left",
  "wipe-right",
  "zoom-in",
  "zoom-out",
  "blur",
  "none",
] as const;
type TransitionKind = (typeof TRANSITION_TYPES)[number];

function useTransitionLabel(): (type: TransitionKind) => string {
  const { t } = useT();
  return (type) => {
    switch (type) {
      case "fade":
        return t("editor.inspector2.tr.fade");
      case "slide-left":
        return t("editor.inspector2.tr.slide-left");
      case "slide-right":
        return t("editor.inspector2.tr.slide-right");
      case "slide-up":
        return t("editor.inspector2.tr.slide-up");
      case "slide-down":
        return t("editor.inspector2.tr.slide-down");
      case "wipe-left":
        return t("editor.inspector2.tr.wipe-left");
      case "wipe-right":
        return t("editor.inspector2.tr.wipe-right");
      case "zoom-in":
        return t("editor.inspector2.tr.zoom-in");
      case "zoom-out":
        return t("editor.inspector2.tr.zoom-out");
      case "blur":
        return t("editor.inspector2.tr.blur");
      case "none":
        return t("editor.inspector2.tr.none");
    }
  };
}

const LAYER_ANIMS = ["none", "fade", "slide-up", "slide-down", "slide-left", "slide-right", "pop", "zoom"] as const;
type LayerAnimKind = (typeof LAYER_ANIMS)[number];

function useAnimLabel(): (anim: LayerAnimKind) => string {
  const { t } = useT();
  return (anim) => {
    switch (anim) {
      case "none":
        return t("editor.inspector2.anim.none");
      case "fade":
        return t("editor.inspector2.anim.fade");
      case "slide-up":
        return t("editor.inspector2.anim.slide-up");
      case "slide-down":
        return t("editor.inspector2.anim.slide-down");
      case "slide-left":
        return t("editor.inspector2.anim.slide-left");
      case "slide-right":
        return t("editor.inspector2.anim.slide-right");
      case "pop":
        return t("editor.inspector2.anim.pop");
      case "zoom":
        return t("editor.inspector2.anim.zoom");
    }
  };
}

function ResetButton({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <Button variant="secondary" small onClick={onClick}>
      <RotateCcw size={14} strokeWidth={2} />
      {t("editor.inspector2.reset")}
    </Button>
  );
}

/**
 * Khung hình: vị trí / cỡ / xoay / lật (+ vừa khung, cắt cạnh với ảnh/video).
 * `width` chỉ layer có (bề rộng hộp theo khung); scene luôn là cả khung.
 */
function FrameSection({
  target,
  idPrefix,
  media,
  patch,
  layerWidth,
  keyframed = false,
}: {
  target: object;
  idPrefix: string;
  /** Có ảnh/video bên trong - hiện "vừa khung" + cắt cạnh */
  media: boolean;
  patch: Patcher;
  /** Layer: bề rộng mặc định của hộp (engine) - bỏ trống với scene */
  layerWidth?: number;
  /** Layer có keyframe: giá trị ở đây chỉ là giá trị gốc */
  keyframed?: boolean;
}) {
  const { t } = useT();
  const obj = target as Record<string, unknown>;
  const tr = readRecord(obj.transform);
  const crop = readRecord(obj.crop);
  const fit = obj.fit === "contain" ? "contain" : "cover";
  const setTr = (changes: Record<string, unknown>, key?: string) =>
    patch({ transform: mergeNested(obj.transform, changes, TRANSFORM_DEFAULTS) }, key ? `tr-${key}` : undefined);
  const setCrop = (side: string, v: number) =>
    patch({ crop: mergeNested(obj.crop, { [side]: v }, CROP_DEFAULTS) }, `crop-${side}`);
  const flipH = tr.flipH === true;
  const flipV = tr.flipV === true;
  const changed = obj.transform !== undefined || obj.crop !== undefined || obj.fit !== undefined;

  return (
    <Panel
      title={t("editor.inspector2.frame")}
      actions={
        changed ? (
          <ResetButton onClick={() => patch({ transform: undefined, crop: undefined, fit: undefined })} />
        ) : undefined
      }
    >
      {keyframed && <p className="text-meta text-[var(--text-muted)]">{t("editor.inspector2.keyframed-hint")}</p>}
      {media && (
        <Field label={t("editor.inspector2.fit")}>
          <Segmented
            label={t("editor.inspector2.fit")}
            value={fit}
            onChange={(v) => patch({ fit: v === "cover" ? undefined : v })}
            options={[
              { value: "cover", label: t("editor.inspector2.fit-cover") },
              { value: "contain", label: t("editor.inspector2.fit-contain") },
            ]}
          />
        </Field>
      )}
      {layerWidth !== undefined && (
        <SliderField
          id={`${idPrefix}-width`}
          label={t("editor.inspector2.width")}
          hint={t("editor.inspector2.width-hint")}
          value={readNum(obj.width, layerWidth)}
          min={0.05}
          max={2}
          step={0.01}
          scale={100}
          unit="%"
          onChange={(v) => patch({ width: v }, "width")}
        />
      )}
      <SliderField
        id={`${idPrefix}-x`}
        label={t("editor.inspector2.x")}
        value={readNum(tr.x, 0)}
        min={-1}
        max={1}
        step={0.005}
        scale={100}
        digits={1}
        unit="%"
        onChange={(v) => setTr({ x: v }, "x")}
      />
      <SliderField
        id={`${idPrefix}-y`}
        label={t("editor.inspector2.y")}
        value={readNum(tr.y, 0)}
        min={-1}
        max={1}
        step={0.005}
        scale={100}
        digits={1}
        unit="%"
        onChange={(v) => setTr({ y: v }, "y")}
      />
      <SliderField
        id={`${idPrefix}-scale`}
        label={t("editor.inspector2.scale")}
        value={readNum(tr.scale, 1)}
        min={0.1}
        max={5}
        step={0.01}
        digits={2}
        unit="×"
        onChange={(v) => setTr({ scale: v }, "scale")}
      />
      <SliderField
        id={`${idPrefix}-rotate`}
        label={t("editor.inspector2.rotate")}
        value={readNum(tr.rotate, 0)}
        min={-180}
        max={180}
        step={1}
        unit="°"
        onChange={(v) => setTr({ rotate: v }, "rotate")}
      />
      <Field label={t("editor.inspector2.flip")}>
        <div className="flex items-center gap-1">
          <IconButton
            label={t("editor.inspector2.flip-h")}
            aria-pressed={flipH}
            className={flipH ? "text-[var(--primary)]" : ""}
            onClick={() => setTr({ flipH: !flipH })}
          >
            <FlipHorizontal2 size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton
            label={t("editor.inspector2.flip-v")}
            aria-pressed={flipV}
            className={flipV ? "text-[var(--primary)]" : ""}
            onClick={() => setTr({ flipV: !flipV })}
          >
            <FlipVertical2 size={16} strokeWidth={1.75} />
          </IconButton>
        </div>
      </Field>
      {media && (
        <>
          <SliderField
            id={`${idPrefix}-crop-top`}
            label={t("editor.inspector2.crop-top")}
            value={readNum(crop.top, 0)}
            min={0}
            max={0.45}
            step={0.005}
            scale={100}
            digits={1}
            unit="%"
            onChange={(v) => setCrop("top", v)}
          />
          <SliderField
            id={`${idPrefix}-crop-bottom`}
            label={t("editor.inspector2.crop-bottom")}
            value={readNum(crop.bottom, 0)}
            min={0}
            max={0.45}
            step={0.005}
            scale={100}
            digits={1}
            unit="%"
            onChange={(v) => setCrop("bottom", v)}
          />
          <SliderField
            id={`${idPrefix}-crop-left`}
            label={t("editor.inspector2.crop-left")}
            value={readNum(crop.left, 0)}
            min={0}
            max={0.45}
            step={0.005}
            scale={100}
            digits={1}
            unit="%"
            onChange={(v) => setCrop("left", v)}
          />
          <SliderField
            id={`${idPrefix}-crop-right`}
            label={t("editor.inspector2.crop-right")}
            value={readNum(crop.right, 0)}
            min={0}
            max={0.45}
            step={0.005}
            scale={100}
            digits={1}
            unit="%"
            onChange={(v) => setCrop("right", v)}
          />
        </>
      )}
    </Panel>
  );
}

/** Chỉnh màu TRÊN TIMELINE (CSS filter trong engine - không đổi file). */
function ColorSection({ target, idPrefix, patch }: { target: object; idPrefix: string; patch: Patcher }) {
  const { t } = useT();
  const presetLabel = usePresetLabel();
  const obj = target as Record<string, unknown>;
  const color = readRecord(obj.color);
  const preset = readStr(color.preset);
  const set = (changes: Record<string, unknown>, key?: string) =>
    patch({ color: mergeNested(obj.color, changes, COLOR_DEFAULTS) }, key ? `color-${key}` : undefined);
  const known = (COLOR_PRESETS as readonly string[]).includes(preset ?? "");

  const slider = (field: keyof typeof COLOR_DEFAULTS, label: string, props: {
    min: number;
    max: number;
    step: number;
    scale?: number;
    digits?: number;
    unit?: string;
  }) => (
    <SliderField
      id={`${idPrefix}-color-${field}`}
      label={label}
      value={readNum(color[field], 0)}
      onChange={(v) => set({ [field]: v }, field)}
      {...props}
    />
  );

  return (
    <Panel
      title={t("editor.inspector2.color")}
      actions={obj.color !== undefined ? <ResetButton onClick={() => patch({ color: undefined })} /> : undefined}
    >
      <Field label={t("editor.inspector2.preset")} hint={t("editor.inspector2.preset-hint")}>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("editor.inspector2.preset")}>
          <FilterChip active={preset === null} onClick={() => set({ preset: undefined })}>
            {t("editor.inspector2.preset-none")}
          </FilterChip>
          {COLOR_PRESETS.map((id) => (
            <FilterChip key={id} active={preset === id} onClick={() => set({ preset: id })}>
              {presetLabel(id)}
            </FilterChip>
          ))}
          {preset !== null && !known && (
            <FilterChip active onClick={() => undefined}>
              {preset}
            </FilterChip>
          )}
        </div>
      </Field>
      {slider("brightness", t("editor.inspector2.brightness"), { min: -1, max: 1, step: 0.01, scale: 100 })}
      {slider("contrast", t("editor.inspector2.contrast"), { min: -1, max: 1, step: 0.01, scale: 100 })}
      {slider("saturation", t("editor.inspector2.saturation"), { min: -1, max: 1, step: 0.01, scale: 100 })}
      {slider("temperature", t("editor.inspector2.temperature"), { min: -1, max: 1, step: 0.01, scale: 100 })}
      {slider("tint", t("editor.inspector2.tint"), { min: -1, max: 1, step: 0.01, scale: 100 })}
      {slider("hue", t("editor.inspector2.hue"), { min: -180, max: 180, step: 1, unit: "°" })}
      {slider("vignette", t("editor.inspector2.vignette"), { min: 0, max: 1, step: 0.01, scale: 100, unit: "%" })}
      {slider("blur", t("editor.inspector2.blur"), { min: 0, max: 20, step: 0.5, digits: 1, unit: "px" })}
    </Panel>
  );
}

/** Âm lượng 0-200% (+ fade vào/ra với scene footage). */
function AudioLevelFields({
  target,
  idPrefix,
  disabled,
  withFades,
  patch,
}: {
  target: object;
  idPrefix: string;
  disabled: boolean;
  withFades: boolean;
  patch: Patcher;
}) {
  const { t } = useT();
  const obj = target as Record<string, unknown>;
  return (
    <>
      <SliderField
        id={`${idPrefix}-volume`}
        label={t("editor.inspector2.volume")}
        hint={disabled ? t("editor.inspector2.volume-muted") : undefined}
        value={readNum(obj.volume, 1)}
        min={0}
        max={2}
        step={0.01}
        scale={100}
        unit="%"
        disabled={disabled}
        onChange={(v) => patch({ volume: v === 1 ? undefined : v }, "volume")}
      />
      {withFades && (
        <>
          <SliderField
            id={`${idPrefix}-fade-in`}
            label={t("editor.inspector2.fade-in")}
            value={readNum(obj.fadeInSec, 0)}
            min={0}
            max={10}
            step={0.1}
            digits={1}
            unit="s"
            disabled={disabled}
            onChange={(v) => patch({ fadeInSec: v > 0 ? v : undefined }, "fade-in")}
          />
          <SliderField
            id={`${idPrefix}-fade-out`}
            label={t("editor.inspector2.fade-out")}
            value={readNum(obj.fadeOutSec, 0)}
            min={0}
            max={10}
            step={0.1}
            digits={1}
            unit="s"
            disabled={disabled}
            onChange={(v) => patch({ fadeOutSec: v > 0 ? v : undefined }, "fade-out")}
          />
        </>
      )}
    </>
  );
}

const SPEED_PRESETS = [0.5, 1, 1.5, 2] as const;

function SpeedSection({ scene, idPrefix }: { scene: TimelineScene; idPrefix: string }) {
  const { t } = useT();
  const { ops, edit } = useEditor();
  const speed = readNum(scene.speed, 1);
  // Qua setSceneSpeed (không patch thẳng `speed`): scene có durationInFrames phải
  // tính lại độ dài cùng lúc, engine ưu tiên durationInFrames hơn speed
  const write = (v: number, key?: string) =>
    edit(
      (tl) => setSceneSpeed(tl, sceneIndexById(tl, scene.id), v, ops),
      key ? typing(`scene:${scene.id}:${key}`) : undefined,
    );
  return (
    <Panel title={t("editor.inspector2.speed")}>
      <SliderField
        id={`${idPrefix}-speed`}
        label={t("editor.inspector2.speed-rate")}
        hint={t("editor.inspector2.speed-hint")}
        value={speed}
        min={0.25}
        max={4}
        step={0.05}
        digits={2}
        unit="×"
        onChange={(v) => write(v, "speed")}
      />
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("editor.inspector2.speed-rate")}>
        {SPEED_PRESETS.map((v) => (
          <FilterChip key={v} active={speed === v} onClick={() => write(v)}>
            {`${v}×`}
          </FilterChip>
        ))}
      </div>
    </Panel>
  );
}

function TransitionTypeField({
  scene,
  idPrefix,
  disabled,
  onPick,
}: {
  scene: TimelineScene;
  idPrefix: string;
  disabled: boolean;
  onPick: (type: TransitionKind) => void;
}) {
  const { t } = useT();
  const label = useTransitionLabel();
  const raw = readStr(readRecord(scene.transition).type) ?? "fade";
  const value = (TRANSITION_TYPES as readonly string[]).includes(raw) ? raw : "fade";
  return (
    <Field
      label={t("editor.inspector2.transition-type")}
      htmlFor={`${idPrefix}-tr-type`}
      hint={(scene.transitionOverlap ?? 0) <= 0 && !disabled ? t("editor.inspector2.transition-type-hint") : undefined}
    >
      <select
        id={`${idPrefix}-tr-type`}
        className="input"
        value={value}
        disabled={disabled}
        onChange={(e) => onPick(e.target.value as TransitionKind)}
      >
        {TRANSITION_TYPES.map((type) => (
          <option key={type} value={type}>
            {label(type)}
          </option>
        ))}
      </select>
    </Field>
  );
}

// ================================================================ v2: layer

function useLayerKindLabel(): (kind: string) => string {
  const { t } = useT();
  return (kind) => {
    switch (kind) {
      case "image":
        return t("editor.inspector2.kind-image");
      case "video":
        return t("editor.inspector2.kind-video");
      case "text":
        return t("editor.inspector2.kind-text");
      default:
        return t("editor.inspector2.kind-shape");
    }
  };
}

function LayerForm({ layer, actions }: { layer: TimelineLayer; actions: InspectorActions }) {
  const { t, tf } = useT();
  const { fps, ops, edit } = useEditor();
  const kindLabel = useLayerKindLabel();
  const obj = layer as unknown as Record<string, unknown>;
  const id = layer.id;
  const lid = `layer-${id}`;
  const patch = layerPatcher(actions, id);
  const kind = String(layer.kind);
  const media = kind === "image" || kind === "video";
  const keyframes = Array.isArray(layer.keyframes) ? layer.keyframes : [];
  const key = (field: string) => typing(`layer:${id}:${field}`);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="muted" dot={false} label={kindLabel(kind)} />
        <span className="min-w-0 text-meta text-[var(--text-muted)] [overflow-wrap:anywhere]">
          {tf("editor.inspector2.layer-id", { id })}
        </span>
      </div>

      {media && (
        <ReadOnlyRow label={t("editor.scene.source")}>
          <span className="text-meta">{readStr(layer.src) ?? "-"}</span>
        </ReadOnlyRow>
      )}

      {kind === "text" && (
        <TextField
          id={`${lid}-text`}
          label={t("editor.inspector2.text")}
          hint={t("editor.inspector2.text-hint")}
          multiline
          value={typeof layer.text === "string" ? layer.text : ""}
          onCommit={(text) => patch({ text }, "text")}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id={`${lid}-start`}
          label={t("editor.cue.start")}
          unit="s"
          value={layer.from / fps}
          min={0}
          onCommit={(sec) => edit((tl) => setLayerStart(tl, id, Math.round(sec * fps)), key("start"))}
        />
        <NumberField
          id={`${lid}-dur`}
          label={t("editor.cue.duration")}
          unit="s"
          value={layer.durationInFrames / fps}
          min={1 / fps}
          onCommit={(sec) =>
            edit((tl) => setLayerDuration(tl, id, Math.max(1, Math.round(sec * fps)), ops), key("dur"))
          }
        />
      </div>

      {kind === "text" && <TextStyleSection layer={layer} idPrefix={lid} patch={patch} />}
      {kind === "shape" && <ShapeStyleSection layer={layer} idPrefix={lid} patch={patch} />}

      <SliderField
        id={`${lid}-opacity`}
        label={t("editor.inspector2.opacity")}
        hint={keyframes.some((k) => typeof k?.opacity === "number") ? t("editor.inspector2.keyframed-hint") : undefined}
        value={readNum(obj.opacity, 1)}
        min={0}
        max={1}
        step={0.01}
        scale={100}
        unit="%"
        onChange={(v) => patch({ opacity: v === 1 ? undefined : v }, "opacity")}
      />

      <FrameSection
        target={layer}
        idPrefix={lid}
        media={media}
        patch={patch}
        layerWidth={LAYER_DEFAULTS.width}
        keyframed={keyframes.length > 0}
      />

      {media && (
        <NumberField
          id={`${lid}-radius`}
          label={t("editor.inspector2.radius")}
          unit="px"
          digits={0}
          step={1}
          value={readNum(obj.radiusPx, 0)}
          min={0}
          max={1000}
          onCommit={(v) => patch({ radiusPx: v > 0 ? Math.round(v) : undefined }, "radius")}
        />
      )}

      {media && <ColorSection target={layer} idPrefix={lid} patch={patch} />}

      <AnimationSection layer={layer} idPrefix={lid} patch={patch} />

      <KeyframeSection layer={layer} actions={actions} patch={patch} />

      {kind === "video" && (
        <Panel title={t("editor.inspector2.audio")}>
          <SwitchField
            id={`${lid}-muted`}
            label={t("editor.scene.muted")}
            hint={t("editor.inspector2.layer-muted-hint")}
            checked={layer.muted !== false}
            onChange={(on) => patch({ muted: on })}
          />
          <AudioLevelFields
            target={layer}
            idPrefix={lid}
            disabled={layer.muted !== false}
            withFades={false}
            patch={patch}
          />
        </Panel>
      )}
    </>
  );
}

function useFontOptions(): { value: string; label: string }[] {
  const { t } = useT();
  return SUBTITLE_FONTS.map((f) => {
    switch (f) {
      case "vietnamese":
        return { value: f, label: t("tv.font.vietnamese") };
      case "sans":
        return { value: f, label: t("tv.font.sans") };
      case "serif":
        return { value: f, label: t("tv.font.serif") };
      case "mono":
        return { value: f, label: t("tv.font.mono") };
    }
  });
}

const FONT_WEIGHTS = ["400", "600", "700", "800"] as const;

/** Viền + bóng - dùng chung cho chữ và khối màu. */
function StrokeShadowFields({
  style,
  idPrefix,
  set,
}: {
  style: Record<string, unknown>;
  idPrefix: string;
  set: (changes: Record<string, unknown>, key?: string) => void;
}) {
  const { t } = useT();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <ColorField
          id={`${idPrefix}-stroke`}
          label={t("editor.inspector2.stroke")}
          value={readStr(style.strokeColor)}
          fallback={VIDEO_BLACK}
          onChange={(v) => set({ strokeColor: v }, "stroke")}
          onClear={() => set({ strokeColor: undefined, strokeWidthPx: undefined })}
        />
        <NumberField
          id={`${idPrefix}-stroke-w`}
          label={t("editor.inspector2.stroke-width")}
          unit="px"
          digits={0}
          step={1}
          value={readNum(style.strokeWidthPx, 0)}
          min={0}
          max={60}
          onCommit={(v) => set({ strokeWidthPx: v > 0 ? Math.round(v) : undefined }, "stroke-w")}
        />
      </div>
      <SwitchField
        id={`${idPrefix}-shadow`}
        label={t("editor.inspector2.shadow")}
        checked={style.shadow === true}
        onChange={(on) => set({ shadow: on ? true : undefined })}
      />
    </>
  );
}

function TextStyleSection({ layer, idPrefix, patch }: { layer: TimelineLayer; idPrefix: string; patch: Patcher }) {
  const { t } = useT();
  const fonts = useFontOptions();
  const obj = layer as unknown as Record<string, unknown>;
  const style = readRecord(obj.style);
  const set = (changes: Record<string, unknown>, key?: string) =>
    patch({ style: mergeNested(obj.style, changes, {}) }, key ? `style-${key}` : undefined);
  const font = readStr(style.fontFamily) ?? "";
  const weight = String(readNum(style.fontWeight, 700));
  const align = style.align === "left" || style.align === "right" ? style.align : "center";

  return (
    <Panel title={t("editor.inspector2.text-style")}>
      <Field label={t("tv.font")} htmlFor={`${idPrefix}-font`}>
        <select
          id={`${idPrefix}-font`}
          className="input"
          value={font}
          onChange={(e) => set({ fontFamily: e.target.value || undefined })}
        >
          <option value="">{t("editor.inspector2.font-default")}</option>
          {font && !fonts.some((f) => f.value === font) && <option value={font}>{font}</option>}
          {fonts.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id={`${idPrefix}-size`}
          label={t("editor.inspector2.font-size")}
          unit="px"
          digits={0}
          step={1}
          value={readNum(style.fontSizePx, DEFAULT_TEXT_PX)}
          min={8}
          max={600}
          onCommit={(v) => set({ fontSizePx: Math.round(v) }, "size")}
        />
        <ColorField
          id={`${idPrefix}-color`}
          label={t("editor.inspector2.text-color")}
          value={readStr(style.color)}
          fallback={VIDEO_WHITE}
          onChange={(v) => set({ color: v }, "color")}
        />
      </div>
      <Field label={t("editor.inspector2.font-weight")}>
        <Segmented
          label={t("editor.inspector2.font-weight")}
          value={(FONT_WEIGHTS as readonly string[]).includes(weight) ? weight : "700"}
          onChange={(v) => set({ fontWeight: Number(v) })}
          options={[
            { value: "400", label: t("editor.inspector2.weight-400") },
            { value: "600", label: t("editor.inspector2.weight-600") },
            { value: "700", label: t("editor.inspector2.weight-700") },
            { value: "800", label: t("editor.inspector2.weight-800") },
          ]}
        />
      </Field>
      <Field label={t("editor.inspector2.align")}>
        <Segmented
          label={t("editor.inspector2.align")}
          value={align}
          onChange={(v) => set({ align: v })}
          options={[
            { value: "left", label: t("editor.inspector2.align-left") },
            { value: "center", label: t("editor.inspector2.align-center") },
            { value: "right", label: t("editor.inspector2.align-right") },
          ]}
        />
      </Field>
      <SliderField
        id={`${idPrefix}-lh`}
        label={t("editor.inspector2.line-height")}
        value={readNum(style.lineHeight, LAYER_DEFAULTS.lineHeight)}
        min={0.8}
        max={3}
        step={0.05}
        digits={2}
        unit="×"
        onChange={(v) => set({ lineHeight: v }, "lh")}
      />
      <div className="grid grid-cols-2 gap-3">
        <ColorField
          id={`${idPrefix}-bg`}
          label={t("editor.inspector2.text-bg")}
          value={readStr(style.backgroundColor)}
          fallback={VIDEO_BLACK}
          onChange={(v) => set({ backgroundColor: v }, "bg")}
          onClear={() => set({ backgroundColor: undefined })}
        />
        <NumberField
          id={`${idPrefix}-pad`}
          label={t("editor.inspector2.padding")}
          unit="px"
          digits={0}
          step={1}
          value={readNum(style.paddingPx, 0)}
          min={0}
          max={400}
          onCommit={(v) => set({ paddingPx: v > 0 ? Math.round(v) : undefined }, "pad")}
        />
      </div>
      <NumberField
        id={`${idPrefix}-radius`}
        label={t("editor.inspector2.radius")}
        unit="px"
        digits={0}
        step={1}
        value={readNum(style.radiusPx, 0)}
        min={0}
        max={1000}
        onCommit={(v) => set({ radiusPx: v > 0 ? Math.round(v) : undefined }, "radius")}
      />
      <StrokeShadowFields style={style} idPrefix={idPrefix} set={set} />
    </Panel>
  );
}

function ShapeStyleSection({ layer, idPrefix, patch }: { layer: TimelineLayer; idPrefix: string; patch: Patcher }) {
  const { t } = useT();
  const obj = layer as unknown as Record<string, unknown>;
  const style = readRecord(obj.style);
  const set = (changes: Record<string, unknown>, key?: string) =>
    patch({ style: mergeNested(obj.style, changes, {}) }, key ? `style-${key}` : undefined);
  return (
    <Panel title={t("editor.inspector2.shape-style")}>
      <div className="grid grid-cols-2 gap-3">
        <ColorField
          id={`${idPrefix}-fill`}
          label={t("editor.inspector2.fill")}
          value={readStr(style.backgroundColor)}
          fallback={VIDEO_SHAPE}
          onChange={(v) => set({ backgroundColor: v }, "fill")}
        />
        <NumberField
          id={`${idPrefix}-aspect`}
          label={t("editor.inspector2.aspect")}
          hint={t("editor.inspector2.aspect-hint")}
          digits={2}
          step={0.01}
          value={readNum(obj.aspect, LAYER_DEFAULTS.aspect)}
          min={0.05}
          max={20}
          onCommit={(v) => patch({ aspect: v }, "aspect")}
        />
      </div>
      <NumberField
        id={`${idPrefix}-radius`}
        label={t("editor.inspector2.radius")}
        unit="px"
        digits={0}
        step={1}
        value={readNum(style.radiusPx, 0)}
        min={0}
        max={1000}
        onCommit={(v) => set({ radiusPx: v > 0 ? Math.round(v) : undefined }, "radius")}
      />
      <StrokeShadowFields style={style} idPrefix={idPrefix} set={set} />
    </Panel>
  );
}

function AnimationSection({ layer, idPrefix, patch }: { layer: TimelineLayer; idPrefix: string; patch: Patcher }) {
  const { t } = useT();
  const animLabel = useAnimLabel();
  const obj = layer as unknown as Record<string, unknown>;
  const anim = readRecord(obj.animation);
  const pick = (v: unknown): LayerAnimKind =>
    typeof v === "string" && (LAYER_ANIMS as readonly string[]).includes(v) ? (v as LayerAnimKind) : "none";
  const animIn = pick(anim.in);
  const animOut = pick(anim.out);
  const set = (changes: Record<string, unknown>, key?: string) =>
    patch({ animation: mergeNested(obj.animation, changes, ANIM_DEFAULTS) }, key ? `anim-${key}` : undefined);
  const select = (which: "in" | "out", value: LayerAnimKind) => (
    <Field label={which === "in" ? t("editor.inspector2.anim-in") : t("editor.inspector2.anim-out")} htmlFor={`${idPrefix}-anim-${which}`}>
      <select
        id={`${idPrefix}-anim-${which}`}
        className="input"
        value={value}
        onChange={(e) => set({ [which]: e.target.value })}
      >
        {LAYER_ANIMS.map((a) => (
          <option key={a} value={a}>
            {animLabel(a)}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <Panel title={t("editor.inspector2.animation")}>
      <div className="grid grid-cols-2 gap-3">
        {select("in", animIn)}
        {select("out", animOut)}
      </div>
      <SliderField
        id={`${idPrefix}-anim-dur`}
        label={t("editor.inspector2.anim-duration")}
        value={readNum(anim.durationSec, LAYER_DEFAULTS.animationSec)}
        min={0.1}
        max={3}
        step={0.05}
        digits={2}
        unit="s"
        disabled={animIn === "none" && animOut === "none"}
        onChange={(v) => set({ durationSec: v }, "dur")}
      />
    </Panel>
  );
}

const KF_EASES = ["linear", "in", "out", "inOut"] as const;

function KeyframeSection({
  layer,
  actions,
  patch,
}: {
  layer: TimelineLayer;
  actions: InspectorActions;
  patch: Patcher;
}) {
  const { t, tf } = useT();
  const { fps, seek } = useEditor();
  const raw: TimelineLayerKeyframe[] = Array.isArray(layer.keyframes) ? layer.keyframes : [];
  const list = raw
    .filter((k) => !!k && typeof k === "object" && typeof k.frame === "number" && Number.isFinite(k.frame))
    .sort((a, b) => a.frame - b.frame);
  const props = (k: TimelineLayerKeyframe): string =>
    (
      [
        ["x", t("editor.inspector2.kf-x")],
        ["y", t("editor.inspector2.kf-y")],
        ["scale", t("editor.inspector2.kf-scale")],
        ["rotate", t("editor.inspector2.kf-rotate")],
        ["opacity", t("editor.inspector2.kf-opacity")],
      ] as const
    )
      .filter(([p]) => typeof k[p] === "number")
      .map(([, label]) => label)
      .join(" · ");
  const setEase = (frame: number, ease: string) =>
    patch({
      keyframes: raw.map((k) => {
        if (k?.frame !== frame) return k;
        const next: Record<string, unknown> = { ...k };
        if (ease === "linear") delete next.ease;
        else next.ease = ease;
        return next;
      }),
    });
  const easeLabel = (e: (typeof KF_EASES)[number]): string => {
    switch (e) {
      case "linear":
        return t("editor.zoom.ease-linear");
      case "in":
        return t("editor.inspector2.ease-in");
      case "out":
        return t("editor.zoom.ease-out");
      case "inOut":
        return t("editor.zoom.ease-inout");
    }
  };

  return (
    <Panel
      title={tf("editor.inspector2.keyframes", { n: list.length })}
      actions={<KeyframeAddButton layer={layer} list={list} actions={actions} />}
    >
      {list.length === 0 ? (
        <p className="text-meta text-[var(--text-muted)]">{t("editor.inspector2.kf-empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((k) => (
            <li key={k.frame} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm tabular-nums">{`${fmtNumber(k.frame / fps)}s`}</p>
                <p className="truncate text-meta text-[var(--text-muted)]">{props(k) || "-"}</p>
              </div>
              <select
                className="input w-28 shrink-0"
                aria-label={t("editor.inspector2.kf-ease")}
                value={typeof k.ease === "string" && (KF_EASES as readonly string[]).includes(k.ease) ? k.ease : "linear"}
                onChange={(e) => setEase(k.frame, e.target.value)}
              >
                {KF_EASES.map((e) => (
                  <option key={e} value={e}>
                    {easeLabel(e)}
                  </option>
                ))}
              </select>
              <IconButton label={t("editor.inspector2.kf-jump")} onClick={() => seek(layer.from + k.frame)}>
                <Crosshair size={16} strokeWidth={1.75} />
              </IconButton>
              <IconButton
                label={t("editor.inspector2.kf-remove")}
                tone="danger"
                onClick={() => actions.layerKeyframe(layer.id, "remove", k.frame)}
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <p className="text-meta text-[var(--text-muted)]">{t("editor.inspector2.kf-hint")}</p>
    </Panel>
  );
}

/**
 * Nút "Thêm keyframe tại playhead" - component riêng vì nó theo playhead từng
 * frame: để trong LayerForm là cả form render lại 60 lần/giây lúc phát.
 */
function KeyframeAddButton({
  layer,
  list,
  actions,
}: {
  layer: TimelineLayer;
  list: TimelineLayerKeyframe[];
  actions: InspectorActions;
}) {
  const { t } = useT();
  const { playback, readOnly } = useEditor();
  const frame = usePlayheadFrame(playback);
  const rel = frame - layer.from;
  const inside = rel >= 0 && rel < layer.durationInFrames;
  const exists = list.some((k) => k.frame === rel);
  return (
    <Button
      variant="secondary"
      small
      disabled={readOnly || !inside}
      title={inside ? undefined : t("editor.inspector2.kf-outside")}
      onClick={() => actions.layerKeyframe(layer.id, "add", rel)}
    >
      <Plus size={14} strokeWidth={2} />
      {exists ? t("editor.inspector2.kf-update") : t("editor.inspector2.kf-add")}
    </Button>
  );
}
