/**
 * Ambiente sonoro procedural de fogata: rumor grave del fuego, crujidos
 * aleatorios y viento entre los árboles. Todo se sintetiza con Web Audio,
 * sin cargar archivos. Debe crearse dentro de un gesto del usuario para
 * cumplir las políticas de autoplay de los navegadores.
 */
export class CampfireAudio {
  private ctx: AudioContext;
  private master: GainNode;
  private crackleTimer: number | null = null;
  private owlTimer: number | null = null;
  private sizzleTimer: number | null = null;
  private rainGain: GainNode | null = null;
  private rainOn = false;
  private disposed = false;

  constructor() {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    this.buildFireBed();
    this.buildWind();
    this.buildRain();
    this.scheduleCrackles();
    this.scheduleOwl();
  }

  /** Lluvia: sábana de ruido agudo, silenciada hasta activar setRain. */
  private buildRain() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer("white", 3);
    src.loop = true;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 1800;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;

    src.connect(highpass).connect(this.rainGain).connect(this.master);
    src.start();
  }

  /** Activa/desactiva la lluvia: sube la sábana y chisporrotea el fuego. */
  setRain(on: boolean) {
    if (this.disposed || !this.rainGain) return;
    this.rainOn = on;
    const now = this.ctx.currentTime;
    this.rainGain.gain.cancelScheduledValues(now);
    this.rainGain.gain.setValueAtTime(this.rainGain.gain.value, now);
    this.rainGain.gain.linearRampToValueAtTime(on ? 0.14 : 0, now + 1.5);
    if (on && this.sizzleTimer === null) this.scheduleSizzles();
    if (!on && this.sizzleTimer !== null) {
      window.clearTimeout(this.sizzleTimer);
      this.sizzleTimer = null;
    }
  }

  /** Siseos de gotas cayendo sobre las brasas mientras llueve. */
  private scheduleSizzles() {
    const fire = () => {
      if (this.disposed || !this.rainOn) {
        this.sizzleTimer = null;
        return;
      }
      if (this.ctx.state === "running") {
        const now = this.ctx.currentTime;
        const dur = 0.15 + Math.random() * 0.35;
        const src = this.ctx.createBufferSource();
        src.buffer = this.makeNoiseBuffer("white", dur);
        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = "bandpass";
        bandpass.frequency.value = 4200 + Math.random() * 2000;
        bandpass.Q.value = 0.8;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.05 + Math.random() * 0.1, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(bandpass).connect(gain).connect(this.master);
        src.start(now);
        src.stop(now + dur + 0.01);
      }
      this.sizzleTimer = window.setTimeout(fire, 400 + Math.random() * 1600);
    };
    fire();
  }

  /** Ululato ocasional de un búho entre los árboles. */
  private scheduleOwl() {
    const hoot = () => {
      if (this.disposed) return;
      if (this.ctx.state === "running") {
        const base = this.ctx.currentTime + 0.05;
        for (const [offset, freq, dur] of [
          [0, 392, 0.28],
          [0.42, 330, 0.5],
        ] as const) {
          const at = base + offset;
          const osc = this.ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, at);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.92, at + dur);
          const lowpass = this.ctx.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.value = 900;
          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.0001, at);
          gain.gain.exponentialRampToValueAtTime(0.06, at + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
          osc.connect(lowpass).connect(gain).connect(this.master);
          osc.start(at);
          osc.stop(at + dur + 0.05);
        }
      }
      this.owlTimer = window.setTimeout(hoot, 14000 + Math.random() * 18000);
    };
    this.owlTimer = window.setTimeout(hoot, 8000 + Math.random() * 8000);
  }

  /** Rumor grave y continuo de las brasas (ruido browniano filtrado). */
  private buildFireBed() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer("brown", 3);
    src.loop = true;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 420;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;

    src.connect(lowpass).connect(gain).connect(this.master);
    src.start();
  }

  /** Viento suave con vaivén lento (LFO sobre la ganancia y el filtro). */
  private buildWind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoiseBuffer("white", 3);
    src.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 320;
    bandpass.Q.value = 0.6;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 0.035;
    lfo.connect(lfoDepth).connect(gain.gain);

    const lfo2 = this.ctx.createOscillator();
    lfo2.frequency.value = 0.05;
    const lfo2Depth = this.ctx.createGain();
    lfo2Depth.gain.value = 140;
    lfo2.connect(lfo2Depth).connect(bandpass.frequency);

    src.connect(bandpass).connect(gain).connect(this.master);
    src.start();
    lfo.start();
    lfo2.start();
  }

  /** Chasquidos cortos de la leña, a intervalos aleatorios. */
  private scheduleCrackles() {
    const fire = () => {
      if (this.disposed) return;
      if (this.ctx.state === "running") {
        const now = this.ctx.currentTime;
        const dur = 0.02 + Math.random() * 0.06;

        const src = this.ctx.createBufferSource();
        src.buffer = this.makeNoiseBuffer("white", dur);

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = "bandpass";
        bandpass.frequency.value = 1200 + Math.random() * 3200;
        bandpass.Q.value = 1.5;

        const gain = this.ctx.createGain();
        const peak = 0.08 + Math.random() * 0.4;
        gain.gain.setValueAtTime(peak, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        src.connect(bandpass).connect(gain).connect(this.master);
        src.start(now);
        src.stop(now + dur + 0.01);
      }
      this.crackleTimer = window.setTimeout(fire, 50 + Math.random() * 350);
    };
    fire();
  }

  private makeNoiseBuffer(type: "white" | "brown", seconds: number) {
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (type === "white") {
        data[i] = white;
      } else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
    return buffer;
  }

  /** Ráfaga de chasquidos al avivar el fuego (tocar la fogata). */
  stoke() {
    if (this.disposed || this.ctx.state !== "running") return;
    for (let i = 0; i < 8; i++) {
      const at = this.ctx.currentTime + Math.random() * 0.5;
      const dur = 0.02 + Math.random() * 0.05;

      const src = this.ctx.createBufferSource();
      src.buffer = this.makeNoiseBuffer("white", dur);

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 1500 + Math.random() * 3500;
      bandpass.Q.value = 1.5;

      const gain = this.ctx.createGain();
      const peak = 0.2 + Math.random() * 0.5;
      gain.gain.setValueAtTime(peak, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + dur);

      src.connect(bandpass).connect(gain).connect(this.master);
      src.start(at);
      src.stop(at + dur + 0.01);
    }
  }

  async resume() {
    if (this.disposed) return;
    await this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(1, now + 1.2);
  }

  pause() {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.4);
    window.setTimeout(() => {
      if (!this.disposed && this.ctx.state === "running") this.ctx.suspend();
    }, 500);
  }

  dispose() {
    this.disposed = true;
    if (this.crackleTimer !== null) window.clearTimeout(this.crackleTimer);
    if (this.owlTimer !== null) window.clearTimeout(this.owlTimer);
    if (this.sizzleTimer !== null) window.clearTimeout(this.sizzleTimer);
    this.ctx.close();
  }
}
