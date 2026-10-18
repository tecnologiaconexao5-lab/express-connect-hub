import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, X, Loader2, Eye, CheckCircle2, Send, Receipt,
  Calendar, User, Trash2, Ban, ArrowLeft, Printer, ExternalLink, Layers, Barcode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  buscarFaturaComItens,
  atualizarFatura,
  emitirFatura,
  cancelarFatura,
  removerItemFatura,
  buscarDadosEmpresaParaFatura,
  buscarClienteParaFatura,
  montarPreviaFatura,
  montarInputPdfFatura,
  sugerirModeloFaturaParaCliente,
  sugerirVencimentoParaCliente,
  montarDescricaoCalvo,
  enviarFaturaParaValidacao,
  aprovarFatura,
  devolverFaturaParaRascunho,
  verificarNumeroFaturaManualDisponivel,
  type FaturaComItens,
  type DadosEmpresaFatura,
  type DadosClienteFatura,
  type ModeloFatura,
} from "@/services/financeiro/faturaService";
import { baixarPDFFatura, type PdfFaturaInput } from "@/utils/pdfFatura";

const fmtM = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
};

export interface ItemSelecionadoFatura {
  osId: string;
  alocacaoId: string | null;
  clienteId: string;
  romaneio: string | null;
  descricao: string | null;
  dataServico: string | null;
  valorBase: number;
  valorAdicionais: number;
  valorDescontos: number;
  valorTotal: number;
  kmExcedente: number;
  pedagioCliente: number;
  ajudanteCliente: number;
  diariaCliente: number;
  saidasAdicionaisCliente: number;
  osNumero: string;
}

interface FaturaPanelProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  itens: ItemSelecionadoFatura[];
  clienteNome: string;
  onEmitida: (numero: string) => void;
  onCancelada?: () => void;
  faturaId?: string | null;
  /**
   * MICRO-EDICAO-FATURA — "editar" = aberto pelo lápis da lista: campos do
   * formulário liberados mesmo fora de rascunho (ex.: fatura emitida), com
   * botão de salvar. Padrão "abrir" preserva o comportamento legado
   * (workflow/visualização) para os demais consumidores do painel.
   */
  modo?: "abrir" | "editar";
}

function DetalheItemModal({ item, onClose }: { item: ItemSelecionadoFatura | null; onClose: () => void }) {
  if (!item) return null;
  const Linha = ({ label, valor }: { label: string; valor: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{valor}</span>
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">Detalhe do valor faturado</DialogTitle>
          <DialogDescription className="text-[11px]">
            {item.osNumero || item.descricao || "Serviço"} {item.romaneio ? `· Romaneio ${item.romaneio}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Linha label="Frete / Base" valor={fmtM(item.valorBase)} />
          <Linha label="KM excedente" valor={fmtM(item.kmExcedente)} />
          <Linha label="Pedágio" valor={fmtM(item.pedagioCliente)} />
          <Linha label="Ajudante" valor={fmtM(item.ajudanteCliente)} />
          <Linha label="Diária" valor={fmtM(item.diariaCliente)} />
          <Linha label="Saídas adicionais" valor={fmtM(item.saidasAdicionaisCliente)} />
          <Linha label="Outros adicionais" valor={fmtM(item.valorAdicionais)} />
          <Linha label="Descontos" valor={<span className="text-red-600">- {fmtM(item.valorDescontos)}</span>} />
          <Separator />
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-bold text-slate-700">Total</span>
            <span className="font-extrabold text-blue-600">{fmtM(item.valorTotal)}</span>
          </div>
          <p className="text-[10px] text-slate-400 pt-1">
            Valor cobrado do cliente (não inclui custo do prestador).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FaturaPanel({ open, onOpenChange, itens, clienteNome, onEmitida, onCancelada, faturaId: faturaIdInicial, modo = "abrir" }: FaturaPanelProps) {
  const [fatura, setFatura] = useState<FaturaComItens | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vencimento, setVencimento] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [numero, setNumero] = useState("");
  const [numeroChecado, setNumeroChecado] = useState<boolean | null>(null);
  const [observacaoEditada, setObservacaoEditada] = useState(false);
  const [modelo, setModelo] = useState<ModeloFatura>("conexao_express");
  const [descricao, setDescricao] = useState("");
  
  const numeroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dadosEmpresa, setDadosEmpresa] = useState<DadosEmpresaFatura | null>(null);
  const [dadosCliente, setDadosCliente] = useState<DadosClienteFatura | null>(null);
  const [mostrarPrevia, setMostrarPrevia] = useState(false);
  const [emitindo, setEmitindo] = useState(false);
  const [confirmarEmissao, setConfirmarEmissao] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancelamento, setConfirmarCancelamento] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  // TMS-FAT-URG-02 — transição de validação/aprovação (pré-emissão)
  const [processandoStatus, setProcessandoStatus] = useState(false);
  const [itemDetalhe, setItemDetalhe] = useState<ItemSelecionadoFatura | null>(null);
  const [msgPosEmissao, setMsgPosEmissao] = useState<string | null>(null);
  const navigate = useNavigate();
  // TMS-FIN-PROG-05D.1 — dados do documento apos a emissao oficial (Nº Conexao,
  // Nº Cliente, Conta a Receber) para o painel de sucesso + navegacao.
  const [posEmissao, setPosEmissao] = useState<{
    numero?: string; numeroCliente?: number | null; contaReceberId?: string | null;
    valor?: number; vencimento?: string | null;
  } | null>(null);

  const carregarEmpresa = useCallback(async () => {
    const emp = await buscarDadosEmpresaParaFatura();
    setDadosEmpresa(emp);
  }, []);

  const carregar = useCallback(async (faturaId: string, clienteId: string) => {
    setLoading(true);
    setErro(null);
    try {
      const f = await buscarFaturaComItens(faturaId);
      if (!f) { setErro("Fatura não encontrada"); setLoading(false); return; }
      setFatura(f);
      setVencimento(f.vencimento || "");
      setDataEmissao(f.data_emissao || new Date().toISOString().split("T")[0]);
      setObservacao(f.observacao || "");
      // Extrai número se for fatura manual
      if (f.metadata && (f.metadata as Record<string, unknown>).numeroManual) {
        setNumero(String((f.metadata as Record<string, unknown>).numeroManual));
      } else {
        setNumero("");
      }
      setObservacaoEditada(false);
      setModelo(f.modelo || "conexao_express");
      setDescricao(f.descricao || "");
      // F38-MANUAL — usa o cliente da própria fatura (corrige edição a partir da lista)
      const cli = await buscarClienteParaFatura(f.cliente_id || clienteId || "");
      setDadosCliente(cli);
      setLoading(false);
    } catch {
      setErro("Erro ao carregar fatura");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarEmpresa();
  }, [carregarEmpresa]);

  // Checagem de duplicidade do número (debounce)
  useEffect(() => {
    if (numeroTimer.current) clearTimeout(numeroTimer.current);
    const num = numero.trim();
    if (!num) { setNumeroChecado(null); return; }
    setNumeroChecado(null);
    numeroTimer.current = setTimeout(async () => {
      // Ignorar se o número digitado for exatamente o número manual que já estava na fatura
      if (fatura?.metadata && (fatura.metadata as Record<string, unknown>).numeroManual === num) {
        setNumeroChecado(true);
        setErro(null);
        return;
      }
      const r = await verificarNumeroFaturaManualDisponivel(num);
      setNumeroChecado(r.disponivel);
      if (!r.disponivel) setErro(r.message || "Já existe uma fatura com este número.");
      else setErro((prev) => (prev === "Já existe uma fatura com este número." ? null : prev));
    }, 450);
    return () => { if (numeroTimer.current) clearTimeout(numeroTimer.current); };
  }, [numero, fatura]);

  useEffect(() => {
    if (!open) { setMsgPosEmissao(null); setPosEmissao(null); setNumero(""); setNumeroChecado(null); return; }
    setMsgPosEmissao(null);
    setPosEmissao(null);
    if (faturaIdInicial) {
      const cliId = itens[0]?.clienteId || "";
      carregar(faturaIdInicial, cliId);
    } else {
      // Cria rascunho com os itens selecionados
      setLoading(true);
      setErro(null);
      const criarRascunho = async () => {
        const { criarRascunhoFatura, adicionarItemFatura, montarObservacaoRomaneios } = await import("@/services/financeiro/faturaService");
        const primeiroCliente = itens[0]?.clienteId || "";
        // Sugere modelo a partir do cliente e vencimento sugerido
        const cli = await buscarClienteParaFatura(primeiroCliente);
        // A31: modelo padrão e vencimento vêm da REGRA do cliente (configuração explícita)
        const modeloSugerido = await sugerirModeloFaturaParaCliente(primeiroCliente, cli?.razaoSocial, cli?.cnpj);
        const vencSugerido = await sugerirVencimentoParaCliente(primeiroCliente);
        setModelo(modeloSugerido);
        setDadosCliente(cli);
        setDataEmissao(new Date().toISOString().split("T")[0]);
        const res = await criarRascunhoFatura({
          cliente_id: primeiroCliente,
          modelo: modeloSugerido,
          vencimento: vencSugerido,
        });
        if (!res.success || !res.fatura) {
          setErro(res.error || "Erro ao criar rascunho");
          setLoading(false);
          return;
        }
        for (const item of itens) {
          await adicionarItemFatura({
            fatura_id: res.fatura.id,
            os_id: item.osId,
            alocacao_id: item.alocacaoId,
            cliente_id: item.clienteId,
            romaneio: item.romaneio,
            descricao: item.descricao,
            data_servico: item.dataServico,
            valor_base: item.valorBase,
            valor_adicionais: item.valorAdicionais,
            valor_descontos: item.valorDescontos,
            km_excedente: item.kmExcedente,
            pedagio_cliente: item.pedagioCliente,
            ajudante_cliente: item.ajudanteCliente,
            diaria_cliente: item.diariaCliente,
            saidas_adicionais_cliente: item.saidasAdicionaisCliente,
          });
        }
        // Descrição/observação conforme modelo
        const romaneios = itens.map((i) => i.romaneio);
        let descricaoAuto = "";
        let obs = "";
        if (modeloSugerido === "calvo") {
          descricaoAuto = montarDescricaoCalvo(itens.map((i) => ({ romaneio: i.romaneio })));
          // A31-I.2: no modelo do cliente os romaneios já estão consolidados na
          // Descrição — não repetir automaticamente na Observação.
          obs = "";
        } else {
          obs = montarObservacaoRomaneios(romaneios);
        }
        if (descricaoAuto || obs) {
          await atualizarFatura(res.fatura.id, {
            descricao: descricaoAuto || null,
            observacao: obs || null,
            vencimento: vencSugerido,
          });
        }
        setDescricao(descricaoAuto);
        const f = await buscarFaturaComItens(res.fatura.id);
        if (f) {
          setFatura(f);
          setVencimento(f.vencimento || vencSugerido);
          setObservacao(f.observacao || obs || "");
        }
        setLoading(false);
      };
      criarRascunho();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, faturaIdInicial]);

  const subtotal = useMemo(() => (fatura?.itens || []).reduce((s, i) => s + i.valor_total, 0), [fatura]);
  const descontos = useMemo(() => (fatura?.itens || []).reduce((s, i) => s + i.valor_descontos, 0), [fatura]);
  const total = fatura?.valor_total ?? subtotal;

  // TMS-FIN-PROG-05D.1 — resumo de conferencia (dados REAIS da fatura)
  const romaneiosFatura = useMemo(
    () => Array.from(new Set((fatura?.itens || []).map((i) => i.romaneio).filter(Boolean))).join(", "),
    [fatura]
  );
  const totalBase = useMemo(() => (fatura?.itens || []).reduce((s, i) => s + (i.valor_base || 0), 0), [fatura]);
  const totalAdicionais = useMemo(() => (fatura?.itens || []).reduce((s, i) => s + (i.valor_adicionais || 0), 0), [fatura]);
  const totalPedagio = useMemo(() => (fatura?.itens || []).reduce((s, i) => s + (i.pedagio_cliente || 0), 0), [fatura]);

  const handleSalvarRascunho = async () => {
    if (!fatura) return;
    if (numeroChecado === false) {
      setErro("Já existe uma fatura com este número.");
      return;
    }
    setSalvando(true);
    setErro(null);
    
    // Atualiza o metadata se tiver número manual
    let novoMetadata = fatura.metadata as Record<string, unknown> | null;
    if (numero.trim()) {
      novoMetadata = { ...(novoMetadata || {}), numeroManual: numero.trim() };
    } else if (novoMetadata && 'numeroManual' in novoMetadata) {
      const { numeroManual, ...rest } = novoMetadata;
      novoMetadata = Object.keys(rest).length ? rest : null;
    }

    const res = await atualizarFatura(fatura.id, {
      vencimento: vencimento || null,
      observacao: observacao,
      modelo: modelo,
      descricao: descricao || null,
      data_emissao: dataEmissao || undefined,
      metadata: novoMetadata,
    });
    if (res.success && res.fatura) {
      setFatura({ ...fatura, ...res.fatura, itens: fatura.itens });
    } else {
      setErro(res.error || "Erro ao salvar rascunho");
    }
    setSalvando(false);
  };

  const handleRemoverItem = async (itemId: string) => {
    if (!fatura) return;
    const res = await removerItemFatura(itemId);
    if (res.success) {
      const f = await buscarFaturaComItens(fatura.id);
      if (f) setFatura(f);
    } else {
      setErro(res.error || "Erro ao remover item");
    }
  };

  const handleEmitir = async () => {
    if (!fatura) return;
    if (numeroChecado === false) {
      setErro("Corrija o número da fatura antes de emitir.");
      setConfirmarEmissao(false);
      return;
    }
    setEmitindo(true);
    setErro(null);
    const res = await emitirFatura(fatura.id);
    setEmitindo(false);
    if (res.success && res.numero) {
      const nCli = res.numeroCliente != null ? ` · Nº Cliente ${res.numeroCliente}` : "";
      setMsgPosEmissao(`Fatura ${res.numero} emitida com sucesso${nCli}`);
      setPosEmissao({
        numero: res.numero,
        numeroCliente: res.numeroCliente ?? null,
        contaReceberId: res.contaReceberId ?? null,
        valor: fatura.valor_total,
        vencimento: vencimento || fatura.vencimento,
      });
      const f = await buscarFaturaComItens(fatura.id);
      if (f) setFatura(f);
      onEmitida(res.numero);
    } else {
      setErro(res.error || "Erro ao emitir fatura");
    }
    setConfirmarEmissao(false);
  };

  const handleCancelar = async () => {
    if (!fatura || !motivoCancelamento.trim()) return;
    setCancelando(true);
    const res = await cancelarFatura(fatura.id, motivoCancelamento.trim());
    setCancelando(false);
    if (res.success) {
      setConfirmarCancelamento(false);
      setMotivoCancelamento("");
      onCancelada?.();
      onOpenChange(false);
    } else {
      setErro(res.error || "Erro ao cancelar fatura");
    }
  };

  // TMS-FAT-URG-02 — VALIDAR/APROVAR NÃO É RECEBER (não cria Conta a Receber).
  const recarregarFatura = async () => {
    if (!fatura) return;
    const f = await buscarFaturaComItens(fatura.id);
    if (f) setFatura(f);
  };

  const handleEnviarValidacao = async () => {
    if (!fatura) return;
    if (numeroChecado === false) {
      setErro("Corrija o número da fatura antes de enviar para validação.");
      return;
    }
    setProcessandoStatus(true);
    setErro(null);
    const res = await enviarFaturaParaValidacao(fatura.id);
    setProcessandoStatus(false);
    if (res.success) await recarregarFatura();
    else setErro(res.error || "Erro ao enviar para validação");
  };

  // FIN-BUG-03 — Aprovar + Emitir em um clique (mesmo contrato da lista):
  // aprova (não cria AR) e emite em seguida (f_emitir_fatura gera o Nº oficial,
  // o nº do cliente e a Conta a Receber). Se a emissão falhar, a fatura fica
  // APROVADA e o botão "Emitir Fatura" permite retomar.
  const handleAprovar = async () => {
    if (!fatura) return;
    if (numeroChecado === false) {
      setErro("Corrija o número da fatura antes de aprovar.");
      return;
    }
    setProcessandoStatus(true);
    setErro(null);
    const res = await aprovarFatura(fatura.id);
    if (!res.success) {
      setProcessandoStatus(false);
      setErro(res.error || "Erro ao aprovar fatura");
      return;
    }
    const em = await emitirFatura(fatura.id);
    setProcessandoStatus(false);
    if (em.success && em.numero) {
      const nCli = em.numeroCliente != null ? ` · Nº Cliente ${em.numeroCliente}` : "";
      setMsgPosEmissao(`Fatura ${em.numero} emitida com sucesso${nCli}`);
      setPosEmissao({
        numero: em.numero,
        numeroCliente: em.numeroCliente ?? null,
        contaReceberId: em.contaReceberId ?? null,
        valor: fatura.valor_total,
        vencimento: vencimento || fatura.vencimento,
      });
      const f = await buscarFaturaComItens(fatura.id);
      if (f) setFatura(f);
      onEmitida(em.numero);
    } else {
      setErro(
        `Aprovada, mas não foi possível emitir: ${em.error || "erro desconhecido"}. ` +
        'Use "Emitir Fatura" para finalizar.'
      );
      await recarregarFatura();
    }
  };

  const handleDevolver = async () => {
    if (!fatura) return;
    setProcessandoStatus(true);
    setErro(null);
    const res = await devolverFaturaParaRascunho(fatura.id);
    setProcessandoStatus(false);
    if (res.success) await recarregarFatura();
    else setErro(res.error || "Erro ao devolver fatura");
  };

  const montarPdfInput = useCallback(async (): Promise<PdfFaturaInput | null> => {
    if (!fatura || !dadosEmpresa) return null;
    // F38-MANUAL — reutiliza o montador oficial aplicando snapshot de conta +
    // número manual; depois aplica as edições ao vivo do painel.
    const base = montarInputPdfFatura(fatura, dadosEmpresa, dadosCliente);
    return {
      ...base,
      modelo,
      descricao: descricao || base.descricao || "",
      data: dataEmissao || base.data,
      vencimento: vencimento || base.vencimento,
    };
  }, [fatura, dadosEmpresa, dadosCliente, modelo, descricao, dataEmissao, vencimento]);

  const handleBaixarPDF = async () => {
    const pdf = await montarPdfInput();
    if (!pdf) return;
    await baixarPDFFatura(pdf);
  };

  const emitida = fatura?.status === "emitida";
  const cancelada = fatura?.status === "cancelada";
  const rascunho = fatura?.status === "rascunho";
  // MICRO-EDICAO-FATURA — o lápis da lista abre o painel em MODO DE EDIÇÃO:
  // os campos do formulário ficam liberados mesmo fora de rascunho (ex.:
  // fatura emitida), EXCETO fatura cancelada (imutável).
  const emModoEdicao = modo === "editar" && !!fatura && !cancelada;
  const podeEditar = rascunho || emModoEdicao; // campos do formulário (Nº, modelo, datas, vencimento, descrição, observação)
  const podeRemoverItem = rascunho; // banco bloqueia alterar itens fora de rascunho (trg_fatura_itens_bloqueio_emissao)
  const podeAcaoRascunho = rascunho; // Salvar Rascunho / Prévia / Enviar para Validação
  const aguardandoValidacao = fatura?.status === "aguardando_aprovacao";
  const aprovada = fatura?.status === "aprovada";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-[#F97316]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-bold">
                  Fatura — {fatura?.numero && fatura.numero !== "Rascunho" ? fatura.numero : "Rascunho"}
                </DialogTitle>
                <DialogDescription className="text-[11px]">
                  {clienteNome || "Sem cliente vinculado"} · {fatura ? `${fatura.itens.length} serviço(s)` : "carregando..."} ·{" "}
                  {fatura ? fmtM(total) : ""}
                </DialogDescription>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {fatura && (
                  <Badge variant="outline" className={
                    emitida ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : cancelada ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                  }>
                    {fatura.status === "emitida" ? "Emitida"
                      : fatura.status === "cancelada" ? "Cancelada"
                      : fatura.status === "aguardando_aprovacao" ? "Aguardando aprovação"
                      : fatura.status === "aprovada" ? "Aprovada"
                      : "Rascunho"}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : erro && !fatura ? (
            <div className="text-center py-8">
              <p className="text-red-500 text-sm">{erro}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          ) : fatura && msgPosEmissao ? (
            <div className="py-6">
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-emerald-700 text-base">{msgPosEmissao}</p>
                <p className="text-[11px] text-muted-foreground">Documento emitido e Conta a Receber criada.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
                {[
                  { label: "Nº Conexão", valor: posEmissao?.numero || fatura.numero || "—" },
                  { label: "Nº Cliente", valor: posEmissao?.numeroCliente != null ? String(posEmissao.numeroCliente) : (fatura.numero_cliente != null ? String(fatura.numero_cliente) : "—") },
                  { label: "Status", valor: "EMITIDA" },
                  { label: "Valor", valor: fmtM(posEmissao?.valor ?? fatura.valor_total) },
                  { label: "Vencimento", valor: fmtData(posEmissao?.vencimento || fatura.vencimento) },
                  { label: "Conta a Receber", valor: (posEmissao?.contaReceberId || fatura.conta_receber_id) ? "Criada" : "—" },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl border bg-slate-50/60 p-3">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5 truncate">{k.valor}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
                <Button size="sm" className="bg-[#F97316] hover:bg-[#EA580C]" onClick={() => { onOpenChange(false); navigate("/financeiro?tab=receber"); }}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver em Contas a Receber
                </Button>
                <Button size="sm" onClick={handleBaixarPDF}><Printer className="w-3.5 h-3.5 mr-1" /> Baixar PDF</Button>
                <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Voltar para Central</Button>
              </div>
            </div>
          ) : fatura ? (
            <div className="space-y-5">
              {/* Cabeçalho resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Nº Conexão", valor: fatura.numero || "será gerado na emissão" },
                  { label: "Nº Cliente", valor: fatura.numero_cliente != null ? String(fatura.numero_cliente) : "será gerado na emissão" },
                  { label: "Cliente", valor: clienteNome || "Sem cliente vinculado" },
                  { label: "Data da Fatura", valor: fmtData(dataEmissao || fatura.data_emissao) },
                  { label: "Vencimento", valor: fmtData(vencimento || fatura.vencimento) },
                  { label: "Modelo", valor: modelo === "calvo" ? "Modelo do cliente (consolidado)" : "Padrão Conexão Express" },
                  { label: "Quantidade de serviços", valor: String(fatura.itens.length) },
                  { label: "Valor total", valor: fmtM(total) },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl border bg-slate-50/60 p-3">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5 truncate">{k.valor}</p>
                  </div>
                ))}
              </div>

              {!clienteNome && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Este serviço não possui cliente vinculado. Informe o cliente no lançamento para poder emitir a fatura.
                </div>
              )}

              {podeEditar && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Nº da Fatura (Opcional - Customizado)</Label>
                    <Input
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Deixe vazio p/ numeração automática"
                      className="h-9 text-xs"
                    />
                    {numeroChecado === false && <p className="text-[10px] text-red-500">Este número já existe.</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Modelo da Fatura</Label>
                    <Select value={modelo} onValueChange={(v) => { setModelo(v as ModeloFatura); setObservacaoEditada(true); }}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conexao_express">Padrão Conexão Express</SelectItem>
                        <SelectItem value="calvo">Modelo do cliente (consolidado)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-slate-400">
                      {modelo === "calvo"
                        ? "Logo centralizado, faixa \"Cobrança para:\", tabela Fatura/Descrição/Parcela/Vencimento/Valor e dados bancários."
                        : "Cabeçalho navy com logo claro, tabela de serviços detalhada e dados para pagamento."}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Data da Fatura / Emissão (editável)</Label>
                    <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Vencimento (sugerido — editável)</Label>
                    <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="h-9" />
                    {emModoEdicao && emitida && (
                      <p className="text-[10px] text-amber-600">
                        Fatura já emitida: a alteração vale para este documento (PDF). A Conta a Receber vinculada não é atualizada automaticamente.
                      </p>
                    )}
                  </div>
                  {modelo === "calvo" && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Descrição da Fatura (consolidada)</Label>
                      <Textarea
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        rows={2}
                        className="text-xs"
                        placeholder="Receita de CT-e referente aos romaneios nº ..."
                      />
                    </div>
                  )}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-[10px] text-muted-foreground">Observação (opcional)</Label>
                    <Textarea
                      value={observacao}
                      onChange={(e) => { setObservacao(e.target.value); setObservacaoEditada(true); }}
                      rows={2}
                      className="text-xs"
                      placeholder="Referente aos romaneios nº ..."
                    />
                  </div>
                </div>
              )}

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              {/* Serviços incluídos */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Serviços incluídos</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="p-2 font-semibold text-slate-600">Data</th>
                        <th className="p-2 font-semibold text-slate-600">OS Interna</th>
                        <th className="p-2 font-semibold text-slate-600">Romaneio/OC</th>
                        <th className="p-2 font-semibold text-slate-600">Descrição</th>
                        <th className="p-2 font-semibold text-slate-600 text-right">Valor</th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {(fatura.itens || []).map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2 whitespace-nowrap">{fmtData(item.data_servico)}</td>
                          <td className="p-2">{item.os_id?.slice(0, 8) || "—"}</td>
                          <td className="p-2">
                            {item.romaneio ? <span className="font-semibold text-indigo-600">{item.romaneio}</span> : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="p-2 max-w-[220px] truncate" title={item.descricao || ""}>{item.descricao || "Serviço"}</td>
                          <td className="p-2 text-right font-semibold tabular-nums">{fmtM(item.valor_total)}</td>
                          <td className="p-2 text-right">
                            <Button
                              variant="ghost" size="sm" className="h-6 w-6 p-0"
                              title="Ver detalhe do valor"
                              onClick={() => setItemDetalhe({
                                osId: item.os_id || "", alocacaoId: item.alocacao_id, clienteId: item.cliente_id || "",
                                romaneio: item.romaneio, descricao: item.descricao, dataServico: item.data_servico,
                                valorBase: item.valor_base, valorAdicionais: item.valor_adicionais,
                                valorDescontos: item.valor_descontos, valorTotal: item.valor_total,
                                kmExcedente: item.km_excedente, pedagioCliente: item.pedagio_cliente,
                                ajudanteCliente: item.ajudante_cliente, diariaCliente: item.diaria_cliente,
                                saidasAdicionaisCliente: item.saidas_adicionais_cliente, osNumero: item.descricao || "",
                              })}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {podeRemoverItem && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" title="Remover item" onClick={() => handleRemoverItem(item.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totais */}
              <div className="rounded-lg border bg-slate-50/60 p-4 space-y-1.5 ml-auto max-w-sm">
                <div className="flex justify-between text-xs"><span className="text-slate-500">Subtotal</span><span className="font-semibold tabular-nums">{fmtM(subtotal)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">Acréscimos da Fatura</span><span className="font-semibold tabular-nums">{fmtM(fatura.acrescimos || 0)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">Descontos da Fatura</span><span className="font-semibold tabular-nums text-red-600">{fmtM(fatura.descontos || descontos)}</span></div>
                <Separator />
                <div className="flex justify-between text-sm"><span className="font-bold text-slate-700">TOTAL</span><span className="font-extrabold text-orange-600 tabular-nums">{fmtM(total)}</span></div>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-2 flex-wrap border-t pt-4">
                {/* MICRO-EDICAO-FATURA — salvar em modo edição fora de rascunho (ex.: fatura emitida) */}
                {emModoEdicao && !rascunho && (
                  <Button variant="outline" size="sm" onClick={handleSalvarRascunho} disabled={salvando || processandoStatus} title="Salvar alterações nos campos da fatura">
                    {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                    Salvar Alterações
                  </Button>
                )}
                {podeAcaoRascunho && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleSalvarRascunho} disabled={salvando || processandoStatus}>
                      {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                      Salvar Rascunho
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setMostrarPrevia(true)} disabled={processandoStatus}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar Prévia
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#F97316] hover:bg-[#EA580C]"
                      disabled={!clienteNome || processandoStatus}
                      title={!clienteNome ? "É necessário informar o cliente para enviar à validação" : "Envia a fatura para validação/aprovação (NÃO emite e NÃO cria título)"}
                      onClick={handleEnviarValidacao}
                    >
                      {processandoStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                      Enviar para Validação
                    </Button>
                  </>
                )}
                {aguardandoValidacao && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setMostrarPrevia(true)} disabled={processandoStatus}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar Prévia
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDevolver} disabled={processandoStatus}>
                      <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Devolver para Rascunho
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={processandoStatus} title="Aprovar e emitir (gera Nº oficial e Conta a Receber)" onClick={handleAprovar}>
                      {processandoStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                      Aprovar Fatura
                    </Button>
                  </>
                )}
                {aprovada && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setMostrarPrevia(true)} disabled={emitindo}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar Prévia
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={!clienteNome || emitindo}
                      title={!clienteNome ? "É necessário informar o cliente para emitir" : "Emite a fatura e gera a Conta a Receber"}
                      onClick={() => setConfirmarEmissao(true)}
                    >
                      <Send className="w-3.5 h-3.5 mr-1" /> Emitir Fatura
                    </Button>
                  </>
                )}
                {emitida && (
                  <>
                    <Button size="sm" onClick={handleBaixarPDF}><Printer className="w-3.5 h-3.5 mr-1" /> Baixar PDF</Button>
                    <Button variant="outline" size="sm" disabled title="Integração com a Efí será habilitada em fase futura">
                      <Barcode className="w-3.5 h-3.5 mr-1" /> Gerar Boleto
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmarCancelamento(true)}>
                      <Ban className="w-3.5 h-3.5 mr-1" /> Cancelar Fatura
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Prévia */}
      {mostrarPrevia && fatura && (
        <PreviaModal
          fatura={fatura}
          dadosEmpresa={dadosEmpresa}
          dadosCliente={dadosCliente}
          modelo={modelo}
          onClose={() => setMostrarPrevia(false)}
          onBaixar={handleBaixarPDF}
        />
      )}

      {/* Confirmação de emissão */}
      <AlertDialog open={confirmarEmissao} onOpenChange={setConfirmarEmissao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold">Emitir Fatura</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-xs space-y-3">
                <div className="rounded-lg border bg-slate-50/60 p-3 grid grid-cols-2 gap-2 text-left">
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Cliente</span>
                    <p className="font-semibold text-slate-800">{clienteNome || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nº/Controle do cliente</span>
                    <p className="font-semibold text-slate-800">
                      {(fatura?.metadata as Record<string, unknown> | undefined)?.numeroManual
                        ? String((fatura?.metadata as Record<string, unknown>).numeroManual)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vencimento</span>
                    <p className="font-semibold text-slate-800">{fmtData(vencimento || fatura?.vencimento)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Romaneios/OC</span>
                    <p className="font-semibold text-slate-800">{romaneiosFatura || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Serviços (itens)</span>
                    <p className="font-semibold text-slate-800">{fatura?.itens.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor base</span>
                    <p className="font-semibold text-slate-800">{fmtM(totalBase)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Adicionais</span>
                    <p className="font-semibold text-slate-800">{fmtM(totalAdicionais)}</p>
                  </div>
                  {totalPedagio > 0 && (
                    <div>
                      <span className="text-muted-foreground">Pedágio</span>
                      <p className="font-semibold text-slate-800">{fmtM(totalPedagio)}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Valor total</span>
                    <p className="font-extrabold text-orange-600">{fmtM(total)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-red-600 font-medium">
                  A emissão criará a Conta a Receber e não deve ser usada antes da conferência dos valores.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emitindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleEmitir(); }}
              disabled={emitindo}
              className="bg-[#F97316] hover:bg-[#EA580C]"
            >
              {emitindo ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Emitir Fatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancelamento com motivo */}
      <AlertDialog open={confirmarCancelamento} onOpenChange={setConfirmarCancelamento}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold">Cancelar Fatura</AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>A fatura será cancelada, os itens liberados para novo faturamento e a Conta a Receber tratada. O histórico permanece.</p>
              <div className="space-y-1.5">
                <Label className="text-[10px]">Motivo do cancelamento (obrigatório)</Label>
                <Textarea
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  rows={2}
                  className="text-xs"
                  placeholder="Informe o motivo..."
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!motivoCancelamento.trim() || cancelando}
              onClick={handleCancelar}
            >
              {cancelando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Ban className="w-3.5 h-3.5 mr-1" />} Cancelar Fatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DetalheItemModal item={itemDetalhe} onClose={() => setItemDetalhe(null)} />
    </>
  );
}

export function PreviaModal({
  fatura, dadosEmpresa, dadosCliente, modelo, onClose, onBaixar,
}: {
  fatura: FaturaComItens;
  dadosEmpresa: DadosEmpresaFatura | null;
  dadosCliente: DadosClienteFatura | null;
  modelo: ModeloFatura;
  onClose: () => void;
  onBaixar: () => void;
}) {
  const previa = useMemo(() => {
    if (!dadosEmpresa) return null;
    return montarPreviaFatura(fatura, dadosEmpresa, dadosCliente);
  }, [fatura, dadosEmpresa, dadosCliente]);

  if (!previa) {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle className="text-sm">Prévia</DialogTitle></DialogHeader>
          <Skeleton className="h-96 w-full" />
        </DialogContent>
      </Dialog>
    );
  }

  const Linha = ({ label, valor, bold }: { label: string; valor: React.ReactNode; bold?: boolean }) => (
    <div className="flex justify-between text-xs py-0.5">
      <span className={bold ? "font-bold text-slate-800" : "text-slate-500"}>{label}</span>
      <span className={bold ? "font-extrabold text-slate-800" : "font-medium text-slate-700"}>{valor}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#F97316]" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">Prévia da Fatura</DialogTitle>
              <DialogDescription className="text-[11px]">
                {previa.numero} · Esta prévia NÃO consome numeração definitiva.
              </DialogDescription>
              <div className="mt-1">
                <Badge variant="outline" className="text-[9px] bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20">
                  Modelo de faturamento do cliente
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" className="ml-auto h-8 text-[11px]" onClick={onBaixar}>
              <Printer className="w-3.5 h-3.5 mr-1" /> Baixar PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="border rounded-xl overflow-hidden">
          {/* Cabeçalho da prévia — modelo do cliente (fiel ao PDF) */}
          {modelo === "calvo" ? (
            <div className="bg-white">
              {/* Logo GRANDE centralizado */}
              <div className="flex justify-center pt-8 pb-6">
                <img
                  src="/logo-oficial-conexao.png"
                  alt="Conexão Express"
                  className="h-32 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              {/* Faixa salmão FINA — somente razão social */}
              <div className="bg-[#FABE96] text-center px-6 py-1.5">
                <p className="text-sm font-extrabold text-[#003399]">{previa.empresa.razaoSocial || "CONEXÃO SERVIÇOS EXPRESS LTDA"}</p>
              </div>
              {/* Dados da empresa — fundo branco, centralizados */}
              <div className="text-center px-6 pt-2 pb-4 space-y-0.5">
                {previa.empresa.cnpj ? <p className="text-[11px] text-slate-600">CNPJ: {previa.empresa.cnpj}</p> : null}
                {previa.empresa.ie ? <p className="text-[11px] text-slate-600">INSCRIÇÃO ESTADUAL: {previa.empresa.ie}</p> : null}
                {previa.empresa.endereco ? <p className="text-[11px] text-slate-600">{previa.empresa.endereco} — {previa.empresa.cidade}/{previa.empresa.uf}</p> : null}
                {previa.empresa.email ? <p className="text-[11px] text-slate-600">E-MAIL: {previa.empresa.email}</p> : null}
              </div>
              {/* Faixa cinza FINA "Cobrança para" */}
              <div className="bg-[#D2D2D2] border-y border-[#505050] px-4 py-1.5">
                <p className="text-xs font-bold text-[#282828]">Cobrança para: {previa.cliente || "—"}</p>
              </div>
              {/* Dados do cliente — fundo branco, alinhados à esquerda */}
              <div className="px-4 py-1.5 space-y-0.5">
                {dadosCliente?.cnpj ? <p className="text-[11px] text-slate-600">CNPJ: {dadosCliente.cnpj}</p> : null}
                {dadosCliente?.ie ? <p className="text-[11px] text-slate-600">IE: {dadosCliente.ie}</p> : null}
                {dadosCliente?.endereco ? <p className="text-[11px] text-slate-600">{dadosCliente.endereco}{dadosCliente.cidade ? ` — ${dadosCliente.cidade}/${dadosCliente.uf}` : ""}</p> : null}
              </div>
            </div>
          ) : (
            <div className="bg-[#0F1A2E] text-white p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold">CONEXÃO EXPRESS</p>
                <p className="text-[10px] text-slate-300">{previa.empresa.cnpj}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-orange-400">FATURA DE SERVIÇOS</p>
                <p className="text-[10px] text-slate-300">Nº {previa.numero}</p>
                <p className="text-[10px] text-slate-300">Emissão: {fmtData(previa.data)} · Venc: {fmtData(previa.vencimento)}</p>
              </div>
            </div>
          )}
          {modelo !== "calvo" && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Emitente</p>
                <Linha label="Razão social" valor={previa.empresa.razaoSocial} />
                <Linha label="CNPJ" valor={previa.empresa.cnpj} />
                <Linha label="Endereço" valor={`${previa.empresa.endereco} — ${previa.empresa.cidade}/${previa.empresa.uf}`} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Cliente</p>
                <Linha label="Razão social" valor={previa.cliente || "—"} />
                <Linha label="CNPJ" valor={dadosCliente?.cnpj || "—"} />
                <Linha label="Endereço" valor={dadosCliente?.endereco || "—"} />
              </div>
            </div>
          )}

          {/* Serviços — modelo calvo: tabela FATURA/DESCRIÇÃO/PARCELA/VENCIMENTO/VALOR */}
          {modelo === "calvo" ? (
            <div className="px-4">
              <table className="w-full text-xs border border-slate-300">
                <thead>
                  <tr className="bg-[#DCDCDC] text-slate-800">
                    <th className="p-2 text-center border border-slate-400 w-[15%]">FATURA</th>
                    <th className="p-2 text-left border border-slate-400">DESCRIÇÃO</th>
                    <th className="p-2 text-center border border-slate-400 w-[10%]">PARCELA</th>
                    <th className="p-2 text-center border border-slate-400 w-[15%]">VENCIMENTO</th>
                    <th className="p-2 text-center border border-slate-400 w-[16%]">VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.itens.map((i, idx) => {
                    const parcelaExib = (fatura.metadata?.parcela && typeof fatura.metadata.parcela === "string" && (fatura.metadata.parcela as string).trim())
                      ? `${(fatura.metadata.parcela as string).trim()}/1`
                      : "1/1";
                    return (
                      <tr key={idx} className="border-t border-slate-300">
                        <td className="p-2 text-center border-r border-slate-300 font-semibold">{previa.numero}</td>
                        <td className="p-2 align-top border-r border-slate-300 leading-snug">{previa.descricao || i.descricao || "Serviço de transporte"}</td>
                        <td className="p-2 text-center border-r border-slate-300">{parcelaExib}</td>
                        <td className="p-2 text-center border-r border-slate-300">{fmtData(previa.vencimento)}</td>
                        <td className="p-2 text-center font-bold text-[#003399]">{fmtM(i.valor)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4">
              <table className="w-full text-xs border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="p-2">Data</th><th className="p-2">OS</th><th className="p-2">Romaneio/OC</th><th className="p-2">Descrição</th><th className="p-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.itens.map((i, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{fmtData(i.data)}</td>
                      <td className="p-2">{i.os}</td>
                      <td className="p-2">{i.romaneio || "—"}</td>
                      <td className="p-2">{i.descricao || "Serviço de transporte"}</td>
                      <td className="p-2 text-right font-semibold">{fmtM(i.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {modelo === "calvo" ? (
            <div className="px-4 py-3 space-y-0.5">
              <p className="text-[10px] font-bold text-[#003399] mb-1">Dados para Transferência Bancária</p>
              {previa.empresa.banco ? <p className="text-[10px] text-slate-600">Banco {previa.empresa.banco}</p> : null}
              {previa.empresa.agencia ? <p className="text-[10px] text-slate-600">AG: {previa.empresa.agencia}</p> : null}
              {previa.empresa.conta ? <p className="text-[10px] text-slate-600">C/C: {previa.empresa.conta}</p> : null}
              {previa.empresa.pix ? <p className="text-[10px] text-slate-600">CHAVE PIX: {previa.empresa.pix}</p> : null}
              {!previa.empresa.banco && !previa.empresa.pix ? <p className="text-[10px] text-slate-400">Dados bancários a configurar</p> : null}
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Totais</p>
                <Linha label="Subtotal" valor={fmtM(previa.subtotal)} />
                <Linha label="Acréscimos" valor={fmtM(previa.acrescimos)} />
                <Linha label="Descontos" valor={`- ${fmtM(previa.descontos)}`} />
                <Linha label="TOTAL DA FATURA" valor={<span className="text-orange-600 font-extrabold">{fmtM(previa.total)}</span>} bold />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Dados para pagamento</p>
                {previa.empresa.banco ? <Linha label="Banco" valor={previa.empresa.banco} /> : null}
                {previa.empresa.agencia ? <Linha label="Agência" valor={previa.empresa.agencia} /> : null}
                {previa.empresa.conta ? <Linha label="Conta" valor={previa.empresa.conta} /> : null}
                {previa.empresa.pix ? <Linha label="PIX" valor={previa.empresa.pix} /> : null}
                {!previa.empresa.banco && !previa.empresa.pix ? <p className="text-[10px] text-slate-400">Dados bancários a configurar</p> : null}
              </div>
            </div>
          )}

          {previa.observacao && (
            <div className="px-4 pb-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Observação</p>
              <p className="text-xs text-slate-600">{previa.observacao}</p>
            </div>
          )}

          <div className="px-4 pb-3 flex justify-end">
            <span className="text-[9px] text-slate-400">Fatura {previa.numero} - Conexão Express</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
