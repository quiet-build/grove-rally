/**
 * Car config in the same local frame Trigger Rally Game.setupVehicle expects:
 * Y-up mesh space, Z forward. setupVehicle applies quat(1,1,1,1) so body +Y is roof.
 * recover.triggerTime/releaseTime must satisfy releaseTime > triggerTime or recover()
 * aborts on the first tick (vehicle.js). Official ArbusuG JSON is not in the clone.
 */
export const toyCar = {
  mass: 980,
  dimensions: [1.7, 1.35, 3.4],
  center: [0, 0.48, 0],
  clips: [
    { pos: [0, 0.55, 0.2], radius: 0.7 },
    { pos: [0, 0.5, -0.9], radius: 0.62 },
  ],
  wheels: [
    { pos: [-0.72, 0.32, 1.15], radius: 0.32, turn: 1, drive: 0, brake: 35 },
    { pos: [0.72, 0.32, 1.15], radius: 0.32, turn: 1, drive: 0, brake: 35 },
    { pos: [-0.72, 0.34, -1.15], radius: 0.34, turn: 0, drive: 1, brake: 25, handbrake: 45 },
    { pos: [0.72, 0.34, -1.15], radius: 0.34, turn: 0, drive: 1, brake: 25, handbrake: 45 },
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
    triggerTime: 1,
    releaseTime: 2.5,
  },
  wheelFrictionStatic: 1.45,
  wheelFrictionDynamic: 1.15,
};

/** 3D play path only. toyCar stays the orchard default so session tests keep their distances. */
export const playCar = {
  ...toyCar,
  wheelFrictionStatic: 1.8,
  wheelFrictionDynamic: 1.4,
  engine: {
    ...toyCar.engine,
    // Keep rear-wheel torque within tyre grip when accelerating out of a turn.
    powerscale: 0.7,
    flywheel: 220,
  },
};
