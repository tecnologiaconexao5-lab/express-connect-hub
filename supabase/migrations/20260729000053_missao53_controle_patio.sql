-- ============================================================
-- EXPRESS CONNECT HUB / TMS — MISSAO 53
-- Controle de Patio, Chegada, Fila e Carregamento Enterprise
-- Data: 2026-07-29
-- ============================================================
-- Cria tabelas para controle completo de patio:
--   patio_unidades, patio_docas, patio_checkins,
--   patio_fila, patio_eventos, patio_regras_fila,
--   patio_rodizio, patio_alertas
-- Todas com tenant_id, RLS, indices e triggers.
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patio_status') THEN
    CREATE TYPE patio_status AS ENUM (
      'previsto','chegou_ao_patio','aguardando_checkin','checkin_realizado',
      'aguardando_liberacao','aguardando_fila','chamado_para_doca',
      'em_doca','carregamento_iniciado','carregamento_pausado',
      'carregamento_concluido','aguardando_documentacao','liberado_para_saida',
      'saiu_do_patio','cancelado','no_show'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patio_doca_status') THEN
    CREATE TYPE patio_doca_status AS ENUM (
      'disponivel','ocupada','bloqueada','manutencao','reservada'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patio_criterio_fila') THEN
    CREATE TYPE patio_criterio_fila AS ENUM (
      'ordem_chegada','horario_agendado','prioridade','sla',
      'regiao','tipo_veiculo','tipo_carga','cliente_vip',
      'rodizio_prestador','rodizio_regiao','doca_disponivel','urgencia'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patio_tipo_rodizio') THEN
    CREATE TYPE patio_tipo_rodizio AS ENUM (
      'prestador','regiao','tipo_veiculo','cliente','contrato','manual'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patio_alerta_tipo') THEN
    CREATE TYPE patio_alerta_tipo AS ENUM (
      'sla_excedido','doca_ocupada','carregamento_parado',
      'documentacao_pendente','no_show','operacao_critica','fila_longa'
    );
  END IF;
END $$;

-- ============================================================
-- FUNCAO AUXILIAR (se nao existir)
-- ============================================================
CREATE OR REPLACE FUNCTION update_patio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. patio_unidades
-- ============================================================
CREATE TABLE IF NOT EXISTS patio_unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT,
  capacidade_total INTEGER DEFAULT 0,
  capacidade_atual INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','manutencao')),
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_patio_unidades_tenant ON patio_unidades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_unidades_status ON patio_unidades(status);

DROP TRIGGER IF EXISTS trg_patio_unidades_updated_at ON patio_unidades;
CREATE TRIGGER trg_patio_unidades_updated_at
  BEFORE UPDATE ON patio_unidades FOR EACH ROW
  EXECUTE FUNCTION update_patio_updated_at();

ALTER TABLE patio_unidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patio_unidades_select ON patio_unidades;
CREATE POLICY patio_unidades_select ON patio_unidades FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS patio_unidades_all ON patio_unidades;
CREATE POLICY patio_unidades_all ON patio_unidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. patio_docas
-- ============================================================
CREATE TABLE IF NOT EXISTS patio_docas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES patio_unidades(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  status patio_doca_status DEFAULT 'disponivel',
  tipo_permitido TEXT[] DEFAULT '{}',
  capacidade_kg NUMERIC(12,2),
  restricoes TEXT[] DEFAULT '{}',
  veiculo_atual_id UUID,
  previsao_liberacao TIMESTAMPTZ,
  observacoes TEXT,
  posicao INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patio_docas_tenant ON patio_docas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_docas_unidade ON patio_docas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_patio_docas_status ON patio_docas(status);

DROP TRIGGER IF EXISTS trg_patio_docas_updated_at ON patio_docas;
CREATE TRIGGER trg_patio_docas_updated_at
  BEFORE UPDATE ON patio_docas FOR EACH ROW
  EXECUTE FUNCTION update_patio_updated_at();

ALTER TABLE patio_docas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patio_docas_select ON patio_docas;
CREATE POLICY patio_docas_select ON patio_docas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS patio_docas_all ON patio_docas;
CREATE POLICY patio_docas_all ON patio_docas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. patio_checkins
-- ============================================================
CREATE TABLE IF NOT EXISTS patio_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES patio_unidades(id) ON DELETE SET NULL,
  ordem_servico_id UUID,
  numero_os TEXT,
  cliente_id UUID,
  cliente_nome TEXT,
  prestador_id UUID,
  prestador_nome TEXT,
  motorista_nome TEXT,
  veiculo_id UUID,
  veiculo_placa TEXT NOT NULL,
  veiculo_tipo TEXT,
  tipo_carga TEXT,
  origem TEXT,
  destino TEXT,
  horario_previsto TIMESTAMPTZ,
  horario_chegada TIMESTAMPTZ,
  horario_saida TIMESTAMPTZ,
  documento TEXT,
  observacao TEXT,
  status patio_status DEFAULT 'previsto',
  posicao_fila INTEGER DEFAULT 0,
  prioridade INTEGER DEFAULT 0,
  doca_id UUID REFERENCES patio_docas(id) ON DELETE SET NULL,
  doca_nome TEXT,
  chamado_para_doca_em TIMESTAMPTZ,
  carregamento_inicio TIMESTAMPTZ,
  carregamento_fim TIMESTAMPTZ,
  carregamento_pausa_motivo TEXT,
  carregamento_pausa_inicio TIMESTAMPTZ,
  tempo_aguardando_min INTEGER DEFAULT 0,
  tempo_carregando_min INTEGER DEFAULT 0,
  tempo_total_min INTEGER DEFAULT 0,
  sla_espera_min INTEGER DEFAULT 120,
  risco_atraso BOOLEAN DEFAULT false,
  liberado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checkin_origem TEXT DEFAULT 'operacao',
  fotos JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_patio_checkins_tenant ON patio_checkins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_placa ON patio_checkins(veiculo_placa);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_status ON patio_checkins(status);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_doca ON patio_checkins(doca_id);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_os ON patio_checkins(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_cliente ON patio_checkins(cliente_id);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_posicao ON patio_checkins(posicao_fila) WHERE posicao_fila > 0;

DROP TRIGGER IF EXISTS trg_patio_checkins_updated_at ON patio_checkins;
CREATE TRIGGER trg_patio_checkins_updated_at
  BEFORE UPDATE ON patio_checkins FOR EACH ROW
  EXECUTE FUNCTION update_patio_updated_at();

ALTER TABLE patio_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patio_checkins_select ON patio_checkins;
CREATE POLICY patio_checkins_select ON patio_checkins FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS patio_checkins_all ON patio_checkins;
CREATE POLICY patio_checkins_all ON patio_checkins FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4. patio_fila
-- ============================================================
CREATE TABLE IF NOT EXISTS patio_fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  checkin_id UUID NOT NULL REFERENCES patio_checkins(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES patio_unidades(id) ON DELETE SET NULL,
  posicao INTEGER NOT NULL DEFAULT 1,
  posicao_anterior INTEGER,
  criterio_ordenacao patio_criterio_fila DEFAULT 'ordem_chegada',
  criterio_detalhe TEXT,
  doca_sugerida_id UUID REFERENCES patio_docas(id) ON DELETE SET NULL,
  sla_espera_min INTEGER DEFAULT 120,
  risco_atraso BOOLEAN DEFAULT false,
  entrou_na_fila_em TIMESTAMPTZ DEFAULT now(),
  chamado_em TIMESTAMPTZ,
  chamado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'aguardando' CHECK (status IN ('aguardando','chamado','em_atendimento','concluido','cancelado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patio_fila_tenant ON patio_fila(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_fila_checkin ON patio_fila(checkin_id);
CREATE INDEX IF NOT EXISTS idx_patio_fila_posicao ON patio_fila(unidade_id, posicao);
CREATE INDEX IF NOT EXISTS idx_patio_fila_status ON patio_fila(status);

DROP TRIGGER IF EXISTS trg_patio_fila_updated_at ON patio_fila;
CREATE TRIGGER trg_patio_fila_updated_at
  BEFORE UPDATE ON patio_fila FOR EACH ROW
  EXECUTE FUNCTION update_patio_updated_at();

ALTER TABLE patio_fila ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patio_fila_select ON patio_fila;
CREATE POLICY patio_fila_select ON patio_fila FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS patio_fila_all ON patio_fila;
CREATE POLICY patio_fila_all ON patio_fila FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 5. patio_eventos
-- ============================================================
CREATE TABLE IF NOT EXISTS patio_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  checkin_id UUID NOT NULL REFERENCES patio_checkins(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  status_anterior patio_status,
  status_novo patio_status NOT NULL,
  descricao TEXT,
  responsavel_nome TEXT,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  origem TEXT DEFAULT 'operacao',
  localizacao TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patio_eventos_checkin ON patio_eventos(checkin_id);
CREATE INDEX IF NOT EXISTS idx_patio_eventos_tenant ON patio_eventos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_eventos_created ON patio_eventos(created_at DESC);

ALTER TABLE patio_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patio_eventos_select ON patio_eventos;
CREATE POLICY patio_eventos_select ON patio_eventos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS patio_eventos_all ON patio_eventos;
CREATE POLICY patio_eventos_all ON patio_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 6. patio_regras_fila
-- ============================================================
CREATE TABLE IF NOT EXISTS patio_regras_fila (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES patio_unidades(id) ON DELETE CASCADE,
  criterio patio_criterio_fila NOT NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 1,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patio_regras_tenant ON patio_regras_fila(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_regras_unidade ON patio_regras_fila(unidade_id);

DROP TRIGGER IF EXISTS trg_patio_regras_updated_at ON patio_regras_fila;
CREATE TRIGGER trg_patio_regras_updated_at
  BEFORE UPDATE ON patio_regras_fila FOR EACH ROW
  EXECUTE FUNCTION update_patio_updated_at();

ALTER TABLE patio_regras_fila ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patio_regras_select ON patio_regras_fila;
CREATE POLICY patio_regras_select ON patio_regras_fila FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS patio_regras_all ON patio_regras_fila;
CREATE POLICY patio_regras_all ON patio_regras_fila FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 7. patio_rodizio
-- ============================================================
CREATE TABLE IF NOT EXISTS patio_rodizio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES patio_unidades(id) ON DELETE CASCADE,
  tipo patio_tipo_rodizio NOT NULL,
  entidade_id UUID,
  entidade_nome TEXT NOT NULL,
  ultimo_chamado_em TIMESTAMPTZ,
  proximo_na_fila INTEGER DEFAULT 1,
  justificativa TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patio_rodizio_tenant ON patio_rodizio(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_rodizio_tipo ON patio_rodizio(tipo);

DROP TRIGGER IF EXISTS trg_patio_rodizio_updated_at ON patio_rodizio;
CREATE TRIGGER trg_patio_rodizio_updated_at
  BEFORE UPDATE ON patio_rodizio FOR EACH ROW
  EXECUTE FUNCTION update_patio_updated_at();

ALTER TABLE patio_rodizio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patio_rodizio_select ON patio_rodizio;
CREATE POLICY patio_rodizio_select ON patio_rodizio FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS patio_rodizio_all ON patio_rodizio;
CREATE POLICY patio_rodizio_all ON patio_rodizio FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 8. patio_alertas
-- ============================================================
CREATE TABLE IF NOT EXISTS patio_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  checkin_id UUID REFERENCES patio_checkins(id) ON DELETE CASCADE,
  tipo patio_alerta_tipo NOT NULL,
  mensagem TEXT NOT NULL,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patio_alertas_tenant ON patio_alertas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_alertas_resolvido ON patio_alertas(resolvido) WHERE resolvido = false;

ALTER TABLE patio_alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patio_alertas_select ON patio_alertas;
CREATE POLICY patio_alertas_select ON patio_alertas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS patio_alertas_all ON patio_alertas;
CREATE POLICY patio_alertas_all ON patio_alertas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: Unidade padrao + 4 docas
-- ============================================================
INSERT INTO patio_unidades (id, tenant_id, nome, capacidade_total, status)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'CD Conexao Express',
  20,
  'ativo'
WHERE NOT EXISTS (SELECT 1 FROM patio_unidades LIMIT 1);

-- Seed de docas para a unidade recem-criada
DO $$
DECLARE
  v_unidade_id UUID;
BEGIN
  SELECT id INTO v_unidade_id FROM patio_unidades LIMIT 1;
  IF v_unidade_id IS NOT NULL THEN
    INSERT INTO patio_docas (tenant_id, unidade_id, nome, status, posicao, tipo_permitido)
    SELECT
      '00000000-0000-0000-0000-000000000001'::uuid,
      v_unidade_id,
      d.nome,
      'disponivel'::patio_doca_status,
      d.posicao,
      d.tipos
    FROM (
      VALUES ('Doca 01', 1, ARRAY['truck','carreta']),
             ('Doca 02', 2, ARRAY['truck','carreta','van']),
             ('Doca 03', 3, ARRAY['carreta','bitrem']),
             ('Doca 04', 4, ARRAY['truck','van','toco'])
    ) AS d(nome, posicao, tipos)
    WHERE NOT EXISTS (SELECT 1 FROM patio_docas pd WHERE pd.unidade_id = v_unidade_id);
  END IF;
END $$;

-- ============================================================
-- SEED: Regras de fila padrao (ordem de chegada)
-- ============================================================
INSERT INTO patio_regras_fila (tenant_id, unidade_id, criterio, ativo, ordem)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  u.id,
  'ordem_chegada',
  true,
  1
FROM patio_unidades u
WHERE NOT EXISTS (SELECT 1 FROM patio_regras_fila r WHERE r.unidade_id = u.id AND r.criterio = 'ordem_chegada');

-- ============================================================
-- COMENTARIOS
-- ============================================================
COMMENT ON TABLE patio_unidades IS 'Unidades/CDs onde ocorre controle de patio.';
COMMENT ON TABLE patio_docas IS 'Docas fisicas disponiveis para carregamento/descarga.';
COMMENT ON TABLE patio_checkins IS 'Check-in de veiculos no patio. Cada entrada = um veiculo.';
COMMENT ON TABLE patio_fila IS 'Fila de carregamento com posicao, criterio e doca sugerida.';
COMMENT ON TABLE patio_eventos IS 'Eventos da timeline do patio (check-in, chamada, carregamento, saida).';
COMMENT ON TABLE patio_regras_fila IS 'Regras configuradas de ordenacao da fila por unidade.';
COMMENT ON TABLE patio_rodizio IS 'Registro de rodizio entre prestadores/regioes/tipos.';
COMMENT ON TABLE patio_alertas IS 'Alertas automaticos do patio (SLA, doca ocupada, no-show, etc.).';
