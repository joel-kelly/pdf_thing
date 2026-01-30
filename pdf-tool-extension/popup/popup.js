/**
 * PDF Tool Extension - Main Popup Script
 * Orchestrates all modules and handles UI interactions
 */

(function() {
  'use strict';

  // Global state
  var state = {
    pdfDoc: null,
    pdfJsDoc: null,
    pdfData: null,
    fileName: null,
    viewer: null,
    toolsPanel: null,
    modalManager: null
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

    // Initialize modal manager
    state.modalManager = window.ModalManager.init();

    // Initialize tools panel with callbacks
    state.toolsPanel = window.ToolsPanel.init({
      onRotatePage: handleRotatePage,
      onDeletePage: handleDeletePage,
      onExtractPage: handleExtractPage,
      onMerge: handleMerge,
      onSplit: handleSplit,
      onReorder: handleReorder,
      onRedactModeEnable: handleRedactModeEnable,
      onRedactModeDisable: handleRedactModeDisable,
      onApplyRedaction: handleApplyRedaction,
      onClearRedactions: handleClearRedactions,
      onAddSignature: handleAddSignature,
      onSelectSignature: handleSelectSignature,
      onDownload: handleDownload
    });

    console.log('PDF Tool ready!');
  }

  /**
   * Prevent default drag/drop on document to stop Firefox from opening files
   */
  function setupGlobalDragPrevention() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function(eventName) {
      document.addEventListener(eventName, function(e) {
        e.preventDefault();
        e.stopPropagation();
      });
    });
  }

  /**
   * Cache frequently used DOM elements
   */
  function cacheElements() {
    elements.uploadArea = document.getElementById('upload-area');
    elements.fileInput = document.getElementById('file-input');
    elements.pdfViewerContainer = document.getElementById('pdf-viewer-container');
    elements.toolsPanel = document.getElementById('tools-panel');
    elements.zoomControls = document.getElementById('zoom-controls');
    elements.zoomSelect = document.getElementById('zoom-select');
    elements.zoomInBtn = document.getElementById('zoom-in-btn');
    elements.zoomOutBtn = document.getElementById('zoom-out-btn');
    elements.pageIndicator = document.getElementById('page-indicator');
    elements.currentPage = document.getElementById('current-page');
    elements.totalPages = document.getElementById('total-pages');
    elements.fileName = document.getElementById('file-name');
    elements.mergeInput = document.getElementById('merge-input');
    elements.signatureFileInput = document.getElementById('signature-file-input');
    elements.signaturePlacementOverlay = document.getElementById('signature-placement-overlay');
    elements.confirmPlacementBtn = document.getElementById('confirm-placement-btn');
    elements.cancelPlacementBtn = document.getElementById('cancel-placement-btn');
    elements.rotateSigLeft = document.getElementById('rotate-sig-left');
    elements.rotateSigRight = document.getElementById('rotate-sig-right');
    elements.addTimestampCheck = document.getElementById('add-timestamp-check');
  }

  /**
   * Setup all event listeners
   */
  function setupEventListeners() {
    // File upload - click
    elements.uploadArea.addEventListener('click', function() {
      elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', handleFileSelect);

    // File upload - drag and drop
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
      handleDrop(e);
    });

    // Zoom controls
    elements.zoomSelect.addEventListener('change', function() {
      if (state.viewer) {
        state.viewer.setScale(elements.zoomSelect.value);
      }
    });

    elements.zoomInBtn.addEventListener('click', function() {
      zoomStep(0.25);
    });

    elements.zoomOutBtn.addEventListener('click', function() {
      zoomStep(-0.25);
    });

    // Page change event
    window.addEventListener('page-change', function(e) {
      updatePageIndicator(e.detail.page, e.detail.total);
    });

    // Redaction boxes change event
    window.addEventListener('redaction-boxes-change', function(e) {
      var hasRedactions = Object.keys(e.detail.boxes || {}).some(function(key) {
        return e.detail.boxes[key] && e.detail.boxes[key].length > 0;
      });
      state.toolsPanel.updateRedactButtons(hasRedactions);
    });

    // Signature placement controls
    elements.confirmPlacementBtn.addEventListener('click', handlePlaceSignature);
    elements.cancelPlacementBtn.addEventListener('click', handleCancelSignaturePlacement);
    elements.rotateSigLeft.addEventListener('click', function() {
      if (state.viewer) state.viewer.rotateSignatureLeft();
    });
    elements.rotateSigRight.addEventListener('click', function() {
      if (state.viewer) state.viewer.rotateSignatureRight();
    });

    // Signature placement events
    window.addEventListener('signature-placement-start', function() {
      elements.signaturePlacementOverlay.classList.remove('hidden');
    });

    window.addEventListener('signature-placement-cancel', function() {
      elements.signaturePlacementOverlay.classList.add('hidden');
    });
  }

  /**
   * Zoom step
   */
  function zoomStep(delta) {
    if (!state.viewer) return;

    var currentScale = state.viewer.getScale();
    var newScale = Math.max(0.25, Math.min(3, currentScale + delta));
    newScale = Math.round(newScale * 100) / 100;

    state.viewer.setScale(newScale);

    // Update select to show custom value or nearest preset
    var presets = ['0.5', '0.75', '1', '1.25', '1.5', '2'];
    var closest = presets.reduce(function(prev, curr) {
      return Math.abs(parseFloat(curr) - newScale) < Math.abs(parseFloat(prev) - newScale) ? curr : prev;
    });

    if (Math.abs(parseFloat(closest) - newScale) < 0.01) {
      elements.zoomSelect.value = closest;
    }
  }

  /**
   * Handle file drop
   */
  function handleDrop(e) {
    var files = e.dataTransfer.files;
    if (files.length > 0) {
      var file = files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        loadPDF(file);
      } else {
        alert('Please drop a PDF file');
      }
    }
  }

  /**
   * Handle file select
   */
  function handleFileSelect(e) {
    var file = e.target.files[0];
    if (file) {
      loadPDF(file);
    }
  }

  /**
   * Load PDF file
   */
  function loadPDF(file) {
    console.log('Loading PDF:', file.name);
    showLoading('Loading PDF...');

    window.FileHandler.loadPDFFile(file)
      .then(function(result) {
        state.pdfData = result.data;
        state.fileName = result.name;
        return window.PDFOperations.loadPDFDocument(result.data);
      })
      .then(function(pdfDoc) {
        state.pdfDoc = pdfDoc;
        return window.pdfjsLib.getDocument({ data: state.pdfData.slice(0) }).promise;
      })
      .then(function(pdfJsDoc) {
        state.pdfJsDoc = pdfJsDoc;

        // Update UI
        elements.uploadArea.classList.add('hidden');
        elements.pdfViewerContainer.classList.remove('hidden');
        elements.toolsPanel.classList.remove('hidden');
        elements.zoomControls.classList.remove('hidden');
        elements.pageIndicator.classList.remove('hidden');

        // Update file name and page indicator
        elements.fileName.textContent = state.fileName;
        updatePageIndicator(1, pdfJsDoc.numPages);

        // Initialize viewer
        state.viewer = window.PDFViewer.init(pdfJsDoc, {
          scale: 1
        });

        hideLoading();
      })
      .catch(function(error) {
        hideLoading();
        console.error('PDF load error:', error);
        alert('Failed to load PDF: ' + error.message);
      });
  }

  /**
   * Update page indicator
   */
  function updatePageIndicator(current, total) {
    elements.currentPage.textContent = current;
    elements.totalPages.textContent = total;
  }

  /**
   * Handle rotate page
   */
  function handleRotatePage(degrees) {
    if (!state.pdfDoc || !state.viewer) return;

    var currentPage = state.viewer.getCurrentPage();
    var pageIndex = currentPage - 1;

    showLoading('Rotating page...');

    try {
      state.pdfDoc = window.PDFOperations.rotatePage(state.pdfDoc, pageIndex, degrees);

      state.pdfDoc.save()
        .then(function(pdfBytes) {
          return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
        })
        .then(function(pdfJsDoc) {
          state.pdfJsDoc = pdfJsDoc;
          state.viewer.refresh(pdfJsDoc);
          hideLoading();
        })
        .catch(function(error) {
          hideLoading();
          alert('Failed to rotate page: ' + error.message);
        });
    } catch (error) {
      hideLoading();
      alert('Failed to rotate page: ' + error.message);
    }
  }

  /**
   * Handle delete page
   */
  function handleDeletePage() {
    if (!state.pdfDoc || !state.viewer) return;

    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
    if (pageCount <= 1) {
      alert('Cannot delete the last page');
      return;
    }

    var currentPage = state.viewer.getCurrentPage();
    if (!confirm('Delete page ' + currentPage + '?')) return;

    var pageIndex = currentPage - 1;
    showLoading('Deleting page...');

    try {
      state.pdfDoc = window.PDFOperations.deletePages(state.pdfDoc, [pageIndex]);

      state.pdfDoc.save()
        .then(function(pdfBytes) {
          return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
        })
        .then(function(pdfJsDoc) {
          state.pdfJsDoc = pdfJsDoc;
          state.viewer.refresh(pdfJsDoc);
          updatePageIndicator(
            Math.min(currentPage, pdfJsDoc.numPages),
            pdfJsDoc.numPages
          );
          hideLoading();
        })
        .catch(function(error) {
          hideLoading();
          alert('Failed to delete page: ' + error.message);
        });
    } catch (error) {
      hideLoading();
      alert('Failed to delete page: ' + error.message);
    }
  }

  /**
   * Handle extract page
   */
  function handleExtractPage() {
    if (!state.pdfDoc || !state.viewer) return;

    var currentPage = state.viewer.getCurrentPage();
    var pageIndex = currentPage - 1;

    showLoading('Extracting page...');

    window.PDFOperations.extractPages(state.pdfDoc, [pageIndex])
      .then(function(extractedDoc) {
        var baseName = state.fileName.replace('.pdf', '');
        return window.FileHandler.exportPDF(extractedDoc, baseName + '_page' + currentPage + '.pdf');
      })
      .then(function() {
        hideLoading();
        alert('Page ' + currentPage + ' extracted');
      })
      .catch(function(error) {
        hideLoading();
        alert('Failed to extract page: ' + error.message);
      });
  }

  /**
   * Handle merge
   */
  function handleMerge() {
    state.modalManager.showMergeModal(function(files) {
      if (files.length === 0) return;

      showLoading('Merging PDFs...');

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
          state.viewer.refresh(pdfJsDoc);
          hideLoading();
          alert('Merged ' + files.length + ' PDF(s) successfully');
        })
        .catch(function(error) {
          hideLoading();
          alert('Failed to merge: ' + error.message);
        });
    });
  }

  /**
   * Handle split
   */
  function handleSplit() {
    if (!state.pdfDoc) return;

    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
    state.modalManager.showSplitModal(pageCount, function(options) {
      showLoading('Splitting PDF...');

      var splitPromise;

      if (options.option === 'all') {
        splitPromise = window.PDFOperations.splitPDF(state.pdfDoc);
      } else if (options.option === 'every') {
        splitPromise = splitEveryN(options.everyN);
      } else if (options.option === 'at') {
        splitPromise = splitAtPages(options.atPages);
      }

      splitPromise
        .then(function(splitDocs) {
          var baseName = state.fileName.replace('.pdf', '');
          return window.FileHandler.exportMultiplePDFs(splitDocs, baseName);
        })
        .then(function() {
          hideLoading();
          alert('PDF split successfully');
        })
        .catch(function(error) {
          hideLoading();
          alert('Failed to split: ' + error.message);
        });
    });
  }

  /**
   * Split every N pages
   */
  function splitEveryN(n) {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
    var ranges = [];

    for (var i = 0; i < pageCount; i += n) {
      var end = Math.min(i + n - 1, pageCount - 1);
      var pageIndices = [];
      for (var j = i; j <= end; j++) {
        pageIndices.push(j);
      }
      ranges.push(pageIndices);
    }

    return Promise.all(ranges.map(function(indices) {
      return window.PDFOperations.extractPages(state.pdfDoc, indices);
    }));
  }

  /**
   * Split at specific pages
   */
  function splitAtPages(splitPoints) {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
    var ranges = [];
    var start = 0;

    splitPoints.forEach(function(point) {
      if (point > start && point <= pageCount) {
        var indices = [];
        for (var i = start; i < point; i++) {
          indices.push(i);
        }
        ranges.push(indices);
        start = point;
      }
    });

    // Add remaining pages
    if (start < pageCount) {
      var remaining = [];
      for (var i = start; i < pageCount; i++) {
        remaining.push(i);
      }
      ranges.push(remaining);
    }

    return Promise.all(ranges.map(function(indices) {
      return window.PDFOperations.extractPages(state.pdfDoc, indices);
    }));
  }

  /**
   * Handle reorder
   */
  function handleReorder() {
    if (!state.pdfJsDoc) return;

    state.modalManager.showReorderModal(state.pdfJsDoc, function(newOrder) {
      showLoading('Reordering pages...');

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
          state.viewer.refresh(pdfJsDoc);
          hideLoading();
        })
        .catch(function(error) {
          hideLoading();
          alert('Failed to reorder pages: ' + error.message);
        });
    });
  }

  /**
   * Handle redact mode enable
   */
  function handleRedactModeEnable() {
    if (state.viewer) {
      state.viewer.enableRedactMode();
    }
  }

  /**
   * Handle redact mode disable
   */
  function handleRedactModeDisable() {
    if (state.viewer) {
      state.viewer.disableRedactMode();
    }
  }

  /**
   * Handle apply redaction
   */
  function handleApplyRedaction() {
    if (!state.pdfDoc || !state.viewer) return;

    var boxes = state.viewer.getRedactionBoxes();
    var hasRedactions = Object.keys(boxes).some(function(key) {
      return boxes[key] && boxes[key].length > 0;
    });

    if (!hasRedactions) {
      alert('No redaction boxes drawn. Draw boxes on areas you want to redact.');
      return;
    }

    if (!confirm('Apply redaction? This will convert affected pages to images and cannot be undone.')) {
      return;
    }

    showLoading('Applying redaction...');

    // Convert boxes to the format expected by Redaction module
    // Need to account for current scale
    var scale = state.viewer.getScale();
    var scaledBoxes = {};

    Object.keys(boxes).forEach(function(pageIndex) {
      scaledBoxes[pageIndex] = boxes[pageIndex].map(function(box) {
        return {
          x: box.x / scale,
          y: box.y / scale,
          width: box.width / scale,
          height: box.height / scale
        };
      });
    });

    window.PDFOperations.copyPDFDocument(state.pdfDoc)
      .then(function(pdfDocCopy) {
        state.pdfDoc = pdfDocCopy;
        return window.Redaction.applyRedactions(state.pdfDoc, state.pdfJsDoc, scaledBoxes, function(current, total) {
          showLoading('Redacting page ' + current + ' of ' + total + '...');
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
        state.viewer.clearRedactionBoxes();
        state.viewer.disableRedactMode();
        window.ToolsPanel.setRedactModeActive(false);
        state.viewer.refresh(pdfJsDoc);
        hideLoading();
        alert('Redaction applied successfully. Verify the result and download.');
      })
      .catch(function(error) {
        hideLoading();
        alert('Redaction failed: ' + error.message);
        console.error('Redaction error:', error);
      });
  }

  /**
   * Handle clear redactions
   */
  function handleClearRedactions() {
    if (state.viewer) {
      state.viewer.clearRedactionBoxes();
    }
  }

  /**
   * Handle add signature
   */
  function handleAddSignature() {
    state.modalManager.showAddSignatureModal(function(name, file) {
      showLoading('Saving signature...');

      window.SignatureManager.saveSignature(name, file)
        .then(function() {
          return state.toolsPanel.refreshSignatures();
        })
        .then(function() {
          hideLoading();
          alert('Signature saved');
        })
        .catch(function(error) {
          hideLoading();
          alert('Failed to save signature: ' + error.message);
        });
    });
  }

  /**
   * Handle select signature
   */
  function handleSelectSignature(signature) {
    if (!state.viewer) return;

    state.viewer.startSignaturePlacement(signature);
  }

  /**
   * Handle place signature
   */
  function handlePlaceSignature() {
    if (!state.viewer || !state.pdfDoc) return;

    var placement = state.viewer.getSignaturePlacement();
    if (!placement) return;

    showLoading('Placing signature...');

    var addTimestamp = elements.addTimestampCheck.checked;

    // Get the signature that was being placed
    var signatureList = document.querySelectorAll('.signature-quick-item');
    var selectedSig = null;

    window.SignatureManager.loadSignatures()
      .then(function(signatures) {
        // Find the signature by checking which one matches current placement dimensions
        selectedSig = signatures[0]; // Default to first signature
        signatures.forEach(function(sig) {
          if (Math.abs(sig.width - placement.width * placement.scale) < 50 &&
              Math.abs(sig.height - placement.height * placement.scale) < 50) {
            selectedSig = sig;
          }
        });

        return window.SignatureManager.insertSignatureIntoPDF(
          state.pdfDoc,
          placement.pageIndex,
          selectedSig,
          {
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            rotation: placement.rotation
          },
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
        state.viewer.cancelSignaturePlacement();
        elements.signaturePlacementOverlay.classList.add('hidden');
        state.viewer.refresh(pdfJsDoc);
        hideLoading();
        alert('Signature placed. Add more or download the PDF.');
      })
      .catch(function(error) {
        hideLoading();
        alert('Failed to place signature: ' + error.message);
        console.error('Signature placement error:', error);
      });
  }

  /**
   * Handle cancel signature placement
   */
  function handleCancelSignaturePlacement() {
    if (state.viewer) {
      state.viewer.cancelSignaturePlacement();
    }
    elements.signaturePlacementOverlay.classList.add('hidden');
  }

  /**
   * Handle download
   */
  function handleDownload() {
    if (!state.pdfDoc) return;

    showLoading('Preparing download...');

    window.FileHandler.exportPDF(state.pdfDoc, state.fileName)
      .then(function() {
        hideLoading();
      })
      .catch(function(error) {
        hideLoading();
        alert('Failed to download: ' + error.message);
      });
  }

  /**
   * Show loading overlay
   */
  function showLoading(message) {
    var overlay = document.getElementById('loading-overlay');
    var text = document.getElementById('loading-text');
    if (text) text.textContent = message || 'Processing...';
    if (overlay) overlay.classList.remove('hidden');
  }

  /**
   * Hide loading overlay
   */
  function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // Wait for libraries to be ready
  window.addEventListener('libs-ready', function() {
    console.log('libs-ready event received');
    init();
  });

  // Fallback: if libs-ready already fired
  setTimeout(function() {
    if (window.pdfjsLib && !window._pdfToolInitialized) {
      console.log('Fallback init - pdfjsLib already available');
      window._pdfToolInitialized = true;
      init();
    }
  }, 100);

})();
