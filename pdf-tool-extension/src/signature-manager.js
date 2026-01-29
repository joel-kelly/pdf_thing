/**
 * Signature Manager Module
 * Manages signature storage and insertion into PDFs
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'signatures';
  const MAX_SIGNATURES = 10;

  /**
   * Load all signatures from storage
   */
  async function loadSignatures() {
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
   */
  async function saveSignature(name, imageFile) {
    const validation = window.FileHandler.validateSignatureImage(imageFile);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const imageData = await window.FileHandler.readFileAsDataURL(imageFile);
    const dimensions = await window.FileHandler.getImageDimensions(imageData);

    const scale = 72 / 96;
    const width = dimensions.width * scale;
    const height = dimensions.height * scale;

    const signature = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim() || 'Unnamed Signature',
      imageData: imageData,
      width: Math.min(width, 200),
      height: Math.min(height, 100),
      created: new Date().toISOString()
    };

    const signatures = await loadSignatures();

    if (signatures.length >= MAX_SIGNATURES) {
      throw new Error(`Maximum of ${MAX_SIGNATURES} signatures allowed. Please delete an existing signature first.`);
    }

    signatures.push(signature);
    await browser.storage.local.set({ [STORAGE_KEY]: signatures });

    return signature;
  }

  /**
   * Delete a signature by ID
   */
  async function deleteSignature(signatureId) {
    const signatures = await loadSignatures();
    const filtered = signatures.filter(sig => sig.id !== signatureId);

    if (filtered.length === signatures.length) {
      throw new Error('Signature not found');
    }

    await browser.storage.local.set({ [STORAGE_KEY]: filtered });
  }

  /**
   * Get a signature by ID
   */
  async function getSignature(signatureId) {
    const signatures = await loadSignatures();
    return signatures.find(sig => sig.id === signatureId) || null;
  }

  /**
   * Insert a signature into a PDF
   */
  async function insertSignatureIntoPDF(pdfDoc, pageIndex, signature, position, options = {}) {
    const imageBytes = window.FileHandler.dataURLToBytes(signature.imageData);
    const imageType = signature.imageData.includes('image/png') ? 'png' : 'jpeg';

    await window.PDFOperations.insertImageOnPage(pdfDoc, pageIndex, imageBytes, imageType, {
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
      rotation: position.rotation || 0,
      opacity: 1
    });

    if (options.addTimestamp) {
      const timestamp = formatTimestamp(new Date());

      await window.PDFOperations.addTextToPage(pdfDoc, pageIndex, `Signed: ${timestamp}`, {
        x: position.x,
        y: position.y - 12,
        size: 8,
        color: { r: 0.4, g: 0.4, b: 0.4 }
      });
    }

    return pdfDoc;
  }

  /**
   * Format a date as a timestamp string
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

  // Expose to global scope
  window.SignatureManager = {
    loadSignatures,
    saveSignature,
    deleteSignature,
    getSignature,
    insertSignatureIntoPDF
  };
})();
