import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search, Plus, Filter, Eye, Edit, Copy, CheckCircle, XCircle,
  FileDown, ArrowRight, ExternalLink, Loader2, FileCheck, Send
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Orcamento, OrcamentoStatus, STATUS_CONFIG } from "./types";
import OrcamentoForm from "./OrcamentoForm";
import OrcamentoPreview from "./OrcamentoPreview";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { gerarPdfOrcamento } from "./orcamentoPdf";
import { toOrcamentoInsert, toOrcamentoDomain } from "@/lib/dbMappers";
import {
  aprovarOrcamento,
  gerarOSDoOrcamento,
  verificarOSJaGerada,
} from "@/services/comercial/orcamentoToOSService";
// MISSÃO COTACAO-EXPRESS — pré-preenchimento do Novo Orçamento a partir da cotação
import {
  buscarCotacao,
  buscarCotacaoPorOrcamento,
  montarOrcamentoDaCotacao,
  vincularCotacaoAoOrcamento,
  marcarCotacaoAguardandoDetalhes,
  garantirClienteAvulsoCotacao,
} from "@/services/cotacoes/cotacaoPublicaService";

const ITEMS_PER_PAGE = 8;

const OrcamentosLista = () => {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<Orcamento | null>(null);
  const [modoForm, setModoForm] = useState<"ver" | "editar" | "novo" | null>(null);
  const [dialogReprovar, setDialogReprovar] = useState<Orcamento | null>(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  // MISSÃO COTACAO-EXPRESS — cotação pública aberta no modo "novo" (pré-preenchida)
  const [cotacaoVinculada, setCotacaoVinculada] = useState<string | null>(null);

  // Loading por ação individual (key = orc.id)
  const [loadingAprovar, setLoadingAprovar] = useState<string | null>(null);
  const [loadingGerarOS, setLoadingGerarOS] = useState<string | null>(null);

  // Mapa de OS vinculadas (orcamento.id → {osId, osNumero})
  const [osVinculadas, setOsVinculadas] = useState<Record<string, { osId: string; osNumero: string }>>({});

  const responsaveis = [...new Set(orcamentos.map((o) => o.responsavel))];
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchOrcamentos();
    const acao = searchParams.get("action");
    const cotacaoIdParam = searchParams.get("cotacao");
    const orcamentoIdParam = searchParams.get("orcamento");

    if (acao === "novo") {
      setModoForm("novo");
      // nunca reaproveita uma seleção anterior (preview) como pré-preenchimento
      setOrcamentoSelecionado(null);
      setCotacaoVinculada(null);
      searchParams.delete("action");
      if (!cotacaoIdParam) setSearchParams(searchParams, { replace: true });
    }

    // MISSÃO COTACAO-EXPRESS — alerta Realtime / link direto: abre o
    // "Novo Orçamento Comercial" já pré-preenchido com a cotação do site.
    if (cotacaoIdParam) {
      void (async () => {
        const res = await buscarCotacao(cotacaoIdParam);
        if (res.ok && res.dado) {
          setCotacaoVinculada(res.dado.id);
          const orcamento = montarOrcamentoDaCotacao(res.dado);
          // Cadastra/reaproveita o cliente da cotação (Nome + WhatsApp da Etapa 1)
          // para que a conversão em OS grave o uuid — nunca o nome — em
          // `ordens_servico.cliente` ("Cliente não definido" deixa de ocorrer).
          const cliente = await garantirClienteAvulsoCotacao({
            nome: res.dado.nome_cliente || "",
            telefone: res.dado.telefone,
            origem: "Cotação Express",
          });
          if (cliente.clienteId) {
            orcamento.clienteId = cliente.clienteId;
          } else if (cliente.erro) {
            toast.warning("Cliente da cotação não pôde ser cadastrado automaticamente.", {
              description: cliente.erro,
            });
          }
          setOrcamentoSelecionado(orcamento);
          setModoForm("novo");
          toast.success("Cotação do site carregada no Novo Orçamento.", {
            description: `${res.dado.nome_cliente || "Cliente"} · ${res.dado.paradas.length} endereço(s)`,
          });
        } else {
          toast.error(res.erro || "Cotação não encontrada.");
        }
        searchParams.delete("cotacao");
        setSearchParams(searchParams, { replace: true });
      })();
      return;
    }

    // MISSÃO COTACAO-EXPRESS — cliente completou a Fase 2 → abre o orçamento vinculado
    if (orcamentoIdParam) {
      void (async () => {
        const { data, error } = await supabase
          .from("orcamentos")
          .select("*")
          .eq("id", orcamentoIdParam)
          .maybeSingle();
        if (!error && data) {
          setOrcamentoSelecionado(toOrcamentoDomain(data as Record<string, unknown>) as Orcamento);
          setModoForm("editar");
        } else {
          toast.error("Orçamento vinculado não encontrado.");
        }
        searchParams.delete("orcamento");
        setSearchParams(searchParams, { replace: true });
      })();
      return;
    }
  }, [searchParams]);

  const fetchOrcamentos = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01") { setOrcamentos([]); return; }
        throw error;
      }

      // TMS-COM-ORC-02 — DB → domínio (contrato único): garante dataEmissao,
      // clienteCnpj, valorBase/valorFinal corretos na listagem/PDF.
      const lista = (((data as any[]) || [])).map(toOrcamentoDomain);
      setOrcamentos(lista as any);

      // Carregar OS vinculadas para orçamentos convertidos
      const convertidos = lista.filter(
        (o: Orcamento) => o.status === "convertido" || o.status === "convertido_em_os"
      );
      if (convertidos.length > 0) {
        await carregarOsVinculadas(convertidos);
      }
    } catch (e: any) {
      if (e.code !== "42P01") toast.error("Erro ao carregar orçamentos.");
      setOrcamentos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const carregarOsVinculadas = async (convertidos: Orcamento[]) => {
    const mapa: Record<string, { osId: string; osNumero: string }> = {};
    for (const orc of convertidos) {
      // Já tem no campo local
      if (orc.osVinculadaId) {
        mapa[orc.id] = { osId: orc.osVinculadaId, osNumero: orc.osVinculadaNumero || "" };
        continue;
      }
      // Busca no banco
      const check = await verificarOSJaGerada(orc.id);
      if (check.jaGerada && check.osId) {
        mapa[orc.id] = { osId: check.osId, osNumero: check.osNumero || "" };
      }
    }
    setOsVinculadas(prev => ({ ...prev, ...mapa }));
  };

  const filtrados = orcamentos.filter((o) => {
    const matchBusca = !busca ||
      o.numero.toLowerCase().includes(busca.toLowerCase()) ||
      o.cliente.toLowerCase().includes(busca.toLowerCase()) ||
      (o.clienteCnpj || "").includes(busca);
    const matchStatus = filtroStatus === "todos" || o.status === filtroStatus;
    const matchResp = filtroResponsavel === "todos" || o.responsavel === filtroResponsavel;
    return matchBusca && matchStatus && matchResp;
  });

  const totalPaginas = Math.ceil(filtrados.length / ITEMS_PER_PAGE);
  const paginados = filtrados.slice((pagina - 1) * ITEMS_PER_PAGE, pagina * ITEMS_PER_PAGE);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // ─── Aprovar ────────────────────────────────────────────────────────────────
  const handleAprovar = async (orc: Orcamento) => {
    setLoadingAprovar(orc.id);
    toast.loading("Aprovando orçamento...", { id: "aprovar" });
    try {
      const res = await aprovarOrcamento(orc);
      if (res.success) {
        // MISSÃO COTACAO-EXPRESS — aprovado → cotação espera os detalhes da Fase 2
        const cotacao = await buscarCotacaoPorOrcamento(orc.id);
        if (cotacao.ok && cotacao.dado) {
          await marcarCotacaoAguardandoDetalhes(cotacao.dado.id);
        }
        toast.success("Orçamento aprovado com sucesso!", { id: "aprovar" });
        fetchOrcamentos();
      } else {
        toast.error(res.erro || "Erro ao aprovar.", { id: "aprovar" });
      }
    } catch {
      toast.error("Erro ao aprovar.", { id: "aprovar" });
    } finally {
      setLoadingAprovar(null);
    }
  };

  // ─── Gerar OS ───────────────────────────────────────────────────────────────
  const handleGerarOS = async (orc: Orcamento) => {
    setLoadingGerarOS(orc.id);
    toast.loading("Gerando ordem de serviço...", { id: "gerar-os" });
    try {
      const res = await gerarOSDoOrcamento(orc);
      if (res.success) {
        toast.success(`OS ${res.osNumero} criada com sucesso!`, { id: "gerar-os" });
        if (res.osId && res.osNumero) {
          setOsVinculadas(prev => ({
            ...prev,
            [orc.id]: { osId: res.osId!, osNumero: res.osNumero! },
          }));
        }
        fetchOrcamentos();
      } else {
        // Se já existe OS, guarda o vínculo
        if (res.osId && res.osNumero) {
          setOsVinculadas(prev => ({
            ...prev,
            [orc.id]: { osId: res.osId!, osNumero: res.osNumero! },
          }));
        }
        toast.error(res.erro || "Erro ao gerar OS.", { id: "gerar-os" });
      }
    } catch {
      toast.error("Erro ao gerar OS.", { id: "gerar-os" });
    } finally {
      setLoadingGerarOS(null);
    }
  };

  const navigate = useNavigate();

  // ─── Abrir OS vinculada ──────────────────────────────────────────────────────
  const handleAbrirOS = (osId: string) => {
    navigate(`/operacao?os=${osId}`);
  };

  // ─── Reprovar ───────────────────────────────────────────────────────────────
  const handleReprovar = async () => {
    if (!dialogReprovar) return;
    try {
      const hist = [
        ...(dialogReprovar.historico || []),
        { data: new Date().toLocaleString("pt-BR"), acao: `Reprovado: ${motivoReprovacao}`, usuario: "Usuário atual" },
      ];
      const res = await saveToSupabase(
        { ...dialogReprovar, status: "reprovado" as OrcamentoStatus, historico: hist, motivoReprovacao },
        false
      );
      if (res) {
        toast.success("Orçamento reprovado.");
        setDialogReprovar(null);
        setMotivoReprovacao("");
      }
    } catch {
      toast.error("Erro ao reprovar.");
    }
  };

  // ─── Duplicar ───────────────────────────────────────────────────────────────
  const handleDuplicar = async (orc: Orcamento) => {
    const novoNumero = `ORC-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,"0")}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const novo: Orcamento = {
      ...JSON.parse(JSON.stringify(orc)),
      id: String(Date.now()),
      numero: novoNumero,
      status: "rascunho",
      dataEmissao: new Date().toISOString().split("T")[0],
      osVinculadaId: undefined,
      osVinculadaNumero: undefined,
      historico: [{ data: new Date().toLocaleString("pt-BR"), acao: `Duplicado de ${orc.numero}`, usuario: "Usuário atual" }],
    };
    await saveToSupabase(novo, true);
  };

  // ─── Enviar (rascunho → enviado) ────────────────────────────────────────────
  const handleEnviar = async (orc: Orcamento) => {
    try {
      const hist = [
        ...(orc.historico || []),
        { data: new Date().toLocaleString("pt-BR"), acao: "Orçamento enviado ao cliente", usuario: "Usuário atual" },
      ];
      const res = await saveToSupabase({ ...orc, status: "enviado" as OrcamentoStatus, historico: hist }, false);
      if (res) toast.success("Orçamento marcado como Enviado!");
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  };

  /** Salva e devolve o id do orçamento (ou `false` em erro) — usado pelo vínculo da cotação. */
  const saveToSupabase = async (orc: Orcamento, isNew: boolean): Promise<string | false> => {
    try {
      const dbPayload = toOrcamentoInsert(orc);
      const result = isNew
        ? await supabase.from("orcamentos").insert([dbPayload]).select()
        : await supabase.from("orcamentos").update(dbPayload).eq("id", orc.id).select();

      if (result.error) {
        toast.error(`Erro ao salvar: ${result.error.message}`);
        return false;
      }
      fetchOrcamentos();
      toast.success(isNew ? "Orçamento criado!" : "Orçamento atualizado!");
      const linha = Array.isArray(result.data) ? (result.data as { id?: unknown }[])[0] : null;
      return String(linha?.id ?? orc.id);
    } catch {
      toast.error("Erro inesperado ao salvar.");
      return false;
    }
  };

  const handleSalvar = async (orc: Orcamento) => {
    const idSalvo = await saveToSupabase(orc, modoForm === "novo");
    // MISSÃO COTACAO-EXPRESS — grava o vínculo no lado da cotação
    // (a Fase 2 e o alerta "Pronto para OS" dependem dele)
    if (idSalvo && cotacaoVinculada) {
      const vinculo = await vincularCotacaoAoOrcamento(cotacaoVinculada, String(idSalvo));
      if (vinculo.ok) {
        toast.success("Cotação do site vinculada a este orçamento.");
      } else {
        toast.warning("Orçamento salvo, mas o vínculo com a cotação falhou.");
      }
    }
    setModoForm(null);
    setOrcamentoSelecionado(null);
    setCotacaoVinculada(null);
  };

  if (modoForm && (orcamentoSelecionado || modoForm === "novo")) {
    return (
      <OrcamentoForm
        orcamento={orcamentoSelecionado || undefined}
        modo={modoForm}
        cotacaoId={cotacaoVinculada}
        onVoltar={() => { setModoForm(null); setOrcamentoSelecionado(null); setCotacaoVinculada(null); }}
        onSalvar={handleSalvar}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Orçamentos</h2>
          <p className="text-sm text-muted-foreground">Gestão de propostas comerciais</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { setOrcamentoSelecionado(null); setCotacaoVinculada(null); setModoForm("novo"); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Orçamento
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por número, cliente ou CNPJ..." value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} className="pl-9" />
            </div>
            <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPagina(1); }}>
              <SelectTrigger className="w-[180px]"><Filter className="w-3 h-3 mr-1" /><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroResponsavel} onValueChange={(v) => { setFiltroResponsavel(v); setPagina(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>OS Vinculada</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : paginados.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum orçamento encontrado.</TableCell></TableRow>
                ) : paginados.map((orc) => {
                  const osVinc = osVinculadas[orc.id];
                  const jaConvertido = orc.status === "convertido" || orc.status === "convertido_em_os";
                  const isAprovandoThis = loadingAprovar === orc.id;
                  const isGerandoThis = loadingGerarOS === orc.id;

                  return (
                    <TableRow key={orc.id} className="hover:bg-muted/50 group">
                      <TableCell className="font-medium text-primary cursor-pointer" onClick={() => { setOrcamentoSelecionado(orc); setShowPreview(true); }}>
                        {orc.numero}
                      </TableCell>
                      <TableCell onClick={() => { setOrcamentoSelecionado(orc); setShowPreview(true); }} className="cursor-pointer">
                        <div className="font-medium">{orc.cliente}</div>
                        <div className="text-xs text-muted-foreground">{orc.clienteCnpj}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {orc.dataEmissao ? (() => { try { return new Date(orc.dataEmissao).toLocaleDateString("pt-BR"); } catch { return "—"; } })() : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(orc.valores?.valorFinal || 0)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CONFIG[orc.status]?.color || "bg-gray-100 text-gray-800"}`}>
                          {STATUS_CONFIG[orc.status]?.label || orc.status}
                        </span>
                      </TableCell>

                      {/* Coluna OS Vinculada */}
                      <TableCell>
                        {jaConvertido && osVinc ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                              <FileCheck className="w-3 h-3" />{osVinc.osNumero}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleAbrirOS(osVinc.osId)}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" /> Abrir OS
                            </Button>
                          </div>
                        ) : jaConvertido ? (
                          <span className="text-xs text-muted-foreground">Carregando...</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>{orc.responsavel || "—"}</TableCell>

                      {/* Ações por status */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Sempre disponíveis */}
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Visualizar" onClick={() => { setOrcamentoSelecionado(orc); setShowPreview(true); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Gerar PDF" onClick={async () => await gerarPdfOrcamento(orc)}>
                            <FileDown className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar" onClick={() => handleDuplicar(orc)}>
                            <Copy className="w-4 h-4" />
                          </Button>

                          {/* Rascunho → Editar + Enviar */}
                          {orc.status === "rascunho" && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => { setOrcamentoSelecionado(orc); setModoForm("editar"); }}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                title="Marcar como Enviado"
                                onClick={() => handleEnviar(orc)}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </>
                          )}

                          {/* Enviado / Em análise → Aprovar + Reprovar */}
                          {(orc.status === "enviado" || orc.status === "em_analise") && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:bg-green-50"
                                title="Aprovar Orçamento"
                                disabled={isAprovandoThis}
                                onClick={() => handleAprovar(orc)}
                              >
                                {isAprovandoThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:bg-red-50"
                                title="Reprovar"
                                onClick={() => setDialogReprovar(orc)}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}

                          {/* Aprovado → Gerar OS */}
                          {orc.status === "aprovado" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-emerald-700 hover:bg-emerald-50 font-semibold"
                              title="Gerar Ordem de Serviço"
                              disabled={isGerandoThis}
                              onClick={() => handleGerarOS(orc)}
                            >
                              {isGerandoThis
                                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Gerando...</>
                                : <><ArrowRight className="w-3 h-3 mr-1" /> Gerar OS</>
                              }
                            </Button>
                          )}

                          {/* Convertido → Abrir OS */}
                          {jaConvertido && osVinc && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-700 hover:bg-emerald-50"
                              title={`Abrir OS ${osVinc.osNumero}`}
                              onClick={() => handleAbrirOS(osVinc.osId)}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{filtrados.length} orçamento(s)</p>
          <div className="flex gap-1">
            {Array.from({ length: totalPaginas }, (_, i) => (
              <Button key={i} variant={pagina === i + 1 ? "default" : "outline"} size="sm" onClick={() => setPagina(i + 1)}>{i + 1}</Button>
            ))}
          </div>
        </div>
      )}

      {/* Dialog Reprovar */}
      <Dialog open={!!dialogReprovar} onOpenChange={() => setDialogReprovar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprovar Orçamento {dialogReprovar?.numero}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe o motivo da reprovação:</p>
            <Textarea value={motivoReprovacao} onChange={(e) => setMotivoReprovacao(e.target.value)} placeholder="Motivo..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogReprovar(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReprovar} disabled={!motivoReprovacao.trim()}>Confirmar Reprovação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview */}
      <Dialog open={showPreview} onOpenChange={(open) => { if (!open) { setShowPreview(false); setOrcamentoSelecionado(null); } }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-orange-500" /> Visualização do Orçamento
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {orcamentoSelecionado && <OrcamentoPreview orcamento={orcamentoSelecionado} onVoltar={() => { setShowPreview(false); setOrcamentoSelecionado(null); }} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrcamentosLista;
