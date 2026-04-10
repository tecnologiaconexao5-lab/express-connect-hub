import { useState, useMemo } from "react";
import {
  Search, Filter, Users, ArrowRight, Activity, Building, Phone, Mail,
  MessageSquare, Clock, Edit, Trash2, ChevronDown, ChevronUp, Eye,
  AlertTriangle, Star, MapPin, Plus, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Lead, ESTAGIOS_CONFIG, TEMPERATURA_CONFIG, SEGMENTOS, REGIOES_BRASIL
} from "./crmTypes";

interface CrmLeadsTableProps {
  leads: Lead[];
  onAbrirLead: (lead: Lead) => void;
}

type SortKey = "empresa" | "valorEstimadoMensal" | "probabilidadeFechamento" | "diasNaEtapa" | "criadoEm";

export default function CrmLeadsTable({ leads, onAbrirLead }: CrmLeadsTableProps) {
  const [busca, setBusca] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState("todos");
  const [filtroTemperatura, setFiltroTemperatura] = useState("todos");
  const [filtroSegmento, setFiltroSegmento] = useState("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");
  const [sortBy, setSortBy] = useState<SortKey>("criadoEm");
  const [sortAsc, setSortAsc] = useState(false);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const responsaveis = useMemo(() => {
    return [...new Set(leads.map(l => l.responsavel))];
  }, [leads]);

  const leadsFiltrados = useMemo(() => {
    let result = [...leads];

    if (busca) {
      const q = busca.toLowerCase();
      result = result.filter(l =>
        l.empresa.toLowerCase().includes(q) ||
        l.nomeContato?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.segmento?.toLowerCase().includes(q)
      );
    }

    if (filtroEstagio !== "todos") result = result.filter(l => l.estagio === filtroEstagio);
    if (filtroTemperatura !== "todos") result = result.filter(l => l.temperatura === filtroTemperatura);
    if (filtroSegmento !== "todos") result = result.filter(l => l.segmento === filtroSegmento);
    if (filtroResponsavel !== "todos") result = result.filter(l => l.responsavel === filtroResponsavel);

    result.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];
      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [leads, busca, filtroEstagio, filtroTemperatura, filtroSegmento, filtroResponsavel, sortBy, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(true); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortBy !== k) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  const getTemperatureColor = (t: string) => {
    const map: Record<string, string> = {
      frio: "bg-blue-100 text-blue-700",
      morno: "bg-yellow-100 text-yellow-700",
      quente: "bg-orange-100 text-orange-700",
      em_chamas: "bg-red-100 text-red-700",
    };
    return map[t] || "bg-slate-100 text-slate-600";
  };

  const totalValor = leadsFiltrados.reduce((a, l) => a + l.valorEstimadoMensal, 0);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa, contato, e-mail..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <Select value={filtroEstagio} onValueChange={setFiltroEstagio}>
              <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todas as etapas</SelectItem>
                {Object.entries(ESTAGIOS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroTemperatura} onValueChange={setFiltroTemperatura}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Temperatura" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todas</SelectItem>
                <SelectItem value="frio" className="text-xs">🧊 Frio</SelectItem>
                <SelectItem value="morno" className="text-xs">🌤️ Morno</SelectItem>
                <SelectItem value="quente" className="text-xs">🔥 Quente</SelectItem>
                <SelectItem value="em_chamas" className="text-xs">🚀 Em Chamas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroSegmento} onValueChange={setFiltroSegmento}>
              <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Segmento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos segmentos</SelectItem>
                {SEGMENTOS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                {responsaveis.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => toast.info("Exportando CSV...")}>
              <Download className="w-3.5 h-3.5" /> Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sumário */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="font-medium text-slate-700">{leadsFiltrados.length} leads encontrados</span>
        <span>·</span>
        <span>Valor total: <strong className="text-emerald-600">{fmt(totalValor)}</strong>/mês</span>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs cursor-pointer hover:text-primary" onClick={() => handleSort("empresa")}>
                Empresa / Contato <SortIcon k="empresa" />
              </TableHead>
              <TableHead className="text-xs">Etapa / Temperatura</TableHead>
              <TableHead className="text-xs">Segmento / Região</TableHead>
              <TableHead className="text-xs cursor-pointer hover:text-primary" onClick={() => handleSort("probabilidadeFechamento")}>
                Score IA <SortIcon k="probabilidadeFechamento" />
              </TableHead>
              <TableHead className="text-xs cursor-pointer hover:text-primary" onClick={() => handleSort("valorEstimadoMensal")}>
                Valor/mês <SortIcon k="valorEstimadoMensal" />
              </TableHead>
              <TableHead className="text-xs cursor-pointer hover:text-primary" onClick={() => handleSort("diasNaEtapa")}>
                Dias na Etapa <SortIcon k="diasNaEtapa" />
              </TableHead>
              <TableHead className="text-xs">Responsável</TableHead>
              <TableHead className="text-xs text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leadsFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum lead encontrado com os filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              leadsFiltrados.map((lead) => {
                const tempCfg = TEMPERATURA_CONFIG[lead.temperatura];
                const estagioConfig = ESTAGIOS_CONFIG[lead.estagio];
                const isAtRisk = lead.diasNaEtapa > 5 && lead.estagio !== "fechado_ganho" && lead.estagio !== "fechado_perdido";

                return (
                  <TableRow
                    key={lead.id}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${isAtRisk ? "bg-red-50/30" : ""}`}
                    onClick={() => onAbrirLead(lead)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <p className="font-bold text-sm text-slate-800">{lead.empresa}</p>
                          <p className="text-xs text-muted-foreground">{lead.nomeContato || "—"}</p>
                          {lead.telefone && (
                            <p className="text-[10px] text-muted-foreground">{lead.telefone}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${estagioConfig.corBg} ${estagioConfig.cor} block w-fit`}>
                          {estagioConfig.label}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTemperatureColor(lead.temperatura)} block w-fit`}>
                          {tempCfg.emoji} {tempCfg.label}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <p className="text-xs font-medium text-slate-700">{lead.segmento || "—"}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{lead.regiao || "—"}
                      </p>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Activity className={`w-3.5 h-3.5 shrink-0 ${lead.probabilidadeFechamento >= 70 ? "text-green-500" : lead.probabilidadeFechamento >= 40 ? "text-yellow-500" : "text-red-500"}`} />
                        <Progress value={lead.probabilidadeFechamento} className="w-16 h-1.5" />
                        <span className="text-xs font-bold text-primary ml-0.5">{lead.probabilidadeFechamento}%</span>
                      </div>
                      {lead.propostaVisualizacoes && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-1">
                          <Eye className="w-3 h-3" /> {lead.propostaVisualizacoes}x visualizado
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      <p className="text-sm font-bold text-emerald-600">{fmt(lead.valorEstimadoMensal)}</p>
                      <p className="text-[10px] text-muted-foreground">{lead.tipoServico || "—"}</p>
                    </TableCell>

                    <TableCell>
                      <div className={`flex items-center gap-1 text-xs font-medium ${isAtRisk ? "text-red-600" : lead.diasNaEtapa > 2 ? "text-amber-600" : "text-slate-600"}`}>
                        {isAtRisk && <AlertTriangle className="w-3.5 h-3.5" />}
                        <Clock className="w-3.5 h-3.5" />
                        <span>{lead.diasNaEtapa} dias</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <p className="text-xs font-medium text-slate-700">{lead.responsavel}</p>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={e => { e.stopPropagation(); toast.info("WhatsApp: " + lead.whatsapp); }}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={e => { e.stopPropagation(); onAbrirLead(lead); }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
