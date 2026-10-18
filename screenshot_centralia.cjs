const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 900 } });

  try {
    // Login
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Fill email
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('admin@conexaoexpress.com.br');

    // Fill password
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('admin123');

    // Click submit
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    // Navigate to Central IA
    await page.goto('http://localhost:5173/central-ia', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Take screenshot
    await page.screenshot({ path: 'central_ia_screenshot.png', fullPage: false });
    console.log('Screenshot saved successfully!');

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: 'central_ia_error.png' });
  }

  await browser.close();
})();
