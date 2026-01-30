# CLAUDE.md

## Project Overview

This is a **Firefox browser extension** for PDF manipulation with three core features:
- **Page Management** - Rotate, delete, reorder, extract, merge, split pages
- **Secure Redaction** - Draw boxes over sensitive content, permanently removes by converting to images
- **Digital Signatures** - Save signature images, place on pages with optional timestamps

**Privacy Focus**: All processing happens locally in the browser. No server uploads, no analytics, no tracking.

## Project Structure

```
pdf-tool-extension/           # Main extension directory
├── manifest.json             # Firefox extension manifest (v2)
├── popup/
│   ├── popup.html           # Main UI layout
│   ├── popup.css            # Styling
│   ├── popup.js             # Main orchestration & state management
│   └── pdf-init.js          # PDF.js worker initialization
├── src/
│   ├── viewer.js            # Continuous scroll PDF viewer with zoom
│   ├── tools-panel.js       # Right sidebar with accordion tool groups
│   ├── file-handler.js      # File upload, validation, export
│   ├── pdf-operations.js    # Core PDF manipulation (PDF-lib)
│   ├── redaction.js         # Secure page-to-image redaction
│   ├── signature-manager.js # Signature storage & insertion
│   └── ui-handler.js        # UI utilities (loading overlay)
├── background/
│   └── background.js        # Opens extension in new tab
├── libs/                    # Third-party libraries (manually downloaded)
│   ├── pdf-lib.min.js      # PDF manipulation
│   ├── pdf.min.mjs         # PDF.js rendering
│   └── pdf.worker.min.mjs  # PDF.js worker
└── icons/                   # Extension icons
```

## Technologies

- **PDF-lib** (v1.17+) - PDF document manipulation
- **PDF.js** (v4.0+) - PDF rendering and visualization
- **Firefox WebExtensions API** - Browser extension framework
- **Canvas API** - Rendering, redaction, image manipulation
- **ES6+ JavaScript** - Modern syntax, async/await, modules

## Development Workflow

### Loading the Extension (Development)
1. Open `about:debugging` in Firefox
2. Click "This Firefox" in sidebar
3. Click "Load Temporary Add-on"
4. Select `pdf-tool-extension/manifest.json`

### Debugging
- Open extension popup, then F12 for DevTools
- Console logs visible in about:debugging console

### No Build Process
This is a pure browser extension - no npm, webpack, or build step needed.

### Download Libraries (if missing)
```bash
cd pdf-tool-extension/libs
curl -L -o pdf-lib.min.js "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"
curl -L -o pdf.min.mjs "https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.min.mjs"
curl -L -o pdf.worker.min.mjs "https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs"
```

## Key Patterns & Conventions

### Module Pattern
All modules use IIFE with strict mode, exposed to `window`:
```javascript
(function() {
    'use strict';
    window.ModuleName = { /* exports */ };
})();
```

### State Management
Central state object in `popup.js`:
```javascript
var state = {
    pdfDoc: null,        // PDF-lib document
    pdfJsDoc: null,      // PDF.js document
    pdfData: null,       // Raw PDF bytes
    fileName: 'document.pdf',
    selectedSignature: null
};
```

### Coordinate Systems
- **PDF coordinates**: Origin at bottom-left, units in points (1/72 inch)
- **Canvas coordinates**: Origin at top-left, units in pixels
- Always convert between systems when placing signatures/redactions

### Module Communication
Callback-based - pass callbacks during initialization, call through `window.ModuleName.method()`

### Error Handling
- Validate files before processing (type, size limits)
- Try-catch around async operations
- Show loading overlay for long operations

## Important Files

| File | Purpose |
|------|---------|
| `popup/popup.js` | Main orchestration, state, event wiring (819 lines) |
| `src/viewer.js` | Continuous scroll viewer, zoom, lazy loading (821 lines) |
| `src/tools-panel.js` | Right sidebar, accordion tools (656 lines) |
| `src/pdf-operations.js` | All PDF manipulation logic (235 lines) |
| `src/redaction.js` | Secure redaction with RENDER_SCALE=2.5 (137 lines) |

## Limitations

- Max 50MB file size
- No password-protected PDF support
- Redacted pages lose text selectability (by design - security feature)
- Large PDFs (100+ pages) may be slow

## Common Tasks

### Adding a New Tool
1. Add UI in `tools-panel.js` within appropriate accordion section
2. Add handler in `popup.js` that calls appropriate module
3. Wire up callback in initialization

### Modifying PDF Operations
All PDF manipulation is in `src/pdf-operations.js` using PDF-lib

### Changing Viewer Behavior
Modify `src/viewer.js` - handles rendering, zoom, scroll, page tracking

### Styling Changes
Edit `popup/popup.css` - uses CSS variables for theming

## Testing

Test with various PDFs:
- Single page, 10 pages, 50+ pages
- Different page sizes (letter, A4, legal)
- PDFs with images vs text-only
- Large file sizes near 50MB limit
