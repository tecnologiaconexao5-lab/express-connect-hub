import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const h = vi.hoisted(() => {
  const state = { signFail: false, chamadas: [] as Array<{ bucket: string; path: string; ttl: number }> };
  const createSignedUrl = vi.fn(async (p: string, ttl: number) => {
    state.chamadas.push({ bucket: "documentos_prestadores", path: p, ttl });
    if (state.signFail) return { data: null, error: { message: "Object not found" } };
    return {
      data: { signedUrl: `https://proj.supabase.co/storage/v1/object/sign/documentos_prestadores/${p}?token=tk` },
      error: null,
    };
  });
  const storageFrom = vi.fn(() => ({ createSignedUrl }));
  const from = vi.fn(() => ({ select: async () => ({ data: [], error: null }) }));
  return { state, createSignedUrl, storageFrom, from };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { storage: { from: h.storageFrom }, from: h.from },
}));

import {
  BUCKET_DOCUMENTOS_PRESTADORES,
  DOCUMENTO_TTL_SECONDS,
  caminhoPertenceAoPrestador,
  mesmaReferencia,
  referenciaEstavelDocumento,
  resolverUrlDocumento,
} from "@/services/documentos/documentoStorageService";
import { parseStorageRef } from "@/services/storage/storageRefService";

const PATH_REAL = "doc_0b55f471-1111-2222-3333-444455556666_CNH_Frente_1788137820863.pdf";
const PUBLIC_LEGADA = `https://proj.supabase.co/storage/v1/object/public/${BUCKET_DOCUMENTOS_PRESTADORES}/${PATH_REAL}`;
const SIGNED_LEGADA = `https://proj.supabase.co/storage/v1/object/sign/${BUCKET_DOCUMENTOS_PRESTADORES}/${PATH_REAL}?token=old`;
const BUCKET_ERRADO = "https://proj.supabase.co/storage/v1/object/public/fiscal-documentos/nf/123.xml";
const EXTERNA = "https://storage.example.com/doc.pdf";

beforeEach(() => {
  h.state.signFail = false;
  h.state.chamadas = [];
  h.createSignedUrl.mockClear();
});

describe("ADM-APP-02D.1 T01-T07 — referência estável e signed URL", () => {
  it("T01) path puro persistido é aceito e vira signed URL", async () => {
    expect(referenciaEstavelDocumento(PATH_REAL)).toBe(PATH_REAL);
    const out = await resolverUrlDocumento(PATH_REAL, { prestadorId: "0b55f471-1111-2222-3333-444455556666" });
    expect(out).toContain(`/storage/v1/object/sign/${BUCKET_DOCUMENTOS_PRESTADORES}/`);
    expect(out).not.toContain("/object/public/");
  });

  it("T02) publicUrl legada do bucket é normalizada para path puro (sem UPDATE em massa)", () => {
    expect(referenciaEstavelDocumento(PUBLIC_LEGADA)).toBe(PATH_REAL);
    expect(referenciaEstavelDocumento(PUBLIC_LEGADA)).not.toMatch(/^https?:/);
    const ref = parseStorageRef(PUBLIC_LEGADA, BUCKET_DOCUMENTOS_PRESTADORES);
    expect(ref?.bucket).toBe(BUCKET_DOCUMENTOS_PRESTADORES);
    expect(ref?.path).toBe(PATH_REAL);
  });

  it("T03) signed URL nunca é o que se persiste (sempre path estável)", () => {
    expect(referenciaEstavelDocumento(SIGNED_LEGADA)).toBe(PATH_REAL);
    const persistido = referenciaEstavelDocumento(SIGNED_LEGADA) ?? "";
    expect(persistido).not.toContain("token=");
    expect(persistido).not.toContain("/object/sign/");
    expect(persistido).not.toContain("http");
  });

  it("T04) objeto inexistente → fallback controlado (null, sem exceção)", async () => {
    h.state.signFail = true;
    const out = await resolverUrlDocumento(PATH_REAL, { prestadorId: "0b55f471-1111-2222-3333-444455556666" });
    expect(out).toBeNull();
    await expect(resolverUrlDocumento(PUBLIC_LEGADA, { sign: async () => null })).resolves.toBeNull();
  });

  it("T05) referência nula/ausente/vazia não quebra", async () => {
    expect(await resolverUrlDocumento(null)).toBeNull();
    expect(await resolverUrlDocumento(undefined)).toBeNull();
    expect(await resolverUrlDocumento("")).toBeNull();
    expect(referenciaEstavelDocumento(null)).toBeNull();
    expect(referenciaEstavelDocumento("   ")).toBeNull();
    expect(caminhoPertenceAoPrestador(null, "abc")).toBe(false);
  });

  it("T06) referência de outro bucket é rejeitada", async () => {
    expect(referenciaEstavelDocumento(BUCKET_ERRADO)).toBeNull();
    expect(await resolverUrlDocumento(BUCKET_ERRADO)).toBeNull();
    expect(h.createSignedUrl).not.toHaveBeenCalled();
    expect(referenciaEstavelDocumento(EXTERNA)).toBeNull();
  });

  it("T07) path malformado é rejeitado (path traversal, query, absoluto, local)", async () => {
    const invalidos = [
      "../secrets.txt",
      "/etc/passwd",
      "doc/a/../b.txt",
      "doc/x.pdf?token=1",
      "doc/x.pdf#frag",
      "file:///etc/hosts",
      "C:\\Users\\x.pdf",
      "data:application/pdf;base64,AAAA",
    ];
    for (const v of invalidos) {
      expect(referenciaEstavelDocumento(v), v).toBeNull();
      expect(await resolverUrlDocumento(v), v).toBeNull();
    }
    expect(h.createSignedUrl).not.toHaveBeenCalled();
  });
});

describe("ADM-APP-02D.1 T10 — guarda de propriedade (prestador próprio)", () => {
  const outro = "ffffffff-0000-1111-2222-333333333333";

  it("T10) path de outro prestador é rejeitado", async () => {
    expect(caminhoPertenceAoPrestador(PATH_REAL, outro)).toBe(false);
    expect(await resolverUrlDocumento(PATH_REAL, { prestadorId: outro })).toBeNull();
    expect(h.createSignedUrl).not.toHaveBeenCalled();
  });

  it("T10b) path do próprio prestador (docs e foto) é aceito", async () => {
    const own = "0b55f471-1111-2222-3333-444455556666";
    expect(caminhoPertenceAoPrestador(PATH_REAL, own)).toBe(true);
    expect(caminhoPertenceAoPrestador(`foto_${own}_1789953705238.jpeg`, own)).toBe(true);
    expect(caminhoPertenceAoPrestador(`foto_temp_1789953705238_1789953705238.jpeg`, "temp_1789953705238")).toBe(true);
    expect(await resolverUrlDocumento(PATH_REAL, { prestadorId: own })).toContain("/object/sign/");
  });

  it("T10c) TTL de assinatura é 600s (não permanente)", async () => {
    expect(DOCUMENTO_TTL_SECONDS).toBe(600);
    await resolverUrlDocumento(PATH_REAL, { prestadorId: "0b55f471-1111-2222-3333-444455556666" });
    expect(h.state.chamadas[0].ttl).toBe(600);
  });
});

describe("ADM-APP-02D.1 — dedup tolerante à normalização (A-5 preservado)", () => {
  it("publicUrl legada e path puro do mesmo objeto são a mesma referência", () => {
    expect(mesmaReferencia(PUBLIC_LEGADA, PATH_REAL)).toBe(true);
    expect(mesmaReferencia(SIGNED_LEGADA, PATH_REAL)).toBe(true);
    expect(mesmaReferencia(PATH_REAL, PATH_REAL)).toBe(true);
    expect(mesmaReferencia(PATH_REAL, `${PATH_REAL}x`)).toBe(false);
    expect(mesmaReferencia(null, PATH_REAL)).toBe(false);
  });
});

describe("ADM-APP-02D.1 T08-T09 — nenhum consumidor depende de URL pública", () => {
  const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), "utf8");

  it("T08a) TMS: PrestadorDetalhe não usa getPublicUrl para render final", () => {
    const s = read("src/components/prestadores/PrestadorDetalhe.tsx");
    expect(s).not.toContain("getPublicUrl");
    expect(s).toContain('from "@/services/documentos/documentoStorageService"');
    expect(s).toContain("resolverUrlDocumento");
    expect(s).toContain("referenciaEstavelDocumento");
  });

  it("T08b) TMS: todos os insert sites persistem referência estável", () => {
    const prestador = read("src/components/prestadores/PrestadorDetalhe.tsx");
    expect(prestador).toContain('from("documentos_prestadores")');
    expect(prestador).toContain("url: docRefPersistida");
    expect(prestador).not.toContain("urlData");
    expect(prestador).not.toMatch(/url:\s*fotoUrl\b/);

    const integ = read("src/services/recrutamentoIntegracao.ts");
    expect(integ).toContain("referenciaEstavelDocumento(doc.url_arquivo)");
    expect(integ).not.toMatch(/url:\s*doc\.url_arquivo\s*,/);

    const svc = read("src/services/documentosPrestadorService.ts");
    expect(svc).toContain("referenciaEstavelDocumento");
    expect(svc).toContain("mesmaReferencia");
    expect(svc).not.toContain("urlData");
  });

  it("T08c) TMS: portalPrestadorService resolve url antes de devolver", () => {
    const s = read("src/services/portal-prestador/portalPrestadorService.ts");
    expect(s).toContain("resolverUrlDocumento");
    expect(s).toContain('eq("prestador_id", prestadorId)');
  });

  it("T08d) TMS: nenhum consumidor referencia SERVICE_ROLE / chave hardcoded", () => {
    const alvos = [
      "src/components/prestadores/PrestadorDetalhe.tsx",
      "src/services/documentos/documentoStorageService.ts",
      "src/services/storage/storageRefService.ts",
      "src/services/portal-prestador/portalPrestadorService.ts",
      "src/services/documentosPrestadorService.ts",
    ];
    for (const a of alvos) {
      const s = read(a);
      expect(s, a).not.toMatch(/SERVICE_ROLE|service_role|sb_secret_/i);
      expect(s, a).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    }
  });

  it("T08e) TMS: sem persistência de signed URL (nenhum insert recebe createSignedUrl)", () => {
    const alvos = [
      "src/components/prestadores/PrestadorDetalhe.tsx",
      "src/services/documentosPrestadorService.ts",
      "src/services/recrutamentoIntegracao.ts",
    ];
    for (const a of alvos) {
      expect(read(a), a).not.toContain("createSignedUrl");
    }
  });

  it("T09) APP: driver_documents_repository não usa getPublicUrl", () => {
    const candidatos = [
      process.env.APP_PRESTADOR_PATH,
      "C:/src/conexao_prestador",
      "C:\\src\\conexao_prestador",
    ].filter(Boolean) as string[];
    const arquivo = candidatos
      .map((c) => path.join(c, "lib", "core", "repositories", "driver_documents_repository.dart"))
      .find((p) => fs.existsSync(p));

    if (!arquivo) {
      console.warn("[T09] repositorio do APP ausente — verificado apenas no TMS");
      return;
    }

    const s = fs.readFileSync(arquivo, "utf8");
    expect(s).not.toContain("getPublicUrl");
    expect(s).toContain("createSignedUrl");
    expect(s).toContain("referenciaEstavel");
    expect(s).toContain("caminhoPertenceAoPrestador");
    expect(s).not.toMatch(/SERVICE_ROLE|sb_secret_/i);

    const linhas = s.split("\n");
    const insert = linhas.findIndex((l) => l.includes(".from(_table)") && l.includes("insert"));
    expect(insert).toBeGreaterThan(0);
    const bloco = linhas.slice(insert, insert + 6).join("\n");
    expect(bloco).toContain("'url': referencia");
    expect(bloco).not.toMatch(/'url':\s*url[,)]/);
  });
});
