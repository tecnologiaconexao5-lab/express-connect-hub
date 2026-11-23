// ===================================================================
// _shared/nfseAdn.ts
//
// Download do DANFSe oficial (PDF) do Ambiente Nacional (ADN) usando
// mTLS com o certificado A1 do emitente.
//
// Endpoints (override por secret):
//   NFSE_ADN_URL            (override geral)
//   NFSE_ADN_URL_PRODUCAO   (default https://adn.nfse.gov.br)
//   NFSE_ADN_URL_HOMOLOGACAO(default https://adn.producaorestrita.nfse.gov.br)
//   NFSE_SEFIN_PROXY_URL / NFSE_SEFIN_PROXY_TOKEN  (proxy Vercel, opcional)
//   NFSE_SEFIN_CA_PEM       (CA do servidor, opcional)
//
// Estrategia: proxy (se configurado), Deno.createHttpClient e node:https
// executados EM PARALELO com um orcamento de tempo compartilhado; a primeira
// resposta valida vence. O erro agregado sempre traz o resultado de cada
// estrategia (sem certificado/senha).
// Retorna apenas PDF valido (magic "%PDF"); nunca lanca excecao para o
// chamador (erros sanitizados, sem certificado/senha).
// ===================================================================
import * as https from "node:https";
import { Buffer } from "node:buffer";

export interface MaterialTlsDanfse {
  keyPem: string;
  chainPem: string;
}

export interface ResultadoDanfseOficial {
  ok: boolean;
  status: number;
  bytes: Uint8Array | null;
  contentType: string | null;
  erro: string | null;
  url: string;
}

interface RespostaDanfseHttp {
  status: number;
  bytes: Uint8Array;
  contentType: string | null;
}

const TIMEOUT_PADRAO_MS = 9000;
const LIMITE_PDF_BYTES = 12 * 1024 * 1024;
const USER_AGENT = "ConexaoExpress-NFSe/1.0 (+https://www.conexaoexpress.com.br)";

/** Trecho seguro do corpo de erro do ADN (sem caracteres de controle). */
function trechoResposta(bytes: Uint8Array | null): string {
  if (!bytes || bytes.length === 0) return "";
  try {
    const texto = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes.subarray(0, 400));
    return texto
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
  } catch {
    return "";
  }
}

function resumoSeguro(erro: unknown, limite = 280): string {
  const bruto = erro instanceof Error
    ? `${erro.name}: ${erro.message}`
    : String(erro);
  return bruto.replace(/\s+/g, " ").slice(0, limite);
}

function lerCaSefin(): string | undefined {
  const ca = Deno.env.get("NFSE_SEFIN_CA_PEM")?.trim();
  return ca || undefined;
}

function baseUrlAdn(ambiente: string): string {
  const geral = Deno.env.get("NFSE_ADN_URL")?.trim();
  if (geral) return geral;

  const producao = Deno.env.get("NFSE_ADN_URL_PRODUCAO")?.trim();
  const homologacao = Deno.env.get("NFSE_ADN_URL_HOMOLOGACAO")?.trim();

  return ambiente.toLowerCase().startsWith("prod")
    ? (producao || "https://adn.nfse.gov.br")
    : (homologacao || "https://adn.producaorestrita.nfse.gov.br");
}

/** Monta a URL oficial do DANFSe por ambiente (chave somente digitos). */
export function urlDanfseOficial(
  chaveAcesso: string,
  ambiente: string,
): string | null {
  const chave = String(chaveAcesso || "").replace(/\D/g, "");
  if (chave.length < 44 || chave.length > 60) return null;
  const base = baseUrlAdn(ambiente).replace(/\/+$/, "");
  return `${base}/danfse/${chave}`;
}

/** Confere se o conteudo comeca com o cabecalho de um PDF ("%PDF"). */
function parecePdf(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 5) return false;
  const limite = Math.min(bytes.length, 1024);
  for (let i = 0; i < limite - 4; i++) {
    if (
      bytes[i] === 0x25 && bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46
    ) {
      return true;
    }
  }
  return false;
}

function base64ParaBytes(texto: string): Uint8Array {
  const bin = atob(texto);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function avaliar(
  url: string,
  resposta: RespostaDanfseHttp,
): ResultadoDanfseOficial {
  const ok = resposta.status >= 200 && resposta.status < 300 &&
    parecePdf(resposta.bytes);
  if (ok) {
    const bytes = resposta.bytes.length > LIMITE_PDF_BYTES
      ? resposta.bytes.subarray(0, LIMITE_PDF_BYTES)
      : resposta.bytes;
    return {
      ok: true,
      status: resposta.status,
      bytes,
      contentType: resposta.contentType,
      erro: null,
      url,
    };
  }
  const trecho = resposta.status >= 400 ? trechoResposta(resposta.bytes) : "";
  const erro = resposta.status >= 200 && resposta.status < 300
    ? `resposta ${resposta.status} sem PDF (content-type ${
      resposta.contentType || "desconhecido"
    })`
    : `HTTP ${resposta.status}${trecho ? ` - ${trecho}` : ""}`;
  return {
    ok: false,
    status: resposta.status,
    bytes: null,
    contentType: resposta.contentType,
    erro,
    url,
  };
}

interface ConfigProxySefin {
  url: string;
  token: string;
}

function obterProxySefin(): ConfigProxySefin | null {
  const url = Deno.env.get("NFSE_SEFIN_PROXY_URL")?.trim();
  const token = Deno.env.get("NFSE_SEFIN_PROXY_TOKEN")?.trim();
  if (!url || !token) return null;
  return { url, token };
}

/** GET via proxy Vercel (regiao gru1) com resposta do corpo em base64. */
async function getComProxy(
  url: string,
  material: MaterialTlsDanfse,
  proxy: ConfigProxySefin,
  timeoutMs: number,
): Promise<RespostaDanfseHttp> {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  const ca = lerCaSefin();

  try {
    const resposta = await fetch(proxy.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-proxy-token": proxy.token,
      },
      body: JSON.stringify({
        url,
        method: "GET",
        headers: {
          "Accept": "application/pdf",
          "User-Agent": USER_AGENT,
        },
        cert: material.chainPem,
        key: material.keyPem,
        responseEncoding: "base64",
        ...(ca ? { ca } : {}),
      }),
      signal: controller.signal,
    });

    const textoResposta = await resposta.text();
    let json: Record<string, unknown> | null = null;
    try {
      const parseado = JSON.parse(textoResposta);
      json = parseado && typeof parseado === "object" && !Array.isArray(parseado)
        ? parseado as Record<string, unknown>
        : null;
    } catch {
      json = null;
    }

    if (!resposta.ok) {
      const detalhe = typeof json?.["error"] === "string"
        ? json["error"]
        : `HTTP ${resposta.status}`;
      throw new Error(`endpoint ${detalhe}`);
    }
    if (
      !json || typeof json["status"] !== "number" ||
      typeof json["body"] !== "string"
    ) {
      throw new Error("resposta invalida do proxy");
    }

    const contentType = typeof json["headers"] === "object" &&
        json["headers"] && !Array.isArray(json["headers"])
      ? (json["headers"] as Record<string, unknown>)["content-type"]
      : null;

    return {
      status: Number(json["status"]),
      bytes: base64ParaBytes(String(json["body"])),
      contentType: typeof contentType === "string" ? contentType : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Caminho principal: Deno.createHttpClient + fetch (mTLS). */
async function getComDenoFetch(
  url: string,
  material: MaterialTlsDanfse,
  timeoutMs: number,
): Promise<RespostaDanfseHttp> {
  const createHttpClient = (Deno as unknown as {
    createHttpClient?: (opcoes: Record<string, unknown>) => {
      close: () => void;
    };
  }).createHttpClient;

  if (typeof createHttpClient !== "function") {
    throw new Error("Deno.createHttpClient indisponivel no runtime");
  }

  const ca = lerCaSefin();
  const cliente = createHttpClient({
    cert: material.chainPem,
    key: material.keyPem,
    ...(ca ? { caCerts: [ca] } : {}),
  });
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, timeoutMs);

  try {
    const init = {
      method: "GET",
      headers: {
        "Accept": "application/pdf",
        "User-Agent": USER_AGENT,
      },
      client: cliente,
      signal: controller.signal,
    } as unknown as RequestInit;

    const resposta = await fetch(url, init);
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    return {
      status: resposta.status,
      bytes,
      contentType: resposta.headers.get("content-type"),
    };
  } finally {
    clearTimeout(timer);
    try {
      cliente.close();
    } catch {
      // Ignora falha ao fechar o cliente.
    }
  }
}

/** Fallback: node:https GET com mTLS e corpo binario. */
function getComNodeHttps(
  url: URL,
  material: MaterialTlsDanfse,
  timeoutMs: number,
): Promise<RespostaDanfseHttp> {
  return new Promise((resolve, reject) => {
    let finalizado = false;
    let requisicao: ReturnType<typeof https.request> | null = null;

    const concluir = function(acao: () => void) {
      if (finalizado) return;
      finalizado = true;
      acao();
    };
    const falhar = function(erro: unknown) {
      concluir(function() {
        reject(erro instanceof Error ? erro : new Error(String(erro)));
      });
    };

    try {
      const ca = lerCaSefin();
      const opcoes = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port ? Number(url.port) : 443,
        path: `${url.pathname || "/"}${url.search}`,
        method: "GET",
        headers: {
          "Accept": "application/pdf",
          "User-Agent": USER_AGENT,
        },
        cert: material.chainPem,
        key: material.keyPem,
        rejectUnauthorized: true,
        servername: url.hostname,
        ...(ca ? { ca } : {}),
      };

      requisicao = https.request(opcoes, (resposta) => {
        const status = resposta.statusCode ?? 0;
        const partes: Buffer[] = [];
        let total = 0;

        resposta.on("data", function(parte) {
          const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
          total += buffer.length;
          if (total > LIMITE_PDF_BYTES) {
            requisicao?.destroy(new Error("PDF oficial acima do limite"));
            return;
          }
          partes.push(buffer);
        });
        resposta.on("end", function() {
          concluir(function() {
            resolve({
              status,
              bytes: new Uint8Array(Buffer.concat(partes)),
              contentType: (resposta.headers["content-type"] as string) || null,
            });
          });
        });
        resposta.on("error", falhar);
        resposta.on("aborted", function() {
          falhar(new Error("resposta do ADN abortada"));
        });
        resposta.on("close", function() {
          if (!finalizado) {
            falhar(new Error("conexao fechada antes do fim da resposta do ADN"));
          }
        });
      });

      requisicao.setTimeout(timeoutMs);
      requisicao.on("timeout", function() {
        requisicao?.destroy(new Error("timeout na conexao com o ADN"));
      });
      requisicao.on("error", falhar);
      requisicao.on("close", function() {
        if (!finalizado) {
          falhar(new Error("conexao encerrada antes da resposta do ADN"));
        }
      });

      requisicao.end();
    } catch (erro) {
      falhar(erro);
      try {
        requisicao?.destroy();
      } catch {
        // Ignora falha ao destruir a requisicao.
      }
    }
  });
}

/**
 * Baixa o DANFSe oficial do ADN por mTLS. Nunca lanca: devolve ok=false
 * com um erro sanitizado quando todas as estrategias falham.
 *
 * As estrategias rodam em paralelo e compartilham o mesmo orcamento de
 * tempo: a primeira que devolver um PDF valido encerra a corrida. Assim o
 * chamador recebe o resultado real de cada estrategia (ou o timeout do
 * orcamento) sem estourar o limite externo.
 */
export async function baixarDanfseOficialAdn(
  chaveAcesso: string,
  ambiente: string,
  material: MaterialTlsDanfse,
  opcoes: { timeoutMs?: number } = {},
): Promise<ResultadoDanfseOficial> {
  const url = urlDanfseOficial(chaveAcesso, ambiente);
  if (!url) {
    return {
      ok: false,
      status: 0,
      bytes: null,
      contentType: null,
      erro: "chave de acesso invalida para o DANFSe",
      url: "",
    };
  }

  const orcamentoMs = Math.max(3000, opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS);

  interface Tentativa {
    nome: string;
    rodar: (tempoMs: number) => Promise<RespostaDanfseHttp>;
  }

  const tentativas: Tentativa[] = [];
  const proxy = obterProxySefin();
  if (proxy) {
    tentativas.push({
      nome: "proxy",
      rodar: (tempoMs) => getComProxy(url, material, proxy, tempoMs),
    });
  }
  tentativas.push({
    nome: "deno-fetch",
    rodar: (tempoMs) => getComDenoFetch(url, material, tempoMs),
  });
  tentativas.push({
    nome: "node-https",
    rodar: (tempoMs) => getComNodeHttps(new URL(url), material, tempoMs),
  });

  return await new Promise<ResultadoDanfseOficial>((resolve) => {
    const detalhes: string[] = [];
    let finalizado = false;
    let pendentes = tentativas.length;
    // Respostas HTTP reais do ADN (>=1) sao definitivas: duas rotas
    // independentes concordando dispensam esperar a terceira pendurar.
    let respostasDefinitivas = 0;
    let statusDefinitivo = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const concluir = (resultado: ResultadoDanfseOficial) => {
      if (finalizado) return;
      finalizado = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(resultado);
    };

    const falhaAgregada = () => {
      concluir({
        ok: false,
        status: statusDefinitivo,
        bytes: null,
        contentType: null,
        erro: (detalhes.length
          ? detalhes.join(" | ")
          : "sem resposta do ADN").slice(0, 500),
        url,
      });
    };

    timer = setTimeout(() => {
      if (!finalizado) {
        detalhes.push(`orcamento de ${orcamentoMs}ms esgotado`);
      }
      falhaAgregada();
    }, orcamentoMs);

    const terminar = () => {
      pendentes -= 1;
      if (pendentes <= 0) falhaAgregada();
    };

    for (const tentativa of tentativas) {
      Promise.resolve()
        .then(() => tentativa.rodar(orcamentoMs))
        .then((resposta) => {
          if (finalizado) return;
          const avaliado = avaliar(url, resposta);
          if (avaliado.ok) {
            concluir(avaliado);
            return;
          }
          detalhes.push(`${tentativa.nome} ${avaliado.erro}`);
          if (avaliado.status > 0) {
            respostasDefinitivas += 1;
            statusDefinitivo = avaliado.status;
          }
          if (respostasDefinitivas >= 2) {
            falhaAgregada();
            return;
          }
          terminar();
        }, (erro) => {
          if (finalizado) return;
          detalhes.push(`${tentativa.nome} ${resumoSeguro(erro, 120)}`);
          terminar();
        });
    }
  });
}
