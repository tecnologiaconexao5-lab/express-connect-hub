-- =============================================================================
-- TALENT INTELLIGENCE — FASE 7 (Itens 11, 12, 15, 16 e 18)
-- Disponibilidade instantânea, convites de OS, treinamentos e suporte a alertas.
-- Nenhuma tela/layout do Dashboard é alterada por esta migration.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. STATUS INSTANTÂNEO DO APP (Disponível / Indisponível / Em Operação)
-- ---------------------------------------------------------------------------
ALTER TABLE public.prestador_perfil_talento
  ADD COLUMN IF NOT EXISTS status_disponibilidade text DEFAULT 'disponivel';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_prestador_perfil_status_disponibilidade'
      AND conrelid = 'public.prestador_perfil_talento'::regclass
  ) THEN
    ALTER TABLE public.prestador_perfil_talento
      ADD CONSTRAINT chk_prestador_perfil_status_disponibilidade
      CHECK (status_disponibilidade IN ('disponivel', 'indisponivel', 'em_operacao'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. DOCUMENTOS — status e validade (base dos Alertas Inteligentes)
-- A tabela original guardava apenas id, prestador_id, tipo, url, created_at.
-- ---------------------------------------------------------------------------
ALTER TABLE public.documentos_prestadores
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS validade date,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_documentos_prestadores_validade
  ON public.documentos_prestadores (data_vencimento)
  WHERE data_vencimento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_prestadores_validade_alt
  ON public.documentos_prestadores (validade)
  WHERE validade IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. CONVITES DE OS (linha do tempo dos convites feitos pelo Match)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recrutamento_convites_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  os_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'expirado')),
  sugerido_em timestamptz NOT NULL DEFAULT now(),
  respondido_em timestamptz,
  tempo_resposta_minutos integer,
  motivo_recusa text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convites_os_prestador
  ON public.recrutamento_convites_os (prestador_id);
CREATE INDEX IF NOT EXISTS idx_convites_os_os
  ON public.recrutamento_convites_os (os_id);
CREATE INDEX IF NOT EXISTS idx_convites_os_status
  ON public.recrutamento_convites_os (status);

DROP TRIGGER IF EXISTS trg_recrutamento_convites_os_updated_at
  ON public.recrutamento_convites_os;
CREATE TRIGGER trg_recrutamento_convites_os_updated_at
  BEFORE UPDATE ON public.recrutamento_convites_os
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.recrutamento_convites_os ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rco_select_tms" ON public.recrutamento_convites_os;
CREATE POLICY "rco_select_tms" ON public.recrutamento_convites_os
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "rco_select_own" ON public.recrutamento_convites_os;
CREATE POLICY "rco_select_own" ON public.recrutamento_convites_os
  FOR SELECT TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rco_insert_tms" ON public.recrutamento_convites_os;
CREATE POLICY "rco_insert_tms" ON public.recrutamento_convites_os
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "rco_update_tms" ON public.recrutamento_convites_os;
CREATE POLICY "rco_update_tms" ON public.recrutamento_convites_os
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "rco_update_own" ON public.recrutamento_convites_os;
CREATE POLICY "rco_update_own" ON public.recrutamento_convites_os
  FOR UPDATE TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rco_delete_tms" ON public.recrutamento_convites_os;
CREATE POLICY "rco_delete_tms" ON public.recrutamento_convites_os
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recrutamento_convites_os TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. TREINAMENTOS DO PRESTADOR
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prestador_treinamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid NOT NULL REFERENCES public.prestadores(id) ON DELETE CASCADE,
  curso text NOT NULL,
  data_conclusao date,
  validade date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prestador_treinamentos_prestador
  ON public.prestador_treinamentos (prestador_id);
CREATE INDEX IF NOT EXISTS idx_prestador_treinamentos_validade
  ON public.prestador_treinamentos (validade)
  WHERE validade IS NOT NULL;

DROP TRIGGER IF EXISTS trg_prestador_treinamentos_updated_at
  ON public.prestador_treinamentos;
CREATE TRIGGER trg_prestador_treinamentos_updated_at
  BEFORE UPDATE ON public.prestador_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.prestador_treinamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ptreino_select_tms" ON public.prestador_treinamentos;
CREATE POLICY "ptreino_select_tms" ON public.prestador_treinamentos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ptreino_select_own" ON public.prestador_treinamentos;
CREATE POLICY "ptreino_select_own" ON public.prestador_treinamentos
  FOR SELECT TO authenticated
  USING (
    prestador_id IN (
      SELECT p.id FROM public.prestadores p WHERE p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ptreino_insert_tms" ON public.prestador_treinamentos;
CREATE POLICY "ptreino_insert_tms" ON public.prestador_treinamentos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ptreino_update_tms" ON public.prestador_treinamentos;
CREATE POLICY "ptreino_update_tms" ON public.prestador_treinamentos
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "ptreino_delete_tms" ON public.prestador_treinamentos;
CREATE POLICY "ptreino_delete_tms" ON public.prestador_treinamentos
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestador_treinamentos TO authenticated;

NOTIFY pgrst, 'reload schema';
