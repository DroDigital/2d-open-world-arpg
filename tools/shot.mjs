#!/usr/bin/env node
// Run the game headless in Node and save screenshots: node tools/shot.mjs [script]
// Scripts drive the hero with scripted input and grab frames to shots/*.png at 2x.
import { Game } from "../src/game/game.js";
import { encodePNG } from "../vendor/pixelfx/tools/lib/png.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

export function snap(g, name, k = 2) {
  const W = 320, H = 180, out = g.render(), big = new Uint8ClampedArray(W * k * H * k * 4);
  const src = new Uint32Array(out.buffer), dst = new Uint32Array(big.buffer);
  for (let y = 0; y < H * k; y++) for (let x = 0; x < W * k; x++) dst[y * W * k + x] = src[((y / k) | 0) * W + ((x / k) | 0)];
  mkdirSync("shots", { recursive: true });
  writeFileSync(`shots/${name}.png`, encodePNG(W * k, H * k, big));
}
export function run(g, seconds, hold = []) {
  for (const a of hold) g.input.hold(a, true);
  for (let i = 0; i < Math.round(seconds * 60); i++) g.update(1 / 60);
  for (const a of hold) g.input.hold(a, false);
}
export function tap(g, a) {
  g.input.tap(a);
  g.update(1 / 60);
}
export function newGame(opts = {}) {
  const g = new Game({ noSave: true, scene: "play", ...opts });
  g.quests.take("main");
  g.ui.toasts = [];
  return g;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = performance.now();
  const g = newGame();
  console.log("boot ms", (performance.now() - t0).toFixed(0));
  run(g, 1);
  snap(g, "village");
  run(g, 2, ["right"]);
  snap(g, "village_run");
  tap(g, "attack");
  run(g, 0.25);
  snap(g, "attack");
}
