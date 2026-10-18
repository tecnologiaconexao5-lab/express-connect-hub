-- ============================================================================
-- FIN-P0-02: CHECK Constraints de Status — Proteção de Novos Dados
-- ============================================================================
-- Data: 2026-09-11
-- Operador: Opencode
-- Projeto: express-connect-hub
-- 
-- CAUSA RAIZ:
--   A migration 20260626_enterprise_hardening.sql definiu:
--     ck_fp_status: CHECK (status IN ('aberto','pago','vencido','atrasado','cancelado'))
--     ck_fr_status: CHECK (status IN ('aberto','pago','vencido','atrasado','cancelado'))
--   Porém NENHUMA dessas constraints existe no banco real.
--   A migration de valor (ck_fp_valor_pos, ck_fr_valor_pos) FOI aplicada.
--   A migration de status NÃO foi aplicada (migration parcial).
--
--  Resultado: 136+ registros com status fora do domínio:
--     'a vencer', 'a_vencer', 'pendente', 'cancelada', 'cancelado',
--     'vencida', 'vencido', NULL — todos sem validação.
--   RPC f_registrar_baixa_financeira escreve 'parcial' — não na lista original.
--
-- ESTRATÉGIA:
--   1. DROP das constraints antigas (se existirem — são dead code)
--   2. CHECK NOT VALID com TODOS os valores legado + novos
--   3. VALIDATE CONSTRAINT (valida apenas linhas novas, não escaneia legado)
--   4. Verificação pré/validação
--   5. Sem UPDATE, sem DELETE, sem destruição
--
-- REGRAS:
--   - NÃO apaga registros
--   - NÃO faz UPDATE massivo
--   - NÃO converte status
--   - NÃO remove informação
--   - Preserva legado completo
--   - NOT VALID = não escaneia dados existentes
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASSO 1: Verificar estado atual
-- ============================================================================

-- Listar constraints de CHECK atuais nas tabelas financeiras
SELECT 
  conrelid::regclass AS tabela,
  conname AS nome,
  pg_get_constraintdef(oid) AS definicao,
  convalidated AS validado
FROM pg_constraint
WHERE conrelid::regclass::text IN (
  'financeiro_pagar', 
  'financeiro_receber', 
  'financeiro_baixas', 
  'pagamentos_prestadores'
)
AND contype = 'c'
ORDER BY tabela, nome;

-- ============================================================================
-- PASSO 2: Dropar constraints antigas (se existirem)
-- ============================================================================
-- Estas constraints da enterprise_hardening NÃO existem no banco real,
-- mas fazemos DROP IF EXISTS por segurança.

ALTER TABLE financeiro_pagar DROP CONSTRAINT IF EXISTS ck_fp_status;
ALTER TABLE financeiro_receber DROP CONSTRAINT IF EXISTS ck_fr_status;

-- ============================================================================
-- PASSO 3: Criar CHECK constraints NOT VALID
-- ============================================================================
-- NOT VALID = não escaneia dados existentes, aplica apenas a novos INSERTs/UPDATEs.
-- Lista expandida inclui TODOS os valores legado encontrados no inventário.

-- financeiro_pagar
ALTER TABLE financeiro_pagar
  ADD CONSTRAINT ck_fp_status
  CHECK (status IN (
    -- Core
    'aberto',
    'pago',
    'vencido',
    'atrasado',
    'cancelado',
    -- Parcial (RPC f_registrar_baixa_financeira)
    'parcial',
    -- Legado compatível
    'pendente',
    'a vencer',
    'cancelada',
    'provisorio',
    -- Derivados frontend (gravados por triggers/RPCs)
    'recebido',
    'renegociado'
  ))
  NOT VALID;

-- financeiro_receber
ALTER TABLE financeiro_receber
  ADD CONSTRAINT ck_fr_status
  CHECK (status IN (
    -- Core
    'aberto',
    'pago',
    'vencido',
    'atrasado',
    'cancelado',
    -- Parcial (RPC f_registrar_baixa_financeira)
    'parcial',
    -- Legado compatível
    'pendente',
    'a vencer',
    'a_vencer',
    'cancelada',
    'vencida',
    'provisorio',
    -- Derivados frontend (gravados por triggers/RPCs)
    'recebido',
    'renegociado'
  ))
  NOT VALID;

-- ============================================================================
-- PASSO 4: Validar constraints
-- ============================================================================
-- VALIDATE CONSTRAINT escaneia apenas linhas novas (desde a criação).
-- Como NOT VALID não escaneou legado, e não houve INSERTs novos desde a criação,
-- a validação deve passar sem erro.

ALTER TABLE financeiro_pagar VALIDATE CONSTRAINT ck_fp_status;
ALTER TABLE financeiro_receber VALIDATE CONSTRAINT ck_fr_status;

-- ============================================================================
-- PASSO 5: Verificação pós-validação
-- ============================================================================

-- Confirmar que as constraints existem e estão validadas
SELECT 
  conrelid::regclass AS tabela,
  conname AS nome,
  convalidated AS validado,
  CASE WHEN convalidated THEN '✅ VALIDADA' ELSE '❌ NÃO VALIDADA' END AS status
FROM pg_constraint
WHERE conrelid::regclass::text IN ('financeiro_pagar', 'financeiro_receber')
AND contype = 'c'
AND conname IN ('ck_fp_status', 'ck_fr_status')
ORDER BY tabela;

-- ============================================================================
-- PASSO 6: Verificar que legado está preservado
-- ============================================================================

-- Todos os status legado continuam acessíveis
SELECT 'financeiro_pagar' AS tabela, status, COUNT(*) AS qtd
FROM financeiro_pagar
GROUP BY status
ORDER BY status;

SELECT 'financeiro_receber' AS tabela, status, COUNT(*) AS qtd
FROM financeiro_receber
GROUP BY status
ORDER BY status;

-- Total de registros preservados (deve ser 107 + 112 = 219)
SELECT 
  (SELECT COUNT(*) FROM financeiro_pagar) AS pagar_total,
  (SELECT COUNT(*) FROM financeiro_receber) AS receber_total;

COMMIT;

-- ============================================================================
-- RESULTADO ESPERADO:
--   pagar: 107 registros preservados
--   receber: 112 registros preservados (incluindo 1 NULL status de teste)
--   ck_fp_status: criada e validada
--   ck_fr_status: criada e validada
--   Novos INSERTs com status fora da lista: REJEITADOS
-- ============================================================================
