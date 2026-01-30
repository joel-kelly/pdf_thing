/**
 * PDF Viewer Module
 * Continuous scroll PDF viewer with zoom and lazy loading
 */

(function() {
  'use strict';

  var state = {
    pdfJsDoc: null,
    container: null,
    viewer: null,
    scale: 1,
    currentPage: 1,
    totalPages: 0,
    pageWrappers: [],
    renderedPages: new Set(),
    renderQueue: [],
    isRendering: false,
    redactMode: false,
    redactionBoxes: {},
    signatureMode: false,
    currentSignature: null,
    signaturePlacement: null,
    observers: []
  };

  var RENDER_MARGIN = 300; // Pixels above/below viewport to pre-render

  /**
   * Initialize the viewer
   */
  function init(pdfJsDoc, options) {
    options = options || {};

    state.pdfJsDoc = pdfJsDoc;
    state.totalPages = pdfJsDoc.numPages;
    state.container = document.getElementById('pdf-viewer-container');
    state.viewer = document.getElementById('pdf-viewer');
    state.scale = options.scale || 1;
    state.redactionBoxes = {};
    state.renderedPages = new Set();
    state.pageWrappers = [];

    // Clear viewer
    state.viewer.innerHTML = '';

    // Create page placeholders
    createPagePlaceholders();

    // Setup intersection observer for lazy loading
    setupIntersectionObserver();

    // Setup scroll listener for current page tracking
    setupScrollListener();

    // Initial render of visible pages
    renderVisiblePages();

    // Dispatch ready event
    dispatchEvent('viewer-ready', { totalPages: state.totalPages });

    return {
      setScale: setScale,
      getScale: getScale,
      getCurrentPage: getCurrentPage,
      getTotalPages: getTotalPages,
      scrollToPage: scrollToPage,
      refresh: refresh,
      enableRedactMode: enableRedactMode,
      disableRedactMode: disableRedactMode,
      isRedactMode: function() { return state.redactMode; },
      getRedactionBoxes: getRedactionBoxes,
      clearRedactionBoxes: clearRedactionBoxes,
      startSignaturePlacement: startSignaturePlacement,
      cancelSignaturePlacement: cancelSignaturePlacement,
      getSignaturePlacement: getSignaturePlacement,
      rotateSignatureLeft: rotateSignatureLeft,
      rotateSignatureRight: rotateSignatureRight,
      destroy: destroy
    };
  }

  /**
   * Create placeholder elements for all pages
   */
  function createPagePlaceholders() {
    state.pageWrappers = [];

    for (var i = 0; i < state.totalPages; i++) {
      var wrapper = document.createElement('div');
      wrapper.className = 'page-wrapper';
      wrapper.dataset.pageIndex = i;

      // We'll set dimensions when we get page info
      state.pdfJsDoc.getPage(i + 1).then(function(pageIndex, page) {
        var viewport = page.getViewport({ scale: state.scale });
        var wrapper = state.pageWrappers[pageIndex];
        if (wrapper) {
          wrapper.style.width = viewport.width + 'px';
          wrapper.style.height = viewport.height + 'px';
        }
      }.bind(null, i));

      // Create page canvas
      var canvas = document.createElement('canvas');
      canvas.className = 'page-canvas';
      wrapper.appendChild(canvas);

      // Create redaction overlay canvas
      var overlay = document.createElement('canvas');
      overlay.className = 'redaction-overlay';
      wrapper.appendChild(overlay);

      // Page label
      var label = document.createElement('span');
      label.className = 'page-label';
      label.textContent = 'Page ' + (i + 1);
      wrapper.appendChild(label);

      state.viewer.appendChild(wrapper);
      state.pageWrappers.push(wrapper);
    }
  }

  /**
   * Setup intersection observer for lazy loading
   */
  function setupIntersectionObserver() {
    // Clean up old observers
    state.observers.forEach(function(obs) { obs.disconnect(); });
    state.observers = [];

    var options = {
      root: state.container,
      rootMargin: RENDER_MARGIN + 'px 0px',
      threshold: [0, 0.1, 0.5, 0.9, 1]
    };

    var renderObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var pageIndex = parseInt(entry.target.dataset.pageIndex);

        if (entry.isIntersecting) {
          queueRender(pageIndex);
        }
      });
    }, options);

    // Observe all page wrappers
    state.pageWrappers.forEach(function(wrapper) {
      renderObserver.observe(wrapper);
    });

    state.observers.push(renderObserver);

    // Separate observer for current page detection
    var currentPageObserver = new IntersectionObserver(function(entries) {
      var mostVisible = null;
      var maxRatio = 0;

      entries.forEach(function(entry) {
        if (entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          mostVisible = entry.target;
        }
      });

      if (mostVisible && maxRatio > 0.3) {
        var newPage = parseInt(mostVisible.dataset.pageIndex) + 1;
        if (newPage !== state.currentPage) {
          state.currentPage = newPage;
          dispatchEvent('page-change', { page: newPage, total: state.totalPages });
        }
      }
    }, {
      root: state.container,
      threshold: [0, 0.25, 0.5, 0.75, 1]
    });

    state.pageWrappers.forEach(function(wrapper) {
      currentPageObserver.observe(wrapper);
    });

    state.observers.push(currentPageObserver);
  }

  /**
   * Setup scroll listener
   */
  function setupScrollListener() {
    state.container.addEventListener('scroll', function() {
      // Debounced current page detection happens via intersection observer
    });
  }

  /**
   * Queue a page for rendering
   */
  function queueRender(pageIndex) {
    if (state.renderedPages.has(pageIndex)) return;
    if (state.renderQueue.includes(pageIndex)) return;

    state.renderQueue.push(pageIndex);
    processRenderQueue();
  }

  /**
   * Process render queue
   */
  function processRenderQueue() {
    if (state.isRendering || state.renderQueue.length === 0) return;

    state.isRendering = true;
    var pageIndex = state.renderQueue.shift();

    renderPage(pageIndex).then(function() {
      state.isRendering = false;
      processRenderQueue();
    }).catch(function(err) {
      console.error('Error rendering page ' + (pageIndex + 1) + ':', err);
      state.isRendering = false;
      processRenderQueue();
    });
  }

  /**
   * Render a single page
   */
  function renderPage(pageIndex) {
    if (state.renderedPages.has(pageIndex)) {
      return Promise.resolve();
    }

    var wrapper = state.pageWrappers[pageIndex];
    if (!wrapper) return Promise.resolve();

    var canvas = wrapper.querySelector('.page-canvas');
    var overlay = wrapper.querySelector('.redaction-overlay');

    return state.pdfJsDoc.getPage(pageIndex + 1).then(function(page) {
      var viewport = page.getViewport({ scale: state.scale });

      // Update wrapper dimensions
      wrapper.style.width = viewport.width + 'px';
      wrapper.style.height = viewport.height + 'px';

      // Setup canvas
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Setup overlay
      overlay.width = viewport.width;
      overlay.height = viewport.height;

      var context = canvas.getContext('2d');

      return page.render({
        canvasContext: context,
        viewport: viewport
      }).promise.then(function() {
        state.renderedPages.add(pageIndex);

        // Setup redaction drawing if in redact mode
        if (state.redactMode) {
          setupRedactionDrawingForPage(pageIndex);
        }

        // Redraw any existing redaction boxes
        redrawRedactionBoxes(pageIndex);
      });
    });
  }

  /**
   * Render all visible pages
   */
  function renderVisiblePages() {
    var containerRect = state.container.getBoundingClientRect();

    state.pageWrappers.forEach(function(wrapper, index) {
      var rect = wrapper.getBoundingClientRect();
      var isVisible = (
        rect.bottom > containerRect.top - RENDER_MARGIN &&
        rect.top < containerRect.bottom + RENDER_MARGIN
      );

      if (isVisible) {
        queueRender(index);
      }
    });
  }

  /**
   * Set zoom scale
   */
  function setScale(newScale) {
    if (newScale === 'fit') {
      // Calculate fit-width scale
      var containerWidth = state.container.clientWidth - 80; // Padding
      state.pdfJsDoc.getPage(1).then(function(page) {
        var viewport = page.getViewport({ scale: 1 });
        var fitScale = containerWidth / viewport.width;
        applyScale(fitScale);
      });
    } else {
      applyScale(parseFloat(newScale));
    }
  }

  /**
   * Apply scale to all pages
   */
  function applyScale(newScale) {
    state.scale = newScale;
    state.renderedPages.clear();
    state.renderQueue = [];

    // Re-render all page placeholders with new dimensions
    state.pageWrappers.forEach(function(wrapper, index) {
      state.pdfJsDoc.getPage(index + 1).then(function(page) {
        var viewport = page.getViewport({ scale: state.scale });
        wrapper.style.width = viewport.width + 'px';
        wrapper.style.height = viewport.height + 'px';

        var canvas = wrapper.querySelector('.page-canvas');
        var overlay = wrapper.querySelector('.redaction-overlay');

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        overlay.width = viewport.width;
        overlay.height = viewport.height;

        // Clear canvases
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
      });
    });

    // Re-render visible pages
    setTimeout(function() {
      renderVisiblePages();
    }, 100);
  }

  /**
   * Get current scale
   */
  function getScale() {
    return state.scale;
  }

  /**
   * Get current page number
   */
  function getCurrentPage() {
    return state.currentPage;
  }

  /**
   * Get total pages
   */
  function getTotalPages() {
    return state.totalPages;
  }

  /**
   * Scroll to a specific page
   */
  function scrollToPage(pageNum) {
    var wrapper = state.pageWrappers[pageNum - 1];
    if (wrapper) {
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Refresh the viewer (re-render all pages)
   */
  function refresh(pdfJsDoc) {
    if (pdfJsDoc) {
      state.pdfJsDoc = pdfJsDoc;
      state.totalPages = pdfJsDoc.numPages;
    }

    state.renderedPages.clear();
    state.renderQueue = [];
    state.viewer.innerHTML = '';
    state.pageWrappers = [];

    createPagePlaceholders();
    setupIntersectionObserver();
    renderVisiblePages();

    dispatchEvent('viewer-refresh', { totalPages: state.totalPages });
  }

  /**
   * Enable redaction mode
   */
  function enableRedactMode() {
    state.redactMode = true;
    state.pageWrappers.forEach(function(wrapper, index) {
      wrapper.classList.add('redact-mode');
      setupRedactionDrawingForPage(index);
    });
    dispatchEvent('redact-mode-change', { enabled: true });
  }

  /**
   * Disable redaction mode
   */
  function disableRedactMode() {
    state.redactMode = false;
    state.pageWrappers.forEach(function(wrapper) {
      wrapper.classList.remove('redact-mode');
    });
    dispatchEvent('redact-mode-change', { enabled: false });
  }

  /**
   * Setup redaction drawing for a specific page
   */
  function setupRedactionDrawingForPage(pageIndex) {
    var wrapper = state.pageWrappers[pageIndex];
    if (!wrapper) return;

    var overlay = wrapper.querySelector('.redaction-overlay');
    if (!overlay) return;

    // Remove old listeners by cloning
    var newOverlay = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(newOverlay, overlay);

    if (!state.redactionBoxes[pageIndex]) {
      state.redactionBoxes[pageIndex] = [];
    }

    var isDrawing = false;
    var startX, startY;
    var currentBox = null;

    function getMousePos(e) {
      var rect = newOverlay.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    function redraw() {
      var ctx = newOverlay.getContext('2d');
      ctx.clearRect(0, 0, newOverlay.width, newOverlay.height);

      ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;

      var boxes = state.redactionBoxes[pageIndex] || [];
      boxes.forEach(function(box) {
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      });

      if (currentBox) {
        ctx.fillRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
        ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
      }
    }

    newOverlay.addEventListener('mousedown', function(e) {
      if (!state.redactMode || e.button !== 0) return;

      var pos = getMousePos(e);
      isDrawing = true;
      startX = pos.x;
      startY = pos.y;
      currentBox = { x: startX, y: startY, width: 0, height: 0 };
    });

    newOverlay.addEventListener('mousemove', function(e) {
      if (!isDrawing) return;

      var pos = getMousePos(e);
      currentBox = {
        x: Math.min(startX, pos.x),
        y: Math.min(startY, pos.y),
        width: Math.abs(pos.x - startX),
        height: Math.abs(pos.y - startY)
      };
      redraw();
    });

    newOverlay.addEventListener('mouseup', function() {
      if (!isDrawing) return;
      isDrawing = false;

      if (currentBox && currentBox.width > 5 && currentBox.height > 5) {
        state.redactionBoxes[pageIndex].push(currentBox);
        dispatchEvent('redaction-boxes-change', {
          pageIndex: pageIndex,
          boxes: state.redactionBoxes
        });
      }
      currentBox = null;
      redraw();
    });

    newOverlay.addEventListener('mouseleave', function() {
      if (isDrawing) {
        isDrawing = false;
        currentBox = null;
        redraw();
      }
    });

    newOverlay.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      var pos = getMousePos(e);
      var boxes = state.redactionBoxes[pageIndex] || [];

      for (var i = boxes.length - 1; i >= 0; i--) {
        var box = boxes[i];
        if (pos.x >= box.x && pos.x <= box.x + box.width &&
            pos.y >= box.y && pos.y <= box.y + box.height) {
          boxes.splice(i, 1);
          dispatchEvent('redaction-boxes-change', {
            pageIndex: pageIndex,
            boxes: state.redactionBoxes
          });
          redraw();
          break;
        }
      }
    });

    // Initial draw
    redraw();
  }

  /**
   * Redraw redaction boxes for a page
   */
  function redrawRedactionBoxes(pageIndex) {
    var wrapper = state.pageWrappers[pageIndex];
    if (!wrapper) return;

    var overlay = wrapper.querySelector('.redaction-overlay');
    if (!overlay) return;

    var ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    var boxes = state.redactionBoxes[pageIndex] || [];
    if (boxes.length === 0) return;

    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;

    boxes.forEach(function(box) {
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    });
  }

  /**
   * Get all redaction boxes
   */
  function getRedactionBoxes() {
    return state.redactionBoxes;
  }

  /**
   * Clear all redaction boxes
   */
  function clearRedactionBoxes() {
    state.redactionBoxes = {};
    state.pageWrappers.forEach(function(wrapper, index) {
      var overlay = wrapper.querySelector('.redaction-overlay');
      if (overlay) {
        var ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    });
    dispatchEvent('redaction-boxes-change', { boxes: {} });
  }

  /**
   * Start signature placement on current page
   */
  function startSignaturePlacement(signature) {
    state.signatureMode = true;
    state.currentSignature = signature;

    var pageIndex = state.currentPage - 1;
    var wrapper = state.pageWrappers[pageIndex];
    if (!wrapper) return;

    // Remove any existing signature overlay
    var existingOverlay = wrapper.querySelector('.signature-overlay-box');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Create signature overlay
    var sigBox = document.createElement('div');
    sigBox.className = 'signature-overlay-box';
    sigBox.style.width = signature.width + 'px';
    sigBox.style.height = signature.height + 'px';
    sigBox.style.left = '50px';
    sigBox.style.top = '50px';

    var img = document.createElement('img');
    img.src = signature.imageData;
    sigBox.appendChild(img);

    var resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    sigBox.appendChild(resizeHandle);

    wrapper.appendChild(sigBox);

    // Setup drag and resize
    state.signaturePlacement = {
      pageIndex: pageIndex,
      element: sigBox,
      x: 50,
      y: 50,
      width: signature.width,
      height: signature.height,
      rotation: 0
    };

    setupSignatureDragResize(sigBox, wrapper);

    dispatchEvent('signature-placement-start', { pageIndex: pageIndex });
  }

  /**
   * Setup drag and resize for signature
   */
  function setupSignatureDragResize(sigBox, wrapper) {
    var isDragging = false;
    var isResizing = false;
    var dragOffsetX, dragOffsetY;
    var resizeHandle = sigBox.querySelector('.resize-handle');

    function updatePlacement() {
      state.signaturePlacement.x = parseInt(sigBox.style.left);
      state.signaturePlacement.y = parseInt(sigBox.style.top);
      state.signaturePlacement.width = sigBox.offsetWidth;
      state.signaturePlacement.height = sigBox.offsetHeight;
    }

    sigBox.addEventListener('mousedown', function(e) {
      if (e.target === resizeHandle) {
        isResizing = true;
      } else {
        isDragging = true;
        var rect = sigBox.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
      }
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (isDragging) {
        var wrapperRect = wrapper.getBoundingClientRect();
        var x = e.clientX - wrapperRect.left - dragOffsetX;
        var y = e.clientY - wrapperRect.top - dragOffsetY;

        // Constrain to wrapper bounds
        x = Math.max(0, Math.min(x, wrapper.offsetWidth - sigBox.offsetWidth));
        y = Math.max(0, Math.min(y, wrapper.offsetHeight - sigBox.offsetHeight));

        sigBox.style.left = x + 'px';
        sigBox.style.top = y + 'px';
        updatePlacement();
      } else if (isResizing) {
        var wrapperRect = wrapper.getBoundingClientRect();
        var newWidth = e.clientX - wrapperRect.left - parseInt(sigBox.style.left);
        var newHeight = e.clientY - wrapperRect.top - parseInt(sigBox.style.top);

        newWidth = Math.max(30, newWidth);
        newHeight = Math.max(30, newHeight);

        sigBox.style.width = newWidth + 'px';
        sigBox.style.height = newHeight + 'px';
        updatePlacement();
      }
    });

    document.addEventListener('mouseup', function() {
      isDragging = false;
      isResizing = false;
    });
  }

  /**
   * Cancel signature placement
   */
  function cancelSignaturePlacement() {
    if (state.signaturePlacement) {
      state.signaturePlacement.element.remove();
    }
    state.signatureMode = false;
    state.currentSignature = null;
    state.signaturePlacement = null;
    dispatchEvent('signature-placement-cancel', {});
  }

  /**
   * Get current signature placement
   */
  function getSignaturePlacement() {
    if (!state.signaturePlacement) return null;

    var wrapper = state.pageWrappers[state.signaturePlacement.pageIndex];
    var canvas = wrapper.querySelector('.page-canvas');

    // Convert canvas coordinates to PDF coordinates
    // PDF coordinate system has origin at bottom-left
    return {
      pageIndex: state.signaturePlacement.pageIndex,
      x: state.signaturePlacement.x / state.scale,
      y: (canvas.height - state.signaturePlacement.y - state.signaturePlacement.height) / state.scale,
      width: state.signaturePlacement.width / state.scale,
      height: state.signaturePlacement.height / state.scale,
      rotation: state.signaturePlacement.rotation,
      scale: state.scale
    };
  }

  /**
   * Rotate signature left
   */
  function rotateSignatureLeft() {
    if (state.signaturePlacement) {
      state.signaturePlacement.rotation = (state.signaturePlacement.rotation - 90 + 360) % 360;
      state.signaturePlacement.element.style.transform = 'rotate(' + state.signaturePlacement.rotation + 'deg)';
    }
  }

  /**
   * Rotate signature right
   */
  function rotateSignatureRight() {
    if (state.signaturePlacement) {
      state.signaturePlacement.rotation = (state.signaturePlacement.rotation + 90) % 360;
      state.signaturePlacement.element.style.transform = 'rotate(' + state.signaturePlacement.rotation + 'deg)';
    }
  }

  /**
   * Dispatch custom event
   */
  function dispatchEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  /**
   * Destroy the viewer
   */
  function destroy() {
    state.observers.forEach(function(obs) { obs.disconnect(); });
    state.observers = [];
    state.viewer.innerHTML = '';
    state.pageWrappers = [];
    state.renderedPages.clear();
    state.renderQueue = [];
    state.redactionBoxes = {};
  }

  // Expose to global scope
  window.PDFViewer = {
    init: init
  };

})();
