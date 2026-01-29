/**
 * PDF Operations Module
 * Core PDF manipulation functions using PDF-lib
 */

(function() {
  'use strict';

  /**
   * Load a PDF document from ArrayBuffer
   */
  async function loadPDFDocument(data) {
    const pdfDoc = await PDFLib.PDFDocument.load(data, {
      ignoreEncryption: true
    });
    return pdfDoc;
  }

  /**
   * Rotate a page by specified degrees
   */
  function rotatePage(pdfDoc, pageIndex, degrees) {
    const page = pdfDoc.getPage(pageIndex);
    const currentRotation = page.getRotation().angle;
    const newRotation = (currentRotation + degrees + 360) % 360;
    page.setRotation(PDFLib.degrees(newRotation));
    return pdfDoc;
  }

  /**
   * Delete pages from the PDF
   */
  function deletePages(pdfDoc, pageIndices) {
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
   */
  async function reorderPages(pdfDoc, newOrder) {
    const newPdfDoc = await PDFLib.PDFDocument.create();

    for (const oldIndex of newOrder) {
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [oldIndex]);
      newPdfDoc.addPage(copiedPage);
    }

    return newPdfDoc;
  }

  /**
   * Extract specific pages to a new PDF
   */
  async function extractPages(pdfDoc, pageIndices) {
    const newPdfDoc = await PDFLib.PDFDocument.create();
    const sortedIndices = [...pageIndices].sort((a, b) => a - b);
    const copiedPages = await newPdfDoc.copyPages(pdfDoc, sortedIndices);

    for (const page of copiedPages) {
      newPdfDoc.addPage(page);
    }

    return newPdfDoc;
  }

  /**
   * Merge multiple PDF documents
   */
  async function mergePDFs(pdfDocs) {
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
   */
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

  /**
   * Get page dimensions
   */
  function getPageDimensions(pdfDoc, pageIndex) {
    const page = pdfDoc.getPage(pageIndex);
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;

    if (rotation === 90 || rotation === 270) {
      return { width: height, height: width };
    }

    return { width, height };
  }

  /**
   * Replace a page with an image
   */
  async function replacePageWithImage(pdfDoc, pageIndex, imageBytes, imageType) {
    const page = pdfDoc.getPage(pageIndex);
    const { width, height } = page.getSize();

    let embeddedImage;
    if (imageType === 'png') {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    }

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

  /**
   * Insert an image onto a page
   */
  async function insertImageOnPage(pdfDoc, pageIndex, imageBytes, imageType, options) {
    const page = pdfDoc.getPage(pageIndex);

    let embeddedImage;
    if (imageType === 'png') {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    }

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
   */
  async function addTextToPage(pdfDoc, pageIndex, text, options) {
    const page = pdfDoc.getPage(pageIndex);
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
   */
  function getPageCount(pdfDoc) {
    return pdfDoc.getPageCount();
  }

  /**
   * Save PDF document to bytes
   */
  async function savePDFToBytes(pdfDoc) {
    return await pdfDoc.save();
  }

  /**
   * Create a copy of the PDF document
   */
  async function copyPDFDocument(pdfDoc) {
    const pdfBytes = await pdfDoc.save();
    return await PDFLib.PDFDocument.load(pdfBytes);
  }

  // Expose to global scope
  window.PDFOperations = {
    loadPDFDocument,
    rotatePage,
    deletePages,
    reorderPages,
    extractPages,
    mergePDFs,
    splitPDF,
    getPageDimensions,
    replacePageWithImage,
    insertImageOnPage,
    addTextToPage,
    getPageCount,
    savePDFToBytes,
    copyPDFDocument
  };
})();
