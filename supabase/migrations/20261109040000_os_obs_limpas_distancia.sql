-- ============================================================================
-- OS — OBSERVAÇÕES LIMPAS + DISTÂNCIA REAL (Cotação Express)
-- Data: 2026-11-09
--
-- Problemas:
--  1) A OS criada pela cotação pública gravava em `observacoes_gerais` todo o
--     texto "Cotação web (Fase 2) — cliente ... WhatsApp ... valor ...".
--  2) A OS ficava com `distancia_km = 0` (a cotação só guardava a distância no
--     metadata da precificação), exibindo "0 km" na visualização.
--
-- Solução (sem reescrever a RPC do Lote 1): trigger de normalização em
-- `ordens_servico` que:
--   • limpa as observações da cotação, preservando APENAS a janela operacional
--     ("Coleta agendada: DD/MM/AAAA · Horário: ...");
--   • remove sufixos de blindagem ("Aguardando confirmação..."/"Cancelada...");
--   • preenche `distancia_km` e `carga.distancia_km` a partir do metadata da
--     cotação vinculada (`orcamentos.pedido_interno` → `cotacoes_publicas`).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.f_trg_os_normalizar_cotacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_texto   text := COALESCE(NEW.observacoes_gerais, '');
  v_data    text;
  v_horario text;
  v_clean   text;
  v_km      numeric;
BEGIN
  -- 1) DISTÂNCIA — se vazia/0, busca na precificação da cotação vinculada.
  IF (NEW.distancia_km IS NULL OR NEW.distancia_km = 0) AND NEW.orcamento_id IS NOT NULL THEN
    SELECT NULLIF(c.metadata -> 'precificacao' ->> 'distancia_km', '')::numeric
      INTO v_km
      FROM public.orcamentos o
      JOIN public.cotacoes_publicas c ON c.id::text = o.pedido_interno
     WHERE o.id = NEW.orcamento_id
     LIMIT 1;

    IF v_km IS NOT NULL AND v_km > 0 THEN
      NEW.distancia_km := v_km;
    END IF;
  END IF;

  IF NEW.distancia_km IS NOT NULL AND NEW.distancia_km > 0 THEN
    NEW.carga := COALESCE(NEW.carga, '{}'::jsonb) || jsonb_build_object(
      'distancia_km', NEW.distancia_km,
      'distancia_texto', NEW.distancia_km::text || ' km'
    );
  END IF;

  -- 2) OBSERVAÇÕES — limpa o lixo do formulário do cliente.
  IF v_texto ILIKE '%Cotação web (Fase 2)%' THEN
    v_data := (regexp_match(v_texto, 'Data desejada:\s*(\d{2}/\d{2}/\d{4})'))[1];
    v_horario := btrim(COALESCE((regexp_match(v_texto, 'Horário:\s*([^·|]+)'))[1], ''));

    v_clean := NULLIF(btrim(concat_ws(' · ',
      CASE WHEN v_data IS NOT NULL THEN 'Coleta agendada: ' || v_data END,
      CASE WHEN v_horario <> '' THEN 'Horário: ' || v_horario END
    )), '');

    NEW.observacoes_gerais := v_clean;
  ELSE
    -- Remove sufixos de blindagem de qualquer OS, preservando notas legítimas.
    v_clean := btrim(regexp_replace(
      regexp_replace(
        v_texto,
        '\s*\|\s*Aguardando confirmação do cliente via WhatsApp', '', 'gi'
      ),
      '\s*\|\s*Cancelada pelo Cliente \(não confirmou via WhatsApp\)', '', 'gi'
    ));
    NEW.observacoes_gerais := NULLIF(v_clean, '');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_normalizar_cotacao ON public.ordens_servico;
CREATE TRIGGER trg_os_normalizar_cotacao
  BEFORE INSERT OR UPDATE OF observacoes_gerais, carga, distancia_km
  ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.f_trg_os_normalizar_cotacao();

-- ---------------------------------------------------------------------------
-- Backfill das OS já existentes (dispara o trigger em cada linha).
-- Não altera `updated_at` (não está no SET).
-- ---------------------------------------------------------------------------
UPDATE public.ordens_servico
   SET observacoes_gerais = observacoes_gerais,
       distancia_km = distancia_km
 WHERE observacoes_gerais ILIKE '%Cotação web (Fase 2)%'
    OR observacoes_gerais ILIKE '%Aguardando confirmação do cliente%'
    OR observacoes_gerais ILIKE '%Cancelada pelo Cliente%'
    OR ((distancia_km IS NULL OR distancia_km = 0) AND orcamento_id IS NOT NULL);

NOTIFY pgrst, 'reload schema';
