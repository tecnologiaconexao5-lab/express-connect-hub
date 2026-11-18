import { useEffect, useRef, useState } from "react";
import { Stamp, PlusCircle, RefreshCw, Loader2, ShieldAlert, XCircle, AlertTriangle, CheckCircle2, Send, Eye, AlertCircle, GitBranch, HelpCircle, Lock, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { gerarRascunhoNfse } from "@/services/fiscal/nfseService";
import { buscarRegraNfse } from "@/services/fiscal/regrasFiscaisNfseService";
import { alterarStatusFiscalInterno, listarHistoricoStatus } from "@/services/fiscal/fiscalStatusService";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const fmtFin = function(v: number) { return v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"; };

/** Matriz oficial da NFS-e Nacional (nao usar o emitente padrao do CT-e). */
const CNPJ_MATRIZ_NFSE = "31227975000180";
const MATRIZ_NFSE_RAZAO_SOCIAL = "CONEXAO TRANSPORTES LTDA";
const MATRIZ_NFSE_CNPJ_FORMATADO = "31.227.975/0001-80";
const CODIGO_SERVICO_NACIONAL_PADRAO = "16.02.01.002";
const CAMPOS_BUSCA_MUNICIPIO = ["nome", "codigo"];
const PASSOS_NFSE = [
  { chave: "prestador", titulo: "Prestador" },
  { chave: "tomador", titulo: "Tomador" },
  { chave: "servico", titulo: "Serviço" },
  { chave: "tributacao", titulo: "Tributação" },
  { chave: "revisao", titulo: "Revisão" },
];
const somenteDigitos = function(valor?: string | null) { return (valor || "").replace(/\D/g, ""); };

type OrigemOpcao = {
  id: string;
  numero: string | null;
  cliente_id: string | null;
  cliente_nome: string;
  valor: number | null;
};

type RespostaTransmissao = {
  success?: boolean;
  status?: string;
  numero?: string | number | null;
  error?: string;
  rejeicao?: {
    codigo?: string | null;
    mensagem?: string | null;
    http_status?: number | null;
  } | null;
};

function mensagemTransmissao(
  payload: RespostaTransmissao | null,
  fallback: string,
): string {
  const rejeicao = payload?.rejeicao;
  const partes = [rejeicao?.codigo, rejeicao?.mensagem]
    .filter(function(parte): parte is string { return Boolean(parte); });
  if (partes.length > 0) return partes.join(" - ");
  if (payload?.error) return payload.error;
  return fallback;
}

export default function NfseTab() {
  const [nfses, setNfses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [isEmitting, setIsEmitting] = useState(false);
  const [passoAtual, setPassoAtual] = useState(1);
  const [rascunhoAtualId, setRascunhoAtualId] = useState<string | null>(null);
  const [emitindo, setEmitindo] = useState(false);
  const [selectedNfse, setSelectedNfse] = useState<any>(null);
  const [showPreEmissao, setShowPreEmissao] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [regraSugerida, setRegraSugerida] = useState<any>(null);
  const [avisoRegra, setAvisoRegra] = useState("");
  const [showSimulacao, setShowSimulacao] = useState(false);
  const [simulacaoAcao, setSimulacaoAcao] = useState("");
  const [motivoSimulacao, setMotivoSimulacao] = useState("");
  const [historico, setHistorico] = useState<any[]>([]);
  const [transmitindoId, setTransmitindoId] = useState<string | null>(null);

  const [gerarForm, setGerarForm] = useState({
    origem: "os" as "os" | "cte" | "avulso",
    origem_id: "",
    cliente_id: "",
    emitente_id: "",
    emitente_nome: "",
    emitente_cnpj: "",
    municipio: "SAO PAULO",
    municipio_ibge: "3550308",
    uf: "SP",
    codigo_servico: CODIGO_SERVICO_NACIONAL_PADRAO,
    descricao_servico: "",
    aliquota_iss: "" as string,
    iss_retido: false,
    tomador_nome: "",
    tomador_cnpj: "",
    valor_servico: 0 as number,
    valor_desconto: 0 as number,
  });
  const [origens, setOrigens] = useState<OrigemOpcao[]>([]);
  const [buscaOrigem, setBuscaOrigem] = useState("");
  const [origemAberto, setOrigemAberto] = useState(false);
  const origemComboRef = useRef<HTMLDivElement>(null);

  // Fecha o combobox de OS ao clicar fora.
  useEffect(function() {
    function aoClicarFora(event: MouseEvent) {
      if (origemComboRef.current && !origemComboRef.current.contains(event.target as Node)) {
        setOrigemAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return function() { document.removeEventListener("mousedown", aoClicarFora); };
  }, []);

  useEffect(function() { fetchNfses(); }, []);

  const fetchNfses = async function() {
    try {
      setLoading(true);
      setErro("");
      const { data, error } = await supabase.from("fiscal_nfse").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setNfses(data || []);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar NFS-e");
    } finally {
      setLoading(false);
    }
  };

  const invocarTransmissao = async function(
    nfseId: string,
  ): Promise<{ ok: boolean; mensagem: string; numero?: string | number | null }> {
    try {
      const { data, error } = await supabase.functions.invoke(
        "nfse-assinar-transmitir",
        { body: { nfse_id: nfseId } },
      );

      let payload = (data ?? null) as RespostaTransmissao | null;

      if (error) {
        // functions.invoke devolve FunctionsHttpError em status != 2xx;
        // o corpo JSON (rejeicao/erro) fica em `context`.
        const contexto = (error as { context?: unknown }).context;
        if (contexto instanceof Response) {
          const corpo = await contexto.json().catch(function() { return null; });
          payload = (corpo ?? payload) as RespostaTransmissao | null;
        }
        return {
          ok: false,
          mensagem: mensagemTransmissao(
            payload,
            error.message || "Falha ao transmitir a NFS-e.",
          ),
        };
      }

      if (!payload?.success) {
        return {
          ok: false,
          mensagem: mensagemTransmissao(payload, "A Sefin rejeitou a NFS-e."),
        };
      }

      return {
        ok: true,
        mensagem: "NFS-e transmitida com sucesso!",
        numero: payload.numero ?? null,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        mensagem: err instanceof Error
          ? err.message
          : "Erro inesperado ao transmitir a NFS-e.",
      };
    }
  };

  const handleTransmitir = async function(nfseId: string) {
    if (!nfseId || transmitindoId) return;

    setTransmitindoId(nfseId);
    try {
      const resultado = await invocarTransmissao(nfseId);
      if (resultado.ok) {
        toast.success(
          resultado.numero
            ? "NFS-e " + String(resultado.numero) + " transmitida com sucesso!"
            : "NFS-e transmitida com sucesso!",
        );
      } else {
        toast.error(resultado.mensagem);
      }
    } finally {
      setTransmitindoId(null);
      await fetchNfses();
    }
  };

  const handleOpenGerar = async function() {
    setRegraSugerida(null);
    setAvisoRegra("");
    setBuscaOrigem("");
    setOrigemAberto(false);
    setGerarForm({
      origem: "os", origem_id: "", cliente_id: "",
      emitente_id: "", emitente_nome: "", emitente_cnpj: "",
      municipio: "SAO PAULO", municipio_ibge: "3550308", uf: "SP",
      codigo_servico: CODIGO_SERVICO_NACIONAL_PADRAO,
      descricao_servico: "", aliquota_iss: "", iss_retido: false,
      tomador_nome: "", tomador_cnpj: "",
      valor_servico: 0, valor_desconto: 0,
    });

    // Emitente: MATRIZ da NFS-e Nacional (CNPJ 31.227.975/0001-80),
    // nunca o emitente padrao do CT-e.
    const { data: emitentes } = await supabase
      .from("configuracoes_fiscais")
      .select("id, razao_social, nome_fantasia, cnpj, cidade, uf, codigo_ibge")
      .eq("ativo", true);

    const listaEmitentes = (emitentes || []) as Array<{
      id: string;
      razao_social: string | null;
      nome_fantasia: string | null;
      cnpj: string | null;
      cidade: string | null;
      uf: string | null;
      codigo_ibge: string | null;
    }>;

    const matriz = listaEmitentes.find(function(e) {
      return somenteDigitos(e.cnpj) === CNPJ_MATRIZ_NFSE;
    }) || null;

    if (matriz) {
      const ibgeMatriz = somenteDigitos(matriz.codigo_ibge) || "3550308";
      const rule = await buscarRegraNfse({
        emitente_id: matriz.id,
        cliente_id: null,
        municipio_prestacao: ibgeMatriz,
      });

      if (rule) setRegraSugerida(rule);
      else setAvisoRegra("Nao ha regra NFS-e para o municipio da matriz (3550308). Configure na aba Regras NFS-e.");

      setGerarForm(function(p) {
        return {
          ...p,
          emitente_id: matriz.id,
          // Exibicao fixa da matriz oficial (rastreabilidade visual)
          emitente_nome: MATRIZ_NFSE_RAZAO_SOCIAL,
          emitente_cnpj: MATRIZ_NFSE_CNPJ_FORMATADO,
          municipio: matriz.cidade || "SAO PAULO",
          municipio_ibge: ibgeMatriz,
          uf: matriz.uf || "SP",
          codigo_servico: rule?.codigo_servico || CODIGO_SERVICO_NACIONAL_PADRAO,
          descricao_servico: rule?.descricao_servico || "",
          aliquota_iss: rule?.aliquota_iss != null ? String(rule.aliquota_iss) : "",
          iss_retido: rule?.iss_retido ?? false,
        };
      });
    } else {
      setAvisoRegra("Matriz CONEXAO TRANSPORTES LTDA (31.227.975/0001-80) nao encontrada em configuracoes_fiscais.");
    }

    fetchOrigens("os");
    setPassoAtual(1);
    setRascunhoAtualId(null);
    setIsEmitting(true);
  };

  const fetchOrigens = async function(tipo: "os" | "cte") {
    const registros: Array<{
      id: string;
      numero: string | null;
      cliente_id: string | null;
      valor: number | null;
    }> = [];

    if (tipo === "os") {
      const { data } = await supabase
        .from("ordens_servico")
        .select("id, numero, cliente_id, valor_cliente")
        .not("cliente_id", "is", null)
        .limit(50)
        .order("created_at", { ascending: false });

      (data || []).forEach(function(r: { id: string; numero: string | null; cliente_id: string | null; valor_cliente: number | null }) {
        registros.push({ id: r.id, numero: r.numero, cliente_id: r.cliente_id, valor: r.valor_cliente ?? null });
      });
    } else {
      const { data } = await supabase
        .from("fiscal_ctes")
        .select("id, numero, cliente_id, valor")
        .eq("status", "rascunho")
        .limit(50)
        .order("created_at", { ascending: false });

      (data || []).forEach(function(r: { id: string; numero: string | null; cliente_id: string | null; valor: number | null }) {
        registros.push({ id: r.id, numero: r.numero, cliente_id: r.cliente_id, valor: r.valor ?? null });
      });
    }

    // Resolve o nome do cliente para exibir no combobox (numero + cliente).
    const idsClientes = Array.from(new Set(
      registros
        .map(function(r) { return r.cliente_id; })
        .filter(function(v): v is string { return Boolean(v); }),
    ));

    const nomesClientes = new Map<string, string>();
    if (idsClientes.length > 0) {
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, razao_social, nome_fantasia")
        .in("id", idsClientes);

      (clientes || []).forEach(function(c: { id: string; razao_social: string | null; nome_fantasia: string | null }) {
        nomesClientes.set(c.id, c.razao_social || c.nome_fantasia || "Cliente sem nome");
      });
    }

    setOrigens(registros.map(function(r) {
      return {
        id: r.id,
        numero: r.numero,
        cliente_id: r.cliente_id,
        cliente_nome: r.cliente_id ? (nomesClientes.get(r.cliente_id) || "Cliente") : "Sem cliente",
        valor: r.valor,
      };
    }));
  };

  const selecionarOrigem = async function(opcao: OrigemOpcao) {
    const rotulo = (opcao.numero || opcao.id.substring(0, 8)) + " — " + opcao.cliente_nome;
    setBuscaOrigem(rotulo);
    setOrigemAberto(false);
    await handleOrigemChange(opcao.id);
  };

  const handleTrocarOrigem = function(novo: "os" | "cte" | "avulso") {
    setBuscaOrigem("");
    setOrigemAberto(false);
    setGerarForm(function(p) {
      return {
        ...p,
        origem: novo,
        origem_id: "",
        cliente_id: "",
        tomador_nome: "",
        tomador_cnpj: "",
        valor_servico: 0,
      };
    });
    if (novo !== "avulso") void fetchOrigens(novo);
  };

  const handleOrigemChange = async function(origemId: string) {
    if (!origemId) return;
    setGerarForm(function(p) { return { ...p, origem_id: origemId }; });

    // Buscar dados da origem
    if (gerarForm.origem === "os") {
      const { data: os } = await supabase.from("ordens_servico").select("*").eq("id", origemId).maybeSingle();
      if (os) {
        setGerarForm(function(p) { return { ...p, valor_servico: os.valor_cliente||0 }; });
        if (os.cliente_id) {
          const { data: cli } = await supabase.from("clientes").select("*").eq("id", os.cliente_id).maybeSingle();
          if (cli) {
            setGerarForm(function(p) { return { ...p, tomador_nome: cli.razao_social||cli.nome_fantasia||"", tomador_cnpj: cli.cnpj||"" }; });
          }
        }
      }
    } else {
      const { data: cte } = await supabase.from("fiscal_ctes").select("*").eq("id", origemId).maybeSingle();
      if (cte) {
        const pf = cte.metadata?.payload_focus||{};
        setGerarForm(function(p) { return { ...p, valor_servico: cte.valor||0, tomador_nome: pf.tomador?.nome||"", tomador_cnpj: pf.tomador?.cnpj||"" }; });
      }
    }
  };

  const aplicarRegraMunicipal = async function(codigoIbge: string, nomeMunicipio: string) {
    let rule = null;

    if (codigoIbge) {
      rule = await buscarRegraNfse({
        emitente_id: gerarForm.emitente_id || null,
        cliente_id: null,
        municipio_prestacao: codigoIbge,
      });
    }
    if (!rule && nomeMunicipio) {
      rule = await buscarRegraNfse({
        emitente_id: gerarForm.emitente_id || null,
        cliente_id: null,
        municipio_prestacao: nomeMunicipio,
      });
    }

    if (rule) {
      setRegraSugerida(rule);
      setAvisoRegra("");
      setGerarForm(function(p) {
        return {
          ...p,
          codigo_servico: rule?.codigo_servico || p.codigo_servico || CODIGO_SERVICO_NACIONAL_PADRAO,
          descricao_servico: rule?.descricao_servico || p.descricao_servico,
          aliquota_iss: rule?.aliquota_iss != null ? String(rule.aliquota_iss) : p.aliquota_iss,
          iss_retido: rule?.iss_retido ?? p.iss_retido,
        };
      });
    } else {
      setRegraSugerida(null);
      setAvisoRegra("Nao ha regra NFS-e para " + (nomeMunicipio || codigoIbge) + ". Ajuste manualmente ou configure na aba Regras NFS-e.");
    }
  };

  const criarRascunhoAtual = async function(): Promise<{ id: string | null; erro?: string }> {
    if (gerarForm.origem !== "avulso" && !gerarForm.origem_id) {
      return { id: null, erro: "Selecione a OS ou o CT-e de origem." };
    }
    if (gerarForm.origem === "avulso" && !gerarForm.tomador_nome) {
      return { id: null, erro: "Selecione o cliente do tomador para a emissao avulsa." };
    }
    if (!gerarForm.emitente_id) {
      return { id: null, erro: "Matriz da NFS-e Nacional nao encontrada em configuracoes_fiscais." };
    }
    if (!(gerarForm.valor_servico > 0)) {
      return { id: null, erro: "Informe o valor do servico." };
    }
    if (gerarForm.valor_desconto < 0) {
      return { id: null, erro: "O desconto nao pode ser negativo." };
    }
    if (gerarForm.valor_desconto > gerarForm.valor_servico) {
      return { id: null, erro: "O desconto nao pode ser maior que o valor do servico." };
    }

    const aliquotaNumerica = gerarForm.aliquota_iss !== "" ? Number(gerarForm.aliquota_iss) : null;

    const result = await gerarRascunhoNfse({
      origem: gerarForm.origem,
      origem_id: gerarForm.origem_id,
      cliente_id: gerarForm.cliente_id || null,
      municipio_prestacao: gerarForm.municipio || "SAO PAULO",
      codigo_municipio_prestacao: gerarForm.municipio_ibge || null,
      descricao_servico: gerarForm.descricao_servico || "Prestacao de servico de transporte",
      tomador_nome: gerarForm.tomador_nome || undefined,
      tomador_cnpj: gerarForm.tomador_cnpj || undefined,
      valor_servico: gerarForm.valor_servico,
      valor_desconto: gerarForm.valor_desconto,
      codigo_servico: gerarForm.codigo_servico || undefined,
      aliquota_iss: aliquotaNumerica != null && !Number.isNaN(aliquotaNumerica) ? aliquotaNumerica : null,
      iss_retido: gerarForm.iss_retido,
    });

    if (result.success) {
      const criado = (result as { nfse?: { id?: string } }).nfse;
      if (criado?.id) return { id: String(criado.id) };
    }
    return {
      id: null,
      erro: (result as { error?: string }).error || "Nao foi possivel salvar o rascunho.",
    };
  };

  const handleSalvarRascunho = async function(): Promise<string | null> {
    if (gerando || emitindo) return rascunhoAtualId;
    if (rascunhoAtualId) {
      toast.info("Rascunho ja salvo. Use \"Emitir NFS-e\" para transmitir.");
      return rascunhoAtualId;
    }

    setGerando(true);
    try {
      const resultado = await criarRascunhoAtual();
      if (!resultado.id) {
        toast.error(resultado.erro || "Nao foi possivel salvar o rascunho.");
        return null;
      }
      setRascunhoAtualId(resultado.id);
      toast.success("Rascunho NFS-e salvo com sucesso!");
      await fetchNfses();
      return resultado.id;
    } finally {
      setGerando(false);
    }
  };

  const handleEmitirNfse = async function() {
    if (emitindo || gerando) return;

    let id = rascunhoAtualId;
    if (!id) {
      id = await handleSalvarRascunho();
      if (!id) return;
    }

    setEmitindo(true);
    try {
      const resultado = await invocarTransmissao(id);
      if (resultado.ok) {
        toast.success(
          resultado.numero
            ? "NFS-e " + String(resultado.numero) + " emitida com sucesso!"
            : "NFS-e emitida com sucesso!",
        );
        setRascunhoAtualId(null);
        setIsEmitting(false);
        setPassoAtual(1);
      } else {
        toast.error(resultado.mensagem);
      }
    } finally {
      setEmitindo(false);
      await fetchNfses();
    }
  };

  const fecharWizard = function() {
    setIsEmitting(false);
    setPassoAtual(1);
    setRascunhoAtualId(null);
  };

  const openDetails = function(nfse: any) { setSelectedNfse(nfse); setShowDetails(true); fetchHistorico(nfse.id); };

  const fetchHistorico = async function(nfseId: string) {
    const data = await listarHistoricoStatus("NFSE", nfseId);
    setHistorico(data);
  };

  const openSimulacao = function(acao: string) { setSimulacaoAcao(acao); setMotivoSimulacao(""); setShowSimulacao(true); };

  const handleSimular = async function() {
    if (!motivoSimulacao.trim()) { toast.error("Informe o motivo da simulacao."); return; }
    const statusNovo = simulacaoAcao === "cancelar" ? "cancelada_simulada" : "rejeitada_simulada";
    const result = await alterarStatusFiscalInterno({ documentoTipo:"NFSE",documentoId:selectedNfse?.id,statusNovo,motivo:motivoSimulacao });
    if (result.success) { toast.success("Simulacao concluida: "+simulacaoAcao); setShowSimulacao(false); fetchHistorico(selectedNfse?.id); }
    else toast.error("Erro: "+(result.error||""));
  };

  const handlePreEmissao = async function() {
    setShowPreEmissao(true);
    try { await supabase.from("fiscal_logs").insert([{ entidade_tipo:"NFSE",entidade_id:selectedNfse?.id,acao:"PRE_EMISSAO_NFSE_VISUALIZADA",request:{nfse_id:selectedNfse?.id},response:{status:"dados_internos_prontos"}}]); } catch{}
  };

  // OS/CT-e travam tomador/CNPJ/valor (dados sistemicos); avulso libera edicao.
  const camposTravados = gerarForm.origem !== "avulso";
  const termoBuscaOrigem = buscaOrigem.trim().toLowerCase();
  const origensFiltradas = termoBuscaOrigem
    ? origens.filter(function(o) {
      return ((o.numero || "") + " " + o.cliente_nome).toLowerCase().includes(termoBuscaOrigem);
    })
    : origens;

  // ===================================================================
  // WIZARD FULL PAGE — Emissao de NFS-e Nacional (5 passos)
  // ===================================================================
  if (isEmitting) {
    return (
      <div className="space-y-4">
        {/* HEADER FUNCIONAL */}
        <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={fecharWizard}
              title="Voltar para a lista"
              aria-label="Voltar para a lista"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">Emissão de NFS-e Nacional</h1>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">
                  DPS em preparação
                </Badge>
                {rascunhoAtualId && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-xs">
                    Rascunho salvo
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Passo {passoAtual} de {PASSOS_NFSE.length} · {PASSOS_NFSE[passoAtual - 1].titulo}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={function() { void handleSalvarRascunho(); }}
              disabled={gerando || emitindo}
            >
              {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Stamp className="w-4 h-4 mr-2" />}
              {gerando ? "Salvando..." : "Salvar rascunho"}
            </Button>
            <Button variant="outline" size="sm" onClick={function() { setPassoAtual(5); }}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Conferir
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 text-white hover:bg-orange-700"
              onClick={function() { void handleEmitirNfse(); }}
              disabled={emitindo || gerando}
            >
              {emitindo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {emitindo ? "Emitindo..." : "Emitir NFS-e"}
            </Button>
          </div>
        </div>

        {/* STEPPER */}
        <div className="overflow-x-auto rounded-xl border bg-white p-4">
          <div className="flex min-w-[680px] items-center">
            {PASSOS_NFSE.map(function(passo, indice) {
              const numero = indice + 1;
              const atual = numero === passoAtual;
              const concluido = numero < passoAtual;
              return (
                <div key={passo.chave} className="flex flex-1 items-center">
                  <button
                    type="button"
                    onClick={function() { setPassoAtual(numero); }}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors " +
                        (atual
                          ? "border-orange-600 bg-orange-600 text-white"
                          : concluido
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 bg-white text-slate-500")
                      }
                    >
                      {concluido ? <CheckCircle2 className="h-4 w-4" /> : numero}
                    </span>
                    <span
                      className={
                        "whitespace-nowrap text-xs font-medium " +
                        (atual ? "text-orange-700" : concluido ? "text-emerald-700" : "text-slate-500")
                      }
                    >
                      {passo.titulo}
                    </span>
                  </button>
                  {indice < PASSOS_NFSE.length - 1 && (
                    <span className={"mx-3 h-0.5 flex-1 " + (concluido ? "bg-emerald-500" : "bg-slate-200")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CONTEUDO DO PASSO */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          {/* PASSO 1 — PRESTADOR */}
          {passoAtual === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Prestador</h2>
                <p className="text-sm text-muted-foreground">
                  Emitente da NFS-e Nacional (matriz oficial, somente leitura).
                </p>
              </div>

              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <img
                  src="/logos/logo-conexao-colorido.png"
                  alt="Conexão Express"
                  className="h-12 w-auto object-contain"
                  onError={function(e) { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900">CONEXÃO EXPRESS</p>
                  <p className="text-sm text-slate-700">{MATRIZ_NFSE_RAZAO_SOCIAL}</p>
                  <p className="text-xs text-muted-foreground">CNPJ {MATRIZ_NFSE_CNPJ_FORMATADO}</p>
                </div>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 sm:ml-auto">
                  Matriz oficial
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Município de emissão (IBGE)</Label>
                  <Input value={gerarForm.municipio_ibge || "3550308"} readOnly className="bg-slate-50" />
                </div>
                <div>
                  <Label>Código de Serviço Nacional padrão</Label>
                  <Input value={CODIGO_SERVICO_NACIONAL_PADRAO} readOnly className="bg-slate-50 font-mono" />
                </div>
              </div>

              {!gerarForm.emitente_id && (
                <div className="flex items-center gap-1 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  <AlertCircle className="w-3 h-3" /> Matriz não encontrada em configuracoes_fiscais.
                </div>
              )}
            </div>
          )}

          {/* PASSO 2 — TOMADOR */}
          {passoAtual === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Tomador</h2>
                <p className="text-sm text-muted-foreground">
                  Selecione a origem e os dados do tomador. Campos da OS são travados.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Origem</Label>
                  <Select
                    value={gerarForm.origem}
                    onValueChange={function(v: string) {
                      handleTrocarOrigem(v as "os" | "cte" | "avulso");
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="os">Ordem de Servico</SelectItem>
                      <SelectItem value="cte">CT-e Pronto</SelectItem>
                      <SelectItem value="avulso">Avulso (sem OS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {gerarForm.origem === "avulso" ? (
                    <>
                      <Label>Documento de origem</Label>
                      <div className="flex h-10 items-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 text-xs text-muted-foreground">
                        Emissao avulsa — selecione o cliente em "Tomador".
                      </div>
                    </>
                  ) : (
                    <>
                      <Label>{gerarForm.origem === "os" ? "Ordem de Servico" : "CT-e"}</Label>
                      <div className="relative" ref={origemComboRef}>
                        <Input
                          value={buscaOrigem}
                          placeholder={gerarForm.origem === "os" ? "Buscar por numero da OS ou cliente..." : "Buscar CT-e por numero ou cliente..."}
                          onChange={function(e) {
                            setBuscaOrigem(e.target.value);
                            setOrigemAberto(true);
                            if (gerarForm.origem_id) {
                              setGerarForm(function(p) {
                                return { ...p, origem_id: "", tomador_nome: "", tomador_cnpj: "", valor_servico: 0 };
                              });
                            }
                          }}
                          onFocus={function() { setOrigemAberto(true); }}
                          onKeyDown={function(e) { if (e.key === "Escape") setOrigemAberto(false); }}
                        />
                        {origemAberto && (
                          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                            {origensFiltradas.length === 0 ? (
                              <p className="p-3 text-center text-xs text-muted-foreground">
                                Nenhum registro encontrado.
                              </p>
                            ) : origensFiltradas.map(function(o) {
                              return (
                                <button
                                  type="button"
                                  key={o.id}
                                  onClick={function() { void selecionarOrigem(o); }}
                                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                                >
                                  <span className="font-semibold text-slate-800">
                                    {o.numero || o.id.substring(0, 8)}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {o.cliente_nome}{o.valor != null ? " · " + fmtFin(o.valor) : ""}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <Label>Tomador / Razao Social</Label>
                  {gerarForm.origem === "avulso" ? (
                    <SearchableSelect
                      table="clientes"
                      labelField="razao_social"
                      valueField="id"
                      returnField="id"
                      searchFields={["razao_social", "nome_fantasia", "cnpj"]}
                      secondaryField="cnpj"
                      placeholder="Buscar cliente cadastrado..."
                      value={gerarForm.cliente_id || null}
                      onChange={function(id: string | null, record: Record<string, unknown> | null) {
                        const cli = record as {
                          razao_social?: string | null;
                          nome_fantasia?: string | null;
                          cnpj?: string | null;
                        } | null;
                        setGerarForm(function(p) {
                          return {
                            ...p,
                            cliente_id: id || "",
                            tomador_nome: cli?.razao_social || cli?.nome_fantasia || "",
                            tomador_cnpj: cli?.cnpj || "",
                          };
                        });
                      }}
                    />
                  ) : (
                    <>
                      <Input value={gerarForm.tomador_nome} readOnly className="bg-slate-50" placeholder="Preenchido pela OS" />
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Lock className="h-3 w-3" /> Preenchido automaticamente pela origem
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <Label>CNPJ do Tomador</Label>
                  <Input
                    value={gerarForm.tomador_cnpj}
                    readOnly={camposTravados}
                    className={camposTravados ? "bg-slate-50" : ""}
                    onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_cnpj: e.target.value }; }); }}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3 — SERVICO E VALORES */}
          {passoAtual === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Serviço e Valores</h2>
                <p className="text-sm text-muted-foreground">Descrição, valor bruto e desconto opcional.</p>
              </div>

              <div>
                <Label>Descricao do Servico</Label>
                <Input
                  value={gerarForm.descricao_servico}
                  onChange={function(e) { setGerarForm(function(p) { return { ...p, descricao_servico: e.target.value }; }); }}
                  placeholder="Transporte de bens ou valores"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Valor do Servico (R$) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={gerarForm.valor_servico || ""}
                    readOnly={camposTravados}
                    className={camposTravados ? "bg-slate-50" : ""}
                    onChange={function(e) { setGerarForm(function(p) { return { ...p, valor_servico: parseFloat(e.target.value) || 0 }; }); }}
                  />
                  {camposTravados && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" /> Valor herdado da origem
                    </p>
                  )}
                </div>
                <div>
                  <Label>Valor do Desconto (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={gerarForm.valor_desconto || ""}
                    onChange={function(e) { setGerarForm(function(p) { return { ...p, valor_desconto: parseFloat(e.target.value) || 0 }; }); }}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Opcional. Nao pode exceder o valor do servico.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                <span className="text-sm text-emerald-800">Valor liquido do servico</span>
                <span className="text-lg font-bold text-emerald-700">
                  {fmtFin(Math.max(0, (gerarForm.valor_servico || 0) - (gerarForm.valor_desconto || 0)))}
                </span>
              </div>
            </div>
          )}

          {/* PASSO 4 — TRIBUTACAO */}
          {passoAtual === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Tributação</h2>
                <p className="text-sm text-muted-foreground">Município, código nacional e ISSQN.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label>Municipio de Prestacao</Label>
                  <SearchableSelect
                    table="municipios_ibge"
                    labelField="nome"
                    valueField="codigo"
                    returnField="codigo"
                    searchFields={CAMPOS_BUSCA_MUNICIPIO}
                    secondaryField="uf"
                    placeholder="Buscar cidade (ex.: Sao Paulo)"
                    value={gerarForm.municipio_ibge || null}
                    onChange={function(codigo: string | null, record: Record<string, unknown> | null) {
                      const reg = record as { nome?: string; uf?: string } | null;
                      const cod = codigo || "";
                      setGerarForm(function(p) {
                        return { ...p, municipio_ibge: cod, municipio: reg?.nome || p.municipio, uf: reg?.uf || p.uf };
                      });
                      void aplicarRegraMunicipal(cod, reg?.nome || "");
                    }}
                  />
                </div>
                <div>
                  <Label>UF</Label>
                  <Select value={gerarForm.uf || undefined} onValueChange={function(v: string) { setGerarForm(function(p) { return { ...p, uf: v }; }); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UFS.map(function(u) { return <SelectItem key={u} value={u}>{u}</SelectItem>; })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="nfse-codigo-servico">Codigo de Servico Nacional</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="Ajuda sobre o codigo de servico" className="rounded p-0.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground">
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Codigo de tributacao nacional do ISSQN (LC 116/2003). O padrao da
                        operacao e 16.02.01.002 (transporte de bens ou valores).
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="nfse-codigo-servico"
                    className="mt-1 font-mono"
                    value={gerarForm.codigo_servico}
                    onChange={function(e) { setGerarForm(function(p) { return { ...p, codigo_servico: e.target.value }; }); }}
                  />
                </div>
                <div>
                  <Label>Aliquota do ISS (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={gerarForm.aliquota_iss}
                    onChange={function(e) { setGerarForm(function(p) { return { ...p, aliquota_iss: e.target.value }; }); }}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-start gap-1.5">
                  <div>
                    <p className="text-sm font-medium">ISS Retido pelo Tomador</p>
                    <p className="text-[11px] text-muted-foreground">Retencao do ISSQN na fonte pelo tomador.</p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Ajuda sobre ISS retido" className="rounded p-0.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Marque "Sim" quando o tomador retiver o ISS. Se a Conexao recolhe o imposto, mantenha "Nao".
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{gerarForm.iss_retido ? "Sim" : "Nao"}</span>
                  <Switch
                    checked={gerarForm.iss_retido}
                    onCheckedChange={function(v: boolean) { setGerarForm(function(p) { return { ...p, iss_retido: v }; }); }}
                  />
                </div>
              </div>

              {regraSugerida && (
                <div className="rounded border border-green-200 bg-green-50 p-2 text-xs text-green-700">
                  Regra municipal encontrada: {regraSugerida.municipio_prestacao}/{regraSugerida.uf}
                  {" | "}Cod: {regraSugerida.codigo_servico}
                  {" | "}ISS: {regraSugerida.aliquota_iss}%
                  {" | "}Retido: {regraSugerida.iss_retido ? "Sim" : "Nao"}
                </div>
              )}
              {avisoRegra && (
                <div className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                  <AlertCircle className="w-3 h-3" /> {avisoRegra}
                </div>
              )}
            </div>
          )}

          {/* PASSO 5 — REVISAO */}
          {passoAtual === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Revisão</h2>
                <p className="text-sm text-muted-foreground">Confira os dados antes de salvar/emitir.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Prestador</p>
                  <p className="text-sm font-semibold">{gerarForm.emitente_nome || "—"}</p>
                  <p className="text-xs text-muted-foreground">{gerarForm.emitente_cnpj || "—"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tomador</p>
                  <p className="text-sm font-semibold">{gerarForm.tomador_nome || "—"}</p>
                  <p className="text-xs text-muted-foreground">{gerarForm.tomador_cnpj || "—"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Serviço</p>
                  <p className="text-sm">{gerarForm.descricao_servico || "Transporte de bens ou valores"}</p>
                  <p className="text-xs text-muted-foreground">
                    Bruto: {fmtFin(gerarForm.valor_servico || 0)} · Desconto: {fmtFin(gerarForm.valor_desconto || 0)}
                  </p>
                  <p className="text-sm font-semibold text-emerald-700">
                    Líquido: {fmtFin(Math.max(0, (gerarForm.valor_servico || 0) - (gerarForm.valor_desconto || 0)))}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tributação</p>
                  <p className="text-sm">{gerarForm.municipio} ({gerarForm.municipio_ibge})</p>
                  <p className="text-xs text-muted-foreground">
                    Cód. {gerarForm.codigo_servico} · ISS {gerarForm.aliquota_iss || "0"}% · {gerarForm.iss_retido ? "Retido" : "Não retido"}
                  </p>
                </div>
              </div>

              <div className="space-y-1 rounded-lg border p-3 text-sm">
                <p className="flex items-center gap-2">
                  {gerarForm.origem === "avulso" || gerarForm.origem_id
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  Origem definida
                </p>
                <p className="flex items-center gap-2">
                  {gerarForm.tomador_nome && gerarForm.tomador_cnpj
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  Tomador e CNPJ
                </p>
                <p className="flex items-center gap-2">
                  {gerarForm.valor_servico > 0
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  Valor do serviço
                </p>
              </div>

              {regraSugerida && (
                <div className="rounded border border-green-200 bg-green-50 p-2 text-xs text-green-700">
                  Regra municipal: {regraSugerida.codigo_servico} · ISS {regraSugerida.aliquota_iss}%
                </div>
              )}
              {avisoRegra && (
                <div className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                  <AlertCircle className="w-3 h-3" /> {avisoRegra}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RODAPE DE NAVEGACAO */}
        <div className="flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm">
          <Button
            variant="outline"
            onClick={function() {
              if (passoAtual === 1) fecharWizard();
              else setPassoAtual(passoAtual - 1);
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {passoAtual === 1 ? "Voltar para a lista" : "Voltar"}
          </Button>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Passo {passoAtual} de {PASSOS_NFSE.length}
            </span>
            {passoAtual < PASSOS_NFSE.length ? (
              <Button onClick={function() { setPassoAtual(passoAtual + 1); }}>
                Avançar
              </Button>
            ) : (
              <Button
                className="bg-orange-600 text-white hover:bg-orange-700"
                onClick={function() { void handleEmitirNfse(); }}
                disabled={emitindo || gerando}
              >
                {emitindo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {emitindo ? "Emitindo..." : "Emitir NFS-e"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">NFS-e</h2><p className="text-muted-foreground text-sm">Nota Fiscal de Servico Eletronica.</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchNfses} disabled={loading}><RefreshCw className="w-4 h-4 mr-2" /> Atualizar</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleOpenGerar}><PlusCircle className="w-4 h-4 mr-2" /> Nova NFS-e</Button>
        </div>
      </div>

      <Card className="w-full">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nº NFS-e</TableHead><TableHead>Tomador</TableHead><TableHead>Servico</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Pendencias</TableHead><TableHead className="text-right">Acoes</TableHead></TableRow></TableHeader>
            <TableBody>
              {erro ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-red-500"><AlertCircle className="w-5 h-5 mx-auto mb-1" /><p className="text-sm">{erro}</p><Button variant="link" size="sm" onClick={fetchNfses}>Tentar novamente</Button></TableCell></TableRow>
               : loading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><ProgressiveBlocksLoader size="normal" /></TableCell></TableRow>
               : nfses.length === 0 ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Nenhuma NFS-e encontrada.</TableCell></TableRow>
                : nfses.map(function(n) {
                    const m = n.metadata || {};
                    const v = m.validacoes_pendentes || [];
                    const statusNfse = String(n.status || "").toLowerCase();
                    const podeTransmitir =
                      statusNfse === "rascunho" || statusNfse === "erro_emissao";
                    return (
                      <TableRow key={n.id}>
                        <TableCell className="font-semibold text-green-700">{n.numero || "-"}</TableCell>
                        <TableCell className="text-sm">{m.tomador?.nome || "-"}</TableCell>
                        <TableCell className="text-xs">{m.servico || "-"}</TableCell>
                        <TableCell className="font-medium">{fmtFin(n.valor)}</TableCell>
                        <TableCell><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{n.status}</Badge></TableCell>
                        <TableCell>
                          {v.length === 0 ? <Badge className="bg-green-100 text-green-700 border-green-200 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />0</Badge>
                           : <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />{v.length}</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {podeTransmitir && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 px-2 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                onClick={function() { void handleTransmitir(n.id); }}
                                disabled={transmitindoId !== null}
                                title="Transmitir NFS-e para a Sefin"
                                aria-label="Transmitir NFS-e"
                              >
                                {transmitindoId === n.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                                <span className="text-xs font-medium">
                                  {transmitindoId === n.id ? "Enviando..." : "Transmitir"}
                                </span>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={function(){openDetails(n);}}
                              title="Ver detalhes"
                              aria-label="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Detalhes */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedNfse && (function() {
            const m = selectedNfse.metadata || {};
            const v = Array.isArray(m.validacoes_pendentes) ? m.validacoes_pendentes : [];
            const pronto = m.pronto_para_emissao;
            const erros = v.filter(function(x:any){return x.severidade==="erro";});
            const avisos = v.filter(function(x:any){return x.severidade==="aviso";});
            const temErros = erros.length > 0;
            return (
              <>
                <DialogHeader><DialogTitle className="flex items-center gap-2"><Stamp className="w-5 h-5 text-green-600" />NFS-e {selectedNfse.numero}</DialogTitle><DialogDescription>{selectedNfse.status}</DialogDescription></DialogHeader>
                <div className="space-y-3 py-2">
                  <div className={"p-3 rounded-lg border-2 "+(temErros?"bg-red-50 border-red-200":"bg-green-50 border-green-200")}>
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><ShieldAlert className={"w-4 h-4 "+(temErros?"text-red-600":"text-green-600")}/><span className="font-semibold text-sm">STATUS FISCAL</span></div><Badge className={temErros?"bg-red-100 text-red-700 border-red-200":"bg-green-100 text-green-700 border-green-200"}>{temErros?"COM PENDENCIA":"PRONTO INTERNO"}</Badge></div>
                  </div>
                  {erros.length>0&&<div className="border rounded-lg"><div className="p-3 border-b bg-red-50/50"><span className="font-semibold text-xs text-red-800">PENDENCIAS ({erros.length})</span></div><div className="p-3 space-y-1">{erros.map(function(e:any,i:number){return<div key={i} className="flex items-start gap-2 text-xs"><XCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0"/><span className="text-red-700">{e.mensagem}</span></div>;})}</div></div>}
                  {avisos.length>0&&<div className="border rounded-lg"><div className="p-3 border-b bg-amber-50/50"><span className="font-semibold text-xs text-amber-800">AVISOS ({avisos.length})</span></div><div className="p-3 space-y-1">{avisos.map(function(a:any,i:number){return<div key={i} className="flex items-start gap-2 text-xs"><AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0"/><span className="text-amber-700">{a.mensagem}</span></div>;})}</div></div>}
                  <div className="border rounded-lg p-3 bg-slate-50 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Emitente</span><span className="font-medium">{m.emitente?.nome||"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tomador</span><span className="font-medium">{m.tomador?.nome||"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Servico</span><span>{m.servico||"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Codigo</span><span className="font-mono">{m.codigo_servico||"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">ISS%</span><span>{m.aliquota_iss!=null?m.aliquota_iss+"%":"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">ISS Retido</span><span>{m.iss_retido===true?"Sim":m.iss_retido===false?"Nao":"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold">{fmtFin(m.valor_servico)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Municipio</span><span>{m.municipio_prestacao||"-"}</span></div>
                  </div>

                  {/* CICLO DE VIDA */}
                  <div className="border rounded-lg mt-3">
                    <div className="p-3 border-b bg-slate-50/50 flex items-center justify-between"><div className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-slate-600" /><span className="font-semibold text-xs text-slate-800">CICLO DE VIDA INTERNO</span></div><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{selectedNfse.status}</Badge></div>
                    <div className="p-3 space-y-2"><div className="flex gap-2"><Button variant="outline" size="sm" className="text-xs" onClick={function(){openSimulacao("cancelar");}}><XCircle className="w-3 h-3 mr-1" />Simular Cancelamento</Button><Button variant="outline" size="sm" className="text-xs" onClick={function(){openSimulacao("rejeitar");}}><AlertTriangle className="w-3 h-3 mr-1" />Simular Rejeicao</Button></div><p className="text-[10px] text-muted-foreground italic">Simulacoes internas. Nao comunicam com prefeitura ou Focus.</p>{historico.length>0&&<div className="mt-2 pt-2 border-t"><span className="text-xs font-semibold text-muted-foreground">Historico</span><div className="space-y-1 mt-1">{historico.slice(0,3).map(function(h:any,i:number){return <div key={i} className="text-[10px] flex items-center gap-1"><span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span><span className="font-mono">{h.status_anterior}→{h.status_novo}</span></div>;})}</div></div>}</div>
                  </div>

                  <Tooltip><TooltipTrigger asChild><span className="w-full inline-block"><Button className="w-full" disabled={temErros} variant={temErros?"outline":"default"} onClick={pronto&&!temErros?handlePreEmissao:undefined}><Stamp className="w-4 h-4 mr-2"/>Pre-emissao NFS-e</Button></span></TooltipTrigger>{temErros&&<TooltipContent><p>Corrija as pendencias antes da emissao.</p></TooltipContent>}</Tooltip>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal Simulacao */}
      <Dialog open={showSimulacao} onOpenChange={setShowSimulacao}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Simular {simulacaoAcao==="cancelar"?"Cancelamento":"Rejeicao"} — NFS-e</DialogTitle><DialogDescription>Esta acao e uma simulacao interna.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2"><div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">Nao comunica com prefeitura ou Focus NFe.</div><div><Label>Motivo *</Label><Input value={motivoSimulacao} onChange={function(e){setMotivoSimulacao(e.target.value);}} placeholder="Teste de homologacao..." /></div></div>
          <DialogFooter><Button variant="outline" onClick={function(){setShowSimulacao(false);}}>Cancelar</Button><Button variant="destructive" onClick={handleSimular} disabled={!motivoSimulacao.trim()}>Confirmar Simulacao</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Pre-emissao */}
      <Dialog open={showPreEmissao} onOpenChange={setShowPreEmissao}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-primary"/>Pre-emissao NFS-e</DialogTitle><DialogDescription>Dados internos prontos</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2"><div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600"/><span className="text-sm font-medium text-green-800">Dados internos prontos</span></div><div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"><div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0"/><p className="text-xs text-blue-800">A emissao desta NFS-e seguira o fluxo proprio do Padrao Nacional (SEFIN), sem dependencia de configuracao, token ou certificado da Focus NFe. O envio sera habilitado pelo motor neutro de NFS-e.</p></div></div></div>
          <DialogFooter><Button variant="outline" onClick={function(){setShowPreEmissao(false);}}>Fechar</Button><Button onClick={function(){setShowPreEmissao(false);}}>Entendi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
