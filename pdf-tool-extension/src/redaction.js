/**
 * Redaction Module
 * Implements secure page-reconstruction redaction
 */

(function() {
  'use strict';

  const RENDER_SCALE = 2.5;

  /**
   * Render a PDF page to a canvas using PDF.js
   */
  async function renderPageToCanvas(pdfJsPage, scale) {
    scale = scale || RENDER_SCALE;
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
   */
  function applyRedactionBoxesToCanvas(canvas, boxes, scale) {
    scale = scale || RENDER_SCALE;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';

    for (const box of boxes) {
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
   */
  function canvasToImageBytes(canvas) {
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
   */
  async function applyRedactionToPage(pdfDoc, pdfJsPage, pageIndex, boxes) {
    if (!boxes || boxes.length === 0) {
      return pdfDoc;
    }

    const canvas = await renderPageToCanvas(pdfJsPage, RENDER_SCALE);
    applyRedactionBoxesToCanvas(canvas, boxes, RENDER_SCALE);
    const imageBytes = await canvasToImageBytes(canvas);
    await window.PDFOperations.replacePageWithImage(pdfDoc, pageIndex, imageBytes, 'png');

    return pdfDoc;
  }

  /**
   * Apply redactions to multiple pages
   */
  async function applyRedactions(pdfDoc, pdfJsDoc, redactionsByPage, onProgress) {
    const pageIndices = Object.keys(redactionsByPage).map(Number).sort((a, b) => a - b);

    for (let i = pageIndices.length - 1; i >= 0; i--) {
      const pageIndex = pageIndices[i];
      const boxes = redactionsByPage[pageIndex];

      if (boxes && boxes.length > 0) {
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
   * Draw redaction preview
   */
  function drawRedactionPreview(ctx, boxes, color) {
    color = color || 'rgba(231, 76, 60, 0.5)';
    ctx.fillStyle = color;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;

    for (const box of boxes) {
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    }
  }

  // Expose to global scope
  window.Redaction = {
    renderPageToCanvas,
    applyRedactionBoxesToCanvas,
    canvasToImageBytes,
    applyRedactionToPage,
    applyRedactions,
    drawRedactionPreview
  };
})();
