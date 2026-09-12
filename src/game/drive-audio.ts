import { musicLoop } from "./music";

/**
 * Trigger Rally client/car.js audio mapping at 079ac532.
 * Official car sound buffers are not in the clone, so oscillators follow the
 * same gain / playbackRate formulas. engineRpm uses this car's idle rpm so
 * rate = 1 at idle (config.sounds.engineRpm is missing).
 */
export function engineGain(throttle: number) {
  return throttle * 0.2 + 0.4;
}
export function engineRate(angVel: number, engineRpm: number) {
  return angVel / (engineRpm * Math.PI / 30);
}
export function skidGain(skidLevel: number) {
  return Math.log(1 + skidLevel * 0.0001) * 0.6;
}

export class DriveAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGainNode: GainNode | null = null;
  private skidGainNode: GainNode | null = null;
  private started = false;

  async unlock() {
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      if (!this.started && this.context.state === "running") this.build();
    } catch { /* Autoplay blocked: stay silent until the next gesture. */ }
  }

  update(input: { muted: boolean; paused: boolean; throttle: number; engineAngVel: number; engineRpm: number; skidLevel: number }) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || !this.master || !this.engine || !this.engineGainNode || !this.skidGainNode) return;
    const silent = input.muted || input.paused;
    this.master.gain.setTargetAtTime(silent ? 0 : 0.12, ctx.currentTime, 0.05);
    const rate = Math.max(0.05, engineRate(input.engineAngVel, input.engineRpm));
    this.engine.frequency.setTargetAtTime(70 * rate, ctx.currentTime, 0.05);
    this.engineGainNode.gain.setTargetAtTime(engineGain(input.throttle) * 0.4, ctx.currentTime, 0.05);
    this.skidGainNode.gain.setTargetAtTime(skidGain(input.skidLevel) * 0.5, ctx.currentTime, 0.04);
  }

  silence() {
    if (!this.context || !this.master) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(0, this.context.currentTime);
  }

  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null;
    this.started = false;
  }

  private build() {
    const ctx = this.context;
    if (!ctx || this.started) return;
    this.started = true;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const samples = musicLoop(ctx.sampleRate);
    const musicBuffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    musicBuffer.getChannelData(0).set(samples);
    const music = ctx.createBufferSource();
    music.buffer = musicBuffer;
    music.loop = true;
    music.connect(this.master);
    music.start();
    this.engine = ctx.createOscillator();
    this.engine.type = "sawtooth";
    this.engine.frequency.value = 70;
    this.engineGainNode = ctx.createGain();
    this.engineGainNode.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 900;
    this.engine.connect(engineFilter).connect(this.engineGainNode).connect(this.master);
    this.engine.start();
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const skid = ctx.createBufferSource();
    skid.buffer = noise;
    skid.loop = true;
    const skidFilter = ctx.createBiquadFilter();
    skidFilter.type = "bandpass";
    skidFilter.frequency.value = 1750;
    skidFilter.Q.value = 2.7;
    this.skidGainNode = ctx.createGain();
    this.skidGainNode.gain.value = 0;
    skid.connect(skidFilter).connect(this.skidGainNode).connect(this.master);
    skid.start();
  }
}
