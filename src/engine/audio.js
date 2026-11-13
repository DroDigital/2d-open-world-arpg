// Sound, synthesized: every effect has a voice made of oscillators and noise, and each land has its own generative
// music (a scale, a tempo, a bass, an arpeggio, a lead that wanders). No samples, no files.

const THEMES = {
  title: { root: 50, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 72, pad: "triangle", lead: "sine", arp: 0.5, bass: 1, mood: 0.6 },
  vale: { root: 55, scale: [0, 2, 4, 7, 9], bpm: 96, pad: "triangle", lead: "square", arp: 0.7, bass: 1, mood: 1 },
  woods: { root: 52, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 84, pad: "sine", lead: "triangle", arp: 0.5, bass: 0.8, mood: 0.8 },
  marsh: { root: 48, scale: [0, 1, 5, 7, 8], bpm: 70, pad: "sawtooth", lead: "triangle", arp: 0.3, bass: 1, mood: 0.5 },
  frost: { root: 57, scale: [0, 2, 5, 7, 9], bpm: 66, pad: "sine", lead: "sine", arp: 0.8, bass: 0.6, mood: 0.7 },
  crags: { root: 45, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 110, pad: "sawtooth", lead: "square", arp: 0.6, bass: 1.2, mood: 0.4 },
  storm: { root: 47, scale: [0, 2, 3, 6, 7, 9], bpm: 120, pad: "square", lead: "sawtooth", arp: 0.9, bass: 1.1, mood: 0.5 },
  crypt: { root: 44, scale: [0, 1, 3, 6, 7, 8], bpm: 60, pad: "sine", lead: "triangle", arp: 0.2, bass: 0.9, mood: 0.2 },
  temple: { root: 50, scale: [0, 2, 3, 7, 9], bpm: 64, pad: "sine", lead: "sine", arp: 0.6, bass: 0.6, mood: 0.6 },
  caverns: { root: 53, scale: [0, 3, 5, 7, 10], bpm: 72, pad: "triangle", lead: "sine", arp: 0.7, bass: 0.6, mood: 0.6 },
  sky: { root: 60, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 90, pad: "triangle", lead: "sine", arp: 0.8, bass: 0.7, mood: 1 },
  boss: { root: 45, scale: [0, 1, 3, 5, 7, 8, 11], bpm: 140, pad: "sawtooth", lead: "square", arp: 1, bass: 1.4, mood: 0.3, drums: true },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Audio {
  constructor(ctx) {
    this.ctx = ctx;
    this.vol = { master: 0.8, sfx: 0.9, music: 0.5 };
    this.theme = null;
    this.nextBeat = 0;
    this.step = 0;
    this.last = {};
    if (!ctx) return;
    this.master = ctx.createGain();
    this.master.gain.value = this.vol.master;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.vol.sfx;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.vol.music;
    // a little room
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.27;
    fb.gain.value = 0.32;
    wet.gain.value = 0.25;
    this.musicBus.connect(this.master);
    this.musicBus.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(this.master);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setVolume(k, v) {
    this.vol[k] = v;
    if (!this.ctx) return;
    if (k === "master") this.master.gain.value = v;
    if (k === "sfx") this.sfxBus.gain.value = v;
    if (k === "music") this.musicBus.gain.value = v;
  }
  // ---- building blocks
  tone(freq, dur, type = "square", vol = 0.2, slide = 0, bus = this.sfxBus, when = 0) {
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  hiss(dur, vol = 0.2, f0 = 2000, f1 = 400, q = 1, when = 0, type = "bandpass", bus = this.sfxBus) {
    const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise;
    s.loop = true;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }
  /** Play a named sound. */
  play(name, o = {}) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.03) return;
    this.last[name] = now;
    const r = 1 + (Math.random() - 0.5) * 0.12;
    switch (name) {
      case "jump": this.tone(300 * r, 0.12, "square", 0.08, 2); break;
      case "jump2": this.tone(420 * r, 0.14, "triangle", 0.1, 2.2); this.hiss(0.15, 0.05, 3000, 6000); break;
      case "land": this.hiss(0.08, 0.08, 600, 200, 1, 0, "lowpass"); break;
      case "land_heavy": this.tone(90, 0.25, "sine", 0.3, 0.5); this.hiss(0.3, 0.15, 800, 100, 1, 0, "lowpass"); break;
      case "step": this.hiss(0.04, o.biome === "frost" ? 0.05 : 0.025, o.biome === "frost" ? 3000 : 1200, 400, 2); break;
      case "dash": this.hiss(0.18, 0.12, 4000, 600, 0.8); break;
      case "swing": this.hiss(o.heavy ? 0.28 : 0.14, o.enemy ? 0.07 : 0.11, o.heavy ? 1200 : 3000, o.heavy ? 200 : 800, 1.2); break;
      case "hit": this.tone(140 * r, 0.09, "square", 0.12, 0.5); this.hiss(0.08, 0.12, 2000, 500); break;
      case "crit": this.tone(200, 0.2, "sawtooth", 0.14, 0.3); this.hiss(0.2, 0.18, 5000, 300); this.tone(1200, 0.12, "square", 0.05, 0.5, this.sfxBus, 0.02); break;
      case "hurt": this.tone(220, 0.25, "sawtooth", 0.15, 0.4); break;
      case "block": this.tone(900 * r, 0.15, "triangle", 0.12, 0.8); this.tone(1400, 0.1, "sine", 0.06); break;
      case "die": this.tone(260 * r, 0.3, "square", 0.08, 0.3); this.hiss(0.3, 0.08, 1500, 200); break;
      case "boom": this.tone(70, o.big ? 0.8 : 0.45, "sine", 0.4, 0.4); this.hiss(o.big ? 1 : 0.5, 0.3, 1200, 60, 0.7, 0, "lowpass"); break;
      case "pickup": this.tone(o.kind === "gold" ? 1400 : 880, 0.08, "square", 0.06); this.tone(o.kind === "gold" ? 2100 : 1320, 0.1, "square", 0.05, 1, this.sfxBus, 0.06); break;
      case "chest": [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.09, 1, this.sfxBus, i * 0.08)); break;
      case "levelup": [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.35, "square", 0.08, 1, this.sfxBus, i * 0.09)); break;
      case "quest": [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.1, 1, this.sfxBus, i * 0.1)); break;
      case "attune": [330, 440, 554, 660].forEach((f, i) => this.tone(f, 0.6, "sine", 0.1, 1.01, this.sfxBus, i * 0.12)); break;
      case "cast": this.tone(440 * r, 0.3, "sine", 0.1, 2); this.hiss(0.3, 0.05, 6000, 2000); break;
      case "fire": this.hiss(0.5, 0.18, 800, 300, 0.6); this.tone(120, 0.4, "sawtooth", 0.06, 0.6); break;
      case "ice": this.tone(1800 * r, 0.25, "triangle", 0.07, 0.5); this.hiss(0.3, 0.08, 8000, 3000, 2); break;
      case "shock": case "thunder": this.hiss(name === "thunder" ? 1.6 : 0.3, name === "thunder" ? 0.35 : 0.15, 3000, 80, 0.5, 0, "lowpass"); this.tone(60, 0.5, "sawtooth", 0.1, 0.5); break;
      case "holy": [880, 1108, 1318].forEach((f, i) => this.tone(f, 0.6, "sine", 0.07, 1, this.sfxBus, i * 0.05)); break;
      case "shadow": this.tone(110, 0.6, "sawtooth", 0.1, 0.5); this.tone(116, 0.6, "sawtooth", 0.08, 0.5); break;
      case "nature": this.hiss(0.4, 0.1, 1500, 3000, 3); this.tone(330, 0.3, "triangle", 0.06, 1.5); break;
      case "water": case "splash": this.hiss(0.35, 0.14, 1500, 300, 1); break;
      case "arcane": this.tone(660 * r, 0.4, "sine", 0.08, 1.5); this.tone(990 * r, 0.4, "sine", 0.05, 0.66); break;
      case "tech": this.tone(1200, 0.08, "square", 0.06, 0.5); this.tone(600, 0.15, "square", 0.05, 2, this.sfxBus, 0.05); break;
      case "bow": this.tone(200, 0.12, "triangle", 0.12, 0.5); this.hiss(0.1, 0.08, 4000, 1000); break;
      case "gun": this.hiss(0.12, 0.25, 3000, 200, 0.5, 0, "lowpass"); this.tone(150, 0.1, "square", 0.12, 0.3); break;
      case "rocket": this.hiss(0.6, 0.2, 400, 2000, 0.6); break;
      case "eshot": this.tone(o.kind === "laser" ? 1500 : 700, 0.12, "square", 0.05, 0.4); break;
      case "screech": this.tone(1800, 0.2, "sawtooth", 0.04, 0.6); break;
      case "hiss": this.hiss(0.3, 0.06, 6000, 4000, 4); break;
      case "breath": this.hiss(1.2, 0.15, 600, 300, 0.5); break;
      case "drink": [500, 600, 700].forEach((f, i) => this.tone(f, 0.08, "sine", 0.08, 1.2, this.sfxBus, i * 0.07)); break;
      case "equip": this.tone(600, 0.06, "square", 0.06); this.tone(900, 0.08, "square", 0.05, 1, this.sfxBus, 0.05); break;
      case "ui": this.tone(o.hi ? 880 : 660, 0.05, "square", 0.04); break;
      case "uiback": this.tone(440, 0.06, "square", 0.04, 0.7); break;
      case "talk": this.tone(300 + Math.random() * 200, 0.04, "square", 0.025); break;
      case "warp": this.tone(200, 1, "sine", 0.12, 6); this.hiss(1, 0.06, 500, 6000, 2); break;
      case "death": this.tone(330, 1.4, "triangle", 0.15, 0.25); break;
      case "revive": [262, 330, 392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.6, "sine", 0.1, 1, this.sfxBus, i * 0.1)); break;
      case "geyser": this.hiss(1, 0.2, 400, 3000, 0.5); break;
      case "firework": this.hiss(0.6, 0.12, 3000, 500, 0.5); this.tone(80, 0.4, "sine", 0.2, 0.5); break;
      case "flare": this.hiss(0.9, 0.12, 1000, 5000, 1); break;
      case "boss": this.tone(55, 2, "sawtooth", 0.2, 1); this.tone(58, 2, "sawtooth", 0.15, 1); break;
      case "shard": [523, 784, 1046, 1568, 2093].forEach((f, i) => this.tone(f, 0.9, "sine", 0.09, 1, this.sfxBus, i * 0.11)); break;
      default: this.tone(500, 0.05, "square", 0.04);
    }
  }
  // ---- music: a tiny generative band
  music(theme, night = 0) {
    if (!this.ctx || this.ctx.state !== "running") return;
    if (theme !== this.theme) {
      this.theme = theme;
      this.step = 0;
      this.phrase = [];
    }
    const T = THEMES[theme] ?? THEMES.vale, c = this.ctx, beat = 60 / T.bpm / 2;
    if (this.nextBeat < c.currentTime) this.nextBeat = c.currentTime + 0.05;
    while (this.nextBeat < c.currentTime + 0.25) {
      const s = this.step++, when = this.nextBeat - c.currentTime, bar = Math.floor(s / 16), chord = [0, 3, 4, 2][bar % 4] % T.scale.length;
      const note = (deg, oct = 0) => T.root + T.scale[((deg % T.scale.length) + T.scale.length) % T.scale.length] + 12 * (oct + Math.floor(deg / T.scale.length));
      // bass on the beat
      if (s % 4 === 0) this.tone(mtof(note(chord, -1)), beat * 3.6, "triangle", 0.11 * T.bass, 1, this.musicBus, when);
      // a pad, once a bar
      if (s % 16 === 0) for (const d of [0, 2, 4]) this.tone(mtof(note(chord + d, 0)), beat * 15, T.pad, 0.022 * (1 - night * 0.3), 1, this.musicBus, when);
      // the arpeggio
      if (Math.random() < T.arp && s % 2 === 0) this.tone(mtof(note(chord + [0, 2, 4, 2][(s >> 1) % 4], 1)), beat * 1.6, "square", 0.018, 1, this.musicBus, when);
      // a lead that wanders by steps
      if (s % 4 === 2 && Math.random() < 0.55 * T.mood + 0.15) {
        this.leadDeg = (this.leadDeg ?? 4) + [-2, -1, 1, 1, 2][Math.floor(Math.random() * 5)];
        this.leadDeg = Math.max(0, Math.min(9, this.leadDeg));
        this.tone(mtof(note(this.leadDeg, 1)), beat * 2.8, T.lead, 0.03, 1, this.musicBus, when);
      }
      if (T.drums) {
        if (s % 4 === 0) this.tone(60, 0.18, "sine", 0.25, 0.4, this.musicBus, when);
        if (s % 8 === 4) this.hiss(0.12, 0.1, 2500, 800, 0.8, when, "bandpass", this.musicBus);
        if (s % 2 === 1) this.hiss(0.03, 0.03, 9000, 7000, 3, when, "highpass", this.musicBus);
      }
      this.nextBeat += beat;
    }
  }
}
