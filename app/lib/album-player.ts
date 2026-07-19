/**
 * Reproductor generativo de la trilogía: sintetiza demos instrumentales
 * cortos con Web Audio (sin archivos), con un carácter distinto por álbum.
 * Emite "nolo:music-beat" en cada pulso para que la fogata reaccione.
 * Pensado para sustituirse por audio real cuando existan los masters.
 */

type AlbumId = "fogata" | "corcel" | "phoenix";

type AlbumConfig = {
  bpm: number;
  wave: OscillatorType;
  lowpass: number;
  gain: number;
  /** Escala en Hz (grave a agudo). */
  scale: number[];
  /** Índices de escala por corchea (null = silencio). */
  pattern: (number | null)[];
  /** Golpes de bombo por corchea (galope, pulso). */
  kicks?: number[];
  /** Eco tipo shimmer (Phoenix). */
  echo?: boolean;
};

const A = 220;
const CONFIGS: Record<AlbumId, AlbumConfig> = {
  fogata: {
    bpm: 84,
    wave: "triangle",
    lowpass: 1500,
    gain: 0.2,
    scale: [A, A * 1.189, A * 1.335, A * 1.498, A * 1.782], // pentatónica menor
    pattern: [0, null, 2, null, 4, 3, null, 1],
  },
  corcel: {
    bpm: 132,
    wave: "sawtooth",
    lowpass: 950,
    gain: 0.12,
    scale: [146.83, 174.61, 196.0, 220.0, 233.08],
    pattern: [0, 0, null, 1, 1, null, 2, 3],
    kicks: [1, 0, 1, 1, 0, 1, 1, 0],
  },
  phoenix: {
    bpm: 100,
    wave: "triangle",
    lowpass: 2600,
    gain: 0.16,
    scale: [261.63, 329.63, 392.0, 523.25, 659.25],
    pattern: [0, 1, 2, 3, 4, 3, 2, 4],
    echo: true,
  },
};

export class AlbumPlayer {
  private ctx: AudioContext;
  private master: GainNode;
  private echoIn: GainNode;
  private scheduler: number | null = null;
  private beatTimers: number[] = [];
  private nextTime = 0;
  private step = 0;
  private disposed = false;

  constructor() {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;

    const compressor = this.ctx.createDynamicsCompressor();
    this.master.connect(compressor).connect(this.ctx.destination);

    // Bus de eco para el shimmer de Phoenix
    this.echoIn = this.ctx.createGain();
    const delay = this.ctx.createDelay(1);
    delay.delayTime.value = 0.375;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.35;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.3;
    this.echoIn.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(this.master);
  }

  async play(album: AlbumId, track: number) {
    if (this.disposed) return;
    this.stopScheduling();
    await this.ctx.resume();
    const cfg = CONFIGS[album];
    // Cada pista transporta y acelera ligeramente el motivo del álbum
    const transpose = Math.pow(2, (track * 3) / 12);
    const stepDur = 60 / (cfg.bpm + track * 6) / 2;

    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;

    const tick = () => {
      while (this.nextTime < this.ctx.currentTime + 0.35) {
        const i = this.step % cfg.pattern.length;
        const note = cfg.pattern[i];
        if (note !== null) {
          this.pluck(cfg.scale[note] * transpose, this.nextTime, cfg);
        }
        if (cfg.kicks?.[i]) this.kick(this.nextTime);
        if (i % 2 === 0) this.emitBeat(this.nextTime);
        this.nextTime += stepDur;
        this.step++;
      }
    };
    tick();
    this.scheduler = window.setInterval(tick, 100);
  }

  private pluck(freq: number, at: number, cfg: AlbumConfig) {
    const osc = this.ctx.createOscillator();
    osc.type = cfg.wave;
    osc.frequency.value = freq;
    const osc2 = this.ctx.createOscillator();
    osc2.type = cfg.wave;
    osc2.frequency.value = freq * 1.004;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cfg.lowpass * 1.6, at);
    filter.frequency.exponentialRampToValueAtTime(cfg.lowpass * 0.5, at + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(cfg.gain, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.85);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(this.master);
    if (cfg.echo) gain.connect(this.echoIn);
    osc.start(at);
    osc2.start(at);
    osc.stop(at + 1);
    osc2.stop(at + 1);
  }

  private kick(at: number) {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(105, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.16);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(at + 0.25);
  }

  private emitBeat(at: number) {
    const delay = Math.max(0, (at - this.ctx.currentTime) * 1000);
    this.beatTimers.push(
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("nolo:music-beat"));
      }, delay)
    );
    if (this.beatTimers.length > 32) {
      this.beatTimers.splice(0, this.beatTimers.length - 32);
    }
  }

  private stopScheduling() {
    if (this.scheduler !== null) window.clearInterval(this.scheduler);
    this.scheduler = null;
    this.beatTimers.forEach((t) => window.clearTimeout(t));
    this.beatTimers = [];
  }

  stop() {
    this.stopScheduling();
    if (!this.disposed && this.ctx.state === "running") {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.25);
      window.setTimeout(() => {
        if (this.disposed) return;
        this.ctx.suspend();
        this.master.gain.value = 0.6;
      }, 300);
    }
  }

  dispose() {
    this.disposed = true;
    this.stopScheduling();
    this.ctx.close();
  }
}

export type { AlbumId };
