// Tile kinds and their physics. A tile is 8 x 8 art pixels.

export const TS = 8;
export const T = {
  AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, SAND: 4, SNOW: 5, ICE: 6, ASH: 7, LAVA: 8, WATER: 9, PLANK: 10, BRICK: 11,
  METAL: 12, CRYSTAL: 13, MUD: 14, TOXIC: 15, BRIDGE: 16, LEAVES: 17, BEDROCK: 18, CLOUD: 19, VINE: 20, SPIKES: 21,
  GATE: 22, ROOF: 23, BASALT: 24, MOSS: 25, BONE: 26, GOLDORE: 27, GLASS: 28,
};
export const NAMES = Object.fromEntries(Object.entries(T).map(([k, v]) => [v, k.toLowerCase()]));

const SOLID = new Set([T.DIRT, T.GRASS, T.STONE, T.SAND, T.SNOW, T.ICE, T.ASH, T.BRICK, T.METAL, T.CRYSTAL, T.MUD, T.BEDROCK, T.GATE, T.BASALT, T.MOSS, T.BONE, T.GOLDORE, T.GLASS]);
const ONEWAY = new Set([T.PLANK, T.BRIDGE, T.CLOUD, T.ROOF, T.LEAVES]);
const LIQUID = new Set([T.WATER, T.LAVA, T.TOXIC]);
export const isSolid = (t) => SOLID.has(t);
export const isOneWay = (t) => ONEWAY.has(t);
export const isLiquid = (t) => LIQUID.has(t);
export const isClimb = (t) => t === T.VINE;

// lookup tables for speed
export const SOLID_T = new Uint8Array(256), ONEWAY_T = new Uint8Array(256), LIQUID_T = new Uint8Array(256);
for (const t of SOLID) SOLID_T[t] = 1;
for (const t of ONEWAY) ONEWAY_T[t] = 1;
for (const t of LIQUID) LIQUID_T[t] = 1;

// walls: what shows behind caves and buildings (0: nothing, the sky shows)
export const WALL = { NONE: 0, DIRT: 1, STONE: 2, WOOD: 3, BRICK: 4, METAL: 5, ICE: 6, ASH: 7, CRYPT: 8, TEMPLE: 9, CRYSTAL: 10, MUD: 11 };
