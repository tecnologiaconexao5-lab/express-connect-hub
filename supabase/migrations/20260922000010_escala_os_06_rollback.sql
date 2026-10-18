-- ESCALA-OS-06 — ROLLBACK ESPECÍFICO (dados)
-- ============================================================================
-- Reverte SOMENTE o que esta missão criou para as 35 alocações aprovadas.
-- NÃO remover financeiro pré-existente dos casos B. NÃO executar se o postcheck passou.
--
-- Casos A (30): não tinham financeiro antes → remover financeiro/composição criados
--   (os_id = alocação.id), remover a OS criada (id = alocação.id) e desvincular.
-- Casos B (5): financeiro JÁ existia → remover apenas a OS criada e desvincular;
--   PRESERVAR financeiro/pagamentos/composição pré-existentes.
-- ============================================================================

-- ---------- CASOS A (30) — remover financeiro criado + OS + vínculo ----------
DELETE FROM composicao_financeira_os
WHERE os_id IN (
  '7ea4c873-9bbd-4877-827f-1b8888cb08e7','b60142b4-6705-458e-91d0-65643a5e1d95',
  'a9f7f8ba-2e51-49ae-a140-16ca3fce3814','57624cae-3ce0-4c8f-b638-4e7e4edf3d00',
  'aceef5f8-6e8f-46e7-8e9c-0a1411a09388','9a00da38-d7dc-4c2b-85cf-3ffde3eedf88',
  '7a8904c8-3ca9-40c9-8ed4-ded6b5660389','7aee1381-59d8-474d-93b9-74b425eb1de0',
  '1fc92d46-6046-4624-980b-111af5bc447f','d19763f1-a8d1-4bf8-9d4d-150dfba3b132',
  'ed4eb599-3b8a-494b-bd00-00030a3f749e','6a6ff51a-3228-4e9d-9420-47568edfae64',
  '4992693a-8e6a-4c9c-8599-9b43aedd692e','899692a7-cc25-4d1c-854f-803f78aa8671',
  '982a7def-9a20-4b32-ab0e-2eb6078c851f','92911a09-495a-4931-9040-cf762c40d941',
  'b2035950-a820-4cb3-86a9-d85b7d470ade','ecbdc239-e5da-4665-ba0d-ebadc4866194',
  'bc57e3f1-5235-4f21-bdf9-c3433cfe234f','2b65575d-8ecc-49cf-83bb-bbf188960518',
  'b2f22402-e504-4cf0-bede-8dd1e3c6b04c','f1a52e77-570a-4ae8-9d32-e5282429710e',
  '25f69fa8-d1c5-4ed6-b1f0-9050b94bfb2d','b90348b8-3448-4988-b7f7-740d3ff8c84e',
  'dd977f3a-ba9e-4587-98c1-fdbe5ada323d','858c0cb2-e569-4669-954f-92a7ca460e3a',
  '0a56ef54-eb6b-46be-b62d-dda2b0860b23','231f2492-81ed-474c-adde-58370ef45353',
  'd2627865-0284-4003-9bcf-870b80bcd38d','af2828c5-3179-4e02-9c23-30f6cd5fcab8'
);

DELETE FROM pagamentos_prestadores
WHERE os_id IN (
  '7ea4c873-9bbd-4877-827f-1b8888cb08e7','b60142b4-6705-458e-91d0-65643a5e1d95',
  'a9f7f8ba-2e51-49ae-a140-16ca3fce3814','57624cae-3ce0-4c8f-b638-4e7e4edf3d00',
  'aceef5f8-6e8f-46e7-8e9c-0a1411a09388','9a00da38-d7dc-4c2b-85cf-3ffde3eedf88',
  '7a8904c8-3ca9-40c9-8ed4-ded6b5660389','7aee1381-59d8-474d-93b9-74b425eb1de0',
  '1fc92d46-6046-4624-980b-111af5bc447f','d19763f1-a8d1-4bf8-9d4d-150dfba3b132',
  'ed4eb599-3b8a-494b-bd00-00030a3f749e','6a6ff51a-3228-4e9d-9420-47568edfae64',
  '4992693a-8e6a-4c9c-8599-9b43aedd692e','899692a7-cc25-4d1c-854f-803f78aa8671',
  '982a7def-9a20-4b32-ab0e-2eb6078c851f','92911a09-495a-4931-9040-cf762c40d941',
  'b2035950-a820-4cb3-86a9-d85b7d470ade','ecbdc239-e5da-4665-ba0d-ebadc4866194',
  'bc57e3f1-5235-4f21-bdf9-c3433cfe234f','2b65575d-8ecc-49cf-83bb-bbf188960518',
  'b2f22402-e504-4cf0-bede-8dd1e3c6b04c','f1a52e77-570a-4ae8-9d32-e5282429710e',
  '25f69fa8-d1c5-4ed6-b1f0-9050b94bfb2d','b90348b8-3448-4988-b7f7-740d3ff8c84e',
  'dd977f3a-ba9e-4587-98c1-fdbe5ada323d','858c0cb2-e569-4669-954f-92a7ca460e3a',
  '0a56ef54-eb6b-46be-b62d-dda2b0860b23','231f2492-81ed-474c-adde-58370ef45353',
  'd2627865-0284-4003-9bcf-870b80bcd38d','af2828c5-3179-4e02-9c23-30f6cd5fcab8'
);

DELETE FROM financeiro_pagar
WHERE os_id IN (
  '7ea4c873-9bbd-4877-827f-1b8888cb08e7','b60142b4-6705-458e-91d0-65643a5e1d95',
  'a9f7f8ba-2e51-49ae-a140-16ca3fce3814','57624cae-3ce0-4c8f-b638-4e7e4edf3d00',
  'aceef5f8-6e8f-46e7-8e9c-0a1411a09388','9a00da38-d7dc-4c2b-85cf-3ffde3eedf88',
  '7a8904c8-3ca9-40c9-8ed4-ded6b5660389','7aee1381-59d8-474d-93b9-74b425eb1de0',
  '1fc92d46-6046-4624-980b-111af5bc447f','d19763f1-a8d1-4bf8-9d4d-150dfba3b132',
  'ed4eb599-3b8a-494b-bd00-00030a3f749e','6a6ff51a-3228-4e9d-9420-47568edfae64',
  '4992693a-8e6a-4c9c-8599-9b43aedd692e','899692a7-cc25-4d1c-854f-803f78aa8671',
  '982a7def-9a20-4b32-ab0e-2eb6078c851f','92911a09-495a-4931-9040-cf762c40d941',
  'b2035950-a820-4cb3-86a9-d85b7d470ade','ecbdc239-e5da-4665-ba0d-ebadc4866194',
  'bc57e3f1-5235-4f21-bdf9-c3433cfe234f','2b65575d-8ecc-49cf-83bb-bbf188960518',
  'b2f22402-e504-4cf0-bede-8dd1e3c6b04c','f1a52e77-570a-4ae8-9d32-e5282429710e',
  '25f69fa8-d1c5-4ed6-b1f0-9050b94bfb2d','b90348b8-3448-4988-b7f7-740d3ff8c84e',
  'dd977f3a-ba9e-4587-98c1-fdbe5ada323d','858c0cb2-e569-4669-954f-92a7ca460e3a',
  '0a56ef54-eb6b-46be-b62d-dda2b0860b23','231f2492-81ed-474c-adde-58370ef45353',
  'd2627865-0284-4003-9bcf-870b80bcd38d','af2828c5-3179-4e02-9c23-30f6cd5fcab8'
);

DELETE FROM financeiro_receber
WHERE os_id IN (
  '7ea4c873-9bbd-4877-827f-1b8888cb08e7','b60142b4-6705-458e-91d0-65643a5e1d95',
  'a9f7f8ba-2e51-49ae-a140-16ca3fce3814','57624cae-3ce0-4c8f-b638-4e7e4edf3d00',
  'aceef5f8-6e8f-46e7-8e9c-0a1411a09388','9a00da38-d7dc-4c2b-85cf-3ffde3eedf88',
  '7a8904c8-3ca9-40c9-8ed4-ded6b5660389','7aee1381-59d8-474d-93b9-74b425eb1de0',
  '1fc92d46-6046-4624-980b-111af5bc447f','d19763f1-a8d1-4bf8-9d4d-150dfba3b132',
  'ed4eb599-3b8a-494b-bd00-00030a3f749e','6a6ff51a-3228-4e9d-9420-47568edfae64',
  '4992693a-8e6a-4c9c-8599-9b43aedd692e','899692a7-cc25-4d1c-854f-803f78aa8671',
  '982a7def-9a20-4b32-ab0e-2eb6078c851f','92911a09-495a-4931-9040-cf762c40d941',
  'b2035950-a820-4cb3-86a9-d85b7d470ade','ecbdc239-e5da-4665-ba0d-ebadc4866194',
  'bc57e3f1-5235-4f21-bdf9-c3433cfe234f','2b65575d-8ecc-49cf-83bb-bbf188960518',
  'b2f22402-e504-4cf0-bede-8dd1e3c6b04c','f1a52e77-570a-4ae8-9d32-e5282429710e',
  '25f69fa8-d1c5-4ed6-b1f0-9050b94bfb2d','b90348b8-3448-4988-b7f7-740d3ff8c84e',
  'dd977f3a-ba9e-4587-98c1-fdbe5ada323d','858c0cb2-e569-4669-954f-92a7ca460e3a',
  '0a56ef54-eb6b-46be-b62d-dda2b0860b23','231f2492-81ed-474c-adde-58370ef45353',
  'd2627865-0284-4003-9bcf-870b80bcd38d','af2828c5-3179-4e02-9c23-30f6cd5fcab8'
);

-- ---------- CASOS A + B (35) — remover a OS criada e desvincular ----------
-- (Para A a OS foi criada agora; para B a OS também foi criada agora e o
--  financeiro pré-existente NÃO é tocado.)
DELETE FROM ordens_servico
WHERE id IN (
  -- A (30)
  '7ea4c873-9bbd-4877-827f-1b8888cb08e7','b60142b4-6705-458e-91d0-65643a5e1d95',
  'a9f7f8ba-2e51-49ae-a140-16ca3fce3814','57624cae-3ce0-4c8f-b638-4e7e4edf3d00',
  'aceef5f8-6e8f-46e7-8e9c-0a1411a09388','9a00da38-d7dc-4c2b-85cf-3ffde3eedf88',
  '7a8904c8-3ca9-40c9-8ed4-ded6b5660389','7aee1381-59d8-474d-93b9-74b425eb1de0',
  '1fc92d46-6046-4624-980b-111af5bc447f','d19763f1-a8d1-4bf8-9d4d-150dfba3b132',
  'ed4eb599-3b8a-494b-bd00-00030a3f749e','6a6ff51a-3228-4e9d-9420-47568edfae64',
  '4992693a-8e6a-4c9c-8599-9b43aedd692e','899692a7-cc25-4d1c-854f-803f78aa8671',
  '982a7def-9a20-4b32-ab0e-2eb6078c851f','92911a09-495a-4931-9040-cf762c40d941',
  'b2035950-a820-4cb3-86a9-d85b7d470ade','ecbdc239-e5da-4665-ba0d-ebadc4866194',
  'bc57e3f1-5235-4f21-bdf9-c3433cfe234f','2b65575d-8ecc-49cf-83bb-bbf188960518',
  'b2f22402-e504-4cf0-bede-8dd1e3c6b04c','f1a52e77-570a-4ae8-9d32-e5282429710e',
  '25f69fa8-d1c5-4ed6-b1f0-9050b94bfb2d','b90348b8-3448-4988-b7f7-740d3ff8c84e',
  'dd977f3a-ba9e-4587-98c1-fdbe5ada323d','858c0cb2-e569-4669-954f-92a7ca460e3a',
  '0a56ef54-eb6b-46be-b62d-dda2b0860b23','231f2492-81ed-474c-adde-58370ef45353',
  'd2627865-0284-4003-9bcf-870b80bcd38d','af2828c5-3179-4e02-9c23-30f6cd5fcab8',
  -- B (5)
  'c0a7ee88-e0f9-470b-8fe0-0bb141ff4501','b7cdb83f-d486-4dad-aab2-4830da417fe4',
  '57801474-02c5-461e-8ffd-8767e30b7a35','fd1e89c2-3091-4fc4-ba60-e722f64ca5b0',
  'bfaec60f-9dfa-46d8-a3dc-3af08812aa2d'
);

UPDATE alocacoes_escala
SET ordem_servico_id = NULL
WHERE id IN (
  -- A (30)
  '7ea4c873-9bbd-4877-827f-1b8888cb08e7','b60142b4-6705-458e-91d0-65643a5e1d95',
  'a9f7f8ba-2e51-49ae-a140-16ca3fce3814','57624cae-3ce0-4c8f-b638-4e7e4edf3d00',
  'aceef5f8-6e8f-46e7-8e9c-0a1411a09388','9a00da38-d7dc-4c2b-85cf-3ffde3eedf88',
  '7a8904c8-3ca9-40c9-8ed4-ded6b5660389','7aee1381-59d8-474d-93b9-74b425eb1de0',
  '1fc92d46-6046-4624-980b-111af5bc447f','d19763f1-a8d1-4bf8-9d4d-150dfba3b132',
  'ed4eb599-3b8a-494b-bd00-00030a3f749e','6a6ff51a-3228-4e9d-9420-47568edfae64',
  '4992693a-8e6a-4c9c-8599-9b43aedd692e','899692a7-cc25-4d1c-854f-803f78aa8671',
  '982a7def-9a20-4b32-ab0e-2eb6078c851f','92911a09-495a-4931-9040-cf762c40d941',
  'b2035950-a820-4cb3-86a9-d85b7d470ade','ecbdc239-e5da-4665-ba0d-ebadc4866194',
  'bc57e3f1-5235-4f21-bdf9-c3433cfe234f','2b65575d-8ecc-49cf-83bb-bbf188960518',
  'b2f22402-e504-4cf0-bede-8dd1e3c6b04c','f1a52e77-570a-4ae8-9d32-e5282429710e',
  '25f69fa8-d1c5-4ed6-b1f0-9050b94bfb2d','b90348b8-3448-4988-b7f7-740d3ff8c84e',
  'dd977f3a-ba9e-4587-98c1-fdbe5ada323d','858c0cb2-e569-4669-954f-92a7ca460e3a',
  '0a56ef54-eb6b-46be-b62d-dda2b0860b23','231f2492-81ed-474c-adde-58370ef45353',
  'd2627865-0284-4003-9bcf-870b80bcd38d','af2828c5-3179-4e02-9c23-30f6cd5fcab8',
  -- B (5)
  'c0a7ee88-e0f9-470b-8fe0-0bb141ff4501','b7cdb83f-d486-4dad-aab2-4830da417fe4',
  '57801474-02c5-461e-8ffd-8767e30b7a35','fd1e89c2-3091-4fc4-ba60-e722f64ca5b0',
  'bfaec60f-9dfa-46d8-a3dc-3af08812aa2d'
);
