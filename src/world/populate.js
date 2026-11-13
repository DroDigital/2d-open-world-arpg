// Everything placed in the world after the terrain: props that burn and pour and hum, things that hurt, wildlife,
// enemies, people, chests, waystones and secrets. Deterministic from the world's seed.

import { rand, Rng } from "../pfx.js";
import { T, TS, SOLID_T, LIQUID_T, ONEWAY_T } from "./tiles.js";
import { BIOMES, biomeAt } from "./biomes.js";

const ENEMIES = {
  vale: ["slime", "slime", "bandit", "frog"],
  woods: ["wisp", "snake", "archer", "slime_moss", "bandit"],
  marsh: ["frog_toxic", "snake", "slime_toxic", "bogman"],
  frost: ["wisp_frost", "knight_frost", "bat_ice", "slime_ice"],
  crags: ["skull", "slime_lava", "brute", "imp"],
  storm: ["sentinel", "gunner", "trooper", "drone"],
};
const CAVE_ENEMIES = {
  crypt: ["skeleton", "ghost", "skull_necro", "cultist", "bat"],
  temple: ["jelly", "slime_water", "sentinel_deep"],
  caverns: ["bat", "slime_crystal", "sentinel_cave"],
  magma: ["skull", "slime_lava", "brute"],
  icecaves: ["bat_ice", "knight_frost", "wisp_frost"],
  depths: ["skeleton", "ghost", "brute", "cultist", "sentinel_deep", "bat"],
  skyreach: ["wisp_holy", "knight_holy", "sentinel_holy"],
};

export function populate(w) {
  const R = new Rng(w.seed * 31 + 7), add = w.add;
  const gy = (tx) => w.ground[tx] * TS;
  const free = (tx, ty) => !SOLID_T[w.tile(tx, ty)] && !LIQUID_T[w.tile(tx, ty)];
  // a dry standable floor at column tx
  const dry = (tx) => {
    const t = w.tile(tx, w.ground[tx]);
    return SOLID_T[t] && free(tx, w.ground[tx] - 1) && free(tx, w.ground[tx] - 2);
  };

  // ---- the village of Brightwater
  const VY = 64 * TS;
  const P = (fx, tx, y = VY, o = {}) => add({ kind: "prop", fx, x: Math.round(tx * TS), y, ...o });
  P("water/fountain", 516, VY + 0);
  P("fire/campfire", 504, VY);
  P("fire/torch", 475, VY - 22);
  P("fire/torch", 487, VY - 22);
  P("fire/torch", 489.5, VY - 22);
  P("fire/torch", 498.5, VY - 22);
  P("fire/torch", 530, VY - 22);
  P("fire/torch", 554.5, VY - 22);
  P("fire/candle", 480, VY - 26);
  P("fire/candle", 535, VY - 26);
  P("fire/brazier", 469, VY);
  P("fire/brazier", 570, VY);
  P("water/ripples", 451, VY + 6, { y: gy(451) + 1 });
  P("arcane/arcane-orb", 559.5, VY - 6, { lightK: 0.6 });
  add({ kind: "waystone", id: "brightwater", name: "Brightwater", x: 523 * TS, y: VY });
  add({ kind: "bed", x: 481 * TS, y: VY });
  add({ kind: "sign", x: 466 * TS, y: VY, text: "BRIGHTWATER - REST, TRADE, BE SAFE" });
  // its people
  const NPC = (id, tx) => add({ kind: "npc", id, x: tx * TS, y: VY });
  NPC("elder", 548);
  NPC("smith", 494);
  NPC("alchemist", 535);
  NPC("mystic", 559);
  NPC("innkeep", 481);
  NPC("hunter", 508);
  NPC("child", 520);
  NPC("bard", 512);
  NPC("guard", 468);
  NPC("guard2", 572);
  // the festival rockets and party poppers live by the fountain
  add({ kind: "festival", x: 516 * TS, y: VY });

  // ---- waystones in every land
  const ways = [["frostpeak", "Frostpeak Camp", 120], ["woods", "Mossgate", 262], ["marsh", "Reedwatch", 640], ["crags", "Cinder Post", 880], ["storm", "Spire Landing", 1030]];
  for (const [id, name, tx] of ways) {
    let x = tx;
    while (!dry(x)) x++;
    add({ kind: "waystone", id, name, x: x * TS + 4, y: gy(x) });
  }
  // the storm's teleporter pads and the lift to the sky
  add({ kind: "pad", id: "spire", x: 1146 * TS, y: gy(1146), to: "summit" });
  add({ kind: "pad", id: "summit", x: 1164 * TS, y: 12 * TS, to: "spire" });
  add({ kind: "lift", x: 1010 * TS, y: gy(1010), top: 26 * TS });

  // ---- props by land
  for (let tx = 6; tx < w.W - 6; tx++) {
    const b = biomeAt(tx), y = gy(tx), r = R.next();
    if (tx > 462 && tx < 576) continue; // the village is placed by hand
    if (!dry(tx)) {
      // over water: fish, lily-light ripples, bubbles and whirlpools
      const t = w.tile(tx, w.ground[tx]);
      if (t === T.WATER && r < 0.04) add({ kind: "critter", type: "fish", x: tx * TS, y: y + 18 });
      if (t === T.WATER && r > 0.97) P("water/ripples", tx, y + 2);
      if (t === T.TOXIC && r < 0.12) P("nature/toxic-puddle", tx, y + 6, { hazard: { dmg: 4, el: "poison", r: 30, status: "poisoned" } });
      continue;
    }
    switch (b.id) {
      case "vale":
        if (r < 0.03) add({ kind: "critter", type: "butterfly", x: tx * TS, y: y - 40 });
        else if (r < 0.04) P("nature/healing-bloom", tx, y, { trigger: "bloom" });
        else if (r < 0.05) P("water/rain-splash", tx, y + 2, { rainOnly: true });
        break;
      case "woods":
        if (r < 0.015) P("fire/spirit-flame", tx, y - 6, { lightK: 0.8 });
        else if (r < 0.03) P("nature/spore-burst", tx, y, { trigger: "spore" });
        else if (r < 0.04) P("nature/healing-bloom", tx, y, { trigger: "bloom" });
        else if (r < 0.06) add({ kind: "critter", type: "butterfly", x: tx * TS, y: y - 46 });
        else if (r < 0.07) add({ kind: "critter", type: "bird", x: tx * TS, y: y - 70 });
        break;
      case "marsh":
        if (r < 0.03) P("nature/poison-cloud", tx, y, { hazard: { dmg: 3, el: "poison", r: 60, status: "poisoned" } });
        else if (r < 0.05) P("nature/toxic-puddle", tx, y + 4, { hazard: { dmg: 4, el: "poison", r: 30, status: "poisoned" } });
        else if (r < 0.06) P("water/geyser", tx, y, { trigger: "geyser" });
        else if (r < 0.075) P("water/rain-splash", tx, y + 2, { rainOnly: true });
        break;
      case "frost":
        if (r < 0.025) P("ice/ice-crystal", tx, y - 6, { node: "frostshard" });
        else if (r < 0.035) P("ice/blizzard-vortex", tx, y, { hazard: { dmg: 3, el: "ice", r: 26, push: 160, status: "slowed" } });
        else if (r < 0.05) P("ice/icicle-fall", tx, y, { trigger: "icicle" });
        break;
      case "crags":
        if (r < 0.02) P("fire/brazier", tx, y);
        else if (r < 0.032) P("fire/fire-tornado", tx, y, { hazard: { dmg: 8, el: "fire", r: 22, status: "burning" } });
        else if (r < 0.05) P("fire/flame-pillar", tx, y, { trigger: "vent" });
        else if (r < 0.06) add({ kind: "barrel", x: tx * TS, y });
        break;
      case "storm":
        if (r < 0.015) P("lightning/tesla-coil", tx, y, { hazard: { dmg: 10, el: "shock", r: 40, status: "shocked", pulse: 2.4 } });
        else if (r < 0.025) P("scifi/laser-grid", tx, y, { hazard: { dmg: 12, el: "fire", r: 26, pulse: 0 } });
        else if (r < 0.035) P("lightning/plasma-ball", tx, y, { lightK: 0.8 });
        else if (r < 0.045) P("lightning/spark-arc", tx, y, { hazard: { dmg: 6, el: "shock", r: 14, status: "shocked" } });
        else if (r < 0.055) add({ kind: "barrel", x: tx * TS, y });
        else if (r < 0.062) P("scifi/hologram", tx, y, { lore: true });
        else if (r < 0.075) P("explosions/dirt-explosion", tx, y, { trigger: "mine" });
        break;
    }
  }
  // set pieces
  P("water/waterfall", 437.5, gy(440) - 92 + 92, { y: gy(440) });
  P("water/drip", 297, gy(297) - 40, { y: gy(297) });
  P("fire/spirit-flame", 291, gy(291) - 58);
  P("fire/spirit-flame", 297, gy(297) - 58);
  P("scifi/energy-core", 1090, gy(1090) - 4, { objective: "core" });
  P("scifi/energy-core", 1040, gy(1040) - 4, { objective: "core" });
  P("scifi/energy-core", 1120, gy(1120) - 4, { objective: "core" });
  P("lightning/storm-cloud", 1135, gy(1135), { hazard: { dmg: 14, el: "shock", r: 24, status: "shocked", pulse: 3 } });
  P("lightning/ball-lightning", 1064, gy(1064) - 6, { hazard: { dmg: 9, el: "shock", r: 18, status: "shocked" } });
  P("projectiles/cannonball", 1104, gy(1104) - 12, { trigger: "cannon" });
  P("holy/sunburst", 1177, 12 * TS - 70, { lightK: 0.8 });
  P("holy/blessing", 1170, 12 * TS, { trigger: "blessing" });
  P("arcane/portal", 1192, 12 * TS);
  P("scifi/tractor-beam", 1010, gy(1010), { lift: true });
  P("scifi/teleporter-pad", 1146, gy(1146));
  P("scifi/teleporter-pad", 1164, 12 * TS);
  // the woods' crypt mouth and the crypt
  for (const [tx, ty] of [[264, 112], [290, 126], [310, 112], [336, 126], [360, 112]]) {
    P("shadow/shadow-flames", tx, ty * TS);
    P("fire/candle", tx + 6, ty * TS);
  }
  P("shadow/necro-skulls", 324, 147 * TS);
  P("shadow/necro-skulls", 350, 147 * TS);
  P("shadow/soul-drain", 280, 112 * TS, { lightK: 0.7 });
  P("shadow/void-orb", 337, 140 * TS - 30);
  P("shadow/hex-sigil", 300, 126 * TS, { trigger: "hex" });
  // the temple
  P("water/whirlpool", 720, 106 * TS, { hazard: { dmg: 0, r: 40, pull: 80 } });
  P("water/bubbles", 705, 124 * TS);
  P("water/bubbles", 735, 124 * TS);
  P("water/water-orb", 721, 112 * TS, { lightK: 0.7 });
  P("water/fountain", 744, 125 * TS);
  // the caverns: crystal nodes on floors in the dark
  const caveFloors = [];
  for (let i = 0; i < 14000; i++) {
    const tx = 4 + Math.floor(R.next() * (w.W - 8)), ty = w.ground[tx] + 14 + Math.floor(R.next() * (w.H - w.ground[tx] - 18));
    if (!SOLID_T[w.tile(tx, ty)] || !free(tx, ty - 1) || !free(tx, ty - 2) || !free(tx, ty - 3) || !free(tx + 1, ty - 1) || !SOLID_T[w.tile(tx + 1, ty)]) continue;
    caveFloors.push([tx, ty]);
  }
  for (const [tx, ty] of caveFloors) {
    const r = R.next(), b = biomeAt(tx), y = ty * TS;
    if (r < 0.06) P("pickups/crystal-shard", tx, y - 6, { pickup: "crystal" });
    else if (r < 0.08) P("water/drip", tx, y - 40, { y });
    else if (r < 0.1 && b.id === "crags") P("fire/flame-pillar", tx, y, { trigger: "vent" });
    else if (r < 0.105) P("pickups/gem-spin", tx, y - 6, { pickup: "gem" });
    else if (r < 0.12) add({ kind: "chest", x: tx * TS, y, tier: ty > 150 ? 3 : ty > 100 ? 2 : 1 });
    else if (r < 0.125 && b.id === "storm") P("projectiles/flare", tx, y, { trigger: "flare" });
  }

  // ---- enemies on the surface, in packs
  for (let tx = 10; tx < w.W - 10; tx += 16 + Math.floor(rand(tx, 3) * 18)) {
    if (tx > 455 && tx < 585) continue;
    if (!dry(tx)) continue;
    const b = biomeAt(tx), list = ENEMIES[b.id], n = 1 + Math.floor(rand(tx, 5) * (b.id === "vale" ? 2 : 3));
    add({ kind: "spawn", x: tx * TS, y: gy(tx), list, n, level: b.level, biome: b.id });
  }
  // flyers in the night sky and water things
  for (let tx = 30; tx < w.W - 30; tx += 60) {
    const b = biomeAt(tx);
    if (b.id === "woods" || b.id === "vale") add({ kind: "spawn", x: tx * TS, y: gy(tx) - 60, list: ["bat"], n: 2, level: b.level, biome: b.id, night: true });
    if (b.id === "woods" || b.id === "frost") add({ kind: "spawn", x: tx * TS + 200, y: gy(tx) - 30, list: [b.id === "frost" ? "ghost_frost" : "ghost"], n: 1, level: b.level, biome: b.id, night: true });
  }
  for (let tx = 610; tx < 790; tx += 30) if (w.tile(tx, w.ground[tx]) === T.WATER) add({ kind: "spawn", x: tx * TS, y: gy(tx) + 20, list: ["jelly"], n: 1, level: [5, 8], biome: "marsh", water: true });
  // in the caves
  const regions = { crypt: [250, 400, 96, 150], temple: [640, 780, 84, 130], caverns: [430, 600, 90, 150], magma: [820, 990, 90, 160], icecaves: [20, 200, 90, 150] };
  for (const [tx, ty] of caveFloors) {
    if (R.next() > 0.1) continue;
    let reg = "depths";
    for (const [k, [x0, x1, y0, y1]] of Object.entries(regions)) if (tx >= x0 && tx < x1 && ty >= y0 && ty < y1) reg = k;
    if (reg === "depths" && ty < 150) reg = biomeAt(tx).id === "crags" ? "magma" : biomeAt(tx).id === "frost" ? "icecaves" : "caverns";
    const lv = { crypt: [7, 10], temple: [6, 9], caverns: [3, 6], magma: [11, 15], icecaves: [9, 12], depths: [14, 20] }[reg];
    add({ kind: "spawn", x: tx * TS, y: ty * TS, list: CAVE_ENEMIES[reg], n: 1 + Math.floor(rand(tx, 2) * 2), level: lv, biome: reg });
  }
  // the sky isles
  for (const isle of w.isles.slice(1, -1)) add({ kind: "spawn", x: isle.x * TS, y: isle.y * TS, list: CAVE_ENEMIES.skyreach, n: 1, level: [16, 20], biome: "skyreach" });
  // a chest or two on the surface of every land, and on the isles
  for (const b of BIOMES) for (let k = 0; k < 3; k++) {
    let tx = b.x0 + 20 + Math.floor(rand(b.x0, k, 61) * (b.x1 - b.x0 - 40));
    if (tx > 460 && tx < 580) continue;
    while (!dry(tx) && tx < b.x1 - 5) tx++;
    add({ kind: "chest", x: tx * TS, y: gy(tx), tier: 1 + Math.floor(b.level[0] / 6) });
  }
  for (const isle of w.isles) add({ kind: "chest", x: (isle.x + 2) * TS, y: isle.y * TS, tier: 3 });

  // ---- scenery sprites: trees, rocks, ruins
  for (let tx = 3; tx < w.W - 3; tx++) {
    if (!dry(tx)) continue;
    const b = biomeAt(tx), r = R.next();
    if (tx > 462 && tx < 576 && r > 0.02) continue;
    const dens = { woods: 0.26, vale: 0.06, marsh: 0.1, frost: 0.09, crags: 0.07, storm: 0.06 }[b.id];
    if (r < dens) add({ kind: "deco", type: b.id, x: tx * TS + 4, y: gy(tx), v: Math.floor(R.next() * 1000) });
    else if (r < dens + 0.08) add({ kind: "deco", type: "small_" + b.id, x: tx * TS + 4, y: gy(tx), v: Math.floor(R.next() * 1000) });
  }
  for (const isle of w.isles) add({ kind: "deco", type: "vale", x: (isle.x - 2) * TS, y: isle.y * TS, v: isle.x });
}
