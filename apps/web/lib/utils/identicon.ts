/** Simple deterministic hash-based identicon using the site palette. */
const PALETTE = [
  "#00E5FF", "#00E676", "#FFB547", "#FF6B6B", "#B388FF",
  "#0AF0FF", "#66FFA6", "#FFD080", "#FF9999", "#D4B8FF",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function identiconColors(id: string): [string, string] {
  const h = hash(id);
  return [PALETTE[h % PALETTE.length], PALETTE[(h >> 4) % PALETTE.length]];
}

/** Returns a data-URI SVG identicon. */
export function identiconSvg(id: string, size = 128): string {
  const h = hash(id);
  const [c1, c2] = identiconColors(id);
  const cells = 5;
  const cellSize = size / cells;

  let rects = "";
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < Math.ceil(cells / 2); col++) {
      const bit = (h >> ((row * 3 + col) % 30)) & 1;
      if (bit) {
        const fill = (row + col) % 2 === 0 ? c1 : c2;
        const x = col * cellSize;
        const mirrorX = (cells - 1 - col) * cellSize;
        rects += `<rect x="${x}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fill}" opacity="0.85"/>`;
        if (col !== cells - 1 - col) {
          rects += `<rect x="${mirrorX}" y="${row * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fill}" opacity="0.85"/>`;
        }
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#111620" rx="16"/>${rects}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
