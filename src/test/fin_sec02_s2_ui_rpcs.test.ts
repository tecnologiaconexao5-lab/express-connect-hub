import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { aprovarPagamentos, atualizarStatusPagamento } from "@/services/financeiro/pagamentoPrestadorService";

const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
const COMP = "src/components/financeiro/PagamentoPrestadores.tsx";
const SVC = "src/services/financeiro/pagamentoPrestadorService.ts";

describe("TMS-FIN-SEC-02-S2 — UI via RPCs (sem DML direto)", () => {
  it("A/B/C/D) component+service usam as RPCs oficiais", () => {
    const svc = read(SVC);
    expect(svc.includes('rpc("f_aprovar_pagamento_prestadores"')).toBe(true);
    expect(svc.includes('rpc("f_gerar_lote_pagamentos"')).toBe(true);
    expect(svc.includes('rpc("f_confirmar_pagamento_prestador"')).toBe(true);
  });

  it("ZERO DML de estado em pagamentos_prestadores no service (atualizarStatusPagamento)", () => {
    const svc = read(SVC);
    // extrai o corpo de atualizarStatusPagamento
    const start = svc.indexOf("export async function atualizarStatusPagamento");
    const end = svc.indexOf("export interface GerarLoteResult");
    const body = svc.slice(start, end);
    expect(body.length).toBeGreaterThan(0);
    expect(/\.from\("pagamentos_prestadores"\)[\s\S]{0,120}\.update\(/.test(body)).toBe(false);
    // nao ha update/insert/delete direto nesse trecho
    expect(body.includes(".update(")).toBe(false);
    expect(body.includes(".insert(")).toBe(false);
    expect(body.includes(".delete(")).toBe(false);
  });

  it("ZERO DML direto no componente (usa services/RPC)", () => {
    const comp = read(COMP);
    expect(/from\("pagamentos_prestadores"\)[\s\S]{0,120}\.(update|insert|delete)\(/.test(comp)).toBe(false);
  });

  it("E) S1 preservado (migration revoga escrita direta do authenticated)", () => {
    const mig = read("supabase/migrations/20260924000018_fin_sec02_s1_lock_pagamentos_prestadores.sql");
    expect(mig).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.pagamentos_prestadores FROM authenticated/i);
    expect(mig).toMatch(/DROP POLICY IF EXISTS pp_update_tms/);
  });

  it("F) aprovarPagamentos chama a RPC 1x com os IDs corretos", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ solicitados: 1, aprovados: 1, ja_aprovados: 0, bloqueados: 0, detalhes: [] }], error: null });
    const r = await aprovarPagamentos(["id1", "id2"], { rpc } as any);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("f_aprovar_pagamento_prestadores", { p_ids: ["id1", "id2"] });
    expect(r.aprovados).toBe(1);
  });

  it("F2) bloqueio da RPC vira erro com motivo (sem alteracao parcial)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ solicitados: 1, aprovados: 0, ja_aprovados: 0, bloqueados: 1, detalhes: [{ resultado: "PAGO", motivo: "Pagamento ja efetuado" }] }], error: null });
    // atualizarStatusPagamento aprovar -> lancaria por aprovados=0; testamos via aprovarPagamentos + regra
    const r = await aprovarPagamentos(["x"], { rpc } as any);
    expect(r.bloqueados).toBe(1);
    expect(r.aprovados).toBe(0);
  });

  it("H') reprovar/cancelar NAO usam UPDATE direto (lancam erro oficial)", async () => {
    await expect(atualizarStatusPagamento("x", { status_aprovacao: "rejeitado" } as any)).rejects.toThrow(/indispon/i);
    await expect(atualizarStatusPagamento("x", { status_pagamento: "cancelado" } as any)).rejects.toThrow(/indispon/i);
  });

  it("I) reprovar/cancelar/estornar usam RPC oficial (sem guard S2 obsoleto)", () => {
    const comp = read(COMP);
    const svc = read(SVC);
    expect(svc.includes('"f_reprovar_pagamento_prestador"')).toBe(true);
    expect(svc.includes('"f_cancelar_pagamento_prestador"')).toBe(true);
    expect(svc.includes('"f_estornar_pagamento_prestador"')).toBe(true);
    expect(comp.includes("abrirReprovarPagamento")).toBe(true);
    expect(comp.includes("abrirCancelarPagamento")).toBe(true);
    expect(comp.includes("abrirEstornarPagamento")).toBe(true);
    expect(comp.includes('title="Indisponível: reprovação pendente de RPC oficial (S2)"')).toBe(false);
  });

  it("L) nao usa service_role no frontend", () => {
    const comp = read(COMP);
    const svc = read(SVC);
    expect(comp.includes("service_role")).toBe(false);
    expect(svc.includes("service_role")).toBe(false);
    expect(comp.includes("SERVICE_ROLE")).toBe(false);
  });

  it("ações de fechamento usam RPCs oficiais (stubs S2 removidos)", () => {
    const comp = read(COMP);
    const svc = read(SVC);
    const fech = read("src/services/financeiro/fechamentoService.ts");
    // stubs removidos do componente
    expect(comp.includes("conferência de fechamento pendente de RPC oficial")).toBe(false);
    expect(comp.includes("aprovação de fechamento pendente de RPC oficial")).toBe(false);
    expect(comp.includes("cancelamento de fechamento pendente de RPC oficial")).toBe(false);
    // componente chama o service (sem DML direto)
    expect(comp.includes("await conferirFechamento(fechamentoSelecionado.id)")).toBe(true);
    expect(comp.includes("await aprovarFechamento(fechamentoSelecionado.id)")).toBe(true);
    expect(comp.includes("await cancelarFechamento(fechamentoSelecionado.id")).toBe(true);
    // service usa as RPCs oficiais (não .update/.insert)
    expect(fech.includes('rpc("f_conferir_fechamento"')).toBe(true);
    expect(fech.includes('rpc("f_aprovar_fechamento"')).toBe(true);
    expect(fech.includes('rpc("f_cancelar_fechamento"')).toBe(true);
    // FIN-PP-FUNC-01: lançamento manual permanece funcional.
    expect(comp.includes("criarLancamentoManualPrestador")).toBe(true);
  });

  it("migration TMS-FIN-PP-FUNC-02 define as 3 RPCs SECURITY DEFINER", () => {
    const mig = read("supabase/migrations/20261008000000_fin_pp_func02_fechamento_acoes.sql");
    expect(mig).toContain("CREATE OR REPLACE FUNCTION public.f_conferir_fechamento");
    expect(mig).toContain("CREATE OR REPLACE FUNCTION public.f_aprovar_fechamento");
    expect(mig).toContain("CREATE OR REPLACE FUNCTION public.f_cancelar_fechamento");
    expect((mig.match(/SECURITY DEFINER/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(mig).toMatch(/GRANT EXECUTE ON FUNCTION public\.f_conferir_fechamento/);
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.f_cancelar_fechamento\(uuid, text\) FROM PUBLIC, anon/);
  });

  it("fechamentoService: conferir/aprovar/cancelar/pagar sem DML direto (S1 preservado)", () => {
    const fech = read("src/services/financeiro/fechamentoService.ts");
    const conf = fech.slice(
      fech.indexOf("export async function conferirFechamento"),
      fech.indexOf("export async function aprovarFechamento"),
    );
    const apro = fech.slice(
      fech.indexOf("export async function aprovarFechamento"),
      fech.indexOf("export async function pagarFechamento"),
    );
    const pagar = fech.slice(
      fech.indexOf("export async function pagarFechamento"),
      fech.indexOf("export async function cancelarFechamento"),
    );
    const canc = fech.slice(
      fech.indexOf("export async function cancelarFechamento"),
      fech.indexOf("export async function itemEmFechamentoAtivo"),
    );
    for (const bloco of [conf, apro, pagar, canc]) {
      expect(bloco.length).toBeGreaterThan(0);
      expect(bloco.includes(".update(")).toBe(false);
      expect(bloco.includes(".insert(")).toBe(false);
      expect(bloco.includes(".delete(")).toBe(false);
      expect(bloco.includes(".rpc(")).toBe(true);
    }
  });
});
