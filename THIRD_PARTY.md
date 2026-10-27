# Third-party components

## 7-Zip 26.05

Archive decoding includes unmodified 7z.exe and 7z.dll, Copyright (C) 1999-2026 Igor Pavlov, from the official [7-Zip release](https://github.com/ip7z/7zip/releases/tag/26.05). The engine is distributed under GNU LGPL terms and the BSD/unRAR terms listed in its upstream license.

The distributed vendor/7zip folder contains License.txt, the full LGPL text, pinned file hashes, provenance and the complete corresponding upstream source archive 7z2605-src.tar.xz. In an installed build these are under resources/app.asar.unpacked/vendor/7zip. The binaries and source archive are unmodified. The app does not download or update this engine independently at runtime.

Upstream project and source: https://www.7-zip.org/

## Test fixtures

The RAR regression fixtures come from libarchive/libarchive and are used only by the test suite. Their source commit, filenames and upstream license are recorded in test/fixtures. They are not included in the packaged application.

## Image decoding

- heic-decode 2.1.0 (ISC): https://github.com/catdad-experiments/heic-decode
- libheif-js 1.23.5 (LGPL-3.0): https://github.com/catdad-experiments/libheif-js; corresponding engine/build sources: https://github.com/catdad-experiments/libheif-emscripten and https://github.com/strukturag/libheif/tree/v1.23.5
- sharp 0.35.5 (Apache-2.0), libvips 8.18.7 (LGPL-2.1-or-later) and its bundled image libraries: https://github.com/lovell/sharp and https://github.com/libvips/libvips/tree/v8.18.7. The installed npm packages include upstream license notices; libvips build recipes/source dependencies: https://github.com/lovell/sharp-libvips.
- @imagemagick/magick-wasm 0.0.45 (Apache-2.0): https://github.com/dlemstra/magick-wasm/tree/0.0.45. Upstream LICENSE and NOTICE are distributed with the package.

These decoders run locally; image data is not uploaded. Libraries are unmodified and pinned by the package lock. HEIC diagnostic image provenance and its MIT COPYING are retained in assets/fixtures/images.
