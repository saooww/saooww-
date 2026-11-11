# HTML5 game project (copy to the game repo as CLAUDE.md)

Targets: PlayGama, CrazyGames and similar web portals.

- Stack to confirm per repo (Phaser / PixiJS / plain Canvas / Three.js); read package.json first.
- Builds: single static bundle, relative paths, no external network calls except the portal SDK; initial download as small as possible (aim < 5–10 MB, lazy-load the rest).
- Portal SDKs: CrazyGames SDK v3 / PlayGama Bridge — init before gameplay, `gameplayStart/Stop`, `loadingStart/Stop`, ads only at natural breaks through the SDK, never on the first second; pause audio and game on ad and on `visibilitychange`.
- Input: keyboard + mouse + touch; no right-click/scroll hijack outside the canvas; works in an iframe at any size (resize handler, devicePixelRatio cap at 2).
- Performance: stable 60 fps on mid phones; object pools; no allocations in the game loop; texture atlases.
- Saves: portal data module or localStorage with a version key; never lose progress on update.
- QA: Playwright smoke (loads, starts, input works, no console errors) + manual check in the portal's QA tool; screenshots for store pages.
- No finance-app rules here.
