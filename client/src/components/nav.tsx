import { FaBars } from "react-icons/fa";
import { Link } from "react-router-dom";

export default function Nav() {
  return (
    <nav className="fixed top-0 md:top-4 z-50 w-full  md:px-8">
      <div className="border-primary-700 bg-primary-900 mx-auto flex justify-between md:grid md:h-14 w-full max-w-[960px] md:grid-cols-3 md:rounded-lg border-0 border-b md:border px-4 sm:px-2 py-4 md:py-1.5">
        <Link to={"/"}>
          <div className="flex h-full items-center gap-2">
            <img
              src="/images/nav-logo.png"
              alt=""
              className="h-[25px] w-[68px]"
            />
            <p className="font-medium hidden sm:block text-base">FaciliGator</p>
          </div>
        </Link>
        <div className="hidden md:flex text-primary-300  items-center justify-center gap-1 text-sm">
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
        <div className="flex justify-end gap-4 items-center">
          <Link
            to={"/signup"}
            className="bg-primary-100 text-primary-900 cta flex pt-[11px] pb-[9px] md:h-full items-center rounded-md px-6 sm:px-8 text-sm sm:text-[15px]"
          >
            <span className="">Get Started</span>
          </Link>
          <span className="text-xl md:hidden p-2 bg-primary-800 rounded-md border border-primary-700"><FaBars/></span>
        </div>
      </div>
    </nav>
  );
}
