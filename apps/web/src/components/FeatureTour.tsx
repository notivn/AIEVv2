"use client";

/**
 * FeatureTour — guide tour từng tính năng: một step chào (3 bước tới video đầu
 * tiên) + một step cho mỗi tab của sidebar, mỗi step một dòng mô tả + nút
 * "Mở trang này". Mở tự động lần đầu (localStorage `aiev-tour-v1-done`), mở lại
 * được từ nút "Hướng dẫn" ở chân sidebar (Shell.tsx).
 *
 * Danh sách step TỰ THÂN PHỤ CỦA Shell.tsx NAV (không import — Shell không export
 * NAV và tour cần kèm mô tả riêng từng trang): thêm/bớt tab thì chỉnh cả mảng
 * STEPS tại đây. Nhãn trang dùng lại đúng key `nav.*` của locale để hai nơi
 * không lệch tên; mô tả là key `tour.desc.*`.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CornerDownRight, X } from "lucide-react";
import { useT } from "@/lib/i18n";

interface TourStep {
  /** href điều hướng — null với step chào */
  href: string | null;
  labelKey: string;
  descKey: string;
}

const STEPS: TourStep[] = [
  { href: "/", labelKey: "nav.dashboard", descKey: "tour.desc.dashboard" },
  { href: "/projects", labelKey: "nav.projects", descKey: "tour.desc.projects" },
  { href: "/images", labelKey: "nav.images", descKey: "tour.desc.images" },
  { href: "/auto-cut", labelKey: "nav.auto-cut", descKey: "tour.desc.auto-cut" },
  { href: "/text-to-video", labelKey: "nav.text-to-video", descKey: "tour.desc.text-to-video" },
  { href: "/translate-video", labelKey: "nav.translate-video", descKey: "tour.desc.translate-video" },
  { href: "/voices", labelKey: "nav.voices", descKey: "tour.desc.voices" },
  { href: "/styles", labelKey: "nav.styles", descKey: "tour.desc.styles" },
  { href: "/video-styles", labelKey: "nav.video-styles", descKey: "tour.desc.video-styles" },
  { href: "/queue", labelKey: "nav.queue", descKey: "tour.desc.queue" },
  { href: "/assets", labelKey: "nav.assets", descKey: "tour.desc.assets" },
  { href: "/sfx", labelKey: "nav.sfx", descKey: "tour.desc.sfx" },
  { href: "/prompts", labelKey: "nav.prompts", descKey: "tour.desc.prompts" },
  { href: "/skills", labelKey: "nav.skills", descKey: "tour.desc.skills" },
  { href: "/config", labelKey: "nav.config", descKey: "tour.desc.config" },
  { href: "/connections", labelKey: "nav.connections", descKey: "tour.desc.connections" },
];

export const TOUR_DONE_KEY = "aiev-tour-v1-done";

export function FeatureTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, tf } = useT();
  const router = useRouter();
  // index 0 = step chào; 1..N = từng tab
  const [index, setIndex] = useState(0);

  // Mở lại từ đầu mỗi lần mount open
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Escape đóng — modal chặn tương tác nền, phím tắt là lối thoát chuẩn
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const total = STEPS.length + 1;
  const isWelcome = index === 0;
  const step = isWelcome ? null : STEPS[index - 1];
  const isLast = index === total - 1;

  function go(delta: number) {
    setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)));
  }

  function finish() {
    try {
      localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {
      /* localStorage chặn (private mode) thì tour chỉ mở lại lần sau — không fatal */
    }
    onClose();
  }

  function openPage(href: string) {
    try {
      localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {
      /* như trên */
    }
    onClose();
    router.push(href);
  }

  return (
    // overlay: click nền = đóng (nút X và Escape vẫn là đường chính)
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onClick={finish}
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-[var(--radius-lg,14px)] border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("tour.title")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-semibold">{t("tour.title")}</span>
            <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
              {tf("tour.step", { n: String(index + 1), total: String(total) })}
            </span>
          </div>
          <button
            onClick={finish}
            aria-label={t("common.close")}
            className="rounded-[var(--radius)] p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {isWelcome ? (
            <>
              <h2 className="text-base font-semibold">{t("tour.welcome.title")}</h2>
              <ol className="mt-3 list-none space-y-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {(["tour.welcome.step1", "tour.welcome.step2", "tour.welcome.step3"] as const).map(
                  (k, i) => (
                    <li key={k} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0">{t(k)}</span>
                    </li>
                  ),
                )}
              </ol>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                {t("tour.welcome.hint")}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold">{t(step!.labelKey)}</span>
                <span className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                  {step!.href}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {t(step!.descKey)}
              </p>
              <button
                onClick={() => openPage(step!.href!)}
                className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--surface)]"
              >
                <CornerDownRight size={14} strokeWidth={2} />
                {t("tour.open-page")}
              </button>
            </>
          )}
        </div>

        {/* Footer: chấm tiến trình + điều hướng */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === index ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => go(-1)}
              disabled={index === 0}
              className="inline-flex items-center gap-1 rounded-[var(--radius)] px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-40"
            >
              <ArrowLeft size={14} strokeWidth={2} />
              {t("tour.prev")}
            </button>
            {isLast ? (
              <button
                onClick={finish}
                className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <Check size={14} strokeWidth={2} />
                {t("tour.finish")}
              </button>
            ) : (
              <button
                onClick={() => go(1)}
                className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {t("tour.next")}
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
