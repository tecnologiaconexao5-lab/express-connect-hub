-- FIN-FORN-02: Tabela fornecedores + FK em financeiro_pagar
-- Data: 2026-09-08
-- Missao: FIN-FORN-02 — Cadastro Real de Fornecedores

-- 1. Tabela fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tipo_pessoa text NOT NULL DEFAULT 'PJ'::text,
  razao_social text NOT NULL,
  nome_fantasia text,
  cpf_cnpj text NOT NULL,
  inscricao_estadual text,
  inscricao_municipal text,
  telefone text,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  chave_pix text,
  tipo_chave_pix text,
  banco text,
  agencia text,
  conta text,
  observacoes text,
  status text NOT NULL DEFAULT 'ativo'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fornecedores_pkey PRIMARY KEY (id),
  CONSTRAINT fornecedores_tipo_pessoa_check CHECK (tipo_pessoa IN ('PF', 'PJ')),
  CONSTRAINT fornecedores_status_check CHECK (status IN ('ativo', 'inativo'))
);

-- 2. Indices
CREATE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj ON public.fornecedores (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_status ON public.fornecedores (status);
CREATE INDEX IF NOT EXISTS idx_fornecedores_razao_social ON public.fornecedores (razao_social);

-- 3. Unique parcial: CPF/CNPJ duplicado so impede se ambos ativos
-- (permite historico: inativar um e cadastrar outro com mesmo doc)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj_unique
  ON public.fornecedores (cpf_cnpj) WHERE status = 'ativo';

-- 4. RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- anon bloqueado
REVOKE ALL ON public.fornecedores FROM anon;

-- SELECT: authenticated com guard tenant_usuarios
CREATE POLICY "fn_select_tms" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));

-- INSERT
CREATE POLICY "fn_insert_tms" ON public.fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));

-- UPDATE
CREATE POLICY "fn_update_tms" ON public.fornecedores
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));

-- DELETE
CREATE POLICY "fn_delete_tms" ON public.fornecedores
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM tenant_usuarios WHERE user_id = auth.uid()));

-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION public.fornecedores_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fornecedores_updated_at ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.fornecedores_updated_at();

-- 6. FK em financeiro_pagar: fornecedor_cadastro_id → fornecedores.id
-- NAO remove fornecedor_id legado (prestadores)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'financeiro_pagar'
    AND column_name = 'fornecedor_cadastro_id'
  ) THEN
    ALTER TABLE public.financeiro_pagar
      ADD COLUMN fornecedor_cadastro_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financeiro_pagar_fornecedor_cadastro_id_fkey'
  ) THEN
    ALTER TABLE public.financeiro_pagar
      ADD CONSTRAINT financeiro_pagar_fornecedor_cadastro_id_fkey
      FOREIGN KEY (fornecedor_cadastro_id)
      REFERENCES public.fornecedores(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Index na nova FK
CREATE INDEX IF NOT EXISTS idx_fp_fornecedor_cadastro_id
  ON public.financeiro_pagar (fornecedor_cadastro_id);
