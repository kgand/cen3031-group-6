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
import React from "react";
import Home from "./pages/home";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Nav from "./components/nav";
import ConfirmEmail from "./pages/ConfirmEmail";


const requireAuth: LoaderFunction = () => {
  const isAuthenticated = Boolean(localStorage.getItem('token'));
  
  if (!isAuthenticated) {
    return redirect('/login');
  }
  
  return null;
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

const App: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default App;