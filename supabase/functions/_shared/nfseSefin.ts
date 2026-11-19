// ===================================================================
// _shared/nfseSefin.ts
//
// Transmissao mTLS do XML assinado para a API do Emissor Nacional
// (Sefin/ADN) e normalizacao da resposta (sucesso/rejeicao).
//
// Endpoint por secret:
//   NFSE_SEFIN_URL            (override geral)
//   NFSE_SEFIN_URL_PRODUCAO
//   NFSE_SEFIN_URL_HOMOLOGACAO
//   NFSE_SEFIN_CA_PEM         (opcional: CA do servidor Sefin, PEM)
//   NFSE_SEFIN_PROXY_URL      (opcional: proxy Vercel em gru1)
//   NFSE_SEFIN_PROXY_TOKEN    (opcional: token x-proxy-token do proxy)
//
// mTLS: se o proxy estiver configurado, envia por ele (IP Brasil).
// Caso contrario, tenta `Deno.createHttpClient` + fetch e, se falhar,
// usa `node:https` com cert/key e rejectUnauthorized: true.
// ===================================================================
import * as https from "node:https";

export interface MaterialTls {
  keyPem: string;
  chainPem: string;
}

export interface RespostaSefin {
  ok: boolean;
  httpStatus: number;
  idDps: string | null;
  chaveAcesso: string | null;
  numero: string | null;
  protocolo: string | null;
  xmlUrl: string | null;
  pdfUrl: string | null;
  codigoRejeicao: string | null;
  mensagemRejeicao: string | null;
  xmlRetorno: string | null;
  corpoResumo: string;
  json: Record<string, unknown> | null;
}

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) {
    bin += String.fromCharCode(...bytes.subarray(i, i + bloco));
  }
  return btoa(bin);
}

function base64ParaBytes(texto: string): Uint8Array<ArrayBuffer> {
  const bin = atob(texto);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function comprimirGzipBase64(texto: string): Promise<string> {
  const textoBytes = new TextEncoder().encode(texto);
  const entrada = new Uint8Array(new ArrayBuffer(textoBytes.length));
  entrada.set(textoBytes);
  const stream = new Blob([entrada]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  const comprimido = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesParaBase64(comprimido);
}

async function descomprimirGzipBase64(valor: string): Promise<string> {
  const bytes = base64ParaBytes(valor);
  const stream = new Blob([bytes]).stream().pipeThrough(
    new DecompressionStream("gzip"),
  );
  return await new Response(stream).text();
}

function extrairTagXml(xml: string, tag: string): string | null {
  const regex = new RegExp(
    `<(?:\\w+:)?${tag}[^>]*>([^<]+)<\\/(?:\\w+:)?${tag}>`,
    "i",
  );
  return xml.match(regex)?.[1]?.trim() || null;
}

function extrairErrosSefin(
  valor: unknown,
): { codigo: string | null; mensagem: string | null } {
  const codigos: string[] = [];
  const mensagens = new Set<string>();
  const chavesConhecidas = [
    "codigo",
    "code",
    "id",
    "descricao",
    "mensagem",
    "message",
    "detail",
    "title",
    "status",
    "type",
    "instance",
  ];

  const visitar = function(item: unknown, chave?: string) {
    if (item === null || item === undefined) return;

    if (typeof item === "string") {
      const textoItem = item.trim();
      if (textoItem) {
        mensagens.add(chave ? `${chave}: ${textoItem}` : textoItem);
      }
      return;
    }
    if (typeof item === "number" || typeof item === "boolean") {
      mensagens.add(String(item));
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(function(valorItem) { visitar(valorItem, chave); });
      return;
    }

    const obj = objeto(item);
    if (!obj) return;

    const codigo = buscarCampo([obj], ["codigo", "code", "id"]);
    const mensagem = buscarCampo(
      [obj],
      ["descricao", "mensagem", "message", "detail", "title"],
    );

    if (codigo) codigos.push(codigo);
    if (mensagem) {
      mensagens.add(codigo ? `${codigo} - ${mensagem}` : mensagem);
    } else if (codigo) {
      mensagens.add(codigo);
    }

    // ASP.NET pode devolver { errors: { Campo: ["msg"] } }.
    for (const [nome, conteudo] of Object.entries(obj)) {
      if (chavesConhecidas.includes(nome)) continue;
      if (
        conteudo === null || conteudo === undefined ||
        typeof conteudo === "string" || typeof conteudo === "object"
      ) {
        visitar(conteudo, chave ? `${chave}.${nome}` : nome);
      }
    }
  };

  visitar(valor);

  return {
    codigo: codigos[0] || null,
    mensagem: mensagens.size ? Array.from(mensagens).join("; ") : null,
  };
}

function extrairErrosXml(
  xml: string,
): { codigo: string | null; mensagem: string | null } {
  const codigo = extrairTagXml(xml, "Codigo") ||
    extrairTagXml(xml, "codigo") ||
    extrairTagXml(xml, "Code");
  const descricao = extrairTagXml(xml, "Descricao") ||
    extrairTagXml(xml, "descricao") ||
    extrairTagXml(xml, "Mensagem") ||
    extrairTagXml(xml, "mensagem") ||
    extrairTagXml(xml, "Message");

  return {
    codigo,
    mensagem: descricao
      ? (codigo ? `${codigo} - ${descricao}` : descricao)
      : null,
  };
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return null;
}

function buscarCampo(
  objetos: Record<string, unknown>[],
  chaves: string[],
): string | null {
  for (const obj of objetos) {
    for (const chave of chaves) {
      const valor = texto(obj[chave]);
      if (valor) return valor;
    }
  }
  return null;
}

async function analisarResposta(
  httpStatus: number,
  corpo: string,
  json: unknown,
): Promise<RespostaSefin> {
  const raiz = objeto(json);
  const objetos = [
    raiz,
    objeto(raiz?.["nfse"]),
    objeto(raiz?.["nota"]),
    objeto(raiz?.["resultado"]),
    objeto(raiz?.["dps"]),
  ].filter((o): o is Record<string, unknown> => Boolean(o));

  let chaveAcesso = buscarCampo(objetos, [
    "chaveAcesso",
    "chave_acesso",
    "chave",
    "codigoVerificacao",
  ]);
  let numero = buscarCampo(objetos, [
    "numero",
    "numeroNfse",
    "numero_nfse",
    "nNFSe",
    "nNfse",
  ]);
  const protocolo = buscarCampo(objetos, [
    "protocolo",
    "numeroProtocolo",
    "protocoloNfse",
  ]);
  const xmlUrl = buscarCampo(objetos, [
    "xmlUrl",
    "urlXml",
    "linkXml",
    "url_xml",
  ]);
  const pdfUrl = buscarCampo(objetos, [
    "pdfUrl",
    "urlPdf",
    "linkPdf",
    "url_pdf",
    "danfseUrl",
  ]);

  const httpOk = httpStatus >= 200 && httpStatus < 300;
  const sucessoFlag = raiz?.["sucesso"] ?? raiz?.["success"];

  const containersErro = [
    Array.isArray(json) ? json : null,
    raiz?.["erros"],
    raiz?.["erro"],
    raiz?.["errors"],
    raiz?.["mensagens"],
    raiz?.["rejeicao"],
    raiz?.["falha"],
  ].filter((valor) => {
    if (valor === undefined || valor === null || valor === "") return false;
    if (Array.isArray(valor) && valor.length === 0) return false;
    if (
      valor && typeof valor === "object" && !Array.isArray(valor) &&
      Object.keys(valor).length === 0
    ) {
      return false;
    }
    return true;
  });

  const temContainerErro = containersErro.length > 0;
  const podeTerMensagemAmpla = !httpOk || temContainerErro ||
    sucessoFlag === false;

  const fontesErro = [
    ...containersErro,
    ...(podeTerMensagemAmpla
      ? [
        raiz?.["mensagem"],
        raiz?.["descricao"],
        raiz?.["title"],
        raiz?.["detail"],
      ]
      : []),
  ].filter((valor) => valor !== undefined && valor !== null && valor !== "");

  let codigo: string | null = null;
  const mensagensErro = new Set<string>();

  for (const fonte of fontesErro) {
    const parcial = extrairErrosSefin(fonte);
    if (!codigo && parcial.codigo) codigo = parcial.codigo;
    if (parcial.mensagem) mensagensErro.add(parcial.mensagem);
  }

  let mensagem: string | null = mensagensErro.size
    ? Array.from(mensagensErro).join("; ")
    : null;

  if (!mensagem && podeTerMensagemAmpla) {
    const xmlErro = extrairErrosXml(corpo);
    if (!codigo && xmlErro.codigo) codigo = xmlErro.codigo;
    if (xmlErro.mensagem) mensagem = xmlErro.mensagem;
  }

  if (!codigo) {
    codigo = buscarCampo(objetos, ["codigoRejeicao", "codigo_rejeicao"]);
  }
  if (!mensagem) {
    mensagem = buscarCampo(objetos, [
      "mensagemRejeicao",
      "mensagem_rejeicao",
      "detail",
    ]);
  }

  const temErro = Boolean(
    codigo || mensagem || temContainerErro || sucessoFlag === false,
  );
  const ok = httpOk && !temErro;

  if (!ok && !mensagem) {
    const trecho = corpo.replace(/\s+/g, " ").trim().slice(0, 600);
    mensagem = trecho
      ? `HTTP ${httpStatus}: ${trecho}`
      : `HTTP ${httpStatus}`;
  }

  const xmlGzipB64 = buscarCampo(objetos, [
    "nfseXmlGZipB64",
    "nfseXmlGzipB64",
    "xmlGZipB64",
    "nfseXmlGzip",
  ]);

  let xmlRetorno: string | null = null;
  if (xmlGzipB64) {
    try {
      xmlRetorno = await descomprimirGzipBase64(xmlGzipB64);
    } catch (erro) {
      console.warn(
        "[nfseSefin] Falha ao descomprimir nfseXmlGZipB64:",
        erro instanceof Error ? erro.message.slice(0, 200) : "erro",
      );
    }
  }
  if (!xmlRetorno) {
    xmlRetorno = /^\s*</.test(corpo) && !/<html/i.test(corpo) ? corpo : null;
  }

  if (!chaveAcesso && xmlRetorno) {
    chaveAcesso = extrairTagXml(xmlRetorno, "chaveAcesso") ||
      extrairTagXml(xmlRetorno, "chaveAcessoNFSe");
  }
  if (!numero && xmlRetorno) {
    numero = extrairTagXml(xmlRetorno, "nNFSe") ||
      extrairTagXml(xmlRetorno, "numeroNfse") ||
      extrairTagXml(xmlRetorno, "numero");
  }

  const idDps = buscarCampo(objetos, ["idDps", "id_dps"]);

  return {
    ok,
    httpStatus,
    idDps,
    chaveAcesso,
    numero,
    protocolo,
    xmlUrl,
    pdfUrl,
    codigoRejeicao: ok ? null : codigo,
    mensagemRejeicao: ok ? null : (mensagem || "Rejeicao sem detalhe."),
    xmlRetorno,
    corpoResumo: corpo.slice(0, 1200),
    json: raiz,
  };
}

interface RespostaHttp {
  status: number;
  corpo: string;
}

/** Erro de transporte sanitizado (sem chave/certificado/senha). */
export class SefinComunicacaoError extends Error {
  readonly detalhe: string;

  constructor(detalhe: string) {
    super(`Falha de comunicacao mTLS com a Sefin (${detalhe}).`);
    this.name = "SefinComunicacaoError";
    this.detalhe = detalhe;
  }
}

function resumoSeguro(erro: unknown): string {
  const bruto = erro instanceof Error
    ? `${erro.name}: ${erro.message}`
    : String(erro);
  return bruto.replace(/\s+/g, " ").slice(0, 280);
}

function normalizarEndpointSefin(endpoint: string): string {
  const limpo = String(endpoint || "").trim();
  // Evita duplicacao acidental: /nfse/nfse ou /dps/dps no final.
  return limpo.replace(/(\/(?:nfse|dps))\/?\1\/?$/i, "$1");
}

function validarEndpointSefin(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(normalizarEndpointSefin(endpoint));
  } catch {
    throw new SefinComunicacaoError(
      "endpoint Sefin invalido (URL malformada em NFSE_SEFIN_URL_HOMOLOGACAO/PRODUCAO)",
    );
  }
  if (url.protocol !== "https:") {
    throw new SefinComunicacaoError(
      `endpoint Sefin invalido (protocolo ${url.protocol}; esperado https:)`,
    );
  }
  if (!url.hostname) {
    throw new SefinComunicacaoError("endpoint Sefin invalido (hostname ausente)");
  }
  return url;
}

function lerCaSefin(): string | undefined {
  const ca = Deno.env.get("NFSE_SEFIN_CA_PEM")?.trim();
  return ca || undefined;
}

interface ConfigProxySefin {
  url: string;
  token: string;
}

function obterProxySefin(): ConfigProxySefin | null {
  const url = Deno.env.get("NFSE_SEFIN_PROXY_URL")?.trim();
  const token = Deno.env.get("NFSE_SEFIN_PROXY_TOKEN")?.trim();

  if (!url && !token) return null;
  if (!url || !token) {
    throw new SefinComunicacaoError(
      "NFSE_SEFIN_PROXY_URL e NFSE_SEFIN_PROXY_TOKEN devem ser configurados juntos",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SefinComunicacaoError(
      "NFSE_SEFIN_PROXY_URL invalida (URL malformada)",
    );
  }
  if (parsed.protocol !== "https:") {
    throw new SefinComunicacaoError(
      "NFSE_SEFIN_PROXY_URL deve usar https://",
    );
  }

  return { url: parsed.toString(), token };
}

async function respostaComJson(
  status: number,
  corpo: string,
): Promise<RespostaSefin> {
  let json: unknown = null;
  try {
    json = JSON.parse(corpo);
  } catch {
    json = null;
  }
  return await analisarResposta(status, corpo, json);
}

interface CorpoSefin {
  body: string;
  headers: Record<string, string>;
}

/** Contrato oficial: DPS em GZip+Base64 dentro de JSON. */
async function montarCorpoSefin(xmlAssinado: string): Promise<CorpoSefin> {
  const dpsXmlGZipB64 = await comprimirGzipBase64(xmlAssinado);
  return {
    body: JSON.stringify({ dpsXmlGZipB64 }),
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  };
}

/** Envio via proxy Vercel (regiao gru1) com mTLS do lado do proxy. */
async function postComProxy(
  urlSefin: string,
  corpoSefin: CorpoSefin,
  material: MaterialTls,
  proxy: ConfigProxySefin,
): Promise<RespostaHttp> {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, 25000);
  const ca = lerCaSefin();

  try {
    const resposta = await fetch(proxy.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json",
        "x-proxy-token": proxy.token,
      },
      body: JSON.stringify({
        url: urlSefin,
        method: "POST",
        headers: corpoSefin.headers,
        body: corpoSefin.body,
        cert: material.chainPem,
        key: material.keyPem,
        ...(ca ? { ca } : {}),
      }),
      signal: controller.signal,
    });

    const textoResposta = await resposta.text();
    let json: unknown = null;
    try {
      json = JSON.parse(textoResposta);
    } catch {
      json = null;
    }
    const obj = objeto(json);

    if (!resposta.ok) {
      const detalhe = texto(obj?.["detalhe"]) || texto(obj?.["error"]) ||
        `HTTP ${resposta.status}`;
      throw new Error(`proxy ${detalhe}`);
    }

    if (
      !obj || typeof obj["status"] !== "number" ||
      typeof obj["body"] !== "string"
    ) {
      throw new Error("resposta invalida do proxy");
    }

    return { status: Number(obj["status"]), corpo: String(obj["body"]) };
  } finally {
    clearTimeout(timer);
  }
}

/** Caminho principal: Deno.createHttpClient + fetch. */
async function postComDenoFetch(
  endpoint: string,
  corpoSefin: CorpoSefin,
  material: MaterialTls,
): Promise<RespostaHttp> {
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
  const timer = setTimeout(function() { controller.abort(); }, 15000);

  try {
    const init = {
      method: "POST",
      headers: corpoSefin.headers,
      body: corpoSefin.body,
      client: cliente,
      signal: controller.signal,
    } as unknown as RequestInit;

    const resposta = await fetch(endpoint, init);
    return { status: resposta.status, corpo: await resposta.text() };
  } finally {
    clearTimeout(timer);
    try {
      cliente.close();
    } catch {
      // Ignora falha ao fechar o cliente.
    }
  }
}

/** Fallback: node:https com mTLS (cert/key PEM e CA valida). */
function postComNodeHttps(
  url: URL,
  corpoSefin: CorpoSefin,
  material: MaterialTls,
): Promise<RespostaHttp> {
  return new Promise((resolve, reject) => {
    let finalizado = false;
    let requisicao: ReturnType<typeof https.request> | null = null;

    const concluir = function(acao: () => void) {
      if (finalizado) return;
      finalizado = true;
      acao();
    };
    const sucesso = function(resposta: RespostaHttp) {
      concluir(function() { resolve(resposta); });
    };
    const falhar = function(erro: unknown) {
      concluir(function() {
        reject(erro instanceof Error ? erro : new Error(String(erro)));
      });
    };

    try {
      const corpoBytes = new TextEncoder().encode(corpoSefin.body);
      const ca = lerCaSefin();

      const opcoes = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port ? Number(url.port) : 443,
        path: `${url.pathname || "/"}${url.search}`,
        method: "POST",
        headers: {
          ...corpoSefin.headers,
          "Content-Length": String(corpoBytes.byteLength),
        },
        cert: material.chainPem,
        key: material.keyPem,
        rejectUnauthorized: true,
        servername: url.hostname,
        ...(ca ? { ca } : {}),
      };

      requisicao = https.request(opcoes, (resposta) => {
        const status = resposta.statusCode ?? 0;
        let corpo = "";

        resposta.setEncoding("utf8");
        resposta.on("data", function(parte) {
          corpo += parte;
        });
        resposta.on("end", function() {
          sucesso({ status, corpo });
        });
        resposta.on("error", function(erro) {
          falhar(erro);
        });
        resposta.on("aborted", function() {
          falhar(new Error("resposta da Sefin abortada"));
        });
        resposta.on("close", function() {
          if (!finalizado) {
            falhar(new Error("conexao fechada antes do fim da resposta da Sefin"));
          }
        });
      });

      requisicao.setTimeout(15000);
      requisicao.on("timeout", function() {
        requisicao?.destroy(new Error("timeout na conexao com a Sefin (15s)"));
      });
      requisicao.on("error", function(erro) {
        falhar(erro);
      });
      requisicao.on("close", function() {
        if (!finalizado) {
          falhar(new Error("conexao encerrada antes da resposta da Sefin"));
        }
      });

      requisicao.write(corpoSefin.body);
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
 * Envia o XML assinado com o certificado A1 como agente TLS (mTLS).
 * Com proxy configurado, usa a Vercel (gru1). Sem proxy, tenta Deno.fetch
 * e cai automaticamente para node:https. Erros sanitizados (sem segredos).
 */
export async function transmitirParaSefin(
  xmlAssinado: string,
  material: MaterialTls,
  endpoint: string,
): Promise<RespostaSefin> {
  const url = validarEndpointSefin(endpoint);
  const proxy = obterProxySefin();
  const corpoSefin = await montarCorpoSefin(xmlAssinado);

  if (proxy) {
    try {
      const resposta = await postComProxy(
        url.toString(),
        corpoSefin,
        material,
        proxy,
      );
      return await respostaComJson(resposta.status, resposta.corpo);
    } catch (erro) {
      throw new SefinComunicacaoError(`proxy ${resumoSeguro(erro)}`);
    }
  }

  const detalhes: string[] = [];

  try {
    const resposta = await postComDenoFetch(
      url.toString(),
      corpoSefin,
      material,
    );
    return await respostaComJson(resposta.status, resposta.corpo);
  } catch (erro) {
    detalhes.push(`deno-fetch ${resumoSeguro(erro)}`);
  }

  try {
    const resposta = await postComNodeHttps(url, corpoSefin, material);
    return await respostaComJson(resposta.status, resposta.corpo);
  } catch (erro) {
    detalhes.push(`node-https ${resumoSeguro(erro)}`);
  }

  throw new SefinComunicacaoError(detalhes.join(" | ").slice(0, 500));
}
