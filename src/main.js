// The browser: a canvas scaled by whole pixels, a fixed 60 Hz step, sound once the page is touched, touch buttons.

import { Game } from "./game/game.js";
import { Audio } from "./engine/audio.js";
import { W, H } from "./engine/render.js";

const canvas = document.getElementById("game"), ctx = canvas.getContext("2d");
const img = ctx.createImageData(W, H);
let game;

function fit() {
  const k = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
  const kk = Math.min(innerWidth / W, innerHeight / H) < 1 ? Math.min(innerWidth / W, innerHeight / H) : k;
  canvas.style.width = W * kk + "px";
  canvas.style.height = H * kk + "px";
}
addEventListener("resize", fit);
fit();

function boot() {
  let actx = null;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {}
  game = new Game({ audio: new Audio(actx) });
  game.input.attach(window);
  window.game = game;
  // touch: on-screen buttons
  if (matchMedia("(pointer: coarse)").matches) {
    const T = document.getElementById("touch");
    T.classList.add("on");
    for (const b of T.querySelectorAll("button")) {
      const a = b.dataset.a;
      const on = (e) => (e.preventDefault(), game.input.hold(a, true), a === "jump" && game.input.hold("confirm", true));
      const off = (e) => (e.preventDefault(), game.input.hold(a, false), a === "jump" && game.input.hold("confirm", false));
      b.addEventListener("pointerdown", on);
      b.addEventListener("pointerup", off);
      b.addEventListener("pointercancel", off);
      b.addEventListener("pointerleave", off);
    }
  }
  const resume = () => actx && actx.state !== "running" && actx.resume();
  addEventListener("pointerdown", resume);
  addEventListener("keydown", resume);
  resume();
  let last = performance.now(), acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    game.frameMs = now - last;
    last = now;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 4) {
      game.update(STEP);
      acc -= STEP;
      n++;
    }
    if (n === 4) acc = 0;
    const out = game.render();
    img.data.set(out);
    ctx.putImageData(img, 0, 0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  addEventListener("beforeunload", () => game.scene === "play" && game.save());
}

const start = document.getElementById("start");
const go = () => {
  start.remove();
  removeEventListener("keydown", go);
  boot();
};
start.addEventListener("pointerdown", go);
addEventListener("keydown", go);
