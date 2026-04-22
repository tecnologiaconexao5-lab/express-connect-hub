-- ============================================================
-- AUTOMAÇÃO OPERACIONAL - FASE 1
-- Adicionar ao Supabase SQL Editor (após o schema principal)
-- ============================================================

-- ============================================================
-- 1. TABELA DE LOGS DE AUTOMAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automacao_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
    os_numero TEXT,
    evento TEXT NOT NULL,
    template_id TEXT,
    canal TEXT DEFAULT 'whatsapp',
    destinatario TEXT,
    corpo TEXT,
    status TEXT DEFAULT 'pendente',
    n8n_execution_id TEXT,
    resposta_ia TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automacao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read automacao_logs"
    ON public.automacao_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can insert automacao_logs"
    ON public.automacao_logs FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can update automacao_logs"
    ON public.automacao_logs FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- 2. COLUNAS OPCIONAIS EM ordens_servico
--    (não alteram estrutura existente)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ordens_servico' AND column_name = 'automacao_ativa'
    ) THEN
        ALTER TABLE public.ordens_servico ADD COLUMN automacao_ativa BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ordens_servico' AND column_name = 'whatsapp_prestador'
    ) THEN
        ALTER TABLE public.ordens_servico ADD COLUMN whatsapp_prestador TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ordens_servico' AND column_name = 'destinatario_nome'
    ) THEN
        ALTER TABLE public.ordens_servico ADD COLUMN destinatario_nome TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ordens_servico' AND column_name = 'ultimo_evento_enviado'
    ) THEN
        ALTER TABLE public.ordens_servico ADD COLUMN ultimo_evento_enviado TEXT;
    END IF;
END $$;

-- ============================================================
-- 3. FUNÇÃO DE DISPARO (Edge Function ready)
-- ============================================================
-- Esta função é chamada por triggers do banco quando status muda
-- Returns json com payload para n8n (Edge Function lê e faz POST)
CREATE OR REPLACE FUNCTION public.fn_dispatcher_automacao()
RETURNS TRIGGER AS $$
DECLARE
    evento_tipo TEXT;
    payload JSONB;
    url_wa TEXT;
BEGIN
    evento_tipo := NULL;

    -- Mapeamento de status -> tipo de evento
    IF TG_OP = 'INSERT' THEN
        evento_tipo := 'os_criada';
    ELSIF TG_OP = 'UPDATE' THEN
        CASE NEW.status
            WHEN 'aceita' THEN evento_tipo := 'os_aceita';
            WHEN 'em_andamento' THEN evento_tipo := 'os_iniciada';
            WHEN 'saida_coleta' THEN evento_tipo := 'os_saida_coleta';
            WHEN 'saida_entrega' THEN evento_tipo := 'os_saida_entrega';
            WHEN 'chegada_destino' THEN evento_tipo := 'os_chegada_destino';
            WHEN 'tentativa' THEN evento_tipo := 'os_tentativa_entrega';
            WHEN 'reentrega' THEN evento_tipo := 'os_reentrega';
            WHEN 'finalizada' THEN evento_tipo := 'os_finalizada';
            WHEN 'baixa_evidencia' THEN evento_tipo := 'os_baixa_evidencia';
            WHEN 'cancelada' THEN evento_tipo := 'os_cancelada';
            ELSE evento_tipo := NULL;
        END CASE;
    END IF;

    -- Se não há evento mapeado, não faz nada
    IF evento_tipo IS NULL THEN
        RETURN NEW;
    END IF;

    -- Se automação desativada na OS, pula
    IF COALESCE(NEW.automacao_ativa, true) = false THEN
        RETURN NEW;
    END IF;

    -- Monta payload para n8n
    payload := jsonb_build_object(
        'evento', evento_tipo,
        'timestamp', NOW()::text,
        'os_id', NEW.id::text,
        'os_numero', NEW.numero,
        'cliente', NEW.cliente,
        'prestador', NEW.prestador,
        'status', NEW.status,
        'whatsapp_destinatario', NEW.whatsapp_destinatario,
        'whatsapp_prestador', NEW.whatsapp_prestador,
        'url_rastreio', 'https://tms.conexaexpress.com.br/rastreio?os=' || NEW.numero,
        'origem', 'express-connect-hub',
        'version', '1.0.0'
    );

    -- IDEMPOTÊNCIA: checa se evento já existe como pendente/enviado/lido
    IF EXISTS (
        SELECT 1 FROM public.automacao_logs
        WHERE os_id = NEW.id
          AND evento = evento_tipo
          AND status IN ('pendente', 'enviado', 'lido')
    ) THEN
        RAISE NOTICE 'IDEMPOTENCIA: evento % ja enviado para OS %', evento_tipo, NEW.numero;
        RETURN NEW;
    END IF;

    -- Insere no log para Edge Function consumir
    INSERT INTO public.automacao_logs (os_id, os_numero, evento, canal, status, corpo)
    VALUES (
        NEW.id,
        NEW.numero,
        evento_tipo,
        'whatsapp',
        'pendente',
        payload::text
    );

    -- Atualiza último evento na OS
    NEW.ultimo_evento_enviado := evento_tipo;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. TRIGGERS NO BANCO (desativados por padrão)
--    Ativar individualmente conforme maturidade
-- ============================================================
DROP TRIGGER IF EXISTS trg_os_automatizacao_insert ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_os_automatizacao_update ON public.ordens_servico;

-- INSERT (desativado — confirmar que não quebra fluxo existente)
CREATE TRIGGER trg_os_automatizacao_insert
    AFTER INSERT ON public.ordens_servico
    REFERENCING NEW TABLE AS new_os
    FOR EACH STATEMENT
    WHEN (false)  -- false = desativado
    EXECUTE FUNCTION public.fn_dispatcher_automacao();

-- UPDATE (desativado)
CREATE TRIGGER trg_os_automatizacao_update
    AFTER UPDATE OF status ON public.ordens_servico
    REFERENCING OLD TABLE AS old_os NEW TABLE AS new_os
    FOR EACH STATEMENT
    WHEN (false)  -- false = desativado
    EXECUTE FUNCTION public.fn_dispatcher_automacao();

-- ============================================================
-- 5. VISÃO PARA MONITORAMENTO
-- ============================================================
CREATE OR REPLACE VIEW public.vw_automacao_monitor AS
SELECT
    al.id,
    al.os_numero,
    al.evento,
    al.canal,
    al.status,
    al.created_at,
    os.cliente,
    os.prestador,
    os.status AS os_status
FROM public.automacao_logs al
LEFT JOIN public.ordens_servico os ON os.id = al.os_id
ORDER BY al.created_at DESC
LIMIT 500;

-- ============================================================
-- NOTAS:
-- • Triggers estão com WHEN (false) para não quebrar operação
-- • Ativar via: UPDATE pg_trigger SET tgenable = 't' WHERE tgname = 'trg_os_automatizacao_insert';
-- • Prefixo de variáveis de ambiente no .env:
--   VITE_N8N_WEBHOOK_URL=https://seu-n8n.com/webhook/automacao
--   VITE_N8N_API_KEY=sua-chave
--   VITE_GROQ_API_KEY=sua-chave
--   VITE_AUTOMACAO_MODO=simulation
-- ============================================================