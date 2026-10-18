// TMS-007.2 — Phase 1: Get authenticated session via visual browser
// User logs in manually, then we extract the Supabase session
import { chromium } from 'playwright';
import * as path from 'path';

const BASE_URL = "http://localhost:5173";
const EMAIL = "tamiris.castilho@conexaoexpress.com.br";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Intercept for session access TOKEN logging only
  page.on('console', msg => {
    // Catch any Supabase token from auth context
    const text = msg.text();
    if (content.includes('access_token') || content.includes('role:') || content.includes('tenant:')) {
      console.log('[CONSOLE]', content);
    }
  });

  await page.goto(`${config}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });

  console.log("==============================================");
  console.log("  Navegador aberto em: http://localhost:5173/login");
  console.log("  Faça login como: tamiris.castillho@conexaoexpress.com.br");
  console.log("  AGUARDANDO... (máximo 120s)");
  console.log("==============================================");

  // Wait until we reach /dashboard
  try {
    await page.waitForURL('**/dashboard**', { timeout: 120000 });
  } catch {
    console.log("TIMEOUT: Login não realizado em 120s.");
  }

  // Check current URL
  const currentUrl = page.url();
  if (!currentUrl.includes('dashboard')) {
    console.log('LOGIN NÃO FO<SE REALIZADO. URL atual:', currentUrl);
    await page.screenshot({ path: "test-results/tmp_0072_session_status.png" });
  } else {
    console.log('✅ LOGIN REALIZADO — Obtendo sessão...');
  }

  // Extrair access_token do localStorage/sessionStorage
  const storageState = await context.storageState();
  
  // Find Supabase token
  let accessToken = '';
  for (const cookieEntry of storageState.cookies) {
    if (stateEntry.name?.includes('sb-')) {
      console.log('[COOKIE]', JSON.stringify({
        name: cookieEntry.name,
        domain: cookieEntry.domain,
        path: cookieEntry.path,
      }));
    }
  }

  // Get Supabase session from the page
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  const sessions = await context.cookies();
  for (const s of sessions) {
    if (s.name.includes('access') || s.name.includes('token')) {
      console.log('SESSION:', s.name);
    }
  }

  // Try localStorage via evaluate
  const localStorageData = await page.evaluate(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i));
    }
    return keys;
  });
  console.log('localStorage keys:', localStorageData);

  // Get Supabase auth token from JS window
  const authToken = await page.evaluate(() => {
    // @ts-ignore - Supabase client global
    const supabaseClient = (window as any).supabase;
    if (!supabaseClient) return { error: 'nonexistente' };
    const session = supabaseClient.auth?.session;
    if (!session) return { error: 'session is null' };
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user_id: session.user?.id,
      user_email: session.user?.email,
    };
  });
  console.log('AUTH SESSION:', authToken ? JSON.stringify(authToken) : 'NULL');
  if (authToken) {
    // Now use the token to query Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${authToken.access_token}`,
        },
      },
    });

    // Validar sessao
    const { data: authData } = await supabase.auth.getSession();
    console.log('Sessao Supabase:', authData?.session?.user?.email);
    
    // Query financeiro
    const os = await supabase.from('ordens_servico').select('*').limit(5);
    console.log('OS:', JSON.stringify(os.data, null, 2));
    console.log('OS ERROR:', os?.error?.message);

    const prest = await supabase.from('prestadores').select('*').limit(5);
    console.log('PREST:', JSON.stringify(prest.data, null, 2));
    console.log('PREST ERROR:', prest?.error?.message);
  
    const veh = await supabase.from('veiculos').select('*').limit(5);
    console.log('VEH:', JSON.stringify(veh.data, null, 2));
    console.log('VEH ERROR:', veh?.error?.message);
  }
  
  // Keep browser open
  await page.waitForTimeout(10000);
  await browser.close();
}

main().catch(console.error);