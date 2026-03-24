import { LucideIcon, Construction, Plug } from "lucide-react";

interface SubModule {
  title: string;
  description: string;
  status: "development" | "integration";
}

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  subModules: SubModule[];
  onSubModuleClick?: (title: string) => void;
}

const PlaceholderPage = ({ title, description, icon: Icon, subModules, onSubModuleClick }: Props) => {
  return (
    <div className="animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{description}</p>
        </div>
      </div>

      {/* Submodules grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {subModules.map((sub) => (
          <div
            key={sub.title}
            className={`bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow ${onSubModuleClick ? "cursor-pointer" : ""}`}
            onClick={() => onSubModuleClick?.(sub.title)}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-foreground">{sub.title}</h3>
              <span
                className={
                  sub.status === "development"
                    ? "text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800"
                    : "text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800"
                }
              >
                {sub.status === "development" ? "Em desenvolvimento" : "Preparado para integração"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{sub.description}</p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground/60">
              {sub.status === "development" ? (
                <Construction className="w-3.5 h-3.5" />
              ) : (
                <Plug className="w-3.5 h-3.5" />
              )}
              <span>
                {sub.status === "development"
                  ? "Módulo em construção"
                  : "Pronto para conexão com APIs"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlaceholderPage;
