import { useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import useSignInOut from './useSignInOut';
import { SignupResponse } from '../types/auth';

const API_URL = import.meta.env.VITE_API_URL;

const useSignUp = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { loginWithRedirect } = useSignInOut();
  const navigate = useNavigate();

  const signUp = async (email: string, password: string, fullName: string) => {
    setError(null);
    setLoading(true);
    const signupToastId = toast.loading("Signing up...");

    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, full_name: fullName})
      });

      const data: SignupResponse & { detail?: string } = await response.json();

      if (!response.ok) {
        const errorMessage = data.detail || 'Signup failed';
        setError(errorMessage);
        toast.dismiss(signupToastId);
        toast.error(errorMessage);
        setLoading(false);
        return;
      }

      toast.dismiss(signupToastId);

      if (data.email_confirmation_required) {
        toast.success("Signup successful! Please check your email to confirm your account.");
        setLoading(false);
        navigate('/confirm-email', { state: { email } });
        return;
      }
      toast.success("Signup successful! Logging you in...");
      await loginWithRedirect(email, password);
      setLoading(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Network error. Please try again.';
      setError(errorMessage);
      toast.dismiss(signupToastId);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return { signUp, error, loading };
};

export default useSignUp;
