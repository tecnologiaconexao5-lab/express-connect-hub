// ===================================================================
// _shared/nfseCrypto.ts
//
// Criptografia REVERSÍVEL da senha do certificado A1 (AES-GCM 256).
// Usada por:
//   - nfse-upload-certificado (escrita)
//   - futuro motor de assinatura NFS-e (leitura via descriptografarSenha)
//
// Formato persistido (campo `senha_hash`):
//   aes-gcm:<iv_base64>:<ciphertext_base64>
//
// Secret: NFSE_CRYPTO_KEY
//   - Ideal: 32 bytes aleatórios em base64 (~44 chars).
//   - Aceita qualquer string com >= 16 chars: nesse caso a chave AES-256
//     é derivada via SHA-256(UTF-8) — somente quando o valor NÃO
//     decodifica para exatamente 32 bytes em base64.
//
// IMPORTANTE: trocar NFSE_CRYPTO_KEY invalida a leitura das senhas já
// gravadas. Rotação exige re-criptografar as linhas existentes ou
// reenviar os certificados.
// ===================================================================

const ALGORITMO = "AES-GCM";
const IV_BYTES = 12; // 96 bits — tamanho recomendado para GCM
const TAG_BITS = 128; // tag de autenticação
const PREFIXO = "aes-gcm";
const MIN_SEGREDO = 16;

// Tipos explícitos em ArrayBuffer para satisfazer BufferSource (Deno 2 / TS 5.9).
type Bytes = Uint8Array<ArrayBuffer>;

function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function textoParaBytes(texto: string): Bytes {
  const enc = new TextEncoder().encode(texto);
  const out = new Uint8Array(new ArrayBuffer(enc.length));
  out.set(enc);
  return out;
}

function base64ParaBytes(texto: string): Bytes {
  const bin = atob(texto);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function tentarBase64(texto: string): Bytes | null {
  try {
    const limpo = texto.trim();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(limpo)) return null;
    return base64ParaBytes(limpo);
  } catch {
    return null;
  }
}

async function derivarChave(segredo: string): Promise<CryptoKey> {
  let material: Bytes;
  const decodificado = tentarBase64(segredo);

  if (decodificado && decodificado.length === 32) {
    material = decodificado;
  } else {
    const digest = await crypto.subtle.digest("SHA-256", textoParaBytes(segredo));
    material = new Uint8Array(digest);
  }

  return crypto.subtle.importKey(
    "raw",
    material,
    { name: ALGORITMO },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Carrega e deriva a CryptoKey a partir de NFSE_CRYPTO_KEY. */
export async function obterChaveCriptografia(): Promise<CryptoKey> {
  const segredo = Deno.env.get("NFSE_CRYPTO_KEY");
  if (!segredo || segredo.trim().length < MIN_SEGREDO) {
    throw new Error(
      `NFSE_CRYPTO_KEY ausente ou com menos de ${MIN_SEGREDO} caracteres.`,
    );
  }
  return derivarChave(segredo.trim());
}

/** Criptografa a senha e devolve `aes-gcm:<iv_b64>:<cifrado_b64>`. */
export async function criptografarSenha(
  senha: string,
  chave: CryptoKey,
): Promise<string> {
  const iv: Bytes = crypto.getRandomValues(
    new Uint8Array(new ArrayBuffer(IV_BYTES)),
  );
  const cifrado = await crypto.subtle.encrypt(
    { name: ALGORITMO, iv, tagLength: TAG_BITS },
    chave,
    textoParaBytes(senha),
  );
  return `${PREFIXO}:${bytesParaBase64(iv)}:${
    bytesParaBase64(new Uint8Array(cifrado))
  }`;
}

/** Reverte `aes-gcm:<iv_b64>:<cifrado_b64>` para a senha em claro. */
export async function descriptografarSenha(
  payload: string,
  chave: CryptoKey,
): Promise<string> {
  const partes = (payload || "").split(":");
  if (partes.length !== 3 || partes[0] !== PREFIXO) {
    throw new Error("Formato de senha criptografada inválido.");
  }

  const iv = base64ParaBytes(partes[1]);
  const cifrado = base64ParaBytes(partes[2]);

  const claro = await crypto.subtle.decrypt(
    { name: ALGORITMO, iv, tagLength: TAG_BITS },
    chave,
    cifrado,
  );
  return new TextDecoder().decode(claro);
}
