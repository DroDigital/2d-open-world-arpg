// The hero's growth and belongings: level and attributes, equipment and its affixes, the bag, gold, shards and the
// abilities they grant, and the loot table.

import { Rng, PAL } from "../pfx.js";
import { RARITY, ELEMENTS, AFFIXES, BASES, DYES, CONSUMABLES, MATERIALS, SHARDS } from "../data/items.js";
import { WEAPONS } from "../data/weapons.js";
import { costume, COSTUMES } from "./rigdraw.js";

let itemSeq = 1;
export const xpFor = (lv) => Math.round(40 * Math.pow(lv, 1.55));

export class RPG {
  constructor(g) {
    this.g = g;
    this.level = 1;
    this.xp = 0;
    this.points = 0;
    this.attr = { vigor: 3, might: 3, focus: 3, agility: 3 };
    this.gold = 30;
    this.bag = []; // equipment items
    this.items = { potion: 3, ether: 1 }; // consumables and materials, by id
    this.equip = { weapon: null, armor: null, helm: null, boots: null, ring: null, amulet: null };
    this.shards = {};
    this.flags = {};
    this.kills = {};
    this.hp = 1;
    this.mp = 1;
    this.R = new Rng(1234);
    this.stats = {};
    this.costume = COSTUMES.hero;
    this.equip.weapon = this.makeItem("sword", 1, 0);
    this.equip.armor = this.makeItem("tunic", 1, 0);
    this.recalc();
    this.hp = this.stats.maxHp;
    this.mp = this.stats.maxMp;
  }
  has(ability) {
    if (this.flags["ability:" + ability]) return true;
    return Object.keys(this.shards).some((k) => SHARDS[k].ability === ability);
  }
  weaponClass() {
    return this.equip.weapon ? BASES[this.equip.weapon.base].cls : "sword";
  }
  weaponPalette() {
    const el = this.equip.weapon?.el;
    return el ? ELEMENTS[el].pal : null;
  }
  // ---- stats from attributes, level and gear
  recalc() {
    const a = this.attr, L = this.level, gear = Object.values(this.equip).filter(Boolean);
    const sum = (stat) => gear.reduce((s, it) => s + (it.mods[stat] ?? 0), 0);
    const W = this.equip.weapon, wc = WEAPONS[this.weaponClass()];
    const s = {
      maxHp: Math.round(60 + a.vigor * 12 + L * 7 + sum("hp")),
      maxMp: Math.round(30 + a.focus * 8 + L * 2 + sum("mp")),
      atk: Math.round((4 + a.might * 2 + L * 1.4 + sum("atk") + (W?.dmg ?? 6)) * (wc?.dmg ?? 1)),
      spell: Math.round(5 + a.focus * 2.6 + L * 1.6 + sum("spell")),
      crit: Math.min(0.75, 0.05 + a.agility * 0.006 + sum("crit") / 100 + (wc?.crit ?? 0)),
      aspd: 1 + a.agility * 0.008 + sum("aspd") / 100,
      move: 1 + sum("move") / 100 + a.agility * 0.003,
      jump: 1,
      def: Math.round(sum("def") + a.vigor * 0.5),
      regen: 0.4 + sum("regen"),
      mregen: 1.2 + a.focus * 0.12,
      leech: sum("leech") / 100,
      gold: 1 + sum("gold") / 100,
      cdr: Math.min(0.4, sum("cdr") / 100),
    };
    if (this.g.status?.has?.(this.g.hero, "rage")) (s.atk = Math.round(s.atk * 1.4)), (s.def = Math.round(s.def * 0.5));
    if (this.g.status?.has?.(this.g.hero, "haste")) s.aspd *= 1.25;
    this.stats = s;
    this.hp = Math.min(this.hp, s.maxHp);
    this.mp = Math.min(this.mp, s.maxMp);
    this.dress();
  }
  // the hero's look follows the armor's dye
  dress() {
    const arm = this.equip.armor, helm = this.equip.helm, boots = this.equip.boots;
    const base = { id: "hero:" + (arm?.dye ?? 0) + ":" + (helm ? helm.tier : -1) + ":" + (boots ? boots.tier : -1) };
    const H = COSTUMES.hero.byPart, dye = DYES[arm?.dye ?? 0].tunic;
    const spec = {
      id: base.id, hair: helm ? [["#a87a4a", "#7a5232", "#523420", "#2e1c14"], ["#c8a878", "#9a7a50", "#6a5034", "#3e2c1c"], ["#d0d8e4", "#9aa6ba", "#606a7e", "#383e4c"], ["#ffe066", "#f0b424", "#b47a14", "#6a3a0c"]][helm.tier] : ["#f0a860", "#c8743a", "#8a4428", "#561e1a"],
      skin: ["#ffd8b4", "#f0b088", "#c4805e", "#8a4e3a"], tunic: dye, sleeve: dye.map((c, i) => dye[Math.min(3, i + 1)]),
      arm: ["#c89a6a", "#9a6a44", "#6a4430", "#3e2620"], hand: ["#a87850", "#7a5232", "#523420", "#2e1c14"], belt: ["#e8c060", "#b08030", "#7a5420", "#4a3014"],
      legs: ["#5a5a8a", "#40406a", "#2c2c4c", "#1c1c30"], boots: boots ? [["#9a6a44", "#6e4a30", "#4a3020", "#2c1c14"], ["#7a5a3a", "#5a3e28", "#3c2818", "#22160e"], ["#a4aec0", "#6e788c", "#4a5262", "#2c303c"], ["#f0f4ff", "#b8c8e8", "#7a8cb8", "#4a5884"]][boots.tier] : ["#9a6a44", "#6e4a30", "#4a3020", "#2c1c14"],
      mark: "#ffe06a",
    };
    void H;
    this.costume = costume(spec);
  }
  // ---- growth
  gainXp(n) {
    this.xp += n;
    let up = false;
    while (this.xp >= xpFor(this.level)) {
      this.xp -= xpFor(this.level);
      this.level++;
      this.points += 3;
      up = true;
    }
    if (up) {
      this.recalc();
      this.hp = this.stats.maxHp;
      this.mp = this.stats.maxMp;
      this.g.onLevelUp();
    }
  }
  spend(attr) {
    if (this.points <= 0) return false;
    this.attr[attr]++;
    this.points--;
    this.recalc();
    return true;
  }
  // ---- items
  makeItem(baseId, level, rarity, opts = {}) {
    const B = BASES[baseId], R = this.R, rr = RARITY[rarity];
    const tier = Math.min(B.names.length - 1, Math.floor(level / 6));
    const it = { uid: itemSeq++, base: baseId, slot: B.slot, level, rarity, tier, mods: {}, name: B.names[tier] };
    if (B.slot === "weapon") it.dmg = Math.round((B.dmg + level * 1.2) * rr.mult);
    if (B.def) it.mods.def = Math.round((B.def + level * 0.35) * rr.mult);
    if (B.move) it.mods.move = B.move;
    if (B.slot === "armor") it.dye = opts.dye ?? R.int(0, DYES.length - 1);
    const picks = AFFIXES.slice().sort(() => R.next() - 0.5).slice(0, rr.affixes);
    for (const a of picks) it.mods[a.stat] = (it.mods[a.stat] ?? 0) + Math.round((a.v[0] + R.next() * (a.v[1] - a.v[0]) + level * a.per) * 10) / 10;
    if (B.slot === "weapon" && rarity >= 1 && (R.next() < 0.45 || opts.el)) it.el = opts.el ?? R.pick(Object.keys(ELEMENTS));
    // a name: prefix from the first affix, suffix from the element
    if (picks.length) it.name = picks[0].pre + " " + it.name;
    if (it.el) it.name += " of " + ELEMENTS[it.el].name;
    if (rarity === 4) it.name = ["Dawnbringer", "Starfall", "Last Light", "Hollowsong", "Embertongue", "Gravewind"][R.int(0, 5)] + " (" + B.names[tier] + ")";
    it.value = Math.round((10 + level * 6) * rr.mult * (1 + rarity));
    return it;
  }
  /** A random drop for a level: equipment, a consumable, materials or gold. */
  rollLoot(level, luck = 0) {
    const R = this.R, r = R.next();
    if (r < 0.32 + luck * 0.2) {
      const rar = R.next(), rarity = rar < 0.02 + luck * 0.05 ? 4 : rar < 0.08 + luck * 0.1 ? 3 : rar < 0.22 + luck * 0.15 ? 2 : rar < 0.5 ? 1 : 0;
      const ids = Object.keys(BASES), weights = ids.map((id) => (BASES[id].slot === "weapon" ? (["launcher", "smg", "shotgun"].includes(id) ? 0.4 : 1) : 1.3));
      let k = R.next() * weights.reduce((a, b) => a + b, 0), id = ids[0];
      for (let i = 0; i < ids.length; i++) if ((k -= weights[i]) <= 0) {
        id = ids[i];
        break;
      }
      return { type: "gear", item: this.makeItem(id, Math.max(1, level + R.int(-1, 1)), rarity) };
    }
    if (r < 0.55) return { type: "item", id: R.pick(["potion", "potion", "ether", "bomb", "elixir", "fury", "flare", "firework", "star"]), n: 1 };
    if (r < 0.7) return { type: "item", id: R.pick(["crystal", "ore", "gem", "frostshard"]), n: 1 };
    return { type: "gold", n: Math.round((4 + level * 3) * (0.6 + R.next()) * this.stats.gold) };
  }
  give(id, n = 1) {
    this.items[id] = (this.items[id] ?? 0) + n;
  }
  take(id, n = 1) {
    if ((this.items[id] ?? 0) < n) return false;
    this.items[id] -= n;
    if (!this.items[id]) delete this.items[id];
    return true;
  }
  addGear(it) {
    this.bag.push(it);
    if (this.bag.length > 40) this.bag.shift();
  }
  equipItem(it) {
    const old = this.equip[it.slot];
    this.equip[it.slot] = it;
    this.bag = this.bag.filter((b) => b !== it);
    if (old) this.bag.push(old);
    this.recalc();
    this.g.sfx("equip");
  }
  sell(it) {
    this.bag = this.bag.filter((b) => b !== it);
    this.gold += Math.round(it.value * 0.4);
  }
  /** How much better an item is than what's worn, as one number (for the arrows in the bag). */
  score(it) {
    if (!it) return 0;
    const m = it.mods;
    return (it.dmg ?? 0) * 1.5 + (m.atk ?? 0) * 2 + (m.spell ?? 0) * 1.5 + (m.hp ?? 0) * 0.3 + (m.mp ?? 0) * 0.3 + (m.def ?? 0) * 2 + (m.crit ?? 0) + (m.aspd ?? 0) * 0.6 + (m.move ?? 0) * 0.5 + (m.regen ?? 0) * 3 + (m.leech ?? 0) * 2 + (m.cdr ?? 0) + it.rarity * 2;
  }
  drinkPotion() {
    const g = this.g, s = this.stats;
    if (this.hp < s.maxHp && this.take("potion")) {
      this.heal(Math.round(s.maxHp * 0.45));
      g.fx.spawn("holy/heal", g.hero.x, g.hero.y, { actor: g.heroActor(), seed: 3, follow: g.hero, memo: false });
      g.sfx("drink");
      return true;
    }
    if (this.mp < s.maxMp && this.take("ether")) {
      this.mp = Math.min(s.maxMp, this.mp + s.maxMp * 0.6);
      g.fx.spawn("arcane/mana-burst", g.hero.x, g.hero.y - 4, { seed: 5, light: 0.6 });
      g.sfx("drink");
      return true;
    }
    g.toast("NO POTIONS");
    return false;
  }
  heal(n) {
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
    if (this.hp - before >= 1) this.g.number(this.g.hero.x, this.g.hero.y - 40, "+" + Math.round(this.hp - before), "heal");
  }
  serialize() {
    return { level: this.level, xp: this.xp, points: this.points, attr: this.attr, gold: this.gold, bag: this.bag, items: this.items, equip: this.equip, shards: this.shards, flags: this.flags, kills: this.kills, hp: this.hp, mp: this.mp };
  }
  load(d) {
    Object.assign(this, d);
    itemSeq = 1 + Math.max(0, ...this.bag.map((b) => b.uid), ...Object.values(this.equip).filter(Boolean).map((b) => b.uid));
    this.recalc();
  }
}
export { PAL };
