import { 
  createBrowserRouter, 
  RouterProvider, 
  Navigate, 
  redirect,
  LoaderFunction,
} from "react-router-dom";
import './styles/app.css'
import './styles/fonts.css'
import './styles/landing.css'
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import React, { useEffect } from "react";
import { useAtom } from 'jotai';


import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import ConfirmEmail from "./pages/ConfirmEmail";
import Home from "./pages/Home";
import Nav from "./components/Nav";
import { isLoadingUserAtom, userAtom } from "./store";


const API_URL = import.meta.env.VITE_API_URL;

// Define a function to fetch user that can be used both by the loader and in components
const fetchUser = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to authenticate');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    localStorage.removeItem('token'); // Clear invalid token
    return null;
  }
};

const requireAuth: LoaderFunction = async () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return redirect('/login');
  }
  
  // Make a full authentication check, including verification status
  try {
    const userData = await fetchUser(token);
    
    if (!userData) {
      // Token is invalid or user doesn't exist
      return redirect('/login');
    }
    
    // Here we could check any additional conditions from userData
    // For example, if the API returns an "email_verified" field:
    if (userData.email_verification_required) {
      return redirect('/confirm-email');
    }
    
    // User is fully authenticated
    return null;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return redirect('/login');
  }
};

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Nav />
      <ToastContainer theme="dark"/>
      {children}
    </>
  );
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout><Home /></Layout>
  },
  {
    path: "/login",
    element: <Layout><Login /></Layout>
  },
  {
    path: "/signup",
    element: <Layout><SignUp /></Layout>
  },
  {
    path: "/confirm-email",
    element: <Layout><ConfirmEmail /></Layout>
  },
  {
    path: "/dashboard",
    element: <Layout><Dashboard /></Layout>,
    loader: requireAuth
  },
  {
    path: "*",
    element: <Navigate to="/" replace />
  }
]);

// App initialization component
const AppWrapper: React.FC = () => {
  const [, setUser] = useAtom(userAtom);
  const [, setIsLoading] = useAtom(isLoadingUserAtom);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (token) {
        const userData = await fetchUser(token);
        setUser(userData);
      }
      setIsLoading(false);
    };

    initAuth();
  }, [setUser, setIsLoading]);

  return <RouterProvider router={router} />;
};

const App: React.FC = () => {
  return <AppWrapper />;
};

export default App;