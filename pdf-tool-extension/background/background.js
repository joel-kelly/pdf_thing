/**
 * Background script for PDF Tool extension
 * Opens the PDF tool in a new tab when the browser action is clicked
 */

browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
    url: browser.runtime.getURL('popup/popup.html')
  });
});
