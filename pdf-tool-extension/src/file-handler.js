/**
 * File Handler Module
 * Handles PDF file uploads, validation, and exports
 */

(function() {
  'use strict';

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  /**
   * Read a file as ArrayBuffer
   */
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Read a file as Data URL (base64)
   */
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Validate a PDF file
   */
  function validatePDF(file) {
    if (!file.type && !file.name.toLowerCase().endsWith('.pdf')) {
      return { valid: false, error: 'Please select a PDF file' };
    }

    if (file.type && file.type !== 'application/pdf') {
      return { valid: false, error: 'Please select a PDF file' };
    }

    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = Math.round(file.size / (1024 * 1024));
      return {
        valid: false,
        error: `File is too large (${sizeMB}MB). Maximum size is 50MB.`
      };
    }

    return { valid: true };
  }

  /**
   * Load a PDF file and return its data
   */
  async function loadPDFFile(file) {
    const validation = validatePDF(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const data = await readFileAsArrayBuffer(file);

    // Basic PDF header check
    const headerBytes = new Uint8Array(data.slice(0, 5));
    const header = String.fromCharCode(...headerBytes);
    if (header !== '%PDF-') {
      throw new Error('Invalid PDF file');
    }

    return {
      data,
      name: file.name
    };
  }

  /**
   * Export a PDF document as a downloadable file
   */
  async function exportPDF(pdfDoc, filename) {
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Export multiple PDFs as separate files
   */
  async function exportMultiplePDFs(pdfDocs, baseFilename) {
    const baseName = baseFilename.replace('.pdf', '');

    for (let i = 0; i < pdfDocs.length; i++) {
      const filename = `${baseName}_page${i + 1}.pdf`;
      await exportPDF(pdfDocs[i], filename);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Validate an image file for signature upload
   */
  function validateSignatureImage(file) {
    const MAX_IMAGE_SIZE = 500 * 1024;
    const ALLOWED_TYPES = ['image/png', 'image/jpeg'];

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Please use PNG or JPEG format' };
    }

    if (file.size > MAX_IMAGE_SIZE) {
      const sizeKB = Math.round(file.size / 1024);
      return {
        valid: false,
        error: `Image is too large (${sizeKB}KB). Maximum size is 500KB.`
      };
    }

    return { valid: true };
  }

  /**
   * Get image dimensions from a data URL
   */
  function getImageDimensions(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataURL;
    });
  }

  /**
   * Convert a data URL to Uint8Array bytes
   */
  function dataURLToBytes(dataURL) {
    const base64 = dataURL.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Expose to global scope
  window.FileHandler = {
    readFileAsArrayBuffer,
    readFileAsDataURL,
    validatePDF,
    loadPDFFile,
    exportPDF,
    exportMultiplePDFs,
    validateSignatureImage,
    getImageDimensions,
    dataURLToBytes
  };
})();
