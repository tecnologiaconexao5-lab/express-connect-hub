-- ESCALA-OS-04 — ROLLBACK ESPECÍFICO (dados)
-- ============================================================================
-- Restaura ordem_servico_id = NULL SOMENTE nas 13 alocações Classe A alteradas.
-- NÃO executar se a validação passou.
-- ============================================================================

UPDATE alocacoes_escala
SET ordem_servico_id = NULL
WHERE id IN (
  '02c85042-6176-4f49-bdaf-ba74b2296425',
  '0733bb97-8356-434c-bbdf-35d70bc0ff08',
  '1a46b5a9-f739-409f-ab5b-a744cfa6a8d5',
  '341fe14a-c4ba-4018-8595-a0eb56903363',
  '36e49824-8804-478a-b1ed-3df35846f552',
  '61cd4358-1050-4a4f-b785-ebff9f54eb86',
  '7ab8ad9c-0962-4ef1-89c8-0f74e744286a',
  '9bd5744e-b2ea-4773-beea-a907cbbb32a9',
  'bb2cda88-cffd-4196-9a16-ed68fd2e472c',
  'c6a4e65a-1622-406f-a20a-b6adccc9abbb',
  'ca905169-c958-4ad8-89c0-d6c6e742c924',
  'dce846ff-d7ae-463a-b784-73d8d2d91b21',
  'f12a56b4-a3f7-4473-97dd-bf180995d2f2'
);
