document.addEventListener('DOMContentLoaded', function() {
    const content = document.getElementById('content');
    content.textContent = 'Dashboard Loaded';
  
    document.getElementById('refreshBtn').addEventListener('click', function() {
      content.textContent = 'Content Refreshed';
      chrome.runtime.sendMessage({action: 'refresh'}, function(response) {
        console.log('Background response:', response);
      });
    });
  });