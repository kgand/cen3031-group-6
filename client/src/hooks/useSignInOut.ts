import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { loginAtom, logoutAtom, authErrorAtom } from '../store';

const useSignInOut = () => {
  const navigate = useNavigate();
  const [, login] = useAtom(loginAtom);
  const [, logout] = useAtom(logoutAtom);
  const [error] = useAtom(authErrorAtom);

  const loginWithRedirect = async (email: string, password: string) => {
    // Show a loading toast
    const toastId = toast.loading("Logging in...");
    try {
      // Call the loginAtom write function with credentials
      await login({ email, password });
      // Update toast to success message
      toast.update(toastId, {
        render: "Logged in successfully",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      // If an error occurs, update the toast accordingly
      const errorMessage = error.message || 'Login failed';
      toast.update(toastId, {
        render: errorMessage,
        type: "error",
        isLoading: false,
        autoClose: 3000,
      });
    }
  };

  const logoutWithRedirect = () => {
    // Call the logoutAtom write function to clear user data and token
    logout();
    toast("Logged out successfully 👋");
    navigate('/', { replace: true });
  };

  return { loginWithRedirect, logoutWithRedirect, error };
};

export default useSignInOut;
