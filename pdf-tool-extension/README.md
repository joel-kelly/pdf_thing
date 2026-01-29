# PDF Tool - Firefox Browser Extension

A Firefox browser extension for PDF manipulation with page management, secure redaction, and signature insertion. All processing happens locally in your browser for maximum privacy.

## Features

### Page Management
- **Rotate pages** - 90° clockwise rotation
- **Delete pages** - Remove unwanted pages
- **Reorder pages** - Drag and drop to rearrange
- **Extract pages** - Save selected pages as a new PDF
- **Merge PDFs** - Combine multiple PDF files
- **Split PDF** - Export each page as a separate file

### Secure Redaction
- Draw redaction boxes over sensitive content
- Pages are converted to high-resolution images with black boxes
- Original text content is completely removed (not just hidden)
- Ideal for redacting credit card numbers, SSNs, etc.

### Signature Insertion
- Upload and save signature images (PNG/JPEG)
- Drag to position signatures on any page
- Resize and rotate signatures
- Optional timestamp below signature
- Manage a library of saved signatures

## Installation

### Prerequisites

Before installing, download the required libraries:

1. **PDF-lib** (v1.17.1+)
   ```bash
   curl -L -o libs/pdf-lib.min.js "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"
   ```

2. **PDF.js** (v4.0+)
   ```bash
   curl -L -o libs/pdf.min.mjs "https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.min.mjs"
   curl -L -o libs/pdf.worker.min.mjs "https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs"
   ```

### Loading in Firefox

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the sidebar
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file from this extension folder

### Permanent Installation

To install permanently:
1. Package the extension as a `.zip` file
2. Rename to `.xpi`
3. Submit to Firefox Add-ons or self-sign for personal use

## Usage

### Basic Workflow

1. Click the extension icon to open the popup
2. Drag and drop a PDF or click to upload
3. Choose a mode:
   - **Pages**: Manage page order, rotate, delete
   - **Redact**: Draw boxes over sensitive content
   - **Sign**: Add signatures to pages
4. Download the modified PDF

### Redaction Tips

- Draw boxes by clicking and dragging on the page
- Right-click a box to remove it
- Redacted pages become images (text not selectable)
- Always verify redaction by opening the final PDF

### Signature Tips

- Use PNG format with transparent background for best results
- Signatures are stored in browser local storage
- Maximum 10 signatures can be saved
- Timestamp shows date/time when placed

## Privacy & Security

- **100% Local Processing**: All PDF operations happen in your browser
- **No Server Communication**: No data is uploaded or sent anywhere
- **No Analytics**: No tracking or telemetry
- **Secure Redaction**: Content is truly removed, not just hidden

## Technical Details

### Libraries Used
- [PDF-lib](https://pdf-lib.js.org/) - PDF manipulation
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF rendering

### Browser APIs
- `browser.storage.local` - Signature storage
- `Canvas API` - PDF rendering and image manipulation
- `FileReader API` - File handling
- `Blob API` - PDF export

### File Structure
```
pdf-tool-extension/
├── manifest.json          # Extension manifest
├── popup/
│   ├── popup.html        # Main UI
│   ├── popup.css         # Styles
│   └── popup.js          # Main application logic
├── src/
│   ├── file-handler.js   # File I/O operations
│   ├── pdf-operations.js # PDF manipulation
│   ├── signature-manager.js # Signature storage
│   ├── redaction.js      # Secure redaction
│   └── ui-handler.js     # UI rendering
├── libs/                  # Third-party libraries
└── icons/                 # Extension icons
```

## Limitations

- Maximum file size: 50MB
- Password-protected PDFs: Not supported
- Very large PDFs may be slow to process
- Redacted pages lose text selectability

## License

MIT License - Free to use, modify, and distribute.

## Contributing

Contributions welcome! Please open an issue or pull request.
