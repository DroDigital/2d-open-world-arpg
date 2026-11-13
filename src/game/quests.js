// Quests: the main thread (six shards, then the Hollow King) and side errands for the people of Brightwater.

import { SHARDS } from "../data/items.js";

export const QUESTS = {
  main: { name: "The Shattered Lantern", giver: "elder", main: true, desc: "The Lantern atop the Stormspire is dark. Six Wardens hold its shards. Take them back.", goal: () => "SHARDS", reward: { xp: 0 } },
  final: { name: "The Hollow King", giver: "elder", main: true, desc: "With six shards, the pad at the Spire's foot will carry you to the summit. End this.", reward: { xp: 0 } },
  slimes: { name: "Slime Trouble", giver: "hunter", desc: "Slimes are eating the turnips. Squash 8 of them.", kill: /^slime/, need: 8, reward: { gold: 60, item: ["bow", 2, 1], xp: 60 } },
  bats: { name: "Wings in the Dark", giver: "hunter", desc: "Bats harry travellers at night and in caves. Thin them out: 6.", kill: /^bat/, need: 6, reward: { items: { elixir: 2 }, xp: 90 } },
  bandits: { name: "Bandit Bounty", giver: "guard", desc: "Bandits on the roads. Bring them to justice: 5.", kill: /^bandit/, need: 5, reward: { gold: 150, xp: 120 } },
  crystals: { name: "Glimmer for the Brew", giver: "alchemist", desc: "Bring me 5 Glimmer Crystals from the caves.", bring: "crystal", need: 5, reward: { items: { potion: 3, ether: 2 }, xp: 100 } },
  ore: { name: "Ore for the Forge", giver: "smith", desc: "Bring 4 Gold Ore and I'll forge you something rare.", bring: "ore", need: 4, reward: { forge: 2, xp: 120 } },
  ways: { name: "Paths of Light", giver: "mystic", desc: "Attune 4 waystones beyond Brightwater.", ways: 5, need: 4, reward: { points: 2, xp: 150 } },
  firework: { name: "Fireworks!", giver: "child", desc: "Can you bring me a firework? Pleeease?", bring: "firework", need: 1, reward: { items: { star: 1 }, xp: 40, show: true } },
  lands: { name: "A Song of the Lands", giver: "bard", desc: "Walk all six lands so I can write their verses.", lands: true, need: 6, reward: { item: ["amulet", 8, 3], xp: 200 } },
  chests: { name: "Treasure Hunter", giver: "innkeep", desc: "Open 8 chests out there and tell me about it.", chests: true, need: 8, reward: { items: { feather: 1 }, gold: 100, xp: 150 } },
  cores: { name: "Silence the Cores", giver: "elder", desc: "Three ancient cores still beat in the Stormspire Ruins. Overload them.", cores: true, need: 3, reward: { points: 1, gold: 200, xp: 300 } },
  deep: { name: "The Deep Dark", giver: "mystic", desc: "Something sleeps far below the world. Go deeper than anyone has.", deep: true, need: 1, reward: { item: ["ring", 14, 3], xp: 300 } },
};

export class Quests {
  constructor(g) {
    this.g = g;
    this.state = {}; // id -> { n, done, turnedIn }
    this.lands = new Set();
  }
  serialize() {
    return { state: this.state, lands: [...this.lands] };
  }
  load(d) {
    if (!d) return;
    this.state = d.state;
    this.lands = new Set(d.lands);
  }
  active(id) {
    const s = this.state[id];
    return s && !s.turnedIn;
  }
  take(id) {
    if (this.state[id]) return;
    this.state[id] = { n: 0, done: false, turnedIn: false };
    this.g.toast("NEW QUEST: " + QUESTS[id].name.toUpperCase(), "#ffe066");
    this.g.sfx("quest");
    this.refresh(id);
  }
  progress(id) {
    const q = QUESTS[id], s = this.state[id];
    if (!s) return 0;
    if (q.bring) return Math.min(q.need, this.g.rpg.items[q.bring] ?? 0);
    return Math.min(q.need ?? 1, s.n);
  }
  refresh(id) {
    const q = QUESTS[id], s = this.state[id];
    if (!s || s.done) return;
    if (id === "main") s.done = Object.keys(this.g.rpg.shards).length >= 6;
    else if (id === "final") s.done = !!this.g.rpg.flags["boss:king"];
    else if (q.ways) s.n = Object.keys(this.g.rpg.flags).filter((k) => k.startsWith("way:") && k !== "way:brightwater").length;
    else if (q.lands) s.n = this.lands.size;
    if (q.need && this.progress(id) >= q.need && !s.done) {
      s.done = true;
      this.g.toast(q.name.toUpperCase() + " - RETURN TO " + q.giver.toUpperCase(), "#ffe066");
    }
  }
  /** Talk to a giver with a finished quest: rewards. */
  turnIn(id) {
    const g = this.g, q = QUESTS[id], s = this.state[id];
    if (!s?.done || s.turnedIn) return false;
    if (q.bring && !g.rpg.take(q.bring, q.need)) return false;
    s.turnedIn = true;
    const r = q.reward;
    if (r.gold) g.rpg.gold += r.gold;
    if (r.xp) g.rpg.gainXp(r.xp);
    if (r.points) g.skills.points += r.points;
    for (const [k, n] of Object.entries(r.items ?? {})) g.rpg.give(k, n);
    if (r.item) g.rpg.addGear(g.rpg.makeItem(r.item[0], Math.max(r.item[1], g.rpg.level), r.item[2]));
    if (r.forge) g.rpg.addGear(g.rpg.makeItem(g.rpg.equip.weapon?.base ?? "sword", g.rpg.level + 1, r.forge));
    if (r.show) g.director.festival({ x: g.hero.x, y: g.hero.y }, 0), (g.rpg.flags["festival:" + Object.keys(g.rpg.shards).length] = false);
    g.fx.spawn("ui/quest-complete", 160, 40, { layer: "ui", seed: 3 });
    g.sfx("quest");
    g.save();
    return true;
  }
  update(dt) {
    this.tick = (this.tick ?? 0) - dt;
    if (this.tick > 0) return;
    this.tick = 0.5;
    const g = this.g, b = g.world.biome(g.hero.x).id;
    if (!this.lands.has(b)) {
      this.lands.add(b);
      g.ui.banner(g.world.biome(g.hero.x).name.toUpperCase());
    }
    if (g.hero.y > 150 * 8 && this.active("deep")) (this.state.deep.n = 1), this.refresh("deep");
    for (const id in this.state) this.refresh(id);
    // a region's name when you first walk in
    const reg = g.director.region;
    if (reg && reg.id !== this.lastReg && g.director.underground > 0.3) g.ui.banner(reg.name.toUpperCase());
    this.lastReg = reg?.id;
  }
  onKill(e) {
    for (const id in this.state) {
      const q = QUESTS[id];
      if (q.kill && q.kill.test(e.type) && !this.state[id].done) {
        this.state[id].n++;
        this.refresh(id);
      }
    }
  }
  onChest() {
    if (this.state.chests && !this.state.chests.done) {
      this.state.chests.n++;
      this.refresh("chests");
    }
  }
  onWaystone() {
    this.refresh("ways");
  }
  onItem() {
    for (const id in this.state) this.refresh(id);
  }
  onBoss(id) {
    this.refresh("main");
    if (Object.keys(this.g.rpg.shards).length >= 6 && !this.state.final) {
      this.g.ui.say("THE ELDER'S VOICE", "Six shards. The pad at the Spire's foot will wake for you now. Go, and bring back the light.");
      this.take("final");
    }
    void id;
  }
  core(e) {
    const g = this.g;
    if (g.rpg.flags["core:" + e.id]) return;
    g.rpg.flags["core:" + e.id] = true;
    g.fx.spawn("explosions/plasma-explosion", e.x, e.y - 30, { seed: 3 });
    g.fx.spawn("scifi/emp-blast", e.x, e.y - 10, { seed: 2 });
    for (const x of g.world.ents) if (x === e) x.kind = "gone";
    g.ents.sleep(e);
    g.rpg.give("core", 1);
    g.shake(3, 0.4);
    g.sfx("boom");
    if (this.state.cores && !this.state.cores.done) {
      this.state.cores.n++;
      this.refresh("cores");
    }
  }
  list() {
    return Object.keys(this.state).map((id) => ({ id, q: QUESTS[id], s: this.state[id], p: this.progress(id) })).sort((a, b) => (a.s.turnedIn - b.s.turnedIn) || (b.q.main ? 1 : 0) - (a.q.main ? 1 : 0));
  }
}
export { SHARDS };
