-- Correção 8: Motor de Filas e Realtime

-- 1. Ajustes na tabela automacoes_fila
ALTER TABLE public.automacoes_fila
  ADD COLUMN IF NOT EXISTS executar_em timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS prioridade varchar(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ultimo_erro text;

-- Sincronizar dados antigos (agendado_para -> executar_em, erro -> ultimo_erro)
UPDATE public.automacoes_fila SET executar_em = agendado_para WHERE executar_em IS NULL AND agendado_para IS NOT NULL;
UPDATE public.automacoes_fila SET ultimo_erro = erro WHERE ultimo_erro IS NULL AND erro IS NOT NULL;

-- 2. Função RPC Segura para o n8n pegar as filas e trancar (Lock)
-- O n8n deve chamar: supabase.rpc('pull_automacoes_pendentes', { limit_num: 20 })
CREATE OR REPLACE FUNCTION pull_automacoes_pendentes(limit_num INT DEFAULT 20)
RETURNS SETOF public.automacoes_fila
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH selecionados AS (
    SELECT id
    FROM public.automacoes_fila
    WHERE status = 'pendente'
      AND executar_em <= now()
      AND tentativas < max_tentativas
    ORDER BY 
      CASE prioridade 
        WHEN 'critica' THEN 1 
        WHEN 'alta' THEN 2 
        WHEN 'normal' THEN 3 
        WHEN 'baixa' THEN 4 
        ELSE 5 
      END ASC,
      executar_em ASC
    LIMIT limit_num
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.automacoes_fila f
  SET status = 'processando'
  FROM selecionados s
  WHERE f.id = s.id
  RETURNING f.*;
END;
$$;

-- 3. Habilitar Realtime
-- Para que o frontend React consiga ouvir alterações sem refresh
alter publication supabase_realtime add table public.automacoes_fila;
alter publication supabase_realtime add table public.automacoes_regras;
alter publication supabase_realtime add table public.ia_logs;
