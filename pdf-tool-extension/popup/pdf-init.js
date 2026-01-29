// Configure PDF.js worker
// pdfjsLib is loaded globally from pdf.js
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = browser.runtime.getURL('libs/pdf.worker.js');
  window.pdfjsLib = pdfjsLib;

  // Signal that libraries are ready
  window.dispatchEvent(new Event('libs-ready'));
} else {
  console.error('PDF.js library not loaded');
}
