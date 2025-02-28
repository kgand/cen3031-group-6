// Configuration for FaciliGator extension

const CONFIG = {
    // API endpoints
    API_BASE_URL: "http://localhost:8000",
    
    // Authentication endpoints
    AUTH: {
        SIGNUP: "/auth/signup",
        LOGIN: "/auth/login",
        LOGOUT: "/auth/logout",
        ME: "/auth/me"
    },
    
    // Storage keys
    STORAGE: {
        AUTH_TOKEN: "facilitator_auth_token",
        USER_INFO: "facilitator_user_info"
    }
};

// Helper functions for authentication
const AuthUtils = {
    // Store authentication token
    setAuthToken: async (token) => {
        await chrome.storage.local.set({ [CONFIG.STORAGE.AUTH_TOKEN]: token });
    },
    
    // Get authentication token
    getAuthToken: async () => {
        const data = await chrome.storage.local.get([CONFIG.STORAGE.AUTH_TOKEN]);
        return data[CONFIG.STORAGE.AUTH_TOKEN];
    },
    
    // Remove authentication token
    removeAuthToken: async () => {
        await chrome.storage.local.remove([CONFIG.STORAGE.AUTH_TOKEN]);
    },
    
    // Store user information
    setUserInfo: async (userInfo) => {
        await chrome.storage.local.set({ [CONFIG.STORAGE.USER_INFO]: userInfo });
    },
    
    // Get user information
    getUserInfo: async () => {
        const data = await chrome.storage.local.get([CONFIG.STORAGE.USER_INFO]);
        return data[CONFIG.STORAGE.USER_INFO];
    },
    
    // Remove user information
    removeUserInfo: async () => {
        await chrome.storage.local.remove([CONFIG.STORAGE.USER_INFO]);
    },
    
    // Check if user is authenticated
    isAuthenticated: async () => {
        const token = await AuthUtils.getAuthToken();
        return !!token;
    },
    
    // Logout user
    logout: async () => {
        await AuthUtils.removeAuthToken();
        await AuthUtils.removeUserInfo();
    }
};

// API helper functions
const ApiUtils = {
    // Make authenticated API request
    authenticatedRequest: async (endpoint, method = 'GET', data = null) => {
        const token = await AuthUtils.getAuthToken();
        
        if (!token) {
            return { error: 'Not authenticated. Please log in.' };
        }
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, options);
            
            if (response.status === 401) {
                // Token expired or invalid
                await AuthUtils.logout();
                return { error: 'Authentication expired. Please log in again.' };
            }
            
            const result = await response.json();
            
            if (!response.ok) {
                return { error: result.detail || 'An error occurred' };
            }
            
            return result;
        } catch (error) {
            console.error('API request error:', error);
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                return { error: 'Cannot connect to the server. Please check your connection or server status.' };
            }
            return { error: 'Network error. Please try again.' };
        }
    },
    
    // Login user
    login: async (email, password) => {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.AUTH.LOGIN}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                return { error: data.detail || 'Login failed' };
            }
            
            // Store authentication data
            await AuthUtils.setAuthToken(data.access_token);
            await AuthUtils.setUserInfo({
                userId: data.user_id,
                email: data.email
            });
            
            return { success: true, user: data };
        } catch (error) {
            console.error('Login error:', error);
            return { error: 'Network error. Please try again.' };
        }
    },
    
    // Register user
    signup: async (email, password, fullName = null) => {
        try {
            const userData = { email, password };
            if (fullName) {
                userData.full_name = fullName;
            }
            
            const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.AUTH.SIGNUP}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                return { error: data.detail || 'Registration failed' };
            }
            
            // Check if email confirmation is required
            if (data.email_confirmation_required) {
                return { 
                    success: true, 
                    email_confirmation_required: true,
                    message: "Please check your email to confirm your account before logging in."
                };
            }
            
            // Store authentication data if no confirmation required
            if (data.access_token) {
                await AuthUtils.setAuthToken(data.access_token);
                await AuthUtils.setUserInfo({
                    userId: data.user_id,
                    email: data.email
                });
            }
            
            return { success: true, user: data };
        } catch (error) {
            console.error('Signup error:', error);
            return { error: 'Network error. Please try again.' };
        }
    },
    
    // Logout user
    logout: async () => {
        try {
            // Call logout endpoint (optional, as JWT can't be invalidated server-side)
            await ApiUtils.authenticatedRequest(CONFIG.AUTH.LOGOUT, 'POST');
            
            // Clear local storage
            await AuthUtils.logout();
            
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            // Still clear local storage even if API call fails
            await AuthUtils.logout();
            return { success: true };
        }
    }
};

// Export configuration and utilities
export { CONFIG, AuthUtils, ApiUtils }; 