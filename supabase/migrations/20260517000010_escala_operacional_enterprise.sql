-- Correção 10: Escala Operacional Enterprise

CREATE TABLE IF NOT EXISTS public.escala_operacional (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    os_id uuid NOT NULL,
    rota_id uuid,
    prestador_id uuid NOT NULL,
    motorista_nome text NOT NULL,
    veiculo_id uuid NOT NULL,
    placa text NOT NULL,
    data_operacao date NOT NULL,
    inicio_previsto timestamp with time zone NOT NULL,
    fim_previsto timestamp with time zone NOT NULL,
    status text NOT NULL,
    prioridade text NOT NULL,
    observacoes text,
    origem text,
    criado_por text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_escala_data_operacao ON public.escala_operacional (data_operacao);
CREATE INDEX IF NOT EXISTS idx_escala_status ON public.escala_operacional (status);
CREATE INDEX IF NOT EXISTS idx_escala_prestador ON public.escala_operacional (prestador_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.escala_operacional;

-- Função de validações IA (conflito motorista e veículo)
CREATE OR REPLACE FUNCTION trg_escala_validacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    conflito int;
BEGIN
    -- Conflito de motorista (mesmo motorista em outra operação com sobreposição de horário)
    SELECT COUNT(*) INTO conflito FROM public.escala_operacional
    WHERE motorista_nome = NEW.motorista_nome
      AND id <> NEW.id
      AND (
        (inicio_previsto, fim_previsto) OVERLAPS (NEW.inicio_previsto, NEW.fim_previsto)
      );
    IF conflito > 0 THEN
        INSERT INTO public.escalonamentos_humanos (
            origem, modulo, referencia_id, tipo, prioridade, status, titulo, descricao, mensagem_original, intencao, confianca
        ) VALUES (
            'escala_operacional', 'operacional', NEW.id, 'conflito_motorista', 'critica', 'aberto',
            'Conflito de Motorista Detectado',
            'Motorista '||NEW.motorista_nome||' está programado em outra operação no mesmo período.',
            'Conflito de motorista na escala.',
            'conflito', 100
        );
    END IF;
    -- Conflito de veículo (mesmo veículo em outra operação sobreposta)
    SELECT COUNT(*) INTO conflito FROM public.escala_operacional
    WHERE veiculo_id = NEW.veiculo_id
      AND id <> NEW.id
      AND (
        (inicio_previsto, fim_previsto) OVERLAPS (NEW.inicio_previsto, NEW.fim_previsto)
      );
    IF conflito > 0 THEN
        INSERT INTO public.escalonamentos_humanos (
            origem, modulo, referencia_id, tipo, prioridade, status, titulo, descricao, mensagem_original, intencao, confianca
        ) VALUES (
            'escala_operacional', 'operacional', NEW.id, 'conflito_veiculo', 'critica', 'aberto',
            'Conflito de Veículo Detectado',
            'Veículo '||NEW.placa||' está programado em outra operação no mesmo período.',
            'Conflito de veículo na escala.',
            'conflito', 100
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escala_validacoes_insert ON public.escala_operacional;
CREATE TRIGGER trg_escala_validacoes_insert
AFTER INSERT OR UPDATE ON public.escala_operacional
FOR EACH ROW
EXECUTE FUNCTION trg_escala_validacoes();
