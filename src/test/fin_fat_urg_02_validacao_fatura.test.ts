// ═══════════════════════════════════════════════════════════════════════════════
// TMS-FAT-URG-02 — VALIDAÇÃO DE FATURA + TENANT EXPLÍCITO
// Testes determinísticos (sem banco):
//   A) lançamento manual envia tenant_id explícito
//   B) criar fatura NÃO cria AR prematuramente
//   C) rascunho -> aguardando_aprovacao (RPC, sem AR)
//   D) aprovação NÃO cria AR
//   E) aprovação -> emissão oficial (FaturaPanel por estado)
//   F) emissão cria exatamente 1 AR (contrato f_emitir_fatura)
//   G) idempotência / sem duplicação
//   H) serviço já vinculado não pode ser faturado novamente
//   I) tenant/perfil incorreto bloqueado (RPC)
//   + sem confirm/alert/prompt nativo na tela Faturas
// ═══════════════════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const SQL_MOVER = "supabase/migrations/20260925000000_fin_fat_urg_02_validacao_fatura_rpc.sql";
const SQL_EMITIR = "supabase/migrations/20260924000000_fin_prog04b_numero_cliente_emissao_oficial.sql";
const SQL_FASE2A = "supabase/migrations/20260816000001_fase2a_faturamento_profissional.sql";
const SRC_FATURA_SERVICE = "src/services/financeiro/faturaService.ts";
const SRC_FATURA_PANEL = "src/components/financeiro/FaturaPanel.tsx";
const SRC_FATURA_LISTA = "src/components/financeiro/FaturaLista.tsx";
const SRC_CONFERENCIA = "src/components/financeiro/ConferenciaFinanceira.tsx";

const H = vi.hoisted(() => {
  const inserts: Array<{ table: string; payload: unknown }> = [];
  const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpcResponses: Record<string, unknown> = {};
  const makeBuilder = (table: string, result: unknown) => {
    const methods: Record<string, unknown> = {};
    const self = () => methods;
    methods.insert = (payload: unknown) => {
      inserts.push({ table, payload });
      return makeBuilder(table, { data: { id: "novo-id" }, error: null });
    };
    ["select", "eq", "neq", "in", "gte", "lte", "order", "limit", "range", "update", "delete", "contains", "returns"].forEach((m) => { methods[m] = self; });
    methods.maybeSingle = () => Promise.resolve(result);
    methods.single = () => Promise.resolve(result);
    methods.then = (onf?: (v: unknown) => unknown) => Promise.resolve(result).then(onf);
    return methods;
  };
  const from = (table: string) => makeBuilder(table, { data: [], error: null });
  const rpc = (name: string, args: Record<string, unknown>) => {
    rpcs.push({ name, args });
    return Promise.resolve(rpcResponses[name] ?? { data: { success: true }, error: null });
  };
  const auth = { getUser: () => Promise.resolve({ data: { user: { id: "U1" } } }) };
  return { inserts, rpcs, rpcResponses, from, rpc, auth };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { from: H.from, rpc: H.rpc, auth: H.auth },
}));

beforeEach(() => {
  vi.resetModules();
  H.inserts.length = 0;
  H.rpcs.length = 0;
  Object.keys(H.rpcResponses).forEach((k) => delete H.rpcResponses[k]);
});
afterEach(() => { vi.restoreAllMocks(); });

describe("TMS-FAT-URG-02 — tenant explícito no lançamento manual", () => {
  it("A) lancarServicoManual envia tenant_id explícito e grava como concluída/finalizada", async () => {
    const { lancarServicoManual } = await import("@/services/financeiro/centralFinanceiroService");
    const res = await lancarServicoManual({
      data_escala: "2026-09-25",
      tipo_veiculo: "Van",
      tenant_id: "T-EXPLICIT",
    });
    expect(res.success).toBe(true);
    const ins = H.inserts.find((i) => i.table === "alocacoes_escala");
    expect(ins).toBeTruthy();
    const payload = (Array.isArray(ins!.payload) ? ins!.payload[0] : ins!.payload) as Record<string, unknown>;
    expect(payload.tenant_id).toBe("T-EXPLICIT");
    expect(payload.status).toBe("concluida");
    expect(payload.finalizada).toBe(true);
  });

  it("A2) Conferência passa tenant do contexto oficial (useTenant) ao lançamento", () => {
    const src = read(SRC_CONFERENCIA);
    expect(src).toMatch(/tenant_id:\s*tenant\?\.id\s*\|\|\s*null/);
  });
});

describe("TMS-FAT-URG-02 — validação NÃO é receber", () => {
  it("C) enviar para validação chama RPC com p_novo_status=aguardando_aprovacao (sem AR)", async () => {
    H.rpcResponses["f_mover_fatura_status"] = { data: { success: true, status: "aguardando_aprovacao", status_anterior: "rascunho", idempotente: false }, error: null };
    const svc = await import("@/services/financeiro/faturaService");
    const res = await svc.enviarFaturaParaValidacao("F1");
    expect(res.success).toBe(true);
    expect(res.status).toBe("aguardando_aprovacao");
    const call = H.rpcs.find((r) => r.name === "f_mover_fatura_status");
    expect(call?.args).toEqual({ p_fatura_id: "F1", p_novo_status: "aguardando_aprovacao" });
    expect(H.inserts.find((i) => i.table === "financeiro_receber")).toBeFalsy();
  });

  it("D) aprovar chama RPC com p_novo_status=aprovada (sem AR)", async () => {
    H.rpcResponses["f_mover_fatura_status"] = { data: { success: true, status: "aprovada", status_anterior: "aguardando_aprovacao", idempotente: false }, error: null };
    const svc = await import("@/services/financeiro/faturaService");
    const res = await svc.aprovarFatura("F9");
    expect(res.success).toBe(true);
    const call = H.rpcs.filter((r) => r.name === "f_mover_fatura_status").pop();
    expect(call?.args.p_novo_status).toBe("aprovada");
    expect(H.inserts.find((i) => i.table === "financeiro_receber")).toBeFalsy();
  });

  it("G) idempotência: RPC retorna idempotente=true sem erro", async () => {
    H.rpcResponses["f_mover_fatura_status"] = { data: { success: true, status: "aprovada", status_anterior: "aprovada", idempotente: true }, error: null };
    const svc = await import("@/services/financeiro/faturaService");
    const res = await svc.aprovarFatura("F2");
    expect(res.success).toBe(true);
    expect(res.idempotente).toBe(true);
  });

  it("G2) transição inválida propagada da RPC (sem sucesso silencioso)", async () => {
    H.rpcResponses["f_mover_fatura_status"] = { data: { success: false, error: "TRANSICAO_INVALIDA" }, error: null };
    const svc = await import("@/services/financeiro/faturaService");
    const res = await svc.enviarFaturaParaValidacao("F3");
    expect(res.success).toBe(false);
    expect(res.error).toBe("TRANSICAO_INVALIDA");
  });

  it("G3) status inválido é rejeitado no client antes da RPC", async () => {
    const svc = await import("@/services/financeiro/faturaService");
    const res = await svc.moverStatusFatura("F4", "emitida" as never);
    expect(res.success).toBe(false);
    expect(H.rpcs.length).toBe(0);
  });
});

describe("TMS-FAT-URG-02 — SQL da RPC de validação", () => {
  const sql = read(SQL_MOVER);

  it("B/D) NÃO cria financeiro_receber nem toca conta_receber_id", () => {
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.financeiro_receber/i);
    expect(sql.toLowerCase()).not.toContain("conta_receber_id =");
  });

  it("I) exige autenticação, perfil e tenant (guards)", () => {
    expect(sql).toContain("USUARIO_NAO_AUTENTICADO");
    expect(sql).toContain("SEM_PERMISSAO_PERFIL");
    expect(sql).toContain("SEM_PERMISSAO_TENANT");
    expect(sql).toContain("TRANSICAO_INVALIDA");
    expect(sql).toContain("FATURA_NAO_ENCONTRADA");
    expect(sql).toContain("FATURA_JA_EMITIDA");
    expect(sql).toContain("FATURA_CANCELADA");
  });

  it("segurança: SECURITY DEFINER + search_path fixo + grants sem anon", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toMatch(/SET search_path TO 'public'/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.f_mover_fatura_status\(uuid, text\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.f_mover_fatura_status\(uuid, text\) TO authenticated, service_role/);
  });

  it("G) idempotência implementada (já no estado => success)", () => {
    expect(sql).toContain("'idempotente', true");
    expect(sql).toMatch(/v_fatura\.status = p_novo_status/);
  });

  it("transições permitidas são apenas as pré-emissão", () => {
    expect(sql).toMatch(/'rascunho'\s+AND p_novo_status = 'aguardando_aprovacao'/);
    expect(sql).toMatch(/'aguardando_aprovacao' AND p_novo_status = 'aprovada'/);
    expect(sql).toMatch(/p_novo_status NOT IN \('rascunho','aguardando_aprovacao','aprovada'\)/);
  });
});

describe("TMS-FAT-URG-02 — emissão oficial permanece a única criadora de AR", () => {
  it("B) criarRascunhoFatura no service não insere em financeiro_receber", () => {
    const src = read(SRC_FATURA_SERVICE);
    expect(src).not.toMatch(/from\("financeiro_receber"\)\s*\n?\s*\.insert/);
  });

  it("F) f_emitir_fatura é o único ponto que cria AR (1 insert) + UNIQUE por fatura", () => {
    const emit = read(SQL_EMITIR);
    const ocorrencias = (emit.match(/INSERT\s+INTO\s+public\.financeiro_receber/gi) || []).length;
    expect(ocorrencias).toBe(1);
    expect(emit).toContain("uq_receber_fatura_id");
    expect(emit).toContain("fatura_id");
  });

  it("E) FaturaPanel separa as ações por estado (Enviar/Aprovar/Emitir)", () => {
    const src = read(SRC_FATURA_PANEL);
    expect(src).toContain("Enviar para Validação");
    expect(src).toContain("Aprovar Fatura");
    expect(src).toContain("Emitir Fatura");
    expect(src).toContain("enviarFaturaParaValidacao");
    expect(src).toContain("aprovarFatura");
    expect(src).not.toContain("Validar e Emitir Fatura");
  });
});

describe("TMS-FAT-URG-02 — duplicidade e Conferência", () => {
  it("H) anti-duplicidade de serviço faturado existe no banco", () => {
    const fase2a = read(SQL_FASE2A);
    expect(fase2a).toContain("SERVIÇO_JA_FATURADO");
    expect(fase2a).toContain("trg_fatura_itens_anti_duplicidade");
  });

  it("H2) Conferência bloqueia item que já está no processo de faturamento", () => {
    const src = read(SRC_CONFERENCIA);
    expect(src).toContain('a.faturamento.status !== "nao_faturado"');
    expect(src).toContain('a.faturamento.status === "faturado" ? "Já faturado" : "Em rascunho de fatura"');
  });
});

describe("TMS-FAT-URG-02 — UX sem diálogos nativos na tela Faturas", () => {
  it("FaturaLista não usa confirm/alert/prompt nativos e usa AlertDialog", () => {
    const src = read(SRC_FATURA_LISTA);
    expect(src).not.toMatch(/\bconfirm\(/);
    expect(src).not.toMatch(/\balert\(/);
    expect(src).not.toMatch(/\bprompt\(/);
    expect(src).toContain("AlertDialog");
    expect(src).toContain("STATUS_LABEL");
  });
});
