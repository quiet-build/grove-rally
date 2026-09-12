# Source review — Grove Rally

Player problem: Mini Arcade had no short, kid-friendly rally with checkpoints, retry and a readable next post. Acceptance: one original orchard loop, one toy car, countdown then drive, posts in order, pause that freezes the sim, retry from the gate, recover after a flip.

Source: [CodeArtemis/TriggerRally](https://github.com/CodeArtemis/TriggerRally) at `079ac53216b74598b652ce3bf11478beb5c6832b` (browser Online Edition, not the C++ desktop game).

| Upstream | Local |
|---|---|
| `game/sim.js` `Sim(1/150)`, `tick` accumulator, `RigidBody` | `src/upstream/sim.js` ESM conversion. Three.js math only, no WebGL |
| `game/vehicle.js` `AutomaticController`, suspension, friction, `recover` | `src/upstream/vehicle.js` plus original `src/game/car.ts` numbers |
| `game/game.js` `Progress` (18m radius, no skip), `startTime = 3`, `setupVehicle` | `src/game/progress.ts`, `src/game/session.ts` |
| `client/client.js` `CamControl.chaseCam` look-ahead `linVel * 0.17`, offset `[0,1.2,-3]`, `PULLTOWARD(..., delta * 5)`, FogExp2, 75° camera, Z-up | `src/game/babylon-view.ts` + leftover `src/game/cam.ts` |
| `game/terrain.js` `getContactRayZ` catmullRom height + 16-bit `unpack16bit` | `src/game/terrain.ts` Heightfield; `play-track.ts` decodes `nice.png` locally |
| `client/car.js` JSONLoader body/wheel, `flipY = false` | `src/game/three-json.ts` + Babylon mesh |
| `game/track.js` image/scenery/quiver pipeline | Local heightmap + generated 12-post valley loop; original eight-post orchard when optional content is absent |
| `util/recorder.js` ghosts | Not in v1 |

Code reused: ESM copies of `sim.js`, `vehicle.js`, `collision.js`, `util.js`, `pubsub.js` (GPL-3.0). Trigger Rally Content is loaded from gitignored `public/tr/` for local play only and must not be redistributed.

Why Babylon.js: the user asked for a 3D view that matches Trigger Rally. The original client is old THREE.js; Babylon.js Engine/Scene/FreeCamera/VertexData/StandardMaterial/CubeTexture are verified against current docs. Three.js stays for the upstream Vector3/Quaternion/Matrix4 physics API only.

Verification: `pnpm test` (Progress skip, sim motion, pause/retry, right-steer toward +X, a seeker finishes the orchard loop, THREE JSON quad parse). Typecheck after adding `@babylonjs/core`. Local play needs `scripts/fetch-tr-content.sh` then `pnpm dev`. Do not publish Content.

Current local view includes trees, arches, dust and the locally loaded car mesh. Checkpoints and vehicle tuning remain original adaptations, not an imported full TR course/config. Host catalog publish is not part of this rebuild.

2026-09-12 driving review: corrected reflected coordinate conversion for body/wheels and verified actual play-car forward motion at all cardinal headings and after recovery. Scenery uses scaled trunk/rail sphere proxies through the upstream collision solver; these are local approximations, not copied scenery collision rules. Course generation is shared with the actual-heightmap simulation integration test. Cross-origin assets, missing-content terrain, native fullscreen, held inputs and disposal are covered in [DRIVING_FIXES.md](DRIVING_FIXES.md).
