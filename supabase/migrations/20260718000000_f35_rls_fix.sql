-- Fix F35 RLS policies to allow anon key access (for service-based operations)
DROP POLICY IF EXISTS "Admin pode gerenciar autoridade" ON ia_autoridade_acoes;
DROP POLICY IF EXISTS "Admin pode gerenciar escalonamento" ON ia_escalonamento_config;

CREATE POLICY "Gerenciar autoridade" ON ia_autoridade_acoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Gerenciar escalonamento" ON ia_escalonamento_config FOR ALL USING (true) WITH CHECK (true);
