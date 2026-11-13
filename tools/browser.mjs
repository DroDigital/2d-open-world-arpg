#!/usr/bin/env node
// Play the game in a real (headless) Chromium: start it, walk, fight, and report frame times. Screenshots in shots/.
//   node tools/browser.mjs [url]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/opt/node-tools/node_modules/playwright"));
}
import { spawn } from "node:child_process";

const url = process.argv[2] ?? "http://localhost:8099/";
let server = null;
if (!process.argv[2]) {
  server = spawn("node", ["tools/serve.mjs", "8099"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url);
await page.waitForTimeout(500);
await page.keyboard.press("Space");
await page.waitForTimeout(2500);
await page.screenshot({ path: "shots/browser_title.png" });
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(100);
await page.keyboard.press("ArrowUp");
await page.waitForTimeout(100);
// new game: the first item when there's no save
await page.keyboard.press("Space");
await page.waitForTimeout(3000);
await page.keyboard.press("Space");
await page.waitForTimeout(400);
await page.keyboard.press("Space");
await page.screenshot({ path: "shots/browser_start.png" });
const sample = async (ms) => page.evaluate(async (ms) => {
  const t = [];
  let last = performance.now();
  await new Promise((done) => {
    const end = last + ms;
    const f = (now) => {
      t.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(f);
      else done();
    };
    requestAnimationFrame(f);
  });
  t.sort((a, b) => a - b);
  return { frames: t.length, median: t[t.length >> 1].toFixed(1), p95: t[Math.floor(t.length * 0.95)].toFixed(1), upd: window.game.perf.update.toFixed(2), rend: window.game.perf.render.toFixed(2) };
}, ms);
console.log("idle in village:", await sample(2000));
await page.keyboard.down("KeyD");
await page.waitForTimeout(1500);
console.log("running:", await sample(1500));
await page.keyboard.up("KeyD");
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(250);
}
await page.keyboard.press("Digit1");
await page.waitForTimeout(600);
await page.keyboard.press("Digit2");
await page.waitForTimeout(300);
console.log("fighting:", await sample(1500));
await page.screenshot({ path: "shots/browser_fight.png" });
// a far land, by teleport
await page.evaluate(() => { const g = window.game; g.hero.x = 880 * 8; g.hero.y = g.world.groundY(g.hero.x); g.snapCamera(); g.director.setWeather("storm"); });
await page.waitForTimeout(2500);
console.log("crags in a storm:", await sample(2000));
await page.screenshot({ path: "shots/browser_crags.png" });
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no errors");
await browser.close();
server?.kill();
