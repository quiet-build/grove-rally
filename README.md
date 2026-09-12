# Grove Rally

A Mini Arcade rally. Driving, timing and chase-camera math come from [Trigger Rally Online Edition](https://github.com/CodeArtemis/TriggerRally) (GPL-3.0). The 3D view is Babylon.js. Trigger Rally maps/cars/textures are **not** in git.

## Play locally

```bash
pnpm install
scripts/fetch-tr-content.sh   # copies Content from a local Trigger Rally clone into public/tr/
pnpm dev
```

`public/tr/` is gitignored. Do not commit or deploy those files. Without them the game falls back to the original orchard heightfield.

## Verify

```bash
pnpm test
pnpm build
```

`pnpm verify` also runs Playwright against the standalone page.

## License

Grove Rally is GPL-3.0 because it includes Trigger Rally source (vehicle, sim, collision, helpers) converted from AMD to ES modules. Original orchard heightfield, checkpoints, toy-car config and Phaser garden art are new. See `LICENSE`, `NOTICE` and `SOURCE_REVIEW.md`.
