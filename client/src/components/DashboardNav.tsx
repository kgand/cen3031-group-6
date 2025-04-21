import {
  IoHomeOutline,
  IoVideocamOutline,
  IoFileTrayOutline,
  IoExitOutline,
  IoExtensionPuzzleOutline,
  IoReaderOutline,
  IoPlayOutline,
  IoLayersOutline
} from "react-icons/io5";
import useSignInOut from "../hooks/useSignInOut";
import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

type Tab = {
  name: string;
  route: string;
  icon: ReactNode;
};
type Section = {
  name: string;
  tabs: Tab[];
};
const sections = [
  {
    name: "Classes",
    tabs: [
      { name: "Lectures", route: "/lectures", icon: <IoVideocamOutline /> },
      {
        name: "Assignments",
        route: "/assignments",
        icon: <IoFileTrayOutline />,
      },
    ],
  },
  {
    name: "Learning",
    tabs: [
      { name: "Quizzes", route: "/quizzes", icon: <IoReaderOutline /> },
      {
        name: "Notecards",
        route: "/notecards",
        icon: <IoLayersOutline />,
      },
    ],
  },
  {
    name: "Other",
    tabs: [
      { name: "Guide", route: "/guide", icon: <IoPlayOutline /> },
      {
        name: "Download Extension",
        route: "/extension",
        icon: <IoExtensionPuzzleOutline />,
      },
    ],
  },
];

export default function DashboardNav() {
  const { logoutWithRedirect } = useSignInOut();
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";

  return (
    <div className="max-h-screen min-w-68 overflow-y-auto p-6 bg-primary-900 border-r border-primary-800">
      <div className="flex items-center gap-3 pb-5 mb-4 border-b border-primary-800">
        <img src="/favicon.png" alt="" className="h-7 w-7" />
        <p className="text-lg font-medium bg-gradient-to-r from-blue-400 to-indigo-400 inline-block text-transparent bg-clip-text">FaciliGator</p>
      </div>

      <div className="mb-4">
        <Link to="/dashboard">
          <div 
            className={`rounded-md p-px transition-all ${isDashboard ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "hover:bg-primary-800"}`}
          >
            <div 
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isDashboard 
                  ? "bg-primary-900 text-primary-200" 
                  : "hover:bg-opacity-80 text-primary-400"
              }`}
            >
              <IoHomeOutline />
              <p>Dashboard</p>
            </div>
          </div>
        </Link>
      </div>

      {sections.map((section) => (
        <NavSection key={section.name} section={section} />
      ))}

      <div className="border-t border-primary-800 pt-4 mt-4">
        <p className="text-primary-500 px-3 text-xs mb-2">Personal</p>
        <div className="grid">
          <div 
            className="rounded-md p-px hover:bg-primary-800 transition-all cursor-pointer" 
            onClick={logoutWithRedirect}
          >
            <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-primary-400 hover:text-primary-300 transition-all">
              <IoExitOutline />
              <p>Sign Out</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type NavSectionProps = {
  section: Section;
};

const NavSection: React.FC<NavSectionProps> = ({ section }) => {
  return (
    <div className="mb-4">
      <p className="text-primary-500 px-3 text-xs mb-2">{section.name}</p>
      <div className="grid gap-1">
        {section.tabs.map((tab) => (
          <NavTab
            key={tab.name}
            name={tab.name}
            route={tab.route}
            icon={tab.icon}
          />
        ))}
      </div>
    </div>
  );
};

const NavTab: React.FC<Tab> = ({ name, route, icon }) => {
  const location = useLocation();
  const isActive = location.pathname === `/dashboard${route}`;

  return (
    <Link to={`/dashboard${route}`}>
      <div
        className={`rounded-md p-px transition-all ${isActive ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "hover:bg-primary-800"}`}
      >
        <div
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${
            isActive 
              ? "bg-primary-900 text-primary-200" 
              : "hover:bg-opacity-80 text-primary-400"
          }`}
        >
          {icon}
          <p>{name}</p>
        </div>
      </div>
    </Link>
  );
};
