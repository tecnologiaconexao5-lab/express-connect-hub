import { test } from '@playwright/test';
test.describe('test', () => { test.beforeEach(async ({ page }) => { page.goto('/'); }); });
test('test', async () => {});
