// Import the authentication utilities
import { ApiUtils } from '../scripts/config.js';

// Function to handle logout
export async function handleLogout() {
    const logoutButton = document.getElementById('logoutButton');
    
    try {
        // Show loading state
        if (logoutButton) {
            logoutButton.disabled = true;
            logoutButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
        }
        
        console.log('Logging out...');
        
        // Call the logout API
        const result = await ApiUtils.logout();
        console.log('Logout result:', result);
        
        // Redirect to auth page
        window.location.href = 'auth.html';
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        
        // Show error message
        alert('Failed to logout. Please try again.');
        
        // Reset button state
        if (logoutButton) {
            logoutButton.disabled = false;
            logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        }
        
        return false;
    }
}

// Initialize logout button if this script is loaded directly
document.addEventListener('DOMContentLoaded', function() {
    const logoutButton = document.getElementById('logoutButton');
    
    if (logoutButton) {
        console.log('Adding logout button event listener from logout.js');
        logoutButton.addEventListener('click', handleLogout);
    }
}); 