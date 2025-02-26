import Logger from './logger.js';

const defaultSettings = {
  theme: 'light',
  notifications: true
};

const initializeBackground = async () => {
  try {
    Logger.log('Background script initialized with settings:', defaultSettings);
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'refresh') {
        Logger.log('Processing refresh action.');
        sendResponse({status: 'refreshed'});
      }
    });
  } catch (error) {
    Logger.error('Background initialization error:', error);
  }
};

initializeBackground();