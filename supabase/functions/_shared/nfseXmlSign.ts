// ===================================================================
// _shared/nfseXmlSign.ts
//
// Assinatura XMLDSig (enveloped) de um no do documento, RSA-SHA256,
// C14N 1.0 e digest SHA-256 — perfil exigido pelo Padrao Nacional NFS-e.
// A tag <Signature> e inserida como irma do no assinado (enveloped).
//
// Usado pela DPS (<infDPS>) e pelo pedido de evento (<infPedReg>).
// ===================================================================
import { SignedXml } from "npm:xml-crypto@6.1.2";

const ALGORITMO_ASSINATURA = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const ALGORITMO_DIGEST = "http://www.w3.org/2001/04/xmlenc#sha256";
const CANONICALIZACAO = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const TRANSFORM_ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

export interface OpcoesAssinaturaDps {
  keyPem: string;
  certPem: string;
}

export type OpcoesAssinaturaEvento = OpcoesAssinaturaDps;

/**
 * Assina um no XML (localName) e devolve o documento com <Signature>
 * inserida logo apos o no. O KeyInfo inclui X509Certificate (ICP-Brasil).
 */
function assinarNoXml(
  xml: string,
  opcoes: OpcoesAssinaturaDps,
  localName: string,
): string {
  if (!xml || !xml.includes(`<${localName}`)) {
    throw new Error(`XML sem no ${localName}.`);
  }
  if (!opcoes.keyPem || !opcoes.certPem) {
    throw new Error("Chave/certificado ausentes para assinatura.");
  }

  const assinador = new SignedXml({
    privateKey: opcoes.keyPem,
    publicCert: opcoes.certPem,
    signatureAlgorithm: ALGORITMO_ASSINATURA,
    canonicalizationAlgorithm: CANONICALIZACAO,
  });

  // Referencia aponta para o Id do no assinado (URI="#ID").
  const idRegex = new RegExp(`<${localName}[^>]*\\sId="([^"]+)"`);
  const idNo = xml.match(idRegex)?.[1] || "";
  const uriReferencia = idNo ? `#${idNo}` : "";
  const xpathNo = `//*[local-name()='${localName}']`;

  assinador.addReference({
    xpath: xpathNo,
    uri: uriReferencia,
    digestAlgorithm: ALGORITMO_DIGEST,
    transforms: [TRANSFORM_ENVELOPED, CANONICALIZACAO],
  });

  // XSD: <Signature> e irma do no assinado (logo apos).
  assinador.computeSignature(xml, {
    location: {
      reference: xpathNo,
      action: "after",
    },
  });

  const assinado = assinador.getSignedXml();
  if (!assinado.includes("<Signature") && !assinado.includes(":Signature")) {
    throw new Error("Falha ao gerar a assinatura XML.");
  }
  return assinado;
}

/**
 * Assina o XML da DPS e devolve o documento com <Signature>.
 * O KeyInfo inclui X509Certificate (ICP-Brasil).
 */
export function assinarDpsXml(
  xml: string,
  opcoes: OpcoesAssinaturaDps,
): string {
  return assinarNoXml(xml, opcoes, "infDPS");
}

/**
 * Assina o pedido de registro de evento (<infPedReg>) e devolve o
 * documento com <Signature> como irma do infPedReg.
 */
export function assinarEventoXml(
  xml: string,
  opcoes: OpcoesAssinaturaEvento,
): string {
  return assinarNoXml(xml, opcoes, "infPedReg");
}
