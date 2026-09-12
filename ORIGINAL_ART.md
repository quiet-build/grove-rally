# Original alpine presentation — 2026-09-12

Grove Rally now generates its own teal-and-ivory car, pine trees, fences, gates, direction signs, mountain silhouettes, road/detail textures, dust sprite and synthesised music. The rear badge reads Grove Rally. No Trigger Rally Content is loaded. Vite copies only static/, excluding historical ignored public/tr/ files.

Physics, vehicle tuning, input handling, recovery, checkpoint progression and timing files are unchanged from 6d026d6. The existing valley course generator and heightfield sampler are retained. Original height samples replace the restricted upstream heightmap: slopes and generated course placement therefore differ; this is not an identical track.

## Verification

- 28 unit tests, TypeScript and production build passed.
- The final cabin mesh initially lacked UV coordinates required by the other merged body primitives. Babylon threw during scene construction, leaving a blank canvas and frozen countdown. The missing attribute is now supplied; a model-construction regression test failed before the fix and passes after it.
- Fresh normal browser reproduction: click Open the gate; car and countdown now render; countdown reaches On course, timer advances, keyboard input and visible vehicle movement observed.
- The earlier machine-load explanation did not establish the cause of the blank scene. Chromium also needs execution outside the local sandbox to start successfully; this is a separate verification-environment issue.
- Full production browser suite: 16 passed, 2 device-specific skips. Embedded component suite: 4 passed, including WebKit controls. Build contains no dist/tr assets.
- No production publication or remote push performed. User visual/play acceptance remains pending before CI publication.

## Steering-release follow-up

User confirmed that continued spinning occurs after releasing Left while holding W. Production simulation reproduction with full throttle yielded 8.63 radians accumulated yaw over six seconds after left release (14.35 right). Reducing playCar powerscale from 3.5 to 0.7 eliminates the reproduced spins; both directions stay below pi/2 accumulated yaw and exceed 10 m/s. The solver and inputs are unchanged. Added steering.test.ts, with both cases red before tuning and green afterward. All 30 unit tests and production build pass.

The initial browser run was inconclusive under heavy host load. Follow-up desktop acceptance passed all six driving/course cases. The final realism build passed the full suite: 16 browser cases, 2 device-specific skips, and 4 component cases. Preview at port 5208 serves the new build. No production publication.
