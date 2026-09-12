/** Original four-bar alpine synth theme, 96 BPM. No downloaded music. */
export function musicLoop(sampleRate: number) {
  const step = 60 / 96 / 2;
  const melody = [74, 0, 81, 78, 76, 0, 74, 69, 71, 0, 78, 74, 73, 0, 71, 69,
    67, 0, 74, 78, 76, 74, 71, 0, 69, 73, 76, 81, 78, 76, 73, 0];
  const roots = [50, 47, 43, 45];
  const samples = new Float32Array(Math.round(step * melody.length * sampleRate));
  const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const beat = Math.floor(t / step);
    const local = t - beat * step;
    const envelope = Math.min(1, local / 0.012) * Math.max(0, 1 - local / step) ** 2;
    const note = melody[beat];
    const lead = note ? (Math.sin(2 * Math.PI * hz(note) * local) + .2 * Math.sin(4 * Math.PI * hz(note) * local)) * 0.18 : 0;
    const bass = Math.sin(2 * Math.PI * hz(roots[Math.floor(beat / 8)]) * local) * 0.16;
    const kick = beat % 2 === 0 ? Math.sin(2 * Math.PI * 55 * local) * Math.exp(-local * 35) * 0.12 : 0;
    samples[i] = (lead + bass + kick) * envelope;
  }
  return samples;
}
