-- ESCALA-FIN-03 — ROLLBACK ESPECÍFICO (dados)
-- ============================================================================
-- Restaura ordens_servico.custo_prestador ao valor anterior (0) SOMENTE para as
-- 3 OS efetivamente alteradas nesta missão. NÃO executar se a validação passou.
--
-- Escopo estrito (3 registros):
--   2073a75d-62f7-453d-b4e3-eaf3e8ea212b  (antes: 0)
--   38961ecf-4c62-4a87-a614-ec9092c988e4  (antes: 0)
--   2c24a4dc-3491-4f46-9d24-69ceb4d76d63  (antes: 0)
-- ============================================================================

UPDATE ordens_servico
SET custo_prestador = 0,
    updated_at = NOW()
WHERE id IN (
  '2073a75d-62f7-453d-b4e3-eaf3e8ea212b',
  '38961ecf-4c62-4a87-a614-ec9092c988e4',
  '2c24a4dc-3491-4f46-9d24-69ceb4d76d63'
);
