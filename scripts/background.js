const initializeBackground = async () => {
    try {
      console.log('Background script initialized asynchronously with ES6.');
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'refresh') {
          console.log('Refresh action received from popup.');
          sendResponse({status: 'refreshed'});
        }
      });
    } catch (error) {
      console.error('Error during background initialization:', error);
    }
  };
  
  initializeBackground();