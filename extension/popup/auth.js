// Import the authentication utilities
import { ApiUtils } from '../scripts/config.js';
import { redirectIfAuthenticated } from '../scripts/auth-check.js';

document.addEventListener('DOMContentLoaded', function() {
    // Get form elements
    const loginForm = document.getElementById('login');
    const signupForm = document.getElementById('signup');
    const loginFormContainer = document.getElementById('login-form');
    const signupFormContainer = document.getElementById('signup-form');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const errorContainer = document.getElementById('error-container');
    const errorText = document.getElementById('error-text');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Password toggle elements
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    
    // Password strength elements
    const passwordInput = document.getElementById('signup-password');
    const strengthMeter = document.getElementById('strength-meter-fill');
    const strengthText = document.getElementById('password-strength-text');
    
    // Check if user is already authenticated
    checkAuth();
    
    // Event listeners for form switching
    showSignupLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginFormContainer.style.display = 'none';
        signupFormContainer.style.display = 'block';
        clearError();
    });
    
    showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        signupFormContainer.style.display = 'none';
        loginFormContainer.style.display = 'block';
        clearError();
    });
    
    // Password visibility toggle
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                this.classList.remove('fa-eye');
                this.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                this.classList.remove('fa-eye-slash');
                this.classList.add('fa-eye');
            }
        });
    });
    
    // Password strength meter
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            const strength = calculatePasswordStrength(password);
            updateStrengthMeter(strength);
        });
    }
    
    // Login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        // Validate inputs
        if (!email || !password) {
            showError('Please fill in all fields');
            return;
        }
        
        // Show loading spinner
        setLoading(true);
        
        // Attempt login
        try {
            const result = await ApiUtils.login(email, password);
            
            if (result.error) {
                showError(result.error);
                setLoading(false);
                return;
            }
            
            // Redirect to main popup on successful login
            window.location.href = 'popup.html';
        } catch (error) {
            console.error('Login error:', error);
            if (error.message && error.message.includes('Failed to fetch')) {
                showError('Cannot connect to the server. Please check if the backend is running.');
            } else {
                showError('An unexpected error occurred. Please try again.');
            }
            setLoading(false);
        }
    });
    
    // Signup form submission
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        
        // Validate inputs
        if (!email || !password || !confirmPassword) {
            showError('Please fill in all required fields');
            return;
        }
        
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }
        
        const strength = calculatePasswordStrength(password);
        if (strength.score < 2) {
            showError('Please choose a stronger password');
            return;
        }
        
        // Show loading spinner
        setLoading(true);
        
        // Attempt signup
        try {
            const result = await ApiUtils.signup(email, password, fullName);
            
            if (result.error) {
                showError(result.error);
                setLoading(false);
                return;
            }
            
            // Check if email confirmation is required
            if (result.email_confirmation_required) {
                // Show success message about email confirmation
                showSuccess(result.message || 'Please check your email to confirm your account before logging in.');
                
                // After 5 seconds, redirect to login form
                setTimeout(() => {
                    setLoading(false);
                    signupFormContainer.style.display = 'none';
                    loginFormContainer.style.display = 'block';
                }, 5000);
                
                return;
            }
            
            // Redirect to main popup on successful signup
            window.location.href = 'popup.html';
        } catch (error) {
            console.error('Signup error:', error);
            if (error.message && error.message.includes('Failed to fetch')) {
                showError('Cannot connect to the server. Please check if the backend is running.');
            } else {
                showError('An unexpected error occurred. Please try again.');
            }
            setLoading(false);
        }
    });
    
    // Helper functions
    
    // Check if user is already authenticated
    async function checkAuth() {
        setLoading(true);
        
        try {
            const redirected = await redirectIfAuthenticated();
            if (!redirected) {
                // User is not authenticated, show login form
                setLoading(false);
            }
        } catch (error) {
            console.error('Authentication check error:', error);
            setLoading(false);
        }
    }
    
    // Show error message
    function showError(message) {
        errorText.textContent = message;
        errorContainer.style.display = 'block';
    }
    
    // Clear error message
    function clearError() {
        errorText.textContent = '';
        errorContainer.style.display = 'none';
    }
    
    // Set loading state
    function setLoading(isLoading) {
        if (isLoading) {
            loadingSpinner.style.display = 'flex';
            loginFormContainer.style.display = 'none';
            signupFormContainer.style.display = 'none';
        } else {
            loadingSpinner.style.display = 'none';
            loginFormContainer.style.display = 'block';
        }
    }
    
    // Calculate password strength
    function calculatePasswordStrength(password) {
        // Basic password strength calculation
        let score = 0;
        let feedback = '';
        
        if (!password) {
            return { score, feedback: 'Password is required' };
        }
        
        // Length check
        if (password.length < 8) {
            feedback = 'Password is too short';
        } else {
            score += 1;
        }
        
        // Complexity checks
        if (/[A-Z]/.test(password)) score += 1; // Has uppercase
        if (/[a-z]/.test(password)) score += 1; // Has lowercase
        if (/[0-9]/.test(password)) score += 1; // Has number
        if (/[^A-Za-z0-9]/.test(password)) score += 1; // Has special char
        
        // Determine feedback based on score
        if (score < 2) {
            feedback = 'Weak password';
        } else if (score < 4) {
            feedback = 'Moderate password';
        } else {
            feedback = 'Strong password';
        }
        
        return { score, feedback };
    }
    
    // Update strength meter
    function updateStrengthMeter(strength) {
        const { score, feedback } = strength;
        
        // Update text
        strengthText.textContent = feedback;
        
        // Update meter
        const percentage = (score / 5) * 100;
        strengthMeter.style.width = `${percentage}%`;
        
        // Update color
        if (score < 2) {
            strengthMeter.style.backgroundColor = '#f44336'; // Red
        } else if (score < 4) {
            strengthMeter.style.backgroundColor = '#ff9800'; // Orange
        } else {
            strengthMeter.style.backgroundColor = '#4caf50'; // Green
        }
    }
    
    // Show success message
    function showSuccess(message) {
        // Create success container if it doesn't exist
        let successContainer = document.getElementById('success-container');
        if (!successContainer) {
            successContainer = document.createElement('div');
            successContainer.id = 'success-container';
            successContainer.className = 'success-container';
            
            const successContent = document.createElement('div');
            successContent.className = 'success-content';
            
            const successIcon = document.createElement('i');
            successIcon.className = 'fas fa-check-circle success-icon';
            
            const successText = document.createElement('span');
            successText.id = 'success-text';
            
            successContent.appendChild(successIcon);
            successContent.appendChild(successText);
            successContainer.appendChild(successContent);
            
            // Insert after error container
            const errorContainer = document.getElementById('error-container');
            errorContainer.parentNode.insertBefore(successContainer, errorContainer.nextSibling);
        }
        
        // Update success message
        const successText = document.getElementById('success-text');
        successText.textContent = message;
        successContainer.style.display = 'block';
        
        // Hide error container if visible
        errorContainer.style.display = 'none';
    }
}); 