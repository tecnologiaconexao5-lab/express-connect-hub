-- ============================================================
-- MIGRATION: 20260716_f34_agentes_ferramentas_autonomo
-- F34 — AGENTES COM FERRAMENTAS E EXECUÇÃO AUTÔNOMA
-- ============================================================
-- ADICIONA ao ia_ferramentas: parametros + timeout
-- CRIA tabela: ia_agentes_execucao (chain state)
-- ============================================================

-- ==================== COLUNAS NOVAS EM ia_ferramentas ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ia_ferramentas' AND column_name = 'parametros') THEN
    ALTER TABLE ia_ferramentas ADD COLUMN parametros JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ia_ferramentas' AND column_name = 'timeout_segundos') THEN
    ALTER TABLE ia_ferramentas ADD COLUMN timeout_segundos INTEGER DEFAULT 60;
  END IF;
END $$;

-- ==================== TABELA: AGENTES EXECUÇÃO (chain state) ====================
CREATE TABLE IF NOT EXISTS ia_agentes_execucao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  robo_id UUID REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  objetivo TEXT NOT NULL,
  contexto_inicial JSONB DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'ativa',
  passo_atual INTEGER DEFAULT 1,
  total_passos INTEGER DEFAULT 1,
  resultado_final JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ia_execucoes_ferramentas' AND column_name = 'agente_execucao_id') THEN
    ALTER TABLE ia_execucoes_ferramentas ADD COLUMN agente_execucao_id UUID REFERENCES ia_agentes_execucao(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ia_execucoes_ferramentas' AND column_name = 'passo_ordem') THEN
    ALTER TABLE ia_execucoes_ferramentas ADD COLUMN passo_ordem INTEGER DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ia_execucoes_ferramentas' AND column_name = 'avaliacao') THEN
    ALTER TABLE ia_execucoes_ferramentas ADD COLUMN avaliacao JSONB DEFAULT '{}';
  END IF;
END $$;

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_ia_agentes_execucao_robo ON ia_agentes_execucao (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_agentes_execucao_estado ON ia_agentes_execucao (estado);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_ferramentas_agente ON ia_execucoes_ferramentas (agente_execucao_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_ferramentas_passo ON ia_execucoes_ferramentas (agente_execucao_id, passo_ordem);

-- ==================== RLS ====================
ALTER TABLE ia_agentes_execucao ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ia_agentes_execucao_select' AND tablename = 'ia_agentes_execucao') THEN
    CREATE POLICY "ia_agentes_execucao_select" ON ia_agentes_execucao FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ia_agentes_execucao_insert' AND tablename = 'ia_agentes_execucao') THEN
    CREATE POLICY "ia_agentes_execucao_insert" ON ia_agentes_execucao FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ia_agentes_execucao_update' AND tablename = 'ia_agentes_execucao') THEN
    CREATE POLICY "ia_agentes_execucao_update" ON ia_agentes_execucao FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ia_agentes_execucao_delete' AND tablename = 'ia_agentes_execucao') THEN
    CREATE POLICY "ia_agentes_execucao_delete" ON ia_agentes_execucao FOR DELETE USING (true);
  END IF;
END $$;

-- ==================== TRIGGER UPDATED_AT ====================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_agentes_execucao_updated_at') THEN
    CREATE TRIGGER trg_ia_agentes_execucao_updated_at BEFORE UPDATE ON ia_agentes_execucao FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
  END IF;
END $$;

-- ==================== SEED: parametros nas ferramentas existentes ====================
UPDATE ia_ferramentas SET parametros = '{
  "destinatario": {"tipo": "email", "obrigatorio": true, "descricao": "Email do destinatario"},
  "assunto": {"tipo": "texto", "obrigatorio": true, "descricao": "Assunto do email"},
  "corpo": {"tipo": "texto", "obrigatorio": true, "descricao": "Corpo do email"}
}' WHERE codigo_unico = 'COM_ENVIAR_EMAIL';

UPDATE ia_ferramentas SET parametros = '{
  "telefone": {"tipo": "telefone", "obrigatorio": true, "descricao": "Numero com DDD"},
  "mensagem": {"tipo": "texto", "obrigatorio": true, "descricao": "Texto da mensagem"}
}' WHERE codigo_unico = 'COM_ENVIAR_WHATSAPP';

UPDATE ia_ferramentas SET parametros = '{
  "cliente_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID do cliente"},
  "tipo_contrato": {"tipo": "texto", "obrigatorio": false, "descricao": "Tipo de contrato"}
}' WHERE codigo_unico = 'COM_GERAR_CONTRATO';

UPDATE ia_ferramentas SET parametros = '{
  "cliente_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID do cliente"},
  "valor": {"tipo": "numero", "obrigatorio": true, "descricao": "Valor da proposta"}
}' WHERE codigo_unico = 'COM_GERAR_PROPOSTA';

UPDATE ia_ferramentas SET parametros = '{
  "documento": {"tipo": "texto", "obrigatorio": true, "descricao": "CNPJ ou CPF"}
}' WHERE codigo_unico IN ('COM_CONSULTAR_CNPJ', 'COM_CONSULTAR_CPF');

UPDATE ia_ferramentas SET parametros = '{
  "os_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID da ordem de servico"}
}' WHERE codigo_unico IN ('COM_EMITIR_NFSE', 'COM_EMITIR_CTE');

UPDATE ia_ferramentas SET parametros = '{
  "cliente_id": {"tipo": "uuid", "obrigatorio": true, "descricao": "ID do cliente"},
  "valor": {"tipo": "numero", "obrigatorio": true, "descricao": "Valor a cobrar"}
}' WHERE codigo_unico = 'COM_REALIZAR_COBRANCA';

UPDATE ia_ferramentas SET timeout_segundos = 30 WHERE codigo_unico IN ('COM_CONSULTAR_CNPJ', 'COM_CONSULTAR_CPF', 'COM_CONSULTAR_SALDO', 'COM_CONSULTAR_FRETE');
UPDATE ia_ferramentas SET timeout_segundos = 120 WHERE codigo_unico IN ('COM_EMITIR_NFSE', 'COM_EMITIR_CTE', 'COM_GERAR_CONTRATO');
