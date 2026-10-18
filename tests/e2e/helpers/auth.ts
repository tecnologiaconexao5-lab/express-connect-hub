import { Page } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = "test-results/e2e/auth";

// ============================================================
// MISSAO 50: Apenas usuarios corporativos REAIS.
// Senha lida exclusivamente de env vars (sem fallback).
// ============================================================
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD;

const FINANCEIRO_EMAIL = "financeiro@conexaoexpress.com.br";
const FINANCEIRO_PASSWORD = process.env.PLAYWRIGHT_FINANCEIRO_PASSWORD;

const COMERCIAL_EMAIL = "comercial@conexaoexpress.com.br";
const COMERCIAL_PASSWORD = process.env.PLAYWRIGHT_COMERCIAL_PASSWORD;

const OPERACIONAL_EMAIL = "operacional@conexaoexpress.com.br";
const OPERACIONAL_PASSWORD = process.env.PLAYWRIGHT_OPERACIONAL_PASSWORD;

const ATENDIMENTO_EMAIL = "contato@conexaoexpress.com.br";
const ATENDIMENTO_PASSWORD = process.env.PLAYWRIGHT_ATENDIMENTO_PASSWORD;

const CLIENTE_EMAIL = "cliente.teste@conexaoexpress.com.br";
const CLIENTE_PASSWORD = process.env.PLAYWRIGHT_CLIENTE_PASSWORD;

export const USUARIOS_CORPORATIVOS = {
  admin:        { email: ADMIN_EMAIL,       password: ADMIN_PASSWORD },
  financeiro:   { email: FINANCEIRO_EMAIL,  password: FINANCEIRO_PASSWORD },
  comercial:    { email: COMERCIAL_EMAIL,   password: COMERCIAL_PASSWORD },
  operacional:  { email: OPERACIONAL_EMAIL, password: OPERACIONAL_PASSWORD },
  atendimento:  { email: ATENDIMENTO_EMAIL, password: ATENDIMENTO_PASSWORD },
  cliente:      { email: CLIENTE_EMAIL,     password: CLIENTE_PASSWORD },
};

async function loginAs(page: Page, perfil: keyof typeof USUARIOS_CORPORATIVOS, screenshotPrefix: string) {
  const creds = USUARIOS_CORPORATIVOS[perfil];
  console.log(`[AUTH] login como ${perfil}: ${creds.email}`);
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${screenshotPrefix}-01-pagina-login.png`),
    fullPage: false,
  });

  const emailInput = page.locator('input[type="email"], input[placeholder*="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(creds.email);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 5000 });
  await passwordInput.fill(creds.password);

  await page.locator('button[type="submit"], button:has-text("Entrar")').click();
  await page.waitForTimeout(3000);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${screenshotPrefix}-02-pos-login.png`),
    fullPage: false,
  });
  console.log(`[AUTH] login ${perfil} realizado`);
}

export async function loginAdmin(page: Page, screenshotPrefix = "auth") {
  return loginAs(page, "admin", screenshotPrefix);
}

export async function loginFinanceiro(page: Page, screenshotPrefix = "auth") {
  return loginAs(page, "financeiro", screenshotPrefix);
}

export async function loginComercial(page: Page, screenshotPrefix = "auth") {
  return loginAs(page, "comercial", screenshotPrefix);
}

export async function loginOperacional(page: Page, screenshotPrefix = "auth") {
  return loginAs(page, "operacional", screenshotPrefix);
}

export async function loginAtendimento(page: Page, screenshotPrefix = "auth") {
  return loginAs(page, "atendimento", screenshotPrefix);
}

export async function loginCliente(page: Page, screenshotPrefix = "auth") {
  return loginAs(page, "cliente", screenshotPrefix);
}

export async function loginIfNeeded(page: Page, screenshotPrefix = "auth") {
  const loginBtn = page.locator('button:has-text("Entrar")');
  const hasLoginForm = await loginBtn.isVisible().catch(() => false);
  if (!hasLoginForm) {
    console.log(`[AUTH] ja logado, pulando login`);
    return;
  }
  return loginAs(page, "admin", screenshotPrefix);
}

export async function navigateToCentralIA(page: Page, screenshotPrefix = "auth") {
  console.log(`[AUTH] navegou Central IA`);
  await page.goto("/central-ia", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${screenshotPrefix}-03-central-ia.png`),
    fullPage: false,
  });
}
