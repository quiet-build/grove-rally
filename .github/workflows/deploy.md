# Arcade component deployment

The pinned `quiet-build/.github` arcade workflow publishes only this game to the shared `mini-arcade-assets` R2 bucket. Existing source, component, standalone and applicable PWA/bundle gates run before publication. The complete relative-base distribution is stored under a content-addressed version; CDN bytes, CORS, cache headers and real Chromium module/CSP readiness must pass before switching the game’s `https://assets.playminiarcade.com/channels/grove-rally.js` entry. Failed verification leaves the previous entry unchanged. No Cloudflare Pages deployment or cumulative asset merge remains. Existing GitHub Pages publication, where configured, remains separate. Production writes are CI-only; update both full support SHA pins together.

## Migration checkpoint — 2026-10-02

The R2 candidate passed the existing CI source/build/browser gates and a separate read-only CDN byte/module/CSP check. GitHub-hosted publication is blocked by the asset zone’s Bot Fight Mode challenge, so the stable R2 channel has not been promoted and the production portal still uses the previous Pages entry. Keep that Pages project until the R2 channel and portal switch are verified. After the zone permissions and approved bot configuration are resolved, dispatch Deploy on current main; do not rerun an older SHA because promotion rejects stale main commits.
