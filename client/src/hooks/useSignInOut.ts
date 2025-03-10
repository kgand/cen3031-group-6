import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginResponse } from '../types/auth';

const API_URL = import.meta.env.VITE_API_URL;

const useSignInOut = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const loginWithRedirect = async (email: string, password: string) => {
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
        setError(data.detail || 'Login failed');
        return;
      }


      localStorage.setItem('token', data.access_token);

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const logoutWithRedirect = () => {
    localStorage.removeItem('token');
    navigate('/', { replace: true });
  };

  return { loginWithRedirect, logoutWithRedirect, error };
};

export default useSignInOut;
