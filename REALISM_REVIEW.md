# Grove Rally realism review — 2026-09-12

## Reviewed source

Repository: https://github.com/viettranx/3dviz-pro-max
Revision: d077e0e68915c25be8e71d74684d3144fd1c2aca
License: root MIT (retain notice if copying code). External assets referenced by the skill require their own rights review.

Read the main skills/3dviz-pro-max/SKILL.md and selected object-craft, lighting-direction-and-scale, visual-anti-slop, Blender handoff, LOD and height-detail guidance. Inspected templates/rigs/lighting-sun.js and post-stack.js. Read docs/compatibility.md. No skill installation, helper execution, scene template integration or demo runtime certification was performed. TinyFish fetched the repository overview; a shallow checkout supplied pinned source evidence.

## Fit and limitations

Useful as an art-development and visual-inspection workflow, not a rally physics upgrade. Preserve Babylon.js, React and the existing physics/render coordinate boundary. Its Three.js rigs and postprocessing stack cannot be imported directly into the Babylon renderer. Translate relevant concepts into engine-native code after checking installed APIs. Blender is optional for custom hero modeling and baking; no framework migration is justified.

Current source and previously observed game frames show deliberate but overly simple forms: box-based car panels, three stacked seven-sided pine crowns, repeated conical mountain silhouettes, and simple procedural ground noise. StandardMaterial surfaces mostly share one specular response. A 1024 unfiltered directional shadow map is already present; shadows are not an absent feature. These observations explain the toy-like appearance without assuming polygon count alone is the answer.

## Proposed sequence (design hypotheses, not implemented improvements)

1. Car first: a continuous recognizable body silhouette, wheel arches, rounded panel edges, recessed windows and clear separation of paint, glass, rubber and alloy. Use original geometry. Retain wheel pivots, chassis transform and collision shape. Judge at the actual chase-camera distance; a garage render alone is insufficient.
2. Road and contact: varied gravel scale, compacted tyre lanes and irregular grass verge; improve tire-ground contact shadows. Keep the driving heightfield fixed. Normal/shading detail must not pretend to create physical ruts.
3. Landscape: several asymmetrical pine silhouettes clustered by height/density; irregular ridgelines rather than repeated cones, with restrained distant atmospheric layers. Preserve scenery collider locations and route clearance. Use instances/LOD only where profiling demonstrates a need; visually changing size must not create misleading collision boundaries.
4. Lighting and materials: establish a consistent daylight direction and exposure, then tune material separation and nearby shadow quality. Do not paste the Three.js rig's intensity, bias or shadow extent into a kilometre-scale Babylon scene. Avoid motion blur or strong depth of field that hides steering/road cues.

Recommended target: grounded, stylized realism for an accessible browser rally game. This is a proposed direction, not a promise of photorealism or measured performance. More convincing shape and material separation should precede extra postprocessing.

## Acceptance before wider art work

First finish steering-release browser acceptance (current tuning change remains unmerged). Then build one representative car + road + tree view before expanding the scenery. Capture matched chase-camera frames at starting gate, corner and rough-ground sections. Verify wheels, suspension, contact, car visibility, countdown, left/right release, reset, sound, fullscreen and embedded launch. Compare frame times and loading on the same desktop/mobile test setup; target budgets must be chosen from a fresh baseline, not guessed. Full human driving and physical-device checks remain distinct from simulation tests.

The skill's insistence on real output inspection directly addresses the recent missing-UV startup failure: structural build checks and visually attractive source code do not establish a working game. Keep source, numerical, interaction and visual evidence separate.


## Implemented first sample

- Original continuous body shell with wheel-arch cutouts and trim, door pillars/handles, refined spoiler and wheel detail. Paint, glass, rubber and alloy have separate StandardMaterial highlight settings; these are authored approximations, not measured PBR materials or ray-traced reflections.
- Irregular layered pine crowns, custom broad/uneven mountain ridgelines, multi-scale gravel shading and irregular road edges. The physical terrain, collision proxies and course data were not changed.
- Existing shadow system retained. No new texture downloads, dependency, postprocessing stack or camera/physics changes. The separately requested steering tuning is included.
- Shader/geometry APIs checked in installed Babylon declarations. Adapted the skill's object-craft and real-output inspection guidance; no template code or third-party assets copied.
- Source mesh sizes before → after: car 202 → 654 triangles, wheel 96 → 368, tree 108 → 108. Material groups remain 5/2/4 respectively. These counts do not certify frame rate; the heavily loaded host did not support a reliable performance comparison.
- Verification: 31 unit tests; TypeScript/build; 16 standalone browser cases passed, 2 device-specific skips; 4 embedded component cases passed. Fresh visible-browser launch, countdown, car rendering, input and reset observed.
- Visual inspection limitation: off-road dense foliage can occlude the chase camera. This first road-driving sample does not claim camera-occlusion polish, photographic realism, physical-mobile-device acceptance or a human-driven complete lap. Geometry normal direction was numerically checked after an intermediate inverted-surface pass and corrected before final testing.
- User-facing preview: http://127.0.0.1:5208/. No remote push or deployment.
