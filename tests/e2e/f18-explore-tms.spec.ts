import { test }   from "@playwright/test";
import path   from "path";
const TMS_URL = "http://localhost:8800";
const EVIDENCE_DIR = path.resolve(process.cwd(), "test-results", "e2e", "f18");
test.describe("F18 â€” Explore TMS OS form", () => {
test("F18.0 â€” Explore and capture TMS navigation", async ({ browser }) => {
const context = await browser.newContext({

      viewport: {

        width: 1440, height: 900}, });
const page = await context.newPage();

    //  1. Go to TM
await page.goto(TMS_URL, {

      waitUntil: "domcontentloaded", timeout: 60000});
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(EVIDENCE_DIR, "tms-login.png"), fullPage: false });

    //  2. Logi
await page.locator('input[type="email"]').fill("tamiris.castilho@conexaoexpress.com.br");
await page.locator('input[type="password"]').fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator("button").filter({ hasText: "Entrar" }).click();
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(EVIDENCE_DIR, "tms-pos-login.png"), fullPage: false });

    //  3. Capture DOM to find menu structur
const bodyText = await page.locator("body").innerText();

    console.log("=== BODY TEXT (first 3000 chars) ===");

    console.log(bodyText.substring(0, 3000));

    //  4. Try clicking on navigation links related to O
const links = await page.locator("a, button, [role=button], nav *").all();

    console.log(`\n=== TOTAL INTERACTIVE ELEMENTS: ${links.length} ===`);
for (const link of links) {
const text = await link.innerText();
const tag = await link.evaluate(el => el.tagName);
const href = await link.getAttribute("href").catch(() => null);
const cls = await link.getAttribute("class").catch(() => null);
if (text && text.trim().length > 0 && text.trim().length < 50) {

        console.log(`  ${tag} | "${text.trim()}" | href="${href || ""}" | class="${(cls || "").substring(0, 60)}"`);}}    await context.close();});});

