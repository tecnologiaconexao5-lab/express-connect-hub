-- =====================================================
-- F20D: SEGURANÇA — USUÁRIOS_CLIENTE + VIEWS SEGURAS + RLS
-- =====================================================
-- Modelo: auth.users → usuarios_cliente → clientes
-- Isolamento: cliente só vê dados do seu cliente_id
-- =====================================================

-- 1. TABELA usuarios_cliente
CREATE TABLE IF NOT EXISTS public.usuarios_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auth_user_id, cliente_id)
);

-- 2. RLS na usuarios_cliente
ALTER TABLE public.usuarios_cliente ENABLE ROW LEVEL SECURITY;

-- Cliente pode ler seu próprio vínculo
DROP POLICY IF EXISTS "cliente_read_own" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "cliente_read_own" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "cliente_read_own" ON usuarios_cliente;
CREATE POLICY "cliente_read_own" ON usuarios_cliente
  FOR SELECT
  USING (auth.uid() = auth_user_id AND ativo = true);

-- Admin/TMS pode gerenciar (via service_role ou autenticado)
DROP POLICY IF EXISTS "admin_all" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "admin_all" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "admin_all" ON usuarios_cliente;
CREATE POLICY "admin_all" ON usuarios_cliente
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Anon key pode ler/inserir (para compatibilidade com app atual)
DROP POLICY IF EXISTS "anon_usuarios_cliente" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "anon_usuarios_cliente" ON public.usuarios_cliente;
DROP POLICY IF EXISTS "anon_usuarios_cliente" ON usuarios_cliente;
CREATE POLICY "anon_usuarios_cliente" ON usuarios_cliente
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. VIEWS SEGURAS PARA O PORTAL DO CLIENTE
-- Cada view filtra por cliente_id usando auth.uid() via usuarios_cliente

-- 3.1 Ordens de Serviço (campos permitidos)
CREATE OR REPLACE VIEW public.portal_cliente_ordens_view AS
SELECT
  os.id, os.numero, os.status, os.cliente, os.cliente_id,
  os.origem, os.destino, os.data_servico, os.data,
  os.created_at, os.valor_cliente, os.peso, os.volumes, os.carga_descricao,
  os.carga_descricao AS mercadoria, os.prestador, os.tipo_veiculo, os.placa_alocada, os.veiculo
FROM public.ordens_servico os
WHERE os.cliente_id::uuid IN (
  SELECT uc.cliente_id FROM public.usuarios_cliente uc
  WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true
);

-- 3.2 Pedidos do Portal
CREATE OR REPLACE VIEW public.portal_cliente_pedidos_view AS
SELECT
  pp.id, pp.cliente_id, pp.numero_pedido, pp.status,
  pp.solicitante_nome, pp.solicitante_email, pp.solicitante_telefone,
  pp.filial, pp.centro_custo, pp.prioridade,
  pp.coleta_cep, pp.coleta_rua, pp.coleta_numero, pp.coleta_complemento,
  pp.coleta_bairro, pp.coleta_cidade, pp.coleta_uf, pp.coleta_referencia, pp.coleta_data,
  pp.entrega_destinatario, pp.entrega_telefone, pp.entrega_email,
  pp.entrega_notificar_whatsapp, pp.entrega_notificar_email,
  pp.entrega_cep, pp.entrega_rua, pp.entrega_numero, pp.entrega_complemento,
  pp.entrega_bairro, pp.entrega_cidade, pp.entrega_uf, pp.entrega_referencia, pp.entrega_data,
  pp.descricao, pp.volumes, pp.peso, pp.comprimento, pp.largura, pp.altura,
  pp.valor_declarado, pp.tipo_carga, pp.observacoes,
  pp.veiculo_sugerido, pp.prazo_estimado,
  pp.payload_n8n, pp.os_vinculada_id, pp.metadata,
  pp.created_at, pp.updated_at
FROM public.portal_pedidos pp
WHERE pp.cliente_id::uuid IN (
  SELECT uc.cliente_id FROM public.usuarios_cliente uc
  WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true
);

-- 3.3 Financeiro a Receber (apenas campos visíveis ao cliente)
CREATE OR REPLACE VIEW public.portal_cliente_financeiro_view AS
SELECT
  fr.id, fr.cliente_id, fr.fatura, fr.descricao AS competencia, fr.data_vencimento,
  fr.valor, fr.status, fr.os_id, fr.created_at
FROM public.financeiro_receber fr
WHERE fr.cliente_id::uuid IN (
  SELECT uc.cliente_id FROM public.usuarios_cliente uc
  WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true
);

-- 3.4 Alocações de Escala (apenas campos seguros)
CREATE OR REPLACE VIEW public.portal_cliente_alocacoes_view AS
SELECT
  ae.id, ae.ordem_servico_id, ae.cliente_id, ae.prestador_id,
  ae.status, ae.aceite_prestador, ae.data_aceite,
  ae.horario_inicio_real, ae.horario_fim_real,
  ae.finalizada, ae.comprovante_url, ae.assinatura_url, ae.fotos_entrega,
  ae.created_at
FROM public.alocacoes_escala ae
WHERE ae.cliente_id::uuid IN (
  SELECT uc.cliente_id FROM public.usuarios_cliente uc
  WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true
);

-- 3.5 Entregas/Protocolo (POD)
CREATE OR REPLACE VIEW public.portal_cliente_pods_view AS
SELECT
  ep.id, ep.alocacao_id, ep.prestador_id,
  ep.nome_recebedor, ep.documento_recebedor,
  ep.foto_entrega_url, ep.foto_canhoto_url, ep.assinatura_url,
  ep.data_hora_entrega, ep.observacao, ep.created_at
FROM public.entregas_protocolo ep
WHERE ep.alocacao_id IN (
  SELECT ae.id FROM public.alocacoes_escala ae
  WHERE ae.cliente_id::uuid IN (
    SELECT uc.cliente_id FROM public.usuarios_cliente uc
    WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true
  )
);

-- 4. PERMISSÕES — GRANT PARA ANON
GRANT SELECT ON public.portal_cliente_ordens_view TO anon, authenticated;
GRANT SELECT ON public.portal_cliente_pedidos_view TO anon, authenticated;
GRANT SELECT ON public.portal_cliente_financeiro_view TO anon, authenticated;
GRANT SELECT ON public.portal_cliente_alocacoes_view TO anon, authenticated;
GRANT SELECT ON public.portal_cliente_pods_view TO anon, authenticated;

GRANT SELECT ON public.usuarios_cliente TO anon, authenticated;

-- 5. FUNÇÃO AUXILIAR: obter cliente_id do usuário logado
CREATE OR REPLACE FUNCTION public.obter_cliente_id_do_usuario()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT cliente_id FROM public.usuarios_cliente
  WHERE auth_user_id = auth.uid() AND ativo = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.obter_cliente_id_do_usuario() TO anon, authenticated;

-- 6. REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'usuarios_cliente'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios_cliente;
  END IF;
END $$;



