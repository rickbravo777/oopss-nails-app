// Deterministic, stable color-per-specialist for the appointments calendar (UJ-16 visual
// redesign). Assignment is derived from a hash of the specialist's own id, not from array
// position or name — so adding/renaming/reordering specialists never reshuffles anyone
// else's already-familiar color. Palette is a muted "dusty/boho" set curated to sit well
// against the brand's cream/taupe base (see DEC-12) while staying distinct from each other.
const PALETTE = [
  "#C98A93", // dusty rose
  "#8FA07E", // sage green
  "#C97B4A", // terracotta
  "#7B95A8", // dusty blue
  "#C9A227", // mustard gold
  "#9B7B9B", // mauve
  "#6B9C93", // warm teal
  "#B25D4C", // clay
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export interface SpecialistColor {
  base: string; // solid hex — legend dots, block border/accent
  bg: string; // translucent tint — event block background
}

export function getSpecialistColor(specialistId: string): SpecialistColor {
  const base = PALETTE[hashString(specialistId) % PALETTE.length];
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  return { base, bg: `rgba(${r}, ${g}, ${b}, 0.18)` };
}
