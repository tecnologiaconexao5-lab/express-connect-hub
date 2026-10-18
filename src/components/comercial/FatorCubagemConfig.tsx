import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Scale, Save, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  carregarRegrasFatorCubagem,
  salvarRegrasFatorCubagem,
  FATOR_CONTEXTO_PADRAO,
} from "@/services/comercial/fatorCubagemService";
import type { RegraFatorCubagem } from "@/components/comercial/cargaCalculo";

/**
 * TMS-COM-CARGA-04 — Fator de cubagem (kg/m³) parametrizável por modalidade.
 * Persistido em configuracoes_sistema['fator_cubagem_regras'] (backend).
 * Sem valor padrão inventado; precedência: modalidade → padrão geral.
 */
export default function FatorCubagemConfig() {
  const [rows, setRows] = useState<RegraFatorCubagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      setRows(await carregarRegrasFatorCubagem());
    } catch {
      toast.error("Erro ao carregar fator de cubagem.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const update = (i: number, patch: Partial<RegraFatorCubagem>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const salvar = async () => {
    setSaving(true);
    try {
      await salvarRegrasFatorCubagem(rows);
      toast.success("Fator de cubagem salvo.");
    } catch (e: unknown) {
      toast.error("Erro ao salvar: " + (e instanceof Error ? e.message : "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Scale className="w-4 h-4 text-primary" /> Fator de Cubagem (Peso Taxável)</CardTitle>
        <CardDescription>
          Regra por modalidade usada para calcular o <strong>peso cubado</strong> = cubagem × fator (kg/m³). Sem regra configurada, o peso cubado fica indisponível — nenhum valor é presumido.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Precedência: <strong>regra da modalidade</strong> → <strong>padrão geral</strong> → sem fator.
            O fator aplicado fica registrado (snapshot) no orçamento; alterações futuras aqui NÃO mudam orçamentos já emitidos.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Carregando regras...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regra / Modalidade</TableHead>
                <TableHead className="text-right">Fator (kg/m³)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const ativo = r.ativo !== false;
                const valido = Number(r.fatorKgM3) > 0;
                return (
                  <TableRow key={r.contexto}>
                    <TableCell className="font-medium">
                      {r.contexto === FATOR_CONTEXTO_PADRAO ? "Padrão geral" : r.contexto}
                      {r.contexto !== FATOR_CONTEXTO_PADRAO && <span className="block text-[10px] text-muted-foreground">modalidade</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="h-8 w-28 text-right"
                        placeholder="—"
                        value={r.fatorKgM3 || ""}
                        onChange={(e) => update(i, { fatorKgM3: Number(e.target.value) || 0 })}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`cursor-pointer text-[10px] ${ativo && valido ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ativo ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-500"}`}
                        onClick={() => update(i, { ativo: !ativo })}
                        title="Clique para ativar/desativar a regra"
                      >
                        {ativo ? (valido ? "Ativa" : "Ativa sem valor") : "Inativa"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={carregar} disabled={loading || saving}>
            <RefreshCw className="w-4 h-4 mr-1" /> Recarregar
          </Button>
          <Button className="bg-primary" onClick={salvar} disabled={loading || saving}>
            {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar fator
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
