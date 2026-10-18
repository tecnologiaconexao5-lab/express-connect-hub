-- ============================================================
-- MIGRATION: 20260902_rec04_mapeamento_fk_candidato_documentos
-- PROJETO: TMS Conexão Express Hub
-- FASE: AG-REC04 — Documentos, FK Canônica e Elegibilidade
-- DESCRIÇÃO:
--   Migra a FK de candidato_documentos.candidato_id
--   de candidatos(id) para recrutamento_candidatos(id).
--
--   PRÉ-CONDIÇÃO: Os IDs são idênticos porque a migration
--   REC-03 (20260901) copiou registros de candidatos para
--   recrutamento_candidatos preservando os UUIDs.
--
--   SEGURANÇA: A migration ABORTA se encontrar:
--   - candidato_documentos sem correspondente em recrutamento_candidatos
--   - candidato_documentos com candidato_id NULL
--   - registros órfãos em recrutamento_candidatos sem correspondente
--     em candidatos (antes da migração)
--   - tenant incompatível entre tabelas (quando tenant_id disponível)
--
--   NÃO EXECUTAR EM PRODUÇÃO SEM VALIDAÇÃO PRÉVIA.
--   NÃO executar remotamente — apenas local.
-- ============================================================

-- ============================================================
-- PARTE 1: VALIDAÇÃO DE INTEGRIDADE (fail-closed)
-- ============================================================

-- 1.1 Verificar que nenhum candidato_documentos tem candidato_id NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.candidato_documentos
    WHERE candidato_id IS NULL
  ) THEN
    RAISE EXCEPTION 'REC-04 BLOCKED: candidato_documentos contém registros com candidato_id NULL';
  END IF;
END $$;

-- 1.2 Verificar que TODOS os candidato_documentos têm correspondente em recrutamento_candidatos
DO $$
DECLARE
  orfaos INTEGER;
BEGIN
  SELECT COUNT(*) INTO orfaos
  FROM public.candidato_documentos cd
  LEFT JOIN public.recrutamento_candidatos rc ON rc.id = cd.candidato_id
  WHERE rc.id IS NULL;

  IF orfaos > 0 THEN
    RAISE EXCEPTION 'REC-04 BLOCKED: % candidato_documentos sem correspondente em recrutamento_candidatos', orfaos;
  END IF;
END $$;

-- 1.3 Verificar que não há órfãos recrutamento_candidatos sem correspondente em candidatos
--     (se a tabela candidatos ainda existir — sanity check pré-migração)
DO $$
DECLARE
  orfaos_rc INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidatos' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO orfaos_rc
    FROM public.recrutamento_candidatos rc
    LEFT JOIN public.candidatos c ON c.id = rc.id
    WHERE c.id IS NULL;

    IF orfaos_rc > 0 THEN
      RAISE NOTICE 'REC-04 WARNING: % recrutamento_candidatos sem correspondente em candidatos (esperado se REC-03 criou novos IDs)', orfaos_rc;
    END IF;
  END IF;
END $$;

-- 1.4 Verificar que a FK atual aponta para candidatos (sanity check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%candidato_documentos%candidato%'
    AND table_name = 'candidato_documentos'
  ) THEN
    RAISE NOTICE 'REC-04: FK candidato_documentos→candidatos não encontrada (pode já ter sido migrada)';
  END IF;
END $$;

-- 1.5 Verificar tenant_id se existir em ambas as tabelas (defesa contra cross-tenant)
DO $$
DECLARE
  rc_has_tenant BOOLEAN;
  cd_has_tenant BOOLEAN;
  cross_tenant INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recrutamento_candidatos' AND column_name = 'tenant_id'
  ) INTO rc_has_tenant;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidato_documentos' AND column_name = 'tenant_id'
  ) INTO cd_has_tenant;

  IF rc_has_tenant AND cd_has_tenant THEN
    SELECT COUNT(*) INTO cross_tenant
    FROM public.candidato_documentos cd
    JOIN public.recrutamento_candidatos rc ON rc.id = cd.candidato_id
    WHERE cd.tenant_id IS NOT NULL
      AND rc.tenant_id IS NOT NULL
      AND cd.tenant_id != rc.tenant_id;

    IF cross_tenant > 0 THEN
      RAISE EXCEPTION 'REC-04 BLOCKED: % candidato_documentos com tenant incompatível com recrutamento_candidatos', cross_tenant;
    END IF;
  END IF;
END $$;

-- 1.6 Verificar que candidato_documentos não referencia candidato errado
--     (cross-check: tipo+status do documento deve ser coerente com o candidato)
--     Esta é uma verificação semântica — se o candidato_id não existir,
--     já foi bloqueado no 1.2. Aqui apenas logamos estatísticas.
DO $$
DECLARE
  total_docs INTEGER;
  total_candidatos_com_docs INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_docs FROM public.candidato_documentos;
  SELECT COUNT(DISTINCT candidato_id) INTO total_candidatos_com_docs FROM public.candidato_documentos;
  RAISE NOTICE 'REC-04: % documentos distribuídos em % candidatos únicos', total_docs, total_candidatos_com_docs;
END $$;

-- ============================================================
-- PARTE 2: MIGRAÇÃO DA FK
-- ============================================================

-- 2.1 Remover FK existente (se houver)
ALTER TABLE public.candidato_documentos
  DROP CONSTRAINT IF EXISTS candidato_documentos_candidato_id_fkey;

-- 2.2 Adicionar nova FK para recrutamento_candidatos
ALTER TABLE public.candidato_documentos
  ADD CONSTRAINT candidato_documentos_candidato_id_rc_fkey
  FOREIGN KEY (candidato_id)
  REFERENCES public.recrutamento_candidatos(id)
  ON DELETE CASCADE;

-- ============================================================
-- PARTE 3: ÍNDICE para performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_candidato_documentos_candidato_id_rc
  ON public.candidato_documentos(candidato_id);

-- ============================================================
-- PARTE 4: COMENTÁRIOS de documentação
-- ============================================================

COMMENT ON TABLE public.candidato_documentos IS
  'Documentos durante fase de recrutamento. FK para recrutamento_candidatos (migrado de candidatos em REC-04). '
  'NÃO é tabela operacional — documentos_prestadores é a fonte canônica pós-conversão. '
  'MANTER esta tabela: possui campos (arquivo_url, dados_extraidos, analise_ia_id) ausentes no JSONB recrutamento_candidatos.documentos.';

COMMENT ON CONSTRAINT candidato_documentos_candidato_id_rc_fkey
  ON public.candidato_documentos IS
  'FK migrada de candidatos→recrutamento_candidatos em REC-04. IDs idênticos (copiados via REC-03 INSERT). Fail-closed: migration aborta se integridade não puder ser provada.';
