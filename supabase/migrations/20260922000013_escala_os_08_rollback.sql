-- ESCALA-OS-08 — ROLLBACK ESPECÍFICO (dados)
-- ============================================================================
-- Desfaz SOMENTE o que esta missão criou: a OS interna (id = alocação.id) e o
-- vínculo (ordem_servico_id) das 3 alocações. NÃO remover financeiro/baixas
-- pré-existentes (títulos já existiam antes; apenas a OS foi criada agora).
-- NÃO executar se o postcheck passou.
-- ============================================================================

DELETE FROM ordens_servico
WHERE id IN (
  '58e5751e-bd54-43c5-9bcf-55fe4e575e6b',
  'd1f34e73-a562-47c7-b057-ed079dd9b03a',
  'ae30da69-1d16-4600-a27d-edfa073ef239'
);

UPDATE alocacoes_escala
SET ordem_servico_id = NULL
WHERE id IN (
  '58e5751e-bd54-43c5-9bcf-55fe4e575e6b',
  'd1f34e73-a562-47c7-b057-ed079dd9b03a',
  'ae30da69-1d16-4600-a27d-edfa073ef239'
);
