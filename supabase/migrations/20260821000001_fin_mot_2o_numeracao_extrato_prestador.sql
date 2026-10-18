-- ============================================================
-- FIN-MOT-2O — NUMERAÇÃO HUMANA EP NA ESTRUTURA REAL
-- Adiciona numero_fechamento em public.pagamentos_prestadores
-- para identificação externa do extrato/fechamento do prestador.
--
-- FORMATO EXTERNO: EP-AAAA-000001  (ex.: EP-2026-000001)
--
-- Base técnica: mesma de f_gerar_numero_fatura (fase2a_faturamento):
--   • SEQUENCE anual (seq_extrato_prestador_<ano>) criada on-demand;
--   • nextval atômico (serializa chamadas concorrentes — sem duplicidade);
--   • SEM MAX+1;
--   • padding de 6 dígitos.
--
-- Regras:
--   • coluna ADITIVA (NULL) — registros históricos permanecem NULL;
--   • SEM backfill;
--   • UNIQUE PARCIAL (numero_fechamento não nulo) impede duplicidade;
--   • RLS/grants da tabela NÃO são afrouxados; nada aberto a anon;
--   • RPC exige auth.uid() e GRANT somente a authenticated.
--
-- NÃO APLICADA em Produção nesta missão (somente preparação local).
-- ============================================================

-- ------------------------------------------------------------
-- A) Coluna aditiva numero_fechamento (histórico permanece NULL)
-- ------------------------------------------------------------
ALTER TABLE public.pagamentos_prestadores
  ADD COLUMN IF NOT EXISTS numero_fechamento TEXT;

-- ------------------------------------------------------------
-- B) UNIQUE parcial — impede duplicidade quando numero_fechamento
--    não for nulo; não interfere em registros históricos (NULL).
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_prestadores_numero_fechamento
  ON public.pagamentos_prestadores (numero_fechamento)
  WHERE numero_fechamento IS NOT NULL;

-- ------------------------------------------------------------
-- C) SEQUENCE anual (criada aditivamente; próxima ao padrão fatura)
--    O ano é fixado na criação da migration; a RPC cria as demais
--    sequências de anos futuros on-demand (mesmo comportamento da fatura).
-- ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.seq_extrato_prestador_2026 START 1;

-- ------------------------------------------------------------
-- D) RPC f_gerar_numero_extrato_prestador
--    Formato: EP-AAAA-000001 (nextval atômico, SEM MAX+1)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_gerar_numero_extrato_prestador()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ano integer;
  v_seq_name text;
  v_numero text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  v_ano := EXTRACT(YEAR FROM now())::integer;
  v_seq_name := 'seq_extrato_prestador_' || v_ano::text;

  -- Cria a sequência do ano se não existir (aditivo, on-demand)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_seq_name AND c.relkind = 'S'
  ) THEN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I START 1', v_seq_name);
  END IF;

  -- nextval é atômico e serializa chamadas concorrentes → impede duplicidade
  EXECUTE format('SELECT nextval(''public.%I'')', v_seq_name) INTO v_numero;

  RETURN format('EP-%s-%s', v_ano, LPAD(v_numero, 6, '0'));
END;
$function$;

-- ------------------------------------------------------------
-- E) SEGURANÇA: somente authenticated; nada aberto a anon/PUBLIC.
--    (não altera RLS existente de pagamentos_prestadores)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.f_gerar_numero_extrato_prestador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_gerar_numero_extrato_prestador() TO authenticated;
