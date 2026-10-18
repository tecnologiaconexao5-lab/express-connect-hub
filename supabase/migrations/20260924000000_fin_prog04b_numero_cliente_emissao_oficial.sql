-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FIN-PROG-04B — EMISSÃO OFICIAL DE FATURAS (Nº CONEXÃO + Nº CLIENTE + 1 AR)
--
-- ADITIVA E COMPATÍVEL COM LEGADO:
--   • faturas.numero (FAT-YYYY-NNNNNN) permanece como Nº CONEXÃO (global).
--   • nova coluna faturas.numero_cliente INTEGER NULL (sequencial por cliente).
--   • nova tabela de contador por tenant_id + cliente_id (SEM ano).
--   • UNIQUE parcial (tenant_id, cliente_id, numero_cliente) WHERE NOT NULL.
--   • UNIQUE parcial financeiro_receber(fatura_id) WHERE fatura_id IS NOT NULL.
--   • trigger que impede NOVAS transições para 'emitida' sem conta_receber_id
--     (não afeta os 14 registros históricos já emitidos sem AR).
--   • f_emitir_fatura passa a gerar o Nº Cliente atomicamente.
--   • REVOKE EXECUTE FROM anon nas RPCs de faturamento.
-- SEM DROP/TRUNCATE/DELETE. Nenhum dado histórico alterado. Sem backfill.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ==============================================================================
-- 1. COLUNA numero_cliente (sequencial POR CLIENTE, sem dimensão de ano)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='faturas' AND column_name='numero_cliente'
  ) THEN
    ALTER TABLE public.faturas ADD COLUMN numero_cliente integer;
  END IF;
END $$;

COMMENT ON COLUMN public.faturas.numero_cliente IS
  'TMS-FIN-PROG-04B: sequencial de faturamento POR CLIENTE (histórico, não reinicia por ano). Gerado na emissão.';

-- ==============================================================================
-- 2. CONTADOR TRANSACIONAL POR tenant_id + cliente_id (sem ano)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.fatura_contadores_cliente (
  tenant_id     uuid    NOT NULL,
  cliente_id    uuid    NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ultimo_numero integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, cliente_id)
);

ALTER TABLE public.fatura_contadores_cliente ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fatura_contadores_cliente' AND policyname='fcc_select_tms') THEN
    CREATE POLICY "fcc_select_tms" ON public.fatura_contadores_cliente FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
             AND tenant_id = current_tenant_id_safe());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fatura_contadores_cliente' AND policyname='fcc_insert_tms') THEN
    CREATE POLICY "fcc_insert_tms" ON public.fatura_contadores_cliente FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
             AND tenant_id = current_tenant_id_safe());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fatura_contadores_cliente' AND policyname='fcc_update_tms') THEN
    CREATE POLICY "fcc_update_tms" ON public.fatura_contadores_cliente FOR UPDATE
      TO authenticated
      USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid())
             AND tenant_id = current_tenant_id_safe());
  END IF;
END $$;

-- ==============================================================================
-- 3. UNICIDADE DO Nº CLIENTE (apenas quando preenchido)
-- ==============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_faturas_numero_cliente
  ON public.faturas (tenant_id, cliente_id, numero_cliente)
  WHERE numero_cliente IS NOT NULL;

-- ==============================================================================
-- 4. IDEMPOTÊNCIA ESTRUTURAL: 1 AR por fatura
-- ==============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_receber_fatura_id
  ON public.financeiro_receber (fatura_id)
  WHERE fatura_id IS NOT NULL;

-- ==============================================================================
-- 5. GUARDA: proibir NOVAS transições para 'emitida' sem Conta a Receber
--    (compatível com os 14 registros históricos já emitidos sem AR)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.f_trg_faturas_bloqueio_emissao_sem_ar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'emitida' AND NEW.conta_receber_id IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'FATURA_EMITIDA_SEM_AR: emissão deve ocorrer via f_emitir_fatura (Nº + Conta a Receber).';
    ELSIF OLD.status IS DISTINCT FROM 'emitida' THEN
      RAISE EXCEPTION 'FATURA_EMITIDA_SEM_AR: transição para emitida exige Conta a Receber (use f_emitir_fatura).';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_faturas_bloqueio_emissao_sem_ar ON public.faturas;
CREATE TRIGGER trg_faturas_bloqueio_emissao_sem_ar
  BEFORE INSERT OR UPDATE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.f_trg_faturas_bloqueio_emissao_sem_ar();

-- ==============================================================================
-- 6. f_emitir_fatura — transacional: Nº Conexão + Nº Cliente + 1 AR
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
  v_numero_cliente integer;
  v_receber_id uuid;
  v_vencimento date;
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

  -- Cliente é obrigatório para gerar o Nº Cliente
  IF v_fatura.cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_SEM_CLIENTE');
  END IF;

  -- Deve haver itens
  IF NOT EXISTS (SELECT 1 FROM public.fatura_itens WHERE fatura_id = p_fatura_id AND status = 'ativo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_SEM_ITENS');
  END IF;

  -- Nº Conexão (sequencial global por ano — mecanismo existente)
  v_numero := public.f_gerar_numero_fatura(p_fatura_id);
  IF v_numero IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FALHA_GERAR_NUMERO');
  END IF;

  -- Nº Cliente (sequencial histórico por tenant+cliente, atômico via UPSERT)
  INSERT INTO public.fatura_contadores_cliente (tenant_id, cliente_id, ultimo_numero, updated_at)
  VALUES (v_fatura.tenant_id, v_fatura.cliente_id, 1, now())
  ON CONFLICT (tenant_id, cliente_id)
  DO UPDATE SET ultimo_numero = public.fatura_contadores_cliente.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_numero_cliente;

  -- Vencimento sugerido: vencimento da fatura, senão emissão + 30 dias
  v_vencimento := COALESCE(v_fatura.vencimento, v_fatura.data_emissao + 30);

  -- Cria Conta a Receber (1 por fatura; UNIQUE parcial em fatura_id)
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

  -- Marca fatura emitida (conta_receber_id preenchido → passa pela guarda)
  UPDATE public.faturas
  SET status = 'emitida',
      numero = v_numero,
      numero_cliente = v_numero_cliente,
      conta_receber_id = v_receber_id,
      vencimento = v_vencimento,
      atualizado_por = auth.uid(),
      atualizado_em = now()
  WHERE id = p_fatura_id;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'numero', v_numero,
    'numero_cliente', v_numero_cliente,
    'conta_receber_id', v_receber_id,
    'valor_total', v_fatura.valor_total,
    'vencimento', v_vencimento
  );
END;
$function$;

-- ==============================================================================
-- 7. GRANTS — único caminho autorizado, sem anon
-- ==============================================================================
REVOKE ALL ON FUNCTION public.f_emitir_fatura(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_cancelar_fatura(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.f_gerar_numero_fatura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_emitir_fatura(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_cancelar_fatura(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.f_gerar_numero_fatura(uuid) TO authenticated, service_role;

-- ==============================================================================
-- FIM DA MIGRATION TMS-FIN-PROG-04B (aditiva, sem backfill, sem tocar histórico)
-- ==============================================================================
