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
      { name: "Quizzes", route: "/Quizzes", icon: <IoReaderOutline /> },
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
      { name: "Watch Demo", route: "/demo", icon: <IoPlayOutline /> },
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

  return (
    <div className="max-h-screen min-w-72 overflow-y-auto p-6">
      <div className="border-primary-700 flex items-center gap-3 border-b border-dashed pb-4">
        <img src="/favicon.png" alt="" className="h-7 w-7" />
        <p className="text-lg font-medium">FaciliGator</p>
      </div>

      <div className="border-primary-700 border-b border-dashed py-4">
        <div className="active-tab-wrapper rounded-md">
          <div className="active-tab flex items-center gap-2 rounded-md px-3 py-1.5 text-sm">
            <IoHomeOutline />
            <p>Dashboard</p>
          </div>
        </div>
      </div>

      {sections.map((section) => (
        <NavSection key={section.name} section={section} />
      ))}

      <div className="border-primary-700 border-b border-dashed py-4">
        <p className="text-primary-400 px-3 text-xs">Personal</p>
        <div className="grid pt-2">
          <div className="p-px rounded-md hover:bg-primary-700 transition-all" onClick={logoutWithRedirect}>
            <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-primary-800 transition-all text-primary-400 cursor-pointer">
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
    <div className="border-primary-700 border-b border-dashed py-4">
      <p className="text-primary-400 px-3 text-xs">{section.name}</p>
      <div className="grid pt-2 gap-1">
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
        className={`rounded-md p-px transition-all ${isActive ? "active-tab-wrapper" : "hover:bg-primary-700"}`}
      >
        <div
          className={` flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-all ${isActive ? "active-tab text-primary-200" : "hover:bg-primary-800 text-primary-400"}`}
        >
          {icon}
          <p>{name}</p>
        </div>
      </div>
    </Link>
  );
};
