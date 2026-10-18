import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save, Users, FileText, CalendarClock, Mail, FileWarning, Landmark, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { supabase } from "@/lib/supabase";
import {
  buscarRegrasFinanceirasCliente,
  salvarRegrasFinanceirasCliente,
  REGRAS_FINANCEIRAS_DEFAULT,
  type RegrasFinanceirasCliente,
} from "@/services/financeiro/configFinanceiraService";

export function RegrasFinanceirasClienteTab() {
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [regras, setRegras] = useState<RegrasFinanceirasCliente>({ ...REGRAS_FINANCEIRAS_DEFAULT });
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregarRegras = useCallback(async (id: string) => {
    setLoading(true);
    const r = await buscarRegrasFinanceirasCliente(id);
    setRegras(r);
    setLoading(false);
  }, []);

  const handleClienteChange = async (value: string | null, record: Record<string, unknown> | null) => {
    setClienteId(value || "");
    setClienteNome(record?.nome_fantasia ? String(record.nome_fantasia) : record?.razao_social ? String(record.razao_social) : "");
    setMsg(null);
    if (value) await carregarRegras(value);
  };

  const handleSalvar = async () => {
    if (!clienteId) { setMsg("Selecione um cliente."); return; }
    setSalvando(true);
    setMsg(null);
    const res = await salvarRegrasFinanceirasCliente(clienteId, regras);
    setSalvando(false);
    setMsg(res.success ? "Regras financeiras do cliente salvas." : res.error || "Erro ao salvar");
  };

  const set = (campo: keyof RegrasFinanceirasCliente, valor: unknown) => {
    setRegras((prev) => ({ ...prev, [campo]: valor }));
  };

  const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 border-b">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-[#F97316]" /> Regras Financeiras por Cliente
          </CardTitle>
          <CardDescription className="text-[11px]">
            Modelo de fatura, Romaneio obrigatório, vencimento, e-mail financeiro e demais regras específicas.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground">Cliente</Label>
            <SearchableSelect
              table="clientes"
              labelField="nome_fantasia"
              valueField="id"
              returnField="id"
              secondaryField="cnpj"
              searchFields={["nome_fantasia", "razao_social", "cnpj"]}
              value={clienteId}
              onChange={handleClienteChange}
              placeholder="Selecione o cliente..."
            />
            {clienteNome && <p className="text-[11px] text-slate-500">Configurando: <strong>{clienteNome}</strong></p>}
          </div>

          {clienteId && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <Campo label="Modelo de Fatura Padrão">
                <Select value={regras.modeloFaturaPadrao} onValueChange={(v) => set("modeloFaturaPadrao", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conexao_express">Padrão Conexão Express</SelectItem>
                    <SelectItem value="calvo">Modelo do cliente (consolidado)</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Exige Romaneio/OC para faturamento?">
                <Select value={regras.exigeRomaneioOC ? "sim" : "nao"} onValueChange={(v) => set("exigeRomaneioOC", v === "sim")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Prazo de pagamento (dias)">
                <Input className="h-9 text-xs" type="number" value={regras.prazoPagamentoDias ?? ""} onChange={(e) => set("prazoPagamentoDias", e.target.value ? Number(e.target.value) : null)} placeholder="Ex.: 15, 30" />
              </Campo>
              <Campo label="Dia fixo de vencimento (opcional)">
                <Input className="h-9 text-xs" type="number" min={1} max={31} value={regras.diaFixo ?? ""} onChange={(e) => set("diaFixo", e.target.value ? Number(e.target.value) : null)} placeholder="Ex.: 15" />
              </Campo>
              <Campo label="Período de fechamento">
                <Select value={regras.periodoFechamento || "nao"} onValueChange={(v) => set("periodoFechamento", v === "nao" ? null : v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não se aplica</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Exige aprovação antes de emitir?">
                <Select value={regras.exigeAprovacao ? "sim" : "nao"} onValueChange={(v) => set("exigeAprovacao", v === "sim")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="E-mail Financeiro (faturamento)">
                <Input className="h-9 text-xs" value={regras.emailFinanceiro} onChange={(e) => set("emailFinanceiro", e.target.value)} placeholder="financeiro@cliente.com.br" />
              </Campo>
              <Campo label="Documento Fiscal Esperado">
                <Select value={regras.tipoDocumentoFiscalEsperado} onValueChange={(v) => set("tipoDocumentoFiscalEsperado", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum / não definido</SelectItem>
                    <SelectItem value="CT-e">CT-e</SelectItem>
                    <SelectItem value="NFS-e">NFS-e</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Observação padrão da Fatura">
                <Input className="h-9 text-xs" value={regras.observacaoPadrao} onChange={(e) => set("observacaoPadrao", e.target.value)} placeholder="Referente aos romaneios nº ..." />
              </Campo>
              <Campo label="Instruções especiais">
                <Input className="h-9 text-xs" value={regras.instrucoesEspeciais} onChange={(e) => set("instrucoesEspeciais", e.target.value)} />
              </Campo>
            </div>
          )}

          {clienteId && (
            <div className="flex justify-end">
              <Button size="sm" className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C]" onClick={handleSalvar} disabled={salvando}>
                {salvando ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar Regras
              </Button>
            </div>
          )}

          {msg && <p className={`text-xs ${msg.includes("sucesso") ? "text-emerald-600" : "text-red-600"}`}>{msg}</p>}
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Regras persistidas em <code>configuracoes_sistema</code> (chave por cliente). Nenhuma migration executada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegrasFinanceirasClienteTab;
