document.addEventListener('DOMContentLoaded', function() {
    const content = document.getElementById('content');
    content.textContent = 'Dashboard Loaded';
  
    document.getElementById('refreshBtn').addEventListener('click', function() {
      content.textContent = 'Content Refreshed';
      chrome.runtime.sendMessage({action: 'refresh'}, function(response) {
        console.log('Background response:', response);
      });
    });
  
    // Modal logic
    const feedbackModal = document.getElementById('feedbackModal');
    const submitFeedback = document.getElementById('submitFeedback');
    // For demonstration, show modal on click of refresh button
    document.getElementById('refreshBtn').addEventListener('click', function() {
      feedbackModal.style.display = 'block';
    });
    submitFeedback.addEventListener('click', function() {
      const feedback = document.getElementById('feedbackText').value;
      console.log('Feedback submitted:', feedback);
      feedbackModal.style.display = 'none';
    });
  });