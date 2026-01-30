/**
 * UI Handler Module
 * Utility functions for UI operations
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
   * Update page count display (legacy support)
   */
  function updatePageCount(count) {
    var el = document.getElementById('total-pages');
    if (el) {
      el.textContent = count;
    }
  }

  // Expose to global scope
  window.UIHandler = {
    showLoading: showLoading,
    hideLoading: hideLoading,
    updatePageCount: updatePageCount
  };
})();
