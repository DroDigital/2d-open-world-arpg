// Weapon classes: what the hero swings, which pixelfx acts drive the swing, and how far it reaches.
// combo: the strokes in order; each names a melee effect whose `act` supplies the body's poses and the hit timing.

export const WEAPONS = {
  sword: { name: "Sword", rig: "sword", combo: ["melee/sword-slash", "melee/double-slash", "melee/heavy-cleave"], wind: 0.3, dmg: 1, spd: 1, icon: "sword" },
  greatsword: { name: "Greatsword", rig: "greatsword", two: true, combo: ["melee/heavy-cleave", "melee/spin-slash"], wind: 0.4, dmg: 1.55, spd: 0.85, icon: "greatsword" },
  dagger: { name: "Daggers", rig: "dagger", combo: ["melee/dagger-flurry", "melee/thrust"], wind: 0.22, dmg: 0.55, spd: 1.25, crit: 0.12, icon: "dagger" },
  spear: { name: "Spear", rig: "spear", two: true, combo: ["melee/thrust", "melee/spear-sweep"], wind: 0.28, dmg: 1.05, spd: 1, reach: 1.25, icon: "spear" },
  hammer: { name: "Warhammer", rig: "hammer", two: true, combo: ["melee/hammer-smash", "melee/heavy-cleave"], wind: 0.45, dmg: 1.9, spd: 0.75, icon: "hammer" },
  scythe: { name: "Scythe", rig: "scythe", two: true, combo: ["melee/scythe-reap", "melee/spin-slash"], wind: 0.36, dmg: 1.35, spd: 0.9, el: "shadow", icon: "scythe" },
  claw: { name: "Gauntlets", rig: "claw", combo: ["melee/claw-swipe", "melee/uppercut", "melee/claw-swipe"], wind: 0.22, dmg: 0.75, spd: 1.2, icon: "claw" },
  whip: { name: "Whip", rig: "handle", combo: ["melee/whip-crack"], wind: 0.3, dmg: 0.9, spd: 1, reach: 1.1, icon: "whip" },
  // ranged
  bow: { name: "Bow", rig: "bow", ranged: "arrow", wind: 0.25, dmg: 0.9, spd: 1, icon: "bow" },
  pistol: { name: "Pistol", rig: "pistol", ranged: "bullet", wind: 0.1, dmg: 0.7, spd: 1.4, icon: "pistol" },
  shotgun: { name: "Scattergun", rig: "pistol", ranged: "shot", wind: 0.2, dmg: 0.45, spd: 0.7, icon: "pistol" },
  smg: { name: "Repeater", rig: "pistol", ranged: "smg", wind: 0.05, dmg: 0.32, spd: 2.5, icon: "pistol" },
  launcher: { name: "Launcher", rig: "launcher", two: true, ranged: "rocket", wind: 0.4, dmg: 2.4, spd: 0.5, icon: "launcher" },
};
