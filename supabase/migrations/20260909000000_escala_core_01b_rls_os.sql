-- -----------------------------------------------------------------------------
-- MISSÃO: ESCALA-CORE-01B
-- CORREÇÃO RLS / VISIBILIDADE DAS OS
-- -----------------------------------------------------------------------------
-- Problema: A política atual (os_select_own) limita a visibilidade
-- a registros cujo 'cliente_id' é um UUID válido. Isso oculta ordens_servico 
-- do TMS caso cliente_id seja nulo ou contenha um nome (texto livre).
-- Solução: Adicionar política 'os_select_tms' para acesso de leitura
-- apenas para usuários do TMS autenticados do mesmo tenant.
-- -----------------------------------------------------------------------------

CREATE POLICY "os_select_tms" ON public.ordens_servico FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_usuarios tu
      WHERE tu.user_id = auth.uid()
        AND tu.tenant_id = ordens_servico.tenant_id
        AND tu.status = 'ativo'
    )
  );
