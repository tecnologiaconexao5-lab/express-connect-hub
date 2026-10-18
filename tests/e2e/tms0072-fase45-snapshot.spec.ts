// ============================================================
// TMS-007.2 FASE 4+5 — Constraints + 2a OS HML + Snapshot
// ============================================================
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const STORAGE_STATE_PATH = path.join("tests", "e2e", ".auth", "storageState.json");
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const OS_ID = "28640e7b-fbe5-4141-a59a-c5bead26d25a";
const PRESTADOR_ID = "5377592a-50e8-41d7-b8c5-b5c4509a3d56";
const VEICULO_ID = "e674550f-c577-4d14-956c-b83df5e903b0";

test.describe("TMS-007.2 FASE 4+5 — Constraints, 2a OS, Snapshot", () => {
  let token: string;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH, baseURL: "http://localhost:8800" });
    const page = await ctx.newPage();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });
    token = await page.evaluate(() => {
      const raw = localStorage.getItem("sb-uwrvzsjtpgaifkktpepn-auth-token");
      if (!raw) return "";
      return JSON.parse(raw).access_token || "";
    });
    await ctx.close();
    expect(token).toBeTruthy();
  });

  const headers = () => ({ Authorization: `Bearer ${token}`, apikey: ANON_KEY });

  test("UNIQUE constraints nas 4 tabelas financeiras", async () => {
    const tabelas = ["financeiro_receber", "financeiro_pagar", "pagamentos_prestadores", "composicao_financeira_os"];
    for (const t of tabelas) {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/${t}?select=*&limit=1`, { headers: headers() });
      if (resp.status !== 200) {
        console.log(`  ${t.padEnd(35)} ERRO HTTP ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      console.log(`  ${t.padEnd(35)} amostra: ${data.length} registros`);
      if (data.length > 0) {
        console.log(`    colunas: ${Object.keys(data[0]).join(", ")}`);
        console.log(`    os_id: ${data[0].os_id?.toString().slice(0, 36) || "(null)"}`);
      }
    }
  });

  test("Buscar 2a OS HML para Cenario B", async () => {
    // Procurar outras OS com status pendente, mesmo prestador ou veiculo HML
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/ordens_servico?select=id,numero,status,valor_cliente,custo_prestador,cliente,prestador,created_at&order=created_at.desc&limit=20`,
      { headers: headers() }
    );
    expect(resp.status).toBe(200);
    const osList = await resp.json();
    console.log(`  Total OS recentes: ${osList.length}`);
    for (const os of osList) {
      const marcadores = [];
      if (os.numero?.includes("HML") || os.numero?.includes("TESTE") || os.numero?.includes("hml")) marcadores.push("NUM_HML");
      if (os.prestador === PRESTADOR_ID || os.prestador?.toString().includes("5377")) marcadores.push("PREST_HML");
      if (os.valor_cliente === null || os.valor_cliente === 0) marcadores.push("SEM_VALOR");
      console.log(`  ID=${os.id.slice(0,8)} numero=${os.numero || "(sem numero)"} status=${os.status} valor_cliente=${os.valor_cliente} ${marcadores.join(" ")}`);
    }
  });

  test("Snapshot completo — financeiro_receber", async () => {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/financeiro_receber?select=*&limit=100`, { headers: headers() });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    console.log(`  Total: ${data.length}`);
    for (const r of data) {
      console.log(`  ${r.id?.slice(0,8)} os_id=${(r.os_id||"").slice(0,8)} valor=${r.valor} status=${r.status} cliente=${(r.cliente||"").slice(0,20)}`);
    }
  });

  test("Snapshot completo — financeiro_pagar", async () => {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/financeiro_pagar?select=*&limit=100`, { headers: headers() });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    console.log(`  Total: ${data.length}`);
    for (const r of data) {
      console.log(`  ${r.id?.slice(0,8)} os_id=${(r.os_id||"").slice(0,8)} valor=${r.valor} status=${r.status} fornecedor=${(r.fornecedor_nome||"").slice(0,20)}`);
    }
  });

  test("Snapshot completo — pagamentos_prestadores", async () => {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/pagamentos_prestadores?select=*&limit=100`, { headers: headers() });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    console.log(`  Total: ${data.length}`);
    for (const r of data) {
      console.log(`  ${r.id?.slice(0,8)} os_id=${(r.os_id||"").slice(0,8)} valor_liquido=${r.valor_liquido} valor_servicos=${r.valor_servicos} status_pagamento=${r.status_pagamento}`);
    }
  });

  test("Snapshot completo — composicao_financeira_os", async () => {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/composicao_financeira_os?select=*&limit=100`, { headers: headers() });
    expect(resp.status).toBe(200);
    const data = await resp.json();
    console.log(`  Total: ${data.length}`);
    for (const r of data) {
      console.log(`  ${r.id?.slice(0,8)} os_id=${(r.os_id||"").slice(0,8)} margem_bruta=${r.margem_bruta} margem_liquida=${r.margem_liquida} origem=${r.origem_calculo}`);
    }
  });

  test("Snapshot — alocacoes_escala da OS TESTE-001", async () => {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/alocacoes_escala?select=id,status,ordem_servico_id,prestador_id,veiculo,valor_frete,valor_repasse,valor_adicional,valor_ajudante,valor_desconto,created_at&ordem_servico_id=eq.${OS_ID}&limit=10`,
      { headers: headers() }
    );
    if (resp.status !== 200) {
      const text = await resp.text();
      console.log(`  ERRO HTTP ${resp.status}: ${text.slice(0,200)}`);
      return;
    }
    const data = await resp.json();
    console.log(`  Alocacoes da OS TESTE-001: ${data.length}`);
    for (const a of data) {
      console.log(`  ${a.id?.slice(0,8)} status=${a.status} valor_frete=${a.valor_frete} valor_repasse=${a.valor_repasse}`);
    }
  });
});
