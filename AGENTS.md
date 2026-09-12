# Agent Notes

- Keep `SOURCE_REVIEW.md` current when driving code, track data, or licensing changes.
- This is a Babylon.js + Vite browser rally. Babylon draws; Trigger Rally sim/vehicle tick the car.
- Trigger Rally **Content** (meshes, textures, heightmaps) may be copied into `public/tr/` for local play only. Never commit or deploy that folder. Run `scripts/fetch-tr-content.sh`.
- Do not commit `dist/`, Playwright reports, or other generated outputs.
