// Locomotion poses for the skeleton, in pixelfx's pose terms (px from the feet, y negative up). Everything that
// moves steps at 12 fps, as the library's acts do, so it reads as drawn frames.

import { READY } from "../pfx.js";

export const STAND = { fx: -3, fy: -15, bx: 5, by: -15, ffx: -2, ffy: -4, fbx: 3, fby: -4 };
const q12 = (t) => Math.floor(t * 12) / 12;

export function idle(t, weapon) {
  const up = Math.floor(q12(t) * 1.5) & 1;
  if (weapon) return { ...READY, weapon: weapon.rig, fx: 11, fy: -18 + up, sa: weapon.rig === "bow" ? -1.3 : 0.35, crouch: 3 + up, bx: 7, by: -19 + up, ...(weapon.two ? { two: true } : {}) };
  return { ...STAND, crouch: up, fy: -15 + up, by: -15 + up };
}

/** A run cycle: phase 0..1, eight drawings. */
export function run(phase, weapon, speed = 1) {
  const p = Math.floor(phase * 8) / 8, a = p * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
  const pose = {
    lean: 3 + speed, crouch: 1 + Math.round(Math.abs(c) * 2),
    ffx: Math.round(8 * s), ffy: -4 - Math.round(Math.max(0, c) * 6), fbx: Math.round(-8 * s), fby: -4 - Math.round(Math.max(0, -c) * 6),
    fx: Math.round(-2 - 7 * s), fy: -18 + Math.round(Math.abs(s) * 2), bx: Math.round(4 + 7 * s), by: -18,
  };
  if (weapon) Object.assign(pose, { weapon: weapon.rig, fx: 8 + Math.round(-3 * s), fy: -19, sa: -1.1, ...(weapon.two ? { two: true } : {}) });
  return pose;
}

export function jump(weapon) {
  return { lean: 2, crouch: 0, ffx: 5, ffy: -10, fbx: -4, fby: -6, fx: -6, fy: -27, bx: 7, by: -25, ...(weapon ? { weapon: weapon.rig, fx: 9, fy: -24, sa: -1.3 } : {}) };
}
export function fall(t, weapon) {
  const f = Math.floor(q12(t) * 2) & 1;
  return { lean: 1, crouch: 0, ffx: 3, ffy: -6 - f, fbx: -3, fby: -4, fx: -8, fy: -25 - f, bx: 9, by: -26 + f, ...(weapon ? { weapon: weapon.rig, fx: 10, fy: -22, sa: -0.8 } : {}) };
}
export function land() {
  return { crouch: 7, lean: 3, ffx: 6, fbx: -6, fx: -4, fy: -12, bx: 8, by: -12 };
}
export function dash() {
  return { lean: 9, crouch: 5, ffx: 10, ffy: -4, fbx: -10, fby: -5, fx: -9, fy: -17, bx: -6, by: -20, ghost: 1, toeB: true };
}
export function hurt() {
  return { lean: -6, crouch: 3, ffx: 4, fbx: -5, fx: -9, fy: -27, bx: 2, by: -30, hy: -1 };
}
export function swim(t) {
  const a = Math.floor(q12(t) * 6) / 6 * Math.PI * 2, s = Math.sin(a);
  return { lean: 10, crouch: 2, ffx: -6 + Math.round(s * 3), ffy: -8, fbx: -10 - Math.round(s * 3), fby: -6, fx: 14 + Math.round(s * 4), fy: -26 + Math.round(s * 3), bx: 12 - Math.round(s * 4), by: -24 - Math.round(s * 3) };
}
export function climb(t, moving) {
  const k = moving ? (Math.floor(q12(t) * 2) & 1) : 0;
  return { turn: 1.6, crouch: 2, ffx: 0, ffy: -6 - k * 5, fbx: 1, fby: -4 - (1 - k) * 5, fx: -2, fy: -36 + k * 4, bx: 4, by: -32 - k * 4 };
}
export function cast(t) {
  const up = Math.floor(q12(t) * 3) & 1;
  return { ...READY, crouch: 3 + up, lean: -1, fx: 14, fy: -24 - up, bx: 10, by: -22, ffx: 6, fbx: -7 };
}
export function crouch() {
  return { crouch: 9, lean: 4, ffx: 6, fbx: -6, fx: 6, fy: -10, bx: 10, by: -11 };
}
export function talk(t) {
  const g = Math.floor(q12(t) * 1.5) % 3;
  return { ...STAND, fx: g === 1 ? 8 : -3, fy: g === 1 ? -22 : -15, crouch: g === 2 ? 1 : 0 };
}
export function wave(t) {
  const g = Math.floor(q12(t) * 4) & 1;
  return { ...STAND, fx: -6 + g * 3, fy: -38, bx: 5, by: -15, turn: 0.9 };
}
export function sit() {
  return { crouch: 12, lean: 2, ffx: 9, ffy: -3, fbx: 8, fby: -3, fx: 5, fy: -12, bx: 9, by: -12 };
}
export function dead() {
  return { crouch: 13, lean: 13, ffx: 9, fbx: -8, fx: 15, fy: -4, bx: 9, by: -3, hy: 2 };
}
