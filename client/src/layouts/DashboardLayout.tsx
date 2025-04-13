import DashboardNav from "../components/DashboardNav";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <>
      <div className="flex">  
        <DashboardNav />
        {children}
      </div>
    </>
  );
};

export default DashboardLayout;
