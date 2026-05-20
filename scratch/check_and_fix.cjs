const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("--- Executando diagnósticos do Supabase ---");
  
  // 1. Verificar exec_sql RPC
  console.log("\n1. Testando RPC exec_sql...");
  const sql = `
    -- Criar tabela modelos_mensagens
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

    -- Habilitar RLS e criar política Allow All
    ALTER TABLE public.modelos_mensagens ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all for everyone on modelos_mensagens" ON public.modelos_mensagens;
    CREATE POLICY "Allow all for everyone on modelos_mensagens" ON public.modelos_mensagens FOR ALL USING (true) WITH CHECK (true);

    -- Criar tabela fluxo_recrutamento
    CREATE TABLE IF NOT EXISTS public.fluxo_recrutamento (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      texto TEXT NOT NULL,
      ordem INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Habilitar RLS e criar política Allow All
    ALTER TABLE public.fluxo_recrutamento ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all for everyone on fluxo_recrutamento" ON public.fluxo_recrutamento;
    CREATE POLICY "Allow all for everyone on fluxo_recrutamento" ON public.fluxo_recrutamento FOR ALL USING (true) WITH CHECK (true);

    -- Criar tabela biblioteca_documentos para metadados reais
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

    -- Habilitar RLS e criar política Allow All
    ALTER TABLE public.biblioteca_documentos ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all for everyone on biblioteca_documentos" ON public.biblioteca_documentos;
    CREATE POLICY "Allow all for everyone on biblioteca_documentos" ON public.biblioteca_documentos FOR ALL USING (true) WITH CHECK (true);

    -- 2. Garantir bucket 'biblioteca-global' no storage
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'biblioteca-global', 
      'biblioteca-global', 
      true, 
      52428800, 
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

    -- Políticas do bucket biblioteca-global
    DROP POLICY IF EXISTS "Public select on biblioteca-global" ON storage.objects;
    CREATE POLICY "Public select on biblioteca-global" ON storage.objects
    FOR SELECT USING (bucket_id = 'biblioteca-global');

    DROP POLICY IF EXISTS "Public insert on biblioteca-global" ON storage.objects;
    CREATE POLICY "Public insert on biblioteca-global" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'biblioteca-global');

    DROP POLICY IF EXISTS "Public update on biblioteca-global" ON storage.objects;
    CREATE POLICY "Public update on biblioteca-global" ON storage.objects
    FOR UPDATE USING (bucket_id = 'biblioteca-global');

    DROP POLICY IF EXISTS "Public delete on biblioteca-global" ON storage.objects;
    CREATE POLICY "Public delete on biblioteca-global" ON storage.objects
    FOR DELETE USING (bucket_id = 'biblioteca-global');
  `;

  const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', { sql });
  if (rpcError) {
    console.error("Erro ao executar SQL via RPC:", rpcError.message);
  } else {
    console.log("SQL executado com sucesso!", rpcData);
  }
}

main().catch(console.error);
