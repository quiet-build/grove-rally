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
