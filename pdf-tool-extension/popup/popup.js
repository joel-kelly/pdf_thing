/**
 * PDF Tool Extension - Main Popup Script
 * Wires together all modules and handles UI interactions
 */

(function() {
  'use strict';

  // Global state
  var state = {
    pdfDoc: null,
    pdfJsDoc: null,
    pdfData: null,
    fileName: null,
    pageOrder: [],
    currentMode: 'pages',
    currentRedactPage: 0,
    redactionBoxes: {},
    currentSignPage: 0,
    selectedSignature: null,
    signaturePlacement: null
  };

  // DOM Elements
  var elements = {};

  /**
   * Initialize the extension
   */
  function init() {
    console.log('PDF Tool initializing...');

    // Check if libraries are loaded
    if (typeof window.pdfjsLib === 'undefined') {
      console.error('PDF.js not loaded yet');
      return;
    }
    if (typeof window.PDFLib === 'undefined') {
      console.error('PDF-lib not loaded');
      return;
    }

    // Cache DOM elements
    cacheElements();

    // Prevent default drag behavior on the entire document
    setupGlobalDragPrevention();

    // Setup event listeners
    setupEventListeners();

    // Load saved signatures
    refreshSignatureLibrary();

    console.log('PDF Tool ready!');
  }

  /**
   * Prevent default drag/drop on document to stop Firefox from opening files
   */
  function setupGlobalDragPrevention() {
    // Prevent default drag behaviors on document
    document.addEventListener('dragenter', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });
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

    elements.redactPageCanvas = document.getElementById('redaction-page-canvas');
    elements.redactOverlayCanvas = document.getElementById('redaction-overlay-canvas');
    elements.redactPrevPage = document.getElementById('redact-prev-page');
    elements.redactNextPage = document.getElementById('redact-next-page');
    elements.redactPageInfo = document.getElementById('redact-page-info');
    elements.clearBoxesBtn = document.getElementById('clear-boxes-btn');
    elements.applyRedactionBtn = document.getElementById('apply-redaction-btn');

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
    elements.signaturePlacementEl = document.getElementById('signature-placement');
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

    // Log if any elements are missing
    Object.keys(elements).forEach(function(key) {
      if (!elements[key]) {
        console.warn('Element not found:', key);
      }
    });
  }

  /**
   * Setup all event listeners
   */
  function setupEventListeners() {
    // File upload - click
    elements.uploadArea.addEventListener('click', function(e) {
      console.log('Upload area clicked');
      elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', function(e) {
      console.log('File input changed', e.target.files);
      handleFileSelect(e);
    });

    // File upload - drag and drop on upload area
    elements.uploadArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      elements.uploadArea.classList.add('dragover');
    });

    elements.uploadArea.addEventListener('dragleave', function(e) {
      e.preventDefault();
      e.stopPropagation();
      elements.uploadArea.classList.remove('dragover');
    });

    elements.uploadArea.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      elements.uploadArea.classList.remove('dragover');
      console.log('File dropped', e.dataTransfer.files);
      handleDrop(e);
    });

    // Mode buttons
    elements.pageModeBtn.addEventListener('click', function() { switchMode('pages'); });
    elements.redactModeBtn.addEventListener('click', function() { switchMode('redact'); });
    elements.signatureModeBtn.addEventListener('click', function() { switchMode('signature'); });

    // Page action buttons
    elements.mergeBtn.addEventListener('click', handleMerge);
    elements.splitBtn.addEventListener('click', handleSplit);
    elements.extractBtn.addEventListener('click', handleExtract);
    elements.downloadBtn.addEventListener('click', handleDownload);
    elements.mergeInput.addEventListener('change', handleMergeFiles);

    // Redaction controls
    elements.redactPrevPage.addEventListener('click', function() { navigateRedactPage(-1); });
    elements.redactNextPage.addEventListener('click', function() { navigateRedactPage(1); });
    elements.clearBoxesBtn.addEventListener('click', clearRedactionBoxes);
    elements.applyRedactionBtn.addEventListener('click', applyRedaction);

    // Signature controls
    elements.addSignatureBtn.addEventListener('click', showSignatureDialog);
    elements.signatureDropzone.addEventListener('click', function() {
      elements.signatureFile.click();
    });
    elements.signatureFile.addEventListener('change', handleSignatureFileSelect);
    elements.saveSignatureBtn.addEventListener('click', handleSaveSignature);
    elements.cancelSignatureBtn.addEventListener('click', hideSignatureDialog);
    elements.signPrevPage.addEventListener('click', function() { navigateSignPage(-1); });
    elements.signNextPage.addEventListener('click', function() { navigateSignPage(1); });
    elements.rotateSigLeft.addEventListener('click', function() {
      if (state.signaturePlacement) state.signaturePlacement.rotateLeft();
    });
    elements.rotateSigRight.addEventListener('click', function() {
      if (state.signaturePlacement) state.signaturePlacement.rotateRight();
    });
    elements.placeSignatureBtn.addEventListener('click', handlePlaceSignature);
    elements.cancelPlacementBtn.addEventListener('click', cancelSignaturePlacement);

    console.log('Event listeners attached');
  }

  function handleDrop(e) {
    var files = e.dataTransfer.files;
    if (files.length > 0) {
      var file = files[0];
      console.log('Dropped file:', file.name, file.type);
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        loadPDF(file);
      } else {
        alert('Please drop a PDF file');
      }
    }
  }

  function handleFileSelect(e) {
    var file = e.target.files[0];
    if (file) {
      console.log('Selected file:', file.name);
      loadPDF(file);
    }
  }

  function loadPDF(file) {
    console.log('Loading PDF:', file.name);
    window.UIHandler.showLoading('Loading PDF...');

    window.FileHandler.loadPDFFile(file)
      .then(function(result) {
        console.log('File read successfully');
        state.pdfData = result.data;
        state.fileName = result.name;

        return window.PDFOperations.loadPDFDocument(result.data);
      })
      .then(function(pdfDoc) {
        console.log('PDF-lib loaded document');
        state.pdfDoc = pdfDoc;

        // Load with PDF.js
        return window.pdfjsLib.getDocument({ data: state.pdfData.slice(0) }).promise;
      })
      .then(function(pdfJsDoc) {
        console.log('PDF.js loaded document, pages:', pdfJsDoc.numPages);
        state.pdfJsDoc = pdfJsDoc;

        var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
        state.pageOrder = [];
        for (var i = 0; i < pageCount; i++) {
          state.pageOrder.push(i);
        }

        window.UIHandler.updatePageCount(pageCount);
        elements.uploadArea.classList.add('hidden');
        elements.modeSelector.classList.remove('hidden');

        return switchMode('pages');
      })
      .then(function() {
        window.UIHandler.hideLoading();
      })
      .catch(function(error) {
        window.UIHandler.hideLoading();
        console.error('PDF load error:', error);
        alert('Failed to load PDF: ' + error.message);
      });
  }

  function switchMode(mode) {
    state.currentMode = mode;

    document.querySelectorAll('.mode-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    elements.pageManagement.classList.add('hidden');
    elements.redactionView.classList.add('hidden');
    elements.signatureView.classList.add('hidden');

    if (mode === 'pages') {
      elements.pageManagement.classList.remove('hidden');
      return renderPages();
    } else if (mode === 'redact') {
      elements.redactionView.classList.remove('hidden');
      state.currentRedactPage = 0;
      return renderRedactionPage();
    } else if (mode === 'signature') {
      elements.signatureView.classList.remove('hidden');
      elements.signatureLibrary.classList.remove('hidden');
      elements.signaturePlacementEl.classList.add('hidden');
      return refreshSignatureLibrary();
    }

    return Promise.resolve();
  }

  function renderPages() {
    window.UIHandler.showLoading('Rendering pages...');

    return window.UIHandler.renderPageThumbnails(state.pdfJsDoc, elements.pageGrid, {
      onRotate: handleRotatePage,
      onDelete: handleDeletePage,
      onSelect: handlePageSelect,
      onReorder: handlePageReorder
    }).then(function() {
      window.UIHandler.hideLoading();
    });
  }

  function handleRotatePage(pageIndex) {
    window.UIHandler.showLoading('Rotating page...');

    try {
      state.pdfDoc = window.PDFOperations.rotatePage(state.pdfDoc, pageIndex, 90);

      state.pdfDoc.save()
        .then(function(pdfBytes) {
          return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
        })
        .then(function(pdfJsDoc) {
          state.pdfJsDoc = pdfJsDoc;
          return renderPages();
        })
        .catch(function(error) {
          alert('Failed to rotate page: ' + error.message);
          window.UIHandler.hideLoading();
        });
    } catch (error) {
      alert('Failed to rotate page: ' + error.message);
      window.UIHandler.hideLoading();
    }
  }

  function handleDeletePage(pageIndex) {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);

    if (pageCount <= 1) {
      alert('Cannot delete the last page');
      return;
    }

    if (!confirm('Delete page ' + (pageIndex + 1) + '?')) {
      return;
    }

    window.UIHandler.showLoading('Deleting page...');

    try {
      state.pdfDoc = window.PDFOperations.deletePages(state.pdfDoc, [pageIndex]);

      state.pdfDoc.save()
        .then(function(pdfBytes) {
          return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
        })
        .then(function(pdfJsDoc) {
          state.pdfJsDoc = pdfJsDoc;
          window.UIHandler.updatePageCount(window.PDFOperations.getPageCount(state.pdfDoc));
          return renderPages();
        })
        .catch(function(error) {
          alert('Failed to delete page: ' + error.message);
          window.UIHandler.hideLoading();
        });
    } catch (error) {
      alert('Failed to delete page: ' + error.message);
      window.UIHandler.hideLoading();
    }
  }

  function handlePageSelect(pageIndex, selected) {
    // Selection state is managed by UI handler
  }

  function handlePageReorder(fromIndex, toIndex) {
    window.UIHandler.showLoading('Reordering pages...');

    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
    var newOrder = [];
    for (var i = 0; i < pageCount; i++) {
      newOrder.push(i);
    }

    var removed = newOrder.splice(fromIndex, 1)[0];
    newOrder.splice(toIndex, 0, removed);

    window.PDFOperations.reorderPages(state.pdfDoc, newOrder)
      .then(function(newPdfDoc) {
        state.pdfDoc = newPdfDoc;
        return state.pdfDoc.save();
      })
      .then(function(pdfBytes) {
        return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
      })
      .then(function(pdfJsDoc) {
        state.pdfJsDoc = pdfJsDoc;
        return renderPages();
      })
      .catch(function(error) {
        alert('Failed to reorder pages: ' + error.message);
        window.UIHandler.hideLoading();
      });
  }

  function handleMerge() {
    elements.mergeInput.click();
  }

  function handleMergeFiles(e) {
    var files = Array.from(e.target.files);
    if (files.length === 0) return;

    window.UIHandler.showLoading('Merging PDFs...');

    var additionalDocs = [];
    var loadPromise = Promise.resolve();

    files.forEach(function(file) {
      loadPromise = loadPromise
        .then(function() {
          return window.FileHandler.loadPDFFile(file);
        })
        .then(function(result) {
          return window.PDFOperations.loadPDFDocument(result.data);
        })
        .then(function(doc) {
          additionalDocs.push(doc);
        });
    });

    loadPromise
      .then(function() {
        return window.PDFOperations.mergePDFs([state.pdfDoc].concat(additionalDocs));
      })
      .then(function(mergedDoc) {
        state.pdfDoc = mergedDoc;
        return state.pdfDoc.save();
      })
      .then(function(pdfBytes) {
        return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
      })
      .then(function(pdfJsDoc) {
        state.pdfJsDoc = pdfJsDoc;
        window.UIHandler.updatePageCount(window.PDFOperations.getPageCount(state.pdfDoc));
        return renderPages();
      })
      .then(function() {
        alert('Merged ' + files.length + ' PDF(s) successfully');
      })
      .catch(function(error) {
        alert('Failed to merge: ' + error.message);
      })
      .finally(function() {
        elements.mergeInput.value = '';
        window.UIHandler.hideLoading();
      });
  }

  function handleSplit() {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);

    if (!confirm('Split into ' + pageCount + ' individual PDF files?')) {
      return;
    }

    window.UIHandler.showLoading('Splitting PDF...');

    window.PDFOperations.splitPDF(state.pdfDoc)
      .then(function(splitDocs) {
        var baseName = state.fileName.replace('.pdf', '');
        return window.FileHandler.exportMultiplePDFs(splitDocs, baseName);
      })
      .then(function() {
        alert('Split into ' + pageCount + ' files');
      })
      .catch(function(error) {
        alert('Failed to split: ' + error.message);
      })
      .finally(function() {
        window.UIHandler.hideLoading();
      });
  }

  function handleExtract() {
    var selectedIndices = window.UIHandler.getSelectedPageIndices(elements.pageGrid);

    if (selectedIndices.length === 0) {
      alert('Please select pages to extract');
      return;
    }

    window.UIHandler.showLoading('Extracting pages...');

    window.PDFOperations.extractPages(state.pdfDoc, selectedIndices)
      .then(function(extractedDoc) {
        var baseName = state.fileName.replace('.pdf', '');
        return window.FileHandler.exportPDF(extractedDoc, baseName + '_extracted.pdf');
      })
      .then(function() {
        alert('Extracted ' + selectedIndices.length + ' page(s)');
      })
      .catch(function(error) {
        alert('Failed to extract: ' + error.message);
      })
      .finally(function() {
        window.UIHandler.hideLoading();
      });
  }

  function handleDownload() {
    window.UIHandler.showLoading('Preparing download...');

    window.FileHandler.exportPDF(state.pdfDoc, state.fileName)
      .catch(function(error) {
        alert('Failed to download: ' + error.message);
      })
      .finally(function() {
        window.UIHandler.hideLoading();
      });
  }

  // Redaction functions
  function renderRedactionPage() {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
    elements.redactPageInfo.textContent = 'Page ' + (state.currentRedactPage + 1) + ' of ' + pageCount;
    elements.redactPrevPage.disabled = state.currentRedactPage === 0;
    elements.redactNextPage.disabled = state.currentRedactPage >= pageCount - 1;

    return state.pdfJsDoc.getPage(state.currentRedactPage + 1)
      .then(function(pdfJsPage) {
        return window.UIHandler.renderPageForRedaction(
          pdfJsPage,
          elements.redactPageCanvas,
          elements.redactOverlayCanvas
        );
      })
      .then(function() {
        if (!state.redactionBoxes[state.currentRedactPage]) {
          state.redactionBoxes[state.currentRedactPage] = [];
        }

        var boxState = { boxes: state.redactionBoxes[state.currentRedactPage] };
        window.UIHandler.setupRedactionDrawing(elements.redactOverlayCanvas, boxState, function(boxes) {
          state.redactionBoxes[state.currentRedactPage] = boxes;
        });
      });
  }

  function navigateRedactPage(delta) {
    var newPage = state.currentRedactPage + delta;
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);

    if (newPage >= 0 && newPage < pageCount) {
      state.currentRedactPage = newPage;
      renderRedactionPage();
    }
  }

  function clearRedactionBoxes() {
    state.redactionBoxes[state.currentRedactPage] = [];
    renderRedactionPage();
  }

  function applyRedaction() {
    var hasRedactions = Object.keys(state.redactionBoxes).some(function(key) {
      var boxes = state.redactionBoxes[key];
      return boxes && boxes.length > 0;
    });

    if (!hasRedactions) {
      alert('No redaction boxes drawn. Draw boxes on areas you want to redact.');
      return;
    }

    if (!confirm('Apply redaction? This will convert affected pages to images and cannot be undone.')) {
      return;
    }

    window.UIHandler.showLoading('Applying redaction...');

    window.PDFOperations.copyPDFDocument(state.pdfDoc)
      .then(function(pdfDocCopy) {
        state.pdfDoc = pdfDocCopy;
        return window.Redaction.applyRedactions(state.pdfDoc, state.pdfJsDoc, state.redactionBoxes, function(current, total) {
          window.UIHandler.showLoading('Redacting page ' + current + ' of ' + total + '...');
        });
      })
      .then(function() {
        return state.pdfDoc.save();
      })
      .then(function(pdfBytes) {
        return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
      })
      .then(function(pdfJsDoc) {
        state.pdfJsDoc = pdfJsDoc;
        state.redactionBoxes = {};
        return renderRedactionPage();
      })
      .then(function() {
        alert('Redaction applied successfully. Verify the result and download.');
      })
      .catch(function(error) {
        alert('Redaction failed: ' + error.message);
        console.error('Redaction error:', error);
      })
      .finally(function() {
        window.UIHandler.hideLoading();
      });
  }

  // Signature functions
  function refreshSignatureLibrary() {
    return window.SignatureManager.loadSignatures()
      .then(function(signatures) {
        window.UIHandler.renderSignatureLibrary(signatures, elements.signatureList, {
          onSelect: handleSignatureSelect,
          onDelete: handleSignatureDelete
        });
      });
  }

  function handleSignatureSelect(signature) {
    state.selectedSignature = signature;

    if (state.pdfDoc) {
      elements.signatureLibrary.classList.add('hidden');
      elements.signaturePlacementEl.classList.remove('hidden');
      state.currentSignPage = 0;
      renderSignaturePage();
    }
  }

  function handleSignatureDelete(signatureId) {
    if (!confirm('Delete this signature?')) {
      return;
    }

    window.SignatureManager.deleteSignature(signatureId)
      .then(function() {
        return refreshSignatureLibrary();
      })
      .catch(function(error) {
        alert('Failed to delete: ' + error.message);
      });
  }

  function showSignatureDialog() {
    elements.signatureUploadDialog.classList.remove('hidden');
    elements.signatureName.value = '';
    elements.signatureFile.value = '';
    elements.signaturePreviewContainer.classList.add('hidden');
  }

  function hideSignatureDialog() {
    elements.signatureUploadDialog.classList.add('hidden');
  }

  function handleSignatureFileSelect(e) {
    var file = e.target.files[0];
    if (!file) return;

    var validation = window.FileHandler.validateSignatureImage(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    window.FileHandler.readFileAsDataURL(file)
      .then(function(dataURL) {
        elements.signaturePreview.src = dataURL;
        elements.signaturePreviewContainer.classList.remove('hidden');
      });
  }

  function handleSaveSignature() {
    var name = elements.signatureName.value.trim();
    var file = elements.signatureFile.files[0];

    if (!file) {
      alert('Please select an image file');
      return;
    }

    window.UIHandler.showLoading('Saving signature...');

    window.SignatureManager.saveSignature(name || 'Signature', file)
      .then(function() {
        hideSignatureDialog();
        return refreshSignatureLibrary();
      })
      .then(function() {
        alert('Signature saved');
      })
      .catch(function(error) {
        alert('Failed to save: ' + error.message);
      })
      .finally(function() {
        window.UIHandler.hideLoading();
      });
  }

  function renderSignaturePage() {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
    elements.signPageInfo.textContent = 'Page ' + (state.currentSignPage + 1) + ' of ' + pageCount;
    elements.signPrevPage.disabled = state.currentSignPage === 0;
    elements.signNextPage.disabled = state.currentSignPage >= pageCount - 1;

    return state.pdfJsDoc.getPage(state.currentSignPage + 1)
      .then(function(pdfJsPage) {
        return window.UIHandler.renderPageForRedaction(
          pdfJsPage,
          elements.signPageCanvas,
          elements.signOverlayCanvas
        );
      })
      .then(function() {
        var placementState = {};
        state.signaturePlacement = window.UIHandler.setupSignaturePlacement(
          elements.signPageCanvas,
          elements.signOverlayCanvas,
          state.selectedSignature,
          placementState
        );
      });
  }

  function navigateSignPage(delta) {
    var newPage = state.currentSignPage + delta;
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);

    if (newPage >= 0 && newPage < pageCount) {
      state.currentSignPage = newPage;
      renderSignaturePage();
    }
  }

  function handlePlaceSignature() {
    if (!state.signaturePlacement || !state.selectedSignature) {
      return;
    }

    window.UIHandler.showLoading('Placing signature...');

    var placement = state.signaturePlacement.getPlacement();
    var addTimestamp = elements.addTimestampCheck.checked;

    state.pdfJsDoc.getPage(state.currentSignPage + 1)
      .then(function(pdfJsPage) {
        var viewport = pdfJsPage.getViewport({ scale: 1 });
        var canvasScale = elements.signPageCanvas.width / viewport.width;

        var pdfPlacement = {
          x: placement.x / canvasScale,
          y: placement.y / canvasScale,
          width: placement.width / canvasScale,
          height: placement.height / canvasScale,
          rotation: placement.rotation
        };

        return window.SignatureManager.insertSignatureIntoPDF(
          state.pdfDoc,
          state.currentSignPage,
          state.selectedSignature,
          pdfPlacement,
          { addTimestamp: addTimestamp }
        );
      })
      .then(function() {
        return state.pdfDoc.save();
      })
      .then(function(pdfBytes) {
        return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
      })
      .then(function(pdfJsDoc) {
        state.pdfJsDoc = pdfJsDoc;
        return renderSignaturePage();
      })
      .then(function() {
        alert('Signature placed. Add more or download the PDF.');
      })
      .catch(function(error) {
        alert('Failed to place signature: ' + error.message);
        console.error('Signature placement error:', error);
      })
      .finally(function() {
        window.UIHandler.hideLoading();
      });
  }

  function cancelSignaturePlacement() {
    state.selectedSignature = null;
    state.signaturePlacement = null;
    elements.signaturePlacementEl.classList.add('hidden');
    elements.signatureLibrary.classList.remove('hidden');

    elements.signatureList.querySelectorAll('.signature-item').forEach(function(item) {
      item.classList.remove('selected');
    });
  }

  // Wait for libraries to be ready
  // The module script fires 'libs-ready' after PDF.js is loaded
  window.addEventListener('libs-ready', function() {
    console.log('libs-ready event received');
    init();
  });

  // Fallback: if libs-ready already fired or module loaded before this script
  // Check after a short delay
  setTimeout(function() {
    if (window.pdfjsLib && !window._pdfToolInitialized) {
      console.log('Fallback init - pdfjsLib already available');
      window._pdfToolInitialized = true;
      init();
    }
  }, 100);

})();
