import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive";
}

const VARIANT_STYLES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "text-white",
  secondary: "border border-[rgb(var(--color-border)/var(--color-border-alpha))] bg-transparent",
  destructive: "text-white",
};

const VARIANT_BG: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "var(--color-primary)",
  secondary: "transparent",
  destructive: "var(--color-error)",
};

export function Button({ variant = "primary", className = "", style, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_STYLES[variant]} ${className}`}
      style={{
        backgroundColor: VARIANT_BG[variant],
        color: variant === "secondary" ? "var(--color-text)" : undefined,
        ...style,
      }}
      disabled={disabled}
      {...props}
    />
  );
}
