"use client";

/**
 * Khóa track của trình chỉnh sửa: track đã khóa thì không kéo, không sửa, không
 * xóa, không thêm vào được - vẫn bấm chọn để XEM trong inspector.
 *
 * Chặn ở hai tầng:
 * - Giao diện (timeline không cho kéo, nút "+" tắt, inspector chỉ đọc, khung xem
 *   trước không cho kéo) để người dùng thấy ngay là đang khóa.
 * - `edit()` của VideoEditor so dữ liệu của mọi track đã khóa trước/sau thao tác
 *   (`lockedChange`) và BỎ cả thao tác nếu có track khóa bị đổi - phím tắt, dán,
 *   AI chèn tại mốc… không chỗ nào phải tự nhớ kiểm.
 *
 * Trạng thái khóa là tiện ích riêng của người đang ngồi sửa (nhớ theo project
 * trong localStorage), KHÔNG ghi vào meta.json - phiên AI không bị ràng buộc.
 */

import { useCallback, useEffect, useState } from "react";
import type { Timeline } from "@/lib/api";
import type { Selection } from "./ops";

export type LockableTrack = "scene" | "layer" | "overlay" | "caption" | "subtitle" | "sfx" | "voice" | "music";

export const LOCKABLE_TRACKS: readonly LockableTrack[] = [
  "scene",
  "layer",
  "overlay",
  "caption",
  "subtitle",
  "sfx",
  "voice",
  "music",
];

/** Track chứa phần tử đang chọn - kind của selection trùng tên track. */
export const trackOfSelection = (sel: Selection | null): LockableTrack | null => (sel ? sel.kind : null);

/** Phần dữ liệu timeline thuộc về một track. */
function sliceOf(tl: Timeline, track: LockableTrack): unknown {
  switch (track) {
    case "scene":
      return tl.scenes;
    case "layer":
      return tl.layers;
    case "overlay":
      return tl.overlays;
    case "caption":
      return tl.captions;
    case "subtitle":
      return [tl.subtitles, tl.subtitleStyle];
    case "sfx":
      return tl.audio.sfx;
    case "music":
      return tl.audio.music;
    case "voice": {
      // Giọng đọc = phần audio còn lại (file giọng + mức âm lượng/field lạ đi kèm)
      const { sfx: _sfx, music: _music, ...rest } = tl.audio;
      return rest;
    }
  }
}

/**
 * Track khóa đầu tiên bị `next` làm thay đổi so với `prev` - null = không đụng
 * track khóa nào. So tham chiếu trước (ops giữ nguyên object khi không đổi), chỉ
 * khi khác tham chiếu mới so nội dung: vài op dựng lại mảng dù nội dung y hệt.
 */
export function lockedChange(prev: Timeline, next: Timeline, locks: ReadonlySet<LockableTrack>): LockableTrack | null {
  if (prev === next || locks.size === 0) return null;
  for (const track of locks) {
    const a = sliceOf(prev, track);
    const b = sliceOf(next, track);
    if (a === b) continue;
    if (track === "subtitle" && prev.subtitles === next.subtitles && prev.subtitleStyle === next.subtitleStyle) continue;
    if (track === "voice" && prev.audio === next.audio) continue;
    if (JSON.stringify(a) !== JSON.stringify(b)) return track;
  }
  return null;
}

const storageKey = (projectId: string) => `aiev.editor.locks.${projectId}`;

function readLocks(projectId: string): Set<LockableTrack> {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return new Set();
    return new Set(list.filter((t): t is LockableTrack => LOCKABLE_TRACKS.includes(t as LockableTrack)));
  } catch {
    return new Set();
  }
}

/** Các track đang khóa của project - nhớ theo trình duyệt (localStorage, bọc try/catch). */
export function useTrackLocks(projectId: string) {
  const [locks, setLocks] = useState<ReadonlySet<LockableTrack>>(() => new Set());
  // Đọc sau khi mount - render phía server không có localStorage
  useEffect(() => {
    setLocks(readLocks(projectId));
  }, [projectId]);

  const toggle = useCallback(
    (track: LockableTrack) => {
      setLocks((cur) => {
        const next = new Set(cur);
        if (next.has(track)) next.delete(track);
        else next.add(track);
        try {
          localStorage.setItem(storageKey(projectId), JSON.stringify([...next]));
        } catch {
          // localStorage bị chặn - khóa vẫn có tác dụng trong phiên này
        }
        return next;
      });
    },
    [projectId],
  );

  return { locks, toggle };
}

/** Khóa i18n tên track - cùng nhãn với cột tên track của timeline */
export const TRACK_LABEL_KEY: Record<LockableTrack, string> = {
  scene: "editor.track.video",
  layer: "editor.track.layer",
  overlay: "editor.track.highlight",
  caption: "editor.track.karaoke",
  subtitle: "editor.track.subtitle",
  sfx: "editor.track.sfx",
  voice: "editor.track.voice",
  music: "editor.track.music",
};
