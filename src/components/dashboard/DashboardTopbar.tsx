import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CalendarDays, Plus, FileText, Truck, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboardFilters } from "@/contexts/DashboardFilterContext";

const DashboardTopbar = () => {
  const navigate = useNavigate();
  const { filters, setPeriodo, setClienteId, setPrestadorId, setVeiculoTipo, setStatusOS } = useDashboardFilters();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            navigate("/comercial?tab=orcamentos&action=novo");
            break;
          case "2":
            e.preventDefault();
            navigate("/operacao?tab=os&action=novo");
            break;
          case "3":
            e.preventDefault();
            navigate("/cadastros/clientes/novo");
            break;
          case "4":
            e.preventDefault();
            navigate("/cadastros/prestadores/novo");
            break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const shortcuts = [
    { key: "1", label: "Novo Orçamento", action: () => navigate("/comercial?tab=orcamentos&action=novo") },
    { key: "2", label: "Nova OS", action: () => navigate("/operacao?tab=os&action=novo") },
    { key: "3", label: "Novo Cliente", action: () => navigate("/cadastros/clientes/novo") },
    { key: "4", label: "Novo Prestador", action: () => navigate("/cadastros/prestadores/novo") },
  ];

  const periodOptions = [
    { value: "hoje", label: "Hoje" },
    { value: "semana", label: "Semana" },
    { value: "mes", label: "Mês" },
    { value: "trimestre", label: "Trimestre" },
    { value: "personalizado", label: "Personalizado" },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filters.periodo} onValueChange={(v: any) => setPeriodo(v)}>
              <SelectTrigger className="w-[130px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/comercial?tab=orcamentos&action=novo")}>
                <Plus className="w-3.5 h-3.5" />
                <FileText className="w-3.5 h-3.5" />
                Orçamento
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Novo Orçamento (Ctrl+1)</p></TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/operacao?tab=os&action=novo")}>
                <Plus className="w-3.5 h-3.5" />
                <Truck className="w-3.5 h-3.5" />
                OS
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Nova OS (Ctrl+2)</p></TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate("/operacao?tab=escala&acao=alocar")}>
                <Plus className="w-3.5 h-3.5" />
                <Truck className="w-3.5 h-3.5" />
                Alocação
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Nova Alocação (Ir para Programação Operacional)</p></TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => navigate("/cadastros/clientes/novo")}>
                <Plus className="w-3.5 h-3.5" />
                <Users className="w-3.5 h-3.5" />
                Cliente
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Novo Cliente (Ctrl+3)</p></TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => navigate("/cadastros/prestadores/novo")}>
                <Plus className="w-3.5 h-3.5" />
                <UserPlus className="w-3.5 h-3.5" />
                Prestador
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Novo Prestador (Ctrl+4)</p></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default DashboardTopbar;
