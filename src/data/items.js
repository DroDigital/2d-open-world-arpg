// Items: weapons, armor, trinkets, consumables, materials and key items, with rarities and random affixes.

import { PAL } from "../pfx.js";

export const RARITY = [
  { id: "common", name: "Common", color: "#e8e4dc", affixes: 0, mult: 1, beam: ["#2a2a30", "#4a4a54", "#7a7a88", "#a8a8b8", "#d0d0dc", "#ececf4", "#ffffff", "#ffffff"] },
  { id: "magic", name: "Magic", color: "#6ab0ff", affixes: 1, mult: 1.15, beam: PAL.water },
  { id: "rare", name: "Rare", color: "#ffd84a", affixes: 2, mult: 1.35, beam: PAL.holy },
  { id: "epic", name: "Epic", color: "#c684ff", affixes: 3, mult: 1.6, beam: PAL.arcane },
  { id: "legendary", name: "Legendary", color: "#ff8a2a", affixes: 4, mult: 2, beam: PAL.fire },
];

// elements recolor weapon strokes with a pixelfx ramp
export const ELEMENTS = {
  fire: { name: "Flame", pal: PAL.fire, status: "burning", color: "#ff8a2a" },
  ice: { name: "Frost", pal: PAL.ice, status: "frozen", color: "#9bdcff" },
  shock: { name: "Storm", pal: PAL.electric, status: "shocked", color: "#7cc8ff" },
  poison: { name: "Venom", pal: PAL.poison, status: "poisoned", color: "#a8e04a" },
  shadow: { name: "Night", pal: PAL.shadow, status: "cursed", color: "#a970e0" },
  holy: { name: "Dawn", pal: PAL.holy, status: null, color: "#ffe066" },
  arcane: { name: "Aether", pal: PAL.arcane, status: "confused", color: "#c684ff" },
  blood: { name: "Blood", pal: PAL.blood, status: "bleeding", color: "#ff5a50" },
};

export const AFFIXES = [
  { stat: "atk", name: "of Might", pre: "Mighty", v: [2, 6], per: 0.6 },
  { stat: "spell", name: "of the Sage", pre: "Arcane", v: [2, 6], per: 0.6 },
  { stat: "hp", name: "of Vigor", pre: "Stout", v: [8, 24], per: 2.5 },
  { stat: "mp", name: "of Focus", pre: "Clear", v: [5, 14], per: 1.4 },
  { stat: "crit", name: "of Precision", pre: "Keen", v: [2, 6], per: 0.15 },
  { stat: "def", name: "of Warding", pre: "Warded", v: [1, 4], per: 0.4 },
  { stat: "aspd", name: "of Haste", pre: "Swift", v: [4, 10], per: 0.3 },
  { stat: "move", name: "of the Wind", pre: "Fleet", v: [3, 8], per: 0.2 },
  { stat: "regen", name: "of Mending", pre: "Mending", v: [1, 3], per: 0.1 },
  { stat: "leech", name: "of the Leech", pre: "Thirsting", v: [2, 5], per: 0.1 },
  { stat: "gold", name: "of Greed", pre: "Gilded", v: [8, 20], per: 0.5 },
  { stat: "cdr", name: "of Recall", pre: "Hastened", v: [4, 10], per: 0.2 },
];

export const BASES = {
  // weapons: class (see weapons.js), base damage
  sword: { slot: "weapon", cls: "sword", names: ["Shortsword", "Longsword", "Runeblade", "Sunsteel Blade"], dmg: 8 },
  greatsword: { slot: "weapon", cls: "greatsword", names: ["Claymore", "Zweihander", "Titan's Edge"], dmg: 13 },
  dagger: { slot: "weapon", cls: "dagger", names: ["Twin Knives", "Stilettos", "Fangs of Dusk"], dmg: 5 },
  spear: { slot: "weapon", cls: "spear", names: ["Pike", "Partisan", "Starlance"], dmg: 9 },
  hammer: { slot: "weapon", cls: "hammer", names: ["Maul", "Warhammer", "Mountainbreaker"], dmg: 15 },
  scythe: { slot: "weapon", cls: "scythe", names: ["Harvest Scythe", "Grave Reaper", "Moonsickle"], dmg: 11 },
  claw: { slot: "weapon", cls: "claw", names: ["Iron Knuckles", "Tiger Claws", "Wyrm Talons"], dmg: 6 },
  whip: { slot: "weapon", cls: "whip", names: ["Leather Whip", "Chain Lash", "Thornlash"], dmg: 8 },
  bow: { slot: "weapon", cls: "bow", names: ["Hunting Bow", "Longbow", "Skyreach Bow"], dmg: 8 },
  pistol: { slot: "weapon", cls: "pistol", names: ["Old Flintlock", "Sidearm", "Relic Pistol"], dmg: 7 },
  shotgun: { slot: "weapon", cls: "shotgun", names: ["Blunderbuss", "Scattergun"], dmg: 6 },
  smg: { slot: "weapon", cls: "smg", names: ["Repeater", "Clockwork Carbine"], dmg: 4 },
  launcher: { slot: "weapon", cls: "launcher", names: ["Hand Cannon", "Thunder Tube"], dmg: 20 },
  // armor: def, and a dye for the hero's costume
  tunic: { slot: "armor", names: ["Padded Tunic", "Ranger Coat", "Warden Mail", "Dawnplate"], def: 3 },
  hood: { slot: "helm", names: ["Hood", "Leather Cap", "Iron Helm", "Crown of Embers"], def: 1 },
  boots: { slot: "boots", names: ["Sandals", "Travel Boots", "Striders", "Cloudwalkers"], def: 1, move: 2 },
  ring: { slot: "ring", names: ["Copper Ring", "Silver Band", "Signet", "Star Ring"] },
  amulet: { slot: "amulet", names: ["Charm", "Talisman", "Pendant", "Heart of Dawn"] },
};
export const DYES = [
  { tunic: ["#6ad0c4", "#36a0a0", "#226a78", "#163e52"] },
  { tunic: ["#e87a6a", "#c04a4a", "#86303a", "#521e2a"] },
  { tunic: ["#8ac86a", "#5a9a48", "#3a6a38", "#24442a"] },
  { tunic: ["#c8a0f0", "#9a6ad0", "#6a44a0", "#40286a"] },
  { tunic: ["#f0d070", "#c8a040", "#8a6a2a", "#54401c"] },
  { tunic: ["#d8dce8", "#a4aabc", "#6e7488", "#444858"] },
  { tunic: ["#5a6a9a", "#3e4a78", "#2a3256", "#1a1e38"] },
];

export const CONSUMABLES = {
  potion: { name: "Health Potion", desc: "Restores 45% of your health.", fx: "pickups/potion", palette: PAL.blood, price: 25, stack: 9 },
  ether: { name: "Mana Draught", desc: "Restores 60% of your mana.", fx: "pickups/potion", palette: PAL.water, price: 30, stack: 9 },
  elixir: { name: "Haste Elixir", desc: "You move and strike faster for 30 s.", fx: "pickups/potion", palette: PAL.volt, price: 60, stack: 5, buff: "haste" },
  fury: { name: "Fury Tonic", desc: "Rage: more damage, less defense, 20 s.", fx: "pickups/potion", palette: PAL.ember, price: 60, stack: 5, buff: "rage" },
  feather: { name: "Phoenix Feather", desc: "If you fall, rise again where you stand.", fx: "holy/feather-burst", price: 250, stack: 3 },
  scroll: { name: "Waystone Scroll", desc: "Return to Brightwater at once.", price: 40, stack: 9 },
  star: { name: "Starfruit", desc: "Glowing fruit: a few seconds of invulnerability.", fx: "pickups/power-star", price: 120, stack: 3, buff: "star" },
  bomb: { name: "Smoke Bomb", desc: "Vanish in smoke; foes lose sight of you.", fx: "explosions/smoke-bomb", price: 35, stack: 9 },
  flare: { name: "Signal Flare", desc: "Lights the land around you for a while.", fx: "projectiles/flare", price: 20, stack: 9 },
  firework: { name: "Firework", desc: "For celebrations. Lights the night sky.", fx: "explosions/firework-rocket", price: 15, stack: 20 },
};
export const MATERIALS = {
  crystal: { name: "Glimmer Crystal", desc: "Hums faintly. The smith and the mystic want these.", price: 12 },
  gem: { name: "Ruby", desc: "A brilliant-cut gem. Worth a fortune.", price: 80 },
  frostshard: { name: "Frost Shard", desc: "Never melts.", price: 18 },
  ore: { name: "Gold Ore", desc: "Raw gold.", price: 15 },
  core: { name: "Spent Core", desc: "An ancient power core, cold now.", price: 40 },
  key: { name: "Old Key", desc: "Opens a locked chest somewhere.", price: 0 },
};

/** The six shards: each a boss's prize, each an ability. */
export const SHARDS = {
  warden: { name: "Verdant Shard", ability: "doublejump", desc: "Leap again in the air.", pal: PAL.leaf },
  mireking: { name: "Tidal Shard", ability: "gills", desc: "Breathe under water.", pal: PAL.water },
  colossus: { name: "Rime Shard", ability: "blink", desc: "Hold up and dash to blink.", pal: PAL.ice },
  tyrant: { name: "Cinder Shard", ability: "lavawalk", desc: "Walk through lava unharmed.", pal: PAL.fire },
  engine: { name: "Storm Shard", ability: "hover", desc: "Hold jump while falling to hover.", pal: PAL.electric },
  watcher: { name: "Umbral Shard", ability: "sight", desc: "See hidden things; scan foes.", pal: PAL.shadow },
};
