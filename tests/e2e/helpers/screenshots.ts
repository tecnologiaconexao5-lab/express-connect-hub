import { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const SCREENSHOTS_DIR = path.resolve("test-results/e2e");

export function ensureDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

export async function tirarScreenshot(page: Page, nome: string) {
  ensureDir();
  const filePath = path.join(SCREENSHOTS_DIR, `${nome}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`[Screenshot] Salva: ${filePath}`);
  return filePath;
}

export function salvarEvidenciaJson(dados: Record<string, unknown>) {
  ensureDir();
  const filePath = path.join(SCREENSHOTS_DIR, "evidencia-final.json");
  fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), "utf-8");
  console.log(`[JSON] Evidência salva: ${filePath}`);
  return filePath;
}

export function salvarEvidenciaFinanceiroJson(dados: Record<string, unknown>) {
  ensureDir();
  const filePath = path.join(SCREENSHOTS_DIR, "evidencia-financeiro.json");
  fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), "utf-8");
  console.log(`[JSON] Evidência financeiro salva: ${filePath}`);
  return filePath;
}

export function salvarEvidenciaF9Json(dados: Record<string, unknown>) {
  ensureDir();
  const filePath = path.join(SCREENSHOTS_DIR, "evidencia-f9-integrado-financeiro.json");
  fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), "utf-8");
  console.log(`[JSON] Evidência F9 salva: ${filePath}`);
  return filePath;
}

export function salvarEvidenciaF10Json(dados: Record<string, unknown>) {
  ensureDir();
  const filePath = path.join(SCREENSHOTS_DIR, "evidencia-f10-flutter-real.json");
  fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), "utf-8");
  console.log(`[JSON] Evidência F10 salva: ${filePath}`);
  return filePath;
}

export function salvarEvidenciaF10CJson(dados: Record<string, unknown>) {
  ensureDir();
  const filePath = path.join(SCREENSHOTS_DIR, "evidencia-f10c-cloudflare-real.json");
  fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), "utf-8");
  console.log(`[JSON] Evidência F10C salva: ${filePath}`);
  return filePath;
}

export function salvarEvidenciaF11Json(dados: Record<string, unknown>) {
  ensureDir();
  const filePath = path.join(SCREENSHOTS_DIR, "evidencia-f11-recrutamento-p14.json");
  fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), "utf-8");
  console.log(`[JSON] Evidência F11 salva: ${filePath}`);
  return filePath;
}
