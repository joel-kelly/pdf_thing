# PDF Tool Browser Extension - Implementation Plan

## Project Overview
A Firefox browser extension for PDF manipulation with focus on page management, secure redaction, and signature insertion (primarily for expense claims with credit card info and document signing).

**Key Use Case:** Redact sensitive information (like credit card numbers) and add visual signatures with timestamps to expense reports - all processed locally in the browser for privacy.

## Core Features

### 1. Page Management
- Rotate pages (90°, 180°, 270°)
- Delete pages
- Reorder pages (drag and drop)
- Extract pages to new PDF
- Merge multiple PDFs
- Split PDF into separate files

### 2. Secure Redaction
- Draw redaction boxes on PDF
- Render affected pages to high-resolution images
- Replace original pages with image-based pages
- Ensure redacted content is truly removed

### 3. Signature Insertion
- Upload and save signature images (signature + initials)
- Insert saved signatures into PDFs
- Drag to position signature on page
- Resize and rotate signature
- Add timestamp text near signature
- Manage saved signature library

## Technical Stack

### Required Libraries
- **PDF-lib** (v1.17+): Core PDF manipulation
  - Download: https://github.com/Hopding/pdf-lib/releases
  - Used for: Page operations, PDF structure manipulation, final assembly, image insertion

- **PDF.js** (Mozilla): PDF rendering and viewing
  - Download: https://github.com/mozilla/pdf.js/releases
  - Used for: Rendering PDFs in the UI, converting pages to images

### Browser APIs
- **browser.storage.local**: Store signature images persistently
- **FileReader API**: Read uploaded PDF and image files
- **Canvas API**: Render PDFs, manipulate images, draw UI elements
- **Blob API**: Create downloadable PDF files

### Firefox Extension Structure
```
pdf-tool-extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   └── content.js (if needed for page integration)
├── background/
│   └── background.js
├── libs/
│   ├── pdf-lib.min.js
│   ├── pdf.js
│   └── pdf.worker.js
├── icons/
│   ├── icon-48.png
│   └── icon-96.png
└── src/
    ├── pdf-operations.js
    ├── redaction.js
    ├── signature-manager.js
    ├── ui-handler.js
    └── file-handler.js
```

## Implementation Phases

### Phase 1: Extension Setup & File Loading

#### manifest.json
```json
{
  "manifest_version": 2,
  "name": "PDF Tool",
  "version": "1.0.0",
  "description": "Free PDF page management, secure redaction, and signature insertion",
  "permissions": [
    "activeTab",
    "storage"
  ],
  "browser_action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "48": "icons/icon-48.png",
      "96": "icons/icon-96.png"
    }
  },
  "icons": {
    "48": "icons/icon-48.png",
    "96": "icons/icon-96.png"
  }
}
```

#### File Handler (file-handler.js)
**Purpose**: Handle PDF file uploads and manage file state

**Key Functions**:
- `loadPDFFile(file)`: Load PDF from file input
- `validatePDF(file)`: Check file is valid PDF and under size limit (suggest 50MB max)
- `storePDFData(arrayBuffer)`: Store PDF data in memory
- `exportPDF(pdfDoc, filename)`: Download processed PDF

**Implementation Notes**:
- Use FileReader API to read PDF as ArrayBuffer
- Store in memory (don't persist to extension storage due to size limits)
- Handle errors gracefully with user-friendly messages

### Phase 2: PDF Viewing & Preview

#### UI Handler (ui-handler.js)
**Purpose**: Render PDF pages and manage UI state

**Key Functions**:
- `renderPDFPreview(pdfData)`: Display all pages as thumbnails
- `renderFullPage(pageNum)`: Show selected page in detail
- `updatePageThumbnail(pageNum, imageData)`: Update thumbnail after changes
- `enableDragAndDrop()`: Allow page reordering

**Implementation with PDF.js**:
```javascript
// Pseudo-code structure
async function renderPDFPreview(pdfData) {
  const loadingTask = pdfjsLib.getDocument({data: pdfData});
  const pdf = await loadingTask.promise;
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({scale: 0.5}); // Thumbnail scale
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({canvasContext: context, viewport: viewport}).promise;
    
    // Add canvas to UI with page controls
    addPageToUI(canvas, pageNum);
  }
}
```

**UI Elements Needed**:
- File upload area (drag-drop or button)
- Page thumbnail grid (scrollable)
- Page controls (rotate, delete buttons on each thumbnail)
- Selected page viewer (larger view for redaction)
- Action buttons (merge, split, extract, download)

### Phase 4: Page Management Operations

#### PDF Operations (pdf-operations.js)
**Purpose**: Core PDF manipulation functions using PDF-lib

**Key Functions**:

**Rotate Pages**:
```javascript
async function rotatePage(pdfDoc, pageIndex, degrees) {
  const page = pdfDoc.getPage(pageIndex);
  const currentRotation = page.getRotation().angle;
  page.setRotation(degrees: currentRotation + degrees);
  return pdfDoc;
}
```

**Delete Pages**:
```javascript
async function deletePages(pdfDoc, pageIndices) {
  // Sort in reverse to avoid index shifting issues
  const sortedIndices = pageIndices.sort((a, b) => b - a);
  for (const index of sortedIndices) {
    pdfDoc.removePage(index);
  }
  return pdfDoc;
}
```

**Reorder Pages**:
```javascript
async function reorderPages(pdfDoc, newOrder) {
  // newOrder is array like [2, 0, 1] meaning page 3 first, then page 1, then page 2
  const pages = pdfDoc.getPages();
  const copiedPages = [];
  
  // Create new PDF with pages in new order
  const newPdfDoc = await PDFLib.PDFDocument.create();
  
  for (const oldIndex of newOrder) {
    const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [oldIndex]);
    newPdfDoc.addPage(copiedPage);
  }
  
  return newPdfDoc;
}
```

**Extract Pages**:
```javascript
async function extractPages(pdfDoc, pageIndices) {
  const newPdfDoc = await PDFLib.PDFDocument.create();
  const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
  copiedPages.forEach(page => newPdfDoc.addPage(page));
  return newPdfDoc;
}
```

**Merge PDFs**:
```javascript
async function mergePDFs(pdfDocsArray) {
  const mergedPdf = await PDFLib.PDFDocument.create();
  
  for (const pdfDoc of pdfDocsArray) {
    const pageCount = pdfDoc.getPageCount();
    const copiedPages = await mergedPdf.copyPages(pdfDoc, [...Array(pageCount).keys()]);
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }
  
  return mergedPdf;
}
```

**Split PDF**:
```javascript
async function splitPDF(pdfDoc) {
  const pageCount = pdfDoc.getPageCount();
  const individualPDFs = [];
  
  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFLib.PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);
    individualPDFs.push(newPdf);
  }
  
  return individualPDFs;
}
```

### Phase 4: Signature Management & Insertion

#### Signature Manager (signature-manager.js)
**Purpose**: Manage signature library and insert signatures into PDFs

**Data Structure in browser.storage.local**:
```javascript
{
  signatures: [
    {
      id: "sig_1234567890",
      name: "Full Signature",
      imageData: "data:image/png;base64,iVBORw0KG...",
      width: 200,      // default width in points
      height: 60,      // default height in points
      created: "2026-01-28T10:30:00Z"
    },
    {
      id: "sig_0987654321",
      name: "Initials",
      imageData: "data:image/png;base64,AB12CD...",
      width: 100,
      height: 40,
      created: "2026-01-28T10:31:00Z"
    }
  ]
}
```

**Key Functions**:

**1. Load Signatures from Storage**:
```javascript
async function loadSignatures() {
  const result = await browser.storage.local.get('signatures');
  return result.signatures || [];
}
```

**2. Save New Signature**:
```javascript
async function saveSignature(name, imageFile) {
  // Read image file as base64
  const imageData = await readFileAsDataURL(imageFile);
  
  // Get image dimensions
  const dimensions = await getImageDimensions(imageData);
  
  const signature = {
    id: `sig_${Date.now()}`,
    name: name,
    imageData: imageData,
    width: dimensions.width * 0.75, // Convert pixels to points (assuming 96 DPI)
    height: dimensions.height * 0.75,
    created: new Date().toISOString()
  };
  
  // Load existing signatures
  const signatures = await loadSignatures();
  signatures.push(signature);
  
  // Save to storage
  await browser.storage.local.set({ signatures: signatures });
  
  return signature;
}

// Helper: Read file as data URL
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: Get image dimensions
function getImageDimensions(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.src = dataURL;
  });
}
```

**3. Delete Signature**:
```javascript
async function deleteSignature(signatureId) {
  const signatures = await loadSignatures();
  const filtered = signatures.filter(sig => sig.id !== signatureId);
  await browser.storage.local.set({ signatures: filtered });
}
```

**4. Insert Signature into PDF**:
```javascript
async function insertSignatureIntoPDF(pdfDoc, pageIndex, signature, position, options = {}) {
  // position = { x, y } in points
  // options = { width, height, rotation, addTimestamp }
  
  const page = pdfDoc.getPage(pageIndex);
  
  // Convert data URL to bytes
  const imageBytes = dataURLToBytes(signature.imageData);
  
  // Determine image type and embed
  let embeddedImage;
  if (signature.imageData.includes('image/png')) {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else if (signature.imageData.includes('image/jpeg')) {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  } else {
    throw new Error('Unsupported image format. Use PNG or JPEG.');
  }
  
  // Use provided dimensions or signature defaults
  const width = options.width || signature.width;
  const height = options.height || signature.height;
  const rotation = options.rotation || 0;
  
  // Draw signature
  page.drawImage(embeddedImage, {
    x: position.x,
    y: position.y,
    width: width,
    height: height,
    rotate: PDFLib.degrees(rotation),
    opacity: options.opacity || 1.0
  });
  
  // Add timestamp if requested
  if (options.addTimestamp) {
    const timestamp = new Date().toLocaleString();
    const fontSize = 8;
    
    page.drawText(`Signed: ${timestamp}`, {
      x: position.x,
      y: position.y - 12, // Below signature
      size: fontSize,
      color: PDFLib.rgb(0.5, 0.5, 0.5)
    });
  }
  
  return pdfDoc;
}

// Helper: Convert data URL to bytes
function dataURLToBytes(dataURL) {
  const base64 = dataURL.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
```

**5. UI for Signature Placement**:
```javascript
// Enable signature placement mode
function enableSignaturePlacementMode(pageNum, signature) {
  // Show page canvas
  const canvas = document.getElementById('signature-canvas');
  const ctx = canvas.getContext('2d');
  
  // Draw signature image preview
  const img = new Image();
  img.src = signature.imageData;
  
  let signaturePosition = { x: 100, y: 100 };
  let isDragging = false;
  let isResizing = false;
  let currentWidth = signature.width;
  let currentHeight = signature.height;
  let currentRotation = 0;
  
  img.onload = () => {
    drawSignaturePreview();
  };
  
  function drawSignaturePreview() {
    // Clear canvas overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw signature at current position
    ctx.save();
    ctx.translate(signaturePosition.x + currentWidth/2, signaturePosition.y + currentHeight/2);
    ctx.rotate(currentRotation * Math.PI / 180);
    ctx.drawImage(img, -currentWidth/2, -currentHeight/2, currentWidth, currentHeight);
    ctx.restore();
    
    // Draw resize handle
    ctx.fillStyle = 'blue';
    ctx.fillRect(signaturePosition.x + currentWidth - 5, signaturePosition.y + currentHeight - 5, 10, 10);
    
    // Draw rotation handle
    ctx.fillStyle = 'green';
    ctx.beginPath();
    ctx.arc(signaturePosition.x + currentWidth/2, signaturePosition.y - 15, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
  
  // Mouse event handlers
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if clicking resize handle
    if (Math.abs(mouseX - (signaturePosition.x + currentWidth)) < 10 &&
        Math.abs(mouseY - (signaturePosition.y + currentHeight)) < 10) {
      isResizing = true;
    }
    // Check if clicking signature area
    else if (mouseX >= signaturePosition.x && mouseX <= signaturePosition.x + currentWidth &&
             mouseY >= signaturePosition.y && mouseY <= signaturePosition.y + currentHeight) {
      isDragging = true;
    }
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const rect = canvas.getBoundingClientRect();
      signaturePosition.x = e.clientX - rect.left - currentWidth/2;
      signaturePosition.y = e.clientY - rect.top - currentHeight/2;
      drawSignaturePreview();
    } else if (isResizing) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      currentWidth = mouseX - signaturePosition.x;
      currentHeight = mouseY - signaturePosition.y;
      drawSignaturePreview();
    }
  });
  
  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
  });
  
  // Rotation buttons (in UI)
  document.getElementById('rotate-sig-left').addEventListener('click', () => {
    currentRotation = (currentRotation - 90) % 360;
    drawSignaturePreview();
  });
  
  document.getElementById('rotate-sig-right').addEventListener('click', () => {
    currentRotation = (currentRotation + 90) % 360;
    drawSignaturePreview();
  });
  
  // Return function to get final placement data
  return {
    getPlacement: () => ({
      x: signaturePosition.x,
      y: canvas.height - signaturePosition.y - currentHeight, // Convert to PDF coordinates
      width: currentWidth,
      height: currentHeight,
      rotation: currentRotation
    })
  };
}
```

**Implementation Notes**:
- Store signatures as base64 data URLs for easy storage and retrieval
- Support PNG and JPEG formats (PNG recommended for signatures)
- Default signature size based on image dimensions, user can resize
- PDF coordinates start bottom-left, canvas coordinates start top-left (convert!)
- Limit stored signatures to 5-10 to avoid storage issues
- Add validation for image size (suggest max 500KB per signature)

### Phase 5: Secure Redaction Implementation

#### Redaction Module (redaction.js)
**Purpose**: Implement secure page-reconstruction redaction

**Data Structures**:
```javascript
// Store redaction boxes for each page
const redactionBoxes = {
  0: [{x: 100, y: 200, width: 150, height: 30}],
  2: [{x: 50, y: 100, width: 200, height: 40}]
};
```

**Key Functions**:

**1. Enable Redaction Mode**:
```javascript
function enableRedactionMode(pageNum) {
  // Show selected page in large canvas
  // Enable click-and-drag to draw redaction boxes
  // Display boxes with delete/resize handles
}
```

**2. Draw Redaction Box (UI)**:
```javascript
function drawRedactionBox(canvas, startX, startY, endX, endY) {
  // Draw semi-transparent red box on canvas overlay
  // Store coordinates for later processing
  // Allow users to see what will be redacted
}
```

**3. Apply Redaction (Core Security Function)**:
```javascript
async function applyRedactionToPage(pdfDoc, pageIndex, redactionBoxes) {
  // STEP 1: Render page to high-resolution image
  const page = pdfDoc.getPage(pageIndex);
  const imageData = await renderPageToImage(page, scale: 3.0); // High DPI
  
  // STEP 2: Draw black boxes on the image
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Draw the rendered page
  ctx.drawImage(imageData, 0, 0);
  
  // Draw black redaction boxes
  ctx.fillStyle = 'black';
  for (const box of redactionBoxes) {
    ctx.fillRect(box.x * 3, box.y * 3, box.width * 3, box.height * 3);
  }
  
  // STEP 3: Convert canvas to image bytes
  const imageBytes = await canvasToImageBytes(canvas);
  
  // STEP 4: Create new page from image
  const embeddedImage = await pdfDoc.embedPng(imageBytes); // or embedJpg
  
  // STEP 5: Replace original page
  const { width, height } = page.getSize();
  pdfDoc.removePage(pageIndex);
  
  const newPage = pdfDoc.insertPage(pageIndex, [width, height]);
  newPage.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: width,
    height: height
  });
  
  return pdfDoc;
}
```

**4. Render Page to High-Res Image**:
```javascript
async function renderPageToImage(pdfPage, scale) {
  // Use PDF.js to render at high DPI
  const viewport = pdfPage.getViewport({scale: scale});
  
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const context = canvas.getContext('2d');
  await pdfPage.render({
    canvasContext: context,
    viewport: viewport
  }).promise;
  
  return canvas;
}
```

**5. Convert Canvas to Image Bytes**:
```javascript
async function canvasToImageBytes(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const arrayBuffer = await blob.arrayBuffer();
      resolve(new Uint8Array(arrayBuffer));
    }, 'image/png');
  });
}
```

**Important Redaction Notes**:
- Use scale of 2.5-3.0 for high quality (balance file size vs quality)
- PNG format preserves quality but larger file size
- JPEG reduces file size but may have artifacts around redaction boxes
- Consider offering user choice between quality/size
- Warn user that redacted pages become non-searchable (acceptable tradeoff)

### Phase 6: UI/UX Implementation

#### popup.html Structure
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <!-- File Upload Area -->
    <div id="upload-area" class="dropzone">
      <p>Drop PDF here or click to upload</p>
      <input type="file" id="file-input" accept=".pdf" hidden>
    </div>
    
    <!-- Mode Selection -->
    <div id="mode-selector" class="hidden">
      <button id="page-mode-btn" class="active">Page Management</button>
      <button id="redact-mode-btn">Redaction</button>
      <button id="signature-mode-btn">Sign Document</button>
    </div>
    
    <!-- Page Management View -->
    <div id="page-management" class="hidden">
      <div id="page-grid"></div>
      
      <div id="actions">
        <button id="merge-btn">Merge PDFs</button>
        <button id="split-btn">Split to Pages</button>
        <button id="extract-btn">Extract Selected</button>
        <button id="download-btn">Download PDF</button>
      </div>
    </div>
    
    <!-- Redaction View -->
    <div id="redaction-view" class="hidden">
      <div id="page-selector">
        <!-- Thumbnails for page selection -->
      </div>
      
      <div id="redaction-canvas-container">
        <canvas id="redaction-canvas"></canvas>
        <div id="redaction-overlay"></div>
      </div>
      
      <div id="redaction-controls">
        <button id="apply-redaction-btn">Apply Redaction</button>
        <button id="clear-boxes-btn">Clear Boxes</button>
        <p class="warning">⚠️ Redacted pages will be converted to images</p>
      </div>
    </div>
    
    <!-- Signature View -->
    <div id="signature-view" class="hidden">
      <!-- Signature Library -->
      <div id="signature-library">
        <h3>Your Signatures</h3>
        <div id="signature-list">
          <!-- Dynamically populated with saved signatures -->
        </div>
        <button id="add-signature-btn">+ Add New Signature</button>
      </div>
      
      <!-- Signature Upload Dialog (hidden by default) -->
      <div id="signature-upload-dialog" class="hidden">
        <h3>Add Signature</h3>
        <input type="text" id="signature-name" placeholder="Name (e.g., Full Signature, Initials)">
        <input type="file" id="signature-file" accept="image/png,image/jpeg">
        <div id="signature-preview"></div>
        <button id="save-signature-btn">Save</button>
        <button id="cancel-signature-btn">Cancel</button>
      </div>
      
      <!-- Page Selection for Signing -->
      <div id="sign-page-selector">
        <h3>Select Page to Sign</h3>
        <div id="sign-page-thumbnails">
          <!-- Thumbnails for page selection -->
        </div>
      </div>
      
      <!-- Signature Placement Canvas -->
      <div id="signature-canvas-container" class="hidden">
        <canvas id="signature-canvas"></canvas>
        <div id="signature-overlay"></div>
        
        <div id="signature-controls">
          <button id="rotate-sig-left">↺ Rotate Left</button>
          <button id="rotate-sig-right">↻ Rotate Right</button>
          <label>
            <input type="checkbox" id="add-timestamp-check" checked>
            Add timestamp
          </label>
          <button id="place-signature-btn">Place Signature</button>
          <button id="cancel-placement-btn">Cancel</button>
        </div>
      </div>
    </div>
  </div>
  
  <script src="../libs/pdf-lib.min.js"></script>
  <script src="../libs/pdf.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

#### Key UI Features

**Drag and Drop Page Reordering**:
- Use HTML5 drag and drop API
- Visual feedback when dragging
- Update internal page order array
- Re-render preview

**Redaction Box Drawing**:
- Click and drag to create box
- Display semi-transparent red overlay
- Show resize handles on selected box
- Right-click or delete key to remove box

**Signature Management**:
- Display saved signatures as thumbnail gallery
- Click signature to select for placement
- Upload dialog with image preview
- Delete signature with confirmation prompt

**Signature Placement**:
- Drag signature to position on page
- Corner handles to resize
- Rotation buttons (90° increments)
- Visual preview before committing
- Timestamp checkbox (on by default)

**Page Selection**:
- Checkbox on each thumbnail for bulk operations
- Select all / deselect all buttons
- Show count of selected pages

**Progress Indicators**:
- Show spinner during processing
- Estimate time for large PDFs
- Disable buttons during operations

### Phase 7: Error Handling & Edge Cases

#### Error Scenarios to Handle

**File Issues**:
- File too large (>50MB) - show warning
- Corrupted PDF - show error message
- Password-protected PDF - explain limitation
- Invalid file type - reject with message

**Signature Issues**:
- Image file too large (>500KB) - show warning and suggest compression
- Invalid image format - only accept PNG/JPEG
- Storage quota exceeded - prompt to delete old signatures
- Empty signature name - require name before saving
- Duplicate signature names - auto-append number or prompt for unique name

**Memory Issues**:
- Large PDFs may crash extension
- Implement file size warnings
- Consider chunked processing for very large files

**Redaction Issues**:
- Empty redaction boxes - ignore
- Overlapping boxes - merge or keep separate
- Boxes outside page bounds - clip to page

**Browser Compatibility**:
- Test canvas size limits
- Test memory limits
- Provide fallback messages

#### User Warnings

**Before Redaction**:
"Redacted pages will be converted to images. These pages will no longer have selectable text. Continue?"

**After Redaction**:
"✓ Redaction complete. Verify that sensitive information is hidden before sharing."

**Download Notice**:
"Always double-check redacted areas by opening the PDF and trying to select text in redacted regions."

**Signature Storage**:
"Your signatures are stored locally in your browser. They will not be synced across devices or uploaded to any server."

**Signature Security**:
"Note: This creates a visual signature, not a cryptographic digital signature. The signed document can still be edited by others."

**First Signature Upload**:
"Tip: For best results, crop your signature tightly and use a transparent background (PNG format)."

### Phase 8: Testing Checklist

#### Functional Tests
- [ ] Load various PDF sizes (1 page, 10 pages, 50+ pages)
- [ ] Rotate pages in all directions
- [ ] Delete single and multiple pages
- [ ] Reorder pages via drag-drop
- [ ] Extract specific pages
- [ ] Merge 2+ PDFs
- [ ] Split PDF into individual pages
- [ ] Upload and save signature images (PNG and JPEG)
- [ ] Delete saved signatures
- [ ] Select signature from library
- [ ] Drag signature to position on page
- [ ] Resize signature with corner handles
- [ ] Rotate signature (90° increments)
- [ ] Place signature with and without timestamp
- [ ] Place multiple signatures on same page
- [ ] Place signatures on different pages
- [ ] Draw redaction boxes
- [ ] Resize and delete redaction boxes
- [ ] Apply redaction and verify text removal
- [ ] Combine operations (sign + redact on same PDF)
- [ ] Download processed PDF

#### Security Tests
- [ ] Verify redacted text cannot be selected
- [ ] Verify redacted text cannot be found with Ctrl+F
- [ ] Verify redacted text not in PDF source (open in text editor)
- [ ] Test with PDF viewers: Firefox, Chrome, Adobe Reader
- [ ] Try copying from redacted areas
- [ ] Check PDF metadata doesn't contain sensitive info

#### Edge Case Tests
- [ ] Single page PDF
- [ ] 100+ page PDF (if performance allows)
- [ ] PDF with forms
- [ ] PDF with images
- [ ] PDF with mixed orientations
- [ ] Scanned document (image-based PDF)
- [ ] Signature image with transparent background
- [ ] Signature image without transparent background
- [ ] Very large signature image (>1MB)
- [ ] Very small signature image (<10KB)
- [ ] Storage limit: save maximum number of signatures (suggest 10)
- [ ] Place signature at edge of page
- [ ] Place signature rotated at various angles
- [ ] Signature + redaction on same page
- [ ] Redact entire page
- [ ] Redact multiple areas on one page

## Development Roadmap

### Week 1: Foundation
- Set up extension structure
- Implement file loading
- Basic PDF viewing with PDF.js
- Page thumbnail generation

### Week 2: Page Management & Signatures
- Implement rotate, delete, reorder
- Add drag-and-drop UI
- Implement extract and merge
- Implement signature storage (browser.storage.local)
- Create signature upload and management UI
- Add signature library display

### Week 3: Signature Placement & Redaction
- Implement signature placement canvas
- Add resize and rotation controls
- Implement timestamp addition
- Test signature insertion into PDFs
- Implement redaction box drawing UI
- Implement page-to-image conversion
- Implement secure redaction

### Week 4: Polish & Testing
- Combine all features (sign + redact workflow)
- Error handling for all features
- UI/UX improvements
- Security testing (redaction + signature verification)
- Performance optimization
- Documentation

## Deployment

### Build Process
1. Bundle all dependencies
2. Minify JavaScript
3. Compress images
4. Test in Firefox
5. Package as .xpi file

### Firefox Add-ons Store
1. Create developer account
2. Submit extension for review
3. Include privacy policy (no data collected)
4. Include clear description of features
5. Add screenshots

### Self-Hosting Option
Users can also install unsigned extensions in Firefox Developer Edition for personal use.

## Future Enhancements (Optional)

### Nice-to-Have Features
- Add blank pages
- Crop pages
- Add watermarks (text-based)
- Basic form filling
- Batch processing multiple files
- Save/load redaction templates
- Signature templates (e.g., "Approved by [Name] on [Date]")
- Multiple signature placement presets (bottom-right, top-right, etc.)
- Keyboard shortcuts
- Dark mode
- Export signature library for backup

### Performance Improvements
- Web Workers for processing
- Lazy loading for large PDFs
- Cached thumbnails
- Progressive rendering

## Resources & Documentation

### Key Documentation Links
- PDF-lib: https://pdf-lib.js.org/
- PDF.js: https://mozilla.github.io/pdf.js/
- Firefox Extension API: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
- Canvas API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

### Example Code References
- PDF-lib examples: https://pdf-lib.js.org/docs/api/
- PDF.js examples: https://github.com/mozilla/pdf.js/tree/master/examples
- Firefox extension examples: https://github.com/mdn/webextensions-examples

## Security Considerations

### Redaction Security
- Never trust visual-only redaction
- Always convert to image-based pages
- Use high DPI to prevent enhancement attacks
- Warn users about metadata
- Recommend testing in multiple viewers

### Privacy
- All processing happens client-side
- No data sent to servers
- No analytics or tracking
- No file storage
- Document in privacy policy

### Extension Permissions
- Only request necessary permissions
- Explain why each permission is needed
- No access to browsing history
- No network requests

## Notes for LLM Implementation

### Code Style Preferences
- Use modern ES6+ JavaScript
- Async/await over promises
- Clear variable names
- Comment complex logic
- Modular functions (single responsibility)

### Priority Order
1. Get basic PDF loading and viewing working first
2. Implement one page operation (rotate) completely
3. Add remaining page operations
4. Implement redaction last (most complex)
5. Polish UI throughout

### Common Pitfalls
- PDF coordinates start bottom-left, canvas top-left (convert coordinates)
- PDF-lib uses points (1/72 inch), canvas uses pixels
- Large PDFs consume lots of memory
- Canvas has size limitations (browser dependent)
- Always test redaction security thoroughly

### Helpful Debugging
- Console.log PDF structure for understanding
- Render intermediate steps (before/after redaction)
- Test with simple PDFs first
- Use Firefox Developer Edition for easier debugging

## Success Criteria

The extension is successful if:
1. Users can perform basic page operations quickly
2. Users can save and insert signatures with timestamps easily
3. Signatures are stored securely in local browser storage
4. Redaction truly removes text (verified by testing)
5. Works reliably for typical expense reports (1-10 pages)
6. UI is intuitive without documentation
7. No data leaves the user's browser
8. File size remains reasonable after processing
9. Combined workflow (redact credit card + sign document) is seamless

---

## Typical User Workflow Example

**Expense Report Signing & Redaction:**
1. Open extension, upload expense report PDF
2. Switch to "Redaction" mode
3. Select page with credit card info
4. Draw boxes over card number and CVV
5. Apply redaction (page converts to image)
6. Switch to "Sign Document" mode
7. Select saved signature from library
8. Choose page to sign (usually last page)
9. Drag signature to bottom-right
10. Resize if needed
11. Ensure "Add timestamp" is checked
12. Place signature (adds "Signed: [date/time]" below)
13. Download completed PDF
14. Submit to accounting

**Time saved:** ~5 minutes vs printing, redacting with marker, signing, scanning

---

## Quick Start Commands for LLM

```bash
# Create project structure
mkdir pdf-tool-extension
cd pdf-tool-extension

# Create directory structure
mkdir -p popup content background libs icons src

# Download required libraries (no npm needed!)
# 1. PDF-lib: Download from https://github.com/Hopding/pdf-lib/releases
#    Get pdf-lib.min.js and place in libs/
# 
# 2. PDF.js: Download from https://github.com/mozilla/pdf.js/releases
#    Get pdf.min.js and pdf.worker.min.js, place in libs/

# Start implementing in this order:
# 1. manifest.json
# 2. popup.html + popup.css
# 3. file-handler.js (load/save)
# 4. ui-handler.js (display)
# 5. pdf-operations.js (page management)
# 6. signature-manager.js (signature storage and insertion)
# 7. redaction.js (secure redaction)
# 8. popup.js (wire everything together)
```

**Library Setup Note:**
Since this is a browser extension, you don't need npm at runtime. Just download the minified library files and include them in your `libs/` folder. Reference them in manifest.json or load them via `<script>` tags in popup.html.

This plan is ready to hand off to an LLM for implementation!