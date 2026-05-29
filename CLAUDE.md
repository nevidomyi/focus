# FocusCode — Claude context

macOS focus trainer that lives in the system tray. Periodically shows a
4-digit code to memorize, then asks the user to recall it.

## Stack

- **Electron 42** — vanilla JS, no bundler, no framework
- **electron-builder** — packages `.dmg` (macOS) and `.exe` (Windows)
- **electron-updater** — auto-update via GitHub Releases
- `nodeIntegration: true`, `contextIsolation: false` — intentional, this
  is a local-only desktop tool, not a web app

## File structure

```
src/
  main.js          — main process: tray, timers, IPC handlers, auto-update
  popup.css        — shared styles for all three popups
  code-popup.html  — shows the 4-digit code + blue progress bar (20 s)
  input-popup.html — digit input cells + 30 s timer + shake on wrong code
  fail-popup.html  — "New combination" / "Sleep & rest" buttons
  icon.icns        — app icon for macOS (Finder, Dock, Launchpad)
  icon.ico         — app icon for Windows
  tray-icon.png    — menu bar icon, 32×32 @2x, black template image
focus-svgrepo-com.svg  — source SVG used to generate all icons
tests/scenarios.md     — 20 manual test scenarios + 14 automated checks
.github/workflows/release.yml  — CI: builds macOS DMG + Windows EXE on tag push
```

## Running locally

```bash
npm start        # launches the app (clears ELECTRON_RUN_AS_NODE)
npm run build    # builds dist/FocusCode-*.dmg  (macOS only)
npm run build:win  # builds dist/FocusCode Setup *.exe  (downloads Wine automatically)
```

## Releasing

```bash
# 1. Bump "version" in package.json
git commit -am "Bump to vX.Y.Z"
git tag vX.Y.Z && git push && git push --tags
# → GitHub Actions builds both platforms and publishes to GitHub Releases
```

GitHub repo: https://github.com/nevidomyi/focus  
Secret required: `GH_TOKEN` (repo scope) — already set.

## Game loop

```
startSession()
  └─ startCycle(0)             ← immediate on session start
       └─ setTimeout(showCode, delayMs)

showCode()  [20 s]
  └─ setTimeout(showInput, 20_000)

showInput() [30 s timer in HTML]
  ├─ correct → startCycle(cooldownMs())   ← 5 min normal / 20 s fast mode
  ├─ wrong   → shake + clear input
  └─ time-up → showFail()

showFail()
  ├─ "New combination" → startCycle(cooldownMs())
  └─ "Sleep & rest"   → execSync('pmset sleepnow')
```

Close button (`×`) on any popup → `pause-session` IPC → `pauseSession()`.

## IPC events

| Renderer → Main | Triggered by |
|---|---|
| `check-code` | 4th digit entered |
| `time-up` | 30 s input timer expires |
| `new-code` | "New combination" button |
| `sleep-now` | "Sleep & rest" button |
| `pause-session` | `×` close button on any popup |

| Main → Renderer | Received by |
|---|---|
| `show-code` | code-popup — starts progress bar |
| `start-timer` | input-popup — starts 30 s countdown |
| `wrong-code` | input-popup — triggers shake animation |

## Tray menu

- **Start / Pause Session** — toggles the cycle
- **Dev** submenu (for development):
  - Fast mode checkbox — 20 s intervals instead of 5–15 min
  - Show code / input / fail popup — manual trigger
  - Current code label — shows active code for manual testing
  - Check for updates
- **Quit**

## Key implementation notes

- `ELECTRON_RUN_AS_NODE=''` in npm start — required because Claude Code sets
  `ELECTRON_RUN_AS_NODE=1` in its environment, which prevents Electron from
  initialising the GUI layer.
- `setAlwaysOnTop(true, 'screen-saver')` — highest macOS window level,
  appears above fullscreen apps.
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` — popups
  visible on all Spaces.
- `tray-icon.png` is a **black-on-transparent** image with `scaleFactor: 2.0`.
  `setTemplateImage(true)` lets macOS adapt it for light/dark menu bar.
- `LSUIElement: true` in plist — hides app from Dock even without
  `app.dock.hide()` in the packaged build.
- Icons generated from `focus-svgrepo-com.svg` via `qlmanage` + Python PIL +
  `iconutil`. To regenerate: re-run the Python snippet from git history.
- `electron-updater` must stay in `dependencies` (not devDependencies) so
  it is included in the `.asar` bundle.

## Conventions

- No TypeScript, no React, no bundler — keep it vanilla.
- Shared popup styles live in `popup.css`; only popup-specific overrides go
  inline in each HTML file.
- All timers tracked in `codeShowTimer` / `codeHideTimer` — always call
  `clearTimers()` before scheduling new ones.
- `closeAll()` is called at the start of every `show*()` function — only one
  popup visible at a time.
- Dev menu items exist only for testing; do not remove them.
