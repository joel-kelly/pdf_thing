/**
 * UI Handler Module
 * Legacy functions retained for compatibility
 * Most rendering has moved to viewer.js, tools-panel.js, and modal-manager.js
 */

(function() {
  'use strict';

  /**
   * Show loading overlay
   */
  function showLoading(message) {
    message = message || 'Processing...';
    var overlay = document.getElementById('loading-overlay');
    var text = document.getElementById('loading-text');
    if (text) text.textContent = message;
    if (overlay) overlay.classList.remove('hidden');
  }

  /**
   * Hide loading overlay
   */
  function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  /**
   * Show an alert/notification
   */
  function showAlert(message, type) {
    alert(message);
  }

  /**
   * Show a confirmation dialog
   */
  function showConfirm(message) {
    return confirm(message);
  }

  /**
   * Update page count display (legacy - now handled by popup.js)
   */
  function updatePageCount(count) {
    var totalPages = document.getElementById('total-pages');
    if (totalPages) {
      totalPages.textContent = count;
    }
  }

  /**
   * Render a page for redaction editing (legacy, used for backward compat)
   */
  async function renderPageForRedaction(pdfJsPage, pageCanvas, overlayCanvas, maxWidth) {
    maxWidth = maxWidth || 500;

    var baseViewport = pdfJsPage.getViewport({ scale: 1 });
    var scale = maxWidth / baseViewport.width;
    var viewport = pdfJsPage.getViewport({ scale: scale });

    pageCanvas.width = viewport.width;
    pageCanvas.height = viewport.height;
    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;

    var context = pageCanvas.getContext('2d');
    await pdfJsPage.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    return {
      scale: scale,
      width: viewport.width,
      height: viewport.height
    };
  }

  /**
   * Setup redaction box drawing on overlay canvas (legacy)
   */
  function setupRedactionDrawing(overlayCanvas, state, onBoxesChange) {
    var ctx = overlayCanvas.getContext('2d');
    var isDrawing = false;
    var startX, startY;
    var currentBox = null;

    if (!state.boxes) {
      state.boxes = [];
    }

    function redraw() {
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;

      for (var i = 0; i < state.boxes.length; i++) {
        var box = state.boxes[i];
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      }

      if (currentBox) {
        ctx.fillRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
        ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
      }
    }

    function getMousePos(e) {
      var rect = overlayCanvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    overlayCanvas.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;

      var pos = getMousePos(e);
      isDrawing = true;
      startX = pos.x;
      startY = pos.y;
      currentBox = { x: startX, y: startY, width: 0, height: 0 };
    });

    overlayCanvas.addEventListener('mousemove', function(e) {
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

    overlayCanvas.addEventListener('mouseup', function() {
      if (!isDrawing) return;
      isDrawing = false;

      if (currentBox && currentBox.width > 5 && currentBox.height > 5) {
        state.boxes.push(currentBox);
        if (onBoxesChange) {
          onBoxesChange(state.boxes);
        }
      }
      currentBox = null;
      redraw();
    });

    overlayCanvas.addEventListener('mouseleave', function() {
      if (isDrawing) {
        isDrawing = false;
        currentBox = null;
        redraw();
      }
    });

    overlayCanvas.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      var pos = getMousePos(e);

      for (var i = state.boxes.length - 1; i >= 0; i--) {
        var box = state.boxes[i];
        if (pos.x >= box.x && pos.x <= box.x + box.width &&
            pos.y >= box.y && pos.y <= box.y + box.height) {
          state.boxes.splice(i, 1);
          if (onBoxesChange) {
            onBoxesChange(state.boxes);
          }
          redraw();
          break;
        }
      }
    });

    return {
      redraw: redraw,
      clear: function() {
        state.boxes = [];
        if (onBoxesChange) {
          onBoxesChange(state.boxes);
        }
        redraw();
      },
      getBoxes: function() {
        return state.boxes.slice();
      }
    };
  }

  /**
   * Render signature library (legacy)
   */
  function renderSignatureLibrary(signatures, container, options) {
    options = options || {};
    container.innerHTML = '';

    if (signatures.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'empty-signatures';
      empty.textContent = 'No signatures saved. Click "Add Signature" to create one.';
      container.appendChild(empty);
      return;
    }

    for (var i = 0; i < signatures.length; i++) {
      var sig = signatures[i];

      var item = document.createElement('div');
      item.className = 'signature-item';
      item.dataset.signatureId = sig.id;

      var img = document.createElement('img');
      img.src = sig.imageData;
      img.alt = sig.name;
      item.appendChild(img);

      var name = document.createElement('div');
      name.className = 'sig-name';
      name.textContent = sig.name;
      item.appendChild(name);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-sig-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = 'Delete signature';
      deleteBtn.addEventListener('click', (function(sigId) {
        return function(e) {
          e.stopPropagation();
          if (options.onDelete) {
            options.onDelete(sigId);
          }
        };
      })(sig.id));
      item.appendChild(deleteBtn);

      item.addEventListener('click', (function(signature) {
        return function() {
          container.querySelectorAll('.signature-item').forEach(function(el) {
            el.classList.remove('selected');
          });
          item.classList.add('selected');

          if (options.onSelect) {
            options.onSelect(signature);
          }
        };
      })(sig));

      container.appendChild(item);
    }
  }

  /**
   * Setup signature placement on page (legacy)
   */
  function setupSignaturePlacement(pageCanvas, overlayCanvas, signature, state) {
    var ctx = overlayCanvas.getContext('2d');
    var img = new Image();

    state.x = 50;
    state.y = 50;
    state.width = signature.width;
    state.height = signature.height;
    state.rotation = 0;
    state.ready = false;

    var isDragging = false;
    var isResizing = false;
    var dragOffsetX, dragOffsetY;

    img.onload = function() {
      state.ready = true;
      redraw();
    };
    img.src = signature.imageData;

    function redraw() {
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      if (!state.ready) return;

      ctx.save();
      ctx.translate(state.x + state.width / 2, state.y + state.height / 2);
      ctx.rotate(state.rotation * Math.PI / 180);
      ctx.drawImage(img, -state.width / 2, -state.height / 2, state.width, state.height);

      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(-state.width / 2, -state.height / 2, state.width, state.height);

      ctx.restore();

      ctx.fillStyle = '#3498db';
      ctx.fillRect(state.x + state.width - 6, state.y + state.height - 6, 12, 12);
    }

    function getMousePos(e) {
      var rect = overlayCanvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    function isInResizeHandle(pos) {
      return (
        pos.x >= state.x + state.width - 12 &&
        pos.x <= state.x + state.width + 6 &&
        pos.y >= state.y + state.height - 12 &&
        pos.y <= state.y + state.height + 6
      );
    }

    function isInSignature(pos) {
      return (
        pos.x >= state.x &&
        pos.x <= state.x + state.width &&
        pos.y >= state.y &&
        pos.y <= state.y + state.height
      );
    }

    overlayCanvas.addEventListener('mousedown', function(e) {
      var pos = getMousePos(e);

      if (isInResizeHandle(pos)) {
        isResizing = true;
      } else if (isInSignature(pos)) {
        isDragging = true;
        dragOffsetX = pos.x - state.x;
        dragOffsetY = pos.y - state.y;
      }
    });

    overlayCanvas.addEventListener('mousemove', function(e) {
      var pos = getMousePos(e);

      if (isDragging) {
        state.x = pos.x - dragOffsetX;
        state.y = pos.y - dragOffsetY;
        redraw();
      } else if (isResizing) {
        state.width = Math.max(20, pos.x - state.x);
        state.height = Math.max(20, pos.y - state.y);
        redraw();
      } else {
        if (isInResizeHandle(pos)) {
          overlayCanvas.style.cursor = 'se-resize';
        } else if (isInSignature(pos)) {
          overlayCanvas.style.cursor = 'move';
        } else {
          overlayCanvas.style.cursor = 'default';
        }
      }
    });

    overlayCanvas.addEventListener('mouseup', function() {
      isDragging = false;
      isResizing = false;
    });

    overlayCanvas.addEventListener('mouseleave', function() {
      isDragging = false;
      isResizing = false;
    });

    return {
      redraw: redraw,
      rotateLeft: function() {
        state.rotation = (state.rotation - 90 + 360) % 360;
        redraw();
      },
      rotateRight: function() {
        state.rotation = (state.rotation + 90) % 360;
        redraw();
      },
      getPlacement: function() {
        return {
          x: state.x,
          y: overlayCanvas.height - state.y - state.height,
          width: state.width,
          height: state.height,
          rotation: state.rotation
        };
      }
    };
  }

  /**
   * Get selected page indices from the grid (legacy)
   */
  function getSelectedPageIndices(container) {
    var selected = [];
    container.querySelectorAll('.page-item.selected').forEach(function(item) {
      selected.push(parseInt(item.dataset.pageIndex));
    });
    return selected.sort(function(a, b) { return a - b; });
  }

  /**
   * Render PDF page thumbnails for page management (legacy, for reorder modal)
   */
  async function renderPageThumbnails(pdfJsDoc, container, options) {
    options = options || {};
    container.innerHTML = '';

    var pageCount = pdfJsDoc.numPages;
    var scale = 0.3;

    for (var pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        var page = await pdfJsDoc.getPage(pageNum);
        var viewport = page.getViewport({ scale: scale });

        var pageItem = document.createElement('div');
        pageItem.className = 'page-item';
        pageItem.dataset.pageIndex = pageNum - 1;
        pageItem.draggable = true;

        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        pageItem.appendChild(canvas);
        container.appendChild(pageItem);

        var context = canvas.getContext('2d');
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        var pageLabel = document.createElement('span');
        pageLabel.className = 'page-number';
        pageLabel.textContent = pageNum;
        pageItem.appendChild(pageLabel);

      } catch (error) {
        console.error('Error rendering page ' + pageNum + ':', error);
      }
    }
  }

  // Expose to global scope
  window.UIHandler = {
    showLoading: showLoading,
    hideLoading: hideLoading,
    showAlert: showAlert,
    showConfirm: showConfirm,
    updatePageCount: updatePageCount,
    renderPageForRedaction: renderPageForRedaction,
    setupRedactionDrawing: setupRedactionDrawing,
    renderSignatureLibrary: renderSignatureLibrary,
    setupSignaturePlacement: setupSignaturePlacement,
    getSelectedPageIndices: getSelectedPageIndices,
    renderPageThumbnails: renderPageThumbnails
  };

})();
