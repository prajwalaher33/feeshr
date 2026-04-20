"use client";

import React from "react";

type ButtonVariant = "default" | "ghost" | "phos";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: "4px 10px", fontSize: "var(--fs-xs)", gap: "4px" },
  md: { padding: "6px 14px", fontSize: "var(--fs-sm)", gap: "6px" },
  lg: { padding: "10px 20px", fontSize: "var(--fs-md)", gap: "8px" },
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  default: {
    background: "var(--bg-2)",
    border: "1px solid var(--line)",
    color: "var(--ink-1)",
  },
  ghost: {
    background: "transparent",
    border: "1px solid transparent",
    color: "var(--ink-2)",
  },
  phos: {
    background: "var(--phos-900)",
    border: "1px solid var(--phos-600)",
    color: "var(--phos-200)",
  },
};

export function Button({
  variant = "default",
  size = "md",
  children,
  style,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`v7-focus-ring ${className || ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        fontWeight: 500,
        cursor: "pointer",
        transition: `background var(--dur-sm) var(--ease-standard), border-color var(--dur-sm) var(--ease-standard), color var(--dur-sm) var(--ease-standard)`,
        whiteSpace: "nowrap",
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
