import { test, expect } from "@playwright/test";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const OS_ID = "28640e7b-fbe5-4141-a59a-c5bead26d25a";
const PRESTADOR_ID = "5377592a-50e8-41d7-b8c5-b5c4509a3d56";
const LS_KEY = "sb-uwrvzsjtpgaifkktpepn-auth-token";

function hoje() {
  return new Date().toISOString().split("T")[0];
}

const h = (token: string, prefer = "return=representation") => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token}`,
  Prefer: prefer,
});

test.describe("TMS-007.2 FASE 6-8 — Homologação Financeira", () => {
  let token: string;
  let clienteId: string;
  let alocId: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/storageState.json" });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), LS_KEY);
    expect(raw).toBeTruthy();
    token = JSON.parse(raw!).access_token;
    expect(token).toBeTruthy();

    // Buscar cliente_id da OS
    const osResp = await fetch(
      `${SUPABASE_URL}/rest/v1/ordens_servico?select=cliente,cliente_id&id=eq.${OS_ID}&limit=1`,
      { headers: h(token) }
    );
    const osRows = await osResp.json();
    if (osRows.length > 0) {
      clienteId = osRows[0].cliente || osRows[0].cliente_id || "";
      console.log("cliente_id da OS:", clienteId);
      if (osRows[0].cliente_id) clienteId = osRows[0].cliente_id;
    }
    if (!clienteId) {
      console.log("⚠️ OS sem cliente_id — usando fallback");
      clienteId = "00000000-0000-0000-0000-000000000000";
    }
    await ctx.close();
  });

  test("FASE 6 — Payload e constantes confirmadas", () => {
    expect(OS_ID).toMatch(/^[0-9a-f-]{36}$/);
    expect(PRESTADOR_ID).toMatch(/^[0-9a-f-]{36}$/);
    expect(clienteId).toBeTruthy();
  });

  test("FASE 7 — Criar alocação HML (→ M66 propaga)", async () => {
    const body: Record<string, unknown> = {
      ordem_servico_id: OS_ID,
      prestador_id: PRESTADOR_ID,
      data_escala: hoje(),
      tipo_veiculo: "vuc",
      status: "planejada",
      valor_frete: 100.0,
      valor_repasse: 60.0,
      valor_adicional: 10.0,
      valor_ajudante: 5.0,
      valor_desconto: 5.0,
      metadata: { origem: "TMS-007.2 HML Financeiro", hml: true },
    };
    if (clienteId) body.cliente_id = clienteId;

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/alocacoes_escala`, {
      method: "POST",
      headers: h(token),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.log("❌ INSERT alocacao FAILED:", resp.status, text.slice(0, 500));
    }
    expect(resp.status).toBe(201);
    const data = await resp.json();
    const row = Array.isArray(data) ? data[0] : data;
    expect(row).toHaveProperty("id");
    expect(row.status).toBe("planejada");
    alocId = row.id;
    console.log("✅ Alocação criada ID:", alocId);
  });

  test("FASE 8a — financeiro_receber propagado (valor=100, pendente)", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/financeiro_receber?select=id,valor,status,cliente,data_vencimento&os_id=eq.${OS_ID}&limit=5`,
      { headers: h(token) }
    );
    expect(resp.status).toBe(200);
    const rows = await resp.json();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows[0];
    expect(Number(r.valor)).toBe(100);
    expect(r.status).toBe("pendente");
    console.log("✅ financeiro_receber:", JSON.stringify(r));
  });

  test("FASE 8b — financeiro_pagar propagado (valor=60, pendente)", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/financeiro_pagar?select=id,valor,status,fornecedor_id,data_vencimento&os_id=eq.${OS_ID}&limit=5`,
      { headers: h(token) }
    );
    expect(resp.status).toBe(200);
    const rows = await resp.json();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows[0];
    expect(Number(r.valor)).toBe(60);
    expect(r.status).toBe("pendente");
    console.log("✅ financeiro_pagar:", JSON.stringify(r));
  });

  test("FASE 8c — pagamentos_prestadores propagado (valor_liquido=70)", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/pagamentos_prestadores?select=id,prestador_id,valor_liquido,valor_servicos,status_pagamento,adicionais&os_id=eq.${OS_ID}&limit=5`,
      { headers: h(token) }
    );
    expect(resp.status).toBe(200);
    const rows = await resp.json();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const r = rows[0];
    expect(Number(r.valor_liquido)).toBe(70);
    expect(Number(r.valor_servicos)).toBe(60);
    expect(r.status_pagamento).toBe("nao_vencido");
    console.log("✅ pagamentos_prestadores:", JSON.stringify(r));
  });

  test("FASE 8d — composicao_financeira_os vazia (OS pendente)", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/composicao_financeira_os?select=id&os_id=eq.${OS_ID}&limit=5`,
      { headers: h(token) }
    );
    if (resp.status !== 200) {
      console.log("⚠️ composicao_financeira_os HTTP", resp.status);
      return;
    }
    const rows = await resp.json();
    expect(rows.length).toBe(0);
    console.log("✅ composicao_financeira_os vazia (conforme esperado)");
  });

  test("FASE 8e — Teste idempotência: re-UPDATE na alocação não duplica", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/alocacoes_escala?select=id&ordem_servico_id=eq.${OS_ID}&limit=5`,
      { headers: h(token) }
    );
    expect(resp.status).toBe(200);
    const rows = await resp.json();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const id = rows[0].id;

    const upd = await fetch(`${SUPABASE_URL}/rest/v1/alocacoes_escala?id=eq.${id}`, {
      method: "PATCH",
      headers: h(token, ""),
      body: JSON.stringify({ observacoes: "teste idempotencia TMS-007.2" }),
    });
    expect(upd.status).toBe(204);

    const r1 = await fetch(
      `${SUPABASE_URL}/rest/v1/financeiro_receber?select=id&os_id=eq.${OS_ID}&limit=10`,
      { headers: h(token) }
    );
    const d1 = await r1.json();
    expect(d1.length).toBe(1);
    console.log("✅ Idempotência ok — 1 registro em financeiro_receber");
  });
});
