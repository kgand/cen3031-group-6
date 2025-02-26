const initializeBackground = async () => {
    try {
      console.log('Background script initialized asynchronously with ES6.');
    } catch (error) {
      console.error('Error during background initialization:', error);
    }
  };
  
  initializeBackground();