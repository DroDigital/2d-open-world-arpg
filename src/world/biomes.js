// The lands, west to east, and what lives in each. Tile x ranges are in tiles.

export const BIOMES = [
  {
    id: "frost", name: "Frostpeak", x0: 0, x1: 220, base: 50, amp: 24, rough: 0.9, level: [8, 12],
    sky: { day: ["#9fc4e8", "#d8ecfa"], dusk: ["#5a4a8a", "#e8a0a8"], night: ["#060a1c", "#18284a"] },
    hills: ["#c8dcf0", "#8aa8cc", "#5a7aa6", "#34507c"], top: "snow", fill: "stone", weather: ["snow", "blizzard", "aurora", "clouds"],
    ground: ["#f4faff", "#cfe2f4", "#9ab8d8", "#6a88b0", "#43597e", "#2a3654"], music: "frost",
  },
  {
    id: "woods", name: "Whispering Woods", x0: 220, x1: 420, base: 62, amp: 7, rough: 0.5, level: [3, 6],
    sky: { day: ["#7ab0d8", "#cfe6d8"], dusk: ["#4a3a6a", "#e89a6a"], night: ["#05080c", "#12201e"] },
    hills: ["#3a6a4a", "#2a5038", "#1c3a2a", "#12261c"], top: "grass", fill: "dirt", weather: ["fog", "falling-leaves", "fireflies", "rain", "god-rays"],
    ground: ["#9ad06a", "#5aa040", "#3a7030", "#5a4030", "#3c2a20", "#241812"], music: "woods",
  },
  {
    id: "vale", name: "Verdant Vale", x0: 420, x1: 600, base: 64, amp: 4, rough: 0.35, level: [1, 3],
    sky: { day: ["#6aa8e8", "#c8e4f8"], dusk: ["#4a3a7a", "#f0a070"], night: ["#060814", "#141c34"] },
    hills: ["#7ab868", "#5a9a58", "#3e7a48", "#285a3a"], top: "grass", fill: "dirt", weather: ["cherry-blossoms", "clouds", "fireflies", "shooting-stars", "rain"],
    ground: ["#b4e07a", "#78c050", "#4e9038", "#7a5638", "#54382a", "#34221a"], music: "vale",
  },
  {
    id: "marsh", name: "Sunken Marsh", x0: 600, x1: 800, base: 70, amp: 5, rough: 0.6, level: [5, 8], water: 71,
    sky: { day: ["#8aa89a", "#c8d4b0"], dusk: ["#3a3a4a", "#b8906a"], night: ["#040806", "#101a14"] },
    hills: ["#4a6a52", "#36503e", "#26382c", "#18241c"], top: "mud", fill: "mud", weather: ["rain", "fog", "storm", "fireflies"],
    ground: ["#8a9a5a", "#62703e", "#46502c", "#3a3424", "#28241a", "#181610"], music: "marsh",
  },
  {
    id: "crags", name: "Ember Crags", x0: 800, x1: 1000, base: 58, amp: 16, rough: 1.1, level: [10, 14], lava: true,
    sky: { day: ["#c86a4a", "#f0b07a"], dusk: ["#5a1a2a", "#e8603a"], night: ["#100406", "#2a0c0e"] },
    hills: ["#6a3a34", "#4a2626", "#321a1c", "#1e1012"], top: "ash", fill: "basalt", weather: ["shooting-stars", "clouds", "god-rays"],
    ground: ["#8a7a72", "#5e5250", "#403838", "#2e2628", "#201a1c", "#140f12"], music: "crags",
  },
  {
    id: "storm", name: "Stormspire Ruins", x0: 1000, x1: 1200, base: 56, amp: 10, rough: 0.7, level: [13, 18],
    sky: { day: ["#5a6a8a", "#a8b4c8"], dusk: ["#2a2a4a", "#8a7aa8"], night: ["#04050c", "#10142a"] },
    hills: ["#4a5470", "#363e58", "#262c42", "#181c2e"], top: "moss", fill: "stone", weather: ["storm", "rain", "clouds", "aurora"],
    ground: ["#7a9a8a", "#4e6a62", "#3a4a50", "#4a4e60", "#30343f", "#1e2028"], music: "storm",
  },
];
export const WORLD_W = 1200, WORLD_H = 200;
export const biomeAt = (tx) => BIOMES.find((b) => tx >= b.x0 && tx < b.x1) ?? (tx < 0 ? BIOMES[0] : BIOMES[BIOMES.length - 1]);

// underground regions: named areas below the surface
export const REGIONS = [
  { id: "crypt", name: "The Hollow Crypt", x0: 250, x1: 400, y0: 96, y1: 150, level: [7, 10], music: "crypt", wall: 8, fill: "brick" },
  { id: "temple", name: "Sunken Temple", x0: 640, x1: 780, y0: 84, y1: 130, level: [6, 9], music: "temple", wall: 9, flooded: true },
  { id: "caverns", name: "Glimmer Caverns", x0: 430, x1: 600, y0: 90, y1: 150, level: [3, 6], music: "caverns", wall: 10 },
  { id: "magma", name: "Magma Veins", x0: 820, x1: 990, y0: 90, y1: 160, level: [11, 15], music: "crags", wall: 7 },
  { id: "icecaves", name: "Rime Hollows", x0: 20, x1: 200, y0: 90, y1: 150, level: [9, 12], music: "frost", wall: 6 },
  { id: "skyreach", name: "Skyreach Isles", x0: 1000, x1: 1200, y0: 4, y1: 34, level: [16, 20], music: "sky", wall: 0 },
  { id: "depths", name: "The Deep Dark", x0: 0, x1: 1200, y0: 150, y1: 200, level: [14, 20], music: "crypt", wall: 2 },
];
