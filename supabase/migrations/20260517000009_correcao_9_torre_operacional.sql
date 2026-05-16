-- Correção 9: Escalonamento Humano e Torre Operacional

CREATE TABLE IF NOT EXISTS public.escalonamentos_humanos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    origem varchar(100) DEFAULT 'ia',
    modulo varchar(100),
    referencia_id uuid, -- ID opcional do cliente, log ou OS
    tipo varchar(100),
    prioridade varchar(50) DEFAULT 'alta',
    status varchar(50) DEFAULT 'aberto',
    titulo varchar(255),
    descricao text,
    mensagem_original text,
    intencao varchar(100),
    confianca numeric,
    payload jsonb DEFAULT '{}'::jsonb,
    operador_responsavel varchar(100),
    assumido_em timestamp with time zone,
    resolvido_em timestamp with time zone,
    observacao_resolucao text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS e Permissões padrão
ALTER TABLE public.escalonamentos_humanos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo em escalonamentos_humanos" ON public.escalonamentos_humanos;
CREATE POLICY "Permitir tudo em escalonamentos_humanos" ON public.escalonamentos_humanos FOR ALL USING (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.escalonamentos_humanos;

-- Trigger para capturar ia_logs com precisa_humano = true
CREATE OR REPLACE FUNCTION trg_ia_logs_escalonamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.precisa_humano = true THEN
    -- Evitar duplicidade de tickets em aberto para o mesmo prompt num intervalo curto (opcional), ou só inserir
    -- Vamos só inserir com a referência
    INSERT INTO public.escalonamentos_humanos (
      origem, modulo, referencia_id, tipo, titulo, descricao, mensagem_original,
      intencao, confianca, prioridade
    ) VALUES (
      'ia_logs', 
      COALESCE(NEW.modulo, 'central_inteligente'), 
      NEW.id, -- referencia o ID do log
      'analise_ia',
      'Escalonamento IA - ' || COALESCE(NEW.intencao, 'Urgência'),
      'A IA marcou precisa_humano = true e o evento exige atenção.',
      NEW.entrada, -- Mensagem original que engatilhou a falha/urgência
      NEW.intencao,
      NEW.confianca,
      'critica'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ia_logs_escalonamento_insert ON public.ia_logs;
CREATE TRIGGER trg_ia_logs_escalonamento_insert
AFTER INSERT ON public.ia_logs
FOR EACH ROW
EXECUTE FUNCTION trg_ia_logs_escalonamento();
