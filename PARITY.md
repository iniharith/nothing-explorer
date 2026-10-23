# Explorer capability audit — 0.5.0

This is a working file manager, not a complete reimplementation of Windows Explorer. “Native” below means the command opens a Windows interface; it does not run inside this app.

| Area | Implemented | Remaining |
| --- | --- | --- |
| Navigation | Tabs, history, breadcrumbs, typed local/UNC paths, native volume labels, pins, saved session, keyboard and mouse history | Tab tear-off and full shell namespace hosting |
| Folder contents | Virtualized details/grid, sorting, hidden items, selection, thumbnails, image/text previews, file association opening | Grouping, configurable columns, additional view sizes, native preview-handler hosting |
| File operations | Copy, cut, paste, rename, folder/text creation, recycle, transfer progress, cancellation, pause/resume, verified persistent undo | Redo, crash-resumable jobs, collision merge/replace dialog, link/ACL/alternate-stream preservation |
| Bulk rename | Numbered names, extension preservation, full preview, collision checks, grouped undo | General pattern and metadata-based renaming |
| Clipboard and drag/drop | Windows file clipboard, drag-out, copy-on-drop | Complete COM IDataObject/IDropTarget parity, virtual-file drops, all modifier-driven drop actions |
| Search | Folder filtering, recursive scanning, optional Windows indexed names, bounded text content queries | Complete AQS/property-store/indexed-content integration |
| Archives | ZIP browse/create/extract with traversal and CRC protection | Encrypted ZIP, in-window 7z/RAR/TAR editing |
| Native tools | Properties, Open With, permissions, Previous Versions, print/share handlers, terminal, desktop shortcut, network mapping/disconnect, eject, folder options | Native tool acceptance depends on Windows version, installed handlers, device and permissions |
| Shell locations | Native This PC, Network, Recycle Bin, Libraries, Recent, Control Panel, Printers | In-window MTP, WSL, cloud-provider namespaces, shell extensions, Recycle Bin restore/delete UI |
| Appearance | Dark/light, wallpaper picker/reset/show, glass toggle/blur/opacity, motion levels, smooth scroll toggle, reduced-motion support | Full accessibility acceptance and high-DPI/multi-monitor hardware matrix |
| Distribution | Public GitHub release feed, stable version detection, explicit download/restart, checksums, NSIS build, tag-based CI release | Authenticode signing; upgrade installation still needs acceptance across machines |

The app retains native Explorer entry points for unsupported shell operations. Nothing Explorer does not register itself as the Windows system shell.

## Validation

Automated tests cover filesystem safety, ZIPs, queries, drive labels, undo, bulk rename and pause/cancel, appearance normalization, fixed update source, and the 60 Hz scheduler. Packaged desktop smoke checks real pointer/keyboard routing, previews, file operations, settings persistence and a 50,000-item viewport. Native tools that would print, share, eject or modify network configuration are not invoked automatically by tests.
