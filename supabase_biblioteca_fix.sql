-- ==========================================
-- SQL MIGRATION FOR BIBLIOTECA DE MANUAIS E ARQUIVOS
-- Execute este script no Supabase SQL Editor (Dashboard)
-- ==========================================

-- 1. Tabela de Mensagens Rápidas
CREATE TABLE IF NOT EXISTS public.modelos_mensagens (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  texto TEXT NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  cliente_documento TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS na tabela modelos_mensagens
ALTER TABLE public.modelos_mensagens ENABLE ROW LEVEL SECURITY;

-- Criar política Allow All para permitir CRUD completo pelo frontend (anon/authenticated)
DROP POLICY IF EXISTS "Allow all for everyone on modelos_mensagens" ON public.modelos_mensagens;
CREATE POLICY "Allow all for everyone on modelos_mensagens" 
ON public.modelos_mensagens 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);


-- 2. Tabela de Fluxo de Recrutamento
CREATE TABLE IF NOT EXISTS public.fluxo_recrutamento (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS na tabela fluxo_recrutamento
ALTER TABLE public.fluxo_recrutamento ENABLE ROW LEVEL SECURITY;

-- Criar política Allow All para fluxo_recrutamento
DROP POLICY IF EXISTS "Allow all for everyone on fluxo_recrutamento" ON public.fluxo_recrutamento;
CREATE POLICY "Allow all for everyone on fluxo_recrutamento" 
ON public.fluxo_recrutamento 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);


-- 3. Tabela de Metadados de Documentos Reais (Biblioteca)
CREATE TABLE IF NOT EXISTS public.biblioteca_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  caminho TEXT NOT NULL,
  url TEXT NOT NULL,
  tamanho TEXT NOT NULL,
  categoria TEXT NOT NULL,
  pasta TEXT NOT NULL, -- 'operacional', 'prestador', 'cliente', 'modelos'
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  prestador_id UUID REFERENCES public.prestadores(id) ON DELETE CASCADE,
  usuario_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS na tabela biblioteca_documentos
ALTER TABLE public.biblioteca_documentos ENABLE ROW LEVEL SECURITY;

-- Criar política Allow All para biblioteca_documentos
DROP POLICY IF EXISTS "Allow all for everyone on biblioteca_documentos" ON public.biblioteca_documentos;
CREATE POLICY "Allow all for everyone on biblioteca_documentos" 
ON public.biblioteca_documentos 
FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);


-- 4. Garantir que o bucket 'biblioteca-global' existe no storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'biblioteca-global', 
  'biblioteca-global', 
  true, 
  52428800, -- Limite de 50MB por arquivo
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
    'text/plain', 'text/xml', 'application/xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET 
  public = true, 
  file_size_limit = 52428800;


-- 5. Políticas de Segurança (RLS) para o bucket 'biblioteca-global' no storage.objects
-- Como o storage do Supabase possui RLS ativado, precisamos dessas políticas para ler/gravar arquivos.

DROP POLICY IF EXISTS "Public select on biblioteca-global" ON storage.objects;
CREATE POLICY "Public select on biblioteca-global" 
ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'biblioteca-global');

DROP POLICY IF EXISTS "Public insert on biblioteca-global" ON storage.objects;
CREATE POLICY "Public insert on biblioteca-global" 
ON storage.objects
FOR INSERT 
TO public
WITH CHECK (bucket_id = 'biblioteca-global');

DROP POLICY IF EXISTS "Public update on biblioteca-global" ON storage.objects;
CREATE POLICY "Public update on biblioteca-global" 
ON storage.objects
FOR UPDATE 
TO public
USING (bucket_id = 'biblioteca-global');

DROP POLICY IF EXISTS "Public delete on biblioteca-global" ON storage.objects;
CREATE POLICY "Public delete on biblioteca-global" 
ON storage.objects
FOR DELETE 
TO public
USING (bucket_id = 'biblioteca-global');
