# Nothing Explorer capability audit — 0.5.0

## Delivered

- Explorer-style compact chrome and frosted-glass design; both themes and wallpaper.
- Native disk names (STRIX F: verified), capacities, removable media state, known folders, drive paths/UNC navigation.
- Tabs/history/breadcrumbs; pinned folders and saved session; sorting, grid/details and selection commands.
- Real file/folder double-click; native file associations; image thumbnails/previews and Windows icons.
- Windows clipboard bridge and drag-and-drop; new folders/text, rename, recycle, native Properties/Open With.
- File transfer queue, byte progress, cancellation, collision rejection, cross-volume support, persistent protected undo.
- ZIP browse/compress/extract with path checks and checksum verification.
- Filters, cancellable recursive search, optional Windows indexed name search.
- Native Windows Network and Recycle Bin entry points; Show in Windows Explorer for other shell operations.
- Portable folder and NSIS installer.

## Verified

Fourteen automated tests pass. Desktop smoke tests check actual click pairs, decoded preview/thumbnail dimensions, live Windows drive labels in three UI surfaces, file operations, undo, pins/session state and archive flows. Windows indexed search returned results on this PC. Native dialog exports and clipboard reader were checked. Final packaged smoke is required for every release.

## Boundaries and acceptance still outstanding

- Full in-window Windows shell namespace and third-party context-menu extension hosting; shell-only tools use native Windows entry points.
- Complete AQS grammar, indexed content queries, non-ZIP archive formats, and encrypted ZIPs.
- Restart-resume for interrupted transfer jobs. Successful operation history persists; in-flight work does not resume automatically. Source data is retained until a completed move is recycled.
- Hands-on cross-app drag/drop and clipboard, Properties/Open With UI, network mapping/permissions, device hotplug, cloud placeholders, assistive technology and extreme directory sizes.
- Authenticode signing remains unconfigured. GitHub release updates are implemented; installed upgrade acceptance across machines remains.

This audit distinguishes implementation and tests from native desktop acceptance. It is not a claim of full Windows Explorer parity.

## 0.4 input and performance

Native keyboard/mouse routing, virtualized file rows, a shared 60 Hz app update clock, cached wallpaper blur, and restrained control/menu transitions are implemented. Additional desktop input/performance checks use a 50,000-entry fixture. See PERFORMANCE.md for the distinction between app cadence and desktop presentation.


## 0.5 expansion

Appearance settings, creator credit, a fixed GitHub release feed, release CI, native shell tools, previewed bulk rename with grouped undo and transfer pause/resume are implemented. See PARITY.md for the complete capability matrix and remaining scope.
