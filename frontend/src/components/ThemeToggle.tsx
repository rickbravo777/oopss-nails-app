import { useThemeStore } from "../lib/themeStore";

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar tema"
      className="glass-card px-3 py-1.5 text-sm"
      style={{ color: "var(--color-text)" }}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
