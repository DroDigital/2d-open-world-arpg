// Dump the generated world at one pixel per tile: shots/map.png
import { generate } from "../src/world/gen.js";
import { T } from "../src/world/tiles.js";
import { encodePNG } from "../vendor/pixelfx/tools/lib/png.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const t0 = performance.now();
const w = generate(+(process.argv[2] ?? 7));
console.log("gen ms", (performance.now() - t0).toFixed(0), "ents", w.ents.length);
const C = { [T.AIR]: [20, 24, 40], [T.DIRT]: [110, 80, 50], [T.GRASS]: [90, 170, 70], [T.STONE]: [90, 90, 100], [T.SNOW]: [235, 240, 250], [T.ICE]: [150, 200, 240], [T.ASH]: [120, 110, 105], [T.LAVA]: [255, 110, 30], [T.WATER]: [40, 110, 210], [T.PLANK]: [170, 120, 60], [T.BRICK]: [140, 70, 60], [T.METAL]: [120, 140, 160], [T.CRYSTAL]: [200, 120, 255], [T.MUD]: [90, 80, 50], [T.TOXIC]: [140, 230, 40], [T.BRIDGE]: [190, 140, 80], [T.BEDROCK]: [10, 10, 10], [T.CLOUD]: [255, 255, 255], [T.VINE]: [40, 200, 90], [T.ROOF]: [180, 60, 50], [T.BASALT]: [60, 50, 55], [T.MOSS]: [80, 130, 100], [T.GOLDORE]: [230, 190, 60] };
const img = new Uint8ClampedArray(w.W * w.H * 4);
for (let i = 0; i < w.W * w.H; i++) {
  let c = C[w.tiles[i]] ?? [255, 0, 255];
  if (w.tiles[i] === 0 && w.walls[i]) c = [40, 36, 50];
  img.set([...c, 255], i * 4);
}
for (const e of w.ents) {
  const x = Math.floor(e.x / 8), y = Math.floor(e.y / 8) - 1;
  const col = { boss: [255, 0, 0], npc: [255, 255, 0], spawn: [255, 80, 200], chest: [255, 200, 0], waystone: [0, 255, 255], prop: [255, 160, 60] }[e.kind] ?? [255, 255, 255];
  for (let d = 0; d < 2; d++) if (x >= 0 && y - d >= 0) img.set([...col, 255], ((y - d) * w.W + x) * 4);
}
mkdirSync("shots", { recursive: true });
writeFileSync("shots/map.png", encodePNG(w.W, w.H, img));
