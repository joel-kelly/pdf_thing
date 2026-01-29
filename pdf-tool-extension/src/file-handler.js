/**
 * File Handler Module
 * Handles PDF file uploads, validation, and exports
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Read a file as ArrayBuffer
 * @param {File} file - The file to read
 * @returns {Promise<ArrayBuffer>} The file contents as ArrayBuffer
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read a file as Data URL (base64)
 * @param {File} file - The file to read
 * @returns {Promise<string>} The file contents as data URL
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validate a PDF file
 * @param {File} file - The file to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validatePDF(file) {
  // Check file type
  if (!file.type && !file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Please select a PDF file' };
  }

  if (file.type && file.type !== 'application/pdf') {
    return { valid: false, error: 'Please select a PDF file' };
  }

  // Check file size
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
 * @param {File} file - The PDF file to load
 * @returns {Promise<{data: ArrayBuffer, name: string}>} The PDF data and filename
 */
export async function loadPDFFile(file) {
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
 * @param {PDFDocument} pdfDoc - The PDF-lib document to export
 * @param {string} filename - The filename for the download
 */
export async function exportPDF(pdfDoc, filename) {
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Export multiple PDFs as separate files
 * @param {PDFDocument[]} pdfDocs - Array of PDF-lib documents
 * @param {string} baseFilename - Base filename (will add page numbers)
 */
export async function exportMultiplePDFs(pdfDocs, baseFilename) {
  const baseName = baseFilename.replace('.pdf', '');

  for (let i = 0; i < pdfDocs.length; i++) {
    const filename = `${baseName}_page${i + 1}.pdf`;
    await exportPDF(pdfDocs[i], filename);

    // Small delay between downloads to prevent issues
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Validate an image file for signature upload
 * @param {File} file - The image file to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateSignatureImage(file) {
  const MAX_IMAGE_SIZE = 500 * 1024; // 500KB
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
 * @param {string} dataURL - The image data URL
 * @returns {Promise<{width: number, height: number}>} Image dimensions
 */
export function getImageDimensions(dataURL) {
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
 * @param {string} dataURL - The data URL to convert
 * @returns {Uint8Array} The binary data
 */
export function dataURLToBytes(dataURL) {
  const base64 = dataURL.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
