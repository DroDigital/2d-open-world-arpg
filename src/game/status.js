// Status effects on anyone: each is a pixelfx status effect that wears the body (burning, frozen, poisoned...) or
// floats over it (stunned, asleep, charmed...), plus what it does: damage over time, no moving, slower, faster.

import { FX } from "../pfx.js";

export const STATUS = {
  burning: { fx: "status/burning", dot: 0.035, tick: 0.5, el: "fire", dur: 4, color: "#ff8a2a", label: "BURN" },
  frozen: { fx: "status/frozen", stop: true, dur: 2.5, color: "#9bdcff", label: "FROZEN", breakOnHit: 0.5 },
  poisoned: { fx: "status/poisoned", dot: 0.025, tick: 0.8, el: "poison", dur: 6, color: "#a8e04a", label: "POISON" },
  shocked: { fx: "lightning/electrified", dot: 0.02, tick: 0.4, el: "shock", dur: 2.2, color: "#7cc8ff", label: "SHOCK", jitter: true },
  bleeding: { fx: "status/bleeding", dot: 0.03, tick: 0.6, el: "blood", dur: 5, color: "#ff5a50", label: "BLEED" },
  charmed: { fx: "status/charmed", dur: 5, color: "#ff86e6", label: "CHARMED", pacify: true },
  confused: { fx: "status/confused", dur: 4, color: "#c684ff", label: "CONFUSED" },
  cursed: { fx: "status/cursed", dur: 8, color: "#a970e0", label: "CURSED", vuln: 0.35 },
  haste: { fx: "status/haste", dur: 30, color: "#ffe066", label: "HASTE", buff: true },
  petrified: { fx: "status/petrified", stop: true, dur: 3.8, color: "#a4a4b2", label: "STONE", once: true },
  rage: { fx: "status/rage", dur: 20, color: "#ff5a3a", label: "RAGE", buff: true },
  sleep: { fx: "status/sleep", stop: true, dur: 6, color: "#a8c8ff", label: "SLEEP", breakOnHit: 1 },
  slowed: { fx: "status/slowed", dur: 4, color: "#8ab4ff", label: "SLOW" },
  stunned: { fx: "status/stunned", stop: true, dur: 1.4, color: "#ffe066", label: "STUN" },
  glitched: { fx: "scifi/glitch", dur: 3, color: "#ff4fd8", label: "GLITCH" },
  blessed: { fx: "holy/blessing", dur: 20, color: "#fff09a", label: "BLESSED", buff: true, regen: 0.02 },
  haloed: { fx: "holy/halo", dur: 60, color: "#ffe066", label: "SANCTIFIED", buff: true, resist: 0.25 },
  shielded: { fx: "holy/divine-shield", dur: 8, color: "#ffd84a", label: "SHIELD", buff: true, absorb: true },
  forcefield: { fx: "scifi/force-field", dur: 8, color: "#7cf0ff", label: "FIELD", buff: true, absorb: true },
  leafstorm: { fx: "nature/leaf-storm", dur: 10, color: "#7cc048", label: "GALE", buff: true, aura: { el: "nature", k: 0.25, r: 34, tick: 0.5 } },
  star: { fx: "pickups/power-star", dur: 6, color: "#ffe066", label: "STAR", buff: true, invuln: true, overhead: true },
};

export class Status {
  constructor(g) {
    this.g = g;
  }
  has(e, name) {
    return !!e?.st?.[name];
  }
  any(e, pred) {
    if (!e?.st) return false;
    for (const k in e.st) if (pred(STATUS[k], k)) return true;
    return false;
  }
  /** Apply a status (refreshes if it's already on). */
  apply(e, name, opts = {}) {
    const S = STATUS[name];
    if (!S || e.dead) return;
    if (e.immune?.includes(name) || (e.boss && S.stop && name !== "stunned")) return;
    e.st ??= {};
    const dur = (opts.dur ?? S.dur) * (e.boss && !S.buff ? 0.4 : 1);
    const cur = e.st[name];
    if (cur) {
      cur.t = 0;
      cur.dur = Math.max(cur.dur - cur.t, dur);
      cur.power = Math.max(cur.power, opts.power ?? 1);
      return;
    }
    const st = (e.st[name] = { t: 0, dur, power: opts.power ?? 1, acc: 0, src: opts.src ?? null, inst: null });
    const mod = FX[S.fx], body = typeof mod.actorAlpha === "function";
    st.body = body;
    const a = e.actor?.();
    if (a || S.overhead) {
      st.inst = this.g.fx.spawn(S.fx, e.x, e.y, {
        follow: e, actor: a ?? undefined, memo: !!S.overhead, seed: 3, flip: e.face < 0 && !e.critter, layer: body ? "act" : "world",
        dy: S.overhead ? -(e.h + 14) : 0, ...(S.overhead ? { light: 0.6 } : {}),
      });
    }
    if (e === this.g.hero) {
      this.g.rpg.recalc();
      if (!S.buff) this.g.number(e.x, e.y - e.h - 8, S.label, "status", S.color);
    }
    if (name === "frozen" || name === "petrified" || name === "stunned" || name === "sleep") e.vx = 0;
  }
  clear(e, name) {
    const st = e.st?.[name];
    if (!st) return;
    if (st.inst) this.g.fx.stop(st.inst);
    delete e.st[name];
    if (e === this.g.hero) this.g.rpg.recalc();
  }
  clearAll(e) {
    for (const k of Object.keys(e.st ?? {})) this.clear(e, k);
  }
  /** Something hit e: sleep and frost break. */
  onHit(e) {
    for (const k of Object.keys(e.st ?? {})) if (STATUS[k].breakOnHit && e.st[k].t > STATUS[k].breakOnHit * 0.3) this.clear(e, k);
  }
  /** Is the body drawn by a status effect right now (so the entity shouldn't draw itself)? */
  hidesBody(e) {
    if (!e.st) return false;
    for (const k in e.st) {
      const st = e.st[k];
      if (st.body && st.inst && !st.inst.dead) {
        const mod = FX[STATUS[k].fx];
        const D = mod.meta.duration, tt = mod.meta.loop ? st.inst.t % D : Math.min(st.inst.t, D);
        if (mod.actorAlpha(tt, st.inst.live?.options ?? {}) < 0.5) return true;
      }
    }
    return false;
  }
  update(e, dt) {
    if (!e.st) return;
    const g = this.g;
    for (const k of Object.keys(e.st)) {
      const S = STATUS[k], st = e.st?.[k];
      if (!st) continue; // cleared by something earlier this tick (a blow, a death)
      st.t += dt;
      if (st.inst?.live) {
        const a = e.actor?.();
        if (a) st.inst.live.options.actor = a;
        st.inst.live.options.flip = e.face < 0 && !e.critter;
        st.inst.flip = st.inst.live.options.flip;
      }
      if (S.dot) {
        st.acc += dt;
        while (st.acc >= S.tick) {
          st.acc -= S.tick;
          const max = e === g.hero ? g.rpg.stats.maxHp : e.maxHp;
          const dmg = Math.max(1, Math.round(max * S.dot * st.power * (e.boss ? 0.25 : 1)));
          if (e === g.hero) g.damageHero(dmg, { el: S.el, dot: true, quiet: true });
          else g.combat.damageEnemy(e, dmg, { el: S.el, dot: true, src: st.src });
          if (e.dead) return;
        }
      }
      if (S.regen && e === g.hero) g.rpg.heal(g.rpg.stats.maxHp * S.regen * dt);
      if (S.aura) {
        st.acc += dt;
        if (st.acc >= S.aura.tick) {
          st.acc = 0;
          g.combat.heroAura(S.aura);
        }
      }
      if (st.t >= st.dur) this.clear(e, k);
    }
  }
}
