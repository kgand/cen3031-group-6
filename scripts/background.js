const initializeBackground = async () => {
    try {
      console.log('Background script initialized asynchronously with ES6.');
  
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'refresh') {
          console.log('Processing refresh action.');
          sendResponse({status: 'refreshed'});
        }
      });
    } catch (error) {
      console.error('Background initialization error:', error);
    }
  };
  
  initializeBackground();