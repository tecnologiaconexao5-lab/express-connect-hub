import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, ChevronLeft, Truck } from "lucide-react";
import { sidebarItems, SidebarItem } from "@/lib/sidebarData";
import { cn } from "@/lib/utils";

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

const SidebarItemComponent = ({
  item,
  collapsed,
}: {
  item: SidebarItem;
  collapsed: boolean;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === item.path;
  const [open, setOpen] = useState(isActive);

  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;

  const handleClick = () => {
    if (hasChildren) {
      if (collapsed) {
        navigate(item.path);
      } else {
        setOpen(!open);
      }
    } else {
      navigate(item.path);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
          isActive
            ? "bg-tms-sidebar-active text-primary-foreground font-medium"
            : "text-tms-sidebar-fg hover:bg-tms-sidebar-hover"
        )}
        title={collapsed ? item.title : undefined}
      >
        <Icon className="w-5 h-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{item.title}</span>
            {hasChildren && (
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            )}
          </>
        )}
      </button>
      {!collapsed && hasChildren && open && (
        <div className="ml-6 mt-1 space-y-0.5 border-l border-tms-sidebar-hover pl-3">
          {item.children!.map((child) => (
            <button
              key={child.path}
              onClick={() => navigate(child.path)}
              className={cn(
                "w-full text-left text-xs py-1.5 px-2 rounded-md transition-colors",
                location.pathname + location.search === child.path
                  ? "text-tms-sidebar-active font-medium"
                  : "text-tms-sidebar-fg/70 hover:text-tms-sidebar-fg"
              )}
            >
              {child.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AppSidebar = ({ collapsed, onToggle }: Props) => {
  return (
    <aside
      className={cn(
        "h-screen bg-tms-sidebar flex flex-col transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-tms-sidebar-hover">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Truck className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h2 className="text-sm font-bold text-primary-foreground truncate">
              Conexão Express
            </h2>
            <p className="text-[10px] text-tms-sidebar-fg/60">TMS</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto p-1 rounded-md hover:bg-tms-sidebar-hover text-tms-sidebar-fg transition"
        >
          <ChevronLeft
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
        {sidebarItems.map((item) => (
          <SidebarItemComponent key={item.path} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
};

export default AppSidebar;
