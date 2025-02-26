console.log('Content script loaded.');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  // Acknowledge receipt properly
  sendResponse({status: 'received'});
  return true;
});