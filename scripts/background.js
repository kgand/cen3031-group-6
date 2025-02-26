const initializeBackground = async () => {
    try {
      // Asynchronous initialization of background tasks
      console.log('Background script initialized with ES6.');
  
      // Listening for messages from other parts of the extension
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