import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Landmark, RefreshCw, Save, Pencil, Ban, Plus, Building2, Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  buscarConfigFonte,
  salvarConfigFinanceiraEmpresa,
  buscarContasBancariasConfig,
  salvarContasBancariasConfig,
  type ConfigFinanceiraEmpresa,
  type ContaBancariaFinanceira,
} from "@/services/financeiro/configFinanceiraService";

const EMPRESA_VAZIA: ConfigFinanceiraEmpresa = {
  razaoSocial: "", nomeFantasia: "Conexão Express", cnpj: "", ie: "",
  inscricaoMunicipal: "", endereco: "", cidade: "", uf: "",
  telefone: "", email: "",
  emailFinanceiro: "financeiro@conexaoexpress.com.br",
  logoClaro: "/logos/logo-conexao-branco.png", logoColorido: "/logos/logo-conexao-colorido.png",
  banco: "", codigoBanco: "", agencia: "", conta: "", digito: "",
  tipoConta: "Conta Corrente", pix: "", beneficiario: "", beneficiarioCnpj: "",
};

const CONTA_VAZIA: ContaBancariaFinanceira = {
  id: "", nome: "", banco: "", codigoBanco: "", agencia: "", conta: "",
  digito: "", pix: "", titular: "", titularCnpj: "", tipo: "Conta Corrente",
  ativa: true, principal: false,
};

// Campo extraído para o escopo do módulo para evitar remount a cada render do
// pai (antes, Campo era definido DENTRO de ConfigFinanceira — um novo type a
// cada render fazia React desmontar/remontar o input, perdendo o foco).
function Campo({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input className="h-9 text-xs" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export const ConfigFinanceira = React.memo(function ConfigFinanceira() {
  const [empresa, setEmpresa] = useState<ConfigFinanceiraEmpresa>({ ...EMPRESA_VAZIA });
  const [contas, setContas] = useState<ContaBancariaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fonteDados, setFonteDados] = useState<"supabase" | "local">("supabase");
  const [editandoConta, setEditandoConta] = useState<ContaBancariaFinanceira | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const carregar = useCallback(async () => {
    if (mountedRef.current) setLoading(true);
    const [empResult, cts] = await Promise.all([buscarConfigFonte(), buscarContasBancariasConfig()]);
    if (!mountedRef.current) return;
    setEmpresa(empResult.empresa);
    setFonteDados(empResult.fonte);
    setContas(cts);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleSalvarEmpresa = async () => {
    if (salvando) return;
    setSalvando(true);
    setMsg(null);
    const res = await salvarConfigFinanceiraEmpresa(empresa);
    if (!mountedRef.current) return;
    setSalvando(false);
    setMsg(res.success ? "Configurações financeiras salvas com sucesso." : res.error || "Erro ao salvar");
  };

  const handleSalvarContas = async () => {
    if (salvando) return;
    setSalvando(true);
    setMsg(null);
    const res = await salvarContasBancariasConfig(contas);
    if (!mountedRef.current) return;
    if (res.success) {
      // refetch: substitui IDs temporarios pelos UUIDs reais gravados
      await carregar();
      if (mountedRef.current) setMsg("Contas bancárias salvas.");
    } else {
      setMsg(res.error || "Erro ao salvar");
    }
    if (mountedRef.current) setSalvando(false);
  };

  const handleAddConta = () => {
    const nova: ContaBancariaFinanceira = { ...CONTA_VAZIA, id: `c-${Date.now()}`, nome: `Conta ${contas.length + 1}` };
    setContas((prev) => [...prev, nova]);
    setEditandoConta(nova);
  };

  const handleRemoveConta = (id: string) => {
    setContas((prev) => prev.filter((c) => c.id !== id));
  };

  const updateConta = (id: string, campo: keyof ContaBancariaFinanceira, valor: unknown) => {
    setContas((prev) => prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
  };

  const setCampoEmpresa = (campo: keyof ConfigFinanceiraEmpresa, valor: string) => {
    setEmpresa((prev) => ({ ...prev, [campo]: valor }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Carregando configurações financeiras...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fonteDados === "local" && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
          <Ban className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>Aviso de persistência:</strong> Os dados foram carregados do armazenamento local (localStorage).
            O Supabase não está acessível — as alterações salvas NÃO serão persistidas no servidor.
          </div>
        </div>
      )}
      <Card>
        <CardHeader className="py-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#F97316]" /> Configurações Financeiras da Conexão Express
              </CardTitle>
              <CardDescription className="text-[11px]">
                Fonte oficial para fatura, boleto futuro, relatórios e cobrança. Salvas em configuracoes_sistema.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={carregar}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Recarregar</Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Campo label="Razão Social" value={empresa.razaoSocial} onChange={(v) => setCampoEmpresa("razaoSocial", v)} />
            <Campo label="Nome Fantasia" value={empresa.nomeFantasia} onChange={(v) => setCampoEmpresa("nomeFantasia", v)} />
            <Campo label="CNPJ" value={empresa.cnpj} onChange={(v) => setCampoEmpresa("cnpj", v)} />
            <Campo label="Inscrição Estadual (IE)" value={empresa.ie} onChange={(v) => setCampoEmpresa("ie", v)} />
            <Campo label="Inscrição Municipal (IM)" value={empresa.inscricaoMunicipal} onChange={(v) => setCampoEmpresa("inscricaoMunicipal", v)} />
            <Campo label="Endereço" value={empresa.endereco} onChange={(v) => setCampoEmpresa("endereco", v)} placeholder="Rua, número, complemento, bairro" />
            <Campo label="Cidade" value={empresa.cidade} onChange={(v) => setCampoEmpresa("cidade", v)} placeholder="São Paulo" />
            <Campo label="UF" value={empresa.uf} onChange={(v) => setCampoEmpresa("uf", v)} placeholder="SP" />
            <Campo label="Telefone" value={empresa.telefone} onChange={(v) => setCampoEmpresa("telefone", v)} />
            <Campo label="E-mail" value={empresa.email} onChange={(v) => setCampoEmpresa("email", v)} />
            <Campo label="E-mail Financeiro" value={empresa.emailFinanceiro} onChange={(v) => setCampoEmpresa("emailFinanceiro", v)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Logo Claro (header escuro)</Label>
              <Input className="h-9 text-xs" value={empresa.logoClaro} onChange={(e) => setCampoEmpresa("logoClaro", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Logo Colorido</Label>
              <Input className="h-9 text-xs" value={empresa.logoColorido} onChange={(e) => setCampoEmpresa("logoColorido", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button size="sm" className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C]" onClick={handleSalvarEmpresa} disabled={salvando}>
              {salvando ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar Dados Financeiros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#F97316]" /> Contas Bancárias
              </CardTitle>
              <CardDescription className="text-[11px]">
                Usadas no PDF de fatura (dados para pagamento). Até a criação de contas_financeiras, persistidas em configuracoes_sistema.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAddConta}><Plus className="w-3.5 h-3.5 mr-1" /> Nova Conta</Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {contas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma conta configurada. Adicione uma conta para exibir dados de pagamento na fatura.
            </p>
          ) : contas.map((c) => (
            <div key={c.id} className="rounded-lg border bg-slate-50/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-700">{c.nome || "Conta"}</span>
                  {c.principal && <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700">Principal</Badge>}
                  {!c.ativa && <Badge variant="outline" className="text-[9px] bg-slate-100 text-slate-500">Inativa</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Editar" onClick={() => setEditandoConta(c)}><Pencil className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" title="Remover" onClick={() => handleRemoveConta(c.id)}><Ban className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Campo label="Banco" value={c.banco} onChange={(v) => updateConta(c.id, "banco", v)} />
                <Campo label="Agência" value={c.agencia} onChange={(v) => updateConta(c.id, "agencia", v)} />
                <Campo label="Conta" value={c.conta} onChange={(v) => updateConta(c.id, "conta", v)} />
                <Campo label="Dígito" value={c.digito} onChange={(v) => updateConta(c.id, "digito", v)} />
                <Campo label="PIX" value={c.pix} onChange={(v) => updateConta(c.id, "pix", v)} />
                <Campo label="Titular" value={c.titular} onChange={(v) => updateConta(c.id, "titular", v)} />
                <Campo label="CNPJ/CPF Titular" value={c.titularCnpj} onChange={(v) => updateConta(c.id, "titularCnpj", v)} />
                <div className="flex items-end gap-2">
                  <Label className="text-[10px] text-muted-foreground pb-2">Principal</Label>
                  <input type="checkbox" className="accent-[#F97316] mb-2" checked={c.principal} onChange={(e) => updateConta(c.id, "principal", e.target.checked)} />
                  <Label className="text-[10px] text-muted-foreground pb-2">Ativa</Label>
                  <input type="checkbox" className="accent-[#F97316] mb-2" checked={c.ativa} onChange={(e) => updateConta(c.id, "ativa", e.target.checked)} />
                </div>
              </div>
            </div>
          ))}
          {contas.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C]" onClick={handleSalvarContas} disabled={salvando}>
                {salvando ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar Contas
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {msg && <p className={`text-xs px-1 ${msg.includes("sucesso") ? "text-emerald-600" : "text-red-600"}`}>{msg}</p>}
      <Separator />
      <p className="text-[10px] text-slate-400">
        Nota: quando a tabela <code>contas_financeiras</code> for criada (proposta A31), as contas migram para ela mantendo compatibilidade. Nenhuma alteração estrutural foi feita em produção.
      </p>
    </div>
  );
});

export default ConfigFinanceira;
