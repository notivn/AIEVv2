"use client";

/**
 * Mảnh dùng chung của trang Kết nối - tách khỏi page.tsx để các card gateway
 * tạo ảnh (GatewayCards.tsx) dựng đúng cùng một nhịp hàng, cùng icon đầu card,
 * cùng dòng "đã lưu" và cùng đường báo lỗi với card provider / tunnel.
 */

import { Check, type LucideIcon } from "lucide-react";

/**
 * Đẩy một lỗi lên banner cấp trang. `key` là nguồn lỗi (mỗi card một khóa
 * riêng) để lỗi của card này không xóa mất lỗi của card kia - TunnelCard poll
 * lại mỗi 4s, nếu dùng chung một ô lỗi thì nó chùi sạch lỗi lưu key vừa hiện.
 * Truyền `null` = nguồn đó hết lỗi.
 */
export type ErrorReporter = (
  key: string,
  err: { message: string; detail?: string } | null
) => void;

/** Một hàng thiết lập - cùng nhịp dọc với trang Cấu hình. */
export function Row({ children }: { children: React.ReactNode }) {
  return <div className="py-4 first:pt-0 last:pb-0">{children}</div>;
}

/** Icon vuông đứng trước tên card - dùng chung cho provider, gateway và tunnel. */
export function CardIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--bg-subtle)]">
      <Icon size={16} strokeWidth={1.75} className="text-[var(--primary)]" />
    </span>
  );
}

/** Dòng xác nhận ngắn (đã lưu / đã áp dụng) - cùng hình dạng với trang Cấu hình. */
export function SavedNotice({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-meta font-medium text-[var(--success)]">
      <Check size={13} strokeWidth={2} className="shrink-0" />
      {children}
    </span>
  );
}

/** Chuỗi lỗi đọc được từ một exception bất kỳ. */
export function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
