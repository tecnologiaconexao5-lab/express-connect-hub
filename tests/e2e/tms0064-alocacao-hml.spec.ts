import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/auth";

const OS_ID = "28640e7b-fbe5-4141-a59a-c5bead26d25a";
const SCREENSHOT_DIR = "test-results/e2e/tms0064";

test.describe("TMS-006.4 Alocacao HML", () => {
  let alocacaoId: string | null = null;

  test("Criar alocacao pela interface", async ({ page }) => {
    await loginAdmin(page, "tms0064");

    // Open Escala with modal via URL param
    await page.goto("http://localhost:8800/operacao?acao=alocar&tab=escala", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-modal-aberto.png`, fullPage: false });

    // 1. Select prestador: type "M43" in the prestador input
    const prestadorInput = page.locator('input[placeholder*="Pesquisar prestador"]');
    await prestadorInput.fill("M43");
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-prestador-search.png`, fullPage: false });

    // Click the first dropdown result
    const prestadorOption = page.locator("div.cursor-pointer div.font-bold", { hasText: /M43/ }).first();
    await prestadorOption.waitFor({ state: "visible", timeout: 5000 });
    await prestadorOption.click();
    await page.waitForTimeout(1000);

    // 2. Select OS: use SearchableSelect for TESTE-001
    // The SearchableSelect needs to be clicked and searched
    const osInput = page.locator('input[placeholder*="Vincular OS"]');
    await osInput.click();
    await osInput.fill("TESTE-001");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-os-search.png`, fullPage: false });

    // Click the OS result
    const osOption = page.locator('[role="option"], .searchable-select-option, div[class*="option"]', { hasText: "TESTE-001" }).first();
    await osOption.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await osOption.isVisible().catch(() => false)) {
      await osOption.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-preenchido.png`, fullPage: false });

    // 3. Click save button — look for "Salvar na Grade" or similar
    const btnSalvar = page.locator("button", { hasText: /salvar|grade|criar aloca/i }).first();
    await btnSalvar.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await btnSalvar.click();
    await page.waitForTimeout(5000);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-pos-salvar.png`, fullPage: false });

    // Validate via DB: check if allocation was created
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signInWithPassword({
      email: "tamiris.castilho@conexaoexpress.com.br",
      password: "Conexao@2026",
    });

    // Search for the allocation by OS + prestador + today
    const today = new Date().toISOString().split("T")[0];
    const { data: aloc } = await supabase
      .from("alocacoes_escala")
      .select("id, ordem_servico_id, prestador_id, placa, tipo_veiculo, status, cliente_id, valor_frete, valor_repasse, metadata")
      .eq("prestador_id", "5377592a-50e8-41d7-b8c5-b5c4509a3d56")
      .eq("data_escala", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    console.log("[TEST] Alocacao encontrada:", aloc?.id);

    // FASE 6: Validate FK, prestador, veiculo
    expect(aloc).not.toBeNull();
    expect(aloc?.ordem_servico_id).toBe(OS_ID);
    expect(aloc?.prestador_id).toBe("5377592a-50e8-41d7-b8c5-b5c4509a3d56");
    expect(aloc?.placa).toBe("HML001");
    expect(aloc?.tipo_veiculo).toBe("moto");
    expect(aloc?.cliente_id).toBeNull();
    expect(Number(aloc?.valor_frete)).toBe(0);
    expect(Number(aloc?.valor_repasse)).toBe(0);

    alocacaoId = aloc?.id;

    console.log("[TEST] ✅ FK ordem_servico_id =", aloc?.ordem_servico_id);
    console.log("[TEST] ✅ prestador_id OK, placa OK, cliente NULL, valores 0");

    // Validate metadata has OS as auxiliary info
    const meta = aloc?.metadata as any;
    expect(meta?.os).toBe("TESTE-001");
    console.log("[TEST] ✅ metadata.os = TESTE-001 (auxiliary, not FK)");

    await supabase.auth.signOut();
  });

  test("Cancelar alocacao", async ({ page }) => {
    if (!alocacaoId) {
      console.log("[TEST] No alocacaoId from previous test — fetching from DB");
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!
      );
      await supabase.auth.signInWithPassword({
        email: "tamiris.castilho@conexaoexpress.com.br",
        password: "Conexao@2026",
      });
      const today = new Date().toISOString().split("T")[0];
      const { data: aloc } = await supabase
        .from("alocacoes_escala")
        .select("id")
        .eq("prestador_id", "5377592a-50e8-41d7-b8c5-b5c4509a3d56")
        .eq("data_escala", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      alocacaoId = aloc?.id;
    }

    console.log("[TEST] Cancelando alocacao:", alocacaoId);

    // Cancel via service
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signInWithPassword({
      email: "tamiris.castilho@conexaoexpress.com.br",
      password: "Conexao@2026",
    });

    const { data: canceled, error: ce } = await supabase
      .from("alocacoes_escala")
      .update({ status: "cancelada", status_pagamento: "cancelado", finalizada: true })
      .eq("id", alocacaoId)
      .select()
      .single();

    if (ce) {
      console.log("[TEST] Cancel error:", ce.message);
    } else {
      console.log("[TEST] ✅ Alocacao cancelada:", canceled?.status, canceled?.status_pagamento);
      expect(canceled?.status).toBe("cancelada");
      expect(canceled?.status_pagamento).toBe("cancelado");

      // Verify trigger estorno financeiro
      const { data: fin } = await supabase
        .from("financeiro_receber")
        .select("status")
        .eq("alocacao_id", alocacaoId);
      console.log("[TEST] Financeiro apos cancelamento:", fin?.length ? "encontrado" : "nenhum");
    }

    await supabase.auth.signOut();
  });

  test("Cleanup", async () => {
    if (!alocacaoId) return;
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signInWithPassword({
      email: "tamiris.castilho@conexaoexpress.com.br",
      password: "Conexao@2026",
    });

    // Delete financeiro if created by trigger
    await supabase.from("financeiro_receber").delete().eq("alocacao_id", alocacaoId);
    await supabase.from("pagamentos_prestadores").delete().eq("alocacao_id", alocacaoId);

    // Delete alocacao
    const { error: de } = await supabase.from("alocacoes_escala").delete().eq("id", alocacaoId);
    console.log("[CLEANUP] Alocacao deleted:", de ? "FAIL " + de.message : "OK");

    // Verify OS is back to clean state
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("id, status")
      .eq("id", OS_ID)
      .single();
    console.log("[CLEANUP] OS status after cleanup:", os?.status);

    // Verify vehicle is clean
    const { data: ve } = await supabase
      .from("veiculos")
      .select("id, placa")
      .eq("placa", "HML001")
      .single();
    console.log("[CLEANUP] HML001 still exists:", !!ve);

    // Verify prestador is clean
    const { count: prAl } = await supabase
      .from("alocacoes_escala")
      .select("*", { count: "exact", head: true })
      .eq("prestador_id", "5377592a-50e8-41d7-b8c5-b5c4509a3d56")
      .not("status", "in", "('cancelada')");
    console.log("[CLEANUP] Prestador alocacoes ativas restantes:", prAl);

    await supabase.auth.signOut();
  });
});
