/**
 * PDF Tool Extension - Main Popup Script
 * Wires together all modules and handles UI interactions
 */

import { loadPDFFile, exportPDF, exportMultiplePDFs, readFileAsDataURL, validateSignatureImage } from '../src/file-handler.js';
import {
  loadPDFDocument,
  rotatePage,
  deletePages,
  reorderPages,
  extractPages,
  mergePDFs,
  splitPDF,
  getPageCount,
  copyPDFDocument
} from '../src/pdf-operations.js';
import {
  loadSignatures,
  saveSignature,
  deleteSignature,
  insertSignatureIntoPDF
} from '../src/signature-manager.js';
import { applyRedactions } from '../src/redaction.js';
import {
  renderPageThumbnails,
  renderPageForRedaction,
  setupRedactionDrawing,
  renderSignatureLibrary,
  setupSignaturePlacement,
  showLoading,
  hideLoading,
  showAlert,
  showConfirm,
  getSelectedPageIndices,
  updatePageCount
} from '../src/ui-handler.js';

// Global state
const state = {
  pdfDoc: null,        // PDF-lib document
  pdfJsDoc: null,      // PDF.js document
  pdfData: null,       // Original PDF ArrayBuffer
  fileName: null,      // Original filename
  pageOrder: [],       // Current page order
  currentMode: 'pages',
  currentRedactPage: 0,
  redactionBoxes: {},  // Map of page index to boxes
  currentSignPage: 0,
  selectedSignature: null,
  signaturePlacement: null
};

// DOM Elements
const elements = {};

/**
 * Initialize the extension
 */
async function init() {
  // Cache DOM elements
  cacheElements();

  // Setup PDF.js worker
  await setupPdfJs();

  // Setup event listeners
  setupEventListeners();

  // Load saved signatures
  await refreshSignatureLibrary();
}

/**
 * Cache frequently used DOM elements
 */
function cacheElements() {
  elements.uploadArea = document.getElementById('upload-area');
  elements.fileInput = document.getElementById('file-input');
  elements.modeSelector = document.getElementById('mode-selector');
  elements.pageModeBtn = document.getElementById('page-mode-btn');
  elements.redactModeBtn = document.getElementById('redact-mode-btn');
  elements.signatureModeBtn = document.getElementById('signature-mode-btn');
  elements.pageManagement = document.getElementById('page-management');
  elements.pageGrid = document.getElementById('page-grid');
  elements.redactionView = document.getElementById('redaction-view');
  elements.signatureView = document.getElementById('signature-view');
  elements.mergeBtn = document.getElementById('merge-btn');
  elements.splitBtn = document.getElementById('split-btn');
  elements.extractBtn = document.getElementById('extract-btn');
  elements.downloadBtn = document.getElementById('download-btn');
  elements.mergeInput = document.getElementById('merge-input');

  // Redaction elements
  elements.redactPageCanvas = document.getElementById('redaction-page-canvas');
  elements.redactOverlayCanvas = document.getElementById('redaction-overlay-canvas');
  elements.redactPrevPage = document.getElementById('redact-prev-page');
  elements.redactNextPage = document.getElementById('redact-next-page');
  elements.redactPageInfo = document.getElementById('redact-page-info');
  elements.clearBoxesBtn = document.getElementById('clear-boxes-btn');
  elements.applyRedactionBtn = document.getElementById('apply-redaction-btn');

  // Signature elements
  elements.signatureLibrary = document.getElementById('signature-library');
  elements.signatureList = document.getElementById('signature-list');
  elements.addSignatureBtn = document.getElementById('add-signature-btn');
  elements.signatureUploadDialog = document.getElementById('signature-upload-dialog');
  elements.signatureName = document.getElementById('signature-name');
  elements.signatureDropzone = document.getElementById('signature-dropzone');
  elements.signatureFile = document.getElementById('signature-file');
  elements.signaturePreviewContainer = document.getElementById('signature-preview-container');
  elements.signaturePreview = document.getElementById('signature-preview');
  elements.saveSignatureBtn = document.getElementById('save-signature-btn');
  elements.cancelSignatureBtn = document.getElementById('cancel-signature-btn');
  elements.signaturePlacement = document.getElementById('signature-placement');
  elements.signPageCanvas = document.getElementById('signature-page-canvas');
  elements.signOverlayCanvas = document.getElementById('signature-overlay-canvas');
  elements.signPrevPage = document.getElementById('sign-prev-page');
  elements.signNextPage = document.getElementById('sign-next-page');
  elements.signPageInfo = document.getElementById('sign-page-info');
  elements.rotateSigLeft = document.getElementById('rotate-sig-left');
  elements.rotateSigRight = document.getElementById('rotate-sig-right');
  elements.addTimestampCheck = document.getElementById('add-timestamp-check');
  elements.placeSignatureBtn = document.getElementById('place-signature-btn');
  elements.cancelPlacementBtn = document.getElementById('cancel-placement-btn');
}

/**
 * Setup PDF.js library
 */
async function setupPdfJs() {
  // PDF.js is loaded as ES module
  const pdfjsLib = await import('../libs/pdf.min.mjs');

  // Set worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = '../libs/pdf.worker.min.mjs';

  // Store reference globally
  window.pdfjsLib = pdfjsLib;
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // File upload
  elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', handleFileSelect);
  elements.uploadArea.addEventListener('dragover', handleDragOver);
  elements.uploadArea.addEventListener('dragleave', handleDragLeave);
  elements.uploadArea.addEventListener('drop', handleDrop);

  // Mode switching
  elements.pageModeBtn.addEventListener('click', () => switchMode('pages'));
  elements.redactModeBtn.addEventListener('click', () => switchMode('redact'));
  elements.signatureModeBtn.addEventListener('click', () => switchMode('signature'));

  // Page actions
  elements.mergeBtn.addEventListener('click', handleMerge);
  elements.splitBtn.addEventListener('click', handleSplit);
  elements.extractBtn.addEventListener('click', handleExtract);
  elements.downloadBtn.addEventListener('click', handleDownload);
  elements.mergeInput.addEventListener('change', handleMergeFiles);

  // Redaction controls
  elements.redactPrevPage.addEventListener('click', () => navigateRedactPage(-1));
  elements.redactNextPage.addEventListener('click', () => navigateRedactPage(1));
  elements.clearBoxesBtn.addEventListener('click', clearRedactionBoxes);
  elements.applyRedactionBtn.addEventListener('click', applyRedaction);

  // Signature controls
  elements.addSignatureBtn.addEventListener('click', showSignatureDialog);
  elements.signatureDropzone.addEventListener('click', () => elements.signatureFile.click());
  elements.signatureFile.addEventListener('change', handleSignatureFileSelect);
  elements.saveSignatureBtn.addEventListener('click', handleSaveSignature);
  elements.cancelSignatureBtn.addEventListener('click', hideSignatureDialog);
  elements.signPrevPage.addEventListener('click', () => navigateSignPage(-1));
  elements.signNextPage.addEventListener('click', () => navigateSignPage(1));
  elements.rotateSigLeft.addEventListener('click', () => state.signaturePlacement?.rotateLeft());
  elements.rotateSigRight.addEventListener('click', () => state.signaturePlacement?.rotateRight());
  elements.placeSignatureBtn.addEventListener('click', handlePlaceSignature);
  elements.cancelPlacementBtn.addEventListener('click', cancelSignaturePlacement);
}

/**
 * Handle file drag over
 */
function handleDragOver(e) {
  e.preventDefault();
  elements.uploadArea.classList.add('dragover');
}

/**
 * Handle file drag leave
 */
function handleDragLeave() {
  elements.uploadArea.classList.remove('dragover');
}

/**
 * Handle file drop
 */
async function handleDrop(e) {
  e.preventDefault();
  elements.uploadArea.classList.remove('dragover');

  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type === 'application/pdf') {
    await loadPDF(files[0]);
  }
}

/**
 * Handle file selection
 */
async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    await loadPDF(file);
  }
}

/**
 * Load a PDF file
 */
async function loadPDF(file) {
  showLoading('Loading PDF...');

  try {
    // Load file
    const { data, name } = await loadPDFFile(file);
    state.pdfData = data;
    state.fileName = name;

    // Load with PDF-lib
    state.pdfDoc = await loadPDFDocument(data);

    // Load with PDF.js
    state.pdfJsDoc = await window.pdfjsLib.getDocument({ data: data.slice(0) }).promise;

    // Initialize page order
    const pageCount = getPageCount(state.pdfDoc);
    state.pageOrder = Array.from({ length: pageCount }, (_, i) => i);

    // Update UI
    updatePageCount(pageCount);
    elements.uploadArea.classList.add('hidden');
    elements.modeSelector.classList.remove('hidden');

    // Render initial view
    await switchMode('pages');

    hideLoading();
  } catch (error) {
    hideLoading();
    showAlert(`Failed to load PDF: ${error.message}`, 'error');
    console.error('PDF load error:', error);
  }
}

/**
 * Switch between modes
 */
async function switchMode(mode) {
  state.currentMode = mode;

  // Update mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // Hide all views
  elements.pageManagement.classList.add('hidden');
  elements.redactionView.classList.add('hidden');
  elements.signatureView.classList.add('hidden');

  // Show selected view
  switch (mode) {
    case 'pages':
      elements.pageManagement.classList.remove('hidden');
      await renderPages();
      break;
    case 'redact':
      elements.redactionView.classList.remove('hidden');
      state.currentRedactPage = 0;
      await renderRedactionPage();
      break;
    case 'signature':
      elements.signatureView.classList.remove('hidden');
      elements.signatureLibrary.classList.remove('hidden');
      elements.signaturePlacement.classList.add('hidden');
      await refreshSignatureLibrary();
      break;
  }
}

/**
 * Render page thumbnails
 */
async function renderPages() {
  showLoading('Rendering pages...');

  await renderPageThumbnails(state.pdfJsDoc, elements.pageGrid, {
    onRotate: handleRotatePage,
    onDelete: handleDeletePage,
    onSelect: handlePageSelect,
    onReorder: handlePageReorder
  });

  hideLoading();
}

/**
 * Handle page rotation
 */
async function handleRotatePage(pageIndex) {
  showLoading('Rotating page...');

  try {
    state.pdfDoc = rotatePage(state.pdfDoc, pageIndex, 90);

    // Refresh PDF.js document
    const pdfBytes = await state.pdfDoc.save();
    state.pdfJsDoc = await window.pdfjsLib.getDocument({ data: pdfBytes }).promise;

    await renderPages();
  } catch (error) {
    showAlert(`Failed to rotate page: ${error.message}`, 'error');
  }

  hideLoading();
}

/**
 * Handle page deletion
 */
async function handleDeletePage(pageIndex) {
  const pageCount = getPageCount(state.pdfDoc);

  if (pageCount <= 1) {
    showAlert('Cannot delete the last page', 'warning');
    return;
  }

  if (!showConfirm(`Delete page ${pageIndex + 1}?`)) {
    return;
  }

  showLoading('Deleting page...');

  try {
    state.pdfDoc = deletePages(state.pdfDoc, [pageIndex]);

    // Refresh PDF.js document
    const pdfBytes = await state.pdfDoc.save();
    state.pdfJsDoc = await window.pdfjsLib.getDocument({ data: pdfBytes }).promise;

    updatePageCount(getPageCount(state.pdfDoc));
    await renderPages();
  } catch (error) {
    showAlert(`Failed to delete page: ${error.message}`, 'error');
  }

  hideLoading();
}

/**
 * Handle page selection
 */
function handlePageSelect(pageIndex, selected) {
  // Selection state is managed by UI handler
}

/**
 * Handle page reordering
 */
async function handlePageReorder(fromIndex, toIndex) {
  showLoading('Reordering pages...');

  try {
    // Build new order
    const pageCount = getPageCount(state.pdfDoc);
    const newOrder = Array.from({ length: pageCount }, (_, i) => i);

    // Move page from fromIndex to toIndex
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);

    // Reorder PDF
    state.pdfDoc = await reorderPages(state.pdfDoc, newOrder);

    // Refresh PDF.js document
    const pdfBytes = await state.pdfDoc.save();
    state.pdfJsDoc = await window.pdfjsLib.getDocument({ data: pdfBytes }).promise;

    await renderPages();
  } catch (error) {
    showAlert(`Failed to reorder pages: ${error.message}`, 'error');
  }

  hideLoading();
}

/**
 * Handle merge button click
 */
function handleMerge() {
  elements.mergeInput.click();
}

/**
 * Handle merge file selection
 */
async function handleMergeFiles(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  showLoading('Merging PDFs...');

  try {
    // Load additional PDFs
    const additionalDocs = [];
    for (const file of files) {
      const { data } = await loadPDFFile(file);
      const doc = await loadPDFDocument(data);
      additionalDocs.push(doc);
    }

    // Merge with current document
    state.pdfDoc = await mergePDFs([state.pdfDoc, ...additionalDocs]);

    // Refresh PDF.js document
    const pdfBytes = await state.pdfDoc.save();
    state.pdfJsDoc = await window.pdfjsLib.getDocument({ data: pdfBytes }).promise;

    updatePageCount(getPageCount(state.pdfDoc));
    await renderPages();

    showAlert(`Merged ${files.length} PDF(s) successfully`, 'success');
  } catch (error) {
    showAlert(`Failed to merge: ${error.message}`, 'error');
  }

  // Clear input
  elements.mergeInput.value = '';
  hideLoading();
}

/**
 * Handle split button click
 */
async function handleSplit() {
  const pageCount = getPageCount(state.pdfDoc);

  if (!showConfirm(`Split into ${pageCount} individual PDF files?`)) {
    return;
  }

  showLoading('Splitting PDF...');

  try {
    const splitDocs = await splitPDF(state.pdfDoc);
    const baseName = state.fileName.replace('.pdf', '');
    await exportMultiplePDFs(splitDocs, baseName);

    showAlert(`Split into ${pageCount} files`, 'success');
  } catch (error) {
    showAlert(`Failed to split: ${error.message}`, 'error');
  }

  hideLoading();
}

/**
 * Handle extract button click
 */
async function handleExtract() {
  const selectedIndices = getSelectedPageIndices(elements.pageGrid);

  if (selectedIndices.length === 0) {
    showAlert('Please select pages to extract', 'warning');
    return;
  }

  showLoading('Extracting pages...');

  try {
    const extractedDoc = await extractPages(state.pdfDoc, selectedIndices);
    const baseName = state.fileName.replace('.pdf', '');
    await exportPDF(extractedDoc, `${baseName}_extracted.pdf`);

    showAlert(`Extracted ${selectedIndices.length} page(s)`, 'success');
  } catch (error) {
    showAlert(`Failed to extract: ${error.message}`, 'error');
  }

  hideLoading();
}

/**
 * Handle download button click
 */
async function handleDownload() {
  showLoading('Preparing download...');

  try {
    await exportPDF(state.pdfDoc, state.fileName);
  } catch (error) {
    showAlert(`Failed to download: ${error.message}`, 'error');
  }

  hideLoading();
}

// ============ Redaction Functions ============

/**
 * Render current redaction page
 */
async function renderRedactionPage() {
  const pageCount = getPageCount(state.pdfDoc);
  elements.redactPageInfo.textContent = `Page ${state.currentRedactPage + 1} of ${pageCount}`;
  elements.redactPrevPage.disabled = state.currentRedactPage === 0;
  elements.redactNextPage.disabled = state.currentRedactPage >= pageCount - 1;

  // Get PDF.js page (1-indexed)
  const pdfJsPage = await state.pdfJsDoc.getPage(state.currentRedactPage + 1);

  // Render page
  await renderPageForRedaction(
    pdfJsPage,
    elements.redactPageCanvas,
    elements.redactOverlayCanvas
  );

  // Initialize redaction boxes for this page if not exists
  if (!state.redactionBoxes[state.currentRedactPage]) {
    state.redactionBoxes[state.currentRedactPage] = [];
  }

  // Setup drawing
  const boxState = { boxes: state.redactionBoxes[state.currentRedactPage] };
  setupRedactionDrawing(elements.redactOverlayCanvas, boxState, (boxes) => {
    state.redactionBoxes[state.currentRedactPage] = boxes;
  });
}

/**
 * Navigate redaction pages
 */
function navigateRedactPage(delta) {
  const newPage = state.currentRedactPage + delta;
  const pageCount = getPageCount(state.pdfDoc);

  if (newPage >= 0 && newPage < pageCount) {
    state.currentRedactPage = newPage;
    renderRedactionPage();
  }
}

/**
 * Clear redaction boxes on current page
 */
function clearRedactionBoxes() {
  state.redactionBoxes[state.currentRedactPage] = [];
  renderRedactionPage();
}

/**
 * Apply redaction to PDF
 */
async function applyRedaction() {
  // Check if there are any redaction boxes
  const hasRedactions = Object.values(state.redactionBoxes).some(boxes => boxes && boxes.length > 0);

  if (!hasRedactions) {
    showAlert('No redaction boxes drawn. Draw boxes on areas you want to redact.', 'warning');
    return;
  }

  if (!showConfirm('Apply redaction? This will convert affected pages to images and cannot be undone.')) {
    return;
  }

  showLoading('Applying redaction...');

  try {
    // Make a copy to work with
    state.pdfDoc = await copyPDFDocument(state.pdfDoc);

    // Apply redactions
    await applyRedactions(state.pdfDoc, state.pdfJsDoc, state.redactionBoxes, (current, total) => {
      showLoading(`Redacting page ${current} of ${total}...`);
    });

    // Refresh PDF.js document
    const pdfBytes = await state.pdfDoc.save();
    state.pdfJsDoc = await window.pdfjsLib.getDocument({ data: pdfBytes }).promise;

    // Clear redaction boxes
    state.redactionBoxes = {};

    // Re-render current page
    await renderRedactionPage();

    showAlert('Redaction applied successfully. Verify the result and download.', 'success');
  } catch (error) {
    showAlert(`Redaction failed: ${error.message}`, 'error');
    console.error('Redaction error:', error);
  }

  hideLoading();
}

// ============ Signature Functions ============

/**
 * Refresh signature library display
 */
async function refreshSignatureLibrary() {
  const signatures = await loadSignatures();

  renderSignatureLibrary(signatures, elements.signatureList, {
    onSelect: handleSignatureSelect,
    onDelete: handleSignatureDelete
  });
}

/**
 * Handle signature selection
 */
async function handleSignatureSelect(signature) {
  state.selectedSignature = signature;

  // Show placement view if PDF is loaded
  if (state.pdfDoc) {
    elements.signatureLibrary.classList.add('hidden');
    elements.signaturePlacement.classList.remove('hidden');
    state.currentSignPage = 0;
    await renderSignaturePage();
  }
}

/**
 * Handle signature deletion
 */
async function handleSignatureDelete(signatureId) {
  if (!showConfirm('Delete this signature?')) {
    return;
  }

  try {
    await deleteSignature(signatureId);
    await refreshSignatureLibrary();
  } catch (error) {
    showAlert(`Failed to delete: ${error.message}`, 'error');
  }
}

/**
 * Show signature upload dialog
 */
function showSignatureDialog() {
  elements.signatureUploadDialog.classList.remove('hidden');
  elements.signatureName.value = '';
  elements.signatureFile.value = '';
  elements.signaturePreviewContainer.classList.add('hidden');
}

/**
 * Hide signature upload dialog
 */
function hideSignatureDialog() {
  elements.signatureUploadDialog.classList.add('hidden');
}

/**
 * Handle signature file selection
 */
async function handleSignatureFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const validation = validateSignatureImage(file);
  if (!validation.valid) {
    showAlert(validation.error, 'error');
    return;
  }

  const dataURL = await readFileAsDataURL(file);
  elements.signaturePreview.src = dataURL;
  elements.signaturePreviewContainer.classList.remove('hidden');
}

/**
 * Handle save signature button
 */
async function handleSaveSignature() {
  const name = elements.signatureName.value.trim();
  const file = elements.signatureFile.files[0];

  if (!file) {
    showAlert('Please select an image file', 'warning');
    return;
  }

  showLoading('Saving signature...');

  try {
    await saveSignature(name || 'Signature', file);
    hideSignatureDialog();
    await refreshSignatureLibrary();
    showAlert('Signature saved', 'success');
  } catch (error) {
    showAlert(`Failed to save: ${error.message}`, 'error');
  }

  hideLoading();
}

/**
 * Render signature placement page
 */
async function renderSignaturePage() {
  const pageCount = getPageCount(state.pdfDoc);
  elements.signPageInfo.textContent = `Page ${state.currentSignPage + 1} of ${pageCount}`;
  elements.signPrevPage.disabled = state.currentSignPage === 0;
  elements.signNextPage.disabled = state.currentSignPage >= pageCount - 1;

  // Get PDF.js page (1-indexed)
  const pdfJsPage = await state.pdfJsDoc.getPage(state.currentSignPage + 1);

  // Render page
  await renderPageForRedaction(
    pdfJsPage,
    elements.signPageCanvas,
    elements.signOverlayCanvas
  );

  // Setup signature placement
  const placementState = {};
  state.signaturePlacement = setupSignaturePlacement(
    elements.signPageCanvas,
    elements.signOverlayCanvas,
    state.selectedSignature,
    placementState
  );
}

/**
 * Navigate signature pages
 */
function navigateSignPage(delta) {
  const newPage = state.currentSignPage + delta;
  const pageCount = getPageCount(state.pdfDoc);

  if (newPage >= 0 && newPage < pageCount) {
    state.currentSignPage = newPage;
    renderSignaturePage();
  }
}

/**
 * Handle place signature button
 */
async function handlePlaceSignature() {
  if (!state.signaturePlacement || !state.selectedSignature) {
    return;
  }

  showLoading('Placing signature...');

  try {
    const placement = state.signaturePlacement.getPlacement();
    const addTimestamp = elements.addTimestampCheck.checked;

    // Get the scale factor to convert from canvas to PDF coordinates
    const pdfJsPage = await state.pdfJsDoc.getPage(state.currentSignPage + 1);
    const viewport = pdfJsPage.getViewport({ scale: 1 });
    const canvasScale = elements.signPageCanvas.width / viewport.width;

    // Convert canvas coordinates to PDF coordinates
    const pdfPlacement = {
      x: placement.x / canvasScale,
      y: placement.y / canvasScale,
      width: placement.width / canvasScale,
      height: placement.height / canvasScale,
      rotation: placement.rotation
    };

    await insertSignatureIntoPDF(
      state.pdfDoc,
      state.currentSignPage,
      state.selectedSignature,
      pdfPlacement,
      { addTimestamp }
    );

    // Refresh PDF.js document
    const pdfBytes = await state.pdfDoc.save();
    state.pdfJsDoc = await window.pdfjsLib.getDocument({ data: pdfBytes }).promise;

    // Re-render page
    await renderSignaturePage();

    showAlert('Signature placed. Add more or download the PDF.', 'success');
  } catch (error) {
    showAlert(`Failed to place signature: ${error.message}`, 'error');
    console.error('Signature placement error:', error);
  }

  hideLoading();
}

/**
 * Cancel signature placement
 */
function cancelSignaturePlacement() {
  state.selectedSignature = null;
  state.signaturePlacement = null;
  elements.signaturePlacement.classList.add('hidden');
  elements.signatureLibrary.classList.remove('hidden');

  // Clear selection in library
  elements.signatureList.querySelectorAll('.signature-item').forEach(item => {
    item.classList.remove('selected');
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
