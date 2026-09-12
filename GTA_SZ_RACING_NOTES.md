# GTA_SZ racing notes (ideas only)

Compared [linranff/GTA_SZ](https://github.com/linranff/GTA_SZ) at `d61d243` against Grove Rally / Trigger Rally OE `079ac532`. GTA_SZ is a Babylon.js Shenzhen city sandbox (drive / walk / drone / plane / tank), not a rally.[2]

Do **not** copy their TypeScript: the repo itself has no SPDX license. Asset licenses (CarConcept CC BY 4.0, Poly Haven CC0) do not cover `src/`. Borrow ideas; keep Trigger Rally `vehicle.js` as the sim.

## What their “racing” actually is

`stepCar` is a 2D arcade integrator: speed, yaw, steer lerp, no suspension, no rigid body.[3] Collision is a 90 m grid of road segments and building rings, with substep anti-tunnel.[5] That is a different game than Grove’s `Sim(1/150)` + wheels.

## Worth taking (input / juice / camera, not physics)

| Idea | Where they do it | Grove today |
| --- | --- | --- |
| High-speed steer soften on keys only | `manualSteeringInput`; test keeps autopilot physics unchanged[3][7] | Binary `turn`, `handbrake` hardcoded `0` |
| Space handbrake | `stepCar` extra yaw + brake[3] | Field exists in `vehicle.js`, unused[9] |
| `R` snap back to nearest road | `resetRoad()`[5] | Auto `recover()` only |
| Chase / cockpit / inspect; look-then-return | `C` / `V`, `viewReturn`, FOV `0.80 + \|speed\| * 0.00045`[5][6] | TR chase only (`linVel * 0.17`) |
| Web Audio motor / roll / wind / skid | `CityAudio`, unlock after gesture[4][6] | Mute button, no drivetrain |
| Brake lights on the road | one `SpotLight`, no extra shadow map[8] | Dust only |

## Do not take

Open-world traffic, pedestrians, career, autopilot, flight, tank, their CarConcept mesh, or replacing `vehicle.js` with `stepCar`.

## Suggested Grove order

1. Bind Space → `handbrake`; keep physics in upstream.
2. Speed-scale keyboard steer in `session.ts`; test that `vehicle.js` turn math is untouched.
3. `R` / last-checkpoint reset in addition to auto recover.
4. Engine + skid from `skidLevel` (already in `vehicle.js`).
5. Brake-light emissive (and maybe one cheap rear spot). Cockpit last — car1 interior is not a dash.

Read locally at `/tmp/GTA_SZ` if the clone is still there.
