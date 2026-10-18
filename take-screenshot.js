import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Define viewport
  await page.setViewport({ width: 1440, height: 900 });

  // Navigate to page
  console.log('Navigating to localhost:8800...');
  await page.goto('http://localhost:8800/operacao?tab=escala', { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('Clicking the Controle Diário tab...');
  // Click on the tab that has value="tabelas" (or contains text "Controle Diário")
  await page.waitForSelector('button[value="tabelas"]', { timeout: 5000 });
  await page.click('button[value="tabelas"]');

  // Wait a bit for the tab content to render
  await new Promise(resolve => setTimeout(resolve, 2000));

  const screenshotPath = process.argv[2] || 'screenshot.png';
  console.log(`Taking screenshot to ${screenshotPath}...`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();
  console.log('Done!');
})().catch(console.error);
