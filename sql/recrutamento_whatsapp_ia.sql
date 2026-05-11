-- ================================================================
-- MÓDULO: RECRUTAMENTO > WHATSAPP IA PRESTADORES
-- Criado em: 2026-04-29
-- Projeto: Express Connect Hub (TMS)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. TABELA: Conversas (uma por prestador/telefone)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recrutamento_whatsapp_conversas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone        text NOT NULL,
  nome            text,
  prestador_id    uuid NULL,                    -- vínculo com prestadores (se já cadastrado)
  status          text NOT NULL DEFAULT 'novo'  -- novo | em_analise | aprovado | reprovado | bloqueado
                    CHECK (status IN ('novo', 'em_analise', 'aprovado', 'reprovado', 'bloqueado')),
  ia_ativa        boolean NOT NULL DEFAULT true,
  humano_assumiu  boolean NOT NULL DEFAULT false,
  ultima_mensagem text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca rápida por telefone
CREATE INDEX IF NOT EXISTS idx_recrutamento_conversas_telefone
  ON recrutamento_whatsapp_conversas (telefone);

-- Índice por status (para filtros)
CREATE INDEX IF NOT EXISTS idx_recrutamento_conversas_status
  ON recrutamento_whatsapp_conversas (status);

-- ----------------------------------------------------------------
-- 2. TABELA: Mensagens (histórico completo)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recrutamento_whatsapp_mensagens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id  uuid NOT NULL REFERENCES recrutamento_whatsapp_conversas(id) ON DELETE CASCADE,
  origem       text NOT NULL                     -- prestador | ia | humano | sistema
                 CHECK (origem IN ('prestador', 'ia', 'humano', 'sistema')),
  mensagem     text NOT NULL,
  payload      jsonb,                            -- dados extras: bloqueios, fallback_usado, prompt, etc.
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Índice por conversa (para carregar histórico)
CREATE INDEX IF NOT EXISTS idx_recrutamento_mensagens_conversa
  ON recrutamento_whatsapp_mensagens (conversa_id, created_at);

-- ----------------------------------------------------------------
-- 3. TABELA: Configuração da IA (singleton — 1 registro)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recrutamento_ia_config (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_empresa     text,        -- manual/contexto da empresa para a IA
  regras_permitidas  text,        -- o que a IA pode responder
  regras_bloqueadas  text,        -- o que a IA NUNCA deve dizer
  ia_ativa           boolean NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Garante que exista apenas 1 configuração ativa
-- (sem trigger, usamos upsert via aplicação)

-- ----------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY (RLS) — permissivo por enquanto
-- ----------------------------------------------------------------
ALTER TABLE recrutamento_whatsapp_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE recrutamento_whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE recrutamento_ia_config          ENABLE ROW LEVEL SECURITY;

-- Políticas abertas para autenticados (ajustar conforme roles futuros)
CREATE POLICY IF NOT EXISTS "allow_authenticated_conversas"
  ON recrutamento_whatsapp_conversas FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "allow_authenticated_mensagens"
  ON recrutamento_whatsapp_mensagens FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "allow_authenticated_ia_config"
  ON recrutamento_ia_config FOR ALL
  USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 5. SEED — Config inicial da IA (se não existir)
-- ----------------------------------------------------------------
INSERT INTO recrutamento_ia_config (manual_empresa, regras_permitidas, regras_bloqueadas, ia_ativa)
SELECT
  'Somos a Conexão Express, empresa especializada em logística de última milha e transporte. '
  'Atendemos prestadores (motoristas/parceiros) que desejam trabalhar conosco. '
  'Nossa equipe está disponível de segunda a sexta, das 8h às 18h. '
  'Para se cadastrar, o prestador precisa de: CNH válida, veículo próprio, celular com WhatsApp e CNPJ ou CPF.',

  'Explicar o processo de cadastro e documentação necessária. '
  'Informar sobre tipos de veículos aceitos (VUC, 3/4, Toco, Truck, Carreta). '
  'Explicar como funciona o pagamento (semanal/quinzenal após aprovação). '
  'Informar sobre bônus por produtividade de forma genérica. '
  'Orientar sobre o aplicativo do prestador.',

  'Nunca revelar dados de clientes (nomes, endereços, contatos). '
  'Nunca informar rotas específicas de operações. '
  'Nunca revelar valores exatos de frete ou tabela interna. '
  'Nunca compartilhar dados de outros prestadores. '
  'Nunca revelar informações estratégicas da operação.',

  true
WHERE NOT EXISTS (SELECT 1 FROM recrutamento_ia_config);

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================

-- ================================================================
-- EXTENS�O: Tabela de Configura��o de Conex�o WhatsApp
-- Adicionada em: 2026-04-29
-- ================================================================
CREATE TABLE IF NOT EXISTS recrutamento_whatsapp_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_api_url   text,
  instance_name       text,
  n8n_webhook_url     text,
  numero_operacional  text,
  status              text NOT NULL DEFAULT 'desconectado'
                        CHECK (status IN ('desconectado', 'aguardando_qr', 'conectado')),
  qr_code             text,
  ia_ativa            boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recrutamento_whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "allow_authenticated_wpp_config"
  ON recrutamento_whatsapp_config FOR ALL
  USING (true) WITH CHECK (true);
