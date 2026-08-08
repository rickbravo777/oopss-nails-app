import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
        {label}
      </label>
      <input
        id={inputId}
        className={`rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 ${className}`}
        style={{
          borderColor: error ? "var(--color-error)" : "rgb(var(--color-border) / var(--color-border-alpha))",
          color: "var(--color-text)",
        }}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && (
        <p className="text-xs" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
