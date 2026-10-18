-- =====================================================
-- MISSÃO 53 — PERFIL DO CLIENTE (Portal Cliente)
-- =====================================================
-- 1. Adiciona colunas de endereço, fiscais e preferências
-- 2. Cria view segura portal_cliente_perfil_view
-- 3. Adiciona RLS policy para clientes via auth.uid()
-- =====================================================

-- 1. NOVAS COLUNAS EM clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS logradouro text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inscricao_municipal text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS optante_simples boolean DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_frete_preferencial text DEFAULT 'rodoviario';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS veiculo_preferencial text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS horario_entrega_preferencial text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS notificar_email boolean DEFAULT true;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS notificar_whatsapp boolean DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS notificar_mudanca_status boolean DEFAULT true;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS notificar_comprovante boolean DEFAULT true;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- 2. VIEW SEGURA — Perfil do Cliente
CREATE OR REPLACE VIEW public.portal_cliente_perfil_view AS
SELECT
  c.id, c.razao_social, c.nome_fantasia, c.cnpj, c.ie, c.inscricao_municipal,
  c.segmento, c.porte, c.status, c.logo,
  c.cep, c.logradouro, c.numero, c.bairro, c.complemento, c.cidade, c.uf,
  c.contato_principal, c.telefone, c.whatsapp, c.email, c.site,
  c.responsavel_operacional, c.responsavel_financeiro, c.responsavel_comercial,
  c.regime_tributario, c.optante_simples, c.aliquota_iss, c.cnae, c.cfop_padrao,
  c.tipo_frete_preferencial, c.veiculo_preferencial, c.horario_entrega_preferencial,
  c.exige_agendamento, c.exige_sla,
  c.notificar_email, c.notificar_whatsapp, c.notificar_mudanca_status, c.notificar_comprovante,
  c.created_at, c.updated_at
FROM public.clientes c
WHERE c.id = public.obter_cliente_id_do_usuario();

GRANT SELECT ON public.portal_cliente_perfil_view TO anon, authenticated;

-- 3. RLS POLICY — Cliente pode SELECT/UPDATE seu próprio registro
DROP POLICY IF EXISTS "cliente_select_own" ON public.clientes;
CREATE POLICY "cliente_select_own" ON public.clientes
  FOR SELECT
  USING (id = public.obter_cliente_id_do_usuario());

DROP POLICY IF EXISTS "cliente_update_own" ON public.clientes;
CREATE POLICY "cliente_update_own" ON public.clientes
  FOR UPDATE
  USING (id = public.obter_cliente_id_do_usuario())
  WITH CHECK (id = public.obter_cliente_id_do_usuario());

-- 4. FUNÇÃO — Obter cliente_id do usuário logado (já existe, mas garantimos)
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

-- 5. FUNÇÃO — Listar dados de usuários vinculados (sem expor auth.users)
CREATE OR REPLACE FUNCTION public.listar_usuarios_vinculados(p_cliente_id uuid)
RETURNS TABLE (
  id uuid,
  auth_user_id uuid,
  email text,
  ativo boolean,
  created_at timestamptz
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT
    uc.id,
    uc.auth_user_id,
    au.email,
    uc.ativo,
    uc.created_at
  FROM public.usuarios_cliente uc
  JOIN auth.users au ON au.id = uc.auth_user_id
  WHERE uc.cliente_id = p_cliente_id AND uc.ativo = true;
$$;

GRANT EXECUTE ON FUNCTION public.listar_usuarios_vinculados(uuid) TO anon, authenticated;
