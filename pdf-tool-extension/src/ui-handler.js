/**
 * UI Handler Module
 * Manages UI rendering and interactions
 */

/**
 * Render PDF page thumbnails for page management
 * @param {Object} pdfJsDoc - PDF.js document
 * @param {HTMLElement} container - Container element for thumbnails
 * @param {Object} options - Rendering options
 * @param {Function} options.onRotate - Callback when rotate button clicked
 * @param {Function} options.onDelete - Callback when delete button clicked
 * @param {Function} options.onSelect - Callback when page selected
 * @param {Function} options.onReorder - Callback when pages reordered
 */
export async function renderPageThumbnails(pdfJsDoc, container, options = {}) {
  container.innerHTML = '';

  const pageCount = pdfJsDoc.numPages;
  const scale = 0.3; // Thumbnail scale

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdfJsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    // Create page item container
    const pageItem = document.createElement('div');
    pageItem.className = 'page-item';
    pageItem.dataset.pageIndex = pageNum - 1;
    pageItem.draggable = true;

    // Create canvas for thumbnail
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    pageItem.appendChild(canvas);

    // Page number label
    const pageLabel = document.createElement('span');
    pageLabel.className = 'page-number';
    pageLabel.textContent = pageNum;
    pageItem.appendChild(pageLabel);

    // Selection checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'select-checkbox';
    checkbox.addEventListener('change', () => {
      pageItem.classList.toggle('selected', checkbox.checked);
      if (options.onSelect) {
        options.onSelect(pageNum - 1, checkbox.checked);
      }
    });
    pageItem.appendChild(checkbox);

    // Page controls
    const controls = document.createElement('div');
    controls.className = 'page-controls';

    // Rotate button
    const rotateBtn = createControlButton('rotate', `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z"/>
      </svg>
    `);
    rotateBtn.title = 'Rotate 90°';
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (options.onRotate) {
        options.onRotate(pageNum - 1);
      }
    });
    controls.appendChild(rotateBtn);

    // Delete button
    const deleteBtn = createControlButton('delete', `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
      </svg>
    `);
    deleteBtn.title = 'Delete page';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (options.onDelete) {
        options.onDelete(pageNum - 1);
      }
    });
    controls.appendChild(deleteBtn);

    pageItem.appendChild(controls);

    // Drag and drop handlers
    setupDragAndDrop(pageItem, container, options.onReorder);

    container.appendChild(pageItem);
  }
}

/**
 * Create a control button
 * @param {string} className - Additional class name
 * @param {string} innerHTML - Button inner HTML
 * @returns {HTMLButtonElement}
 */
function createControlButton(className, innerHTML) {
  const btn = document.createElement('button');
  btn.className = `page-control-btn ${className}`;
  btn.innerHTML = innerHTML;
  return btn;
}

/**
 * Setup drag and drop for page reordering
 * @param {HTMLElement} pageItem - The page item element
 * @param {HTMLElement} container - The container element
 * @param {Function} onReorder - Callback when reordering occurs
 */
function setupDragAndDrop(pageItem, container, onReorder) {
  pageItem.addEventListener('dragstart', (e) => {
    pageItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', pageItem.dataset.pageIndex);
  });

  pageItem.addEventListener('dragend', () => {
    pageItem.classList.remove('dragging');
    container.querySelectorAll('.page-item').forEach(item => {
      item.classList.remove('drag-over');
    });
  });

  pageItem.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    pageItem.classList.add('drag-over');
  });

  pageItem.addEventListener('dragleave', () => {
    pageItem.classList.remove('drag-over');
  });

  pageItem.addEventListener('drop', (e) => {
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
 * @param {Object} pdfJsPage - PDF.js page object
 * @param {HTMLCanvasElement} pageCanvas - Canvas for page rendering
 * @param {HTMLCanvasElement} overlayCanvas - Canvas for redaction overlay
 * @param {number} [maxWidth=500] - Maximum canvas width
 * @returns {Promise<{scale: number, width: number, height: number}>}
 */
export async function renderPageForRedaction(pdfJsPage, pageCanvas, overlayCanvas, maxWidth = 500) {
  // Calculate scale to fit width
  const baseViewport = pdfJsPage.getViewport({ scale: 1 });
  const scale = maxWidth / baseViewport.width;
  const viewport = pdfJsPage.getViewport({ scale });

  // Setup canvases
  pageCanvas.width = viewport.width;
  pageCanvas.height = viewport.height;
  overlayCanvas.width = viewport.width;
  overlayCanvas.height = viewport.height;

  // Render page
  const context = pageCanvas.getContext('2d');
  await pdfJsPage.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  return {
    scale,
    width: viewport.width,
    height: viewport.height
  };
}

/**
 * Setup redaction box drawing on overlay canvas
 * @param {HTMLCanvasElement} overlayCanvas - The overlay canvas
 * @param {Object} state - State object to track boxes
 * @param {Function} onBoxesChange - Callback when boxes change
 * @returns {Object} Controller object with methods
 */
export function setupRedactionDrawing(overlayCanvas, state, onBoxesChange) {
  const ctx = overlayCanvas.getContext('2d');
  let isDrawing = false;
  let startX, startY;
  let currentBox = null;

  // Initialize boxes array if not exists
  if (!state.boxes) {
    state.boxes = [];
  }

  function redraw() {
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Draw existing boxes
    ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;

    for (const box of state.boxes) {
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
    }

    // Draw current box being drawn
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

  overlayCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left click

    const pos = getMousePos(e);
    isDrawing = true;
    startX = pos.x;
    startY = pos.y;
    currentBox = { x: startX, y: startY, width: 0, height: 0 };
  });

  overlayCanvas.addEventListener('mousemove', (e) => {
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

  overlayCanvas.addEventListener('mouseup', () => {
    if (!isDrawing) return;
    isDrawing = false;

    // Only add box if it has some size
    if (currentBox && currentBox.width > 5 && currentBox.height > 5) {
      state.boxes.push(currentBox);
      if (onBoxesChange) {
        onBoxesChange(state.boxes);
      }
    }
    currentBox = null;
    redraw();
  });

  overlayCanvas.addEventListener('mouseleave', () => {
    if (isDrawing) {
      isDrawing = false;
      currentBox = null;
      redraw();
    }
  });

  // Right-click to remove box
  overlayCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pos = getMousePos(e);

    // Find and remove box under cursor
    const index = state.boxes.findIndex(box =>
      pos.x >= box.x && pos.x <= box.x + box.width &&
      pos.y >= box.y && pos.y <= box.y + box.height
    );

    if (index !== -1) {
      state.boxes.splice(index, 1);
      if (onBoxesChange) {
        onBoxesChange(state.boxes);
      }
      redraw();
    }
  });

  return {
    redraw,
    clear: () => {
      state.boxes = [];
      if (onBoxesChange) {
        onBoxesChange(state.boxes);
      }
      redraw();
    },
    getBoxes: () => [...state.boxes]
  };
}

/**
 * Render signature library
 * @param {Array} signatures - Array of signature objects
 * @param {HTMLElement} container - Container element
 * @param {Object} options - Options
 * @param {Function} options.onSelect - Callback when signature selected
 * @param {Function} options.onDelete - Callback when delete clicked
 */
export function renderSignatureLibrary(signatures, container, options = {}) {
  container.innerHTML = '';

  if (signatures.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-signatures';
    empty.textContent = 'No signatures saved. Click "Add Signature" to create one.';
    container.appendChild(empty);
    return;
  }

  for (const sig of signatures) {
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
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (options.onDelete) {
        options.onDelete(sig.id);
      }
    });
    item.appendChild(deleteBtn);

    item.addEventListener('click', () => {
      // Deselect others
      container.querySelectorAll('.signature-item').forEach(el => {
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
 * @param {HTMLCanvasElement} pageCanvas - Canvas with page rendered
 * @param {HTMLCanvasElement} overlayCanvas - Overlay canvas for signature preview
 * @param {Object} signature - Signature object
 * @param {Object} state - State object to track placement
 * @returns {Object} Controller object
 */
export function setupSignaturePlacement(pageCanvas, overlayCanvas, signature, state) {
  const ctx = overlayCanvas.getContext('2d');
  const img = new Image();

  // Initialize state
  state.x = 50;
  state.y = 50;
  state.width = signature.width;
  state.height = signature.height;
  state.rotation = 0;
  state.ready = false;

  let isDragging = false;
  let isResizing = false;
  let dragOffsetX, dragOffsetY;

  img.onload = () => {
    state.ready = true;
    redraw();
  };
  img.src = signature.imageData;

  function redraw() {
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (!state.ready) return;

    ctx.save();

    // Move to center of signature
    ctx.translate(state.x + state.width / 2, state.y + state.height / 2);
    ctx.rotate(state.rotation * Math.PI / 180);

    // Draw image centered
    ctx.drawImage(img, -state.width / 2, -state.height / 2, state.width, state.height);

    // Draw border
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(-state.width / 2, -state.height / 2, state.width, state.height);

    ctx.restore();

    // Draw resize handle (bottom-right corner)
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

  overlayCanvas.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);

    if (isInResizeHandle(pos)) {
      isResizing = true;
    } else if (isInSignature(pos)) {
      isDragging = true;
      dragOffsetX = pos.x - state.x;
      dragOffsetY = pos.y - state.y;
    }
  });

  overlayCanvas.addEventListener('mousemove', (e) => {
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
      // Update cursor
      if (isInResizeHandle(pos)) {
        overlayCanvas.style.cursor = 'se-resize';
      } else if (isInSignature(pos)) {
        overlayCanvas.style.cursor = 'move';
      } else {
        overlayCanvas.style.cursor = 'default';
      }
    }
  });

  overlayCanvas.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
  });

  overlayCanvas.addEventListener('mouseleave', () => {
    isDragging = false;
    isResizing = false;
  });

  return {
    redraw,
    rotateLeft: () => {
      state.rotation = (state.rotation - 90 + 360) % 360;
      redraw();
    },
    rotateRight: () => {
      state.rotation = (state.rotation + 90) % 360;
      redraw();
    },
    getPlacement: () => ({
      x: state.x,
      y: overlayCanvas.height - state.y - state.height, // Convert to PDF coordinates
      width: state.width,
      height: state.height,
      rotation: state.rotation
    })
  };
}

/**
 * Show loading overlay
 * @param {string} [message='Processing...'] - Loading message
 */
export function showLoading(message = 'Processing...') {
  const overlay = document.getElementById('loading-overlay');
  const text = document.getElementById('loading-text');
  if (text) text.textContent = message;
  if (overlay) overlay.classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.add('hidden');
}

/**
 * Show an alert/notification
 * @param {string} message - Message to show
 * @param {string} [type='info'] - Alert type: 'info', 'success', 'error', 'warning'
 */
export function showAlert(message, type = 'info') {
  // Simple alert for now - could be enhanced with custom UI
  alert(message);
}

/**
 * Show a confirmation dialog
 * @param {string} message - Confirmation message
 * @returns {boolean} User's choice
 */
export function showConfirm(message) {
  return confirm(message);
}

/**
 * Get selected page indices from the grid
 * @param {HTMLElement} container - Page grid container
 * @returns {number[]} Array of selected page indices
 */
export function getSelectedPageIndices(container) {
  const selected = [];
  container.querySelectorAll('.page-item.selected').forEach(item => {
    selected.push(parseInt(item.dataset.pageIndex));
  });
  return selected.sort((a, b) => a - b);
}

/**
 * Update page count display
 * @param {number} count - Number of pages
 */
export function updatePageCount(count) {
  const el = document.getElementById('page-count');
  if (el) {
    el.textContent = `${count} page${count !== 1 ? 's' : ''}`;
  }
}
