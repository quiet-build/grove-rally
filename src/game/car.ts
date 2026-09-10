/** Original Grove Rally toy-car config matching Trigger Rally vehicle.js fields. Not upstream Content. */
export const toyCar = {
  mass: 980,
  dimensions: [1.7, 3.4, 1.35],
  center: [0, 0, 0.48],
  clips: [
    { pos: [0, 0.2, 0.55], radius: 0.7 },
    { pos: [0, -0.9, 0.5], radius: 0.62 },
  ],
  wheels: [
    { pos: [-0.72, 1.15, 0.32], radius: 0.32, turn: 1, drive: 0 },
    { pos: [0.72, 1.15, 0.32], radius: 0.32, turn: 1, drive: 0 },
    { pos: [-0.72, -1.15, 0.32], radius: 0.34, turn: 0, drive: 1 },
    { pos: [0.72, -1.15, 0.32], radius: 0.34, turn: 0, drive: 1 },
  ],
  engine: {
    powerscale: 0.22,
    redline: 6200,
    powerband: [
      { rpm: 800, power: 18 },
      { rpm: 2200, power: 52 },
      { rpm: 4200, power: 78 },
      { rpm: 5800, power: 64 },
    ],
  },
  transmission: {
    reverse: 3.2,
    final: 3.6,
    forward: [3.4, 2.1, 1.45, 1.05],
  },
  recover: {
    posOffset: [0, 0, 4],
    triggerTime: 8,
    releaseTime: 1,
  },
  wheelFrictionStatic: 1.45,
  wheelFrictionDynamic: 1.15,
};
