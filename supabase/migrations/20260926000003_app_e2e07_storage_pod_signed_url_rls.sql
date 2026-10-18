-- ═══════════════════════════════════════════════════════════════════════════════
-- APP-E2E-07 — F3: STORAGE PRIVADO + SIGNED URL SEGURA (POD) + RLS UPDATE
--
-- Problema (APP-E2E-06 / GAP-F3-01):
--   A mídia POD é gravada no bucket PRIVADO `driver-evidence` mas referenciada
--   como se fosse pública (/object/public/driver-evidence/...) → HTTP 400.
--   O TMS (DossieEntregaSheet) usa <img src> cru → comprovante não abre.
--
-- Solução (SEM tornar o bucket público):
--   1) Policy storage.objects de SELECT no bucket `driver-evidence` para STAFF
--      do TMS (tenant_usuarios) dono do tenant da alocação do POD. Assim o
--      cliente Supabase autenticado do TMS pode gerar createSignedUrl (TTL curto).
--   2) Policy UPDATE em public.delivery_proofs restrita ao dono (GAP-F3-02),
--      permitindo o UPSERT(onConflict=id) usado pelo repositório do APP.
--
-- driver-evidence.public PERMANECE FALSE. Nenhuma URL pública é criada.
-- Escopo TMS: apenas arquivos de POD (pasta [2]='pod'), da alocação do path
-- ([3]=operationId) e do prestador dono do prefixo ([1]=prestadores.auth_user_id),
-- com tenant compatível (ou super_admin).
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Leitura segura pelo TMS de mídias POD no bucket privado driver-evidence
DROP POLICY IF EXISTS driver_evidence_select_tms ON storage.objects;
CREATE POLICY driver_evidence_select_tms ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'driver-evidence'
  AND (storage.foldername(name))[2] = 'pod'
  AND EXISTS (
    SELECT 1
    FROM public.alocacoes_escala ae
    JOIN public.prestadores p ON p.id = ae.prestador_id
    JOIN public.tenant_usuarios tu ON tu.user_id = auth.uid()
    WHERE p.auth_user_id::text = (storage.foldername(name))[1]
      AND ae.id::text = (storage.foldername(name))[3]
      AND (tu.papel = 'super_admin' OR tu.tenant_id = ae.tenant_id)
  )
);

-- 2) GAP-F3-02: UPDATE do próprio POD (habilita UPSERT onConflict=id do repo)
--    `authenticated` tinha SELECT/INSERT mas NÃO UPDATE na tabela.
GRANT UPDATE ON public.delivery_proofs TO authenticated;

DROP POLICY IF EXISTS dp_update_own ON public.delivery_proofs;
CREATE POLICY dp_update_own ON public.delivery_proofs
FOR UPDATE TO authenticated
USING (driver_id = (auth.uid())::text)
WITH CHECK (driver_id = (auth.uid())::text);
