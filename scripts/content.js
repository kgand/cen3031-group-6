console.log('Content script loaded.');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Process message with minimal overhead
  sendResponse({status: 'received'});
  return true;
});