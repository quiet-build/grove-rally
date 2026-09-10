# Grove Rally

A Mini Arcade toy-car rally around an original peach orchard. Driving, timing and chase-camera math come from [Trigger Rally Online Edition](https://github.com/CodeArtemis/TriggerRally) (GPL-3.0). Maps, cars and art from that project are **not** included.

## Play locally

```bash
pnpm install
pnpm dev
```

## Verify

```bash
pnpm test
pnpm build
```

`pnpm verify` also runs Playwright against the standalone page.

## License

Grove Rally is GPL-3.0 because it includes Trigger Rally source (vehicle, sim, collision, helpers) converted from AMD to ES modules. Original orchard heightfield, checkpoints, toy-car config and Phaser garden art are new. See `LICENSE`, `NOTICE` and `SOURCE_REVIEW.md`.
