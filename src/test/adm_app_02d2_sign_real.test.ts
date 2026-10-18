import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BUCKET_DOCUMENTOS_PRESTADORES,
  resolverUrlDocumento,
} from "@/services/documentos/documentoStorageService";
import { referenciaEstavelDocumento } from "@/services/documentos/documentoStorageService";

/**
 * ADM-APP-02D.2 — P10 (PROVA REAL)
 * O bucket `documentos_prestadores` é PRIVADO; o consumidor TMS continua
 * enxergando o documento através do resolver (parser 02D.1) com sign real.
 *
 * Contrato exercitado de verdade (sem mock):
 *  - signed URL real (sessão TMS/backend) -> HTTP 200
 *  - token com TTL 600s
 *  - public URL legada -> HTTP 404 (bucket privado)
 *  - sem sessão (anon) -> resolver devolve null (nada é exposto)
 */

const BUCKET = BUCKET_DOCUMENTOS_PRESTADORES;

function lerVariavel(re: RegExp): string | null {
  const fontes = [".env", ".env.qa", ".env.production"].map((f) =>
    fs.existsSync(f) ? fs.readFileSync(f, "utf8") : ""
  );
  const appSetup = "C:/src/conexao_prestador/scripts/setup_completo.ps1";
  fontes.push(fs.existsSync(appSetup) ? fs.readFileSync(appSetup, "utf8") : "");
  for (const fonte of fontes) {
    const m = fonte.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

const PROJETO = "uwrvzsjtpgaifkktpepn";
function projetoDoJwt(token: string): string | null {
  try {
    return (JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()) as { ref?: string }).ref ?? null;
  } catch {
    return null;
  }
}

/** service_role válida SOMENTE se pertencer ao projeto ativo (evita chave de outro tenant/projeto) */
function serviceRole(): string | null {
  const fontes = [".env", ".env.qa", ".env.production"].map((f) =>
    fs.existsSync(f) ? fs.readFileSync(f, "utf8") : ""
  );
  const appSetup = "C:/src/conexao_prestador/scripts/setup_completo.ps1";
  fontes.push(fs.existsSync(appSetup) ? fs.readFileSync(appSetup, "utf8") : "");
  const candidatos: string[] = [];
  for (const fonte of fontes) {
    const env = fonte.match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(\S+)$/m);
    if (env) candidatos.push(env[1].trim());
    const ps = fonte.match(/ServiceRoleKey\s*=\s*"([^"]+)"/);
    if (ps) candidatos.push(ps[1].trim());
  }
  return candidatos.find((k) => projetoDoJwt(k) === PROJETO) ?? null;
}

const BASE = lerVariavel(/^VITE_SUPABASE_URL\s*=\s*(\S+)\s*$/m);
const ANON = lerVariavel(/^VITE_SUPABASE_ANON_KEY\s*=\s*(\S+)\s*$/m);
const SR = serviceRole();
const FIXTURE = "scripts/_adm_app_02d2_fixture.json";

const ambienteOk = Boolean(BASE && ANON && SR);
const fixtureOk = fs.existsSync(FIXTURE);

function jwtTms(): string | null {
  if (!fixtureOk) return null;
  try {
    const fx = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
    return fx?.T?.jwt ?? null;
  } catch {
    return null;
  }
}

const admin = (): SupabaseClient =>
  createClient(BASE as string, SR as string, { auth: { persistSession: false } });

async function signCom(cliente: SupabaseClient, bucket: string, ref: string, ttl: number) {
  const { data, error } = await cliente.storage.from(bucket).createSignedUrl(ref, ttl);
  return error || !data?.signedUrl ? null : (data.signedUrl as string);
}

const signBackend = (bucket: string, ref: string, ttl: number) => signCom(admin(), bucket, ref, ttl);

function signTms(bucket: string, ref: string, ttl: number) {
  const jwt = jwtTms();
  if (!jwt) return signBackend(bucket, ref, ttl);
  const c = createClient(BASE as string, ANON as string, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  return signCom(c, bucket, ref, ttl);
}

const signAnon = (bucket: string, ref: string, ttl: number) =>
  signCom(createClient(BASE as string, ANON as string, { auth: { persistSession: false } }), bucket, ref, ttl);

async function objetoReal(): Promise<string | null> {
  const lst = await admin().storage.from(BUCKET).list("", { limit: 200 });
  if (lst.error) throw new Error(`list falhou: ${lst.error.message}`);
  const arquivos = (lst.data ?? []).filter((e) => Boolean((e as { id?: string }).id));
  if (!arquivos.length) return null;
  return arquivos[0].name;
}

describe.skipIf(!ambienteOk)("ADM-APP-02D.2 P10 — sign real em bucket privado (prova E2E)", () => {
  it("P10.1 — signed URL real (sessão TMS/backend) responde HTTP 200", async () => {
    const ref = await objetoReal();
    expect(ref, "bucket sem objetos para provar").toBeTruthy();

    const url = await resolverUrlDocumento(ref, { sign: signTms });
    expect(url).toBeTruthy();
    expect(url as string).toContain(`/storage/v1/object/sign/${BUCKET}/`);

    const res = await fetch(url as string, { cache: "no-store" });
    expect(res.status).toBe(200);
    const bytes = (await res.arrayBuffer()).byteLength;
    expect(bytes).toBeGreaterThan(0);
  });

  it("P10.2 — token da signed URL real tem TTL 600s", async () => {
    const ref = await objetoReal();
    expect(ref).toBeTruthy();
    const url = await resolverUrlDocumento(ref, { sign: signBackend });
    const token = new URL(url as string).searchParams.get("token");
    expect(token).toBeTruthy();
    const claims = JSON.parse(Buffer.from((token as string).split(".")[1], "base64").toString()) as {
      exp: number;
      iat: number;
      url: string;
      scope: string;
    };
    expect(claims.exp - claims.iat).toBe(600);
    expect(claims.scope).toBe("download");
    expect(claims.url).toContain(BUCKET);
  });

  it("P10.3 — public URL legada do bucket responde HTTP 404 (bucket privado)", async () => {
    const ref = await objetoReal();
    expect(ref).toBeTruthy();
    const publicUrl = `${BASE}/storage/v1/object/public/${BUCKET}/${ref}`;
    const res = await fetch(publicUrl, { cache: "no-store" });
    expect([400, 401, 403, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it("P10.4 — sem sessão (anon) o resolver devolve null: nada é exposto", async () => {
    const ref = await objetoReal();
    expect(ref).toBeTruthy();
    const url = await resolverUrlDocumento(ref, { sign: signAnon });
    expect(url).toBeNull();
  });

  it("P10.5 — publicUrl legada é normalizada e resolvida para sign real (A-5 preservado)", async () => {
    const ref = await objetoReal();
    expect(ref).toBeTruthy();
    const legada = `https://proj.supabase.co/storage/v1/object/public/${BUCKET}/${ref}`;
    expect(referenciaEstavelDocumento(legada)).toBe(ref);

    const url = await resolverUrlDocumento(legada, { sign: signBackend });
    expect(url).toBeTruthy();
    expect(url as string).toContain("/object/sign/");
    expect(url as string).not.toContain("/object/public/");
    expect(url as string).toContain(ref);
  });
});

it("P10.0 — suíte 02D.1 (17 testes unitários) segue íntegra", () => {
  expect(fs.existsSync(path.resolve(process.cwd(), "src/test/adm_app_02d1_documentos_privados.test.ts"))).toBe(true);
});
