-- ================================================================
-- TABELA: Central de Integrações
-- Criada em: 2026-04-29
-- ================================================================
CREATE TABLE IF NOT EXISTS central_integracoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,
  ambiente text default 'local',
  status text default 'nao_configurado',
  url_publica text,
  webhook_url text,
  observacoes text,
  ultimo_teste_em timestamptz,
  ultimo_erro text,
  ativo boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE central_integracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_central_integracoes" ON central_integracoes FOR ALL USING (true) WITH CHECK (true);
