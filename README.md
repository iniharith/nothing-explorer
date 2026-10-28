# Nothing Explorer

Windows desktop file manager with Explorer-style tabs, address/search and command rows, and the supplied admin reference's frosted-glass treatment.

## Release status

The published stable release is [0.8.5](https://github.com/iniharith/nothing-explorer/releases/tag/v0.8.5). It adds merge/replace and verified transfer recovery, metadata preservation, configurable columns, rename patterns and Explorer drop modifiers. The unfinished embedded Windows pane is disabled in normal builds; failures retain the working glass list. See [PARITY.md](PARITY.md) for completed checks and remaining acceptance. The installed application was upgraded to 0.8.4, with the existing profile backed up and preserved. Full Explorer parity remains in progress.

Version 0.8.0 includes tab/window workflows and multi-format archive extraction with shared cancellation. See PARITY.md for the implementation and remaining acceptance gates.

## Run and build

```
npm install
npm start
npm test
npm run package
npm run installer
```

Portable folder: `release/win-unpacked/` (keep the entire folder together).
Installer: `release/Nothing-Explorer-Setup-0.8.0.exe`.

## Implemented

- Windows volume names, free space, mapped drive paths and removable-drive availability. Refresh updates drive information. This PC's labelled disk is verified as **STRIX (F:)**; unlabeled disks retain Windows-style fallback names.
- Tabs and histories, breadcrumbs/address editing, known folders, pins, saved sessions, list/grid views, sort direction, multiselection, and select/invert commands.
- Double-click/native association opening, image previews, lazy thumbnails and Windows file icons. Installed Windows handlers determine optional PDF/design/video thumbnails.
- Create folder/text file, rename, copy/cut/paste with Windows file clipboard exchange, native drag-out and copy/move/shortcut drop modifiers into the current folder, folder rows, or sidebar locations.
- Sequential transfer queue, byte progress, cancel, same/cross-volume copies and moves. Every transfer uses staging; interrupted items retain their source. Completed items remain if a later item fails. Existing destinations require an explicit skip/keep-both/merge/replace choice. Replaced items are retained for Undo.
- Persistent undo for successful app transfers, creations and renames (latest 100 records). Hashes protect copied targets from being discarded if their contents changed. Undo refuses collisions. A move copies/verifies the destination then sends its source to the Windows Recycle Bin, so a failed recycle can leave a safe duplicate.
- ZIP entry browsing, creation, and extraction into a new folder. Extraction rejects path traversal, reserved Windows names, symlinks, duplicate case-insensitive paths and encrypted entries, and verifies CRC checksums.
- Current-folder filtering, cancellable subfolder scanning, optional Windows indexed name search. Scanning supports quoted names, wildcards, `ext:png`, `kind:picture`, `size:>10MB`, `modified:2026-10-23`, `created:>=2026-01-01`, and `content:"some text"`. Content scanning reads text files up to 2 MB; scan/index results are capped at 5,000. The optional indexed mode covers indexed locations and names, not all filesystem contents or the complete AQS grammar.
- In-app metadata, Windows native Properties and Open With, and in-window Windows Network/Recycle Bin listings. Restore deleted items through the Windows shell from the in-app Recycle Bin.
- Dark/light themes, persisted wallpaper/view, neutral field focus, shared menu styling, search clear, reduced-motion/high-contrast styles.

## Keyboard

Ctrl+T new tab; Ctrl+W close tab; Ctrl+Tab / Ctrl+Shift+Tab cycle tabs; Ctrl+L address; Ctrl+F search; Alt+Left/Right history; Alt+Up parent; F5 refresh; Ctrl+A select all; Ctrl+C/X/V copy/cut/paste; Ctrl+Z undo; Ctrl+Shift+N new folder; F2 rename; Delete recycle; Enter open; Alt+Enter Windows properties. Middle-click a folder for a new tab.

## Checks and limits

`npm test` covers volume labels, queries, ZIP round-trip/path checks, copy/move/cancellation, undo persistence, modified-target protection and collision handling.

`node_modules/.bin/electron.cmd . --smoke --capture` uses an isolated profile and disposable fixtures. It checks live volume names across sidebar/tab/breadcrumb, real pointer double-clicks, image decoding, search clearing, sorting, copy/paste routing, Properties, creation/undo, pins/session data and ZIP browsing/extraction. In smoke mode clipboard exchange is isolated and native file opens are recorded; `--test-native-open` additionally asks Windows to open the fixture PNG.

The Windows Search provider was queried live, native dialog exports were checked, and the Windows clipboard reader was checked. Cross-app clipboard/drag-and-drop, interactive native dialog acceptance, assistive technology, cloud placeholders, network permissions and very large directory workloads still require hands-on acceptance. Builds are unsigned. Installed builds detect stable releases from iniharith/nothing-explorer on GitHub. Settings offers download and restart/install controls; no alternate update URL is accepted.

This app does not implement Explorer's entire shell namespace/third-party shell-extension host inside its own window. Windows-only shell operations use native Windows entry points or Show in Windows Explorer. ZIP is the built-in archive format; use Open With for others. Interrupted transfer jobs can retry their remaining sources after a restart. Partial file data resumes from a verified prefix; verified transfer commits are reconciled on retry. Full undo/redo power-failure recovery remains incomplete. Originals are retained until commit and recycle. The app does not register itself as the Windows shell.

## Design

Colors/glass originated from local Shop-Co admin source and the user's screenshots. The bundled abstract wallpaper is a substitute for the original admin artwork; use Wallpaper to choose a local image. Source modules: main/preload bridge, renderer/capabilities, Windows helper, archives, transfers, query parser, settings, release updater and CSS.

## Input and rendering improvements in 0.4

The file list is virtualized, app-driven scrolling and animation updates target 60 Hz, mouse side buttons use folder history, and keyboard routing preserves text-editing shortcuts. See PERFORMANCE.md for the implementation and measurement limits.


## Version 0.5

Settings includes animation levels, smooth scrolling, dark/light themes, wallpaper selection/reset/visibility, frosted glass, blur and opacity. Preferences persist in the local app profile. Your Windows reduced-motion setting takes precedence.

Bulk rename previews numbered names while retaining file extensions, rejects collisions, stages name swaps and supports group undo. Active transfers can pause, resume or cancel.

Tools provides Windows-native permissions, Previous Versions, printing/sharing, PowerShell, shortcuts, network mapping/disconnect, eject and shell locations. These use installed Windows handlers; see [PARITY.md](PARITY.md) for the exact remaining gaps. Full Explorer parity is not claimed.

Created by [INIHARITH](https://iniharith.github.io/).

## GitHub Releases and updates

Install the NSIS setup from [GitHub Releases](https://github.com/iniharith/nothing-explorer/releases). Keep the portable folder together if running it without installation; automatic install replacement is supported for installed NSIS builds.

The app checks the fixed public GitHub repository 15 seconds after startup and every six hours. It accepts stable newer releases only, does not downgrade, and requires an explicit download and restart. The sidebar Settings button marks available updates. Update downloads are verified by electron-updater against release checksums. Unsigned builds do not provide Authenticode publisher verification.

To release: change the package/lock version together, commit, create the matching `vX.Y.Z` tag and push it. The Windows GitHub Actions workflow runs tests, builds the NSIS installer and updater metadata, runs packaged smoke, then publishes the installer, blockmap and latest.yml. Never publish latest.yml without its matching installer. The updater follows the compiled repository only, following the [electron-builder update workflow](https://www.electron.build/docs/features/auto-update/).

## Version 0.6 — parity expansion

- Original gold/charcoal frosted folder icon, with dotted N branding and SVG/PNG/ICO sources.
- This PC, Recycle Bin, Libraries, Network and Printers browse in the existing app window through Windows shell identities. Recycle Bin items expose restore and permanent-delete commands. Windows actions lists verbs exposed by installed shell handlers. This is not full IContextMenu2/3 hosting.
- Persistent redo (Ctrl+Y / Ctrl+Shift+Z), including group rename. Recovery copies stay in the app profile and later edits/collisions stop undo or redo.
- Persisted interrupted transfer jobs offer Retry remaining. Existing recorded commits are retained. Native collision prompts offer Cancel, Skip existing and Keep both with numbered names; replacement and directory merging remain outstanding.
- Group by type/name/month/size, configurable detail columns, compact rows, file-extension visibility and four icon sizes, retaining a bounded virtual viewport.

`npm run icon` regenerates the PNG from the editable SVG. The ICO includes 16–256 px entries. See PARITY.md for the remaining implementation and acceptance gaps.

## Third-party archive engine

The app bundles a pinned 7-Zip engine and its corresponding source/license files. See [THIRD_PARTY.md](THIRD_PARTY.md) for provenance, licensing and installed source locations. No archive engine is downloaded independently at runtime.

## Explorer workflow controls

Middle-click a folder or sidebar location to open it in a new tab. Right-click Quick Access locations for pin/unpin, new tab/window and properties; the main-view menu also includes folder pinning. Settings > Appearance chooses Home, This PC or previous tabs for startup. New tabs open Home or This PC rather than copying the active folder.

The status bar includes selected-file bytes and Details/Large-icons buttons. Ctrl+Shift+6 and Ctrl+Shift+2 switch those views; Alt+D and Ctrl+L focus the address, Ctrl+E and Ctrl+F focus search. Still images open in the built-in viewer, with previous/next, fit, zoom and Open with. Format support depends on the decoder and installed Windows codecs.

Version 0.8.3 adds wheel zoom, image panning, fit/100% double-click and Left/Right navigation across folder images regardless of a filename filter. HEIC/HEIF decode locally with a bundled decoder; sharp and ImageMagick provide additional formats in bounded worker threads. Properties opens an in-app details dialog and offers the Windows sheet. This PC includes used/free/total space and low-space indicators. Proprietary variants, corrupt files and complete animation/multipage/HDR support remain acceptance gaps.

Version 0.8.4 requests larger Windows shell icons, displays larger thumbnails and wraps filenames. A fitted image loads first, with high-resolution detail on zoom; reusable workers and a local thumbnail cache speed repeat visits. The selected sort field and direction persist across launches.

Version 0.8.5 centers wrapped filenames under their icons in grid view.
