"use client";

import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "destructive";

export function Button({
  variant = "primary",
  small = false,
  children,
  className = "",
  ...rest
}: ComponentProps<"button"> & {
  variant?: Variant;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${small ? "btn-sm" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
