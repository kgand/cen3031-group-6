import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import { LoginResponse } from '../types/auth';

const API_URL = import.meta.env.VITE_API_URL;

const useSignInOut = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const loginWithRedirect = async (email: string, password: string) => {
    setError(null);
    // Display a loading toast
    toast.loading("Logging in...");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data: LoginResponse & { detail?: string } = await response.json();

      if (!response.ok) {
        const errorMessage = data.detail || 'Login failed';
        setError(errorMessage);
        toast.error(errorMessage);
        return;
      }

      // Store token and update toast
      localStorage.setItem('token', data.access_token);
      toast.success("Logged in successfully");
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const errorMessage = err.message || 'Network error. Please try again.';
      setError(errorMessage);
      toast.dismiss();
      toast.error(errorMessage);
    }
  };

  const logoutWithRedirect = () => {
    localStorage.removeItem('token');
    toast("Logged out successfully 👋");
    navigate('/', { replace: true });
  };

  return { loginWithRedirect, logoutWithRedirect, error };
};

export default useSignInOut;
