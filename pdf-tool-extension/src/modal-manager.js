/**
 * Modal Manager Module
 * Reusable modal system with pre-built templates
 */

(function() {
  'use strict';

  var state = {
    overlay: null,
    container: null,
    title: null,
    body: null,
    footer: null,
    closeBtn: null,
    currentModal: null,
    onClose: null
  };

  /**
   * Initialize the modal manager
   */
  function init() {
    state.overlay = document.getElementById('modal-overlay');
    state.container = document.getElementById('modal-container');
    state.title = document.getElementById('modal-title');
    state.body = document.getElementById('modal-body');
    state.footer = document.getElementById('modal-footer');
    state.closeBtn = document.getElementById('modal-close-btn');

    // Close button handler
    state.closeBtn.addEventListener('click', close);

    // Click outside to close
    state.overlay.addEventListener('click', function(e) {
      if (e.target === state.overlay) {
        close();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !state.overlay.classList.contains('hidden')) {
        close();
      }
    });

    return {
      showSplitModal: showSplitModal,
      showMergeModal: showMergeModal,
      showReorderModal: showReorderModal,
      showAddSignatureModal: showAddSignatureModal,
      close: close
    };
  }

  /**
   * Show the modal
   */
  function show(title, bodyContent, footerContent, onClose) {
    state.title.textContent = title;
    state.body.innerHTML = '';
    state.footer.innerHTML = '';

    if (typeof bodyContent === 'string') {
      state.body.innerHTML = bodyContent;
    } else {
      state.body.appendChild(bodyContent);
    }

    if (footerContent) {
      if (typeof footerContent === 'string') {
        state.footer.innerHTML = footerContent;
      } else {
        state.footer.appendChild(footerContent);
      }
    }

    state.onClose = onClose;
    state.overlay.classList.remove('hidden');
  }

  /**
   * Close the modal
   */
  function close() {
    state.overlay.classList.add('hidden');
    state.body.innerHTML = '';
    state.footer.innerHTML = '';

    if (state.onClose) {
      state.onClose();
      state.onClose = null;
    }

    state.currentModal = null;
  }

  /**
   * Show Split PDF modal
   */
  function showSplitModal(pageCount, onConfirm) {
    var body = document.createElement('div');

    body.innerHTML = '\
      <div class="radio-group">\
        <label class="radio-option">\
          <input type="radio" name="split-option" value="all" checked>\
          <div class="radio-label">\
            <span>Extract all pages</span>\
            <small>Creates ' + pageCount + ' individual PDF files</small>\
          </div>\
        </label>\
        <label class="radio-option">\
          <input type="radio" name="split-option" value="every">\
          <div class="radio-label">\
            <span>Split every <input type="number" id="split-every-n" value="2" min="1" max="' + pageCount + '" style="width:50px"> pages</span>\
            <small>Creates multiple PDFs with specified page count each</small>\
          </div>\
        </label>\
        <label class="radio-option">\
          <input type="radio" name="split-option" value="at">\
          <div class="radio-label">\
            <span>Split at pages:</span>\
            <input type="text" id="split-at-pages" placeholder="e.g., 3, 5, 8" style="margin-top:4px;width:100%">\
            <small>Enter page numbers where splits should occur</small>\
          </div>\
        </label>\
      </div>\
    ';

    var footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';

    var cancelBtn = createButton('Cancel', false, close);
    var confirmBtn = createButton('Split', true, function() {
      var option = body.querySelector('input[name="split-option"]:checked').value;
      var result = { option: option };

      if (option === 'every') {
        result.everyN = parseInt(body.querySelector('#split-every-n').value) || 2;
      } else if (option === 'at') {
        var pagesStr = body.querySelector('#split-at-pages').value;
        result.atPages = pagesStr.split(',')
          .map(function(s) { return parseInt(s.trim()); })
          .filter(function(n) { return !isNaN(n) && n > 0 && n <= pageCount; })
          .sort(function(a, b) { return a - b; });
      }

      close();
      if (onConfirm) onConfirm(result);
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    show('Split Document', body, footer);
    state.currentModal = 'split';
  }

  /**
   * Show Merge PDFs modal
   */
  function showMergeModal(onConfirm) {
    var selectedFiles = [];

    var body = document.createElement('div');

    var dropzone = document.createElement('div');
    dropzone.className = 'modal-dropzone';
    dropzone.innerHTML = '<p>Drop PDFs here or click to select</p><span class="hint">Select multiple PDF files to merge</span>';

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf';
    fileInput.multiple = true;
    fileInput.style.display = 'none';

    var fileList = document.createElement('div');
    fileList.className = 'modal-file-list';

    dropzone.addEventListener('click', function() {
      fileInput.click();
    });

    dropzone.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', function() {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      addFiles(Array.from(e.dataTransfer.files));
    });

    fileInput.addEventListener('change', function() {
      addFiles(Array.from(fileInput.files));
      fileInput.value = '';
    });

    function addFiles(files) {
      files.forEach(function(file) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          selectedFiles.push(file);
        }
      });
      renderFileList();
    }

    function renderFileList() {
      fileList.innerHTML = '';
      selectedFiles.forEach(function(file, index) {
        var item = document.createElement('div');
        item.className = 'modal-file-item';

        var name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = file.name;

        var removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', function() {
          selectedFiles.splice(index, 1);
          renderFileList();
        });

        item.appendChild(name);
        item.appendChild(removeBtn);
        fileList.appendChild(item);
      });
    }

    body.appendChild(dropzone);
    body.appendChild(fileInput);
    body.appendChild(fileList);

    var footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';

    var cancelBtn = createButton('Cancel', false, close);
    var confirmBtn = createButton('Merge', true, function() {
      if (selectedFiles.length === 0) {
        alert('Please select at least one PDF file to merge');
        return;
      }
      close();
      if (onConfirm) onConfirm(selectedFiles);
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    show('Merge PDFs', body, footer);
    state.currentModal = 'merge';
  }

  /**
   * Show Reorder Pages modal
   */
  function showReorderModal(pdfJsDoc, onConfirm) {
    var pageOrder = [];
    var pageCount = pdfJsDoc.numPages;

    for (var i = 0; i < pageCount; i++) {
      pageOrder.push(i);
    }

    var body = document.createElement('div');
    body.innerHTML = '<p style="margin-bottom:12px;color:#666;font-size:13px">Drag pages to reorder them</p>';

    var grid = document.createElement('div');
    grid.className = 'page-thumbnail-grid';
    body.appendChild(grid);

    // Render thumbnails
    var scale = 0.2;

    for (var pageNum = 1; pageNum <= pageCount; pageNum++) {
      (function(pn) {
        var thumb = document.createElement('div');
        thumb.className = 'page-thumbnail';
        thumb.dataset.pageIndex = pn - 1;
        thumb.draggable = true;

        var canvas = document.createElement('canvas');
        thumb.appendChild(canvas);

        var numLabel = document.createElement('span');
        numLabel.className = 'page-num';
        numLabel.textContent = pn;
        thumb.appendChild(numLabel);

        grid.appendChild(thumb);

        // Render page
        pdfJsDoc.getPage(pn).then(function(page) {
          var viewport = page.getViewport({ scale: scale });
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          var ctx = canvas.getContext('2d');
          page.render({
            canvasContext: ctx,
            viewport: viewport
          });
        });

        // Setup drag and drop
        thumb.addEventListener('dragstart', function(e) {
          thumb.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', thumb.dataset.pageIndex);
        });

        thumb.addEventListener('dragend', function() {
          thumb.classList.remove('dragging');
          grid.querySelectorAll('.page-thumbnail').forEach(function(t) {
            t.classList.remove('drag-over');
          });
        });

        thumb.addEventListener('dragover', function(e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          thumb.classList.add('drag-over');
        });

        thumb.addEventListener('dragleave', function() {
          thumb.classList.remove('drag-over');
        });

        thumb.addEventListener('drop', function(e) {
          e.preventDefault();
          thumb.classList.remove('drag-over');

          var fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
          var toIndex = parseInt(thumb.dataset.pageIndex);

          if (fromIndex !== toIndex) {
            // Move thumbnail in DOM
            var fromEl = grid.querySelector('[data-page-index="' + fromIndex + '"]');
            var toEl = thumb;

            if (fromIndex < toIndex) {
              toEl.parentNode.insertBefore(fromEl, toEl.nextSibling);
            } else {
              toEl.parentNode.insertBefore(fromEl, toEl);
            }

            // Update page order
            var removed = pageOrder.splice(fromIndex, 1)[0];
            pageOrder.splice(toIndex, 0, removed);

            // Update data attributes
            var thumbs = grid.querySelectorAll('.page-thumbnail');
            thumbs.forEach(function(t, i) {
              t.dataset.pageIndex = i;
            });
          }
        });
      })(pageNum);
    }

    var footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';

    var cancelBtn = createButton('Cancel', false, close);
    var confirmBtn = createButton('Apply', true, function() {
      // Build final page order from DOM order
      var finalOrder = [];
      grid.querySelectorAll('.page-thumbnail').forEach(function(thumb) {
        var originalIndex = pageOrder[parseInt(thumb.dataset.pageIndex)];
        finalOrder.push(originalIndex);
      });

      close();
      if (onConfirm) onConfirm(finalOrder);
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    show('Reorder Pages', body, footer);
    state.currentModal = 'reorder';
  }

  /**
   * Show Add Signature modal
   */
  function showAddSignatureModal(onConfirm) {
    var selectedFile = null;
    var imagePreview = null;

    var body = document.createElement('div');

    body.innerHTML = '\
      <div class="form-group">\
        <label for="sig-name-input">Signature Name</label>\
        <input type="text" id="sig-name-input" placeholder="e.g., Full Signature, Initials">\
      </div>\
      <div class="form-group">\
        <label>Signature Image</label>\
        <div class="modal-dropzone" id="sig-dropzone">\
          <p>Drop image or click to upload</p>\
          <span class="hint">PNG or JPEG, max 500KB</span>\
        </div>\
        <input type="file" id="sig-file-input" accept="image/png,image/jpeg" style="display:none">\
        <div class="modal-preview" id="sig-preview" style="display:none"></div>\
      </div>\
    ';

    setTimeout(function() {
      var dropzone = body.querySelector('#sig-dropzone');
      var fileInput = body.querySelector('#sig-file-input');
      var preview = body.querySelector('#sig-preview');

      dropzone.addEventListener('click', function() {
        fileInput.click();
      });

      dropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', function() {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          handleFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
          handleFile(fileInput.files[0]);
        }
      });

      function handleFile(file) {
        // Validate file
        if (!file.type.match(/^image\/(png|jpeg)$/)) {
          alert('Please select a PNG or JPEG image');
          return;
        }

        if (file.size > 500 * 1024) {
          alert('Image must be smaller than 500KB');
          return;
        }

        selectedFile = file;

        // Show preview
        var reader = new FileReader();
        reader.onload = function(e) {
          imagePreview = e.target.result;
          preview.innerHTML = '<img src="' + imagePreview + '" alt="Signature preview">';
          preview.style.display = 'block';
          dropzone.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
    }, 0);

    var footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';

    var cancelBtn = createButton('Cancel', false, close);
    var confirmBtn = createButton('Save', true, function() {
      var nameInput = body.querySelector('#sig-name-input');
      var name = nameInput.value.trim() || 'Signature';

      if (!selectedFile) {
        alert('Please select an image file');
        return;
      }

      close();
      if (onConfirm) onConfirm(name, selectedFile);
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    show('Add Signature', body, footer);
    state.currentModal = 'signature';
  }

  /**
   * Create a button element
   */
  function createButton(text, primary, onClick) {
    var btn = document.createElement('button');
    btn.className = 'modal-btn' + (primary ? ' primary' : '');
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // Expose to global scope
  window.ModalManager = {
    init: init
  };

})();
