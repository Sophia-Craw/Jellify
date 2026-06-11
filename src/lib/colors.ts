const COLORS = [
  "#1b6b32", "#7a1f32", "#4a1a5e", "#3a1f6e", "#2a357a",
  "#1a4a7a", "#1a5a6a", "#1a5a4a", "#2a5a2a", "#7a3a1a",
  "#7a5a1a", "#7a6a1a", "#4a3a2a", "#3a4a5a", "#7a2a2a",
];

export function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function colorFromString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}
