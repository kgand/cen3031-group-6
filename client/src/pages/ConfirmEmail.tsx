import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


const API_URL = import.meta.env.VITE_API_URL;


const checkEmailConfirmed = async (): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) return false;
  
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    if (!response.ok) {
      return false;
    }
  
    const user = await response.json();

    return Boolean(user.email_confirmed_at);
  };
  

const ConfirmEmail: React.FC = () => {
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const intervalId = setInterval(async () => {
      const isConfirmed = await checkEmailConfirmed();
      if (isConfirmed) {
        setConfirmed(true);
        clearInterval(intervalId);
        // Redirect to login or dashboard after email is confirmed
        navigate('/login');
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [navigate]);

  return (
    <div>
      <h1>Please confirm your email</h1>
      <p>We sent you an email with a confirmation link. Once you verify your email, we’ll log you in automatically.</p>
      {confirmed && <p>Email confirmed!</p>}
    </div>
  );
};

export default ConfirmEmail;
