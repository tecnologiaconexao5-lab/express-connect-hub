-- ============================================================================
-- EXECUTAR_ESCALA_COMPLETA.sql
-- Migration única para a Escala Operacional
-- 
-- COMO EXECUTAR:
-- 1. Acesse https://supabase.com/dashboard/project/uwrvzsjtpgaifkktpepn
-- 2. Vá em SQL Editor
-- 3. Cole TODO o conteúdo deste arquivo
-- 4. Clique em RUN (ou pressione Ctrl+Enter)
-- 5. Aguarde a execução (esperada: ~2 segundos)
-- 6. Verifique o resultado no final
-- ============================================================================

-- ============================================================================
-- PARTE 1: TABELA PRINCIPAL alocacoes_escala
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alocacoes_escala (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Relacionamentos
    empresa_id uuid,
    cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    prestador_id uuid REFERENCES public.prestadores(id) ON DELETE SET NULL,
    ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    ordem_carregamento_id uuid,
    
    -- Dados operacionais
    data_escala date NOT NULL,
    turno text DEFAULT 'diurno',
    tipo_veiculo text NOT NULL,
    placa text,
    regiao text,
    rota text,
    origem text,
    destino text,
    
    -- Status e controle
    status text NOT NULL DEFAULT 'planejada' CHECK (
        status IN (
            'planejada', 
            'aguardando_aceite', 
            'aceita', 
            'recusada', 
            'em_rota', 
            'concluida', 
            'cancelada', 
            'ocorrencia'
        )
    ),
    status_pagamento text DEFAULT 'pendente' CHECK (
        status_pagamento IN ('pendente', 'aprovado', 'pago', 'cancelado')
    ),
    
    -- Métricas operacionais
    quantidade_entregas integer DEFAULT 0,
    quantidade_coletas integer DEFAULT 0,
    quantidade_paradas integer DEFAULT 0,
    km_previstos numeric DEFAULT 0,
    km_realizados numeric DEFAULT 0,
    
    -- Financeiro
    valor_frete numeric DEFAULT 0,
    valor_repasse numeric DEFAULT 0,
    valor_pedagio numeric DEFAULT 0,
    valor_combustivel numeric DEFAULT 0,
    valor_ajudante numeric DEFAULT 0,
    valor_adicional numeric DEFAULT 0,
    valor_desconto numeric DEFAULT 0,
    valor_total numeric GENERATED ALWAYS AS (
        valor_repasse + valor_pedagio + valor_combustivel + valor_ajudante + valor_adicional - valor_desconto
    ) STORED,
    
    -- Controles detalhados de valores (compatível com EscalaLista.tsx)
    valor_tipo text DEFAULT 'fixo' CHECK (valor_tipo IN ('fixo', 'percentual')),
    valor_percentual numeric DEFAULT 0,
    valor_fixo numeric DEFAULT 0,
    combustivel_valor numeric DEFAULT 0,
    km_rodados numeric DEFAULT 0,
    valor_km numeric DEFAULT 0,
    pedagio_franquia numeric DEFAULT 0,
    pedagio_excedente numeric DEFAULT 0,
    pedagio_cobrar_excedente boolean DEFAULT false,
    diarias_adicionais integer DEFAULT 0,
    valor_diaria numeric DEFAULT 0,
    segunda_saida boolean DEFAULT false,
    valor_segunda_saida numeric DEFAULT 0,
    terceira_saida boolean DEFAULT false,
    valor_terceira_saida numeric DEFAULT 0,
    saidas_adicionais integer DEFAULT 0,
    valor_saida_adicional numeric DEFAULT 0,
    ajudantes integer DEFAULT 0,
    valor_ajudante_unit numeric DEFAULT 0,
    reembolsos_outros text,
    valor_reembolso_outros numeric DEFAULT 0,
    
    -- Tempos e horários
    horario_saida time,
    horario_retorno_previsto time,
    horario_inicio_real timestamptz,
    horario_fim_real timestamptz,
    tempo_total_minutos integer,
    
    -- App Prestador
    aceite_prestador boolean DEFAULT false,
    data_aceite timestamptz,
    motivo_recusa text,
    finalizada boolean DEFAULT false,
    data_finalizacao timestamptz,
    comprovante_url text,
    assinatura_url text,
    fotos_entrega text[],
    
    -- Ocorrências e observações
    ocorrencias_count integer DEFAULT 0,
    ocorrencias_descricao text,
    observacoes text,
    instrucoes_operacionais text,
    observacoes_internas text,
    
    -- Informações de tabela de preços
    tabela_valores_id uuid,
    tem_regra_especial boolean DEFAULT false,
    
    -- Metadados e flexibilidade
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[],
    
    -- Auditoria
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid,
    updated_by uuid
);

-- ============================================================================
-- PARTE 2: TABELA DE HISTÓRICO
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.historico_alocacoes_escala (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    alocacao_id uuid NOT NULL REFERENCES public.alocacoes_escala(id) ON DELETE CASCADE,
    
    evento text NOT NULL,
    status_anterior text,
    status_novo text,
    
    descricao text,
    payload jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz DEFAULT now(),
    created_by uuid,
    ip_origem text,
    user_agent text
);

-- ============================================================================
-- PARTE 3: ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_data ON public.alocacoes_escala(data_escala);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_status ON public.alocacoes_escala(status);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_prestador ON public.alocacoes_escala(prestador_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_cliente ON public.alocacoes_escala(cliente_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_os ON public.alocacoes_escala(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_data_prestador ON public.alocacoes_escala(data_escala, prestador_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_data_status ON public.alocacoes_escala(data_escala, status);
CREATE INDEX IF NOT EXISTS idx_historico_alocacao ON public.historico_alocacoes_escala(alocacao_id);
CREATE INDEX IF NOT EXISTS idx_historico_created ON public.historico_alocacoes_escala(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_metadata ON public.alocacoes_escala USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_tags ON public.alocacoes_escala USING gin(tags);

-- ============================================================================
-- PARTE 4: TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_alocacoes_escala_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alocacoes_escala_updated_at ON public.alocacoes_escala;
CREATE TRIGGER trg_alocacoes_escala_updated_at
    BEFORE UPDATE ON public.alocacoes_escala
    FOR EACH ROW
    EXECUTE FUNCTION update_alocacoes_escala_updated_at();

CREATE OR REPLACE FUNCTION registrar_historico_alocacao()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id, evento, status_anterior, status_novo, descricao, payload, created_by
        ) VALUES (
            NEW.id, 'mudanca_status', OLD.status, NEW.status,
            'Status alterado de ' || OLD.status || ' para ' || NEW.status,
            jsonb_build_object('status_anterior', OLD.status, 'status_novo', NEW.status, 'updated_by', NEW.updated_by),
            NEW.updated_by
        );
    END IF;
    
    IF (TG_OP = 'UPDATE' AND OLD.aceite_prestador = false AND NEW.aceite_prestador = true) THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id, evento, descricao, payload, created_by
        ) VALUES (
            NEW.id, 'aceite_prestador', 'Prestador aceitou a alocação',
            jsonb_build_object('prestador_id', NEW.prestador_id, 'data_aceite', NEW.data_aceite),
            NEW.updated_by
        );
    END IF;
    
    IF (TG_OP = 'UPDATE' AND OLD.finalizada = false AND NEW.finalizada = true) THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id, evento, descricao, payload, created_by
        ) VALUES (
            NEW.id, 'finalizacao', 'Alocação finalizada',
            jsonb_build_object('data_finalizacao', NEW.data_finalizacao, 'km_realizados', NEW.km_realizados, 'tempo_total_minutos', NEW.tempo_total_minutos),
            NEW.updated_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registrar_historico_alocacao ON public.alocacoes_escala;
CREATE TRIGGER trg_registrar_historico_alocacao
    AFTER INSERT OR UPDATE ON public.alocacoes_escala
    FOR EACH ROW
    EXECUTE FUNCTION registrar_historico_alocacao();

-- ============================================================================
-- PARTE 5: REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.alocacoes_escala;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.historico_alocacoes_escala;

-- ============================================================================
-- PARTE 6: COLUNAS FINANCEIRAS NA TABELA tabelas_valores
-- ============================================================================

ALTER TABLE public.tabelas_valores 
ADD COLUMN IF NOT EXISTS valor_cliente numeric DEFAULT 0;

ALTER TABLE public.tabelas_valores 
ADD COLUMN IF NOT EXISTS tipo_repasse_prestador text DEFAULT 'percentual';

ALTER TABLE public.tabelas_valores 
ADD COLUMN IF NOT EXISTS valor_fixo_prestador numeric DEFAULT 0;

-- ============================================================================
-- PARTE 7: VERIFICAÇÃO PÓS-EXECUÇÃO
-- ============================================================================

SELECT '=== VERIFICAÇÃO PÓS-MIGRAÇÃO ===' AS "";

SELECT 'alocacoes_escala' AS tabela, 
    CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alocacoes_escala') 
    THEN 'CRIADA' ELSE 'AUSENTE' END AS status;

SELECT 'historico_alocacoes_escala' AS tabela,
    CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'historico_alocacoes_escala') 
    THEN 'CRIADA' ELSE 'AUSENTE' END AS status;

SELECT 'tabelas_valores.valor_cliente' AS coluna,
    CASE WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tabelas_valores' AND column_name = 'valor_cliente') 
    THEN 'ADICIONADA' ELSE 'AUSENTE' END AS status;

SELECT 'tabelas_valores.tipo_repasse_prestador' AS coluna,
    CASE WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tabelas_valores' AND column_name = 'tipo_repasse_prestador') 
    THEN 'ADICIONADA' ELSE 'AUSENTE' END AS status;

SELECT 'tabelas_valores.valor_fixo_prestador' AS coluna,
    CASE WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tabelas_valores' AND column_name = 'valor_fixo_prestador') 
    THEN 'ADICIONADA' ELSE 'AUSENTE' END AS status;

SELECT '=== FIM DA VERIFICAÇÃO ===' AS "";

-- Se todas as verificações mostrarem CRIADA/ADICIONADA, a migration foi bem-sucedida.
-- Agora teste na tela: Operação > Escala Operacional
