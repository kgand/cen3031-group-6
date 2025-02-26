const initializeBackground = async () => {
    try {
      // Initialize background processes and listen for messages
      console.log('Background script initialized with ES6.');
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'refresh') {
          console.log('Refresh action received from popup.');
          sendResponse({status: 'refreshed'});
        }
      });
    } catch (error) {
      console.error('Background initialization error:', error);
    }
  };
  
  initializeBackground();