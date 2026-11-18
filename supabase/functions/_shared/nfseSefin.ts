// ===================================================================
// _shared/nfseSefin.ts
//
// Transmissao mTLS do XML assinado para a API do Emissor Nacional
// (Sefin/ADN) e normalizacao da resposta (sucesso/rejeicao).
//
// O endpoint e configurado por secret:
//   NFSE_SEFIN_URL            (override geral)
//   NFSE_SEFIN_URL_PRODUCAO
//   NFSE_SEFIN_URL_HOMOLOGACAO
// ===================================================================

export interface MaterialTls {
  keyPem: string;
  chainPem: string;
}

export interface RespostaSefin {
  ok: boolean;
  httpStatus: number;
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

function analisarResposta(
  httpStatus: number,
  corpo: string,
  json: unknown,
): RespostaSefin {
  const raiz = objeto(json);
  const objetos = [
    raiz,
    objeto(raiz?.["nfse"]),
    objeto(raiz?.["nota"]),
    objeto(raiz?.["resultado"]),
    objeto(raiz?.["dps"]),
  ].filter((o): o is Record<string, unknown> => Boolean(o));

  const chaveAcesso = buscarCampo(objetos, [
    "chaveAcesso",
    "chave_acesso",
    "chave",
    "codigoVerificacao",
  ]);
  const numero = buscarCampo(objetos, [
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

  let codigo: string | null = null;
  let mensagem: string | null = null;

  const erroBruto = raiz?.["erros"] ?? raiz?.["erro"] ?? raiz?.["rejeicao"] ??
    raiz?.["falha"];

  if (Array.isArray(erroBruto) && erroBruto.length > 0) {
    const primeiro = objeto(erroBruto[0]);
    if (primeiro) {
      codigo = buscarCampo([primeiro], ["codigo", "code", "id"]);
      mensagem = buscarCampo(
        [primeiro],
        ["mensagem", "message", "descricao", "detail"],
      );
    } else {
      mensagem = texto(erroBruto[0]);
    }
  } else {
    const objErro = objeto(erroBruto);
    if (objErro) {
      codigo = buscarCampo([objErro], ["codigo", "code", "id"]);
      mensagem = buscarCampo(
        [objErro],
        ["mensagem", "message", "descricao", "detail"],
      );
    } else {
      mensagem = texto(erroBruto);
    }
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

  const sucessoFlag = raiz?.["sucesso"] ?? raiz?.["success"];
  const temErro = Boolean(
    codigo ||
      mensagem ||
      (Array.isArray(erroBruto) && erroBruto.length > 0) ||
      sucessoFlag === false,
  );
  const httpOk = httpStatus >= 200 && httpStatus < 300;
  const ok = httpOk && !temErro;

  if (!ok && !mensagem) {
    mensagem = httpOk
      ? "Rejeicao sem mensagem retornada pela Sefin."
      : `HTTP ${httpStatus}`;
  }

  const xmlRetorno = /^\s*</.test(corpo) && !/<html/i.test(corpo)
    ? corpo
    : null;

  return {
    ok,
    httpStatus,
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

/**
 * Envia o XML assinado com o certificado A1 como agente TLS (mTLS).
 * Lanca erro de rede (sem detalhes sensiveis) se a conexao falhar.
 */
export async function transmitirParaSefin(
  xmlAssinado: string,
  material: MaterialTls,
  endpoint: string,
): Promise<RespostaSefin> {
  const cliente = Deno.createHttpClient({
    cert: material.chainPem,
    key: material.keyPem,
  });

  try {
    const init = {
      method: "POST",
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Accept": "application/json, application/xml;q=0.9, */*;q=0.8",
      },
      body: xmlAssinado,
      client: cliente,
    } as RequestInit & { client: Deno.HttpClient };

    const resposta = await fetch(endpoint, init);
    const corpo = await resposta.text();

    let json: unknown = null;
    try {
      json = JSON.parse(corpo);
    } catch {
      json = null;
    }

    return analisarResposta(resposta.status, corpo, json);
  } catch (erro) {
    // Nao incluir corpo/XML/senha — apenas um motivo tecnico curto.
    const motivo = erro instanceof Error ? erro.name : "erro desconhecido";
    throw new Error(`Falha de comunicacao mTLS com a Sefin (${motivo}).`);
  } finally {
    cliente.close();
  }
}
