/**
 * PDF Viewer Module
 * Continuous scroll PDF viewer with zoom and lazy loading
 */

(function() {
  'use strict';

  var Viewer = {
    // State
    pdfJsDoc: null,
    container: null,
    pagesContainer: null,
    scale: 1,
    currentPage: 1,
    totalPages: 0,
    pageElements: [],
    renderQueue: [],
    isRendering: false,
    observer: null,
    redactionMode: false,
    redactionBoxes: {},
    signatureMode: false,
    selectedSignature: null,
    signaturePlacement: null,

    // Callbacks
    onPageChange: null,
    onRedactionChange: null,
    onSignaturePlaced: null,

    /**
     * Initialize the viewer
     */
    init: function(options) {
      this.container = options.container;
      this.pagesContainer = options.pagesContainer;
      this.onPageChange = options.onPageChange || function() {};
      this.onRedactionChange = options.onRedactionChange || function() {};
      this.onSignaturePlaced = options.onSignaturePlaced || function() {};

      this.setupIntersectionObserver();
      this.setupScrollListener();
    },

    /**
     * Load a PDF document
     */
    load: function(pdfJsDoc) {
      this.pdfJsDoc = pdfJsDoc;
      this.totalPages = pdfJsDoc.numPages;
      this.currentPage = 1;
      this.pageElements = [];
      this.redactionBoxes = {};
      this.renderQueue = [];

      this.createPagePlaceholders();
      this.updateVisiblePages();

      return Promise.resolve();
    },

    /**
     * Set zoom level
     */
    setZoom: function(zoomValue) {
      var self = this;

      if (zoomValue === 'fit-width') {
        // Calculate scale based on container width
        if (this.pdfJsDoc && this.totalPages > 0) {
          return this.pdfJsDoc.getPage(1).then(function(page) {
            var viewport = page.getViewport({ scale: 1 });
            var containerWidth = self.container.clientWidth - 60; // Account for padding
            self.scale = containerWidth / viewport.width;
            return self.rerenderAllPages();
          });
        }
      } else {
        this.scale = parseFloat(zoomValue);
        return this.rerenderAllPages();
      }

      return Promise.resolve();
    },

    /**
     * Get current scale
     */
    getScale: function() {
      return this.scale;
    },

    /**
     * Get current page number
     */
    getCurrentPage: function() {
      return this.currentPage;
    },

    /**
     * Get total pages
     */
    getTotalPages: function() {
      return this.totalPages;
    },

    /**
     * Scroll to a specific page
     */
    scrollToPage: function(pageNum) {
      if (pageNum < 1 || pageNum > this.totalPages) return;

      var wrapper = this.pageElements[pageNum - 1];
      if (wrapper) {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },

    /**
     * Create placeholder elements for all pages
     */
    createPagePlaceholders: function() {
      var self = this;
      this.pagesContainer.innerHTML = '';
      this.pageElements = [];

      for (var i = 0; i < this.totalPages; i++) {
        var wrapper = document.createElement('div');
        wrapper.className = 'page-wrapper';
        wrapper.dataset.pageNum = i + 1;

        // Create placeholder
        var placeholder = document.createElement('div');
        placeholder.className = 'page-placeholder';
        placeholder.textContent = 'Page ' + (i + 1);

        // Create canvas (hidden until rendered)
        var canvas = document.createElement('canvas');
        canvas.className = 'page-canvas';
        canvas.style.display = 'none';

        // Create redaction overlay
        var redactOverlay = document.createElement('canvas');
        redactOverlay.className = 'redaction-overlay';

        // Create page label
        var label = document.createElement('div');
        label.className = 'page-label';
        label.textContent = 'Page ' + (i + 1) + ' of ' + this.totalPages;

        wrapper.appendChild(placeholder);
        wrapper.appendChild(canvas);
        wrapper.appendChild(redactOverlay);
        wrapper.appendChild(label);

        this.pagesContainer.appendChild(wrapper);
        this.pageElements.push(wrapper);

        // Set initial placeholder size based on first page
        (function(pageIndex, wrapperEl, placeholderEl) {
          self.pdfJsDoc.getPage(pageIndex + 1).then(function(page) {
            var viewport = page.getViewport({ scale: self.scale });
            placeholderEl.style.width = viewport.width + 'px';
            placeholderEl.style.height = viewport.height + 'px';
          });
        })(i, wrapper, placeholder);

        // Observe for visibility
        this.observer.observe(wrapper);
      }
    },

    /**
     * Setup IntersectionObserver for lazy loading and current page tracking
     */
    setupIntersectionObserver: function() {
      var self = this;

      this.observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          var pageNum = parseInt(entry.target.dataset.pageNum, 10);

          if (entry.isIntersecting) {
            // Queue for rendering
            self.queueRender(pageNum);
          }

          // Track current page (most visible)
          if (entry.intersectionRatio > 0.5) {
            if (self.currentPage !== pageNum) {
              self.currentPage = pageNum;
              self.onPageChange(pageNum, self.totalPages);
            }
          }
        });
      }, {
        root: this.container,
        rootMargin: '200px 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1]
      });
    },

    /**
     * Setup scroll listener for current page tracking
     */
    setupScrollListener: function() {
      var self = this;
      var scrollTimeout;

      this.container.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(function() {
          self.updateVisiblePages();
        }, 100);
      });
    },

    /**
     * Update which pages are visible
     */
    updateVisiblePages: function() {
      var containerRect = this.container.getBoundingClientRect();
      var mostVisiblePage = 1;
      var maxVisibility = 0;

      for (var i = 0; i < this.pageElements.length; i++) {
        var wrapper = this.pageElements[i];
        var rect = wrapper.getBoundingClientRect();

        // Check if in view
        var top = Math.max(rect.top, containerRect.top);
        var bottom = Math.min(rect.bottom, containerRect.bottom);
        var visibleHeight = Math.max(0, bottom - top);
        var visibility = visibleHeight / rect.height;

        if (visibility > maxVisibility) {
          maxVisibility = visibility;
          mostVisiblePage = i + 1;
        }

        // Queue render if visible
        if (visibleHeight > 0) {
          this.queueRender(i + 1);
        }
      }

      if (this.currentPage !== mostVisiblePage) {
        this.currentPage = mostVisiblePage;
        this.onPageChange(mostVisiblePage, this.totalPages);
      }
    },

    /**
     * Queue a page for rendering
     */
    queueRender: function(pageNum) {
      if (this.renderQueue.indexOf(pageNum) === -1) {
        var wrapper = this.pageElements[pageNum - 1];
        var canvas = wrapper.querySelector('.page-canvas');

        // Don't re-render already rendered pages at same scale
        if (canvas.dataset.renderedScale === String(this.scale)) {
          return;
        }

        this.renderQueue.push(pageNum);
        this.processRenderQueue();
      }
    },

    /**
     * Process the render queue
     */
    processRenderQueue: function() {
      var self = this;

      if (this.isRendering || this.renderQueue.length === 0) {
        return;
      }

      this.isRendering = true;
      var pageNum = this.renderQueue.shift();

      this.renderPage(pageNum).then(function() {
        self.isRendering = false;
        self.processRenderQueue();
      }).catch(function(error) {
        console.error('Error rendering page ' + pageNum + ':', error);
        self.isRendering = false;
        self.processRenderQueue();
      });
    },

    /**
     * Render a single page
     */
    renderPage: function(pageNum) {
      var self = this;
      var wrapper = this.pageElements[pageNum - 1];
      var placeholder = wrapper.querySelector('.page-placeholder');
      var canvas = wrapper.querySelector('.page-canvas');
      var redactOverlay = wrapper.querySelector('.redaction-overlay');

      return this.pdfJsDoc.getPage(pageNum).then(function(page) {
        var viewport = page.getViewport({ scale: self.scale });

        // Set canvas dimensions
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';

        // Set redaction overlay dimensions
        redactOverlay.width = viewport.width;
        redactOverlay.height = viewport.height;
        redactOverlay.style.width = viewport.width + 'px';
        redactOverlay.style.height = viewport.height + 'px';

        // Update placeholder size
        placeholder.style.width = viewport.width + 'px';
        placeholder.style.height = viewport.height + 'px';

        var ctx = canvas.getContext('2d');

        return page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise.then(function() {
          // Show canvas, hide placeholder
          canvas.style.display = 'block';
          placeholder.style.display = 'none';
          canvas.dataset.renderedScale = self.scale;

          // Re-draw redaction boxes if any
          self.drawRedactionBoxes(pageNum);
        });
      });
    },

    /**
     * Re-render all visible pages (after zoom change)
     */
    rerenderAllPages: function() {
      var self = this;

      // Clear render queue
      this.renderQueue = [];

      // Reset all pages to placeholder state
      this.pageElements.forEach(function(wrapper, index) {
        var placeholder = wrapper.querySelector('.page-placeholder');
        var canvas = wrapper.querySelector('.page-canvas');

        canvas.dataset.renderedScale = '';
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';

        // Update placeholder size
        self.pdfJsDoc.getPage(index + 1).then(function(page) {
          var viewport = page.getViewport({ scale: self.scale });
          placeholder.style.width = viewport.width + 'px';
          placeholder.style.height = viewport.height + 'px';
        });
      });

      // Queue visible pages for rendering
      return new Promise(function(resolve) {
        setTimeout(function() {
          self.updateVisiblePages();
          resolve();
        }, 50);
      });
    },

    /**
     * Refresh the viewer (after PDF changes)
     */
    refresh: function(pdfJsDoc) {
      this.pdfJsDoc = pdfJsDoc;
      this.totalPages = pdfJsDoc.numPages;

      // Recreate page elements
      this.createPagePlaceholders();
      this.updateVisiblePages();

      return Promise.resolve();
    },

    /**
     * Enable redaction mode
     */
    enableRedactionMode: function() {
      var self = this;
      this.redactionMode = true;

      this.pageElements.forEach(function(wrapper) {
        var overlay = wrapper.querySelector('.redaction-overlay');
        overlay.classList.add('active');
        self.setupRedactionDrawing(wrapper);
      });
    },

    /**
     * Disable redaction mode
     */
    disableRedactionMode: function() {
      this.redactionMode = false;

      this.pageElements.forEach(function(wrapper) {
        var overlay = wrapper.querySelector('.redaction-overlay');
        overlay.classList.remove('active');
      });
    },

    /**
     * Setup redaction drawing on a page
     */
    setupRedactionDrawing: function(wrapper) {
      var self = this;
      var overlay = wrapper.querySelector('.redaction-overlay');
      var pageNum = parseInt(wrapper.dataset.pageNum, 10);

      var isDrawing = false;
      var startX, startY;

      overlay.onmousedown = function(e) {
        if (!self.redactionMode) return;

        var rect = overlay.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        isDrawing = true;
      };

      overlay.onmousemove = function(e) {
        if (!isDrawing) return;

        var rect = overlay.getBoundingClientRect();
        var currentX = e.clientX - rect.left;
        var currentY = e.clientY - rect.top;

        // Preview box
        self.drawRedactionBoxes(pageNum, {
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY)
        });
      };

      overlay.onmouseup = function(e) {
        if (!isDrawing) return;
        isDrawing = false;

        var rect = overlay.getBoundingClientRect();
        var endX = e.clientX - rect.left;
        var endY = e.clientY - rect.top;

        var box = {
          x: Math.min(startX, endX),
          y: Math.min(startY, endY),
          width: Math.abs(endX - startX),
          height: Math.abs(endY - startY)
        };

        // Only add if large enough
        if (box.width > 5 && box.height > 5) {
          if (!self.redactionBoxes[pageNum]) {
            self.redactionBoxes[pageNum] = [];
          }
          self.redactionBoxes[pageNum].push(box);
          self.onRedactionChange(self.redactionBoxes);
        }

        self.drawRedactionBoxes(pageNum);
      };

      // Right-click to delete box
      overlay.oncontextmenu = function(e) {
        e.preventDefault();

        if (!self.redactionBoxes[pageNum]) return;

        var rect = overlay.getBoundingClientRect();
        var clickX = e.clientX - rect.left;
        var clickY = e.clientY - rect.top;

        // Find and remove clicked box
        var boxes = self.redactionBoxes[pageNum];
        for (var i = boxes.length - 1; i >= 0; i--) {
          var box = boxes[i];
          if (clickX >= box.x && clickX <= box.x + box.width &&
              clickY >= box.y && clickY <= box.y + box.height) {
            boxes.splice(i, 1);
            self.onRedactionChange(self.redactionBoxes);
            self.drawRedactionBoxes(pageNum);
            break;
          }
        }
      };
    },

    /**
     * Draw redaction boxes on a page
     */
    drawRedactionBoxes: function(pageNum, previewBox) {
      var wrapper = this.pageElements[pageNum - 1];
      var overlay = wrapper.querySelector('.redaction-overlay');
      var ctx = overlay.getContext('2d');

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // Draw existing boxes
      var boxes = this.redactionBoxes[pageNum] || [];
      boxes.forEach(function(box) {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      });

      // Draw preview box
      if (previewBox) {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        ctx.fillRect(previewBox.x, previewBox.y, previewBox.width, previewBox.height);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(previewBox.x, previewBox.y, previewBox.width, previewBox.height);
        ctx.setLineDash([]);
      }
    },

    /**
     * Get all redaction boxes
     */
    getRedactionBoxes: function() {
      return this.redactionBoxes;
    },

    /**
     * Check if there are any redaction boxes
     */
    hasRedactionBoxes: function() {
      var self = this;
      return Object.keys(this.redactionBoxes).some(function(key) {
        return self.redactionBoxes[key] && self.redactionBoxes[key].length > 0;
      });
    },

    /**
     * Clear all redaction boxes
     */
    clearRedactionBoxes: function() {
      var self = this;
      this.redactionBoxes = {};

      this.pageElements.forEach(function(wrapper) {
        var pageNum = parseInt(wrapper.dataset.pageNum, 10);
        self.drawRedactionBoxes(pageNum);
      });

      this.onRedactionChange(this.redactionBoxes);
    },

    /**
     * Get redaction boxes scaled to PDF coordinates
     */
    getRedactionBoxesForPDF: function() {
      var self = this;
      var result = {};
      var scale = this.scale;

      Object.keys(this.redactionBoxes).forEach(function(pageNum) {
        var boxes = self.redactionBoxes[pageNum];
        if (boxes && boxes.length > 0) {
          result[parseInt(pageNum, 10) - 1] = boxes.map(function(box) {
            return {
              x: box.x / scale,
              y: box.y / scale,
              width: box.width / scale,
              height: box.height / scale
            };
          });
        }
      });

      return result;
    },

    /**
     * Enable signature placement mode
     */
    enableSignatureMode: function(signature) {
      var self = this;
      this.signatureMode = true;
      this.selectedSignature = signature;
      this.signaturePlacement = null;

      // Add click handler to current page for placement
      var currentWrapper = this.pageElements[this.currentPage - 1];
      this.setupSignaturePlacement(currentWrapper);
    },

    /**
     * Disable signature mode
     */
    disableSignatureMode: function() {
      this.signatureMode = false;
      this.selectedSignature = null;
      this.signaturePlacement = null;

      // Remove any preview elements
      this.pageElements.forEach(function(wrapper) {
        var preview = wrapper.querySelector('.signature-preview');
        if (preview) {
          preview.remove();
        }
      });
    },

    /**
     * Setup signature placement on a page
     */
    setupSignaturePlacement: function(wrapper) {
      var self = this;
      var pageNum = parseInt(wrapper.dataset.pageNum, 10);

      // Remove existing preview
      var existingPreview = wrapper.querySelector('.signature-preview');
      if (existingPreview) {
        existingPreview.remove();
      }

      wrapper.onclick = function(e) {
        if (!self.signatureMode || !self.selectedSignature) return;

        // Don't create new signature if one already exists (prevents re-creation on resize/drag mouseup)
        if (wrapper.querySelector('.signature-preview')) return;

        // Don't create if click originated from signature element
        if (e.target.closest('.signature-preview')) return;

        var rect = wrapper.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;

        // Create signature preview
        self.createSignaturePreview(wrapper, x, y);
      };
    },

    /**
     * Create signature preview element
     */
    createSignaturePreview: function(wrapper, x, y) {
      var self = this;
      var pageNum = parseInt(wrapper.dataset.pageNum, 10);

      // Remove existing preview
      var existing = wrapper.querySelector('.signature-preview');
      if (existing) {
        existing.remove();
      }

      var sig = this.selectedSignature;
      var initialWidth = Math.min(sig.width * 0.5, 150);
      var initialHeight = (initialWidth / sig.width) * sig.height;

      var preview = document.createElement('div');
      preview.className = 'signature-preview';
      preview.style.left = (x - initialWidth / 2) + 'px';
      preview.style.top = (y - initialHeight / 2) + 'px';
      preview.style.width = initialWidth + 'px';
      preview.style.height = initialHeight + 'px';

      var img = document.createElement('img');
      img.src = sig.imageData;
      preview.appendChild(img);

      var resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      preview.appendChild(resizeHandle);

      wrapper.appendChild(preview);

      // Stop clicks on preview from bubbling to wrapper
      preview.onclick = function(e) {
        e.stopPropagation();
      };

      // Make draggable and resizable
      this.makeSignatureDraggable(preview, wrapper);
      this.makeSignatureResizable(preview, resizeHandle);

      // Store placement
      this.signaturePlacement = {
        pageNum: pageNum,
        element: preview,
        rotation: 0
      };
    },

    /**
     * Make signature preview draggable
     */
    makeSignatureDraggable: function(element, container) {
      var isDragging = false;
      var startX, startY, startLeft, startTop;

      element.onmousedown = function(e) {
        if (e.target.classList.contains('resize-handle')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = element.offsetLeft;
        startTop = element.offsetTop;
        e.preventDefault();
      };

      document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        var dx = e.clientX - startX;
        var dy = e.clientY - startY;

        element.style.left = (startLeft + dx) + 'px';
        element.style.top = (startTop + dy) + 'px';
      });

      document.addEventListener('mouseup', function() {
        isDragging = false;
      });
    },

    /**
     * Make signature preview resizable
     */
    makeSignatureResizable: function(element, handle) {
      var isResizing = false;
      var startX, startY, startWidth, startHeight;
      var aspectRatio;

      handle.onmousedown = function(e) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = element.offsetWidth;
        startHeight = element.offsetHeight;
        aspectRatio = startWidth / startHeight;
        e.stopPropagation();
        e.preventDefault();
      };

      document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;

        var dx = e.clientX - startX;
        var newWidth = Math.max(50, startWidth + dx);
        var newHeight = newWidth / aspectRatio;

        element.style.width = newWidth + 'px';
        element.style.height = newHeight + 'px';
      });

      document.addEventListener('mouseup', function() {
        isResizing = false;
      });
    },

    /**
     * Rotate current signature placement
     */
    rotateSignature: function(degrees) {
      if (!this.signaturePlacement) return;

      this.signaturePlacement.rotation += degrees;
      var img = this.signaturePlacement.element.querySelector('img');
      img.style.transform = 'rotate(' + this.signaturePlacement.rotation + 'deg)';
    },

    /**
     * Get current signature placement data
     */
    getSignaturePlacement: function() {
      if (!this.signaturePlacement) return null;

      var el = this.signaturePlacement.element;
      var scale = this.scale;

      return {
        pageIndex: this.signaturePlacement.pageNum - 1,
        x: el.offsetLeft / scale,
        y: el.offsetTop / scale,
        width: el.offsetWidth / scale,
        height: el.offsetHeight / scale,
        rotation: this.signaturePlacement.rotation
      };
    },

    /**
     * Clean up
     */
    destroy: function() {
      if (this.observer) {
        this.observer.disconnect();
      }
      this.pagesContainer.innerHTML = '';
      this.pageElements = [];
      this.renderQueue = [];
      this.redactionBoxes = {};
    }
  };

  // Export to window
  window.PDFViewer = Viewer;

})();
