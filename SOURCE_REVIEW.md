# Source review — Grove Rally

Player problem: Mini Arcade had no short, kid-friendly rally with checkpoints, retry and a readable next post. Acceptance: one original orchard loop, one toy car, countdown then drive, posts in order, pause that freezes the sim, retry from the gate, recover after a flip.

Source: [CodeArtemis/TriggerRally](https://github.com/CodeArtemis/TriggerRally) at `079ac53216b74598b652ce3bf11478beb5c6832b` (browser Online Edition, not the C++ desktop game).

| Upstream | Local |
|---|---|
| `game/sim.js` `Sim(1/150)`, `tick` accumulator, `RigidBody` | `src/upstream/sim.js` ESM conversion. Three.js math only, no WebGL |
| `game/vehicle.js` `AutomaticController`, suspension, friction, `recover` | `src/upstream/vehicle.js` plus original `src/game/car.ts` numbers |
| `game/game.js` `Progress` (18m radius, no skip), `startTime = 3`, `setupVehicle` | `src/game/progress.ts`, `src/game/session.ts` |
| `client/client.js` `CamControl.chaseCam` look-ahead `linVel * 0.17`, `PULLTOWARD(..., delta * 5)` | `src/game/cam.ts` 2D follow |
| `game/terrain.js` `getContactRayZ` catmullRom height + derivatives | `src/game/terrain.ts` original height samples, same sampling |
| `game/track.js` image/scenery/quiver pipeline | Not used. Original `COURSE` checkpoints instead |
| `util/recorder.js` ghosts | Not in v1 |

Code reused: ESM copies of `sim.js`, `vehicle.js`, `collision.js`, `util.js`, `pubsub.js` (GPL-3.0). No Trigger Rally Content.

Why Phaser + Three math, not Three.js rendering: Mini Arcade games stay on Phaser canvas; technology-choices says not to add Three.js just because a sim is 3D. The upstream vehicle API already uses `THREE.Vector3` / `Quaternion` / `Matrix4`, so that math library stays. The orchard is drawn in Phaser.

Verification: `pnpm test` (Progress skip, sim motion, pause/retry, right-steer toward +X, a seeker finishes the loop). Typecheck/build/e2e run after install. Local Chromium play after the turn invert reached post 3 on the dirt; pause froze the clock; restart returned to 0.0. Physical iPhone/Android and Safari were not available.

Remaining: Host catalog publish so playminiarcade.com lists the fourteenth game. No physical-device or Safari pass yet.
