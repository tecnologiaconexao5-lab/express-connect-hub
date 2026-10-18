-- ═══════════════════════════════════════════════════════════════════════════════
-- FASE 2A — FUNDAÇÃO PROFISSIONAL DO FATURAMENTO
-- fatura + fatura_itens + vínculo seguro com financeiro_receber
--
-- MIGRATION ADITIVA E COMPATÍVEL:
--   • CREATE TABLE (novas tabelas faturas / fatura_itens)
--   • ALTER TABLE financeiro_receber ADD COLUMN fatura_id (uuid, FK)
--   • CREATE SEQUENCE para numeração sequencial segura
--   • CREATE FUNCTION (numeração, anti-duplicidade, totais)
--   • CREATE TRIGGER (proteção de item em fatura emitida/cancelada)
--   • RLS padrão _tms (guard EXISTS tenant_usuarios)
--   • SEM DROP / TRUNCATE / RESET / DELETE / recriação de tabelas existentes
--   • Nenhum dado existente é alterado
-- ═══════════════════════════════════════════════════════════════════════════════

-- ==============================================================================
-- 1. SEQUÊNCIA DE NUMERAÇÃO (por ano, com lock transacional)
-- ==============================================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_fatura_2026 START 1;
-- A numeração é gerada por RPC transacional (f_gerar_numero_fatura) que usa um
-- lock na tabela de contadores para impedir que dois usuários recebam o mesmo
-- número simultaneamente. Cada ano terá sua sequência, criada on-demand.

-- ==============================================================================
-- 2. ENTIDADE FATURA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.faturas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL DEFAULT current_tenant_id_safe(),
  numero                text UNIQUE,           -- FAT-2026-000037 (preenchido na emissão)
  cliente_id            uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  data_emissao          date NOT NULL DEFAULT CURRENT_DATE,
  competencia_inicio    date,
  competencia_fim       date,
  vencimento            date,
  valor_bruto           numeric(14,2) NOT NULL DEFAULT 0,
  descontos             numeric(14,2) NOT NULL DEFAULT 0,
  acrescimos            numeric(14,2) NOT NULL DEFAULT 0,
  valor_total           numeric(14,2) NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'rascunho',
  observacao            text,
  observacao_fiscal     text,
  conta_receber_id      uuid REFERENCES public.financeiro_receber(id) ON DELETE SET NULL,
  criado_por            uuid,
  criado_em             timestamptz NOT NULL DEFAULT now(),
  atualizado_por        uuid,
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  cancelado_em          timestamptz,
  cancelado_por         uuid,
  motivo_cancelamento   text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_faturas_status CHECK (status IN (
    'rascunho','aguardando_aprovacao','aprovada','emitida','cancelada'
  ))
);

CREATE INDEX IF NOT EXISTS idx_faturas_cliente_status ON public.faturas (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_faturas_vencimento ON public.faturas (vencimento);
CREATE INDEX IF NOT EXISTS idx_faturas_tenant_status ON public.faturas (tenant_id, status);

-- ==============================================================================
-- 3. ITENS DA FATURA (snapshot financeiro imutável após emissão)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fatura_itens (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id             uuid NOT NULL REFERENCES public.faturas(id) ON DELETE CASCADE,
  os_id                 uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  alocacao_id           uuid REFERENCES public.alocacoes_escala(id) ON DELETE SET NULL,
  cliente_id            uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  romaneio              text,
  descricao             text,
  data_servico          date,
  -- Snapshot financeiro do CLIENTE (nunca inclui custo do prestador)
  valor_base            numeric(14,2) NOT NULL DEFAULT 0,
  valor_adicionais      numeric(14,2) NOT NULL DEFAULT 0,
  valor_descontos       numeric(14,2) NOT NULL DEFAULT 0,
  valor_total           numeric(14,2) NOT NULL DEFAULT 0,
  -- Componentes detalhados (preservados para rastreabilidade)
  km_excedente          numeric(14,2) NOT NULL DEFAULT 0,
  pedagio_cliente       numeric(14,2) NOT NULL DEFAULT 0,
  ajudante_cliente      numeric(14,2) NOT NULL DEFAULT 0,
  diaria_cliente        numeric(14,2) NOT NULL DEFAULT 0,
  saidas_adicionais_cliente numeric(14,2) NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'ativo',
  criado_por            uuid,
  criado_em             timestamptz NOT NULL DEFAULT now(),
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_fatura_itens_status CHECK (status IN ('ativo','cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_fatura_itens_fatura ON public.fatura_itens (fatura_id);
CREATE INDEX IF NOT EXISTS idx_fatura_itens_os ON public.fatura_itens (os_id);

-- ==============================================================================
-- 4. VÍNCULO SEGURO FATURA ↔ CONTA A RECEBER
-- ==============================================================================
-- Aditivo: coluna fatura_id em financeiro_receber (FK para faturas).
-- NÃO remove colunas legadas (fatura, serie, numero, os_vinculadas).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='financeiro_receber' AND column_name='fatura_id'
  ) THEN
    ALTER TABLE public.financeiro_receber
      ADD COLUMN fatura_id uuid REFERENCES public.faturas(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_financeiro_receber_fatura_id ON public.financeiro_receber (fatura_id);

-- ==============================================================================
-- 5. NUMERAÇÃO SEQUENCIAL SEGURA (transacional, por ano)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_gerar_numero_fatura(p_fatura_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ano integer;
  v_seq_name text;
  v_numero text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  v_ano := EXTRACT(YEAR FROM now())::integer;
  v_seq_name := 'seq_fatura_' || v_ano::text;

  -- Cria a sequência do ano se não existir (aditivo, on-demand)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_seq_name AND c.relkind = 'S'
  ) THEN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I START 1', v_seq_name);
  END IF;

  -- nextval é atômico e serializa chamadas concorrentes → impede duplicidade
  EXECUTE format('SELECT nextval(''public.%I'')', v_seq_name) INTO v_numero;

  RETURN format('FAT-%s-%s', v_ano, LPAD(v_numero, 6, '0'));
END;
$function$;

REVOKE ALL ON FUNCTION public.f_gerar_numero_fatura(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_gerar_numero_fatura(uuid) TO authenticated;

-- ==============================================================================
-- 6. CÁLCULO DO TOTAL DA FATURA (itens → totais)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_recalcular_totais_fatura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura_id uuid;
BEGIN
  v_fatura_id := NEW.fatura_id;
  IF TG_OP = 'DELETE' THEN
    v_fatura_id := OLD.fatura_id;
  END IF;

  UPDATE public.faturas f
  SET
    valor_bruto = COALESCE((
      SELECT SUM(i.valor_base) FROM public.fatura_itens i
      WHERE i.fatura_id = v_fatura_id AND i.status = 'ativo'
    ), 0),
    valor_total = COALESCE((
      SELECT SUM(i.valor_total) FROM public.fatura_itens i
      WHERE i.fatura_id = v_fatura_id AND i.status = 'ativo'
    ), 0),
    descontos = COALESCE((
      SELECT SUM(i.valor_descontos) FROM public.fatura_itens i
      WHERE i.fatura_id = v_fatura_id AND i.status = 'ativo'
    ), 0),
    atualizado_em = now()
  WHERE f.id = v_fatura_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_fatura_itens_recalcular_totais ON public.fatura_itens;
CREATE TRIGGER trg_fatura_itens_recalcular_totais
  AFTER INSERT OR UPDATE OR DELETE ON public.fatura_itens
  FOR EACH ROW EXECUTE FUNCTION public.f_recalcular_totais_fatura();

-- ==============================================================================
-- 7. ANTI-DUPLICIDADE FORTE: mesma OS ativa em duas faturas válidas é bloqueada
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_trg_fatura_itens_anti_duplicidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_os_ja_faturada uuid;
  v_status_fatura text;
BEGIN
  IF NEW.os_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_status_fatura FROM public.faturas WHERE id = NEW.fatura_id;

  -- Regra: mesmo serviço ativo não pode estar em duas faturas válidas
  -- (válidas = não canceladas). Fatura cancelada libera o serviço.
  IF v_status_fatura IS DISTINCT FROM 'cancelada' THEN
    SELECT fi.id INTO v_os_ja_faturada
    FROM public.fatura_itens fi
    JOIN public.faturas f ON f.id = fi.fatura_id
    WHERE fi.os_id = NEW.os_id
      AND fi.status = 'ativo'
      AND f.status IS DISTINCT FROM 'cancelada'
      AND fi.fatura_id IS DISTINCT FROM NEW.fatura_id
    LIMIT 1;

    IF v_os_ja_faturada IS NOT NULL THEN
      RAISE EXCEPTION 'SERVIÇO_JA_FATURADO: A OS % já está vinculada a outra fatura ativa.', NEW.os_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fatura_itens_anti_duplicidade ON public.fatura_itens;
CREATE TRIGGER trg_fatura_itens_anti_duplicidade
  BEFORE INSERT OR UPDATE ON public.fatura_itens
  FOR EACH ROW EXECUTE FUNCTION public.f_trg_fatura_itens_anti_duplicidade();

-- ==============================================================================
-- 8. BLOQUEIO DE ALTERAÇÃO APÓS EMISSÃO
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_trg_fatura_itens_bloqueio_emissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.faturas WHERE id = NEW.fatura_id;
  IF v_status IN ('emitida','cancelada') THEN
    RAISE EXCEPTION 'FATURA_BLOQUEADA: Não é permitido alterar itens de fatura % (status %). Use cancelamento/correção controlada.', v_status, v_status;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fatura_itens_bloqueio_emissao ON public.fatura_itens;
CREATE TRIGGER trg_fatura_itens_bloqueio_emissao
  BEFORE INSERT OR UPDATE OR DELETE ON public.fatura_itens
  FOR EACH ROW EXECUTE FUNCTION public.f_trg_fatura_itens_bloqueio_emissao();

-- ==============================================================================
-- 9. RLS — padrão _tms (guard EXISTS tenant_usuarios)
-- ==============================================================================
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatura_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- faturas
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='faturas' AND policyname='fat_select_tms') THEN
    CREATE POLICY "fat_select_tms" ON public.faturas FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
             AND tenant_id = current_tenant_id_safe());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='faturas' AND policyname='fat_insert_tms') THEN
    CREATE POLICY "fat_insert_tms" ON public.faturas FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
             AND tenant_id = current_tenant_id_safe());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='faturas' AND policyname='fat_update_tms') THEN
    CREATE POLICY "fat_update_tms" ON public.faturas FOR UPDATE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
             AND tenant_id = current_tenant_id_safe());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='faturas' AND policyname='fat_delete_tms') THEN
    CREATE POLICY "fat_delete_tms" ON public.faturas FOR DELETE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
             AND tenant_id = current_tenant_id_safe());
  END IF;

  -- fatura_itens
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fatura_itens' AND policyname='fatit_select_tms') THEN
    CREATE POLICY "fatit_select_tms" ON public.fatura_itens FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fatura_itens' AND policyname='fatit_insert_tms') THEN
    CREATE POLICY "fatit_insert_tms" ON public.fatura_itens FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fatura_itens' AND policyname='fatit_update_tms') THEN
    CREATE POLICY "fatit_update_tms" ON public.fatura_itens FOR UPDATE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fatura_itens' AND policyname='fatit_delete_tms') THEN
    CREATE POLICY "fatit_delete_tms" ON public.fatura_itens FOR DELETE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ==============================================================================
-- 10. EMISSÃO TRANSACIONAL (gera número + cria Conta a Receber)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_emitir_fatura(p_fatura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura public.faturas%ROWTYPE;
  v_numero text;
  v_receber_id uuid;
  v_vencimento date;
  v_obs_romaneios text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Lock transacional na fatura (impede emissão concorrente)
  SELECT * INTO v_fatura FROM public.faturas WHERE id = p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_ENCONTRADA');
  END IF;

  IF v_fatura.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_CANCELADA');
  END IF;
  IF v_fatura.status = 'emitida' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_JA_EMITIDA');
  END IF;
  IF v_fatura.status NOT IN ('rascunho','aguardando_aprovacao','aprovada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'STATUS_INVALIDO_EMISSAO');
  END IF;

  -- Deve haver itens
  IF NOT EXISTS (SELECT 1 FROM public.fatura_itens WHERE fatura_id = p_fatura_id AND status = 'ativo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_SEM_ITENS');
  END IF;

  -- Numeração sequencial transacional
  v_numero := public.f_gerar_numero_fatura(p_fatura_id);
  IF v_numero IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FALHA_GERAR_NUMERO');
  END IF;

  -- Vencimento sugerido: vencimento da fatura, senão emissão + 30 dias
  v_vencimento := COALESCE(v_fatura.vencimento, v_fatura.data_emissao + 30);

  -- Cria Conta a Receber vinculada (FK fatura_id)
  INSERT INTO public.financeiro_receber (
    cliente_id, descricao, valor, vencimento, data_vencimento, data_emissao,
    status, cliente, cliente_nome, fatura, numero, os_vinculadas,
    valor_bruto, valor_liquido, fatura_id
  ) VALUES (
    v_fatura.cliente_id,
    'Fatura ' || v_numero,
    v_fatura.valor_total,
    v_vencimento,
    v_vencimento,
    CURRENT_DATE,
    'aberto',
    (SELECT COALESCE(c.nome_fantasia, c.razao_social, '') FROM public.clientes c WHERE c.id = v_fatura.cliente_id),
    (SELECT COALESCE(c.nome_fantasia, c.razao_social, '') FROM public.clientes c WHERE c.id = v_fatura.cliente_id),
    v_numero,
    v_numero,
    NULL,
    v_fatura.valor_bruto,
    v_fatura.valor_total,
    p_fatura_id
  )
  RETURNING id INTO v_receber_id;

  -- Marca fatura emitida
  UPDATE public.faturas
  SET status = 'emitida',
      numero = v_numero,
      conta_receber_id = v_receber_id,
      vencimento = v_vencimento,
      atualizado_por = auth.uid(),
      atualizado_em = now()
  WHERE id = p_fatura_id;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'numero', v_numero,
    'conta_receber_id', v_receber_id,
    'valor_total', v_fatura.valor_total,
    'vencimento', v_vencimento
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.f_emitir_fatura(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_emitir_fatura(uuid) TO authenticated;

-- ==============================================================================
-- 11. CANCELAMENTO CONTROLADO (libera serviços para novo faturamento)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_cancelar_fatura(p_fatura_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura public.faturas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  SELECT * INTO v_fatura FROM public.faturas WHERE id = p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_ENCONTRADA');
  END IF;

  IF v_fatura.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_JA_CANCELADA');
  END IF;

  -- Cancela a fatura
  UPDATE public.faturas
  SET status = 'cancelada',
      cancelado_em = now(),
      cancelado_por = auth.uid(),
      motivo_cancelamento = p_motivo,
      atualizado_em = now()
  WHERE id = p_fatura_id;

  -- Cancela itens (libera os serviços; o anti-duplicidade ignora fatura cancelada)
  UPDATE public.fatura_itens SET status = 'cancelado', atualizado_em = now()
  WHERE fatura_id = p_fatura_id AND status = 'ativo';

  -- Cancela a Conta a Receber vinculada, se existir
  IF v_fatura.conta_receber_id IS NOT NULL THEN
    UPDATE public.financeiro_receber
    SET status = 'cancelado', observacoes = COALESCE(observacoes, '') || ' | Cancelada pela Fatura ' || COALESCE(v_fatura.numero, '')
    WHERE id = v_fatura.conta_receber_id AND status NOT IN ('pago');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'status', 'cancelada',
    'servicos_liberados', true
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.f_cancelar_fatura(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.f_cancelar_fatura(uuid, text) TO authenticated;

-- ==============================================================================
-- FIM DA MIGRATION FASE 2A (aditiva, compatível, sem impacto em dados existentes)
-- ==============================================================================
