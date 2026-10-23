# Nothing Explorer 0.4 — input and rendering

## Changes

- Virtual file-list viewport: only visible/overscan rows are mounted. Filtering and numeric sorting are cached until the source entries, query, sort or visibility settings change. Selection no longer rebuilds/sorts all rows.
- Shared 60 Hz app update clock for scroll interpolation and viewport/thumbnail writes. The clock stops when idle. Touchpad deltas retain direct batching; coarse mouse-wheel movement settles smoothly. Scrollbar dragging remains native. Reduced-motion settings bypass interpolation.
- Windowed Chromium presentation remains VSync/display driven. Electron's setFrameRate API applies only to offscreen windows; it is not a native-window hard FPS limiter. The application caps its own update/animation cadence, not the Windows desktop refresh rate.
- Windows defaults to the D3D11 ANGLE path while preserving explicit backend choices, Chromium's driver blocklist and the GPU sandbox. No global Windows graphics settings are changed.
- A cached blurred wallpaper texture replaces live blur behind moving rows. Brief button/menu state transitions use a bounded step cadence; there are no continuous decorative animations.
- Native mouse app-command routing and DOM side-button fallback use folder history and suppress duplicate events. Default Electron application-menu accelerators no longer compete with the file manager.
- One context-aware keyboard router preserves text-field copy/paste/undo, supports navigation shortcuts from fields, and handles file selection, page/home/end navigation, type-ahead, F2, Ctrl+A, Ctrl+Shift+N, Ctrl+Tab and Ctrl+W.
- Closing a tab no longer depends on an asynchronously rendered X button. Navigation captures its target tab; back/forward only commit history after a successful load.
- A reusable local Windows helper removes PowerShell startup overhead from every navigation/clipboard lookup. Its JSON protocol preserves array types, including drive lists and hidden names.
- Preview work is delayed briefly until selection settles. Stale thumbnail jobs do not duplicate work; cache memory is bounded. Generic files load association icons rather than invoking arbitrary thumbnail handlers.

## Validation

- Nine Node tests cover the shared clock (including a simulated 144 Hz display), plus existing filesystem, ZIP, transfer, cancellation, undo, query and label checks.
- Desktop smoke checks still cover the original features and real file/folder pointer double-clicks.
- Additional tests inject Electron key events, native Windows app-command events and DOM mouse-button events. They verify Alt+Left from the address field, Ctrl+L/F/T/W, list navigation, Ctrl+A, F2, Ctrl+Shift+N, smooth wheel movement, and keyboard mounting of the final row in a 50,000-entry list.
- Synthetic scrolling benchmarks record update cadence, raw renderer cadence, mounted-row count, P95 patch time, presentation mode and reported graphics features. Results live in artifacts/interaction-performance*.json. They are measurements of this workload, not a guarantee for every directory, shell thumbnail handler, graphics driver or desktop refresh rate.

Run `node_modules/.bin/electron.cmd . --smoke --capture --interaction-test` for isolated offscreen checks. Omit `--capture` for the native-window workload. Test fixtures/profiles are separate from the user's saved app settings and real files.
