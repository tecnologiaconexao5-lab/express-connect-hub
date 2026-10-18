// ============================================================
// TMS-007.2 FASE 2 — Pré-check HML via browser context
// ============================================================
// Usa page.evaluate() dentro do contexto autenticado do browser,
// onde o Supabase client ja possui a sessao ativa.
// ============================================================
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const STORAGE_STATE_PATH = path.join("tests", "e2e", ".auth", "storageState.json");

// IDs HML
const OS_ID = "28640e7b-fbe5-4141-a59a-c5bead26d25a";
const PRESTADOR_ID = "5377592a-50e8-41d7-b8c5-b5c4509a3d56";
const VEICULO_ID = "e674550f-c577-4d14-956c-b83df5e903b0";

test.describe("TMS-007.2 FASE 2 — Pre-check HML", () => {
  test("OS TESTE-001: dados e sem alocacao ativa", async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH, baseURL: "http://localhost:8800" });
    const page = await ctx.newPage();

    // Navegar para pagina que carrega Supabase
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });

    const result = await page.evaluate(async (osId) => {
      const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

      const sessionRaw = localStorage.getItem("sb-uwrvzsjtpgaifkktpepn-auth-token");
      if (!sessionRaw) return { erro: "sem sessao no localStorage" };
      const session = JSON.parse(sessionRaw);
      const token = session.access_token;
      if (!token) return { erro: "sem access_token" };

      const headers = { Authorization: `Bearer ${token}`, apikey: ANON_KEY };

      try {
        const osResp = await fetch(`${SUPABASE_URL}/rest/v1/ordens_servico?select=*&id=eq.${osId}`, { headers });
        const osText = await osResp.text();
        if (!osResp.ok) return { erro: `OS HTTP ${osResp.status}: ${osText.slice(0, 200)}` };
        const osData = JSON.parse(osText);
        if (osData.length === 0) return { erro: "OS nao encontrada" };

        const alocResp = await fetch(`${SUPABASE_URL}/rest/v1/alocacoes_escala?select=id,status&ordem_servico_id=eq.${osId}&status=neq.cancelado&limit=5`, { headers });
        const alocData = await alocResp.json();

      const os = osData[0];
      const prepagResp = await fetch(`${SUPABASE_URL}/rest/v1/pagamentos_prestadores?select=id,valor,status&os_id=eq.${osId}&limit=5`, { headers });
      const prepagText = await prepagResp.text();
      let prepagData: any[] = [];
      try { prepagData = JSON.parse(prepagText); } catch { prepagData = []; }

      return {
        os,
        alocacoes_ativas: alocData,
        pagamentos_prestadores: prepagData,
      };
      } catch (e: any) {
        return { erro: e.message || String(e) };
      }
    }, OS_ID);

    console.log(`  Resultado OS:`);
    if (result.erro) {
      console.log(`  ERRO: ${result.erro}`);
      expect(result.erro).toBeUndefined();
    } else {
      console.log(`  OS columns: ${Object.keys(result.os).join(", ")}`);
      console.log(`  numero: ${result.os.numero}`);
      console.log(`  status: ${result.os.status}`);
      console.log(`  valor_cliente: ${result.os.valor_cliente}`);
      console.log(`  valor_prestador: ${result.os.valor_prestador}`);
      console.log(`  adicionais: ${result.os.adicionais}`);
      console.log(`  ajudante: ${result.os.ajudante}`);
      console.log(`  descontos: ${result.os.descontos}`);
      console.log(`  alocacoes ativas: ${result.alocacoes_ativas.length}`);
      console.log(`  pagamentos prestador: ${result.pagamentos_prestadores.length}`);
      expect(result.alocacoes_ativas.length).toBe(0);
      expect(result.os.status).toBeTruthy();
    }

    await ctx.close();
  });

  test("Prestador HML: dados e sem financeiro ativo", async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH, baseURL: "http://localhost:8800" });
    const page = await ctx.newPage();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });

    const result = await page.evaluate(async (prestId) => {
      const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

      const sessionRaw = localStorage.getItem("sb-uwrvzsjtpgaifkktpepn-auth-token");
      if (!sessionRaw) return { erro: "sem sessao" };
      const token = JSON.parse(sessionRaw).access_token;
      const headers = { Authorization: `Bearer ${token}`, apikey: ANON_KEY };

      try {
        const pResp = await fetch(`${SUPABASE_URL}/rest/v1/prestadores?select=*&id=eq.${prestId}`, { headers });
        const pText = await pResp.text();
        if (!pResp.ok) return { erro: `Prestador HTTP ${pResp.status}: ${pText.slice(0, 200)}` };
        const pData = JSON.parse(pText);
        if (pData.length === 0) return { erro: "Prestador nao encontrado" };

        const finResp = await fetch(`${SUPABASE_URL}/rest/v1/financeiro_pagar?select=id,valor,status&fornecedor_id=eq.${prestId}&status=neq.cancelado&limit=5`, { headers });
        const finText = await finResp.text();
        let finData: any[] = [];
        try { finData = JSON.parse(finText); } catch { finData = []; }

        return { prestador: pData[0], contas_pagar_ativas: finData };
      } catch (e: any) {
        return { erro: e.message || String(e) };
      }
    }, PRESTADOR_ID);

    if (result.erro) {
      console.log(`  ERRO Prestador: ${result.erro}`);
      expect(result.erro).toBeUndefined();
    } else {
      console.log(`  Prestador columns: ${Object.keys(result.prestador).join(", ")}`);
      console.log(`  nome: ${result.prestador.nome_completo}`);
      console.log(`  documento: ${result.prestador.cpf_cnpj}`);
      console.log(`  status: ${result.prestador.status}`);
      const cpa = result.contas_pagar_ativas;
      if (Array.isArray(cpa)) {
        console.log(`  contas a pagar ativas: ${cpa.length} (fornecedor_id)`);
      } else {
        console.log(`  contas a pagar ativas: erro (${JSON.stringify(cpa).slice(0,100)})`);
      }
    }

    await ctx.close();
  });

  test("Veiculo HML001: dados e sem tracking", async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH, baseURL: "http://localhost:8800" });
    const page = await ctx.newPage();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });

    const result = await page.evaluate(async (veicId) => {
      const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

      const sessionRaw = localStorage.getItem("sb-uwrvzsjtpgaifkktpepn-auth-token");
      if (!sessionRaw) return { erro: "sem sessao" };
      const token = JSON.parse(sessionRaw).access_token;
      const headers = { Authorization: `Bearer ${token}`, apikey: ANON_KEY };

      try {
        const vResp = await fetch(`${SUPABASE_URL}/rest/v1/veiculos?select=id,placa,renavam,status&id=eq.${veicId}`, { headers });
        if (!vResp.ok) return { erro: `Veiculo HTTP ${vResp.status}` };
        const vData = await vResp.json();
        if (vData.length === 0) return { erro: "Veiculo nao encontrado" };

        const trResp = await fetch(`${SUPABASE_URL}/rest/v1/portal_tracking_realtime?select=id&veiculo_id=eq.${veicId}&limit=5`, { headers });
        const trData = await trResp.json();

        return { veiculo: vData[0], tracking: trData };
      } catch (e: any) {
        return { erro: e.message || String(e) };
      }
    }, VEICULO_ID);

    if (result.erro) {
      console.log(`  ERRO Veiculo: ${result.erro}`);
      expect(result.erro).toBeUndefined();
    } else {
      console.log(`  placa: ${result.veiculo.placa}`);
      console.log(`  renavam: ${result.veiculo.renavam}`);
      console.log(`  status: ${result.veiculo.status}`);
      console.log(`  tracking: ${result.tracking.length}`);
    }

    await ctx.close();
  });

  test("Nenhum financeiro residual da OS", async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH, baseURL: "http://localhost:8800" });
    const page = await ctx.newPage();

    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30000 });

    const result = await page.evaluate(async (osId) => {
      const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

      const sessionRaw = localStorage.getItem("sb-uwrvzsjtpgaifkktpepn-auth-token");
      if (!sessionRaw) return { erro: "sem sessao" };
      const token = JSON.parse(sessionRaw).access_token;
      const headers = { Authorization: `Bearer ${token}`, apikey: ANON_KEY };

      const tabelas = [
        { nome: "financeiro_receber", filtro: `os_id=eq.${osId}` },
        { nome: "financeiro_pagar", filtro: `os_id=eq.${osId}` },
        { nome: "pagamentos_prestadores", filtro: `os_id=eq.${osId}` },
        { nome: "composicao_financeira_os", filtro: `os_id=eq.${osId}` },
      ];

      const resultados: Record<string, number | string> = {};
      for (const t of tabelas) {
        try {
          const resp = await fetch(`${SUPABASE_URL}/rest/v1/${t.nome}?select=id&${t.filtro}&limit=5`, { headers });
          if (!resp.ok) {
            resultados[t.nome] = `HTTP ${resp.status}`;
          } else {
            const data = await resp.json();
            resultados[t.nome] = data.length;
          }
        } catch (e: any) {
          resultados[t.nome] = `erro: ${e.message}`;
        }
      }
      return resultados;
    }, OS_ID);

    if (result.erro) {
      console.log(`  ERRO: ${result.erro}`);
      expect(result.erro).toBeUndefined();
    } else {
      for (const [tabela, qtd] of Object.entries(result)) {
        console.log(`  ${tabela.padEnd(35)} ${qtd} registros`);
        if (typeof qtd === "number") {
          expect(qtd).toBe(0);
        } else {
          expect(qtd).toBe(0); // Will fail with error message
        }
      }
    }

    await ctx.close();
  });
});
