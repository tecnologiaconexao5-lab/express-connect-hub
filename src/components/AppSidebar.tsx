import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, Truck } from "lucide-react";
import { sidebarItems, getVisibleSidebarItems, SidebarItem } from "@/lib/sidebarData";
import { cn } from "@/lib/utils";

interface Props {
  expanded: boolean;
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
  const isActive = location.pathname === item.path ||
    (item.children?.some(c => location.pathname + location.search === c.path));
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
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative",
          isActive
            ? "bg-primary/20 text-white font-medium shadow-sm border border-primary/30"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        )}
        title={item.title}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span className={cn(
          "flex-1 text-left truncate transition-all duration-200",
          collapsed ? "w-0 opacity-0 overflow-hidden pointer-events-none" : "w-auto opacity-100"
        )}>
          {item.title}
        </span>
        {hasChildren && (
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-all duration-200 opacity-60 shrink-0",
              collapsed && "hidden",
              open && "rotate-180"
            )}
          />
        )}
      </button>
      {!collapsed && hasChildren && open && (
        <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-white/10 pl-3">
          {item.children!.map((child) => (
            <button
              key={child.path}
              onClick={() => navigate(child.path)}
              className={cn(
                "w-full text-left text-xs py-1.5 px-2 rounded-lg transition-colors",
                location.pathname + location.search === child.path
                  ? "text-white font-semibold bg-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
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

const AppSidebar = ({ expanded }: Props) => {
  const collapsed = !expanded;
  return (
    <aside
      className={cn(
        "h-screen flex flex-col shrink-0 transition-all duration-300 ease-in-out z-50",
        expanded && "shadow-2xl shadow-black/30"
      )}
      style={{
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
        width: expanded ? 240 : 64,
        position: "absolute",
        left: 0,
        top: 0,
      }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <Truck className="w-4 h-4 text-white" />
        </div>
        <div className={cn(
          "ml-3 overflow-hidden transition-all duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}>
          <h2 className="text-sm font-bold text-white truncate tracking-tight">
            Conexao Express
          </h2>
          <p className="text-[10px] text-slate-400 font-medium">TMS</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
        {getVisibleSidebarItems().map((item) => (
          <SidebarItemComponent key={item.path} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer */}
      <div className={cn(
        "p-3 border-t border-white/10 text-center transition-all duration-200",
        collapsed ? "text-[9px]" : "text-[10px]"
      )}>
        <span className="text-slate-500">
          {collapsed ? "v1.0" : "Express Connect Hub v1.0"}
        </span>
      </div>
    </aside>
  );
};

export default AppSidebar;
