// ===================================================================
// Vercel Node.js Serverless Function — proxy mTLS para a Sefin Nacional
//
// Executa na região gru1 (São Paulo) para evitar timeouts a partir dos
// EUA. Recebe JSON autenticado por x-proxy-token, valida o destino
// (https + *.nfse.gov.br) e repassa o XML assinado via node:https com
// certificado de cliente.
//
// NUNCA registra em log: cert, key, ca, body ou x-proxy-token.
// ===================================================================
import type { IncomingMessage, ServerResponse } from "node:http";
import * as https from "node:https";
import { timingSafeEqual } from "node:crypto";

export const config = {
  maxDuration: 30,
};

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB (XML + PEM)
const TIMEOUT_MS = 20000;

interface ProxyPayload {
  url?: unknown;
  method?: unknown;
  headers?: unknown;
  body?: unknown;
  cert?: unknown;
  key?: unknown;
  ca?: unknown;
}

interface RespostaProxy {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function responderJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function tokenValido(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido, "utf8");
  const b = Buffer.from(esperado, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function lerCorpo(req: IncomingMessage): Promise<string> {
  const partes: Buffer[] = [];
  let total = 0;

  for await (const parte of req) {
    const buffer = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error("payload muito grande");
    }
    partes.push(buffer);
  }

  return Buffer.concat(partes).toString("utf8");
}

function validarDestino(valor: string): URL {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error("url malformada");
  }

  if (url.protocol !== "https:") {
    throw new Error("url deve usar https");
  }

  const host = url.hostname.toLowerCase();
  if (host !== "nfse.gov.br" && !host.endsWith(".nfse.gov.br")) {
    throw new Error("dominio nao permitido");
  }

  if (url.username || url.password) {
    throw new Error("url com credenciais nao permitida");
  }

  return url;
}

function headersRepasse(headers: unknown): Record<string, string> {
  const resultado: Record<string, string> = {};
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return resultado;
  }

  for (const [chave, valor] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof valor !== "string") continue;
    const nome = chave.toLowerCase();
    if (
      ["host", "content-length", "connection", "transfer-encoding", "x-proxy-token"]
        .includes(nome)
    ) {
      continue;
    }
    resultado[chave] = valor;
  }

  return resultado;
}

function headersResposta(
  headers: IncomingMessage["headers"],
): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(headers)) {
    if (valor === undefined) continue;
    if (
      ["connection", "keep-alive", "transfer-encoding", "content-encoding"]
        .includes(chave.toLowerCase())
    ) {
      continue;
    }
    resultado[chave] = Array.isArray(valor) ? valor.join(", ") : valor;
  }
  return resultado;
}

function requisitarSefin(
  url: URL,
  corpo: string,
  cert: string,
  key: string,
  ca: string,
  headers: Record<string, string>,
): Promise<RespostaProxy> {
  return new Promise((resolve, reject) => {
    let finalizado = false;
    let requisicao: ReturnType<typeof https.request> | null = null;

    const concluir = function(acao: () => void) {
      if (finalizado) return;
      finalizado = true;
      acao();
    };
    const sucesso = function(resposta: RespostaProxy) {
      concluir(function() { resolve(resposta); });
    };
    const falhar = function(erro: unknown) {
      concluir(function() {
        reject(erro instanceof Error ? erro : new Error(String(erro)));
      });
    };

    try {
      const corpoBuffer = Buffer.from(corpo, "utf8");

      const opcoes = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port ? Number(url.port) : 443,
        path: `${url.pathname || "/"}${url.search}`,
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": String(corpoBuffer.length),
        },
        cert,
        key,
        ...(ca ? { ca } : {}),
        rejectUnauthorized: true,
        servername: url.hostname,
      };

      requisicao = https.request(opcoes, (resposta) => {
        const status = resposta.statusCode ?? 0;
        let corpoResposta = "";

        resposta.setEncoding("utf8");
        resposta.on("data", function(parte) {
          corpoResposta += parte;
        });
        resposta.on("end", function() {
          sucesso({
            status,
            headers: headersResposta(resposta.headers),
            body: corpoResposta,
          });
        });
        resposta.on("error", function(erro) {
          falhar(erro);
        });
        resposta.on("aborted", function() {
          falhar(new Error("resposta da Sefin abortada"));
        });
        resposta.on("close", function() {
          if (!finalizado) {
            falhar(new Error("conexao fechada antes do fim da resposta"));
          }
        });
      });

      requisicao.setTimeout(TIMEOUT_MS);
      requisicao.on("timeout", function() {
        requisicao?.destroy(new Error("timeout na Sefin (20s)"));
      });
      requisicao.on("error", function(erro) {
        falhar(erro);
      });
      requisicao.on("close", function() {
        if (!finalizado) {
          falhar(new Error("conexao encerrada antes da resposta"));
        }
      });

      requisicao.write(corpoBuffer);
      requisicao.end();
    } catch (erro) {
      falhar(erro);
      try {
        requisicao?.destroy();
      } catch {
        // Ignora falha ao destruir.
      }
    }
  });
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    responderJson(res, 405, { error: "Metodo nao permitido. Use POST." });
    return;
  }

  const tokenEsperado = (process.env.NFSE_PROXY_TOKEN || "").trim();
  if (!tokenEsperado) {
    responderJson(res, 500, { error: "NFSE_PROXY_TOKEN nao configurado." });
    return;
  }

  const tokenRecebido = String(req.headers["x-proxy-token"] || "").trim();
  if (!tokenRecebido || !tokenValido(tokenRecebido, tokenEsperado)) {
    responderJson(res, 401, { error: "Nao autorizado." });
    return;
  }

  let corpo: string;
  try {
    corpo = await lerCorpo(req);
  } catch {
    responderJson(res, 413, { error: "Payload invalido ou muito grande." });
    return;
  }

  let payload: ProxyPayload;
  try {
    payload = JSON.parse(corpo) as ProxyPayload;
  } catch {
    responderJson(res, 400, { error: "JSON invalido." });
    return;
  }

  const urlTexto = texto(payload.url);
  const metodo = texto(payload.method) || "POST";
  const body = texto(payload.body);
  const cert = texto(payload.cert);
  const key = texto(payload.key);
  const ca = texto(payload.ca);

  if (metodo !== "POST") {
    responderJson(res, 400, { error: "method deve ser POST." });
    return;
  }
  if (!urlTexto || !body || !cert || !key) {
    responderJson(res, 400, {
      error: "url, body, cert e key sao obrigatorios.",
    });
    return;
  }

  let destino: URL;
  try {
    destino = validarDestino(urlTexto);
  } catch (erro) {
    console.error(
      "[nfse-sefin-proxy] Destino rejeitado:",
      erro instanceof Error ? erro.message : "erro",
    );
    responderJson(res, 400, {
      error: "Destino invalido. Apenas https://*.nfse.gov.br.",
    });
    return;
  }

  try {
    const resposta = await requisitarSefin(
      destino,
      body,
      cert,
      key,
      ca,
      headersRepasse(payload.headers),
    );
    responderJson(res, 200, resposta);
  } catch (erro) {
    const detalhe = erro instanceof Error
      ? `${erro.name}: ${erro.message}`
      : "erro desconhecido";
    // Sem cert/key/token/body no log.
    console.error(
      "[nfse-sefin-proxy] Falha mTLS:",
      detalhe.replace(/\s+/g, " ").slice(0, 300),
    );
    responderJson(res, 502, {
      error: "Falha na conexao mTLS com a Sefin.",
      detalhe: detalhe.replace(/\s+/g, " ").slice(0, 300),
    });
  }
}
