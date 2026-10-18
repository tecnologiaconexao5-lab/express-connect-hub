import type { NfeXmlParsed, FiscalDocumentoVinculado, EnderecoRealEntrega } from "@/types/fiscal";
import { supabase } from "@/lib/supabase";

const NFSE_NS = "http://www.portalfiscal.inf.br/nfe";

export interface XmlTipoDetectado {
  tipo: "nfe" | "cte" | "mdfe" | "evento_nfe" | "cancelamento_nfe" | "desconhecido";
  label: string;
  valido: boolean;
}

function findByLocalName(root: Element, name: string): Element | null {
  if (!root) return null;
  const all = root.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === name) return all[i];
  }
  return null;
}

function findByLocalNameNS(root: Element, ns: string, name: string): Element | null {
  if (!root) return null;
  return root.getElementsByTagNameNS(ns, name)[0] || findByLocalName(root, name);
}

function getText(el: Element | null, tag: string): string | null {
  if (!el) return null;
  const child = el.getElementsByTagNameNS(NFSE_NS, tag)[0] || el.getElementsByTagName(tag)[0];
  return child?.textContent?.trim() ?? null;
}

function parseNum(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat((val || "").replace(",", "."));
  return isNaN(n) ? null : n;
}

export function detectarTipoXml(xmlString: string): XmlTipoDetectado {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return { tipo: "desconhecido", label: "XML malformado (erro de sintaxe)", valido: false };
    }

    const root = doc.documentElement;
    if (!root) return { tipo: "desconhecido", label: "XML sem elemento raiz", valido: false };

    const rn = root.localName || root.nodeName || "";

    if (rn === "nfeProc" || rn === "NFe" || findByLocalName(root, "infNFe")) {
      const modelo = findByLocalName(root, "mod")?.textContent?.trim();
      if (modelo === "57") return { tipo: "cte", label: "CT-e (modelo 57) — nao e NF-e", valido: false };
      if (modelo === "55" || !modelo) return { tipo: "nfe", label: "NF-e (modelo 55)", valido: true };
      return { tipo: "nfe", label: `NF-e (modelo ${modelo || "?"})`, valido: true };
    }
    if (rn === "cteProc" || rn === "CTe" || findByLocalName(root, "infCte")) {
      return { tipo: "cte", label: "CT-e", valido: false };
    }
    if (rn === "procEventoNFe" || rn === "evento" || findByLocalName(root, "infEvento")) {
      return { tipo: "evento_nfe", label: "Evento de NF-e (nao e NF-e completa)", valido: false };
    }
    if (rn === "procCancNFe" || rn === "cancNFe" || findByLocalName(root, "infCanc")) {
      return { tipo: "cancelamento_nfe", label: "Cancelamento de NF-e", valido: false };
    }
    if (rn === "mdfeProc" || rn === "MDFe" || findByLocalName(root, "infMDFe")) {
      return { tipo: "mdfe", label: "MDF-e", valido: false };
    }
    return { tipo: "desconhecido", label: "Documento fiscal nao reconhecido", valido: false };
  } catch {
    return { tipo: "desconhecido", label: "Erro ao processar XML", valido: false };
  }
}

function extrairInfCpl(doc: Document): string | null {
  try {
    const infAdic = findByLocalNameNS(doc.documentElement, NFSE_NS, "infAdic");
    if (!infAdic) return null;
    const infCpl = findByLocalNameNS(infAdic, NFSE_NS, "infCpl");
    if (!infCpl) return null;
    const texto = infCpl.textContent?.trim() || null;
    return texto;
  } catch { return null; }
}

function extrairEnderecoDoInfCpl(doc: Document): EnderecoRealEntrega | null {
  const texto = extrairInfCpl(doc);
  if (!texto || texto.length < 15) return null;

  const temMencoEntrega = /entrega|ENTREGA|Entrega|local\s*(de\s*)?entrega|LOCAL\s*(DE\s*)?ENTREGA|destino\s*(real|REAL|Real)/i.test(texto);
  if (!temMencoEntrega) return null;

  const cepMatch = texto.match(/\b(\d{5}-?\d{3})\b/);
  if (!cepMatch) return null;

  const cep = cepMatch[1].replace(/\D/g, "");
  if (cep.length < 8) return null;

  const ufMatch = texto.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/gi);
  const uf = ufMatch ? ufMatch[ufMatch.length - 1].toUpperCase() : null;

  const logMatch =
    texto.match(/(?:AV\.?|AVENIDA|RUA|R\.|ALAMEDA|ESTRADA|ROD\.?|RODOVIA|TRAVESSA|PRACA|PRAÇA)\s+([A-ZÀ-Ú0-9][A-ZÀ-Ú\s\.]+?)(?:\s*,?\s*(?:\d+|S\/N|SN|s\/n))?/gi);
  const logradouro = logMatch ? logMatch[logMatch.length - 1].trim() : null;

  const numMatch = texto.match(/(?:,?\s*(?:n[º°]?|N[º°]?)\s*(\d+[A-Za-z]?|\d+|S\/N|SN))\b/i);
  const numero = numMatch ? numMatch[1] : null;

  const bairroMatch = texto.match(/(?:bairro|Bairro|BAIRRO)[:\s]*([^\n,;]+)/i);
  const bairro = bairroMatch ? bairroMatch[1].trim() : null;

  if (!logradouro && !uf) return null;

  return {
    logradouro: logradouro || null,
    numero: numero || null,
    complemento: null,
    bairro: bairro || null,
    municipio: null,
    uf: uf || null,
    cep: cep || null,
    codigo_ibge: null,
  };
}

export function parseNfeXml(xmlString: string): NfeXmlParsed | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");

    const parseError = doc.querySelector("parsererror");
    if (parseError) return null;

    const infNFe = findByLocalNameNS(doc.documentElement, NFSE_NS, "infNFe");
    if (!infNFe) return null;

    const ide = findByLocalNameNS(infNFe, NFSE_NS, "ide");
    const emit = findByLocalNameNS(infNFe, NFSE_NS, "emit");
    const dest = findByLocalNameNS(infNFe, NFSE_NS, "dest");
    const total = findByLocalNameNS(infNFe, NFSE_NS, "total");
    const transp = findByLocalNameNS(infNFe, NFSE_NS, "transp");

    const detList = infNFe.getElementsByTagNameNS(NFSE_NS, "det");
    const altDet = infNFe.getElementsByTagName("det");
    const dets = detList.length > 0 ? detList : altDet;

    let produtoPredominante: string | null = null;
    if (dets.length > 0) {
      const prod = findByLocalNameNS(dets[0], NFSE_NS, "prod");
      if (prod) produtoPredominante = getText(prod, "xProd");
    }

    const emitenteEnder = findByLocalNameNS(emit, NFSE_NS, "enderEmit");
    const destEnder = findByLocalNameNS(dest, NFSE_NS, "enderDest");
    const icmsTot = findByLocalNameNS(total, NFSE_NS, "ICMSTot");
    const vol = findByLocalNameNS(transp, NFSE_NS, "vol");

    let chave: string | null = null;
    const protNFe = findByLocalNameNS(doc.documentElement, NFSE_NS, "protNFe");
    if (protNFe) {
      const infProt = findByLocalNameNS(protNFe, NFSE_NS, "infProt");
      chave = infProt ? getText(infProt, "chNFe") : null;
    }
    if (!chave) {
      chave = (infNFe.getAttribute("Id") || "").replace("NFe", "") || null;
    }

    return {
      chave_acesso: chave,
      numero: getText(ide, "nNF"),
      serie: getText(ide, "serie"),
      emitente_cnpj: getText(emit, "CNPJ"),
      emitente_nome: getText(emit, "xNome"),
      destinatario_cnpj: getText(dest, "CNPJ"),
      destinatario_nome: getText(dest, "xNome"),
      valor_total: parseNum(getText(icmsTot, "vNF")),
      peso_bruto: parseNum(vol ? getText(vol, "pesoL") : null),
      volumes: vol ? (parseInt(getText(vol, "qVol") ?? "", 10) || null) : null,
      produto_predominante: produtoPredominante,
      municipio_origem: getText(emitenteEnder, "xMun"),
      uf_origem: getText(emitenteEnder, "UF"),
      municipio_destino: getText(destEnder, "xMun"),
      uf_destino: getText(destEnder, "UF"),
      endereco_fiscal_xml: {
        logradouro: getText(destEnder, "xLgr"),
        numero: getText(destEnder, "nro"),
        complemento: getText(destEnder, "xCpl"),
        bairro: getText(destEnder, "xBairro"),
        municipio: getText(destEnder, "xMun"),
        uf: getText(destEnder, "UF"),
        cep: getText(destEnder, "CEP"),
        codigo_ibge: getText(destEnder, "cMun"),
      },
      infCpl: extrairInfCpl(doc),
      endereco_infCpl: extrairEnderecoDoInfCpl(doc),
    };
  } catch { return null; }
}

export interface ImportacaoXmlResultado {
  arquivo: string;
  sucesso: boolean;
  duplicado: boolean;
  numeroNfe: string | null;
  chaveNfe: string | null;
  valorTotal: number | null;
  tipoDetectado: string;
  erro: string | null;
  doc?: FiscalDocumentoVinculado;
}

export async function importarXmlNfe(
  xmlString: string,
  osId?: string | null
): Promise<{ success: boolean; doc?: FiscalDocumentoVinculado; error?: string }> {
  const parsed = parseNfeXml(xmlString);
  if (!parsed) {
    const tipo = detectarTipoXml(xmlString);
    if (!tipo.valido) {
      return { success: false, error: `Tipo detectado: ${tipo.label}` };
    }
    return { success: false, error: "XML invalido ou nao reconhecido como NF-e." };
  }

  // Verificar duplicidade
  if (parsed.chave_acesso) {
    const { data: existente } = await supabase
      .from("fiscal_documentos_vinculados")
      .select("id")
      .eq("chave_acesso", parsed.chave_acesso)
      .limit(1);
    if (existente && existente.length > 0) {
      return { success: false, error: `NF-e ${parsed.numero} ja importada (chave duplicada).` };
    }
  }

  const payload: Record<string, any> = {
    tipo_documento: "NFE",
    chave_acesso: parsed.chave_acesso,
    numero: parsed.numero,
    serie: parsed.serie,
    emitente_cnpj: parsed.emitente_cnpj,
    emitente_nome: parsed.emitente_nome,
    destinatario_cnpj: parsed.destinatario_cnpj,
    destinatario_nome: parsed.destinatario_nome,
    valor_total: parsed.valor_total,
    peso_bruto: parsed.peso_bruto,
    volumes: parsed.volumes,
    produto_predominante: parsed.produto_predominante,
    municipio_origem: parsed.municipio_origem,
    uf_origem: parsed.uf_origem,
    municipio_destino: parsed.municipio_destino,
    uf_destino: parsed.uf_destino,
    xml_original: xmlString,
    status: "aguardando_vinculo",
    metadata: {
      importado_em: new Date().toISOString(),
      origem_importacao: "upload_manual",
      endereco_fiscal_xml: parsed.endereco_fiscal_xml || null,
      fonte_endereco_entrega: parsed.endereco_infCpl ? "xml_infCpl" : "xml",
      divergencia_endereco_xml_romaneio: false,
      pendente_conferencia_endereco: !parsed.endereco_infCpl,
      ...(parsed.endereco_infCpl ? {
        endereco_real_entrega: parsed.endereco_infCpl,
        endereco_infCpl_raw: parsed.infCpl?.slice(0, 2000) || null,
        endereco_infCpl_extraido_em: new Date().toISOString(),
      } : {}),
    },
  };

  if (osId) {
    payload.ordem_servico_id = osId;
    payload.status = "vinculado";
    payload.metadata.os_vinculada = osId;
  }

  const { data, error } = await supabase
    .from("fiscal_documentos_vinculados")
    .insert([payload])
    .select("*")
    .single();

  if (error) {
    return { success: false, error: `Erro ao salvar documento: ${error.message}` };
  }

  return { success: true, doc: data as FiscalDocumentoVinculado };
}

export async function importarMultiplosXmlNfe(files: File[]): Promise<ImportacaoXmlResultado[]> {
  const resultados: ImportacaoXmlResultado[] = [];
  for (const file of files) {
    try {
      const xmlText = await file.text();
      const tipo = detectarTipoXml(xmlText);
      if (!tipo.valido) {
        resultados.push({
          arquivo: file.name, sucesso: false, duplicado: false,
          numeroNfe: null, chaveNfe: null, valorTotal: null,
          tipoDetectado: tipo.label, erro: `Tipo: ${tipo.label}`,
        });
        continue;
      }

      const result = await importarXmlNfe(xmlText, null);
      if (result.success && result.doc) {
        resultados.push({
          arquivo: file.name, sucesso: true, duplicado: false,
          numeroNfe: result.doc.numero || null,
          chaveNfe: result.doc.chave_acesso || null,
          valorTotal: result.doc.valor_total || null,
          tipoDetectado: "NF-e", erro: null, doc: result.doc,
        });
      } else {
        const duplicado = (result.error || "").includes("duplicada");
        resultados.push({
          arquivo: file.name, sucesso: false, duplicado,
          numeroNfe: null, chaveNfe: null, valorTotal: null,
          tipoDetectado: tipo.label,
          erro: result.error || null,
        });
      }
    } catch (err: any) {
      resultados.push({
        arquivo: file.name, sucesso: false, duplicado: false,
        numeroNfe: null, chaveNfe: null, valorTotal: null,
        tipoDetectado: "erro",
        erro: `Erro ao ler arquivo: ${err.message}`,
      });
    }
  }
  return resultados;
}
