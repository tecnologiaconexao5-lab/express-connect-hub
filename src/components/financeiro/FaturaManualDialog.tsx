import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Receipt, X, Loader2, Hash, Building2, FileText, Banknote,
  Landmark, StickyNote, Eye, Send, Save, ShieldCheck, UserRound, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FormSectionCard } from "@/components/ui/premium-document";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";
import {
  buscarDadosEmpresaParaFatura,
  buscarClienteParaFatura,
  sugerirModeloFaturaParaCliente,
  sugerirVencimentoParaCliente,
  criarFaturaManual,
  enviarFaturaParaValidacao,
  verificarNumeroFaturaManualDisponivel,
  montarSnapshotConta,
  montarInputPdfFatura,
  type DadosEmpresaFatura,
  type DadosClienteFatura,
  type ModeloFatura,
  type ContaBancariaSnapshot,
  type FaturaComItens,
} from "@/services/financeiro/faturaService";
import { buscarContasBancariasConfig, type ContaBancariaFinanceira } from "@/services/financeiro/configFinanceiraService";
import { baixarPDFFatura } from "@/utils/pdfFatura";
import { PreviaModal } from "./FaturaPanel";

const fmtM = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hoje = () => new Date().toISOString().split("T")[0];
const mais30 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
};

interface FaturaManualDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onFaturaSalva?: () => void;
}

export function FaturaManualDialog({ open, onOpenChange, onFaturaSalva }: FaturaManualDialogProps) {
  // ── Identificação ───────────────────────────────────────────────────────────
  const [numero, setNumero] = useState("");
  const [numeroChecado, setNumeroChecado] = useState<boolean | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteLabel, setClienteLabel] = useState("");
  const [dadosCliente, setDadosCliente] = useState<DadosClienteFatura | null>(null);
  const [dataEmissao, setDataEmissao] = useState(hoje);
  const [vencimento, setVencimento] = useState(mais30);
  const [parcela, setParcela] = useState("1");
  const [modelo, setModelo] = useState<ModeloFatura>("conexao_express");

  // ── Descrição / Valor / Conta / Observação interna ─────────────────────────
  const [descricao, setDescricao] = useState("");
  const [valorStr, setValorStr] = useState("");
  const [contas, setContas] = useState<ContaBancariaFinanceira[]>([]);
  const [contaId, setContaId] = useState<string>("");
  const [contaSelecionada, setContaSelecionada] = useState<ContaBancariaFinanceira | null>(null);
  const [observacaoInterna, setObservacaoInterna] = useState("");

  // ── Estado de execução ──────────────────────────────────────────────────────
  const [dadosEmpresa, setDadosEmpresa] = useState<DadosEmpresaFatura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mostrarPrevia, setMostrarPrevia] = useState(false);

  const numeroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const valorNum = useMemo(() => {
    const n = Number((valorStr || "").replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? 0 : n;
  }, [valorStr]);

  const snapshotConta = useMemo<ContaBancariaSnapshot | null>(() => montarSnapshotConta(contaSelecionada), [contaSelecionada]);

  const carregarBase = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const [emp, listaContas] = await Promise.all([buscarDadosEmpresaParaFatura(), buscarContasBancariasConfig()]);
    setDadosEmpresa(emp);
    setContas(listaContas || []);
    const principal = (listaContas || []).find((c) => c.ativa !== false && c.principal === true)
      || (listaContas || []).find((c) => c.ativa !== false)
      || (listaContas || [])[0];
    setContaSelecionada(principal || null);
    setContaId(principal?.id || "");
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (open) {
      setNumero("");
      setNumeroChecado(null);
      setClienteId(null);
      setClienteLabel("");
      setDadosCliente(null);
      setDataEmissao(hoje());
      setVencimento(mais30());
      setParcela("1");
      setModelo("conexao_express");
      setDescricao("");
      setValorStr("");
      setObservacaoInterna("");
      setErro(null);
      setMostrarPrevia(false);
      carregarBase();
    }
  }, [open, carregarBase]);

  // Checagem de duplicidade do número (debounce)
  useEffect(() => {
    if (numeroTimer.current) clearTimeout(numeroTimer.current);
    const num = numero.trim();
    if (!num) { setNumeroChecado(null); return; }
    setNumeroChecado(null);
    numeroTimer.current = setTimeout(async () => {
      const r = await verificarNumeroFaturaManualDisponivel(num);
      setNumeroChecado(r.disponivel);
      if (!r.disponivel) setErro(r.message || "Já existe uma fatura com este número.");
      else setErro((prev) => (prev === "Já existe uma fatura com este número." ? null : prev));
    }, 450);
    return () => { if (numeroTimer.current) clearTimeout(numeroTimer.current); };
  }, [numero]);

  const handleSelecionarCliente = async (value: string | null, record?: Record<string, unknown> | null) => {
    setClienteId(value);
    if (!value) {
      setClienteLabel("");
      setDadosCliente(null);
      return;
    }
    // F38-MANUAL-2 — usa o registro já carregado pelo seletor como fonte primária,
    // garantindo que os dados do cliente cheguem ao PDF mesmo se a consulta
    // oficial falhar/atrasar. NÃO altera o cadastro mestre (somente leitura).
    const toStr = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
    const toNumOrNull = (v: unknown): number | null => (v != null && !Number.isNaN(Number(v)) ? Number(v) : null);
    const fromRecord = (r: Record<string, unknown>): DadosClienteFatura => ({
      razaoSocial: toStr(r.razao_social) || toStr(r.nome_fantasia) || "Cliente",
      nomeFantasia: toStr(r.nome_fantasia) || null,
      cnpj: toStr(r.cnpj) || null,
      ie: toStr(r.ie) || null,
      inscricaoMunicipal: toStr(r.inscricao_municipal) || null,
      endereco: toStr(r.endereco),
      cidade: toStr(r.cidade),
      uf: toStr(r.uf),
      vencimentoPadraoDias: toNumOrNull(r.vencimento_padrao),
      tipoCobranca: toStr(r.tipo_cobranca) || null,
      tabelaValoresPadraoId: toStr(r.tabela_valores_padrao_id) || null,
    });
    if (record) {
      const cliRecord = fromRecord(record);
      setDadosCliente(cliRecord);
      setClienteLabel(cliRecord.razaoSocial);
    }
    // Confirma via service oficial (fonte das regras de modelo/vencimento)
    const cli = await buscarClienteParaFatura(value);
    if (cli) {
      setDadosCliente(cli);
      setClienteLabel(cli.razaoSocial || cli.nomeFantasia || "Cliente");
    }
    // Sugere modelo e vencimento a partir da REGRA do cliente (mesmo fluxo automático)
    const cliRef = cli || (record ? fromRecord(record) : null);
    const modeloSug = await sugerirModeloFaturaParaCliente(value, cliRef?.razaoSocial, cliRef?.cnpj);
    setModelo(modeloSug);
    const vencSug = await sugerirVencimentoParaCliente(value, dataEmissao);
    setVencimento(vencSug);
  };

  const handleContaChange = (v: string) => {
    setContaId(v);
    setContaSelecionada(contas.find((c) => c.id === v) || null);
  };

  // TMS-FIN-PROG-04B — o número NÃO é mais exigido no rascunho: o Nº Conexão e o
  // Nº Cliente são gerados na EMISSÃO (RPC f_emitir_fatura).
  const validar = (): boolean => {
    if (!clienteId) { setErro("Selecione o cliente."); return false; }
    if (valorNum <= 0) { setErro("O valor deve ser maior que zero."); return false; }
    if (!vencimento) { setErro("Informe a data de vencimento."); return false; }
    setErro(null);
    return true;
  };

  // ── Fatura simulada para a prévia (sem salvar) ─────────────────────────────
  const montarFaturaSimulada = useCallback((): FaturaComItens | null => {
    if (!clienteId || valorNum <= 0) return null;
    const agora = new Date().toISOString();
    return {
      id: "preview-manual",
      tenant_id: "",
      numero: null,
      numero_cliente: null,
      cliente_id: clienteId,
      modelo,
      descricao: descricao || null,
      data_emissao: dataEmissao,
      competencia_inicio: null,
      competencia_fim: null,
      vencimento: vencimento || null,
      valor_bruto: valorNum,
      descontos: 0,
      acrescimos: 0,
      valor_total: valorNum,
      status: "rascunho",
      observacao: observacaoInterna || null,
      observacao_fiscal: null,
      conta_receber_id: null,
      criado_por: null,
      criado_em: agora,
      atualizado_por: null,
      atualizado_em: agora,
      cancelado_em: null,
      cancelado_por: null,
      motivo_cancelamento: null,
      metadata: { origem: "manual", numeroManual: numero.trim(), contaBancaria: snapshotConta, modelo, descricao },
      itens: [{
        id: "preview-item",
        fatura_id: "preview-manual",
        os_id: null,
        alocacao_id: null,
        cliente_id: clienteId,
        romaneio: null,
        descricao: descricao || "Fatura manual",
        data_servico: dataEmissao,
        valor_base: valorNum,
        valor_adicionais: 0,
        valor_descontos: 0,
        valor_total: valorNum,
        km_excedente: 0,
        pedagio_cliente: 0,
        ajudante_cliente: 0,
        diaria_cliente: 0,
        saidas_adicionais_cliente: 0,
        status: "ativo",
        criado_por: null,
        criado_em: agora,
        atualizado_em: agora,
      }],
    };
  }, [clienteId, valorNum, modelo, descricao, dataEmissao, vencimento, observacaoInterna, numero, snapshotConta]);

  const empresaComConta = useMemo(() => {
    if (!dadosEmpresa) return null;
    if (!snapshotConta) return dadosEmpresa;
    return {
      ...dadosEmpresa,
      banco: snapshotConta.banco || dadosEmpresa.banco,
      agencia: snapshotConta.agencia || dadosEmpresa.agencia,
      conta: snapshotConta.conta || dadosEmpresa.conta,
      pix: snapshotConta.pix || dadosEmpresa.pix,
    };
  }, [dadosEmpresa, snapshotConta]);

  const baixarPdfDaFatura = useCallback(async (fatura: FaturaComItens, empresa: DadosEmpresaFatura) => {
    // F38-MANUAL-2 — garante os dados do cliente no PDF mesmo se o estado não
    // tiver sido populado (re-busca a partir do cliente_id da fatura).
    let cli = dadosCliente;
    if (!cli && fatura.cliente_id) {
      cli = await buscarClienteParaFatura(fatura.cliente_id);
    }
    const input = montarInputPdfFatura(fatura, empresa, cli);
    await baixarPDFFatura(input);
  }, [dadosCliente]);

  const handleVisualizar = () => {
    if (!validar()) return;
    setMostrarPrevia(true);
  };

  const handleSalvarRascunho = async () => {
    if (!validar()) return;
    setSalvando(true);
    setErro(null);
    const res = await criarFaturaManual({
      cliente_id: clienteId as string,
      modelo,
      data_emissao: dataEmissao,
      vencimento,
      parcela,
      descricao,
      valor: valorNum,
      conta: snapshotConta,
      observacaoInterna: observacaoInterna || null,
    });
    setSalvando(false);
    if (res.success) {
      onFaturaSalva?.();
      onOpenChange(false);
    } else {
      setErro(res.error || "Erro ao salvar fatura");
    }
  };

  // TMS-FAT-URG-04 — a Fatura Manual obedece ao MESMO contrato: cria rascunho e
  // ENVIA PARA VALIDAÇÃO. A emissão (e o AR) só ocorrem após aprovação, em Faturas.
  // NÃO há exceção no banco para a fatura manual (nenhuma fatura sem aprovação).
  const handleSalvarEEnviarValidacao = async () => {
    if (!validar()) return;
    setSalvando(true);
    setErro(null);
    const res = await criarFaturaManual({
      cliente_id: clienteId as string,
      modelo,
      data_emissao: dataEmissao,
      vencimento,
      parcela,
      descricao,
      valor: valorNum,
      conta: snapshotConta,
      observacaoInterna: observacaoInterna || null,
    });
    if (!res.success || !res.fatura) {
      setSalvando(false);
      setErro(res.error || "Erro ao salvar fatura");
      return;
    }
    const mv = await enviarFaturaParaValidacao(res.fatura.id);
    setSalvando(false);
    if (!mv.success) {
      setErro(mv.error || "Rascunho salvo, mas falhou ao enviar para validação");
      return;
    }
    onFaturaSalva?.();
    onOpenChange(false);
  };

  const LinhaCadastro = ({ label, valor }: { label: string; valor: string }) => (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-medium text-slate-700" title={valor}>{valor || "—"}</p>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F97316]/10">
                <Receipt className="h-5 w-5 text-[#F97316]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold">Nova Fatura Manual</DialogTitle>
                <DialogDescription className="text-[11px]">
                  Fatura profissional sem vínculo com OS/CT-e — usa a estrutura oficial <strong>faturas + fatura_itens</strong>. Não dispara NFS-e/CT-e automaticamente.
                </DialogDescription>
              </div>
              <Badge variant="outline" className="ml-auto hidden sm:inline-flex bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20">
                Manual
              </Badge>
            </div>
          </DialogHeader>

          {carregando ? (
            <div className="flex items-center justify-center py-16">
              <ProgressiveBlocksLoader size="normal" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* ── Coluna principal — Seções A a E ─────────────────────────── */}
              <div className="space-y-5 lg:col-span-2">
                {/* SEÇÃO A — Identificação */}
                <FormSectionCard icon={Hash} title="Identificação" description="Dados básicos da fatura manual">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Números da fatura</Label>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">
                        Nº Conexão e Nº Cliente serão gerados na <strong className="text-slate-700">emissão</strong>.
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Cliente *</Label>
                      <SearchableSelect
                        table="clientes"
                        labelField="razao_social"
                        searchFields={["razao_social", "nome_fantasia", "cnpj"]}
                        secondaryField="cnpj"
                        placeholder="Pesquisar cliente pelo nome..."
                        value={clienteId}
                        onChange={(v, rec) => { void rec; handleSelecionarCliente(v, rec as Record<string, unknown> | null); }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Data de emissão *</Label>
                      <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Data de vencimento *</Label>
                      <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Parcela</Label>
                      <Input value={parcela} onChange={(e) => setParcela(e.target.value)} className="h-9 text-xs" />
                      <p className="text-[9px] text-slate-400">Padrão 1 (1/1 no PDF)</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Modelo da fatura</Label>
                      <Select value={modelo} onValueChange={(v) => setModelo(v as ModeloFatura)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conexao_express">Padrão Conexão Express</SelectItem>
                          <SelectItem value="calvo">Modelo do cliente (consolidado)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {dadosCliente && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dados do cliente (do cadastro — não altera o cadastro mestre)</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <LinhaCadastro label="Razão social" valor={dadosCliente.razaoSocial} />
                        <LinhaCadastro label="CNPJ" valor={dadosCliente.cnpj || ""} />
                        <LinhaCadastro label="IE" valor={dadosCliente.ie || ""} />
                        <LinhaCadastro label="Endereço" valor={dadosCliente.endereco ? `${dadosCliente.endereco}${dadosCliente.cidade ? ` — ${dadosCliente.cidade}/${dadosCliente.uf}` : ""}` : ""} />
                      </div>
                    </div>
                  )}
                </FormSectionCard>

                {/* SEÇÃO B — Descrição */}
                <FormSectionCard icon={FileText} title="Descrição da fatura" description="Texto exibido exatamente na coluna DESCRIÇÃO do PDF">
                  <div className="space-y-1.5">
                    <Textarea
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      rows={4}
                      className="text-xs"
                      placeholder="Ex.: Receita de CT-e referente aos romaneios nº 343550, 343375, 343421, 341721, 341770 e 343488, incluindo serviço de devolução."
                    />
                    <div className="flex justify-end">
                      <span className="text-[10px] text-slate-400">{descricao.length}/2000 caracteres</span>
                    </div>
                  </div>
                </FormSectionCard>

                {/* SEÇÃO C — Valor */}
                <FormSectionCard icon={Banknote} title="Valor" description="Moeda BRL — o valor informado não é recalculado automaticamente">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Valor total da fatura *</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={valorStr}
                          onChange={(e) => setValorStr(e.target.value)}
                          className="h-9 pl-9 text-xs"
                          placeholder="0,00"
                        />
                      </div>
                      {valorNum > 0 ? (
                        <p className="text-sm font-extrabold text-[#F97316] tabular-nums">{fmtM(valorNum)}</p>
                      ) : (
                        <p className="text-[10px] text-amber-600">Informe um valor maior que zero.</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Parcela no PDF</Label>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs text-slate-600">
                        A parcela {parcela || "1"} aparece na coluna PARCELA do PDF (ex.: {parcela || "1"}/1).
                      </div>
                    </div>
                  </div>
                </FormSectionCard>

                {/* SEÇÃO D — Conta para recebimento */}
                <FormSectionCard icon={Landmark} title="Conta para recebimento" description="Fonte: Config. Financeiras (contas_financeiras_config). A conta fica snapshotada na fatura.">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Conta bancária</Label>
                      {contas.length > 0 ? (
                        <Select value={contaId} onValueChange={handleContaChange}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                          <SelectContent>
                            {contas.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.banco ? `${c.banco}${c.agencia ? ` · AG ${c.agencia}` : ""}${c.conta ? ` · C/C ${c.conta}` : ""}` : c.nome || "Conta"} {c.principal ? "(principal)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">
                          Nenhuma conta configurada em Config. Financeiras. O PDF usará a conta padrão da empresa (se configurada).
                        </p>
                      )}
                    </div>

                    {contaSelecionada && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Conta selecionada para este PDF</p>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-700 sm:grid-cols-2">
                          <p><span className="text-slate-400">Banco: </span><strong>{contaSelecionada.banco || "—"}</strong></p>
                          <p><span className="text-slate-400">AG: </span><strong>{contaSelecionada.agencia || "—"}</strong></p>
                          <p><span className="text-slate-400">C/C: </span><strong>{contaSelecionada.conta || "—"}</strong></p>
                          <p className="truncate" title={contaSelecionada.pix || ""}><span className="text-slate-400">PIX: </span><strong>{contaSelecionada.pix || "—"}</strong></p>
                        </div>
                      </div>
                    )}
                  </div>
                </FormSectionCard>

                {/* SEÇÃO E — Observação interna */}
                <FormSectionCard icon={StickyNote} title="Observação interna" description="Registros internos (validações, e-mails, pendências). NÃO aparece no PDF.">
                  <div className="space-y-1.5">
                    <Textarea
                      value={observacaoInterna}
                      onChange={(e) => setObservacaoInterna(e.target.value)}
                      rows={3}
                      className="text-xs"
                      placeholder="Validações, e-mails, diferenças pendentes, observações financeiras..."
                    />
                  </div>
                </FormSectionCard>
              </div>

              {/* ── Coluna lateral — Resumo da fatura ───────────────────────── */}
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <Receipt className="h-3.5 w-3.5 text-[#F97316]" /> Resumo da fatura
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Nº Conexão</p>
                        <p className="text-sm font-extrabold text-slate-800">será gerado na emissão</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Nº Cliente</p>
                        <p className="text-sm font-extrabold text-slate-800">será gerado na emissão</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-slate-500"><UserRound className="h-3.5 w-3.5 shrink-0" /> Cliente</span>
                        <span className="text-right font-semibold text-slate-700">{clienteLabel || "—"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-slate-500"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> Vencimento</span>
                        <span className="font-semibold text-slate-700">{vencimento ? new Date(vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-slate-500"><Banknote className="h-3.5 w-3.5 shrink-0" /> Valor</span>
                        <span className="font-extrabold text-[#F97316] tabular-nums">{valorNum > 0 ? fmtM(valorNum) : "—"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-slate-500"><Hash className="h-3.5 w-3.5 shrink-0" /> Parcela</span>
                        <span className="font-semibold text-slate-700">{parcela || "1"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-slate-500"><FileText className="h-3.5 w-3.5 shrink-0" /> Modelo</span>
                        <span className="font-semibold text-slate-700">{modelo === "calvo" ? "Cliente (consolidado)" : "Conexão Express"}</span>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Conta escolhida é gravada na fatura (snapshot). Alterações futuras na conta da empresa não afetam PDFs históricos.
                    </p>
                  </div>
                </div>

                {erro && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{erro}</div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={salvando}>
              <X className="mr-1 h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button variant="outline" size="sm" onClick={handleSalvarRascunho} disabled={salvando || carregando}>
              {salvando ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              Salvar Rascunho
            </Button>
            <Button variant="outline" size="sm" onClick={handleVisualizar} disabled={carregando}>
              <Eye className="mr-1 h-3.5 w-3.5" /> Visualizar Fatura
            </Button>
            <Button size="sm" className="bg-[#F97316] hover:bg-[#EA580C]" onClick={handleSalvarEEnviarValidacao} disabled={salvando || carregando} title="Cria o rascunho e envia para validação. A emissão ocorre em Faturas, após aprovação.">
              {salvando ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
              Salvar e Enviar para Validação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prévia do PDF (reutiliza o template oficial) */}
      {mostrarPrevia && dadosEmpresa && (
        <PreviaModal
          fatura={montarFaturaSimulada() as FaturaComItens}
          dadosEmpresa={empresaComConta}
          dadosCliente={dadosCliente}
          modelo={modelo}
          onClose={() => setMostrarPrevia(false)}
          onBaixar={async () => {
            const f = montarFaturaSimulada();
            if (f) await baixarPdfDaFatura(f, empresaComConta as DadosEmpresaFatura);
          }}
        />
      )}
    </>
  );
}

export default FaturaManualDialog;
