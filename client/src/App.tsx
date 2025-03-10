import { 
  createBrowserRouter, 
  RouterProvider, 
  Navigate, 
  redirect,
  LoaderFunction,
} from "react-router-dom";
import Home from "./pages/home";
import './styles/app.css'
import './styles/fonts.css'
import './styles/landing.css'
import Nav from "./components/nav";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import React from "react";


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