// Synthesised car audio (no samples): V8-ish engine, tyre squeal, wind,
// off-road rumble and impact thuds, all on the Web Audio API.

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // brownish
    d[i] = white * 0.6 + last * 3.2;
  }
  return buf;
}

function loopNoise(ctx: AudioContext, buf: AudioBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.start();
  return src;
}

export class CarAudio {
  private ctx: AudioContext;
  private master: GainNode;
  private engineGain: GainNode;
  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];
  private filter: BiquadFilterNode;
  private burble: OscillatorNode;
  private burbleGain: GainNode;
  private squealGain: GainNode;
  private squealFilter: BiquadFilterNode;
  private windGain: GainNode;
  private rumbleGain: GainNode;
  private noise: AudioBuffer;
  private lastGear = 1;
  private muted = false;

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.noise = noiseBuffer(ctx, 2);

    // engine: detuned saw + square sub + saw octave, soft-clipped and filtered
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 2.5;
    const types: OscillatorType[] = ["sawtooth", "square", "sawtooth", "triangle"];
    const levels = [0.32, 0.22, 0.1, 0.3];
    types.forEach((t, i) => {
      const o = ctx.createOscillator();
      o.type = t;
      const g = ctx.createGain();
      g.gain.value = levels[i];
      o.connect(g).connect(shaper);
      o.start();
      this.oscs.push(o);
      this.oscGains.push(g);
    });
    // lumpy cam: amplitude modulation at a quarter of the firing frequency
    this.burble = ctx.createOscillator();
    this.burble.type = "sine";
    this.burbleGain = ctx.createGain();
    this.burbleGain.gain.value = 0.35;
    const am = ctx.createGain();
    am.gain.value = 0.65;
    this.burble.connect(this.burbleGain).connect(am.gain);
    this.burble.start();
    shaper.connect(this.filter).connect(am).connect(this.engineGain).connect(this.master);

    // tyres
    this.squealFilter = ctx.createBiquadFilter();
    this.squealFilter.type = "bandpass";
    this.squealFilter.frequency.value = 1350;
    this.squealFilter.Q.value = 9;
    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    loopNoise(ctx, this.noise).connect(this.squealFilter).connect(this.squealGain).connect(this.master);

    // wind
    const wf = ctx.createBiquadFilter();
    wf.type = "lowpass";
    wf.frequency.value = 600;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    loopNoise(ctx, this.noise).connect(wf).connect(this.windGain).connect(this.master);

    // off-road rumble
    const rf = ctx.createBiquadFilter();
    rf.type = "lowpass";
    rf.frequency.value = 180;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    loopNoise(ctx, this.noise).connect(rf).connect(this.rumbleGain).connect(this.master);
  }

  resume() {
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  update(rpm: number, throttle: number, gear: number, speed: number, slip: number, offRoad: boolean) {
    if (this.muted) return;
    const t = this.ctx.currentTime;
    const f = (rpm / 60) * 4; // V8 firing frequency
    const mults = [1, 0.5, 2, 1.003];
    this.oscs.forEach((o, i) => o.frequency.setTargetAtTime(f * mults[i], t, 0.02));
    this.burble.frequency.setTargetAtTime(f / 4, t, 0.02);
    this.burbleGain.gain.setTargetAtTime(0.45 * (1 - Math.min(1, rpm / 5000)) + 0.08, t, 0.1);
    this.filter.frequency.setTargetAtTime(380 + throttle * 2600 + rpm * 0.22, t, 0.05);
    let vol = 0.1 + throttle * 0.2 + (rpm / 9000) * 0.12;
    if (gear !== this.lastGear) {
      // brief torque cut on gear changes
      this.engineGain.gain.cancelScheduledValues(t);
      this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, t);
      this.engineGain.gain.linearRampToValueAtTime(vol * 0.35, t + 0.05);
      this.engineGain.gain.linearRampToValueAtTime(vol, t + 0.22);
      this.lastGear = gear;
    } else {
      this.engineGain.gain.setTargetAtTime(vol, t, 0.06);
    }
    this.squealGain.gain.setTargetAtTime(Math.max(0, slip - 0.25) * (offRoad ? 0.04 : 0.32) * Math.min(1, speed / 6), t, 0.05);
    this.squealFilter.frequency.setTargetAtTime(1100 + slip * 500, t, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.28, (speed / 70) ** 2 * 0.3), t, 0.1);
    this.rumbleGain.gain.setTargetAtTime(offRoad ? Math.min(0.5, speed / 25) * 0.5 : 0, t, 0.08);
    vol = 0;
  }

  impact(strength: number) {
    if (this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420 + strength * 60;
    const g = ctx.createGain();
    const peak = Math.min(1.2, 0.15 + strength * 0.08);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.4);
  }

  dispose() {
    void this.ctx.close();
  }
}
