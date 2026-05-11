import { Database, Users, Truck, MapPin, Building2, Store, CreditCard, List, ChevronRight, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Cadastros = () => {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Clientes",
      description: "Cadastro completo de clientes com dados fiscais, contatos e endereços.",
      icon: Users,
      path: "/cadastros/clientes",
      color: "from-blue-500 to-blue-600",
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
      stat: "Clientes ativos"
    },
    {
      title: "Prestadores",
      description: "Gestão de parceiros logísticos com documentação, veículos e áreas de atuação.",
      icon: Truck,
      path: "/cadastros/prestadores",
      color: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      stat: "Parceiros cadastrados"
    },
    {
      title: "Veículos",
      description: "Frota própria e de parceiros com dados técnicos e documentação.",
      icon: Truck,
      path: "/cadastros/veiculos",
      color: "from-orange-500 to-orange-600",
      bg: "bg-orange-500/10",
      text: "text-orange-600 dark:text-orange-400",
      stat: "Veículos na frota"
    },
    {
      title: "Regiões",
      description: "Mapeamento de regiões de atendimento com praças e abrangência.",
      icon: MapPin,
      path: "/cadastros/auxiliares?tab=regioes",
      color: "from-purple-500 to-purple-600",
      bg: "bg-purple-500/10",
      text: "text-purple-600 dark:text-purple-400",
      stat: "Regiões mapeadas"
    },
    {
      title: "Filiais",
      description: "Estrutura de filiais com endereços, responsáveis e áreas de cobertura.",
      icon: Building2,
      path: "/cadastros/auxiliares?tab=filiais",
      color: "from-indigo-500 to-indigo-600",
      bg: "bg-indigo-500/10",
      text: "text-indigo-600 dark:text-indigo-400",
      stat: "Unidades ativas"
    },
    {
      title: "Unidades",
      description: "Unidades operacionais com configurações específicas de operação.",
      icon: Store,
      path: "/cadastros/auxiliares?tab=unidades",
      color: "from-pink-500 to-pink-600",
      bg: "bg-pink-500/10",
      text: "text-pink-600 dark:text-pink-400",
      stat: "Unidades configuradas"
    },
    {
      title: "Centros de Custo",
      description: "Estrutura de centros de custo para rateio e controle financeiro.",
      icon: CreditCard,
      path: "/cadastros/auxiliares?tab=centros-custo",
      color: "from-cyan-500 to-cyan-600",
      bg: "bg-cyan-500/10",
      text: "text-cyan-600 dark:text-cyan-400",
      stat: "Centros ativos"
    },
    {
      title: "Tabelas Auxiliares",
      description: "Tabelas de apoio: tipos de veículo, tipos de carga, motivos e outros.",
      icon: List,
      path: "/cadastros/auxiliares?tab=tabelas",
      color: "from-slate-500 to-slate-600",
      bg: "bg-slate-500/10",
      text: "text-slate-600 dark:text-slate-400",
      stat: "Parâmetros cadastrados"
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header enterprise */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
          <Database className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastros</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Base cadastral centralizada — clientes, prestadores, veículos e estrutura organizacional.
          </p>
        </div>
      </div>

      {/* Grid enterprise — 4 colunas em telas largas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {modules.map((mod) => (
          <div
            key={mod.title}
            className="group relative bg-card border border-border rounded-2xl p-6 cursor-pointer
                       hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5
                       transition-all duration-200 hover:-translate-y-1 overflow-hidden"
            onClick={() => navigate(mod.path)}
          >
            {/* Gradient accent top bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${mod.color} opacity-0 group-hover:opacity-100 transition-opacity`} />

            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl ${mod.bg} flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
              <mod.icon className={`w-6 h-6 ${mod.text}`} />
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors">
                  {mod.title}
                </h3>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mod.description}
              </p>
            </div>

            {/* Footer stat label */}
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {mod.stat}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Cadastros;