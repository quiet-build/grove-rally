import { describe, expect, it } from "vitest";
import { engineGain, engineRate, skidGain } from "./drive-audio";

describe("Trigger Rally car.js audio mapping", () => {
  it("uses throttle * 0.2 + 0.4 for engine gain", () => {
    expect(engineGain(0)).toBeCloseTo(0.4);
    expect(engineGain(1)).toBeCloseTo(0.6);
  });

  it("divides engine speed by rpm * π/30 for playback rate", () => {
    const idle = 800 * Math.PI / 30;
    expect(engineRate(idle, 800)).toBeCloseTo(1);
  });

  it("maps skidLevel with log(1 + skid * 0.0001) * 0.6", () => {
    expect(skidGain(0)).toBe(0);
    expect(skidGain(10000)).toBeCloseTo(Math.log(2) * 0.6);
  });
});

import { musicLoop } from "./music";
it("generates a finite, audible ten-second loop with quiet boundaries", () => {
  const samples = musicLoop(8000);
  expect(samples.length).toBe(80000);
  expect(samples.every(Number.isFinite)).toBe(true);
  expect(Math.max(...samples)).toBeGreaterThan(0.1);
  expect(samples.every(sample => Math.abs(sample) < 1)).toBe(true);
  expect(Math.abs(samples[0])).toBeLessThan(0.001);
  expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.001);
});
