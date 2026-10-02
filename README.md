# Grove Rally

An original alpine rally for Mini Arcade: a petrol-blue car, pine forests, pale mountain ridges and gravel roads. Babylon.js draws the scene; the existing GPL-3.0 Trigger Rally simulation handles driving.

## Run

```sh
pnpm install --frozen-lockfile
pnpm dev
```

No separate asset download is needed. Geometry, terrain samples, gravel/dust textures and the music are generated locally by the project. Starting a race enables music and driving audio by default. Click **Sound on** to mute both; the choice is retained through restarts within the session. Pause silences both.

## Verify

```sh
pnpm verify
pnpm test:component
```

The twelve-post integration test uses the same original terrain, course builder and car configuration as play. Desktop/mobile browser checks cover controls, fullscreen and audio. `static/` is the only directory copied into builds, so historical local-only `public/tr/` files are excluded.

## License

GPL-3.0: `src/upstream/` derives from Trigger Rally's Source Code. No Trigger Rally Content is shipped. See `LICENSE`, `NOTICE` and `SOURCE_REVIEW.md`.

## R2 publication

The pinned `quiet-build/.github` arcade workflow publishes only this game to the shared `mini-arcade-assets` R2 bucket. Existing source, component, standalone and applicable PWA/bundle gates run before publication. The complete relative-base distribution is stored under a content-addressed version; CDN bytes, CORS, cache headers and real Chromium module/CSP readiness must pass before switching the game’s `https://assets.playminiarcade.com/channels/grove-rally.js` entry. Failed verification leaves the previous entry unchanged. No Cloudflare Pages deployment or cumulative asset merge remains. Existing GitHub Pages publication, where configured, remains separate. Production writes are CI-only; update both full support SHA pins together.
