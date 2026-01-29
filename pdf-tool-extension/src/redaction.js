/**
 * Redaction Module
 * Implements secure page-reconstruction redaction
 */

import { replacePageWithImage, getPageDimensions } from './pdf-operations.js';

/**
 * @typedef {Object} RedactionBox
 * @property {number} x - X position (from left, in canvas coordinates)
 * @property {number} y - Y position (from top, in canvas coordinates)
 * @property {number} width - Width in canvas pixels
 * @property {number} height - Height in canvas pixels
 */

// Rendering scale for high-quality output
const RENDER_SCALE = 2.5;

/**
 * Render a PDF page to a canvas using PDF.js
 * @param {Object} pdfJsPage - PDF.js page object
 * @param {number} scale - Rendering scale
 * @returns {Promise<HTMLCanvasElement>} Canvas with rendered page
 */
export async function renderPageToCanvas(pdfJsPage, scale = RENDER_SCALE) {
  const viewport = pdfJsPage.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');

  await pdfJsPage.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  return canvas;
}

/**
 * Apply redaction boxes to a canvas
 * @param {HTMLCanvasElement} canvas - The canvas to modify
 * @param {RedactionBox[]} boxes - Redaction boxes (in original scale coordinates)
 * @param {number} scale - Scale factor used for rendering
 */
export function applyRedactionBoxesToCanvas(canvas, boxes, scale = RENDER_SCALE) {
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';

  for (const box of boxes) {
    // Scale box coordinates to match canvas scale
    ctx.fillRect(
      box.x * scale,
      box.y * scale,
      box.width * scale,
      box.height * scale
    );
  }
}

/**
 * Convert canvas to PNG bytes
 * @param {HTMLCanvasElement} canvas - The canvas to convert
 * @returns {Promise<Uint8Array>} PNG image bytes
 */
export function canvasToImageBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }
        try {
          const arrayBuffer = await blob.arrayBuffer();
          resolve(new Uint8Array(arrayBuffer));
        } catch (error) {
          reject(error);
        }
      },
      'image/png'
    );
  });
}

/**
 * Apply redaction to a single page
 * This is the core security function - it renders the page to an image,
 * draws black boxes over redacted areas, then replaces the original page
 *
 * @param {PDFDocument} pdfDoc - PDF-lib document
 * @param {Object} pdfJsPage - PDF.js page object for rendering
 * @param {number} pageIndex - Zero-based page index
 * @param {RedactionBox[]} boxes - Redaction boxes (in display coordinates)
 * @returns {Promise<PDFDocument>} The modified PDF document
 */
export async function applyRedactionToPage(pdfDoc, pdfJsPage, pageIndex, boxes) {
  if (!boxes || boxes.length === 0) {
    return pdfDoc;
  }

  // Step 1: Render the page at high resolution
  const canvas = await renderPageToCanvas(pdfJsPage, RENDER_SCALE);

  // Step 2: Draw black boxes on the canvas
  applyRedactionBoxesToCanvas(canvas, boxes, RENDER_SCALE);

  // Step 3: Convert canvas to PNG bytes
  const imageBytes = await canvasToImageBytes(canvas);

  // Step 4: Replace the original page with the image
  await replacePageWithImage(pdfDoc, pageIndex, imageBytes, 'png');

  return pdfDoc;
}

/**
 * Apply redactions to multiple pages
 * @param {PDFDocument} pdfDoc - PDF-lib document
 * @param {Object} pdfJsDoc - PDF.js document for rendering
 * @param {Object<number, RedactionBox[]>} redactionsByPage - Map of page index to redaction boxes
 * @param {Function} [onProgress] - Progress callback (pageIndex, totalPages)
 * @returns {Promise<PDFDocument>} The modified PDF document
 */
export async function applyRedactions(pdfDoc, pdfJsDoc, redactionsByPage, onProgress) {
  const pageIndices = Object.keys(redactionsByPage).map(Number).sort((a, b) => a - b);

  // Process pages in reverse order to avoid index shifting issues
  // when pages are replaced
  for (let i = pageIndices.length - 1; i >= 0; i--) {
    const pageIndex = pageIndices[i];
    const boxes = redactionsByPage[pageIndex];

    if (boxes && boxes.length > 0) {
      // Get the PDF.js page (1-indexed)
      const pdfJsPage = await pdfJsDoc.getPage(pageIndex + 1);

      await applyRedactionToPage(pdfDoc, pdfJsPage, pageIndex, boxes);

      if (onProgress) {
        onProgress(pageIndices.length - i, pageIndices.length);
      }
    }
  }

  return pdfDoc;
}

/**
 * Validate redaction boxes
 * @param {RedactionBox[]} boxes - Boxes to validate
 * @param {number} pageWidth - Page width for bounds checking
 * @param {number} pageHeight - Page height for bounds checking
 * @returns {RedactionBox[]} Validated and clipped boxes
 */
export function validateRedactionBoxes(boxes, pageWidth, pageHeight) {
  return boxes
    .filter(box => {
      // Remove boxes with no area
      return box.width > 0 && box.height > 0;
    })
    .map(box => {
      // Clip boxes to page bounds
      const x = Math.max(0, box.x);
      const y = Math.max(0, box.y);
      const width = Math.min(box.width, pageWidth - x);
      const height = Math.min(box.height, pageHeight - y);

      return { x, y, width, height };
    })
    .filter(box => box.width > 0 && box.height > 0);
}

/**
 * Merge overlapping redaction boxes (optional optimization)
 * @param {RedactionBox[]} boxes - Boxes to merge
 * @returns {RedactionBox[]} Merged boxes
 */
export function mergeOverlappingBoxes(boxes) {
  if (boxes.length <= 1) return boxes;

  // Simple implementation - check each box against all others
  const merged = [];
  const used = new Set();

  for (let i = 0; i < boxes.length; i++) {
    if (used.has(i)) continue;

    let current = { ...boxes[i] };
    used.add(i);

    let changed = true;
    while (changed) {
      changed = false;

      for (let j = 0; j < boxes.length; j++) {
        if (used.has(j)) continue;

        const other = boxes[j];

        // Check if boxes overlap
        if (boxesOverlap(current, other)) {
          // Merge boxes
          const minX = Math.min(current.x, other.x);
          const minY = Math.min(current.y, other.y);
          const maxX = Math.max(current.x + current.width, other.x + other.width);
          const maxY = Math.max(current.y + current.height, other.y + other.height);

          current = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          };

          used.add(j);
          changed = true;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

/**
 * Check if two boxes overlap
 * @param {RedactionBox} a - First box
 * @param {RedactionBox} b - Second box
 * @returns {boolean} True if boxes overlap
 */
function boxesOverlap(a, b) {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Create a preview of redaction (draws semi-transparent boxes)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {RedactionBox[]} boxes - Redaction boxes
 * @param {string} [color='rgba(231, 76, 60, 0.5)'] - Box color
 */
export function drawRedactionPreview(ctx, boxes, color = 'rgba(231, 76, 60, 0.5)') {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 2;

  for (const box of boxes) {
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.strokeRect(box.x, box.y, box.width, box.height);
  }
}

/**
 * Get information about what will be redacted
 * @param {Object<number, RedactionBox[]>} redactionsByPage - Map of page index to boxes
 * @returns {{pageCount: number, boxCount: number, pages: number[]}}
 */
export function getRedactionSummary(redactionsByPage) {
  const pages = Object.keys(redactionsByPage)
    .map(Number)
    .filter(pageIndex => {
      const boxes = redactionsByPage[pageIndex];
      return boxes && boxes.length > 0;
    })
    .sort((a, b) => a - b);

  const boxCount = pages.reduce((total, pageIndex) => {
    return total + redactionsByPage[pageIndex].length;
  }, 0);

  return {
    pageCount: pages.length,
    boxCount,
    pages
  };
}
