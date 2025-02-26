document.addEventListener('DOMContentLoaded', function() {
    // Initialize popup content
    const content = document.getElementById('content');
    content.textContent = 'Dashboard Loaded';
  
    // Refresh button logic
    document.getElementById('refreshBtn').addEventListener('click', function() {
      content.textContent = 'Content Refreshed';
      chrome.runtime.sendMessage({action: 'refresh'}, function(response) {
        console.log('Background response:', response);
      });
    });
  
    // Setup feedback modal interactions
    const feedbackModal = document.getElementById('feedbackModal');
    const submitFeedback = document.getElementById('submitFeedback');
    
    // Show modal on refresh button click
    document.getElementById('refreshBtn').addEventListener('click', function() {
      feedbackModal.style.display = 'block';
    });
  
    // Handle feedback submission
    submitFeedback.addEventListener('click', function() {
      const feedback = document.getElementById('feedbackText').value;
      console.log('Feedback submitted:', feedback);
      feedbackModal.style.display = 'none';
    });
  });