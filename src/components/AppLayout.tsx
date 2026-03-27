import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { getUser } from "@/lib/auth";
import AppSidebar from "./AppSidebar";
import AppTopbar from "./AppTopbar";

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const user = getUser();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/torre-controle") {
      setCollapsed(true);
    }
  }, [location.pathname]);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
