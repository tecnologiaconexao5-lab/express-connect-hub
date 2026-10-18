import { test, expect } from "@playwright/test";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const LS_KEY = "sb-uwrvzsjtpgaifkktpepn-auth-token";

const h = (token: string) => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token}`,
});

test.describe("Schema check", () => {
  let token: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/storageState.json" });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const raw = await page.evaluate((k: string) => localStorage.getItem(k), LS_KEY);
    token = JSON.parse(raw!).access_token;
    await ctx.close();
  });

  test("alocacoes_escala columns", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/alocacoes_escala?select=*&limit=1`,
      { headers: h(token) }
    );
    expect(resp.status).toBe(200);
    const rows = await resp.json();
    if (rows.length === 0) {
      console.log("alocacoes_escala vazia — sem amostra");
      return;
    }
    console.log("Colunas:", Object.keys(rows[0]).join(", "));
    console.log("Amostra:", JSON.stringify(rows[0], null, 2));
  });

  test("financeiro_receber columns", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/financeiro_receber?select=*&limit=1`,
      { headers: h(token) }
    );
    expect(resp.status).toBe(200);
    const rows = await resp.json();
    if (rows.length === 0) return;
    console.log("fr colunas:", Object.keys(rows[0]).join(", "));
  });

  test("financeiro_pagar columns", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/financeiro_pagar?select=*&limit=1`,
      { headers: h(token) }
    );
    expect(resp.status).toBe(200);
    const rows = await resp.json();
    if (rows.length === 0) return;
    console.log("fp colunas:", Object.keys(rows[0]).join(", "));
  });

  test("pagamentos_prestadores columns", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/pagamentos_prestadores?select=*&limit=1`,
      { headers: h(token) }
    );
    expect(resp.status).toBe(200);
    const rows = await resp.json();
    if (rows.length === 0) return;
    console.log("pp colunas:", Object.keys(rows[0]).join(", "));
  });

  test("distinct status em alocacoes_escala", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/alocacoes_escala?select=status&limit=100&order=created_at.desc`,
      { headers: h(token) }
    );
    expect(resp.status).toBe(200);
    const rows = await resp.json();
    const statuses = [...new Set(rows.map((r: any) => r.status))];
    console.log("Statuses:", statuses.join(", "));
    const sp = [...new Set(rows.map((r: any) => r.status_pagamento).filter(Boolean))];
    console.log("Status pagamento:", sp.join(", "));
  });
});
