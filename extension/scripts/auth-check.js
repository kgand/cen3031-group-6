// Authentication check script
import { AuthUtils } from './config.js';

// Function to check if user is authenticated
export async function checkAuthentication() {
    try {
        const isAuthenticated = await AuthUtils.isAuthenticated();
        return isAuthenticated;
    } catch (error) {
        console.error('Authentication check error:', error);
        return false;
    }
}

// Function to redirect to auth page if not authenticated
export async function redirectIfNotAuthenticated() {
    const isAuthenticated = await checkAuthentication();
    
    if (!isAuthenticated) {
        window.location.href = 'auth.html';
        return false;
    }
    
    return true;
}

// Function to redirect to main page if authenticated
export async function redirectIfAuthenticated() {
    const isAuthenticated = await checkAuthentication();
    
    if (isAuthenticated) {
        window.location.href = 'popup.html';
        return true;
    }
    
    return false;
} 