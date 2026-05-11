import { useState, useEffect } from "react";
import { Search, Download, FileText, TrendingUp, DollarSign, Truck, User, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listarComposicoesFinanceiras } from "@/services/financeiro/composicaoFinanceiraService";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    "rascunho": { label: "Rascunho", cls: "bg-gray-100 text-gray-800" },
    "finalizada": { label: "Finalizada", cls: "bg-green-100 text-green-700" },
    "cancelada": { label: "Cancelada", cls: "bg-red-100 text-red-700" },
  };
  const entry = map[status?.toLowerCase()] ?? { label: status || "-", cls: "bg-gray-100 text-gray-500" };
  return <Badge variant="outline" className={`text-[11px] font-semibold px-2.5 py-0.5 ${entry.cls}`}>{entry.label}</Badge>;
};

export default function RelatorioMargemReal() {
  const [loading, setLoading] = useState(false);
  const [composicoes, setComposicoes] = useState<any[]>([]);
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroMargemMinima, setFiltroMargemMinima] = useState("");
  const [tipoRelatorio, setTipoRelatorio] = useState("margem");

  const carregarDados = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filtroDataInicio) params.dataInicio = filtroDataInicio;
      if (filtroDataFim) params.dataFim = filtroDataFim;
      if (filtroMargemMinima) params.margemMinima = Number(filtroMargemMinima);

      const dados = await listarComposicoesFinanceiras(params);
      setComposicoes(dados || []);
      toast.success(`${dados?.length || 0} registros encontrados`);
    } catch (e) {
      console.error("[Relatório] Erro ao carregar:", e);
      toast.error("Erro ao carregar dados do relatório");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const totalValorCliente = composicoes.reduce((acc, item) => acc + (Number(item.valor_cliente) || 0), 0);
  const totalValorPrestador = composicoes.reduce((acc, item) => acc + (Number(item.valor_prestador) || 0), 0);
  const totalMargemBruta = composicoes.reduce((acc, item) => acc + (Number(item.margem_bruta) || 0), 0);
  const totalMargemLiquida = composicoes.reduce((acc, item) => acc + (Number(item.margem_liquida) || 0), 0);
  const mediaMargemLiquida = composicoes.length > 0 ? (totalMargemLiquida / totalValorCliente) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Relatório de Margem Real
          </h2>
          <p className="text-muted-foreground">Composição financeira detalhada por OS</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filtros do Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data-inicio">Data Início</Label>
              <Input 
                id="data-inicio" 
                type="date" 
                value={filtroDataInicio} 
                onChange={(e) => setFiltroDataInicio(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-fim">Data Fim</Label>
              <Input 
                id="data-fim" 
                type="date" 
                value={filtroDataFim} 
                onChange={(e) => setFiltroDataFim(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="margem-min">Margem Mínima (%)</Label>
              <Input 
                id="margem-min" 
                type="number" 
                placeholder="Ex: 15" 
                value={filtroMargemMinima} 
                onChange={(e) => setFiltroMargemMinima(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo-rel">Tipo de Relatório</Label>
              <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                <SelectTrigger id="tipo-rel">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="margem">Composição de Margem</SelectItem>
                  <SelectItem value="custos">Custos Operacionais</SelectItem>
                  <SelectItem value="prestador">Por Prestador</SelectItem>
                  <SelectItem value="cliente">Por Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={carregarDados} disabled={loading} className="gap-2">
              <Search className="w-4 h-4" />
              {loading ? "Carregando..." : "Gerar Relatório"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{fmt(totalValorCliente)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Prestador</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{fmt(totalValorPrestador)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Margem Bruta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{fmt(totalMargemBruta)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Margem Líquida Média</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">{mediaMargemLiquida.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Detalhamento por OS
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Exportação CSV em desenvolvimento")}>
                <Download className="w-4 h-4" />
                Exportar CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Exportação PDF em desenvolvimento")}>
                <FileText className="w-4 h-4" />
                Exportar PDF
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Prestador</TableHead>
                  <TableHead className="text-right">Valor Cliente</TableHead>
                  <TableHead className="text-right">Valor Prestador</TableHead>
                  <TableHead className="text-right">Imposto</TableHead>
                  <TableHead className="text-right">Seguro</TableHead>
                  <TableHead className="text-right">Pedágio</TableHead>
                  <TableHead className="text-right">Outros</TableHead>
                  <TableHead className="text-right">Margem Bruta</TableHead>
                  <TableHead className="text-right">Margem Líquida</TableHead>
                  <TableHead className="text-right">% Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {composicoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado. Ajuste os filtros e gere o relatório.
                    </TableCell>
                  </TableRow>
                ) : (
                  composicoes.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.os?.numero || "-"}</TableCell>
                      <TableCell><StatusBadge status={item.os?.status || ""} /></TableCell>
                      <TableCell>{item.cliente_id || "-"}</TableCell>
                      <TableCell>{item.prestador_id || "-"}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(item.valor_cliente) || 0)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(item.valor_prestador) || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{fmt(Number(item.imposto_valor) || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{fmt(Number(item.seguro_valor) || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-orange-600">{fmt(Number(item.pedagio_valor) || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-orange-600">{fmt(Number(item.outros_custos) || 0)}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${Number(item.margem_bruta) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(Number(item.margem_bruta) || 0)}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${Number(item.margem_liquida) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(Number(item.margem_liquida) || 0)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${Number(item.percentual_margem_liquida) >= 20 ? "text-green-600" : Number(item.percentual_margem_liquida) >= 10 ? "text-yellow-600" : "text-red-600"}`}>
                        {Number(item.percentual_margem_liquida)?.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
