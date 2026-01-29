/**
 * UI Handler Module
 * Manages UI rendering and interactions
 */

(function() {
  'use strict';

  /**
   * Render PDF page thumbnails for page management
   */
  async function renderPageThumbnails(pdfJsDoc, container, options) {
    options = options || {};
    container.innerHTML = '';

    const pageCount = pdfJsDoc.numPages;
    const scale = 0.3;

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfJsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const pageItem = document.createElement('div');
      pageItem.className = 'page-item';
      pageItem.dataset.pageIndex = pageNum - 1;
      pageItem.draggable = true;

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      pageItem.appendChild(canvas);

      const pageLabel = document.createElement('span');
      pageLabel.className = 'page-number';
      pageLabel.textContent = pageNum;
      pageItem.appendChild(pageLabel);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'select-checkbox';
      checkbox.addEventListener('change', function() {
        pageItem.classList.toggle('selected', checkbox.checked);
        if (options.onSelect) {
          options.onSelect(pageNum - 1, checkbox.checked);
        }
      });
      pageItem.appendChild(checkbox);

      const controls = document.createElement('div');
      controls.className = 'page-controls';

      const rotateBtn = createControlButton('rotate', '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z"/></svg>');
      rotateBtn.title = 'Rotate 90°';
      rotateBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (options.onRotate) {
          options.onRotate(pageNum - 1);
        }
      });
      controls.appendChild(rotateBtn);

      const deleteBtn = createControlButton('delete', '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>');
      deleteBtn.title = 'Delete page';
      deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (options.onDelete) {
          options.onDelete(pageNum - 1);
        }
      });
      controls.appendChild(deleteBtn);

      pageItem.appendChild(controls);
      setupDragAndDrop(pageItem, container, options.onReorder);
      container.appendChild(pageItem);
    }
  }

  function createControlButton(className, innerHTML) {
    const btn = document.createElement('button');
    btn.className = 'page-control-btn ' + className;
    btn.innerHTML = innerHTML;
    return btn;
  }

  function setupDragAndDrop(pageItem, container, onReorder) {
    pageItem.addEventListener('dragstart', function(e) {
      pageItem.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', pageItem.dataset.pageIndex);
    });

    pageItem.addEventListener('dragend', function() {
      pageItem.classList.remove('dragging');
      container.querySelectorAll('.page-item').forEach(function(item) {
        item.classList.remove('drag-over');
      });
    });

    pageItem.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      pageItem.classList.add('drag-over');
    });

    pageItem.addEventListener('dragleave', function() {
      pageItem.classList.remove('drag-over');
    });

    pageItem.addEventListener('drop', function(e) {
      e.preventDefault();
      pageItem.classList.remove('drag-over');

      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = parseInt(pageItem.dataset.pageIndex);

      if (fromIndex !== toIndex && onReorder) {
        onReorder(fromIndex, toIndex);
      }
    });
  }

  /**
   * Render a page for redaction editing
   */
  async function renderPageForRedaction(pdfJsPage, pageCanvas, overlayCanvas, maxWidth) {
    maxWidth = maxWidth || 500;

    const baseViewport = pdfJsPage.getViewport({ scale: 1 });
    const scale = maxWidth / baseViewport.width;
    const viewport = pdfJsPage.getViewport({ scale });

    pageCanvas.width = viewport.width;
    pageCanvas.height = viewport.height;
    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;

    const context = pageCanvas.getContext('2d');
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
   * Setup redaction box drawing on overlay canvas
   */
  function setupRedactionDrawing(overlayCanvas, state, onBoxesChange) {
    const ctx = overlayCanvas.getContext('2d');
    let isDrawing = false;
    let startX, startY;
    let currentBox = null;

    if (!state.boxes) {
      state.boxes = [];
    }

    function redraw() {
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;

      for (let i = 0; i < state.boxes.length; i++) {
        const box = state.boxes[i];
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      }

      if (currentBox) {
        ctx.fillRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
        ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
      }
    }

    function getMousePos(e) {
      const rect = overlayCanvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    overlayCanvas.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;

      const pos = getMousePos(e);
      isDrawing = true;
      startX = pos.x;
      startY = pos.y;
      currentBox = { x: startX, y: startY, width: 0, height: 0 };
    });

    overlayCanvas.addEventListener('mousemove', function(e) {
      if (!isDrawing) return;

      const pos = getMousePos(e);
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
      const pos = getMousePos(e);

      for (let i = state.boxes.length - 1; i >= 0; i--) {
        const box = state.boxes[i];
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
   * Render signature library
   */
  function renderSignatureLibrary(signatures, container, options) {
    options = options || {};
    container.innerHTML = '';

    if (signatures.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-signatures';
      empty.textContent = 'No signatures saved. Click "Add Signature" to create one.';
      container.appendChild(empty);
      return;
    }

    for (let i = 0; i < signatures.length; i++) {
      const sig = signatures[i];

      const item = document.createElement('div');
      item.className = 'signature-item';
      item.dataset.signatureId = sig.id;

      const img = document.createElement('img');
      img.src = sig.imageData;
      img.alt = sig.name;
      item.appendChild(img);

      const name = document.createElement('div');
      name.className = 'sig-name';
      name.textContent = sig.name;
      item.appendChild(name);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-sig-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = 'Delete signature';
      deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (options.onDelete) {
          options.onDelete(sig.id);
        }
      });
      item.appendChild(deleteBtn);

      item.addEventListener('click', function() {
        container.querySelectorAll('.signature-item').forEach(function(el) {
          el.classList.remove('selected');
        });
        item.classList.add('selected');

        if (options.onSelect) {
          options.onSelect(sig);
        }
      });

      container.appendChild(item);
    }
  }

  /**
   * Setup signature placement on page
   */
  function setupSignaturePlacement(pageCanvas, overlayCanvas, signature, state) {
    const ctx = overlayCanvas.getContext('2d');
    const img = new Image();

    state.x = 50;
    state.y = 50;
    state.width = signature.width;
    state.height = signature.height;
    state.rotation = 0;
    state.ready = false;

    let isDragging = false;
    let isResizing = false;
    let dragOffsetX, dragOffsetY;

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
      const rect = overlayCanvas.getBoundingClientRect();
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
      const pos = getMousePos(e);

      if (isInResizeHandle(pos)) {
        isResizing = true;
      } else if (isInSignature(pos)) {
        isDragging = true;
        dragOffsetX = pos.x - state.x;
        dragOffsetY = pos.y - state.y;
      }
    });

    overlayCanvas.addEventListener('mousemove', function(e) {
      const pos = getMousePos(e);

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
   * Show loading overlay
   */
  function showLoading(message) {
    message = message || 'Processing...';
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (text) text.textContent = message;
    if (overlay) overlay.classList.remove('hidden');
  }

  /**
   * Hide loading overlay
   */
  function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
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
   * Get selected page indices from the grid
   */
  function getSelectedPageIndices(container) {
    const selected = [];
    container.querySelectorAll('.page-item.selected').forEach(function(item) {
      selected.push(parseInt(item.dataset.pageIndex));
    });
    return selected.sort(function(a, b) { return a - b; });
  }

  /**
   * Update page count display
   */
  function updatePageCount(count) {
    const el = document.getElementById('page-count');
    if (el) {
      el.textContent = count + ' page' + (count !== 1 ? 's' : '');
    }
  }

  // Expose to global scope
  window.UIHandler = {
    renderPageThumbnails: renderPageThumbnails,
    renderPageForRedaction: renderPageForRedaction,
    setupRedactionDrawing: setupRedactionDrawing,
    renderSignatureLibrary: renderSignatureLibrary,
    setupSignaturePlacement: setupSignaturePlacement,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showAlert: showAlert,
    showConfirm: showConfirm,
    getSelectedPageIndices: getSelectedPageIndices,
    updatePageCount: updatePageCount
  };
})();
