-- =====================================================
-- F25B: CENTRAL DE ROBÔS — EXPANSÃO DE CAMPOS E SEGURANÇA
-- =====================================================
-- Adiciona campos de configuração por robô
-- Adiciona campos de bloqueio/segurança em comunicacoes_mensagens
-- =====================================================

-- 1. EXPANDIR automacoes_robos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'canal_principal') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN canal_principal TEXT DEFAULT 'interno';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'nivel_autonomia') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN nivel_autonomia TEXT DEFAULT 'manual' CHECK (nivel_autonomia IN ('manual','assistido','automatico_seguro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'responsavel_humano_id') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN responsavel_humano_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'modo_atual') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN modo_atual TEXT DEFAULT 'seguro' CHECK (modo_atual IN ('seguro','homologacao','producao_assistida','producao'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'setor_responsavel') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN setor_responsavel TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'permite_envio_externo') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN permite_envio_externo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'exige_aprovacao_humana') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN exige_aprovacao_humana BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'limite_mensagens_dia') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN limite_mensagens_dia INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'horario_inicio') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN horario_inicio TIME;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'horario_fim') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN horario_fim TIME;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'tom_conversa') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN tom_conversa TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'automacoes_robos' AND column_name = 'instrucoes_resumo') THEN
    ALTER TABLE public.automacoes_robos ADD COLUMN instrucoes_resumo TEXT;
  END IF;
END $$;

-- 2. ATUALIZAR ROBÔS EXISTENTES COM VALORES PADRÃO
UPDATE public.automacoes_robos
SET
  modo_atual = 'seguro',
  permite_envio_externo = false,
  exige_aprovacao_humana = true,
  nivel_autonomia = modo,
  canal_principal = CASE
    WHEN setor IN ('Cliente','Prestador/Motorista') THEN 'whatsapp'
    ELSE 'interno'
  END
WHERE modo_atual IS NULL;

-- 3. GARANTIR QUE MODO SEGURO É PADRÃO PARA NOVOS REGISTROS
ALTER TABLE public.automacoes_robos
  ALTER COLUMN modo_atual SET DEFAULT 'seguro',
  ALTER COLUMN permite_envio_externo SET DEFAULT false,
  ALTER COLUMN exige_aprovacao_humana SET DEFAULT true;

-- 4. EXPANDIR comunicacoes_mensagens PARA BLOQUEIO E RASTREAMENTO
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'comunicacoes_mensagens' AND column_name = 'modo_homologacao') THEN
    ALTER TABLE public.comunicacoes_mensagens ADD COLUMN modo_homologacao BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'comunicacoes_mensagens' AND column_name = 'motivo_bloqueio') THEN
    ALTER TABLE public.comunicacoes_mensagens ADD COLUMN motivo_bloqueio TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'comunicacoes_mensagens' AND column_name = 'bloqueado_por_regra') THEN
    ALTER TABLE public.comunicacoes_mensagens ADD COLUMN bloqueado_por_regra TEXT;
  END IF;
END $$;

-- 5. ADICIONAR NOVOS STATUS PERMITIDOS EM comunicacoes_mensagens
-- (a constraint CHECK já existe, então precisamos dropar e recriar)
DO $$ BEGIN
  ALTER TABLE public.comunicacoes_mensagens DROP CONSTRAINT IF EXISTS comunicacoes_mensagens_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.comunicacoes_mensagens
  ADD CONSTRAINT comunicacoes_mensagens_status_check
  CHECK (status IN (
    'rascunho','simulado','enviado','erro',
    'enviado_homologacao','erro_homologacao',
    'bloqueado','aguardando_aprovacao'
  ));

-- 6. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_modo_atual ON public.automacoes_robos(modo_atual);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_permite_envio ON public.automacoes_robos(permite_envio_externo);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_exige_aprovacao ON public.automacoes_robos(exige_aprovacao_humana);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_mensagens_modo_homolog ON public.comunicacoes_mensagens(modo_homologacao);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_mensagens_motivo_bloqueio ON public.comunicacoes_mensagens(motivo_bloqueio);

-- 7. PERMISSÕES
GRANT ALL ON public.automacoes_robos TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
