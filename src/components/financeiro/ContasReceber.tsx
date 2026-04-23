import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Search, Filter, X, Check, AlertCircle, ChevronDown,
  DollarSign, Clock, CheckCircle2, AlertTriangle, FileText,
  ArrowDownRight, RefreshCw, MoreHorizontal, Download, Eye,
  Split, Repeat, ReceiptText, TrendingDown, User, Building2,
  CalendarDays, Tag, Layers, ChevronUp
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
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Cliente } from "@/components/clientes/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Parcela {
  id: string | number;
  faturaId: number;
  numero: number;
  totalParcelas: number;
  vencimento: string;
  previsaoRecebimento: string;
  valorBruto: number;
  desconto: number;
  multa: number;
  juros: number;
  abatimento: number;
  valorLiquido: number;
  status: "a_vencer" | "vencida" | "paga" | "parcial" | "negociada" | "cancelada";
  dataBaixa?: string;
  valorBaixado?: number;
  contaEntrada?: string;
  observacoesBaixa?: string;
}

interface LancamentoReceber {
  id: string | number;
  // Identificação
  documento: string;
  serie: string;
  numero: string;
  // Cliente
  clienteId: string;
  clienteNome: string;
  clienteDocumento: string;
  // Vínculos
  osVinculadas: string;
  contratoVinculado: string;
  propostaVinculada: string;
  // Classificação
  centroResultado: string;
  categoriaFinanceira: string;
  planoContas: string;
  // Datas
  competencia: string;
  emissao: string;
  vencimento: string;
  previsaoRecebimento: string;
  // Valores
  valorBruto: number;
  desconto: number;
  multa: number;
  juros: number;
  abatimento: number;
  valorLiquido: number;
  // Config
  contaEntrada: string;
  status: "a_vencer" | "vencida" | "paga" | "parcial" | "negociada" | "cancelada";
  recorrencia: string;
  observacoes: string;
  parcelas: Parcela[];
}

interface FiltrosAvancados {
  status: string;
  clienteId: string;
  centroResultado: string;
  categoriaFinanceira: string;
  dataInicio: string;
  dataFim: string;
  vencimentoInicio: string;
  vencimentoFim: string;
  contaEntrada: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s: string) => {
  if (!s) return "—";
  try { return new Date(s + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return s; }
};
const hoje = () => new Date().toISOString().split("T")[0];
const gerarId = () => Date.now() + Math.floor(Math.random() * 1000);

const calcLiquido = (bruto: number, desc: number, mult: number, jur: number, abat: number) =>
  Math.max(0, bruto - (desc || 0) + (mult || 0) + (jur || 0) - (abat || 0));

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  a_vencer: { label: "A Vencer", cls: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300", icon: Clock },
  vencida:  { label: "Vencida",  cls: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300",   icon: AlertTriangle },
  paga:     { label: "Pago",     cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  parcial:  { label: "Parcial",  cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300", icon: TrendingDown },
  negociada:{ label: "Neg.",     cls: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300", icon: RefreshCw },
  cancelada:{ label: "Cancelado",cls: "bg-gray-100 text-gray-500 border-gray-200", icon: X },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["a_vencer"];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 gap-1 ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </Badge>
  );
};

// ─── Formulário em branco ─────────────────────────────────────────────────────

const FORM_BLANK: Omit<LancamentoReceber, "id" | "parcelas"> = {
  documento: "", serie: "A", numero: "",
  clienteId: "", clienteNome: "", clienteDocumento: "",
  osVinculadas: "", contratoVinculado: "", propostaVinculada: "",
  centroResultado: "", categoriaFinanceira: "Receita de Frete", planoContas: "4.1.1 - Receita Operacional",
  competencia: "", emissao: hoje(), vencimento: "", previsaoRecebimento: "",
  valorBruto: 0, desconto: 0, multa: 0, juros: 0, abatimento: 0, valorLiquido: 0,
  contaEntrada: "Conta Corrente Principal", status: "a_vencer", recorrencia: "nenhuma", observacoes: "",
};

const FILTROS_BLANK: FiltrosAvancados = {
  status: "todos", clienteId: "", centroResultado: "", categoriaFinanceira: "",
  dataInicio: "", dataFim: "", vencimentoInicio: "", vencimentoFim: "", contaEntrada: "",
};

// ─── Autocomplete de Cliente ───────────────────────────────────────────────────

interface ClienteAutocompleteProps {
  value: string;
  onSelect: (c: Pick<Cliente, "id" | "razao_social" | "nome_fantasia" | "cnpj">) => void;
  error?: string;
}

interface ClienteOption { id: string; razao_social: string; nome_fantasia?: string; cnpj?: string; cpf?: string; }

function ClienteAutocomplete({ value, onSelect, error }: ClienteAutocompleteProps) {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(value); }, [value]);

  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) { setOptions([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("clientes")
        .select("id, razao_social, nome_fantasia, cnpj, cpf")
        .or(`razao_social.ilike.%${q}%,cnpj.ilike.%${q}%,cpf.ilike.%${q}%`)
        .order("razao_social")
        .limit(8);
      if (data && data.length > 0) {
        setOptions(data as ClienteOption[]);
      } else {
        setOptions([]);
      }
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (open) buscar(input); }, 300);
    return () => clearTimeout(t);
  }, [input, open, buscar]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Digite razão social ou CNPJ..."
          className={`pl-9 h-10 ${error ? "border-red-400 focus-visible:ring-red-300" : ""}`}
        />
        {loading && <RefreshCw className="absolute right-3 top-3 w-4 h-4 text-muted-foreground animate-spin" />}
      </div>
      {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      {open && options.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-xl shadow-xl overflow-hidden">
          {options.map(c => (
            <button
              key={c.id}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/70 transition-colors"
              onMouseDown={e => { e.preventDefault(); onSelect(c); setInput(c.razao_social); setOpen(false); }}
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{c.razao_social}</p>
                <p className="text-xs text-muted-foreground font-mono">{c.cnpj}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal de Baixa ───────────────────────────────────────────────────────────

interface ModalBaixaProps {
  lancamento: LancamentoReceber;
  onConfirm: (id: string | number, tipo: "total" | "parcial", valor: number, conta: string, obs: string, data: string) => void;
  onClose: () => void;
}

function ModalBaixa({ lancamento, onConfirm, onClose }: ModalBaixaProps) {
  const [tipoBaixa, setTipoBaixa] = useState<"total" | "parcial">("total");
  const [valorBaixar, setValorBaixar] = useState(lancamento.valorLiquido);
  const [conta, setConta] = useState("Conta Corrente Principal");
  const [obs, setObs] = useState("");
  const [dataBaixa, setDataBaixa] = useState(hoje());
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!valorBaixar || valorBaixar <= 0) { toast.error("Informe um valor válido."); return; }
    if (valorBaixar > lancamento.valorLiquido) { toast.error("Valor não pode ser maior que o saldo em aberto."); return; }
    setLoading(true);
    try {
      await onConfirm(lancamento.id, tipoBaixa, valorBaixar, conta, obs, dataBaixa);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 rounded-lg"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          Registrar Recebimento
        </DialogTitle>
        <DialogDescription>
          {lancamento.documento} · {lancamento.clienteNome}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Valor em aberto */}
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Valor em aberto</p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-0.5">{fmtBRL(lancamento.valorLiquido)}</p>
        </div>

        {/* Tipo de baixa */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Baixa</Label>
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
                {t === "total" ? "Baixa Total" : "Baixa Parcial"}
              </button>
            ))}
          </div>
        </div>

        {/* Valor */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Valor Recebido (R$) *
          </Label>
          <Input
            type="number" min="0.01" step="0.01"
            value={valorBaixar || ""}
            onChange={e => setValorBaixar(Number(e.target.value))}
            disabled={tipoBaixa === "total"}
            className="h-10 font-bold font-mono text-emerald-700 dark:text-emerald-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Data */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data do Recebimento</Label>
            <Input type="date" value={dataBaixa} onChange={e => setDataBaixa(e.target.value)} className="h-10" />
          </div>

          {/* Conta */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conta de Entrada</Label>
            <Select value={conta} onValueChange={setConta}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Conta Corrente Principal">C/C Principal</SelectItem>
                <SelectItem value="Conta Reserva / Impostos">C/C Reserva</SelectItem>
                <SelectItem value="Cartão Corporativo Digital">Cart. Digital</SelectItem>
                <SelectItem value="Caixa Interno — Pequenos Gastos">Caixa Físico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Obs */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</Label>
          <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Pago via PIX, comprovante enviado..." className="resize-none h-16" />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose} className="h-10">Cancelar</Button>
        <Button onClick={handleConfirm} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6 font-semibold">
          {loading
            ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Registrando...</span>
            : <><Check className="w-4 h-4 mr-1.5" />Confirmar Recebimento</>}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContasReceber() {
  const [lancamentos, setLancamentos] = useState<LancamentoReceber[]>([]);
  const [showNovo, setShowNovo] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [editando, setEditando] = useState<LancamentoReceber | null>(null);
  const [baixando, setBaixando] = useState<LancamentoReceber | null>(null);
  const [buscaRapida, setBuscaRapida] = useState("");
  const [filtros, setFiltros] = useState<FiltrosAvancados>({ ...FILTROS_BLANK });
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosAvancados>({ ...FILTROS_BLANK });

  // Form
  const [form, setForm] = useState({ ...FORM_BLANK });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parcelas
  const [gerarParcelas, setGerarParcelas] = useState(false);
  const [numParcelas, setNumParcelas] = useState(1);
  const [diaVencimento, setDiaVencimento] = useState(5);

  // ── Valores derivados ──
  const valorLiquido = calcLiquido(form.valorBruto, form.desconto, form.multa, form.juros, form.abatimento);

  useEffect(() => {
    setForm(p => ({ ...p, valorLiquido }));
  }, [valorLiquido]);

  // ── KPIs ──
  const totalAReceber = lancamentos.filter(l => l.status === "a_vencer" || l.status === "parcial")
    .reduce((a, l) => a + l.valorLiquido, 0);
  const totalVencido = lancamentos.filter(l => l.status === "vencida").reduce((a, l) => a + l.valorLiquido, 0);
  const totalRecebidoMes = lancamentos.filter(l => l.status === "paga").reduce((a, l) => a + l.valorLiquido, 0);
  const totalGeral = lancamentos.reduce((a, l) => a + l.valorLiquido, 0);

  // ── Filtros ──
  const lancFiltrados = lancamentos.filter(l => {
    const q = buscaRapida.toLowerCase();
    const passaBusca = !q || l.clienteNome.toLowerCase().includes(q) || l.documento.toLowerCase().includes(q) ||
      l.osVinculadas.toLowerCase().includes(q);
    const passaStatus = filtrosAtivos.status === "todos" || !filtrosAtivos.status || l.status === filtrosAtivos.status;
    const passaCliente = !filtrosAtivos.clienteId || l.clienteId === filtrosAtivos.clienteId;
    const passaCategoria = !filtrosAtivos.categoriaFinanceira || l.categoriaFinanceira === filtrosAtivos.categoriaFinanceira;
    const passaCR = !filtrosAtivos.centroResultado || l.centroResultado === filtrosAtivos.centroResultado;
    return passaBusca && passaStatus && passaCliente && passaCategoria && passaCR;
  });

  // ── Validação ──
  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.clienteId) e.cliente = "Selecione o cliente";
    if (!form.vencimento) e.vencimento = "Informe o vencimento";
    if (!form.valorBruto || form.valorBruto <= 0) e.valorBruto = "Valor deve ser maior que zero";
    if (!form.categoriaFinanceira) e.categoriaFinanceira = "Selecione a categoria";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  // ── Gerar nº fatura ──
  const gerarDocumento = () => {
    const n = (lancamentos.length + 1).toString().padStart(4, "0");
    return `FAT-${n}`;
  };

  // ── Leitura inicial do Supabase ──
  useEffect(() => {
    fetchLancamentos();
  }, []);

  const fetchLancamentos = async () => {
    try {
      setIsSubmitting(true);
      const { data, error } = await supabase
        .from("financeiro_receber")
        .select("*")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        setLancamentos(data.map((r: any) => ({
          id: r.id,
          documento: r.fatura || r.documento || "",
          serie: r.serie || "A",
          numero: r.numero || "",
          clienteId: r.cliente_id || "",
          clienteNome: r.cliente || "",
          clienteDocumento: r.cliente_documento || "",
          osVinculadas: r.os_vinculadas || "",
          contratoVinculado: r.contrato_vinculado || "",
          propostaVinculada: r.proposta_vinculada || "",
          centroResultado: r.centro_resultado || "",
          categoriaFinanceira: r.categoria || "",
          planoContas: r.plano_conta || "",
          competencia: r.competencia || "",
          emissao: r.data_emissao || "",
          vencimento: r.data_vencimento || r.vencimento || "",
          previsaoRecebimento: r.data_previsao_recebimento || "",
          valorBruto: r.valor_bruto || r.valor || 0,
          desconto: r.desconto || 0,
          multa: r.multa || 0,
          juros: r.juros || 0,
          abatimento: r.abatimento || 0,
          valorLiquido: r.valor_liquido || r.valor || 0,
          contaEntrada: r.conta_entrada || "",
          status: mapStatus(r.status),
          recorrencia: r.recorrencia || "nenhuma",
          observacoes: r.observacoes || "",
          parcelas: []
        })));
      } else {
        setLancamentos([]);
      }
    } catch (error) {
      console.error("Erro ao buscar recebíveis do Supabase:", error);
      setLancamentos([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const mapStatus = (s: string): LancamentoReceber["status"] => {
    const map: Record<string, LancamentoReceber["status"]> = {
      "a vencer": "a_vencer", "a_vencer": "a_vencer", "pendente": "a_vencer",
      "vencida": "vencida", "vencido": "vencida",
      "paga": "paga", "pago": "paga",
      "parcial": "parcial",
      "negociada": "negociada", "renegociada": "negociada",
      "cancelada": "cancelada", "cancelado": "cancelada",
    };
    return map[s?.toLowerCase()] ?? "a_vencer";
  };

// ── Salvar com persistência Supabase ──
  const handleSalvar = async () => {
    if (!validar()) { toast.error("Corrija os campos obrigatórios."); return; }
    setIsSubmitting(true);
    try {
      const doc = form.documento || gerarDocumento();
      const num = form.numero || doc.split("-")[1] || `${lancamentos.length + 1}`;

      const payload = {
        fatura: doc,
        serie: form.serie || "A",
        numero: num,
        cliente_id: form.clienteId || null,
        cliente: form.clienteNome,
        cliente_documento: form.clienteDocumento,
        os_vinculadas: form.osVinculadas,
        contrato_vinculado: form.contratoVinculado,
        proposta_vinculada: form.propostaVinculada,
        centro_resultado: form.centroResultado,
        categoria: form.categoriaFinanceira,
        plano_conta: form.planoContas,
        competencia: form.competencia,
        data_emissao: form.emissao,
        data_vencimento: form.vencimento,
        data_previsao_recebimento: form.previsaoRecebimento,
        valor_bruto: form.valorBruto,
        desconto: form.desconto || 0,
        multa: form.multa || 0,
        juros: form.juros || 0,
        abatimento: form.abatimento || 0,
        valor_liquido: valorLiquido,
        conta_entrada: form.contaEntrada,
        status: form.status === "a_vencer" ? "a vencer" : form.status,
        recorrencia: form.recorrencia,
        observacoes: form.observacoes,
      };

      if (editando?.id) {
        const { error } = await supabase.from("financeiro_receber").update(payload).eq("id", editando.id);
        if (error) throw error;
        toast.success("Lançamento atualizado.");
      } else {
        const { error } = await supabase.from("financeiro_receber").insert([payload]);
        if (error) throw error;

        if (gerarParcelas && numParcelas > 1 && form.vencimento) {
          const valParcela = Math.round((valorLiquido / numParcelas) * 100) / 100;
          const base = new Date(form.vencimento + "T12:00:00");
          const parcelasPayload = Array.from({ length: numParcelas }, (_, i) => {
            const dt = new Date(base); dt.setMonth(dt.getMonth() + i);
            return {
              ...payload,
              id: undefined,
              fatura: `${doc} (${i + 1}/${numParcelas})`,
              data_vencimento: dt.toISOString().split("T")[0],
              data_previsao_recebimento: dt.toISOString().split("T")[0],
              valor_bruto: valParcela,
              desconto: 0, multa: 0, juros: 0, abatimento: 0,
              valor_liquido: valParcela,
              serie: form.serie || "A",
              numero: `${i + 1}/${numParcelas}`,
              quantidade_parcelas: numParcelas,
              parcela_atual: i + 1,
            };
          });
          await supabase.from("financeiro_receber").insert(parcelasPayload);
          toast.success(`${numParcelas} parcelas criadas!`);
        } else {
          toast.success(`Lançamento ${doc} criado!`);
        }
      }
      await fetchLancamentos();
      setShowNovo(false);
      setEditando(null);
      setForm({ ...FORM_BLANK });
      setErros({});
      setGerarParcelas(false);
      setNumParcelas(1);
    } catch (error) {
      console.error("Erro ao salvar no Supabase:", error);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Baixa com persistência Supabase ──
  const handleBaixa = async (id: any, tipo: "total" | "parcial", valor: number, conta: string, obs: string, data: string) => {
    try {
      const lanc = lancamentos.find(l => l.id === id);
      if (!lanc) return;
      const novoStatus = tipo === "total" ? "pago" : "parcial";
      const novoValor = tipo === "parcial" ? (lanc.valorLiquido - valor) : 0;

      const { error } = await supabase.from("financeiro_receber").update({
        status: novoStatus,
        valor_liquido: novoValor,
        data_previsao_recebimento: data,
        observacoes: `${lanc.observacoes || ""}\nBaixa ${tipo}: ${fmtBRL(valor)} em ${data} | Conta: ${conta} | Obs: ${obs}`,
      }).eq("id", id);
      if (error) throw error;
      toast.success(tipo === "total" ? "Baixa total registrada!" : `Baixa parcial de ${fmtBRL(valor)} registrada!`);
      await fetchLancamentos();
    } catch (error) {
      console.error("Erro na baixa:", error);
      toast.error("Erro ao registrar baixa.");
    }
    setBaixando(null);
  };

  // ── Renegociar com persistência Supabase ──
  const handleRenegociar = async (id: any) => {
    try {
      const { error } = await supabase.from("financeiro_receber").update({ status: "renegociada" }).eq("id", id);
      if (error) throw error;
      toast.success("Lançamento renegociado.");
      await fetchLancamentos();
    } catch (error) {
      console.error("Erro na renegociação:", error);
      toast.error("Erro ao renegociar.");
    }
  };

  // ── Cancelar com persistência Supabase ──
  const handleCancelar = async (id: any) => {
    if (!confirm("Tem certeza que deseja cancelar?")) return;
    try {
      const { error } = await supabase.from("financeiro_receber").update({ status: "cancelada" }).eq("id", id);
      if (error) throw error;
      toast.success("Lançamento cancelado.");
      await fetchLancamentos();
    } catch (error) {
      console.error("Erro ao cancelar:", error);
      toast.error("Erro ao cancelar.");
    }
  };

  // ── Renegociar ──
  const handleRenegociar = (id: number) => {
    setLancamentos(prev => prev.map(l =>
      l.id === id ? { ...l, status: "negociada" as const } : l
    ));
    toast.success("Lançamento marcado como negociado.");
  };

  // ── Cancelar ──
  const handleCancelar = (id: number) => {
    setLancamentos(prev => prev.map(l =>
      l.id === id ? { ...l, status: "cancelada" as const } : l
    ));
    toast.success("Lançamento cancelado.");
  };

  const abrirEditar = (l: LancamentoReceber) => {
    setEditando(l);
    setForm({
      documento: l.documento, serie: l.serie, numero: l.numero,
      clienteId: l.clienteId, clienteNome: l.clienteNome, clienteDocumento: l.clienteDocumento,
      osVinculadas: l.osVinculadas, contratoVinculado: l.contratoVinculado, propostaVinculada: l.propostaVinculada,
      centroResultado: l.centroResultado, categoriaFinanceira: l.categoriaFinanceira, planoContas: l.planoContas,
      competencia: l.competencia, emissao: l.emissao, vencimento: l.vencimento, previsaoRecebimento: l.previsaoRecebimento,
      valorBruto: l.valorBruto, desconto: l.desconto, multa: l.multa, juros: l.juros, abatimento: l.abatimento, valorLiquido: l.valorLiquido,
      contaEntrada: l.contaEntrada, status: l.status, recorrencia: l.recorrencia, observacoes: l.observacoes,
    });
    setShowNovo(true);
  };

  const fechar = () => {
    setShowNovo(false);
    setEditando(null);
    setForm({ ...FORM_BLANK });
    setErros({});
    setGerarParcelas(false);
    setNumParcelas(1);
  };

  const aplicarFiltros = () => {
    setFiltrosAtivos({ ...filtros });
    setShowFiltros(false);
  };

  const limparFiltros = () => {
    setFiltros({ ...FILTROS_BLANK });
    setFiltrosAtivos({ ...FILTROS_BLANK });
    setShowFiltros(false);
  };

  const filtrosAplicados = Object.values(filtrosAtivos).some(v => v && v !== "todos");

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total a Receber", value: totalAReceber, icon: ArrowDownRight, gradient: "from-blue-500 to-blue-600", bg: "from-blue-500 to-blue-700" },
          { label: "Vencido (em aberto)", value: totalVencido, icon: AlertTriangle, gradient: "from-red-500 to-rose-600", bg: "from-red-500 to-rose-700" },
          { label: "Recebido no Mês", value: totalRecebidoMes, icon: CheckCircle2, gradient: "from-emerald-500 to-green-600", bg: "from-emerald-500 to-green-700" },
          { label: "Total Carteira", value: totalGeral, icon: DollarSign, gradient: "from-violet-500 to-purple-600", bg: "from-violet-500 to-purple-700" },
        ].map(k => (
          <div key={k.label} className="relative overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 p-4 flex items-center justify-between">
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${k.gradient}`} />
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="text-xl font-black text-foreground mt-1">{fmtBRL(k.value)}</p>
            </div>
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${k.bg} shadow-sm`}>
              <k.icon className="w-4 h-4 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fatura, cliente ou OS..."
            value={buscaRapida}
            onChange={e => setBuscaRapida(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Button
          variant="outline"
          className={`gap-2 h-9 relative ${filtrosAplicados ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20" : ""}`}
          onClick={() => setShowFiltros(true)}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {filtrosAplicados && (
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-600 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
              {Object.values(filtrosAtivos).filter(v => v && v !== "todos").length}
            </span>
          )}
        </Button>

        {filtrosAplicados && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground gap-1.5" onClick={limparFiltros}>
            <X className="w-3.5 h-3.5" /> Limpar
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" className="gap-2 h-9 text-xs">
            <Download className="w-4 h-4" /> Exportar
          </Button>
          <Button
            className="gap-1.5 h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            onClick={() => { setEditando(null); setForm({ ...FORM_BLANK }); setShowNovo(true); }}
          >
            <Plus className="w-4 h-4" /> Nova Receita
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase pl-5">Documento</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase">Cliente</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase">OS / Vínculo</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase">Categoria</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase">Competência</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase">Vencimento</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase text-right">Bruto</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase text-right pr-4">Líquido</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase">Status</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-15" />
                    <p className="font-medium">Nenhum lançamento encontrado.</p>
                    <p className="text-xs mt-1">Tente ajustar os filtros ou crie uma nova receita.</p>
                  </TableCell>
                </TableRow>
              )}
              {lancFiltrados.map(l => (
                <TableRow key={l.id} className="hover:bg-muted/20 transition-colors group">
                  <TableCell className="pl-5 py-3">
                    <p className="font-semibold text-sm text-blue-700 dark:text-blue-400">{l.documento}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">Série {l.serie} · Nº {l.numero}</p>
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="font-semibold text-sm max-w-[160px] truncate" title={l.clienteNome}>{l.clienteNome}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{l.clienteDocumento}</p>
                  </TableCell>
                  <TableCell className="py-3">
                    {l.osVinculadas ? (
                      <Badge variant="outline" className="text-[10px] font-mono font-medium">{l.osVinculadas}</Badge>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                    {l.contratoVinculado && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{l.contratoVinculado}</p>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="text-xs font-medium max-w-[120px] truncate">{l.categoriaFinanceira}</p>
                    <p className="text-[10px] text-muted-foreground">{l.centroResultado}</p>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground">{l.competencia}</TableCell>
                  <TableCell className="py-3">
                    <p className={`text-sm font-medium ${l.status === "vencida" ? "text-red-600" : ""}`}>
                      {fmtData(l.vencimento)}
                    </p>
                    {l.previsaoRecebimento && l.previsaoRecebimento !== l.vencimento && (
                      <p className="text-[10px] text-muted-foreground">Prev: {fmtData(l.previsaoRecebimento)}</p>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm text-muted-foreground font-mono">{fmtBRL(l.valorBruto)}</TableCell>
                  <TableCell className="py-3 text-right pr-4 font-black text-sm">{fmtBRL(l.valorLiquido)}</TableCell>
                  <TableCell className="py-3"><StatusBadge status={l.status} /></TableCell>
                  <TableCell className="py-3 text-right pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => abrirEditar(l)}>
                          <Eye className="w-4 h-4 mr-2" /> Ver / Editar
                        </DropdownMenuItem>
                        {(l.status === "a_vencer" || l.status === "vencida" || l.status === "parcial") && (
                          <DropdownMenuItem onClick={() => setBaixando(l)} className="text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Registrar Recebimento
                          </DropdownMenuItem>
                        )}
                        {(l.status === "vencida" || l.status === "parcial") && (
                          <DropdownMenuItem onClick={() => handleRenegociar(l.id)} className="text-purple-700">
                            <RefreshCw className="w-4 h-4 mr-2" /> Renegociar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {l.status !== "cancelada" && l.status !== "paga" && (
                          <DropdownMenuItem onClick={() => handleCancelar(l.id)} className="text-red-600">
                            <X className="w-4 h-4 mr-2" /> Cancelar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Filtros Avançados ── */}
      <Dialog open={showFiltros} onOpenChange={setShowFiltros}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filtros Avançados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                <Select value={filtros.status} onValueChange={v => setFiltros(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="a_vencer">A Vencer</SelectItem>
                    <SelectItem value="vencida">Vencidos</SelectItem>
                    <SelectItem value="paga">Pagos</SelectItem>
                    <SelectItem value="parcial">Baixa Parcial</SelectItem>
                    <SelectItem value="negociada">Negociados</SelectItem>
                    <SelectItem value="cancelada">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria</Label>
                <Select value={filtros.categoriaFinanceira} onValueChange={v => setFiltros(p => ({ ...p, categoriaFinanceira: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    <SelectItem value="Receita de Frete">Receita de Frete</SelectItem>
                    <SelectItem value="Receita de Cross-Docking">Cross-Docking</SelectItem>
                    <SelectItem value="Receita de Armazenagem">Armazenagem</SelectItem>
                    <SelectItem value="Outras Receitas">Outras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vencto. De</Label>
                <Input type="date" className="h-9" value={filtros.vencimentoInicio} onChange={e => setFiltros(p => ({ ...p, vencimentoInicio: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vencto. Até</Label>
                <Input type="date" className="h-9" value={filtros.vencimentoFim} onChange={e => setFiltros(p => ({ ...p, vencimentoFim: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Centro de Resultado</Label>
              <Input placeholder="Ex: SP-Operações" className="h-9" value={filtros.centroResultado} onChange={e => setFiltros(p => ({ ...p, centroResultado: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={limparFiltros} className="h-9">Limpar</Button>
            <Button onClick={aplicarFiltros} className="h-9 bg-blue-600 hover:bg-blue-700">Aplicar Filtros</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Novo / Editar Lançamento ── */}
      <Dialog open={showNovo} onOpenChange={open => { if (!open) fechar(); else setShowNovo(true); }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ReceiptText className="w-4 h-4 text-blue-600" />
              </div>
              {editando ? "Editar Lançamento — Contas a Receber" : "Novo Lançamento — Contas a Receber"}
            </DialogTitle>
            <DialogDescription>Campos com * são obrigatórios.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="principal" className="mt-1">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="principal">Principal</TabsTrigger>
              <TabsTrigger value="valores">Valores</TabsTrigger>
              <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
              <TabsTrigger value="config">Config.</TabsTrigger>
            </TabsList>

            {/* ── Aba 1: Principal ── */}
            <TabsContent value="principal" className="space-y-4 pt-3">
              {/* Documento */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Documento / Fatura</Label>
                  <Input value={form.documento} onChange={e => setForm(p => ({ ...p, documento: e.target.value }))} placeholder="Auto: FAT-XXXX" className="h-10 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Série</Label>
                  <Input value={form.serie} onChange={e => setForm(p => ({ ...p, serie: e.target.value }))} placeholder="A" className="h-10 font-mono" maxLength={3} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Número</Label>
                  <Input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} placeholder="0001" className="h-10 font-mono" />
                </div>
              </div>

              {/* Cliente */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cliente <span className="text-red-500">*</span>
                </Label>
                <ClienteAutocomplete
                  value={form.clienteNome}
                  onSelect={c => {
                    setForm(p => ({
                      ...p,
                      clienteId: c.id,
                      clienteNome: c.razao_social,
                      clienteDocumento: c.cnpj,
                    }));
                    setErros(p => ({ ...p, cliente: "" }));
                  }}
                  error={erros.cliente}
                />
                {form.clienteDocumento && (
                  <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 ml-1">
                    <Building2 className="w-3 h-3" /> CNPJ: {form.clienteDocumento}
                  </p>
                )}
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emissão</Label>
                  <Input type="date" value={form.emissao} onChange={e => setForm(p => ({ ...p, emissao: e.target.value }))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Vencimento <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="date" value={form.vencimento}
                    onChange={e => { setForm(p => ({ ...p, vencimento: e.target.value, previsaoRecebimento: e.target.value })); setErros(p => ({ ...p, vencimento: "" })); }}
                    className={`h-10 ${erros.vencimento ? "border-red-400" : ""}`}
                  />
                  {erros.vencimento && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{erros.vencimento}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Previsão Receb.</Label>
                  <Input type="date" value={form.previsaoRecebimento} onChange={e => setForm(p => ({ ...p, previsaoRecebimento: e.target.value }))} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Competência</Label>
                  <Input value={form.competencia} onChange={e => setForm(p => ({ ...p, competencia: e.target.value }))} placeholder="MM/AAAA" className="h-10 font-mono" />
                </div>
              </div>

              {/* Toggle parcelas */}
              {!editando && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5"><Split className="w-4 h-4 text-muted-foreground" /> Gerar Parcelas</p>
                    <p className="text-xs text-muted-foreground">Divide automaticamente em N parcelas mensais</p>
                  </div>
                  <Switch checked={gerarParcelas} onCheckedChange={setGerarParcelas} />
                </div>
              )}

              {gerarParcelas && !editando && (
                <div className="grid grid-cols-2 gap-4 p-3 rounded-lg border border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Número de Parcelas</Label>
                    <Input type="number" min={2} max={60} value={numParcelas} onChange={e => setNumParcelas(Number(e.target.value))} className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor por Parcela</Label>
                    <div className="h-10 flex items-center px-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 font-black text-blue-700">
                      {numParcelas > 1 ? fmtBRL(valorLiquido / numParcelas) : "—"}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Aba 2: Valores ── */}
            <TabsContent value="valores" className="space-y-4 pt-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800 p-4">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-3">Composição do Valor</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 md:col-span-1">
                    <Label className="text-xs font-semibold text-muted-foreground">Valor Bruto (R$) <span className="text-red-500">*</span></Label>
                    <Input
                      type="number" min="0.01" step="0.01"
                      value={form.valorBruto || ""}
                      onChange={e => { setForm(p => ({ ...p, valorBruto: Number(e.target.value) })); setErros(p => ({ ...p, valorBruto: "" })); }}
                      placeholder="0,00"
                      className={`h-10 font-bold font-mono text-blue-700 dark:text-blue-400 ${erros.valorBruto ? "border-red-400" : ""}`}
                    />
                    {erros.valorBruto && <p className="text-xs text-red-500">{erros.valorBruto}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Desconto (-)</Label>
                    <Input type="number" min="0" step="0.01" value={form.desconto || ""} onChange={e => setForm(p => ({ ...p, desconto: Number(e.target.value) }))} placeholder="0,00" className="h-10 font-mono text-emerald-600" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Multa (+)</Label>
                    <Input type="number" min="0" step="0.01" value={form.multa || ""} onChange={e => setForm(p => ({ ...p, multa: Number(e.target.value) }))} placeholder="0,00" className="h-10 font-mono text-red-600" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Juros (+)</Label>
                    <Input type="number" min="0" step="0.01" value={form.juros || ""} onChange={e => setForm(p => ({ ...p, juros: Number(e.target.value) }))} placeholder="0,00" className="h-10 font-mono text-red-600" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Abatimento (-)</Label>
                    <Input type="number" min="0" step="0.01" value={form.abatimento || ""} onChange={e => setForm(p => ({ ...p, abatimento: Number(e.target.value) }))} placeholder="0,00" className="h-10 font-mono text-emerald-600" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Valor Líquido</Label>
                    <div className="h-10 flex items-center px-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 font-black text-blue-700 dark:text-blue-300 text-lg">
                      {fmtBRL(valorLiquido)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conta de Entrada</Label>
                <Select value={form.contaEntrada} onValueChange={v => setForm(p => ({ ...p, contaEntrada: v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Conta Corrente Principal">Conta Corrente Principal</SelectItem>
                    <SelectItem value="Conta Reserva / Impostos">Conta Reserva / Impostos</SelectItem>
                    <SelectItem value="Cartão Corporativo Digital">Cartão Corporativo Digital</SelectItem>
                    <SelectItem value="Caixa Interno — Pequenos Gastos">Caixa Físico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* ── Aba 3: Vínculos ── */}
            <TabsContent value="vinculos" className="space-y-4 pt-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">OS Vinculadas</Label>
                  <Input value={form.osVinculadas} onChange={e => setForm(p => ({ ...p, osVinculadas: e.target.value }))} placeholder="OS-401, OS-402" className="h-10 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contrato Vinculado</Label>
                  <Input value={form.contratoVinculado} onChange={e => setForm(p => ({ ...p, contratoVinculado: e.target.value }))} placeholder="CTR-001" className="h-10 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Proposta Vinculada</Label>
                  <Input value={form.propostaVinculada} onChange={e => setForm(p => ({ ...p, propostaVinculada: e.target.value }))} placeholder="PROP-058" className="h-10 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Centro de Resultado</Label>
                  <Select value={form.centroResultado} onValueChange={v => setForm(p => ({ ...p, centroResultado: v }))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SP-Operações">SP-Operações</SelectItem>
                      <SelectItem value="RJ-Operações">RJ-Operações</SelectItem>
                      <SelectItem value="MG-Operações">MG-Operações</SelectItem>
                      <SelectItem value="Corporativo">Corporativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Categoria Financeira <span className="text-red-500">*</span>
                  </Label>
                  <Select value={form.categoriaFinanceira} onValueChange={v => { setForm(p => ({ ...p, categoriaFinanceira: v })); setErros(p => ({ ...p, categoriaFinanceira: "" })); }}>
                    <SelectTrigger className={`h-10 ${erros.categoriaFinanceira ? "border-red-400" : ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Receita de Frete">Receita de Frete</SelectItem>
                      <SelectItem value="Receita de Cross-Docking">Receita de Cross-Docking</SelectItem>
                      <SelectItem value="Receita de Armazenagem">Receita de Armazenagem</SelectItem>
                      <SelectItem value="Receita de Serviços Adicionais">Serviços Adicionais</SelectItem>
                      <SelectItem value="Outras Receitas">Outras Receitas</SelectItem>
                    </SelectContent>
                  </Select>
                  {erros.categoriaFinanceira && <p className="text-xs text-red-500">{erros.categoriaFinanceira}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plano de Contas</Label>
                  <Select value={form.planoContas} onValueChange={v => setForm(p => ({ ...p, planoContas: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4.1.1 - Receita Operacional">4.1.1 - Receita Operacional</SelectItem>
                      <SelectItem value="4.1.2 - Serviços Especiais">4.1.2 - Serviços Especiais</SelectItem>
                      <SelectItem value="4.2 - Outras Receitas">4.2 - Outras Receitas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ── Aba 4: Config ── */}
            <TabsContent value="config" className="space-y-4 pt-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as LancamentoReceber["status"] }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" /> Recorrência
                  </Label>
                  <Select value={form.recorrencia} onValueChange={v => setForm(p => ({ ...p, recorrencia: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Nenhuma (único)</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="bimestral">Bimestral</SelectItem>
                      <SelectItem value="trimestral">Trimestral</SelectItem>
                      <SelectItem value="semestral">Semestral</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                  placeholder="Histórico ou observações sobre este lançamento..."
                  className="resize-none h-24"
                />
              </div>

              {/* Resumo final */}
              {form.valorBruto > 0 && (
                <div className="rounded-lg p-3 border border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-2">Resumo</p>
                  {[
                    ["Cliente", form.clienteNome || "—"],
                    ["Documento", form.documento || "Gerado automaticamente"],
                    ["Vencimento", form.vencimento ? fmtData(form.vencimento) : "—"],
                    ["Valor Bruto", fmtBRL(form.valorBruto)],
                    ["Valor Líquido", fmtBRL(valorLiquido)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{k}:</span>
                      <span className="font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={fechar} disabled={isSubmitting} className="h-10">Cancelar</Button>
            <Button
              onClick={handleSalvar}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6 font-semibold"
            >
              {isSubmitting
                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Salvando...</span>
                : <><Check className="w-4 h-4 mr-1.5" />{editando ? "Salvar Alterações" : "Criar Lançamento"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Baixa ── */}
      {baixando && (
        <Dialog open={!!baixando} onOpenChange={() => setBaixando(null)}>
          <ModalBaixa lancamento={baixando} onConfirm={handleBaixa} onClose={() => setBaixando(null)} />
        </Dialog>
      )}
    </div>
  );
}
