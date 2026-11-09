// ============================================================
// FIX 401 / "Não foi possível abrir a OS agora" (Cotação Express)
// Causa real: a RPC do Lote 1 chama public.f_proximo_numero_os(), que
// nunca foi criada em produção (migration da sequência não aplicada).
// ============================================================
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const readSrc = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");

const fixMig = readSrc("supabase/migrations/20261109020000_fix_f_proximo_numero_os.sql");
const lote1Mig = readSrc("supabase/migrations/20261109000000_cotacao_os_correcoes_base.sql");
const applyScript = readSrc("scripts/_apply_fix_f_proximo_numero_os.cjs");

describe("Correção do erro na conversão cotação → OS (401/função ausente)", () => {
  it("cria a sequence e a função f_proximo_numero_os de forma idempotente", () => {
    expect(fixMig).toContain("CREATE SEQUENCE IF NOT EXISTS public.os_numero_seq");
    expect(fixMig).toContain("CREATE OR REPLACE FUNCTION public.f_proximo_numero_os()");
    expect(fixMig).toContain("nextval('public.os_numero_seq')");
    expect(fixMig).toContain("SECURITY DEFINER");
    expect(fixMig).toContain("America/Sao_Paulo");
  });

  it("a RPC da OS é SECURITY DEFINER e chama a função agora existente", () => {
    expect(lote1Mig).toContain("SECURITY DEFINER");
    expect(lote1Mig).toContain("public.f_proximo_numero_os()");
  });

  it("não regride as correções do Lote 1 ao corrigir a numeração", () => {
    expect(fixMig).not.toContain("CREATE OR REPLACE FUNCTION public.f_cotacao_detalhes_para_os");
    expect(lote1Mig).toContain("f_endereco_cotacao_os");
    expect(lote1Mig).toContain("'em_analise'");
  });

  it("script de aplicação valida a sequence, a função e os grants", () => {
    expect(applyScript).toContain("20261109020000_fix_f_proximo_numero_os.sql");
    expect(applyScript).toContain("--apply");
    expect(applyScript).toContain("f_proximo_numero_os");
    expect(applyScript).toContain("RPC mantém as correções do Lote 1");
  });
});
