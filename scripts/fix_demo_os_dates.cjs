const { chromium } = require("playwright");
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const CLIENTE_ID = "cd463c93-5190-408e-b5e6-ee639b688402";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "tamiris.castilho@conexaoexpress.com.br");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(2000);

  // First check ordens_servico schema - try SELECT without tenant_id
  const tenantInfo = await page.evaluate(async ({ url, key }) => {
    const tk = Object.keys(localStorage).find(k => k.includes("auth-token"));
    const token = tk ? JSON.parse(localStorage.getItem(tk)).access_token : null;
    const headers = { "apikey": key, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
    async function f(path) {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers });
      try { return { ok: r.ok, data: await r.json() }; } catch { return { ok: r.ok, data: null }; }
    }
    const osAll = await f(`ordens_servico?select=id,numero,status,cidade_destino,created_at,data_servico,data_previsao&limit=8`);
    const osCols = await f(`ordens_servico?select=id,numero,status&limit=2`);
    const updateTest = await f(`ordens_servico?id=eq.a0000000-0000-0000-0000-000000000001`);
    return { os: osAll.data, osCols: osCols.data, osOk: osAll.ok, colsOk: osCols.ok };
  }, { url: SUPABASE_URL, key: ANON_KEY });
  console.log("OS select (full):", JSON.stringify(tenantInfo.os, null, 2));
  console.log("OS select (minimal) ok:", tenantInfo.osOk, "cols:", tenantInfo.colsOk);

  // Now update
  const result = await page.evaluate(async ({ url, key, clienteId }) => {
    const tk = Object.keys(localStorage).find(k => k.includes("auth-token"));
    const token = tk ? JSON.parse(localStorage.getItem(tk)).access_token : null;
    const headers = { "apikey": key, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

    async function fetchJSON(path, opts = {}) {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers, ...opts });
      const text = await r.text();
      try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
      catch { return { ok: r.ok, status: r.status, error: text.substring(0, 200) }; }
    }

    // Check tenant_id on OS records
    const tenantCheck = await fetchJSON(`ordens_servico?select=id,numero,tenant_id,cliente_id&limit=5`);
    if (tenantCheck.ok && Array.isArray(tenantCheck.data)) {
      console.log("tenant_id check:", JSON.stringify(tenantCheck.data.map(x => ({ n: x.numero, t: x.tenant_id, c: x.cliente_id }))));
    }
    
    // Get 10 OS for this client
    const osResp = await fetchJSON(`ordens_servico?cliente_id=eq.${clienteId}&select=id,numero,status,created_at,tenant_id&order=created_at.desc&limit=10`);
    if (!osResp.ok || !Array.isArray(osResp.data)) return { error: "No OS", osResp };
    
    const osList = osResp.data;
    const now = new Date();
    
    function sh(h) { const n = new Date(now); n.setHours(now.getHours() + h); return n.toISOString(); }
    function da(d) { const n = new Date(now); n.setDate(n.getDate() - d); return n.toISOString().split("T")[0]; }
    function df(d) { const n = new Date(now); n.setDate(n.getDate() + d); return n.toISOString().split("T")[0]; }

    const updates = [
      { status: "em_andamento", created: sh(-5), srv: da(0), prev: da(0), cidade: "Sao Paulo - SP", origem: "CD Matriz SP", valor: 1200, vol: 10, peso: 500, carga: "Mercadorias diversas [DEV DEMO]" },
      { status: "em_andamento", created: sh(-4), srv: da(0), prev: da(0), cidade: "Campinas - SP", origem: "CD Matriz SP", valor: 850, vol: 5, peso: 200, carga: "Equipamentos eletronicos [DEV DEMO]" },
      { status: "programacao", created: sh(-8), srv: da(0), prev: df(1), cidade: "Sao Bernardo - SP", origem: "CD Matriz SP", valor: 2100, vol: 25, peso: 1200, carga: "Moveis e utensilios [DEV DEMO]" },
      { status: "concluida", created: sh(-24), srv: da(1), prev: da(1), cidade: "Guarulhos - SP", origem: "CD Matriz SP", valor: 540, vol: 3, peso: 100, carga: "Documentos [DEV DEMO]" },
      { status: "atrasada", created: sh(-48), srv: da(2), prev: da(1), cidade: "Osasco - SP", origem: "CD Matriz SP", valor: 3700, vol: 40, peso: 2000, carga: "Materiais de construcao [DEV DEMO]" },
    ];

    let count = 0;
    const errors = [];
    for (let i = 0; i < osList.length && i < updates.length; i++) {
      const u = updates[i];
      const os = osList[i];
      // Try PATCH - first just the status alone
      let r = await fetchJSON(`ordens_servico?id=eq.${os.id}`, { method: "PATCH", body: JSON.stringify({ status: u.status }) });
      if (r.ok) {
        // Then update other fields in a second PATCH
        r = await fetchJSON(`ordens_servico?id=eq.${os.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            created_at: u.created,
            data_servico: u.srv,
            data_previsao: u.prev,
            cidade_destino: u.cidade,
            filial_origem: u.origem,
            valor_cliente: u.valor,
            volumes: u.vol,
            peso: u.peso,
            carga_descricao: u.carga,
          })
        });
        if (r.ok) count++;
        else errors.push(`${os.numero} fields: ${r.status} ${JSON.stringify(r.data) || r.error}`);
      } else {
        errors.push(`${os.numero} status: ${r.status} ${JSON.stringify(r.data) || r.error || "?"}`);
      }
    }
    
    return { total: osList.length, updated: count, errors };
  }, { url: SUPABASE_URL, key: ANON_KEY, clienteId: CLIENTE_ID });

  console.log("Result:", JSON.stringify(result, null, 2));

  await browser.close();
})();
