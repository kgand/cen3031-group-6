import Logger from '../scripts/logger.js';

function sanitizeInput(input) {
  return input.replace(/[<>]/g, '');
}

document.addEventListener('DOMContentLoaded', function() {
  try {
    const content = document.getElementById('content');
    content.textContent = 'Dashboard Loaded';

    document.getElementById('refreshBtn').addEventListener('click', function() {
      content.textContent = 'Content Refreshed';
      chrome.runtime.sendMessage({action: 'refresh'}, function(response) {
        Logger.log('Background response:', response);
      });
    });

    const feedbackModal = document.getElementById('feedbackModal');
    const submitFeedback = document.getElementById('submitFeedback');
    document.getElementById('refreshBtn').addEventListener('click', function() {
      feedbackModal.style.display = 'block';
    });
    submitFeedback.addEventListener('click', function() {
      let feedback = document.getElementById('feedbackText').value;
      feedback = sanitizeInput(feedback);
      Logger.log('Feedback submitted:', feedback);
      feedbackModal.style.display = 'none';
    });
  } catch (error) {
    Logger.error('Error initializing popup UI:', error);
    document.getElementById('content').textContent = 'Error loading dashboard.';
  }
});