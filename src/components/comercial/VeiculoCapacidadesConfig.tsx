import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Save, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { carregarCapacidadesVeiculo, salvarCapacidadesVeiculo } from "@/services/comercial/veiculoCapacidadeService";
import type { VeiculoCapacidade } from "@/components/comercial/cargaCalculo";

const NAO_PARAM = "__nao_parametrizado__";

/**
 * TMS-COM-CARGA-03 — Parametrização de capacidade por TIPO/CONFIGURAÇÃO de veículo.
 * Persistida em configuracoes_sistema['veiculo_capacidades'] (sem migration).
 * Números padrão derivam de VEICULO_PARAMETROS (origem explícita) — editáveis.
 */
export default function VeiculoCapacidadesConfig() {
  const [rows, setRows] = useState<VeiculoCapacidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      setRows(await carregarCapacidadesVeiculo());
    } catch (e: unknown) {
      toast.error("Erro ao carregar capacidades de veículos.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const update = (i: number, patch: Partial<VeiculoCapacidade>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const salvar = async () => {
    setSaving(true);
    try {
      await salvarCapacidadesVeiculo(rows);
      toast.success("Capacidades de veículos salvas.");
    } catch (e: unknown) {
      toast.error("Erro ao salvar capacidades: " + (e instanceof Error ? e.message : "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> Capacidade dos Veículos</CardTitle>
        <CardDescription>
          Parâmetros por tipo/configuração usados na recomendação do Orçamento. Os valores padrão derivam do cadastro do sistema
          (<code>VEICULO_PARAMETROS</code>) e podem ser ajustados. Campos em branco/0 significam <strong>não parametrizado</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            A cubagem útil e as dimensões são base para o motor de compatibilidade (peso, cubagem, dimensão individual, pallets e refrigeração).
            Capacidade de pallets e refrigeração só são usadas quando efetivamente parametrizadas — nada é presumido.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Carregando capacidades...
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Configuração</TableHead>
                  <TableHead className="text-right">Peso máx (kg)</TableHead>
                  <TableHead className="text-right">Comp. útil (cm)</TableHead>
                  <TableHead className="text-right">Larg. útil (cm)</TableHead>
                  <TableHead className="text-right">Alt. útil (cm)</TableHead>
                  <TableHead className="text-right">Cubagem útil (m³)</TableHead>
                  <TableHead className="text-right">Pallets</TableHead>
                  <TableHead>Refrigerado</TableHead>
                  <TableHead>Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.tipo}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {r.label}
                      {r.fonte && <span className="block text-[10px] text-muted-foreground">{r.fonte}</span>}
                    </TableCell>
                    <TableCell><Input className="h-8 w-36" value={r.configuracao || ""} placeholder="ex.: baú, sider" onChange={(e) => update(i, { configuracao: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-24 text-right" value={r.capacidadeKg || ""} onChange={(e) => update(i, { capacidadeKg: Number(e.target.value) || 0 })} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 text-right" value={r.comprimentoUtilCm || ""} onChange={(e) => update(i, { comprimentoUtilCm: Number(e.target.value) || 0 })} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 text-right" value={r.larguraUtilCm || ""} onChange={(e) => update(i, { larguraUtilCm: Number(e.target.value) || 0 })} /></TableCell>
                    <TableCell><Input type="number" className="h-8 w-20 text-right" value={r.alturaUtilCm || ""} onChange={(e) => update(i, { alturaUtilCm: Number(e.target.value) || 0 })} /></TableCell>
                    <TableCell><Input type="number" step="0.1" className="h-8 w-24 text-right" value={r.cubagemUtilM3 || ""} onChange={(e) => update(i, { cubagemUtilM3: Number(e.target.value) || 0 })} /></TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="h-8 w-20 text-right"
                        placeholder="—"
                        value={r.capacidadePallets ?? ""}
                        onChange={(e) => update(i, { capacidadePallets: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.refrigerado === null || r.refrigerado === undefined ? NAO_PARAM : r.refrigerado ? "sim" : "nao"}
                        onValueChange={(v) => update(i, { refrigerado: v === NAO_PARAM ? null : v === "sim" })}
                      >
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NAO_PARAM}>Não parametrizado</SelectItem>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`cursor-pointer text-[10px] ${r.ativo !== false ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500"}`}
                        onClick={() => update(i, { ativo: r.ativo === false })}
                      >
                        {r.ativo !== false ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading || saving}>
            <RefreshCw className="w-4 h-4 mr-1" /> Recarregar
          </Button>
          <Button className="bg-primary" onClick={salvar} disabled={loading || saving}>
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar capacidades
          </Button>
        </div>
        <Label className="text-[11px] text-muted-foreground block">
          Decisão arquitetural (backlog Fracionado): esta capacidade alimenta o motor de compatibilidade local e poderá ser
          reutilizada por providers/adapters (TabelaPrópria, ParceiroApi, PlataformaFrete, Manual) sem acoplar a um fornecedor específico (ex.: Frenet = um adapter).
        </Label>
      </CardContent>
    </Card>
  );
}
