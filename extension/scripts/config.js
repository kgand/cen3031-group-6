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
            
            // Parse the response JSON
            let result;
            try {
                result = await response.json();
            } catch (e) {
                // If JSON parsing fails, create a simple object with the status text
                result = { detail: response.statusText || 'Unknown error' };
            }
            
            // Check if response is not ok (not in 200-299 range)
            if (!response.ok) {
                // For validation errors (422 Unprocessable Entity), format them nicely
                if (response.status === 422) {
                    console.error('Validation error response:', result);
                    
                    // Format the validation error details
                    if (result.detail && Array.isArray(result.detail)) {
                        const formattedErrors = result.detail.map((err, i) => {
                            if (typeof err === 'object') {
                                return `Validation error ${i+1}: ${JSON.stringify(err)}`;
                            }
                            return `Validation error ${i+1}: ${err}`;
                        }).join('. ');
                        
                        return { error: formattedErrors };
                    }
                }
                
                // For other error types
                return { 
                    error: result.detail || result.message || `Error ${response.status}: ${response.statusText}` 
                };
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
                console.error('Login error response:', data);
                // Check if the error is about unconfirmed email
                if (data.detail && data.detail.includes("Email not confirmed")) {
                    return { 
                        error: data.detail,
                        email_confirmation_required: true
                    };
                }
                return { error: data.detail || 'Login failed' };
            }
            
            // Store authentication data
            await AuthUtils.setAuthToken(data.access_token);
            
            // Get user's name from email (before the @ symbol) as fallback
            const displayName = email.split('@')[0];
            
            // Store user info
            await AuthUtils.setUserInfo({
                userId: data.user_id,
                email: data.email,
                fullName: data.full_name || displayName
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
                console.error('Signup error response:', data);
                // Check if the error indicates that the account was created but there was an issue
                if (data.detail && (data.detail.includes("Account created") || data.detail.includes("check your email"))) {
                    return { 
                        success: true, 
                        email_confirmation_required: true,
                        message: data.detail
                    };
                }
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
                
                // Get user's name from email (before the @ symbol) as fallback
                const displayName = email.split('@')[0];
                
                await AuthUtils.setUserInfo({
                    userId: data.user_id,
                    email: data.email,
                    fullName: fullName || displayName
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
    },
    
    // Get user information
    getUserInfo: async () => {
        try {
            // First try to get from storage
            const userInfo = await AuthUtils.getUserInfo();
            
            // If we have user info in storage, return it
            if (userInfo) {
                return userInfo;
            }
            
            // If not in storage, try to get from API
            const result = await ApiUtils.authenticatedRequest(CONFIG.AUTH.ME);
            
            if (result.error) {
                return null;
            }
            
            // Store the user info
            await AuthUtils.setUserInfo(result);
            
            return result;
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
    },
    
    // Store Zoom recordings in database
    storeZoomRecordings: async (data) => {
        try {
            console.log('Submitting Zoom recordings:', data);
            
            // Call the API endpoint to store recordings
            const result = await ApiUtils.authenticatedRequest('/zoom/store', 'POST', data);
            
            if (result.error) {
                console.error('Error storing zoom recordings:', result.error);
                return { error: result.error };
            }
            
            return { 
                status: 'success',
                message: result.message || 'Recordings submitted successfully',
                count: data.recordings.length,
                batch_id: data.upload_batch_id
            };
        } catch (error) {
            console.error('Error in storeZoomRecordings:', error);
            return { error: error.message || 'Failed to store recordings' };
        }
    },
    
    // Store assignments in database
    storeAssignments: async (data) => {
        try {
            console.log('Submitting assignments:', data);
            
            // Basic validation to prevent common issues
            if (!data || !data.assignments || !Array.isArray(data.assignments) || data.assignments.length === 0) {
                return { error: 'No valid assignments to submit' };
            }
            
            // Ensure required fields are present for all assignments
            for (const [index, assignment] of data.assignments.entries()) {
                if (!assignment.title || !assignment.url) {
                    return { error: `Assignment at position ${index} must have a title and URL` };
                }
                
                // Ensure points is a valid number
                if (assignment.points && isNaN(parseFloat(assignment.points))) {
                    return { error: `Assignment "${assignment.title}" has invalid points value` };
                }
            }
            
            // Call the API endpoint to store assignments
            const result = await ApiUtils.authenticatedRequest('/assignments/store', 'POST', data);
            
            if (result.error) {
                // Format error message properly
                let errorMessage = result.error;
                
                // If the error is an object, convert it to a string
                if (typeof errorMessage === 'object') {
                    try {
                        // Check for validation errors (common format for 422 responses)
                        if (errorMessage.detail && Array.isArray(errorMessage.detail)) {
                            // Format validation errors nicely
                            const validationErrors = errorMessage.detail.map((err, i) => 
                                `Error ${i+1}: ${JSON.stringify(err)}`
                            ).join('; ');
                            errorMessage = `Validation errors: ${validationErrors}`;
                        } else {
                            // Just stringify the whole object
                            errorMessage = JSON.stringify(errorMessage);
                        }
                    } catch (e) {
                        errorMessage = 'Invalid error format';
                    }
                }
                
                console.error('Error storing assignments:', errorMessage);
                return { error: errorMessage };
            }
            
            console.log('Successfully stored assignments:', result);
            return { 
                status: 'success',
                message: result.message || 'Assignments submitted successfully',
                count: data.assignments.length,
                batch_id: data.upload_batch_id
            };
        } catch (error) {
            // Format the caught error properly
            let errorMessage = error.message || 'Failed to store assignments';
            
            // For network or other errors that might be objects
            if (typeof error === 'object' && !(error instanceof Error)) {
                try {
                    errorMessage = JSON.stringify(error);
                } catch (e) {
                    errorMessage = 'Unknown error object';
                }
            }
            
            console.error('Error in storeAssignments:', errorMessage);
            return { error: errorMessage };
        }
    },
    
    // Extract transcript from Zoom recording using frontend scraping
    extractZoomTranscript: async (url) => {
        try {
            console.log('Extracting transcript from URL:', url);
            
            return new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    action: 'extractZoomTranscript',
                    url: url
                }, (response) => {
                    console.log('Transcript extraction response:', response);
                    
                    if (!response || response.error) {
                        resolve({ 
                            success: false, 
                            error: response?.error || 'Failed to extract transcript' 
                        });
                        return;
                    }
                    
                    resolve({
                        success: true,
                        transcript_data: response.transcript_data,
                        formatted_text: response.formatted_text,
                        segment_count: response.segment_count || 0
                    });
                });
            });
        } catch (error) {
            console.error('Error in extractZoomTranscript:', error);
            return { 
                success: false, 
                error: error.message || 'Failed to extract transcript' 
            };
        }
    },
    
    // Store Zoom transcript in the database
    storeZoomTranscript: async (recordingId, transcriptData) => {
        try {
            console.log('Storing transcript for recording ID:', recordingId);
            
            // Call the API endpoint to store the transcript
            const result = await ApiUtils.authenticatedRequest('/zoom/store-transcript', 'POST', {
                recording_id: recordingId,
                transcript_data: transcriptData.transcript_data,
                formatted_text: transcriptData.formatted_text || "",
                segment_count: transcriptData.segment_count || transcriptData.transcript_data?.length || 0
            });
            
            if (result.error) {
                console.error('Error storing transcript:', result.error);
                return { error: result.error };
            }
            
            return { 
                success: true,
                message: 'Transcript stored successfully',
                recording_id: recordingId
            };
        } catch (error) {
            console.error('Error in storeZoomTranscript:', error);
            return { error: error.message || 'Failed to store transcript' };
        }
    }
};

// Export configuration and utilities
export { CONFIG, AuthUtils, ApiUtils }; 