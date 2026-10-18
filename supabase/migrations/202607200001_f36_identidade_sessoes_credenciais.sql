-- ============================================================
-- F36 — IDENTIDADE DIGITAL, SESSÕES OPERACIONAIS E CREDENCIAIS
-- ============================================================

-- Skip seeds that failed before — will be inserted via application

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='status_identidade') THEN
    CREATE TYPE status_identidade AS ENUM ('ativa','inativa','pausada','bloqueada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='perfil_identidade') THEN
    CREATE TYPE perfil_identidade AS ENUM ('comercial','financeiro','operacional','fiscal','recrutamento','monitoramento','cliente','prestador','rh','suporte');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tipo_credencial') THEN
    CREATE TYPE tipo_credencial AS ENUM ('whatsapp','zoho','smtp','crm','api','site_vagas','outro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='status_sessao_operacional') THEN
    CREATE TYPE status_sessao_operacional AS ENUM ('ativa','concluida','falhou','cancelada');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS ia_identidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE UNIQUE,
  nome_operacional VARCHAR NOT NULL,
  email_operacional VARCHAR,
  status status_identidade NOT NULL DEFAULT 'ativa',
  perfil perfil_identidade NOT NULL,
  timezone VARCHAR DEFAULT 'America/Sao_Paulo',
  idioma VARCHAR DEFAULT 'pt-BR',
  configuracao_operacional JSONB DEFAULT '{}',
  configuracao_cognitiva JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_identidades_robo ON ia_identidades(robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_identidades_perfil ON ia_identidades(perfil);
CREATE INDEX IF NOT EXISTS idx_ia_identidades_status ON ia_identidades(status);

CREATE TABLE IF NOT EXISTS ia_credenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  tipo tipo_credencial NOT NULL,
  nome_credencial VARCHAR NOT NULL,
  provedor VARCHAR,
  referencia_env VARCHAR NOT NULL,
  escopos TEXT[] DEFAULT '{}',
  ativo BOOLEAN DEFAULT true,
  ultimo_uso TIMESTAMPTZ,
  ultima_rotacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_credenciais_robo ON ia_credenciais(robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_credenciais_tipo ON ia_credenciais(tipo);
CREATE INDEX IF NOT EXISTS idx_ia_credenciais_provedor ON ia_credenciais(provedor);

CREATE TABLE IF NOT EXISTS ia_sessoes_operacionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  robo_id UUID NOT NULL REFERENCES automacoes_robos(id) ON DELETE CASCADE,
  identidade_id UUID REFERENCES ia_identidades(id) ON DELETE SET NULL,
  motivo VARCHAR NOT NULL,
  status status_sessao_operacional NOT NULL DEFAULT 'ativa',
  contexto_inicial JSONB DEFAULT '{}',
  resultado JSONB DEFAULT '{}',
  inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fim TIMESTAMPTZ,
  duracao_segundos INTEGER,
  total_acoes INTEGER DEFAULT 0,
  criado_por VARCHAR,
  encerrado_por VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_sessoes_robo ON ia_sessoes_operacionais(robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_sessoes_status ON ia_sessoes_operacionais(status);
CREATE INDEX IF NOT EXISTS idx_ia_sessoes_inicio ON ia_sessoes_operacionais(inicio DESC);

ALTER TABLE ia_identidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_credenciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_sessoes_operacionais ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar identidades' AND tablename='ia_identidades') THEN
    CREATE POLICY "Gerenciar identidades" ON ia_identidades FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar credenciais' AND tablename='ia_credenciais') THEN
    CREATE POLICY "Gerenciar credenciais" ON ia_credenciais FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Gerenciar sessoes' AND tablename='ia_sessoes_operacionais') THEN
    CREATE POLICY "Gerenciar sessoes" ON ia_sessoes_operacionais FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION f36_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ia_identidades_updated_at ON ia_identidades;
CREATE TRIGGER trg_ia_identidades_updated_at BEFORE UPDATE ON ia_identidades FOR EACH ROW EXECUTE FUNCTION f36_updated_at();
DROP TRIGGER IF EXISTS trg_ia_credenciais_updated_at ON ia_credenciais;
CREATE TRIGGER trg_ia_credenciais_updated_at BEFORE UPDATE ON ia_credenciais FOR EACH ROW EXECUTE FUNCTION f36_updated_at();
DROP TRIGGER IF EXISTS trg_ia_sessoes_updated_at ON ia_sessoes_operacionais;
CREATE TRIGGER trg_ia_sessoes_updated_at BEFORE UPDATE ON ia_sessoes_operacionais FOR EACH ROW EXECUTE FUNCTION f36_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_identidades TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_credenciais TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_sessoes_operacionais TO anon, authenticated;
