/** Original four-bar, 96 BPM loop. Generated locally; no downloaded music. */
export function musicLoop(sampleRate: number) {
  const step = 60 / 96 / 2;
  const melody = [76, 0, 79, 83, 81, 79, 76, 74, 72, 0, 76, 79, 76, 74, 72, 0,
    74, 0, 78, 81, 79, 78, 74, 71, 72, 76, 79, 81, 79, 76, 74, 0];
  const roots = [48, 45, 50, 43];
  const samples = new Float32Array(Math.round(step * melody.length * sampleRate));
  const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const beat = Math.floor(t / step);
    const local = t - beat * step;
    const envelope = Math.min(1, local / 0.012) * Math.max(0, 1 - local / step) ** 2;
    const note = melody[beat];
    const lead = note ? Math.sin(2 * Math.PI * hz(note) * local) * 0.22 : 0;
    const bass = Math.sin(2 * Math.PI * hz(roots[Math.floor(beat / 8)]) * local) * 0.16;
    const kick = beat % 2 === 0 ? Math.sin(2 * Math.PI * 55 * local) * Math.exp(-local * 35) * 0.12 : 0;
    samples[i] = (lead + bass + kick) * envelope;
  }
  return samples;
}
