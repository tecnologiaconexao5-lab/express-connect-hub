import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { Stamp, PlusCircle, RefreshCw, Loader2, ShieldAlert, XCircle, AlertTriangle, CheckCircle2, Send, Eye, AlertCircle, GitBranch, HelpCircle, Lock, ArrowLeft, Search, Printer, Download, FileText, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { formatarCpfCnpj } from "@/lib/formatacaoCadastros";
import { formatarDataBR, hojeISOSP } from "@/lib/formatDates";
import { gerarRascunhoNfse, cancelarNfse, enviarNfsePorEmail, MOTIVOS_CANCELAMENTO_NFSE } from "@/services/fiscal/nfseService";
import type { MotivoCancelamentoNfse } from "@/services/fiscal/nfseService";
import { buscarRegraNfse, listarRegrasNfse } from "@/services/fiscal/regrasFiscaisNfseService";
import { alterarStatusFiscalInterno, listarHistoricoStatus } from "@/services/fiscal/fiscalStatusService";
import { abrirImpressaoDanfse } from "@/components/fiscal/DanfsePrintTemplate";
import type { DanfsePrintDados } from "@/components/fiscal/DanfsePrintTemplate";
import { gerarXmlDpsNacional } from "@/services/fiscal/nfseEmissaoService";
import type { DpsPayload, FiscalCompanySettings } from "@/services/fiscal/nfseEmissaoService";
import { nomeArquivoNfse, nomeBaseNfse } from "@/services/fiscal/nfseFilename";
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
const CODIGO_NACIONAL_PADRAO = "16.02.01";
const CODIGO_COMPLEMENTAR_PADRAO = "002";
/** Descrição oficial da NFS-e (editável no Passo 3). */
const DESCRICAO_SERVICO_PADRAO =
  "Prestação de serviços de coleta e entrega de mercadorias, conforme programação operacional definida pelo contratante.";
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

function formatarCodigoNacional(valor: string): string {
  const digitos = (valor || "").replace(/\D/g, "").slice(0, 6);
  return digitos.length === 6
    ? `${digitos.slice(0, 2)}.${digitos.slice(2, 4)}.${digitos.slice(4, 6)}`
    : digitos;
}

function dividirCodigoServico(valor: string): {
  nacional: string;
  complementar: string;
  completo: string;
} {
  const digitos = (valor || "").replace(/\D/g, "");
  const nacionalDigitos = digitos.slice(0, 6);
  const complementar = digitos.slice(6, 9) || CODIGO_COMPLEMENTAR_PADRAO;
  const nacional = formatarCodigoNacional(nacionalDigitos) || CODIGO_NACIONAL_PADRAO;
  const completo = nacionalDigitos.length === 6
    ? `${nacional}.${complementar}`
    : CODIGO_SERVICO_NACIONAL_PADRAO;
  return { nacional, complementar, completo };
}

/** Combina Código Nacional (6 dígitos) + Complementar Municipal (3 dígitos). */
function comporCodigoServico(nacional: string, complementar: string): string {
  const nacionalDigitos = (nacional || "").replace(/\D/g, "").slice(0, 6);
  const complementoDigitos = (complementar || "").replace(/\D/g, "").slice(0, 3);
  const nacionalFormatado = formatarCodigoNacional(nacionalDigitos);
  if (nacionalDigitos.length === 6) {
    return complementoDigitos
      ? `${nacionalFormatado}.${complementoDigitos}`
      : nacionalFormatado;
  }
  return nacionalDigitos + complementoDigitos;
}

/** Lista de códigos nacionais (6 dígitos) a partir dos códigos completos. */
function montarCodigosNacionais(opcoes: CodigoServicoOpcao[]): CodigoServicoOpcao[] {
  const mapa = new Map<string, { descricao: string; completo: boolean }>();
  opcoes.forEach(function(opcao) {
    const digitos = (opcao.codigo || "").replace(/\D/g, "");
    if (digitos.length < 6) return;
    const nacional = formatarCodigoNacional(digitos.slice(0, 6));
    const atual = mapa.get(nacional);
    const completo = digitos.length >= 9;
    if (!atual || (completo && !atual.completo)) {
      mapa.set(nacional, { descricao: opcao.descricao, completo });
    }
  });
  return Array.from(mapa, function(par) {
    return { codigo: par[0], descricao: par[1].descricao };
  });
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

/** Consulta CNPJ (BrasilAPI) para completar o DANFSe quando a nota não tem os dados. */
async function buscarDadosCnpjFallback(cnpj: string): Promise<BrasilApiCnpj | null> {
  try {
    const resposta = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      { headers: { Accept: "application/json" } },
    );
    if (!resposta.ok) return null;
    return (await resposta.json()) as BrasilApiCnpj;
  } catch {
    return null;
  }
}

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

/** "YYYY-MM" no fuso America/Sao_Paulo (para o filtro de exportacao mensal). */
function mesSP(valor: unknown): string {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto.slice(0, 7);
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto.slice(0, 7);
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(data);
  const ano = partes.find(function(p) { return p.type === "year"; })?.value || "";
  const mes = partes.find(function(p) { return p.type === "month"; })?.value || "";
  return ano && mes ? `${ano}-${mes}` : "";
}

function dataBrSP(valor: unknown): string {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

function numeroCsv(valor: unknown): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "0,00";
  return numero.toFixed(2).replace(".", ",");
}

function somarRetencoes(retencoes: unknown): number {
  if (!retencoes || typeof retencoes !== "object") return 0;
  return ["pis", "cofins", "csll", "irrf", "inss"].reduce(function(total, chave) {
    const valor = Number((retencoes as Record<string, unknown>)[chave] ?? 0);
    return total + (Number.isFinite(valor) && valor > 0 ? valor : 0);
  }, 0);
}

function escaparCsv(valor: unknown): string {
  const texto = String(valor ?? "");
  if (/[";\n\r]/.test(texto)) return '"' + texto.replace(/"/g, '""') + '"';
  return texto;
}

/** CSV do resumo mensal (UTF-8 com BOM, separador ";" para Excel pt-BR). */
function montarResumoCsv(nfses: any[]): string {
  const cabecalho = [
    "Numero",
    "Data",
    "Tomador",
    "CNPJ_CPF",
    "Status",
    "Valor_Bruto",
    "Retencoes",
    "Valor_Liquido",
    "Chave_Acesso",
  ];
  const linhas = nfses.map(function(nfse) {
    const meta = (nfse.metadata || {}) as Record<string, any>;
    const tomador = (meta.tomador || {}) as Record<string, any>;
    const bruto = Number(meta.valor_servico ?? nfse.valor ?? 0);
    const retencoes = somarRetencoes(meta.retencoes);
    const liquido = Number(
      meta.valor_liquido ?? ((nfse.valor ?? bruto) - retencoes),
    );
    return [
      nfse.numero || "",
      dataBrSP(
        nfse.data_emissao || meta.data_emissao ||
          meta.emissao?.data_emissao || nfse.created_at,
      ),
      tomador.nome || "",
      tomador.cnpj || tomador.cpf || "",
      String(nfse.status || "").toLowerCase(),
      numeroCsv(bruto),
      numeroCsv(retencoes),
      numeroCsv(liquido),
      nfse.chave_acesso || "",
    ].map(escaparCsv).join(";");
  });
  const conteudo = [cabecalho.join(";")].concat(linhas).join("\r\n");
  return "\uFEFF" + conteudo + "\r\n";
}

function caminhoXmlAutorizado(nfse: any): string | null {
  const meta = (nfse.metadata || {}) as Record<string, any>;
  const docs = (meta.documentos_storage || {}) as Record<string, any>;
  return docs.nfse_retorno || docs.nfse_dps || nfse.xml_url || null;
}

function caminhoPdfOficialNfse(nfse: any): string | null {
  const meta = (nfse.metadata || {}) as Record<string, any>;
  const docs = (meta.documentos_storage || {}) as Record<string, any>;
  return (
    nfse.pdf_url ||
    meta.pdf_oficial_path ||
    docs.danfse_oficial ||
    docs.danfse_pdf ||
    docs.nfse_pdf ||
    null
  );
}

async function baixarBytesStorage(
  caminhoBruto: string | null,
): Promise<Uint8Array | null> {
  const caminho = String(caminhoBruto || "").trim();
  if (!caminho || /^https?:\/\//i.test(caminho)) return null;
  const limpo = caminho.replace(/^fiscal-documentos\//, "");
  const { data, error } = await supabase.storage
    .from("fiscal-documentos")
    .download(limpo);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

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

type RespostaPdfOficial = {
  success?: boolean;
  error?: string;
  detalhe?: string | null;
  pdf_oficial_path?: string | null;
  links?: { xml?: string | null; pdf?: string | null } | null;
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
  // Cadastro do cliente usado como fallback para os dados do tomador no DANFSe
  // (quando a nota antiga não guardou endereço/e-mail/telefone no metadata).
  const [clienteNfseDetalhe, setClienteNfseDetalhe] = useState<Record<string, unknown> | null>(null);
  // Complemento de exibição do tomador (CNPJ → Receita) quando a nota/cliente
  // não guardaram endereço/e-mail/telefone. Não altera o XML nem o banco.
  const [tomadorCnpjFallback, setTomadorCnpjFallback] = useState<BrasilApiCnpj | null>(null);
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
  const [showCancelamento, setShowCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState<MotivoCancelamentoNfse>("1");
  const [cancelJustificativa, setCancelJustificativa] = useState("");
  const [mesExportacao, setMesExportacao] = useState(function() { return hojeISOSP().slice(0, 7); });
  const [exportandoMes, setExportandoMes] = useState(false);
  const [enviandoEmailId, setEnviandoEmailId] = useState<string | null>(null);

  const [gerarForm, setGerarForm] = useState({
    origem: "os" as "os" | "cte" | "avulso",
    origem_id: "",
    cliente_id: "",
    emitente_id: "",
    emitente_nome: "",
    emitente_cnpj: "",
    emitente_im: "",
    emitente_regime: "",
    ambiente: "homologacao",
    competencia_data: hojeISOSP(),
    municipio: "SAO PAULO",
    municipio_ibge: "3550308",
    uf: "SP",
    codigo_servico: CODIGO_SERVICO_NACIONAL_PADRAO,
    codigo_nacional: CODIGO_NACIONAL_PADRAO,
    codigo_complementar: CODIGO_COMPLEMENTAR_PADRAO,
    codigo_nbs: CODIGO_NBS_PADRAO,
    descricao_servico: DESCRICAO_SERVICO_PADRAO,
    aliquota_iss: "" as string,
    iss_retido: false,
    tomador_nome: "",
    tomador_cnpj: "",
    tomador_cpf: "",
    tomador_tipo_documento: "cnpj" as "cnpj" | "cpf",
    tomador_im: "",
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
    pedido_compra: "",
    enviar_email_tomador: false,
    ret_pis: "",
    ret_cofins: "",
    ret_csll: "",
    ret_irrf: "",
    ret_inss: "",
    exigibilidade_iss: "tributavel",
    tributos_aprox_tipo: "percentual" as "valor" | "percentual",
    tributos_aprox_valor: "",
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
          return somenteDigitos(String(e.cnpj ?? "")) === CNPJ_MATRIZ_NFSE;
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
      emitente_im: "", emitente_regime: "", ambiente: "homologacao",
      competencia_data: hojeISOSP(),
      municipio: "SAO PAULO", municipio_ibge: "3550308", uf: "SP",
      codigo_servico: CODIGO_SERVICO_NACIONAL_PADRAO,
      codigo_nacional: CODIGO_NACIONAL_PADRAO,
      codigo_complementar: CODIGO_COMPLEMENTAR_PADRAO,
      codigo_nbs: CODIGO_NBS_PADRAO,
      descricao_servico: DESCRICAO_SERVICO_PADRAO, aliquota_iss: "", iss_retido: false,
      tomador_nome: "", tomador_cnpj: "", tomador_cpf: "",
      tomador_tipo_documento: "cnpj", tomador_im: "",
      tomador_email: "", tomador_telefone: "",
      tomador_logradouro: "", tomador_numero: "", tomador_complemento: "",
      tomador_bairro: "", tomador_municipio: "", tomador_uf: "", tomador_cep: "",
      valor_servico: 0, valor_desconto: 0,
      pedido_compra: "", enviar_email_tomador: false,
      ret_pis: "", ret_cofins: "", ret_csll: "", ret_irrf: "", ret_inss: "",
      exigibilidade_iss: "tributavel",
      tributos_aprox_tipo: "percentual", tributos_aprox_valor: "",
    });

    // Emitente: MATRIZ da NFS-e Nacional (CNPJ 31.227.975/0001-80),
    // nunca o emitente padrao do CT-e.
    const { data: emitentes } = await supabase
      .from("configuracoes_fiscais")
      .select("id, razao_social, nome_fantasia, cnpj, cidade, uf, codigo_ibge, inscricao_municipal, regime_tributario, ambiente_fiscal")
      .eq("ativo", true);

    const listaEmitentes = (emitentes || []) as Array<{
      id: string;
      razao_social: string | null;
      nome_fantasia: string | null;
      cnpj: string | null;
      cidade: string | null;
      uf: string | null;
      codigo_ibge: string | null;
      inscricao_municipal: string | null;
      regime_tributario: string | null;
      ambiente_fiscal: string | null;
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
        const partesCodigo = dividirCodigoServico(
          rule?.codigo_servico || CODIGO_SERVICO_NACIONAL_PADRAO,
        );
        return {
          ...p,
          emitente_id: matriz.id,
          // Exibicao fixa da matriz oficial (rastreabilidade visual)
          emitente_nome: MATRIZ_NFSE_RAZAO_SOCIAL,
          emitente_cnpj: MATRIZ_NFSE_CNPJ_FORMATADO,
          emitente_im: matriz.inscricao_municipal || "",
          emitente_regime: matriz.regime_tributario || "Simples Nacional",
          ambiente: matriz.ambiente_fiscal || "homologacao",
          competencia_data: hojeISOSP(),
          municipio: matriz.cidade || "SAO PAULO",
          municipio_ibge: ibgeMatriz,
          uf: matriz.uf || "SP",
          codigo_servico: partesCodigo.completo,
          codigo_nacional: partesCodigo.nacional,
          codigo_complementar: partesCodigo.complementar,
          descricao_servico: DESCRICAO_SERVICO_PADRAO,
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
        tomador_cep: somenteDigitos(String(cli.cep ?? "")) || p.tomador_cep,
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
    if (gerarForm.tomador_tipo_documento !== "cnpj") {
      return;
    }
    if (cnpjTomadorDigitos.length !== 14) {
      ultimoCnpjConsultadoRef.current = "";
      return;
    }
    if (ultimoCnpjConsultadoRef.current === cnpjTomadorDigitos) return;
    ultimoCnpjConsultadoRef.current = cnpjTomadorDigitos;
    void consultarCnpjTomador(cnpjTomadorDigitos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnpjTomadorDigitos, gerarForm.tomador_tipo_documento]);

  const selecionarCodigoNacional = function(opcao: CodigoServicoOpcao) {
    const nacionalDigitos = (opcao.codigo || "").replace(/\D/g, "").slice(0, 6);
    setGerarForm(function(p) {
      return {
        ...p,
        codigo_nacional: formatarCodigoNacional(nacionalDigitos),
        codigo_servico: comporCodigoServico(
          nacionalDigitos,
          p.codigo_complementar,
        ),
        descricao_servico: p.descricao_servico || DESCRICAO_SERVICO_PADRAO,
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
        const partesCodigo = dividirCodigoServico(
          rule?.codigo_servico || p.codigo_servico || CODIGO_SERVICO_NACIONAL_PADRAO,
        );
        return {
          ...p,
          codigo_servico: partesCodigo.completo,
          codigo_nacional: partesCodigo.nacional,
          codigo_complementar: partesCodigo.complementar,
          descricao_servico: p.descricao_servico || DESCRICAO_SERVICO_PADRAO,
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

    const retNumero = function(valor: string): number {
      const numero = Number(valor);
      return Number.isFinite(numero) && numero > 0 ? numero : 0;
    };
    const retencoes = {
      pis: retNumero(gerarForm.ret_pis),
      cofins: retNumero(gerarForm.ret_cofins),
      csll: retNumero(gerarForm.ret_csll),
      irrf: retNumero(gerarForm.ret_irrf),
      inss: retNumero(gerarForm.ret_inss),
    };
    const totalRetencoes = Object.values(retencoes)
      .reduce(function(total, valor) { return total + valor; }, 0);
    if (totalRetencoes > gerarForm.valor_servico - gerarForm.valor_desconto) {
      return { id: null, erro: "As retencoes nao podem exceder o valor liquido do servico." };
    }

    const tipoDocumentoTomador = gerarForm.tomador_tipo_documento;
    const documentoTomadorDigitos = somenteDigitos(
      tipoDocumentoTomador === "cpf"
        ? gerarForm.tomador_cpf
        : gerarForm.tomador_cnpj,
    );
    if (!documentoTomadorDigitos) {
      return {
        id: null,
        erro: tipoDocumentoTomador === "cpf"
          ? "Informe o CPF do tomador."
          : "Informe o CNPJ do tomador.",
      };
    }
    if (tipoDocumentoTomador === "cnpj" && documentoTomadorDigitos.length !== 14) {
      return { id: null, erro: "CNPJ do tomador invalido (14 digitos)." };
    }
    if (tipoDocumentoTomador === "cpf" && documentoTomadorDigitos.length !== 11) {
      return { id: null, erro: "CPF do tomador invalido (11 digitos)." };
    }

    const aliquotaNumerica = gerarForm.aliquota_iss !== "" ? Number(gerarForm.aliquota_iss) : null;

    const result = await gerarRascunhoNfse({
      origem: gerarForm.origem,
      origem_id: gerarForm.origem_id,
      cliente_id: gerarForm.cliente_id || null,
      municipio_prestacao: gerarForm.municipio || "SAO PAULO",
      codigo_municipio_prestacao: gerarForm.municipio_ibge || null,
      descricao_servico: gerarForm.descricao_servico || DESCRICAO_SERVICO_PADRAO,
      data_competencia: gerarForm.competencia_data || hojeISOSP(),
      tomador_nome: gerarForm.tomador_nome || undefined,
      tomador_cnpj: tipoDocumentoTomador === "cnpj" ? gerarForm.tomador_cnpj || undefined : undefined,
      tomador_cpf: tipoDocumentoTomador === "cpf" ? gerarForm.tomador_cpf || undefined : undefined,
      tomador_tipo_documento: tipoDocumentoTomador,
      tomador_inscricao_municipal: gerarForm.tomador_im || undefined,
      pedido_compra: gerarForm.pedido_compra || undefined,
      enviar_email_tomador: gerarForm.enviar_email_tomador,
      retencoes,
      exigibilidade_iss: gerarForm.exigibilidade_iss,
      tributos_aproximados: Number(gerarForm.tributos_aprox_valor) > 0
        ? {
          tipo: gerarForm.tributos_aprox_tipo,
          valor: Number(gerarForm.tributos_aprox_valor),
        }
        : undefined,
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

    // Fallback do tomador para o DANFSe: dados do cadastro do cliente.
    setClienteNfseDetalhe(null);
    if (nfse.cliente_id) {
      const clienteId = nfse.cliente_id;
      void supabase
        .from("clientes")
        .select("razao_social, nome_fantasia, cnpj, email, telefone, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, uf")
        .eq("id", clienteId)
        .maybeSingle()
        .then(function(resposta) {
          setClienteNfseDetalhe(
            (resposta.data as Record<string, unknown> | null) || null,
          );
        });
    }

    // Complemento via CNPJ (BrasilAPI) quando a nota não tem os dados do tomador.
    setTomadorCnpjFallback(null);
    const tomadorMeta = (nfse.metadata?.tomador || {}) as Record<string, unknown>;
    const enderecoMeta = (tomadorMeta.endereco || {}) as Record<string, unknown>;
    const cnpjTomador = somenteDigitos(String(tomadorMeta.cnpj || ""));
    const faltaDadosTomador =
      !String(tomadorMeta.email || "").trim() ||
      !String(tomadorMeta.telefone || "").trim() ||
      !String(enderecoMeta.logradouro || "").trim();
    if (cnpjTomador.length === 14 && faltaDadosTomador) {
      void buscarDadosCnpjFallback(cnpjTomador).then(function(dados) {
        if (dados) setTomadorCnpjFallback(dados);
      });
    }
  };

  const fecharDetalhes = function() {
    setShowDetails(false);
    setShowSimulacao(false);
    setShowPreEmissao(false);
    setClienteNfseDetalhe(null);
    setTomadorCnpjFallback(null);
  };

  // ------------------------------------------------------------------
  // DANFSe / XML — dados derivados da nota + metadata
  // ------------------------------------------------------------------
  const montarDadosDanfse = function(nfse: FiscalNfse): DanfsePrintDados {
    const meta = nfse.metadata || {};
    const tomador = (meta.tomador || {}) as Record<string, unknown>;
    const cliente = (clienteNfseDetalhe || {}) as Record<string, unknown>;
    const fallbackCnpj = tomadorCnpjFallback;

    const textoOuVazio = function(valor: unknown): string {
      return valor == null ? "" : String(valor).trim();
    };
    const primeiroTexto = function(...valores: unknown[]): string {
      for (const valor of valores) {
        const texto = textoOuVazio(valor);
        if (texto) return texto;
      }
      return "";
    };

    const enderecoMeta = (tomador.endereco || {}) as Record<string, unknown>;
    const enderecoTomador = {
      logradouro: primeiroTexto(enderecoMeta.logradouro, tomador.logradouro, cliente.logradouro, fallbackCnpj?.logradouro) || null,
      numero: primeiroTexto(enderecoMeta.numero, tomador.numero, cliente.numero, fallbackCnpj?.numero) || null,
      complemento: primeiroTexto(enderecoMeta.complemento, tomador.complemento, cliente.complemento, fallbackCnpj?.complemento) || null,
      bairro: primeiroTexto(enderecoMeta.bairro, tomador.bairro, cliente.bairro, fallbackCnpj?.bairro) || null,
      municipio: primeiroTexto(enderecoMeta.municipio, tomador.municipio, cliente.cidade, fallbackCnpj?.municipio) || null,
      uf: primeiroTexto(enderecoMeta.uf, tomador.uf, cliente.uf, fallbackCnpj?.uf) || null,
      cep: primeiroTexto(enderecoMeta.cep, tomador.cep, cliente.cep, somenteDigitos(fallbackCnpj?.cep)) || null,
    };
    const tomadorNome = primeiroTexto(
      tomador.nome,
      cliente.razao_social,
      cliente.nome_fantasia,
      fallbackCnpj?.razao_social,
      fallbackCnpj?.nome_fantasia,
    );
    const tomadorCnpj = primeiroTexto(tomador.cnpj, cliente.cnpj);
    const tomadorEmail = primeiroTexto(tomador.email, cliente.email, fallbackCnpj?.email);
    const tomadorTelefone = primeiroTexto(
      tomador.telefone,
      cliente.telefone,
      cliente.whatsapp,
      fallbackCnpj?.ddd_telefone_1,
      fallbackCnpj?.telefone,
    );

    // Número/Série da DPS: metadata da transmissão ou o mesmo fallback
    // determinístico usado pelo gerador (últimos 9 dígitos do id, sem zeros).
    const numeroDpsInformado = primeiroTexto(
      meta.numero_dps,
      meta.emissao?.numero_dps,
    ).replace(/\D/g, "").replace(/^0+/, "").slice(0, 15);
    const serieDpsInformada = primeiroTexto(meta.serie, meta.emissao?.serie)
      .replace(/\D/g, "").slice(0, 5);
    const digitosNfse = String(nfse.id || "").replace(/\D/g, "").slice(-9)
      .replace(/^0+/, "");
    const numeroDpsDanfse = numeroDpsInformado || digitosNfse || "—";
    const serieDpsDanfse = serieDpsInformada || "1";

    // NBS salvo na nota ou fallback do serviço padrão (transporte rodoviário).
    const codigoServicoBruto = String(meta.codigo_servico || "16.02.01.002");
    const codigoServicoDigitos = codigoServicoBruto.replace(/\D/g, "");
    const codigoNbsDanfse = primeiroTexto(
      meta.codigo_nbs,
      meta.emissao?.codigo_nbs,
      codigoServicoDigitos === "160201002" ? CODIGO_NBS_PADRAO : "",
    ) || "—";

    // Ambiente (homologação exibe faixa "SEM VALOR FISCAL").
    const ambienteDanfse = primeiroTexto(
      meta.emissao?.ambiente,
      meta.ambiente,
      meta.emissao?.tp_amb,
      meta.tp_amb,
      meta.tpAmb,
    ) || null;

    const valorServico = Number(meta.valor_servico ?? nfse.valor ?? 0);
    const desconto = Number(meta.valor_desconto ?? 0);
    const liquido = Number(meta.valor_liquido ?? Math.max(0, valorServico - desconto));
    const aliquota = Number(meta.aliquota_iss ?? 0);
    const base = Number(meta.base_calculo_iss ?? valorServico);
    const issRetido = meta.iss_retido === true;
    const issqn = Number(meta.issqn ?? (base * aliquota) / 100);
    const retencoes = Number(meta.total_retencoes ?? (issRetido ? issqn : 0));

    const digitos = codigoServicoBruto.replace(/\D/g, "");
    const codigoFormatado = digitos.length >= 9
      ? `${digitos.slice(0, 2)}.${digitos.slice(2, 4)}.${digitos.slice(4, 6)}/${digitos.slice(6, 9)}`
      : codigoServicoBruto;

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
      numero: String(nfse.numero || "-"),
      // Título usado pelo navegador ao "Salvar como PDF" (sem extensão).
      nomeArquivo: nomeBaseNfse(nfse, { tomadorNome: tomadorNome, valor: liquido }),
      chaveAcesso: String(nfse.chave_acesso || meta.emissao?.chave_acesso || ""),
      competencia: formatarCompetenciaDanfse(meta.competencia, nfse.created_at),
      emissao: formatarDataHoraDanfse(nfse.data_emissao || nfse.created_at),
      numeroDps: numeroDpsDanfse,
      serieDps: serieDpsDanfse,
      situacao: situacaoDanfse(nfse.status),
      statusCodigo: String(nfse.status || ""),
      ambiente: ambienteDanfse,
      emitente: emitenteDanfse,
      tomador: {
        nome: tomadorNome || "—",
        cnpj: tomadorCnpj || "—",
        email: tomadorEmail || null,
        telefone: tomadorTelefone || null,
        endereco: enderecoTomador,
      },
      servico: {
        descricao: String(meta.servico || DESCRICAO_SERVICO_PADRAO),
        codigoTributacao: codigoFormatado,
        codigoNbs: codigoNbsDanfse,
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
      dataCompetencia: meta.data_competencia ? String(meta.data_competencia) : null,
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
        inscricaoMunicipal: tomador.inscricao_municipal
          ? String(tomador.inscricao_municipal)
          : null,
      },
      servico: {
        codigoTributacaoNacional: String(meta.codigo_servico || "16.02.01.002"),
        descricao: String(meta.servico || DESCRICAO_SERVICO_PADRAO),
        valorServico: Number(meta.valor_servico ?? nfse.valor ?? 0),
        aliquotaIss: Number(meta.aliquota_iss ?? 0),
        issRetido: meta.iss_retido === true,
        codigoMunicipioPrestacao: String(meta.codigo_municipio_prestacao || "3550308"),
        codigoNbs: meta.codigo_nbs ? String(meta.codigo_nbs) : null,
        informacoesComplementares: meta.pedido_compra ? String(meta.pedido_compra) : null,
      },
      retencoes: meta.retencoes
        ? {
          pis: Number(meta.retencoes.pis ?? 0) || 0,
          cofins: Number(meta.retencoes.cofins ?? 0) || 0,
          csll: Number(meta.retencoes.csll ?? 0) || 0,
          irrf: Number(meta.retencoes.irrf ?? 0) || 0,
          inss: Number(meta.retencoes.inss ?? 0) || 0,
        }
        : null,
      exigibilidadeIss: meta.exigibilidade_iss
        ? String(meta.exigibilidade_iss)
        : "tributavel",
      tributosAproximados: meta.tributos_aproximados &&
          Number(meta.tributos_aproximados.valor) > 0
        ? {
          tipo: meta.tributos_aproximados.tipo === "valor" ? "valor" : "percentual",
          valor: Number(meta.tributos_aproximados.valor),
        }
        : null,
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
      opSimpNac: String(metaEmitente.op_simp_nac || "3"),
      regApTribSN: String(metaEmitente.reg_ap_trib_sn || "1"),
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

        baixarArquivo(await resposta.blob(), nomeArquivoNfse(nfse, "xml"));
        toast.success("XML baixado.");
        return;
      }

      const status = String(nfse.status || "").toLowerCase();
      if (status === "rascunho" || status === "erro_emissao" || status === "") {
        const xml = gerarXmlDoRascunho(nfse);
        baixarArquivo(
          new Blob([xml], { type: "application/xml" }),
          nomeArquivoNfse(nfse, "xml"),
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

  const nomeArquivoDanfseOficial = function(nfse: FiscalNfse): string {
    return nomeArquivoNfse(nfse, "pdf");
  };

  // Baixa o PDF oficial da DANFSe: Storage (se ja arquivado) ou Edge Function
  // (busca no ADN via mTLS e arquiva sob demanda). Nunca abre consultapublica.
  const baixarPdfOficial = async function(nfse: FiscalNfse) {
    if (abrindoPdfOficialId) return;

    const meta = (nfse.metadata || {}) as Record<string, any>;
    const documentos = (meta.documentos_storage || {}) as Record<string, string>;
    const referencia = String(
      nfse.pdf_url || meta.pdf_oficial_path || documentos.danfse_oficial ||
        documentos.danfse_pdf || documentos.nfse_pdf || "",
    );
    const status = String(nfse.status || "").toLowerCase();
    const chave = String(nfse.chave_acesso || meta?.emissao?.chave_acesso || "");

    setAbrindoPdfOficialId(nfse.id);
    try {
      let urlPdf: string | null = null;

      if (referencia) {
        if (/^https?:\/\//i.test(referencia)) {
          urlPdf = referencia;
        } else {
          const caminho = referencia.replace(/^fiscal-documentos\//, "");
          const { data, error } = await supabase.storage
            .from("fiscal-documentos")
            .createSignedUrl(caminho, 120);
          if (!error && data?.signedUrl) urlPdf = data.signedUrl;
        }
      }

      if (!urlPdf) {
        if (status !== "emitida" || !chave) {
          throw new Error("PDF oficial disponivel apos a emissao na Sefin.");
        }

        const { data, error } = await supabase.functions.invoke(
          "nfse-assinar-transmitir",
          { body: { nfse_id: nfse.id, acao: "baixar_danfse" } },
        );

        let payload = (data ?? null) as RespostaPdfOficial | null;

        if (error) {
          const contexto = (error as { context?: unknown }).context;
          if (contexto instanceof Response) {
            const corpo = await contexto.json().catch(function() { return null; });
            payload = (corpo ?? payload) as RespostaPdfOficial | null;
          }
        }

        if (!payload?.success) {
          throw new Error(
            payload?.error ||
              error?.message ||
              "Nao foi possivel baixar o PDF oficial agora.",
          );
        }

        urlPdf = payload.links?.pdf || null;
        if (!urlPdf) {
          throw new Error("PDF oficial ainda nao disponivel no ADN.");
        }

        // Reflete pdf_url/metadata atualizados pela Edge Function.
        const { data: atualizada } = await supabase
          .from("fiscal_nfse")
          .select("*")
          .eq("id", nfse.id)
          .maybeSingle();
        if (atualizada) setSelectedNfse(atualizada);
        await fetchNfses();
      }

      try {
        const resposta = await fetch(urlPdf);
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        const blob = await resposta.blob();
        baixarArquivo(blob, nomeArquivoDanfseOficial(nfse));
        toast.success("PDF oficial da DANFSe baixado.");
      } catch {
        // CORS/URL externa: abre em nova aba como fallback.
        const aberta = window.open(urlPdf, "_blank", "noopener,noreferrer");
        if (aberta) {
          toast.success("Abrindo o PDF oficial da DANFSe...");
        } else {
          toast.error("Permita pop-ups para abrir o PDF oficial.");
        }
      }
    } catch (erro: unknown) {
      console.error(
        "[NfseTab] Erro ao baixar PDF oficial:",
        erro instanceof Error ? erro.message : String(erro),
      );
      toast.error(
        erro instanceof Error ? erro.message : "Falha ao baixar o PDF oficial.",
      );
    } finally {
      setAbrindoPdfOficialId(null);
    }
  };

  const abrirCancelamento = function() {
    setCancelMotivo("1");
    setCancelJustificativa("");
    setShowCancelamento(true);
  };

  const fecharCancelamento = function() {
    if (cancelando) return;
    setShowCancelamento(false);
  };

  const confirmarCancelamento = async function() {
    if (!selectedNfse || cancelando) return;
    const justificativa = cancelJustificativa.trim();
    const tamanho = Array.from(justificativa).length;
    if (tamanho < 15) {
      toast.error("A justificativa deve ter no minimo 15 caracteres.");
      return;
    }
    if (tamanho > 255) {
      toast.error("A justificativa deve ter no maximo 255 caracteres.");
      return;
    }

    setCancelando(true);
    try {
      const resposta = await cancelarNfse({
        nfse_id: selectedNfse.id,
        codigo_motivo: cancelMotivo,
        justificativa,
      });

      if (resposta.success) {
        toast.success(
          "NFS-e cancelada" +
            (resposta.protocolo
              ? " (protocolo " + resposta.protocolo + ")"
              : "") +
            ".",
        );
        setShowCancelamento(false);
        const dataCancelamento = resposta.data || new Date().toISOString();
        setSelectedNfse(function(prev: any) {
          if (!prev) return prev;
          const metaPrev = prev.metadata || {};
          return {
            ...prev,
            status: "cancelada",
            metadata: {
              ...metaPrev,
              cancelamento: {
                ...(metaPrev.cancelamento || {}),
                protocolo: resposta.protocolo ?? null,
                data: dataCancelamento,
                motivo_codigo: resposta.motivo_codigo ?? cancelMotivo,
                motivo_descricao: resposta.motivo_descricao ?? null,
                justificativa,
              },
            },
          };
        });
        await fetchNfses();
      } else {
        toast.error(resposta.error || "Cancelamento rejeitado pela Sefin.");
      }
    } finally {
      setCancelando(false);
    }
  };

  const exportarMesZip = async function() {
    if (exportandoMes) return;
    const mes = mesExportacao;
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      toast.error("Selecione um mes/ano valido para exportar.");
      return;
    }
    setExportandoMes(true);
    try {
      const { data, error } = await supabase
        .from("fiscal_nfse")
        .select("*")
        .in("status", ["emitida", "cancelada"])
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;

      const doMes = (data || []).filter(function(nfse) {
        const meta = (nfse.metadata || {}) as Record<string, any>;
        const referencia = nfse.data_emissao || meta.data_emissao ||
          meta.emissao?.data_emissao || nfse.created_at;
        return mesSP(referencia) === mes;
      });

      if (doMes.length === 0) {
        toast.error("Nenhuma NFS-e emitida/cancelada no mes selecionado.");
        return;
      }

      const zip = new JSZip();
      const pastaXml = zip.folder("XML_Autorizados")!;
      const pastaCancel = zip.folder("XML_Cancelamentos")!;
      const pastaPdf = zip.folder("PDF_DANFSe")!;

      const semXml: string[] = [];
      const semPdf: string[] = [];
      const semCancelXml: string[] = [];

      for (const nfse of doMes) {
        const numero = nfse.numero || nfse.id;

        const xmlBytes = await baixarBytesStorage(caminhoXmlAutorizado(nfse));
        if (xmlBytes) pastaXml.file(nomeArquivoNfse(nfse, "xml"), xmlBytes);
        else semXml.push(String(numero));

        if (String(nfse.status || "").toLowerCase() === "cancelada") {
          const cancelPath =
            (nfse.metadata || {})?.cancelamento?.xml_storage_path || null;
          const cancelBytes = await baixarBytesStorage(cancelPath);
          if (cancelBytes) {
            pastaCancel.file(
              nomeBaseNfse(nfse) + "_Cancelamento.xml",
              cancelBytes,
            );
          } else {
            semCancelXml.push(String(numero));
          }
        }

        const pdfBytes = await baixarBytesStorage(caminhoPdfOficialNfse(nfse));
        if (pdfBytes) pastaPdf.file(nomeArquivoNfse(nfse, "pdf"), pdfBytes);
        else semPdf.push(String(numero));
      }

      zip.file("Resumo_Mensal_" + mes + ".csv", montarResumoCsv(doMes));

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const nomeZip = "NFSe_ConexaoExpress_" + mes + ".zip";
      baixarArquivo(blob, nomeZip);

      const partes = [
        doMes.length + " NFS-e",
        (doMes.length - semXml.length) + " XML",
        (doMes.length - semPdf.length) + " PDF",
      ];
      if (semPdf.length) partes.push("sem PDF: " + semPdf.length);
      if (semXml.length) partes.push("sem XML: " + semXml.length);
      if (semCancelXml.length) {
        partes.push("cancelamento sem XML: " + semCancelXml.length);
      }
      toast.success(
        "ZIP " + nomeZip + " gerado (" + partes.join(" · ") + ").",
      );
    } catch (erro: unknown) {
      console.error(
        "[NfseTab] Falha ao exportar mes:",
        erro instanceof Error ? erro.message : String(erro),
      );
      toast.error(
        erro instanceof Error ? erro.message : "Falha ao exportar o mes.",
      );
    } finally {
      setExportandoMes(false);
    }
  };

  const reenviarEmailNfse = async function(nfse: any) {
    if (enviandoEmailId) return;
    setEnviandoEmailId(nfse.id);
    try {
      const resposta = await enviarNfsePorEmail(nfse.id);
      if (resposta.success) {
        toast.success(
          resposta.envio_real === false
            ? (resposta.mensagem || "Envio registrado.")
            : "E-mail enviado ao tomador.",
        );
        await fetchNfses();
      } else if (resposta.configurado === false) {
        const faltando = (resposta.secrets_faltando || []).join(" | ");
        toast.error(
          (resposta.error || "Envio de e-mail nao configurado no backend.") +
            (faltando ? " Secrets: " + faltando : ""),
        );
      } else {
        toast.error(resposta.error || "Falha ao enviar o e-mail.");
      }
    } finally {
      setEnviandoEmailId(null);
    }
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
  const numeroCampo = function(valor: string): number {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
  };
  const totalRetencoesForm = numeroCampo(gerarForm.ret_pis) +
    numeroCampo(gerarForm.ret_cofins) + numeroCampo(gerarForm.ret_csll) +
    numeroCampo(gerarForm.ret_irrf) + numeroCampo(gerarForm.ret_inss);
  const valorLiquidoFinal = Math.max(
    0,
    (gerarForm.valor_servico || 0) - (gerarForm.valor_desconto || 0) - totalRetencoesForm,
  );
  const valorTravadoPelaOrigem = gerarForm.origem !== "avulso";
  const termoBuscaOrigem = buscaOrigem.trim().toLowerCase();
  const origensFiltradas = termoBuscaOrigem
    ? origens.filter(function(o) {
      return ((o.numero || "") + " " + o.cliente_nome).toLowerCase().includes(termoBuscaOrigem);
    })
    : origens;
  const codigosNacionais = montarCodigosNacionais(codigosServico);

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
                  <p className="text-xs text-muted-foreground">
                    CNPJ {MATRIZ_NFSE_CNPJ_FORMATADO} | IM {gerarForm.emitente_im || "-"} | Regime {gerarForm.emitente_regime || "-"}
                  </p>
                </div>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 sm:ml-auto">
                  Matriz oficial
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Municipio de emissao (IBGE)</Label>
                  <Input value={gerarForm.municipio_ibge || "3550308"} readOnly className="bg-slate-50" />
                </div>
                <div>
                  <Label>Data de Competência</Label>
                  <Input
                    type="date"
                    value={gerarForm.competencia_data}
                    onChange={function(e) {
                      setGerarForm(function(p) { return { ...p, competencia_data: e.target.value }; });
                    }}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Padrao: hoje em America/Sao_Paulo. Vai para a tag dCompet da DPS.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Codigo nacional, complementar municipal e NBS ficam centralizados no Passo 4 (Tributacao).
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

              <label className="flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3 text-xs">
                <Checkbox
                  checked={gerarForm.enviar_email_tomador}
                  onCheckedChange={function(v) {
                    setGerarForm(function(p) { return { ...p, enviar_email_tomador: v === true }; });
                  }}
                  className="mt-0.5"
                />
                <span className="text-slate-700">
                  Enviar PDF + XML automaticamente para o e-mail do tomador apos autorizacao.
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">Preferencia salva na nota para uso no pos-emissao.</span>
                </span>
              </label>

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
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Label>{gerarForm.tomador_tipo_documento === "cpf" ? "CPF do Tomador" : "CNPJ do Tomador"}</Label>
                    <div className="inline-flex overflow-hidden rounded-md border border-slate-200">
                      {(["cnpj", "cpf"] as const).map(function(tipo) {
                        const ativo = gerarForm.tomador_tipo_documento === tipo;
                        return (
                          <button
                            key={tipo}
                            type="button"
                            onClick={function() {
                              setGerarForm(function(p) {
                                return {
                                  ...p,
                                  tomador_tipo_documento: tipo,
                                  tomador_cnpj: tipo === "cnpj" ? p.tomador_cnpj : "",
                                  tomador_cpf: tipo === "cpf" ? p.tomador_cpf : "",
                                };
                              });
                              setErroConsultaCnpj("");
                              ultimoCnpjConsultadoRef.current = "";
                            }}
                            className={"px-2.5 py-1 text-[10px] font-bold uppercase " + (ativo ? "bg-violet-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50")}
                          >
                            {tipo}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={gerarForm.tomador_tipo_documento === "cpf" ? gerarForm.tomador_cpf : gerarForm.tomador_cnpj}
                      onChange={function(e) {
                        const valor = formatarCpfCnpj(e.target.value);
                        const campo = gerarForm.tomador_tipo_documento === "cpf" ? "tomador_cpf" : "tomador_cnpj";
                        setGerarForm(function(p) { return { ...p, [campo]: valor }; });
                      }}
                      placeholder={gerarForm.tomador_tipo_documento === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                    />
                    {gerarForm.tomador_tipo_documento === "cnpj" && (
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
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {gerarForm.tomador_tipo_documento === "cpf"
                      ? "CPF com 11 digitos. Nao ha consulta automatica para CPF."
                      : "Digite o CNPJ (consulta automatica ao completar 14 digitos) ou use Buscar CNPJ."}
                  </p>
                  {erroConsultaCnpj && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
                      <AlertCircle className="h-3 w-3" /> {erroConsultaCnpj}
                    </p>
                  )}
                  <div className="mt-2">
                    <Label>IM do Tomador (opcional)</Label>
                    <Input
                      value={gerarForm.tomador_im}
                      onChange={function(e) {
                        setGerarForm(function(p) { return { ...p, tomador_im: e.target.value.replace(/\D/g, "").slice(0, 15) }; });
                      }}
                      placeholder="Inscricao municipal do tomador"
                    />
                  </div>
                </div></div>

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
                <div className="flex items-center justify-between">
                  <Label>Descricao do Servico</Label>
                  <span className="text-[10px] text-muted-foreground">{gerarForm.descricao_servico.length}/2000</span>
                </div>
                <Textarea
                  value={gerarForm.descricao_servico}
                  onChange={function(e) {
                    setGerarForm(function(p) { return { ...p, descricao_servico: e.target.value.slice(0, 2000) }; });
                  }}
                  rows={4}
                  maxLength={2000}
                  className="mt-1 min-h-[110px] resize-y"
                  placeholder="Detalhe a prestacao: numero da OS, romaneio, periodo, placa e demais informacoes."
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Multilinha (ate 2000 caracteres). Vai para xDescServ na DPS.
                </p>
              </div>

              <div>
                <Label>Nº Pedido de Compra (PO) / Informações Complementares (opcional)</Label>
                <Input
                  value={gerarForm.pedido_compra}
                  onChange={function(e) {
                    setGerarForm(function(p) { return { ...p, pedido_compra: e.target.value }; });
                  }}
                  maxLength={2000}
                  placeholder="Ex.: PO-12345 / Romaneio 67890 / Periodo 01-15/11"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Quando preenchido, vai como xInfComp em serv/infoCompl (sem alterar a descricao do servico).
                </p>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="nfse-codigo-servico">Código Nacional</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label="Ajuda sobre o codigo de servico" className="rounded p-0.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground">
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Código de tributação nacional do ISSQN (6 dígitos, LC 116/2003).
                        Padrão da operação: 16.02.01.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mt-1">
                    <CodigoCombobox
                      id="nfse-codigo-servico"
                      value={gerarForm.codigo_nacional}
                      options={codigosNacionais}
                      placeholder="Ex.: 16.02.01"
                      vazioTexto="Nenhum código na lista. Você pode digitar manualmente."
                      rodapeTexto="Código nacional do ISSQN (6 dígitos)."
                      onChangeValue={function(valor) {
                        setGerarForm(function(p) {
                          return {
                            ...p,
                            codigo_nacional: valor,
                            codigo_servico: comporCodigoServico(valor, p.codigo_complementar),
                          };
                        });
                      }}
                      onSelectOption={selecionarCodigoNacional}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="nfse-codigo-complementar">Código Complementar Municipal</Label>
                  <Input
                    id="nfse-codigo-complementar"
                    value={gerarForm.codigo_complementar}
                    inputMode="numeric"
                    maxLength={3}
                    placeholder="002"
                    className="mt-1 font-mono"
                    onChange={function(e) {
                      const valor = e.target.value.replace(/\D/g, "").slice(0, 3);
                      setGerarForm(function(p) {
                        return {
                          ...p,
                          codigo_complementar: valor,
                          codigo_servico: comporCodigoServico(p.codigo_nacional, valor),
                        };
                      });
                    }}
                  />
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

              <details className="rounded-lg border border-slate-200 bg-slate-50/30">
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-700">
                  Retenções Federais (opcional)
                  <span className="ml-2 text-[10px] font-normal text-muted-foreground">Somente valores &gt; 0 entram no XML</span>
                </summary>
                <div className="grid grid-cols-2 gap-3 border-t p-3 sm:grid-cols-5">
                  {([
                    { campo: "ret_pis", label: "PIS" },
                    { campo: "ret_cofins", label: "COFINS" },
                    { campo: "ret_csll", label: "CSLL" },
                    { campo: "ret_irrf", label: "IRRF" },
                    { campo: "ret_inss", label: "INSS" },
                  ] as Array<{ campo: "ret_pis" | "ret_cofins" | "ret_csll" | "ret_irrf" | "ret_inss"; label: string }>).map(function(item) {
                    return (
                      <div key={item.campo}>
                        <Label className="text-[11px]">{item.label} (R$)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={gerarForm[item.campo]}
                          onChange={function(e) {
                            setGerarForm(function(p) { return { ...p, [item.campo]: e.target.value }; });
                          }}
                          placeholder="0,00"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Total retenções: <strong className="text-slate-800">{fmtFin(totalRetencoesForm)}</strong></span>
                  <span className="text-muted-foreground">Valor líquido final: <strong className="text-emerald-700">{fmtFin(valorLiquidoFinal)}</strong></span>
                </div>
              </details>

              <details className="rounded-lg border border-slate-200 bg-slate-50/30">
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-700">
                  Configurações Avançadas (opcional)
                </summary>
                <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
                  <div>
                    <Label>Exigibilidade do ISS</Label>
                    <Select
                      value={gerarForm.exigibilidade_iss}
                      onValueChange={function(v: string) {
                        setGerarForm(function(p) { return { ...p, exigibilidade_iss: v }; });
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tributavel">Tributavel (padrao)</SelectItem>
                        <SelectItem value="imunidade">Imunidade</SelectItem>
                        <SelectItem value="nao_incidencia">Não incidência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tributos Aproximados / Lei 12.741 (opcional)</Label>
                    <div className="flex gap-2">
                      <Select
                        value={gerarForm.tributos_aprox_tipo}
                        onValueChange={function(v: string) {
                          setGerarForm(function(p) {
                            return { ...p, tributos_aprox_tipo: v === "valor" ? "valor" : "percentual" };
                          });
                        }}
                      >
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentual">%</SelectItem>
                          <SelectItem value="valor">R$</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={gerarForm.tributos_aprox_valor}
                        onChange={function(e) {
                          setGerarForm(function(p) { return { ...p, tributos_aprox_valor: e.target.value }; });
                        }}
                        placeholder="0,00"
                        className="flex-1"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Simples: % vira pTotTribSN. Demais: % vira pTotTrib e R$ vira vTotTrib.
                    </p>
                  </div>
                </div>
              </details>

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

              <div className="flex flex-wrap items-center gap-2">
                <Badge className={String(gerarForm.ambiente || "").toLowerCase().startsWith("prod") ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}>
                  {String(gerarForm.ambiente || "").toLowerCase().startsWith("prod") ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}
                </Badge>
                <span className="text-xs text-muted-foreground">Ambiente da emissao</span>
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
                  <p className="text-xs text-muted-foreground">
                    {gerarForm.tomador_tipo_documento === "cpf"
                      ? (formatarCpfCnpj(gerarForm.tomador_cpf) || "—")
                      : (formatarCpfCnpj(gerarForm.tomador_cnpj) || "—")}
                  </p>
                  <p className="text-xs text-muted-foreground">IM: {gerarForm.tomador_im || "—"}</p>
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
                  <p className="text-sm">{gerarForm.descricao_servico || DESCRICAO_SERVICO_PADRAO}</p>
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
              <div className="rounded-lg border p-3 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Competência / PO / Retenções</p>
                  <div className="mt-1 grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Data de Competência</p>
                      <p className="font-semibold">{formatarDataBR(gerarForm.competencia_data) || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Pedido de Compra</p>
                      <p className="font-semibold">{gerarForm.pedido_compra || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Retencoes</p>
                      <p className="font-semibold">{totalRetencoesForm > 0 ? fmtFin(totalRetencoesForm) : "Nao informadas"}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-emerald-700">Valor Líquido Final: {fmtFin(valorLiquidoFinal)}</p>
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
                  {gerarForm.tomador_nome && (gerarForm.tomador_cnpj || gerarForm.tomador_cpf)
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  Tomador e documento
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
      selectedNfse.pdf_url || metaDetalhe.pdf_oficial_path ||
        documentosStorage.danfse_oficial || documentosStorage.danfse_pdf ||
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
      : "Baixar o PDF oficial da DANFSe (fonte ADN)";

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
            <Badge
              variant="outline"
              className={
                "text-xs " +
                (statusLower === "cancelada"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-blue-200 bg-blue-50 text-blue-700")
              }
            >
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
            {statusLower === "emitida" && (
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={abrirCancelamento}
                disabled={cancelando}
                title="Cancelar a NFS-e na Sefin (evento e101101)"
              >
                <XCircle className="w-4 h-4 mr-2" /> Cancelar NFS-e
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
                onClick={function() { void baixarPdfOficial(selectedNfse); }}
                disabled={pdfOficialDisabled || abrindoPdfOficialId === selectedNfse.id}
                title={pdfOficialTitle}
              >
                {abrindoPdfOficialId === selectedNfse.id
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <FileText className="w-4 h-4 mr-2" />}
                Baixar DANFSe Oficial
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
              {(statusLower === "emitida" || statusLower === "cancelada") && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={function() { void reenviarEmailNfse(selectedNfse); }}
                  disabled={enviandoEmailId === selectedNfse.id}
                  title="Enviar XML e DANFSe por e-mail ao tomador"
                >
                  {enviandoEmailId === selectedNfse.id
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Mail className="w-4 h-4 mr-2" />}
                  Reenviar por E-mail
                </Button>
              )}
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

        <Dialog
          open={showCancelamento}
          onOpenChange={function(aberto) { if (!aberto) fecharCancelamento(); }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" /> Cancelar NFS-e
              </DialogTitle>
              <DialogDescription>
                Registra o evento oficial de cancelamento (e101101) na Sefin.
                Esta acao e irreversivel.
              </DialogDescription>
            </DialogHeader>
            {(() => {
              const metaSel = (selectedNfse.metadata || {}) as Record<string, any>;
              const ambienteSel = String(metaSel.emissao?.ambiente || "").toLowerCase();
              const ehProducaoSel = ambienteSel.startsWith("prod") || ambienteSel === "1";
              const justificativaLen = Array.from(cancelJustificativa.trim()).length;
              const justificativaValida = justificativaLen >= 15 && justificativaLen <= 255;
              return (
                <div className="space-y-4">
                  <div className="space-y-1 rounded-lg border bg-slate-50 p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Nota</span>
                      <span className="font-semibold">{selectedNfse.numero || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Tomador</span>
                      <span className="text-right font-medium">{metaSel.tomador?.nome || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Valor</span>
                      <span className="font-medium">{fmtFin(selectedNfse.valor)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Ambiente</span>
                      <span className={ehProducaoSel ? "font-bold text-red-700" : "font-medium text-amber-700"}>
                        {ehProducaoSel ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}
                      </span>
                    </div>
                  </div>
                  {ehProducaoSel ? (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Esta nota e de <strong>PRODUÇÃO</strong> (valor fiscal). O
                        cancelamento na Sefin e definitivo.
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      Nota de homologação (ambiente de produção restrita).
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Motivo oficial</Label>
                    <Select
                      value={cancelMotivo}
                      onValueChange={function(valor) { setCancelMotivo(valor as MotivoCancelamentoNfse); }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOTIVOS_CANCELAMENTO_NFSE.map(function(opcao) {
                          return (
                            <SelectItem key={opcao.valor} value={opcao.valor}>
                              {opcao.valor} - {opcao.rotulo}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Justificativa</Label>
                      <span className={"text-xs " + (justificativaValida ? "text-muted-foreground" : "text-red-600")}>
                        {justificativaLen}/255
                      </span>
                    </div>
                    <Textarea
                      value={cancelJustificativa}
                      onChange={function(e) { setCancelJustificativa(e.target.value); }}
                      rows={4}
                      maxLength={255}
                      placeholder="Descreva o motivo do cancelamento (15 a 255 caracteres)."
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Mínimo de 15 caracteres. A justificativa é enviada à Sefin.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={fecharCancelamento} disabled={cancelando}>
                      Voltar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={confirmarCancelamento}
                      disabled={cancelando || !justificativaValida}
                    >
                      {cancelando
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelando...</>
                        : <><XCircle className="mr-2 h-4 w-4" /> Confirmar cancelamento</>}
                    </Button>
                  </DialogFooter>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">NFS-e</h2><p className="text-muted-foreground text-sm">Nota Fiscal de Servico Eletronica.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            value={mesExportacao}
            onChange={function(e) { setMesExportacao(e.target.value); }}
            className="h-9 w-40"
            aria-label="Mes e ano para exportacao"
            title="Mes/Ano para exportacao do ZIP mensal"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={function() { void exportarMesZip(); }}
            disabled={exportandoMes}
            title="Exportar NFS-e do mes em ZIP (XML, cancelamentos, PDF e resumo CSV)"
          >
            {exportandoMes
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Download className="w-4 h-4 mr-2" />}
            {exportandoMes ? "Gerando ZIP..." : "Exportar Mes (ZIP)"}
          </Button>
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
                        <TableCell><Badge variant="outline" className={statusNfse === "cancelada" ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}>{n.status}</Badge></TableCell>
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
