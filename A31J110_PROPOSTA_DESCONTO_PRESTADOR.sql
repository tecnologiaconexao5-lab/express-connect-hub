-- =============================================================================
-- A31-J1.10 — PROPOSTA MÍNIMA (NÃO APLICADA) — Persistência do
-- "Desconto / Ajuste Prestador" separada do "Desconto Cliente".
-- =============================================================================
-- CONTEXTO COMPROVADO (A31-J1.5 + A31-J1.10):
--   - alocacoes_escala só possui valor_desconto (único, compartilhado).
--   - pagamentos_prestadores.(valor_descontos|valor_ajustes|descontos|ajustes)
--     e pagamentos_prestadores_itens.valor_desconto são de FECHAMENTO/PAGAMENTO
--     (agregado/saída) — NÃO são fonte de entrada por serviço.
--   - financeiro_pagar.desconto é SAÍDA derivada (via M66).
--   - composicao_financeira_os.desconto_valor é a fórmula unificada M80.
--   - prestadores.retencoes/retencoes_descontos são cadastro recorrente.
--   - NÃO existe campo oficial reutilizável para desconto/ajuste DO PRESTADOR
--     por alocação/serviço → proposta de coluna aditiva abaixo.
-- =============================================================================

-- Proposta conceitual: coluna própria na fonte única (alocacoes_escala).
-- 100% ADITIVA: ADD COLUMN IF NOT EXISTS; sem DROP; sem DELETE; sem alterar
-- registros antigos; DEFAULT 0 mantém comportamento atual até ser preenchida.
ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS valor_desconto_prestador numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.alocacoes_escala.valor_desconto_prestador IS
  'A31-J1.10 — Desconto/Ajuste EXCLUSIVO do prestador por serviço (NÃO afeta o cliente). '
  'Complementa valor_desconto (desconto do cliente). Fonte de entrada: Lançamento Manual.';

-- =============================================================================
-- OBSERVAÇÕES (não fazem parte do DDL desta missão):
-- 1. NÃO executar automaticamente — requer aprovação e aplicação manual.
-- 2. Após a coluna existir, estender a leitura em:
--      centralFinanceiroService.ts  → descontosPrestador = valor_desconto_prestador
--      centralFinanceiroVisao.ts    → prestador usa valor_desconto_prestador
--      lancarServicoManual          → persistir valor_desconto_prestador
--      ConferenciaFinanceira.tsx    → passar o campo no submit
-- 3. Definir se o trigger M66/M80 deve incluir a coluna na fórmula
--    (v_outros_custos − desconto_prestador) — decisão de produto/fiscal.
-- =============================================================================
