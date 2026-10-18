import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useFormExitGuard } from "@/hooks/useFormExitGuard";
import {
  Plus, Search, Filter, X, Check, AlertCircle,
  FileText, ArrowUpRight, RefreshCw, MoreHorizontal, Download, Eye,
  Split, Repeat, TrendingDown, User, Building2,
  AlertTriangle, Clock, CheckCircle2, DollarSign, Wallet
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PaginationBar from "@/components/ui/PaginationBar";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { criarPagavel, atualizarPagavel, baixarPagavel, cancelarPagavel, criarParcelasPagavel } from "@/services/financeiro/pagarService";
import { calcularStatusEfetivo, statusEfetivoLabel, statusEfetivoClasses, hojeSP, type StatusEfetivo } from "@/helpers/statusVencimento";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ParcelaPagar {
  id: number;
  despesaId: number;
  numero: number;
  totalParcelas: number;
  vencimento: string;
  dataPrevistaPgto: string;
  valorOriginal: number;
  desconto: number;
  multa: number;
  juros: number;
  impostosRetidos: number;
  valorLiquido: number;
  status: "a_vencer" | "vencida" | "paga" | "parcial" | "provisao" | "cancelada";
  dataBaixa?: string;
  valorBaixado?: number;
  contaPagadora?: string;
}

interface LancamentoPagar {
  id: string | number;
  // Identificação
  favorecidoNome: string;
  favorecidoCnpjCpf: string;
  isLegadoPrestador?: boolean;
  fornecedorCadastroId?: string;   // FIN-FORN-03: FK para fornecedores
  documentoNF: string;
  tipoDocumento: string; // NF, Fatura, Recibo, Boleto, Guia
  // Classificação
  categoria: string;
  planoContas: string;
  centroResultado: string;
  unidadeFilial: string;
  despesaFixaBase: "Fixa" | "Variável";
  // Datas
  competencia: string;
  emissao: string;
  vencimento: string;
  dataPrevistaPgto: string;
  // Valores
  valorOriginal: number;
  desconto: number;
  multa: number;
  juros: number;
  impostosRetidos: number;
  valorLiquido: number;
  // Pagamento
  formaPagamento: string;
  codigoBarras: string;
  chavePix: string;
  contaPagadora: string;
  dataEfetivaPgto?: string;
  dataPagamento?: string;
  status: "a_vencer" | "vencida" | "paga" | "parcial" | "provisao" | "cancelada";
  statusEfetivo: StatusEfetivo;
  recorrencia: string;
  observacoes: string;
  parcelas: ParcelaPagar[];
}

interface FiltrosAvancados {
  status: string;
  centroResultado: string;
  categoria: string;
  dataInicio: string;
  dataFim: string;
  vencimentoInicio: string;
  vencimentoFim: string;
  contaPagadora: string;
  fornecedor: string;
  ordenacao: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// FIN-UX-02B — tamanho de página profissional, consistente com o financeiro (25).
const PAGE_SIZE_PAGAR = 25;
const fmtData = (s: string) => {
  if (!s) return "—";
  try { return new Date(s + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return s; }
};
const hoje = () => new Date().toISOString().split("T")[0];
const gerarId = () => Date.now() + Math.floor(Math.random() * 1000);

const mapStatusPagar = (s: string): LancamentoPagar["status"] => {
  const map: Record<string, LancamentoPagar["status"]> = {
    "a vencer": "a_vencer", "a_vencer": "a_vencer", "pendente": "a_vencer",
    "vencida": "vencida", "vencido": "vencida",
    "paga": "paga", "pago": "paga",
    "parcial": "parcial",
    "provisao": "provisao",
    "cancelada": "cancelada", "cancelado": "cancelada",
  };
  return map[s?.toLowerCase()] ?? "a_vencer";
};

const calcLiquidoPagar = (orig: number, desc: number, mult: number, jur: number, imp: number) =>
  Math.max(0, orig - (desc || 0) + (mult || 0) + (jur || 0) - (imp || 0));

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  provisao: { label: "Provisão", cls: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300", icon: FileText },
  a_vencer: { label: "A Vencer", cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300", icon: Clock },
  vencida:  { label: "Atrasado", cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300",   icon: AlertTriangle },
  paga:     { label: "Pago",     cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  parcial:  { label: "Parcial",  cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300", icon: TrendingDown },
  cancelada:{ label: "Cancelado",cls: "bg-gray-100 text-gray-500 border-gray-200", icon: X },
};

const StatusBadge = ({ status, statusEfetivo }: { status: string; statusEfetivo?: StatusEfetivo }) => {
  const se = statusEfetivo || "desconhecido";
  const label = statusEfetivoLabel(se);
  const cls = statusEfetivoClasses(se);
  const iconMap: Record<string, React.ElementType> = {
    atrasado: AlertTriangle,
    vence_hoje: Clock,
    a_vencer: Clock,
    pago: CheckCircle2,
    parcial: TrendingDown,
    provisao: FileText,
    cancelado: X,
    renegociado: TrendingDown,
    desconhecido: FileText,
  };
  const Icon = iconMap[se] || FileText;
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 gap-1 ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </Badge>
  );
};

// ─── Formulário em branco ─────────────────────────────────────────────────────

const FORM_BLANK: Omit<LancamentoPagar, "id" | "parcelas"> = {
  favorecidoNome: "", favorecidoCnpjCpf: "", fornecedorCadastroId: "", documentoNF: "", tipoDocumento: "NF",
  categoria: "", planoContas: "", centroResultado: "Corporativo", unidadeFilial: "Matriz (SP)",
  despesaFixaBase: "Variável",
  competencia: "", emissao: hoje(), vencimento: "", dataPrevistaPgto: "",
  valorOriginal: 0, desconto: 0, multa: 0, juros: 0, impostosRetidos: 0, valorLiquido: 0,
  formaPagamento: "Boleto", codigoBarras: "", chavePix: "", contaPagadora: "Conta Corrente Principal",
  status: "a_vencer", recorrencia: "nenhuma", observacoes: "",
};

const FILTROS_BLANK: FiltrosAvancados = {
  status: "todos", centroResultado: "", categoria: "",
  dataInicio: "", dataFim: "", vencimentoInicio: "", vencimentoFim: "", contaPagadora: "",
  fornecedor: "", ordenacao: "vencimento_asc",
};

// ─── Autocomplete Fornecedor (FIN-FORN-03) ────────────────────────────────────

interface FornecedorOption {
  id: string;
  nome: string;
  documento: string;
  fantasia?: string;
  fornecedor_cadastro_id: string;
}

interface FornecedorAutocompleteProps {
  value: string;
  onSelect: (f: FornecedorOption) => void;
  onNovoCadastro?: () => void;
  error?: string;
}

function FornecedorAutocomplete({ value, onSelect, onNovoCadastro, error }: FornecedorAutocompleteProps) {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<FornecedorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(value); }, [value]);

  useEffect(() => {
    if (!input.trim() || input.trim().length < 2) { setOptions([]); return; }
    setLoading(true);
    supabase.from("fornecedores")
      .select("id, razao_social, nome_fantasia, cpf_cnpj")
      .eq("status", "ativo")
      .or(`razao_social.ilike.%${input}%,nome_fantasia.ilike.%${input}%,cpf_cnpj.ilike.%${input}%`)
      .limit(10)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) { console.error("Erro ao buscar fornecedores:", error); setOptions([]); return; }
        setOptions((data || []).map((f: any) => ({
          id: f.razao_social,
          nome: f.razao_social,
          fantasia: f.nome_fantasia || "",
          documento: f.cpf_cnpj || "",
          fornecedor_cadastro_id: f.id,
        })));
      });
  }, [input]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (f: FornecedorOption) => {
    onSelect(f);
    setInput(f.fantasia ? `${f.nome} (${f.fantasia})` : f.nome);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <Building2 className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar fornecedor por nome, fantasia ou CPF/CNPJ"
          className={`pl-9 h-10 ${onNovoCadastro ? "pr-10" : ""} ${error ? "border-red-400 focus-visible:ring-red-300" : ""}`}
        />
        {onNovoCadastro && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            onClick={e => { e.stopPropagation(); onNovoCadastro(); }}
            title="Cadastrar novo fornecedor"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      {open && (options.length > 0 || loading) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-xl shadow-xl overflow-hidden">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>}
          {!loading && options.length === 0 && input.trim().length >= 2 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum fornecedor encontrado</div>
          )}
          {options.map(f => (
            <button
              key={f.fornecedor_cadastro_id}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/70 transition-colors"
              onMouseDown={e => { e.preventDefault(); handleSelect(f); }}
            >
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-3.5 h-3.5 text-orange-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{f.nome}</p>
                <div className="flex items-center gap-2">
                  {f.fantasia && <p className="text-xs text-muted-foreground truncate">{f.fantasia}</p>}
                  {f.documento && <p className="text-xs text-muted-foreground font-mono">{f.documento}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal Cadastro Rápido Fornecedor (FIN-FORN-03) ──────────────────────────

interface CadastroRapidoFornecedorProps {
  open: boolean;
  onClose: () => void;
  onSalvo: (f: FornecedorOption) => void;
}

function CadastroRapidoFornecedor({ open, onClose, onSalvo }: CadastroRapidoFornecedorProps) {
  const [tipoPessoa, setTipoPessoa] = useState<"PF" | "PJ">("PJ");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (open) {
      setTipoPessoa("PJ"); setRazaoSocial(""); setNomeFantasia("");
      setCpfCnpj(""); setTelefone(""); setErro("");
    }
  }, [open]);

  const handleSalvar = async () => {
    if (!razaoSocial.trim()) { setErro("Razão social / nome é obrigatório"); return; }
    if (!cpfCnpj.trim()) { setErro("CPF/CNPJ é obrigatório"); return; }
    setSaving(true); setErro("");
    try {
      const { data: existente } = await supabase.from("fornecedores")
        .select("id, razao_social, nome_fantasia, cpf_cnpj, status")
        .eq("cpf_cnpj", cpfCnpj.trim())
        .eq("status", "ativo")
        .maybeSingle();
      if (existente) {
        toast.info(`Fornecedor já cadastrado: ${existente.razao_social}`);
        onSalvo({
          id: existente.razao_social,
          nome: existente.razao_social,
          fantasia: existente.nome_fantasia || "",
          documento: existente.cpf_cnpj || "",
          fornecedor_cadastro_id: existente.id,
        });
        onClose();
        return;
      }
      const { data: duplicado } = await supabase.from("fornecedores")
        .select("id, razao_social, nome_fantasia, cpf_cnpj")
        .eq("cpf_cnpj", cpfCnpj.trim())
        .in("status", ["ativo", "inativo"])
        .maybeSingle();
      if (duplicado) {
        setErro(`CPF/CNPJ já possui cadastro (${duplicado.razao_social}) — selecione-o na busca`);
        setSaving(false);
        return;
      }
      const { data: novo, error: insertErr } = await supabase.from("fornecedores").insert({
        tipo_pessoa: tipoPessoa,
        razao_social: razaoSocial.trim(),
        nome_fantasia: nomeFantasia.trim() || null,
        cpf_cnpj: cpfCnpj.trim(),
        telefone: telefone.trim() || null,
        status: "ativo",
      }).select("id, razao_social, nome_fantasia, cpf_cnpj").maybeSingle();
      if (insertErr) {
        console.error("Erro ao cadastrar fornecedor:", insertErr);
        setErro("Erro ao salvar: " + (insertErr.message || "verifique os dados"));
        setSaving(false);
        return;
      }
      if (novo) {
        toast.success(`Fornecedor "${novo.razao_social}" cadastrado com sucesso!`);
        onSalvo({
          id: novo.razao_social,
          nome: novo.razao_social,
          fantasia: novo.nome_fantasia || "",
          documento: novo.cpf_cnpj || "",
          fornecedor_cadastro_id: novo.id,
        });
        onClose();
      }
    } catch (err) {
      console.error("Erro inesperado ao cadastrar fornecedor:", err);
      setErro("Erro inesperado. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <div className="p-1 bg-orange-100 rounded-lg"><Plus className="w-3.5 h-3.5 text-orange-600" /></div>
            Cadastro Rápido — Fornecedor
          </DialogTitle>
          <DialogDescription>Preencha os dados básicos. Campos com * são obrigatórios.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Tipo <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={tipoPessoa === "PJ" ? "default" : "outline"} className={tipoPessoa === "PJ" ? "bg-orange-600 hover:bg-orange-700" : ""} onClick={() => setTipoPessoa("PJ")}>Pessoa Jurídica</Button>
              <Button type="button" size="sm" variant={tipoPessoa === "PF" ? "default" : "outline"} className={tipoPessoa === "PF" ? "bg-orange-600 hover:bg-orange-700" : ""} onClick={() => setTipoPessoa("PF")}>Pessoa Física</Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">{tipoPessoa === "PJ" ? "Razão Social" : "Nome Completo"} <span className="text-red-500">*</span></Label>
            <Input value={razaoSocial} onChange={e => { setRazaoSocial(e.target.value); setErro(""); }} placeholder={tipoPessoa === "PJ" ? "Empresa Exemplo LTDA" : "João da Silva"} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Nome Fantasia</Label>
            <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Opcional" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">{tipoPessoa === "PJ" ? "CNPJ" : "CPF"} <span className="text-red-500">*</span></Label>
            <Input value={cpfCnpj} onChange={e => { setCpfCnpj(e.target.value); setErro(""); }} placeholder={tipoPessoa === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"} className="h-9 font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide">Telefone</Label>
            <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="h-9" />
          </div>
          {erro && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erro}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-9" disabled={saving}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white h-9">
            {saving ? "Salvando..." : <><Check className="w-4 h-4 mr-1" /> Salvar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal de Baixa de Pagamento ──────────────────────────────────────────────

interface ModalBaixaPagarProps {
  lancamento: LancamentoPagar;
  onConfirm: (id: string | number, tipo: "total" | "parcial", valor: number, conta: string, forma: string, obs: string, data: string, contaId?: string) => void;
  onClose: () => void;
}

function ModalBaixaPagar({ lancamento, onConfirm, onClose }: ModalBaixaPagarProps) {
  const [tipoBaixa, setTipoBaixa] = useState<"total" | "parcial">("total");
  const [valorBaixar, setValorBaixar] = useState(lancamento.valorLiquido);
  const [conta, setConta] = useState(lancamento.contaPagadora || "Conta Corrente Principal");
  const [contaId, setContaId] = useState<string | undefined>(undefined);
  const [forma, setForma] = useState(lancamento.formaPagamento || "PIX");
  const [obs, setObs] = useState("");
  const [dataBaixa, setDataBaixa] = useState(hoje());
  const [loading, setLoading] = useState(false);
  const [contasDisponiveis, setContasDisponiveis] = useState<{ id: string; nome: string }[]>([]);

  // FIN-MASTER-361 — carregar contas_financeiras reais
  useEffect(() => {
    const loadContas = async () => {
      const { data } = await supabase
        .from("contas_financeiras")
        .select("id, nome")
        .eq("ativa", true)
        .order("nome");
      if (data) setContasDisponiveis(data);
    };
    loadContas();
  }, []);

  const handleConfirm = async () => {
    if (!valorBaixar || valorBaixar <= 0) { toast.error("Informe um valor válido."); return; }
    if (valorBaixar > lancamento.valorLiquido) { toast.error("Valor não pode ser maior que o saldo a pagar."); return; }
    setLoading(true);
    try {
      await onConfirm(lancamento.id, tipoBaixa, valorBaixar, conta, forma, obs, dataBaixa, contaId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          Registrar Pagamento
        </DialogTitle>
        <DialogDescription>
          {lancamento.documentoNF || "Sem Doc"} · {lancamento.favorecidoNome}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
          <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">Valor a Pagar</p>
          <p className="text-2xl font-black text-orange-700 dark:text-orange-400 mt-0.5">{fmtBRL(lancamento.valorLiquido)}</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Pagamento</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["total", "parcial"] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipoBaixa(t); setValorBaixar(t === "total" ? lancamento.valorLiquido : 0); }}
                className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                  tipoBaixa === t
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-card border-border text-muted-foreground hover:border-emerald-400"
                }`}
              >
                {t === "total" ? "Pgto Total" : "Pgto Parcial"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Pago (R$) *</Label>
          <Input
            type="number" min="0.01" step="0.01"
            value={valorBaixar || ""}
            onChange={e => setValorBaixar(Number(e.target.value))}
            disabled={tipoBaixa === "total"}
            className="h-10 font-bold font-mono text-emerald-700 dark:text-emerald-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data Efetiva</Label>
            <Input type="date" value={dataBaixa} onChange={e => setDataBaixa(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Forma de Pgto</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="Boleto">Boleto</SelectItem>
                <SelectItem value="Transferência / TEF">Transf / TEF</SelectItem>
                <SelectItem value="Cartão de Crédito">Cartão Crédito</SelectItem>
                <SelectItem value="Dinheiro Espécie">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conta Pagadora</Label>
          <Select value={conta} onValueChange={v => {
            setConta(v);
            const encontrada = contasDisponiveis.find(c => c.nome === v);
            setContaId(encontrada?.id);
          }}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {contasDisponiveis.length > 0 ? (
                contasDisponiveis.map(c => (
                  <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="Conta Corrente Principal">C/C Principal</SelectItem>
                  <SelectItem value="Conta Reserva / Impostos">C/C Reserva</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações do Pgto</Label>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Comprovante salvo, NSU..." className="resize-none h-16" />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} className="h-10">Cancelar</Button>
        <Button onClick={handleConfirm} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6 font-semibold">
          {loading
            ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Registrando...</span>
            : <><Check className="w-4 h-4 mr-1.5" />Confirmar Pagamento</>}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContasPagar() {
  const [lancamentos, setLancamentos] = useState<LancamentoPagar[]>([]);
  const [showNovo, setShowNovo] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [editando, setEditando] = useState<LancamentoPagar | null>(null);
  const [baixando, setBaixando] = useState<LancamentoPagar | null>(null);
  const [buscaRapida, setBuscaRapida] = useState("");
  const [filtros, setFiltros] = useState<FiltrosAvancados>({ ...FILTROS_BLANK });
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosAvancados>({ ...FILTROS_BLANK });
  // FIN-UX-02B — paginação real da listagem (página atual)
  const [pagina, setPagina] = useState(1);

  const [form, setForm] = useState({ ...FORM_BLANK });
  // Guard contra perda de alterações na despesa (dirty + beforeunload + saída).
  const exitGuard = useFormExitGuard({ current: form, initial: FORM_BLANK, enabled: showNovo });
  const fechar = async () => {
    if (!(await exitGuard.confirmExit())) return;
    setShowNovo(false);
  };
  const [erros, setErros] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [gerarParcelas, setGerarParcelas] = useState(false);
  const [numParcelas, setNumParcelas] = useState(1);
  const [showCadastroFornecedor, setShowCadastroFornecedor] = useState(false);

  // ── Mês / Período ──
  const [mesOffset, setMesOffset] = useState(0);
  const mesRef = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + mesOffset);
    return d;
  }, [mesOffset]);
  const mesAtualStr = useMemo(() => {
    return mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  }, [mesRef]);
  const mesAtualCodigo = useMemo(() => {
    return mesRef.toLocaleDateString("sv-SE", { month: "numeric", year: "numeric", timeZone: "America/Sao_Paulo" }).slice(0, 7);
  }, [mesRef]);

  const valorLiquido = calcLiquidoPagar(form.valorOriginal, form.desconto, form.multa, form.juros, form.impostosRetidos);
  useEffect(() => { setForm(p => ({ ...p, valorLiquido })); }, [valorLiquido]);

  // FIN-MASTER-361 — pago no mês: fonte = financeiro_baixas (não status)
  const [pagoMesValor, setPagoMesValor] = useState(0);

  // ── Helpers de período ──
  const periodoMes = useMemo(() => {
    const y = mesRef.getFullYear();
    const m = mesRef.getMonth();
    const inicio = new Date(y, m, 1);
    const fim = new Date(y, m + 1, 0);
    return {
      inicio: inicio.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
      fim: fim.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
    };
  }, [mesRef]);

  const periodoEfetivo = useMemo(() => {
    if (filtros.dataInicio && filtros.dataFim) {
      return { inicio: filtros.dataInicio, fim: filtros.dataFim };
    }
    return periodoMes;
  }, [filtros.dataInicio, filtros.dataFim, periodoMes]);

  // ── Leitura inicial do Supabase ──
  useEffect(() => {
    fetchLancamentos();
    fetchPagoMes();
  }, [periodoEfetivo.inicio, periodoEfetivo.fim]);

  const fetchLancamentos = async () => {
    try {
      setIsSubmitting(true);
      let query = supabase
        .from("financeiro_pagar")
        .select("*")
        .eq("is_teste", false)
        .gte("data_vencimento", periodoEfetivo.inicio)
        .lte("data_vencimento", periodoEfetivo.fim);
      const { data, error } = await query.order("data_vencimento", { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        setLancamentos(data.map((r: any) => {
          const statusDb = mapStatusPagar(r.status);
          const se = calcularStatusEfetivo({
            statusPersistido: r.status,
            dataVencimento: r.data_vencimento || r.vencimento,
            dataPagamento: r.data_pagamento || r.data_baixa || r.data_efetiva_pgto,
            valorPago: r.valor_baixado,
            valorTotal: r.valor || r.valor_bruto,
          });
          return {
          id: r.id,
          favorecidoNome: r.fornecedor || "",
          favorecidoCnpjCpf: r.fornecedor_documento || "",
          isLegadoPrestador: !!(r.prestador_id || r.prestador),
          fornecedorCadastroId: r.fornecedor_cadastro_id || "",
          documentoNF: r.documento || r.fatura || "",
          tipoDocumento: r.tipo_documento || "NF",
          categoria: r.categoria || "",
          planoContas: r.plano_contas || "",
          centroResultado: r.centro_resultado || "",
          unidadeFilial: r.unidade_filial || "Matriz (SP)",
          despesaFixaBase: r.despesa_fixa_base || "Variável",
          competencia: r.competencia || "",
          emissao: r.data_emissao || "",
          vencimento: r.data_vencimento || r.vencimento || "",
          dataPrevistaPgto: r.data_previsao_pagamento || "",
          valorOriginal: r.valor || r.valor_bruto || 0,
          desconto: r.desconto || 0,
          multa: r.multa || 0,
          juros: r.juros || 0,
          impostosRetidos: r.impostos_retidos || 0,
          valorLiquido: r.valor || r.valor_liquido || 0,
          formaPagamento: r.forma_pagamento || "",
          codigoBarras: r.codigo_barras || "",
          chavePix: r.chave_pix || "",
          contaPagadora: r.conta_pagadora || "",
          dataPagamento: r.data_pagamento || r.data_baixa || null,
          status: statusDb,
          statusEfetivo: se,
          recorrencia: r.recorrencia || "nenhuma",
          observacoes: r.observacoes || "",
          parcelas: []
        }}));
      } else {
        setLancamentos([]);
      }
    } catch (error) {
      console.error("Erro ao buscar despesas do Supabase:", error);
      setLancamentos([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // FIN-MASTER-361 — pago no mês: soma baixas não estornadas do mês atual
  const fetchPagoMes = async () => {
    try {
      const mesAtual = new Date().toISOString().slice(0, 7);
      const dataInicioMes = `${mesAtual}-01`;
      const proximoMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        .toISOString().split("T")[0];

      const { data: baixasData, error: baixasError } = await supabase
        .from("financeiro_baixas")
        .select("valor_baixado, data_baixa, titulo_id")
        .eq("titulo_tabela", "financeiro_pagar")
        .eq("estornada", false)
        .gte("data_baixa", dataInicioMes)
        .lt("data_baixa", proximoMes);

      if (baixasError) throw baixasError;

      // Excluir baixas de títulos de teste
      const tituloIds = [...new Set((baixasData || []).map((b: any) => b.titulo_id).filter(Boolean))];
      let testIds = new Set<string>();
      if (tituloIds.length > 0) {
        const { data: parents } = await supabase
          .from("financeiro_pagar")
          .select("id, is_teste")
          .in("id", tituloIds);
        testIds = new Set((parents || []).filter((p: any) => p.is_teste === true).map((p: any) => p.id));
      }

      const total = (baixasData || [])
        .filter((b: any) => !testIds.has(b.titulo_id))
        .reduce((a, b) => a + (Number(b.valor_baixado) || 0), 0);
      setPagoMesValor(total);
    } catch (error) {
      console.error("[ContasPagar] Erro ao buscar pago no mês:", error);
      setPagoMesValor(0);
    }
  };

  // ── KPIs (derivados do período selecionado) ──
  const totalAPagar = lancamentos.filter(l => l.statusEfetivo === "a_vencer" || l.statusEfetivo === "vence_hoje" || l.statusEfetivo === "parcial")
    .reduce((a, l) => a + (l.valorLiquido || 0), 0);
  const totalAtrasado = lancamentos.filter(l => l.statusEfetivo === "atrasado").reduce((a, l) => a + (l.valorLiquido || 0), 0);
  const totalPagoMes = pagoMesValor;
  const totalProvisao = lancamentos.filter(l => l.statusEfetivo === "provisao").reduce((a, l) => a + (l.valorLiquido || 0), 0);
  const hojeCalc = hojeSP();
  const em7diasCalc = new Date(Date.now() + 7 * 86400000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const totalVence7 = lancamentos.filter(l =>
    (l.statusEfetivo === "a_vencer" || l.statusEfetivo === "vence_hoje" || l.statusEfetivo === "parcial") &&
    l.vencimento >= hojeCalc && l.vencimento <= em7diasCalc
  ).reduce((a, l) => a + (l.valorLiquido || 0), 0);
  const totalPrevisto = lancamentos.filter(l =>
    l.vencimento?.startsWith(mesAtualCodigo) && l.statusEfetivo !== "cancelado"
  ).reduce((a, l) => a + (l.valorLiquido || 0), 0);

  // ── Filtros ──
  const lancFiltrados = useMemo(() => {
    let result = lancamentos.filter(l => {
      const q = buscaRapida.toLowerCase();
      const passaBusca = !q || l.favorecidoNome.toLowerCase().includes(q) || l.documentoNF.toLowerCase().includes(q) || l.categoria.toLowerCase().includes(q);
      const passaStatus = !filtrosAtivos.status || filtrosAtivos.status === "todos" || l.statusEfetivo === filtrosAtivos.status;
      const passaCategoria = !filtrosAtivos.categoria || filtrosAtivos.categoria === "todos" || l.categoria === filtrosAtivos.categoria;
      const passaFornecedor = !filtrosAtivos.fornecedor || l.favorecidoNome.toLowerCase().includes(filtrosAtivos.fornecedor.toLowerCase());
      return passaBusca && passaStatus && passaCategoria && passaFornecedor;
    });
    const ord = filtrosAtivos.ordenacao || "vencimento_asc";
    result.sort((a, b) => {
      switch (ord) {
        case "vencimento_desc": return b.vencimento?.localeCompare(a.vencimento || "") || 0;
        case "valor_desc": return (b.valorLiquido || 0) - (a.valorLiquido || 0);
        case "valor_asc": return (a.valorLiquido || 0) - (b.valorLiquido || 0);
        case "vencimento_asc":
        default: return a.vencimento?.localeCompare(b.vencimento || "") || 0;
      }
    });
    return result;
  }, [lancamentos, buscaRapida, filtrosAtivos]);

  // ── FIN-UX-02B — paginação real (janela sobre o conjunto COMPLETO filtrado) ──
  // Ordem: query SQL (período) -> busca -> filtros -> ordenação (lancFiltrados)
  //        -> paginação (lancPagina) -> render. Não há cap silencioso na lista
  // (a query não usa .limit()); a página é apenas uma janela de visualização.
  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(lancFiltrados.length / PAGE_SIZE_PAGAR)),
    [lancFiltrados.length]
  );
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);
  const lancPagina = useMemo(() => {
    const inicio = (pagina - 1) * PAGE_SIZE_PAGAR;
    return lancFiltrados.slice(inicio, inicio + PAGE_SIZE_PAGAR);
  }, [lancFiltrados, pagina]);
  // Mudança de busca, filtros ou período retorna à página 1.
  useEffect(() => {
    setPagina(1);
  }, [buscaRapida, filtrosAtivos, periodoEfetivo.inicio, periodoEfetivo.fim]);

  // ── Validação ──
  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.favorecidoNome.trim()) e.fornecedor = "Favorecido é obrigatório";
    if (!form.vencimento) e.vencimento = "Vencimento é obrigatório";
    if (!form.valorOriginal || form.valorOriginal <= 0) e.valorOriginal = "Valor inválido";
    if (!form.categoria) e.categoria = "Categoria é obrigatória";
    setErros(e);
    return Object.keys(e).length === 0;
  };

// ── Salvar com persistência Supabase ──
  const handleSalvar = async () => {
    if (!validar()) { toast.error("Preencha os campos obrigatórios corretamente."); return; }
    setIsSubmitting(true);
    try {
      const sanitizeValue = (val: any) => {
        if (val === "" || val === undefined || val === null) return null;
        return val;
      };
      
      const descricao = [form.documentoNF, form.favorecidoNome].filter(Boolean).join(" - ") || "Despesa";
      const payload = {
        descricao,
        valor: valorLiquido || 0,
        fornecedor: form.favorecidoNome,
        fornecedor_documento: sanitizeValue(form.favorecidoCnpjCpf),
        fornecedor_cadastro_id: form.fornecedorCadastroId || null,
        fornecedor_nome: sanitizeValue(form.favorecidoNome),
        documento: sanitizeValue(form.documentoNF),
        tipo_documento: sanitizeValue(form.tipoDocumento),
        categoria: form.categoria,
        plano_contas: sanitizeValue(form.planoContas),
        centro_resultado: sanitizeValue(form.centroResultado),
        unidade_filial: sanitizeValue(form.unidadeFilial),
        despesa_fixa_base: sanitizeValue(form.despesaFixaBase),
        competencia: sanitizeValue(form.competencia),
        data_emissao: sanitizeValue(form.emissao),
        data_vencimento: form.vencimento,
        data_previsao_pagamento: sanitizeValue(form.dataPrevistaPgto) || form.vencimento,
        valor_bruto: form.valorOriginal || 0,
        desconto: form.desconto || 0,
        multa: form.multa || 0,
        juros: form.juros || 0,
        impostos_retidos: form.impostosRetidos || 0,
        valor_liquido: valorLiquido || 0,
        codigo_barras: sanitizeValue(form.codigoBarras),
        chave_pix: sanitizeValue(form.chavePix),
        conta_pagadora: sanitizeValue(form.contaPagadora),
        status: form.status === "a_vencer" ? "a vencer" : form.status,
        recorrente: !!form.recorrencia && form.recorrencia !== "nenhuma",
        observacoes: sanitizeValue(form.observacoes),
      };

      if (editando) {
        await atualizarPagavel(editando.id, payload);
        toast.success("Despesa atualizada com sucesso.");
      } else {
        await criarPagavel(payload);

        if (gerarParcelas && numParcelas > 1 && form.vencimento) {
          const valParcela = Math.round((valorLiquido / numParcelas) * 100) / 100;
          const base = new Date(form.vencimento + "T12:00:00");
          const parcelas = Array.from({ length: numParcelas }, (_, i) => {
            const dt = new Date(base); dt.setMonth(dt.getMonth() + i);
            return {
              valor: valParcela,
              data_vencimento: dt.toISOString().split("T")[0],
            };
          });
          await criarParcelasPagavel("temp", parcelas);
          toast.success(`${numParcelas} parcelas criadas!`);
        } else {
          toast.success("Nova despesa cadastrada!");
        }
      }
      await fetchLancamentos();
      exitGuard.markClean();
      setShowNovo(false);
      setEditando(null);
      setForm({ ...FORM_BLANK });
      setErros({});
      setGerarParcelas(false);
      setNumParcelas(1);
    } catch (error) {
      console.error("Erro ao salvar despesa no Supabase:", error);
      toast.error("Erro ao salvar despesa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Ações com persistência Supabase ──
  const handleBaixa = async (id: string | number, tipo: "total" | "parcial", valor: number, conta: string, forma: string, obs: string, data: string, contaId?: string) => {
    try {
      const lanc = lancamentos.find(l => l.id === id);
      if (!lanc) return;
      const novoStatus = tipo === "total" ? "pago" : "parcial";
      const novoValor = tipo === "parcial" ? (lanc.valorLiquido - valor) : 0;

      await baixarPagavel(id, valor, data, conta, obs, forma, undefined, contaId);
      toast.success(tipo === "total" ? "Pagamento total registrado!" : `Baixa parcial de ${fmtBRL(valor)} registrada!`);
      await Promise.all([fetchLancamentos(), fetchPagoMes()]);
    } catch (error) {
      console.error("Erro na baixa:", error);
      toast.error("Erro ao registrar pagamento.");
    }
    setBaixando(null);
  };

  const handleCancelar = async (id: string | number) => {
    if (!confirm("Tem certeza que deseja cancelar?")) return;
    try {
      await cancelarPagavel(id);
      toast.success("Documento cancelado.");
      await fetchLancamentos();
    } catch (error) {
      console.error("Erro ao cancelar:", error);
      toast.error("Erro ao cancelar.");
    }
  };

  const abrirEditar = (l: LancamentoPagar) => {
    setEditando(l);
    setForm({
      favorecidoNome: l.favorecidoNome, favorecidoCnpjCpf: l.favorecidoCnpjCpf,
      fornecedorCadastroId: l.fornecedorCadastroId || "",
      documentoNF: l.documentoNF, tipoDocumento: l.tipoDocumento,
      categoria: l.categoria, planoContas: l.planoContas, centroResultado: l.centroResultado, unidadeFilial: l.unidadeFilial,
      despesaFixaBase: l.despesaFixaBase, competencia: l.competencia, emissao: l.emissao, vencimento: l.vencimento, dataPrevistaPgto: l.dataPrevistaPgto,
      valorOriginal: l.valorOriginal, desconto: l.desconto, multa: l.multa, juros: l.juros, impostosRetidos: l.impostosRetidos, valorLiquido: l.valorLiquido,
      formaPagamento: l.formaPagamento, codigoBarras: l.codigoBarras, chavePix: l.chavePix, contaPagadora: l.contaPagadora,
      status: l.status, recorrencia: l.recorrencia, observacoes: l.observacoes,
    });
    setShowNovo(true);
  };

  const limparFiltros = () => { setFiltros({ ...FILTROS_BLANK }); setFiltrosAtivos({ ...FILTROS_BLANK }); setShowFiltros(false); };
  const aplicarFiltros = () => { setFiltrosAtivos({ ...filtros }); setShowFiltros(false); };
  const filtrosAtivosCount = [filtrosAtivos.status, filtrosAtivos.categoria, filtrosAtivos.fornecedor, filtrosAtivos.dataInicio, filtrosAtivos.dataFim].filter(v => v && v !== "todos" && v !== "").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: "Total a Pagar", value: totalAPagar, icon: ArrowUpRight, accent: "from-orange-500 to-red-500", bg: "from-orange-500 to-red-600" },
          { label: "Atrasado", value: totalAtrasado, icon: AlertTriangle, accent: "from-red-600 to-rose-700", bg: "from-red-600 to-rose-800" },
          { label: "Vence em 7 dias", value: totalVence7, icon: Clock, accent: "from-amber-400 to-amber-600", bg: "from-amber-400 to-amber-600" },
          { label: "Previsto no Mês", value: totalPrevisto, icon: DollarSign, accent: "from-blue-500 to-blue-700", bg: "from-blue-500 to-blue-700" },
          { label: "Provisões", value: totalProvisao, icon: FileText, accent: "from-slate-500 to-slate-700", bg: "from-slate-500 to-slate-800" },
          { label: "Pago no Mês", value: totalPagoMes, icon: CheckCircle2, accent: "from-emerald-500 to-green-600", bg: "from-emerald-500 to-green-700" },
        ].map(k => (
          <div key={k.label} className="relative overflow-hidden rounded-xl border bg-card shadow-sm hover:translate-y-[-2px] transition-transform p-4 flex items-center justify-between">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${k.accent}`} />
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="text-xl font-black text-foreground mt-1">{fmtBRL(k.value)}</p>
            </div>
            <div className={`p-2 rounded-xl bg-gradient-to-br ${k.bg} shadow-sm`}><k.icon className="w-4 h-4 text-white" /></div>
          </div>
        ))}
      </div>

      {/* ── Navegação por Mês ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setMesOffset(o => o - 1)}>
            <ArrowUpRight className="w-4 h-4 rotate-[-90deg]" />
          </Button>
          <span className="text-sm font-bold text-foreground min-w-[160px] text-center capitalize">{mesAtualStr}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setMesOffset(o => o + 1)}>
            <ArrowUpRight className="w-4 h-4 rotate-[90deg]" />
          </Button>
          {mesOffset !== 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => setMesOffset(0)}>
              Voltar ao mês atual
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtrosAtivos.ordenacao || "vencimento_asc"} onValueChange={v => { setFiltros({ ...filtros, ordenacao: v }); setFiltrosAtivos({ ...filtrosAtivos, ordenacao: v }); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vencimento_asc">Vencimento ↑</SelectItem>
              <SelectItem value="vencimento_desc">Vencimento ↓</SelectItem>
              <SelectItem value="valor_desc">Maior valor</SelectItem>
              <SelectItem value="valor_asc">Menor valor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Filtros Rápidos + Busca ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar favorecido, doc, NF, categoria..." value={buscaRapida} onChange={e => setBuscaRapida(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: "Todos", value: "todos" },
            { label: "Atrasados", value: "atrasado", cls: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
            { label: "Vence Hoje", value: "vence_hoje", cls: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
            { label: "A Vencer", value: "a_vencer", cls: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
            { label: "Pago", value: "pago", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
            { label: "Cancelado", value: "cancelado", cls: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100" },
          ].map(f => (
            <Button
              key={f.value}
              variant="outline"
              size="sm"
              className={`h-8 text-xs font-semibold ${(filtrosAtivos.status || "todos") === f.value ? (f.cls || "bg-orange-50 text-orange-700 border-orange-300") : "bg-transparent"}`}
              onClick={() => { setFiltros({ ...filtros, status: f.value }); setFiltrosAtivos({ ...filtrosAtivos, status: f.value }); }}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" className={`gap-2 h-9 relative ${filtrosAtivosCount ? "border-orange-500 text-orange-600 bg-orange-50" : ""}`} onClick={() => setShowFiltros(true)}>
          <Filter className="w-4 h-4" /> Filtros
          {filtrosAtivosCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-orange-600 rounded-full text-[8px] text-white flex items-center justify-center font-bold">{filtrosAtivosCount}</span>}
        </Button>
        {filtrosAtivosCount > 0 && <Button variant="ghost" size="sm" className="h-9 text-muted-foreground gap-1.5" onClick={limparFiltros}><X className="w-3.5 h-3.5" /> Limpar</Button>}
        
        <div className="ml-auto flex items-center gap-2">
          <Button className="gap-1.5 h-9 bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm" onClick={() => { setEditando(null); setForm({ ...FORM_BLANK }); setShowNovo(true); }}>
            <Plus className="w-4 h-4" /> Nova Despesa
          </Button>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="bg-muted/30">
              <TableHead className="text-[11px] font-semibold uppercase text-muted-foreground pl-5">Nº Doc</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-muted-foreground">Favorecido / Fornecedor</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-muted-foreground">Categoria</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-muted-foreground">Competência</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-muted-foreground">Vencimento</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-muted-foreground text-right pr-5">Valor</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-muted-foreground">Status</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-muted-foreground text-right pr-4">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lancFiltrados.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Nenhuma despesa localizada.</TableCell></TableRow>}
              {lancPagina.map((l) => (
                <TableRow key={l.id} className="hover:bg-muted/20 group">
                  <TableCell className="pl-5 py-3">
                    <p className="font-semibold text-sm text-orange-700 dark:text-orange-400 font-mono">{l.documentoNF || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{l.tipoDocumento}</p>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm max-w-[160px] truncate" title={l.favorecidoNome}>{l.favorecidoNome}</p>
                      {l.isLegadoPrestador && (
                        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[9px] px-1 py-0 font-bold">
                          Legado Prestador
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{l.favorecidoCnpjCpf || "—"}</p>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-[10px] font-medium max-w-[120px] truncate">{l.categoria}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{l.centroResultado}</p>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground">{l.competencia || "—"}</TableCell>
                  <TableCell className="py-3 text-sm font-medium">{fmtData(l.vencimento)}</TableCell>
                  <TableCell className="py-3 text-right pr-5 font-black text-sm">{fmtBRL(l.valorLiquido)}</TableCell>
                  <TableCell className="py-3"><StatusBadge status={l.status} statusEfetivo={l.statusEfetivo} /></TableCell>
                  <TableCell className="py-3 text-right pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => abrirEditar(l)}><Eye className="w-4 h-4 mr-2" /> Ver / Editar</DropdownMenuItem>
                        {["a_vencer", "vence_hoje", "atrasado", "provisao"].includes(l.statusEfetivo) && <DropdownMenuItem onClick={() => setBaixando(l)} className="text-emerald-700"><CheckCircle2 className="w-4 h-4 mr-2" /> Registrar Pagamento</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        {!["pago", "cancelado"].includes(l.statusEfetivo) && <DropdownMenuItem onClick={() => handleCancelar(l.id)} className="text-red-600"><X className="w-4 h-4 mr-2" /> Cancelar</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* FIN-UX-02B — paginação real, numerada e visível (padrão do sistema) */}
          <div className="px-4 pb-4 border-t border-slate-100">
            <PaginationBar
              page={pagina}
              pageSize={PAGE_SIZE_PAGAR}
              totalCount={lancFiltrados.length}
              onPageChange={setPagina}
              loading={isSubmitting}
            />
          </div>
        </CardContent>
      </Card>

      {/* MODAL CADASTRAR/EDITAR DESPESA ── */}
      <Dialog open={showNovo} onOpenChange={open => !open && fechar()}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-orange-100 rounded-lg"><ArrowUpRight className="w-4 h-4 text-orange-600" /></div>
              {editando ? "Editar Despesa — Contas a Pagar" : "Lançar Despesa — Contas a Pagar"}
            </DialogTitle>
            <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3">
             {/* Esquerda */}
             <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide">Fornecedor / Favorecido <span className="text-red-500">*</span></Label>
                  <FornecedorAutocomplete
                    value={form.favorecidoNome}
                    onSelect={f => {
                      setForm({
                        ...form,
                        favorecidoNome: f.nome,
                        favorecidoCnpjCpf: f.documento,
                        fornecedorCadastroId: f.fornecedor_cadastro_id,
                      });
                      setErros({ ...erros, fornecedor: "" });
                    }}
                    onNovoCadastro={() => setShowCadastroFornecedor(true)}
                    error={erros.fornecedor}
                  />
                  {form.fornecedorCadastroId && (
                    <p className="text-[10px] text-orange-600 flex items-center gap-1 mt-0.5">
                      <Check className="w-3 h-3" /> Fornecedor do cadastro vinculado
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                     <Label className="text-xs uppercase tracking-wide">Documento / NF</Label>
                     <Input value={form.documentoNF} onChange={e => setForm({...form, documentoNF: e.target.value})} placeholder="NF-1234" className="h-10 font-mono" />
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-xs uppercase tracking-wide">Tipo de Doc</Label>
                     <Select value={form.tipoDocumento} onValueChange={v => setForm({...form, tipoDocumento: v})}>
                       <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="NF">Nota Fiscal (NF)</SelectItem>
                         <SelectItem value="Fatura">Fatura</SelectItem>
                         <SelectItem value="Recibo">Recibo</SelectItem>
                         <SelectItem value="Boleto">Apenas Boleto</SelectItem>
                         <SelectItem value="Guia Imposto">Guia de Imposto</SelectItem>
                         <SelectItem value="Sem Comprovante">Sem Comprovante</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                     <Label className="text-xs uppercase tracking-wide">Categoria <span className="text-red-500">*</span></Label>
                     <Select value={form.categoria} onValueChange={v => { setForm({...form, categoria: v}); setErros({...erros, categoria: ""}); }}>
                       <SelectTrigger className={`h-10 ${erros.categoria ? "border-red-400" : ""}`}><SelectValue placeholder="Selecione" /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="Combustível frota própria">Combustível</SelectItem>
                         <SelectItem value="Manutenção">Manutenção Veicular</SelectItem>
                         <SelectItem value="Energia elétrica">Energia elétrica</SelectItem>
                         <SelectItem value="Aluguel">Aluguel Imóvel</SelectItem>
                         <SelectItem value="Folha de Pagamento">Folha Pgto / Pró-labore</SelectItem>
                         <SelectItem value="Impostos Federais">Impostos Federais</SelectItem>
                         <SelectItem value="Outros">Outras Despesas</SelectItem>
                       </SelectContent>
                     </Select>
                     {erros.categoria && <p className="text-xs text-red-500">{erros.categoria}</p>}
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-xs uppercase tracking-wide">Plano de Contas</Label>
                     <Input value={form.planoContas} onChange={e => setForm({...form, planoContas: e.target.value})} placeholder="Ex: 3.1.2 - Custos..." className="h-10" />
                   </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide">Competência</Label>
                    <Input value={form.competencia} onChange={e => setForm({...form, competencia: e.target.value})} placeholder="MM/AAAA" className="h-10 text-center" />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs uppercase tracking-wide">Centro de Resultado</Label>
                    <Input value={form.centroResultado} onChange={e => setForm({...form, centroResultado: e.target.value})} className="h-10" />
                  </div>
                </div>
             </div>

             {/* Direita */}
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50/50 rounded-lg border border-orange-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-orange-700">Valor Original R$ *</Label>
                    <Input type="number" min="0.01" step="0.01" value={form.valorOriginal || ""} onChange={e => {setForm({...form, valorOriginal: Number(e.target.value)}); setErros({...erros, valorOriginal: ""});}} className={`h-10 font-bold text-orange-700 ${erros.valorOriginal ? "border-red-400" : ""}`} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-orange-700">Valor Liquido R$</Label>
                    <div className="h-10 rounded-md bg-orange-100 flex items-center px-3 font-black text-lg text-orange-800">{fmtBRL(valorLiquido)}</div>
                  </div>
                  <div className="col-span-2 grid grid-cols-4 gap-2">
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Desconto (-)</Label><Input type="number" step="0.01" value={form.desconto || ""} onChange={e => setForm({...form, desconto: Number(e.target.value)})} className="h-8 text-xs text-emerald-600" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Multa (+)</Label><Input type="number" step="0.01" value={form.multa || ""} onChange={e => setForm({...form, multa: Number(e.target.value)})} className="h-8 text-xs text-red-600" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Juros (+)</Label><Input type="number" step="0.01" value={form.juros || ""} onChange={e => setForm({...form, juros: Number(e.target.value)})} className="h-8 text-xs text-red-600" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Impostos (-)</Label><Input type="number" step="0.01" value={form.impostosRetidos || ""} onChange={e => setForm({...form, impostosRetidos: Number(e.target.value)})} className="h-8 text-xs text-emerald-600" /></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide">Emissão</Label><Input type="date" value={form.emissao} onChange={e => setForm({...form, emissao: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide">Vencimento <span className="text-red-500">*</span></Label>
                    <Input type="date" value={form.vencimento} onChange={e => {setForm({...form, vencimento: e.target.value, dataPrevistaPgto: e.target.value}); setErros({...erros, vencimento: ""})}} className={`h-10 ${erros.vencimento ? "border-red-400" : ""}`} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide">Linha Digitável / Cód. Barras</Label>
                  <Input value={form.codigoBarras} onChange={e => setForm({...form, codigoBarras: e.target.value})} className="h-10 font-mono text-sm" placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide">Chave PIX</Label>
                  <Input value={form.chavePix} onChange={e => setForm({...form, chavePix: e.target.value})} className="h-10 font-mono text-sm" placeholder="CPF/CNPJ, Email, Telefone..." />
                </div>
             </div>
          </div>
          
          <div className="border-t pt-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
               {/* Parcelamento Simples */}
               {!editando && (
                  <div className="flex items-center space-x-2">
                    <Switch id="gerar-parcelas" checked={gerarParcelas} onCheckedChange={setGerarParcelas} />
                    <Label htmlFor="gerar-parcelas" className="text-sm font-semibold text-muted-foreground mr-2">Parcelar</Label>
                    {gerarParcelas && <Input type="number" min={2} max={60} value={numParcelas} onChange={e => setNumParcelas(Number(e.target.value))} className="w-16 h-8 text-center" />}
                  </div>
               )}
            </div>
            
            <div className="flex gap-2">
              <Select value={form.status} onValueChange={(v:any) => setForm({...form, status: v})}>
                <SelectTrigger className="w-[140px] h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vencer">A Vencer</SelectItem>
                  <SelectItem value="provisao">Provisão</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fechar} disabled={isSubmitting} className="h-10">Cancelar</Button>
              <Button onClick={handleSalvar} disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white h-10">
                {isSubmitting ? "Salvando..." : <><Check className="w-4 h-4 mr-2" /> Salvar Despesa</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Baixa */}
      {baixando && <Dialog open={!!baixando} onOpenChange={() => setBaixando(null)}><ModalBaixaPagar lancamento={baixando} onConfirm={handleBaixa} onClose={() => setBaixando(null)} /></Dialog>}

      {/* Modal Cadastro Rápido Fornecedor (FIN-FORN-03) */}
      <CadastroRapidoFornecedor
        open={showCadastroFornecedor}
        onClose={() => setShowCadastroFornecedor(false)}
        onSalvo={(f) => {
          setForm({
            ...form,
            favorecidoNome: f.nome,
            favorecidoCnpjCpf: f.documento,
            fornecedorCadastroId: f.fornecedor_cadastro_id,
          });
          setErros({ ...erros, fornecedor: "" });
        }}
      />

      {/* ── Modal Filtros Avançados ── */}
      <Dialog open={showFiltros} onOpenChange={setShowFiltros}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-orange-600" /> Filtros Avançados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data Início</Label>
                <Input type="date" value={filtros.dataInicio} onChange={e => setFiltros({ ...filtros, dataInicio: e.target.value })} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data Fim</Label>
                <Input type="date" value={filtros.dataFim} onChange={e => setFiltros({ ...filtros, dataFim: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fornecedor / Favorecido</Label>
              <Input value={filtros.fornecedor} onChange={e => setFiltros({ ...filtros, fornecedor: e.target.value })} placeholder="Filtrar por fornecedor..." className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Categoria</Label>
              <Select value={filtros.categoria || "todos"} onValueChange={v => setFiltros({ ...filtros, categoria: v === "todos" ? "" : v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="Combustível frota própria">Combustível</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Energia elétrica">Energia</SelectItem>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                  <SelectItem value="Folha de Pagamento">Folha Pgto</SelectItem>
                  <SelectItem value="Impostos Federais">Impostos</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status Efetivo</Label>
              <Select value={filtros.status || "todos"} onValueChange={v => setFiltros({ ...filtros, status: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="vence_hoje">Vence Hoje</SelectItem>
                  <SelectItem value="a_vencer">A Vencer</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="provisao">Provisão</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(filtros.dataInicio || filtros.dataFim || filtros.fornecedor || (filtros.categoria && filtros.categoria !== "todos") || (filtros.status && filtros.status !== "todos")) && (
              <p className="text-[10px] text-muted-foreground">
                Período personalizado ativo — KPIs refletem o filtro de data.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={limparFiltros} className="h-9">Limpar Tudo</Button>
            <Button onClick={aplicarFiltros} className="bg-orange-600 hover:bg-orange-700 text-white h-9">
              <Check className="w-4 h-4 mr-1" /> Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
