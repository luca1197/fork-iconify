# Iconify — Project Guidelines

## Overview

A static, no-build, single-page web app that converts SVG files to trimmed/recolored/resized PNGs in the browser. All logic lives in [`iconify.js`](../iconify.js). No server, no framework, no bundler.

## Architecture

| File | Role |
|------|------|
| `index.html` | UI markup; uses inline event handlers (`onsubmit`, `onchange`) |
| `iconify.js` | All app logic — SVG parsing, canvas rendering, ZIP creation |
| `style.css` | Styling (vanilla CSS, no preprocessor) |
| `base64.js` | `base64DecToArr()` helper for PNG Blob creation |
| `jszip/` | Vendored JSZip — use `dist/jszip.min.js` |
| `FileSaver.js/` | Vendored FileSaver — use `FileSaver.js/src/FileSaver.js` |

**Core pipeline** (`render()` in `iconify.js`):
1. `FileReader` reads SVG as binary string
2. `DOMParser` parses SVG; it's temporarily appended to `document.body` to call `getBBox()` for tight bounding-box trimming
3. `viewBox` is set to trimmed bounds; width/height/fill attributes applied
4. SVG Blob → `<img>` → `<canvas>` → `canvas.toDataURL()` → base64 PNG
5. Single file: `saveAs()` directly; multiple files/manifest: accumulated into JSZip then saved

## Code Style

- **Vanilla ES6+**: `const`/`let`, arrow functions, `async/await`, template literals — no modules, no bundler
- **camelCase** for functions and variables; `UPPER_SNAKE_CASE` for regex constants
- Vendor libraries are static, committed files — do not `npm install` at the root

## Key Conventions

- The hidden `<canvas id="render">` is **reused** across renders; always `clearRect` before drawing
- `render()` returns a raw base64 string (data URL prefix stripped); callers are responsible for decoding/saving
- The `manifest` object is mutated inside `render()` — pass `null` when no manifest is needed
- `recolorSVG()` identifies fill-able elements via `isPointInFill`; it does **not** handle stroke-only or `fill="none"` elements
- Loop in `iconifyZIP` is intentionally **sequential** (`for` + `await`) because the canvas is shared state

## Known Issues / Gotchas

- `var bbox` is declared twice in `render()` — be careful not to rely on the first value after the manifest block
- No error handling for invalid SVGs or zero-size bounding boxes — failures are silent
- `document.body.appendChild(svg)` / `svg.remove()` must always be paired to avoid DOM leaks
