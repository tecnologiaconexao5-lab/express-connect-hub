import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

test.describe('Escala allocation OS linkage validation', () => {
  test('should show error toast and not insert allocation when OS not selected', async ({ page }) => {
    const envPath = path.resolve(process.cwd(), '.env');
    dotenv.config({ path: envPath });
    const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY as string;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { count: initialCount, error: initErr } = await supabase
      .from('alocacoes_escala')
      .select('id', { count: 'exact', head: true })
      .eq('ordem_servico_id', null);
    expect(initErr).toBeNull();
    await page.goto('/operacao/escala');
    await page.getByRole('button', { name: /\+ Nova Alocação/i }).click();
    await page.getByPlaceholder('Selecione o prestador').click();
    await page.getByRole('option').first().click();
    await page.getByPlaceholder('Selecione o cliente').click();
    await page.getByRole('option').first().click();
    await page.getByLabel('Data da alocação').fill('2026-10-01');
    await page.getByRole('button', { name: /Salvar/i }).click();
    const toast = page.getByText('Selecione uma Ordem de Serviço antes de salvar a alocação.');
    await expect(toast).toBeVisible();
    const { count: finalCount, error: finalErr } = await supabase
      .from('alocacoes_escala')
      .select('id', { count: 'exact', head: true })
      .eq('ordem_servico_id', null);
    expect(finalErr).toBeNull();
    expect(finalCount).toBe(initialCount);
  });
});
