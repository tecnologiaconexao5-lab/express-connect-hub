-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 10
-- Notificacoes Cliente Enterprise
-- Data: 2026-06-26
-- ============================================================

-- ============================================================
-- SECAO 1: Expandir portal_notificacoes com fila de envio
-- ============================================================

-- Adicionar colunas de controle de envio (se nao existirem)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_notificacoes' AND column_name = 'status_envio') THEN
        ALTER TABLE portal_notificacoes ADD COLUMN status_envio TEXT DEFAULT 'pendente';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_notificacoes' AND column_name = 'erro_envio') THEN
        ALTER TABLE portal_notificacoes ADD COLUMN erro_envio TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_notificacoes' AND column_name = 'tentativas') THEN
        ALTER TABLE portal_notificacoes ADD COLUMN tentativas INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_notificacoes' AND column_name = 'enviado_em') THEN
        ALTER TABLE portal_notificacoes ADD COLUMN enviado_em TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_notificacoes' AND column_name = 'destinatario') THEN
        ALTER TABLE portal_notificacoes ADD COLUMN destinatario TEXT;
    END IF;
END $$;

-- CHECK constraint para status_envio
DO $$ BEGIN
    ALTER TABLE portal_notificacoes ADD CONSTRAINT ck_pn_status_envio CHECK (status_envio IN ('pendente','enviado','erro','ignorado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indice para fila de envio
CREATE INDEX IF NOT EXISTS idx_pn_status_envio ON portal_notificacoes(status_envio) WHERE status_envio = 'pendente';

-- ============================================================
-- SECAO 2: Funcao para criar notificacao em mudanca de status OS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_notificar_mudanca_status_os()
RETURNS TRIGGER AS $$
DECLARE
    v_cliente_id UUID;
    v_cliente_email TEXT;
    v_mensagem TEXT;
    v_titulo TEXT;
    v_os_numero TEXT;
BEGIN
    -- So notifica se status REALMENTE mudou
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    -- Buscar dados do cliente vinculado
    SELECT id INTO v_cliente_id FROM clientes WHERE id = NEW.cliente_id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    v_os_numero := COALESCE(NEW.numero, substring(NEW.id::text, 1, 8));

    -- Mapear status para mensagem amigavel
    CASE NEW.status
        WHEN 'pendente' THEN
            v_titulo := 'OS ' || v_os_numero || ' — Aguardando';
            v_mensagem := 'Sua solicitacao foi registrada e esta aguardando processamento. Acompanhe em: /rastrear/' || v_os_numero;
        WHEN 'agendada' THEN
            v_titulo := 'OS ' || v_os_numero || ' — Agendada';
            v_mensagem := 'Sua entrega foi agendada' || CASE WHEN NEW.data_programada IS NOT NULL THEN ' para ' || NEW.data_programada::text ELSE '' END || '. Acompanhe em: /rastrear/' || v_os_numero;
        WHEN 'em_andamento', 'em_rota' THEN
            v_titulo := 'OS ' || v_os_numero || ' — Em Rota';
            v_mensagem := 'Sua entrega esta em rota. Acompanhe em tempo real: /rastrear/' || v_os_numero;
        WHEN 'entregue', 'finalizada', 'concluida' THEN
            v_titulo := 'OS ' || v_os_numero || ' — Concluida';
            v_mensagem := 'Sua entrega foi concluida. Obrigado por utilizar nossos servicos.';
        WHEN 'cancelada' THEN
            v_titulo := 'OS ' || v_os_numero || ' — Cancelada';
            v_mensagem := 'Sua solicitacao foi cancelada. Entre em contato para mais informacoes.';
        WHEN 'ocorrencia' THEN
            v_titulo := 'OS ' || v_os_numero || ' — Ocorrencia';
            v_mensagem := 'Houve uma ocorrencia na sua entrega. Nossa equipe ja esta cuidando.';
        ELSE
            RETURN NEW;
    END CASE;

    -- Inserir notificacao (evitar duplicata: mesma OS + mesmo tipo + mesmo dia)
    IF NOT EXISTS (
        SELECT 1 FROM portal_notificacoes
        WHERE os_id = NEW.id
          AND tipo = 'status_os'
          AND titulo = v_titulo
          AND created_at::date = CURRENT_DATE
    ) THEN
        INSERT INTO portal_notificacoes (
            cliente_id, os_id, tipo, titulo, mensagem, canal, prioridade, status_envio, destinatario
        ) VALUES (
            v_cliente_id, NEW.id, 'status_os', v_titulo, v_mensagem, 'email', 'normal', 'pendente', v_cliente_email
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Aplicar trigger
DROP TRIGGER IF EXISTS trg_notificar_status_os ON ordens_servico;
CREATE TRIGGER trg_notificar_status_os
    AFTER UPDATE OF status ON ordens_servico
    FOR EACH ROW
    EXECUTE FUNCTION fn_notificar_mudanca_status_os();

-- ============================================================
-- SECAO 3: View para n8n consumir notificacoes pendentes
-- ============================================================

CREATE OR REPLACE VIEW vw_notificacoes_pendentes AS
SELECT
    pn.id,
    pn.cliente_id,
    c.nome_fantasia AS cliente_nome,
    c.email AS cliente_email,
    c.telefone AS cliente_telefone,
    pn.os_id,
    os.numero AS os_numero,
    pn.tipo,
    pn.titulo,
    pn.mensagem,
    pn.canal,
    pn.prioridade,
    pn.tentativas,
    pn.created_at
FROM portal_notificacoes pn
LEFT JOIN clientes c ON c.id = pn.cliente_id
LEFT JOIN ordens_servico os ON os.id = pn.os_id
WHERE pn.status_envio = 'pendente'
ORDER BY pn.prioridade DESC, pn.created_at ASC;

-- ============================================================
-- FIM MIGRATION MISSAO 10
-- ============================================================
