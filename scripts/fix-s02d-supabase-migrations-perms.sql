-- ============================================================
-- FIN-SANE-02D — Fix supabase_migrations schema permissions
-- Data: 2026-09-15
-- Ambiente: LOCAL Docker APENAS
-- Producao: NAO EXECUTAR
-- ============================================================
-- Causa: Supabase CLI perde SET ROLE postgres durante
-- pipeline longo (100+ migrations). INSERT tracking
-- executa como supabase_admin sem permissao no schema.
--
-- Fix: Conceder ALL privileges a supabase_admin no
-- schema supabase_migrations, eliminando dependencia
-- do SET ROLE postgres.
-- ============================================================

-- 1. Garantir que o schema existe (idempotente)
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

-- 2. Owner continua postgres (superuser) — NAO alterar
ALTER SCHEMA supabase_migrations OWNER TO postgres;

-- 3. Conceder USAGE + CREATE a supabase_admin
GRANT ALL ON SCHEMA supabase_migrations TO postgres;
GRANT ALL ON SCHEMA supabase_migrations TO supabase_admin;

-- 4. Conceder permisssoes em tabelas existentes
GRANT ALL ON ALL TABLES IN SCHEMA supabase_migrations TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA supabase_migrations TO supabase_admin;

-- 5. Conceder permisssoes em sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA supabase_migrations TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA supabase_migrations TO supabase_admin;

-- 6. Garantir que future objects herdam permissoes
ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_migrations
  GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_migrations
  GRANT ALL ON TABLES TO supabase_admin;

-- 7. Verificacao (deve retornar postgres + supabase_admin com ALL)
-- SELECT grantee, privilege_type
-- FROM information_schema.schema_privileges
-- WHERE schema_name = 'supabase_migrations';
