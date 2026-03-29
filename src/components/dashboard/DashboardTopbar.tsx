import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, CalendarDays, Plus, FileText, Truck, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DashboardTopbar = () => {
  const navigate = useNavigate();
  const [unidade, setUnidade] = useState("todas");
  const [periodo, setPeriodo] = useState("mes");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            navigate("/comercial/orcamentos/novo");
            break;
          case "2":
            e.preventDefault();
            navigate("/operacao/os/nova");
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
    { key: "1", label: "Novo Orçamento", action: () => navigate("/comercial/orcamentos/novo") },
    { key: "2", label: "Nova OS", action: () => navigate("/operacao/os/nova") },
    { key: "3", label: "Novo Cliente", action: () => navigate("/cadastros/clientes/novo") },
    { key: "4", label: "Novo Prestador", action: () => navigate("/cadastros/prestadores/novo") },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as unidades</SelectItem>
                <SelectItem value="sp">Filial São Paulo</SelectItem>
                <SelectItem value="rj">Filial Rio de Janeiro</SelectItem>
                <SelectItem value="mg">Filial Minas Gerais</SelectItem>
                <SelectItem value="pr">Filial Paraná</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
                <SelectItem value="trimestre">Trimestre</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/comercial/orcamentos/novo")}>
                <Plus className="w-3.5 h-3.5" />
                <FileText className="w-3.5 h-3.5" />
                Orçamento
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Novo Orçamento (Ctrl+1)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/operacao/os/nova")}>
                <Plus className="w-3.5 h-3.5" />
                <Truck className="w-3.5 h-3.5" />
                OS
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Nova OS (Ctrl+2)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => navigate("/cadastros/clientes/novo")}>
                <Plus className="w-3.5 h-3.5" />
                <Users className="w-3.5 h-3.5" />
                Cliente
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Novo Cliente (Ctrl+3)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => navigate("/cadastros/prestadores/novo")}>
                <Plus className="w-3.5 h-3.5" />
                <UserPlus className="w-3.5 h-3.5" />
                Prestador
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Novo Prestador (Ctrl+4)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default DashboardTopbar;
