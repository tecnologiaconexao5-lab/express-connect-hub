import { useState } from "react";
import { Building2, CalendarDays, Plus, FileText, Truck, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DashboardTopbar = () => {
  const [unidade, setUnidade] = useState("todas");
  const [periodo, setPeriodo] = useState("mes");

  return (
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
        <Button size="sm" className="h-8 text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          <FileText className="w-3.5 h-3.5" />
          Orçamento
        </Button>
        <Button size="sm" className="h-8 text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          <Truck className="w-3.5 h-3.5" />
          OS
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          <Users className="w-3.5 h-3.5" />
          Cliente
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          <UserPlus className="w-3.5 h-3.5" />
          Prestador
        </Button>
      </div>
    </div>
  );
};

export default DashboardTopbar;
