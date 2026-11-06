"use client";

/**
 * /chat — mặt phẳng DUY NHẤT để dùng AIEV: chọn project → nhắn với AI.
 * Lấy cảm hứng từ HyperFrames Studio: chat là sản phẩm, mọi tính năng khác
 * (tải clip, dựng draft, karaoke, SFX…) chạy qua hội thoại. Route này trước
 * đây redirect về Dashboard (chat nằm trong panel project) — phục hồi lại
 * thành landing mặc định của app desktop (desktop shell mở thẳng /chat).
 *
 * - Chưa chọn project: card tạo mới (tên → POST /api/projects, 1080x1920@30)
 *   + danh sách project có sẵn.
 * - Đã chọn: hàng trên = selector + nút tải clip (POST /api/assets) + link
 *   trình chỉnh sửa; thân = ChatThread (providersEnabled — chọn engine tại chỗ).
 * - Chip gợi ý đẩy sẵn câu lệnh vào ô nhập (queued) — người dùng sửa rồi gửi.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FolderPlus, Paperclip, Send } from "lucide-react";
import { getProjects, type ProjectSummary } from "@/lib/api";
import { ChatThread } from "@/components/ChatThread";
import { useT } from "@/lib/i18n";

const QUICK_CHIPS: Array<{ textKey: string }> = [
  { textKey: "aichat.chip.draft" },
  { textKey: "aichat.chip.karaoke" },
  { textKey: "aichat.chip.sfx" },
  { textKey: "aichat.chip.shorts" },
];

export default function ChatPage() {
  const { t, tf } = useT();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [chip, setChip] = useState<{ id: number; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chipSeq = useRef(0);

  const load = useCallback(async () => {
    try {
      const list = await getProjects();
      setProjects(list);
      setSelectedId((cur) => cur || list[0]?.id || "");
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = projects?.find((p) => p.id === selectedId) ?? null;

  async function createProject() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, width: 1080, height: 1920, fps: 30 }),
      });
      if (res.ok) {
        const p = (await res.json()) as { id: string };
        setNewName("");
        await load();
        setSelectedId(p.id);
      }
    } finally {
      setCreating(false);
    }
  }

  async function uploadClip(file: File) {
    if (!selectedId || uploading) return;
    setUploading(true);
    setUploadNote(t("aichat.uploading"));
    try {
      const fd = new FormData();
      // Token/projectId/scope append TRƯỚC file — server đọc theo thứ tự field
      fd.append("projectId", selectedId);
      fd.append("scope", "project");
      fd.append("file", file);
      const res = await fetch("/api/assets", { method: "POST", body: fd });
      if (res.ok) {
        const info = (await res.json()) as { name: string };
        setUploadNote(tf("aichat.uploaded", { name: info.name }));
        // Gợi ý ngay câu lệnh dựng — người dùng chỉnh rồi gửi
        sendChip(tf("aichat.chip.draft", {}));
      } else {
        setUploadNote(t("aichat.upload-failed"));
      }
    } catch {
      setUploadNote(t("aichat.upload-failed"));
    } finally {
      setUploading(false);
    }
  }

  function sendChip(text: string) {
    chipSeq.current += 1;
    setChip({ id: chipSeq.current, text });
  }

  return (
    <div
      className="flex h-full w-full flex-col"
      onDragOver={(e) => {
        if (selectedId) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && selectedId) void uploadClip(f);
      }}
    >
      {/* Hàng trên: project + upload + editor */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <select
          className="input w-auto max-w-[260px]"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-label={t("aichat.select-project")}
        >
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {(projects ?? []).length === 0 && <option value="">{t("aichat.no-project")}</option>}
        </select>

        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] px-2.5 py-1.5 text-sm transition-colors hover:bg-[var(--surface)]"
          >
            <FolderPlus size={14} strokeWidth={2} />
            {t("aichat.new-project")}
          </button>
        )}
        {creating && (
          <span className="flex items-center gap-1.5">
            <input
              className="input w-44"
              value={newName}
              autoFocus
              placeholder={t("aichat.project-name")}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createProject();
                if (e.key === "Escape") setCreating(false);
              }}
            />
            <button
              onClick={() => void createProject()}
              disabled={!newName.trim()}
              className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-2.5 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              <Send size={13} strokeWidth={2} />
              {t("aichat.create")}
            </button>
          </span>
        )}

        <span className="flex-1" />

        {selected && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadClip(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] px-2.5 py-1.5 text-sm transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
            >
              <Paperclip size={14} strokeWidth={2} />
              {t("aichat.upload-clip")}
            </button>
            <a
              href={`/projects/${encodeURIComponent(selected.id)}/editor`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius)] px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              {t("aichat.open-editor")}
              <ExternalLink size={13} strokeWidth={2} />
            </a>
          </>
        )}
      </div>

      {/* Note upload + chip gợi ý */}
      {selected && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] px-3 py-1.5">
          {uploadNote && (
            <span className="text-xs text-[var(--text-muted)]">{uploadNote}</span>
          )}
          <span className="flex-1" />
          {QUICK_CHIPS.map(({ textKey }) => (
            <button
              key={textKey}
              onClick={() => sendChip(t(textKey))}
              className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              {t(textKey)}
            </button>
          ))}
        </div>
      )}

      {/* Thân: chat */}
      <div className="relative min-h-0 flex-1">
        {selected ? (
          <ChatThread sessionId={null} projectId={selected.id} providersEnabled queued={chip} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-[var(--text-muted)]">{t("aichat.empty-hint")}</p>
            {creating ? (
              <span className="flex items-center gap-1.5">
                <input
                  className="input w-56"
                  value={newName}
                  autoFocus
                  placeholder={t("aichat.project-name")}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createProject();
                  }}
                />
                <button
                  onClick={() => void createProject()}
                  disabled={!newName.trim()}
                  className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {t("aichat.create")}
                </button>
              </span>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
              >
                <FolderPlus size={15} strokeWidth={2} />
                {t("aichat.new-project")}
              </button>
            )}
          </div>
        )}
        {dragOver && (
          <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[var(--radius-lg,14px)] border-2 border-dashed border-[var(--primary)] bg-[var(--bg)]/80">
            <p className="text-sm font-medium">{t("aichat.drop-hint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
