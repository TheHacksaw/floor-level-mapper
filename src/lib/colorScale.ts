/**
 * Maps a value to a color on a blue-to-red gradient.
 * Blue = low (needs filling), Red = high (needs grinding)
 */
export function valueToColor(value: number, min: number, max: number): string {
  if (max === min) return 'hsl(120, 100%, 50%)'; // green if all same
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // HSL hue: 240 (blue) → 120 (green) → 0 (red)
  const hue = (1 - t) * 240;
  return `hsl(${hue}, 100%, 50%)`;
}

export function valueToRgba(
  value: number,
  min: number,
  max: number,
  alpha: number = 180
): [number, number, number, number] {
  if (max === min) return [0, 255, 0, alpha];
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const hue = (1 - t) * 240;
  const [r, g, b] = hslToRgb(hue / 360, 1, 0.5);
  return [r, g, b, alpha];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  const sector = Math.floor(h * 6);
  switch (sector % 6) {
    case 0: r = c; g = x; b = 0; break;
    case 1: r = x; g = c; b = 0; break;
    case 2: r = 0; g = c; b = x; break;
    case 3: r = 0; g = x; b = c; break;
    case 4: r = x; g = 0; b = c; break;
    case 5: r = c; g = 0; b = x; break;
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}
