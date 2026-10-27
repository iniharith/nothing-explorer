# Nothing Explorer completion plan

The objective remains full Explorer-style functionality, navigation and interaction without awkward workarounds, preserving the frosted-glass theme, original icon and INIHARITH credit. PARITY.md records the current implementation and acceptance limits. A release milestone does not complete this objective.

## Published milestone

The published 0.7.0 release adds merge/replace with recovery copies, prefix-verified interrupted-file resume, verified-commit reconciliation, Windows stream/permission/timestamp preservation, configurable columns, rename patterns and Explorer drop modifiers. Same-folder moves do nothing, copies receive vacant numbered names, and shortcut groups persist through Undo/Redo. The native-pane prototype is disabled in normal builds and cannot hide the glass file list on startup failure.

Thirty-three automated tests and local packaged desktop checks pass. Branch Windows CI 40452297772 passed. Tagged Windows CI 40452523216 also passed, published the stable release, and the packaged 0.6.2 app detected 0.7.0 through the fixed GitHub feed. Installation across additional machines remains unverified.

## Remaining completion gates

- File operations: exercise copy/move/merge/replace/cancel/resume across real volumes, UNC permissions, links and cloud/device providers; retain streams and supported filesystem metadata. Complete recoverable undo/redo transactions through process termination at each filesystem/journal boundary. Preserve edits and collision protection during recovery.
- Clipboard and drop: physical cross-application file and virtual-file transfers in both directions, modifiers/cursor feedback, mixed-volume operations, right-button choices, cancelled drops and cut-clipboard reconciliation. Retain data on partial failure.
- Navigation and windows: reorder/close/reopen/tear off tabs, multiple windows, per-tab selection/search/scroll/history, familiar keyboard and mouse behavior with the address/search fields and dialogs focused.
- Windows shell: visibly accepted embedded navigation and native context-menu/preview handlers, full extension/submenu hosting, namespace commands and virtual files. Validate keyboard focus, item selection, accessibility and device/provider behavior before enabling the prototype.
- Contents and preview: native preview handlers, folder view conventions, metadata columns/properties and large mixed-media folders; verify memory bounds and thumbnails on installed handlers.
- Search: complete AQS/property/indexed-content behavior and Explorer-compatible scopes, plus cancellable fallback scanning.
- Archives: broader Windows-supported formats, encrypted archives where supported, and familiar archive navigation/editing, with traversal/link/collision protection and cancellation.
- Appearance and performance: retain the existing design while verifying keyboard focus, assistive technology, reduced motion, high contrast, DPI/multiple monitors and actual desktop presentation. The app update target remains 60 Hz; do not equate scheduler cadence with universal GPU frame rate.
- Distribution: validate each tagged packaged build, fixed GitHub stable feed detection/download and upgrade behavior. Authenticode signing and acceptance on additional machines remain open.

## Required evidence before declaring completion

Every requirement needs matching implementation and meaningful tests, plus real native/UI/provider acceptance where simulation cannot establish behavior. A passing fixture or API enumeration alone does not prove an entire Windows integration. Keep remaining and unverified items visible in PARITY.md; do not mark the persistent goal complete until all completion gates are satisfied.
