/**
 * PDF Tool Extension - Main Popup Script
 * Orchestrates the new Adobe Acrobat-style UI
 */

(function() {
  'use strict';

  // Global state
  var state = {
    pdfDoc: null,        // PDF-lib document
    pdfJsDoc: null,      // PDF.js document
    pdfData: null,       // Raw PDF bytes
    fileName: 'document.pdf',
    selectedSignature: null
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

    // Setup file upload
    setupFileUpload();

    // Setup zoom controls
    setupZoomControls();

    // Initialize PDF Viewer
    window.PDFViewer.init({
      container: elements.pdfViewer,
      pagesContainer: elements.pagesContainer,
      onPageChange: handlePageChange,
      onRedactionChange: handleRedactionChange,
      onSignaturePlaced: handleSignaturePlaced
    });

    // Initialize Tools Panel
    window.ToolsPanel.init({
      // Page Tools
      rotateLeft: function() { rotatePage(-90); },
      rotateRight: function() { rotatePage(90); },
      deletePage: deletePage,
      extractPage: extractPage,

      // Document Tools
      merge: handleMerge,
      split: handleSplit,
      reorder: handleReorder,

      // Redact
      toggleRedaction: toggleRedactionMode,
      applyRedaction: applyRedaction,
      clearRedaction: clearRedaction,

      // Sign
      addSignature: showAddSignatureModal,
      selectSignature: handleSignatureSelect,
      deleteSignature: handleSignatureDelete,
      rotateSignatureLeft: function() { window.PDFViewer.rotateSignature(-90); },
      rotateSignatureRight: function() { window.PDFViewer.rotateSignature(90); },
      confirmSignature: confirmSignaturePlacement,
      cancelSignature: cancelSignaturePlacement,

      // Download
      download: handleDownload
    });

    console.log('PDF Tool ready!');
  }

  /**
   * Cache frequently used DOM elements
   */
  function cacheElements() {
    elements.uploadArea = document.getElementById('upload-area');
    elements.fileInput = document.getElementById('file-input');
    elements.workspace = document.getElementById('workspace');
    elements.pdfViewer = document.getElementById('pdf-viewer');
    elements.pagesContainer = document.getElementById('pages-container');

    elements.zoomControls = document.getElementById('zoom-controls');
    elements.zoomSelect = document.getElementById('zoom-select');
    elements.zoomInBtn = document.getElementById('zoom-in-btn');
    elements.zoomOutBtn = document.getElementById('zoom-out-btn');

    elements.pageIndicator = document.getElementById('page-indicator');
    elements.currentPage = document.getElementById('current-page');
    elements.totalPages = document.getElementById('total-pages');

    elements.mergeInput = document.getElementById('merge-input');
    elements.signatureFile = document.getElementById('signature-file');
  }

  /**
   * Prevent default drag/drop on document
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
   * Setup file upload handling
   */
  function setupFileUpload() {
    elements.uploadArea.addEventListener('click', function() {
      elements.fileInput.click();
    });

    elements.fileInput.addEventListener('change', function(e) {
      if (e.target.files[0]) {
        loadPDF(e.target.files[0]);
      }
    });

    elements.uploadArea.addEventListener('dragover', function() {
      elements.uploadArea.classList.add('dragover');
    });

    elements.uploadArea.addEventListener('dragleave', function() {
      elements.uploadArea.classList.remove('dragover');
    });

    elements.uploadArea.addEventListener('drop', function(e) {
      elements.uploadArea.classList.remove('dragover');
      var file = e.dataTransfer.files[0];
      if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
        loadPDF(file);
      } else {
        alert('Please drop a PDF file');
      }
    });

    // Merge file input
    elements.mergeInput.addEventListener('change', handleMergeFiles);
  }

  /**
   * Setup zoom controls
   */
  function setupZoomControls() {
    elements.zoomSelect.addEventListener('change', function() {
      var value = elements.zoomSelect.value;
      showLoading('Adjusting zoom...');
      window.PDFViewer.setZoom(value).then(function() {
        hideLoading();
      });
    });

    elements.zoomInBtn.addEventListener('click', function() {
      var options = elements.zoomSelect.options;
      var currentIndex = elements.zoomSelect.selectedIndex;

      // Find next higher zoom level
      for (var i = currentIndex + 1; i < options.length; i++) {
        if (options[i].value !== 'fit-width') {
          elements.zoomSelect.selectedIndex = i;
          elements.zoomSelect.dispatchEvent(new Event('change'));
          break;
        }
      }
    });

    elements.zoomOutBtn.addEventListener('click', function() {
      var options = elements.zoomSelect.options;
      var currentIndex = elements.zoomSelect.selectedIndex;

      // Find next lower zoom level
      for (var i = currentIndex - 1; i >= 0; i--) {
        if (options[i].value !== 'fit-width') {
          elements.zoomSelect.selectedIndex = i;
          elements.zoomSelect.dispatchEvent(new Event('change'));
          break;
        }
      }
    });
  }

  /**
   * Load a PDF file
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

        // Load with PDF.js for rendering
        return window.pdfjsLib.getDocument({ data: state.pdfData.slice(0) }).promise;
      })
      .then(function(pdfJsDoc) {
        state.pdfJsDoc = pdfJsDoc;

        // Show workspace, hide upload
        elements.uploadArea.classList.add('hidden');
        elements.workspace.classList.remove('hidden');
        elements.zoomControls.classList.remove('hidden');
        elements.pageIndicator.classList.remove('hidden');

        // Update page count
        elements.totalPages.textContent = pdfJsDoc.numPages;
        elements.currentPage.textContent = '1';

        // Load into viewer
        return window.PDFViewer.load(pdfJsDoc);
      })
      .then(function() {
        hideLoading();
      })
      .catch(function(error) {
        hideLoading();
        console.error('PDF load error:', error);
        alert('Failed to load PDF: ' + error.message);
      });
  }

  /**
   * Handle page change from viewer
   */
  function handlePageChange(currentPage, totalPages) {
    elements.currentPage.textContent = currentPage;
    elements.totalPages.textContent = totalPages;
  }

  /**
   * Handle redaction boxes change
   */
  function handleRedactionChange(boxes) {
    var hasBoxes = Object.keys(boxes).some(function(key) {
      return boxes[key] && boxes[key].length > 0;
    });
    window.ToolsPanel.updateRedactionButtons(hasBoxes);
  }

  /**
   * Handle signature placed
   */
  function handleSignaturePlaced() {
    // Signature preview is shown, waiting for confirmation
  }

  /**
   * Rotate current page
   */
  function rotatePage(degrees) {
    var pageIndex = window.PDFViewer.getCurrentPage() - 1;
    showLoading('Rotating page...');

    try {
      state.pdfDoc = window.PDFOperations.rotatePage(state.pdfDoc, pageIndex, degrees);

      state.pdfDoc.save()
        .then(function(pdfBytes) {
          state.pdfData = pdfBytes;
          return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
        })
        .then(function(pdfJsDoc) {
          state.pdfJsDoc = pdfJsDoc;
          return window.PDFViewer.refresh(pdfJsDoc);
        })
        .then(function() {
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
   * Delete current page
   */
  function deletePage() {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);

    if (pageCount <= 1) {
      alert('Cannot delete the last page');
      return;
    }

    var pageIndex = window.PDFViewer.getCurrentPage() - 1;

    if (!confirm('Delete page ' + (pageIndex + 1) + '?')) {
      return;
    }

    showLoading('Deleting page...');

    try {
      state.pdfDoc = window.PDFOperations.deletePages(state.pdfDoc, [pageIndex]);

      state.pdfDoc.save()
        .then(function(pdfBytes) {
          state.pdfData = pdfBytes;
          return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
        })
        .then(function(pdfJsDoc) {
          state.pdfJsDoc = pdfJsDoc;
          elements.totalPages.textContent = pdfJsDoc.numPages;
          return window.PDFViewer.refresh(pdfJsDoc);
        })
        .then(function() {
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
   * Extract current page
   */
  function extractPage() {
    var pageIndex = window.PDFViewer.getCurrentPage() - 1;
    showLoading('Extracting page...');

    window.PDFOperations.extractPages(state.pdfDoc, [pageIndex])
      .then(function(extractedDoc) {
        var baseName = state.fileName.replace('.pdf', '');
        return window.FileHandler.exportPDF(extractedDoc, baseName + '_page' + (pageIndex + 1) + '.pdf');
      })
      .then(function() {
        hideLoading();
      })
      .catch(function(error) {
        hideLoading();
        alert('Failed to extract page: ' + error.message);
      });
  }

  /**
   * Handle merge button click
   */
  function handleMerge() {
    elements.mergeInput.click();
  }

  /**
   * Handle merge files selected
   */
  function handleMergeFiles(e) {
    var files = Array.from(e.target.files);
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
        state.pdfData = pdfBytes;
        return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
      })
      .then(function(pdfJsDoc) {
        state.pdfJsDoc = pdfJsDoc;
        elements.totalPages.textContent = pdfJsDoc.numPages;
        return window.PDFViewer.refresh(pdfJsDoc);
      })
      .then(function() {
        hideLoading();
        alert('Merged ' + files.length + ' PDF(s) successfully');
      })
      .catch(function(error) {
        hideLoading();
        alert('Failed to merge: ' + error.message);
      })
      .finally(function() {
        elements.mergeInput.value = '';
      });
  }

  /**
   * Handle split button click
   */
  function handleSplit() {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);

    window.ToolsPanel.showSplitModal(pageCount, function(options) {
      window.ToolsPanel.hideModal();
      showLoading('Splitting PDF...');

      var splitPromise;

      if (options.method === 'all') {
        splitPromise = window.PDFOperations.splitPDF(state.pdfDoc);
      } else if (options.method === 'every') {
        splitPromise = splitEveryN(options.n);
      } else if (options.method === 'at') {
        splitPromise = splitAtPages(options.pages);
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
   * Split PDF every N pages
   */
  function splitEveryN(n) {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
    var promises = [];

    for (var i = 0; i < pageCount; i += n) {
      var indices = [];
      for (var j = i; j < Math.min(i + n, pageCount); j++) {
        indices.push(j);
      }
      promises.push(window.PDFOperations.extractPages(state.pdfDoc, indices));
    }

    return Promise.all(promises);
  }

  /**
   * Split PDF at specific pages
   */
  function splitAtPages(pages) {
    var pageCount = window.PDFOperations.getPageCount(state.pdfDoc);
    var sortedPages = pages.slice().sort(function(a, b) { return a - b; });
    var promises = [];
    var start = 0;

    sortedPages.forEach(function(pageNum) {
      if (pageNum > start && pageNum <= pageCount) {
        var indices = [];
        for (var i = start; i < pageNum; i++) {
          indices.push(i);
        }
        if (indices.length > 0) {
          promises.push(window.PDFOperations.extractPages(state.pdfDoc, indices));
        }
        start = pageNum;
      }
    });

    // Last segment
    if (start < pageCount) {
      var lastIndices = [];
      for (var i = start; i < pageCount; i++) {
        lastIndices.push(i);
      }
      promises.push(window.PDFOperations.extractPages(state.pdfDoc, lastIndices));
    }

    return Promise.all(promises);
  }

  /**
   * Handle reorder button click
   */
  function handleReorder() {
    window.ToolsPanel.showReorderModal(state.pdfJsDoc, function(newOrder) {
      window.ToolsPanel.hideModal();
      showLoading('Reordering pages...');

      window.PDFOperations.reorderPages(state.pdfDoc, newOrder)
        .then(function(newPdfDoc) {
          state.pdfDoc = newPdfDoc;
          return state.pdfDoc.save();
        })
        .then(function(pdfBytes) {
          state.pdfData = pdfBytes;
          return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
        })
        .then(function(pdfJsDoc) {
          state.pdfJsDoc = pdfJsDoc;
          return window.PDFViewer.refresh(pdfJsDoc);
        })
        .then(function() {
          hideLoading();
        })
        .catch(function(error) {
          hideLoading();
          alert('Failed to reorder: ' + error.message);
        });
    });
  }

  /**
   * Toggle redaction mode
   */
  function toggleRedactionMode(active) {
    if (active) {
      window.PDFViewer.enableRedactionMode();
    } else {
      window.PDFViewer.disableRedactionMode();
    }
  }

  /**
   * Apply redaction
   */
  function applyRedaction() {
    if (!window.PDFViewer.hasRedactionBoxes()) {
      alert('No redaction boxes drawn. Draw boxes on areas you want to redact.');
      return;
    }

    if (!confirm('Apply redaction? This will convert affected pages to images and cannot be undone.')) {
      return;
    }

    showLoading('Applying redaction...');

    // Get boxes scaled to PDF coordinates
    var redactionBoxes = window.PDFViewer.getRedactionBoxesForPDF();

    window.PDFOperations.copyPDFDocument(state.pdfDoc)
      .then(function(pdfDocCopy) {
        state.pdfDoc = pdfDocCopy;
        return window.Redaction.applyRedactions(state.pdfDoc, state.pdfJsDoc, redactionBoxes, function(current, total) {
          showLoading('Redacting page ' + current + ' of ' + total + '...');
        });
      })
      .then(function() {
        return state.pdfDoc.save();
      })
      .then(function(pdfBytes) {
        state.pdfData = pdfBytes;
        return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
      })
      .then(function(pdfJsDoc) {
        state.pdfJsDoc = pdfJsDoc;
        window.PDFViewer.clearRedactionBoxes();
        window.PDFViewer.disableRedactionMode();
        window.ToolsPanel.setRedactionMode(false);
        return window.PDFViewer.refresh(pdfJsDoc);
      })
      .then(function() {
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
   * Clear all redaction boxes
   */
  function clearRedaction() {
    window.PDFViewer.clearRedactionBoxes();
  }

  /**
   * Show add signature modal
   */
  function showAddSignatureModal() {
    window.ToolsPanel.showAddSignatureModal(function(name, file) {
      window.ToolsPanel.hideModal();
      showLoading('Saving signature...');

      window.SignatureManager.saveSignature(name, file)
        .then(function() {
          window.ToolsPanel.refreshSignatures();
          hideLoading();
        })
        .catch(function(error) {
          hideLoading();
          alert('Failed to save signature: ' + error.message);
        });
    });
  }

  /**
   * Handle signature selection
   */
  function handleSignatureSelect(signature) {
    state.selectedSignature = signature;
    window.PDFViewer.enableSignatureMode(signature);
    window.ToolsPanel.showSignaturePlacementControls();
  }

  /**
   * Handle signature deletion
   */
  function handleSignatureDelete(signatureId) {
    window.SignatureManager.deleteSignature(signatureId)
      .then(function() {
        window.ToolsPanel.refreshSignatures();
      })
      .catch(function(error) {
        alert('Failed to delete signature: ' + error.message);
      });
  }

  /**
   * Confirm signature placement
   */
  function confirmSignaturePlacement() {
    var placement = window.PDFViewer.getSignaturePlacement();

    if (!placement || !state.selectedSignature) {
      alert('Please click on the page to place your signature first.');
      return;
    }

    showLoading('Placing signature...');

    var addTimestamp = window.ToolsPanel.getAddTimestamp();

    window.SignatureManager.insertSignatureIntoPDF(
      state.pdfDoc,
      placement.pageIndex,
      state.selectedSignature,
      placement,
      { addTimestamp: addTimestamp }
    )
      .then(function() {
        return state.pdfDoc.save();
      })
      .then(function(pdfBytes) {
        state.pdfData = pdfBytes;
        return window.pdfjsLib.getDocument({ data: pdfBytes }).promise;
      })
      .then(function(pdfJsDoc) {
        state.pdfJsDoc = pdfJsDoc;
        window.PDFViewer.disableSignatureMode();
        window.ToolsPanel.hideSignaturePlacementControls();
        state.selectedSignature = null;
        return window.PDFViewer.refresh(pdfJsDoc);
      })
      .then(function() {
        hideLoading();
        alert('Signature placed. You can add more or download the PDF.');
      })
      .catch(function(error) {
        hideLoading();
        alert('Failed to place signature: ' + error.message);
        console.error('Signature error:', error);
      });
  }

  /**
   * Cancel signature placement
   */
  function cancelSignaturePlacement() {
    window.PDFViewer.disableSignatureMode();
    window.ToolsPanel.hideSignaturePlacementControls();
    state.selectedSignature = null;
  }

  /**
   * Handle download
   */
  function handleDownload() {
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
    text.textContent = message || 'Processing...';
    overlay.classList.remove('hidden');
  }

  /**
   * Hide loading overlay
   */
  function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
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
