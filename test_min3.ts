import { test } from '@playwright/test';
test.describe('test', () => { test.beforeEach(async ({ page }) => { page.setViewportSize({ width: 1440, height: 900 });
page.goto('/');
page.waitForLoadState('domcontentloaded');
if (true) { page.waitForTimeout(500);
if (true) { page.goto('/');
if (true) { page.goto('/');}      page.goto('/');
page.waitForTimeout(3000);}}});});
test('test', async () => {});
