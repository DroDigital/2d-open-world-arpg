// Every skill, by school. Each one plays pixelfx effects; `type` says how it behaves:
//   act      the hero performs the effect's act (its poses), damage lands on the act's own hit times
//   proj     a projectile (combat.js SHOTS) after a short cast
//   place    an effect dropped on the nearest foe (or ahead), hurting on its landing time
//   channel  a loop held in front of the hero while the key is held: damage ticks, mana drains
//   buff     a status on the hero
//   summon   an effect left in the world that hurts (or helps) for a while
//   target   a status effect that wears the nearest foe's body (freeze, curse, roots)
//   special  bespoke (blink, heal, time stop, decoy, scan...)
// k: damage as a multiple of spell power (or attack, with phys); mp; cd seconds; lv: level to learn; cost: points.

import { PAL } from "../pfx.js";

export const SCHOOLS = {
  blade: { name: "Blade", color: "#e8edf6", pal: PAL.metal },
  fire: { name: "Fire", color: "#ff8a2a", pal: PAL.fire },
  ice: { name: "Ice", color: "#9bdcff", pal: PAL.ice },
  storm: { name: "Storm", color: "#7cc8ff", pal: PAL.electric },
  arcane: { name: "Arcane", color: "#c684ff", pal: PAL.arcane },
  holy: { name: "Holy", color: "#ffe066", pal: PAL.holy },
  shadow: { name: "Shadow", color: "#a970e0", pal: PAL.shadow },
  nature: { name: "Nature", color: "#7cc048", pal: PAL.leaf },
  tide: { name: "Tide", color: "#36a2e0", pal: PAL.water },
  tech: { name: "Tech", color: "#4ce8d8", pal: PAL.cyber },
};

const S = (school, name, type, fx, o) => ({ school, name, type, fx, ...o });
export const SKILLS = {
  // ---- blade: the whole moves
  threefold: S("blade", "Threefold Edge", "act", "moves/sword-combo", { k: 1.1, phys: true, mp: 10, cd: 5, lv: 1, cost: 0, desc: "A slash, a crossing cut and a cleave, walking forward." }),
  rush: S("blade", "Phantom Rush", "act", "moves/dash-strike", { k: 2.2, phys: true, mp: 14, cd: 7, lv: 4, cost: 1, moveBody: 1.32, dur: 1.36, area: "path", desc: "Cross the floor in a blur and cut through everything." }),
  deadeye: S("blade", "Deadeye", "act", "moves/pistol-shots", { k: 0.9, phys: true, mp: 12, cd: 6, lv: 6, cost: 1, desc: "Three aimed shots that stagger." }),
  piercing: S("blade", "Piercing Arrow", "act", "moves/arrow-shot", { k: 2.4, phys: true, mp: 12, cd: 6, lv: 3, cost: 1, area: "line", desc: "Draw, hold, loose: an arrow that crosses the floor." }),
  siege: S("blade", "Siege Rocket", "act", "moves/rocket-launcher", { k: 4.5, phys: true, mp: 30, cd: 16, lv: 14, cost: 2, dur: 1.5, r: 50, desc: "Kneel, shoulder the tube, flatten the target." }),
  pound: S("blade", "Meteor Drop", "act", "moves/ground-pound", { k: 2.6, phys: true, mp: 18, cd: 9, lv: 8, cost: 2, air: true, area: "around", r: 80, desc: "Leap out of sight and come down like a rock." }),
  // ---- fire
  firebolt: S("fire", "Fire Bolt", "proj", "fire/fireball", { shot: "fire", k: 1.1, mp: 6, cd: 0.6, lv: 1, cost: 0, desc: "A ball of flame that bursts on contact." }),
  fireball: S("fire", "Great Fireball", "act", "moves/fireball-throw", { k: 3.2, mp: 22, cd: 10, lv: 7, cost: 2, dur: 1.5, r: 48, desc: "Gather fire, lean back and hurl it." }),
  firering: S("fire", "Ring of Fire", "act", "fire/fire-ring", { k: 1.6, mp: 18, cd: 8, lv: 4, cost: 1, area: "around", r: 92, status: "burning", desc: "Flames race outward along the floor." }),
  breath: S("fire", "Dragon's Breath", "channel", "fire/fire-breath", { k: 0.35, mp: 14, cd: 1, lv: 6, cost: 1, len: 120, status: "burning", desc: "Hold to breathe a cone of fire." }),
  inferno: S("fire", "Inferno Jet", "channel", "fire/flamethrower", { k: 0.42, mp: 16, cd: 1, lv: 10, cost: 2, len: 112, status: "burning", desc: "Hold: a pressurised jet of flame." }),
  pillar: S("fire", "Flame Pillar", "place", "fire/flame-pillar", { k: 2.4, mp: 16, cd: 6, lv: 5, cost: 1, r: 18, h: 140, ticks: 5, desc: "The floor cracks and a column of fire erupts." }),
  firestorm: S("fire", "Firestorm", "summon", "fire/fire-tornado", { k: 0.6, mp: 26, cd: 14, lv: 12, cost: 2, life: 7, r: 22, move: 30, status: "burning", desc: "A spinning funnel of fire wanders forward." }),
  meteorcall: S("fire", "Meteor Call", "act", "moves/meteor-call", { k: 6, mp: 40, cd: 30, lv: 18, cost: 3, dur: 2.4, r: 70, ult: true, desc: "A long chant, then a burning rock flattens the scene." }),
  meteor: S("fire", "Meteor", "place", "fire/meteor", { k: 3.6, mp: 26, cd: 12, lv: 13, cost: 2, r: 44, desc: "Call one burning rock down on a foe." }),
  // ---- ice
  frostnova: S("ice", "Frost Nova", "act", "ice/frost-nova", { k: 1.3, mp: 14, cd: 6, lv: 1, cost: 0, area: "around", r: 104, status: "frozen", desc: "Ice crystals bloom in rings round you, freezing foes." }),
  icelance: S("ice", "Ice Lance", "proj", "ice/ice-lance", { shot: "ice", k: 1.3, mp: 8, cd: 0.9, lv: 2, cost: 1, desc: "A faceted spear of ice." }),
  javelin: S("ice", "Glacial Javelin", "act", "moves/ice-lance-throw", { k: 3.4, mp: 22, cd: 10, lv: 9, cost: 2, dur: 1.3, desc: "Frost gathers into a spear and is thrown." }),
  icespikes: S("ice", "Glacier Line", "place", "ice/ice-spikes", { k: 1.8, mp: 18, cd: 7, lv: 6, cost: 1, at: "self", r: 172, line: true, status: "slowed", desc: "Ice blades burst up along the floor ahead." }),
  icicles: S("ice", "Icicle Drop", "place", "ice/icicle-fall", { k: 2.2, mp: 12, cd: 4, lv: 4, cost: 1, r: 16, h: 60, status: "slowed", desc: "An icicle snaps and drops on a foe." }),
  frostbreath: S("ice", "Frost Breath", "channel", "ice/frost-breath", { k: 0.3, mp: 12, cd: 1, lv: 8, cost: 1, len: 130, status: "slowed", desc: "Hold: a cone of freezing wind." }),
  vortex: S("ice", "Blizzard", "summon", "ice/blizzard-vortex", { k: 0.4, mp: 22, cd: 14, lv: 11, cost: 2, life: 8, r: 26, move: 24, status: "slowed", desc: "A swirling snow tornado that chills all it touches." }),
  deepfreeze: S("ice", "Deep Freeze", "target", "ice/freeze", { k: 1.5, mp: 16, cd: 9, lv: 7, cost: 1, status: "frozen", dur: 3, desc: "Seal a foe in a block of ice, then shatter it." }),
  // ---- storm
  chain: S("storm", "Chain Lightning", "act", "lightning/chain-lightning", { k: 1.4, mp: 14, cd: 5, lv: 3, cost: 1, area: "targets", status: "shocked", desc: "A bolt leaps from foe to foe." }),
  thunderclap: S("storm", "Thunderclap", "act", "lightning/thunderclap", { k: 1.8, mp: 18, cd: 8, lv: 6, cost: 1, area: "around", r: 104, status: "stunned", desc: "Forked bolts burst out and a shock ring tears the floor." }),
  callstorm: S("storm", "Call Lightning", "act", "moves/lightning-call", { k: 3, mp: 22, cd: 10, lv: 10, cost: 2, status: "shocked", desc: "A sigil, a raised arm, a bolt from the sky." }),
  overcharge: S("storm", "Overcharge", "act", "lightning/charge-up", { k: 2.6, mp: 20, cd: 12, lv: 9, cost: 2, area: "around", r: 90, onBody: true, desc: "Gather lightning in your hand until it bursts every way." }),
  balllight: S("storm", "Ball Lightning", "summon", "lightning/ball-lightning", { k: 0.5, mp: 20, cd: 12, lv: 8, cost: 1, life: 8, r: 30, move: 40, status: "shocked", desc: "A crackling ball of plasma drifts ahead, zapping all near." }),
  tesla: S("storm", "Tesla Totem", "summon", "lightning/tesla-coil", { k: 0.8, mp: 24, cd: 18, lv: 12, cost: 2, life: 12, r: 70, pulse: 0.8, status: "shocked", desc: "Plant a coil that lashes arcs at nearby foes." }),
  stormcloud: S("storm", "Thundercloud", "summon", "lightning/storm-cloud", { k: 1.4, mp: 26, cd: 16, lv: 14, cost: 2, life: 9, r: 26, pulse: 1, move: 26, status: "shocked", desc: "A storm cloud follows foes and strikes." }),
  bolt: S("storm", "Smite Bolt", "place", "lightning/lightning-strike", { k: 2.6, mp: 18, cd: 7, lv: 5, cost: 1, r: 30, h: 300, status: "shocked", desc: "A sigil on the floor, then a bolt slams into it." }),
  // ---- arcane
  missiles: S("arcane", "Arcane Missiles", "act", "arcane/arcane-missiles", { k: 0.7, mp: 12, cd: 3, lv: 2, cost: 1, desc: "A volley of violet bolts curls onto the target." }),
  beam: S("arcane", "Arcane Beam", "channel", "arcane/arcane-beam", { k: 0.45, mp: 18, cd: 1, lv: 8, cost: 2, len: 220, beam: true, desc: "Hold: a twisting beam of force." }),
  starfall: S("arcane", "Star Fall", "place", "arcane/star-fall", { k: 0.7, mp: 22, cd: 10, lv: 9, cost: 2, r: 52, ticks: 6, every: 0.18, desc: "Stars streak down across an area." }),
  manaburst: S("arcane", "Mana Burst", "place", "arcane/mana-burst", { k: 1.6, mp: 14, cd: 7, lv: 4, cost: 1, at: "self", r: 60, push: 3, desc: "Energy rushes in and blows out, flinging foes." }),
  sanctum: S("arcane", "Sanctum", "place", "arcane/magic-circle-cast", { k: 3.8, mp: 30, cd: 16, lv: 13, cost: 2, at: "self", r: 50, h: 200, desc: "A circle draws itself, runes ignite, a column of light fires up." }),
  timestop: S("arcane", "Time Stop", "special", "arcane/time-stop", { mp: 40, cd: 40, lv: 16, cost: 3, ult: true, desc: "Freeze every foe in time for five seconds." }),
  familiar: S("arcane", "Arcane Familiar", "summon", "arcane/arcane-orb", { k: 0.5, mp: 24, cd: 20, lv: 11, cost: 2, life: 15, orbit: true, shoot: "arcane", desc: "A floating orb that follows and fires at foes." }),
  ward: S("arcane", "Rune Ward", "summon", "arcane/rune-circle", { k: 0.25, mp: 16, cd: 14, lv: 6, cost: 1, life: 10, r: 60, status: "slowed", desc: "A turning rune circle slows all foes inside." }),
  recall: S("arcane", "Recall Portal", "special", "arcane/portal", { mp: 20, cd: 60, lv: 3, cost: 1, desc: "Open a rift home to Brightwater." }),
  // ---- holy
  heal: S("holy", "Heal", "special", "holy/heal", { mp: 16, cd: 6, lv: 1, cost: 0, desc: "Light blooms under you, restoring 40% health." }),
  healring: S("holy", "Healing Ring", "special", "holy/heal-aoe", { mp: 24, cd: 12, lv: 7, cost: 1, desc: "A ring of green light: heal over time, harm the dead." }),
  shield: S("holy", "Divine Shield", "buff", "holy/divine-shield", { status: "shielded", mp: 18, cd: 18, lv: 5, cost: 1, desc: "A bubble of gold light swallows blows." }),
  smite: S("holy", "Smite", "place", "holy/smite", { k: 2.4, mp: 14, cd: 5, lv: 3, cost: 1, r: 34, desc: "A bolt of light drops like a hammer." }),
  judgement: S("holy", "Judgement", "act", "moves/holy-smite", { k: 3.2, mp: 22, cd: 10, lv: 8, cost: 2, desc: "Hands up, a glint marks the target, light falls." }),
  sunlance: S("holy", "Sunlance", "place", "holy/holy-pillar", { k: 1, mp: 26, cd: 12, lv: 12, cost: 2, r: 28, h: 200, ticks: 6, every: 0.22, desc: "A fan of light converges on the mark and burns." }),
  radiance: S("holy", "Radiance", "summon", "holy/sunburst", { k: 0.3, mp: 22, cd: 18, lv: 10, cost: 2, life: 6, r: 70, status: "stunned", pulse: 2, follow: true, dy: -50, desc: "A small sun over you dazzles foes." }),
  blessing: S("holy", "Blessing", "buff", "holy/blessing", { status: "blessed", mp: 14, cd: 25, lv: 4, cost: 1, desc: "A cone of light: health returns while it lasts." }),
  // ---- shadow
  lifesteal: S("shadow", "Life Steal", "act", "shadow/life-steal", { k: 1.6, mp: 14, cd: 7, lv: 3, cost: 1, leech: 0.6, desc: "Strike a foe and drink what bleeds out." }),
  hands: S("shadow", "Grasping Hands", "place", "shadow/grasping-hands", { k: 1.4, mp: 14, cd: 6, lv: 4, cost: 1, r: 42, status: "slowed", ticks: 3, every: 0.5, desc: "Shadow arms burst up and drag at foes." }),
  tendrils: S("shadow", "Tendrils", "place", "shadow/shadow-tendrils", { k: 1.6, mp: 18, cd: 8, lv: 7, cost: 1, r: 40, ticks: 4, every: 0.4, desc: "Tentacles lash up out of a dark pool." }),
  darkstar: S("shadow", "Dark Star", "place", "shadow/dark-explosion", { k: 3.2, mp: 24, cd: 11, lv: 10, cost: 2, r: 56, desc: "A black sphere burns, throws shards, and collapses." }),
  hex: S("shadow", "Hex Sigil", "place", "shadow/hex-sigil", { k: 3.4, mp: 18, cd: 9, lv: 9, cost: 1, r: 40, h: 90, status: "cursed", desc: "A cursed sigil traced in the air, then it flares." }),
  curse: S("shadow", "Curse", "target", "shadow/curse", { k: 0.5, mp: 10, cd: 6, lv: 2, cost: 1, status: "cursed", dur: 8, desc: "A skull stamps down: the foe takes more harm." }),
  singularity: S("shadow", "Singularity", "summon", "shadow/black-hole", { k: 0.4, mp: 34, cd: 24, lv: 15, cost: 3, life: 6, r: 80, pull: 160, desc: "A black hole drags everything in." }),
  gravering: S("shadow", "Grave Ring", "summon", "shadow/necro-skulls", { k: 0.35, mp: 22, cd: 16, lv: 11, cost: 2, life: 10, r: 40, follow: true, desc: "Spectral skulls circle you, biting foes." }),
  siphon: S("shadow", "Soul Siphon", "channel", "shadow/soul-drain", { k: 0.3, mp: 10, cd: 1, lv: 12, cost: 2, len: 160, leech: 0.5, desc: "Hold: tear souls loose and drink them." }),
  voidorb: S("shadow", "Void Orb", "summon", "shadow/void-orb", { k: 0.55, mp: 30, cd: 18, lv: 14, cost: 2, life: 6, r: 40, move: 50, pull: 60, desc: "A black orb rolls forward, swallowing light." }),
  shadowfire: S("shadow", "Shadowfire", "summon", "shadow/shadow-flames", { k: 0.4, mp: 14, cd: 9, lv: 5, cost: 1, life: 6, r: 24, status: "cursed", desc: "Inside-out fire burns on the floor." }),
  // ---- nature
  stomp: S("nature", "Earthbreaker", "act", "moves/earth-stomp", { k: 2.4, mp: 18, cd: 8, lv: 5, cost: 1, desc: "A knee up, the boot down, a spike rams through the floor." }),
  spike: S("nature", "Earth Spike", "place", "nature/earth-spike", { k: 2.4, mp: 14, cd: 6, lv: 3, cost: 1, r: 26, h: 70, desc: "A faceted stone spike rams up under a foe." }),
  thorns: S("nature", "Thornline", "place", "nature/thorns", { k: 1.6, mp: 14, cd: 6, lv: 4, cost: 1, at: "self", line: true, r: 190, status: "bleeding", desc: "Hooked thorns punch up along the floor." }),
  vine: S("nature", "Vine Lash", "place", "nature/vine-whip", { k: 2, mp: 10, cd: 4, lv: 2, cost: 1, at: "self", line: true, r: 150, desc: "A thorny vine bursts up and lashes out." }),
  quake: S("nature", "Quake", "place", "nature/quake", { k: 1, mp: 26, cd: 12, lv: 11, cost: 2, at: "self", r: 130, ticks: 3, every: 0.44, status: "stunned", desc: "The ground jolts three times and splits." }),
  boulder: S("nature", "Boulder Toss", "place", "nature/boulder", { k: 2.6, mp: 16, cd: 7, lv: 6, cost: 1, at: "self", line: true, r: 200, desc: "A spinning boulder arcs out and smashes." }),
  spores: S("nature", "Spore Burst", "place", "nature/spore-burst", { k: 0.8, mp: 12, cd: 8, lv: 5, cost: 1, r: 60, status: "confused", desc: "A toadstool puffs a cloud of maddening spores." }),
  roots: S("nature", "Root Snare", "target", "nature/root-snare", { k: 0.8, mp: 10, cd: 7, lv: 3, cost: 1, status: "stunned", dur: 2.2, desc: "Roots burst up round a foe and cinch tight." }),
  acid: S("nature", "Acid Spit", "place", "nature/acid-splash", { k: 1.2, mp: 8, cd: 3, lv: 2, cost: 1, r: 26, status: "poisoned", desc: "A gob of acid eats into the floor." }),
  miasma: S("nature", "Miasma", "summon", "nature/poison-cloud", { k: 0.25, mp: 18, cd: 14, lv: 8, cost: 1, life: 8, r: 90, status: "poisoned", desc: "Poison gas creeps along the floor." }),
  sludge: S("nature", "Toxic Pool", "summon", "nature/toxic-puddle", { k: 0.3, mp: 12, cd: 10, lv: 6, cost: 1, life: 10, r: 40, status: "poisoned", desc: "A pool of glowing tar." }),
  gale: S("nature", "Leaf Gale", "buff", "nature/leaf-storm", { status: "leafstorm", mp: 18, cd: 20, lv: 7, cost: 1, desc: "Leaves whirl round you, cutting all who come near." }),
  cyclone: S("nature", "Cyclone", "summon", "nature/tornado", { k: 0.5, mp: 28, cd: 18, lv: 13, cost: 2, life: 7, r: 34, move: 36, push: 200, desc: "A snaking funnel of wind tears forward." }),
  bloom: S("nature", "Healing Bloom", "special", "nature/healing-bloom", { mp: 14, cd: 15, lv: 6, cost: 1, desc: "A flower opens round a golden heart: health returns." }),
  // ---- tide
  waterjet: S("tide", "Water Jet", "channel", "water/water-jet", { k: 0.35, mp: 10, cd: 1, lv: 3, cost: 1, len: 118, push: 120, desc: "Hold: a pressurised stream that shoves." }),
  geyser: S("tide", "Geyser", "place", "water/geyser", { k: 1.6, mp: 16, cd: 8, lv: 6, cost: 1, r: 24, h: 100, launch: true, desc: "The floor heaves and blasts foes skyward." }),
  wave: S("tide", "Tidal Wave", "place", "water/wave-crash", { k: 2.2, mp: 22, cd: 10, lv: 9, cost: 2, at: "self", line: true, r: 110, push: 4, desc: "A swell rolls in and crashes." }),
  maelstrom: S("tide", "Maelstrom", "summon", "water/whirlpool", { k: 0.3, mp: 22, cd: 16, lv: 12, cost: 2, life: 7, r: 60, pull: 120, desc: "Dark water winds into a vortex, drawing foes in." }),
  waterorb: S("tide", "Water Orb", "summon", "water/water-orb", { k: 0, mp: 14, cd: 20, lv: 5, cost: 1, life: 12, heal: 0.02, follow: true, dy: -40, desc: "A floating sphere of water that mends you." }),
  splash: S("tide", "Splash", "place", "water/splash", { k: 1.1, mp: 6, cd: 2, lv: 1, cost: 0, r: 30, push: 2, desc: "A wall of water that knocks foes back." }),
  // ---- tech
  emp: S("tech", "EMP", "place", "scifi/emp-blast", { k: 1.4, mp: 18, cd: 10, lv: 8, cost: 1, at: "self", r: 60, status: "stunned", desc: "A bubble of scanlines shorts out everything near." }),
  field: S("tech", "Force Field", "buff", "scifi/force-field", { status: "forcefield", mp: 20, cd: 18, lv: 6, cost: 1, desc: "A hex dome over you takes the hits." }),
  decoy: S("tech", "Hologram", "special", "scifi/hologram", { mp: 16, cd: 16, lv: 7, cost: 1, desc: "A turning projection draws foes away." }),
  scan: S("tech", "Scanner", "special", "scifi/scanner", { mp: 6, cd: 8, lv: 2, cost: 1, desc: "Scan nearby foes: they take more harm." }),
  lasers: S("tech", "Laser Fence", "summon", "scifi/laser-grid", { k: 0.6, mp: 20, cd: 16, lv: 10, cost: 2, life: 10, r: 30, desc: "Security lasers that cut whatever crosses." }),
  disc: S("tech", "Energy Disc", "proj", "projectiles/energy-disc", { shot: "disc", k: 1.2, mp: 10, cd: 1.6, lv: 5, cost: 1, desc: "A spinning saw of energy that cuts through foes." }),
  plasma: S("tech", "Plasma Shot", "proj", "projectiles/plasma-shot", { shot: "plasma", k: 1.5, mp: 10, cd: 1.4, lv: 4, cost: 1, desc: "A glowing blob that bursts." }),
  grenade: S("tech", "Grenade", "place", "explosions/grenade", { k: 2.8, mp: 14, cd: 6, lv: 6, cost: 1, r: 40, desc: "Lob it, wait for it." }),
  implode: S("tech", "Implosion", "place", "explosions/implosion", { k: 2.6, mp: 20, cd: 10, lv: 10, cost: 2, r: 50, pull: true, desc: "Everything is sucked in, then it pops." }),
  smokebomb: S("tech", "Smoke Bomb", "special", "explosions/smoke-bomb", { mp: 10, cd: 18, lv: 4, cost: 1, desc: "Vanish in smoke; foes lose you." }),
  phase: S("tech", "Phase Shift", "special", "scifi/warp-out", { mp: 18, cd: 10, lv: 9, cost: 1, desc: "Break into light and reappear ahead." }),
  brute: S("tech", "Call the Brute", "special", "spawn/summon-rise", { mp: 36, cd: 45, lv: 15, cost: 3, ult: true, desc: "A horned brute heaves up out of the floor to fight for you." }),
  egg: S("nature", "Hatchling", "special", "spawn/egg-hatch", { mp: 20, cd: 60, lv: 8, cost: 1, desc: "An egg rocks, cracks and hatches a slime companion." }),
};

export const START_SKILLS = ["firebolt", "frostnova", "heal", "threefold", "splash"];
