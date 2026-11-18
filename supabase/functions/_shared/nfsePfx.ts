// ===================================================================
// _shared/nfsePfx.ts
//
// Abre o certificado A1 (.pfx/.p12) em Deno usando node-forge e extrai:
//   - chave privada (PEM) para assinatura XMLDSig
//   - certificado folha (PEM) para KeyInfo/mTLS
//   - cadeia completa (PEM) para o agente TLS
//
// SEGURANCA: a senha jamais e incluida em mensagens de erro/logs.
// ===================================================================
// @ts-ignore node-forge nao publica tipos proprios
import forge from "npm:node-forge@1.3.1";

export interface MaterialCertificado {
  /** Chave privada RSA em PEM. */
  keyPem: string;
  /** Certificado folha em PEM. */
  certPem: string;
  /** Folha + intermediarios (PEM concatenado) para mTLS. */
  chainPem: string;
  /** Subject do certificado (exibicao/auditoria). */
  subject: string;
  /** Validade final (ISO) quando disponivel. */
  validadeFim: string | null;
}

function bytesParaBinario(bytes: Uint8Array): string {
  let out = "";
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) {
    out += String.fromCharCode(...bytes.subarray(i, i + bloco));
  }
  return out;
}

/**
 * Extrai a chave/certificado do PFX.
 * Lanca erro GENERICO (sem senha) quando o arquivo ou a senha sao invalidos.
 */
export function abrirPfx(
  pfxBytes: Uint8Array,
  senha: string,
): MaterialCertificado {
  if (!pfxBytes || pfxBytes.length === 0) {
    throw new Error("Arquivo PFX vazio.");
  }

  try {
    const asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(bytesParaBinario(pfxBytes)),
    );
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);

    // Chave privada pode estar em pkcs8ShroudedKeyBag (comum) ou keyBag.
    const bagsChave = [
      ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ] || []),
      ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[
        forge.pki.oids.keyBag
      ] || []),
    ];
    const chaveBag = bagsChave.find((b: { key?: unknown }) => Boolean(b?.key));
    const chave = chaveBag?.key;
    if (!chave) throw new Error("chave ausente");

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ] || [];
    const certificados = certBags
      .map((b: { cert?: unknown }) => b?.cert)
      .filter(Boolean);
    if (certificados.length === 0) throw new Error("certificado ausente");

    // Escolhe o certificado cuja chave publica casa com a chave privada.
    const chaveRsa = chave as { n?: { toString: (radix?: number) => string } };
    const folha = certificados.find((c: {
      publicKey?: { n?: { toString: (radix?: number) => string } };
    }) => {
      const nPub = c?.publicKey?.n;
      return Boolean(
        nPub && chaveRsa?.n &&
          nPub.toString(16) === chaveRsa.n.toString(16),
      );
    }) || certificados[0];

    const outros = certificados.filter((c: unknown) => c !== folha);

    const keyPem = forge.pki.privateKeyToPem(chave);
    const certPem = forge.pki.certificateToPem(folha);
    const chainPem = [folha, ...outros]
      .map((c: unknown) => forge.pki.certificateToPem(c))
      .join("\n");

    const atributos = folha?.subject?.attributes || [];
    const subject = atributos
      .map((a: { shortName?: string; name?: string; value?: unknown }) =>
        `${a.shortName || a.name || "?"}=${String(a.value ?? "")}`
      )
      .join(", ");

    const notAfter = folha?.validity?.notAfter;
    const validadeFim = notAfter instanceof Date ? notAfter.toISOString() : null;

    return { keyPem, certPem, chainPem, subject, validadeFim };
  } catch {
    // Nunca repassar a mensagem original (pode conter detalhes do ASN.1).
    throw new Error(
      "Nao foi possivel abrir o certificado A1 (PFX invalido ou senha incorreta).",
    );
  }
}
