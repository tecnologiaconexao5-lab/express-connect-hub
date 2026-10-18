import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2,
  Package, Hash, Search, Camera, Signature,
  AlertTriangle, XCircle, Eye, MoreHorizontal,
  Pencil, RefreshCw, Layers, FileText,
  Receipt, CircleDollarSign, Banknote, FileWarning, Plus, Settings2, Scale, Truck, UserRound, MoveHorizontal
} from "lucide-react";
import {
  PRESET_ESSENCIAL,
  PRESET_COMPLETA,
  CHAVE_COLUNAS_LOCAL,
  lerColunasDoModo,
  calcularResumoLancamento,
} from "@/services/financeiro/centralFinanceiroVisao";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import PaginationBar from "@/components/ui/PaginationBar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buscarCentralFinanceiro,
  buscarDocumentosFiscaisDaOS,
  salvarRomaneioOS,
  type CentralItemFinanceiro,
  type CentralFiltros,
} from "@/services/financeiro/centralFinanceiroService";
import DossieEntregaSheet from "@/components/comprovantes/DossieEntregaSheet";
import KmEvidenciasPanel from "@/components/operacao/KmEvidenciasPanel";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FaturaPanel, type ItemSelecionadoFatura } from "./FaturaPanel";
import { supabase } from "@/lib/supabase";
import { mascararCPF, mascararTelefone } from "@/lib/masking";
import { useTenant } from "@/contexts/TenantContext";
import { buscarTabelaValoresCliente, buscarTabelaPrestador } from "@/services/precificacao/buscarTabelasService";

const fmtM = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const numF = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// FIN-UX-02A — tamanho de página profissional, consistente com o sistema
// (Contas a Receber / Margem por OS usam 25).
const PAGE_SIZE_CONFERENCIA = 25;

// A31-J1 — etapas do lançamento manual premium (navegação/âncora visual)
const ETAPAS_LANCAMENTO = [
  { id: "identificacao", label: "Identificação", sub: "Data, Romaneio e Cliente", icon: Hash },
  { id: "operacao", label: "Operação", sub: "Origem, destino e KM", icon: Truck },
  { id: "prestador", label: "Prestador / Veículo", sub: "Quem executou o serviço", icon: UserRound },
  { id: "financeiro-cliente", label: "Financeiro Cliente", sub: "Receita / cobrança", icon: ArrowUpRight },
  { id: "financeiro-prestador", label: "Financeiro Prestador", sub: "Custos / repasse / reembolso", icon: ArrowDownRight },
  { id: "itens-adicionais", label: "Itens Adicionais", sub: "Pedágios, ajudantes e diárias", icon: Layers },
  { id: "observacoes", label: "Observações", sub: "Informações complementares", icon: FileText },
  { id: "resumo", label: "Resumo Final", sub: "Conferência e lançamento", icon: Receipt },
];

interface NFVinculada {
  id: string;
  numero?: string | null;
  serie?: string | null;
  chave_acesso?: string | null;
  valor_total?: number | null;
  peso_total?: number | null;
  volumes?: number | null;
  emitente_nome?: string | null;
  status?: string | null;
  tipo_documento?: string | null;
}

// A31E — prestador/motorista para o lançamento manual (mesma fonte da Escala)
interface PrestadorLancamento {
  id: string;
  nome: string;
  cpfCnpj?: string;
  telefone?: string;
  whatsapp?: string;
  veiculo?: string;
  placa?: string;
}

const STATUS_OPERACIONAL_LABEL: Record<string, string> = {
  planejada: "Planejada",
  aguardando_aceite: "Aguardando Aceite",
  aceita: "Aceita",
  em_rota: "Em Rota",
  concluida: "Concluída",
  cancelada: "Cancelada",
  recusada: "Recusada",
};

const POD_LABEL: Record<string, string> = {
  completo: "POD completo",
  parcial: "POD parcial",
  entregue_ressalva: "Com ressalva",
  nao_entregue: "Não entregue",
  pendente: "POD pendente",
};

function SemafaroDot({ situacao, motivos }: { situacao: string; motivos: string[] }) {
  const conf = {
    verde: { bg: "bg-emerald-500", ring: "ring-emerald-200", label: "Pronto" },
    amarelo: { bg: "bg-amber-400", ring: "ring-amber-200", label: "Atenção" },
    vermelho: { bg: "bg-red-500", ring: "ring-red-200", label: "Bloqueio" },
  }[situacao] || { bg: "bg-slate-400", ring: "ring-slate-200", label: "—" };
  return (
    <div className="flex items-center gap-2" title={motivos.join(" · ")}>
      <span className={`w-3 h-3 rounded-full ${conf.bg} ring-4 ${conf.ring} shrink-0`} />
      <span className="text-[10px] font-semibold text-slate-600">{conf.label}</span>
    </div>
  );
}

function ValorCell({ valor, className = "" }: { valor: number; className?: string }) {
  return valor > 0 ? (
    <span className={`text-xs font-semibold tabular-nums ${className}`}>{fmtM(valor)}</span>
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  );
}

// A31F — componentes elevados para o escopo do módulo.
// Definir componentes dentro do corpo de outro componente faz o React tratar o
// tipo como NOVO a cada render, remontando o subtree inteiro (e perde o foco de
// inputs a cada tecla). Mover para o módulo estabiliza a identidade do tipo e
// preserva foco durante digitação contínua (causa-raiz do campo "Número da NF").

function Grupo({
  titulo,
  chave,
  secoesAbertas,
  toggleSecao,
  children,
}: {
  titulo: string;
  chave?: string;
  secoesAbertas: Record<string, boolean>;
  toggleSecao: (k: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => chave && toggleSecao(chave)}
        className={`w-full flex items-center justify-between text-left mb-2 ${chave ? "cursor-pointer hover:text-[#F97316]" : ""}`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{titulo}</p>
        {chave && (
          <span className={`text-[10px] text-slate-400 transition-transform ${secoesAbertas[chave] ? "" : "rotate-180"}`}>▾</span>
        )}
      </button>
      {(!chave || secoesAbertas[chave]) && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function CardResumo({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <div className="rounded-xl border bg-slate-50/60 p-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-sm font-extrabold tabular-nums mt-0.5 ${cor}`}>{valor}</p>
    </div>
  );
}

function Linha({ label, valor, mono }: { label: string; valor: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold text-slate-800 text-right ${mono ? "tabular-nums" : ""}`}>{valor}</span>
    </div>
  );
}

function DossieFinanceiroSheet({
  item,
  open,
  onOpenChange,
  onRomaneioSalvo,
}: {
  item: CentralItemFinanceiro | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRomaneioSalvo: (novoRomaneio: string) => void;
}) {
  const [romaneio, setRomaneio] = useState("");
  const [salvandoRomaneio, setSalvandoRomaneio] = useState(false);
  const [notasFiscais, setNotasFiscais] = useState<NFVinculada[]>([]);
  const [carregandoNotas, setCarregandoNotas] = useState(false);
  const [dossiePodId, setDossiePodId] = useState<string | null>(null);
  const [msgRomaneio, setMsgRomaneio] = useState<string | null>(null);
  const [mostrarFormNF, setMostrarFormNF] = useState(false);
  const [mostrarLoteNF, setMostrarLoteNF] = useState(false);
  const [nfLote, setNfLote] = useState("");
  const [salvandoNF, setSalvandoNF] = useState(false);
  const [msgNF, setMsgNF] = useState<string | null>(null);
  const [novaNF, setNovaNF] = useState({ numero: "", serie: "", chave_acesso: "", valor_total: "", emitente_nome: "" });
  // A31B — complementação manual ("Completar Serviço" / "Editar informações")
  const [complemento, setComplemento] = useState<Record<string, string | number>>({});
  const [salvandoComplemento, setSalvandoComplemento] = useState(false);
  const [msgComplemento, setMsgComplemento] = useState<string | null>(null);
  const [dossieEdicaoNF, setDossieEdicaoNF] = useState<NFVinculada | null>(null);
  // A31-J1.6 — comprovante de pedágio (estrutura oficial reembolsos_prestador)
  const [comprovantePedagio, setComprovantePedagio] = useState<{ comprovante_url: string | null; valor: number | null } | null>(null);
  const [formEdicaoNF, setFormEdicaoNF] = useState({ numero: "", serie: "", chave_acesso: "", valor_total: "", emitente_nome: "" });
  // A31F — NF aguardando confirmação de desvinculação (AlertDialog)
  const [nfParaRemover, setNfParaRemover] = useState<NFVinculada | null>(null);
  // A31D — seções recolhíveis do dossiê
  const [secoesAbertas, setSecoesAbertas] = useState<Record<string, boolean>>({
    identificacao: true,
    operacao: true,
    financeiroCliente: true,
    financeiroPrestador: true,
    margem: true,
    pod: true,
    faturamento: true,
    recebimento: true,
    nfs: true,
  });
  const toggleSecao = (k: string) => setSecoesAbertas((p) => ({ ...p, [k]: !p[k] }));

  const recarregarNFs = useCallback(async () => {
    if (!item?.osId) return;
    setCarregandoNotas(true);
    const { listarNFsDaOS } = await import("@/services/financeiro/faturaService");
    const lista = await listarNFsDaOS(item.osId);
    setNotasFiscais(lista as unknown as NFVinculada[]);
    setCarregandoNotas(false);
  }, [item?.osId]);

  const handleAdicionarNF = async () => {
    if (!item?.osId) return;
    setSalvandoNF(true);
    setMsgNF(null);
    const { adicionarNFaOS } = await import("@/services/financeiro/faturaService");
    const res = await adicionarNFaOS({
      osId: item.osId,
      numero: novaNF.numero || undefined,
      serie: novaNF.serie || undefined,
      chave_acesso: novaNF.chave_acesso || undefined,
      valor_total: novaNF.valor_total ? Number(novaNF.valor_total) : undefined,
      emitente_nome: novaNF.emitente_nome || undefined,
    });
    setSalvandoNF(false);
    if (res.success) {
      setNovaNF({ numero: "", serie: "", chave_acesso: "", valor_total: "", emitente_nome: "" });
      setMostrarFormNF(false);
      setMsgNF("NF vinculada ao serviço.");
      await recarregarNFs();
    } else {
      setMsgNF(res.error || "Erro ao adicionar NF");
    }
  };

  // A31C — NF em lote: separa por vírgula, ponto e vírgula, espaço ou quebra de linha;
  // apenas Número é obrigatório (série/chave/valor/emitente ficam em branco).
  // A31F — impede duplicidade dentro do lote E com NFs já vinculadas ao MESMO serviço.
  const handleAdicionarNFsEmLote = async () => {
    if (!item?.osId) return;
    const numeros = nfLote
      .split(/[\s,;]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    const semDuplicados = Array.from(new Set(numeros));
    if (semDuplicados.length === 0) { setMsgNF("Informe ao menos um número de NF."); return; }
    setSalvandoNF(true);
    setMsgNF(null);
    const { adicionarNFaOS, listarNumerosNFsDaOS } = await import("@/services/financeiro/faturaService");
    const jaVinculados = await listarNumerosNFsDaOS(item.osId);
    let ok = 0;
    let jaExistentes = 0;
    const erros: string[] = [];
    for (const numero of semDuplicados) {
      if (jaVinculados.has(numero)) {
        jaExistentes++;
        continue;
      }
      const res = await adicionarNFaOS({ osId: item.osId, numero });
      if (res.success) {
        ok++;
        jaVinculados.add(numero);
      } else {
        erros.push(`${numero}: ${res.error || "erro"}`);
      }
    }
    setSalvandoNF(false);
    if (ok > 0) {
      setNfLote("");
      setMostrarLoteNF(false);
      const partes = [`${ok} NF${ok === 1 ? "" : "s"} vinculada${ok === 1 ? "" : "s"} com sucesso`];
      if (jaExistentes > 0) partes.push(`${jaExistentes} já existente${jaExistentes === 1 ? "" : "s"} neste serviço`);
      if (erros.length > 0) partes.push(`${erros.length} falha(s): ${erros.join(" | ")}`);
      setMsgNF(`${partes.join(" · ")}.`);
      await recarregarNFs();
    } else if (jaExistentes > 0) {
      setNfLote("");
      setMostrarLoteNF(false);
      setMsgNF(`Nenhuma NF nova — ${jaExistentes} já existente${jaExistentes === 1 ? "" : "s"} neste serviço.`);
      await recarregarNFs();
    } else {
      setMsgNF(erros.join(" | ") || "Nenhuma NF vinculada");
    }
  };

  // A31B — complementação manual: carrega campos financeiros atuais da alocação
  const carregarComplemento = useCallback(async (alocacaoId: string) => {
    if (!alocacaoId) return;
    const { buscarCamposFinanceirosAlocacao } = await import("@/services/financeiro/centralFinanceiroService");
    const dados = await buscarCamposFinanceirosAlocacao(alocacaoId);
    if (!dados) return;
    const mapa: Record<string, string | number> = {};
    const campos: Array<[string, string]> = [
      ["km_realizados", "kmRealizados"],
      ["valor_frete", "valorFrete"],
      ["valor_repasse", "valorRepasse"],
      ["valor_pedagio", "valorPedagio"],
      ["valor_combustivel", "valorCombustivel"],
      ["valor_ajudante", "valorAjudante"],
      ["diarias_adicionais", "diariasAdicionais"],
      ["valor_diaria", "valorDiaria"],
      ["valor_segunda_saida", "valorSegundaSaida"],
      ["valor_terceira_saida", "valorTerceiraSaida"],
      ["saidas_adicionais", "saidasAdicionais"],
      ["valor_saida_adicional", "valorSaidaAdicional"],
      ["ajudantes", "ajudantes"],
      ["valor_ajudante_unit", "valorAjudanteUnit"],
      ["valor_reembolso_outros", "valorReembolsoOutros"],
      ["valor_adicional", "valorAdicional"],
      ["valor_desconto", "valorDesconto"],
      ["valor_desconto_prestador", "valorDescontoPrestador"],
    ];
    for (const [coluna, chave] of campos) {
      const v = dados[coluna];
      if (typeof v === "number" || typeof v === "string") mapa[chave] = v;
    }
    setComplemento(mapa);
  }, []);

  const handleSalvarComplemento = async () => {
    if (!item?.alocacaoId) { setMsgComplemento("Alocação sem vínculo."); return; }
    setSalvandoComplemento(true);
    setMsgComplemento(null);
    const { salvarComplementoFinanceiroAlocacao } = await import("@/services/financeiro/centralFinanceiroService");
    const campos: Record<string, number> = {};
    const numCampos: Array<[string, string]> = [
      ["km_realizados", "kmRealizados"],
      ["valor_frete", "valorFrete"],
      ["valor_repasse", "valorRepasse"],
      ["valor_pedagio", "valorPedagio"],
      ["valor_combustivel", "valorCombustivel"],
      ["valor_ajudante", "valorAjudante"],
      ["diarias_adicionais", "diariasAdicionais"],
      ["valor_diaria", "valorDiaria"],
      ["valor_segunda_saida", "valorSegundaSaida"],
      ["valor_terceira_saida", "valorTerceiraSaida"],
      ["saidas_adicionais", "saidasAdicionais"],
      ["valor_saida_adicional", "valorSaidaAdicional"],
      ["ajudantes", "ajudantes"],
      ["valor_ajudante_unit", "valorAjudanteUnit"],
      ["valor_reembolso_outros", "valorReembolsoOutros"],
      ["valor_adicional", "valorAdicional"],
      ["valor_desconto", "valorDesconto"],
      ["valor_desconto_prestador", "valorDescontoPrestador"],
    ];
    for (const [coluna, chave] of numCampos) {
      const v = complemento[chave];
      if (v === undefined || v === null || v === "") continue;
      campos[coluna] = Number(v);
    }
    if (Object.keys(campos).length === 0) { setMsgComplemento("Nenhum valor para salvar."); setSalvandoComplemento(false); return; }
    const res = await salvarComplementoFinanceiroAlocacao(item.alocacaoId, campos);
    setSalvandoComplemento(false);
    if (res.success) {
      setMsgComplemento("Informações complementadas em alocacoes_escala (mesma fonte da Programação Operacional).");
      onRomaneioSalvo(item.romaneioOC || item.romaneio || "");
    } else {
      setMsgComplemento(res.error || "Erro ao complementar serviço.");
    }
  };

  const setComplementoNum = (chave: string, v: string) => {
    setComplemento((p) => ({ ...p, [chave]: v === "" ? "" : Number(v) }));
  };

  const handleSalvarEdicaoNF = async () => {
    if (!dossieEdicaoNF?.id) return;
    setSalvandoNF(true);
    setMsgNF(null);
    const { atualizarNFdaOS } = await import("@/services/financeiro/faturaService");
    const res = await atualizarNFdaOS(dossieEdicaoNF.id, {
      numero: formEdicaoNF.numero || undefined,
      serie: formEdicaoNF.serie || undefined,
      chave_acesso: formEdicaoNF.chave_acesso || undefined,
      valor_total: formEdicaoNF.valor_total ? Number(formEdicaoNF.valor_total) : undefined,
      emitente_nome: formEdicaoNF.emitente_nome || undefined,
    });
    setSalvandoNF(false);
    if (res.success) {
      setDossieEdicaoNF(null);
      setMsgNF("NF atualizada.");
      await recarregarNFs();
    } else {
      setMsgNF(res.error || "Erro ao editar NF");
    }
  };

  useEffect(() => {
    if (open && item) {
      setRomaneio(item.romaneioOC || item.romaneio || "");
      setMsgRomaneio(null);
      setNotasFiscais([]);
      setMsgComplemento(null);
      if (item.alocacaoId) {
        carregarComplemento(item.alocacaoId);
        // A31-J1.6 — comprovante de pedágio (reembolsos_prestador oficial)
        import("@/services/operacao/reembolsoPedagioService")
          .then(({ buscarComprovantePedagio }) => buscarComprovantePedagio(item.alocacaoId as string))
          .then((c) => setComprovantePedagio(c))
          .catch(() => setComprovantePedagio(null));
      }
      if (item.osId) {
        setCarregandoNotas(true);
        buscarDocumentosFiscaisDaOS(item.osId)
          .then(setNotasFiscais)
          .finally(() => setCarregandoNotas(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.osId]);

  if (!item) return null;

  const handleSalvarRomaneio = async () => {
    if (!item.osId) { setMsgRomaneio("OS sem vínculo para salvar."); return; }
    setSalvandoRomaneio(true);
    setMsgRomaneio(null);
    const res = await salvarRomaneioOS(item.osId, romaneio);
    setSalvandoRomaneio(false);
    if (res.success) {
      setMsgRomaneio("Romaneio/OC atualizado na OS com sucesso.");
      onRomaneioSalvo(romaneio.trim());
    } else {
      setMsgRomaneio(res.error || "Erro ao salvar romaneio.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-[#F97316]" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-sm font-bold">Detalhes do Serviço</SheetTitle>
              <SheetDescription className="text-[11px]">
                {item.osNumero ? (
                  <>OS Interna: <span className="font-bold text-slate-700">{item.osNumero}</span></>
                ) : (
                  <span className="text-amber-600 font-semibold">Serviço sem OS Interna vinculada</span>
                )}
                {item.romaneioOC ? ` · Romaneio ${item.romaneioOC}` : ""}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 border p-3">
            <SemafaroDot situacao={item.semaforo} motivos={item.semaforoMotivos} />
            <div className="flex flex-wrap gap-1 ml-auto">
              {item.semaforoMotivos.slice(0, 4).map((m, i) => (
                <Badge key={i} variant="outline" className="text-[9px] text-slate-600">{m}</Badge>
              ))}
            </div>
          </div>

          {/* A31D — cards compactos de resumo */}
          <div className="grid grid-cols-2 gap-2">
            <CardResumo label="Total Cliente" valor={fmtM(item.valorClienteTotal)} cor="text-blue-600" />
            <CardResumo label="Total Prestador" valor={fmtM(item.valorPrestadorTotal)} cor="text-orange-600" />
            <CardResumo
              label="Margem"
              valor={fmtM(item.composicao?.margem_bruta ?? item.valorClienteTotal - item.valorPrestadorTotal)}
              cor={(item.composicao?.margem_bruta ?? item.valorClienteTotal - item.valorPrestadorTotal) >= 0 ? "text-emerald-600" : "text-red-600"}
            />
            <CardResumo
              label="POD"
              valor={item.pod?.situacao === "pendente" ? "Pendente" : POD_LABEL[item.pod?.situacao || "pendente"]}
              cor={item.pod?.situacao === "pendente" ? "text-amber-600" : item.pod?.situacao === "nao_entregue" ? "text-red-600" : "text-emerald-600"}
            />
          </div>

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Identificação" chave="identificacao">
            <Linha label="OS Interna" valor={
              item.osNumero ? <span className="font-bold text-slate-800">{item.osNumero}</span> : <span className="text-amber-600 font-semibold">não informada</span>
            } mono={!!item.osNumero} />
            <Linha label="Cliente" valor={
              item.clienteId ? item.clienteNome : <span className="text-amber-600 font-semibold">{item.clienteNome || "NÃO INFORMADO"}</span>
            } />
            <Linha label="Data" valor={item.data ? new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR") : "—"} />
            <Linha label="Prestador" valor={item.prestadorNome} />
            <Linha label="Veículo" valor={item.tipoVeiculo ? `${item.tipoVeiculo}${item.placa ? ` (${item.placa})` : ""}` : item.placa || "—"} />
          </Grupo>

          {!item.clienteId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
              <p className="font-bold mb-0.5">Pendência cadastral</p>
              <p>O serviço não possui cliente identificado. A emissão definitiva de fatura fica bloqueada até o cliente ser vinculado no módulo de origem (OS/Programação).</p>
            </div>
          )}

          <Separator />

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Referência do Cliente">
            <div className="space-y-2">
              <Input
                value={romaneio}
                onChange={(e) => setRomaneio(e.target.value)}
                placeholder="Informe o Romaneio ou OC do cliente"
                className="h-9"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[11px]"
                  onClick={handleSalvarRomaneio}
                  disabled={salvandoRomaneio || !item.osId}
                >
                  {salvandoRomaneio ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Pencil className="w-3 h-3 mr-1" />}
                  Salvar na OS
                </Button>
                {!romaneio && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    Romaneio/OC pendente
                  </Badge>
                )}
              </div>
              {msgRomaneio && (
                <p className={`text-[11px] ${msgRomaneio.includes("sucesso") ? "text-emerald-600" : "text-red-600"}`}>{msgRomaneio}</p>
              )}
              <p className="text-[10px] text-slate-400">
                Salvo diretamente em <code>ordens_servico.romaneio</code> (fonte oficial — mesmo registro da OS).
              </p>
            </div>
          </Grupo>

          <Separator />

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Operação" chave="operacao">
            <Linha label="Origem" valor={item.origem || "—"} />
            <Linha label="Destino" valor={item.destino || "—"} />
            <Linha label="Status Operacional" valor={STATUS_OPERACIONAL_LABEL[item.statusOperacional] || item.statusOperacional || "—"} />
            <Linha label="Finalizada" valor={item.finalizada ? "Sim" : "Não"} />
            <div className="pt-1">
              <KmEvidenciasPanel osId={item.osId} alocacaoId={item.alocacaoId} />
            </div>
            {comprovantePedagio?.comprovante_url && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-100 bg-rose-50/40 px-2.5 py-2 mt-1.5">
                <span className="text-[11px] font-semibold text-slate-600">Comprovante de pedágio</span>
                <span className="flex items-center gap-1.5">
                  {comprovantePedagio.valor != null && (
                    <span className="text-[11px] font-bold text-rose-700 tabular-nums">{fmtM(comprovantePedagio.valor)}</span>
                  )}
                  <a href={comprovantePedagio.comprovante_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-rose-600 hover:underline">Ver</a>
                  <a href={comprovantePedagio.comprovante_url} download className="text-[10px] font-bold text-slate-500 hover:underline">Baixar</a>
                </span>
              </div>
            )}
          </Grupo>

          <Separator />

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Financeiro Cliente" chave="financeiroCliente">
            <Linha label="Valor base / frete" valor={<ValorCell valor={item.valorClienteBase} />} mono />
            <Linha label="Adicionais" valor={<ValorCell valor={item.valorClienteAdicionais} className="text-emerald-600" />} mono />
            <Linha label="Descontos" valor={<ValorCell valor={item.valorClienteDescontos} className="text-red-600" />} mono />
            <div className="flex items-center justify-between gap-2 text-sm border-t border-slate-100 pt-1.5 mt-1">
              <span className="font-bold text-slate-700">Total Cliente</span>
              <span className="font-extrabold text-blue-600 tabular-nums">{fmtM(item.valorClienteTotal)}</span>
            </div>
          </Grupo>

          <Separator />

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Financeiro Prestador" chave="financeiroPrestador">
            <Linha label="Repasse base" valor={<ValorCell valor={item.valorPrestadorBase} />} mono />
            <Linha label="Adicionais / reembolsos" valor={<ValorCell valor={item.valorPrestadorAdicionais} className="text-emerald-600" />} mono />
            <Linha label="Descontos" valor={<ValorCell valor={item.valorPrestadorDescontos} className="text-red-600" />} mono />
            <div className="flex items-center justify-between gap-2 text-sm border-t border-slate-100 pt-1.5 mt-1">
              <span className="font-bold text-slate-700">Total Prestador</span>
              <span className="font-extrabold text-orange-600 tabular-nums">{fmtM(item.valorPrestadorTotal)}</span>
            </div>
          </Grupo>

          {item.composicao && (
            <>
              <Separator />
              <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Margem do Serviço" chave="margem">
                <Linha label="Receita Cliente" valor={fmtM(item.composicao.valor_cliente)} mono />
                <Linha label="Custo Prestador" valor={fmtM(item.composicao.valor_prestador)} mono />
                <div className="flex items-center justify-between gap-2 text-sm border-t border-slate-100 pt-1.5 mt-1">
                  <span className="font-bold text-slate-700">Margem Bruta</span>
                  <span className={`font-extrabold tabular-nums ${item.composicao.margem_bruta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {fmtM(item.composicao.margem_bruta)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">Margem Líquida</span>
                  <span className={`font-bold tabular-nums ${item.composicao.margem_liquida >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {fmtM(item.composicao.margem_liquida)}
                  </span>
                </div>
              </Grupo>
            </>
          )}

          <Separator />

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Completar Serviço (complementação manual)">
            <p className="text-[10px] text-slate-400 mb-2">
              Edita diretamente em <code>alocacoes_escala</code> — mesma fonte da Programação Operacional/TMS (não é base paralela). O trigger financeiro propaga para receber/pagar.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] text-slate-500">KM realizados</Label>
                <Input type="number" className="h-8 text-xs" value={complemento.kmRealizados ?? ""} onChange={(e) => setComplementoNum("kmRealizados", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Valor frete (cliente)</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorFrete ?? ""} onChange={(e) => setComplementoNum("valorFrete", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Repasse (prestador)</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorRepasse ?? ""} onChange={(e) => setComplementoNum("valorRepasse", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Pedágio</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorPedagio ?? ""} onChange={(e) => setComplementoNum("valorPedagio", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Combustível</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorCombustivel ?? ""} onChange={(e) => setComplementoNum("valorCombustivel", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Ajudante (total)</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorAjudante ?? ""} onChange={(e) => setComplementoNum("valorAjudante", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Diárias adicionais</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.diariasAdicionais ?? ""} onChange={(e) => setComplementoNum("diariasAdicionais", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Valor diária</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorDiaria ?? ""} onChange={(e) => setComplementoNum("valorDiaria", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Saídas adicionais</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.saidasAdicionais ?? ""} onChange={(e) => setComplementoNum("saidasAdicionais", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Valor saída adicional</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorSaidaAdicional ?? ""} onChange={(e) => setComplementoNum("valorSaidaAdicional", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Reembolsos outros</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorReembolsoOutros ?? ""} onChange={(e) => setComplementoNum("valorReembolsoOutros", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Desconto Cliente</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorDesconto ?? ""} onChange={(e) => setComplementoNum("valorDesconto", e.target.value)} />
              </div>
              <div>
                <Label className="text-[9px] text-slate-500">Desconto/Ajuste Prestador</Label>
                <Input type="number" step="0.01" className="h-8 text-xs" value={complemento.valorDescontoPrestador ?? ""} onChange={(e) => setComplementoNum("valorDescontoPrestador", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                className="h-8 text-[11px] bg-[#F97316] hover:bg-[#EA580C]"
                onClick={handleSalvarComplemento}
                disabled={salvandoComplemento}
              >
                {salvandoComplemento ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Pencil className="w-3 h-3 mr-1" />}
                Salvar informações
              </Button>
              {msgComplemento && (
                <span className={`text-[11px] ${msgComplemento.includes("mesma fonte") ? "text-emerald-600" : "text-red-600"}`}>{msgComplemento}</span>
              )}
            </div>
          </Grupo>

          <Separator />

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Evidências (POD)" chave="pod">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{POD_LABEL[item.pod?.situacao || "pendente"]}</Badge>
                <div className="flex items-center gap-1">
                  {item.pod?.temFoto && <span title="Foto" className="text-emerald-600"><Camera className="w-3.5 h-3.5" /></span>}
                  {item.pod?.temCanhoto && <span title="Canhoto" className="text-emerald-600"><FileText className="w-3.5 h-3.5" /></span>}
                  {item.pod?.temAssinatura && <span title="Assinatura" className="text-emerald-600"><Signature className="w-3.5 h-3.5" /></span>}
                </div>
              </div>
              {item.pod?.podId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] text-[#F97316] border-[#E5E7EB] hover:bg-[#F97316]/10"
                  onClick={() => setDossiePodId(item.pod!.podId)}
                >
                  <Eye className="w-3 h-3 mr-1" /> Ver comprovante
                </Button>
              )}
            </div>
            {item.pod?.recebedor && <p className="text-[10px] text-slate-500 mt-1">Recebedor: {item.pod.recebedor}</p>}
          </Grupo>

          <Separator />

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Faturamento / Fiscal" chave="faturamento">
            <Linha label="Fatura" valor={
              item.faturamento.status === "faturado" && item.faturamento.numero
                ? <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-700">{item.faturamento.numero}</Badge>
                : item.faturamento.status === "rascunho"
                  ? <Badge variant="outline" className="text-[9px] bg-slate-100 text-slate-600">Rascunho</Badge>
                  : <span className="text-slate-400">Não faturado</span>
            } />
            <Linha label="NFS-e / CT-e" valor={
              notasFiscais.length > 0
                ? <Badge variant="outline" className="text-[9px] bg-violet-50 text-violet-700">{notasFiscais.length} doc(s) fiscal(is)</Badge>
                : <span className="text-slate-400">Sem documentos vinculados</span>
            } />
          </Grupo>

          <Separator />

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Recebimento / Pagamento" chave="recebimento">
            <Linha label="Recebimento do Cliente" valor={
              item.receber
                ? <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700">{item.receber.status}{item.receber.fatura ? ` · ${item.receber.fatura}` : ""}</Badge>
                : <span className="text-slate-400">Sem título vinculado</span>
            } />
            <Linha label="Pagamento do Prestador" valor={
              item.pagamentoPrestador
                ? <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700">{item.pagamentoPrestador.status_pagamento || item.pagamentoPrestador.status}</Badge>
                : <span className="text-slate-400">Sem fechamento vinculado</span>
            } />
            <Linha label="Conta a Pagar" valor={
              item.pagar
                ? <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700">{item.pagar.status}</Badge>
                : <span className="text-slate-400">Sem título vinculado</span>
            } />
          </Grupo>

          <Separator />

          <Grupo secoesAbertas={secoesAbertas} toggleSecao={toggleSecao} titulo="Notas fiscais transportadas" chave="nfs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] text-slate-400">NFs da carga/mercadoria transportada</span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] text-violet-600 border-[#E5E7EB] hover:bg-violet-50"
                  onClick={() => { setMostrarLoteNF((v) => !v); setMostrarFormNF(false); setMsgNF(null); }}
                >
                  <Layers className="w-3 h-3 mr-1" /> NFs em lote
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] text-[#F97316] border-[#E5E7EB] hover:bg-[#F97316]/10"
                  onClick={() => { setMostrarFormNF((v) => !v); setMostrarLoteNF(false); setMsgNF(null); }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar NF com detalhes
                </Button>
              </div>
            </div>

            {mostrarLoteNF && (
              <div className="rounded-lg border bg-violet-50/40 p-3 space-y-2 mb-2">
                <Label className="text-[10px] text-muted-foreground">
                  Números das NF (separados por vírgula, ponto e vírgula, espaço ou quebra de linha)
                </Label>
                <Textarea
                  className="text-xs"
                  rows={4}
                  placeholder={"123456\n789101\n112233, 445566; 778899"}
                  value={nfLote}
                  onChange={(e) => setNfLote(e.target.value)}
                />
                <p className="text-[10px] text-slate-400">Apenas o número é obrigatório. Duplicados são ignorados.</p>
                {msgNF && <p className="text-[11px] text-amber-600">{msgNF}</p>}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setMostrarLoteNF(false)}>Cancelar</Button>
                  <Button size="sm" className="h-7 text-[10px] bg-violet-600 hover:bg-violet-700" onClick={handleAdicionarNFsEmLote} disabled={salvandoNF || !nfLote.trim()}>
                    {salvandoNF ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Layers className="w-3 h-3 mr-1" />} Vincular em lote
                  </Button>
                </div>
              </div>
            )}

            {mostrarFormNF && (
              <div className="rounded-lg border bg-slate-50/60 p-3 space-y-2 mb-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input className="h-8 text-xs" placeholder="Número da NF" value={novaNF.numero} onChange={(e) => setNovaNF((p) => ({ ...p, numero: e.target.value }))} />
                  <Input className="h-8 text-xs" placeholder="Série" value={novaNF.serie} onChange={(e) => setNovaNF((p) => ({ ...p, serie: e.target.value }))} />
                </div>
                <Input className="h-8 text-xs" placeholder="Chave de acesso" value={novaNF.chave_acesso} onChange={(e) => setNovaNF((p) => ({ ...p, chave_acesso: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input className="h-8 text-xs" placeholder="Valor (R$)" type="number" value={novaNF.valor_total} onChange={(e) => setNovaNF((p) => ({ ...p, valor_total: e.target.value }))} />
                  <Input className="h-8 text-xs" placeholder="Emitente" value={novaNF.emitente_nome} onChange={(e) => setNovaNF((p) => ({ ...p, emitente_nome: e.target.value }))} />
                </div>
                {msgNF && <p className="text-[11px] text-amber-600">{msgNF}</p>}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setMostrarFormNF(false)}>Cancelar</Button>
                  <Button size="sm" className="h-7 text-[10px] bg-[#F97316] hover:bg-[#EA580C]" onClick={handleAdicionarNF} disabled={salvandoNF || !novaNF.numero.trim()}>
                    {salvandoNF ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />} Vincular NF
                  </Button>
                </div>
              </div>
            )}

            {carregandoNotas ? (
              <Skeleton className="h-10 w-full" />
            ) : notasFiscais.length === 0 ? (
              <div className="rounded-lg border border-dashed p-3 text-center">
                <FileWarning className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                <p className="text-[11px] text-slate-400">Nenhuma nota fiscal vinculada</p>
                <p className="text-[10px] text-slate-300">Use "+ Adicionar NF" para vincular a(s) NF(s) transportada(s).</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {notasFiscais.map((nf) => (
                  <div key={nf.id} className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50/60 px-2.5 py-1.5 text-xs">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-700">NF {nf.numero || nf.chave_acesso?.slice(0, 10) || "—"}</span>
                      <span className="text-[10px] text-slate-500">
                        {nf.serie ? `Série ${nf.serie}` : ""} · {nf.valor_total ? fmtM(Number(nf.valor_total)) : "—"}
                        {nf.status === "desvinculada" ? <span className="ml-1 text-amber-600 font-semibold">(desvinculada)</span> : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => {
                            setDossieEdicaoNF(nf);
                            setFormEdicaoNF({ numero: nf.numero || "", serie: nf.serie || "", chave_acesso: nf.chave_acesso || "", valor_total: nf.valor_total != null ? String(nf.valor_total) : "", emitente_nome: nf.emitente_nome || "" });
                          }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Editar NF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setNfParaRemover(nf)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-2" /> Remover NF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Grupo>
        </div>

        <SheetFooter className="border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </SheetFooter>
      </SheetContent>

      <DossieEntregaSheet
        open={!!dossiePodId}
        onOpenChange={(o) => { if (!o) setDossiePodId(null); }}
        podId={dossiePodId || ""}
        numeroOs={item.osNumero}
      />

      <Sheet open={!!dossieEdicaoNF} onOpenChange={(o) => { if (!o) setDossieEdicaoNF(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="border-b pb-4">
            <SheetTitle className="text-sm font-bold">Editar NF transportada</SheetTitle>
            <SheetDescription className="text-[11px]">
              NF {dossieEdicaoNF?.numero || dossieEdicaoNF?.chave_acesso?.slice(0, 10) || "—"} — {dossieEdicaoNF?.status || "vinculada"}
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input className="h-8 text-xs" placeholder="Número da NF" value={formEdicaoNF.numero} onChange={(e) => setFormEdicaoNF((p) => ({ ...p, numero: e.target.value }))} />
              <Input className="h-8 text-xs" placeholder="Série" value={formEdicaoNF.serie} onChange={(e) => setFormEdicaoNF((p) => ({ ...p, serie: e.target.value }))} />
            </div>
            <Input className="h-8 text-xs" placeholder="Chave de acesso" value={formEdicaoNF.chave_acesso} onChange={(e) => setFormEdicaoNF((p) => ({ ...p, chave_acesso: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input className="h-8 text-xs" placeholder="Valor (R$)" type="number" value={formEdicaoNF.valor_total} onChange={(e) => setFormEdicaoNF((p) => ({ ...p, valor_total: e.target.value }))} />
              <Input className="h-8 text-xs" placeholder="Emitente" value={formEdicaoNF.emitente_nome} onChange={(e) => setFormEdicaoNF((p) => ({ ...p, emitente_nome: e.target.value }))} />
            </div>
            <p className="text-[10px] text-slate-400">
              Edição bloqueada se a NF estiver vinculada a CT-e/MDF-e emitido.
            </p>
            {msgNF && <p className="text-[11px] text-amber-600">{msgNF}</p>}
          </div>
          <SheetFooter className="border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setDossieEdicaoNF(null)}>Cancelar</Button>
            <Button size="sm" className="bg-[#F97316] hover:bg-[#EA580C]" onClick={handleSalvarEdicaoNF} disabled={salvandoNF || !formEdicaoNF.numero.trim()}>
              {salvandoNF ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Pencil className="w-3 h-3 mr-1" />} Salvar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* A31F — confirmação para desvincular NF do serviço (proteção fiscal) */}
      <AlertDialog open={!!nfParaRemover} onOpenChange={(o) => { if (!o) setNfParaRemover(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold">Desvincular NF deste serviço?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Remover NF <strong>{nfParaRemover?.numero || nfParaRemover?.chave_acesso?.slice(0, 10) || "—"}</strong> do serviço {item.osNumero || "atual"}?
              A NF deixa de ser vinculada a este serviço. Se estiver vinculada a um CT-e/MDF-e emitido, a remoção será bloqueada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!nfParaRemover) return;
                const alvo = nfParaRemover;
                setNfParaRemover(null);
                setMsgNF(null);
                const { removerNFdaOS } = await import("@/services/financeiro/faturaService");
                const res = await removerNFdaOS(alvo.id);
                if (res.success) {
                  setMsgNF("NF desvinculada do serviço.");
                  await recarregarNFs();
                } else {
                  setMsgNF(res.error || "Erro ao remover NF");
                }
              }}
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

export default function ConferenciaFinanceira() {
  const [itens, setItens] = useState<CentralItemFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  // TMS-FAT-URG-04 — visão DEFAULT operacional: apenas serviços NÃO FATURADOS.
  // Serviços já em fatura ativa (rascunho/aguardando/aprovada) ou emitidos saem
  // da fila padrão; permanecem consultáveis via filtro "Faturado" ou "Todos".
  const [filtros, setFiltros] = useState<CentralFiltros>({ faturado: "nao_faturado" });
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<CentralItemFinanceiro | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  // FIN-UX-02A — paginação real da Conferência (página atual)
  const [pagina, setPagina] = useState(1);
  const [painelFatura, setPainelFatura] = useState(false);
  const [avisoFatura, setAvisoFatura] = useState<string | null>(null);
  const [regrasClientesMap, setRegrasClientesMap] = useState<Record<string, { exigeRomaneioOC: boolean }>>({});
  // A31B — alternância de visão da Central
  const [modoVisao, setModoVisao] = useState<"essencial" | "completa">("essencial");
  // A31-J0 — presets de colunas por visão (Essencial resumido / Completa analítica).
  // "Colunas" é a personalização manual SOBRE o preset da visão ativa, salvo por modo.
  const COLUNAS_PADRAO: Record<string, boolean> = { ...PRESET_COMPLETA };
  const [colunasEssencial, setColunasEssencial] = useState<Record<string, boolean>>(() =>
    lerColunasDoModo("essencial", (() => {
      try { return localStorage.getItem(CHAVE_COLUNAS_LOCAL); } catch { return null; }
    })()),
  );
  const [colunasCompleta, setColunasCompleta] = useState<Record<string, boolean>>(() =>
    lerColunasDoModo("completa", (() => {
      try {
        return localStorage.getItem(CHAVE_COLUNAS_LOCAL) ?? localStorage.getItem("central_financeira_colunas_v1");
      } catch { return null; }
    })()),
  );
  const colunasVisiveis = modoVisao === "essencial" ? colunasEssencial : colunasCompleta;
  const salvarColunas = (modo: "essencial" | "completa", cols: Record<string, boolean>) => {
    try {
      const atual = JSON.parse(localStorage.getItem(CHAVE_COLUNAS_LOCAL) || "{}");
      localStorage.setItem(CHAVE_COLUNAS_LOCAL, JSON.stringify({ ...atual, [modo]: cols }));
    } catch { /* ignore */ }
  };
  const toggleColuna = (key: string) => {
    if (modoVisao === "essencial") {
      const next = { ...colunasEssencial, [key]: !colunasEssencial[key] };
      setColunasEssencial(next);
      salvarColunas("essencial", next);
    } else {
      const next = { ...colunasCompleta, [key]: !colunasCompleta[key] };
      setColunasCompleta(next);
      salvarColunas("completa", next);
    }
  };
  // A31C — lançamento manual de serviço pela Central
  const [mostrarLancamento, setMostrarLancamento] = useState(false);
  const [salvandoLancamento, setSalvandoLancamento] = useState(false);
  const [msgLancamento, setMsgLancamento] = useState<string | null>(null);
  const [formLancamento, setFormLancamento] = useState({
    data_escala: new Date().toISOString().split("T")[0],
    cliente_id: "",
    cliente_nome: "",
    prestador_id: "",
    prestador_nome: "",
    romaneio: "",
    origem: "",
    destino: "",
    tipo_veiculo: "",
    placa: "",
    km_realizados: "",
    valor_frete: "",
    valor_repasse: "",
    valor_pedagio: "",
    valor_combustivel: "",
    valor_reembolso_outros: "",
    valor_ajudante: "",
    diarias_adicionais: "",
    valor_diaria: "",
    valor_adicional: "",
    valor_desconto: "",
    valor_desconto_prestador: "",
    pedagio_cobrar_excedente: false,
    comprovante_pedagio_url: "",
    observacoes: "",
  });

  // A31-J1.4 — tabelas/regras da Escala para o lançamento manual (cliente e prestador)
  const { tenant } = useTenant();
  const [tabelaManual, setTabelaManual] = useState<{
    cliente: { nome: string; fonte: string; valorBase: number; franquia: number; valorKm: number } | null;
    prestador: { nome: string; fonte: string; valorBase: number; franquia: number; valorKm: number } | null;
  }>({ cliente: null, prestador: null });
  const [carregandoTabelaManual, setCarregandoTabelaManual] = useState(false);

  // A31-J1.4 — tabela comercial ATIVA do cliente (mesma seleção da Escala)
  useEffect(() => {
    let ativo = true;
    const f = async () => {
      if (!formLancamento.cliente_id || !formLancamento.tipo_veiculo.trim()) {
        setTabelaManual((p) => ({ ...p, cliente: null }));
        return;
      }
      setCarregandoTabelaManual(true);
      try {
        const { tabela } = await buscarTabelaValoresCliente({
          tenant_id: tenant?.id || "",
          cliente_id: formLancamento.cliente_id,
          tipo_veiculo: formLancamento.tipo_veiculo,
          tipo_operacao: "urbano",
          distancia_km: Number(formLancamento.km_realizados || 0),
          quantidade_paradas: 1,
          origem: { cidade: "", uf: "" },
          destino: { cidade: "", uf: "" },
          modo: "preview",
          data_operacao: formLancamento.data_escala,
        });
        if (!ativo) return;
        const valida = tabela && (tabela.fonte === "tabelas_valores" || tabela.fonte === "universal");
        setTabelaManual((p) => ({
          ...p,
          cliente: valida
            ? { nome: tabela.nome, fonte: tabela.fonte, valorBase: tabela.valor_base, franquia: tabela.franquia_km, valorKm: tabela.valor_km_excedente }
            : null,
        }));
        if (valida && formLancamento.valor_frete === "") {
          setFormLancamento((prev) => (prev.valor_frete === "" ? { ...prev, valor_frete: String(tabela.valor_base || "") } : prev));
        }
      } catch {
        if (ativo) setTabelaManual((p) => ({ ...p, cliente: null }));
      } finally {
        if (ativo) setCarregandoTabelaManual(false);
      }
    };
    f();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formLancamento.cliente_id, formLancamento.tipo_veiculo]);

  // A31-J1.4 — cadastro financeiro do PRESTADOR (mesma fonte da Escala)
  useEffect(() => {
    let ativo = true;
    const f = async () => {
      if (!formLancamento.prestador_id) {
        setTabelaManual((p) => ({ ...p, prestador: null }));
        return;
      }
      setCarregandoTabelaManual(true);
      try {
        const { tabela } = await buscarTabelaPrestador({
          tenant_id: tenant?.id || "",
          cliente_id: formLancamento.cliente_id || "",
          tipo_veiculo: formLancamento.tipo_veiculo,
          tipo_operacao: "urbano",
          distancia_km: Number(formLancamento.km_realizados || 0),
          quantidade_paradas: 1,
          origem: { cidade: "", uf: "" },
          destino: { cidade: "", uf: "" },
          prestador_id: formLancamento.prestador_id,
          modo: "preview",
          data_operacao: formLancamento.data_escala,
        });
        if (!ativo) return;
        const base = tabela.valor_saida || tabela.valor_minimo || tabela.valor_diaria || 0;
        const valida = tabela.fonte !== "nao_encontrada" && base > 0;
        setTabelaManual((p) => ({
          ...p,
          prestador: valida
            ? { nome: tabela.nome, fonte: tabela.fonte, valorBase: base, franquia: tabela.km_incluso || 0, valorKm: tabela.valor_km || 0 }
            : null,
        }));
        if (valida && formLancamento.valor_repasse === "") {
          setFormLancamento((prev) => (prev.valor_repasse === "" ? { ...prev, valor_repasse: String(base || "") } : prev));
        }
      } catch {
        if (ativo) setTabelaManual((p) => ({ ...p, prestador: null }));
      } finally {
        if (ativo) setCarregandoTabelaManual(false);
      }
    };
    f();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formLancamento.prestador_id, formLancamento.tipo_veiculo]);

  // A31E — prestadores para o lançamento manual (mesma fonte/query da Escala)
  const [prestadoresLancamento, setPrestadoresLancamento] = useState<PrestadorLancamento[]>([]);
  const [filtroPrestadorLancamento, setFiltroPrestadorLancamento] = useState("");
  const [showPrestadorDropdown, setShowPrestadorDropdown] = useState(false);

  // Carrega prestadores ativos (mesma fonte da Escala: prestadores + veiculos embutidos)
  useEffect(() => {
    let ativo = true;
    const carregarPrestadores = async () => {
      try {
        const { data, error } = await supabase
          .from("prestadores")
          .select("id, nome_completo, cpf_cnpj, telefone, whatsapp, veiculos(tipo, placa), status")
          .eq("status", "ativo")
          .limit(50);
        if (ativo && !error && data) {
          setPrestadoresLancamento(
            data.map((p: {
              id: string;
              nome_completo?: string | null;
              cpf_cnpj?: string | null;
              telefone?: string | null;
              whatsapp?: string | null;
              veiculos?: { tipo?: string | null; placa?: string | null }[] | null;
            }) => {
              const v = Array.isArray(p.veiculos) && p.veiculos.length > 0 ? p.veiculos[0] : null;
              return {
                id: String(p.id),
                nome: String(p.nome_completo || ""),
                cpfCnpj: p.cpf_cnpj ? String(p.cpf_cnpj) : undefined,
                telefone: p.telefone ? String(p.telefone) : undefined,
                whatsapp: p.whatsapp ? String(p.whatsapp) : undefined,
                veiculo: v?.tipo ? String(v.tipo) : undefined,
                placa: v?.placa ? String(v.placa) : undefined,
              };
            })
          );
        }
      } catch {
        // busca opcional — modal segue funcional sem a lista
      }
    };
    carregarPrestadores();
    return () => { ativo = false; };
  }, []);

  const prestadoresLancamentoFiltrados = useMemo(() => {
    const termo = filtroPrestadorLancamento.trim().toLowerCase();
    if (!termo) return prestadoresLancamento;
    return prestadoresLancamento.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        (p.placa && p.placa.toLowerCase().includes(termo)) ||
        (p.veiculo && p.veiculo.toLowerCase().includes(termo)) ||
        (p.cpfCnpj && p.cpfCnpj.toLowerCase().includes(termo)) ||
        (p.telefone && p.telefone.toLowerCase().includes(termo)) ||
        (p.whatsapp && p.whatsapp.toLowerCase().includes(termo))
    );
  }, [prestadoresLancamento, filtroPrestadorLancamento]);

  const selecionarPrestadorLancamento = (p: PrestadorLancamento) => {
    setFormLancamento((prev) => ({
      ...prev,
      prestador_id: p.id,
      prestador_nome: p.nome,
      // autopreenche veículo/placa quando houver dados cadastrados (ajustável)
      tipo_veiculo: prev.tipo_veiculo || p.veiculo || "",
      placa: prev.placa || p.placa || "",
    }));
    setFiltroPrestadorLancamento(p.nome);
    setShowPrestadorDropdown(false);
  };

  const limparPrestadorLancamento = () => {
    setFormLancamento((prev) => ({ ...prev, prestador_id: "", prestador_nome: "" }));
    setFiltroPrestadorLancamento("");
    setShowPrestadorDropdown(false);
  };

  // A31-J1 — navegação por etapas do lançamento premium (âncora visual, sem esconder campos)
  const [etapaLancamento, setEtapaLancamento] = useState("identificacao");
  const irParaEtapa = (id: string) => {
    setEtapaLancamento(id);
    document.getElementById(`lancamento-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const limparFormLancamento = () => {
    setFormLancamento({
      data_escala: new Date().toISOString().split("T")[0],
      cliente_id: "", cliente_nome: "", prestador_id: "", prestador_nome: "",
      romaneio: "", origem: "", destino: "",
      tipo_veiculo: "", placa: "", km_realizados: "", valor_frete: "", valor_repasse: "",
      valor_pedagio: "", valor_combustivel: "", valor_reembolso_outros: "", valor_ajudante: "", diarias_adicionais: "",
      valor_diaria: "", valor_adicional: "", valor_desconto: "", valor_desconto_prestador: "", pedagio_cobrar_excedente: false, comprovante_pedagio_url: "", observacoes: "",
    });
    setTabelaManual({ cliente: null, prestador: null });
    setFiltroPrestadorLancamento("");
    setMsgLancamento(null);
  };

  // A31-J1.4 — prévia financeira com as MESMAS fontes da Escala (tabela cliente +
  // cadastro prestador) e descontos separados por perna.
  const resumoLancamento = useMemo(
    () =>
      calcularResumoLancamento({
        ...formLancamento,
        tabela_km: {
          franquiaCliente: tabelaManual.cliente?.franquia,
          valorKmExcCliente: tabelaManual.cliente?.valorKm,
          franquiaPrestador: tabelaManual.prestador?.franquia,
          valorKmPrestador: tabelaManual.prestador?.valorKm,
        },
      }),
    [formLancamento, tabelaManual]
  );

  useEffect(() => {
    // A31 — carrega regras financeiras dos clientes presentes (para romaneio obrigatório)
    const carregarRegras = async () => {
      const clienteIds = new Set(itens.map((i) => i.clienteId).filter(Boolean));
      if (clienteIds.size === 0) { setRegrasClientesMap({}); return; }
      const mapa: Record<string, { exigeRomaneioOC: boolean }> = {};
      for (const id of clienteIds) {
        try {
          const { buscarRegrasFinanceirasCliente } = await import("@/services/financeiro/configFinanceiraService");
          const r = await buscarRegrasFinanceirasCliente(id);
          mapa[id] = { exigeRomaneioOC: r.exigeRomaneioOC };
        } catch {
          mapa[id] = { exigeRomaneioOC: false };
        }
      }
      setRegrasClientesMap(mapa);
    };
    carregarRegras();
  }, [itens]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const lista = await buscarCentralFinanceiro({ ...filtros, busca });
      setItens(lista);
      // FIN-UX-02A — qualquer mudança de filtros/busca/período retorna à página 1
      setPagina(1);
    } catch (e) {
      console.error("[CentralFinanceira] Erro:", e);
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados");
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [filtros, busca]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totais = useMemo(() => {
    return {
      qtd: itens.length,
      totalCliente: itens.reduce((s, a) => s + a.valorClienteTotal, 0),
      totalPrestador: itens.reduce((s, a) => s + a.valorPrestadorTotal, 0),
      margem: itens.reduce((s, a) => s + (a.composicao?.margem_bruta ?? a.valorClienteTotal - a.valorPrestadorTotal), 0),
      comPOD: itens.filter((a) => a.pod?.situacao !== "pendente").length,
      pendentes: itens.filter((a) => !a.pod || a.pod.situacao === "pendente").length,
      prontosFaturar: itens.filter((a) => a.faturamento.status === "nao_faturado" && a.clienteId && a.valorClienteTotal > 0 && a.romaneioOC && a.pod?.situacao !== "pendente").length,
      comPendencia: itens.filter((a) => a.semaforo === "amarelo" || a.semaforo === "vermelho").length,
      verde: itens.filter((a) => a.semaforo === "verde").length,
      amarelo: itens.filter((a) => a.semaforo === "amarelo").length,
      vermelho: itens.filter((a) => a.semaforo === "vermelho").length,
    };
  }, [itens]);

  const setFiltro = (key: keyof CentralFiltros, value: string | undefined) => {
    setFiltros((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const aplicarFiltros = () => {
    carregar();
  };

  const limparFiltros = () => {
    // TMS-FAT-URG-04 — "Limpar" restaura a visão DEFAULT operacional (não faturados).
    setFiltros({ faturado: "nao_faturado" });
    setBusca("");
    setTimeout(carregar, 0);
  };

  const aoSalvarRomaneio = (novoRomaneio: string) => {
    setItens((prev) =>
      prev.map((i) => (i.id === selecionado?.id ? { ...i, romaneio: novoRomaneio || null, romaneioOC: novoRomaneio || null } : i))
    );
    if (selecionado) setSelecionado({ ...selecionado, romaneio: novoRomaneio || null, romaneioOC: novoRomaneio || null });
  };

  // A31C — lançamento manual de serviço pela Central (fonte única: alocacoes_escala)
  const handleLancarServico = async () => {
    setSalvandoLancamento(true);
    setMsgLancamento(null);
    const { lancarServicoManual } = await import("@/services/financeiro/centralFinanceiroService");
    const num = (v: string) => (v === "" || v === undefined ? undefined : Number(v));
    const res = await lancarServicoManual({
      data_escala: formLancamento.data_escala,
      // TMS-FAT-URG-02 — tenant do contexto oficial (useTenant), nunca hardcoded.
      tenant_id: tenant?.id || null,
      cliente_id: formLancamento.cliente_id || null,
      prestador_id: formLancamento.prestador_id || null,
      romaneio: formLancamento.romaneio || null,
      origem: formLancamento.origem || null,
      destino: formLancamento.destino || null,
      tipo_veiculo: formLancamento.tipo_veiculo,
      placa: formLancamento.placa || null,
      km_realizados: num(formLancamento.km_realizados),
      valor_frete: num(formLancamento.valor_frete),
      valor_repasse: num(formLancamento.valor_repasse),
      valor_pedagio: num(formLancamento.valor_pedagio),
      valor_combustivel: num(formLancamento.valor_combustivel),
      valor_reembolso_outros: num(formLancamento.valor_reembolso_outros),
      valor_ajudante: num(formLancamento.valor_ajudante),
      diarias_adicionais: num(formLancamento.diarias_adicionais),
      valor_diaria: num(formLancamento.valor_diaria),
      valor_adicional: num(formLancamento.valor_adicional),
      valor_desconto: num(formLancamento.valor_desconto),
      valor_desconto_prestador: num(formLancamento.valor_desconto_prestador),
      observacoes: formLancamento.observacoes || null,
      // A31-J1.6 — pedágio único + cobrança ao cliente (flag oficial) e KM excedente
      pedagio_cobrar_excedente: !!formLancamento.pedagio_cobrar_excedente,
      franquia_km_cliente: tabelaManual.cliente?.franquia,
      valor_km_excedente_cliente: tabelaManual.cliente?.valorKm,
      franquia_km_prestador: tabelaManual.prestador?.franquia,
      valor_km_prestador: tabelaManual.prestador?.valorKm,
    });
    setSalvandoLancamento(false);
    if (res.success) {
      // A31-J1.6 — comprovante de pedágio na estrutura OFICIAL reembolsos_prestador
      if (res.alocacaoId && formLancamento.comprovante_pedagio_url.trim()) {
        try {
          const { salvarComprovantePedagio } = await import("@/services/operacao/reembolsoPedagioService");
          await salvarComprovantePedagio({
            os_id: res.alocacaoId,
            prestador: formLancamento.prestador_nome || null,
            valor: num(formLancamento.valor_pedagio) || 0,
            data_despesa: formLancamento.data_escala,
            comprovante_url: formLancamento.comprovante_pedagio_url.trim(),
            tenant_id: tenant?.id || null,
          });
        } catch { /* comprovante opcional — não bloqueia o lançamento */ }
      }
      setMsgLancamento("Serviço lançado com sucesso na Programação Operacional (fonte única).");
      setMostrarLancamento(false);
      limparFormLancamento();
      setEtapaLancamento("identificacao");
      carregar();
    } else {
      setMsgLancamento(res.error || "Erro ao lançar serviço");
    }
  };

  // ── Seleção múltipla para faturamento ───────────────────────────────────────
  const motivosBloqueio = (a: CentralItemFinanceiro): string[] => {
    const m: string[] = [];
    if (a.faturamento.status !== "nao_faturado") {
      m.push(a.faturamento.status === "faturado" ? "Já faturado" : "Em rascunho de fatura");
    }
    if (!a.clienteId) m.push("Sem cliente");
    if (a.valorClienteTotal <= 0) m.push("Sem valor faturável");
    // A31 — Romaneio/OC obrigatório por regra do cliente
    const regra = a.clienteId ? regrasClientesMap[a.clienteId] : undefined;
    if (regra?.exigeRomaneioOC && !a.romaneioOC) {
      m.push("Romaneio/OC obrigatório para este cliente");
    }
    return m;
  };

  const isElegivel = (a: CentralItemFinanceiro): boolean => motivosBloqueio(a).length === 0;

  // ── FIN-UX-02A — paginação real da Conferência ──────────────────────────────
  // O recorte da página é feito ANTES da renderização, sobre o conjunto COMPLETO
  // filtrado (sem LIMIT 300 silencioso no service). Busca/filtros/ordenação atuam
  // sobre o conjunto global; a página é apenas uma janela de visualização.
  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(itens.length / PAGE_SIZE_CONFERENCIA)),
    [itens.length]
  );
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);
  const itensPagina = useMemo(() => {
    const inicio = (pagina - 1) * PAGE_SIZE_CONFERENCIA;
    return itens.slice(inicio, inicio + PAGE_SIZE_CONFERENCIA);
  }, [itens, pagina]);
  // Semântica explícita: o checkbox de cabeçalho alterna SOMENTE os elegíveis desta
  // página (registros efetivamente carregados/visíveis), nunca "finge" selecionar
  // linhas de outras páginas. A seleção individual persiste por id entre páginas.
  const elegiveisPagina = itensPagina.filter(isElegivel);

  const toggleSelecao = (id: string) => {
    setAvisoFatura(null);
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const itensSelecionados = useMemo(
    () => itens.filter((i) => selecionados.has(i.id)),
    [itens, selecionados]
  );

  const totalSelecionado = useMemo(
    () => itensSelecionados.reduce((s, i) => s + i.valorClienteTotal, 0),
    [itensSelecionados]
  );

  const criarFatura = () => {
    setAvisoFatura(null);
    if (itensSelecionados.length === 0) {
      setAvisoFatura("Selecione ao menos um serviço para criar a fatura.");
      return;
    }
    // Regra crítica A30: UMA FATURA = UM ÚNICO CLIENTE
    const clientes = new Set(itensSelecionados.map((i) => i.clienteId).filter(Boolean));
    if (clientes.size > 1) {
      setAvisoFatura("Não é possível faturar serviços de clientes diferentes. Selecione somente serviços pertencentes ao mesmo cliente.");
      return;
    }
    // Cliente não informado: NÃO permitir emissão definitiva (pendência cadastral)
    const semCliente = itensSelecionados.filter((i) => !i.clienteId);
    if (semCliente.length > 0) {
      setAvisoFatura("Não é possível faturar serviços sem cliente identificado (pendência cadastral). Vincule o cliente no módulo de origem (OS/Programação) antes de faturar.");
      return;
    }
    const semRomaneio = itensSelecionados.filter((i) => !i.romaneioOC);
    const semPOD = itensSelecionados.filter((i) => !i.pod || i.pod.situacao === "pendente");
    if (semRomaneio.length > 0) {
      setAvisoFatura(`Atenção: ${semRomaneio.length} serviço(s) com Romaneio/OC pendente. Deseja continuar?`);
    }
    if (semPOD.length > 0) {
      setAvisoFatura((prev) => {
        const rom = prev ? `${prev} ` : "";
        return `${rom}Aviso: ${semPOD.length} serviço(s) com POD pendente.`;
      });
    }
    setPainelFatura(true);
  };

  const aposEmitirFatura = (numero: string) => {
    setPainelFatura(false);
    setSelecionados(new Set());
    setAvisoFatura(`Fatura ${numero} emitida com sucesso.`);
    carregar();
  };

  const itensParaFatura: ItemSelecionadoFatura[] = useMemo(
    () =>
      itensSelecionados.map((i) => ({
        osId: i.osId || "",
        alocacaoId: i.alocacaoId,
        clienteId: i.clienteId || "",
        romaneio: i.romaneioOC || i.romaneio,
        descricao: `${i.osNumero || "Serviço"} — ${i.origem || ""} → ${i.destino || ""}`.trim(),
        dataServico: i.data,
        valorBase: i.valorClienteBase,
        valorAdicionais: i.valorClienteAdicionais,
        valorDescontos: i.valorClienteDescontos,
        valorTotal: i.valorClienteTotal,
        kmExcedente: i.detalhe?.valorKmExcedenteCliente || 0,
        pedagioCliente: i.valorClienteAdicionais >= 0 ? i.valorClienteAdicionais : 0,
        ajudanteCliente: i.detalhe?.ajudanteCliente || 0,
        diariaCliente: i.detalhe?.diariasCliente || 0,
        saidasAdicionaisCliente: i.detalhe?.saidasCliente || 0,
        osNumero: i.osNumero,
      })),
    [itensSelecionados]
  );

  const renderPOD = (a: CentralItemFinanceiro) => {
    const s = a.pod?.situacao || "pendente";
    const cls =
      s === "completo" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
      s === "parcial" ? "bg-blue-50 text-blue-700 border-blue-200" :
      s === "entregue_ressalva" ? "bg-amber-50 text-amber-700 border-amber-200" :
      s === "nao_entregue" ? "bg-red-50 text-red-700 border-red-200" :
      "bg-slate-100 text-slate-600 border-slate-200";
    const Icon =
      s === "completo" ? CheckCircle2 :
      s === "parcial" ? FileText :
      s === "entregue_ressalva" ? AlertTriangle :
      s === "nao_entregue" ? XCircle :
      AlertTriangle;
    return (
      <div className="flex flex-col gap-1 min-w-[110px]">
        <Badge variant="outline" className={cls}>
          <Icon className="w-3 h-3 mr-1" /> {POD_LABEL[s]}
        </Badge>
        <div className="flex items-center gap-1 flex-wrap">
          {a.pod?.temFoto && <span title="Foto" className="text-emerald-600"><Camera className="w-3 h-3" /></span>}
          {a.pod?.temCanhoto && <span title="Canhoto" className="text-emerald-600"><FileText className="w-3 h-3" /></span>}
          {a.pod?.temAssinatura && <span title="Assinatura" className="text-emerald-600"><Signature className="w-3 h-3" /></span>}
          {a.pod?.recebedor && <span className="text-[9px] text-slate-500 truncate max-w-[70px]">{a.pod.recebedor}</span>}
        </div>
      </div>
    );
  };

  if (loading && itens.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (erro) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-red-500 font-medium">{erro}</p>
          <Button variant="outline" className="mt-4" onClick={carregar}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho da Central */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-white">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-[#F97316]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Central de Controle Financeiro</h2>
              <p className="text-[11px] text-muted-foreground">
                Rastreabilidade completa dos serviços, romaneios, faturamento e repasses.
              </p>
            </div>
          </div>
          <div className="md:ml-auto flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> {totais.verde} prontos
            </Badge>
            <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> {totais.amarelo} atenção
            </Badge>
            <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500" /> {totais.vermelho} bloqueio
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { title: "Serviços Finalizados", value: String(totais.qtd), icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { title: "Total a Receber (Cliente)", value: fmtM(totais.totalCliente), icon: ArrowDownRight, color: "text-blue-600", bg: "bg-blue-50" },
          { title: "Total a Pagar (Prestador)", value: fmtM(totais.totalPrestador), icon: ArrowUpRight, color: "text-orange-600", bg: "bg-orange-50" },
          { title: "Margem Estimada", value: fmtM(totais.margem), icon: Scale, color: totais.margem >= 0 ? "text-emerald-600" : "text-red-600", bg: totais.margem >= 0 ? "bg-emerald-50" : "bg-red-50" },
          { title: "Prontos p/ Faturar", value: String(totais.prontosFaturar), icon: Receipt, color: "text-indigo-600", bg: "bg-indigo-50" },
          { title: "Com Pendência", value: String(totais.comPendencia), icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((k) => (
          <div key={k.title} className="relative overflow-hidden bg-card border rounded-xl p-4 shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-200" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{k.title}</p>
                <p className={`text-base font-extrabold mt-1 ${k.color}`}>{k.value}</p>
              </div>
              <div className={`p-2 rounded-xl ${k.bg}`}>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alternância de visão A31B — Modo 1 Essencial / Modo 2 Financeira Completa */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#F97316]" />
            <span className="text-xs font-bold text-slate-700">Visão da Central</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setModoVisao("essencial")}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                modoVisao === "essencial" ? "bg-white shadow-sm text-[#F97316]" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Essencial
            </button>
            <button
              type="button"
              onClick={() => setModoVisao("completa")}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                modoVisao === "completa" ? "bg-white shadow-sm text-[#F97316]" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Financeira Completa
            </button>
          </div>
          <span className="text-[10px] text-slate-400">
            {modoVisao === "essencial"
              ? "Visão resumida para conferência rápida."
              : "Detalhamento de KM, adicionais, custos, recebimentos e pagamentos."}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-[#E5E7EB] text-slate-600 hover:bg-slate-50"
              >
                <Settings2 className="w-3.5 h-3.5 mr-1" /> Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-[70vh] overflow-y-auto">
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Colunas · {modoVisao === "essencial" ? "Essencial" : "Financeira Completa"}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-2 pb-2">
                {Object.entries(COLUNAS_PADRAO).map(([key, padrao]) => (
                  <label key={key} className="flex items-center gap-2 text-[11px] py-0.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="accent-[#F97316]"
                      checked={!!colunasVisiveis[key]}
                      onChange={() => toggleColuna(key)}
                    />
                    <span className="capitalize">{key}</span>
                  </label>
                ))}
              </div>
              <p className="px-2 pb-2 text-[9px] text-slate-400">Personalização sobre o preset da visão atual — salva no navegador.</p>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-8 text-xs border-[#E5E7EB] text-[#F97316] hover:bg-[#F97316]/10"
            onClick={() => { setMostrarLancamento(true); setMsgLancamento(null); setEtapaLancamento("identificacao"); }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Lançar Serviço
          </Button>
        </CardContent>
      </Card>

      {/* Barra de ação de faturamento (quando há seleção) */}
      {(selecionados.size > 0 || avisoFatura) && (
        <div className="sticky top-0 z-30 rounded-xl border-2 border-[#F97316]/30 bg-white shadow-lg p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F97316]/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[#F97316]" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-800">
                {selecionados.size} serviço(s) selecionado(s)
              </p>
              <p className="text-[11px] text-muted-foreground">
                Total Cliente: <span className="font-bold text-blue-600">{fmtM(totalSelecionado)}</span>
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {avisoFatura && (
              <span className="text-[11px] text-amber-600 font-medium max-w-xs">{avisoFatura}</span>
            )}
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setSelecionados(new Set()); setAvisoFatura(null); }}>
              Limpar seleção
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C]"
              onClick={criarFatura}
              disabled={selecionados.size === 0}
            >
              <Receipt className="w-3.5 h-3.5 mr-1" /> Criar Fatura
            </Button>
          </div>
        </div>
      )}

      {/* Filtros combinados */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-bold text-slate-700">Filtros combinados</span>
            <span className="text-[10px] text-slate-400">— combine período, cliente, prestador, OS, romaneio e mais</span>
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-[10px]" onClick={limparFiltros}>
              Limpar
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Período inicial</Label>
              <Input type="date" className="h-8 text-xs" value={filtros.dataInicio || ""} onChange={(e) => setFiltro("dataInicio", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Período final</Label>
              <Input type="date" className="h-8 text-xs" value={filtros.dataFim || ""} onChange={(e) => setFiltro("dataFim", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">OS Interna</Label>
              <Input className="h-8 text-xs" placeholder="OS-..." value={filtros.os || ""} onChange={(e) => setFiltro("os", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Romaneio/OC</Label>
              <Input className="h-8 text-xs" placeholder="343198..." value={filtros.romaneio || ""} onChange={(e) => setFiltro("romaneio", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Cliente</Label>
              <Input className="h-8 text-xs" placeholder="Nome..." value={filtros.cliente || ""} onChange={(e) => setFiltro("cliente", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Prestador</Label>
              <Input className="h-8 text-xs" placeholder="Nome..." value={filtros.prestador || ""} onChange={(e) => setFiltro("prestador", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Placa</Label>
              <Input className="h-8 text-xs uppercase" placeholder="AAA1A11" value={filtros.placa || ""} onChange={(e) => setFiltro("placa", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Status Operacional</Label>
              <Select value={filtros.statusOperacional || ""} onValueChange={(v) => setFiltro("statusOperacional", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_OPERACIONAL_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">POD</Label>
              <Select value={filtros.pod || ""} onValueChange={(v) => setFiltro("pod", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="com_pod">Com POD</SelectItem>
                  <SelectItem value="pendente">POD pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Faturamento (fila operacional)</Label>
              <Select value={filtros.faturado || "nao_faturado"} onValueChange={(v) => setFiltro("faturado", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Não faturado (fila)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_faturado">Não faturado (fila)</SelectItem>
                  <SelectItem value="em_processo">Em processo (rascunho)</SelectItem>
                  <SelectItem value="faturado">Faturado (emitido)</SelectItem>
                  <SelectItem value="todos">Todos (histórico)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Recebimento</Label>
              <Select value={filtros.recebimento || ""} onValueChange={(v) => setFiltro("recebimento", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recebido">Recebido</SelectItem>
                  <SelectItem value="nao_recebido">Não recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Pagto Prestador</Label>
              <Select value={filtros.pagamentoPrestador || ""} onValueChange={(v) => setFiltro("pagamentoPrestador", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="nao_pago">Não pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" className="h-8 text-xs w-full" onClick={aplicarFiltros}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Aplicar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Busca global + abas */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por OS, Romaneio, Cliente, Prestador, Placa..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") carregar(); }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={carregar}>
          Atualizar
        </Button>
      </div>

      {itens.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nenhum serviço finalizado encontrado</p>
            <p className="text-sm mt-1">
              Ajuste os filtros ou aguarde novas operações finalizadas pelo App Prestador.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="py-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#F97316]" />
                  Central — Serviços Finalizados
                </CardTitle>
                <CardDescription className="text-[11px]">
                  {itens.length} serviço(s) · página {pagina} de {totalPaginas} · cruza alocação + OS + cliente + prestador + POD + financeiro
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] gap-1"><CircleDollarSign className="w-3 h-3 text-blue-500" /> Receber {fmtM(totais.totalCliente)}</Badge>
                <Badge variant="outline" className="text-[10px] gap-1"><Banknote className="w-3 h-3 text-orange-500" /> Pagar {fmtM(totais.totalPrestador)}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative">
              <div className="overflow-x-auto">
                <Table className={modoVisao === "completa" ? "min-w-[1180px]" : undefined}>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60">
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        className="accent-[#F97316]"
                        checked={elegiveisPagina.length > 0 && elegiveisPagina.every((i) => selecionados.has(i.id))}
                        title="Selecionar elegíveis desta página"
                        aria-label="Selecionar elegíveis desta página"
                        onChange={() => {
                          const elegiveis = elegiveisPagina;
                          setAvisoFatura(null);
                          setSelecionados((prev) => {
                            const todosSel = elegiveis.every((i) => prev.has(i.id));
                            const next = new Set(prev);
                            elegiveis.forEach((i) => {
                              if (todosSel) next.delete(i.id);
                              else next.add(i.id);
                            });
                            return next;
                          });
                        }}
                      />
                    </TableHead>
                    {colunasVisiveis.status && <TableHead className="text-[10px] uppercase">Status</TableHead>}
                    {colunasVisiveis.data && <TableHead className="text-[10px] uppercase">Data</TableHead>}
                    {colunasVisiveis.os && <TableHead className="text-[10px] uppercase">OS Interna</TableHead>}
                    {colunasVisiveis.cliente && <TableHead className="text-[10px] uppercase">Cliente</TableHead>}
                    {colunasVisiveis.romaneio && <TableHead className="text-[10px] uppercase">Romaneio/OC</TableHead>}
                    {colunasVisiveis.prestador && <TableHead className="text-[10px] uppercase">Prestador</TableHead>}
                    {colunasVisiveis.veiculo && <TableHead className="text-[10px] uppercase">Veículo</TableHead>}
                    {modoVisao === "essencial" ? (
                      <>
                        {colunasVisiveis.valorCliente && <TableHead className="text-[10px] uppercase text-right">Valor Cliente</TableHead>}
                        {colunasVisiveis.adicCliente && <TableHead className="text-[10px] uppercase text-right">Adic. Cliente</TableHead>}
                        {colunasVisiveis.totalCliente && <TableHead className="text-[10px] uppercase text-right">Total Cliente</TableHead>}
                        {colunasVisiveis.valorPrestador && <TableHead className="text-[10px] uppercase text-right">Valor Prestador</TableHead>}
                        {colunasVisiveis.totalPrestador && <TableHead className="text-[10px] uppercase text-right">Total Prestador</TableHead>}
                      </>
                    ) : (
                      <>
                        <TableHead className="text-[10px] uppercase text-right">Km</TableHead>
                        {colunasVisiveis.kmExcedente && <TableHead className="text-[10px] uppercase text-right">KM Exced. Cli.</TableHead>}
                        {colunasVisiveis.pedagioCliente && <TableHead className="text-[10px] uppercase text-right">Pedágio Cli.</TableHead>}
                        {colunasVisiveis.adicCliente && <TableHead className="text-[10px] uppercase text-right">Ajud. Cli.</TableHead>}
                        {colunasVisiveis.totalCliente && <TableHead className="text-[10px] uppercase text-right">Diárias/Saídas</TableHead>}
                        {colunasVisiveis.totalCliente && <TableHead className="text-[10px] uppercase text-right">Total Cliente</TableHead>}
                        {colunasVisiveis.kmExcedente && <TableHead className="text-[10px] uppercase text-right">KM Exced. Prest.</TableHead>}
                        {colunasVisiveis.combustivelPrestador && <TableHead className="text-[10px] uppercase text-right">Comb./Pedágio</TableHead>}
                        {colunasVisiveis.reembolsoPrestador && <TableHead className="text-[10px] uppercase text-right">Ajud./Reemb.</TableHead>}
                        {colunasVisiveis.totalPrestador && <TableHead className="text-[10px] uppercase text-right">Total Prestador</TableHead>}
                      </>
                    )}
                    {colunasVisiveis.pod && <TableHead className="text-[10px] uppercase">POD</TableHead>}
                    {colunasVisiveis.receber && <TableHead className="text-[10px] uppercase">Receber</TableHead>}
                    {colunasVisiveis.faturamento && <TableHead className="text-[10px] uppercase">Faturar</TableHead>}
                    {colunasVisiveis.pagamento && <TableHead className="text-[10px] uppercase">Pagto</TableHead>}
                    {colunasVisiveis.acoes && <TableHead className="text-[10px] uppercase text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensPagina.map((a) => (
                    <TableRow
                      key={a.id}
                      className={`cursor-pointer hover:bg-slate-50/60 ${selecionados.has(a.id) ? "bg-[#F97316]/5" : ""}`}
                      onClick={() => setSelecionado(a)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="accent-[#F97316]"
                          checked={selecionados.has(a.id)}
                          disabled={!isElegivel(a)}
                          title={!isElegivel(a) ? motivosBloqueio(a).join(" · ") : "Selecionar para faturamento"}
                          onChange={() => toggleSelecao(a.id)}
                        />
                      </TableCell>
                      {colunasVisiveis.status && (
                        <TableCell>
                          <SemafaroDot situacao={a.semaforo} motivos={a.semaforoMotivos} />
                        </TableCell>
                      )}
                      {colunasVisiveis.data && (
                        <TableCell className="text-xs whitespace-nowrap">
                          {a.data ? new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                      )}
                      {colunasVisiveis.os && (
                        <TableCell className="text-xs">
                          {a.osNumero ? (
                            <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                              <Hash className="w-3 h-3 text-[#F97316]" /> {a.osNumero}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5" title="Serviço sem OS Interna vinculada — romaneio pode vir do App">
                              <AlertTriangle className="w-3 h-3" /> Sem OS
                            </span>
                          )}
                        </TableCell>
                      )}
                      {colunasVisiveis.cliente && <TableCell className="text-xs max-w-[140px] truncate" title={a.clienteNome}>{a.clienteNome}</TableCell>}
                      {colunasVisiveis.romaneio && (
                        <TableCell className="text-xs">
                          {a.romaneioOC ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5">
                              <Receipt className="w-3 h-3" /> {a.romaneioOC}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">pendente</span>
                          )}
                        </TableCell>
                      )}
                      {colunasVisiveis.prestador && <TableCell className="text-xs max-w-[130px] truncate" title={a.prestadorNome}>{a.prestadorNome}</TableCell>}
                      {colunasVisiveis.veiculo && (
                        <TableCell className="text-xs whitespace-nowrap">
                          {a.tipoVeiculo || "-"}{a.placa ? ` (${a.placa})` : ""}
                        </TableCell>
                      )}
                      {modoVisao === "essencial" ? (
                        <>
                          {colunasVisiveis.valorCliente && <TableCell className="text-right"><ValorCell valor={a.valorClienteBase} /></TableCell>}
                          {colunasVisiveis.adicCliente && <TableCell className="text-right"><ValorCell valor={a.valorClienteAdicionais} className="text-emerald-600" /></TableCell>}
                          {colunasVisiveis.totalCliente && <TableCell className="text-right"><span className="text-xs font-bold text-blue-600 tabular-nums">{fmtM(a.valorClienteTotal)}</span></TableCell>}
                          {colunasVisiveis.valorPrestador && <TableCell className="text-right"><ValorCell valor={a.valorPrestadorBase} /></TableCell>}
                          {colunasVisiveis.totalPrestador && <TableCell className="text-right"><span className="text-xs font-bold text-orange-600 tabular-nums">{fmtM(a.valorPrestadorTotal)}</span></TableCell>}
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right"><span className="text-xs text-slate-600 tabular-nums">{a.detalhe.kmRealizados > 0 ? `${a.detalhe.kmRealizados} km` : "—"}</span></TableCell>
                          {colunasVisiveis.kmExcedente && (
                            <TableCell className="text-right">
                              <ValorCell
                                valor={a.detalhe.valorKmExcedenteCliente}
                                className="text-violet-600"
                              />
                            </TableCell>
                          )}
                          {colunasVisiveis.pedagioCliente && <TableCell className="text-right"><ValorCell valor={a.detalhe.pedagioCliente} /></TableCell>}
                          {colunasVisiveis.adicCliente && <TableCell className="text-right"><ValorCell valor={a.detalhe.ajudanteCliente} /></TableCell>}
                          {colunasVisiveis.totalCliente && (
                            <TableCell className="text-right">
                              <ValorCell
                                valor={a.detalhe.diariasCliente + a.detalhe.saidasCliente}
                                className="text-emerald-600"
                              />
                            </TableCell>
                          )}
                          {colunasVisiveis.totalCliente && <TableCell className="text-right"><span className="text-xs font-bold text-blue-600 tabular-nums">{fmtM(a.valorClienteTotal)}</span></TableCell>}
                          {colunasVisiveis.kmExcedente && (
                            <TableCell className="text-right">
                              <ValorCell
                                valor={a.detalhe.valorKmExcedentePrestador}
                                className="text-violet-600"
                              />
                            </TableCell>
                          )}
                          {colunasVisiveis.combustivelPrestador && (
                            <TableCell className="text-right">
                              <ValorCell
                                valor={a.detalhe.combustivelPrestador + a.detalhe.pedagioPrestador}
                                className="text-emerald-600"
                              />
                            </TableCell>
                          )}
                          {colunasVisiveis.reembolsoPrestador && (
                            <TableCell className="text-right">
                              <ValorCell
                                valor={a.detalhe.ajudantePrestador + a.detalhe.reembolsoOutrosPrestador}
                                className="text-emerald-600"
                              />
                            </TableCell>
                          )}
                          {colunasVisiveis.totalPrestador && <TableCell className="text-right"><span className="text-xs font-bold text-orange-600 tabular-nums">{fmtM(a.valorPrestadorTotal)}</span></TableCell>}
                        </>
                      )}
                      {colunasVisiveis.pod && <TableCell>{renderPOD(a)}</TableCell>}
                      {colunasVisiveis.receber && (
                        <TableCell className="text-xs">
                          {a.receber ? (
                            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700">{a.receber.status}</Badge>
                          ) : <span className="text-[10px] text-slate-300">—</span>}
                        </TableCell>
                      )}
                      {colunasVisiveis.faturamento && (
                        <TableCell className="text-xs">
                          {a.faturamento.status === "faturado" ? (
                            <Badge variant="outline" className="text-[9px] bg-indigo-50 text-indigo-700">
                              {a.faturamento.numero || "Faturado"}
                            </Badge>
                          ) : a.faturamento.status === "rascunho" ? (
                            <Badge variant="outline" className="text-[9px] bg-slate-100 text-slate-600">Rascunho</Badge>
                          ) : (
                            <span className="text-[10px] text-slate-400">Não faturado</span>
                          )}
                        </TableCell>
                      )}
                      {colunasVisiveis.pagamento && (
                        <TableCell className="text-xs">
                          {a.pagamentoPrestador ? (
                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700">{a.pagamentoPrestador.status_pagamento || a.pagamentoPrestador.status}</Badge>
                          ) : <span className="text-[10px] text-slate-300">—</span>}
                        </TableCell>
                      )}
                      {colunasVisiveis.acoes && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setSelecionado(a)}>
                                <Eye className="w-3.5 h-3.5 mr-2" /> Ver dossiê
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSelecionado(a)}>
                                <Pencil className="w-3.5 h-3.5 mr-2" /> Editar Romaneio
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSelecionado(a)}>
                                <Layers className="w-3.5 h-3.5 mr-2" /> Completar Serviço
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              {modoVisao === "completa" && (
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/80 to-transparent" />
              )}
            </div>
            {modoVisao === "completa" && (
              <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-slate-400 border-t border-slate-100">
                <MoveHorizontal className="w-3 h-3 text-[#F97316]" />
                Tabela analítica — use a rolagem horizontal para ver todas as colunas.
              </div>
            )}
            {/* FIN-UX-02A — paginação real, numerada e visível (padrão do sistema) */}
            <div className="px-4 pb-4 border-t border-slate-100">
              <PaginationBar
                page={pagina}
                pageSize={PAGE_SIZE_CONFERENCIA}
                totalCount={itens.length}
                onPageChange={setPagina}
                loading={loading}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground text-right">
        Fonte: <strong>alocacoes_escala</strong> + <strong>ordens_servico</strong> (OS/romaneio) |
        POD: <strong>entregas_protocolo</strong> | Fin: <strong>financeiro_receber/pagar</strong> + <strong>pagamentos_prestadores</strong> |
        Margem: <strong>composicao_financeira_os</strong>
        {modoVisao === "completa" && <span> | Detalhe Modo 2: km/pedágio/combustível/ajudantes/diárias/saídas/reembolsos</span>}
      </div>

      <DossieFinanceiroSheet
        item={selecionado}
        open={!!selecionado}
        onOpenChange={(o) => { if (!o) setSelecionado(null); }}
        onRomaneioSalvo={aoSalvarRomaneio}
      />

      {/* A31C / A31-J1 — Lançamento manual premium (fonte única: alocacoes_escala) */}
      <Dialog open={mostrarLancamento} onOpenChange={(o) => { if (!o) { setMostrarLancamento(false); setMsgLancamento(null); } }}>
        <DialogContent className="sm:max-w-[1450px] w-[92vw] max-h-[94vh] p-0 overflow-hidden">
          <div className="flex flex-col h-[94vh]">
            <DialogHeader className="px-5 pt-4 pb-3 border-b bg-white shrink-0 pr-12">
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#F97316]" /> Lançar Serviço Manualmente
              </DialogTitle>
              <DialogDescription className="text-xs">
                Cria um serviço finalizado em <strong>alocacoes_escala</strong> (mesma fonte da Programação Operacional — sem base paralela e sem criar OS falsa). O romaneio fica em metadata para a Central localizar.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 min-h-0">
              {/* Índice lateral de etapas (navegação/âncora visual, sem esconder campos) */}
              <aside className="w-60 shrink-0 border-r bg-slate-50/70 p-3 overflow-y-auto">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Etapas</p>
                <nav className="space-y-1">
                  {ETAPAS_LANCAMENTO.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => irParaEtapa(e.id)}
                      className={`w-full text-left flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                        etapaLancamento === e.id ? "bg-[#F97316]/10" : "text-slate-600 hover:bg-white"
                      }`}
                    >
                      <e.icon className={`w-4 h-4 mt-0.5 ${etapaLancamento === e.id ? "text-[#F97316]" : "text-slate-400"}`} />
                      <span className="min-w-0">
                        <span className={`block text-[13px] font-semibold ${etapaLancamento === e.id ? "text-[#EA580C]" : "text-slate-700"}`}>{e.label}</span>
                        <span className={`block text-[11px] ${etapaLancamento === e.id ? "text-[#EA580C]/70" : "text-slate-400"}`}>{e.sub}</span>
                      </span>
                    </button>
                  ))}
                </nav>
              </aside>

              {/* Formulário principal */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
                {/* 1. IDENTIFICAÇÃO */}
                <section id="lancamento-identificacao" className="scroll-mt-2 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#F97316]/10"><Hash className="w-3 h-3 text-[#F97316]" /></span>
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">1. Identificação</span>
                    <span className="text-[11px] text-slate-400">Data, Romaneio e Cliente</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Data do serviço *</Label>
                      <Input type="date" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.data_escala} onChange={(e) => setFormLancamento((p) => ({ ...p, data_escala: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Romaneio / OC do Cliente</Label>
                      <Input className="h-8 text-sm placeholder:text-[13px]" placeholder="Referência externa do cliente" value={formLancamento.romaneio} onChange={(e) => setFormLancamento((p) => ({ ...p, romaneio: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Cliente</Label>
                      <SearchableSelect
                        table="clientes"
                        labelField="nome_fantasia"
                        valueField="id"
                        returnField="id"
                        secondaryField="cnpj"
                        searchFields={["nome_fantasia", "razao_social", "cnpj"]}
                        value={formLancamento.cliente_id || null}
                        onChange={(id, record) =>
                          setFormLancamento((p) => ({
                            ...p,
                            cliente_id: id || "",
                            cliente_nome: record?.nome_fantasia ? String(record.nome_fantasia) : record?.razao_social ? String(record.razao_social) : "",
                          }))
                        }
                        placeholder="Selecione o cliente..."
                      />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <Label className="text-xs font-medium">OS Interna Conexão</Label>
                      <div className="flex items-center gap-2 h-8 rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-2 text-[11px] text-slate-500">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Sem OS vinculada — lançamento manual cria alocação direta (sem número fictício). Romaneio/OC permanece como referência externa do cliente.
                      </div>
                    </div>
                  </div>
                </section>

                {/* 2. OPERAÇÃO */}
                <section id="lancamento-operacao" className="scroll-mt-2 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-100"><Truck className="w-3 h-3 text-slate-500" /></span>
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">2. Operação</span>
                    <span className="text-[11px] text-slate-400">Origem, destino e KM</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Origem</Label>
                      <Input className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.origem} onChange={(e) => setFormLancamento((p) => ({ ...p, origem: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Destino</Label>
                      <Input className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.destino} onChange={(e) => setFormLancamento((p) => ({ ...p, destino: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">KM realizados</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.km_realizados} onChange={(e) => setFormLancamento((p) => ({ ...p, km_realizados: e.target.value }))} />
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-slate-50/70 border border-slate-100 p-2.5">
                    <p className="text-[11px] font-semibold uppercase text-slate-500 mb-1.5">KM — Duas pernas (mesma lógica da Programação Operacional)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div><p className="text-[11px] uppercase text-slate-400 font-semibold">Franquia Cliente</p><p className="text-xs font-semibold text-slate-600">{tabelaManual.cliente ? `${resumoLancamento.franquiaCliente} km` : "—"}</p></div>
                      <div><p className="text-[11px] uppercase text-slate-400 font-semibold">KM Exced. Cliente</p><p className="text-xs font-semibold text-emerald-700">{tabelaManual.cliente ? `${resumoLancamento.excedenteCliente} km` : "—"}</p></div>
                      <div><p className="text-[11px] uppercase text-slate-400 font-semibold">R$/KM Cliente</p><p className="text-xs font-semibold text-slate-600">{tabelaManual.cliente ? fmtM(tabelaManual.cliente.valorKm) : "—"}</p></div>
                      <div><p className="text-[11px] uppercase text-slate-400 font-semibold">Exced. Cliente</p><p className="text-xs font-bold text-emerald-700">{tabelaManual.cliente ? fmtM(resumoLancamento.totalExcedenteCliente) : "—"}</p></div>
                      <div><p className="text-[11px] uppercase text-slate-400 font-semibold">Franquia Prestador</p><p className="text-xs font-semibold text-slate-600">{tabelaManual.prestador ? `${resumoLancamento.franquiaPrestador} km` : "—"}</p></div>
                      <div><p className="text-[11px] uppercase text-slate-400 font-semibold">KM Exced. Prestador</p><p className="text-xs font-semibold text-rose-700">{tabelaManual.prestador ? `${resumoLancamento.excedentePrestador} km` : "—"}</p></div>
                      <div><p className="text-[11px] uppercase text-slate-400 font-semibold">R$/KM Prestador</p><p className="text-xs font-semibold text-slate-600">{tabelaManual.prestador ? fmtM(tabelaManual.prestador.valorKm) : "—"}</p></div>
                      <div><p className="text-[11px] uppercase text-slate-400 font-semibold">Exced. Prestador</p><p className="text-xs font-bold text-rose-700">{tabelaManual.prestador ? fmtM(resumoLancamento.totalExcedentePrestador) : "—"}</p></div>
                    </div>
                    {(!tabelaManual.cliente || !tabelaManual.prestador) && (
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {carregandoTabelaManual
                          ? "Buscando tabela comercial / cadastro do prestador..."
                          : "Sem tabela aplicável para cliente e/ou prestador — preencha base e ajustes manualmente."}
                      </p>
                    )}
                  </div>
                </section>

                {/* 3. PRESTADOR / VEÍCULO */}
                <section id="lancamento-prestador" className="scroll-mt-2 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-100"><UserRound className="w-3 h-3 text-slate-500" /></span>
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">3. Prestador / Veículo</span>
                    <span className="text-[11px] text-slate-400">Quem executou o serviço</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs font-medium">Prestador / Motorista</Label>
                      <div className="relative">
                        <Input
                          placeholder="Pesquisar prestador (nome, placa, veículo, telefone)..."
                          value={filtroPrestadorLancamento}
                          onChange={(e) => {
                            setFiltroPrestadorLancamento(e.target.value);
                            setShowPrestadorDropdown(true);
                            if (formLancamento.prestador_id) limparPrestadorLancamento();
                          }}
                          onFocus={() => setShowPrestadorDropdown(true)}
                          className="h-8 text-sm placeholder:text-[13px]"
                        />
                        {showPrestadorDropdown && filtroPrestadorLancamento.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                            {prestadoresLancamentoFiltrados.length === 0 ? (
                              <div className="p-2 text-sm text-slate-500">Nenhum prestador encontrado.</div>
                            ) : (
                              prestadoresLancamentoFiltrados.map((p) => (
                                <div key={p.id} className="p-2 text-sm cursor-pointer hover:bg-slate-50 border-b last:border-b-0" onClick={() => selecionarPrestadorLancamento(p)}>
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    <UserRound className="w-3 h-3 text-slate-400" /> {p.nome}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex gap-2 mt-0.5 flex-wrap">
                                    {p.cpfCnpj && <span>CPF/CNPJ: {mascararCPF(p.cpfCnpj)}</span>}
                                    {p.telefone && <span>Tel: {mascararTelefone(p.telefone)}</span>}
                                    <span>Veículo: {p.veiculo || "N/A"}</span>
                                    <span>Placa: {p.placa || "N/A"}</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Tipo de veículo *</Label>
                      <Input className="h-8 text-sm placeholder:text-[13px]" placeholder="Ex: Carreta" value={formLancamento.tipo_veiculo} onChange={(e) => setFormLancamento((p) => ({ ...p, tipo_veiculo: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Placa</Label>
                      <Input className="h-8 text-sm placeholder:text-[13px] uppercase" placeholder="Ex: ABC-1234" value={formLancamento.placa} onChange={(e) => setFormLancamento((p) => ({ ...p, placa: e.target.value }))} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs font-medium">Veículo (cadastro)</Label>
                      <div className="h-8 rounded-md bg-slate-50 border border-slate-100 px-2 flex items-center text-[11px] text-slate-500">
                        {formLancamento.prestador_id
                          ? (formLancamento.tipo_veiculo || "—") + (formLancamento.placa ? ` · ${formLancamento.placa}` : "") + " — preenchido do cadastro do prestador (ajustável)."
                          : "Selecione o prestador para autopreencher veículo/placa do cadastro."}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4. FINANCEIRO CLIENTE */}
                <section id="lancamento-financeiro-cliente" className="scroll-mt-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-600/10"><ArrowUpRight className="w-3 h-3 text-emerald-600" /></span>
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-emerald-700">4. Financeiro Cliente — Receita / Cobrança</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Valor frete / base</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_frete} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_frete: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Outros adicionais</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_adicional} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_adicional: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Desconto Cliente</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_desconto} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_desconto: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Pedágio cobrado do cliente</Label>
                      <label className="flex items-center gap-2 h-8 px-2 rounded-md border border-emerald-200 bg-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="accent-[#F97316]"
                          checked={!!formLancamento.pedagio_cobrar_excedente}
                          onChange={(e) => setFormLancamento((p) => ({ ...p, pedagio_cobrar_excedente: e.target.checked }))}
                        />
                        <span className="text-[11px] text-slate-600">
                          {formLancamento.pedagio_cobrar_excedente
                            ? `Cobrar R$ ${formLancamento.valor_pedagio || "0,00"} do cliente`
                            : "Não cobrar pedágio do cliente"}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 rounded-lg bg-white/70 border border-emerald-100 p-2.5">
                    <div><p className="text-[11px] uppercase text-slate-400 font-semibold">KM excedente cobrado</p><p className="text-xs font-semibold text-emerald-700">{fmtM(resumoLancamento.totalExcedenteCliente)}</p></div>
                    <div><p className="text-[11px] uppercase text-slate-400 font-semibold">Pedágio cobrado</p><p className="text-xs font-semibold text-emerald-700">{fmtM(resumoLancamento.pedagioCliente)}</p></div>
                    <div><p className="text-[11px] uppercase text-slate-400 font-semibold">Ajudante cobrado</p><p className="text-xs font-semibold text-emerald-700">{fmtM(resumoLancamento.ajudanteCliente)}</p></div>
                    <div><p className="text-[11px] uppercase text-slate-400 font-semibold">Diárias / saídas</p><p className="text-xs font-semibold text-emerald-700">{fmtM(resumoLancamento.diariasCliente)}</p></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-600/10 border border-emerald-300/60 px-3 py-2">
                    <span className="text-[11px] font-bold uppercase text-emerald-700">Total Cliente</span>
                    <span className="text-base font-semibold text-emerald-700 tabular-nums">{fmtM(resumoLancamento.valorClienteTotal)}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700/70 mt-2">
                    Pedágio, ajudante e diárias têm fonte única (lançadas no bloco do prestador); a cobrança ao cliente segue a regra da Programação Operacional — marque "Pedágio cobrado do cliente" para repassar o pedágio ao cliente. Campo único, sem duplicação.
                  </p>
                </section>

                {/* 5. FINANCEIRO PRESTADOR */}
                <section id="lancamento-financeiro-prestador" className="scroll-mt-2 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-rose-600/10"><ArrowDownRight className="w-3 h-3 text-rose-600" /></span>
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-rose-700">5. Financeiro Prestador — Custo / Repasse / Reembolso</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Valor repasse / base</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_repasse} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_repasse: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Pedágio (reembolso)</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_pedagio} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_pedagio: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Combustível (reembolso)</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_combustivel} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_combustivel: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Reembolso outros</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_reembolso_outros} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_reembolso_outros: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Ajudante</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_ajudante} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_ajudante: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Diárias adicionais</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.diarias_adicionais} onChange={(e) => setFormLancamento((p) => ({ ...p, diarias_adicionais: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Valor diária</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_diaria} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_diaria: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Desconto / Ajuste Prestador</Label>
                      <Input type="number" className="h-8 text-sm placeholder:text-[13px]" value={formLancamento.valor_desconto_prestador} onChange={(e) => setFormLancamento((p) => ({ ...p, valor_desconto_prestador: e.target.value }))} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-md bg-white/70 border border-rose-100 px-2.5 py-1.5">
                    <span className="text-[11px] uppercase font-semibold text-slate-400">KM excedente (repasse)</span>
                    <span className="text-xs font-bold text-rose-700 tabular-nums">{fmtM(resumoLancamento.totalExcedentePrestador)}</span>
                  </div>
                  <div className="mt-2 rounded-md bg-white/70 border border-rose-100 p-2.5 space-y-1.5">
                    <Label className="text-xs font-medium">Comprovante de pedágio (PDF/JPG/PNG — link)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 text-sm placeholder:text-[13px]"
                        placeholder="https://.../comprovante-pedagio.pdf"
                        value={formLancamento.comprovante_pedagio_url}
                        onChange={(e) => setFormLancamento((p) => ({ ...p, comprovante_pedagio_url: e.target.value }))}
                      />
                      {formLancamento.comprovante_pedagio_url.trim() ? (
                        <>
                          <Button variant="outline" size="sm" className="h-8 text-[13px] shrink-0" asChild>
                            <a href={formLancamento.comprovante_pedagio_url.trim()} target="_blank" rel="noreferrer">Ver</a>
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-[13px] shrink-0" asChild>
                            <a href={formLancamento.comprovante_pedagio_url.trim()} download>Baixar</a>
                          </Button>
                        </>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Persistido na estrutura oficial <strong>reembolsos_prestador</strong> (tipo=pedágio) ao salvar.
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-rose-600/10 border border-rose-300/60 px-3 py-2">
                    <span className="text-[11px] font-bold uppercase text-rose-700">Total Prestador</span>
                    <span className="text-base font-semibold text-rose-700 tabular-nums">{fmtM(resumoLancamento.valorPrestadorTotal)}</span>
                  </div>
                </section>

                {/* 6. ITENS ADICIONAIS */}
                <section id="lancamento-itens-adicionais" className="scroll-mt-2 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-100"><Layers className="w-3 h-3 text-slate-500" /></span>
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">6. Itens Adicionais</span>
                    <span className="text-[11px] text-slate-400">Pedágios, ajudantes e diárias</span>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 uppercase text-[10px]">
                          <th className="text-left font-semibold px-2.5 py-1.5">Item</th>
                          <th className="text-right font-semibold px-2.5 py-1.5">Valor</th>
                          <th className="text-center font-semibold px-2.5 py-1.5">Cliente</th>
                          <th className="text-center font-semibold px-2.5 py-1.5">Prestador</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Pedágio", valor: numF(formLancamento.valor_pedagio), cliente: !!formLancamento.pedagio_cobrar_excedente, prestador: true },
                          { label: "Ajudante", valor: numF(formLancamento.valor_ajudante), cliente: true, prestador: true },
                          { label: "Diárias", valor: resumoLancamento.diariasCliente, cliente: true, prestador: true },
                          { label: "Combustível", valor: numF(formLancamento.valor_combustivel), cliente: false, prestador: true },
                          { label: "Reembolso outros", valor: numF(formLancamento.valor_reembolso_outros), cliente: false, prestador: true },
                          { label: "Outros adicionais (cliente)", valor: numF(formLancamento.valor_adicional), cliente: true, prestador: false },
                          { label: "Desconto Cliente", valor: numF(formLancamento.valor_desconto), cliente: true, prestador: false },
                          { label: "Desconto / Ajuste Prestador", valor: numF(formLancamento.valor_desconto_prestador), cliente: false, prestador: true },
                        ].map((i) => (
                          <tr key={i.label} className="border-t border-slate-50">
                            <td className="px-2.5 py-1.5 font-medium text-slate-600">{i.label}</td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-700">{fmtM(i.valor)}</td>
                            <td className="px-2.5 py-1.5 text-center">
                              {i.cliente ? <span className="text-[11px] font-bold text-emerald-600">Cobrado</span> : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-2.5 py-1.5 text-center">
                              {i.prestador ? <span className="text-[11px] font-bold text-rose-600">Custo</span> : <span className="text-slate-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Fonte única — cada item alimenta Cliente/Prestador conforme a regra já homologada da Programação Operacional (campo único, sem duplicação).
                  </p>
                </section>

                {/* 7. OBSERVAÇÕES */}
                <section id="lancamento-observacoes" className="scroll-mt-2 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-100"><FileText className="w-3 h-3 text-slate-500" /></span>
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">7. Observações Gerais</span>
                    <span className="text-[11px] text-slate-400">Informações complementares</span>
                  </div>
                  <Textarea className="text-sm" rows={3} placeholder="Observações do serviço..." value={formLancamento.observacoes} onChange={(e) => setFormLancamento((p) => ({ ...p, observacoes: e.target.value }))} />
                </section>

                {/* 8. RESUMO FINAL */}
                <section id="lancamento-resumo" className="scroll-mt-2 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-[#F97316]/10"><Receipt className="w-3 h-3 text-[#F97316]" /></span>
                    <span className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">8. Resumo Final</span>
                    <span className="text-[11px] text-slate-400">Conferência e lançamento</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                      <p className="text-[11px] uppercase font-bold text-blue-600">Total Cliente</p>
                      <p className="text-base font-semibold text-blue-700 tabular-nums">{fmtM(resumoLancamento.valorClienteTotal)}</p>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                      <p className="text-[11px] uppercase font-bold text-orange-600">Total Prestador</p>
                      <p className="text-base font-semibold text-orange-700 tabular-nums">{fmtM(resumoLancamento.valorPrestadorTotal)}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="text-[11px] uppercase font-bold text-emerald-600">Margem Estimada</p>
                      <p className={`text-base font-semibold tabular-nums ${resumoLancamento.margem >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtM(resumoLancamento.margem)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <p className="text-[11px] uppercase font-bold text-slate-500">Margem %</p>
                      <p className={`text-base font-semibold tabular-nums ${resumoLancamento.margemPct >= 0 ? "text-slate-700" : "text-red-600"}`}>{resumoLancamento.margemPct.toFixed(1)}%</p>
                    </div>
                  </div>
                  {msgLancamento && <p className="text-xs text-amber-600 mt-3">{msgLancamento}</p>}
                  <p className="text-[11px] text-slate-400 mt-3">
                    Grava em <strong>alocacoes_escala</strong> (mesma fonte da Programação Operacional) e, quando há cliente, cria a <strong>OS Interna oficial</strong> (ordens_servico) vinculada via ordem_servico_id. Romaneio/OC permanece separado (metadata.numeroOC). Os valores serão propagados pelo trigger para financeiro_receber/pagar (mesmo fluxo da Programação Operacional).
                  </p>
                </section>
              </div>
            </div>

            {/* Rodapé fixo */}
            <div className="flex items-center gap-2 px-5 py-3 border-t bg-white shrink-0">
              <Button variant="ghost" size="sm" className="h-8 text-[13px] text-slate-500" onClick={limparFormLancamento}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Limpar campos
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 text-[13px]" onClick={() => setMostrarLancamento(false)}>Cancelar</Button>
                <Button
                  size="sm"
                  className="h-8 text-[13px] bg-[#F97316] hover:bg-[#EA580C]"
                  disabled={salvandoLancamento || !formLancamento.data_escala || !formLancamento.tipo_veiculo}
                  onClick={handleLancarServico}
                >
                  {salvandoLancamento ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                  Validar e Lançar Serviço
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FaturaPanel
        open={painelFatura}
        onOpenChange={(o) => { if (!o) setPainelFatura(false); }}
        itens={itensParaFatura}
        clienteNome={itensSelecionados[0]?.clienteNome || ""}
        onEmitida={aposEmitirFatura}
      />
    </div>
  );
}
