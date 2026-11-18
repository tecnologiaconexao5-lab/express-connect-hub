// ===================================================================
// _shared/nfsePfx.ts
//
// Abre certificados A1 (.pfx/.p12) em Deno e extrai chave privada PEM,
// certificado folha e cadeia para XMLDSig/mTLS.
//
// Estrategia:
//   1) PKIjs (WebCrypto) — suporta PKCS#12 moderno (PBES2/AES-256-CBC/SHA-256)
//   2) node-forge       — fallback para PFX legado (3DES/RC2)
//
// SEGURANCA: senha, PFX bytes e chave privada NAO aparecem em erros/logs.
// ===================================================================
// @ts-ignore node-forge nao publica tipos proprios
import forge from "npm:node-forge@1.3.1";
import {
  CertBag,
  KeyBag,
  PKCS8ShroudedKeyBag,
  PFX,
} from "npm:pkijs@4.0.1";

export interface MaterialCertificado {
  /** Chave privada RSA em PEM (PKCS#8). */
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

/** Erro tecnico do certificado, com detalhe sanitizado para log do servidor. */
export class CertificadoError extends Error {
  readonly codigo: string;
  readonly detalhe: string;

  constructor(codigo: string, detalhe: string) {
    super(
      "Nao foi possivel abrir o certificado A1 (PFX invalido ou senha incorreta).",
    );
    this.name = "CertificadoError";
    this.codigo = codigo;
    this.detalhe = detalhe;
  }
}

function paraArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function senhaParaBuffer(senha: string): ArrayBuffer {
  return paraArrayBuffer(new TextEncoder().encode(senha));
}

function bytesParaBinario(bytes: Uint8Array): string {
  let out = "";
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) {
    out += String.fromCharCode(...bytes.subarray(i, i + bloco));
  }
  return out;
}

function derParaPem(der: ArrayBuffer, label: string): string {
  const b64 = btoa(bytesParaBinario(new Uint8Array(der)));
  const linhas = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN ${label}-----\n${linhas}\n-----END ${label}-----`;
}

function resumoErro(erro: unknown): string {
  const texto = erro instanceof Error
    ? `${erro.name}: ${erro.message}`
    : String(erro);
  return texto.replace(/\s+/g, " ").slice(0, 300);
}

function classificarFalha(detalhe: string): string {
  const texto = detalhe.toLowerCase();
  if (/integrity|mac|password|senha|bad decrypt|decrypt|wrong/.test(texto)) {
    return "senha_ou_integridade";
  }
  if (
    /algorithm|algoritmo|unsupported|oid|pbes|pbkdf|asn1|schema|unknown|not implemented/
      .test(texto)
  ) {
    return "algoritmo_asn1_nao_suportado";
  }
  return "estrutura_pfx";
}

type CertificadoPem = { pem: string; spkiDer: ArrayBuffer | null };

/** Escolhe o certificado cuja chave publica casa com a chave privada. */
async function escolherFolha(
  chaveDer: ArrayBuffer,
  certificados: CertificadoPem[],
): Promise<CertificadoPem | null> {
  try {
    const chave = await crypto.subtle.importKey(
      "pkcs8",
      chaveDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["sign"],
    );
    const jwkChave = await crypto.subtle.exportKey("jwk", chave) as JsonWebKey;

    for (const certificado of certificados) {
      if (!certificado.spkiDer) continue;
      try {
        const publica = await crypto.subtle.importKey(
          "spki",
          certificado.spkiDer,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["verify"],
        );
        const jwkPublica = await crypto.subtle.exportKey("jwk", publica) as JsonWebKey;
        if (
          jwkChave.n && jwkPublica.n && jwkChave.n === jwkPublica.n &&
          jwkChave.e === jwkPublica.e
        ) {
          return certificado;
        }
      } catch {
        // Certificado com algoritmo diferente — tenta o proximo.
      }
    }
  } catch {
    // Chave nao-RSA ou falha do WebCrypto — usa o primeiro certificado.
  }
  return certificados[0] || null;
}

function montarMaterial(
  chaveDer: ArrayBuffer,
  certificados: CertificadoPem[],
  folha: CertificadoPem,
): MaterialCertificado {
  const keyPem = derParaPem(chaveDer, "PRIVATE KEY");
  const certPem = folha.pem;
  const outros = certificados.filter((c) => c.pem !== folha.pem);
  const chainPem = [folha.pem, ...outros.map((c) => c.pem)].join("\n");

  let subject = "";
  let validadeFim: string | null = null;
  try {
    const certForge = forge.pki.certificateFromPem(certPem);
    const atributos = certForge.subject?.attributes || [];
    subject = atributos
      .map((a: { shortName?: string; name?: string; value?: unknown }) =>
        `${a.shortName || a.name || "?"}=${String(a.value ?? "")}`
      )
      .join(", ");
    const notAfter = certForge.validity?.notAfter;
    validadeFim = notAfter instanceof Date ? notAfter.toISOString() : null;
  } catch {
    // Sem subject/validade; a assinatura continua valida.
  }

  return { keyPem, certPem, chainPem, subject, validadeFim };
}

/** PKIjs: PKCS#12 moderno (PBES2 / AES-256-CBC / SHA-256). */
async function abrirPfxComPkijs(
  pfxBytes: Uint8Array,
  senha: string,
): Promise<MaterialCertificado> {
  const password = senhaParaBuffer(senha);
  const pfx = PFX.fromBER(paraArrayBuffer(pfxBytes));

  try {
    await pfx.parseInternalValues({ password, checkIntegrity: true });
  } catch (erro) {
    const texto = resumoErro(erro).toLowerCase();
    // PFX sem MAC (macData opcional) — le sem verificar integridade.
    if (/absent/.test(texto) && /macdata/.test(texto)) {
      await pfx.parseInternalValues({ password, checkIntegrity: false });
    } else {
      throw erro;
    }
  }

  const authenticatedSafe = pfx.parsedValue?.authenticatedSafe;
  if (!authenticatedSafe) throw new Error("AuthenticatedSafe ausente no PFX.");

  const parametrosSafeContents = authenticatedSafe.safeContents.map((content) => {
    // 1.2.840.113549.1.7.6 = EncryptedData (senha)
    return content.contentType === "1.2.840.113549.1.7.6"
      ? { password }
      : {};
  });
  await authenticatedSafe.parseInternalValues({
    safeContents: parametrosSafeContents,
  });

  const conteudos = authenticatedSafe.parsedValue?.safeContents as
    | Array<{ value: { safeBags: Array<{ bagValue: unknown }> } }>
    | undefined;

  const chavesDer: ArrayBuffer[] = [];
  const certificados: CertificadoPem[] = [];

  for (const conteudo of conteudos || []) {
    for (const bag of conteudo.value.safeBags) {
      const value = bag.bagValue;

      if (value instanceof PKCS8ShroudedKeyBag) {
        const shrouded = value as unknown as {
          parseInternalValues: (p: { password: ArrayBuffer }) => Promise<void>;
          parsedValue?: {
            toSchema: () => { toBER: (isRoot?: boolean) => ArrayBuffer };
          };
        };
        await shrouded.parseInternalValues({ password });
        if (shrouded.parsedValue) {
          chavesDer.push(shrouded.parsedValue.toSchema().toBER(false));
        }
      } else if (value instanceof KeyBag) {
        chavesDer.push(value.toSchema().toBER(false));
      } else if (value instanceof CertBag) {
        const parsed = value.parsedValue as {
          toSchema?: () => { toBER: (isRoot?: boolean) => ArrayBuffer };
          subjectPublicKeyInfo?: {
            toSchema: () => { toBER: (isRoot?: boolean) => ArrayBuffer };
          };
        } | null;

        let der: ArrayBuffer | null = null;
        if (parsed?.toSchema) {
          der = parsed.toSchema().toBER(false);
        } else {
          const certValue = value.certValue as {
            valueBlock?: { valueHexView?: Uint8Array };
          };
          if (certValue?.valueBlock?.valueHexView) {
            der = paraArrayBuffer(certValue.valueBlock.valueHexView);
          }
        }

        if (der) {
          const spkiDer = parsed?.subjectPublicKeyInfo
            ? parsed.subjectPublicKeyInfo.toSchema().toBER(false)
            : null;
          certificados.push({ pem: derParaPem(der, "CERTIFICATE"), spkiDer });
        }
      }
    }
  }

  if (chavesDer.length === 0) {
    throw new Error("Chave privada nao encontrada nos SafeBags.");
  }
  if (certificados.length === 0) {
    throw new Error("Certificado X.509 nao encontrado nos SafeBags.");
  }

  const folha = await escolherFolha(chavesDer[0], certificados);
  if (!folha) throw new Error("Certificado folha nao identificado.");

  return montarMaterial(chavesDer[0], certificados, folha);
}

/** node-forge: fallback para PFX legado (3DES/RC2). */
function abrirPfxComForge(
  pfxBytes: Uint8Array,
  senha: string,
): MaterialCertificado {
  const asn1 = forge.asn1.fromDer(
    forge.util.createBuffer(bytesParaBinario(pfxBytes)),
  );
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);

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
  if (!chave) throw new Error("Chave privada nao encontrada (forge).");

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ] || [];
  const certificados = certBags
    .map((b: { cert?: unknown }) => b?.cert)
    .filter(Boolean);
  if (certificados.length === 0) {
    throw new Error("Certificado X.509 nao encontrado (forge).");
  }

  const chaveRsa = chave as { n?: { toString: (radix?: number) => string } };
  const folha = certificados.find((c: {
    publicKey?: { n?: { toString: (radix?: number) => string } };
  }) => {
    const nPub = c?.publicKey?.n;
    return Boolean(
      nPub && chaveRsa?.n && nPub.toString(16) === chaveRsa.n.toString(16),
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

  return {
    keyPem,
    certPem,
    chainPem,
    subject,
    validadeFim: notAfter instanceof Date ? notAfter.toISOString() : null,
  };
}

/**
 * Extrai chave/certificado do PFX.
 * Tenta PKIjs (moderno) e, se falhar, node-forge (legado).
 */
export async function abrirPfx(
  pfxBytes: Uint8Array,
  senha: string,
): Promise<MaterialCertificado> {
  if (!pfxBytes || pfxBytes.length === 0) {
    throw new CertificadoError("arquivo_invalido", "PFX vazio (0 bytes).");
  }
  if (pfxBytes[0] !== 0x30) {
    throw new CertificadoError(
      "arquivo_invalido",
      `Magic byte inesperado: 0x${pfxBytes[0]?.toString(16)} (esperado 0x30).`,
    );
  }

  const detalhes: string[] = [];

  try {
    return await abrirPfxComPkijs(pfxBytes, senha);
  } catch (erro) {
    detalhes.push("pkijs " + resumoErro(erro));
  }

  try {
    return abrirPfxComForge(pfxBytes, senha);
  } catch (erro) {
    detalhes.push("forge " + resumoErro(erro));
  }

  const detalhe = detalhes.join(" | ").slice(0, 600);
  throw new CertificadoError(classificarFalha(detalhe), detalhe);
}
