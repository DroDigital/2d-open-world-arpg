// The world generator: deterministic from a seed. Terrain per biome, caves and dungeons, the village, ruins, sky
// isles, boss arenas, and everything placed in them (props, enemies, people, chests, waystones).

import { fbm, noise, noise2, rand, Rng, clamp, lerp, smooth } from "../pfx.js";
import { T, WALL, SOLID_T, LIQUID_T } from "./tiles.js";
import { BIOMES, REGIONS, WORLD_W, WORLD_H, biomeAt } from "./biomes.js";

export function generate(seed = 7) {
  const W = WORLD_W, H = WORLD_H, R = new Rng(seed);
  const tiles = new Uint8Array(W * H), walls = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? T.BEDROCK : tiles[y * W + x]);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t; };
  const wall = (x, y, w) => { if (x >= 0 && y >= 0 && x < W && y < H) walls[y * W + x] = w; };
  const ents = [];
  const add = (e) => (ents.push(e), e);

  // ---- the surface: each biome's own hills, blended across the borders
  const height = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let sum = 0, wsum = 0;
    for (const b of BIOMES) {
      const d = x < b.x0 ? b.x0 - x : x >= b.x1 ? x - b.x1 + 1 : 0, w = Math.max(0, 1 - d / 22);
      if (w <= 0) continue;
      let h = b.base + b.amp * fbm(x / (34 / b.rough), 3.7, seed + b.x0, 4);
      if (b.id === "frost") h -= 18 * Math.pow(Math.max(0, Math.sin(((x - b.x0) / (b.x1 - b.x0)) * Math.PI * 2.2 + 0.4)), 3); // peaks
      if (b.id === "crags") h += 6 * Math.abs(noise(x / 7, seed + 9));
      sum += h * w;
      wsum += w;
    }
    height[x] = sum / wsum;
  }
  // flat places: the village, the arenas, the ruins plaza
  const flatten = (x0, x1, y, edge = 10) => {
    for (let x = x0 - edge; x <= x1 + edge; x++) {
      if (x < 0 || x >= W) continue;
      const k = x < x0 ? smooth(x0 - edge, x0, x) : x > x1 ? 1 - smooth(x1, x1 + edge, x) : 1;
      height[x] = lerp(height[x], y, k);
    }
  };
  flatten(470, 566, 64, 14); // Brightwater village
  flatten(372, 410, 62, 8); // the Grove Warden's clearing
  flatten(898, 936, 55, 8); // the caldera
  flatten(1076, 1118, 56, 8); // the foundry
  flatten(56, 92, 30, 10); // Frostpeak summit
  flatten(1128, 1150, 57, 6); // the Spire base
  flatten(4, 14, 40, 6);
  const surf = new Int16Array(W);
  for (let x = 0; x < W; x++) surf[x] = Math.round(height[x]);

  // ---- fill the ground
  for (let x = 0; x < W; x++) {
    const b = biomeAt(x), s = surf[x];
    for (let y = s; y < H; y++) {
      const d = y - s;
      let t;
      if (b.id === "vale" || b.id === "woods") t = d === 0 ? T.GRASS : d < 5 + rand(x, 3) * 3 ? T.DIRT : T.STONE;
      else if (b.id === "marsh") t = d < 6 ? T.MUD : T.STONE;
      else if (b.id === "frost") t = d < 2 ? T.SNOW : d < 4 && rand(x, y, 5) < 0.5 ? T.ICE : T.STONE;
      else if (b.id === "crags") t = d === 0 ? T.ASH : T.BASALT;
      else t = d === 0 ? T.MOSS : T.STONE;
      if (t === T.STONE && rand(x, y, 77) < 0.012 && d > 10) t = T.GOLDORE;
      set(x, y, t);
      wall(x, y, d < 6 ? (b.id === "crags" ? WALL.ASH : b.id === "marsh" ? WALL.MUD : WALL.DIRT) : b.id === "frost" ? WALL.ICE : b.id === "crags" ? WALL.ASH : WALL.STONE);
    }
  }

  // ---- caves: ridged tunnels and wide caverns, only well under the surface
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s = surf[x], d = y - s;
      if (d < 14) continue;
      const n = Math.abs(fbm(x / 26, y / 14, seed + 31, 3)), c = fbm(x / 40, y / 22, seed + 57, 3);
      const deep = y > 150 ? 0.08 : 0;
      if (n < 0.055 + deep * 0.5 || c > 0.36 - deep) set(x, y, T.AIR);
    }

  // ---- carving helpers
  const disc = (cx, cy, r, t = T.AIR) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && at(x, y) !== T.BEDROCK) set(x, y, t);
  };
  const box = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  const wallBox = (x0, y0, x1, y1, w) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) wall(x, y, w); };
  // a winding tunnel from (x0, y0) to (x1, y1)
  const worm = (x0, y0, x1, y1, r = 2.2, wobble = 0.6) => {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(L);
    for (let i = 0; i <= n; i++) {
      const u = i / n, ox = noise(i / 9, seed + x0) * 6 * wobble, oy = noise(i / 11, seed + y0) * 4 * wobble;
      disc(lerp(x0, x1, u) + ox, lerp(y0, y1, u) + oy, r + noise(i / 5, seed + 3) * 0.6);
    }
  };
  // a vertical shaft with vines to climb and ledges to rest on
  const shaft = (x, y0, y1, w = 3) => {
    box(x - w, y0, x + w, y1, T.AIR);
    for (let y = y0; y <= y1; y++) set(x - w, y, T.VINE);
    for (let y = y0 + 5; y < y1 - 2; y += 6) for (let k = 0; k < 3; k++) set(x + w - k, y, T.PLANK);
  };

  // ---- the underground regions
  for (const g of REGIONS) {
    if (g.id === "skyreach" || g.id === "depths") continue;
    const midY = (g.y0 + g.y1) >> 1;
    // a main gallery across the region
    worm(g.x0 + 6, midY, g.x1 - 6, midY + 4, 3, 1);
    worm(g.x0 + 10, g.y0 + 6, g.x1 - 12, g.y1 - 6, 2.4, 1.4);
    for (let y = g.y0; y <= g.y1; y++) for (let x = g.x0; x <= g.x1; x++) if (walls[y * W + x]) wall(x, y, g.wall);
  }
  // the Deep Dark: great caverns along the bottom of the world
  worm(10, 168, W - 10, 172, 4, 2);
  worm(30, 182, W - 30, 160, 3, 2);

  // entrances: from the surface down into each region
  const entrance = (x, toY, name) => {
    const s = surf[x];
    shaft(x, s - 1, toY);
    add({ kind: "sign", x: x * 8 + 28, y: s * 8, text: name });
  };
  entrance(300, 112, "THE HOLLOW CRYPT"); // in the woods' ruins
  entrance(520 + 30, 100, "GLIMMER CAVERNS - MIND THE DARK"); // the village well
  // a lid of planks over the well: walk across it, or drop through (down + jump)
  for (let x = 547; x <= 553; x++) set(x, surf[550], T.PLANK);
  entrance(860, 110, "MAGMA VEINS");
  entrance(150, 105, "RIME HOLLOWS");
  entrance(690, 96, "SUNKEN TEMPLE");
  entrance(1060, 150, "THE DEEP DARK");
  // wells: the region galleries reach their shafts
  worm(300, 112, 330, 122, 2.5);
  worm(550, 100, 520, 120, 2.5);
  worm(860, 110, 900, 125, 2.5);
  worm(150, 105, 120, 120, 2.5);
  worm(690, 96, 710, 107, 2.5);
  worm(1060, 150, 1060, 168, 3);

  // ---- dungeons: rooms
  // the Crypt: brick halls and a deep boss vault
  for (let i = 0; i < 6; i++) {
    const rx = 262 + i * 22, ry = 104 + (i % 2) * 14;
    box(rx, ry, rx + 16, ry + 8, T.AIR);
    for (let x = rx - 1; x <= rx + 17; x++) (set(x, ry - 1, T.BRICK), set(x, ry + 9, T.BRICK));
    wallBox(rx, ry, rx + 16, ry + 8, WALL.CRYPT);
    if (i > 0) worm(rx - 6, ry + 6, rx + 2, ry + 6, 2);
  }
  // the Watcher's vault
  box(318, 132, 356, 146, T.AIR);
  box(316, 147, 358, 150, T.BRICK);
  wallBox(318, 128, 356, 146, WALL.CRYPT);
  worm(338, 122, 336, 134, 2.6);
  // the Sunken Temple: flooded halls
  box(700, 112, 742, 124, T.AIR);
  box(698, 125, 744, 128, T.BRICK);
  wallBox(698, 104, 744, 124, WALL.TEMPLE);
  worm(710, 107, 712, 114, 2.4);
  // the Magma Veins: lava lakes
  for (let i = 0; i < 4; i++) {
    const lx = 840 + i * 38, ly = 132 + (i % 2) * 8;
    box(lx, ly, lx + 14, ly + 6, T.AIR);
    box(lx + 2, ly + 5, lx + 12, ly + 6, T.LAVA);
  }

  // ---- crystal veins in the caverns and the deep
  for (let i = 0; i < 420; i++) {
    const cx = Math.floor(R.next() * W), cy = 90 + Math.floor(R.next() * 100);
    const inCaverns = cx >= 430 && cx < 600 && cy < 150;
    if (!inCaverns && cy < 150 && R.next() < 0.7) continue;
    // only on a rock face next to open cave
    if (at(cx, cy) === T.AIR || at(cx, cy) === T.BEDROCK) continue;
    let open = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(cx + dx, cy + dy) === T.AIR) open = true;
    if (!open) continue;
    for (let k = 0; k < 4 + R.int(0, 5); k++) {
      const x = cx + R.int(-2, 2), y = cy + R.int(-2, 2);
      if (at(x, y) !== T.AIR && at(x, y) !== T.BEDROCK && !LIQUID_T[at(x, y)]) set(x, y, T.CRYSTAL);
    }
  }

  // ---- water and lava on the surface
  const pond = (x0, x1, depth, liquid = T.WATER) => {
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0), d = Math.round(depth * Math.sin(u * Math.PI));
      const s = surf[x];
      for (let y = s; y < s + d; y++) set(x, y, liquid);
    }
  };
  pond(440, 462, 5); // Vale pond
  pond(244, 256, 3); // woods brook
  // the marsh: everything under the water line floods, and pools dug into it
  const mb = BIOMES.find((b) => b.id === "marsh");
  for (let x = mb.x0 + 8; x < mb.x1 - 8; x++) {
    if (rand(x >> 4, 5) < 0.55) for (let y = surf[x]; y < surf[x] + 3; y++) set(x, y, T.AIR);
    for (let y = 60; y < surf[x] + 4; y++) if (at(x, y) === T.AIR && y >= mb.water) set(x, y, T.WATER);
  }
  // the crags: lava pools between the rocks
  for (const [x0, x1] of [[820, 834], [852, 868], [942, 956], [970, 984]]) pond(x0, x1, 4, T.LAVA);
  // the caldera's lava moat
  pond(886, 896, 3, T.LAVA);
  pond(938, 946, 3, T.LAVA);
  // toxic sumps in the marsh
  pond(742, 752, 2, T.TOXIC);
  // the temple floods
  for (let y = 104; y <= 124; y++) for (let x = 696; x <= 746; x++) if (at(x, y) === T.AIR) set(x, y, T.WATER);
  for (let y = 96; y <= 112; y++) for (let x = 686; x <= 694; x++) if (at(x, y) === T.AIR && y > 100) set(x, y, T.WATER);

  // ---- sky isles over the ruins, cloud steps between them
  const isles = [];
  for (let i = 0; i < 9; i++) {
    const cx = 1012 + i * 20 + Math.floor(rand(i, 4) * 6), cy = 30 - Math.floor(i * 1.9) - Math.floor(rand(i, 5) * 3), hw = 5 + Math.floor(rand(i, 6) * 4);
    for (let x = cx - hw; x <= cx + hw; x++) {
      const u = Math.abs(x - cx) / hw, depth = Math.round(4 * (1 - u * u) + 1);
      set(x, cy, T.GRASS);
      for (let y = cy + 1; y < cy + depth; y++) set(x, y, T.STONE);
    }
    isles.push({ x: cx, y: cy, hw });
    if (i < 8) for (let k = 0; k < 3; k++) set(cx + hw + 3 + k, cy - 1 - (k > 1 ? 1 : 0), T.CLOUD);
  }
  // the summit of the Spire: the last isle, wide and flat
  box(1158, 12, 1196, 12, T.METAL);
  box(1160, 13, 1194, 15, T.BRICK);
  isles.push({ x: 1177, y: 12, hw: 18 });

  // ---- the village of Brightwater
  const vy = 64;
  const house = (x0, w, h, kind) => {
    const top = vy - h;
    wallBox(x0, top, x0 + w - 1, vy - 1, kind === "brick" ? WALL.BRICK : WALL.WOOD);
    // a pitched roof you can stand on
    for (let r = 0; r <= Math.ceil(w / 2) + 1; r++) for (let x = x0 - 1 + r; x <= x0 + w - r; x++) set(x, top - 1 - r, T.ROOF);
    add({ kind: "house", x: x0 * 8, y: vy * 8, w: w * 8, h: h * 8, style: kind, door: (x0 + (w >> 1)) * 8 });
  };
  house(476, 10, 6, "wood"); // the inn
  house(490, 8, 5, "brick"); // the smithy
  house(531, 9, 6, "wood"); // the apothecary
  house(544, 10, 7, "brick"); // the elder's hall
  house(556, 7, 5, "wood"); // the mystic's hut
  // a lookout with planks
  for (let y = vy - 12; y < vy; y += 4) box(566, y, 569, y, T.PLANK);
  // the marsh boardwalk and the woods' bridge
  for (let x = mb.x0 + 4; x < mb.x1 - 4; x++) if (at(x, mb.water - 1) === T.AIR && at(x, mb.water) === T.WATER && rand(x >> 3, 9) < 0.7) set(x, mb.water - 1, T.BRIDGE);
  for (let x = 242; x <= 258; x++) set(x, surf[242] - 1, T.BRIDGE);

  // ---- the ruins: broken metal halls on the storm plateau
  for (let i = 0; i < 5; i++) {
    const x0 = 1012 + i * 30, s = surf[x0 + 4], hgt = 6 + Math.floor(rand(i, 8) * 6);
    for (let y = s - hgt; y < s; y++) (set(x0, y, T.METAL), set(x0 + 12, y, rand(i, y, 2) < 0.8 ? T.METAL : T.AIR));
    for (let x = x0; x <= x0 + 12; x++) if (rand(x, i, 3) < 0.85) set(x, s - hgt - 1, T.METAL);
    wallBox(x0 + 1, s - hgt, x0 + 11, s - 1, WALL.METAL);
  }
  // the crypt's ruined entrance in the woods
  for (let x = 292; x <= 296; x++) for (let y = surf[292] - 7; y < surf[292]; y++) if (x === 292 || x === 296 || y === surf[292] - 7) set(x, y, T.BRICK);

  // ---- world edges: cliffs nobody climbs
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) set(x, y, T.BEDROCK);
  for (let x = 0; x < W; x++) for (let y = H - 3; y < H; y++) set(x, y, T.BEDROCK);

  // ---- the real surface now: the first solid (or liquid) tile from the top, below the sky isles
  const ground = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    let y = x >= 1000 ? 38 : 0;
    while (y < H - 1 && !SOLID_T[at(x, y)] && !LIQUID_T[at(x, y)] && at(x, y) !== T.BRIDGE && at(x, y) !== T.ROOF) y++;
    ground[x] = y;
  }

  // ---- arenas
  const arenas = [
    { boss: "warden", x0: 374, x1: 408, y: surf[390] },
    { boss: "mireking", x0: 702, x1: 740, y: 125 },
    { boss: "colossus", x0: 60, x1: 90, y: surf[75] },
    { boss: "tyrant", x0: 900, x1: 934, y: surf[915] },
    { boss: "engine", x0: 1078, x1: 1116, y: surf[1097] },
    { boss: "watcher", x0: 320, x1: 354, y: 147 },
    { boss: "king", x0: 1160, x1: 1194, y: 12 },
  ];
  for (const a of arenas) {
    box(a.x0, a.y - 13, a.x1, a.y - 1, T.AIR);
    if (a.boss === "mireking") for (let y = a.y - 13; y < a.y; y++) for (let x = a.x0; x <= a.x1; x++) if (y < a.y - 9) set(x, y, T.AIR); else set(x, y, T.AIR);
    add({ kind: "boss", id: a.boss, x: ((a.x0 + a.x1) / 2) * 8, y: a.y * 8, arena: { x0: a.x0 * 8, x1: (a.x1 + 1) * 8, y: a.y * 8 } });
  }

  return { W, H, tiles, walls, surf, ground, ents, isles, arenas, seed, add, at, set };
}
