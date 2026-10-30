"use client";

/**
 * Bảng HƯỚNG DẪN SỬ DỤNG - trượt ra từ mép phải khi bấm nút "Hướng dẫn" trên
 * topbar.
 *
 * MỞ ĐÚNG MỤC CỦA TRANG ĐANG XEM: người dùng bấm hướng dẫn khi đang kẹt ở một
 * màn hình cụ thể, mở từ đầu là bắt họ tự đi tìm. Đang mở mà chuyển trang thì
 * mục cũng chuyển theo. Muốn đọc mục khác thì chọn trong menu ở đầu bảng.
 *
 * KHÔNG phải modal: không phủ nền, không giữ focus. Người ta đọc hướng dẫn để
 * làm theo ngay trên trang bên cạnh, khóa trang lại là hướng dẫn thành vô dụng.
 * Cũng KHÔNG dùng slot ShellRightPanel: slot đó là chỗ của chat AI trên trang
 * project, chiếm nó thì mất chat đúng lúc đang cần.
 *
 * Nội dung nằm ở lib/guide (có kiểu, vi + en), không ở locales - xem lý do
 * trong lib/guide/types.ts.
 */

import { ChevronDown, ChevronLeft, ChevronRight, CircleQuestionMark, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import {
  GUIDE_GROUPS,
  GUIDE_ORDER,
  guideContent,
  guideIdFor,
  type GuideBlock,
  type GuideId,
} from "@/lib/guide";
import { useT } from "@/lib/i18n";

export const GUIDE_PANEL_ID = "guide-panel";

/** `**chữ đậm**` là định dạng duy nhất trong nội dung hướng dẫn (tên nút/ô) */
function rich(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function Block({ block }: { block: GuideBlock }) {
  return (
    <section className="flex flex-col gap-2">
      {block.heading && <h3 className="text-sm font-semibold">{rich(block.heading)}</h3>}
      {block.paragraphs?.map((p, i) => (
        <p key={i} className="text-sm">
          {rich(p)}
        </p>
      ))}
      {block.steps && (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          {block.steps.map((s, i) => (
            <li key={i}>{rich(s)}</li>
          ))}
        </ol>
      )}
      {block.bullets && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {block.bullets.map((s, i) => (
            <li key={i}>{rich(s)}</li>
          ))}
        </ul>
      )}
      {block.tip && <Banner tone="info" message={rich(block.tip)} />}
      {block.warning && <Banner tone="danger" message={rich(block.warning)} />}
    </section>
  );
}

export function GuidePanel({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const { t, lang } = useT();
  const pageId = guideIdFor(pathname);
  const [id, setId] = useState<GuideId>(pageId);
  const [menuOpen, setMenuOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Mở bảng hoặc chuyển trang lúc đang mở -> về đúng mục của trang hiện tại
  useEffect(() => {
    if (!open) return;
    setId(pageId);
    setMenuOpen(false);
  }, [open, pageId]);

  // Mở ra thì đưa focus vào bảng để Tab đi tiếp từ đây; Esc đóng
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Đổi mục thì cuộn lên đầu - đọc mục mới từ giữa chừng là đọc sai
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [id]);

  if (!open || typeof document === "undefined") return null;

  const content = guideContent(lang);
  const section = content[id];
  const index = GUIDE_ORDER.indexOf(id);
  const prev = index > 0 ? GUIDE_ORDER[index - 1] : null;
  const next = index < GUIDE_ORDER.length - 1 ? GUIDE_ORDER[index + 1] : null;

  const choose = (target: GuideId) => {
    setId(target);
    setMenuOpen(false);
  };

  return createPortal(
    <div
      ref={panelRef}
      id={GUIDE_PANEL_ID}
      role="dialog"
      aria-modal="false"
      aria-labelledby="guide-panel-title"
      tabIndex={-1}
      className="guide-panel"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        if (menuOpen) setMenuOpen(false);
        else onClose();
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] p-3">
        <h2 id="guide-panel-title" className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <CircleQuestionMark
            size={16}
            strokeWidth={2}
            className="shrink-0 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <span className="truncate">{t("guide.title")}</span>
        </h2>
        <IconButton label={t("common.close")} size="sm" onClick={onClose}>
          <X size={15} strokeWidth={2} />
        </IconButton>
      </div>

      {/* Menu chọn mục: nút hiện mục đang đọc, bấm thì bung danh sách nhóm */}
      <div className="shrink-0 border-b border-[var(--border)] p-3">
        <button
          type="button"
          className="guide-menu-btn"
          aria-expanded={menuOpen}
          aria-controls="guide-panel-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="flex min-w-0 flex-col items-start">
            <span className="text-meta text-[var(--text-muted)]">{t("guide.menu")}</span>
            <span className="max-w-full truncate text-sm font-semibold">{section.title}</span>
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2}
            aria-hidden="true"
            className={`shrink-0 transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>
        {id !== pageId && !menuOpen && (
          <button
            type="button"
            onClick={() => choose(pageId)}
            className="mt-2 text-meta font-medium text-[var(--primary)] hover:underline"
          >
            {t("guide.this-page")}: {content[pageId].title}
          </button>
        )}
      </div>

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {menuOpen ? (
          <nav id="guide-panel-menu" aria-label={t("guide.menu")} className="flex flex-col gap-4">
            {GUIDE_GROUPS.map((group) => (
              <div key={group.labelKey} className="flex flex-col gap-1">
                <p className="t-eyebrow px-3">{t(group.labelKey)}</p>
                {group.ids.map((gid) => (
                  <button
                    key={gid}
                    type="button"
                    onClick={() => choose(gid)}
                    aria-current={gid === id ? "true" : undefined}
                    className={`nav-item w-full text-left ${gid === id ? "active" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{content[gid].title}</span>
                    {gid === pageId && (
                      <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">
                        {t("guide.current-page")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        ) : (
          <article className="flex flex-col gap-4">
            <p className="text-sm text-[var(--text-muted)]">{rich(section.summary)}</p>
            {section.blocks.map((block, i) => (
              <Block key={`${id}-${i}`} block={block} />
            ))}
          </article>
        )}
      </div>

      {!menuOpen && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border)] p-3">
          {prev ? (
            <Button variant="secondary" small onClick={() => choose(prev)} title={content[prev].title}>
              <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
              {t("guide.prev")}
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button variant="secondary" small onClick={() => choose(next)} title={content[next].title}>
              {t("guide.next")}
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
