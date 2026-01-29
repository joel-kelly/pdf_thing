/**
 * PDF Operations Module
 * Core PDF manipulation functions using PDF-lib
 */

// PDF-lib is loaded globally from the script tag

/**
 * Load a PDF document from ArrayBuffer
 * @param {ArrayBuffer} data - The PDF data
 * @returns {Promise<PDFDocument>} The loaded PDF document
 */
export async function loadPDFDocument(data) {
  const pdfDoc = await PDFLib.PDFDocument.load(data, {
    ignoreEncryption: true
  });
  return pdfDoc;
}

/**
 * Rotate a page by specified degrees
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {number} pageIndex - Zero-based page index
 * @param {number} degrees - Rotation in degrees (90, 180, 270, or -90)
 * @returns {PDFDocument} The modified PDF document
 */
export function rotatePage(pdfDoc, pageIndex, degrees) {
  const page = pdfDoc.getPage(pageIndex);
  const currentRotation = page.getRotation().angle;
  const newRotation = (currentRotation + degrees + 360) % 360;
  page.setRotation(PDFLib.degrees(newRotation));
  return pdfDoc;
}

/**
 * Delete pages from the PDF
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {number[]} pageIndices - Zero-based indices of pages to delete
 * @returns {PDFDocument} The modified PDF document
 */
export function deletePages(pdfDoc, pageIndices) {
  // Sort in reverse order to avoid index shifting issues
  const sortedIndices = [...pageIndices].sort((a, b) => b - a);

  for (const index of sortedIndices) {
    if (index >= 0 && index < pdfDoc.getPageCount()) {
      pdfDoc.removePage(index);
    }
  }

  return pdfDoc;
}

/**
 * Reorder pages in the PDF
 * @param {PDFDocument} pdfDoc - The original PDF document
 * @param {number[]} newOrder - Array of old indices in new order
 * @returns {Promise<PDFDocument>} A new PDF document with reordered pages
 */
export async function reorderPages(pdfDoc, newOrder) {
  const newPdfDoc = await PDFLib.PDFDocument.create();

  for (const oldIndex of newOrder) {
    const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [oldIndex]);
    newPdfDoc.addPage(copiedPage);
  }

  return newPdfDoc;
}

/**
 * Extract specific pages to a new PDF
 * @param {PDFDocument} pdfDoc - The source PDF document
 * @param {number[]} pageIndices - Zero-based indices of pages to extract
 * @returns {Promise<PDFDocument>} A new PDF with only the extracted pages
 */
export async function extractPages(pdfDoc, pageIndices) {
  const newPdfDoc = await PDFLib.PDFDocument.create();

  // Sort indices to maintain order
  const sortedIndices = [...pageIndices].sort((a, b) => a - b);
  const copiedPages = await newPdfDoc.copyPages(pdfDoc, sortedIndices);

  for (const page of copiedPages) {
    newPdfDoc.addPage(page);
  }

  return newPdfDoc;
}

/**
 * Merge multiple PDF documents
 * @param {PDFDocument[]} pdfDocs - Array of PDF documents to merge
 * @returns {Promise<PDFDocument>} A new merged PDF document
 */
export async function mergePDFs(pdfDocs) {
  const mergedPdf = await PDFLib.PDFDocument.create();

  for (const pdfDoc of pdfDocs) {
    const pageCount = pdfDoc.getPageCount();
    const indices = Array.from({ length: pageCount }, (_, i) => i);
    const copiedPages = await mergedPdf.copyPages(pdfDoc, indices);

    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  return mergedPdf;
}

/**
 * Split PDF into individual page documents
 * @param {PDFDocument} pdfDoc - The PDF document to split
 * @returns {Promise<PDFDocument[]>} Array of single-page PDF documents
 */
export async function splitPDF(pdfDoc) {
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

/**
 * Get page dimensions
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {number} pageIndex - Zero-based page index
 * @returns {{width: number, height: number}} Page dimensions in points
 */
export function getPageDimensions(pdfDoc, pageIndex) {
  const page = pdfDoc.getPage(pageIndex);
  const { width, height } = page.getSize();
  const rotation = page.getRotation().angle;

  // Account for rotation
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }

  return { width, height };
}

/**
 * Replace a page with an image
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {number} pageIndex - Zero-based index of page to replace
 * @param {Uint8Array} imageBytes - PNG or JPEG image bytes
 * @param {string} imageType - 'png' or 'jpeg'
 * @returns {Promise<PDFDocument>} The modified PDF document
 */
export async function replacePageWithImage(pdfDoc, pageIndex, imageBytes, imageType) {
  const page = pdfDoc.getPage(pageIndex);
  const { width, height } = page.getSize();

  // Embed the image
  let embeddedImage;
  if (imageType === 'png') {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  }

  // Remove the original page and insert a new one
  pdfDoc.removePage(pageIndex);
  const newPage = pdfDoc.insertPage(pageIndex, [width, height]);

  // Draw the image to fill the page
  newPage.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: width,
    height: height
  });

  return pdfDoc;
}

/**
 * Insert an image onto a page
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {number} pageIndex - Zero-based page index
 * @param {Uint8Array} imageBytes - PNG or JPEG image bytes
 * @param {string} imageType - 'png' or 'jpeg'
 * @param {Object} options - Placement options
 * @param {number} options.x - X position in points
 * @param {number} options.y - Y position in points
 * @param {number} options.width - Width in points
 * @param {number} options.height - Height in points
 * @param {number} [options.rotation=0] - Rotation in degrees
 * @param {number} [options.opacity=1] - Opacity (0-1)
 * @returns {Promise<PDFDocument>} The modified PDF document
 */
export async function insertImageOnPage(pdfDoc, pageIndex, imageBytes, imageType, options) {
  const page = pdfDoc.getPage(pageIndex);

  // Embed the image
  let embeddedImage;
  if (imageType === 'png') {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  }

  // Draw the image
  page.drawImage(embeddedImage, {
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    rotate: PDFLib.degrees(options.rotation || 0),
    opacity: options.opacity || 1
  });

  return pdfDoc;
}

/**
 * Add text to a page
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {number} pageIndex - Zero-based page index
 * @param {string} text - Text to add
 * @param {Object} options - Text options
 * @param {number} options.x - X position in points
 * @param {number} options.y - Y position in points
 * @param {number} [options.size=12] - Font size in points
 * @param {Object} [options.color] - RGB color object
 * @returns {Promise<PDFDocument>} The modified PDF document
 */
export async function addTextToPage(pdfDoc, pageIndex, text, options) {
  const page = pdfDoc.getPage(pageIndex);

  // Use standard font
  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

  const color = options.color || { r: 0.5, g: 0.5, b: 0.5 };

  page.drawText(text, {
    x: options.x,
    y: options.y,
    size: options.size || 12,
    font: font,
    color: PDFLib.rgb(color.r, color.g, color.b)
  });

  return pdfDoc;
}

/**
 * Get the page count of a PDF document
 * @param {PDFDocument} pdfDoc - The PDF document
 * @returns {number} Number of pages
 */
export function getPageCount(pdfDoc) {
  return pdfDoc.getPageCount();
}

/**
 * Save PDF document to bytes
 * @param {PDFDocument} pdfDoc - The PDF document
 * @returns {Promise<Uint8Array>} The PDF bytes
 */
export async function savePDFToBytes(pdfDoc) {
  return await pdfDoc.save();
}

/**
 * Create a copy of the PDF document
 * @param {PDFDocument} pdfDoc - The PDF document to copy
 * @returns {Promise<PDFDocument>} A new copy of the document
 */
export async function copyPDFDocument(pdfDoc) {
  const pdfBytes = await pdfDoc.save();
  return await PDFLib.PDFDocument.load(pdfBytes);
}
