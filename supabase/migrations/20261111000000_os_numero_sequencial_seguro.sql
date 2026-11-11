-- ============================================================================
-- OS — SEQUENCIADOR SIMPLES E SEQUENCIAL (SEM Math.random)
--
-- Problema: o painel exibia saltos de numeração (ex.: 1699 -> 3703) porque
--   (a) o frontend usava Math.random como fallback;
--   (b) a sequence global `os_numero_seq` podia ficar à frente dos números
--       realmente existentes (números "queimados" em tentativas antigas).
--
-- Solução: função que calcula o próximo número a partir do MAIOR número
-- realmente existente no mês corrente (`OS-AAAAMM-NNNNN`), +1.
--   • Ignora legados fora do padrão (ex.: OS-202611-438527) via regex 1..5 dígitos.
--   • Não consome sequence — não há "pulos" por tentativa falha.
--   • Mantém a função antiga `f_proximo_numero_os()` intacta para os fluxos
--     que já a utilizam (cotação). O TMS passa a chamar esta função no Salvar.
--
-- Rollback: DROP FUNCTION public.f_proximo_numero_os_sequencial();
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_proximo_numero_os_sequencial()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_prefixo text;
  v_proximo integer;
BEGIN
  v_prefixo := 'OS-' || to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYYMM') || '-';

  SELECT COALESCE(
           MAX((regexp_replace(numero, '^OS-[0-9]{6}-', ''))::integer),
           1199
         ) + 1
    INTO v_proximo
    FROM public.ordens_servico
   WHERE numero LIKE v_prefixo || '%'
     AND numero ~ ('^' || v_prefixo || '[0-9]{1,5}$');

  RETURN v_prefixo || lpad(v_proximo::text, 4, '0');
END;
$function$;

REVOKE ALL ON FUNCTION public.f_proximo_numero_os_sequencial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_proximo_numero_os_sequencial() TO authenticated, service_role;

-- Alinha a sequence antiga (usada pela conversão de cotação) ao MAIOR número
-- realmente existente. Se ela estiver à frente (números "queimados"), volta
-- para o ponto sequencial correto. Ignora legados aleatórios de 6 dígitos.
DO $align$
DECLARE
  v_max integer;
  v_seq integer;
BEGIN
  SELECT COALESCE(MAX((regexp_replace(numero, '^OS-[0-9]{6}-', ''))::integer), 1199)
    INTO v_max
    FROM public.ordens_servico
   WHERE numero ~ '^OS-[0-9]{6}-[0-9]{1,5}$';

  SELECT last_value INTO v_seq FROM public.os_numero_seq;

  IF v_seq IS DISTINCT FROM v_max THEN
    PERFORM setval('public.os_numero_seq', GREATEST(v_max, 1199), true);
  END IF;
END;
$align$;

NOTIFY pgrst, 'reload schema';
