// The world: tiles, walls, the lands and regions, and queries in pixels.

import { generate } from "./gen.js";
import { populate } from "./populate.js";
import { T, TS, SOLID_T, ONEWAY_T, LIQUID_T } from "./tiles.js";
import { biomeAt, REGIONS } from "./biomes.js";

export class World {
  constructor(seed = 7) {
    Object.assign(this, generate(seed));
    this.pw = this.W * TS;
    this.ph = this.H * TS;
    this.dirty = [];
    populate(this);
  }
  tile(tx, ty) {
    return tx < 0 || ty < 0 || tx >= this.W || ty >= this.H ? T.BEDROCK : this.tiles[ty * this.W + tx];
  }
  wall(tx, ty) {
    return tx < 0 || ty < 0 || tx >= this.W || ty >= this.H ? 0 : this.walls[ty * this.W + tx];
  }
  setTile(tx, ty, t) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return;
    this.tiles[ty * this.W + tx] = t;
    this.dirty.push([tx, ty]);
  }
  /** Tile at a pixel. */
  at(px, py) {
    return this.tile(Math.floor(px / TS), Math.floor(py / TS));
  }
  solid(px, py) {
    return SOLID_T[this.at(px, py)] === 1;
  }
  oneway(px, py) {
    return ONEWAY_T[this.at(px, py)] === 1;
  }
  liquid(px, py) {
    const t = this.at(px, py);
    return LIQUID_T[t] ? t : 0;
  }
  /** The ground's top surface y (px) at column px: the first solid tile from the sky down (ignores sky isles). */
  groundY(px) {
    const tx = Math.max(0, Math.min(this.W - 1, Math.floor(px / TS)));
    return this.ground[tx] * TS;
  }
  /** The first standable surface at or below py at column px. */
  floorBelow(px, py) {
    let ty = Math.floor(py / TS);
    const tx = Math.floor(px / TS);
    while (ty < this.H && !SOLID_T[this.tile(tx, ty)] && !ONEWAY_T[this.tile(tx, ty)]) ty++;
    return ty * TS;
  }
  biome(px) {
    return biomeAt(px / TS);
  }
  /** The named underground region at a point, or null on the surface. */
  region(px, py) {
    const tx = px / TS, ty = py / TS;
    if (ty < this.ground[Math.max(0, Math.min(this.W - 1, Math.floor(tx)))] + 6 && !(ty < 36 && tx >= 1000)) return null;
    for (const g of REGIONS) if (tx >= g.x0 && tx < g.x1 && ty >= g.y0 && ty < g.y1) return g;
    return null;
  }
  /** How far under the surface (px) a point is: 0 on or above it. */
  depth(px, py) {
    return Math.max(0, py - this.groundY(px));
  }
}
