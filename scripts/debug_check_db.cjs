const { chromium } = require("playwright");
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login as tamiris to get auth session
  await page.goto("http://localhost:8800/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', "tamiris.castilho@conexaoexpress.com.br");
  await page.fill('input[type="password"]', "Admin@123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Get the auth token from localStorage
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.includes("auth-token"));
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      const parsed = JSON.parse(raw);
      return parsed.access_token || null;
    } catch { return null; }
  });

  if (!token) {
    console.log("ERROR: No auth token found in localStorage");
    await browser.close();
    return;
  }

  async function queryTable(table) {
    const res = await page.evaluate(async ({ url, table, token }) => {
      const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, {
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs",
          "Authorization": `Bearer ${token}`
        }
      });
      if (!r.ok) return { count: -1, error: `${r.status} ${r.statusText}` };
      const data = await r.json();
      return { count: data.length, data };
    }, { url: SUPABASE_URL, table, token });
    return res;
  }

  const tables = [
    "clientes", "usuarios_cliente", "tenant_usuarios",
    "ordens_servico", "patio_checkins", "alocacoes_escala",
    "financeiro_receber", "portal_pedidos", "tenants",
    "patio_unidades", "patio_docas", "entregas_protocolo",
    "portal_notificacoes", "portal_ocorrencias"
  ];

  console.log("=== DATABASE STATE CHECK ===\n");
  for (const table of tables) {
    const result = await queryTable(table);
    const status = result.count >= 0 ? `${result.count} rows` : `ERROR: ${result.error}`;
    console.log(`${table.padEnd(25)} ${status}`);
    if (result.data && result.data.length > 0) {
      result.data.forEach(row => console.log(`  ${JSON.stringify(row).substring(0, 200)}`));
    }
  }

  await browser.close();
})();
