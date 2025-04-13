import { useState, useRef, useEffect } from "react";
import { useAtom } from "jotai";
import { FaBars } from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";
import { userAtom } from "../store";
import useSignInOut from "../hooks/useSignInOut";

export default function Nav() {
  const [user] = useAtom(userAtom);

  const { logoutWithRedirect } = useSignInOut();
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const location = useLocation();

  // Close popover if clicking outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }

    if (isPopoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPopoverOpen]);

  return (
    <nav className="fixed top-0 z-50 w-full md:top-4 md:px-8">
      <div
        className={`border-primary-700 bg-primary-900 mx-auto flex w-full max-w-[960px] justify-between md:grid md:h-14 ${location.pathname !== "/" ? "md:grid-cols-2" : "md:grid-cols-3"} border-0 border-b px-4 py-4 sm:px-2 md:rounded-lg md:border md:py-1.5`}
      >
        <Link to="/">
          <div className="flex h-full items-center gap-2">
            <img
              src="/images/nav-logo.png"
              alt="Logo"
              className="h-[25px] w-[68px]"
            />
            <p className="hidden text-base font-medium sm:block">FaciliGator</p>
          </div>
        </Link>
        {location.pathname == "/" && (
          <div className="text-primary-300 hidden items-center justify-center gap-1 text-sm md:flex">
            <a
              href=""
              className="hover:bg-primary-700 rounded-md px-3.5 py-2 transition-all"
            >
              Repo
            </a>
            <a
              href=""
              className="hover:bg-primary-700 rounded-md px-3.5 py-2 transition-all"
            >
              Features
            </a>
            <a
              href=""
              className="hover:bg-primary-700 rounded-md px-3.5 py-2 transition-all"
            >
              Tools
            </a>
          </div>
        )}
        <div className="relative flex items-center justify-end gap-4">
          {location.pathname == "/" ? (
            <Link
              to={user ? "/dashboard" : "/login"}
              className="bg-primary-100 text-primary-900 cta flex items-center rounded-md px-6 pt-[11px] pb-[9px] text-sm sm:px-8 sm:text-[15px] md:h-full"
            >
              <span>{user ? "Dashboard" : "Get Started"}</span>
            </Link>
          ) : (
            <>
              <Link to={"/"} className="hidden md:block pr-2 text-primary-200 text-sm">Home</Link>
              <Link to={"/login"} className="hidden md:blockpr-2 text-primary-200 text-sm">Login</Link>
              <Link to={"/signup"} className="hidden md:block pr-4 text-primary-200 text-sm">Sign Up</Link>
            </>
          )}
          {user && (
            <div ref={popoverRef} className="relative hidden h-full md:block">
              <div
                onClick={() => setPopoverOpen(!isPopoverOpen)}
                className="bg-primary-600 text-primary-300 aspect-square h-full cursor-pointer rounded-full"
              />
              {isPopoverOpen && (
                <div className="bg-primary-800 border-primary-700 absolute right-0 mt-2 w-40 rounded-md border shadow-lg">
                  <button
                    onClick={() => {
                      setPopoverOpen(false);
                      logoutWithRedirect();
                    }}
                    className="hover:bg-primary-700 w-full cursor-pointer px-4 py-2 text-left text-white"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
          <span className="bg-primary-800 border-primary-700 rounded-md border p-2 text-xl md:hidden">
            <FaBars />
          </span>
        </div>
      </div>
    </nav>
  );
}
