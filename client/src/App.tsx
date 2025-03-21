// libraries
import { 
  createBrowserRouter, 
  RouterProvider, 
  Navigate, 
  redirect,
  LoaderFunction,
} from "react-router-dom";
import { useEffect } from "react";
import { useAtom } from "jotai";
import { ToastContainer } from "react-toastify";
// styles
import "./styles/app.css";
import "./styles/fonts.css";
import "./styles/landing.css";
import "./styles/dashboard.css";
import "react-toastify/dist/ReactToastify.css";
// pages
import Login from "./pages/login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import ConfirmEmail from "./pages/ConfirmEmail";
import Home from "./pages/home";
// layouts
import HomeLayout from "./layouts/HomeLayout";
import DashboardLayout from "./layouts/DashboardLayout";
// state
import { isLoadingUserAtom, userAtom } from "./store";
const API_URL = import.meta.env.VITE_API_URL;

// Define a function to fetch user that can be used both by the loader and in components
const fetchUser = async (token: string) => {
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to authenticate");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching user:", error);
    localStorage.removeItem("token"); // Clear invalid token
    return null;
  }
};

const requireAuth: LoaderFunction = async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    return redirect("/login");
  }

  // Make a full authentication check, including verification status
  try {
    const userData = await fetchUser(token);

    if (!userData) {
      // Token is invalid or user doesn't exist
      return redirect("/login");
    }
    // User is fully authenticated
    return null;
  } catch (error) {
    console.error("Authentication check failed:", error);
    return redirect("/login");
  }
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeLayout><Home /></HomeLayout>,
  },
  {
    path: "/login",
    element: <HomeLayout><Login /></HomeLayout>,
  },
  {
    path: "/signup",
    element: <HomeLayout><SignUp /></HomeLayout>,
  },
  {
    path: "/confirm-email",
    element: <HomeLayout><ConfirmEmail /></HomeLayout>,
  },
  {
    path: "/dashboard",
    element: <DashboardLayout><Dashboard /></DashboardLayout>,
    loader: requireAuth,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

// App initialization component
const AppWrapper: React.FC = () => {
  const [, setUser] = useAtom(userAtom);
  const [, setIsLoading] = useAtom(isLoadingUserAtom);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      if (token) {
        const userData = await fetchUser(token);
        setUser(userData);
      }
      setIsLoading(false);
    };

    initAuth();
  }, [setUser, setIsLoading]);

  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer theme="dark" />
    </>
  );
};

const App: React.FC = () => {
  return <AppWrapper />;
};

export default App;
