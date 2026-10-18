/**
 * SEED PORTAL CLIENTE DEMO — Ambiente DEV apenas
 * Cria dados de demonstracao para o Portal Cliente.
 * Todos os dados sao marcados com [DEV DEMO].
 * Nao executar em producao.
 * 
 * Passos:
 * 1. Atualiza cliente existente com nome amigavel
 * 2. Cria usuarios_cliente vinculando contato@ ao cliente
 * 3. Atualiza ordens_servico com cliente_id
 * 4. Cria patio_checkins para as OS
 * 5. Atualiza alocacoes_escala com cliente_id e OS link
 */
const { chromium } = require("playwright");
const { guardHarness } = require("./_guard.cjs");

// TMS-FIN-DATA-04D2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/seed_portal_cliente_demo.cjs");

// TMS-FIN-DATA-04D2 — sem hardcode de PROD/anon. Somente ambiente validado pelo guard.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const CLIENTE_ID = "cd463c93-5190-408e-b5e6-ee639b688402";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const UNIDADE_ID = "426800fa-fb59-4d35-9670-1147180e34ec";
const DOCA_01 = "2b715ead-a7af-49f0-9458-d33c2f16347a";
const DOCA_02 = "ca23f9c8-8fb0-4268-ab32-d69155b65119";

async function api(page, method, path, body = null) {
  return await page.evaluate(async ({ url, key, method, path, body }) => {
    const token = (() => {
      const k = Object.keys(localStorage).find(k => k.includes("auth-token"));
      if (!k) return null;
      try { return JSON.parse(localStorage.getItem(k)).access_token; }
      catch { return null; }
    })();
    const opts = {
      method,
      headers: { "apikey": key, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
    };
    if (body && (method === "POST" || method === "PATCH")) {
      opts.body = JSON.stringify(body);
    }
    if (method === "POST" && path.includes("?") === false) {
      opts.headers["Prefer"] = "return=representation";
    }
    const r = await fetch(`${url}/rest/v1/${path}`, opts);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: r.ok, status: r.status, data };
  }, { url: SUPABASE_URL, key: ANON_KEY, method, path, body });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login as tamiris (super_admin)
  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "tamiris.castilho@conexaoexpress.com.br");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(2000);

  // =============================================
  // STEP 0: Get contato auth user ID
  // =============================================
  console.log("=== STEP 0: Auth ID do contato ===");
  const contatoPage = await browser.newPage();
  await contatoPage.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await contatoPage.waitForTimeout(1000);
  await contatoPage.fill('input[type="email"]', "contato@conexaoexpress.com.br");
  await contatoPage.fill('input[type="password"]', "Admin@123");
  await contatoPage.click('button[type="submit"]');
  await contatoPage.waitForTimeout(3000);
  const contatoAuthId = await contatoPage.evaluate(() => {
    const k = Object.keys(localStorage).find(k => k.includes("auth-token"));
    if (!k) return null;
    try { return JSON.parse(localStorage.getItem(k)).user?.id; }
    catch { return null; }
  });
  console.log(`contato auth ID: ${contatoAuthId}`);
  await contatoPage.close();

  // =============================================
  // STEP 1: Update cliente name
  // =============================================
  console.log("\n=== STEP 1: Atualizar nome do cliente ===");
  const r1 = await api(page, "PATCH", `clientes?id=eq.${CLIENTE_ID}`, {
    nome_fantasia: "Empresa Demo Ltda [DEV DEMO]",
    razao_social: "Empresa Demo Ltda"
  });
  console.log(`PATCH clientes: ${r1.ok ? "OK" : "FAIL"} ${r1.status}`);

  // =============================================
  // STEP 2: Create usuarios_cliente
  // =============================================
  console.log("\n=== STEP 2: Criar usuarios_cliente ===");
  // Delete existing if any
  await api(page, "DELETE", `usuarios_cliente?auth_user_id=eq.${contatoAuthId}`);
  const r2 = await api(page, "POST", "usuarios_cliente", {
    auth_user_id: contatoAuthId,
    cliente_id: CLIENTE_ID,
    ativo: true
  });
  console.log(`POST usuarios_cliente: ${r2.ok ? "OK" : "FAIL"} ${r2.status}`);
  if (!r2.ok) console.log(`  Error: ${JSON.stringify(r2.data)}`);

  // =============================================
  // STEP 3: Update ordens_servico
  // =============================================
  console.log("\n=== STEP 3: Atualizar ordens_servico ===");
  const osList = (await api(page, "GET", `ordens_servico?select=id,numero,status,cliente_id&order=created_at.desc&limit=10`)).data || [];
  let count1 = 0;
  for (const os of osList) {
    if (!os.cliente_id) {
      const r = await api(page, "PATCH", `ordens_servico?id=eq.${os.id}`, { cliente_id: CLIENTE_ID });
      if (r.ok) count1++;
    }
  }
  console.log(`Updated ${count1}/${osList.length} OS records`);

  // =============================================
  // STEP 4: Create patio_checkins
  // =============================================
  console.log("\n=== STEP 4: Criar patio_checkins ===");
  // Check if table has RLS blocking inserts
  const checkRls = await api(page, "GET", `patio_checkins?select=id&limit=1`);
  if (checkRls.status === 404 || checkRls.status === 401 || checkRls.status === 403) {
    console.log(`patio_checkins query: ${checkRls.status} ${JSON.stringify(checkRls.data)}`);
    console.log("patio_checkins table may not exist or RLS blocks");
  }

  // Use the first 5 OS that now have cliente_id  
  const osWithClient = osList.filter(o => o.cliente_id).slice(0, 5);
  console.log(`Using ${osWithClient.length} OS for checkins`);
  
  let count2 = 0;
  const now = new Date();
  for (let i = 0; i < osWithClient.length; i++) {
    const os = osWithClient[i];
    const statuses = ["em_fila", "chegou_ao_patio", "carregando", "liberado", "saiu"];
    const status = statuses[i];
    const placas = ["ABC-1234", "DEF-5678", "GHI-9012", "JKL-3456", "MNO-7890"];
    const motores = ["Joao Silva", "Maria Santos", "Pedro Alves", "Ana Costa", "Carlos Lima"];
    const chegada = new Date(now);
    chegada.setHours(now.getHours() - (4 - i));
    
    const body = {
      unidade_id: UNIDADE_ID,
      ordem_servico_id: os.id,
      cliente_id: CLIENTE_ID,
      numero_os: os.numero,
      veiculo_placa: placas[i],
      motorista_nome: motores[i],
      status: status,
      posicao_fila: status === "em_fila" ? 2 : status === "chegou_ao_patio" ? 1 : 0,
      doca_id: status === "carregando" ? DOCA_01 : null,
      doca_nome: status === "carregando" ? "Doca 01" : null,
      horario_chegada: chegada.toISOString(),
      tempo_aguardando_min: status === "em_fila" ? 30 : status === "chegou_ao_patio" ? 15 : status === "carregando" ? 0 : 0,
      tempo_carregando_min: status === "carregando" ? 45 : 0,
      observacao: "[DEV DEMO] Dados de demonstracao para testes"
    };
    
    const r = await api(page, "POST", "patio_checkins", body);
    if (r.ok) {
      count2++;
    } else {
      console.log(`  FAILED checkin ${i+1} (${status}): ${r.status} ${JSON.stringify(r.data).substring(0,150)}`);
    }
  }
  console.log(`Created ${count2}/${osWithClient.length} patio_checkins`);

  // =============================================
  // STEP 5: Update alocacoes_escala
  // =============================================
  console.log("\n=== STEP 5: Atualizar alocacoes_escala ===");
  const alocList = (await api(page, "GET", `alocacoes_escala?select=id,cliente_id,ordem_servico_id&limit=10`)).data || [];
  let count3 = 0;
  for (let i = 0; i < alocList.length && i < osWithClient.length; i++) {
    const aloc = alocList[i];
    const os = osWithClient[i];
    const r = await api(page, "PATCH", `alocacoes_escala?id=eq.${aloc.id}`, {
      cliente_id: CLIENTE_ID,
      ordem_servico_id: os.id
    });
    if (r.ok) count3++;
  }
  console.log(`Updated ${count3}/${alocList.length} alocacoes_escala`);

  // =============================================
  // VERIFY
  // =============================================
  console.log("\n=== VERIFICACAO ===");
  const tables = ["clientes", "usuarios_cliente", "tenant_usuarios", "ordens_servico", "patio_checkins", "alocacoes_escala"];
  for (const table of tables) {
    const r = await api(page, "GET", `${table}?select=*&limit=3`);
    if (r.ok) {
      const data = Array.isArray(r.data) ? r.data : [];
      console.log(`${table.padEnd(25)} ${data.length} rows`);
    }
  }
  
  // Verify usuarios_cliente link
  const ucVerify = await api(page, "GET", `usuarios_cliente?auth_user_id=eq.${contatoAuthId}&select=*`);
  console.log(`\nusuarios_cliente for contato: ${ucVerify.ok ? JSON.stringify(ucVerify.data) : "NOT FOUND"}`);

  // Verify patio_checkins for this client
  const pcVerify = await api(page, "GET", `patio_checkins?cliente_id=eq.${CLIENTE_ID}&select=id,veiculo_placa,status,posicao_fila`);
  if (pcVerify.ok) {
    console.log(`\npatio_checkins for client: ${Array.isArray(pcVerify.data) ? pcVerify.data.length : 0} rows`);
    if (Array.isArray(pcVerify.data)) {
      pcVerify.data.forEach(c => console.log(`  ${c.status}: ${c.veiculo_placa} fila=${c.posicao_fila}`));
    }
  }

  console.log(`\n=== FIM ===`);
  console.log(`Cliente ID: ${CLIENTE_ID}`);
  console.log(`Usuario portal: contato@conexaoexpress.com.br / Admin@123`);
  console.log(`Tenant usuarios ID for contato: ${contatoAuthId}`);

  await browser.close();
})();
