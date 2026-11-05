-- =============================================================================
-- ADM-APP-02B.2 — BACKEND SEGURO DE OFERTAS PÚBLICAS
-- Tabela recrutamento_ofertas + identificadores + eventos + rate limit
-- RPC f_registrar_oferta_publica (SECURITY DEFINER, service_role only)
-- RLS de consulta/atualização interna por tenant.
--
-- IMPORTANTE: este arquivo NÃO foi aplicado em nenhum banco.
-- Aplicar somente com autorização separada e em ambiente controlado.
-- =============================================================================

BEGIN;

-- 1) TABELA PRINCIPAL ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recrutamento_ofertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  tipo_oferta TEXT NOT NULL
    CHECK (tipo_oferta IN ('motoboy', 'motorista_veiculo_proprio', 'disponibilidade_veiculo')),
  status TEXT NOT NULL DEFAULT 'nova'
    CHECK (status IN ('nova', 'em_analise', 'em_contato', 'convertida', 'descartada', 'arquivada', 'duplicada')),
  revisao_humana BOOLEAN NOT NULL DEFAULT FALSE,

  nome TEXT NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 3 AND 160),
  cpf_cnpj TEXT,
  cpf_cnpj_norm TEXT,
  telefone TEXT,
  telefone_norm TEXT,
  email TEXT,
  email_norm TEXT,
  cidade TEXT CHECK (cidade IS NULL OR char_length(btrim(cidade)) BETWEEN 2 AND 120),
  uf TEXT CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),

  regioes JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(regioes) = 'array'),
  dias_disponiveis JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(dias_disponiveis) = 'array'),
  horario_inicio TIME,
  horario_fim TIME,
  modalidades TEXT[] NOT NULL DEFAULT '{}',
  tipo_moto TEXT,
  possui_bau BOOLEAN,
  capacidade_bau_litros NUMERIC CHECK (capacidade_bau_litros IS NULL OR capacidade_bau_litros >= 0),

  veiculo_categoria TEXT
    CHECK (veiculo_categoria IS NULL OR veiculo_categoria IN ('proprio', 'agregado', 'terceiro')),
  veiculo_tipo TEXT,
  carroceria TEXT,
  veiculo_modelo TEXT CHECK (veiculo_modelo IS NULL OR char_length(btrim(veiculo_modelo)) <= 80),
  veiculo_placa TEXT,
  veiculo_ano INTEGER CHECK (veiculo_ano IS NULL OR veiculo_ano BETWEEN 1980 AND 2100),
  caracteristicas JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(caracteristicas) = 'array'),

  capacidade_kg NUMERIC CHECK (capacidade_kg IS NULL OR capacidade_kg >= 0),
  capacidade_m3 NUMERIC CHECK (capacidade_m3 IS NULL OR capacidade_m3 >= 0),
  dimensoes JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(dimensoes) = 'object'),

  valor_diaria NUMERIC CHECK (valor_diaria IS NULL OR valor_diaria >= 0),
  valor_km NUMERIC CHECK (valor_km IS NULL OR valor_km >= 0),
  valor_saida NUMERIC CHECK (valor_saida IS NULL OR valor_saida >= 0),
  valor_mensal NUMERIC CHECK (valor_mensal IS NULL OR valor_mensal >= 0),
  valor_negociavel BOOLEAN NOT NULL DEFAULT FALSE,
  condicoes_comerciais TEXT CHECK (condicoes_comerciais IS NULL OR char_length(condicoes_comerciais) <= 2000),
  restricoes TEXT CHECK (restricoes IS NULL OR char_length(restricoes) <= 2000),
  observacoes TEXT CHECK (observacoes IS NULL OR char_length(observacoes) <= 2000),

  origem TEXT NOT NULL DEFAULT 'link_publico',
  idempotency_key TEXT,
  dedup_hash TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,

  lgpd_consent BOOLEAN NOT NULL DEFAULT FALSE CHECK (lgpd_consent = TRUE),
  lgpd_consent_em TIMESTAMPTZ CHECK (lgpd_consent_em IS NOT NULL),
  lgpd_termo_versao TEXT NOT NULL,
  lgpd_finalidade TEXT NOT NULL DEFAULT 'analise_e_contato_sobre_oferta',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ofertas_contato_obrigatorio CHECK (
    coalesce(btrim(telefone_norm), '') <> '' OR coalesce(btrim(email_norm), '') <> ''
  ),
  CONSTRAINT ofertas_lgpd_obrigatorio CHECK (lgpd_consent = TRUE),
  CONSTRAINT ofertas_modalidades_validas CHECK (
    modalidades <@ ARRAY['esporadica', 'urgente', 'fixa', 'recorrente']::TEXT[]
  ),
  CONSTRAINT ofertas_veiculo_coerente CHECK (
    (tipo_oferta = 'motoboy' AND veiculo_tipo = 'moto')
    OR (
      tipo_oferta IN ('motorista_veiculo_proprio', 'disponibilidade_veiculo')
      AND veiculo_tipo IS NOT NULL
      AND carroceria IS NOT NULL
    )
  )
);

-- 2) ÍNDICES DE IDENTIDADE, DEDUP E CONSULTA ---------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_ofertas_idempotency
  ON public.recrutamento_ofertas (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ofertas_dedup_ativa
  ON public.recrutamento_ofertas (tenant_id, dedup_hash)
  WHERE status IN ('nova', 'em_analise', 'em_contato');

CREATE INDEX IF NOT EXISTS idx_ofertas_tenant_status
  ON public.recrutamento_ofertas (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ofertas_uf_cidade
  ON public.recrutamento_ofertas (tenant_id, uf, cidade);
CREATE INDEX IF NOT EXISTS idx_ofertas_tipo_veiculo
  ON public.recrutamento_ofertas (tenant_id, tipo_oferta, veiculo_tipo);
CREATE INDEX IF NOT EXISTS idx_ofertas_regioes
  ON public.recrutamento_ofertas USING GIN (regioes);
CREATE INDEX IF NOT EXISTS idx_ofertas_dias
  ON public.recrutamento_ofertas USING GIN (dias_disponiveis);
CREATE INDEX IF NOT EXISTS idx_ofertas_modalidades
  ON public.recrutamento_ofertas USING GIN (modalidades);
CREATE INDEX IF NOT EXISTS idx_ofertas_caracteristicas
  ON public.recrutamento_ofertas USING GIN (caracteristicas);
CREATE INDEX IF NOT EXISTS idx_ofertas_valores
  ON public.recrutamento_ofertas (tenant_id, valor_diaria, valor_km, valor_mensal);
CREATE INDEX IF NOT EXISTS idx_ofertas_telefone
  ON public.recrutamento_ofertas (tenant_id, telefone_norm);
CREATE INDEX IF NOT EXISTS idx_ofertas_email
  ON public.recrutamento_ofertas (tenant_id, email_norm);
CREATE INDEX IF NOT EXISTS idx_ofertas_cpf
  ON public.recrutamento_ofertas (tenant_id, cpf_cnpj_norm);
CREATE INDEX IF NOT EXISTS idx_ofertas_created
  ON public.recrutamento_ofertas (created_at DESC);

-- 3) IDENTIFICADORES (permite múltiplas ofertas legítimas do mesmo contato) ---
CREATE TABLE IF NOT EXISTS public.recrutamento_oferta_identificadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES public.recrutamento_ofertas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('telefone', 'email', 'cpf', 'cnpj')),
  valor_norm TEXT NOT NULL CHECK (char_length(btrim(valor_norm)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oferta_id, tipo, valor_norm)
);

CREATE INDEX IF NOT EXISTS idx_oferta_identificadores_busca
  ON public.recrutamento_oferta_identificadores (tenant_id, tipo, valor_norm);
CREATE INDEX IF NOT EXISTS idx_oferta_identificadores_oferta
  ON public.recrutamento_oferta_identificadores (oferta_id);

-- 4) EVENTOS (auditoria imutável para usuários internos) ---------------------
CREATE TABLE IF NOT EXISTS public.recrutamento_oferta_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES public.recrutamento_ofertas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL,
  descricao TEXT,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  ator TEXT NOT NULL DEFAULT 'sistema',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oferta_eventos_oferta
  ON public.recrutamento_oferta_eventos (oferta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oferta_eventos_tenant
  ON public.recrutamento_oferta_eventos (tenant_id, created_at DESC);

-- 5) RATE LIMIT (persistente, compartilhado entre isolates da Edge) ----------
CREATE TABLE IF NOT EXISTS public.recrutamento_oferta_rate_limit (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  janela TIMESTAMPTZ NOT NULL,
  contador INTEGER NOT NULL DEFAULT 0 CHECK (contador >= 0),
  PRIMARY KEY (tenant_id, ip_hash, janela)
);

CREATE INDEX IF NOT EXISTS idx_oferta_rate_limit_janela
  ON public.recrutamento_oferta_rate_limit (janela);

-- 6) VÍNCULO OPCIONAL OFERTA → CANDIDATO (não converte automaticamente) -----
ALTER TABLE public.recrutamento_candidatos
  ADD COLUMN IF NOT EXISTS oferta_id UUID
  REFERENCES public.recrutamento_ofertas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_oferta
  ON public.recrutamento_candidatos (oferta_id);

-- 7) TRIGGER DE updated_at + PROTEÇÃO DE CAMPOS INTERNOS --------------------
CREATE OR REPLACE FUNCTION public.f_recrutamento_ofertas_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.protocolo IS DISTINCT FROM OLD.protocolo
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.dedup_hash IS DISTINCT FROM OLD.dedup_hash
     OR NEW.ip_hash IS DISTINCT FROM OLD.ip_hash
     OR NEW.user_agent_hash IS DISTINCT FROM OLD.user_agent_hash
     OR NEW.origem IS DISTINCT FROM OLD.origem
     OR NEW.lgpd_consent IS DISTINCT FROM OLD.lgpd_consent
     OR NEW.lgpd_consent_em IS DISTINCT FROM OLD.lgpd_consent_em
     OR NEW.lgpd_termo_versao IS DISTINCT FROM OLD.lgpd_termo_versao
     OR NEW.lgpd_finalidade IS DISTINCT FROM OLD.lgpd_finalidade
  THEN
    RAISE EXCEPTION 'campos_internos_imutaveis' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'nova' AND NEW.status IN ('em_analise', 'em_contato', 'descartada', 'arquivada'))
      OR (OLD.status = 'em_analise' AND NEW.status IN ('em_contato', 'convertida', 'descartada', 'arquivada'))
      OR (OLD.status = 'em_contato' AND NEW.status IN ('convertida', 'descartada', 'arquivada'))
      OR (OLD.status = 'convertida' AND NEW.status IN ('arquivada'))
      OR (OLD.status = 'duplicada' AND NEW.status IN ('arquivada'))
    ) THEN
      RAISE EXCEPTION 'transicao_status_invalida' USING ERRCODE = '22023';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recrutamento_ofertas_before_update ON public.recrutamento_ofertas;
CREATE TRIGGER trg_recrutamento_ofertas_before_update
  BEFORE UPDATE ON public.recrutamento_ofertas
  FOR EACH ROW
  EXECUTE FUNCTION public.f_recrutamento_ofertas_before_update();

-- 8) RPC TRANSACIONAL --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f_registrar_oferta_publica(
  p_tenant_id UUID,
  p_payload JSONB,
  p_request_id TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL,
  p_user_agent_hash TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campos_inesperados TEXT[];
  v_tipo TEXT;
  v_nome TEXT;
  v_cpf_norm TEXT;
  v_telefone TEXT;
  v_telefone_norm TEXT;
  v_email TEXT;
  v_cidade TEXT;
  v_uf TEXT;
  v_regioes JSONB;
  v_dias JSONB;
  v_horario_inicio TEXT;
  v_horario_fim TEXT;
  v_modalidades TEXT[];
  v_tipo_moto TEXT;
  v_possui_bau BOOLEAN;
  v_capacidade_bau NUMERIC;
  v_veiculo_categoria TEXT;
  v_veiculo_tipo TEXT;
  v_carroceria TEXT;
  v_veiculo_modelo TEXT;
  v_veiculo_placa TEXT;
  v_veiculo_ano INTEGER;
  v_caracteristicas JSONB;
  v_capacidade_kg NUMERIC;
  v_capacidade_m3 NUMERIC;
  v_dimensoes JSONB;
  v_valor_diaria NUMERIC;
  v_valor_km NUMERIC;
  v_valor_saida NUMERIC;
  v_valor_mensal NUMERIC;
  v_valor_negociavel BOOLEAN;
  v_condicoes TEXT;
  v_restricoes TEXT;
  v_observacoes TEXT;
  v_lgpd BOOLEAN;
  v_lgpd_termo TEXT;
  v_dedup TEXT;
  v_identificadores TEXT[];
  v_ident TEXT;
  v_key TEXT;
  v_existente_id UUID;
  v_existente_protocolo TEXT;
  v_rate_count INTEGER;
  v_relacionadas UUID[];
  v_revisao BOOLEAN := FALSE;
  v_id UUID;
  v_protocolo TEXT;
  v_agora TIMESTAMPTZ := now();
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_obrigatorio' USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload_invalido' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(k) INTO v_campos_inesperados
    FROM jsonb_object_keys(p_payload) AS t(k)
   WHERE k NOT IN (
     'tipo_oferta', 'nome', 'cpf_cnpj', 'telefone', 'email', 'cidade', 'uf',
     'regioes', 'dias_disponiveis', 'horario_inicio', 'horario_fim', 'modalidades',
     'tipo_moto', 'possui_bau', 'capacidade_bau_litros', 'veiculo_categoria',
     'veiculo_tipo', 'carroceria', 'veiculo_modelo', 'veiculo_placa', 'veiculo_ano',
     'caracteristicas', 'capacidade_kg', 'capacidade_m3', 'dimensoes',
     'valor_diaria', 'valor_km', 'valor_saida', 'valor_mensal', 'valor_negociavel',
     'condicoes_comerciais', 'restricoes', 'observacoes', 'lgpd_consent',
     'lgpd_termo_versao'
   );
  IF v_campos_inesperados IS NOT NULL THEN
    RAISE EXCEPTION 'campos_inesperados' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tenant_invalido' USING ERRCODE = '22023';
  END IF;

  -- Rate limit persistente: 5 requisições por minuto por tenant + IP hash.
  IF p_ip_hash IS NOT NULL AND btrim(p_ip_hash) <> '' THEN
    INSERT INTO public.recrutamento_oferta_rate_limit
      (tenant_id, ip_hash, janela, contador)
    VALUES (p_tenant_id, p_ip_hash, date_trunc('minute', now()), 1)
    ON CONFLICT (tenant_id, ip_hash, janela)
    DO UPDATE SET contador = public.recrutamento_oferta_rate_limit.contador + 1
    RETURNING contador INTO v_rate_count;
    IF v_rate_count > 5 THEN
      RAISE EXCEPTION 'rate_limit' USING ERRCODE = '42901';
    END IF;
  END IF;

  v_tipo := btrim(coalesce(p_payload->>'tipo_oferta', ''));
  IF v_tipo NOT IN ('motoboy', 'motorista_veiculo_proprio', 'disponibilidade_veiculo') THEN
    RAISE EXCEPTION 'tipo_oferta_invalido' USING ERRCODE = '22023';
  END IF;

  v_nome := regexp_replace(btrim(coalesce(p_payload->>'nome', '')), '\s+', ' ', 'g');
  IF char_length(v_nome) < 3 OR char_length(v_nome) > 160 THEN
    RAISE EXCEPTION 'nome_invalido' USING ERRCODE = '22023';
  END IF;

  v_cpf_norm := NULLIF(regexp_replace(coalesce(p_payload->>'cpf_cnpj', ''), '\D', '', 'g'), '');
  IF v_cpf_norm IS NOT NULL AND char_length(v_cpf_norm) NOT IN (11, 14) THEN
    RAISE EXCEPTION 'cpf_cnpj_invalido' USING ERRCODE = '22023';
  END IF;

  v_telefone := NULLIF(btrim(coalesce(p_payload->>'telefone', '')), '');
  v_telefone_norm := NULLIF(regexp_replace(coalesce(p_payload->>'telefone', ''), '\D', '', 'g'), '');
  IF v_telefone_norm IS NOT NULL AND char_length(v_telefone_norm) NOT IN (10, 11) THEN
    RAISE EXCEPTION 'telefone_invalido' USING ERRCODE = '22023';
  END IF;

  v_email := NULLIF(lower(btrim(coalesce(p_payload->>'email', ''))), '');
  IF v_email IS NOT NULL AND (
    char_length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ) THEN
    RAISE EXCEPTION 'email_invalido' USING ERRCODE = '22023';
  END IF;

  IF v_telefone_norm IS NULL AND v_email IS NULL THEN
    RAISE EXCEPTION 'contato_obrigatorio' USING ERRCODE = '22023';
  END IF;

  v_cidade := NULLIF(regexp_replace(btrim(coalesce(p_payload->>'cidade', '')), '\s+', ' ', 'g'), '');
  IF v_cidade IS NULL OR char_length(v_cidade) < 2 OR char_length(v_cidade) > 120 THEN
    RAISE EXCEPTION 'cidade_invalida' USING ERRCODE = '22023';
  END IF;

  v_uf := NULLIF(upper(btrim(coalesce(p_payload->>'uf', ''))), '');
  IF v_uf IS NULL OR v_uf !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'uf_invalida' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(coalesce(p_payload->'regioes', 'null'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'regioes_invalidas' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(value ORDER BY value), '[]'::jsonb)
    INTO v_regioes
    FROM (
      SELECT DISTINCT btrim(value) AS value
        FROM jsonb_array_elements_text(p_payload->'regioes') AS t(value)
       WHERE btrim(value) <> ''
    ) AS regioes_unicas;
  IF jsonb_array_length(v_regioes) < 1 OR jsonb_array_length(v_regioes) > 20 THEN
    RAISE EXCEPTION 'regioes_invalidas' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_regioes) AS r
     WHERE char_length(r) > 80
  ) THEN
    RAISE EXCEPTION 'regioes_invalidas' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(coalesce(p_payload->'dias_disponiveis', 'null'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'dias_invalidos' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_payload->'dias_disponiveis') AS d
     WHERE d.value !~ '^[0-6]$'
  ) THEN
    RAISE EXCEPTION 'dias_invalidos' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(DISTINCT value::int), '[]'::jsonb)
    INTO v_dias
    FROM jsonb_array_elements_text(p_payload->'dias_disponiveis') AS t(value);
  IF jsonb_array_length(v_dias) < 1 OR jsonb_array_length(v_dias) > 7 THEN
    RAISE EXCEPTION 'dias_invalidos' USING ERRCODE = '22023';
  END IF;

  v_horario_inicio := NULLIF(btrim(coalesce(p_payload->>'horario_inicio', '')), '');
  v_horario_fim := NULLIF(btrim(coalesce(p_payload->>'horario_fim', '')), '');
  IF v_horario_inicio IS NULL OR v_horario_fim IS NULL
     OR v_horario_inicio !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR v_horario_fim !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR v_horario_fim::time <= v_horario_inicio::time
  THEN
    RAISE EXCEPTION 'horario_invalido' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(coalesce(p_payload->'modalidades', 'null'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'modalidades_invalidas' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(p_payload->'modalidades') AS m
     WHERE m.value NOT IN ('esporadica', 'urgente', 'fixa', 'recorrente')
  ) THEN
    RAISE EXCEPTION 'modalidades_invalidas' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(DISTINCT value ORDER BY value), '{}'::text[])
    INTO v_modalidades
    FROM jsonb_array_elements_text(p_payload->'modalidades') AS t(value);
  IF coalesce(array_length(v_modalidades, 1), 0) < 1
     OR coalesce(array_length(v_modalidades, 1), 0) > 4 THEN
    RAISE EXCEPTION 'modalidades_invalidas' USING ERRCODE = '22023';
  END IF;

  v_veiculo_categoria := NULLIF(lower(btrim(coalesce(p_payload->>'veiculo_categoria', ''))), '');
  IF v_veiculo_categoria NOT IN ('proprio', 'agregado', 'terceiro') THEN
    RAISE EXCEPTION 'veiculo_categoria_invalida' USING ERRCODE = '22023';
  END IF;

  IF v_tipo = 'motoboy' THEN
    v_tipo_moto := btrim(coalesce(p_payload->>'tipo_moto', ''));
    IF v_tipo_moto NOT IN ('Street', 'Trail', 'Custom', 'Scooter', 'Outra') THEN
      RAISE EXCEPTION 'tipo_moto_invalido' USING ERRCODE = '22023';
    END IF;
    v_veiculo_tipo := 'moto';
    v_carroceria := NULL;
    v_possui_bau := coalesce((p_payload->>'possui_bau')::boolean, FALSE);
    v_capacidade_bau := NULLIF(p_payload->>'capacidade_bau_litros', '')::numeric;
    IF v_capacidade_bau IS NOT NULL AND (v_capacidade_bau < 0 OR v_capacidade_bau > 100000) THEN
      RAISE EXCEPTION 'capacidade_invalida' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_tipo_moto := NULL;
    v_possui_bau := NULL;
    v_capacidade_bau := NULL;
    v_veiculo_tipo := btrim(coalesce(p_payload->>'veiculo_tipo', ''));
    IF v_veiculo_tipo NOT IN (
      'Moto', 'Veículo de Passeio', 'Fiorino', 'Kangoo', 'Kombi', 'Van', 'HR',
      'VUC', '3/4', 'Toco', 'Truck', 'Bitruck', 'Carreta', 'Bitrem', 'Outro'
    ) THEN
      RAISE EXCEPTION 'veiculo_tipo_invalido' USING ERRCODE = '22023';
    END IF;
    v_carroceria := btrim(coalesce(p_payload->>'carroceria', ''));
    IF v_carroceria NOT IN (
      'Baú fechado', 'Sider', 'Graneleiro', 'Grade baixa', 'Prancha', 'Tanque',
      'Refrigerado', 'Porta-container', 'Outra'
    ) THEN
      RAISE EXCEPTION 'carroceria_invalida' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_veiculo_modelo := NULLIF(regexp_replace(btrim(coalesce(p_payload->>'veiculo_modelo', '')), '\s+', ' ', 'g'), '');
  IF v_veiculo_modelo IS NOT NULL AND char_length(v_veiculo_modelo) > 80 THEN
    RAISE EXCEPTION 'veiculo_modelo_invalido' USING ERRCODE = '22023';
  END IF;

  v_veiculo_placa := NULLIF(upper(btrim(coalesce(p_payload->>'veiculo_placa', ''))), '');
  IF v_veiculo_placa IS NOT NULL AND v_veiculo_placa !~ '^[A-Z0-9]{7}$' THEN
    RAISE EXCEPTION 'veiculo_placa_invalida' USING ERRCODE = '22023';
  END IF;

  v_veiculo_ano := NULLIF(p_payload->>'veiculo_ano', '')::integer;
  IF v_veiculo_ano IS NOT NULL AND (v_veiculo_ano < 1980 OR v_veiculo_ano > 2100) THEN
    RAISE EXCEPTION 'veiculo_ano_invalido' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(coalesce(p_payload->'caracteristicas', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'caracteristicas_invalidas' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(value ORDER BY value), '[]'::jsonb)
    INTO v_caracteristicas
    FROM (
      SELECT DISTINCT btrim(value) AS value
        FROM jsonb_array_elements_text(p_payload->'caracteristicas') AS t(value)
       WHERE btrim(value) <> ''
    ) AS caracteristicas_unicas;
  IF jsonb_array_length(v_caracteristicas) > 20 THEN
    RAISE EXCEPTION 'caracteristicas_invalidas' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_caracteristicas) AS c
     WHERE char_length(c) > 80
  ) THEN
    RAISE EXCEPTION 'caracteristicas_invalidas' USING ERRCODE = '22023';
  END IF;

  v_capacidade_kg := NULLIF(p_payload->>'capacidade_kg', '')::numeric;
  v_capacidade_m3 := NULLIF(p_payload->>'capacidade_m3', '')::numeric;
  IF (v_capacidade_kg IS NOT NULL AND (v_capacidade_kg < 0 OR v_capacidade_kg > 1000000))
     OR (v_capacidade_m3 IS NOT NULL AND (v_capacidade_m3 < 0 OR v_capacidade_m3 > 1000000))
  THEN
    RAISE EXCEPTION 'capacidade_invalida' USING ERRCODE = '22023';
  END IF;

  v_dimensoes := coalesce(p_payload->'dimensoes', '{}'::jsonb);
  IF jsonb_typeof(v_dimensoes) <> 'object' THEN
    RAISE EXCEPTION 'dimensoes_invalidas' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(v_dimensoes) AS k
     WHERE k NOT IN ('comprimento_m', 'largura_m', 'altura_m')
  ) THEN
    RAISE EXCEPTION 'dimensoes_invalidas' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(v_dimensoes) AS d
     WHERE d.value IS NOT NULL AND (
       d.value !~ '^[0-9]+(\.[0-9]+)?$'
       OR (d.value ~ '^[0-9]+(\.[0-9]+)?$' AND (d.value::numeric < 0 OR d.value::numeric > 1000))
     )
  ) THEN
    RAISE EXCEPTION 'dimensoes_invalidas' USING ERRCODE = '22023';
  END IF;

  v_valor_diaria := NULLIF(p_payload->>'valor_diaria', '')::numeric;
  v_valor_km := NULLIF(p_payload->>'valor_km', '')::numeric;
  v_valor_saida := NULLIF(p_payload->>'valor_saida', '')::numeric;
  v_valor_mensal := NULLIF(p_payload->>'valor_mensal', '')::numeric;
  IF (v_valor_diaria IS NOT NULL AND (v_valor_diaria < 0 OR v_valor_diaria > 1000000000))
     OR (v_valor_km IS NOT NULL AND (v_valor_km < 0 OR v_valor_km > 1000000000))
     OR (v_valor_saida IS NOT NULL AND (v_valor_saida < 0 OR v_valor_saida > 1000000000))
     OR (v_valor_mensal IS NOT NULL AND (v_valor_mensal < 0 OR v_valor_mensal > 1000000000))
  THEN
    RAISE EXCEPTION 'valores_invalidos' USING ERRCODE = '22023';
  END IF;

  v_valor_negociavel := coalesce((p_payload->>'valor_negociavel')::boolean, FALSE);
  v_condicoes := NULLIF(regexp_replace(btrim(coalesce(p_payload->>'condicoes_comerciais', '')), '\s+', ' ', 'g'), '');
  v_restricoes := NULLIF(regexp_replace(btrim(coalesce(p_payload->>'restricoes', '')), '\s+', ' ', 'g'), '');
  v_observacoes := NULLIF(regexp_replace(btrim(coalesce(p_payload->>'observacoes', '')), '\s+', ' ', 'g'), '');
  IF (v_condicoes IS NOT NULL AND char_length(v_condicoes) > 2000)
     OR (v_restricoes IS NOT NULL AND char_length(v_restricoes) > 2000)
     OR (v_observacoes IS NOT NULL AND char_length(v_observacoes) > 2000)
  THEN
    RAISE EXCEPTION 'texto_invalido' USING ERRCODE = '22023';
  END IF;
  IF NOT v_valor_negociavel
     AND v_valor_diaria IS NULL AND v_valor_km IS NULL
     AND v_valor_saida IS NULL AND v_valor_mensal IS NULL
     AND v_condicoes IS NULL
  THEN
    RAISE EXCEPTION 'valor_ou_condicao_obrigatorio' USING ERRCODE = '22023';
  END IF;

  v_lgpd := coalesce((p_payload->>'lgpd_consent')::boolean, FALSE);
  IF v_lgpd IS NOT TRUE THEN
    RAISE EXCEPTION 'lgpd_obrigatorio' USING ERRCODE = '22023';
  END IF;
  v_lgpd_termo := btrim(coalesce(p_payload->>'lgpd_termo_versao', ''));
  IF char_length(v_lgpd_termo) < 1 OR char_length(v_lgpd_termo) > 50 THEN
    RAISE EXCEPTION 'lgpd_termo_invalido' USING ERRCODE = '22023';
  END IF;

  v_dedup := md5(concat_ws('|',
    v_tipo, lower(v_nome), coalesce(v_telefone_norm, ''), coalesce(v_email, ''),
    lower(v_cidade), v_uf, v_regioes::text, v_dias::text,
    array_to_string(v_modalidades, ','), v_horario_inicio, v_horario_fim,
    coalesce(v_veiculo_tipo, ''), coalesce(v_veiculo_categoria, ''), coalesce(v_carroceria, ''),
    lower(coalesce(v_veiculo_modelo, '')), coalesce(v_veiculo_placa, ''),
    coalesce(v_capacidade_kg::text, ''), coalesce(v_capacidade_m3::text, ''),
    coalesce(v_capacidade_bau::text, ''), v_dimensoes::text,
    v_caracteristicas::text, coalesce(v_valor_diaria::text, ''),
    coalesce(v_valor_km::text, ''), coalesce(v_valor_saida::text, ''),
    coalesce(v_valor_mensal::text, ''), v_valor_negociavel::text,
    coalesce(v_condicoes, '')
  ));

  v_identificadores := ARRAY(
    SELECT v FROM unnest(ARRAY[
      CASE WHEN v_telefone_norm IS NOT NULL THEN 'telefone:' || v_telefone_norm END,
      CASE WHEN v_email IS NOT NULL THEN 'email:' || v_email END,
      CASE WHEN v_cpf_norm IS NOT NULL
           THEN (CASE WHEN char_length(v_cpf_norm) = 11 THEN 'cpf:' ELSE 'cnpj:' END) || v_cpf_norm
      END
    ]) AS t(v)
    WHERE v IS NOT NULL
    ORDER BY v
  );

  FOREACH v_ident IN ARRAY v_identificadores LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || v_ident, 0));
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':dedup:' || v_dedup, 0));

  v_key := NULLIF(btrim(coalesce(p_request_id, '')), '');
  IF v_key IS NOT NULL THEN
    SELECT o.id, o.protocolo INTO v_existente_id, v_existente_protocolo
      FROM public.recrutamento_ofertas o
     WHERE o.tenant_id = p_tenant_id
       AND o.idempotency_key = v_key
     LIMIT 1;
    IF v_existente_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', TRUE, 'oferta_id', v_existente_id,
        'protocolo', v_existente_protocolo, 'deduplicada', TRUE,
        'revisao_humana', FALSE
      );
    END IF;
  END IF;

  SELECT o.id, o.protocolo INTO v_existente_id, v_existente_protocolo
    FROM public.recrutamento_ofertas o
   WHERE o.tenant_id = p_tenant_id
     AND o.dedup_hash = v_dedup
     AND o.status IN ('nova', 'em_analise', 'em_contato')
   LIMIT 1;
  IF v_existente_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE, 'oferta_id', v_existente_id,
      'protocolo', v_existente_protocolo, 'deduplicada', TRUE,
      'revisao_humana', FALSE
    );
  END IF;

  -- Não bloqueia automaticamente: conflito de identificadores sinaliza revisão humana.
  SELECT array_agg(DISTINCT oi.oferta_id) INTO v_relacionadas
    FROM public.recrutamento_oferta_identificadores oi
   WHERE oi.tenant_id = p_tenant_id
     AND (
       (v_telefone_norm IS NOT NULL AND oi.tipo = 'telefone' AND oi.valor_norm = v_telefone_norm)
       OR (v_email IS NOT NULL AND oi.tipo = 'email' AND oi.valor_norm = v_email)
       OR (v_cpf_norm IS NOT NULL AND oi.tipo IN ('cpf', 'cnpj') AND oi.valor_norm = v_cpf_norm)
     );
  v_revisao := coalesce(array_length(v_relacionadas, 1), 0) > 1;

  v_protocolo := 'OF-' || to_char(v_agora, 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  BEGIN
    INSERT INTO public.recrutamento_ofertas (
      protocolo, tenant_id, tipo_oferta, status, revisao_humana,
      nome, cpf_cnpj, cpf_cnpj_norm, telefone, telefone_norm, email, email_norm,
      cidade, uf, regioes, dias_disponiveis, horario_inicio, horario_fim,
      modalidades, tipo_moto, possui_bau, capacidade_bau_litros,
      veiculo_categoria, veiculo_tipo, carroceria, veiculo_modelo,
      veiculo_placa, veiculo_ano, caracteristicas, capacidade_kg,
      capacidade_m3, dimensoes, valor_diaria, valor_km, valor_saida,
      valor_mensal, valor_negociavel, condicoes_comerciais, restricoes,
      observacoes, origem, idempotency_key, dedup_hash, ip_hash,
      user_agent_hash, lgpd_consent, lgpd_consent_em, lgpd_termo_versao,
      lgpd_finalidade
    ) VALUES (
      v_protocolo, p_tenant_id, v_tipo, 'nova', v_revisao,
      v_nome, NULLIF(btrim(coalesce(p_payload->>'cpf_cnpj', '')), ''), v_cpf_norm,
      v_telefone, v_telefone_norm, v_email, v_email,
      v_cidade, v_uf, v_regioes, v_dias, v_horario_inicio::time, v_horario_fim::time,
      v_modalidades, v_tipo_moto, v_possui_bau, v_capacidade_bau,
      v_veiculo_categoria, v_veiculo_tipo, v_carroceria, v_veiculo_modelo,
      v_veiculo_placa, v_veiculo_ano, v_caracteristicas, v_capacidade_kg,
      v_capacidade_m3, v_dimensoes, v_valor_diaria, v_valor_km, v_valor_saida,
      v_valor_mensal, v_valor_negociavel, v_condicoes, v_restricoes,
      v_observacoes, 'link_publico', v_key, v_dedup, p_ip_hash,
      p_user_agent_hash, TRUE, v_agora, v_lgpd_termo,
      'analise_e_contato_sobre_oferta'
    ) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT o.id, o.protocolo INTO v_existente_id, v_existente_protocolo
      FROM public.recrutamento_ofertas o
     WHERE o.tenant_id = p_tenant_id
       AND (o.dedup_hash = v_dedup OR (v_key IS NOT NULL AND o.idempotency_key = v_key))
       AND o.status IN ('nova', 'em_analise', 'em_contato')
     ORDER BY o.created_at DESC
     LIMIT 1;
    IF v_existente_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', TRUE, 'oferta_id', v_existente_id,
        'protocolo', v_existente_protocolo, 'deduplicada', TRUE,
        'revisao_humana', FALSE
      );
    END IF;
    RAISE;
  END;

  INSERT INTO public.recrutamento_oferta_identificadores
    (oferta_id, tenant_id, tipo, valor_norm)
  SELECT v_id, p_tenant_id, split_part(i, ':', 1), substr(i, strpos(i, ':') + 1)
    FROM unnest(v_identificadores) AS t(i)
   WHERE split_part(i, ':', 1) IN ('telefone', 'email', 'cpf', 'cnpj')
     AND char_length(substr(i, strpos(i, ':') + 1)) > 0
   ON CONFLICT DO NOTHING;

  INSERT INTO public.recrutamento_oferta_eventos
    (oferta_id, tenant_id, tipo, descricao, dados, ator)
  VALUES (
    v_id, p_tenant_id, 'oferta_recebida',
    'Oferta recebida pelo link público.',
    jsonb_build_object('protocolo', v_protocolo, 'revisao_humana', v_revisao),
    'sistema'
  );

  IF v_revisao THEN
    INSERT INTO public.recrutamento_oferta_eventos
      (oferta_id, tenant_id, tipo, descricao, dados, ator)
    VALUES (
      v_id, p_tenant_id, 'conflito_identificadores',
      'Telefone/e-mail/CPF apontam para ofertas diferentes; revisão manual necessária.',
      jsonb_build_object('ofertas_relacionadas', coalesce(to_jsonb(v_relacionadas), '[]'::jsonb)),
      'sistema'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE, 'oferta_id', v_id, 'protocolo', v_protocolo,
    'deduplicada', FALSE, 'revisao_humana', v_revisao
  );
END;
$$;

-- 9) PERMISSÕES DA RPC: SOMENTE service_role --------------------------------
REVOKE ALL ON FUNCTION public.f_registrar_oferta_publica(UUID, JSONB, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f_registrar_oferta_publica(UUID, JSONB, TEXT, TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.f_registrar_oferta_publica(UUID, JSONB, TEXT, TEXT, TEXT) IS
  'ADM-APP-02B.2 — recebe oferta pública com validação, dedup/conflito, rate limit e auditoria. Chamável apenas por service_role (Edge ofertas-publicas).';

-- 10) RLS E GRANTS -----------------------------------------------------------
ALTER TABLE public.recrutamento_ofertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ofertas_select_tms ON public.recrutamento_ofertas;
CREATE POLICY ofertas_select_tms ON public.recrutamento_ofertas
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id_safe()
    AND EXISTS (SELECT 1 FROM public.tenant_usuarios tu WHERE tu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS ofertas_update_tms ON public.recrutamento_ofertas;
CREATE POLICY ofertas_update_tms ON public.recrutamento_ofertas
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id_safe()
    AND EXISTS (SELECT 1 FROM public.tenant_usuarios tu WHERE tu.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id_safe()
    AND EXISTS (SELECT 1 FROM public.tenant_usuarios tu WHERE tu.user_id = auth.uid())
  );

REVOKE ALL ON public.recrutamento_ofertas FROM PUBLIC;
REVOKE ALL ON public.recrutamento_ofertas FROM anon;
GRANT SELECT, UPDATE ON public.recrutamento_ofertas TO authenticated;
GRANT ALL ON public.recrutamento_ofertas TO service_role;

ALTER TABLE public.recrutamento_oferta_identificadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oferta_identificadores_select_tms ON public.recrutamento_oferta_identificadores;
CREATE POLICY oferta_identificadores_select_tms ON public.recrutamento_oferta_identificadores
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id_safe()
    AND EXISTS (SELECT 1 FROM public.tenant_usuarios tu WHERE tu.user_id = auth.uid())
  );
REVOKE ALL ON public.recrutamento_oferta_identificadores FROM PUBLIC;
REVOKE ALL ON public.recrutamento_oferta_identificadores FROM anon;
GRANT SELECT ON public.recrutamento_oferta_identificadores TO authenticated;
GRANT ALL ON public.recrutamento_oferta_identificadores TO service_role;

ALTER TABLE public.recrutamento_oferta_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oferta_eventos_select_tms ON public.recrutamento_oferta_eventos;
CREATE POLICY oferta_eventos_select_tms ON public.recrutamento_oferta_eventos
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id_safe()
    AND EXISTS (SELECT 1 FROM public.tenant_usuarios tu WHERE tu.user_id = auth.uid())
  );
REVOKE ALL ON public.recrutamento_oferta_eventos FROM PUBLIC;
REVOKE ALL ON public.recrutamento_oferta_eventos FROM anon;
GRANT SELECT ON public.recrutamento_oferta_eventos TO authenticated;
GRANT ALL ON public.recrutamento_oferta_eventos TO service_role;

ALTER TABLE public.recrutamento_oferta_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recrutamento_oferta_rate_limit FROM PUBLIC;
REVOKE ALL ON public.recrutamento_oferta_rate_limit FROM anon;
REVOKE ALL ON public.recrutamento_oferta_rate_limit FROM authenticated;
GRANT ALL ON public.recrutamento_oferta_rate_limit TO service_role;

-- 11) COMENTÁRIOS ------------------------------------------------------------
COMMENT ON TABLE public.recrutamento_ofertas IS
  'ADM-APP-02B.2 — ofertas públicas de motoboys/motoristas/veículos. Não cria prestador, Auth user ou liberado_app.';
COMMENT ON TABLE public.recrutamento_oferta_identificadores IS
  'Identificadores normalizados da oferta para dedup/conflito entre telefone, e-mail e CPF/CNPJ.';
COMMENT ON TABLE public.recrutamento_oferta_eventos IS
  'Auditoria imutável de eventos da oferta (recebimento, conflito, status, conversão futura).';
COMMENT ON TABLE public.recrutamento_oferta_rate_limit IS
  'Rate limit persistente por tenant + IP hash para a Edge ofertas-publicas.';

NOTIFY pgrst, 'reload schema';

COMMIT;
