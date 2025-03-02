import { Link } from "react-router-dom";

export default function Nav() {
  return (
    <nav className="fixed top-4 w-full px-10 z-50">
      <div className="border-primary-700 bg-primary-900 mx-auto grid h-14 w-full max-w-[960px] grid-cols-3 rounded-lg border px-2 py-1.5">
        <div className="flex h-full items-center gap-2">
          <img
            src="/images/nav-logo.png"
            alt=""
            className="h-[25px] w-[68px]"
          />
          <p className="font-medium">FaciliGator</p>
        </div>
        <div className="text-primary-300 flex items-center justify-center gap-1 text-sm">
          <a href="" className="hover:bg-primary-700 px-3.5 py-2 rounded-md transition-all">Repo</a>
          <a href="" className="hover:bg-primary-700 px-3.5 py-2 rounded-md transition-all">Features</a>
          <a href="" className="hover:bg-primary-700 px-3.5 py-2 rounded-md transition-all">Tools</a>
        </div>
        <div className="flex justify-end">
          <Link
            to={"/login"}
            className="bg-primary-100 text-primary-900  flex h-full items-center rounded-md px-8 text-[15px] cta"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
