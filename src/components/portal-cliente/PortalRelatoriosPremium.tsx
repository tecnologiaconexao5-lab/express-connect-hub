import { useState, useMemo } from "react";
import {
  FileText, Download, BarChart3, DollarSign, AlertCircle, Calendar,
  FileCheck, RefreshCw, Filter, FileSpreadsheet
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { PortalEmptyState } from "@/components/portal-cliente";
import { gerarPDFProfissional } from "@/utils/pdfGenerator";
import { exportToExcel } from "@/utils/excelExport";

interface RelatorioFiltros {
  tipo: string;
  dataInicial: string;
  dataFinal: string;
  status: string;
  formato: string;
}

interface PortalRelatoriosPremiumProps {
  onGerarRelatorio: (filtros: RelatorioFiltros) => Promise<{ dados: any[]; titulo: string }>;
}

const TIPOS_RELATORIO = [
  { value: "entregas", label: "Entregas por Período", icon: FileCheck, desc: "Todas as entregas realizadas no período" },
  { value: "sla", label: "SLA e Performance", icon: BarChart3, desc: "Indicadores de nível de serviço" },
  { value: "financeiro", label: "Financeiro", icon: DollarSign, desc: "Faturamento, vencimentos e pagamentos" },
  { value: "ocorrencias", label: "Ocorrências", icon: AlertCircle, desc: "Registro de ocorrências operacionais" },
  { value: "comprovantes", label: "Comprovantes/POD", icon: FileText, desc: "Comprovantes de entrega" },
];

export default function PortalRelatoriosPremium({ onGerarRelatorio }: PortalRelatoriosPremiumProps) {
  const { toast } = useToast();
  const [filtros, setFiltros] = useState<RelatorioFiltros>({
    tipo: "entregas",
    dataInicial: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0],
    dataFinal: new Date().toISOString().split("T")[0],
    status: "todos",
    formato: "pdf",
  });
  const [gerando, setGerando] = useState(false);

  const atualizarFiltro = (campo: keyof RelatorioFiltros, valor: string) => {
    setFiltros(prev => ({ ...prev, [campo]: valor }));
  };

  const handleGerar = async () => {
    if (!filtros.dataInicial || !filtros.dataFinal) {
      toast({ title: "Preencha o período", description: "Selecione data inicial e final", variant: "destructive" });
      return;
    }
    if (new Date(filtros.dataFinal) < new Date(filtros.dataInicial)) {
      toast({ title: "Período inválido", description: "Data final anterior à data inicial", variant: "destructive" });
      return;
    }

    setGerando(true);
    try {
      const { dados, titulo } = await onGerarRelatorio(filtros);
      if (!dados || dados.length === 0) {
        toast({ title: "Nada a exportar", description: "Nenhum dado encontrado para os filtros selecionados" });
        setGerando(false);
        return;
      }

      if (filtros.formato === "pdf") {
        const colunas = Object.keys(dados[0]);
        const linhas = dados.map((d: any) => colunas.map(c => String(d[c] ?? "")));
        await gerarPDFProfissional({
          titulo,
          subtitulo: `${filtros.dataInicial} a ${filtros.dataFinal} | ${dados.length} registro(s)`,
          colunas,
          linhas,
          orientacao: colunas.length > 6 ? "landscape" : "portrait",
        });
        toast({ title: "PDF gerado", description: `${titulo} baixado com sucesso` });
      } else if (filtros.formato === "excel") {
        exportToExcel(dados, titulo.replace(/[^a-z0-9]/gi, "_").toLowerCase());
        toast({ title: "Excel gerado", description: `${titulo} baixado com sucesso` });
      } else {
        const csv = [
          Object.keys(dados[0]).join(","),
          ...dados.map((d: any) => Object.values(d).map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${titulo.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${filtros.dataInicial}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast({ title: "CSV gerado", description: `${titulo} baixado com sucesso` });
      }
    } catch (error) {
      toast({ title: "Erro ao gerar relatório", description: "Tente novamente com filtros diferentes", variant: "destructive" });
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-[#111827]">Relatórios Operacionais</CardTitle>
              <p className="text-sm text-[#64748B]">Exporte dados da sua operação com filtros reais</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TIPOS_RELATORIO.map(tipo => (
              <button
                key={tipo.value}
                onClick={() => atualizarFiltro("tipo", tipo.value)}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  filtros.tipo === tipo.value
                    ? "border-[#F97316] bg-orange-50 shadow-md"
                    : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1]"
                }`}
              >
                <tipo.icon className={`w-6 h-6 mb-2 ${filtros.tipo === tipo.value ? "text-[#F97316]" : "text-[#64748B]"}`} />
                <p className="text-sm font-bold text-[#111827]">{tipo.label}</p>
                <p className="text-[10px] text-[#64748B] mt-0.5">{tipo.desc}</p>
              </button>
            ))}
          </div>

          <div className="p-6 bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#F97316]" />
              <span className="text-sm font-bold text-[#111827]">Filtros do Relatório</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Data Inicial</Label>
                <Input
                  type="date"
                  value={filtros.dataInicial}
                  onChange={e => atualizarFiltro("dataInicial", e.target.value)}
                  className="rounded-xl bg-white border-[#E5E7EB] h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Data Final</Label>
                <Input
                  type="date"
                  value={filtros.dataFinal}
                  onChange={e => atualizarFiltro("dataFinal", e.target.value)}
                  className="rounded-xl bg-white border-[#E5E7EB] h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Status</Label>
                <Select value={filtros.status} onValueChange={v => atualizarFiltro("status", v)}>
                  <SelectTrigger className="rounded-xl bg-white border-[#E5E7EB] h-10">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="concluida">Concluído</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="atrasada">Atrasado</SelectItem>
                    <SelectItem value="cancelada">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Formato</Label>
                <Select value={filtros.formato} onValueChange={v => atualizarFiltro("formato", v)}>
                  <SelectTrigger className="rounded-xl bg-white border-[#E5E7EB] h-10">
                    <SelectValue placeholder="Formato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleGerar}
                disabled={gerando}
                className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-8 font-bold shadow-lg shadow-orange-500/20"
              >
                {gerando ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Gerar Relatório</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm text-[#111827] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#F97316]" />
            Resumo da Seleção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Relatório</p>
              <p className="font-bold text-[#111827]">{TIPOS_RELATORIO.find(t => t.value === filtros.tipo)?.label}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Período</p>
              <p className="font-bold text-[#111827]">{filtros.dataInicial} a {filtros.dataFinal}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Status</p>
              <p className="font-bold text-[#111827] capitalize">{filtros.status}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Formato</p>
              <p className="font-bold text-[#111827] uppercase">{filtros.formato}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
