// The people of Brightwater: dressed skeletons with their own idle business, words, wares and errands.

import { costume, drawRig } from "./rigdraw.js";
import { COSTUME_SPECS } from "../data/enemies.js";
import { QUESTS } from "./quests.js";
import * as POSE from "./poses.js";
import { READY } from "../pfx.js";

export const PEOPLE = {
  elder: { name: "ELDER MAREN", shop: null, quests: ["main", "cores"], idle: "talk",
    lines: ["The Lantern on the Stormspire kept the dark at bay for a thousand years. Then the Hollow King broke it.", "Six Wardens carry its shards now, each in their own land. The roads are dangerous. You are not.", "Waystones remember you. Touch one and it will carry you back, or bring you home when you fall."] },
  smith: { name: "BRANN THE SMITH", shop: "smith", quests: ["ore"], idle: "hammer",
    lines: ["Steel's steel. What matters is the arm behind it.", "Gold ore from the deep rock makes the best edges. Bring me some.", "Swords, spears, hammers, scythes. Even those clockwork guns from the ruins, if you've the coin."] },
  alchemist: { name: "IVY THE ALCHEMIST", shop: "alchemist", quests: ["crystals"], idle: "talk",
    lines: ["Red for blood, blue for mind, gold for haste. Don't mix them up.", "Glimmer crystals hum in the caverns under the village. My brews need them.", "A Phoenix Feather? Only if you plan to die. Plan ahead."] },
  mystic: { name: "SEER OLUWA", shop: "mystic", quests: ["ways", "deep"], idle: "float",
    lines: ["Every spell is a shape of light. Learn the shapes and the light will follow.", "Spend what you've learned here. The schools are many: fire, frost, storm, shadow, and stranger.", "The world is older than the Lantern. Things sleep in the Deep Dark that remember it."] },
  innkeep: { name: "OLD TOMMEN", shop: "inn", quests: ["chests"], idle: "talk",
    lines: ["A bed, a meal, a roof. The night is long out there.", "Adventurers find chests. I find adventurers. Tell me your stories."] },
  hunter: { name: "KESTREL", shop: null, quests: ["slimes", "bats"], idle: "talk",
    lines: ["Stay low in the woods. The archers there don't miss twice.", "Slimes hop. Wait for the landing, then strike."] },
  child: { name: "PIP", shop: null, quests: ["firework"], idle: "wave",
    lines: ["Are you a hero? You look like a hero!", "When the Lantern comes back there'll be a festival with fireworks! Real ones!"] },
  bard: { name: "LUTE", shop: null, quests: ["lands"], idle: "talk",
    lines: ["Six lands, six songs. Snow and leaves and mud and fire and storm.", "Every song needs a hero in it. Lucky me."] },
  guard: { name: "CAPTAIN ROSS", shop: null, quests: ["bandits"], idle: "guard",
    lines: ["Brightwater is safe. Out there, nothing is.", "Bandits on the woods road. Thin them out and the purse is yours."] },
  guard2: { name: "GUARD ELLA", shop: null, quests: [], idle: "guard", costume: "guard",
    lines: ["East lies the Sunken Marsh. Breathe through your mouth.", "Marsh, crags, ruins. Every land is worse than the last."] },
};

const C = {};
const costumeOf = (id) => (C[id] ??= costume({ id: "npc:" + id, ...COSTUME_SPECS[PEOPLE[id].costume ?? id] }));

export class Npcs {
  constructor(g) {
    this.g = g;
    this.list = [];
    this.byEnt = new Map();
  }
  ensure(e) {
    if (this.byEnt.has(e)) return;
    const n = { id: e.id, def: PEOPLE[e.id], x: e.x, y: e.y, home: e.x, face: -1, t: Math.random() * 5, ent: e, walk: 0 };
    this.byEnt.set(e, n);
    this.list.push(n);
  }
  update(dt) {
    const g = this.g, h = g.hero;
    for (const n of this.list) {
      n.t += dt;
      const dx = h.x - n.x;
      if (Math.abs(dx) < 70) n.face = Math.sign(dx) || n.face;
      else {
        // a little wandering
        n.walkT = (n.walkT ?? 0) - dt;
        if (n.walkT <= 0) {
          n.walkT = 3 + Math.random() * 4;
          n.walk = Math.random() < 0.5 ? 0 : Math.sign(n.home - n.x + (Math.random() - 0.5) * 60) * 18;
        }
        n.x += n.walk * dt;
        if (n.walk) n.face = Math.sign(n.walk);
        if (Math.abs(n.x - n.home) > 34) n.walk = Math.sign(n.home - n.x) * 18;
      }
      if (Math.abs(dx) < 20 && Math.abs(h.y - n.y) < 30) g.prompt(n, "TALK", () => g.ui.talk(n));
      // a marker over the head when they have something for you
      n.mark = this.mark(n);
    }
  }
  mark(n) {
    const q = this.g.quests;
    for (const id of n.def.quests) {
      if (!q.state[id]) return "!";
      if (q.state[id].done && !q.state[id].turnedIn) return "?";
    }
    return null;
  }
  draw(S) {
    const g = this.g;
    for (const n of this.list) {
      if (Math.abs(n.x - S.camX - 160) > 200) continue;
      let pose;
      if (n.walk && Math.abs(g.hero.x - n.x) >= 70) pose = POSE.run((n.t * 1.2) % 1, null, 0.3);
      else if (n.def.idle === "hammer") pose = Math.floor(n.t * 2) % 2 ? { ...READY, weapon: "hammer", fx: 10, fy: -30, sa: -2, crouch: 2 } : { ...READY, weapon: "hammer", fx: 14, fy: -14, sa: 0.4, crouch: 4 };
      else if (n.def.idle === "guard") pose = { ...POSE.idle(n.t, null), weapon: "spear", fx: 4, fy: -16, sa: -1.5 };
      else if (n.def.idle === "wave" && Math.abs(g.hero.x - n.x) < 90) pose = POSE.wave(n.t);
      else if (n.talking) pose = POSE.talk(n.t);
      else pose = POSE.idle(n.t, null);
      drawRig(S.act, pose, costumeOf(n.id), n.x, n.y, { flip: n.face < 0 });
      if (n.mark) g.ui.markOver(n.x, n.y - 46, n.mark);
    }
  }
}
export { QUESTS };
