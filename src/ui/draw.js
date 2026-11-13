// Drawing helpers for the UI: text in the library's pixel fonts, panels, bars, small icons.

import { rasterText, textWidth, hex, mix } from "../pfx.js";

export const COL = {
  ink: hex("#0b0a10"), panel: hex("#17142a"), panel2: hex("#221d3a"), edge: hex("#4a4263"), hi: hex("#8a80b4"), text: hex("#e8e4f4"), dim: hex("#8f87a8"),
  gold: hex("#ffd84a"), red: hex("#ff4a5a"), redD: hex("#7a1a2a"), blue: hex("#4aa8ff"), blueD: hex("#1a3a7a"), green: hex("#7cf06a"), xp: hex("#c684ff"), sel: hex("#f53cd1"),
};

export function put(f, x, y, c, a = 1) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= f.w || y >= f.h) return;
  const i = y * f.w + x;
  if (a >= 1) f.color[i] = c;
  else {
    const d = f.color[i], da = (d >>> 24) / 255, oa = a + da * (1 - a), k = a / oa, j = 1 - k;
    const r = ((c & 255) * k + (d & 255) * j) & 255, g = (((c >>> 8) & 255) * k + ((d >>> 8) & 255) * j) & 255, b = (((c >>> 16) & 255) * k + ((d >>> 16) & 255) * j) & 255;
    f.color[i] = ((((oa * 255) | 0) & 255) << 24) | (b << 16) | (g << 8) | r;
  }
}
export function fill(f, x, y, w, h, c, a = 1) {
  for (let yy = Math.max(0, y | 0); yy < Math.min(f.h, (y + h) | 0); yy++) for (let xx = Math.max(0, x | 0); xx < Math.min(f.w, (x + w) | 0); xx++) put(f, xx, yy, c, a);
}
/** Text: opts { font: "mini" | "big", k (scale), align, shadow, outline, a, max (wrap width) }. Returns width. */
export function text(f, str, x, y, c, o = {}) {
  str = String(str).toUpperCase();
  const font = o.font ?? "mini", k = o.k ?? 1, w = textWidth(str, font) * k;
  const left = Math.round(o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x), top = Math.round(y);
  const a = o.a ?? 1;
  const plot = (dx, dy, col) => rasterText(str, font, (gx, gy) => {
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) put(f, left + gx * k + i + dx, top + gy * k + j + dy, col, a);
  });
  if (o.outline !== undefined) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) plot(dx, dy, o.outline);
  else if (o.shadow !== false) plot(1, 1, o.shadow ?? COL.ink);
  plot(0, 0, c);
  return w;
}
export const width = (str, font = "mini", k = 1) => textWidth(String(str).toUpperCase(), font) * k;
/** Wrap text into lines that fit w px. */
export function wrap(str, w, font = "mini") {
  const out = [];
  for (const para of String(str).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const t = line ? line + " " + word : word;
      if (width(t, font) > w && line) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}
export function panel(f, x, y, w, h, o = {}) {
  fill(f, x + 1, y + 1, w - 2, h - 2, o.bg ?? COL.panel, o.a ?? 0.94);
  for (let i = 1; i < w - 1; i++) (put(f, x + i, y, COL.edge), put(f, x + i, y + h - 1, COL.ink));
  for (let j = 1; j < h - 1; j++) (put(f, x, y + j, COL.edge), put(f, x + w - 1, y + j, COL.ink));
  for (let i = 2; i < w - 2; i++) put(f, x + i, y + 1, o.hi ?? COL.hi, 0.35);
}
export function bar(f, x, y, w, h, k, c, back, o = {}) {
  fill(f, x - 1, y - 1, w + 2, h + 2, COL.ink);
  fill(f, x, y, w, h, back);
  if (o.ghost !== undefined) fill(f, x, y, Math.round(w * Math.max(k, o.ghost)), h, hex("#ffffff"), 0.6);
  fill(f, x, y, Math.round(w * k), h, c);
  fill(f, x, y, Math.round(w * k), 1, mix(c, 0xffffffff, 0.45));
}

// tiny 7x7 icons, scaled 2x: one per school and per item kind
const ICONS = {
  blade: ["......#", ".....#.", "....#..", "#..#...", ".##....", ".##....", "#..#..."],
  fire: ["...#...", "..##...", "..###..", ".####..", ".#####.", ".##.##.", "..###.."],
  ice: ["...#...", ".#.#.#.", "..###..", "#######", "..###..", ".#.#.#.", "...#..."],
  storm: ["....##.", "...##..", "..##...", ".#####.", "...##..", "..##...", ".##...."],
  arcane: ["...#...", "...#...", ".#####.", "...#...", "..#.#..", ".#...#.", "......."],
  holy: ["#..#..#", ".#.#.#.", "..###..", "###.###", "..###..", ".#.#.#.", "#..#..#"],
  shadow: [".#####.", "#######", "#.#.#.#", "#######", ".##.##.", "..###..", ".#.#.#."],
  nature: ["....##.", "..####.", ".#####.", ".####..", ".###...", ".#.....", "#......"],
  tide: ["...#...", "..###..", ".#####.", "#######", "#######", ".#####.", "..###.."],
  tech: ["..#.#..", ".#####.", "##...##", ".#.#.#.", "##...##", ".#####.", "..#.#.."],
  sword: ["......#", ".....#.", "....#..", "...#...", "#.#....", ".#.....", "#.#...."],
  greatsword: [".....##", "....###", "...###.", "#.###..", ".##....", ".##....", "#..#..."],
  dagger: ["......#", ".....#.", "....#..", "...#...", "..#....", ".##....", "#......"],
  spear: ["......#", ".....##", "....#..", "...#...", "..#....", ".#.....", "#......"],
  hammer: ["..###..", "..###..", "..###..", "...#...", "...#...", "...#...", "...#..."],
  scythe: [".####..", "#....#.", ".....#.", "....#..", "...#...", "..#....", ".#....."],
  claw: ["#.#.#..", "#.#.#..", "#.#.#..", ".###...", ".####..", ".###...", "......."],
  whip: ["..##...", ".#..#..", ".#...#.", "..#..#.", "...#.#.", ".....#.", "....##."],
  bow: ["..#....", ".#.#...", "#...#..", "#....#.", "#...#..", ".#.#...", "..#...."],
  pistol: ["#####..", "#####..", ".#.....", ".##....", ".#.....", "......."],
  launcher: ["#######", "#######", "..#.#..", "..#....", ".......", ".......", "......."],
  armor: [".#...#.", "#######", "#######", ".#####.", ".#####.", ".#####.", "......."],
  helm: ["..###..", ".#####.", "#######", "##...##", "#.....#", ".......", "......."],
  boots: ["..##...", "..##...", "..##...", "..##...", "..####.", ".######", "......."],
  ring: ["...#...", "..#.#..", ".#####.", "#.....#", "#.....#", ".#...#.", "..###.."],
  amulet: ["#.....#", ".#...#.", "..#.#..", "...#...", "..###..", ".#####.", "..###.."],
  potion: ["..##...", "..##...", ".####..", "######.", "######.", "######.", ".####.."],
};
export function icon(f, name, x, y, c, k = 2) {
  const rows = ICONS[name];
  if (!rows) return;
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch !== "#") return;
    for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) put(f, x + i * k + xx, y + j * k + yy, c);
  }));
}
export { ICONS };
