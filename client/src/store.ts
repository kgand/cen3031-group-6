import { atom } from 'jotai';

const API_URL = import.meta.env.VITE_API_URL;

// Define the User interface based on what your API returns
export interface User {
  user_id: string;
  email: string;
}

// Main user atom to store the authenticated user
export const userAtom = atom<User | null>(null);

// Loading state to track authentication status checking
export const isLoadingUserAtom = atom<boolean>(true);

// Authentication state derived from userAtom
export const isAuthenticatedAtom = atom(
  (get) => get(userAtom) !== null
);

// Error state for authentication failures
export const authErrorAtom = atom<string | null>(null);

// Token atom for managing the JWT
// (initialized from localStorage if available)
export const tokenAtom = atom<string | null>(
  typeof window !== 'undefined' ? localStorage.getItem('token') : null
);

// Write-only atom for the login action
export const loginAtom = atom(
  null,
  async (_, set, credentials: { email: string; password: string }) => {
    try {
      set(isLoadingUserAtom, true);
      set(authErrorAtom, null);
      
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }
      
      const data = await response.json();
      
      // Save token to localStorage and atom
      localStorage.setItem('token', data.access_token);
      set(tokenAtom, data.access_token);
      
      // Set user data
      set(userAtom, {
        user_id: data.user_id,
        email: data.email,
      });
      
      return data;
    } catch (error) {
      set(authErrorAtom, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    } finally {
      set(isLoadingUserAtom, false);
    }
  }
);

// Write-only atom for logout action
export const logoutAtom = atom(
  null,
  (_, set) => {
    localStorage.removeItem('token');
    set(tokenAtom, null);
    set(userAtom, null);
  }
);


// Write-only atom for refreshing user data
export const refreshUserAtom = atom(
  null,
  async (get, set) => {
    const token = get(tokenAtom);
    if (!token) return;
    
    try {
      set(isLoadingUserAtom, true);
      
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        // If authentication fails, clear user and token
        // Correct way to call the write-only atom
        set(logoutAtom);
        throw new Error('Session expired');
      }
      
      const userData = await response.json();
      set(userAtom, userData);
    } catch (error) {
      console.error('Error refreshing user:', error);
    } finally {
      set(isLoadingUserAtom, false);
    }
  }
);