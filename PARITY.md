# Explorer capability audit — 0.7.0

This is a working file manager, not a complete reimplementation of Windows Explorer. “Native” below means the command opens a Windows interface; it does not run inside this app.

| Area | Implemented | Remaining |
| --- | --- | --- |
| Navigation | Tabs, history, breadcrumbs, typed local/UNC paths, native volume labels, pins, saved session, keyboard and mouse history | Tab tear-off and full shell namespace hosting |
| Folder contents | Virtualized details/grid, grouping, resizable/reorderable detail columns, compact rows, four icon sizes, extensions toggle, sorting, hidden items, selection, thumbnails, image/text previews, file association opening | Native preview-handler hosting |
| File operations | Copy, cut, paste, rename, folder/text creation, recycle, transfer progress, cancellation, pause/resume, verified persistent undo/redo, prefix-verified interrupted-job resume and commit reconciliation, collision skip/keep-both/merge/replace choices, Windows DACL/named-stream/timestamp preservation | Transactional crash recovery throughout undo/redo; complete link, filesystem and provider metadata acceptance |
| Bulk rename | Name/extension/number/date/size patterns, literal find/replace, full preview, collision checks, grouped undo | Complete Explorer/provider metadata property support |
| Clipboard and drag/drop | Windows file clipboard, drag-out, copy/move/shortcut drop modifiers, actual-volume defaults, same-folder numbered copies, grouped shortcut undo | Complete COM IDataObject/IDropTarget parity, virtual-file drops, physical cross-app drag/cursor acceptance |
| Search | Folder filtering, recursive scanning, optional Windows indexed names, bounded text content queries | Complete AQS/property-store/indexed-content integration |
| Archives | ZIP browse/create/extract with traversal and CRC protection | Encrypted ZIP, in-window 7z/RAR/TAR editing |
| Native tools | Properties, Open With, permissions, Previous Versions, print/share handlers, terminal, desktop shortcut, network mapping/disconnect, eject, folder options | Native tool acceptance depends on Windows version, installed handlers, device and permissions |
| Shell locations | In-window Shell.Application namespace navigation for This PC, Network, Recycle Bin, Libraries, Printers and reachable child namespaces; restore/delete verbs and installed Windows action menus | Full IContextMenu2/3 extension hosting, virtual-file copy/drop, device/cloud-provider acceptance; Recent/Control Panel remain native entry points |
| Appearance | Dark/light, wallpaper picker/reset/show, glass toggle/blur/opacity, motion levels, smooth scroll toggle, reduced-motion support | Full accessibility acceptance and high-DPI/multi-monitor hardware matrix |
| Distribution | Public GitHub release feed, stable version detection, explicit download/restart, checksums, NSIS build, tag-based CI release | Authenticode signing; upgrade installation still needs acceptance across machines |

The app retains native Explorer entry points for unsupported shell operations. Nothing Explorer does not register itself as the Windows system shell.

## Validation

Automated tests cover filesystem safety, ZIPs, queries, drive labels, undo, bulk rename and pause/cancel, appearance normalization, fixed update source, and the 60 Hz scheduler. Packaged desktop smoke checks real pointer/keyboard routing, previews, file operations, settings persistence and a 50,000-item viewport. Native tools that would print, share, eject or modify network configuration are not invoked automatically by tests.

## Historical 0.6 safety and acceptance baseline

This section records the published 0.6 behavior. The development changes and their acceptance limits follow below.

The app icon is original SVG artwork inspired by the familiar folder silhouette, with gold and charcoal glass surfaces and a dotted N mark. PNG and multi-size ICO exports are included; `scripts/render-icon.cjs` renders the SVG with Chromium.

Undo/redo recovery copies are stored in the app profile, not hidden among the user's folder contents. Starting a new operation invalidates redo and sends obsolete recovery copies to Windows Recycle Bin. Rename, bulk rename, create, copy and move redo check for later edits and collisions. Successful undo/redo history persists across restarts. Whole-operation transactional recovery during a power failure is not complete.

Transfer jobs persist their source list and committed source list. After a restart, interrupted jobs wait for **Retry remaining**. Committed sources are skipped, and known partial staging data is removed only when the user retries with sources still present. Interrupted files restart from byte zero. If a crash occurs between filesystem commit and journal save, an existing destination stops retry rather than overwriting it; manual reconciliation is still necessary.

Native recycle/restore was tested using a disposable uniquely named fixture. Enumeration of the existing Recycle Bin was read-only. Windows confirms permanent deletion through its own shell verb. Device/provider transfers and shell-extension submenu hosting are not claimed complete.

## Published 0.7.0 milestone (2026-10-27)

The stable 0.7.0 release passed tagged Windows CI [40452523216](https://github.com/iniharith/nothing-explorer/actions/runs/40452523216). The packaged 0.6.2 updater detected 0.7.0 through the fixed GitHub feed. This proves release detection, not installation acceptance on every machine. The release includes:

- Merge/replace transfer planning with retained replacement data and grouped undo/redo.
- Prefix-verified resumption of interrupted file data; journalled verified-commit reconciliation; durable journal writes.
- Windows named streams, discretionary ACLs and timestamps copied through the Windows metadata helper. Broader filesystem/provider acceptance remains necessary.
- Column resizing/reordering and rename patterns with numbering, dates, sizes and literal find/replace.
- Moving items into their existing parent is a safe no-op. Copying within the same folder creates vacant numbered names, including folder names with dots. A multi-item shortcut drop retains partial success and undoes/redoes as one persistent group.
- Drop modifiers: Ctrl copies, Shift moves, Alt or Ctrl+Shift creates Windows shortcuts. Default copy/move uses actual filesystem volume IDs, including mounted volumes; mixed-volume sources are separated. Shortcuts choose vacant numbered names and participate in Undo/Redo. Native shortcut targets and copy/move/undo paths pass the packaged regression. Physical cross-application drag/cursor feedback and shell virtual-file drops still require acceptance.
- Packaged desktop regression: 50,000 items, 26 mounted rows, 60.004 app updates/second and 0.8 ms p95 viewport patch cost on the measured 60 Hz software-rendered session. Offscreen capture measured 37.35 updates/second; this is not a universal 60 FPS claim.
- An embedded ExplorerBrowser prototype, behind explicit development/test flags. Its folder, parent-window, selection and navigation checks pass. Complete visual, shell-extension, clipboard and device acceptance is still outstanding. It is hidden from normal builds until that acceptance is complete.
- Fixed the native-view placeholder regression: the glass list stays visible, a native pane requires a visible-window acknowledgement, failures restore normal controls, and test windows have an explicit TEST WINDOW title. No published release contains this placeholder.
- Electron patched to 44.9.3 and the compatible fast-uri dependency updated; npm audit reports no known vulnerabilities for the current lockfile.

The full Explorer-parity objective remains active. This release does not close the remaining search, archive, namespace, accessibility, window-management and native integration requirements listed above.
## Unreleased tab workflow improvements

The codex/tab-workflows branch adds per-tab query/selection/scroll restoration, background close without reloading the active folder, middle-click tab closing, in-window drag reordering, keyboard navigation when a tab title is focused, and a scrollable strip that retains a visible active tab and new-tab button with many tabs open. The final packaged desktop regression passed these behaviors plus existing file operations and keyboard/mouse checks. Drag reordering is exercised through browser drag events; physical drag acceptance and tab tear-off/multiple windows remain open.

The measured 50,000-item run retained 26 mounted rows, 60.006 app updates/second and 0.6 ms p95 row patch cost, with GPU compositing enabled. This development work is not part of the published 0.7.0 installer.
## Unreleased multi-window implementation

Windows share one transfer queue, undo/redo history, update controller and serialized file-action/settings writers. IPC handlers route by the requesting trusted window; each window owns its folder watcher, search cancellation and native-preview state. A normal app launch acquires a single-instance lock so subsequent launches open another window through the same controller. Secondary tab sessions use sessionStorage and cannot overwrite the primary saved tab session.

Ctrl+N and Open in new window create a ready window at the requested folder. Move tab to new window is available through the tab context menu and Tools; it transfers validated history, query, selection and scroll state, then closes the source tab only after the destination finishes loading. Failed creation leaves the source intact. Startup waits for DOMContentLoaded so fast secondary windows cannot initialize before their scripts. Simultaneous Undo/Redo and obsolete-redo cleanup are serialized.

The 36 automated tests and packaged desktop suite pass. Native multi-window checks cover cross-window Undo/Redo, simultaneous history commands, settings writes, continuation of a paused transfer after a window closes, Ctrl+N, failed tab moves and successful history-preserving moves. The 50,000-item desktop measurement retained 25 rows, approximately 60.008 updates/second and 0.7 ms p95 viewport patch cost. This is not a claim of universal presentation performance.

Physical tear-off/cross-window tab dragging, all-window restart restoration, the full device/provider/accessibility matrix and the other completion gates remain open. This work is not yet included in a published stable installer. Windows release CI now runs the multi-window suite as part of packaged acceptance.
## Unreleased cross-window tab drops — 0.8.0-beta.1 candidate

Tab drags now carry a short-lived opaque token rather than serialized tab paths. Only another trusted app window can claim the validated state; it must load and restore the tab before acknowledging the move. Failed loads roll back the destination and keep the source. Cancelled/expired/replayed tokens cannot close a source tab, and a source that changes during acceptance is retained. Local reorders release their drag snapshots immediately. Navigation now reports load success through both shell wrappers, and secondary-window readiness rejects a failed initial folder load.

Forty automated tests pass, including one-shot claims, acknowledgement ownership, cancellation/expiry, destination closure and snapshot cleanup. Packaged desktop and capture suites exercise cross-window drag events, full history/query/selection transfer, source-last-tab closure, and simulated destination-load failure with rollback. These are browser-event regression checks, not proof of physical mouse acceptance across all Windows configurations. The new-tab button remains beside the last tab when tabs fit and remains reachable with overflow.

The package is labelled 0.8.0-beta.1 to distinguish this development build from the published 0.7.0 installer. No beta release/feed is published; installed apps continue using the fixed stable GitHub feed. Physical drag acceptance, drag-out tear-off into a newly created window, all-window session restoration and the broader Explorer completion gates remain open.
