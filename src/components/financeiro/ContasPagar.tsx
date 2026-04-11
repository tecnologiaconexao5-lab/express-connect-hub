import { useState, useEffect, useRef, useCallback } from "react";
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
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

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
  id: number;
  // Identificação
  favorecidoNome: string;
  favorecidoCnpjCpf: string;
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
  status: "a_vencer" | "vencida" | "paga" | "parcial" | "provisao" | "cancelada";
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s: string) => {
  if (!s) return "—";
  try { return new Date(s + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return s; }
};
const hoje = () => new Date().toISOString().split("T")[0];
const gerarId = () => Date.now() + Math.floor(Math.random() * 1000);

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

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["a_vencer"];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 gap-1 ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </Badge>
  );
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_FORNECEDORES = [
  { id: "f1", nome: "Posto Ipiranga Rota 101", documento: "01.234.567/0001-89", tipo: "Fornecedor" },
  { id: "f2", nome: "Enel Distribuidora de Energia", documento: "08.123.456/0001-00", tipo: "Concessionária" },
  { id: "f3", nome: "Sabesp Serviços", documento: "43.776.517/0001-80", tipo: "Concessionária" },
  { id: "f4", nome: "João Silva Serviços de Manutenção", documento: "123.456.789-00", tipo: "Prestador" },
  { id: "f5", nome: "Aluguel Galpão - Imobiliária Base", documento: "99.888.777/0001-22", tipo: "Fornecedor" },
];

const MOCK_PAGAR: LancamentoPagar[] = [
  {
    id: 1, favorecidoNome: "Posto Ipiranga Rota 101", favorecidoCnpjCpf: "01.234.567/0001-89",
    documentoNF: "NF-894", tipoDocumento: "NF", categoria: "Combustível frota própria",
    planoContas: "3.1.2 - Custos Operacionais", centroResultado: "Frota", unidadeFilial: "Matriz (SP)",
    despesaFixaBase: "Variável", competencia: "04/2026", emissao: "2026-04-01",
    vencimento: "2026-04-15", dataPrevistaPgto: "2026-04-15", valorOriginal: 12450.00,
    desconto: 0, juros: 0, multa: 0, impostosRetidos: 0, valorLiquido: 12450.00,
    formaPagamento: "Boleto", codigoBarras: "34191.09008 61000.040003 34567.890001 8 00001245000", chavePix: "",
    contaPagadora: "Conta Corrente Principal", status: "a_vencer", recorrencia: "nenhuma", observacoes: "", parcelas: []
  },
  {
    id: 2, favorecidoNome: "Enel Distribuidora de Energia", favorecidoCnpjCpf: "08.123.456/0001-00",
    documentoNF: "FAT-0426", tipoDocumento: "Fatura", categoria: "Energia elétrica",
    planoContas: "3.2.1 - Despesas Administrativas", centroResultado: "Corporativo", unidadeFilial: "Matriz (SP)",
    despesaFixaBase: "Fixa", competencia: "03/2026", emissao: "2026-03-20",
    vencimento: "2026-04-05", dataPrevistaPgto: "2026-04-05", valorOriginal: 1450.80,
    desconto: 0, juros: 14.50, multa: 29.00, impostosRetidos: 0, valorLiquido: 1494.30,
    formaPagamento: "PIX", codigoBarras: "", chavePix: "financeiro@expressconnect.com.br",
    contaPagadora: "Conta Corrente Principal", status: "vencida", recorrencia: "mensal", observacoes: "Aguardando liberação de caixa", parcelas: []
  },
  {
    id: 3, favorecidoNome: "João Silva Serviços de Manutenção", favorecidoCnpjCpf: "123.456.789-00",
    documentoNF: "REC-102", tipoDocumento: "Recibo", categoria: "Manutenção",
    planoContas: "3.1.2 - Custos Operacionais", centroResultado: "Frota", unidadeFilial: "Matriz (SP)",
    despesaFixaBase: "Variável", competencia: "04/2026", emissao: "2026-04-08",
    vencimento: "2026-04-10", dataPrevistaPgto: "2026-04-10", valorOriginal: 850.00,
    desconto: 0, juros: 0, multa: 0, impostosRetidos: 0, valorLiquido: 850.00, dataEfetivaPgto: "2026-04-10",
    formaPagamento: "Transferência / TEF", codigoBarras: "", chavePix: "11988887777",
    contaPagadora: "Caixa Interno — Pequenos Gastos", status: "paga", recorrencia: "nenhuma", observacoes: "Manutenção placa ABC-1234", parcelas: []
  },
];

// ─── Formulário em branco ─────────────────────────────────────────────────────

const FORM_BLANK: Omit<LancamentoPagar, "id" | "parcelas"> = {
  favorecidoNome: "", favorecidoCnpjCpf: "", documentoNF: "", tipoDocumento: "NF",
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
};

// ─── Autocomplete Fornecedor ───────────────────────────────────────────────────

interface FornecedorAutocompleteProps {
  value: string;
  onSelect: (f: Pick<typeof MOCK_FORNECEDORES[0], "id" | "nome" | "documento">) => void;
  error?: string;
}

function FornecedorAutocomplete({ value, onSelect, error }: FornecedorAutocompleteProps) {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<typeof MOCK_FORNECEDORES>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(value); }, [value]);

  useEffect(() => {
    if (!input.trim()) { setOptions([]); return; }
    const res = MOCK_FORNECEDORES.filter(f =>
      f.nome.toLowerCase().includes(input.toLowerCase()) ||
      f.documento.includes(input)
    );
    setOptions(res);
  }, [input]);

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
        <Building2 className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Fornecedor, Concessionária, Favorecido..."
          className={`pl-9 h-10 ${error ? "border-red-400 focus-visible:ring-red-300" : ""}`}
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      {open && options.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border rounded-xl shadow-xl overflow-hidden">
          {options.map(f => (
            <button
              key={f.id}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/70 transition-colors"
              onMouseDown={e => { e.preventDefault(); onSelect(f); setInput(f.nome); setOpen(false); }}
            >
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-3.5 h-3.5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{f.nome}</p>
                <p className="text-xs text-muted-foreground font-mono">{f.documento}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal de Baixa de Pagamento ──────────────────────────────────────────────

interface ModalBaixaPagarProps {
  lancamento: LancamentoPagar;
  onConfirm: (id: number, tipo: "total" | "parcial", valor: number, conta: string, forma: string, obs: string, data: string) => void;
  onClose: () => void;
}

function ModalBaixaPagar({ lancamento, onConfirm, onClose }: ModalBaixaPagarProps) {
  const [tipoBaixa, setTipoBaixa] = useState<"total" | "parcial">("total");
  const [valorBaixar, setValorBaixar] = useState(lancamento.valorLiquido);
  const [conta, setConta] = useState(lancamento.contaPagadora || "Conta Corrente Principal");
  const [forma, setForma] = useState(lancamento.formaPagamento || "PIX");
  const [obs, setObs] = useState("");
  const [dataBaixa, setDataBaixa] = useState(hoje());
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!valorBaixar || valorBaixar <= 0) { toast.error("Informe um valor válido."); return; }
    if (valorBaixar > lancamento.valorLiquido) { toast.error("Valor não pode ser maior que o saldo a pagar."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    onConfirm(lancamento.id, tipoBaixa, valorBaixar, conta, forma, obs, dataBaixa);
    setLoading(false);
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
          <Select value={conta} onValueChange={setConta}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Conta Corrente Principal">C/C Principal</SelectItem>
              <SelectItem value="Conta Reserva / Impostos">C/C Reserva</SelectItem>
              <SelectItem value="Cartão Corporativo Digital">Cartão Corporativo Digital</SelectItem>
              <SelectItem value="Caixa Interno — Pequenos Gastos">Caixa Físico</SelectItem>
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
  const [lancamentos, setLancamentos] = useState<LancamentoPagar[]>(MOCK_PAGAR);
  const [showNovo, setShowNovo] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [editando, setEditando] = useState<LancamentoPagar | null>(null);
  const [baixando, setBaixando] = useState<LancamentoPagar | null>(null);
  const [buscaRapida, setBuscaRapida] = useState("");
  const [filtros, setFiltros] = useState<FiltrosAvancados>({ ...FILTROS_BLANK });
  const [filtrosAtivos, setFiltrosAtivos] = useState<FiltrosAvancados>({ ...FILTROS_BLANK });

  const [form, setForm] = useState({ ...FORM_BLANK });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parcelamento
  const [gerarParcelas, setGerarParcelas] = useState(false);
  const [numParcelas, setNumParcelas] = useState(1);

  // ── Valores derivados ──
  const valorLiquido = calcLiquidoPagar(form.valorOriginal, form.desconto, form.multa, form.juros, form.impostosRetidos);
  useEffect(() => { setForm(p => ({ ...p, valorLiquido })); }, [valorLiquido]);

  // ── KPIs ──
  const totalAPagar = lancamentos.filter(l => l.status === "a_vencer" || l.status === "parcial")
    .reduce((a, l) => a + l.valorLiquido, 0);
  const totalAtrasado = lancamentos.filter(l => l.status === "vencida").reduce((a, l) => a + l.valorLiquido, 0);
  const totalPagoMes = lancamentos.filter(l => l.status === "paga").reduce((a, l) => a + l.valorLiquido, 0);
  const totalProvisao = lancamentos.filter(l => l.status === "provisao").reduce((a, l) => a + l.valorLiquido, 0);

  // ── Filtros ──
  const lancFiltrados = lancamentos.filter(l => {
    const q = buscaRapida.toLowerCase();
    const passaBusca = !q || l.favorecidoNome.toLowerCase().includes(q) || l.documentoNF.toLowerCase().includes(q);
    const passaStatus = !filtrosAtivos.status || filtrosAtivos.status === "todos" || l.status === filtrosAtivos.status;
    const passaCategoria = !filtrosAtivos.categoria || l.categoria === filtrosAtivos.categoria;
    return passaBusca && passaStatus && passaCategoria;
  });

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

  // ── Salvar ──
  const handleSalvar = async () => {
    if (!validar()) { toast.error("Preencha os campos obrigatórios corretamente."); return; }
    setIsSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 750));

      if (editando) {
        setLancamentos(prev => prev.map(l =>
          l.id === editando.id ? { ...l, ...form, valorLiquido, id: l.id, parcelas: l.parcelas } : l
        ));
        toast.success("Despesa atualizada com sucesso.");
      } else {
        const novo: LancamentoPagar = { ...form, id: gerarId(), valorLiquido, parcelas: [] };

        if (gerarParcelas && numParcelas > 1 && form.vencimento) {
          const valParcela = Math.round((valorLiquido / numParcelas) * 100) / 100;
          const base = new Date(form.vencimento + "T12:00:00");
          novo.parcelas = Array.from({ length: numParcelas }, (_, i) => {
            const dt = new Date(base); dt.setMonth(dt.getMonth() + i);
            return {
              id: gerarId() + i, despesaId: novo.id, numero: i + 1, totalParcelas: numParcelas,
              vencimento: dt.toISOString().split("T")[0], dataPrevistaPgto: dt.toISOString().split("T")[0],
              valorOriginal: valParcela, desconto: 0, edulta: 0, juros: 0, impostosRetidos: 0,
              valorLiquido: valParcela, status: "a_vencer" as const,
            } as any;
          });
          // Se for parcelado, dividimos o original e liquido
          novo.valorOriginal = valParcela;
          novo.valorLiquido = valParcela;
          novo.documentoNF += " (1/" + numParcelas + ")";
          for(let i=1; i<numParcelas; i++){
            const pData = novo.parcelas[i];
            const px = {...novo, id: pData.id, vencimento: pData.vencimento, dataPrevistaPgto: pData.dataPrevistaPgto, documentoNF: form.documentoNF + " ("+(i+1)+"/"+numParcelas+")"};
            setLancamentos(pr => [...pr, px]);
          }
        }
        setLancamentos(prev => [novo, ...prev]);
        toast.success("Nova despesa cadastrada!");
      }
      setShowNovo(false);
      setEditando(null);
      setForm({ ...FORM_BLANK });
      setErros({});
      setGerarParcelas(false);
      setNumParcelas(1);
    } catch {
      toast.error("Erro ao salvar despesa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Ações ──
  const handleBaixa = (id: number, tipo: "total" | "parcial", valor: number, conta: string, forma: string, obs: string, data: string) => {
    setLancamentos(prev => prev.map(l => l.id !== id ? l : {
      ...l, status: tipo === "total" ? "paga" : "parcial",
      dataEfetivaPgto: data, valorBaixado: valor, contaPagadora: conta, formaPagamento: forma, observacoes: (l.observacoes + "\nPgto: " + obs).trim()
    } as LancamentoPagar));
    toast.success(tipo === "total" ? "Cheque/Baixa total registrada!" : "Baixa parcial registrada com sucesso");
    setBaixando(null);
  };
  const handleCancelar = (id: number) => {
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: "cancelada" } : l));
    toast.success("Documento cancelado.");
  };

  const abrirEditar = (l: LancamentoPagar) => {
    setEditando(l);
    setForm({
      favorecidoNome: l.favorecidoNome, favorecidoCnpjCpf: l.favorecidoCnpjCpf, documentoNF: l.documentoNF, tipoDocumento: l.tipoDocumento,
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
  const filtrosAtivosCount = Object.values(filtrosAtivos).filter(v => v && v !== "todos").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total a Pagar", value: totalAPagar, icon: ArrowUpRight, gradient: "from-orange-500 to-red-500", bg: "from-orange-500 to-red-600" },
          { label: "Atrasado", value: totalAtrasado, icon: AlertTriangle, gradient: "from-red-600 to-rose-700", bg: "from-red-600 to-rose-800" },
          { label: "Provisões", value: totalProvisao, icon: FileText, gradient: "from-slate-500 to-slate-700", bg: "from-slate-500 to-slate-800" },
          { label: "Pago no Mês", value: totalPagoMes, icon: CheckCircle2, gradient: "from-emerald-500 to-green-600", bg: "from-emerald-500 to-green-700" },
        ].map(k => (
          <div key={k.label} className="relative overflow-hidden rounded-xl border bg-card shadow-sm hover:translate-y-[-2px] transition-transform p-4 flex items-center justify-between">
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${k.gradient}`} />
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="text-xl font-black text-foreground mt-1">{fmtBRL(k.value)}</p>
            </div>
            <div className={`p-2 rounded-xl bg-gradient-to-br ${k.bg} shadow-sm`}><k.icon className="w-4 h-4 text-white" /></div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar favorecido, doc ou NF..." value={buscaRapida} onChange={e => setBuscaRapida(e.target.value)} className="pl-9 h-9" />
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
              {lancFiltrados.map((l) => (
                <TableRow key={l.id} className="hover:bg-muted/20 group">
                  <TableCell className="pl-5 py-3">
                    <p className="font-semibold text-sm text-orange-700 dark:text-orange-400 font-mono">{l.documentoNF || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{l.tipoDocumento}</p>
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="font-semibold text-sm max-w-[200px] truncate" title={l.favorecidoNome}>{l.favorecidoNome}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{l.favorecidoCnpjCpf || "—"}</p>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-[10px] font-medium max-w-[120px] truncate">{l.categoria}</Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{l.centroResultado}</p>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-muted-foreground">{l.competencia || "—"}</TableCell>
                  <TableCell className="py-3 text-sm font-medium">{fmtData(l.vencimento)}</TableCell>
                  <TableCell className="py-3 text-right pr-5 font-black text-sm">{fmtBRL(l.valorLiquido)}</TableCell>
                  <TableCell className="py-3"><StatusBadge status={l.status} /></TableCell>
                  <TableCell className="py-3 text-right pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => abrirEditar(l)}><Eye className="w-4 h-4 mr-2" /> Ver / Editar</DropdownMenuItem>
                        {["a_vencer", "vencida", "provisao"].includes(l.status) && <DropdownMenuItem onClick={() => setBaixando(l)} className="text-emerald-700"><CheckCircle2 className="w-4 h-4 mr-2" /> Registrar Pagamento</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        {!["paga", "cancelada"].includes(l.status) && <DropdownMenuItem onClick={() => handleCancelar(l.id)} className="text-red-600"><X className="w-4 h-4 mr-2" /> Cancelar</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                  <FornecedorAutocomplete value={form.favorecidoNome} onSelect={f => { setForm({ ...form, favorecidoNome: f.nome, favorecidoCnpjCpf: f.documento }); setErros({ ...erros, fornecedor: "" }); }} error={erros.fornecedor} />
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
                  <SelectItem value="paga">Pago (Liquidado)</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setShowNovo(false)} disabled={isSubmitting} className="h-10">Cancelar</Button>
              <Button onClick={handleSalvar} disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white h-10">
                {isSubmitting ? "Salvando..." : <><Check className="w-4 h-4 mr-2" /> Salvar Despesa</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Baixa */}
      {baixando && <Dialog open={!!baixando} onOpenChange={() => setBaixando(null)}><ModalBaixaPagar lancamento={baixando} onConfirm={handleBaixa} onClose={() => setBaixando(null)} /></Dialog>}
    </div>
  );
}
