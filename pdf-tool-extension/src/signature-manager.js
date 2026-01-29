/**
 * Signature Manager Module
 * Manages signature storage and insertion into PDFs
 */

import {
  readFileAsDataURL,
  getImageDimensions,
  validateSignatureImage,
  dataURLToBytes
} from './file-handler.js';
import { insertImageOnPage, addTextToPage } from './pdf-operations.js';

const STORAGE_KEY = 'signatures';
const MAX_SIGNATURES = 10;

/**
 * @typedef {Object} Signature
 * @property {string} id - Unique identifier
 * @property {string} name - Display name
 * @property {string} imageData - Base64 data URL
 * @property {number} width - Default width in points
 * @property {number} height - Default height in points
 * @property {string} created - ISO date string
 */

/**
 * Load all signatures from storage
 * @returns {Promise<Signature[]>} Array of saved signatures
 */
export async function loadSignatures() {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  } catch (error) {
    console.error('Failed to load signatures:', error);
    return [];
  }
}

/**
 * Save a new signature
 * @param {string} name - Display name for the signature
 * @param {File} imageFile - Image file (PNG or JPEG)
 * @returns {Promise<Signature>} The saved signature object
 */
export async function saveSignature(name, imageFile) {
  // Validate the image
  const validation = validateSignatureImage(imageFile);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Read image as data URL
  const imageData = await readFileAsDataURL(imageFile);

  // Get image dimensions
  const dimensions = await getImageDimensions(imageData);

  // Convert pixels to points (assuming 96 DPI screen, PDF uses 72 DPI)
  const scale = 72 / 96;
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;

  // Create signature object
  const signature = {
    id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim() || 'Unnamed Signature',
    imageData: imageData,
    width: Math.min(width, 200), // Cap default width
    height: Math.min(height, 100), // Cap default height
    created: new Date().toISOString()
  };

  // Load existing signatures
  const signatures = await loadSignatures();

  // Check if we've reached the limit
  if (signatures.length >= MAX_SIGNATURES) {
    throw new Error(`Maximum of ${MAX_SIGNATURES} signatures allowed. Please delete an existing signature first.`);
  }

  // Add new signature
  signatures.push(signature);

  // Save to storage
  await browser.storage.local.set({ [STORAGE_KEY]: signatures });

  return signature;
}

/**
 * Delete a signature by ID
 * @param {string} signatureId - ID of signature to delete
 * @returns {Promise<void>}
 */
export async function deleteSignature(signatureId) {
  const signatures = await loadSignatures();
  const filtered = signatures.filter(sig => sig.id !== signatureId);

  if (filtered.length === signatures.length) {
    throw new Error('Signature not found');
  }

  await browser.storage.local.set({ [STORAGE_KEY]: filtered });
}

/**
 * Get a signature by ID
 * @param {string} signatureId - ID of signature to get
 * @returns {Promise<Signature|null>}
 */
export async function getSignature(signatureId) {
  const signatures = await loadSignatures();
  return signatures.find(sig => sig.id === signatureId) || null;
}

/**
 * Update a signature's default dimensions
 * @param {string} signatureId - ID of signature to update
 * @param {number} width - New default width
 * @param {number} height - New default height
 * @returns {Promise<void>}
 */
export async function updateSignatureDimensions(signatureId, width, height) {
  const signatures = await loadSignatures();
  const index = signatures.findIndex(sig => sig.id === signatureId);

  if (index === -1) {
    throw new Error('Signature not found');
  }

  signatures[index].width = width;
  signatures[index].height = height;

  await browser.storage.local.set({ [STORAGE_KEY]: signatures });
}

/**
 * Insert a signature into a PDF
 * @param {PDFDocument} pdfDoc - The PDF document
 * @param {number} pageIndex - Zero-based page index
 * @param {Signature} signature - The signature to insert
 * @param {Object} position - Position and size
 * @param {number} position.x - X position in points (from left)
 * @param {number} position.y - Y position in points (from bottom)
 * @param {number} position.width - Width in points
 * @param {number} position.height - Height in points
 * @param {number} [position.rotation=0] - Rotation in degrees
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.addTimestamp=false] - Add timestamp below signature
 * @returns {Promise<PDFDocument>} The modified PDF document
 */
export async function insertSignatureIntoPDF(pdfDoc, pageIndex, signature, position, options = {}) {
  // Convert data URL to bytes
  const imageBytes = dataURLToBytes(signature.imageData);

  // Determine image type from data URL
  const imageType = signature.imageData.includes('image/png') ? 'png' : 'jpeg';

  // Insert the signature image
  await insertImageOnPage(pdfDoc, pageIndex, imageBytes, imageType, {
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    rotation: position.rotation || 0,
    opacity: 1
  });

  // Add timestamp if requested
  if (options.addTimestamp) {
    const timestamp = formatTimestamp(new Date());

    await addTextToPage(pdfDoc, pageIndex, `Signed: ${timestamp}`, {
      x: position.x,
      y: position.y - 12, // Below signature
      size: 8,
      color: { r: 0.4, g: 0.4, b: 0.4 }
    });
  }

  return pdfDoc;
}

/**
 * Format a date as a timestamp string
 * @param {Date} date - The date to format
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(date) {
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Check storage usage for signatures
 * @returns {Promise<{used: number, limit: number, signatures: number}>}
 */
export async function getStorageUsage() {
  const signatures = await loadSignatures();

  // Estimate size of stored data
  let totalSize = 0;
  for (const sig of signatures) {
    totalSize += sig.imageData.length;
    totalSize += sig.name.length;
    totalSize += 100; // Rough estimate for other fields
  }

  return {
    used: totalSize,
    limit: 5 * 1024 * 1024, // 5MB typical extension storage limit
    signatures: signatures.length,
    maxSignatures: MAX_SIGNATURES
  };
}

/**
 * Export all signatures as JSON for backup
 * @returns {Promise<string>} JSON string of all signatures
 */
export async function exportSignatures() {
  const signatures = await loadSignatures();
  return JSON.stringify(signatures, null, 2);
}

/**
 * Import signatures from JSON backup
 * @param {string} jsonString - JSON string of signatures
 * @param {boolean} [replace=false] - Replace existing signatures
 * @returns {Promise<number>} Number of signatures imported
 */
export async function importSignatures(jsonString, replace = false) {
  const imported = JSON.parse(jsonString);

  if (!Array.isArray(imported)) {
    throw new Error('Invalid signature backup format');
  }

  // Validate each signature
  for (const sig of imported) {
    if (!sig.id || !sig.name || !sig.imageData) {
      throw new Error('Invalid signature data in backup');
    }
  }

  let signatures;
  if (replace) {
    signatures = imported.slice(0, MAX_SIGNATURES);
  } else {
    const existing = await loadSignatures();
    signatures = [...existing, ...imported].slice(0, MAX_SIGNATURES);
  }

  await browser.storage.local.set({ [STORAGE_KEY]: signatures });

  return imported.length;
}
