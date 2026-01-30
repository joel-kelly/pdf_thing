/**
 * Tools Panel Module
 * Right sidebar with accordion tool groups
 */

(function() {
  'use strict';

  var state = {
    panel: null,
    signatures: [],
    callbacks: {}
  };

  /**
   * Initialize the tools panel
   */
  function init(callbacks) {
    state.callbacks = callbacks || {};
    state.panel = document.getElementById('tools-panel');

    setupAccordions();
    setupToolButtons();
    loadSignatures();

    return {
      show: show,
      hide: hide,
      updateRedactButtons: updateRedactButtons,
      refreshSignatures: refreshSignatures
    };
  }

  /**
   * Setup accordion behavior for tool groups
   */
  function setupAccordions() {
    var headers = document.querySelectorAll('.tool-group-header');

    headers.forEach(function(header) {
      header.addEventListener('click', function() {
        var group = header.closest('.tool-group');

        // Skip download section
        if (group.classList.contains('download-section')) return;

        group.classList.toggle('collapsed');
      });
    });
  }

  /**
   * Setup tool button click handlers
   */
  function setupToolButtons() {
    // Page Tools
    bindButton('rotate-left-btn', function() {
      if (state.callbacks.onRotatePage) {
        state.callbacks.onRotatePage(-90);
      }
    });

    bindButton('rotate-right-btn', function() {
      if (state.callbacks.onRotatePage) {
        state.callbacks.onRotatePage(90);
      }
    });

    bindButton('delete-page-btn', function() {
      if (state.callbacks.onDeletePage) {
        state.callbacks.onDeletePage();
      }
    });

    bindButton('extract-page-btn', function() {
      if (state.callbacks.onExtractPage) {
        state.callbacks.onExtractPage();
      }
    });

    // Document Tools
    bindButton('merge-btn', function() {
      if (state.callbacks.onMerge) {
        state.callbacks.onMerge();
      }
    });

    bindButton('split-btn', function() {
      if (state.callbacks.onSplit) {
        state.callbacks.onSplit();
      }
    });

    bindButton('reorder-btn', function() {
      if (state.callbacks.onReorder) {
        state.callbacks.onReorder();
      }
    });

    // Redact Tools
    var redactModeBtn = document.getElementById('redact-mode-btn');
    if (redactModeBtn) {
      redactModeBtn.addEventListener('click', function() {
        var isActive = redactModeBtn.classList.contains('active');

        if (isActive) {
          redactModeBtn.classList.remove('active');
          if (state.callbacks.onRedactModeDisable) {
            state.callbacks.onRedactModeDisable();
          }
        } else {
          redactModeBtn.classList.add('active');
          if (state.callbacks.onRedactModeEnable) {
            state.callbacks.onRedactModeEnable();
          }
        }
      });
    }

    bindButton('apply-redaction-btn', function() {
      if (state.callbacks.onApplyRedaction) {
        state.callbacks.onApplyRedaction();
      }
    });

    bindButton('clear-redactions-btn', function() {
      if (state.callbacks.onClearRedactions) {
        state.callbacks.onClearRedactions();
      }
    });

    // Sign Tools
    bindButton('add-signature-btn', function() {
      if (state.callbacks.onAddSignature) {
        state.callbacks.onAddSignature();
      }
    });

    // Download
    bindButton('download-btn', function() {
      if (state.callbacks.onDownload) {
        state.callbacks.onDownload();
      }
    });
  }

  /**
   * Bind click handler to button by ID
   */
  function bindButton(id, handler) {
    var btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', handler);
    }
  }

  /**
   * Load and display signatures
   */
  function loadSignatures() {
    if (!window.SignatureManager) {
      console.warn('SignatureManager not available');
      return Promise.resolve();
    }

    return window.SignatureManager.loadSignatures()
      .then(function(signatures) {
        state.signatures = signatures;
        renderSignatureList(signatures);
      })
      .catch(function(err) {
        console.error('Failed to load signatures:', err);
      });
  }

  /**
   * Render signature quick list
   */
  function renderSignatureList(signatures) {
    var container = document.getElementById('signature-quick-list');
    if (!container) return;

    container.innerHTML = '';

    if (signatures.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'empty-signatures-msg';
      empty.textContent = 'No saved signatures';
      container.appendChild(empty);
      return;
    }

    signatures.forEach(function(sig) {
      var item = document.createElement('div');
      item.className = 'signature-quick-item';
      item.dataset.signatureId = sig.id;

      var img = document.createElement('img');
      img.src = sig.imageData;
      img.alt = sig.name;
      item.appendChild(img);

      var name = document.createElement('span');
      name.className = 'sig-name';
      name.textContent = sig.name;
      item.appendChild(name);

      var deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = 'Delete signature';
      deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        handleDeleteSignature(sig.id);
      });
      item.appendChild(deleteBtn);

      item.addEventListener('click', function() {
        if (state.callbacks.onSelectSignature) {
          state.callbacks.onSelectSignature(sig);
        }
      });

      container.appendChild(item);
    });
  }

  /**
   * Handle signature deletion
   */
  function handleDeleteSignature(signatureId) {
    if (!confirm('Delete this signature?')) return;

    window.SignatureManager.deleteSignature(signatureId)
      .then(function() {
        return loadSignatures();
      })
      .catch(function(err) {
        alert('Failed to delete signature: ' + err.message);
      });
  }

  /**
   * Show the tools panel
   */
  function show() {
    state.panel.classList.remove('hidden');
  }

  /**
   * Hide the tools panel
   */
  function hide() {
    state.panel.classList.add('hidden');
  }

  /**
   * Update redact buttons based on redaction state
   */
  function updateRedactButtons(hasRedactions) {
    var applyBtn = document.getElementById('apply-redaction-btn');
    var clearBtn = document.getElementById('clear-redactions-btn');

    if (applyBtn) {
      applyBtn.disabled = !hasRedactions;
    }
    if (clearBtn) {
      clearBtn.disabled = !hasRedactions;
    }
  }

  /**
   * Refresh signatures list
   */
  function refreshSignatures() {
    return loadSignatures();
  }

  /**
   * Set redact mode button state
   */
  function setRedactModeActive(active) {
    var btn = document.getElementById('redact-mode-btn');
    if (btn) {
      if (active) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  // Expose to global scope
  window.ToolsPanel = {
    init: init,
    setRedactModeActive: setRedactModeActive
  };

})();
