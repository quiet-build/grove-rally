# Grove Rally driving fixes and verification — 2026-09-12

Worktree: `/Users/ming/projects/grove-rally-driving-fix`, branch `fix/rally-driving`.
Baseline: `70151b7` preserves the other agent's Babylon rebuild. Herdr's rightmost game agent was idle and had not committed or merged; its source changes were preserved before this branch was created.

## Fixes

| Problem | Cause and change | Verification |
|---|---|---|
| W appears to drive backwards after changing direction or recovering | Z-up physics to Y-up graphics swaps two axes, which is a reflection. The old quaternion composition disagreed with physical forward at two cardinal headings. Use world reflection × body rotation × local X reflection; apply the same reflection to wheel positions and steering. | The old conversion failed two cardinal-heading checks with a dot product of -1. All four headings, actual play-car acceleration, and flip/recovery now have regression coverage. |
| Holding accelerate before green stops working | Status-change effect cleared inputs when countdown became racing. Clear on modal transitions only. | Hold W and pointer accelerator continuously through the countdown. |
| Pointer and keyboard controls cancel one another | Each input path overwrote the other's values. Track held pointers and combine them with held keys. Clear both on pause/blur/cancel. | Pointer accelerator remains active after unrelated keyup; keyboard and utility-button driving checks. |
| Reset interrupts a held W key | Reset cleared session inputs without restoring currently held controls. | All reset buttons and R use the same reset handler; E2E holds W while pressing R. |
| Space cannot toggle a focused button | Global handbrake handler prevented native Space activation. | Preserve button/link Space and Enter, editable fields and host focus. W still drives after using an in-game utility button. Real Brave clicks + Space confirmed Sound off → on → off. |
| Fullscreen hides touch controls | Only the canvas board entered fullscreen. | Fullscreen the complete play area. Test native Fullscreen API, accelerator containment, viewport bounds, driving and exit; no API mocks. |
| Recovery control hidden from accessibility tree | The whole HUD had aria-hidden. | Keep only duplicate timer/checkpoint text hidden. Recovery alert and button remain exposed. |
| Embedded loading targets the host and taints the heightmap canvas | Root-relative URLs used the embedding document's origin; heightmap image omitted CORS mode. | Resolve resource URLs against the game module, load heightmap anonymously, exercise cross-origin component loading. |
| Missing content produces unhandled parse failures or absent terrain | HTML fallback responses were parsed as mesh JSON; terrain shader depended on optional textures; original course extends into negative coordinates outside the mesh. | Catch optional mesh parse failures, supply small shader texture defaults, extend wrapped terrain into the course's negative coordinates. E2E returns 404 for every optional asset and drives the original eight-post course. |
| Late asset completion recreates resources after unmount | Async mesh/scenery/car loaders continued after scene disposal. | Guard completion with scene disposal state; component reconnect tests. |
| Trees and fences can be driven through | Scenery was visual only. | Add scaled trunk/rail sphere proxies to the existing Trigger Rally solver, grouped per scenery tile. A physics regression checks that a barrier blocks the car. These are simplified proxies, not triangle-perfect mesh collisions. |
| Sky has a visible diagonal boundary | infiniteDistance already adds camera position; sync added it again. | Remove manual sky movement and inspect a fresh normal launch. |

Desktop and embedded boards also use a wide aspect ratio. Background tabs stop rendering. No new dependency or alternate physics implementation was introduced.

## Final results

- `pnpm test`: **26 passed**, four files.
- `pnpm typecheck` and `pnpm build`: **passed**. Vite reports the existing large Babylon bundle warning.
- `pnpm test:e2e --reporter=line`: **14 passed, two intentionally skipped** (portrait-only check on desktop; duplicate full-course simulation on mobile).
- `pnpm test:component --reporter=line`: **four passed**, including the WebKit focus/resume check. The initially missing WebKit browser was installed before rerunning.
- Fresh Brave launch: start button works; clicking Sound and pressing Space toggles it back off; the sky's diagonal edge is absent after the fix.
- Continuous keyboard/pointer driving and native fullscreen were exercised through actual browser input in Chromium. Automatic flip recovery is verified in the shared simulation; it was not manually reproduced on a physical phone. Fullscreen app-switch/visibility behavior is not separately accepted by an OS-level manual test.

## Verification commands and scope

```sh
pnpm test
pnpm build
pnpm test:e2e --reporter=line
pnpm test:component --reporter=line
```

Standalone tests use the production build through Vite preview, one Chromium worker, and full Chromium's new headless mode. The legacy headless shell stalled on this machine's WebGL rendering; the complete Chromium browser passed the same held-W workflow. macOS sandbox restrictions require browser tests to run with browser-launch permission.

The standalone suite covers desktop and iPhone-sized Chromium viewports: startup, held W, held pointer, reset while held, handbrake, sound-button keyboard behavior, pause/resume/restart, native fullscreen, 375px control bounds, and missing optional content. Mobile emulation is not physical iPhone acceptance.

The valley test decodes the actual local `nice.png`, uses the same course builder, actual `playCar`, and production `RallySession`, and drives all twelve checkpoints with a test steering controller. This is an end-to-end **simulation integration** check, not a claim that a human/OS-keyboard driver completed all twelve posts. It excludes rendered scenery collisions; those have a separate contact regression. This test skips when the licensed local-only heightmap is absent, and runs only once because simulation rules do not vary by viewport.

Unit tests additionally cover checkpoint ordering, finish timing, pause invariants, braking/reverse, steering, recovery, reset progress preservation, car tuning, JSON parsing and audio calculations.

Playwright traces/results are generated under ignored `test-results/`. Trigger Rally Content remains ignored and local-only; no content, build output or test artifacts are committed. This task merges locally to main; it does not authorize a production deployment.
