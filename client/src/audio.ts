/** Synthesized audio — no asset files. Wind ambient, reel clicks, run scream, splash, catch chime.
 *  Context starts on first user gesture (browser autoplay policy). */

class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private reelOsc: OscillatorNode | null = null;
  private reelGain: GainNode | null = null;
  private screamOsc: OscillatorNode | null = null;
  private screamGain: GainNode | null = null;
  private clickTimer = 0;

  /** Call on any user gesture; idempotent. */
  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // wind: looped noise -> lowpass, slow LFO on gain
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.35;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.12;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(this.windGain.gain);
    noise.connect(lp).connect(this.windGain).connect(this.master);
    noise.start();
    lfo.start();

    // reel: quiet square blips, gated by setReeling
    this.reelOsc = ctx.createOscillator();
    this.reelOsc.type = "square";
    this.reelOsc.frequency.value = 70;
    this.reelGain = ctx.createGain();
    this.reelGain.gain.value = 0;
    this.reelOsc.connect(this.reelGain).connect(this.master);
    this.reelOsc.start();

    // run scream: rising saw, gated by setRunning
    this.screamOsc = ctx.createOscillator();
    this.screamOsc.type = "sawtooth";
    this.screamOsc.frequency.value = 180;
    this.screamGain = ctx.createGain();
    this.screamGain.gain.value = 0;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 300;
    this.screamOsc.connect(hp).connect(this.screamGain).connect(this.master);
    this.screamOsc.start();
  }

  /** Tick from the game loop: reel clicking cadence. */
  update(dt: number, reeling: boolean) {
    if (!this.ctx || !this.reelGain) return;
    if (reeling) {
      this.clickTimer -= dt;
      if (this.clickTimer <= 0) {
        this.clickTimer = 0.09;
        const g = this.reelGain.gain;
        g.cancelScheduledValues(this.ctx.currentTime);
        g.setValueAtTime(0.08, this.ctx.currentTime);
        g.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      }
    }
  }

  setRunning(running: boolean, tension: number) {
    if (!this.ctx || !this.screamGain || !this.screamOsc) return;
    const t = this.ctx.currentTime;
    this.screamGain.gain.linearRampToValueAtTime(running ? 0.10 : 0, t + 0.1);
    if (running) this.screamOsc.frequency.linearRampToValueAtTime(160 + tension * 4, t + 0.1);
  }

  private blip(freq: number, dur: number, gain: number, type: OscillatorType = "sine") {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  splash() { this.blip(120, 0.25, 0.2, "triangle"); this.blip(60, 0.35, 0.15, "sine"); }
  chime() { this.blip(660, 0.4, 0.12); setTimeout(() => this.blip(880, 0.5, 0.12), 120); }
  snap() { this.blip(1400, 0.08, 0.25, "square"); }
}

export const audio = new GameAudio();
