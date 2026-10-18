-- MISSÃO TMS-006.5 — CORREÇÃO DO TRIGGER DE CANCELAMENTO
-- 
-- Problema: trg_evento_alocacao_cancelada referencia NEW.motivo_cancelamento
-- mas esta coluna NÃO EXISTE em alocacoes_escala.
-- A coluna real para motivo de cancelamento é observacoes_internas.
--
-- Efeito: QUALQUER cancelamento de alocação falha com:
--   record "new" has no field "motivo_cancelamento"

CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_cancelada()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'escala.alocacao.cancelada',
    'alocacao',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.updated_by,
    'internal',
    jsonb_build_object(
      'alocacao_id', NEW.id,
      'os_id', NEW.ordem_servico_id,
      'prestador_id', NEW.prestador_id,
      'motivo_cancelamento', NEW.observacoes_internas,  -- FIX: column exists
      'status_anterior', OLD.status,
      'data_cancelamento', NOW()
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_alocacao_cancelada',
      'source_table', 'alocacoes_escala'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Rollback:
-- CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_cancelada()
-- ... (código original com NEW.motivo_cancelamento)
