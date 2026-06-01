import type { NfeXmlParsed, FiscalDocumentoVinculado } from "@/types/fiscal";
import { supabase } from "@/lib/supabase";

const NFSE_NS = "http://www.portalfiscal.inf.br/nfe";

function getText(el: Element | null, tag: string): string | null {
  if (!el) return null;
  const child = el.getElementsByTagNameNS(NFSE_NS, tag)[0]
    || el.getElementsByTagName(tag)[0];
  return child?.textContent?.trim() ?? null;
}

function parseNum(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(",", "."));
  return isNaN(n) ? null : n;
}

export function parseNfeXml(xmlString: string): NfeXmlParsed | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");

    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      console.error("[XmlImport] Erro ao parsear XML:", parseError.textContent);
      return null;
    }

    const infNFe = doc.getElementsByTagNameNS(NFSE_NS, "infNFe")[0]
      || doc.getElementsByTagName("infNFe")[0];
    if (!infNFe) return null;

    const ide = infNFe.getElementsByTagNameNS(NFSE_NS, "ide")[0]
      || infNFe.getElementsByTagName("ide")[0];
    const emit = infNFe.getElementsByTagNameNS(NFSE_NS, "emit")[0]
      || infNFe.getElementsByTagName("emit")[0];
    const dest = infNFe.getElementsByTagNameNS(NFSE_NS, "dest")[0]
      || infNFe.getElementsByTagName("dest")[0];
    const total = infNFe.getElementsByTagNameNS(NFSE_NS, "total")[0]
      || infNFe.getElementsByTagName("total")[0];
    const transp = infNFe.getElementsByTagNameNS(NFSE_NS, "transp")[0]
      || infNFe.getElementsByTagName("transp")[0];

    const detList = infNFe.getElementsByTagNameNS(NFSE_NS, "det");
    if (detList.length === 0) {
      const altDet = infNFe.getElementsByTagName("det");
      for (let i = 0; i < altDet.length; i++) detList[i] = altDet[i];
    }

    let produtoPredominante: string | null = null;
    if (detList.length > 0) {
      const prod = detList[0].getElementsByTagNameNS(NFSE_NS, "prod")[0]
        || detList[0].getElementsByTagName("prod")[0];
      if (prod) {
        produtoPredominante = getText(prod, "xProd");
      }
    }

    const emitenteEnder = emit?.getElementsByTagNameNS(NFSE_NS, "enderEmit")[0]
      || emit?.getElementsByTagName("enderEmit")[0];
    const destEnder = dest?.getElementsByTagNameNS(NFSE_NS, "enderDest")[0]
      || dest?.getElementsByTagName("enderDest")[0];

    const icmsTot = total?.getElementsByTagNameNS(NFSE_NS, "ICMSTot")[0]
      || total?.getElementsByTagName("ICMSTot")[0];

    const vol = transp?.getElementsByTagNameNS(NFSE_NS, "vol")[0]
      || transp?.getElementsByTagName("vol")[0];

    let chave: string | null = null;
    const protNFe = doc.getElementsByTagNameNS(NFSE_NS, "protNFe")[0]
      || doc.getElementsByTagName("protNFe")[0];
    if (protNFe) {
      const infProt = protNFe.getElementsByTagNameNS(NFSE_NS, "infProt")[0]
        || protNFe.getElementsByTagName("infProt")[0];
      chave = infProt ? getText(infProt, "chNFe") : null;
    }
    if (!chave) {
      chave = infNFe.getAttribute("Id")?.replace("NFe", "") ?? null;
    }

    const result: NfeXmlParsed = {
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
    };

    return result;
  } catch (err) {
    console.error("[XmlImport] Erro ao processar XML:", err);
    return null;
  }
}

export async function importarXmlNfe(
  xmlString: string,
  osId?: string | null
): Promise<{ success: boolean; doc?: FiscalDocumentoVinculado; error?: string }> {
  try {
    const parsed = parseNfeXml(xmlString);
    if (!parsed) {
      return { success: false, error: "XML invalido ou nao reconhecido como NF-e." };
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

    if (osId) {
      await supabase.from("fiscal_logs").insert([{
        entidade_tipo: "NFE",
        entidade_id: data.id,
        acao: "IMPORTAR_XML_NFE",
        request: { arquivo_tamanho: xmlString.length, os_id: osId },
        response: { doc_id: data.id, chave: parsed.chave_acesso, status: "sucesso" },
      }]);
    }

    return { success: true, doc: data as FiscalDocumentoVinculado };
  } catch (err: any) {
    console.error("[XmlImport] Erro ao importar XML:", err);
    return { success: false, error: err.message };
  }
}
