const { chromium } = require("playwright");
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const CLIENTE_ID = "cd463c93-5190-408e-b5e6-ee639b688402";
const UNIDADE_ID = "426800fa-fb59-4d35-9670-1147180e34ec";
const DOCA_01 = "2b715ead-a7af-49f0-9458-d33c2f16347a";

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
    if (body && (method === "POST" || method === "PATCH")) opts.body = JSON.stringify(body);
    if (method === "POST") opts.headers["Prefer"] = "return=representation";
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

  // Login as tamiris
  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "tamiris.castilho@conexaoexpress.com.br");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Get OS with cliente_id
  const osResp = await api(page, "GET", `ordens_servico?select=id,numero,status,cliente_id&cliente_id=eq.${CLIENTE_ID}&order=created_at.desc&limit=10`);
  const osList = Array.isArray(osResp.data) ? osResp.data : [];
  console.log(`OS with client: ${osList.length}`);
  
  // Delete existing checkins for this client
  const del = await api(page, "DELETE", `patio_checkins?cliente_id=eq.${CLIENTE_ID}`);
  console.log(`Deleted old checkins: ${del.ok}`);

  // Create 5 checkins with correct ENUM statuses
  const now = new Date();
  const checkins = [
    { status: "aguardando_fila", veiculo: "ABC-1234", motorista: "Joao Silva", posicao: 2, doca: null, docaNome: null, offsetH: 0 },
    { status: "chegou_ao_patio", veiculo: "DEF-5678", motorista: "Maria Santos", posicao: 1, doca: null, docaNome: null, offsetH: 1 },
    { status: "carregamento_iniciado", veiculo: "GHI-9012", motorista: "Pedro Alves", posicao: 0, doca: DOCA_01, docaNome: "Doca 01", offsetH: 2 },
    { status: "liberado_para_saida", veiculo: "JKL-3456", motorista: "Ana Costa", posicao: 0, doca: null, docaNome: null, offsetH: 3 },
    { status: "saiu_do_patio", veiculo: "MNO-7890", motorista: "Carlos Lima", posicao: 0, doca: null, docaNome: null, offsetH: 4 },
  ];

  let count = 0;
  for (let i = 0; i < checkins.length && i < osList.length; i++) {
    const os = osList[i];
    const c = checkins[i];
    const chegada = new Date(now);
    chegada.setHours(now.getHours() - c.offsetH);
    
    // Calculate waiting times
    const esperaMin = c.status === "aguardando_fila" ? 30 : c.status === "chegou_ao_patio" ? 15 : 0;
    const cargaMin = c.status === "carregamento_iniciado" ? 45 : 0;
    
    const body = {
      unidade_id: UNIDADE_ID,
      ordem_servico_id: os.id,
      cliente_id: CLIENTE_ID,
      numero_os: os.numero,
      veiculo_placa: c.veiculo,
      motorista_nome: c.motorista,
      status: c.status,
      posicao_fila: c.posicao,
      doca_id: c.doca,
      doca_nome: c.docaNome,
      horario_chegada: chegada.toISOString(),
      tempo_aguardando_min: esperaMin,
      tempo_carregando_min: cargaMin,
      observacao: "[DEV DEMO] Dados de demonstracao"
    };
    
    const r = await api(page, "POST", "patio_checkins", body);
    if (r.ok) {
      count++;
      console.log(`  OK: ${c.veiculo} (${c.status})`);
    } else {
      console.log(`  FAIL: ${c.veiculo} (${c.status}): ${r.status} - ${JSON.stringify(r.data).substring(0,100)}`);
    }
  }
  console.log(`\nCreated ${count}/${checkins.length} checkins`);

  // Verify
  const v = await api(page, "GET", `patio_checkins?cliente_id=eq.${CLIENTE_ID}&select=id,veiculo_placa,status,posicao_fila`);
  if (v.ok) {
    const data = Array.isArray(v.data) ? v.data : [];
    console.log(`\nTotal checkins for client: ${data.length}`);
    data.forEach(c => console.log(`  ${c.status.padEnd(25)} ${c.veiculo_placa} fila=${c.posicao_fila}`));
  }

  await browser.close();
})();
