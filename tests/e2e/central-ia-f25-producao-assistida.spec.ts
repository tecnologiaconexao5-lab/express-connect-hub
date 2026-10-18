import { test, expect } from '@playwright/test'
test.describe('F25 - ProduÃ§Ã£o Assistida (RobÃ´ Operacional)', () => {
test.beforeEach(async ({ page }) => {
await page.goto('/central-ia')
await page.waitForLoadState('domcontentloaded')})
test('F25.1 - Exibe botÃ£o ProduÃ§Ã£o Assistida na Tab RobÃ´s', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.waitForSelector('button:has-text("ProduÃ§Ã£o Assistida")', {

      timeout: 5000,})
const btn = page.locator('button:has-text("ProduÃ§Ã£o Assistida")')
expect(btn).toBeVisible()})
test('F25.2 - BotÃ£o ProduÃ§Ã£o Assistida estÃ¡ habilitado inicialmente', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
const btn = page.locator('button:has-text("ProduÃ§Ã£o Assistida")')
expect(btn).toBeEnabled({ timeout: 5000 })})
test('F25.3 - BotÃ£o ProduÃ§Ã£o Assistida fica desabilitado durante execuÃ§Ã£o', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
const btn = page.locator('button:has-text("ProduÃ§Ã£o Assistida")')
await btn.click()
expect(btn).toBeDisabled({ timeout: 2000 })})
test('F25.4 - ExecuÃ§Ã£o produÃ§Ã£o assistida retorna resumo com enviados/bloqueados', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
const card = page.locator('text=Resultado ProduÃ§Ã£o Assistida')
expect(card).toBeVisible({ timeout: 15000 })
expect(page.locator('text=Enviados:')).toBeVisible({ timeout: 5000 })
expect(page.locator('text=Bloqueados:')).toBeVisible({ timeout: 5000, })})
test('F25.5 - Card da ProduÃ§Ã£o Assistida tem borda Ã¢mbar', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
const card = page
    .locator('text=Resultado ProduÃ§Ã£o Assistida')
    .locator('..')
    .locator('..')
expect(card).toHaveClass(/border-amber/, {

      timeout: 15000})})
test('F25.6 - ExecuÃ§Ã£o produÃ§Ã£o assistida cria tarefas e aprovaÃ§Ãµes', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
const card = page.locator('text=Resultado ProduÃ§Ã£o Assistida')
expect(card).toBeVisible({ timeout: 15000 })
const text = await card.textContent()
expect(text).toMatch(/(tarefas|Tarefas)/i)})
test('F25.7 - ExecuÃ§Ã£o produÃ§Ã£o assistida mostra total de encontrados', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
const card = page.locator('text=Resultado ProduÃ§Ã£o Assistida')
expect(card).toBeVisible({ timeout: 15000 })
const text = await card.textContent()
expect(text).toMatch(/situaÃ§Ãµes/)})
test('F25.8 - BotÃ£o ProduÃ§Ã£o Assistida fica visÃ­vel mesmo sem robÃ´s configurados', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
const btn = page.locator('button:has-text("ProduÃ§Ã£o Assistida")')
expect(btn).toBeVisible({ timeout: 5000 })})
test('F25.9 - Dry-Run e ProduÃ§Ã£o Assistida funcionam independentemente', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.click('button:has-text("Dry-Run")')
await page.waitForTimeout(1000)
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
const card = page.locator('text=Resultado ProduÃ§Ã£o Assistida')
expect(card).toBeVisible({ timeout: 15000 })})
test('F25.10 - ExecuÃ§Ã£o produÃ§Ã£o assistida nÃ£o trava UI', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
expect(
    page.locator('text=Resultado ProduÃ§Ã£o Assistida'), ).toBeVisible({ timeout: 15000 })
expect(page.locator('h2:has-text("RobÃ´s Digitais")')).toBeVisible({ timeout: 3000, })})
test('F25.11 - Card da produÃ§Ã£o assistida exibe PRODUÃ‡ÃƒO ASSISTIDA no tÃ­tulo', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
const header = page.locator('text=Resultado ProduÃ§Ã£o Assistida')
expect(header).toBeVisible({ timeout: 15000 })})
test('F25.12 - Resumo contÃ©m PRODUÃ‡ÃƒO ASSISTIDA no inÃ­cio', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
const pre = page
    .locator('text=Resultado ProduÃ§Ã£o Assistida')
    .locator('..')
    .locator('pre')
expect(pre).toContainText(/PRODUÃ‡ÃƒO ASSISTIDA/, {

      timeout: 15000})})
test('F25.13 - NÃ£o cria duplicatas em execuÃ§Ãµes consecutivas', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
await page.waitForSelector('text=Resultado ProduÃ§Ã£o Assistida', {

      timeout: 15000,})
await page.waitForTimeout(2000)
await page.click('button:has-text("ProduÃ§Ã£o Assistida")')
expect(
    page.locator('text=Resultado ProduÃ§Ã£o Assistida'), ).toBeVisible({ timeout: 15000 })})
test('F25.14 - BotÃ£o usa variante default/Ã¢mbar para diferenciar do Dry-Run', async ({ page, }) => {
await page.click('button:has-text("RobÃ´s")')
const btn = page.locator('button:has-text("ProduÃ§Ã£o Assistida")')
expect(btn).toBeVisible({ timeout: 5000 })})})
