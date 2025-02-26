import Logger from './logger.js';

const defaultSettings = {
  theme: 'light',
  notifications: true
};

const handleRefresh = (sendResponse) => {
  Logger.log('Processing refresh action.');
  sendResponse({status: 'refreshed'});
};

const initializeBackground = async () => {
  try {
    Logger.log('Background script initialized with settings:', defaultSettings);
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'refresh') {
        handleRefresh(sendResponse);
      }
    });
  } catch (error) {
    Logger.error('Background initialization error:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon48.png',
      title: 'Extension Error',
      message: 'An error occurred during initialization.'
    });
  }
};

initializeBackground();