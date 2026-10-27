# Third-party components

## 7-Zip 26.05

Archive decoding includes unmodified 7z.exe and 7z.dll, Copyright (C) 1999-2026 Igor Pavlov, from the official [7-Zip release](https://github.com/ip7z/7zip/releases/tag/26.05). The engine is distributed under GNU LGPL terms and the BSD/unRAR terms listed in its upstream license.

The distributed vendor/7zip folder contains License.txt, the full LGPL text, pinned file hashes, provenance and the complete corresponding upstream source archive 7z2605-src.tar.xz. In an installed build these are under resources/app.asar.unpacked/vendor/7zip. The binaries and source archive are unmodified. The app does not download or update this engine independently at runtime.

Upstream project and source: https://www.7-zip.org/

## Test fixtures

The RAR regression fixtures come from libarchive/libarchive and are used only by the test suite. Their source commit, filenames and upstream license are recorded in test/fixtures. They are not included in the packaged application.
