// ===================================================================
// _shared/nfseXmlSign.ts
//
// Assinatura XMLDSig (enveloped) do no <infDPS>, RSA-SHA256,
// C14N 1.0 e digest SHA-256 — perfil exigido pelo Padrao Nacional NFS-e.
// A tag <Signature> e inserida como irma de <infDPS> dentro de <DPS>.
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

/**
 * Assina o XML da DPS e devolve o documento com <Signature>.
 * O KeyInfo inclui X509Certificate (ICP-Brasil).
 */
export function assinarDpsXml(
  xml: string,
  opcoes: OpcoesAssinaturaDps,
): string {
  if (!xml || !xml.includes("<infDPS")) {
    throw new Error("XML da DPS sem no infDPS.");
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

  // Referencia aponta para o Id do <infDPS> (URI="#DPS...").
  const idInfDps = xml.match(/<infDPS[^>]*\sId="([^"]+)"/)?.[1] || "";
  const uriReferencia = idInfDps ? `#${idInfDps}` : "";

  assinador.addReference({
    xpath: "//*[local-name()='infDPS']",
    uri: uriReferencia,
    digestAlgorithm: ALGORITMO_DIGEST,
    transforms: [TRANSFORM_ENVELOPED, CANONICALIZACAO],
  });

  // XSD TCDPS: <infDPS> seguido de <ds:Signature> (irmao, dentro de DPS).
  assinador.computeSignature(xml, {
    location: {
      reference: "//*[local-name()='infDPS']",
      action: "after",
    },
  });

  const assinado = assinador.getSignedXml();
  if (!assinado.includes("<Signature") && !assinado.includes(":Signature")) {
    throw new Error("Falha ao gerar a assinatura XML.");
  }
  return assinado;
}
