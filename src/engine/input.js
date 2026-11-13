// Input: keyboard, gamepad and touch, folded into named actions with down / pressed / released each tick.

export const ACTIONS = ["left", "right", "up", "down", "jump", "attack", "dash", "s1", "s2", "s3", "s4", "interact", "potion", "menu", "map", "inv", "pause", "confirm", "back", "tabL", "tabR"];

const KEYS = {
  ArrowLeft: ["left"], KeyA: ["left"], ArrowRight: ["right"], KeyD: ["right"],
  ArrowUp: ["up"], KeyW: ["up"], ArrowDown: ["down"], KeyS: ["down"],
  Space: ["jump", "confirm"], KeyK: ["jump"], KeyZ: ["jump"],
  KeyJ: ["attack"], KeyX: ["attack"],
  ShiftLeft: ["dash"], ShiftRight: ["dash"], KeyL: ["dash"], KeyC: ["dash"],
  Digit1: ["s1"], Digit2: ["s2"], Digit3: ["s3"], Digit4: ["s4"], KeyU: ["s1"], KeyI: ["s2"], KeyO: ["s3"], KeyP: ["s4"],
  KeyE: ["interact"], KeyF: ["interact"], KeyQ: ["potion"], KeyR: ["potion"],
  Tab: ["inv"], KeyB: ["inv"], KeyM: ["map"], Escape: ["pause", "back"], Enter: ["confirm", "menu"], Backspace: ["back"],
  BracketLeft: ["tabL"], BracketRight: ["tabR"], PageUp: ["tabL"], PageDown: ["tabR"],
};
// standard gamepad layout
const PAD = { 0: ["jump", "confirm"], 1: ["dash", "back"], 2: ["attack"], 3: ["interact"], 4: ["s1", "tabL"], 5: ["s2", "tabR"], 6: ["s3"], 7: ["s4"], 8: ["map"], 9: ["pause", "menu"], 12: ["up"], 13: ["down"], 14: ["left"], 15: ["right"], 10: ["potion"], 11: ["inv"] };

export class Input {
  constructor() {
    this.down = {};
    this.prev = {};
    this.pressed = {};
    this.released = {};
    this.raw = new Set();
    this.virtual = new Set(); // touch buttons and scripted presses
    this.queued = new Set(); // one-tick presses
    this.hits = new Set(); // keys pressed since the last poll, even if already let go
    this.lastDevice = "keyboard";
    this.anyPressed = false;
    for (const a of ACTIONS) this.down[a] = this.prev[a] = false;
  }
  attach(win) {
    win.addEventListener("keydown", (e) => {
      if (KEYS[e.code] || e.code === "Tab") e.preventDefault();
      this.raw.add(e.code);
      if (!e.repeat) this.hits.add(e.code);
      this.lastDevice = "keyboard";
    });
    win.addEventListener("keyup", (e) => this.raw.delete(e.code));
    win.addEventListener("blur", () => this.raw.clear());
  }
  /** Press an action for one tick (scripts, tests, touch taps). */
  tap(a) {
    this.queued.add(a);
  }
  hold(a, on) {
    if (on) this.virtual.add(a);
    else this.virtual.delete(a);
  }
  poll() {
    const now = {};
    for (const a of ACTIONS) now[a] = false;
    for (const code of this.raw) for (const a of KEYS[code] ?? []) now[a] = true;
    // a tap shorter than a frame still counts once
    const tapped = {};
    for (const code of this.hits) for (const a of KEYS[code] ?? []) if (!now[a]) tapped[a] = now[a] = true;
    this.hits.clear();
    for (const a of this.virtual) now[a] = true;
    for (const a of this.queued) now[a] = true;
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads ?? []) {
      if (!p) continue;
      p.buttons.forEach((b, i) => {
        if (b.pressed) {
          for (const a of PAD[i] ?? []) now[a] = true;
          this.lastDevice = "pad";
        }
      });
      const [x, y] = [p.axes[0] ?? 0, p.axes[1] ?? 0];
      if (x < -0.4) now.left = true;
      if (x > 0.4) now.right = true;
      if (y < -0.5) now.up = true;
      if (y > 0.5) now.down = true;
    }
    this.anyPressed = false;
    for (const a of ACTIONS) {
      this.prev[a] = this.down[a];
      this.down[a] = now[a];
      this.pressed[a] = now[a] && !this.prev[a];
      this.released[a] = !now[a] && this.prev[a];
      if (this.pressed[a]) this.anyPressed = true;
    }
    this.queued.clear();
  }
  /** Horizontal axis -1..1. */
  get ax() {
    return (this.down.right ? 1 : 0) - (this.down.left ? 1 : 0);
  }
  get ay() {
    return (this.down.down ? 1 : 0) - (this.down.up ? 1 : 0);
  }
  /** Consume a press so a second system doesn't also see it this tick. */
  eat(a) {
    this.pressed[a] = false;
  }
}
