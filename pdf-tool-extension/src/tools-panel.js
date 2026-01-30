/**
 * Tools Panel Module
 * Accordion-style tool groups for the right sidebar
 */

(function() {
  'use strict';

  var ToolsPanel = {
    // State
    expandedGroups: ['page-tools', 'document-tools', 'redact', 'sign'],
    signatures: [],

    // Callbacks
    callbacks: {},

    /**
     * Initialize the tools panel
     */
    init: function(callbacks) {
      this.callbacks = callbacks || {};
      this.setupAccordion();
      this.setupEventListeners();
      this.loadSignatures();
    },

    /**
     * Setup accordion behavior for tool groups
     */
    setupAccordion: function() {
      var self = this;
      var headers = document.querySelectorAll('.tool-group-header');

      headers.forEach(function(header) {
        header.addEventListener('click', function() {
          var group = header.parentElement;
          var groupName = group.dataset.group;

          if (!groupName) return; // Skip download group

          group.classList.toggle('collapsed');

          // Update expanded state
          var index = self.expandedGroups.indexOf(groupName);
          if (group.classList.contains('collapsed')) {
            if (index > -1) self.expandedGroups.splice(index, 1);
          } else {
            if (index === -1) self.expandedGroups.push(groupName);
          }
        });
      });
    },

    /**
     * Setup event listeners for tool buttons
     */
    setupEventListeners: function() {
      var self = this;

      // Page Tools
      this.bindButton('rotate-left-btn', 'rotateLeft');
      this.bindButton('rotate-right-btn', 'rotateRight');
      this.bindButton('delete-page-btn', 'deletePage');
      this.bindButton('extract-page-btn', 'extractPage');

      // Document Tools
      this.bindButton('merge-btn', 'merge');
      this.bindButton('split-btn', 'split');
      this.bindButton('reorder-btn', 'reorder');

      // Redact
      var toggleRedactBtn = document.getElementById('toggle-redact-btn');
      if (toggleRedactBtn) {
        toggleRedactBtn.addEventListener('click', function() {
          var isActive = toggleRedactBtn.classList.toggle('active');
          if (self.callbacks.toggleRedaction) {
            self.callbacks.toggleRedaction(isActive);
          }
        });
      }

      this.bindButton('apply-redaction-btn', 'applyRedaction');
      this.bindButton('clear-redaction-btn', 'clearRedaction');

      // Sign
      this.bindButton('add-signature-btn', 'addSignature');
      this.bindButton('rotate-sig-left', 'rotateSignatureLeft');
      this.bindButton('rotate-sig-right', 'rotateSignatureRight');
      this.bindButton('confirm-signature-btn', 'confirmSignature');
      this.bindButton('cancel-signature-btn', 'cancelSignature');

      // Download
      this.bindButton('download-btn', 'download');
    },

    /**
     * Bind a button to a callback
     */
    bindButton: function(id, callbackName) {
      var self = this;
      var btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', function() {
          if (self.callbacks[callbackName]) {
            self.callbacks[callbackName]();
          }
        });
      }
    },

    /**
     * Load signatures from storage
     */
    loadSignatures: function() {
      var self = this;

      if (window.SignatureManager) {
        window.SignatureManager.loadSignatures().then(function(signatures) {
          self.signatures = signatures;
          self.renderSignatureQuickList();
        });
      }
    },

    /**
     * Refresh signature list
     */
    refreshSignatures: function() {
      this.loadSignatures();
    },

    /**
     * Render the signature quick-select list
     */
    renderSignatureQuickList: function() {
      var self = this;
      var container = document.getElementById('signature-quick-list');
      if (!container) return;

      container.innerHTML = '';

      if (this.signatures.length === 0) {
        container.innerHTML = '<p style="font-size: 12px; color: #888; margin-top: 8px;">No signatures saved</p>';
        return;
      }

      this.signatures.forEach(function(sig) {
        var item = document.createElement('div');
        item.className = 'signature-quick-item';
        item.dataset.id = sig.id;

        var img = document.createElement('img');
        img.src = sig.imageData;
        img.alt = sig.name;

        var name = document.createElement('span');
        name.textContent = sig.name;

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Delete';

        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (confirm('Delete this signature?')) {
            if (self.callbacks.deleteSignature) {
              self.callbacks.deleteSignature(sig.id);
            }
          }
        });

        item.appendChild(img);
        item.appendChild(name);
        item.appendChild(deleteBtn);

        item.addEventListener('click', function() {
          // Deselect others
          container.querySelectorAll('.signature-quick-item').forEach(function(el) {
            el.classList.remove('selected');
          });

          item.classList.add('selected');

          if (self.callbacks.selectSignature) {
            self.callbacks.selectSignature(sig);
          }
        });

        container.appendChild(item);
      });
    },

    /**
     * Update redaction button states
     */
    updateRedactionButtons: function(hasBoxes) {
      var applyBtn = document.getElementById('apply-redaction-btn');
      var clearBtn = document.getElementById('clear-redaction-btn');

      if (applyBtn) applyBtn.disabled = !hasBoxes;
      if (clearBtn) clearBtn.disabled = !hasBoxes;
    },

    /**
     * Set redaction mode active/inactive
     */
    setRedactionMode: function(active) {
      var toggleBtn = document.getElementById('toggle-redact-btn');
      if (toggleBtn) {
        toggleBtn.classList.toggle('active', active);
      }
    },

    /**
     * Show signature placement controls
     */
    showSignaturePlacementControls: function() {
      var controls = document.getElementById('signature-placement-controls');
      if (controls) {
        controls.classList.remove('hidden');
      }
    },

    /**
     * Hide signature placement controls
     */
    hideSignaturePlacementControls: function() {
      var controls = document.getElementById('signature-placement-controls');
      if (controls) {
        controls.classList.add('hidden');
      }

      // Deselect signature items
      var container = document.getElementById('signature-quick-list');
      if (container) {
        container.querySelectorAll('.signature-quick-item').forEach(function(el) {
          el.classList.remove('selected');
        });
      }
    },

    /**
     * Get timestamp checkbox state
     */
    getAddTimestamp: function() {
      var checkbox = document.getElementById('add-timestamp-check');
      return checkbox ? checkbox.checked : false;
    },

    /**
     * Enable/disable all tools
     */
    setEnabled: function(enabled) {
      var buttons = document.querySelectorAll('#tools-panel .tool-btn');
      buttons.forEach(function(btn) {
        // Don't disable these special buttons
        if (btn.id === 'apply-redaction-btn' || btn.id === 'clear-redaction-btn') {
          return;
        }
        btn.disabled = !enabled;
      });
    },

    /**
     * Show modal for split options
     */
    showSplitModal: function(pageCount, onConfirm) {
      this.showModal({
        title: 'Split Document',
        body: '\
          <div class="form-group">\
            <label>Split Method</label>\
            <div style="margin-top: 8px;">\
              <label style="display: block; margin-bottom: 8px; cursor: pointer;">\
                <input type="radio" name="split-method" value="all" checked>\
                All pages (creates ' + pageCount + ' files)\
              </label>\
              <label style="display: block; margin-bottom: 8px; cursor: pointer;">\
                <input type="radio" name="split-method" value="every">\
                Every N pages\
              </label>\
              <div id="every-n-container" style="margin-left: 24px; margin-bottom: 8px; display: none;">\
                <input type="number" id="split-every-n" value="2" min="1" max="' + pageCount + '" style="width: 60px; padding: 4px 8px;">\
                pages\
              </div>\
              <label style="display: block; cursor: pointer;">\
                <input type="radio" name="split-method" value="at">\
                At specific pages\
              </label>\
              <div id="at-pages-container" style="margin-left: 24px; margin-top: 8px; display: none;">\
                <input type="text" id="split-at-pages" placeholder="e.g., 3, 5, 8" style="width: 100%; padding: 8px;">\
                <span style="font-size: 11px; color: #888;">Enter page numbers separated by commas</span>\
              </div>\
            </div>\
          </div>',
        buttons: [
          { text: 'Cancel', action: 'cancel' },
          { text: 'Split', action: 'confirm', primary: true }
        ],
        onAction: function(action) {
          if (action === 'confirm') {
            var method = document.querySelector('input[name="split-method"]:checked').value;
            var options = { method: method };

            if (method === 'every') {
              options.n = parseInt(document.getElementById('split-every-n').value, 10);
            } else if (method === 'at') {
              var pagesStr = document.getElementById('split-at-pages').value;
              options.pages = pagesStr.split(',').map(function(s) {
                return parseInt(s.trim(), 10);
              }).filter(function(n) {
                return !isNaN(n) && n > 0 && n <= pageCount;
              });
            }

            onConfirm(options);
          }
        }
      });

      // Setup radio button handlers
      setTimeout(function() {
        var radios = document.querySelectorAll('input[name="split-method"]');
        radios.forEach(function(radio) {
          radio.addEventListener('change', function() {
            document.getElementById('every-n-container').style.display =
              radio.value === 'every' ? 'block' : 'none';
            document.getElementById('at-pages-container').style.display =
              radio.value === 'at' ? 'block' : 'none';
          });
        });
      }, 0);
    },

    /**
     * Show modal for merge position selection
     */
    showMergeModal: function(currentPageCount, onConfirm) {
      this.showModal({
        title: 'Merge PDFs',
        body: '\
          <div class="form-group">\
            <label>Insert Position</label>\
            <div style="margin-top: 8px;">\
              <label style="display: block; margin-bottom: 8px; cursor: pointer;">\
                <input type="radio" name="merge-position" value="end" checked>\
                At the end (after page ' + currentPageCount + ')\
              </label>\
              <label style="display: block; margin-bottom: 8px; cursor: pointer;">\
                <input type="radio" name="merge-position" value="start">\
                At the beginning (before page 1)\
              </label>\
              <label style="display: block; cursor: pointer;">\
                <input type="radio" name="merge-position" value="after">\
                After specific page\
              </label>\
              <div id="after-page-container" style="margin-left: 24px; margin-top: 8px; display: none;">\
                <input type="number" id="merge-after-page" value="1" min="1" max="' + currentPageCount + '" style="width: 80px; padding: 4px 8px;">\
                <span style="font-size: 12px; color: #666;"> (1-' + currentPageCount + ')</span>\
              </div>\
            </div>\
          </div>',
        buttons: [
          { text: 'Cancel', action: 'cancel' },
          { text: 'Select Files', action: 'confirm', primary: true }
        ],
        onAction: function(action) {
          if (action === 'confirm') {
            var position = document.querySelector('input[name="merge-position"]:checked').value;
            var insertAfter;

            if (position === 'end') {
              insertAfter = currentPageCount;
            } else if (position === 'start') {
              insertAfter = 0;
            } else {
              insertAfter = parseInt(document.getElementById('merge-after-page').value, 10);
              if (isNaN(insertAfter) || insertAfter < 1) insertAfter = 1;
              if (insertAfter > currentPageCount) insertAfter = currentPageCount;
            }

            onConfirm(insertAfter);
          }
        }
      });

      // Setup radio button handlers
      setTimeout(function() {
        var radios = document.querySelectorAll('input[name="merge-position"]');
        radios.forEach(function(radio) {
          radio.addEventListener('change', function() {
            document.getElementById('after-page-container').style.display =
              radio.value === 'after' ? 'block' : 'none';
          });
        });
      }, 0);
    },

    /**
     * Show modal for adding signature
     */
    showAddSignatureModal: function(onSave) {
      var self = this;

      this.showModal({
        title: 'Add Signature',
        body: '\
          <div class="form-group">\
            <label for="sig-name">Name</label>\
            <input type="text" id="sig-name" placeholder="e.g., Full Signature, Initials">\
          </div>\
          <div class="form-group">\
            <label>Image</label>\
            <div id="sig-dropzone" class="modal-dropzone">\
              <p>Drop image or click to upload</p>\
              <span class="hint">PNG or JPEG, max 500KB</span>\
            </div>\
          </div>\
          <div id="sig-preview-container" style="display: none; margin-top: 16px; text-align: center;">\
            <img id="sig-preview" style="max-width: 100%; max-height: 100px; object-fit: contain;">\
          </div>',
        buttons: [
          { text: 'Cancel', action: 'cancel' },
          { text: 'Save', action: 'save', primary: true }
        ],
        onAction: function(action) {
          if (action === 'save') {
            var name = document.getElementById('sig-name').value.trim() || 'Signature';
            var fileInput = document.getElementById('signature-file');
            var file = fileInput.files[0];

            if (!file) {
              alert('Please select an image file');
              return false; // Don't close modal
            }

            onSave(name, file);
          }
        }
      });

      // Setup dropzone
      setTimeout(function() {
        var dropzone = document.getElementById('sig-dropzone');
        var fileInput = document.getElementById('signature-file');
        var previewContainer = document.getElementById('sig-preview-container');
        var preview = document.getElementById('sig-preview');

        dropzone.addEventListener('click', function() {
          fileInput.click();
        });

        dropzone.addEventListener('dragover', function(e) {
          e.preventDefault();
          dropzone.style.borderColor = '#1473e6';
        });

        dropzone.addEventListener('dragleave', function() {
          dropzone.style.borderColor = '#ccc';
        });

        dropzone.addEventListener('drop', function(e) {
          e.preventDefault();
          dropzone.style.borderColor = '#ccc';

          var file = e.dataTransfer.files[0];
          if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
            // Create a new FileList-like object
            var dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;

            self.showImagePreview(file, preview, previewContainer);
          }
        });

        fileInput.addEventListener('change', function() {
          if (fileInput.files[0]) {
            self.showImagePreview(fileInput.files[0], preview, previewContainer);
          }
        });
      }, 0);
    },

    /**
     * Show image preview
     */
    showImagePreview: function(file, previewImg, container) {
      var reader = new FileReader();
      reader.onload = function(e) {
        previewImg.src = e.target.result;
        container.style.display = 'block';
      };
      reader.readAsDataURL(file);
    },

    /**
     * Show reorder pages modal
     */
    showReorderModal: function(pdfJsDoc, onConfirm) {
      var self = this;
      var pageCount = pdfJsDoc.numPages;

      this.showModal({
        title: 'Reorder Pages',
        body: '<div id="reorder-grid" class="reorder-grid"></div>',
        buttons: [
          { text: 'Cancel', action: 'cancel' },
          { text: 'Apply', action: 'confirm', primary: true }
        ],
        onAction: function(action) {
          if (action === 'confirm') {
            var grid = document.getElementById('reorder-grid');
            var items = grid.querySelectorAll('.reorder-item');
            var newOrder = [];

            items.forEach(function(item) {
              newOrder.push(parseInt(item.dataset.originalIndex, 10));
            });

            onConfirm(newOrder);
          }
        }
      });

      // Render page thumbnails
      setTimeout(function() {
        self.renderReorderThumbnails(pdfJsDoc);
      }, 0);
    },

    /**
     * Render thumbnails for reorder modal
     */
    renderReorderThumbnails: function(pdfJsDoc) {
      var grid = document.getElementById('reorder-grid');
      if (!grid) return;

      var pageCount = pdfJsDoc.numPages;

      for (var i = 0; i < pageCount; i++) {
        (function(pageIndex) {
          var item = document.createElement('div');
          item.className = 'reorder-item';
          item.dataset.originalIndex = pageIndex;
          item.draggable = true;

          var canvas = document.createElement('canvas');
          var pageNum = document.createElement('div');
          pageNum.className = 'page-num';
          pageNum.textContent = (pageIndex + 1);

          item.appendChild(canvas);
          item.appendChild(pageNum);
          grid.appendChild(item);

          // Render thumbnail
          pdfJsDoc.getPage(pageIndex + 1).then(function(page) {
            var viewport = page.getViewport({ scale: 0.2 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            page.render({
              canvasContext: canvas.getContext('2d'),
              viewport: viewport
            });
          });

          // Drag and drop
          item.addEventListener('dragstart', function(e) {
            item.classList.add('dragging');
            e.dataTransfer.setData('text/plain', pageIndex);
          });

          item.addEventListener('dragend', function() {
            item.classList.remove('dragging');
          });

          item.addEventListener('dragover', function(e) {
            e.preventDefault();
            var dragging = grid.querySelector('.dragging');
            if (dragging && dragging !== item) {
              var rect = item.getBoundingClientRect();
              var midX = rect.left + rect.width / 2;

              if (e.clientX < midX) {
                grid.insertBefore(dragging, item);
              } else {
                grid.insertBefore(dragging, item.nextSibling);
              }
            }
          });
        })(i);
      }
    },

    /**
     * Show a modal
     */
    showModal: function(options) {
      var overlay = document.getElementById('modal-overlay');
      var container = document.getElementById('modal-container');
      var title = document.getElementById('modal-title');
      var body = document.getElementById('modal-body');
      var footer = document.getElementById('modal-footer');
      var closeBtn = document.getElementById('modal-close');

      title.textContent = options.title || 'Modal';
      body.innerHTML = options.body || '';
      footer.innerHTML = '';

      // Add buttons
      if (options.buttons) {
        options.buttons.forEach(function(btn) {
          var button = document.createElement('button');
          button.className = 'tool-btn' + (btn.primary ? ' primary' : '');
          button.textContent = btn.text;
          button.addEventListener('click', function() {
            var result = options.onAction ? options.onAction(btn.action) : undefined;
            if (result !== false) {
              overlay.classList.add('hidden');
            }
          });
          footer.appendChild(button);
        });
      }

      // Close button
      closeBtn.onclick = function() {
        overlay.classList.add('hidden');
      };

      // Click outside to close
      overlay.onclick = function(e) {
        if (e.target === overlay) {
          overlay.classList.add('hidden');
        }
      };

      overlay.classList.remove('hidden');
    },

    /**
     * Hide modal
     */
    hideModal: function() {
      var overlay = document.getElementById('modal-overlay');
      overlay.classList.add('hidden');
    }
  };

  // Export to window
  window.ToolsPanel = ToolsPanel;

})();
