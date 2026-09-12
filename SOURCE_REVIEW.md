# Grove Rally source and artwork review

## Code reference retained

[CodeArtemis/TriggerRally](https://github.com/CodeArtemis/TriggerRally), revision `079ac53216b74598b652ce3bf11478beb5c6832b`. Source Code is GPL-3.0; its separate Content license does not permit redistribution.

| Inspected upstream responsibility | Existing local implementation |
|---|---|
| `game/sim.js`: fixed-step accumulator and rigid body | `src/upstream/sim.js` |
| `game/vehicle.js`: drivetrain, suspension, friction and recovery | `src/upstream/vehicle.js`, original `src/game/car.ts` configuration |
| `game/game.js`: ordered checkpoints and start delay | `src/game/progress.ts`, `src/game/session.ts` |
| `game/terrain.js`: Catmull-Rom height/contact sampling | `src/game/terrain.ts` |
| `client/client.js`: chase-camera smoothing and velocity look-ahead | Existing `src/game/babylon-view.ts` camera update |

No new engine or driving implementation was introduced for the art replacement. The code under `src/upstream/`, progress, contact sampler and chassis conversion is unchanged from `6d026d6`. The later steering-release fix reduces playCar engine powerscale from 3.5 to 0.7: excessive rear-wheel torque caused continued spinning under throttle after steering release. Both left/right production-track regression cases fail with the old tuning and pass with the revised tuning. Input handlers and audio lifecycle are retained. Later presentation changes add checkpoint guidance and enable audio by default at race start; session physics is unchanged. Engine/skid gain is reduced to leave room for the existing original music. The original twelve-checkpoint generation and start-placement algorithms are retained.

## Original replacement artwork — 2026-09-12

Player problem: the accepted local prototype depended on restricted car meshes, textures, scenery and heightmap. A clean build therefore looked and played on different terrain. The new build uses only project-generated visual/audio resources:

- `src/game/original-art.ts`: original compact rally car with sloping glass, roof stripe, spoiler and alloy wheels; layered seven-sided pines; rail fences; checkpoint gates and direction signs. These are newly authored Babylon primitives/vertices, not conversions or remeshes of upstream models.
- `src/game/play-track.ts`: original analytic height samples. No upstream image or sampled terrain data is used. Changing terrain input changes slopes and course location; it does not change the heightfield or vehicle solver.
- `src/game/babylon-view.ts`: original gravel texture noise, road tyre marks, dust sprite, sky palette, layered mountain backdrop and fixed numbered checkpoint signs. Scenery placement and existing trunk/rail collision proxies are preserved.
- `src/game/music.ts`: new original alpine synth melody/timbre, using the existing audio lifecycle. No recording was downloaded.
- `src/App.tsx`, `src/styles.css`: alpine rally typography, petrol-blue and ivory palette, original Grove Rally branding. Existing controls and modal flow remain.

This art direction is a local creative design, not a claim of upstream visual reuse. Existing source research supplied the retained driving/camera patterns; no third-party art pack was adopted. Babylon primitive, merge and texture APIs were verified against installed package declarations.

## Distribution boundary and verification

Vite copies only `static/`. Historical ignored `public/tr/` files cannot enter the build, even on a machine that still has the old local prototype. Runtime source contains no `/tr/` asset requests. The former content-copy script is removed. GPL source attribution remains in `LICENSE` and `NOTICE`.

Acceptance: original scene renders in a fresh normal browser; all twelve posts can be completed with the unchanged production simulation/car; desktop and mobile control/music checks pass; no restricted content requests or artifacts; gameplay files remain unchanged. Full-course steering automation proves simulation completion, not physical-phone acceptance or a complete human-driven lap. See `ORIGINAL_ART.md` for final results and review status.


## Realism sample

The later sample replaces the simple body with an original continuous wheel-arch shell, adds material-specific highlights and wheel details, and refines pine crowns, mountain ridgelines and gravel shading. It uses 3dviz-pro-max object-craft guidance, reviewed at d077e0e68915c25be8e71d74684d3144fd1c2aca; no kit code/assets or Three.js rendering template was copied. See REALISM_REVIEW.md for implementation, limits and final verification. Physical terrain, collision and camera logic remain unchanged by this visual pass.


Checkpoint presentation now uses stationary numbered arch labels, per-checkpoint NEXT/DONE states, a HUD direction/distance indicator and completion feedback. Removed the interpolated yellow ring and travelling chevron; checkpoint coordinates and the existing acceptance radius/order remain authoritative. This is an original presentation change responding to user confusion, not reused upstream UI code. See ORIGINAL_ART.md and tests/checkpoints.spec.ts.
