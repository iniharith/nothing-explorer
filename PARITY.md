# Explorer capability audit — 0.6.2

This is a working file manager, not a complete reimplementation of Windows Explorer. “Native” below means the command opens a Windows interface; it does not run inside this app.

| Area | Implemented | Remaining |
| --- | --- | --- |
| Navigation | Tabs, history, breadcrumbs, typed local/UNC paths, native volume labels, pins, saved session, keyboard and mouse history | Tab tear-off and full shell namespace hosting |
| Folder contents | Virtualized details/grid, grouping, selectable detail columns, compact rows, four icon sizes, extensions toggle, sorting, hidden items, selection, thumbnails, image/text previews, file association opening | Column reordering/resizing, native preview-handler hosting |
| File operations | Copy, cut, paste, rename, folder/text creation, recycle, transfer progress, cancellation, pause/resume, verified persistent undo/redo, interrupted-job retry, collision skip/keep-both choices | Byte-offset crash resume, transactional crash recovery around commit/undo, folder merge/file replace, link/ACL/alternate-stream preservation |
| Bulk rename | Numbered names, extension preservation, full preview, collision checks, grouped undo | General pattern and metadata-based renaming |
| Clipboard and drag/drop | Windows file clipboard, drag-out, copy-on-drop | Complete COM IDataObject/IDropTarget parity, virtual-file drops, all modifier-driven drop actions |
| Search | Folder filtering, recursive scanning, optional Windows indexed names, bounded text content queries | Complete AQS/property-store/indexed-content integration |
| Archives | ZIP browse/create/extract with traversal and CRC protection | Encrypted ZIP, in-window 7z/RAR/TAR editing |
| Native tools | Properties, Open With, permissions, Previous Versions, print/share handlers, terminal, desktop shortcut, network mapping/disconnect, eject, folder options | Native tool acceptance depends on Windows version, installed handlers, device and permissions |
| Shell locations | In-window Shell.Application namespace navigation for This PC, Network, Recycle Bin, Libraries, Printers and reachable child namespaces; restore/delete verbs and installed Windows action menus | Full IContextMenu2/3 extension hosting, virtual-file copy/drop, device/cloud-provider acceptance; Recent/Control Panel remain native entry points |
| Appearance | Dark/light, wallpaper picker/reset/show, glass toggle/blur/opacity, motion levels, smooth scroll toggle, reduced-motion support | Full accessibility acceptance and high-DPI/multi-monitor hardware matrix |
| Distribution | Public GitHub release feed, stable version detection, explicit download/restart, checksums, NSIS build, tag-based CI release | Authenticode signing; upgrade installation still needs acceptance across machines |

The app retains native Explorer entry points for unsupported shell operations. Nothing Explorer does not register itself as the Windows system shell.

## Validation

Automated tests cover filesystem safety, ZIPs, queries, drive labels, undo, bulk rename and pause/cancel, appearance normalization, fixed update source, and the 60 Hz scheduler. Packaged desktop smoke checks real pointer/keyboard routing, previews, file operations, settings persistence and a 50,000-item viewport. Native tools that would print, share, eject or modify network configuration are not invoked automatically by tests.

## 0.6 safety and acceptance details

The app icon is original SVG artwork inspired by the familiar folder silhouette, with gold and charcoal glass surfaces and a dotted N mark. PNG and multi-size ICO exports are included; `scripts/render-icon.cjs` renders the SVG with Chromium.

Undo/redo recovery copies are stored in the app profile, not hidden among the user's folder contents. Starting a new operation invalidates redo and sends obsolete recovery copies to Windows Recycle Bin. Rename, bulk rename, create, copy and move redo check for later edits and collisions. Successful undo/redo history persists across restarts. Whole-operation transactional recovery during a power failure is not complete.

Transfer jobs persist their source list and committed source list. After a restart, interrupted jobs wait for **Retry remaining**. Committed sources are skipped, and known partial staging data is removed only when the user retries with sources still present. Interrupted files restart from byte zero. If a crash occurs between filesystem commit and journal save, an existing destination stops retry rather than overwriting it; manual reconciliation is still necessary.

Native recycle/restore was tested using a disposable uniquely named fixture. Enumeration of the existing Recycle Bin was read-only. Windows confirms permanent deletion through its own shell verb. Device/provider transfers and shell-extension submenu hosting are not claimed complete.
