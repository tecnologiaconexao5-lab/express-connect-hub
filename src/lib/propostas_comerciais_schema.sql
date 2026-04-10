-- TABELA: biblioteca_propostas (Propostas Comerciais e Modelos Base)
CREATE TABLE IF NOT EXISTS public.biblioteca_propostas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo varchar NOT NULL,
  subtitulo varchar,
  tipo varchar NOT NULL DEFAULT 'personalizada', -- 'modelo' | 'personalizada'
  cliente_id uuid, -- fk para tabela_clientes, null se tipo = 'modelo'
  segmento varchar,
  tipo_servico varchar,
  introducao text,
  escopo text,
  condicoes text,
  observacoes text,
  status varchar DEFAULT 'rascunho',
  favorita boolean DEFAULT false,
  versao integer DEFAULT 1,
  modelo_origem_id uuid REFERENCES public.biblioteca_propostas(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
