-- Phantom tables stub: tables referenced by later migrations but never CREATE TABLE'd
-- These must exist before the migrations that reference them

-- 1. ia_tarefas_automaticas — referenced by central_ia_dashboard_view in 20260621000000
CREATE TABLE IF NOT EXISTS public.ia_tarefas_automaticas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL DEFAULT '',
  tipo_tarefa text NOT NULL DEFAULT 'geral',
  status text NOT NULL DEFAULT 'pendente',
  executado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  setor_id uuid
);

-- 2. ia_aprovacoes_humanas — referenced by central_ia_dashboard_view in 20260621000000
CREATE TABLE IF NOT EXISTS public.ia_aprovacoes_humanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz NOT NULL DEFAULT now(),
  setor_id uuid
);

-- 3. composicao_financeira_os — referenced by enterprise_hardening, missao02, missao021, etc.
CREATE TABLE IF NOT EXISTS public.composicao_financeira_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id text,
  cliente_id uuid,
  prestador_id uuid,
  valor_cliente numeric DEFAULT 0,
  valor_prestador numeric DEFAULT 0,
  imposto_percentual numeric DEFAULT 0,
  imposto_valor numeric DEFAULT 0,
  seguro_valor numeric DEFAULT 0,
  pedagio_valor numeric DEFAULT 0,
  outros_custos numeric DEFAULT 0,
  combustivel_valor numeric DEFAULT 0,
  ajudante_valor numeric DEFAULT 0,
  adicional_valor numeric DEFAULT 0,
  desconto_valor numeric DEFAULT 0,
  margem_bruta numeric DEFAULT 0,
  margem_liquida numeric DEFAULT 0,
  percentual_margem_bruta numeric DEFAULT 0,
  percentual_margem_liquida numeric DEFAULT 0,
  origem_calculo text DEFAULT 'trigger',
  tenant_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
