import { useEffect, useRef, useState } from "react";
import { Stamp, PlusCircle, RefreshCw, Loader2, ShieldAlert, XCircle, AlertTriangle, CheckCircle2, Send, Eye, AlertCircle, GitBranch, HelpCircle, Lock, ArrowLeft, Search, Printer, Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { gerarRascunhoNfse } from "@/services/fiscal/nfseService";
import { buscarRegraNfse, listarRegrasNfse } from "@/services/fiscal/regrasFiscaisNfseService";
import { alterarStatusFiscalInterno, listarHistoricoStatus } from "@/services/fiscal/fiscalStatusService";
import { abrirImpressaoDanfse } from "@/components/fiscal/DanfsePrintTemplate";
import type { DanfsePrintDados } from "@/components/fiscal/DanfsePrintTemplate";
import { gerarXmlDpsNacional } from "@/services/fiscal/nfseEmissaoService";
import type { DpsPayload, FiscalCompanySettings } from "@/services/fiscal/nfseEmissaoService";
import type { FiscalNfse } from "@/types/fiscal";
import { carregarConfiguracaoSistema } from "@/services/configuracoesService";
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

type CodigoServicoOpcao = { codigo: string; descricao: string };

const CODIGOS_SERVICO_NACIONAIS: CodigoServicoOpcao[] = [
  { codigo: "16.02.01.002", descricao: "Transporte de bens ou valores, dentro do território do Município" },
  { codigo: "16.01.01", descricao: "Transporte coletivo" },
  { codigo: "16.01.02", descricao: "Transporte escolar" },
  { codigo: "16.02.01", descricao: "Outros serviços de transporte de natureza municipal" },
  { codigo: "11.04.01", descricao: "Armazenamento, carga e descarga" },
  { codigo: "26.01.01", descricao: "Coleta, remessa ou entrega de correspondências/documentos/objetos/bens" },
];

function montarCodigosServico(
  regras: Array<{ codigo_servico: string; descricao_servico?: string | null }>,
): CodigoServicoOpcao[] {
  const mapa = new Map<string, CodigoServicoOpcao>();
  CODIGOS_SERVICO_NACIONAIS.forEach(function(item) { mapa.set(item.codigo, item); });

  regras.forEach(function(regra) {
    const codigo = (regra.codigo_servico || "").trim();
    if (!codigo) return;
    const existente = mapa.get(codigo);
    mapa.set(codigo, {
      codigo,
      descricao: regra.descricao_servico?.trim() || existente?.descricao || "Regra municipal",
    });
  });

  return Array.from(mapa.values());
}

/** Código NBS padrão da operação (transporte rodoviário de cargas). */
const CODIGO_NBS_PADRAO = "1.0501.15.00";
const CODIGOS_NBS: CodigoServicoOpcao[] = [
  {
    codigo: "1.0501.15.00",
    descricao: "Serviços de transporte rodoviário de cargas postais e malotes",
  },
  {
    codigo: "1.0501.19.00",
    descricao: "Serviços de transporte rodoviário de cargas não classificados nas subposições anteriores",
  },
];

type CodigoComboboxProps = {
  id?: string;
  value: string;
  options: CodigoServicoOpcao[];
  placeholder?: string;
  vazioTexto?: string;
  rodapeTexto?: string;
  onChangeValue: (valor: string) => void;
  onSelectOption: (opcao: CodigoServicoOpcao) => void;
};

/** Combobox pesquisável de códigos (serviço nacional / NBS). */
function CodigoCombobox({
  id,
  value,
  options,
  placeholder,
  vazioTexto,
  rodapeTexto,
  onChangeValue,
  onSelectOption,
}: CodigoComboboxProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const comboRef = useRef<HTMLDivElement>(null);

  useEffect(function() {
    function aoClicarFora(event: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return function() { document.removeEventListener("mousedown", aoClicarFora); };
  }, []);

  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? options.filter(function(opcao) {
      return opcao.codigo.toLowerCase().includes(termo) ||
        opcao.descricao.toLowerCase().includes(termo);
    })
    : options;

  return (
    <div className="relative" ref={comboRef}>
      <Input
        id={id}
        className="font-mono"
        value={value}
        placeholder={placeholder}
        onChange={function(e) {
          onChangeValue(e.target.value);
          setBusca(e.target.value);
          setAberto(true);
        }}
        onFocus={function() { setBusca(""); setAberto(true); }}
        onClick={function() { setBusca(""); setAberto(true); }}
        onKeyDown={function(e) { if (e.key === "Escape") setAberto(false); }}
      />
      {aberto && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtrados.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              {vazioTexto || "Nenhum código na lista. Você pode digitar manualmente."}
            </p>
          ) : filtrados.slice(0, 40).map(function(opcao) {
            return (
              <button
                type="button"
                key={opcao.codigo}
                onClick={function() {
                  onSelectOption(opcao);
                  setBusca("");
                  setAberto(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
              >
                <span className="font-mono text-xs font-semibold text-slate-800">
                  {opcao.codigo}
                </span>
                <span className="text-xs text-slate-500">{opcao.descricao}</span>
              </button>
            );
          })}
          {rodapeTexto && (
            <p className="border-t px-3 py-2 text-[10px] text-muted-foreground">
              {rodapeTexto}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

type MunicipioComboboxProps = {
  value: string;
  uf: string;
  placeholder?: string;
  onChange: (nome: string, ufSelecionada?: string) => void;
};

type MunicipioIbgeOpcao = { nome: string; uf: string | null; codigo: string };

/** Combobox de municípios (tabela municipios_ibge) com lista real ao abrir. */
function MunicipioCombobox({
  value,
  uf,
  placeholder,
  onChange,
}: MunicipioComboboxProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<MunicipioIbgeOpcao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);
  const sequenciaRef = useRef(0);

  useEffect(function() {
    function aoClicarFora(event: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return function() { document.removeEventListener("mousedown", aoClicarFora); };
  }, []);

  useEffect(function() {
    if (!aberto) return;
    const meu = ++sequenciaRef.current;
    setCarregando(true);
    let cancelado = false;

    const timer = setTimeout(async function() {
      let query = supabase
        .from("municipios_ibge")
        .select("nome, uf, codigo")
        .order("nome", { ascending: true })
        .limit(25);

      const termo = busca.trim();
      if (termo) query = query.ilike("nome", `%${termo}%`);

      const { data, error } = await query;
      if (cancelado || meu !== sequenciaRef.current) return;

      const lista = (error ? [] : (data || [])) as MunicipioIbgeOpcao[];
      setResultados(lista.filter(function(item) { return Boolean(item.nome); }));
      setCarregando(false);
    }, 250);

    return function() {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [aberto, busca]);

  return (
    <div className="relative" ref={comboRef}>
      <div className="relative flex items-center">
        <Input
          value={value}
          placeholder={placeholder || "Buscar cidade (ex.: São Paulo)"}
          onChange={function(e) {
            onChange(e.target.value);
            setBusca(e.target.value);
            setAberto(true);
          }}
          onFocus={function() { setBusca(""); setAberto(true); }}
          onClick={function() { setBusca(""); setAberto(true); }}
          onKeyDown={function(e) { if (e.key === "Escape") setAberto(false); }}
          className="pr-16"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {uf && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {uf}
            </span>
          )}
          {carregando
            ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            : <Search className="h-4 w-4 text-slate-400" />}
        </div>
      </div>

      {aberto && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {carregando && resultados.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-3 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
            </div>
          ) : resultados.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">
              Nenhum município encontrado. Você pode digitar manualmente.
            </p>
          ) : resultados.map(function(item) {
            return (
              <button
                type="button"
                key={item.codigo}
                onClick={function() {
                  onChange(item.nome, item.uf || undefined);
                  setBusca("");
                  setAberto(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
              >
                <span className="truncate text-slate-800">{item.nome}</span>
                <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                  {item.uf || "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type BrasilApiCnpj = {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  email?: string | null;
  ddd_telefone_1?: string | null;
  ddd_telefone_2?: string | null;
  telefone?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
};

const EMITENTE_DANFSE: DanfsePrintDados["emitente"] = {
  nome: "CONEXAO TRANSPORTES LTDA",
  cnpj: "31.227.975/0001-80",
  inscricaoMunicipal: "000000060458216",
  endereco: "RUA ANTONIO MACEDO, 45, PARQUE SAO JORGE",
  municipio: "São Paulo",
  uf: "SP",
  cep: "03087-010",
  regime: "Simples Nacional (Optante - Microempresa ou EPP)",
};

function formatarDataHoraDanfse(valor: unknown): string {
  if (!valor) return "—";
  const data = new Date(String(valor));
  if (Number.isNaN(data.getTime())) return String(valor);
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarCompetenciaDanfse(valor: unknown, fallback: unknown): string {
  const texto = String(valor || "");
  if (/^\d{4}-\d{2}$/.test(texto)) {
    return texto.slice(5, 7) + "/" + texto.slice(0, 4);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
    return texto.slice(5, 7) + "/" + texto.slice(0, 4);
  }
  if (fallback) {
    const data = new Date(String(fallback));
    if (!Number.isNaN(data.getTime())) {
      return String(data.getMonth() + 1).padStart(2, "0") + "/" + data.getFullYear();
    }
  }
  return "—";
}

function situacaoDanfse(status: unknown): string {
  const valor = String(status || "").toLowerCase();
  if (valor === "emitida") return "NFS-e Gerada";
  if (valor === "rascunho") return "Rascunho";
  if (valor === "erro_emissao") return "Erro de Emissão";
  if (valor === "cancelada") return "Cancelada";
  return valor ? String(status) : "—";
}

function baixarArquivo(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

function urlLogoAbsoluta(valor: string): string {
  const url = (valor || "").trim();
  if (!url) return `${window.location.origin}/logos/logo-conexao-colorido.png`;
  if (url.startsWith("data:") || /^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${window.location.origin}${url}`;
  return `${window.location.origin}/${url}`;
}
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
  const [baixandoXmlId, setBaixandoXmlId] = useState<string | null>(null);
  const [logoEmitenteUrl, setLogoEmitenteUrl] = useState("/logos/logo-conexao-colorido.png");
  const [abrindoPdfOficialId, setAbrindoPdfOficialId] = useState<string | null>(null);

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
    codigo_nbs: CODIGO_NBS_PADRAO,
    descricao_servico: "",
    aliquota_iss: "" as string,
    iss_retido: false,
    tomador_nome: "",
    tomador_cnpj: "",
    tomador_email: "",
    tomador_telefone: "",
    tomador_logradouro: "",
    tomador_numero: "",
    tomador_complemento: "",
    tomador_bairro: "",
    tomador_municipio: "",
    tomador_uf: "",
    tomador_cep: "",
    valor_servico: 0 as number,
    valor_desconto: 0 as number,
  });
  const [origens, setOrigens] = useState<OrigemOpcao[]>([]);
  const [buscaOrigem, setBuscaOrigem] = useState("");
  const [origemAberto, setOrigemAberto] = useState(false);
  const origemComboRef = useRef<HTMLDivElement>(null);
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);
  const [erroConsultaCnpj, setErroConsultaCnpj] = useState("");
  const [codigosServico, setCodigosServico] = useState<CodigoServicoOpcao[]>(CODIGOS_SERVICO_NACIONAIS);

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

  // Logo do emitente: configuracoes_fiscais (logo_url/metadata) e,
  // como fallback, a identidade visual (configuracoes_sistema).
  useEffect(function() {
    let cancelado = false;

    (async function() {
      const candidatos: string[] = [];

      try {
        const { data } = await supabase
          .from("configuracoes_fiscais")
          .select("*")
          .eq("ativo", true);

        const lista = (data || []) as Array<Record<string, unknown>>;
        const matriz = lista.find(function(e) {
          return somenteDigitos(e.cnpj) === CNPJ_MATRIZ_NFSE;
        }) || lista.find(function(e) { return e.padrao === true; }) || lista[0];

        const metadata = matriz?.metadata as Record<string, unknown> | undefined;
        const url = matriz?.logo_url ?? metadata?.logo_url ?? metadata?.logoUrl ?? matriz?.logo;
        if (typeof url === "string" && url.trim()) candidatos.push(url.trim());
      } catch {
        // Segue para a identidade visual/fallback.
      }

      if (candidatos.length === 0) {
        try {
          const identidade = await carregarConfiguracaoSistema("identidade_visual");
          if (identidade && typeof identidade === "object") {
            const config = identidade as Record<string, unknown>;
            const url = config.logoUrl ?? config.logo_url;
            if (typeof url === "string" && url.trim()) candidatos.push(url.trim());
          }
        } catch {
          // Fallback silencioso.
        }
      }

      if (!cancelado) {
        setLogoEmitenteUrl(
          urlLogoAbsoluta(candidatos[0] || "/logos/logo-conexao-colorido.png"),
        );
      }
    })();

    return function() { cancelado = true; };
  }, []);

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
      codigo_nbs: CODIGO_NBS_PADRAO,
      descricao_servico: "", aliquota_iss: "", iss_retido: false,
      tomador_nome: "", tomador_cnpj: "",
      tomador_email: "", tomador_telefone: "",
      tomador_logradouro: "", tomador_numero: "", tomador_complemento: "",
      tomador_bairro: "", tomador_municipio: "", tomador_uf: "", tomador_cep: "",
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

    try {
      const regras = await listarRegrasNfse();
      setCodigosServico(montarCodigosServico(regras));
    } catch {
      setCodigosServico(CODIGOS_SERVICO_NACIONAIS);
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
        tomador_email: "",
        tomador_telefone: "",
        tomador_logradouro: "",
        tomador_numero: "",
        tomador_complemento: "",
        tomador_bairro: "",
        tomador_municipio: "",
        tomador_uf: "",
        tomador_cep: "",
        valor_servico: 0,
      };
    });
    if (novo !== "avulso") void fetchOrigens(novo);
  };

  const preencherTomadorComCliente = function(cli: Record<string, unknown>) {
    setGerarForm(function(p) {
      return {
        ...p,
        tomador_nome: String(cli.razao_social || cli.nome_fantasia || p.tomador_nome || ""),
        tomador_cnpj: String(cli.cnpj || p.tomador_cnpj || ""),
        tomador_email: String(cli.email || p.tomador_email || ""),
        tomador_telefone: String(cli.telefone || cli.whatsapp || p.tomador_telefone || ""),
        tomador_cep: somenteDigitos(cli.cep) || p.tomador_cep,
        tomador_logradouro: String(cli.logradouro || p.tomador_logradouro || ""),
        tomador_numero: String(cli.numero || p.tomador_numero || ""),
        tomador_complemento: String(cli.complemento || p.tomador_complemento || ""),
        tomador_bairro: String(cli.bairro || p.tomador_bairro || ""),
        tomador_municipio: String(cli.cidade || p.tomador_municipio || ""),
        tomador_uf: String(cli.uf || p.tomador_uf || ""),
      };
    });
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
          if (cli) preencherTomadorComCliente(cli as Record<string, unknown>);
        }
      }
    } else {
      const { data: cte } = await supabase.from("fiscal_ctes").select("*").eq("id", origemId).maybeSingle();
      if (cte) {
        setGerarForm(function(p) { return { ...p, valor_servico: cte.valor||0 }; });
        if (cte.cliente_id) {
          const { data: cli } = await supabase.from("clientes").select("*").eq("id", cte.cliente_id).maybeSingle();
          if (cli) preencherTomadorComCliente(cli as Record<string, unknown>);
        } else {
          const pf = cte.metadata?.payload_focus||{};
          setGerarForm(function(p) {
            return {
              ...p,
              tomador_nome: pf.tomador?.nome||p.tomador_nome,
              tomador_cnpj: pf.tomador?.cnpj||p.tomador_cnpj,
              tomador_email: pf.tomador?.email||p.tomador_email,
            };
          });
        }
      }
    }
  };

  const consultarCnpjTomador = async function(cnpjInformado?: string) {
    const cnpj = somenteDigitos(cnpjInformado ?? gerarForm.tomador_cnpj);
    if (cnpj.length !== 14) {
      const msg = "Informe um CNPJ válido (14 dígitos).";
      setErroConsultaCnpj(msg);
      toast.error(msg);
      return;
    }
    if (consultandoCnpj) return;

    setErroConsultaCnpj("");
    setConsultandoCnpj(true);
    try {
      const resposta = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
        { headers: { Accept: "application/json" } },
      );

      if (!resposta.ok) {
        const msg = resposta.status === 404
          ? "CNPJ não encontrado na Receita."
          : "Falha ao consultar o CNPJ.";
        setErroConsultaCnpj(msg);
        toast.error(msg);
        return;
      }

      const dados = await resposta.json() as BrasilApiCnpj;

      setGerarForm(function(p) {
        return {
          ...p,
          tomador_cnpj: cnpj,
          tomador_nome: dados.razao_social || dados.nome_fantasia || p.tomador_nome,
          tomador_email: dados.email || p.tomador_email,
          tomador_telefone: dados.ddd_telefone_1 || dados.telefone || p.tomador_telefone,
          tomador_cep: somenteDigitos(dados.cep) || p.tomador_cep,
          tomador_logradouro: dados.logradouro || p.tomador_logradouro,
          tomador_numero: dados.numero || p.tomador_numero,
          tomador_complemento: dados.complemento || p.tomador_complemento,
          tomador_bairro: dados.bairro || p.tomador_bairro,
          tomador_municipio: dados.municipio || p.tomador_municipio,
          tomador_uf: dados.uf || p.tomador_uf,
        };
      });

      setErroConsultaCnpj("");
      toast.success("Dados do CNPJ carregados.");
    } catch (erro: unknown) {
      console.error(
        "[NfseTab] Erro ao consultar CNPJ:",
        erro instanceof Error ? erro.message : String(erro),
      );
      const msg = "Erro de rede ao consultar o CNPJ.";
      setErroConsultaCnpj(msg);
      toast.error(msg);
    } finally {
      setConsultandoCnpj(false);
    }
  };

  // Consulta automática ao completar 14 dígitos (o botão "Buscar CNPJ" também dispara).
  const cnpjTomadorDigitos = somenteDigitos(gerarForm.tomador_cnpj);
  const ultimoCnpjConsultadoRef = useRef("");

  useEffect(function() {
    if (cnpjTomadorDigitos.length !== 14) {
      ultimoCnpjConsultadoRef.current = "";
      return;
    }
    if (ultimoCnpjConsultadoRef.current === cnpjTomadorDigitos) return;
    ultimoCnpjConsultadoRef.current = cnpjTomadorDigitos;
    void consultarCnpjTomador(cnpjTomadorDigitos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnpjTomadorDigitos]);

  const selecionarCodigoServico = function(opcao: CodigoServicoOpcao) {
    setGerarForm(function(p) {
      return {
        ...p,
        codigo_servico: opcao.codigo,
        descricao_servico: p.descricao_servico || opcao.descricao,
      };
    });
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
      tomador_email: gerarForm.tomador_email || undefined,
      tomador_telefone: gerarForm.tomador_telefone || undefined,
      tomador_logradouro: gerarForm.tomador_logradouro || undefined,
      tomador_numero: gerarForm.tomador_numero || undefined,
      tomador_complemento: gerarForm.tomador_complemento || undefined,
      tomador_bairro: gerarForm.tomador_bairro || undefined,
      tomador_municipio: gerarForm.tomador_municipio || undefined,
      tomador_uf: gerarForm.tomador_uf || undefined,
      tomador_cep: gerarForm.tomador_cep || undefined,
      valor_servico: gerarForm.valor_servico,
      valor_desconto: gerarForm.valor_desconto,
      codigo_servico: gerarForm.codigo_servico || undefined,
      codigo_nbs: gerarForm.codigo_nbs || undefined,
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

  const openDetails = function(nfse: FiscalNfse) {
    setSelectedNfse(nfse);
    setShowDetails(true);
    setShowSimulacao(false);
    setShowPreEmissao(false);
    fetchHistorico(nfse.id);
  };

  const fecharDetalhes = function() {
    setShowDetails(false);
    setShowSimulacao(false);
    setShowPreEmissao(false);
  };

  // ------------------------------------------------------------------
  // DANFSe / XML — dados derivados da nota + metadata
  // ------------------------------------------------------------------
  const montarDadosDanfse = function(nfse: FiscalNfse): DanfsePrintDados {
    const meta = nfse.metadata || {};
    const tomador = meta.tomador || {};
    const enderecoTomador = tomador.endereco || {
      logradouro: tomador.logradouro ?? null,
      numero: tomador.numero ?? null,
      complemento: tomador.complemento ?? null,
      bairro: tomador.bairro ?? null,
      municipio: tomador.municipio ?? null,
      uf: tomador.uf ?? null,
      cep: tomador.cep ?? null,
    };

    const valorServico = Number(meta.valor_servico ?? nfse.valor ?? 0);
    const desconto = Number(meta.valor_desconto ?? 0);
    const liquido = Number(meta.valor_liquido ?? Math.max(0, valorServico - desconto));
    const aliquota = Number(meta.aliquota_iss ?? 0);
    const base = Number(meta.base_calculo_iss ?? valorServico);
    const issRetido = meta.iss_retido === true;
    const issqn = Number(meta.issqn ?? (base * aliquota) / 100);
    const retencoes = Number(meta.total_retencoes ?? (issRetido ? issqn : 0));

    const codigo = String(meta.codigo_servico || "16.02.01.002");
    const digitos = codigo.replace(/\D/g, "");
    const codigoFormatado = digitos.length >= 9
      ? `${digitos.slice(0, 2)}.${digitos.slice(2, 4)}.${digitos.slice(4, 6)}/${digitos.slice(6, 9)}`
      : codigo;

    const municipio = String(meta.municipio_prestacao || EMITENTE_DANFSE.municipio);
    const uf = String(meta.uf || EMITENTE_DANFSE.uf);

    // IM da DANFSe: usa a IM registrada no emitente (string, com zeros à
    // esquerda). Fallback para o valor oficial de São Paulo.
    const metaEmitenteDanfse = (meta.emitente || {}) as Record<string, unknown>;
    const emitenteDanfse: DanfsePrintDados["emitente"] = {
      ...EMITENTE_DANFSE,
      inscricaoMunicipal: String(
        metaEmitenteDanfse.inscricao_municipal || EMITENTE_DANFSE.inscricaoMunicipal,
      ),
    };

    return {
      logoUrl: urlLogoAbsoluta(logoEmitenteUrl),
      numero: String(nfse.numero || "—"),
      chaveAcesso: String(nfse.chave_acesso || meta.emissao?.chave_acesso || ""),
      competencia: formatarCompetenciaDanfse(meta.competencia, nfse.created_at),
      emissao: formatarDataHoraDanfse(nfse.data_emissao || nfse.created_at),
      numeroDps: String(meta.numero_dps || "—"),
      serieDps: String(meta.serie || "—"),
      situacao: situacaoDanfse(nfse.status),
      statusCodigo: String(nfse.status || ""),
      emitente: emitenteDanfse,
      tomador: {
        nome: String(tomador.nome || "—"),
        cnpj: String(tomador.cnpj || "—"),
        email: tomador.email ? String(tomador.email) : null,
        telefone: tomador.telefone ? String(tomador.telefone) : null,
        endereco: enderecoTomador,
      },
      servico: {
        descricao: String(meta.servico || "Transporte de bens ou valores"),
        codigoTributacao: codigoFormatado,
        codigoNbs: String(meta.codigo_nbs || "—"),
        localPrestacao: `${municipio}/${uf}`,
      },
      tributacao: {
        municipioIncidencia: `${municipio}/${uf}`,
        issRetido,
        baseCalculo: base,
        aliquota,
        issqn,
        pisCofinsCsll: Number(meta.pis_cofins_csll ?? 0),
        irrf: Number(meta.irrf ?? 0),
        ibsCbs: Number(meta.ibs_cbs ?? 0),
        totalRetencoes: retencoes,
      },
      valores: {
        servico: valorServico,
        desconto,
        liquido,
      },
      observacoes: String(meta.observacoes || meta.informacoes_complementares || ""),
    };
  };

  const imprimirDanfse = function(nfse: FiscalNfse) {
    try {
      if (!abrirImpressaoDanfse(montarDadosDanfse(nfse))) {
        toast.error("Permita pop-ups no navegador para abrir a DANFSe.");
      }
    } catch (erro: unknown) {
      console.error(
        "[NfseTab] Erro ao gerar DANFSe:",
        erro instanceof Error ? erro.message : String(erro),
      );
      toast.error(erro instanceof Error ? erro.message : "Falha ao gerar a DANFSe.");
    }
  };

  const gerarXmlDoRascunho = function(nfse: FiscalNfse): string {
    const meta = nfse.metadata || {};
    const tomador = meta.tomador || {};
    const metaEmitente = (meta.emitente || {}) as Record<string, unknown>;
    const competencia = /^\d{4}-\d{2}$/.test(String(meta.competencia || ""))
      ? String(meta.competencia)
      : new Date(nfse.created_at || Date.now()).toISOString().slice(0, 7);

    // IM como STRING — preserva zeros à esquerda (ex.: 000000060458216).
    const inscricaoMunicipalEmitente = String(
      metaEmitente.inscricao_municipal || EMITENTE_DANFSE.inscricaoMunicipal,
    );

    const dps: DpsPayload = {
      competencia,
      prestador: {
        cnpj: "31227975000180",
        inscricaoMunicipal: inscricaoMunicipalEmitente,
        razaoSocial: EMITENTE_DANFSE.nome,
        municipioIbge: "3550308",
      },
      tomador: {
        nome: String(tomador.nome || ""),
        cnpj: tomador.cnpj ? String(tomador.cnpj) : null,
        cpf: tomador.cpf ? String(tomador.cpf) : null,
        email: tomador.email ? String(tomador.email) : null,
      },
      servico: {
        codigoTributacaoNacional: String(meta.codigo_servico || "16.02.01.002"),
        descricao: String(meta.servico || "Transporte de bens ou valores"),
        valorServico: Number(meta.valor_servico ?? nfse.valor ?? 0),
        aliquotaIss: Number(meta.aliquota_iss ?? 0),
        issRetido: meta.iss_retido === true,
        codigoMunicipioPrestacao: String(meta.codigo_municipio_prestacao || "3550308"),
        codigoNbs: meta.codigo_nbs ? String(meta.codigo_nbs) : null,
      },
      serie: String(meta.serie || "1"),
      numero: meta.numero_dps ? String(meta.numero_dps) : null,
      nfseId: nfse.id,
    };

    const empresa: FiscalCompanySettings = {
      cnpj: "31.227.975/0001-80",
      razaoSocial: EMITENTE_DANFSE.nome,
      inscricaoMunicipal: inscricaoMunicipalEmitente,
      codigoIbge: "3550308",
      cep: "03087010",
      logradouro: "RUA ANTONIO MACEDO",
      numero: "45",
      bairro: "PARQUE SAO JORGE",
      cidade: "São Paulo",
      uf: "SP",
      email: "fiscal@conexaoexpress.com.br",
      regimeTributario: "Simples Nacional (ME)",
      crt: "1",
      ambienteFiscal: String(meta.emissao?.ambiente || "homologacao"),
    };

    return gerarXmlDpsNacional(dps, empresa);
  };

  const baixarXmlNfse = async function(nfse: FiscalNfse) {
    if (baixandoXmlId) return;
    setBaixandoXmlId(nfse.id);

    try {
      const meta = nfse.metadata || {};
      const documentos = meta.documentos_storage || {};
      const candidatos: string[] = [
        documentos.nfse_retorno,
        documentos.nfse_dps,
        nfse.xml_url,
      ].filter(function(item): item is string { return Boolean(item); });

      const urlExterna = candidatos.find(function(item) {
        return /^https?:\/\//i.test(item);
      });
      if (urlExterna) {
        window.open(urlExterna, "_blank", "noopener,noreferrer");
        toast.success("Abrindo XML autorizado...");
        return;
      }

      const caminhoBruto = candidatos.find(function(item) {
        return !/^https?:\/\//i.test(item);
      });
      if (caminhoBruto) {
        const caminho = caminhoBruto.replace(/^fiscal-documentos\//, "");
        const { data, error } = await supabase.storage
          .from("fiscal-documentos")
          .createSignedUrl(caminho, 60);

        if (error || !data?.signedUrl) {
          throw new Error("Nao foi possivel acessar o XML no Storage.");
        }

        const resposta = await fetch(data.signedUrl);
        if (!resposta.ok) {
          throw new Error("Falha ao baixar o XML do Storage.");
        }

        baixarArquivo(await resposta.blob(), `NFS-e-${nfse.numero || nfse.id}.xml`);
        toast.success("XML baixado.");
        return;
      }

      const status = String(nfse.status || "").toLowerCase();
      if (status === "rascunho" || status === "erro_emissao" || status === "") {
        const xml = gerarXmlDoRascunho(nfse);
        baixarArquivo(
          new Blob([xml], { type: "application/xml" }),
          `DPS-${nfse.numero || nfse.id}.xml`,
        );
        toast.success("XML da DPS (rascunho) gerado.");
        return;
      }

      toast.error("XML autorizado nao encontrado no Storage.");
    } catch (erro: unknown) {
      console.error(
        "[NfseTab] Erro ao baixar XML:",
        erro instanceof Error ? erro.message : String(erro),
      );
      toast.error(erro instanceof Error ? erro.message : "Falha ao obter o XML.");
    } finally {
      setBaixandoXmlId(null);
    }
  };

  const abrirPdfOficial = async function(nfse: FiscalNfse) {
    if (abrindoPdfOficialId) return;

    const meta = nfse.metadata || {};
    const documentos = meta.documentos_storage || {};
    const referencia = String(
      nfse.pdf_url || documentos.danfse_pdf || documentos.nfse_pdf || "",
    );
    const status = String(nfse.status || "").toLowerCase();

    if (referencia) {
      if (/^https?:\/\//i.test(referencia)) {
        window.open(referencia, "_blank", "noopener,noreferrer");
        return;
      }

      // Abre a aba antes do await para nao ser bloqueada como pop-up.
      const janela = window.open("", "_blank");
      setAbrindoPdfOficialId(nfse.id);

      try {
        const caminho = referencia.replace(/^fiscal-documentos\//, "");
        const { data, error } = await supabase.storage
          .from("fiscal-documentos")
          .createSignedUrl(caminho, 60);

        if (error || !data?.signedUrl) {
          throw new Error("PDF oficial nao encontrado no Storage.");
        }

        if (janela) janela.location.replace(data.signedUrl);
        else {
          const aberta = window.open(
            data.signedUrl,
            "_blank",
            "noopener,noreferrer",
          );
          if (!aberta) toast.error("Permita pop-ups para abrir o PDF oficial.");
        }
      } catch (erro: unknown) {
        if (janela) janela.close();
        console.error(
          "[NfseTab] Erro ao abrir PDF oficial:",
          erro instanceof Error ? erro.message : String(erro),
        );
        toast.error(
          erro instanceof Error ? erro.message : "Falha ao abrir o PDF oficial.",
        );
      } finally {
        setAbrindoPdfOficialId(null);
      }
      return;
    }

    if (status === "emitida" && nfse.chave_acesso) {
      window.open(
        `https://www.nfse.gov.br/consultapublica?chave=${encodeURIComponent(String(nfse.chave_acesso))}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    toast.error("PDF oficial disponivel apos a emissao na Sefin.");
  };

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

  // Apenas o VALOR do serviço fica travado pela origem. Tomador/CNPJ/endereço
  // permanecem editáveis (inclusive para busca avulsa de CNPJ).
  const valorTravadoPelaOrigem = gerarForm.origem !== "avulso";
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
                  src={logoEmitenteUrl}
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

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Município de emissão (IBGE)</Label>
                  <Input value={gerarForm.municipio_ibge || "3550308"} readOnly className="bg-slate-50" />
                </div>
                <div>
                  <Label>Código de Serviço Nacional</Label>
                  <CodigoCombobox
                    value={gerarForm.codigo_servico}
                    options={codigosServico}
                    placeholder="Ex.: 16.02.01.002"
                    vazioTexto="Nenhum código na lista. Você pode digitar manualmente."
                    rodapeTexto="Selecione ou digite um código customizado."
                    onChangeValue={function(valor) {
                      setGerarForm(function(p) { return { ...p, codigo_servico: valor }; });
                    }}
                    onSelectOption={selecionarCodigoServico}
                  />
                </div>
                <div>
                  <Label>Código NBS</Label>
                  <CodigoCombobox
                    value={gerarForm.codigo_nbs}
                    options={CODIGOS_NBS}
                    placeholder="Ex.: 1.0501.15.00"
                    vazioTexto="Nenhum NBS na lista. Você pode digitar manualmente."
                    rodapeTexto="NBS 2.0 — transporte rodoviário de cargas: 1.0501.15.00."
                    onChangeValue={function(valor) {
                      setGerarForm(function(p) { return { ...p, codigo_nbs: valor }; });
                    }}
                    onSelectOption={function(opcao) {
                      setGerarForm(function(p) { return { ...p, codigo_nbs: opcao.codigo }; });
                    }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                O código de serviço (cTribNac) e o NBS seguem para a DPS. Padrão:
                16.02.01.002 (transporte de bens) e NBS 1.0501.15.00.
              </p>

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
                  Selecione a origem ou informe o CNPJ do tomador. Todos os campos ficam editáveis.
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
                          onFocus={function() {
                            setOrigemAberto(true);
                            // Garante a lista real das OSs/CT-e recentes ao clicar,
                            // mesmo se a carga inicial ainda não terminou.
                            if (origens.length === 0) {
                              void fetchOrigens(gerarForm.origem === "cte" ? "cte" : "os");
                            }
                          }}
                          onClick={function() {
                            setOrigemAberto(true);
                            if (origens.length === 0) {
                              void fetchOrigens(gerarForm.origem === "cte" ? "cte" : "os");
                            }
                          }}
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
                          email?: string | null;
                          telefone?: string | null;
                          whatsapp?: string | null;
                          cep?: string | null;
                          logradouro?: string | null;
                          numero?: string | null;
                          complemento?: string | null;
                          bairro?: string | null;
                          cidade?: string | null;
                          uf?: string | null;
                        } | null;
                        setGerarForm(function(p) {
                          return {
                            ...p,
                            cliente_id: id || "",
                            tomador_nome: cli?.razao_social || cli?.nome_fantasia || "",
                            tomador_cnpj: cli?.cnpj || "",
                            tomador_email: cli?.email || "",
                            tomador_telefone: cli?.telefone || cli?.whatsapp || "",
                            tomador_cep: somenteDigitos(cli?.cep) || "",
                            tomador_logradouro: cli?.logradouro || "",
                            tomador_numero: cli?.numero || "",
                            tomador_complemento: cli?.complemento || "",
                            tomador_bairro: cli?.bairro || "",
                            tomador_municipio: cli?.cidade || "",
                            tomador_uf: cli?.uf || "",
                          };
                        });
                      }}
                    />
                  ) : (
                    <>
                      <Input
                        value={gerarForm.tomador_nome}
                        onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_nome: e.target.value }; }); }}
                        placeholder="Razão social do tomador"
                      />
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Lock className="h-3 w-3" /> Preenchido pela origem/CNPJ — editável
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <Label>CNPJ do Tomador</Label>
                  <div className="flex gap-2">
                    <Input
                      value={gerarForm.tomador_cnpj}
                      onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_cnpj: e.target.value }; }); }}
                      placeholder="00.000.000/0000-00"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={function() { void consultarCnpjTomador(); }}
                      disabled={consultandoCnpj}
                      title="Buscar dados do CNPJ na Receita (BrasilAPI)"
                    >
                      {consultandoCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      <span className="hidden sm:inline">Buscar CNPJ</span>
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Digite o CNPJ (consulta automática ao completar 14 dígitos) ou use "Buscar CNPJ".
                  </p>
                  {erroConsultaCnpj && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
                      <AlertCircle className="h-3 w-3" /> {erroConsultaCnpj}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Contato e endereço do tomador
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={gerarForm.tomador_email}
                      onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_email: e.target.value }; }); }}
                      placeholder="fiscal@cliente.com.br"
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={gerarForm.tomador_telefone}
                      onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_telefone: e.target.value }; }); }}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Logradouro</Label>
                    <Input
                      value={gerarForm.tomador_logradouro}
                      onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_logradouro: e.target.value }; }); }}
                    />
                  </div>
                  <div>
                    <Label>Número</Label>
                    <Input
                      value={gerarForm.tomador_numero}
                      onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_numero: e.target.value }; }); }}
                    />
                  </div>
                  <div>
                    <Label>Complemento</Label>
                    <Input
                      value={gerarForm.tomador_complemento}
                      onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_complemento: e.target.value }; }); }}
                    />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input
                      value={gerarForm.tomador_bairro}
                      onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_bairro: e.target.value }; }); }}
                    />
                  </div>
                  <div>
                    <Label>Município</Label>
                    <MunicipioCombobox
                      value={gerarForm.tomador_municipio}
                      uf={gerarForm.tomador_uf}
                      onChange={function(nome, ufSelecionada) {
                        setGerarForm(function(p) {
                          return {
                            ...p,
                            tomador_municipio: nome,
                            tomador_uf: ufSelecionada || p.tomador_uf,
                          };
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input
                      maxLength={2}
                      value={gerarForm.tomador_uf}
                      onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_uf: e.target.value.toUpperCase() }; }); }}
                    />
                  </div>
                  <div>
                    <Label>CEP</Label>
                    <Input
                      value={gerarForm.tomador_cep}
                      onChange={function(e) { setGerarForm(function(p) { return { ...p, tomador_cep: e.target.value }; }); }}
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Campos editáveis. A consulta de CNPJ preenche automaticamente.
                </p>
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
                    readOnly={valorTravadoPelaOrigem}
                    className={valorTravadoPelaOrigem ? "bg-slate-50" : ""}
                    onChange={function(e) { setGerarForm(function(p) { return { ...p, valor_servico: parseFloat(e.target.value) || 0 }; }); }}
                  />
                  {valorTravadoPelaOrigem && (
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
                    listAllOnOpen
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                  <div className="mt-1">
                    <CodigoCombobox
                      id="nfse-codigo-servico"
                      value={gerarForm.codigo_servico}
                      options={codigosServico}
                      placeholder="Ex.: 16.02.01.002"
                      vazioTexto="Nenhum código na lista. Você pode digitar manualmente."
                      rodapeTexto="Selecione ou digite um código customizado."
                      onChangeValue={function(valor) {
                        setGerarForm(function(p) { return { ...p, codigo_servico: valor }; });
                      }}
                      onSelectOption={selecionarCodigoServico}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="nfse-codigo-nbs">Código NBS</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="Ajuda sobre o codigo NBS" className="rounded p-0.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground">
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Nomenclatura Brasileira de Serviços (NBS 2.0). Padrão da operação:
                        1.0501.15.00 (transporte rodoviário de cargas). Na DPS vai como 105011500.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mt-1">
                    <CodigoCombobox
                      id="nfse-codigo-nbs"
                      value={gerarForm.codigo_nbs}
                      options={CODIGOS_NBS}
                      placeholder="Ex.: 1.0501.15.00"
                      vazioTexto="Nenhum NBS na lista. Você pode digitar manualmente."
                      rodapeTexto="NBS 2.0 — transporte rodoviário de cargas: 1.0501.15.00."
                      onChangeValue={function(valor) {
                        setGerarForm(function(p) { return { ...p, codigo_nbs: valor }; });
                      }}
                      onSelectOption={function(opcao) {
                        setGerarForm(function(p) { return { ...p, codigo_nbs: opcao.codigo }; });
                      }}
                    />
                  </div>
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
                  <p className="text-xs text-muted-foreground">{gerarForm.tomador_email || "—"}</p>
                  <p className="text-xs text-muted-foreground">{gerarForm.tomador_telefone || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {[gerarForm.tomador_logradouro, gerarForm.tomador_numero, gerarForm.tomador_bairro, gerarForm.tomador_municipio, gerarForm.tomador_uf]
                      .filter(Boolean)
                      .join(", ") || "Endereço não informado"}
                  </p>
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
                    Cód. {gerarForm.codigo_servico} · NBS {gerarForm.codigo_nbs || "—"} · ISS {gerarForm.aliquota_iss || "0"}% · {gerarForm.iss_retido ? "Retido" : "Não retido"}
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

  // ===================================================================
  // DETALHES — pagina cheia (sem Dialog)
  // ===================================================================
  if (showDetails && selectedNfse) {
    const metaDetalhe = selectedNfse.metadata || {};
    const validacoesDetalhe: Array<{ severidade?: string; mensagem?: string }> =
      Array.isArray(metaDetalhe.validacoes_pendentes)
        ? metaDetalhe.validacoes_pendentes
        : [];
    const errosDetalhe = validacoesDetalhe.filter(function(item) {
      return item.severidade === "erro";
    });
    const avisosDetalhe = validacoesDetalhe.filter(function(item) {
      return item.severidade === "aviso";
    });
    const temErros = errosDetalhe.length > 0;
    const pronto = metaDetalhe.pronto_para_emissao === true;
    const statusDetalhe = String(selectedNfse.status || "");
    const statusLower = statusDetalhe.toLowerCase();
    const podeTransmitirDetalhe =
      statusLower === "rascunho" || statusLower === "erro_emissao";

    const documentosStorage = metaDetalhe.documentos_storage || {};
    const pdfRef = String(
      selectedNfse.pdf_url || documentosStorage.danfse_pdf ||
        documentosStorage.nfse_pdf || "",
    );
    const pdfBloqueado =
      statusLower === "rascunho" || statusLower === "erro_emissao";
    const temPdfOficial = Boolean(pdfRef) ||
      (statusLower === "emitida" && Boolean(selectedNfse.chave_acesso));
    const pdfOficialDisabled = pdfBloqueado || !temPdfOficial;
    const pdfOficialTitle = pdfBloqueado
      ? "Disponível após a emissão oficial na Sefin"
      : !temPdfOficial
      ? "PDF oficial ainda não disponível"
      : "Abrir PDF oficial da Sefin";

    return (
      <div className="space-y-4">
        {/* HEADER */}
        <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={fecharDetalhes}
              title="Voltar para a lista"
              aria-label="Voltar para a lista"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                NFS-e {selectedNfse.numero || "—"}
              </h1>
              <p className="text-xs text-muted-foreground">Detalhes do documento fiscal</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">
              {statusDetalhe || "—"}
            </Badge>
            {podeTransmitirDetalhe && (
              <Button
                size="sm"
                className="bg-orange-600 text-white hover:bg-orange-700"
                onClick={function() {
                  setShowDetails(false);
                  void handleTransmitir(selectedNfse.id);
                }}
                disabled={transmitindoId !== null}
              >
                {transmitindoId === selectedNfse.id
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Send className="w-4 h-4 mr-2" />}
                Transmitir
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fecharDetalhes}>Fechar</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* STATUS FISCAL */}
            <div
              className={
                "rounded-xl border-2 p-4 " +
                (temErros ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className={"h-4 w-4 " + (temErros ? "text-red-600" : "text-emerald-600")} />
                  <span className="text-sm font-semibold">STATUS FISCAL</span>
                </div>
                <Badge
                  className={
                    temErros
                      ? "border-red-200 bg-red-100 text-red-700"
                      : "border-emerald-200 bg-emerald-100 text-emerald-700"
                  }
                >
                  {temErros ? "COM PENDÊNCIA" : "PRONTO INTERNO"}
                </Badge>
              </div>
            </div>

            {selectedNfse.motivo_rejeicao && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p className="flex items-center gap-2 font-semibold">
                  <XCircle className="h-4 w-4" /> Rejeição da Sefin
                </p>
                <p className="mt-1 text-xs">{selectedNfse.motivo_rejeicao}</p>
              </div>
            )}

            {errosDetalhe.length > 0 && (
              <div className="rounded-xl border bg-white">
                <div className="border-b bg-red-50/50 p-3">
                  <span className="text-xs font-semibold text-red-800">
                    PENDÊNCIAS ({errosDetalhe.length})
                  </span>
                </div>
                <div className="space-y-1 p-3">
                  {errosDetalhe.map(function(item, indice) {
                    return (
                      <div key={indice} className="flex items-start gap-2 text-xs">
                        <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                        <span className="text-red-700">{item.mensagem}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {avisosDetalhe.length > 0 && (
              <div className="rounded-xl border bg-white">
                <div className="border-b bg-amber-50/50 p-3">
                  <span className="text-xs font-semibold text-amber-800">
                    AVISOS ({avisosDetalhe.length})
                  </span>
                </div>
                <div className="space-y-1 p-3">
                  {avisosDetalhe.map(function(item, indice) {
                    return (
                      <div key={indice} className="flex items-start gap-2 text-xs">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                        <span className="text-amber-700">{item.mensagem}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DADOS */}
            <div className="space-y-2 rounded-xl border bg-white p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Emitente</span>
                <span className="font-medium">{metaDetalhe.emitente?.nome || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tomador</span>
                <span className="font-medium">{metaDetalhe.tomador?.nome || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Serviço</span>
                <span>{metaDetalhe.servico || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Código</span>
                <span className="font-mono">{metaDetalhe.codigo_servico || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ISS%</span>
                <span>{metaDetalhe.aliquota_iss != null ? metaDetalhe.aliquota_iss + "%" : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ISS Retido</span>
                <span>{metaDetalhe.iss_retido === true ? "Sim" : metaDetalhe.iss_retido === false ? "Não" : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-semibold">
                  {fmtFin(Number(metaDetalhe.valor_servico ?? selectedNfse.valor ?? 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Município</span>
                <span>{metaDetalhe.municipio_prestacao || "—"}</span>
              </div>
            </div>

            {/* CICLO DE VIDA */}
            <div className="rounded-xl border bg-white">
              <div className="flex items-center justify-between border-b bg-slate-50/50 p-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-slate-600" />
                  <span className="text-xs font-semibold text-slate-800">CICLO DE VIDA INTERNO</span>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">
                  {selectedNfse.status}
                </Badge>
              </div>
              <div className="space-y-2 p-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={function() { openSimulacao("cancelar"); }}>
                    <XCircle className="mr-1 h-3 w-3" /> Simular Cancelamento
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={function() { openSimulacao("rejeitar"); }}>
                    <AlertTriangle className="mr-1 h-3 w-3" /> Simular Rejeição
                  </Button>
                </div>
                <p className="text-[10px] italic text-muted-foreground">
                  Simulações internas. Não comunicam com prefeitura ou Focus.
                </p>

                {showSimulacao && (
                  <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">
                      Simular {simulacaoAcao === "cancelar" ? "cancelamento" : "rejeição"}
                    </p>
                    <Input
                      value={motivoSimulacao}
                      onChange={function(e) { setMotivoSimulacao(e.target.value); }}
                      placeholder="Motivo da simulação..."
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={function() { setShowSimulacao(false); }}>
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleSimular}
                        disabled={!motivoSimulacao.trim()}
                      >
                        Confirmar
                      </Button>
                    </div>
                  </div>
                )}

                {historico.length > 0 && (
                  <div className="mt-2 border-t pt-2">
                    <span className="text-xs font-semibold text-muted-foreground">Histórico</span>
                    <div className="mt-1 space-y-1">
                      {historico.slice(0, 5).map(function(h, indice) {
                        return (
                          <div key={indice} className="flex items-center gap-1 text-[10px]">
                            <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                            <span className="font-mono">{h.status_anterior}→{h.status_novo}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* COLUNA LATERAL */}
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border bg-white p-4">
              <p className="text-sm font-semibold">Documentos</p>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={function() { imprimirDanfse(selectedNfse); }}
              >
                <Printer className="w-4 h-4 mr-2" /> PDF / Imprimir (Modelo Conexão)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={function() { void abrirPdfOficial(selectedNfse); }}
                disabled={pdfOficialDisabled || abrindoPdfOficialId === selectedNfse.id}
                title={pdfOficialTitle}
              >
                {abrindoPdfOficialId === selectedNfse.id
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <FileText className="w-4 h-4 mr-2" />}
                PDF Oficial (Sefin)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={function() { void baixarXmlNfse(selectedNfse); }}
                disabled={baixandoXmlId === selectedNfse.id}
              >
                {baixandoXmlId === selectedNfse.id
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Download className="w-4 h-4 mr-2" />}
                Baixar XML
              </Button>
              <p className="text-[11px] text-muted-foreground">
                XML autorizado do Storage ou DPS gerada localmente para rascunho.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border bg-white p-4">
              <p className="text-sm font-semibold">Pré-emissão</p>
              <Button
                className="w-full"
                variant={temErros || !pronto ? "outline" : "default"}
                disabled={temErros || !pronto}
                onClick={pronto && !temErros ? handlePreEmissao : undefined}
              >
                <Stamp className="mr-2 h-4 w-4" /> Pré-emissão NFS-e
              </Button>
              {!pronto && !temErros && (
                <p className="text-[11px] text-muted-foreground">
                  Finalize as pendências para habilitar.
                </p>
              )}

              {showPreEmissao && (
                <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> Dados internos prontos
                  </p>
                  <p className="text-xs text-blue-800">
                    A emissão desta NFS-e segue o fluxo próprio do Padrão Nacional
                    (SEFIN), sem dependência de configuração, token ou certificado
                    da Focus NFe.
                  </p>
                  <Button variant="outline" size="sm" onClick={function() { setShowPreEmissao(false); }}>
                    Entendi
                  </Button>
                </div>
              )}
            </div>
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

    </div>
  );
}
