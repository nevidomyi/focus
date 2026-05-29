# FocusCode

A macOS menu bar app that trains your focus by asking you to memorize a 4-digit code and recall it later.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)
![Electron](https://img.shields.io/badge/electron-42-blue)

## How it works

1. **Start a session** — the app shows a 4-digit code for 20 seconds
2. **Memorize it** — a blue progress bar counts down
3. **Recall it** — an input popup appears; type the digits from memory
4. **Correct** → the cycle repeats after a cooldown
5. **Wrong or time's up** → choose to try a new code or sleep

All popups appear in the bottom-right corner, on top of every window including fullscreen apps.

## Install

Download the latest release for your platform from [GitHub Releases](https://github.com/nevidomyi/focus/releases):

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `FocusCode-x.x.x-arm64.dmg` |
| Windows | `FocusCode Setup x.x.x.exe` |

**macOS:** open the `.dmg`, drag FocusCode to Applications, launch it.  
If macOS blocks the app: **System Settings → Privacy & Security → Open Anyway**.

**Windows:** run the `.exe` installer, the app starts automatically.

The app lives in the menu bar — no Dock icon, no window.

## Settings

Click the menu bar icon → **Settings** to configure:

| Setting | Default | Description |
|---|---|---|
| Code display | 20 s | How long the code is shown |
| Input time limit | 30 s | Time to recall the code |
| Random interval | off | Random cooldown within a min–max range |
| Cooldown (normal) | 5 min | Fixed wait between cycles |
| Cooldown (fast) | 20 s | Wait in fast mode (for testing) |

Settings are saved to disk and persist between restarts.

## Tray menu

| Item | Action |
|---|---|
| Start / Pause Session | Toggle the cycle |
| Settings… | Open settings window |
| Dev → Fast mode | 20 s intervals for testing |
| Dev → Show … popup | Manually trigger any popup |
| Dev → Current code | Shows the active code |
| Quit | Exit the app |

## Development

```bash
git clone https://github.com/nevidomyi/focus
cd focus
npm install
npm start
```

**Stack:** Electron 42, vanilla JS, no bundler, no framework.

## Building

```bash
npm run build        # macOS DMG
npm run build:win    # Windows NSIS installer (downloads Wine automatically)
```

## Releasing

```bash
# Bump version in package.json, then:
git commit -am "Bump to vX.Y.Z"
git tag vX.Y.Z && git push && git push --tags
```

GitHub Actions builds both platforms in parallel and publishes to GitHub Releases.  
`electron-updater` checks for updates on startup and every 4 hours.

## License

MIT
