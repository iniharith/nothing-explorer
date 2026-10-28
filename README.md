# Nothing Explorer

A Windows file manager with tabs, familiar Explorer controls, and a frosted-glass look.

## Download

Download **Nothing Explorer Setup** from the [latest release](https://github.com/iniharith/nothing-explorer/releases/latest), then run the installer. Open Settings in the app to check for updates, download them, and restart to install.

The app is still being developed. Some Windows Explorer features and shell extensions are not yet available; see [PARITY.md](PARITY.md) for details. Windows may warn that the installer is unsigned.

## What you can do

- Browse folders and drives in tabs, pin favorite folders, and choose your startup page.
- Search, sort, select, copy, move, rename, and delete files. Use Undo for supported operations.
- View image thumbnails and open pictures in the built-in viewer, with zoom and previous/next controls.
- Browse and create ZIP archives, and extract supported archive formats.
- Change the wallpaper, glass effect, animation, and other appearance settings.

File support can depend on Windows codecs and installed applications. Use Windows Explorer for shell features that are not yet available here.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| New or close tab | Ctrl+T / Ctrl+W |
| Switch tabs | Ctrl+Tab / Ctrl+Shift+Tab |
| Address or search | Ctrl+L / Ctrl+F |
| Back, forward, or up | Alt+Left / Alt+Right / Alt+Up |
| New folder or rename | Ctrl+Shift+N / F2 |
| Select all | Ctrl+A |
| Copy, cut, or paste | Ctrl+C / Ctrl+X / Ctrl+V |
| Undo or redo | Ctrl+Z / Ctrl+Y |
| Refresh or properties | F5 / Alt+Enter |

Middle-click a folder to open it in a new tab. Drag from empty space in the file list to select items.

## Build from source

Requires Node.js and Windows.

```powershell
npm install
npm start
npm test
npm run installer
```

The installer is created in `release/`. For the portable build, run `npm run package` and keep the contents of `release/win-unpacked/` together.

The app checks for stable releases from this repository. Updates require you to choose download and restart. For bundled software licenses, see [THIRD_PARTY.md](THIRD_PARTY.md).

Created by [INIHARITH](https://iniharith.github.io/).
