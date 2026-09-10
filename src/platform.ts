const key = "grove-rally.best.v1";
export function readBest() {
  try { const n = Number(localStorage.getItem(key)); return Number.isFinite(n) && n > 0 ? n : 0; }
  catch { return 0; }
}
export function saveBest(time: number) {
  try { localStorage.setItem(key, String(readBest() === 0 ? time : Math.min(time, readBest()))); } catch { /* Private mode: the run stays playable without storage. */ }
}
export class Chime {
  private context?: AudioContext;
  muted = true;
  unlock() {
    if (this.muted) return;
    try { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); } catch { this.muted = true; }
  }
  play(saved: boolean) {
    const ctx = this.context;
    if (this.muted || !ctx || ctx.state !== "running") return;
    const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    oscillator.type = "sine"; oscillator.frequency.setValueAtTime(saved ? 660 : 180, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(saved ? 990 : 110, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.07, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.2);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  suspend() { if (this.context?.state === "running") void this.context.suspend().catch(() => {}); }
  close() { if (this.context) void this.context.close().catch(() => {}); }
}
