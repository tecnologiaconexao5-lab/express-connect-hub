-- Fundacao 03: Tabela certificados_fiscais (certificados digitais A1 por emitente)
-- Idempotente: CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS

CREATE TABLE IF NOT EXISTS public.certificados_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  emitente_id uuid NOT NULL REFERENCES public.configuracoes_fiscais(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL,

  tipo text DEFAULT 'A1',
  validade date,
  status text DEFAULT 'pendente',
  ativo boolean DEFAULT true,

  criado_por uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_cert_emitente ON public.certificados_fiscais(emitente_id);
CREATE INDEX IF NOT EXISTS idx_cert_ativo ON public.certificados_fiscais(ativo);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_cert_updated_at ON public.certificados_fiscais;
CREATE TRIGGER trg_cert_updated_at
  BEFORE UPDATE ON public.certificados_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.certificados_fiscais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for authenticated" ON public.certificados_fiscais;
CREATE POLICY "Enable select for authenticated" ON public.certificados_fiscais
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.certificados_fiscais;
CREATE POLICY "Enable insert for authenticated" ON public.certificados_fiscais
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated" ON public.certificados_fiscais;
CREATE POLICY "Enable update for authenticated" ON public.certificados_fiscais
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Bucket Storage privado para certificados (se storage schema acessivel)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificados-fiscais', 'certificados-fiscais', false, 10485760, ARRAY['application/x-pkcs12', 'application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

-- Comentarios
COMMENT ON TABLE public.certificados_fiscais IS 'Certificados digitais A1 por emitente fiscal. A senha do certificado nunca e armazenada nesta tabela.';
COMMENT ON COLUMN public.certificados_fiscais.tipo IS 'A1 (arquivo) ou A3 (token USB/cartao)';
COMMENT ON COLUMN public.certificados_fiscais.status IS 'pendente / enviado / ativo / expirado / revogado';
