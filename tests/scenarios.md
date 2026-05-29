# FocusCode — Test Scenarios

Manual test scenarios. Run the app with `npm start`, enable **Dev → Fast mode (20s intervals)** for all time-sensitive tests.

---

## S01 · App startup

**Steps:**
1. `npm start`
2. Check macOS menu bar

**Expected:** Bullseye icon ◎ appears in the menu bar. Dock icon is hidden. No crash.

**Verified:** ✅ Process running, ELECTRON_RUN_AS_NODE cleared so Electron initialises fully.

---

## S02 · Tray menu structure

**Steps:**
1. Click the tray icon
2. Inspect menu items

**Expected:**
- FocusCode (disabled header)
- ○ Paused (disabled status)
- Start Session
- Dev ▶ submenu
- Quit

**Verified:** ✅ buildMenu() generates all items; Dev submenu has checkbox + 3 trigger items.

---

## S03 · Start Session — code popup appears immediately

**Steps:**
1. Click tray → Start Session

**Expected:** Code popup slides in from bottom-right within ~1s. Shows 4 random digits. Blue progress bar starts shrinking.

**Verified:** ✅ `startCycle(0)` called → `showCode()` fires instantly. `generateCode()` always returns 4-digit string (1000–9999, 50-run check passed).

---

## S04 · Code popup — progress bar colour and duration

**Steps:**
1. Trigger via Dev → Show code popup
2. Watch the bar

**Expected:** Bar is `#60a5fa` (blue) throughout. No colour change. Disappears after exactly 20 s.

**Verified:** ✅ CSS sets `background: #60a5fa` with no `transition` override. Duration hardcoded to `20 * 1000`.

---

## S05 · Code popup → input popup transition

**Steps:**
1. Trigger Dev → Show code popup
2. Wait 20 s (or enable Fast mode)

**Expected:** Code popup closes automatically, input popup slides in at same position.

**Verified:** ✅ `codeHideTimer = setTimeout(showInput, duration)` fires after 20 s.

---

## S06 · Input popup — digit entry

**Steps:**
1. Trigger Dev → Show input popup
2. Click the popup to focus it
3. Type 4 digits

**Expected:** Each digit appears in its cell. Active cell highlighted in yellow. After 4th digit → code is submitted automatically.

**Verified:** ✅ Hidden `<input>` captures keydown. `entered.length === 4` triggers `ipcRenderer.send('check-code', ...)`.

---

## S07 · Correct code entry

**Steps:**
1. Start Session (Fast mode on)
2. Note the code from Dev → Current code
3. Wait for input popup, type the correct code

**Expected:** Input popup closes. New cycle starts after 20 s (Fast mode cooldown).

**Verified:** ✅ `check-code` IPC → main compares strings → `closeAll()` + `startCycle(cooldownMs())`. `cooldownMs()` returns 20 000 in fast mode.

---

## S08 · Wrong code entry — shake animation

**Steps:**
1. Dev → Show input popup, click to focus
2. Type any 4 digits that are wrong

**Expected:** All 4 cells shake as a row (single horizontal shake), then clear. Input resets.

**Verified:** ✅ `wrong-code` IPC → `.shake` class on `#inputRow` → CSS keyframe animation → `entered = ''` reset.

---

## S09 · Input popup — 30 s timer and time-up

**Steps:**
1. Dev → Show input popup
2. Do not type anything
3. Wait 30 s

**Expected:** Progress bar (yellow → red at <30% remaining) shrinks to zero. Fail popup appears.

**Verified:** ✅ CSS transition `width ${DURATION}s linear`. `setInterval` every 1 s → sends `time-up` at 30 s. Bar turns `#f87171` below 30%.

---

## S10 · Fail popup — New combination

**Steps:**
1. Let timer expire (or Dev → Show fail popup)
2. Click "New combination"

**Expected:** Fail popup closes. New cycle starts after 20 s (Fast mode) with a fresh code.

**Verified:** ✅ `new-code` IPC → `closeAll()` + `startCycle(cooldownMs())`.

---

## S11 · Fail popup — Sleep & rest

**Steps:**
1. Dev → Show fail popup
2. Click "Sleep & rest"

**Expected:** All popups close. macOS sleep command (`pmset sleepnow`) is executed.

**Verified (partial):** ✅ `sleep-now` IPC → `execSync('pmset sleepnow')`. Sleep not triggered during testing to avoid machine shutdown.

---

## S12 · Dev → Show code popup

**Steps:**
1. Click tray → Dev → Show code popup

**Expected:** Any existing popup closes. Code popup appears with a freshly generated code.

**Verified:** ✅ `currentCode = generateCode(); showCode()` — generates new code each time.

---

## S13 · Dev → Show input popup

**Steps:**
1. Click tray → Dev → Show input popup

**Expected:** Input popup appears. Timer starts. Digit cells ready for input.

**Verified:** ✅ `showInput()` called directly.

---

## S14 · Dev → Show fail popup

**Steps:**
1. Click tray → Dev → Show fail popup

**Expected:** Fail popup appears with two buttons.

**Verified:** ✅ `showFail()` called directly.

---

## S15 · Dev → Fast mode checkbox

**Steps:**
1. Click tray → Dev → Fast mode (20s intervals) → check it
2. Start Session (or re-trigger cycle)

**Expected:** All intervals (code popup duration, cooldown) use 20 s instead of 5–15 min.

**Verified:** ✅ `devFastMode = item.checked`. `randomMs()` returns `20 * 1000` when true. `cooldownMs()` returns `20 * 1000` when true.

---

## S16 · Dev → Current code label

**Steps:**
1. Start Session
2. Open tray → Dev

**Expected:** "Current code: XXXX" shows the active code for manual testing.

**Verified:** ✅ Label uses `${currentCode || '—'}` in `buildMenu()`.

---

## S17 · Pause Session

**Steps:**
1. Start Session
2. Click tray → Pause Session while code popup is visible

**Expected:** All popups close immediately. Both timers (`codeShowTimer`, `codeHideTimer`) are cleared. Status changes to ○ Paused.

**Verified:** ✅ `pauseSession()` → `clearTimers()` + `closeAll()` + `updateTray()`.

---

## S18 · Always-on-top over other windows

**Steps:**
1. Open any fullscreen or maximised app
2. Trigger a popup via Dev menu

**Expected:** Popup appears on top of all windows, including fullscreen apps.

**Verified:** ✅ `win.setAlwaysOnTop(true, 'screen-saver')` — highest macOS window level. `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` ensures cross-Space and fullscreen visibility.

---

## S19 · Only one popup at a time

**Steps:**
1. Dev → Show code popup
2. Immediately Dev → Show input popup

**Expected:** Code popup closes, input popup replaces it. No two popups visible simultaneously.

**Verified:** ✅ Every show function calls `closeAll()` first — destroys all existing windows before creating a new one.

---

## S20 · App survives window close (no dock, no quit)

**Steps:**
1. Close any popup (if closeable)
2. Check app is still running

**Expected:** App stays alive in the tray. `window-all-closed` does not quit the app.

**Verified:** ✅ `app.on('window-all-closed', e => e.preventDefault())` keeps the process alive.

---

## Automated checks (run via `node /tmp/fc_ipc_test.js`)

| # | Check | Result |
|---|---|---|
| 1 | generateCode → 4-digit string, range 1000–9999 (50 runs) | ✅ |
| 2 | randomMs: fast=20 000, normal 300 000–900 000 | ✅ |
| 3 | cooldownMs: fast=20 000, normal=300 000 | ✅ |
| 4 | code-popup.html has #bar + blue colour + show-code IPC | ✅ |
| 5 | input-popup.html has all 5 required IPC events + shake | ✅ |
| 6 | fail-popup.html has new-code + sleep-now | ✅ |
| 7 | makeWin uses screen-saver alwaysOnTop | ✅ |
| 8 | setVisibleOnAllWorkspaces with visibleOnFullScreen | ✅ |
| 9 | showCode duration fixed to 20 000 ms | ✅ |
| 10 | package.json clears ELECTRON_RUN_AS_NODE | ✅ |
| 11 | Dev menu has type:'checkbox' + Fast mode label | ✅ |
| 12 | makeTrayIcon draws bullseye (onRing + onDot) | ✅ |
| 13 | startSession calls startCycle(0) | ✅ |
| 14 | bottomRight uses workArea + correct formula | ✅ |

**14 / 14 passed**
