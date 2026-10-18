-- ============================================================================
-- BASELINE ESTRUTURAL LIVE — PRODUÇÃO CONEXAO EXPRESS
-- Project Ref: uwrvzsjtpgaifkktpepn
-- Extração realizada em: 2026-09-20T20:14:50.408Z
-- MISSÃO: ENV-QA-02-BASELINE-PACKAGE
-- CONTEÚDO: DDL ESTRUTURAL COMPLETO (ZERO DADOS REAIS / ZERO INSERTS)
-- ============================================================================

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

-- ============================================================================
-- 1. EXTENSÕES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- ============================================================================
-- 2. SCHEMAS
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS public;

-- ============================================================================
-- 3. ENUMS E DOMAIN TYPES
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE public."acao_decisao_diretor" AS ENUM ('pause', 'resume', 'repriorizar', 'redistribuir', 'escalar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."canal_integracao" AS ENUM ('whatsapp', 'email', 'zoho_mail', 'crm', 'leads', 'google_ads', 'meta_ads', 'api_externa', 'webhook');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."categoria_ferramenta" AS ENUM ('COMUNICACAO', 'MARKETING', 'FINANCEIRO', 'OPERACIONAL', 'COMERCIAL', 'DOCUMENTOS', 'AUTOMACAO_WEB', 'INTEGRACOES', 'RECRUTAMENTO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."categoria_integracao" AS ENUM ('comunicacao', 'comercial', 'marketing', 'operacao');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."dia_semana" AS ENUM ('domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."escopo_memoria" AS ENUM ('compartilhada', 'privada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."impacto_decisao_diretor" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."modo_conector" AS ENUM ('HOMOLOGACAO', 'PRODUCAO_ASSISTIDA', 'PRODUCAO', 'PRODUCAO_AUTONOMA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."modo_diretor_virtual" AS ENUM ('auto', 'semi_auto', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."nivel_autonomia_ferramenta" AS ENUM ('CONSULTA', 'EXECUTAR_COM_APROVACAO', 'EXECUTAR_AUTONOMO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."nivel_risco" AS ENUM ('baixo', 'medio', 'alto', 'critico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."patio_alerta_tipo" AS ENUM ('sla_excedido', 'doca_ocupada', 'carregamento_parado', 'documentacao_pendente', 'no_show', 'operacao_critica', 'fila_longa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."patio_criterio_fila" AS ENUM ('ordem_chegada', 'horario_agendado', 'prioridade', 'sla', 'regiao', 'tipo_veiculo', 'tipo_carga', 'cliente_vip', 'rodizio_prestador', 'rodizio_regiao', 'doca_disponivel', 'urgencia');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."patio_doca_status" AS ENUM ('disponivel', 'ocupada', 'bloqueada', 'manutencao', 'reservada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."patio_status" AS ENUM ('previsto', 'chegou_ao_patio', 'aguardando_checkin', 'checkin_realizado', 'aguardando_liberacao', 'aguardando_fila', 'chamado_para_doca', 'em_doca', 'carregamento_iniciado', 'carregamento_pausado', 'carregamento_concluido', 'aguardando_documentacao', 'liberado_para_saida', 'saiu_do_patio', 'cancelado', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."patio_tipo_rodizio" AS ENUM ('prestador', 'regiao', 'tipo_veiculo', 'cliente', 'contrato', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."perfil_identidade" AS ENUM ('comercial', 'financeiro', 'operacional', 'fiscal', 'recrutamento', 'monitoramento', 'cliente', 'prestador', 'rh', 'suporte');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."periodicidade_kpi" AS ENUM ('diario', 'semanal', 'quinzenal', 'mensal', 'trimestral', 'semestral', 'anual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."periodicidade_meta" AS ENUM ('diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."prioridade_comunicacao_robo" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."prioridade_missao" AS ENUM ('baixa', 'media', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."prioridade_trabalho" AS ENUM ('baixa', 'normal', 'alta', 'critica');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."rede_oportunidade_status" AS ENUM ('publicada', 'visualizada', 'interessada', 'aceita', 'expirada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_academia" AS ENUM ('rascunho', 'em_andamento', 'aprovado', 'obsoleto', 'revogado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_arquivo_treinamento" AS ENUM ('rascunho', 'ativo', 'arquivado', 'expirado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_comunicacao_robo" AS ENUM ('pendente', 'enviado', 'respondido', 'concluido', 'erro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_credencial_zoho" AS ENUM ('ativo', 'expirado', 'revogado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_decisao_diretor" AS ENUM ('pending', 'executed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_diretor_virtual" AS ENUM ('active', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_execucao_conector" AS ENUM ('SOLICITADA', 'AGUARDANDO_APROVACAO', 'APROVADA', 'EM_EXECUCAO', 'CONCLUIDA', 'FALHOU', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_execucao_ferramenta" AS ENUM ('SOLICITADA', 'AGUARDANDO_APROVACAO', 'APROVADA', 'EM_EXECUCAO', 'CONCLUIDA', 'FALHOU', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_execucao_missao" AS ENUM ('pendente', 'em_andamento', 'concluida', 'falhou', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_execucao_rotina_ia" AS ENUM ('running', 'success', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_fila_trabalho" AS ENUM ('pendente', 'em_andamento', 'concluida', 'falhou');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_fluxo_execucao" AS ENUM ('pendente', 'em_andamento', 'concluido', 'falhou', 'bloqueado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_identidade" AS ENUM ('ativa', 'inativa', 'pausada', 'bloqueada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_insight" AS ENUM ('novo', 'analisado', 'aprovado', 'rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_instrucao" AS ENUM ('rascunho', 'em_revisao', 'publicado', 'arquivado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_integracao_externa" AS ENUM ('simulada', 'bloqueada_governanca', 'bloqueada_identidade', 'erro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_meta" AS ENUM ('ativa', 'pausada', 'atingida', 'nao_atingida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_missao" AS ENUM ('ativa', 'pausada', 'concluida', 'cancelada', 'rascunho');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_processamento" AS ENUM ('aguardando_processamento', 'processando', 'processado', 'erro', 'cancelado', 'reprocessando');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_regra_operacao" AS ENUM ('ativo', 'inativo', 'rascunho', 'vencido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_rotina_ia" AS ENUM ('pending', 'running', 'success', 'error', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_sessao_operacional" AS ENUM ('ativa', 'concluida', 'falhou', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_sugestao_melhoria" AS ENUM ('pendente', 'aprovado', 'rejeitado', 'aplicado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."status_trabalho" AS ENUM ('pendente', 'em_andamento', 'concluida', 'falhou', 'cancelada', 'escalada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_acao_gatilho" AS ENUM ('criar_tarefa', 'criar_aprovacao', 'criar_alerta', 'acionar_humano', 'executar_robo_simulado', 'notificar_setor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_atividade_agenda" AS ENUM ('prospeccao', 'followup', 'email', 'cobranca', 'analise', 'relatorio', 'reuniao', 'treinamento', 'comunicacao', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_auditoria_performance" AS ENUM ('meta', 'kpi', 'score', 'missao_execucao');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_comunicacao_robo" AS ENUM ('solicitacao', 'resposta', 'delegacao', 'alerta', 'escalonamento');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_conector" AS ENUM ('EMAIL', 'WHATSAPP', 'CRM', 'IA', 'AUTOMACAO_WEB', 'REDE_SOCIAL', 'PLATAFORMA_VAGAS', 'FINANCEIRO', 'OUTRO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_conhecimento" AS ENUM ('procedimento', 'politica', 'contrato', 'tabela_preco', 'treinamento', 'compliance', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_credencial" AS ENUM ('whatsapp', 'zoho', 'smtp', 'crm', 'api', 'site_vagas', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_decisao_diretor" AS ENUM ('priorizacao', 'risco', 'falha', 'overload', 'oportunidade');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_entidade" AS ENUM ('cliente', 'lead', 'motorista', 'prestador', 'fornecedor', 'colaborador', 'robo', 'projeto', 'contrato', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_evento" AS ENUM ('negociacao', 'reclamacao', 'proposta', 'contratacao', 'atraso', 'pagamento', 'bloqueio', 'elogio', 'cancelamento', 'renovacao', 'alerta', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_evento_aprendizado" AS ENUM ('execucao', 'erro', 'bloqueio', 'sucesso', 'decisao', 'performance', 'insight', 'fluxo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_fluxo" AS ENUM ('comercial', 'financeiro', 'operacional', 'rh', 'marketing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_material_academia" AS ENUM ('texto', 'pergunta_resposta', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'xml', 'imagem', 'audio', 'video');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_rotina_ia" AS ENUM ('scheduled', 'interval', 'event', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_sugestao_melhoria" AS ENUM ('fluxo', 'regra', 'kpi', 'prompt', 'ferramenta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public."tipo_versao_sistema" AS ENUM ('fluxo', 'regra', 'prompt', 'kpi');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. SEQUENCES
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public."fin_sane_02b_snapshot_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public."seq_fatura_2026" START WITH 1 INCREMENT BY 1;

-- ============================================================================
-- 5. TABELAS BASE E COLUNAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public."_hml_seed_checkpoint" (
    "marcador" text NOT NULL,
    "cenario" integer NOT NULL,
    "seed_version" text NOT NULL,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "tentativas" integer NOT NULL DEFAULT 0,
    "erro" text,
    "iniciado_em" timestamp with time zone,
    "concluido_em" timestamp with time zone,
    "duracao_ms" integer,
    "executado_por" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."academia_cursos" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "robo_id" uuid,
    "titulo" text NOT NULL,
    "descricao" text,
    "tipo" text NOT NULL DEFAULT 'curso'::text,
    "categoria" text,
    "objetivo" text,
    "status" status_academia NOT NULL DEFAULT 'rascunho'::status_academia,
    "versao" integer NOT NULL DEFAULT 1,
    "autor" uuid,
    "aprovador" uuid,
    "data_aprovacao" timestamp with time zone,
    "validade" date,
    "tags" text[] DEFAULT '{}'::text[],
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."academia_materiais" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "curso_id" uuid,
    "tipo" tipo_material_academia NOT NULL,
    "titulo" text NOT NULL,
    "conteudo" text,
    "pergunta" text,
    "resposta" text,
    "arquivo_url" text,
    "storage_path" text,
    "mime_type" text,
    "tamanho_bytes" bigint,
    "duracao_segundos" integer,
    "ordem" integer NOT NULL DEFAULT 0,
    "versao" integer NOT NULL DEFAULT 1,
    "status" text NOT NULL DEFAULT 'ativo'::text,
    "tags" text[] DEFAULT '{}'::text[],
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."academia_progresso" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "robo_id" uuid,
    "curso_id" uuid,
    "material_id" uuid,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "observacao" text,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."agentes_ia_internos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo" text NOT NULL,
    "nome" text NOT NULL,
    "descricao" text,
    "setor" text NOT NULL,
    "funcao" text NOT NULL,
    "email_institucional" text,
    "assinatura_execucao" text NOT NULL,
    "ativo" boolean DEFAULT true,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."alocacoes_escala" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" uuid,
    "cliente_id" uuid,
    "prestador_id" uuid,
    "ordem_servico_id" uuid,
    "ordem_carregamento_id" uuid,
    "data_escala" date NOT NULL,
    "turno" text DEFAULT 'diurno'::text,
    "tipo_veiculo" text NOT NULL,
    "placa" text,
    "regiao" text,
    "rota" text,
    "origem" text,
    "destino" text,
    "status" text NOT NULL DEFAULT 'planejada'::text,
    "status_pagamento" text DEFAULT 'pendente'::text,
    "quantidade_entregas" integer DEFAULT 0,
    "quantidade_coletas" integer DEFAULT 0,
    "quantidade_paradas" integer DEFAULT 0,
    "km_previstos" numeric DEFAULT 0,
    "km_realizados" numeric DEFAULT 0,
    "valor_frete" numeric DEFAULT 0,
    "valor_repasse" numeric DEFAULT 0,
    "valor_pedagio" numeric DEFAULT 0,
    "valor_combustivel" numeric DEFAULT 0,
    "valor_ajudante" numeric DEFAULT 0,
    "valor_adicional" numeric DEFAULT 0,
    "valor_desconto" numeric DEFAULT 0,
    "valor_total" numeric DEFAULT (((((valor_repasse + valor_pedagio) + valor_combustivel) + valor_ajudante) + valor_adicional) - valor_desconto),
    "valor_tipo" text DEFAULT 'fixo'::text,
    "valor_percentual" numeric DEFAULT 0,
    "valor_fixo" numeric DEFAULT 0,
    "combustivel_valor" numeric DEFAULT 0,
    "km_rodados" numeric DEFAULT 0,
    "valor_km" numeric DEFAULT 0,
    "pedagio_franquia" numeric DEFAULT 0,
    "pedagio_excedente" numeric DEFAULT 0,
    "pedagio_cobrar_excedente" boolean DEFAULT false,
    "diarias_adicionais" integer DEFAULT 0,
    "valor_diaria" numeric DEFAULT 0,
    "segunda_saida" boolean DEFAULT false,
    "valor_segunda_saida" numeric DEFAULT 0,
    "terceira_saida" boolean DEFAULT false,
    "valor_terceira_saida" numeric DEFAULT 0,
    "saidas_adicionais" integer DEFAULT 0,
    "valor_saida_adicional" numeric DEFAULT 0,
    "ajudantes" integer DEFAULT 0,
    "valor_ajudante_unit" numeric DEFAULT 0,
    "reembolsos_outros" text,
    "valor_reembolso_outros" numeric DEFAULT 0,
    "horario_saida" time without time zone,
    "horario_retorno_previsto" time without time zone,
    "horario_inicio_real" timestamp with time zone,
    "horario_fim_real" timestamp with time zone,
    "tempo_total_minutos" integer,
    "aceite_prestador" boolean DEFAULT false,
    "data_aceite" timestamp with time zone,
    "motivo_recusa" text,
    "finalizada" boolean DEFAULT false,
    "data_finalizacao" timestamp with time zone,
    "comprovante_url" text,
    "assinatura_url" text,
    "fotos_entrega" text[],
    "ocorrencias_count" integer DEFAULT 0,
    "ocorrencias_descricao" text,
    "observacoes" text,
    "instrucoes_operacionais" text,
    "observacoes_internas" text,
    "tabela_valores_id" uuid,
    "tem_regra_especial" boolean DEFAULT false,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "tags" text[],
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "created_by" uuid,
    "updated_by" uuid,
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "tipo_reversa" text DEFAULT 'sem_reversa'::text,
    "reversa_valor_cliente" numeric(12,2) DEFAULT 0,
    "reversa_valor_prestador" numeric(12,2) DEFAULT 0,
    "reversa_qtd_volumes" integer DEFAULT 0,
    "reversa_status" text,
    "reversa_pod_url" text,
    "reversa_fotos" jsonb DEFAULT '[]'::jsonb,
    "reversa_observacoes" text,
    "reversa_realizada_em" timestamp with time zone,
    "reversa_qtd_coletada" integer DEFAULT 0,
    "reversa_endereco_coleta" text,
    "reversa_endereco_devolucao" text,
    "reversa_unidade_cobranca" text DEFAULT 'unidade'::text,
    "reversa_valor_unitario" numeric(12,2) DEFAULT 0,
    "reversa_divergencia" text,
    "reversa_motivo_divergencia" text,
    "reversa_responsavel" text,
    "reversa_documento_responsavel" text,
    "reversa_telefone" text,
    "reversa_data_prevista" date,
    "reversa_data_realizada" date,
    "reversa_valor_adicional" numeric(12,2) DEFAULT 0,
    "reversa_assinatura_url" text,
    "reversa_latitude" numeric,
    "reversa_longitude" numeric,
    "coleta_reversa" boolean DEFAULT false,
    "operation_mode" text DEFAULT 'standard_delivery'::text,
    "motivo_troca_motorista" text,
    "endereco_origem" jsonb,
    "endereco_destino" jsonb,
    "valor_desconto_prestador" numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."auth_eventos_auditoria" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid,
    "email" text,
    "tipo_evento" text NOT NULL,
    "perfil" text,
    "ip_origem" text,
    "user_agent" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "criado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."automacoes_aprovacoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tarefa_id" uuid,
    "tipo_aprovacao" text NOT NULL,
    "conteudo_original" jsonb DEFAULT '{}'::jsonb,
    "conteudo_sugerido" jsonb DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "aprovado_por" text,
    "aprovado_em" timestamp with time zone,
    "observacao" text,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."automacoes_execucoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "regra_id" uuid,
    "status" text DEFAULT 'pendente'::text,
    "modulo" text,
    "evento" text,
    "payload" jsonb,
    "resultado" jsonb,
    "erro" text,
    "iniciado_em" timestamp with time zone,
    "finalizado_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."automacoes_fila" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "regra_id" uuid,
    "tipo" text NOT NULL,
    "canal" text NOT NULL,
    "destino" text NOT NULL,
    "assunto" text,
    "mensagem" text NOT NULL,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "status" text DEFAULT 'pendente'::text,
    "tentativas" integer DEFAULT 0,
    "max_tentativas" integer DEFAULT 3,
    "agendado_para" timestamp with time zone DEFAULT now(),
    "processado_em" timestamp with time zone,
    "erro" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "executar_em" timestamp with time zone DEFAULT now(),
    "prioridade" character varying(20) DEFAULT 'normal'::character varying,
    "ultimo_erro" text
);

CREATE TABLE IF NOT EXISTS public."automacoes_gatilhos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "nome" text NOT NULL,
    "setor" text NOT NULL,
    "evento" text NOT NULL,
    "descricao" text,
    "cliente_id" uuid,
    "operacao_id" uuid,
    "regiao" text,
    "prioridade" text NOT NULL DEFAULT 'normal'::text,
    "status_anterior" text,
    "status_novo" text,
    "condicao_json" jsonb DEFAULT '{}'::jsonb,
    "tipo_acao" text NOT NULL DEFAULT 'criar_tarefa'::text,
    "criar_tarefa" boolean DEFAULT true,
    "criar_aprovacao" boolean DEFAULT false,
    "criar_alerta" boolean DEFAULT false,
    "acionar_humano" boolean DEFAULT false,
    "executar_robo_simulado" boolean DEFAULT false,
    "exige_aprovacao_humana" boolean DEFAULT true,
    "permite_execucao_automatica" boolean DEFAULT false,
    "nivel_risco" text NOT NULL DEFAULT 'medio'::text,
    "limite_execucoes" integer DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "horario_inicio" time without time zone,
    "horario_fim" time without time zone,
    "criado_por" uuid,
    "criado_em" timestamp with time zone NOT NULL DEFAULT now(),
    "atualizado_em" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."automacoes_gatilhos_execucao" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "gatilho_id" uuid NOT NULL,
    "robo_id" uuid,
    "evento" text NOT NULL,
    "tipo_acao" text NOT NULL,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "resultado" jsonb DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'processado'::text,
    "erro" text,
    "executado_em" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."automacoes_instrucoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "versao" integer NOT NULL,
    "objetivo" text,
    "tom_de_conversa" text,
    "regras_fixas" text,
    "perguntas_obrigatorias" text,
    "respostas_padrao" jsonb DEFAULT '[]'::jsonb,
    "limites_de_atuacao" text,
    "quando_chamar_humano" text,
    "proibicoes" text,
    "exemplos_de_conversa" jsonb DEFAULT '[]'::jsonb,
    "instrucoes_completas" text,
    "status" text NOT NULL DEFAULT 'rascunho'::text,
    "ativo" boolean NOT NULL DEFAULT false,
    "criado_por" uuid,
    "publicado_por" uuid,
    "publicado_em" timestamp with time zone,
    "criado_em" timestamp with time zone NOT NULL DEFAULT now(),
    "atualizado_em" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."automacoes_logs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "tarefa_id" uuid,
    "acao" text NOT NULL,
    "entrada" jsonb DEFAULT '{}'::jsonb,
    "saida" jsonb DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'sucesso'::text,
    "erro" text,
    "criado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."automacoes_regras" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "descricao" text,
    "modulo" text,
    "evento_trigger" text,
    "canal" text,
    "ativa" boolean DEFAULT true,
    "prioridade" text DEFAULT 'normal'::text,
    "condicoes" jsonb DEFAULT '{}'::jsonb,
    "acoes" jsonb DEFAULT '[]'::jsonb,
    "ultima_execucao" timestamp with time zone,
    "proxima_execucao" timestamp with time zone,
    "total_execucoes" integer DEFAULT 0,
    "total_erros" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."automacoes_regras_operacao" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "cliente_id" uuid,
    "nome_operacao" text NOT NULL,
    "setor" text NOT NULL,
    "tipo_veiculo" text,
    "capacidade" text,
    "local_carregamento" text,
    "cidade_operacao" text,
    "horario_inicio" time without time zone,
    "horario_fim" time without time zone,
    "dias_operacao" text,
    "valor_operacao" numeric(12,2),
    "modelo_pagamento" text,
    "km_incluso" integer,
    "valor_km_excedente" numeric(10,2),
    "documentos_obrigatorios" text[] DEFAULT '{}'::text[],
    "exige_treinamento" boolean DEFAULT false,
    "criterios_aprovacao" text,
    "criterios_reprovacao" text,
    "mensagem_inicial" text,
    "status" text NOT NULL DEFAULT 'ativo'::text,
    "validade_inicio" date,
    "validade_fim" date,
    "criado_por" uuid,
    "atualizado_por" uuid,
    "criado_em" timestamp with time zone NOT NULL DEFAULT now(),
    "atualizado_em" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."automacoes_robos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "descricao" text,
    "setor" text NOT NULL,
    "icone" text DEFAULT 'Bot'::text,
    "cor" text DEFAULT '#6366f1'::text,
    "modo" text NOT NULL DEFAULT 'manual'::text,
    "status" text NOT NULL DEFAULT 'inativo'::text,
    "acoes_permitidas" jsonb DEFAULT '[]'::jsonb,
    "acoes_bloqueadas" jsonb DEFAULT '[]'::jsonb,
    "precisa_aprovacao" jsonb DEFAULT '[]'::jsonb,
    "mensagem_fallback" text DEFAULT 'Vou direcionar para o responsavel pelo setor e ja retorno com uma posicao.'::text,
    "ultima_execucao" timestamp with time zone,
    "total_execucoes" integer DEFAULT 0,
    "total_erros" integer DEFAULT 0,
    "config" jsonb DEFAULT '{}'::jsonb,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now(),
    "canal_principal" text DEFAULT 'interno'::text,
    "nivel_autonomia" text DEFAULT 'manual'::text,
    "responsavel_humano_id" uuid,
    "modo_atual" text DEFAULT 'seguro'::text,
    "setor_responsavel" text,
    "permite_envio_externo" boolean DEFAULT false,
    "exige_aprovacao_humana" boolean DEFAULT true,
    "limite_mensagens_dia" integer DEFAULT 0,
    "horario_inicio" time without time zone,
    "horario_fim" time without time zone,
    "tom_conversa" text,
    "instrucoes_resumo" text,
    "is_agente_interno" boolean DEFAULT false,
    "agente_interno_id" uuid
);

CREATE TABLE IF NOT EXISTS public."automacoes_tarefas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "setor" text NOT NULL,
    "tipo_tarefa" text NOT NULL DEFAULT 'geral'::text,
    "origem_tipo" text,
    "origem_id" text,
    "titulo" text NOT NULL,
    "descricao" text,
    "prioridade" text NOT NULL DEFAULT 'normal'::text,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "executar_em" timestamp with time zone,
    "tentativas" integer DEFAULT 0,
    "max_tentativas" integer DEFAULT 3,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "resultado" jsonb DEFAULT '{}'::jsonb,
    "responsavel_humano_id" uuid,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."biblioteca_documentos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "caminho" text,
    "url" text,
    "tamanho" text,
    "categoria" text DEFAULT 'Geral'::text,
    "pasta" text NOT NULL DEFAULT 'geral'::text,
    "cliente_id" uuid,
    "prestador_id" uuid,
    "usuario_nome" text DEFAULT 'Sistema'::text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."campanhas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome_campanha" text NOT NULL,
    "tipo_campanha" text NOT NULL,
    "objetivo" text,
    "canal" text,
    "publico_alvo" text,
    "orcamento_estimado" numeric(12,2),
    "data_inicio" date,
    "data_fim" date,
    "status" text DEFAULT 'Rascunho'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."candidato_documentos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "candidato_id" uuid NOT NULL,
    "tipo" text NOT NULL,
    "arquivo_url" text,
    "status" text DEFAULT 'pendente'::text,
    "validade" date,
    "dados_extraidos" jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."candidatos" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "nome_completo" text NOT NULL,
    "cpf" text,
    "telefone" text,
    "whatsapp" text,
    "email" text,
    "cidade" text,
    "uf" text,
    "regiao" text,
    "tipo_veiculo" text,
    "tipo_carroceria" text,
    "placa" text,
    "experiencia_anos" integer,
    "como_conheceu" text,
    "mensagem_livre" text,
    "canal_captacao" text DEFAULT 'link_direto'::text,
    "status" text DEFAULT 'interessado'::text,
    "score_perfil" numeric DEFAULT 0,
    "prioridade" numeric DEFAULT 0,
    "ultima_interacao" timestamp with time zone,
    "prestador_id" uuid,
    "observacoes" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."central_integracoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "tipo" text NOT NULL,
    "ambiente" text NOT NULL,
    "status" text NOT NULL,
    "url_publica" text,
    "webhook_url" text,
    "observacoes" text,
    "ultimo_teste_em" timestamp with time zone,
    "ultimo_erro" text,
    "ativo" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."centros_custo" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "descricao" text,
    "status" text DEFAULT 'Ativo'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."certificados_fiscais" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "emitente_id" uuid NOT NULL,
    "nome_arquivo" text NOT NULL,
    "storage_path" text NOT NULL,
    "tipo" text DEFAULT 'A1'::text,
    "validade" date,
    "status" text DEFAULT 'pendente'::text,
    "ativo" boolean DEFAULT true,
    "criado_por" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."clientes" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "razao_social" text,
    "nome_fantasia" text,
    "cnpj" text,
    "ie" text,
    "segmento" text,
    "porte" text,
    "status" text DEFAULT 'ativo'::text,
    "telefone" text,
    "whatsapp" text,
    "email" text,
    "contato_principal" text,
    "cidade" text,
    "uf" text,
    "created_at" timestamp without time zone DEFAULT now(),
    "updated_at" timestamp without time zone DEFAULT now(),
    "site" text,
    "responsavel_operacional" text,
    "responsavel_financeiro" text,
    "responsavel_comercial" text,
    "observacoes" text,
    "origem_comercial" text,
    "aceita_api" boolean DEFAULT false,
    "aceita_portal" boolean DEFAULT false,
    "exige_agendamento" boolean DEFAULT false,
    "exige_sla" boolean DEFAULT false,
    "exige_portal" boolean DEFAULT false,
    "logo" text,
    "num_os_mes" integer DEFAULT 0,
    "tipo_cobranca" text,
    "vencimento_padrao" integer DEFAULT 15,
    "agrupamento_faturamento" text,
    "cte_obrigatorio" boolean DEFAULT false,
    "xml_obrigatorio" boolean DEFAULT false,
    "comprovante_obrigatorio" boolean DEFAULT false,
    "canhoto_obrigatorio" boolean DEFAULT false,
    "assinatura_legivel" boolean DEFAULT false,
    "protocolo_obrigatorio" boolean DEFAULT false,
    "geolocalizacao" boolean DEFAULT false,
    "tomador" text,
    "cnae" text,
    "cfop_padrao" text,
    "retencoes" text,
    "envio_xml" boolean DEFAULT false,
    "observacoes_fiscais" text,
    "municipio_padrao" text,
    "regime_tributario" text,
    "aliquota_iss" numeric DEFAULT 0,
    "incentivo_fiscal" boolean DEFAULT false,
    "tabela_valores_padrao_id" uuid,
    "cep" text,
    "logradouro" text,
    "numero" text,
    "bairro" text,
    "complemento" text,
    "inscricao_municipal" text,
    "optante_simples" boolean DEFAULT false,
    "tipo_frete_preferencial" text DEFAULT 'rodoviario'::text,
    "veiculo_preferencial" text,
    "horario_entrega_preferencial" text,
    "notificar_email" boolean DEFAULT true,
    "notificar_whatsapp" boolean DEFAULT false,
    "notificar_mudanca_status" boolean DEFAULT true,
    "notificar_comprovante" boolean DEFAULT true,
    "tenant_id" uuid,
    "data_cadastro" date,
    "ultima_operacao" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."clientes_contratos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "numero" text,
    "tipo" text,
    "valor" numeric DEFAULT 0,
    "objeto" text,
    "vigencia_inicio" date,
    "vigencia_fim" date,
    "status" text DEFAULT 'ativo'::text,
    "observacoes" text,
    "anexo_url" text,
    "anexo_nome" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."communication_events" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "os_id" uuid,
    "alocacao_id" uuid,
    "cliente_id" uuid,
    "prestador_id" uuid,
    "template_id" uuid,
    "destinatario_nome" text,
    "destinatario_contato" text,
    "evento" text NOT NULL,
    "publico" text NOT NULL,
    "canal" text DEFAULT 'simulation'::text,
    "status_envio" text DEFAULT 'pendente'::text,
    "assunto" text,
    "mensagem" text,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "erro" text,
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."communication_preferences" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "cliente_id" uuid,
    "canal" text DEFAULT 'todos'::text,
    "publico" text DEFAULT 'todos'::text,
    "ativo" boolean DEFAULT true,
    "eventos_permitidos" jsonb DEFAULT '[]'::jsonb,
    "branding" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."communication_templates" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "codigo" text NOT NULL,
    "nome" text NOT NULL,
    "canal" text DEFAULT 'todos'::text,
    "publico" text NOT NULL,
    "evento" text NOT NULL,
    "assunto" text,
    "corpo" text NOT NULL,
    "variaveis" jsonb DEFAULT '[]'::jsonb,
    "branding" jsonb DEFAULT '{}'::jsonb,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."composicao_financeira" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "os_id" uuid,
    "valor_cliente" numeric,
    "valor_prestador" numeric,
    "impostos" numeric DEFAULT 0,
    "seguro" numeric DEFAULT 0,
    "pedagio" numeric DEFAULT 0,
    "outros" numeric DEFAULT 0,
    "margem_bruta" numeric,
    "margem_liquida" numeric,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."composicao_financeira_os" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "os_id" uuid,
    "cliente_id" uuid,
    "prestador_id" uuid,
    "valor_cliente" numeric DEFAULT 0,
    "valor_prestador" numeric DEFAULT 0,
    "imposto_percentual" numeric DEFAULT 4.5,
    "imposto_valor" numeric DEFAULT 0,
    "seguro_valor" numeric DEFAULT 0,
    "pedagio_valor" numeric DEFAULT 0,
    "outros_custos" numeric DEFAULT 0,
    "margem_bruta" numeric DEFAULT 0,
    "margem_liquida" numeric DEFAULT 0,
    "percentual_margem_bruta" numeric DEFAULT 0,
    "percentual_margem_liquida" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "origem_calculo" text DEFAULT 'os_direta'::text,
    "combustivel_valor" numeric DEFAULT 0,
    "ajudante_valor" numeric DEFAULT 0,
    "adicional_valor" numeric DEFAULT 0,
    "desconto_valor" numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."comunicacoes_destinatarios_autorizados" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tipo_destinatario" text NOT NULL,
    "origem_id" text,
    "nome" text,
    "telefone" text,
    "canal" text NOT NULL DEFAULT 'whatsapp'::text,
    "setor" text NOT NULL DEFAULT 'operacional'::text,
    "permitido" boolean DEFAULT false,
    "ambiente" text NOT NULL DEFAULT 'homologacao'::text,
    "observacao" text,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."comunicacoes_mensagens" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "tarefa_id" uuid,
    "origem_tipo" text,
    "origem_id" text,
    "destinatario_tipo" text NOT NULL,
    "destinatario_nome" text,
    "canal" text NOT NULL DEFAULT 'simulado'::text,
    "assunto" text,
    "conteudo" text NOT NULL,
    "status" text NOT NULL DEFAULT 'rascunho'::text,
    "provider_message_id" text,
    "modo_seguro" boolean DEFAULT true,
    "contexto" jsonb DEFAULT '{}'::jsonb,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now(),
    "modo_homologacao" boolean DEFAULT false,
    "aprovado_por" text,
    "aprovado_em" timestamp with time zone,
    "motivo_bloqueio" text,
    "bloqueado_por_regra" text
);

CREATE TABLE IF NOT EXISTS public."configuracoes_fiscais" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "razao_social" text,
    "nome_fantasia" text,
    "cnpj" text,
    "ie" text,
    "rntrc" text,
    "cep" text,
    "logradouro" text,
    "numero" text,
    "complemento" text,
    "bairro" text,
    "cidade" text,
    "uf" text,
    "telefone" text,
    "email" text,
    "ambiente_fiscal" text DEFAULT 'homologacao'::text,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
    "apelido" text,
    "padrao" boolean DEFAULT false,
    "limite_plano" integer DEFAULT 3,
    "focus_empresa_id" text,
    "focus_token_configurado" boolean DEFAULT false,
    "certificado_configurado" boolean DEFAULT false,
    "inscricao_municipal" text,
    "codigo_ibge" text,
    "crt" text,
    "regime_tributario" text,
    "cnae_principal" text,
    "focus_status" text DEFAULT 'pendente'::text,
    "certificado_nome" text,
    "certificado_validade" date,
    "certificado_status" text DEFAULT 'pendente'::text
);

CREATE TABLE IF NOT EXISTS public."configuracoes_sistema" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "chave" text NOT NULL,
    "valor" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."contas_financeiras" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "tipo" text NOT NULL DEFAULT 'Conta Corrente'::text,
    "banco" text,
    "agencia" text,
    "numero_conta" text,
    "digito" text,
    "titular" text,
    "chave_pix" text,
    "saldo" numeric(14,2) NOT NULL DEFAULT 0,
    "saldo_inicial" numeric(14,2) NOT NULL DEFAULT 0,
    "saldo_inicial_data" date,
    "ativa" boolean NOT NULL DEFAULT true,
    "principal" boolean NOT NULL DEFAULT false,
    "empresa" text DEFAULT 'Matriz (SP)'::text,
    "plano_contas" text DEFAULT 'Disponibilidades'::text,
    "observacoes" text,
    "cor" text DEFAULT '#2563eb'::text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."contratos_gerados" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "numero_contrato" text,
    "prestador_id" uuid,
    "modelo_id" uuid,
    "tipo_contrato" text,
    "contratado_nome" text,
    "conteudo_html" text,
    "pdf_url" text,
    "hash_documento" text,
    "status" text DEFAULT 'aguardando'::text,
    "aceite_whatsapp" boolean DEFAULT false,
    "aceite_whatsapp_data" timestamp with time zone,
    "aceite_whatsapp_numero" text,
    "aceite_whatsapp_mensagem" text,
    "assinatura_eletronica" boolean DEFAULT false,
    "assinatura_data" timestamp with time zone,
    "assinatura_ip" text,
    "assinatura_geolocalizacao" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "valor_contrato" numeric,
    "valor_diaria" numeric,
    "valor_saida" numeric,
    "prestador_nome" text,
    "prestador_cpf" text,
    "prestador_cnpj" text,
    "prestador_rntrc" text,
    "prestador_telefone" text
);

CREATE TABLE IF NOT EXISTS public."contratos_historico" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "contrato_id" uuid,
    "acao" text NOT NULL,
    "descricao" text,
    "dados" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."contratos_modelos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "tipo" text NOT NULL DEFAULT 'TAC'::text,
    "conteudo_base" text NOT NULL,
    "variaveis" text[] DEFAULT '{}'::text[],
    "ativa" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."contratos_operacao" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "numero" text NOT NULL,
    "cliente_id" uuid NOT NULL,
    "cliente_nome" text NOT NULL,
    "data_inicio" date NOT NULL,
    "data_fim" date,
    "renovacao_automatica" boolean DEFAULT false,
    "frequencia" text NOT NULL DEFAULT 'diaria'::text,
    "dias_semana" integer[] DEFAULT '{}'::integer[],
    "dia_mes" integer,
    "datas_especificas" date[],
    "horario_inicio" time without time zone DEFAULT '08:00:00'::time without time zone,
    "horario_fim" time without time zone DEFAULT '18:00:00'::time without time zone,
    "sla_entrega_horas" integer DEFAULT 24,
    "tolerancia_atraso_minutos" integer DEFAULT 30,
    "tabela_valores_id" uuid,
    "tipo_reversa" text DEFAULT 'sem_reversa'::text,
    "reversa_config" jsonb DEFAULT '{}'::jsonb,
    "dias_para_vencimento" integer DEFAULT 30,
    "aliquota_iss" numeric(5,2) DEFAULT 4.5,
    "prestador_id" uuid,
    "usar_rede" boolean DEFAULT false,
    "documentos_obrigatorios" text[] DEFAULT '{}'::text[],
    "ativo" boolean DEFAULT true,
    "suspenso_ate" date,
    "motivo_suspensao" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."contratos_operacao_execucao" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "contrato_id" uuid NOT NULL,
    "rota_id" uuid,
    "os_id" uuid,
    "alocacao_id" uuid,
    "data_geracao" date NOT NULL,
    "data_operacao" date NOT NULL,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "erro" text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."contratos_operacao_rotas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "contrato_id" uuid NOT NULL,
    "nome" text NOT NULL,
    "ordem" integer DEFAULT 0,
    "origem_cidade" text NOT NULL,
    "origem_uf" text NOT NULL,
    "destino_cidade" text NOT NULL,
    "destino_uf" text NOT NULL,
    "tipo_veiculo" text NOT NULL,
    "tipo_operacao" text NOT NULL DEFAULT 'Entrega'::text,
    "distancia_km" numeric(10,2) DEFAULT 0,
    "peso_medio_kg" numeric(10,2) DEFAULT 0,
    "volumes_medio" integer DEFAULT 0,
    "tabela_valores_id" uuid,
    "prestador_id" uuid,
    "horario_inicio" time without time zone,
    "horario_fim" time without time zone,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."convites" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "email" text NOT NULL,
    "papel" text NOT NULL DEFAULT 'admin_tenant'::text,
    "token" uuid DEFAULT gen_random_uuid(),
    "usado" boolean DEFAULT false,
    "expira_em" timestamp with time zone DEFAULT (now() + '7 days'::interval),
    "criado_por" uuid,
    "criado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."criativos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "titulo" text NOT NULL,
    "tipo" text NOT NULL,
    "descricao" text,
    "link" text,
    "campanha_id" uuid,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."crm_conversas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "lead_id" uuid,
    "canal" text NOT NULL,
    "telefone" text,
    "email" text,
    "nome_contato" text,
    "setor" text,
    "status" text DEFAULT 'aberta'::text,
    "ultima_mensagem" text,
    "ultimo_evento_em" timestamp with time zone,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."crm_followups" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" uuid NOT NULL,
    "canal" text DEFAULT 'email'::text,
    "tipo" text DEFAULT 'primeiro_contato'::text,
    "assunto" text DEFAULT ''::text,
    "mensagem" text DEFAULT ''::text,
    "status" text DEFAULT 'pendente'::text,
    "agendado_para" timestamp with time zone,
    "enviado_em" timestamp with time zone,
    "erro" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."crm_historico" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" uuid NOT NULL,
    "tipo" text NOT NULL DEFAULT 'atualizacao'::text,
    "titulo" text DEFAULT ''::text,
    "descricao" text DEFAULT ''::text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."crm_interacoes_prestadores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "prestador_id" uuid NOT NULL,
    "prestador_nome" text NOT NULL DEFAULT ''::text,
    "tipo" text NOT NULL,
    "titulo" text NOT NULL DEFAULT ''::text,
    "descricao" text NOT NULL DEFAULT ''::text,
    "data" timestamp with time zone NOT NULL DEFAULT now(),
    "usuario" text NOT NULL DEFAULT ''::text,
    "proxima_acao" text NOT NULL DEFAULT ''::text,
    "data_proximo_contato" timestamp with time zone,
    "status" text NOT NULL DEFAULT 'realizado'::text,
    "anexos" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."crm_leads" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text,
    "empresa" text,
    "telefone" text,
    "email" text,
    "origem" text DEFAULT 'manual'::text,
    "status" text DEFAULT 'novo'::text,
    "origem_endereco" text,
    "destino_endereco" text,
    "tipo_veiculo" text,
    "valor_estimado" numeric DEFAULT 0,
    "receita_potencial" numeric DEFAULT 0,
    "observacoes" text,
    "data_ultimo_contato" timestamp with time zone,
    "proximo_followup" timestamp with time zone,
    "convertido_cliente_id" uuid,
    "convertido_os_id" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "nome_contato" text NOT NULL DEFAULT ''::text,
    "whatsapp" text DEFAULT ''::text,
    "segmento" text DEFAULT ''::text,
    "regiao" text DEFAULT ''::text,
    "responsavel" text DEFAULT ''::text,
    "tipo_servico" text DEFAULT ''::text,
    "estagio" text DEFAULT 'lead_novo'::text,
    "urgencia" text DEFAULT 'media'::text,
    "temperatura" text DEFAULT 'frio'::text,
    "valor_estimado_mensal" numeric DEFAULT 0,
    "probabilidade_fechamento" integer DEFAULT 10,
    "qtd_veiculos" integer DEFAULT 0,
    "tipos_veiculo" text[] DEFAULT '{}'::text[],
    "regioes" text[] DEFAULT '{}'::text[],
    "volume_mensal" integer DEFAULT 0,
    "timeline" jsonb DEFAULT '[]'::jsonb,
    "lembretes" jsonb DEFAULT '[]'::jsonb,
    "dias_na_etapa" integer DEFAULT 0,
    "motivo_perda" text,
    "descricao_perda" text,
    "proposta_url" text,
    "proposta_enviada_em" timestamp with time zone,
    "proposta_visualizacoes" integer DEFAULT 0,
    "cliente_id" uuid,
    "orcamento_id" uuid
);

CREATE TABLE IF NOT EXISTS public."crm_mensagens" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "conversa_id" uuid,
    "lead_id" uuid,
    "cliente_id" uuid,
    "canal" text NOT NULL,
    "tipo" text DEFAULT 'texto'::text,
    "direction" text NOT NULL,
    "remetente" text,
    "destinatario" text,
    "mensagem" text NOT NULL,
    "status" text DEFAULT 'pendente'::text,
    "anexo_url" text,
    "external_id" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "erro" text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."crm_templates_mensagem" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text,
    "canal" text,
    "setor" text,
    "assunto" text,
    "mensagem" text,
    "ativo" boolean DEFAULT true,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."delivery_proofs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "stop_id" text,
    "operation_id" text,
    "driver_id" text,
    "receiver_name" text NOT NULL,
    "receiver_document" text,
    "receiver_relationship" text,
    "status" text DEFAULT 'pending'::text,
    "photo_url" text,
    "signature_url" text,
    "latitude" double precision,
    "longitude" double precision,
    "gps_accuracy" double precision,
    "observation" text,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "foto_canhoto_url" text,
    "rota_id" text,
    "os_id" text,
    "cliente_id" text,
    "parada_id" uuid,
    "idempotency_key" text
);

CREATE TABLE IF NOT EXISTS public."despesas_operacionais" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "veiculo_id" uuid,
    "categoria" text NOT NULL DEFAULT 'outros'::text,
    "subcategoria" text,
    "descricao" text,
    "valor" numeric(12,2) NOT NULL DEFAULT 0,
    "data_competencia" date NOT NULL DEFAULT CURRENT_DATE,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "comprovante_url" text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."diretor_virtual_decisoes_ia" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "origem" text NOT NULL,
    "robo_id" uuid,
    "tipo" tipo_decisao_diretor NOT NULL,
    "descricao" text NOT NULL,
    "impacto" impacto_decisao_diretor NOT NULL DEFAULT 'medium'::impacto_decisao_diretor,
    "acao" acao_decisao_diretor NOT NULL,
    "detalhes" jsonb DEFAULT '{}'::jsonb,
    "status" status_decisao_diretor NOT NULL DEFAULT 'pending'::status_decisao_diretor,
    "executado" boolean NOT NULL DEFAULT false,
    "executado_em" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."diretor_virtual_eventos_ia" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tipo_evento" text NOT NULL,
    "robo_id" uuid,
    "rotina_id" uuid,
    "descricao" text NOT NULL DEFAULT ''::text,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."diretor_virtual_ia" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "status" status_diretor_virtual NOT NULL DEFAULT 'active'::status_diretor_virtual,
    "modo_operacao" modo_diretor_virtual NOT NULL DEFAULT 'semi_auto'::modo_diretor_virtual,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."diretor_virtual_metricas_ia" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "rotinas_ativas" integer NOT NULL DEFAULT 0,
    "rotinas_atrasadas" integer NOT NULL DEFAULT 0,
    "falhas_24h" integer NOT NULL DEFAULT 0,
    "execucoes_24h" integer NOT NULL DEFAULT 0,
    "carga_percentual" numeric(5,2) NOT NULL DEFAULT 0,
    "risco_score" numeric(5,2) NOT NULL DEFAULT 0,
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."documentos_prestadores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "prestador_id" uuid,
    "tipo" text,
    "url" text,
    "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."driver_incidents" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "operation_id" uuid,
    "stop_id" uuid,
    "driver_id" uuid,
    "category" text,
    "description" text,
    "photo_url" text,
    "audio_url" text,
    "latitude" double precision,
    "longitude" double precision,
    "status" text DEFAULT 'aberto'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."driver_operations" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" uuid,
    "numero_os" text NOT NULL,
    "operation_mode" text DEFAULT 'dedicated'::text,
    "status" text DEFAULT 'pending'::text,
    "origem_nome" text,
    "origem_endereco" text,
    "destino_nome" text,
    "destino_endereco" text,
    "cliente_nome" text,
    "produto" text,
    "peso_total" text,
    "volumes_total" text,
    "valor_saida" double precision,
    "franquia_km" integer,
    "valor_km_adicional" double precision,
    "sla_final" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."driver_profiles" (
    "id" uuid NOT NULL,
    "user_id" uuid,
    "nome" text NOT NULL,
    "telefone" text,
    "email" text,
    "cpf_cnpj" text,
    "nivel" text DEFAULT 'Bronze'::text,
    "score" double precision DEFAULT 0,
    "status_operacional" text DEFAULT 'ativo'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."enderecos_cliente" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "logradouro" text NOT NULL,
    "numero" text,
    "complemento" text,
    "bairro" text,
    "cidade" text NOT NULL,
    "uf" text NOT NULL,
    "cep" text,
    "contato" text,
    "telefone" text,
    "tipo_favorito" text DEFAULT 'outro'::text,
    "contador_uso" integer DEFAULT 1,
    "ultimo_uso" timestamp without time zone DEFAULT now(),
    "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."enderecos_clientes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "tipo_endereco" text,
    "cep" text,
    "logradouro" text,
    "numero" text,
    "complemento" text,
    "bairro" text,
    "cidade" text,
    "uf" text,
    "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."entregas_protocolo" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "alocacao_id" uuid NOT NULL,
    "prestador_id" uuid NOT NULL,
    "nome_recebedor" text NOT NULL,
    "documento_recebedor" text,
    "observacao" text,
    "foto_entrega_url" text,
    "foto_canhoto_url" text,
    "assinatura_url" text,
    "data_hora_entrega" timestamp with time zone NOT NULL DEFAULT now(),
    "latitude" numeric,
    "longitude" numeric,
    "status" text NOT NULL DEFAULT 'entregue'::text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "gps_accuracy" numeric,
    "receiver_relationship" text,
    "ordem_servico_id" uuid,
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "parada_id" uuid
);

CREATE TABLE IF NOT EXISTS public."escala_operacional" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "os_id" uuid NOT NULL,
    "rota_id" uuid,
    "prestador_id" uuid NOT NULL,
    "motorista_nome" text NOT NULL,
    "veiculo_id" uuid NOT NULL,
    "placa" text NOT NULL,
    "data_operacao" date NOT NULL,
    "inicio_previsto" timestamp with time zone NOT NULL,
    "fim_previsto" timestamp with time zone NOT NULL,
    "status" text NOT NULL,
    "prioridade" text NOT NULL,
    "observacoes" text,
    "origem" text,
    "criado_por" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."escalonamentos_humanos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "origem" character varying(100) DEFAULT 'ia'::character varying,
    "modulo" character varying(100),
    "referencia_id" uuid,
    "tipo" character varying(100),
    "prioridade" character varying(50) DEFAULT 'alta'::character varying,
    "status" character varying(50) DEFAULT 'aberto'::character varying,
    "titulo" character varying(255),
    "descricao" text,
    "mensagem_original" text,
    "intencao" character varying(100),
    "confianca" numeric,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "operador_responsavel" character varying(100),
    "assumido_em" timestamp with time zone,
    "resolvido_em" timestamp with time zone,
    "observacao_resolucao" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."eventos_oficiais" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL DEFAULT current_tenant_id_safe(),
    "event_type" text NOT NULL,
    "entity_type" text NOT NULL,
    "entity_id" uuid NOT NULL,
    "entity_number" text,
    "status" text NOT NULL DEFAULT 'active'::text,
    "source" text NOT NULL DEFAULT 'service'::text,
    "created_by" uuid,
    "visibility" text NOT NULL DEFAULT 'internal'::text,
    "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "processed_at" timestamp with time zone,
    "version" text NOT NULL DEFAULT '1.0'::text,
    "retry_count" integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."fatura_itens" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "fatura_id" uuid NOT NULL,
    "os_id" uuid,
    "alocacao_id" uuid,
    "cliente_id" uuid,
    "romaneio" text,
    "descricao" text,
    "data_servico" date,
    "valor_base" numeric(14,2) NOT NULL DEFAULT 0,
    "valor_adicionais" numeric(14,2) NOT NULL DEFAULT 0,
    "valor_descontos" numeric(14,2) NOT NULL DEFAULT 0,
    "valor_total" numeric(14,2) NOT NULL DEFAULT 0,
    "km_excedente" numeric(14,2) NOT NULL DEFAULT 0,
    "pedagio_cliente" numeric(14,2) NOT NULL DEFAULT 0,
    "ajudante_cliente" numeric(14,2) NOT NULL DEFAULT 0,
    "diaria_cliente" numeric(14,2) NOT NULL DEFAULT 0,
    "saidas_adicionais_cliente" numeric(14,2) NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'ativo'::text,
    "criado_por" uuid,
    "criado_em" timestamp with time zone NOT NULL DEFAULT now(),
    "atualizado_em" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."faturas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL DEFAULT current_tenant_id_safe(),
    "numero" text,
    "cliente_id" uuid,
    "data_emissao" date NOT NULL DEFAULT CURRENT_DATE,
    "competencia_inicio" date,
    "competencia_fim" date,
    "vencimento" date,
    "valor_bruto" numeric(14,2) NOT NULL DEFAULT 0,
    "descontos" numeric(14,2) NOT NULL DEFAULT 0,
    "acrescimos" numeric(14,2) NOT NULL DEFAULT 0,
    "valor_total" numeric(14,2) NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'rascunho'::text,
    "observacao" text,
    "observacao_fiscal" text,
    "conta_receber_id" uuid,
    "criado_por" uuid,
    "criado_em" timestamp with time zone NOT NULL DEFAULT now(),
    "atualizado_por" uuid,
    "atualizado_em" timestamp with time zone NOT NULL DEFAULT now(),
    "cancelado_em" timestamp with time zone,
    "cancelado_por" uuid,
    "motivo_cancelamento" text,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public."filiais" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "descricao" text,
    "status" text DEFAULT 'Ativo'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."fin_sane_02b_snapshot" (
    "id" integer NOT NULL DEFAULT nextval('fin_sane_02b_snapshot_id_seq'::regclass),
    "financeiro_pagar_id" uuid NOT NULL,
    "os_id" text,
    "pagamento_prestador_id" uuid,
    "prestador_id" uuid,
    "valor_anterior" numeric(18,2),
    "valor_novo" numeric(18,2),
    "status_anterior" text,
    "motivo" text,
    "processado_em" timestamp with time zone DEFAULT now(),
    "execucao_id" uuid DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public."financeiro_baixas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "titulo_tabela" text NOT NULL,
    "titulo_id" uuid NOT NULL,
    "valor_original" numeric(18,2) NOT NULL,
    "valor_baixado" numeric(18,2) NOT NULL,
    "saldo_restante" numeric(18,2) NOT NULL,
    "data_baixa" date NOT NULL DEFAULT CURRENT_DATE,
    "forma_pagamento" text,
    "conta_financeira" text,
    "referencia_bancaria" text,
    "observacao" text,
    "usuario_id" uuid,
    "usuario_nome" text,
    "estornada" boolean NOT NULL DEFAULT false,
    "data_estorno" timestamp with time zone,
    "motivo_estorno" text,
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "conta_financeira_id" uuid
);

CREATE TABLE IF NOT EXISTS public."financeiro_pagar" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "cliente_id" uuid,
    "descricao" text,
    "valor" numeric,
    "vencimento" date,
    "status" text,
    "created_at" timestamp without time zone DEFAULT now(),
    "updated_at" timestamp without time zone DEFAULT now(),
    "os_id" text,
    "prestador" text,
    "fornecedor_nome" text,
    "data_vencimento" date,
    "data_emissao" date,
    "data_pagamento" date,
    "categoria" text,
    "observacoes" text,
    "fornecedor_id" uuid,
    "fornecedor_documento" text,
    "fornecedor" text,
    "documento" text,
    "tipo_documento" text DEFAULT 'NF'::text,
    "os_vinculada" text,
    "valor_bruto" numeric(12,2) DEFAULT 0,
    "valor_liquido" numeric(12,2) DEFAULT 0,
    "desconto" numeric(12,2) DEFAULT 0,
    "juros" numeric(12,2) DEFAULT 0,
    "multa" numeric(12,2) DEFAULT 0,
    "impostos_retidos" numeric(12,2) DEFAULT 0,
    "data_previsao_pagamento" date,
    "conta_pagadora" text DEFAULT 'Conta Corrente Principal'::text,
    "codigo_barras" text,
    "chave_pix" text,
    "recorrente" boolean DEFAULT false,
    "quantidade_parcelas" integer DEFAULT 1,
    "parcela_atual" integer DEFAULT 1,
    "competencia" text,
    "plano_contas" text,
    "centro_resultado" text,
    "unidade_filial" text,
    "despesa_fixa_base" text DEFAULT 'Variável'::text,
    "data_efetiva_pgto" date,
    "is_teste" boolean NOT NULL DEFAULT false,
    "fornecedor_cadastro_id" uuid
);

CREATE TABLE IF NOT EXISTS public."financeiro_receber" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "cliente_id" uuid,
    "descricao" text,
    "valor" numeric,
    "vencimento" date,
    "status" text,
    "created_at" timestamp without time zone DEFAULT now(),
    "updated_at" timestamp without time zone DEFAULT now(),
    "os_id" text,
    "cliente" text,
    "cliente_nome" text,
    "data_vencimento" date,
    "data_emissao" date,
    "data_pagamento" date,
    "categoria" text,
    "observacoes" text,
    "cliente_documento" text,
    "fatura" text,
    "serie" text,
    "numero" text,
    "os_vinculadas" text,
    "contrato_vinculado" text,
    "proposta_vinculada" text,
    "valor_bruto" numeric(12,2) DEFAULT 0,
    "valor_liquido" numeric(12,2) DEFAULT 0,
    "desconto" numeric(12,2) DEFAULT 0,
    "juros" numeric(12,2) DEFAULT 0,
    "multa" numeric(12,2) DEFAULT 0,
    "abatimento" numeric(12,2) DEFAULT 0,
    "data_previsao_recebimento" date,
    "recorrente" boolean DEFAULT false,
    "quantidade_parcelas" integer DEFAULT 1,
    "parcela_atual" integer DEFAULT 1,
    "centro_resultado" text,
    "plano_conta" text,
    "conta_entrada" text,
    "recorrencia" text DEFAULT 'nenhuma'::text,
    "fatura_id" uuid,
    "is_teste" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."financeiro_transferencias" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_at" timestamp with time zone DEFAULT now(),
    "data" date NOT NULL DEFAULT CURRENT_DATE,
    "conta_origem_id" uuid NOT NULL,
    "conta_destino_id" uuid NOT NULL,
    "valor" numeric(18,2) NOT NULL,
    "taxa" numeric(18,2) DEFAULT 0,
    "historico" text,
    "usuario_id" uuid,
    "usuario_nome" text,
    "tenant_id" uuid DEFAULT current_tenant_id_safe()
);

CREATE TABLE IF NOT EXISTS public."fiscal_ctes" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "filial_id" uuid,
    "cliente_id" uuid,
    "ordem_servico_id" uuid,
    "numero" character varying(50),
    "chave_acesso" character varying(100),
    "status" character varying(50) NOT NULL DEFAULT 'pendente'::character varying,
    "valor" numeric(15,2),
    "data_emissao" timestamp with time zone,
    "xml_url" text,
    "pdf_url" text,
    "protocolo" character varying(100),
    "motivo_rejeicao" text,
    "metadata" jsonb,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public."fiscal_documentos_vinculados" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "tipo_documento" character varying(10) NOT NULL DEFAULT 'NFE'::character varying,
    "chave_acesso" character varying(100),
    "numero" character varying(50),
    "serie" character varying(10),
    "emitente_cnpj" character varying(20),
    "emitente_nome" text,
    "destinatario_cnpj" character varying(20),
    "destinatario_nome" text,
    "valor_total" numeric(15,2),
    "peso_bruto" numeric(15,3),
    "volumes" integer,
    "produto_predominante" text,
    "municipio_origem" text,
    "uf_origem" character varying(2),
    "municipio_destino" text,
    "uf_destino" character varying(2),
    "xml_original" text,
    "ordem_servico_id" uuid,
    "status" character varying(30) NOT NULL DEFAULT 'aguardando_vinculo'::character varying,
    "metadata" jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "cte_id" uuid,
    "mdfe_id" uuid,
    "xml_storage_path" text,
    "xml_nome_arquivo" text,
    "peso_total" numeric(14,3),
    "criado_por" uuid
);

CREATE TABLE IF NOT EXISTS public."fiscal_events" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "documento_tipo" character varying(20) NOT NULL,
    "documento_id" uuid NOT NULL,
    "tipo_evento" character varying(50) NOT NULL,
    "descricao" text,
    "protocolo" character varying(100),
    "metadata" jsonb,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public."fiscal_historico_status" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "documento_tipo" text NOT NULL,
    "documento_id" uuid NOT NULL,
    "status_anterior" text,
    "status_novo" text NOT NULL,
    "motivo" text,
    "usuario" text,
    "origem" text DEFAULT 'simulacao_interna'::text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public."fiscal_logs" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "entidade_tipo" character varying(50),
    "entidade_id" uuid,
    "acao" character varying(100) NOT NULL,
    "request" jsonb,
    "response" jsonb,
    "status_code" integer,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public."fiscal_mdfes" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "filial_id" uuid,
    "cliente_id" uuid,
    "ordem_servico_id" uuid,
    "numero" character varying(50),
    "chave_acesso" character varying(100),
    "status" character varying(50) NOT NULL DEFAULT 'pendente'::character varying,
    "valor" numeric(15,2),
    "data_emissao" timestamp with time zone,
    "xml_url" text,
    "pdf_url" text,
    "protocolo" character varying(100),
    "motivo_rejeicao" text,
    "metadata" jsonb,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public."fiscal_nfse" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "filial_id" uuid,
    "cliente_id" uuid,
    "ordem_servico_id" uuid,
    "numero" character varying(50),
    "chave_acesso" character varying(100),
    "status" character varying(50) NOT NULL DEFAULT 'pendente'::character varying,
    "valor" numeric(15,2),
    "data_emissao" timestamp with time zone,
    "xml_url" text,
    "pdf_url" text,
    "protocolo" character varying(100),
    "motivo_rejeicao" text,
    "metadata" jsonb,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public."fiscal_xml_recebidos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "remetente" text NOT NULL,
    "destinatario" text NOT NULL,
    "assunto" text,
    "corpo_email" text,
    "nome_arquivo" text NOT NULL,
    "conteudo_xml" text,
    "xml_parsed" jsonb,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "robo_id" uuid,
    "tarefa_id" uuid,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."fluxo_recrutamento" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "titulo" text NOT NULL,
    "texto" text,
    "ordem" integer NOT NULL DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."fornecedores" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "tipo_pessoa" text NOT NULL DEFAULT 'PJ'::text,
    "razao_social" text NOT NULL,
    "nome_fantasia" text,
    "cpf_cnpj" text NOT NULL,
    "inscricao_estadual" text,
    "inscricao_municipal" text,
    "telefone" text,
    "email" text,
    "cep" text,
    "logradouro" text,
    "numero" text,
    "complemento" text,
    "bairro" text,
    "cidade" text,
    "uf" text,
    "chave_pix" text,
    "tipo_chave_pix" text,
    "banco" text,
    "agencia" text,
    "conta" text,
    "observacoes" text,
    "status" text NOT NULL DEFAULT 'ativo'::text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."historico_alocacoes_escala" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "alocacao_id" uuid NOT NULL,
    "evento" text NOT NULL,
    "status_anterior" text,
    "status_novo" text,
    "descricao" text,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "created_by" uuid,
    "ip_origem" text,
    "user_agent" text
);

CREATE TABLE IF NOT EXISTS public."homologacoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "candidato_id" uuid,
    "data_homologacao" text,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "obs" text,
    "checklist" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_agenda_atividades" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "agenda_id" uuid NOT NULL,
    "robo_id" uuid NOT NULL,
    "horario_inicio" time without time zone NOT NULL,
    "horario_fim" time without time zone NOT NULL,
    "tipo_atividade" tipo_atividade_agenda NOT NULL DEFAULT 'outro'::tipo_atividade_agenda,
    "descricao" text NOT NULL,
    "prioridade" prioridade_missao NOT NULL DEFAULT 'media'::prioridade_missao,
    "frequencia" text DEFAULT 'diario'::text,
    "repeticoes" integer DEFAULT 1,
    "ativo" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_agenda_trabalho" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "dia_semana" dia_semana NOT NULL,
    "ativo" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_agentes_execucao" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "objetivo" text NOT NULL,
    "contexto_inicial" jsonb DEFAULT '{}'::jsonb,
    "estado" text NOT NULL DEFAULT 'ativa'::text,
    "passo_atual" integer DEFAULT 1,
    "total_passos" integer DEFAULT 1,
    "resultado_final" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_aprendizado_eventos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "entidade_tipo" character varying,
    "entidade_id" character varying,
    "tipo_evento" tipo_evento_aprendizado NOT NULL,
    "origem" character varying NOT NULL,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_aprovacoes_fila" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "execucao_ferramenta_id" uuid,
    "acao_tipo" character varying NOT NULL,
    "acao_descricao" text,
    "contexto" jsonb DEFAULT '{}'::jsonb,
    "justificativa" text,
    "risco" character varying DEFAULT 'medio'::character varying,
    "valor_financeiro" numeric(15,2) DEFAULT 0,
    "status" character varying DEFAULT 'pendente'::character varying,
    "nivel_atual" integer DEFAULT 1,
    "nivel_maximo" integer DEFAULT 3,
    "aprovador_id" uuid,
    "aprovador_tipo" character varying,
    "aprovado_em" timestamp with time zone,
    "rejeitado_em" timestamp with time zone,
    "observacao" text,
    "expiracao" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_aprovacoes_humanas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "setor_id" uuid,
    "titulo" text NOT NULL,
    "descricao" text,
    "acao_sugerida" text,
    "payload" jsonb,
    "status" text DEFAULT 'pendente'::text,
    "aprovado_por" text,
    "aprovado_em" timestamp with time zone,
    "rejeitado_em" timestamp with time zone,
    "motivo_rejeicao" text,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_auditoria_performance" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "missao_execucao_id" uuid,
    "tipo" tipo_auditoria_performance NOT NULL,
    "acao" character varying NOT NULL,
    "descricao" text,
    "valor_anterior" jsonb DEFAULT '{}'::jsonb,
    "valor_novo" jsonb DEFAULT '{}'::jsonb,
    "resultado" character varying,
    "impacto" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_autoridade_acoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "acao_tipo" character varying NOT NULL,
    "permitido" boolean DEFAULT true,
    "condicoes" jsonb DEFAULT '{}'::jsonb,
    "valor_maximo" numeric(15,2),
    "risco_maximo" character varying DEFAULT 'critico'::character varying,
    "precisa_aprovacao" boolean DEFAULT false,
    "supervisor_robo_id" uuid,
    "supervisor_setor" character varying,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_comunicacoes_fila_robos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "tipo_evento" text NOT NULL,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'pending'::text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_comunicacoes_robos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "origem_robo_id" uuid NOT NULL,
    "destino_robo_id" uuid NOT NULL,
    "tipo" tipo_comunicacao_robo NOT NULL,
    "assunto" text NOT NULL,
    "mensagem" text NOT NULL,
    "contexto" jsonb DEFAULT '{}'::jsonb,
    "status" status_comunicacao_robo NOT NULL DEFAULT 'pendente'::status_comunicacao_robo,
    "prioridade" prioridade_comunicacao_robo NOT NULL DEFAULT 'medium'::prioridade_comunicacao_robo,
    "tarefa_id" uuid,
    "rotina_id" uuid,
    "resposta_texto" text,
    "resposta_robo_id" uuid,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_conector_robo" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "conector_id" uuid NOT NULL,
    "modo" modo_conector NOT NULL DEFAULT 'HOMOLOGACAO'::modo_conector,
    "config_override" jsonb DEFAULT '{}'::jsonb,
    "ativo" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "limite_uso_dia" integer,
    "horario_permitido_inicio" time without time zone,
    "horario_permitido_fim" time without time zone
);

CREATE TABLE IF NOT EXISTS public."ia_conectores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo_unico" text NOT NULL,
    "nome" text NOT NULL,
    "descricao" text,
    "tipo" tipo_conector NOT NULL,
    "provedor" text NOT NULL,
    "config_default" jsonb DEFAULT '{}'::jsonb,
    "modo_padrao" modo_conector NOT NULL DEFAULT 'HOMOLOGACAO'::modo_conector,
    "ativo" boolean NOT NULL DEFAULT true,
    "url_base" text,
    "health_check_url" text,
    "instrucoes_conexao" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "credenciais" jsonb DEFAULT '{}'::jsonb,
    "token" text,
    "refresh_token" text,
    "token_validade" timestamp with time zone,
    "escopos" text[] DEFAULT '{}'::text[],
    "limite_uso_dia" integer DEFAULT 100,
    "horario_permitido_inicio" time without time zone DEFAULT '06:00:00'::time without time zone,
    "horario_permitido_fim" time without time zone DEFAULT '22:00:00'::time without time zone
);

CREATE TABLE IF NOT EXISTS public."ia_conhecimento" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "setor_id" uuid,
    "titulo" text NOT NULL,
    "tipo" text DEFAULT 'texto'::text,
    "conteudo" text,
    "arquivo_url" text,
    "tags" text[],
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now(),
    "robo_id" uuid,
    "categoria" text,
    "setor" text,
    "status" text NOT NULL DEFAULT 'ativo'::text,
    "validade_inicio" date,
    "validade_fim" date,
    "criado_por" uuid,
    "atualizado_por" uuid,
    "tipo_conhecimento" text NOT NULL DEFAULT 'outro'::text,
    "versao" integer NOT NULL DEFAULT 1,
    "aprovado_por" uuid,
    "data_aprovacao" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."ia_conhecimento_distribuicao" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "conhecimento_id" uuid NOT NULL,
    "robo_id" uuid NOT NULL,
    "obrigatorio" boolean NOT NULL DEFAULT false,
    "prioridade" text NOT NULL DEFAULT 'normal'::text,
    "data_vinculo" timestamp with time zone NOT NULL DEFAULT now(),
    "ativo" boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."ia_contextos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "modulo" text,
    "tipo" text,
    "conteudo" text NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_credenciais" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "tipo" tipo_credencial NOT NULL,
    "nome_credencial" character varying NOT NULL,
    "provedor" character varying,
    "referencia_env" character varying NOT NULL,
    "escopos" text[] DEFAULT '{}'::text[],
    "ativo" boolean DEFAULT true,
    "ultimo_uso" timestamp with time zone,
    "ultima_rotacao" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_credenciais_zoho" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "client_id" text NOT NULL,
    "account_id" text NOT NULL DEFAULT ''::text,
    "data_center" text NOT NULL DEFAULT 'mail.zoho.com'::text,
    "refresh_token_criptografado" text NOT NULL,
    "email_conectado" text NOT NULL DEFAULT ''::text,
    "status" status_credencial_zoho NOT NULL DEFAULT 'ativo'::status_credencial_zoho,
    "criado_em" timestamp with time zone NOT NULL DEFAULT now(),
    "atualizado_em" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_custos_ia" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "usuario_id" uuid,
    "provedor" text NOT NULL,
    "modelo" text NOT NULL,
    "tipo_tarefa" text NOT NULL,
    "complexidade" text NOT NULL,
    "modo_tenant" text NOT NULL,
    "tokens_entrada" integer DEFAULT 0,
    "tokens_saida" integer DEFAULT 0,
    "custo_estimado" numeric(12,8) DEFAULT 0,
    "tempo_resposta_ms" integer DEFAULT 0,
    "status" text NOT NULL DEFAULT 'sucesso'::text,
    "erro_resumido" text,
    "tempo_execucao" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_decisoes_logs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "setor" text,
    "origem" text,
    "referencia_id" text,
    "entrada_usuario" text,
    "decisao" text,
    "resposta_gerada" text,
    "precisa_humano" boolean DEFAULT false,
    "motivo_humano" text,
    "provider" text,
    "raw_payload" jsonb,
    "criado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_escalonamento_config" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tipo_acao" character varying NOT NULL,
    "nivel_risco_min" character varying,
    "valor_min" numeric(15,2),
    "nivel_ordem" integer NOT NULL DEFAULT 1,
    "aprovador_tipo" character varying NOT NULL DEFAULT 'supervisor'::character varying,
    "aprovador_robo_id" uuid,
    "aprovador_setor" character varying,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_execucoes_conectores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "conector_id" uuid NOT NULL,
    "ferramenta_id" uuid,
    "tarefa_id" uuid,
    "aprovacao_id" uuid,
    "acao" text NOT NULL,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "modo_executado" modo_conector NOT NULL,
    "status" status_execucao_conector NOT NULL DEFAULT 'SOLICITADA'::status_execucao_conector,
    "resultado" jsonb DEFAULT '{}'::jsonb,
    "erro" text,
    "request_log" jsonb DEFAULT '[]'::jsonb,
    "response_log" jsonb DEFAULT '{}'::jsonb,
    "inicio_execucao" timestamp with time zone,
    "fim_execucao" timestamp with time zone,
    "aprovado_por" uuid,
    "aprovado_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "tentativa" integer DEFAULT 1,
    "duracao_ms" integer,
    "request_url" text,
    "request_method" text
);

CREATE TABLE IF NOT EXISTS public."ia_execucoes_ferramentas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "ferramenta_id" uuid NOT NULL,
    "tarefa_id" uuid,
    "aprovacao_id" uuid,
    "solicitacao" text NOT NULL,
    "contexto" jsonb DEFAULT '{}'::jsonb,
    "status" status_execucao_ferramenta NOT NULL DEFAULT 'SOLICITADA'::status_execucao_ferramenta,
    "resultado" jsonb DEFAULT '{}'::jsonb,
    "erro" text,
    "inicio_execucao" timestamp with time zone,
    "fim_execucao" timestamp with time zone,
    "aprovado_por" uuid,
    "aprovado_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "agente_execucao_id" uuid,
    "passo_ordem" integer DEFAULT 1,
    "avaliacao" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public."ia_ferramentas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo_unico" text NOT NULL,
    "nome" text NOT NULL,
    "descricao" text,
    "categoria" categoria_ferramenta NOT NULL,
    "ativo" boolean NOT NULL DEFAULT true,
    "precisa_aprovacao" boolean NOT NULL DEFAULT true,
    "risco_operacional" text NOT NULL DEFAULT 'baixo'::text,
    "custo_estimado" text,
    "limite_execucoes_dia" integer NOT NULL DEFAULT 10,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "parametros" jsonb DEFAULT '{}'::jsonb,
    "timeout_segundos" integer DEFAULT 60
);

CREATE TABLE IF NOT EXISTS public."ia_fila_trabalho" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "trabalho_id" uuid NOT NULL,
    "robo_id" uuid NOT NULL,
    "ordem_execucao" integer NOT NULL DEFAULT 0,
    "status" status_fila_trabalho NOT NULL DEFAULT 'pendente'::status_fila_trabalho,
    "tentativas" integer NOT NULL DEFAULT 0,
    "ultima_execucao" timestamp with time zone,
    "proxima_execucao" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_fluxos_empresa" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" character varying NOT NULL,
    "descricao" text,
    "tipo" tipo_fluxo NOT NULL,
    "codigo" character varying NOT NULL,
    "versao" integer NOT NULL DEFAULT 1,
    "ativo" boolean DEFAULT true,
    "config" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_fluxos_etapas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "fluxo_id" uuid NOT NULL,
    "ordem" integer NOT NULL,
    "nome" character varying NOT NULL,
    "descricao" text,
    "origem_robo_id" uuid,
    "destino_robo_id" uuid,
    "setor_origem" character varying,
    "setor_destino" character varying,
    "acao_codigo" character varying,
    "acao_payload" jsonb DEFAULT '{}'::jsonb,
    "condicoes" jsonb DEFAULT '{}'::jsonb,
    "timeout_segundos" integer DEFAULT 300,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_fluxos_execucao_log" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "fluxo_id" uuid,
    "fluxo_codigo" character varying NOT NULL,
    "fluxo_nome" character varying NOT NULL,
    "etapa_id" uuid,
    "etapa_ordem" integer NOT NULL,
    "etapa_nome" character varying NOT NULL,
    "robo_origem_id" uuid,
    "robo_destino_id" uuid,
    "fluxo_execucao_id" uuid NOT NULL,
    "status" status_fluxo_execucao NOT NULL DEFAULT 'pendente'::status_fluxo_execucao,
    "pipeline" jsonb DEFAULT '{}'::jsonb,
    "decisao_f34a" text,
    "risco_calculado" numeric DEFAULT 0,
    "aprovado_f35" boolean,
    "identidade_f36" text,
    "resultado_f37" jsonb DEFAULT '{}'::jsonb,
    "impacto_f38" jsonb DEFAULT '{}'::jsonb,
    "memoria_f33" jsonb DEFAULT '{}'::jsonb,
    "decisao_f27" jsonb DEFAULT '{}'::jsonb,
    "erro" text,
    "inicio_execucao" timestamp with time zone DEFAULT now(),
    "fim_execucao" timestamp with time zone,
    "duracao_ms" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_governanca_log" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "acao_tipo" character varying,
    "decisao" character varying NOT NULL,
    "contexto" jsonb DEFAULT '{}'::jsonb,
    "regra_aplicada" jsonb DEFAULT '{}'::jsonb,
    "resultado" character varying,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_historico_indicadores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "indicador_id" uuid,
    "meta_id" uuid,
    "robo_id" uuid NOT NULL,
    "valor_planejado" numeric(15,2) NOT NULL DEFAULT 0,
    "valor_realizado" numeric(15,2) NOT NULL DEFAULT 0,
    "percentual_atingido" numeric(5,2) DEFAULT 0,
    "tendencia" text DEFAULT 'estavel'::text,
    "periodo_referencia" text,
    "data_apuracao" date NOT NULL DEFAULT CURRENT_DATE,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_historico_trabalho" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "trabalho_id" uuid NOT NULL,
    "robo_id" uuid,
    "acao" text NOT NULL,
    "detalhes" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_identidades" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "nome_operacional" character varying NOT NULL,
    "email_operacional" character varying,
    "status" status_identidade NOT NULL DEFAULT 'ativa'::status_identidade,
    "perfil" perfil_identidade NOT NULL,
    "timezone" character varying DEFAULT 'America/Sao_Paulo'::character varying,
    "idioma" character varying DEFAULT 'pt-BR'::character varying,
    "configuracao_operacional" jsonb DEFAULT '{}'::jsonb,
    "configuracao_cognitiva" jsonb DEFAULT '{}'::jsonb,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_indicadores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "meta_id" uuid NOT NULL,
    "robo_id" uuid NOT NULL,
    "valor_planejado" numeric(15,2) NOT NULL DEFAULT 0,
    "valor_realizado" numeric(15,2) NOT NULL DEFAULT 0,
    "percentual_atingido" numeric(5,2) DEFAULT 0,
    "tendencia" text DEFAULT 'estavel'::text,
    "periodo_referencia" text,
    "data_apuracao" date NOT NULL DEFAULT CURRENT_DATE,
    "observacoes" text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_insights_automaticos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "contexto" text,
    "insight_texto" text NOT NULL,
    "impacto_estimado" character varying,
    "prioridade" character varying DEFAULT 'media'::character varying,
    "status" status_insight NOT NULL DEFAULT 'novo'::status_insight,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_integracoes_externas_logs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "sessao_id" uuid,
    "canal" canal_integracao NOT NULL,
    "categoria" categoria_integracao NOT NULL,
    "acao" character varying NOT NULL,
    "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "payload_mockado" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "status" status_integracao_externa NOT NULL DEFAULT 'simulada'::status_integracao_externa,
    "governanca_decisao" character varying,
    "identidade_status" character varying,
    "duracao_ms" integer,
    "erro" text,
    "origem" character varying DEFAULT 'external_integration_engine'::character varying,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_kpis_robo" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "nome_kpi" character varying NOT NULL,
    "descricao" text,
    "formula" text NOT NULL,
    "valor_atual" numeric NOT NULL DEFAULT 0,
    "valor_meta" numeric NOT NULL DEFAULT 100,
    "unidade" character varying DEFAULT 'pontos'::character varying,
    "periodicidade" periodicidade_kpi NOT NULL DEFAULT 'mensal'::periodicidade_kpi,
    "fonte_dados" character varying,
    "ultima_atualizacao" timestamp with time zone,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_limites_operacionais" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "acao_tipo" text NOT NULL,
    "limite_quantidade" integer NOT NULL DEFAULT 0,
    "periodo" text NOT NULL DEFAULT 'diario'::text,
    "horario_permitido_inicio" time without time zone DEFAULT '00:00:00'::time without time zone,
    "horario_permitido_fim" time without time zone DEFAULT '23:59:59'::time without time zone,
    "limite_financeiro" numeric(15,2),
    "alerta_quando_atingir" numeric(5,2) DEFAULT 80,
    "ativo" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_logs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "provider" text NOT NULL,
    "origem" text,
    "telefone" text,
    "prompt" text,
    "resposta" text,
    "raw_payload" jsonb,
    "criado_em" timestamp with time zone DEFAULT now(),
    "modulo" character varying(100),
    "entrada" text,
    "saida" text,
    "intencao" character varying(100),
    "confianca" numeric,
    "precisa_humano" boolean DEFAULT false,
    "status" character varying(50) DEFAULT 'success'::character varying,
    "erro" text
);

CREATE TABLE IF NOT EXISTS public."ia_metas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "missao_id" uuid NOT NULL,
    "robo_id" uuid NOT NULL,
    "nome_meta" text NOT NULL,
    "descricao" text,
    "tipo" text,
    "valor_meta" numeric(15,2) NOT NULL DEFAULT 0,
    "valor_atual" numeric(15,2) NOT NULL DEFAULT 0,
    "unidade" text DEFAULT 'unidades'::text,
    "periodicidade" periodicidade_meta NOT NULL DEFAULT 'mensal'::periodicidade_meta,
    "peso" numeric(5,2) NOT NULL DEFAULT 1.0,
    "status" status_meta NOT NULL DEFAULT 'ativa'::status_meta,
    "data_referencia_inicio" date,
    "data_referencia_fim" date,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_missoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "nome_missao" text NOT NULL,
    "descricao" text,
    "objetivo_estrategico" text,
    "prioridade" prioridade_missao NOT NULL DEFAULT 'media'::prioridade_missao,
    "status" status_missao NOT NULL DEFAULT 'rascunho'::status_missao,
    "inicio_vigencia" date,
    "fim_vigencia" date,
    "criado_por" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_missoes_execucao" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "missao_id" uuid,
    "titulo" character varying NOT NULL,
    "descricao" text,
    "status" status_execucao_missao NOT NULL DEFAULT 'pendente'::status_execucao_missao,
    "progresso" integer NOT NULL DEFAULT 0,
    "resultado" jsonb DEFAULT '{}'::jsonb,
    "impacto_estimado" character varying,
    "planejamento_id" uuid,
    "total_acoes" integer DEFAULT 0,
    "acoes_concluidas" integer DEFAULT 0,
    "inicio" timestamp with time zone,
    "fim" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_modelos_mensagem" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "setor_id" uuid,
    "nome" text NOT NULL,
    "canal" text DEFAULT 'whatsapp'::text,
    "contexto" text,
    "mensagem" text NOT NULL,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_providers_config" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "provider" character varying(50) NOT NULL,
    "model" character varying(100) NOT NULL,
    "ativo" boolean DEFAULT false,
    "prioridade" integer DEFAULT 99,
    "setor" character varying(50) DEFAULT 'Geral'::character varying,
    "temperatura" numeric DEFAULT 0.7,
    "max_tokens" integer DEFAULT 1024,
    "is_default" boolean DEFAULT false,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_regras" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "setor_id" uuid,
    "titulo" text NOT NULL,
    "instrucoes" text,
    "pode_fazer" text,
    "nao_pode_fazer" text,
    "quando_chamar_humano" text,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_robo_ferramentas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "ferramenta_id" uuid NOT NULL,
    "nivel_autonomia" nivel_autonomia_ferramenta NOT NULL DEFAULT 'EXECUTAR_COM_APROVACAO'::nivel_autonomia_ferramenta,
    "limite_diario" integer,
    "horario_inicio" time without time zone,
    "horario_fim" time without time zone,
    "ativo" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_score_robo" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "performance_score" numeric NOT NULL DEFAULT 0,
    "eficiencia_score" numeric NOT NULL DEFAULT 0,
    "confiabilidade_score" numeric NOT NULL DEFAULT 0,
    "risco_score" numeric NOT NULL DEFAULT 0,
    "score_geral" numeric NOT NULL DEFAULT 0,
    "atualizado_em" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_sessoes_operacionais" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "identidade_id" uuid,
    "motivo" character varying NOT NULL,
    "status" status_sessao_operacional NOT NULL DEFAULT 'ativa'::status_sessao_operacional,
    "contexto_inicial" jsonb DEFAULT '{}'::jsonb,
    "resultado" jsonb DEFAULT '{}'::jsonb,
    "inicio" timestamp with time zone NOT NULL DEFAULT now(),
    "fim" timestamp with time zone,
    "duracao_segundos" integer,
    "total_acoes" integer DEFAULT 0,
    "criado_por" character varying,
    "encerrado_por" character varying,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_setores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "descricao" text,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now(),
    "modo_operacao" text DEFAULT 'manual'::text,
    "fallback_msg" text DEFAULT 'Vou direcionar para o responsavel pelo setor e ja retorno com uma posicao.'::text
);

CREATE TABLE IF NOT EXISTS public."ia_sugestoes_melhoria" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tipo" tipo_sugestao_melhoria NOT NULL,
    "descricao" text NOT NULL,
    "origem_insight_id" uuid,
    "impacto_estimado" text,
    "status" status_sugestao_melhoria NOT NULL DEFAULT 'pendente'::status_sugestao_melhoria,
    "governanca_aprovacao_id" uuid,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_tarefas_automaticas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "setor_id" uuid,
    "titulo" text NOT NULL,
    "descricao" text,
    "tipo_tarefa" text,
    "status" text DEFAULT 'pendente'::text,
    "prioridade" text DEFAULT 'normal'::text,
    "executar_em" timestamp with time zone,
    "executado_em" timestamp with time zone,
    "resultado" text,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_trabalhos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "origem" text NOT NULL DEFAULT 'manual'::text,
    "tipo" text NOT NULL DEFAULT 'outro'::text,
    "titulo" text NOT NULL,
    "descricao" text,
    "prioridade" prioridade_trabalho NOT NULL DEFAULT 'normal'::prioridade_trabalho,
    "status" status_trabalho NOT NULL DEFAULT 'pendente'::status_trabalho,
    "criado_por_robo" uuid,
    "atribuido_por_robo" uuid,
    "data_criacao" timestamp with time zone DEFAULT now(),
    "data_vencimento" timestamp with time zone,
    "data_inicio" timestamp with time zone,
    "data_conclusao" timestamp with time zone,
    "payload" jsonb DEFAULT '{}'::jsonb,
    "resultado" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ia_versoes_sistema" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tipo" tipo_versao_sistema NOT NULL,
    "entidade_id" character varying,
    "versao" integer NOT NULL,
    "snapshot" jsonb NOT NULL,
    "ativo" boolean DEFAULT true,
    "sugerido_por" uuid,
    "aprovado_por" uuid,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."integracoes_config" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tipo" text NOT NULL,
    "nome" text NOT NULL,
    "base_url" text,
    "api_key" text,
    "status" text DEFAULT 'pendente'::text,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."integracoes_logs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "integracao" text,
    "evento" text,
    "status" text,
    "payload" jsonb,
    "resposta" jsonb,
    "erro" text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."leads" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "telefone" text,
    "email" text,
    "empresa" text,
    "origem" text,
    "campanha_id" uuid,
    "tipo_lead" text NOT NULL,
    "status" text DEFAULT 'Novo'::text,
    "responsavel" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."memoria_conhecimento" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "processamento_id" uuid,
    "robo_id" uuid,
    "documento_origem" text NOT NULL,
    "tipo_arquivo" text,
    "conteudo" text NOT NULL,
    "categoria" text,
    "tags" text[] DEFAULT '{}'::text[],
    "data_ref" date DEFAULT CURRENT_DATE,
    "versao" integer NOT NULL DEFAULT 1,
    "score_relevancia" real DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."memoria_conversas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "entidade_tipo" tipo_entidade,
    "entidade_id" text,
    "canal" text DEFAULT 'whatsapp'::text,
    "assunto" text,
    "resumo" text,
    "mensagens_count" integer DEFAULT 0,
    "ultima_mensagem" text,
    "data_inicio" timestamp with time zone,
    "data_fim" timestamp with time zone,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "escopo" escopo_memoria NOT NULL DEFAULT 'compartilhada'::escopo_memoria,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."memoria_entidades" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "entidade_tipo" tipo_entidade NOT NULL DEFAULT 'outro'::tipo_entidade,
    "entidade_id" text NOT NULL,
    "nome" text NOT NULL,
    "resumo" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "escopo" escopo_memoria NOT NULL DEFAULT 'compartilhada'::escopo_memoria,
    "relevancia" real DEFAULT 0.5,
    "ultima_interacao" timestamp with time zone,
    "criado_por_robo" uuid,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."memoria_eventos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "entidade_tipo" tipo_entidade,
    "entidade_id" text,
    "tipo_evento" tipo_evento NOT NULL DEFAULT 'outro'::tipo_evento,
    "titulo" text NOT NULL,
    "descricao" text,
    "data_evento" timestamp with time zone DEFAULT now(),
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "escopo" escopo_memoria NOT NULL DEFAULT 'compartilhada'::escopo_memoria,
    "criado_por_robo" uuid,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."memoria_preferencias" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "entidade_tipo" tipo_entidade,
    "entidade_id" text,
    "chave" text NOT NULL,
    "valor" text NOT NULL,
    "tipo" text DEFAULT 'texto'::text,
    "categoria" text DEFAULT 'geral'::text,
    "aprendido_automaticamente" boolean DEFAULT false,
    "escopo" escopo_memoria NOT NULL DEFAULT 'compartilhada'::escopo_memoria,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."memoria_resumos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "entidade_tipo" tipo_entidade,
    "entidade_id" text,
    "sumario" text NOT NULL,
    "nivel_detalhe" text DEFAULT 'normal'::text,
    "periodo_referencia" text,
    "gerado_por" uuid,
    "origem_dados" text[] DEFAULT '{}'::text[],
    "escopo" escopo_memoria NOT NULL DEFAULT 'compartilhada'::escopo_memoria,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."modelos_mensagens" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "titulo" text NOT NULL,
    "categoria" text DEFAULT 'geral'::text,
    "texto" text,
    "cliente_id" uuid,
    "cliente_nome" text,
    "cliente_documento" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."motorista_app_sessoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "motorista_id" uuid,
    "token" text NOT NULL,
    "ativo" boolean DEFAULT true,
    "criado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."motorista_checkins" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "prestador_id" uuid,
    "escala_id" uuid,
    "tipo" text NOT NULL,
    "latitude" numeric,
    "longitude" numeric,
    "observacao" text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."municipios_ibge" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "codigo" text NOT NULL,
    "nome" text NOT NULL,
    "uf" text NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."ocorrencias" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "os_id" uuid,
    "alocacao_id" uuid,
    "prestador_id" uuid,
    "prestador" text,
    "cliente_id" uuid,
    "tipo" text NOT NULL,
    "descricao" text,
    "status" text DEFAULT 'pendente'::text,
    "severidade" text DEFAULT 'media'::text,
    "prioridade" text DEFAULT 'normal'::text,
    "visivel_cliente" boolean DEFAULT false,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "evidencias" jsonb DEFAULT '[]'::jsonb,
    "resolvida_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."operacao_localizacao" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "escala_id" uuid,
    "latitude" numeric NOT NULL,
    "longitude" numeric NOT NULL,
    "velocidade" numeric,
    "status" text,
    "atualizado_em" timestamp with time zone DEFAULT now(),
    "origem" text,
    "alocacao_id" uuid,
    "os_id" uuid,
    "prestador_id" uuid,
    "tenant_id" uuid,
    "precisao" numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."operacao_mensagens" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "alocacao_id" uuid NOT NULL,
    "os_id" uuid,
    "prestador_id" uuid,
    "sender_type" text NOT NULL DEFAULT 'prestador'::text,
    "sender_user_id" uuid,
    "mensagem" text NOT NULL,
    "status" text NOT NULL DEFAULT 'enviada'::text,
    "read_at" timestamp with time zone,
    "idempotency_key" text,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."operacoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "regiao_carregamento" text,
    "veiculo" text,
    "status" text NOT NULL DEFAULT 'ativo'::text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."operation_km" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "operation_id" uuid,
    "driver_id" uuid,
    "km_inicial" integer,
    "km_final" integer,
    "foto_km_inicial_url" text,
    "foto_km_final_url" text,
    "km_rodado" integer,
    "km_adicional" integer,
    "valor_adicional_estimado" double precision,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."operation_timeline_events" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "operation_id" text NOT NULL,
    "stop_id" text,
    "driver_id" text NOT NULL,
    "type" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "latitude" double precision,
    "longitude" double precision,
    "accuracy" double precision,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "synced" boolean DEFAULT true,
    "event_time" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."orcamentos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "cliente_id" uuid,
    "descricao" text,
    "valor_base" numeric,
    "valor_final" numeric,
    "distancia_rota" jsonb,
    "frete_sugerido" jsonb,
    "status" text,
    "endereco" jsonb,
    "carga" jsonb,
    "veiculo" jsonb,
    "valores" jsonb,
    "motivoreprovacao" text,
    "numero" text,
    "enderecos" jsonb DEFAULT '[]'::jsonb,
    "carga_ajudante" boolean DEFAULT false,
    "carga_refrigerado" boolean DEFAULT false,
    "carga_fragil" boolean DEFAULT false,
    "carga_pallets" numeric,
    "carga_cubagem" numeric,
    "carga_peso" numeric,
    "carga_volumes" numeric,
    "carga_valor_declarado" numeric,
    "carga_descricao" text,
    "veiculo_tipo" text,
    "pedagio" numeric DEFAULT 0,
    "adicionais" numeric DEFAULT 0,
    "descontos" numeric DEFAULT 0,
    "custo_estimado" numeric DEFAULT 0,
    "unidade" text,
    "centro_custo" text,
    "responsavel" text,
    "modalidade" text,
    "prioridade" text,
    "pedido_interno" text,
    "observacoes_gerais" text,
    "cliente_cnpj" text,
    "cliente" text,
    "data_emissao" date,
    "validade" date,
    "tipo_operacao" text,
    "carga_tipo" text,
    "carga_refrigerada" boolean DEFAULT false,
    "carga_empilhavel" boolean DEFAULT false,
    "carga_risco" boolean DEFAULT false,
    "veiculo_termica" text,
    "historico" jsonb DEFAULT '[]'::jsonb,
    "motivo_reprovacao" text,
    "carga_perigosa" boolean DEFAULT false,
    "carga_controlada" boolean DEFAULT false,
    "os_vinculada_id" uuid,
    "os_vinculada_numero" text
);

CREATE TABLE IF NOT EXISTS public."ordens_servico" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "numero" text,
    "cliente" uuid,
    "prestador" uuid,
    "veiculo_alocado" uuid,
    "status" text DEFAULT 'pendente'::text,
    "data" date,
    "tipo_operacao" text,
    "carga_tipo" text,
    "peso" numeric,
    "volumes" integer,
    "created_at" timestamp without time zone DEFAULT now(),
    "updated_at" timestamp without time zone DEFAULT now(),
    "adicionais" jsonb,
    "ajudante" jsonb,
    "cargaadicional" jsonb,
    "cargaAdicional" jsonb,
    "correios" text,
    "historico" jsonb DEFAULT '[]'::jsonb,
    "unidade" text,
    "centro_custo" text,
    "modalidade" text,
    "prioridade" text,
    "pedagio" numeric,
    "custo_prestador" numeric,
    "valor_cliente" numeric,
    "status_faturamento" text,
    "status_pagamento" text,
    "distancia_rota" jsonb,
    "enderecos" jsonb DEFAULT '[]'::jsonb,
    "carga_ajudante" boolean DEFAULT false,
    "carga_refrigerada" boolean DEFAULT false,
    "carga_fragil" boolean DEFAULT false,
    "pallets" numeric,
    "cubagem" numeric,
    "valor_declarado" numeric,
    "carga_descricao" text,
    "veiculo_tipo" text,
    "veiculo_termica" text,
    "carga_empilhavel" boolean DEFAULT false,
    "cliente_id" text,
    "prestador_id" text,
    "carga_refrigerado" boolean DEFAULT false,
    "carga_risco" boolean DEFAULT false,
    "frete_sugerido" jsonb,
    "ocorrencias" jsonb DEFAULT '[]'::jsonb,
    "documentos" jsonb DEFAULT '[]'::jsonb,
    "anexos" jsonb DEFAULT '[]'::jsonb,
    "carga_perigosa" boolean DEFAULT false,
    "carga_controlada" boolean DEFAULT false,
    "carga" jsonb,
    "tipo_veiculo" text,
    "data_servico" timestamp with time zone,
    "centro_custo_inicio" text,
    "centro_custo_fim" text,
    "conta_contabil" text,
    "tabela_aplicada" text,
    "faturamento_status" text DEFAULT 'A Faturar'::text,
    "repasse_status" text DEFAULT 'Pendente p/ Extração'::text,
    "outros_custos_prev" numeric DEFAULT 0,
    "valor_prestador_calculado" numeric DEFAULT 0,
    "imposto_valor" numeric DEFAULT 0,
    "seguro_valor" numeric DEFAULT 0,
    "pedagio_valor" numeric DEFAULT 0,
    "outros_custos" numeric DEFAULT 0,
    "margem_bruta" numeric DEFAULT 0,
    "margem_liquida" numeric DEFAULT 0,
    "percentual_margem_liquida" numeric DEFAULT 0,
    "centro_custo_fin" text,
    "comprovante_obrigatorio" boolean DEFAULT false,
    "cte_obrigatorio" boolean DEFAULT false,
    "data_programada" date,
    "inicio_previsto" timestamp without time zone,
    "placa_alocada" text,
    "parceiro_id" uuid,
    "enviar_whatsapp" boolean DEFAULT false,
    "forma_cobranca" text,
    "descontos" numeric DEFAULT 0,
    "email_destinatario" text,
    "nome_destinatario" text,
    "telefone_destinatario" text,
    "observacoes" text,
    "tipo_carga" text,
    "valor_total" numeric DEFAULT 0,
    "eventos_tracker" jsonb DEFAULT '[]'::jsonb,
    "faixa_aplicada" text,
    "distancia_km" numeric DEFAULT 0,
    "tempo_minutos" numeric DEFAULT 0,
    "valor_prestador" numeric DEFAULT 0,
    "margem" numeric DEFAULT 0,
    "origem" text,
    "destino" text,
    "desconto" numeric DEFAULT 0,
    "veiculo" text,
    "instrucoes_operacionais_os" text,
    "is_reserva" boolean DEFAULT false,
    "xml_obrigatorio" boolean DEFAULT false,
    "operacao_dedicada" boolean DEFAULT false,
    "retorno_obrigatorio" boolean DEFAULT false,
    "notificar_destinatario" boolean DEFAULT true,
    "orcamento_origem" text,
    "veiculo_subcategoria" text,
    "veiculo_carroceria" text,
    "data_agendada" text,
    "observacao_agendamento" text,
    "janela_operacional" text,
    "previsao_inicio" text,
    "previsao_termino" text,
    "tipo_escala" text,
    "instrucoes_operacionais" text,
    "observacao_torre" text,
    "whatsapp_destinatario" text,
    "veiculo_sugerido" text,
    "recebedor_nome" text,
    "recebedor_documento" text,
    "reembolso_previsto" numeric DEFAULT 0,
    "lucro_estimado" numeric DEFAULT 0,
    "margem_lucro" numeric DEFAULT 0,
    "tempo_estimado" numeric DEFAULT 0,
    "localizacao_entrega_json" jsonb,
    "observacoes_gerais" text,
    "orcamento_id" uuid,
    "numero_orcamento" text,
    "tenant_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
    "tipo_reversa" text DEFAULT 'sem_reversa'::text,
    "reversa_qtd_volumes" integer DEFAULT 0,
    "reversa_observacoes" text,
    "romaneio" text,
    "pedido_portal_id" uuid,
    "is_teste" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."os_historico" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "ordem_servico_id" uuid,
    "descricao" text,
    "created_at" timestamp without time zone DEFAULT now(),
    "acao" text,
    "status_novo" text,
    "usuario" text,
    "os_id" uuid
);

CREATE TABLE IF NOT EXISTS public."os_ocorrencias" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "ordem_servico_id" uuid NOT NULL,
    "prestador_id" uuid,
    "tipo" text,
    "descricao" text,
    "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."os_pod" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "ordem_servico_id" uuid NOT NULL,
    "prestador_id" uuid,
    "nome_recebedor" text,
    "grau_proximidade" text,
    "documento_recebedor" text,
    "observacao" text,
    "foto_url" text,
    "created_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."pagamento_prestadores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "os_id" uuid,
    "prestador_id" uuid,
    "valor" numeric,
    "status" text DEFAULT 'pendente'::text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."pagamentos_prestadores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "prestador_id" uuid,
    "prestador_nome" text,
    "prestador_documento" text,
    "periodo_inicio" date NOT NULL,
    "periodo_fim" date NOT NULL,
    "quantidade_os" integer DEFAULT 0,
    "valor_servicos" numeric(10,2) DEFAULT 0,
    "valor_reembolsos" numeric(10,2) DEFAULT 0,
    "valor_bonus" numeric(10,2) DEFAULT 0,
    "valor_descontos" numeric(10,2) DEFAULT 0,
    "valor_adiantamentos" numeric(10,2) DEFAULT 0,
    "valor_liquido" numeric(10,2) DEFAULT 0,
    "status" text DEFAULT 'pendente'::text,
    "data_pagamento" date,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "os_id" uuid,
    "qtd_os" integer DEFAULT 0,
    "pedagio" numeric DEFAULT 0,
    "reembolsos" numeric DEFAULT 0,
    "adicionais" numeric DEFAULT 0,
    "descontos" numeric DEFAULT 0,
    "adiantamentos" numeric DEFAULT 0,
    "multas" numeric DEFAULT 0,
    "ajustes" numeric DEFAULT 0,
    "status_conferencia" text DEFAULT 'em_aberto'::text,
    "status_aprovacao" text DEFAULT 'aguardando_aprovacao'::text,
    "status_pagamento" text DEFAULT 'pendente'::text,
    "origem_lancamento" text DEFAULT 'manual'::text,
    "tipo_pagamento" text,
    "categoria_financeira" text,
    "centro_custo" text,
    "conta_contabil" text,
    "competencia" date,
    "data_prevista_pagamento" date,
    "elegivel_lote" boolean DEFAULT false,
    "lote_id" uuid,
    "impacto_dre" boolean DEFAULT true,
    "impacto_fluxo_caixa" boolean DEFAULT true,
    "observacao" text,
    "os_numero" text,
    "tipo_lancamento" text DEFAULT 'Serviço Escala'::text,
    "natureza" text DEFAULT 'credito'::text,
    "data_competencia" date,
    "is_teste" boolean NOT NULL DEFAULT false,
    "classificacao_dado" text,
    "fechamento_id" uuid,
    "data_conferencia" timestamp with time zone,
    "data_aprovacao" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."pagamentos_prestadores_itens" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "pagamento_id" uuid,
    "os_id" uuid,
    "os_numero" text,
    "valor_servico" numeric(10,2) DEFAULT 0,
    "pedagio" numeric(10,2) DEFAULT 0,
    "adicional" numeric(10,2) DEFAULT 0,
    "valor_reembolso" numeric(10,2) DEFAULT 0,
    "valor_bonus" numeric(10,2) DEFAULT 0,
    "valor_desconto" numeric(10,2) DEFAULT 0,
    "status" text DEFAULT 'pendente'::text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patio_alertas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "checkin_id" uuid,
    "tipo" patio_alerta_tipo NOT NULL,
    "mensagem" text NOT NULL,
    "resolvido" boolean DEFAULT false,
    "resolvido_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patio_checkins" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "unidade_id" uuid,
    "ordem_servico_id" uuid,
    "numero_os" text,
    "cliente_id" uuid,
    "cliente_nome" text,
    "prestador_id" uuid,
    "prestador_nome" text,
    "motorista_nome" text,
    "veiculo_id" uuid,
    "veiculo_placa" text NOT NULL,
    "veiculo_tipo" text,
    "tipo_carga" text,
    "origem" text,
    "destino" text,
    "horario_previsto" timestamp with time zone,
    "horario_chegada" timestamp with time zone,
    "horario_saida" timestamp with time zone,
    "documento" text,
    "observacao" text,
    "status" patio_status DEFAULT 'previsto'::patio_status,
    "posicao_fila" integer DEFAULT 0,
    "prioridade" integer DEFAULT 0,
    "doca_id" uuid,
    "doca_nome" text,
    "chamado_para_doca_em" timestamp with time zone,
    "carregamento_inicio" timestamp with time zone,
    "carregamento_fim" timestamp with time zone,
    "carregamento_pausa_motivo" text,
    "carregamento_pausa_inicio" timestamp with time zone,
    "tempo_aguardando_min" integer DEFAULT 0,
    "tempo_carregando_min" integer DEFAULT 0,
    "tempo_total_min" integer DEFAULT 0,
    "sla_espera_min" integer DEFAULT 120,
    "risco_atraso" boolean DEFAULT false,
    "liberado_por" uuid,
    "checkin_origem" text DEFAULT 'operacao'::text,
    "fotos" jsonb DEFAULT '[]'::jsonb,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "created_by" uuid
);

CREATE TABLE IF NOT EXISTS public."patio_docas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "unidade_id" uuid,
    "nome" text NOT NULL,
    "status" patio_doca_status DEFAULT 'disponivel'::patio_doca_status,
    "tipo_permitido" text[] DEFAULT '{}'::text[],
    "capacidade_kg" numeric(12,2),
    "restricoes" text[] DEFAULT '{}'::text[],
    "veiculo_atual_id" uuid,
    "previsao_liberacao" timestamp with time zone,
    "observacoes" text,
    "posicao" integer DEFAULT 0,
    "config" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patio_eventos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "checkin_id" uuid NOT NULL,
    "tipo_evento" text NOT NULL,
    "status_anterior" patio_status,
    "status_novo" patio_status NOT NULL,
    "descricao" text,
    "responsavel_nome" text,
    "responsavel_id" uuid,
    "origem" text DEFAULT 'operacao'::text,
    "localizacao" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patio_fila" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "checkin_id" uuid NOT NULL,
    "unidade_id" uuid,
    "posicao" integer NOT NULL DEFAULT 1,
    "posicao_anterior" integer,
    "criterio_ordenacao" patio_criterio_fila DEFAULT 'ordem_chegada'::patio_criterio_fila,
    "criterio_detalhe" text,
    "doca_sugerida_id" uuid,
    "sla_espera_min" integer DEFAULT 120,
    "risco_atraso" boolean DEFAULT false,
    "entrou_na_fila_em" timestamp with time zone DEFAULT now(),
    "chamado_em" timestamp with time zone,
    "chamado_por" uuid,
    "status" text DEFAULT 'aguardando'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patio_regras_fila" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "unidade_id" uuid,
    "criterio" patio_criterio_fila NOT NULL,
    "ativo" boolean DEFAULT true,
    "ordem" integer DEFAULT 1,
    "config" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patio_rodizio" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "unidade_id" uuid,
    "tipo" patio_tipo_rodizio NOT NULL,
    "entidade_id" uuid,
    "entidade_nome" text NOT NULL,
    "ultimo_chamado_em" timestamp with time zone,
    "proximo_na_fila" integer DEFAULT 1,
    "justificativa" text,
    "config" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."patio_unidades" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "nome" text NOT NULL,
    "endereco" text,
    "capacidade_total" integer DEFAULT 0,
    "capacidade_atual" integer DEFAULT 0,
    "status" text DEFAULT 'ativo'::text,
    "config" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "created_by" uuid
);

CREATE TABLE IF NOT EXISTS public."pending_uploads" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "local_path" text NOT NULL,
    "type" text NOT NULL,
    "driver_id" text NOT NULL,
    "operation_id" text,
    "stop_id" text,
    "storage_path" text,
    "status" text DEFAULT 'pending'::text,
    "attempts" integer DEFAULT 0,
    "last_error" text,
    "uploaded_url" text,
    "sha256" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."perfis_permissoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "papel" text NOT NULL,
    "modulo" text NOT NULL,
    "pode_ver" boolean DEFAULT false,
    "pode_editar" boolean DEFAULT false,
    "pode_excluir" boolean DEFAULT false,
    "descricao" text,
    "criado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."permissoes_prestador" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "pode_ver_os" boolean DEFAULT true,
    "pode_ver_valores" boolean DEFAULT false,
    "pode_ver_clientes" boolean DEFAULT false,
    "pode_aceitar_servico" boolean DEFAULT true,
    "pode_ver_financeiro" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."portal_avaliacoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "os_id" uuid,
    "prestador_id" uuid,
    "nota" integer NOT NULL,
    "nps" integer,
    "comentario" text,
    "canal" text DEFAULT 'portal'::text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."portal_comprovantes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "os_id" uuid,
    "prestador_id" uuid,
    "veiculo_id" uuid,
    "tipo" text NOT NULL DEFAULT 'entrega'::text,
    "titulo" text NOT NULL,
    "url" text,
    "nome_recebedor" text,
    "documento_recebedor" text,
    "data_entrega" timestamp with time zone,
    "latitude" numeric,
    "longitude" numeric,
    "fotos" jsonb DEFAULT '[]'::jsonb,
    "assinatura_url" text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."portal_faturas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "numero" text NOT NULL,
    "competencia" text NOT NULL,
    "valor" numeric DEFAULT 0,
    "vencimento" date,
    "status" text DEFAULT 'aberta'::text,
    "url_boleto" text,
    "url_nf" text,
    "os_ids" jsonb DEFAULT '[]'::jsonb,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."portal_notificacoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "os_id" uuid,
    "tipo" text NOT NULL DEFAULT 'sistema'::text,
    "titulo" text NOT NULL,
    "mensagem" text NOT NULL,
    "canal" text DEFAULT 'portal'::text,
    "lida" boolean DEFAULT false,
    "prioridade" text DEFAULT 'normal'::text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "referencia_id" uuid,
    "event_type" text,
    "prestador_id" uuid,
    "origem_id" uuid,
    "origem_tipo" text
);

CREATE TABLE IF NOT EXISTS public."portal_ocorrencias" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "tipo" text NOT NULL DEFAULT 'outro'::text,
    "descricao" text,
    "prioridade" text DEFAULT 'media'::text,
    "status" text DEFAULT 'aberta'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."portal_pedidos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "numero_pedido" text,
    "status" text DEFAULT 'rascunho'::text,
    "solicitante_nome" text,
    "solicitante_email" text,
    "solicitante_telefone" text,
    "filial" text,
    "centro_custo" text,
    "prioridade" text DEFAULT 'normal'::text,
    "coleta_cep" text,
    "coleta_rua" text,
    "coleta_numero" text,
    "coleta_complemento" text,
    "coleta_bairro" text,
    "coleta_cidade" text,
    "coleta_uf" text,
    "coleta_referencia" text,
    "coleta_data" timestamp with time zone,
    "entrega_destinatario" text,
    "entrega_telefone" text,
    "entrega_email" text,
    "entrega_notificar_whatsapp" boolean DEFAULT false,
    "entrega_notificar_email" boolean DEFAULT false,
    "entrega_cep" text,
    "entrega_rua" text,
    "entrega_numero" text,
    "entrega_complemento" text,
    "entrega_bairro" text,
    "entrega_cidade" text,
    "entrega_uf" text,
    "entrega_referencia" text,
    "entrega_data" timestamp with time zone,
    "descricao" text,
    "volumes" integer DEFAULT 1,
    "peso" numeric DEFAULT 0,
    "comprimento" numeric DEFAULT 0,
    "largura" numeric DEFAULT 0,
    "altura" numeric DEFAULT 0,
    "valor_declarado" numeric DEFAULT 0,
    "tipo_carga" text,
    "observacoes" text,
    "veiculo_sugerido" text,
    "prazo_estimado" text,
    "payload_n8n" jsonb DEFAULT '{}'::jsonb,
    "os_vinculada_id" uuid,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "data_solicitada" timestamp with time zone,
    "horario_solicitado" text,
    "solicitacao_via" text DEFAULT 'portal_cliente'::text,
    "tipo_veiculo" text,
    "mercadoria" text,
    "erro_processamento" text,
    "codigo_erro" text,
    "tentativas_processamento" integer DEFAULT 0,
    "ultima_tentativa_em" timestamp with time zone,
    "escala_id" uuid,
    "alocacao_id" uuid,
    "rota_id" uuid,
    "processado_em" timestamp with time zone,
    "idempotency_key" text,
    "origem" text DEFAULT 'portal_cliente'::text,
    "converted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."portal_preferencias_cliente" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "logo_url" text,
    "cor_primaria" text DEFAULT '#F97316'::text,
    "nome_exibicao" text,
    "notificacoes" jsonb DEFAULT '{"sms": false, "push": true, "email": true}'::jsonb,
    "permissoes" jsonb DEFAULT '{}'::jsonb,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."portal_protocolos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "os_id" uuid,
    "comprovante_id" uuid,
    "protocolo" text NOT NULL,
    "status" text DEFAULT 'pendente'::text,
    "recebedor" text,
    "horario" timestamp with time zone,
    "localizacao" jsonb DEFAULT '{}'::jsonb,
    "eventos" jsonb DEFAULT '[]'::jsonb,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "parada_id" uuid
);

CREATE TABLE IF NOT EXISTS public."portal_relatorios" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "tipo" text NOT NULL,
    "titulo" text NOT NULL,
    "periodo_inicio" date,
    "periodo_fim" date,
    "url" text,
    "formato" text DEFAULT 'csv'::text,
    "filtros" jsonb DEFAULT '{}'::jsonb,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."portal_rotas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "nome" text NOT NULL,
    "status" text DEFAULT 'rascunho'::text,
    "destinos" jsonb DEFAULT '[]'::jsonb,
    "veiculos_sugeridos" jsonb DEFAULT '[]'::jsonb,
    "km_estimado" numeric DEFAULT 0,
    "tempo_estimado_min" integer DEFAULT 0,
    "custo_estimado" numeric DEFAULT 0,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."portal_tracking_realtime" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "os_id" uuid,
    "prestador_id" uuid,
    "veiculo_id" uuid,
    "status" text DEFAULT 'offline'::text,
    "latitude" numeric,
    "longitude" numeric,
    "eta_min" integer,
    "velocidade" numeric,
    "bateria" numeric,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "updated_at" timestamp with time zone DEFAULT now(),
    "alocacao_id" uuid,
    "captured_at" timestamp with time zone,
    "precisao" numeric,
    "direcao" numeric,
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "created_at" timestamp with time zone DEFAULT now(),
    "origem" text DEFAULT 'app_motorista'::text
);

CREATE TABLE IF NOT EXISTS public."postagens" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "data_planejada" date,
    "canal" text,
    "conteudo" text,
    "status" text DEFAULT 'Rascunho'::text,
    "observacoes" text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."prestador_disponibilidade" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "prestador_id" uuid NOT NULL,
    "disponivel" boolean DEFAULT true,
    "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."prestador_os" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "prestador_id" uuid NOT NULL,
    "ordem_servico_id" uuid NOT NULL,
    "status" text DEFAULT 'disponivel'::text,
    "created_at" timestamp without time zone DEFAULT now(),
    "updated_at" timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."prestadores" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "nome_completo" text,
    "cpf_cnpj" text,
    "telefone" text,
    "whatsapp" text,
    "email" text,
    "tipo_parceiro" text,
    "status" text DEFAULT 'ativo'::text,
    "regiao_principal" text,
    "endereco" jsonb,
    "created_at" timestamp without time zone DEFAULT now(),
    "updated_at" timestamp without time zone DEFAULT now(),
    "data_nascimento" date,
    "rg" text,
    "aceite_acordo" boolean DEFAULT false,
    "score_interno" numeric,
    "status_operacional" text,
    "observacoes" text,
    "aceiteDoacordo" boolean DEFAULT false,
    "aceita_dedicada" boolean DEFAULT false,
    "aceita_urbana" boolean DEFAULT false,
    "aceita_refrigerada" boolean DEFAULT false,
    "aceita_esporadica" boolean DEFAULT false,
    "conferend_manual" boolean DEFAULT false,
    "aceita_refrigerado" boolean DEFAULT false,
    "aceita_urbano" boolean DEFAULT false,
    "aceita_dedicado" boolean DEFAULT false,
    "conferencia_manual" boolean DEFAULT false,
    "indice_comparecimento" numeric(5,2) DEFAULT 0,
    "indice_entrega_prazo" numeric(5,2) DEFAULT 0,
    "ultima_atualizacao" timestamp without time zone DEFAULT now(),
    "data_cadastro" date,
    "data_aprovacao" date,
    "ultimo_usuario" text,
    "observacoes_torre" text,
    "avaliacao_operacional" text,
    "indice_aceite" numeric(5,2) DEFAULT 0,
    "qtd_operacoes" integer DEFAULT 0,
    "foto" text,
    "regioes_secundarias" text[],
    "origem_cadastro" text,
    "indicacao" text,
    "disponibilidade_padrao" text,
    "turnos_preferenciais" text,
    "restricoes_operacionais" text,
    "aceita_viagem" boolean DEFAULT false,
    "banco" text,
    "agencia" text,
    "conta" text,
    "digito" text,
    "tipo_conta" text,
    "favorecido" text,
    "cpf_cnpj_favorecido" text,
    "chave_pix" text,
    "tipo_chave_pix" text,
    "valor_diaria" numeric(12,2),
    "valor_km" numeric(12,2),
    "valor_saida" numeric(12,2),
    "fixo_mensal" numeric(12,2),
    "valor_ajudante" numeric(12,2),
    "valor_espera" numeric(12,2),
    "valor_reentrega" numeric(12,2),
    "valor_devolucao" numeric(12,2),
    "periodicidade_pagamento" text,
    "prazo_pagamento" text,
    "forma_preferencial" text,
    "conta_contabil" text,
    "centro_custo" text,
    "retencoes_descontos" text,
    "observacoes_financeiras" text,
    "rg_ie" text,
    "franquia_km" numeric(10,2),
    "forma_preferencial_pagamento" text,
    "retencoes" text,
    "rntrc" text,
    "antt" text,
    "auth_user_id" uuid,
    "origem" text DEFAULT 'manual'::text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "liberado_app" boolean DEFAULT false,
    "nome_fantasia" text
);

CREATE TABLE IF NOT EXISTS public."prestadores_app" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "nome" text NOT NULL,
    "email" text NOT NULL,
    "telefone" text,
    "cpf_cnpj" text,
    "tipo_veiculo" text DEFAULT 'Fiorino'::text,
    "placa" text,
    "refrigerado" boolean DEFAULT false,
    "antt" text,
    "categoria_cnh" text DEFAULT 'B'::text,
    "status_operacional" text NOT NULL DEFAULT 'Em análise'::text,
    "nivel_motorista" text DEFAULT 'Bronze'::text,
    "score" numeric(3,1) DEFAULT 0.0,
    "cep" text,
    "rua" text,
    "numero" text,
    "cidade" text,
    "uf" text,
    "pix" text,
    "banco" text,
    "agencia" text,
    "conta" text,
    "data_nascimento" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."prestadores_ocorrencias" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "prestador_id" uuid,
    "data" date DEFAULT CURRENT_DATE,
    "tipo" text,
    "gravidade" text,
    "status" text DEFAULT 'aberta'::text,
    "descricao" text,
    "registrado_por" text DEFAULT 'Sistema'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."processamento_fila" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "academia_material_id" uuid,
    "curso_id" uuid,
    "robo_id" uuid,
    "nome_original" text NOT NULL,
    "tipo_arquivo" text NOT NULL,
    "mime_type" text,
    "tamanho_bytes" bigint DEFAULT 0,
    "storage_path" text,
    "bucket" text DEFAULT 'biblioteca-global'::text,
    "responsavel" text,
    "robos_autorizados" uuid[] DEFAULT '{}'::uuid[],
    "status" status_processamento NOT NULL DEFAULT 'aguardando_processamento'::status_processamento,
    "erro" text,
    "tentativas" integer NOT NULL DEFAULT 0,
    "max_tentativas" integer NOT NULL DEFAULT 3,
    "tempo_processamento_ms" integer,
    "data_envio" timestamp with time zone DEFAULT now(),
    "data_processamento" timestamp with time zone,
    "data_conclusao" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."provider_documents" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "prestador_id" uuid,
    "tipo" text NOT NULL DEFAULT 'outros'::text,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "validade" date,
    "url" text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."raciocinio_auditoria" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid,
    "processo_id" text NOT NULL,
    "documento_utilizado" text,
    "trechos_considerados" text[] DEFAULT '{}'::text[],
    "pergunta" text,
    "decisao" text,
    "acao_executada" text,
    "contexto" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."rascunhos_prestador" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cpf_cnpj" text NOT NULL,
    "current_step" integer NOT NULL DEFAULT 0,
    "dados" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'em_preenchimento'::text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "draft_token" uuid NOT NULL DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public."recibos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "numero" text NOT NULL,
    "data_emissao" date NOT NULL DEFAULT CURRENT_DATE,
    "favorecido_tipo" text NOT NULL DEFAULT 'outro'::text,
    "favorecido_nome" text NOT NULL,
    "favorecido_documento" text,
    "valor" numeric(14,2) NOT NULL DEFAULT 0,
    "valor_extenso" text,
    "referencia" text,
    "forma_pagamento" text,
    "conta_financeira" text,
    "os_numero" text,
    "observacoes" text,
    "status" text NOT NULL DEFAULT 'emitido'::text,
    "motivo_cancelamento" text,
    "data_cancelamento" timestamp with time zone,
    "usuario_criador" text,
    "usuario_cancelou" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."recrutamento_automacoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "tipo" text NOT NULL,
    "trigger" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "acao" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'ativa'::text,
    "ultima_execucao" timestamp with time zone,
    "total_execucoes" integer NOT NULL DEFAULT 0,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."recrutamento_candidatos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL DEFAULT ''::text,
    "foto" text DEFAULT ''::text,
    "score" integer DEFAULT 50,
    "cidade" text DEFAULT ''::text,
    "uf" text DEFAULT ''::text,
    "veiculo" text DEFAULT ''::text,
    "placa" text DEFAULT ''::text,
    "status_documental" text DEFAULT 'pendente'::text,
    "prioridade" text DEFAULT 'media'::text,
    "validade_cnh" text DEFAULT 'valida'::text,
    "data_validade_cnh" text DEFAULT ''::text,
    "tags" jsonb DEFAULT '[]'::jsonb,
    "observacoes_ia" text DEFAULT ''::text,
    "telefone" text DEFAULT ''::text,
    "email" text DEFAULT ''::text,
    "stage" text DEFAULT 'novo_cadastro'::text,
    "data_entrada" text DEFAULT ''::text,
    "data_atualizacao" text DEFAULT ''::text,
    "documentos" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "prestador_id" uuid,
    "historico" jsonb DEFAULT '[]'::jsonb,
    "reserva_contexto" jsonb,
    "score_comprometimento" integer DEFAULT 0,
    "classificacao_comprometimento" text,
    "risco_desistencia" text,
    "tempo_medio_resposta_horas" numeric,
    "quantidade_cobrancas" integer DEFAULT 0,
    "confirmou_interesse" boolean DEFAULT false,
    "data_confirmacao_interesse" timestamp with time zone,
    "confirmou_pre_inicio" boolean DEFAULT false,
    "data_confirmacao_pre_inicio" timestamp with time zone,
    "compareceu_primeiro_dia" boolean DEFAULT false,
    "completou_30_dias" boolean DEFAULT false,
    "quantidade_reclamacoes" integer DEFAULT 0,
    "possui_outra_operacao_fixa" boolean DEFAULT false,
    "disponibilidade_recrutamento" text,
    "historico_desistencias" integer DEFAULT 0,
    "etiquetas_automaticas" jsonb DEFAULT '[]'::jsonb,
    "parecer_ia" text,
    "principais_riscos" jsonb DEFAULT '[]'::jsonb,
    "principais_pontos_positivos" jsonb DEFAULT '[]'::jsonb,
    "proxima_acao_sugerida" text,
    "questionario_respostas" jsonb,
    "pipeline_validacoes" jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public."recrutamento_ia_config" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "manual_empresa" text,
    "regras_permitidas" text,
    "regras_bloqueadas" text,
    "ia_ativa" boolean NOT NULL DEFAULT true,
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."recrutamento_operacoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL DEFAULT ''::text,
    "cliente" text NOT NULL DEFAULT ''::text,
    "regiao" text NOT NULL DEFAULT ''::text,
    "rota_origem" text DEFAULT ''::text,
    "rota_destino" text DEFAULT ''::text,
    "tipo_veiculo" text DEFAULT ''::text,
    "tipo_carga" text DEFAULT 'seco'::text,
    "metodo_carga" text DEFAULT 'paletizado'::text,
    "temperatura" text DEFAULT ''::text,
    "peso_carga" text DEFAULT ''::text,
    "dimensoes" text DEFAULT ''::text,
    "local_carregamento" text DEFAULT ''::text,
    "local_descarregamento" text DEFAULT ''::text,
    "horario_carregamento" text DEFAULT ''::text,
    "horario_descarregamento" text DEFAULT ''::text,
    "data_inicio" text DEFAULT ''::text,
    "data_fim" text DEFAULT ''::text,
    "recurrencia" text DEFAULT 'unica'::text,
    "frequencia" text DEFAULT 'fixa'::text,
    "status" text DEFAULT 'aberta'::text,
    "prioridade" text DEFAULT 'media'::text,
    "observacoes" text DEFAULT ''::text,
    "financeiro" jsonb DEFAULT '{}'::jsonb,
    "meta" jsonb DEFAULT '{}'::jsonb,
    "historico" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "created_by" text DEFAULT 'admin'::text
);

CREATE TABLE IF NOT EXISTS public."recrutamento_prestadores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL DEFAULT ''::text,
    "razao_social" text DEFAULT ''::text,
    "cpf_cnpj" text DEFAULT ''::text,
    "rg" text DEFAULT ''::text,
    "data_nascimento" text DEFAULT ''::text,
    "contatos" jsonb DEFAULT '[]'::jsonb,
    "endereco" jsonb DEFAULT '{}'::jsonb,
    "tipo_veiculo" text DEFAULT ''::text,
    "placa_veiculo" text DEFAULT ''::text,
    "eixos" integer DEFAULT 0,
    "capacidade_kg" integer DEFAULT 0,
    "capacidade_m3" integer DEFAULT 0,
    "tipo_carga_veiculo" text DEFAULT 'seco'::text,
    "disponibilidade" text DEFAULT ''::text,
    "regioes_atuacao" jsonb DEFAULT '[]'::jsonb,
    "origem_cadastro" text DEFAULT 'site'::text,
    "status" text DEFAULT 'novo'::text,
    "score" jsonb DEFAULT '{}'::jsonb,
    "documentos" jsonb DEFAULT '[]'::jsonb,
    "onboarding" text DEFAULT 'nao_iniciado'::text,
    "canal_captacao" text DEFAULT 'site'::text,
    "indicado_por" text DEFAULT ''::text,
    "historico" jsonb DEFAULT '{}'::jsonb,
    "data_cadastro" text DEFAULT ''::text,
    "data_ativacao" text DEFAULT ''::text,
    "ultima_atividade" text DEFAULT ''::text,
    "observacoes" text DEFAULT ''::text,
    "tags" jsonb DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."recrutamento_whatsapp_config" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "evolution_api_url" text,
    "instance_name" text,
    "n8n_webhook_url" text,
    "numero_operacional" text,
    "status" text NOT NULL DEFAULT 'desconectado'::text,
    "qr_code" text,
    "ia_ativa" boolean NOT NULL DEFAULT true,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."recrutamento_whatsapp_conversas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "telefone" text NOT NULL,
    "nome" text,
    "prestador_id" uuid,
    "status" text NOT NULL DEFAULT 'novo'::text,
    "ia_ativa" boolean NOT NULL DEFAULT true,
    "humano_assumiu" boolean NOT NULL DEFAULT false,
    "ultima_mensagem" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."recrutamento_whatsapp_mensagens" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "conversa_id" uuid NOT NULL,
    "origem" text NOT NULL,
    "mensagem" text NOT NULL,
    "payload" jsonb,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."rede_oportunidades" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "os_id" uuid NOT NULL,
    "status" rede_oportunidade_status NOT NULL DEFAULT 'publicada'::rede_oportunidade_status,
    "prestador_aceite_id" uuid,
    "valor_prestador" numeric(12,2) DEFAULT 0,
    "veiculo_necessario" jsonb DEFAULT '{}'::jsonb,
    "regiao" text,
    "requisitos" jsonb DEFAULT '[]'::jsonb,
    "prazo_expiracao" timestamp with time zone,
    "aceite_em" timestamp with time zone,
    "expirada_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "criado_por" uuid,
    "tipo_veiculo" text
);

CREATE TABLE IF NOT EXISTS public."rede_visualizacoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "oportunidade_id" uuid NOT NULL,
    "prestador_id" uuid NOT NULL,
    "status" text NOT NULL DEFAULT 'visualizada'::text,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."reembolsos_prestador" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "prestador" text NOT NULL,
    "os_id" uuid,
    "tipo" text NOT NULL,
    "descricao" text,
    "valor" numeric NOT NULL,
    "data_despesa" date NOT NULL,
    "comprovante_url" text,
    "status" text NOT NULL DEFAULT 'pendente'::text,
    "aprovado_por" uuid,
    "data_aprovacao" timestamp with time zone,
    "obs_rejeicao" text,
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "created_by" uuid DEFAULT auth.uid(),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."regioes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "descricao" text,
    "status" text DEFAULT 'Ativo'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."regras_fiscais_cte" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" uuid,
    "uf_origem" text,
    "uf_destino" text,
    "tipo_operacao" text,
    "cfop" text NOT NULL,
    "natureza_operacao" text,
    "aliquota_icms" numeric,
    "observacao" text,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
    "nome" text,
    "descricao" text,
    "emitente_id" uuid,
    "cst_icms" text DEFAULT '00'::text,
    "reducao_base" numeric DEFAULT 0,
    "padrao" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."regras_fiscais_nfse" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "emitente_id" uuid,
    "cliente_id" uuid,
    "municipio_prestacao" text NOT NULL,
    "uf" text,
    "codigo_servico" text NOT NULL,
    "descricao_servico" text,
    "aliquota_iss" numeric,
    "iss_retido" boolean,
    "observacao" text,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
    "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public."roles_permissoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "role" text NOT NULL,
    "modulo" text NOT NULL,
    "pode_ver" boolean DEFAULT true,
    "pode_criar" boolean DEFAULT false,
    "pode_editar" boolean DEFAULT false,
    "pode_excluir" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."rota_execucoes" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "rota_id" uuid,
    "prestador_id" uuid,
    "status" text DEFAULT 'pendente'::text,
    "iniciado_em" timestamp with time zone,
    "finalizado_em" timestamp with time zone,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."rota_paradas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "rota_id" uuid,
    "sequencia" integer NOT NULL,
    "cliente_nome" text,
    "telefone" text,
    "cep" text,
    "endereco" text,
    "numero" text,
    "bairro" text,
    "cidade" text,
    "uf" text,
    "complemento" text,
    "latitude" numeric,
    "longitude" numeric,
    "peso" numeric DEFAULT 0,
    "volumes" integer DEFAULT 0,
    "cubagem" numeric DEFAULT 0,
    "temperatura" text,
    "prioridade" text DEFAULT 'normal'::text,
    "janela_entrega" text,
    "observacoes" text,
    "status" text DEFAULT 'pendente'::text,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "os_id" uuid,
    "alocacao_id" uuid,
    "pedido" text,
    "nota_fiscal" text,
    "destinatario" text,
    "contato" text,
    "tipo_carga" text,
    "instrucoes" text,
    "recebedor" text,
    "assinatura_url" text,
    "pod_url" text,
    "fotos" jsonb DEFAULT '[]'::jsonb,
    "ocorrencia" text,
    "data_hora" timestamp with time zone,
    "latitude_fim" numeric,
    "longitude_fim" numeric,
    "data_entrega" timestamp with time zone,
    "volumes_entregues" integer DEFAULT 0,
    "logradouro" text,
    "referencia" text,
    "contato_nome" text,
    "contato_telefone" text,
    "responsavel_local" text,
    "recebedor_previsto" text,
    "horario_limite" text,
    "portaria" text,
    "doca" text,
    "procedimento_entrada" text,
    "procedimento_saida" text,
    "estacionamento" text,
    "documento_necessario" text,
    "codigo_acesso" text,
    "temperatura_carga" text,
    "exigencia_epi" boolean DEFAULT false,
    "exige_ajudante" boolean DEFAULT false,
    "restricao_veiculo" text,
    "restricao_altura" text,
    "outras_restricoes" text,
    "data_prevista" date
);

CREATE TABLE IF NOT EXISTS public."rotas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "status" text DEFAULT 'rascunho'::text,
    "data_rota" date,
    "tipo_rota" text DEFAULT 'entrega'::text,
    "distancia_km" numeric DEFAULT 0,
    "duracao_min" numeric DEFAULT 0,
    "peso_total" numeric DEFAULT 0,
    "volumes_total" integer DEFAULT 0,
    "veiculo_sugerido" text,
    "prestador_id" uuid,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "os_id" uuid,
    "cliente_id" uuid,
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "motorista" text,
    "veiculo" text,
    "horario_previsto" timestamp with time zone,
    "horario_realizado" timestamp with time zone,
    "sla" text,
    "destino_final" text,
    "numero_paradas" integer DEFAULT 0,
    "paradas_pendentes" integer DEFAULT 0,
    "operation_mode" text DEFAULT 'standard_delivery'::text,
    "instrucoes" text,
    "alocacao_id" uuid
);

CREATE TABLE IF NOT EXISTS public."rotinas_execucoes_ia" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "rotina_id" uuid NOT NULL,
    "robo_id" uuid NOT NULL,
    "status" status_execucao_rotina_ia NOT NULL DEFAULT 'running'::status_execucao_rotina_ia,
    "input" jsonb DEFAULT '{}'::jsonb,
    "output" jsonb DEFAULT '{}'::jsonb,
    "logs" text,
    "erro" text,
    "started_at" timestamp with time zone NOT NULL DEFAULT now(),
    "finished_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."rotinas_ia" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "nome" text NOT NULL,
    "descricao" text,
    "tipo" tipo_rotina_ia NOT NULL DEFAULT 'interval'::tipo_rotina_ia,
    "cron_expression" text,
    "interval_seconds" integer,
    "ativo" boolean NOT NULL DEFAULT true,
    "config" jsonb DEFAULT '{}'::jsonb,
    "ultima_execucao" timestamp with time zone,
    "proxima_execucao" timestamp with time zone,
    "status" status_rotina_ia NOT NULL DEFAULT 'pending'::status_rotina_ia,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."route_stops" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "operation_id" uuid,
    "sequencia" integer,
    "nome" text,
    "endereco" text,
    "janela_inicio" text,
    "janela_fim" text,
    "volumes" text,
    "peso" text,
    "produto" text,
    "nf" text,
    "contato" text,
    "instrucoes" text,
    "latitude" double precision,
    "longitude" double precision,
    "status" text DEFAULT 'pending'::text,
    "arrived_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."seguros_apolices" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "seguradora" text NOT NULL,
    "numero_apolice" text NOT NULL,
    "tipo_seguro" text,
    "veiculo_id" uuid,
    "vigencia_inicio" date NOT NULL,
    "vigencia_fim" date NOT NULL,
    "valor_premio" numeric DEFAULT 0,
    "forma_pagamento" text,
    "status" text DEFAULT 'ativa'::text,
    "observacao" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."sinistros" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "os_id" uuid,
    "tipo_sinistro" text,
    "data_evento" date,
    "valor_estimado" numeric DEFAULT 0,
    "seguradora" text,
    "apolice_id" uuid,
    "status" text DEFAULT 'em_analise'::text,
    "descricao" text,
    "anexos" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."tabela_prestador" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text,
    "tipo_veiculo" text,
    "regiao" text,
    "valor_minimo" numeric DEFAULT 0,
    "km_incluso" numeric DEFAULT 0,
    "valor_km" numeric DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "cidade" text,
    "uf" text,
    "valor_saida" numeric DEFAULT 0,
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "data_inicio" date,
    "data_fim" date,
    "versao" integer DEFAULT 1,
    "motivo_alteracao" text,
    "prioridade" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."tabela_prestador_operacional" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text,
    "prestador_id" uuid,
    "tipo_veiculo" text,
    "regiao" text,
    "cidade" text,
    "uf" text,
    "valor_minimo" numeric DEFAULT 0,
    "km_incluso" numeric DEFAULT 0,
    "valor_km" numeric DEFAULT 0,
    "valor_saida" numeric DEFAULT 0,
    "valor_diaria" numeric DEFAULT 0,
    "percentual_bonus" numeric DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."tabela_valores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text,
    "tipo_veiculo" text,
    "valor_minimo" numeric,
    "km_incluso" numeric,
    "valor_km" numeric,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."tabelas_valores" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "tipo_veiculo" text NOT NULL,
    "km_inicial" numeric DEFAULT 0,
    "km_final" numeric DEFAULT 999999,
    "valor_base" numeric DEFAULT 0,
    "valor_km" numeric DEFAULT 0,
    "valor_minimo" numeric DEFAULT 0,
    "ativo" boolean DEFAULT true,
    "universal" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT now(),
    "adicionais" jsonb DEFAULT '{}'::jsonb,
    "financeiro" jsonb DEFAULT '{}'::jsonb,
    "regras" jsonb DEFAULT '{}'::jsonb,
    "faixas" jsonb DEFAULT '[]'::jsonb,
    "observacoes" text,
    "status" text DEFAULT 'ATIVA'::text,
    "cliente" text,
    "updated_at" timestamp without time zone DEFAULT now(),
    "arredondamento" jsonb DEFAULT '{}'::jsonb,
    "centro_custo_padrao" text,
    "conta_contabil_padrao" text,
    "custo_teto_prestador" numeric DEFAULT 0,
    "markup_desejavel" numeric DEFAULT 0,
    "km_franquia" numeric DEFAULT 0,
    "valor_km_excedente" numeric DEFAULT 0,
    "exigencia_termica" text,
    "metodos_cobranca" jsonb DEFAULT '{}'::jsonb,
    "classificacao_termica" text,
    "cobranca_principais" text[] DEFAULT '{}'::text[],
    "minimo_faturavel" numeric(12,2) DEFAULT 0,
    "cobranca_retorno" jsonb DEFAULT '{"cobrado": false, "percentual": 0}'::jsonb,
    "conta_contabil" text,
    "franquia_km" numeric,
    "custo_prestador" numeric,
    "markup_percent" numeric,
    "custo_minimo_prestador" numeric DEFAULT 0,
    "margem_minima_percent" numeric DEFAULT 0,
    "unidade" text,
    "tipo_operacao" text,
    "segmento_cliente" text,
    "data_inicio" date,
    "data_fim" date,
    "versao" integer DEFAULT 1,
    "tipo_tabela" text,
    "subcategoria_veiculo" text,
    "percentual_prestador" numeric(5,2) DEFAULT 80,
    "valor_cliente" numeric DEFAULT 0,
    "tipo_repasse_prestador" text DEFAULT 'percentual'::text,
    "valor_fixo_prestador" numeric DEFAULT 0,
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "motivo_alteracao" text,
    "prioridade" integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."tenant_usuarios" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "papel" text NOT NULL DEFAULT 'operacional'::text,
    "status" text DEFAULT 'ativo'::text,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."tenants" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "slug" text NOT NULL,
    "documento" text,
    "plano" text DEFAULT 'starter'::text,
    "status" text DEFAULT 'ativo'::text,
    "email_contato" text,
    "telefone_contato" text,
    "logo_url" text,
    "cor_primaria" text DEFAULT '#F97316'::text,
    "dominio_customizado" text,
    "config" jsonb DEFAULT '{}'::jsonb,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."tracking_public_links" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" uuid DEFAULT current_tenant_id_safe(),
    "os_id" uuid,
    "token_publico" text NOT NULL,
    "expira_em" timestamp with time zone,
    "ativo" boolean DEFAULT true,
    "acessos" integer DEFAULT 0,
    "ultimo_acesso_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."treinamento_arquivos_ia" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "robo_id" uuid NOT NULL,
    "conhecimento_id" uuid,
    "nome_original" text NOT NULL,
    "nome_armazenado" text NOT NULL,
    "tipo_arquivo" text NOT NULL,
    "mime_type" text NOT NULL,
    "tamanho_bytes" bigint NOT NULL DEFAULT 0,
    "bucket" text NOT NULL DEFAULT 'biblioteca-global'::text,
    "caminho_storage" text NOT NULL,
    "categoria" text,
    "descricao" text,
    "tags" text[] DEFAULT '{}'::text[],
    "versao" integer NOT NULL DEFAULT 1,
    "status" text NOT NULL DEFAULT 'ativo'::text,
    "validade_inicio" date,
    "validade_fim" date,
    "hash_arquivo" text,
    "criado_por" uuid,
    "atualizado_por" uuid,
    "criado_em" timestamp with time zone NOT NULL DEFAULT now(),
    "atualizado_em" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."unidades" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "descricao" text,
    "status" text DEFAULT 'Ativo'::text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."usuarios_cliente" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "auth_user_id" uuid NOT NULL,
    "cliente_id" uuid NOT NULL,
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."veiculos" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "placa" text,
    "tipo_veiculo" text,
    "marca" text,
    "modelo" text,
    "ano_fabricacao" integer,
    "capacidade_kg" numeric,
    "capacidade_m3" numeric,
    "prestador_vinculado" uuid,
    "status" text DEFAULT 'disponivel'::text,
    "created_at" timestamp without time zone DEFAULT now(),
    "updated_at" timestamp without time zone DEFAULT now(),
    "tipo" text,
    "ano" integer,
    "renavam" text,
    "antt" text,
    "proprietario_nome" text,
    "proprietario_documento" text,
    "comprimento_m" numeric(10,2),
    "largura_m" numeric(10,2),
    "altura_m" numeric(10,2),
    "tipo_carga" text,
    "temperatura_min" numeric(10,2),
    "temperatura_max" numeric(10,2),
    "rastreador" boolean DEFAULT false,
    "seguro" boolean DEFAULT false,
    "restricoes_regiao" text,
    "observacoes" text,
    "principal" boolean DEFAULT false,
    "rntrc" text,
    "tara_kg" numeric(10,2),
    "uf_licenciamento" character varying(2),
    "tipo_rodado" character varying(30),
    "seguro_apolice" text,
    "validade_documental" text,
    "custo_km" numeric(10,4) DEFAULT 0,
    "custo_diaria" numeric(10,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public."webhooks_recebidos" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "origem" text NOT NULL,
    "evento" text NOT NULL,
    "payload" jsonb NOT NULL,
    "processado" boolean DEFAULT false,
    "status" text DEFAULT 'recebido'::text,
    "erro" text,
    "received_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."whatsapp_conversas" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "instancia_id" uuid,
    "telefone" text NOT NULL,
    "nome_contato" text,
    "tipo_origem" text DEFAULT 'recrutamento'::text,
    "status" text DEFAULT 'aberta'::text,
    "ultima_mensagem" text,
    "ultima_interacao" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."whatsapp_instancias" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "nome" text NOT NULL,
    "provider" text DEFAULT 'evolution'::text,
    "server_url" text,
    "api_key" text,
    "numero" text,
    "status" text DEFAULT 'desconectado'::text,
    "qr_code" text,
    "webhook_url" text,
    "criado_em" timestamp with time zone DEFAULT now(),
    "atualizado_em" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."whatsapp_mensagens" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "conversa_id" uuid,
    "instancia_id" uuid,
    "telefone" text NOT NULL,
    "direcao" text NOT NULL,
    "mensagem" text,
    "tipo_mensagem" text DEFAULT 'text'::text,
    "raw_payload" jsonb,
    "status" text DEFAULT 'recebida'::text,
    "criado_em" timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- 6. CONSTRAINTS (PRIMARY KEY, UNIQUE, CHECK)
-- ============================================================================
DO $$ BEGIN
    ALTER TABLE public."_hml_seed_checkpoint" ADD CONSTRAINT "_hml_seed_checkpoint_cenario_check" CHECK (cenario >= 1 AND cenario <= 6);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."_hml_seed_checkpoint" ADD CONSTRAINT "_hml_seed_checkpoint_duracao_ms_check" CHECK (duracao_ms IS NULL OR duracao_ms >= 0);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."_hml_seed_checkpoint" ADD CONSTRAINT "_hml_seed_checkpoint_status_check" CHECK (status = ANY (ARRAY['pendente'::text, 'concluido'::text, 'falhou'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."_hml_seed_checkpoint" ADD CONSTRAINT "_hml_seed_checkpoint_tentativas_check" CHECK (tentativas >= 0);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_cursos" ADD CONSTRAINT "academia_cursos_tipo_check" CHECK (tipo = ANY (ARRAY['modulo'::text, 'curso'::text, 'licao'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_materiais" ADD CONSTRAINT "academia_materiais_status_check" CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'rascunho'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_progresso" ADD CONSTRAINT "academia_progresso_status_check" CHECK (status = ANY (ARRAY['pendente'::text, 'em_andamento'::text, 'concluido'::text, 'pulado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."alocacoes_escala" ADD CONSTRAINT "alocacoes_escala_status_check" CHECK (status = ANY (ARRAY['planejada'::text, 'aguardando_aceite'::text, 'aceita'::text, 'recusada'::text, 'em_rota'::text, 'concluida'::text, 'cancelada'::text, 'ocorrencia'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."alocacoes_escala" ADD CONSTRAINT "alocacoes_escala_status_pagamento_check" CHECK (status_pagamento = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'pago'::text, 'cancelado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."alocacoes_escala" ADD CONSTRAINT "alocacoes_escala_valor_tipo_check" CHECK (valor_tipo = ANY (ARRAY['fixo'::text, 'percentual'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_aprovacoes" ADD CONSTRAINT "automacoes_aprovacoes_status_check" CHECK (status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'rejeitado'::text, 'editado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_aprovacoes" ADD CONSTRAINT "automacoes_aprovacoes_tipo_aprovacao_check" CHECK (tipo_aprovacao = ANY (ARRAY['proposta_comercial'::text, 'contrato'::text, 'desconto'::text, 'alteracao_valor'::text, 'cancelamento_operacao'::text, 'troca_motorista'::text, 'troca_prestador'::text, 'resposta_reclamacao'::text, 'resposta_ocorrencia_grave'::text, 'emissao_fiscal'::text, 'mensagem_cliente'::text, 'mensagem_prestador'::text, 'outro'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_gatilhos" ADD CONSTRAINT "nivel_risco_gatilho_check" CHECK (nivel_risco = ANY (ARRAY['baixo'::text, 'medio'::text, 'alto'::text, 'critico'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_gatilhos" ADD CONSTRAINT "prioridade_gatilho_check" CHECK (prioridade = ANY (ARRAY['baixa'::text, 'normal'::text, 'alta'::text, 'critica'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_gatilhos" ADD CONSTRAINT "tipo_acao_gatilho_check" CHECK (tipo_acao = ANY (ARRAY['criar_tarefa'::text, 'criar_aprovacao'::text, 'criar_alerta'::text, 'acionar_humano'::text, 'executar_robo_simulado'::text, 'notificar_setor'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_instrucoes" ADD CONSTRAINT "status_instrucao_check" CHECK (status = ANY (ARRAY['rascunho'::text, 'em_revisao'::text, 'publicado'::text, 'arquivado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_logs" ADD CONSTRAINT "automacoes_logs_status_check" CHECK (status = ANY (ARRAY['sucesso'::text, 'erro'::text, 'info'::text, 'aviso'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_regras_operacao" ADD CONSTRAINT "status_regra_operacao_check" CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'rascunho'::text, 'vencido'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_robos" ADD CONSTRAINT "automacoes_robos_modo_atual_check" CHECK (modo_atual = ANY (ARRAY['seguro'::text, 'homologacao'::text, 'producao_assistida'::text, 'producao'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_robos" ADD CONSTRAINT "automacoes_robos_modo_check" CHECK (modo = ANY (ARRAY['manual'::text, 'assistido'::text, 'automatico_seguro'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_robos" ADD CONSTRAINT "automacoes_robos_nivel_autonomia_check" CHECK (nivel_autonomia = ANY (ARRAY['manual'::text, 'assistido'::text, 'automatico_seguro'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_robos" ADD CONSTRAINT "automacoes_robos_status_check" CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'pausado'::text, 'erro'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_tarefas" ADD CONSTRAINT "automacoes_tarefas_prioridade_check" CHECK (prioridade = ANY (ARRAY['baixa'::text, 'normal'::text, 'alta'::text, 'critica'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_tarefas" ADD CONSTRAINT "automacoes_tarefas_status_check" CHECK (status = ANY (ARRAY['pendente'::text, 'em_execucao'::text, 'aguardando_aprovacao'::text, 'concluida'::text, 'falhou'::text, 'cancelada'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."campanhas" ADD CONSTRAINT "campanhas_status_check" CHECK (status = ANY (ARRAY['Rascunho'::text, 'Ativa'::text, 'Pausada'::text, 'Finalizada'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."campanhas" ADD CONSTRAINT "campanhas_tipo_campanha_check" CHECK (tipo_campanha = ANY (ARRAY['CLIENTE'::text, 'MOTORISTA'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_events" ADD CONSTRAINT "communication_events_publico_check" CHECK (publico = ANY (ARRAY['destinatario'::text, 'cliente'::text, 'prestador'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_events" ADD CONSTRAINT "communication_events_status_envio_check" CHECK (status_envio = ANY (ARRAY['pendente'::text, 'enviado'::text, 'falhou'::text, 'cancelado'::text, 'simulado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_templates" ADD CONSTRAINT "communication_templates_publico_check" CHECK (publico = ANY (ARRAY['destinatario'::text, 'cliente'::text, 'prestador'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_destinatarios_autorizados" ADD CONSTRAINT "comunicacoes_destinatarios_autorizados_ambiente_check" CHECK (ambiente = ANY (ARRAY['homologacao'::text, 'producao_assistida'::text, 'producao'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_destinatarios_autorizados" ADD CONSTRAINT "comunicacoes_destinatarios_autorizados_canal_check" CHECK (canal = ANY (ARRAY['whatsapp'::text, 'email'::text, 'sms'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_destinatarios_autorizados" ADD CONSTRAINT "comunicacoes_destinatarios_autorizados_tipo_destinatario_check" CHECK (tipo_destinatario = ANY (ARRAY['cliente'::text, 'prestador'::text, 'candidato'::text, 'interno'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_mensagens" ADD CONSTRAINT "comunicacoes_mensagens_canal_check" CHECK (canal = ANY (ARRAY['whatsapp'::text, 'email'::text, 'sms'::text, 'simulado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_mensagens" ADD CONSTRAINT "comunicacoes_mensagens_destinatario_tipo_check" CHECK (destinatario_tipo = ANY (ARRAY['cliente'::text, 'prestador'::text, 'candidato'::text, 'admin'::text, 'setor'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_mensagens" ADD CONSTRAINT "comunicacoes_mensagens_status_check" CHECK (status = ANY (ARRAY['rascunho'::text, 'simulado'::text, 'aguardando_aprovacao'::text, 'aprovado'::text, 'bloqueado'::text, 'enviado_homologacao'::text, 'erro_homologacao'::text, 'rejeitado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_operacao" ADD CONSTRAINT "contratos_operacao_frequencia_check" CHECK (frequencia = ANY (ARRAY['diaria'::text, 'semanal'::text, 'quinzenal'::text, 'mensal'::text, 'data_especifica'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_operacao_execucao" ADD CONSTRAINT "contratos_operacao_execucao_status_check" CHECK (status = ANY (ARRAY['pendente'::text, 'gerada'::text, 'cancelada'::text, 'falha'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."criativos" ADD CONSTRAINT "criativos_tipo_check" CHECK (tipo = ANY (ARRAY['Imagem'::text, 'Vídeo'::text, 'Carrossel'::text, 'Story'::text, 'Post'::text, 'Banner'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_interacoes_prestadores" ADD CONSTRAINT "crm_interacoes_prestadores_status_check" CHECK (status = ANY (ARRAY['agendado'::text, 'realizado'::text, 'cancelado'::text, 'pendente'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_interacoes_prestadores" ADD CONSTRAINT "crm_interacoes_prestadores_tipo_check" CHECK (tipo = ANY (ARRAY['ligacao'::text, 'whatsapp'::text, 'email'::text, 'reuniao'::text, 'visita'::text, 'observacao'::text, 'proposta_enviada'::text, 'retorno_prestador'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."diretor_virtual_eventos_ia" ADD CONSTRAINT "diretor_virtual_eventos_ia_tipo_evento_check" CHECK (tipo_evento = ANY (ARRAY['analise'::text, 'decisao'::text, 'acao'::text, 'erro'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."eventos_oficiais" ADD CONSTRAINT "eventos_oficiais_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'internal'::text, 'admin'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fatura_itens" ADD CONSTRAINT "ck_fatura_itens_status" CHECK (status = ANY (ARRAY['ativo'::text, 'cancelado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."faturas" ADD CONSTRAINT "ck_faturas_status" CHECK (status = ANY (ARRAY['rascunho'::text, 'aguardando_aprovacao'::text, 'aprovada'::text, 'emitida'::text, 'cancelada'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_baixas" ADD CONSTRAINT "ck_financeiro_baixas_saldo" CHECK (valor_original >= 0::numeric AND saldo_restante >= 0::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_baixas" ADD CONSTRAINT "ck_financeiro_baixas_tabela" CHECK (titulo_tabela = ANY (ARRAY['financeiro_pagar'::text, 'financeiro_receber'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_baixas" ADD CONSTRAINT "ck_financeiro_baixas_valor_baixado" CHECK (valor_baixado > 0::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_pagar" ADD CONSTRAINT "ck_fp_status" CHECK (status = ANY (ARRAY['aberto'::text, 'pago'::text, 'vencido'::text, 'atrasado'::text, 'cancelado'::text, 'parcial'::text, 'pendente'::text, 'a vencer'::text, 'cancelada'::text, 'provisorio'::text, 'recebido'::text, 'renegociado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_receber" ADD CONSTRAINT "ck_fr_status" CHECK (status = ANY (ARRAY['aberto'::text, 'pago'::text, 'vencido'::text, 'atrasado'::text, 'cancelado'::text, 'parcial'::text, 'pendente'::text, 'a vencer'::text, 'a_vencer'::text, 'cancelada'::text, 'vencida'::text, 'provisorio'::text, 'recebido'::text, 'renegociado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_transferencias" ADD CONSTRAINT "financeiro_transferencias_taxa_check" CHECK (taxa >= 0::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_transferencias" ADD CONSTRAINT "financeiro_transferencias_valor_check" CHECK (valor > 0::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fornecedores" ADD CONSTRAINT "fornecedores_status_check" CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fornecedores" ADD CONSTRAINT "fornecedores_tipo_pessoa_check" CHECK (tipo_pessoa = ANY (ARRAY['PF'::text, 'PJ'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_comunicacoes_fila_robos" ADD CONSTRAINT "ia_comunicacoes_fila_robos_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conhecimento" ADD CONSTRAINT "ia_conhecimento_status_check" CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'vencido'::text, 'rascunho'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conhecimento_distribuicao" ADD CONSTRAINT "ia_conhecimento_distribuicao_prioridade_check" CHECK (prioridade = ANY (ARRAY['baixa'::text, 'normal'::text, 'alta'::text, 'critica'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_custos_ia" ADD CONSTRAINT "ia_custos_ia_complexidade_check" CHECK (complexidade = ANY (ARRAY['1_economico'::text, '2_intermediario'::text, '3_complexo'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_custos_ia" ADD CONSTRAINT "ia_custos_ia_modo_tenant_check" CHECK (modo_tenant = ANY (ARRAY['economico'::text, 'balanceado'::text, 'premium'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_custos_ia" ADD CONSTRAINT "ia_custos_ia_status_check" CHECK (status = ANY (ARRAY['sucesso'::text, 'falha'::text, 'fallback'::text, 'cache'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_ferramentas" ADD CONSTRAINT "ia_ferramentas_risco_operacional_check" CHECK (risco_operacional = ANY (ARRAY['baixo'::text, 'medio'::text, 'alto'::text, 'critico'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_missoes_execucao" ADD CONSTRAINT "ia_missoes_execucao_progresso_check" CHECK (progresso >= 0 AND progresso <= 100);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_score_robo" ADD CONSTRAINT "ia_score_robo_confiabilidade_score_check" CHECK (confiabilidade_score >= 0::numeric AND confiabilidade_score <= 100::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_score_robo" ADD CONSTRAINT "ia_score_robo_eficiencia_score_check" CHECK (eficiencia_score >= 0::numeric AND eficiencia_score <= 100::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_score_robo" ADD CONSTRAINT "ia_score_robo_performance_score_check" CHECK (performance_score >= 0::numeric AND performance_score <= 100::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_score_robo" ADD CONSTRAINT "ia_score_robo_risco_score_check" CHECK (risco_score >= 0::numeric AND risco_score <= 100::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_score_robo" ADD CONSTRAINT "ia_score_robo_score_geral_check" CHECK (score_geral >= 0::numeric AND score_geral <= 100::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_setores" ADD CONSTRAINT "ia_setores_modo_operacao_check" CHECK (modo_operacao = ANY (ARRAY['manual'::text, 'assistido'::text, 'automatico_seguro'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."leads" ADD CONSTRAINT "leads_status_check" CHECK (status = ANY (ARRAY['Novo'::text, 'Em contato'::text, 'Qualificado'::text, 'Perdido'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."leads" ADD CONSTRAINT "leads_tipo_lead_check" CHECK (tipo_lead = ANY (ARRAY['CLIENTE'::text, 'MOTORISTA'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operacao_mensagens" ADD CONSTRAINT "operacao_mensagens_sender_type_check" CHECK (sender_type = ANY (ARRAY['prestador'::text, 'torre'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operacao_mensagens" ADD CONSTRAINT "operacao_mensagens_status_check" CHECK (status = ANY (ARRAY['enviada'::text, 'lida'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pagamentos_prestadores" ADD CONSTRAINT "chk_classificacao_dado" CHECK (classificacao_dado = ANY (ARRAY['real'::text, 'teste'::text, 'duvidoso'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_fila" ADD CONSTRAINT "patio_fila_status_check" CHECK (status = ANY (ARRAY['aguardando'::text, 'chamado'::text, 'em_atendimento'::text, 'concluido'::text, 'cancelado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_unidades" ADD CONSTRAINT "patio_unidades_status_check" CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'manutencao'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_avaliacoes" ADD CONSTRAINT "portal_avaliacoes_nota_check" CHECK (nota >= 1 AND nota <= 5);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_pedidos" ADD CONSTRAINT "portal_pedidos_prioridade_check" CHECK (prioridade = ANY (ARRAY['baixa'::text, 'normal'::text, 'alta'::text, 'urgente'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_pedidos" ADD CONSTRAINT "portal_pedidos_status_check" CHECK (status = ANY (ARRAY['rascunho'::text, 'enviado'::text, 'em_analise'::text, 'aprovado'::text, 'convertido'::text, 'programado'::text, 'coleta'::text, 'em_rota'::text, 'entregue'::text, 'rejeitado'::text, 'erro_conversao'::text, 'cancelado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_tracking_realtime" ADD CONSTRAINT "chk_tracking_coords_validas" CHECK (latitude IS NULL AND longitude IS NULL OR latitude >= '-90'::integer::numeric AND latitude <= 90::numeric AND latitude <> 0::numeric OR longitude >= '-180'::integer::numeric AND longitude <= 180::numeric AND longitude <> 0::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."postagens" ADD CONSTRAINT "postagens_status_check" CHECK (status = ANY (ARRAY['Rascunho'::text, 'Agendada'::text, 'Publicada'::text, 'Cancelada'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestador_os" ADD CONSTRAINT "chk_status_prestador_os" CHECK (status = ANY (ARRAY['disponivel'::text, 'aceita'::text, 'em_andamento'::text, 'coletado'::text, 'em_rota'::text, 'entregue'::text, 'concluida'::text, 'cancelada'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_automacoes" ADD CONSTRAINT "recrutamento_automacoes_status_check" CHECK (status = ANY (ARRAY['ativa'::text, 'pausada'::text, 'desativada'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_automacoes" ADD CONSTRAINT "recrutamento_automacoes_tipo_check" CHECK (tipo = ANY (ARRAY['whatsapp'::text, 'email'::text, 'notificacao'::text, 'webhook'::text, 'score'::text, 'validade_documento'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_whatsapp_config" ADD CONSTRAINT "recrutamento_whatsapp_config_status_check" CHECK (status = ANY (ARRAY['desconectado'::text, 'aguardando_qr'::text, 'conectado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_whatsapp_conversas" ADD CONSTRAINT "recrutamento_whatsapp_conversas_status_check" CHECK (status = ANY (ARRAY['novo'::text, 'em_analise'::text, 'aprovado'::text, 'reprovado'::text, 'bloqueado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_whatsapp_mensagens" ADD CONSTRAINT "recrutamento_whatsapp_mensagens_origem_check" CHECK (origem = ANY (ARRAY['prestador'::text, 'ia'::text, 'humano'::text, 'sistema'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rede_visualizacoes" ADD CONSTRAINT "rede_visualizacoes_status_check" CHECK (status = ANY (ARRAY['visualizada'::text, 'interessada'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."reembolsos_prestador" ADD CONSTRAINT "reembolsos_prestador_status_check" CHECK (status = ANY (ARRAY['pendente'::text, 'aprovado'::text, 'rejeitado'::text, 'pago'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."reembolsos_prestador" ADD CONSTRAINT "reembolsos_prestador_valor_check" CHECK (valor >= 0::numeric);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tabelas_valores" ADD CONSTRAINT "tabelas_valores_tipo_repasse_prestador_check" CHECK (tipo_repasse_prestador = ANY (ARRAY['percentual'::text, 'fixo'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tenant_usuarios" ADD CONSTRAINT "tenant_usuarios_papel_check" CHECK (papel = ANY (ARRAY['super_admin'::text, 'admin_tenant'::text, 'gestor'::text, 'operacional'::text, 'financeiro'::text, 'comercial'::text, 'atendimento'::text, 'cliente'::text, 'prestador'::text, 'motorista'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tenant_usuarios" ADD CONSTRAINT "tenant_usuarios_status_check" CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'convidado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_plano_check" CHECK (plano = ANY (ARRAY['starter'::text, 'professional'::text, 'enterprise'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_status_check" CHECK (status = ANY (ARRAY['ativo'::text, 'inativo'::text, 'suspenso'::text, 'trial'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."treinamento_arquivos_ia" ADD CONSTRAINT "status_arquivo_treinamento_check" CHECK (status = ANY (ARRAY['rascunho'::text, 'ativo'::text, 'arquivado'::text, 'expirado'::text]));
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."_hml_seed_checkpoint" ADD CONSTRAINT "_hml_seed_checkpoint_pkey" PRIMARY KEY (marcador, cenario);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_cursos" ADD CONSTRAINT "academia_cursos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_materiais" ADD CONSTRAINT "academia_materiais_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_progresso" ADD CONSTRAINT "academia_progresso_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."agentes_ia_internos" ADD CONSTRAINT "agentes_ia_internos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."alocacoes_escala" ADD CONSTRAINT "alocacoes_escala_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."auth_eventos_auditoria" ADD CONSTRAINT "auth_eventos_auditoria_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_aprovacoes" ADD CONSTRAINT "automacoes_aprovacoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_execucoes" ADD CONSTRAINT "automacoes_execucoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_fila" ADD CONSTRAINT "automacoes_fila_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_gatilhos" ADD CONSTRAINT "automacoes_gatilhos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_gatilhos_execucao" ADD CONSTRAINT "automacoes_gatilhos_execucao_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_instrucoes" ADD CONSTRAINT "automacoes_instrucoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_logs" ADD CONSTRAINT "automacoes_logs_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_regras" ADD CONSTRAINT "automacoes_regras_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_regras_operacao" ADD CONSTRAINT "automacoes_regras_operacao_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_robos" ADD CONSTRAINT "automacoes_robos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_tarefas" ADD CONSTRAINT "automacoes_tarefas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."biblioteca_documentos" ADD CONSTRAINT "biblioteca_documentos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."campanhas" ADD CONSTRAINT "campanhas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."candidato_documentos" ADD CONSTRAINT "candidato_documentos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."candidatos" ADD CONSTRAINT "candidatos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."central_integracoes" ADD CONSTRAINT "central_integracoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."centros_custo" ADD CONSTRAINT "centros_custo_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."certificados_fiscais" ADD CONSTRAINT "certificados_fiscais_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."clientes_contratos" ADD CONSTRAINT "clientes_contratos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_events" ADD CONSTRAINT "communication_events_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_preferences" ADD CONSTRAINT "communication_preferences_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_templates" ADD CONSTRAINT "communication_templates_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."composicao_financeira" ADD CONSTRAINT "composicao_financeira_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."composicao_financeira_os" ADD CONSTRAINT "composicao_financeira_os_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_destinatarios_autorizados" ADD CONSTRAINT "comunicacoes_destinatarios_autorizados_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_mensagens" ADD CONSTRAINT "comunicacoes_mensagens_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."configuracoes_fiscais" ADD CONSTRAINT "configuracoes_fiscais_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."configuracoes_sistema" ADD CONSTRAINT "configuracoes_sistema_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contas_financeiras" ADD CONSTRAINT "contas_financeiras_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_gerados" ADD CONSTRAINT "contratos_gerados_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_historico" ADD CONSTRAINT "contratos_historico_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_modelos" ADD CONSTRAINT "contratos_modelos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_operacao" ADD CONSTRAINT "contratos_operacao_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_operacao_execucao" ADD CONSTRAINT "contratos_operacao_execucao_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_operacao_rotas" ADD CONSTRAINT "contratos_operacao_rotas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."convites" ADD CONSTRAINT "convites_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."criativos" ADD CONSTRAINT "criativos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_conversas" ADD CONSTRAINT "crm_conversas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_followups" ADD CONSTRAINT "crm_followups_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_historico" ADD CONSTRAINT "crm_historico_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_interacoes_prestadores" ADD CONSTRAINT "crm_interacoes_prestadores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_leads" ADD CONSTRAINT "crm_leads_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_mensagens" ADD CONSTRAINT "crm_mensagens_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_templates_mensagem" ADD CONSTRAINT "crm_templates_mensagem_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."delivery_proofs" ADD CONSTRAINT "delivery_proofs_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."despesas_operacionais" ADD CONSTRAINT "despesas_operacionais_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."diretor_virtual_decisoes_ia" ADD CONSTRAINT "diretor_virtual_decisoes_ia_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."diretor_virtual_eventos_ia" ADD CONSTRAINT "diretor_virtual_eventos_ia_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."diretor_virtual_ia" ADD CONSTRAINT "diretor_virtual_ia_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."diretor_virtual_metricas_ia" ADD CONSTRAINT "diretor_virtual_metricas_ia_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."documentos_prestadores" ADD CONSTRAINT "documentos_prestadores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."driver_incidents" ADD CONSTRAINT "driver_incidents_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."driver_operations" ADD CONSTRAINT "driver_operations_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."driver_profiles" ADD CONSTRAINT "driver_profiles_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."enderecos_cliente" ADD CONSTRAINT "enderecos_cliente_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."enderecos_clientes" ADD CONSTRAINT "enderecos_clientes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."entregas_protocolo" ADD CONSTRAINT "entregas_protocolo_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."escala_operacional" ADD CONSTRAINT "escala_operacional_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."escalonamentos_humanos" ADD CONSTRAINT "escalonamentos_humanos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."eventos_oficiais" ADD CONSTRAINT "eventos_oficiais_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fatura_itens" ADD CONSTRAINT "fatura_itens_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."faturas" ADD CONSTRAINT "faturas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."filiais" ADD CONSTRAINT "filiais_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fin_sane_02b_snapshot" ADD CONSTRAINT "fin_sane_02b_snapshot_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_baixas" ADD CONSTRAINT "financeiro_baixas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_pagar" ADD CONSTRAINT "financeiro_pagar_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_receber" ADD CONSTRAINT "financeiro_receber_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_transferencias" ADD CONSTRAINT "financeiro_transferencias_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_documentos_vinculados" ADD CONSTRAINT "fiscal_documentos_vinculados_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_events" ADD CONSTRAINT "fiscal_events_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_historico_status" ADD CONSTRAINT "fiscal_historico_status_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_logs" ADD CONSTRAINT "fiscal_logs_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_mdfes" ADD CONSTRAINT "fiscal_mdfes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_nfse" ADD CONSTRAINT "fiscal_nfse_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_xml_recebidos" ADD CONSTRAINT "fiscal_xml_recebidos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fluxo_recrutamento" ADD CONSTRAINT "fluxo_recrutamento_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fornecedores" ADD CONSTRAINT "fornecedores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."historico_alocacoes_escala" ADD CONSTRAINT "historico_alocacoes_escala_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."homologacoes" ADD CONSTRAINT "homologacoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_agenda_atividades" ADD CONSTRAINT "ia_agenda_atividades_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_agenda_trabalho" ADD CONSTRAINT "ia_agenda_trabalho_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_agentes_execucao" ADD CONSTRAINT "ia_agentes_execucao_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_aprendizado_eventos" ADD CONSTRAINT "ia_aprendizado_eventos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_aprovacoes_fila" ADD CONSTRAINT "ia_aprovacoes_fila_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_aprovacoes_humanas" ADD CONSTRAINT "ia_aprovacoes_humanas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_auditoria_performance" ADD CONSTRAINT "ia_auditoria_performance_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_autoridade_acoes" ADD CONSTRAINT "ia_autoridade_acoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_comunicacoes_fila_robos" ADD CONSTRAINT "ia_comunicacoes_fila_robos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_comunicacoes_robos" ADD CONSTRAINT "ia_comunicacoes_robos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conector_robo" ADD CONSTRAINT "ia_conector_robo_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conectores" ADD CONSTRAINT "ia_conectores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conhecimento" ADD CONSTRAINT "ia_conhecimento_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conhecimento_distribuicao" ADD CONSTRAINT "ia_conhecimento_distribuicao_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_contextos" ADD CONSTRAINT "ia_contextos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_credenciais" ADD CONSTRAINT "ia_credenciais_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_credenciais_zoho" ADD CONSTRAINT "ia_credenciais_zoho_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_custos_ia" ADD CONSTRAINT "ia_custos_ia_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_decisoes_logs" ADD CONSTRAINT "ia_decisoes_logs_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_escalonamento_config" ADD CONSTRAINT "ia_escalonamento_config_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_conectores" ADD CONSTRAINT "ia_execucoes_conectores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_ferramentas" ADD CONSTRAINT "ia_execucoes_ferramentas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_ferramentas" ADD CONSTRAINT "ia_ferramentas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fila_trabalho" ADD CONSTRAINT "ia_fila_trabalho_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_empresa" ADD CONSTRAINT "ia_fluxos_empresa_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_etapas" ADD CONSTRAINT "ia_fluxos_etapas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_execucao_log" ADD CONSTRAINT "ia_fluxos_execucao_log_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_governanca_log" ADD CONSTRAINT "ia_governanca_log_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_historico_indicadores" ADD CONSTRAINT "ia_historico_indicadores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_historico_trabalho" ADD CONSTRAINT "ia_historico_trabalho_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_identidades" ADD CONSTRAINT "ia_identidades_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_indicadores" ADD CONSTRAINT "ia_indicadores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_insights_automaticos" ADD CONSTRAINT "ia_insights_automaticos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_integracoes_externas_logs" ADD CONSTRAINT "ia_integracoes_externas_logs_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_kpis_robo" ADD CONSTRAINT "ia_kpis_robo_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_limites_operacionais" ADD CONSTRAINT "ia_limites_operacionais_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_logs" ADD CONSTRAINT "ia_logs_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_metas" ADD CONSTRAINT "ia_metas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_missoes" ADD CONSTRAINT "ia_missoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_missoes_execucao" ADD CONSTRAINT "ia_missoes_execucao_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_modelos_mensagem" ADD CONSTRAINT "ia_modelos_mensagem_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_providers_config" ADD CONSTRAINT "ia_providers_config_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_regras" ADD CONSTRAINT "ia_regras_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_robo_ferramentas" ADD CONSTRAINT "ia_robo_ferramentas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_score_robo" ADD CONSTRAINT "ia_score_robo_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_sessoes_operacionais" ADD CONSTRAINT "ia_sessoes_operacionais_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_setores" ADD CONSTRAINT "ia_setores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_sugestoes_melhoria" ADD CONSTRAINT "ia_sugestoes_melhoria_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_tarefas_automaticas" ADD CONSTRAINT "ia_tarefas_automaticas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_trabalhos" ADD CONSTRAINT "ia_trabalhos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_versoes_sistema" ADD CONSTRAINT "ia_versoes_sistema_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."integracoes_config" ADD CONSTRAINT "integracoes_config_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."integracoes_logs" ADD CONSTRAINT "integracoes_logs_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."leads" ADD CONSTRAINT "leads_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_conhecimento" ADD CONSTRAINT "memoria_conhecimento_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_conversas" ADD CONSTRAINT "memoria_conversas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_entidades" ADD CONSTRAINT "memoria_entidades_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_eventos" ADD CONSTRAINT "memoria_eventos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_preferencias" ADD CONSTRAINT "memoria_preferencias_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_resumos" ADD CONSTRAINT "memoria_resumos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."modelos_mensagens" ADD CONSTRAINT "modelos_mensagens_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."motorista_app_sessoes" ADD CONSTRAINT "motorista_app_sessoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."motorista_checkins" ADD CONSTRAINT "motorista_checkins_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."municipios_ibge" ADD CONSTRAINT "municipios_ibge_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ocorrencias" ADD CONSTRAINT "ocorrencias_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operacao_localizacao" ADD CONSTRAINT "operacao_localizacao_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operacao_mensagens" ADD CONSTRAINT "operacao_mensagens_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operacoes" ADD CONSTRAINT "operacoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operation_km" ADD CONSTRAINT "operation_km_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operation_timeline_events" ADD CONSTRAINT "operation_timeline_events_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."orcamentos" ADD CONSTRAINT "orcamentos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ordens_servico" ADD CONSTRAINT "ordens_servico_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."os_historico" ADD CONSTRAINT "os_historico_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."os_ocorrencias" ADD CONSTRAINT "os_ocorrencias_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."os_pod" ADD CONSTRAINT "os_pod_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pagamento_prestadores" ADD CONSTRAINT "pagamento_prestadores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pagamentos_prestadores" ADD CONSTRAINT "pagamentos_prestadores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pagamentos_prestadores_itens" ADD CONSTRAINT "pagamentos_prestadores_itens_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_alertas" ADD CONSTRAINT "patio_alertas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_checkins" ADD CONSTRAINT "patio_checkins_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_docas" ADD CONSTRAINT "patio_docas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_eventos" ADD CONSTRAINT "patio_eventos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_fila" ADD CONSTRAINT "patio_fila_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_regras_fila" ADD CONSTRAINT "patio_regras_fila_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_rodizio" ADD CONSTRAINT "patio_rodizio_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_unidades" ADD CONSTRAINT "patio_unidades_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pending_uploads" ADD CONSTRAINT "pending_uploads_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."perfis_permissoes" ADD CONSTRAINT "perfis_permissoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."permissoes_prestador" ADD CONSTRAINT "permissoes_prestador_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_avaliacoes" ADD CONSTRAINT "portal_avaliacoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_comprovantes" ADD CONSTRAINT "portal_comprovantes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_faturas" ADD CONSTRAINT "portal_faturas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_notificacoes" ADD CONSTRAINT "portal_notificacoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_ocorrencias" ADD CONSTRAINT "portal_ocorrencias_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_pedidos" ADD CONSTRAINT "portal_pedidos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_preferencias_cliente" ADD CONSTRAINT "portal_preferencias_cliente_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_protocolos" ADD CONSTRAINT "portal_protocolos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_relatorios" ADD CONSTRAINT "portal_relatorios_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_rotas" ADD CONSTRAINT "portal_rotas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_tracking_realtime" ADD CONSTRAINT "portal_tracking_realtime_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."postagens" ADD CONSTRAINT "postagens_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestador_disponibilidade" ADD CONSTRAINT "prestador_disponibilidade_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestador_os" ADD CONSTRAINT "prestador_os_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestadores" ADD CONSTRAINT "prestadores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestadores_app" ADD CONSTRAINT "prestadores_app_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestadores_ocorrencias" ADD CONSTRAINT "prestadores_ocorrencias_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."processamento_fila" ADD CONSTRAINT "processamento_fila_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."provider_documents" ADD CONSTRAINT "provider_documents_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."raciocinio_auditoria" ADD CONSTRAINT "raciocinio_auditoria_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rascunhos_prestador" ADD CONSTRAINT "rascunhos_prestador_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recibos" ADD CONSTRAINT "recibos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_automacoes" ADD CONSTRAINT "recrutamento_automacoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_candidatos" ADD CONSTRAINT "recrutamento_candidatos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_ia_config" ADD CONSTRAINT "recrutamento_ia_config_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_operacoes" ADD CONSTRAINT "recrutamento_operacoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_prestadores" ADD CONSTRAINT "recrutamento_prestadores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_whatsapp_config" ADD CONSTRAINT "recrutamento_whatsapp_config_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_whatsapp_conversas" ADD CONSTRAINT "recrutamento_whatsapp_conversas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_whatsapp_mensagens" ADD CONSTRAINT "recrutamento_whatsapp_mensagens_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rede_oportunidades" ADD CONSTRAINT "rede_oportunidades_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rede_visualizacoes" ADD CONSTRAINT "rede_visualizacoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."reembolsos_prestador" ADD CONSTRAINT "reembolsos_prestador_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."regioes" ADD CONSTRAINT "regioes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."regras_fiscais_cte" ADD CONSTRAINT "regras_fiscais_cte_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."regras_fiscais_nfse" ADD CONSTRAINT "regras_fiscais_nfse_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."roles_permissoes" ADD CONSTRAINT "roles_permissoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rota_execucoes" ADD CONSTRAINT "rota_execucoes_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rota_paradas" ADD CONSTRAINT "rota_paradas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rotas" ADD CONSTRAINT "rotas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rotinas_execucoes_ia" ADD CONSTRAINT "rotinas_execucoes_ia_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rotinas_ia" ADD CONSTRAINT "rotinas_ia_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."route_stops" ADD CONSTRAINT "route_stops_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."seguros_apolices" ADD CONSTRAINT "seguros_apolices_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."sinistros" ADD CONSTRAINT "sinistros_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tabela_prestador" ADD CONSTRAINT "tabela_prestador_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tabela_prestador_operacional" ADD CONSTRAINT "tabela_prestador_operacional_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tabela_valores" ADD CONSTRAINT "tabela_valores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tabelas_valores" ADD CONSTRAINT "tabelas_valores_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tenant_usuarios" ADD CONSTRAINT "tenant_usuarios_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tracking_public_links" ADD CONSTRAINT "tracking_public_links_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."treinamento_arquivos_ia" ADD CONSTRAINT "treinamento_arquivos_ia_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."unidades" ADD CONSTRAINT "unidades_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."usuarios_cliente" ADD CONSTRAINT "usuarios_cliente_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."veiculos" ADD CONSTRAINT "veiculos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."webhooks_recebidos" ADD CONSTRAINT "webhooks_recebidos_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."whatsapp_conversas" ADD CONSTRAINT "whatsapp_conversas_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."whatsapp_instancias" ADD CONSTRAINT "whatsapp_instancias_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."whatsapp_mensagens" ADD CONSTRAINT "whatsapp_mensagens_pkey" PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_progresso" ADD CONSTRAINT "academia_progresso_robo_id_curso_id_material_id_key" UNIQUE (robo_id, curso_id, material_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."agentes_ia_internos" ADD CONSTRAINT "agentes_ia_internos_codigo_key" UNIQUE (codigo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."central_integracoes" ADD CONSTRAINT "central_integracoes_tipo_key" UNIQUE (tipo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_preferences" ADD CONSTRAINT "communication_preferences_tenant_id_cliente_id_key" UNIQUE (tenant_id, cliente_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_templates" ADD CONSTRAINT "communication_templates_tenant_id_codigo_key" UNIQUE (tenant_id, codigo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."composicao_financeira_os" ADD CONSTRAINT "composicao_financeira_os_os_id_key" UNIQUE (os_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."configuracoes_sistema" ADD CONSTRAINT "configuracoes_sistema_chave_unique" UNIQUE (chave);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_operacao" ADD CONSTRAINT "contratos_operacao_numero_key" UNIQUE (numero);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_operacao_execucao" ADD CONSTRAINT "contratos_operacao_execucao_rota_id_data_operacao_key" UNIQUE (rota_id, data_operacao);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."convites" ADD CONSTRAINT "convites_token_key" UNIQUE (token);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_key" UNIQUE (user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."enderecos_cliente" ADD CONSTRAINT "enderecos_cliente_cliente_id_logradouro_numero_bairro_cidad_key" UNIQUE (cliente_id, logradouro, numero, bairro, cidade, uf);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."faturas" ADD CONSTRAINT "faturas_numero_key" UNIQUE (numero);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_pagar" ADD CONSTRAINT "uq_fp_os_id" UNIQUE (os_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_receber" ADD CONSTRAINT "uq_fr_os_id" UNIQUE (os_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_agenda_trabalho" ADD CONSTRAINT "ia_agenda_trabalho_robo_id_dia_semana_key" UNIQUE (robo_id, dia_semana);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_autoridade_acoes" ADD CONSTRAINT "ia_autoridade_acoes_robo_id_acao_tipo_key" UNIQUE (robo_id, acao_tipo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conector_robo" ADD CONSTRAINT "ia_conector_robo_robo_id_conector_id_key" UNIQUE (robo_id, conector_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conectores" ADD CONSTRAINT "ia_conectores_codigo_unico_key" UNIQUE (codigo_unico);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conhecimento_distribuicao" ADD CONSTRAINT "ia_conhecimento_distribuicao_conhecimento_id_robo_id_key" UNIQUE (conhecimento_id, robo_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_escalonamento_config" ADD CONSTRAINT "ia_escalonamento_config_tipo_acao_nivel_ordem_key" UNIQUE (tipo_acao, nivel_ordem);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_ferramentas" ADD CONSTRAINT "ia_ferramentas_codigo_unico_key" UNIQUE (codigo_unico);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_empresa" ADD CONSTRAINT "ia_fluxos_empresa_codigo_key" UNIQUE (codigo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_identidades" ADD CONSTRAINT "ia_identidades_robo_id_key" UNIQUE (robo_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_limites_operacionais" ADD CONSTRAINT "ia_limites_operacionais_robo_id_acao_tipo_periodo_key" UNIQUE (robo_id, acao_tipo, periodo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_robo_ferramentas" ADD CONSTRAINT "ia_robo_ferramentas_robo_id_ferramenta_id_key" UNIQUE (robo_id, ferramenta_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_score_robo" ADD CONSTRAINT "ia_score_robo_robo_id_key" UNIQUE (robo_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_setores" ADD CONSTRAINT "ia_setores_nome_key" UNIQUE (nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_entidades" ADD CONSTRAINT "memoria_entidades_entidade_tipo_entidade_id_key" UNIQUE (entidade_tipo, entidade_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_preferencias" ADD CONSTRAINT "memoria_preferencias_entidade_tipo_entidade_id_chave_key" UNIQUE (entidade_tipo, entidade_id, chave);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."motorista_app_sessoes" ADD CONSTRAINT "motorista_app_sessoes_token_key" UNIQUE (token);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."municipios_ibge" ADD CONSTRAINT "municipios_ibge_codigo_key" UNIQUE (codigo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pagamentos_prestadores" ADD CONSTRAINT "uq_pp_os_id" UNIQUE (os_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."perfis_permissoes" ADD CONSTRAINT "perfis_permissoes_papel_modulo_key" UNIQUE (papel, modulo);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_pedidos" ADD CONSTRAINT "portal_pedidos_numero_pedido_key" UNIQUE (numero_pedido);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_preferencias_cliente" ADD CONSTRAINT "portal_preferencias_cliente_cliente_id_key" UNIQUE (cliente_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestadores_app" ADD CONSTRAINT "prestadores_app_cpf_cnpj_key" UNIQUE (cpf_cnpj);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestadores_app" ADD CONSTRAINT "prestadores_app_email_key" UNIQUE (email);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rascunhos_prestador" ADD CONSTRAINT "rascunhos_prestador_draft_token_key" UNIQUE (draft_token);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rede_oportunidades" ADD CONSTRAINT "rede_oportunidades_os_id_key" UNIQUE (os_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rede_visualizacoes" ADD CONSTRAINT "rede_visualizacoes_oportunidade_id_prestador_id_key" UNIQUE (oportunidade_id, prestador_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tenant_usuarios" ADD CONSTRAINT "tenant_usuarios_tenant_id_user_id_key" UNIQUE (tenant_id, user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tenants" ADD CONSTRAINT "tenants_slug_key" UNIQUE (slug);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tracking_public_links" ADD CONSTRAINT "tracking_public_links_token_publico_key" UNIQUE (token_publico);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."usuarios_cliente" ADD CONSTRAINT "usuarios_cliente_auth_user_id_cliente_id_key" UNIQUE (auth_user_id, cliente_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."whatsapp_instancias" ADD CONSTRAINT "whatsapp_instancias_nome_key" UNIQUE (nome);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 6.1 FOREIGN KEYS
-- ============================================================================
DO $$ BEGIN
    ALTER TABLE public."academia_cursos" ADD CONSTRAINT "academia_cursos_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_materiais" ADD CONSTRAINT "academia_materiais_curso_id_fkey" FOREIGN KEY (curso_id) REFERENCES academia_cursos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_progresso" ADD CONSTRAINT "academia_progresso_curso_id_fkey" FOREIGN KEY (curso_id) REFERENCES academia_cursos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_progresso" ADD CONSTRAINT "academia_progresso_material_id_fkey" FOREIGN KEY (material_id) REFERENCES academia_materiais(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."academia_progresso" ADD CONSTRAINT "academia_progresso_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."alocacoes_escala" ADD CONSTRAINT "alocacoes_escala_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."alocacoes_escala" ADD CONSTRAINT "alocacoes_escala_ordem_servico_id_fkey" FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."alocacoes_escala" ADD CONSTRAINT "alocacoes_escala_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_aprovacoes" ADD CONSTRAINT "automacoes_aprovacoes_tarefa_id_fkey" FOREIGN KEY (tarefa_id) REFERENCES automacoes_tarefas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_execucoes" ADD CONSTRAINT "automacoes_execucoes_regra_id_fkey" FOREIGN KEY (regra_id) REFERENCES automacoes_regras(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_fila" ADD CONSTRAINT "automacoes_fila_regra_id_fkey" FOREIGN KEY (regra_id) REFERENCES automacoes_regras(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_gatilhos" ADD CONSTRAINT "automacoes_gatilhos_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_gatilhos_execucao" ADD CONSTRAINT "automacoes_gatilhos_execucao_gatilho_id_fkey" FOREIGN KEY (gatilho_id) REFERENCES automacoes_gatilhos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_gatilhos_execucao" ADD CONSTRAINT "automacoes_gatilhos_execucao_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_instrucoes" ADD CONSTRAINT "automacoes_instrucoes_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_logs" ADD CONSTRAINT "automacoes_logs_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_logs" ADD CONSTRAINT "automacoes_logs_tarefa_id_fkey" FOREIGN KEY (tarefa_id) REFERENCES automacoes_tarefas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_regras_operacao" ADD CONSTRAINT "automacoes_regras_operacao_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_robos" ADD CONSTRAINT "automacoes_robos_agente_interno_id_fkey" FOREIGN KEY (agente_interno_id) REFERENCES agentes_ia_internos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."automacoes_tarefas" ADD CONSTRAINT "automacoes_tarefas_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."candidato_documentos" ADD CONSTRAINT "candidato_documentos_candidato_id_rc_fkey" FOREIGN KEY (candidato_id) REFERENCES recrutamento_candidatos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."candidatos" ADD CONSTRAINT "candidatos_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."certificados_fiscais" ADD CONSTRAINT "certificados_fiscais_emitente_id_fkey" FOREIGN KEY (emitente_id) REFERENCES configuracoes_fiscais(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."clientes" ADD CONSTRAINT "clientes_tabela_valores_padrao_id_fkey" FOREIGN KEY (tabela_valores_padrao_id) REFERENCES tabelas_valores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."clientes_contratos" ADD CONSTRAINT "clientes_contratos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_events" ADD CONSTRAINT "communication_events_alocacao_id_fkey" FOREIGN KEY (alocacao_id) REFERENCES alocacoes_escala(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_events" ADD CONSTRAINT "communication_events_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_events" ADD CONSTRAINT "communication_events_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_events" ADD CONSTRAINT "communication_events_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_events" ADD CONSTRAINT "communication_events_template_id_fkey" FOREIGN KEY (template_id) REFERENCES communication_templates(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."communication_preferences" ADD CONSTRAINT "communication_preferences_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_mensagens" ADD CONSTRAINT "comunicacoes_mensagens_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."comunicacoes_mensagens" ADD CONSTRAINT "comunicacoes_mensagens_tarefa_id_fkey" FOREIGN KEY (tarefa_id) REFERENCES automacoes_tarefas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_gerados" ADD CONSTRAINT "contratos_gerados_modelo_id_fkey" FOREIGN KEY (modelo_id) REFERENCES contratos_modelos(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."contratos_historico" ADD CONSTRAINT "contratos_historico_contrato_id_fkey" FOREIGN KEY (contrato_id) REFERENCES contratos_gerados(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."convites" ADD CONSTRAINT "convites_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."criativos" ADD CONSTRAINT "criativos_campanha_id_fkey" FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_followups" ADD CONSTRAINT "crm_followups_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_historico" ADD CONSTRAINT "crm_historico_lead_id_fkey" FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_interacoes_prestadores" ADD CONSTRAINT "crm_interacoes_prestadores_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."crm_mensagens" ADD CONSTRAINT "crm_mensagens_conversa_id_fkey" FOREIGN KEY (conversa_id) REFERENCES crm_conversas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."despesas_operacionais" ADD CONSTRAINT "despesas_operacionais_veiculo_id_fkey" FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."diretor_virtual_decisoes_ia" ADD CONSTRAINT "diretor_virtual_decisoes_ia_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."diretor_virtual_eventos_ia" ADD CONSTRAINT "diretor_virtual_eventos_ia_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."diretor_virtual_eventos_ia" ADD CONSTRAINT "diretor_virtual_eventos_ia_rotina_id_fkey" FOREIGN KEY (rotina_id) REFERENCES rotinas_ia(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."diretor_virtual_metricas_ia" ADD CONSTRAINT "diretor_virtual_metricas_ia_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."driver_operations" ADD CONSTRAINT "driver_operations_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES driver_profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."enderecos_cliente" ADD CONSTRAINT "enderecos_cliente_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."enderecos_clientes" ADD CONSTRAINT "enderecos_clientes_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."entregas_protocolo" ADD CONSTRAINT "entregas_protocolo_alocacao_id_fkey" FOREIGN KEY (alocacao_id) REFERENCES alocacoes_escala(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fatura_itens" ADD CONSTRAINT "fatura_itens_alocacao_id_fkey" FOREIGN KEY (alocacao_id) REFERENCES alocacoes_escala(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fatura_itens" ADD CONSTRAINT "fatura_itens_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fatura_itens" ADD CONSTRAINT "fatura_itens_fatura_id_fkey" FOREIGN KEY (fatura_id) REFERENCES faturas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fatura_itens" ADD CONSTRAINT "fatura_itens_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."faturas" ADD CONSTRAINT "faturas_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."faturas" ADD CONSTRAINT "faturas_conta_receber_id_fkey" FOREIGN KEY (conta_receber_id) REFERENCES financeiro_receber(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_baixas" ADD CONSTRAINT "financeiro_baixas_conta_financeira_id_fkey" FOREIGN KEY (conta_financeira_id) REFERENCES contas_financeiras(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_pagar" ADD CONSTRAINT "financeiro_pagar_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_pagar" ADD CONSTRAINT "financeiro_pagar_fornecedor_cadastro_id_fkey" FOREIGN KEY (fornecedor_cadastro_id) REFERENCES fornecedores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_pagar" ADD CONSTRAINT "financeiro_pagar_fornecedor_id_fkey" FOREIGN KEY (fornecedor_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_receber" ADD CONSTRAINT "financeiro_receber_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_receber" ADD CONSTRAINT "financeiro_receber_fatura_id_fkey" FOREIGN KEY (fatura_id) REFERENCES faturas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_transferencias" ADD CONSTRAINT "financeiro_transferencias_conta_destino_id_fkey" FOREIGN KEY (conta_destino_id) REFERENCES contas_financeiras(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."financeiro_transferencias" ADD CONSTRAINT "financeiro_transferencias_conta_origem_id_fkey" FOREIGN KEY (conta_origem_id) REFERENCES contas_financeiras(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_filial_id_fkey" FOREIGN KEY (filial_id) REFERENCES filiais(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_ctes" ADD CONSTRAINT "fiscal_ctes_ordem_servico_id_fkey" FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_documentos_vinculados" ADD CONSTRAINT "fiscal_documentos_vinculados_cte_id_fkey" FOREIGN KEY (cte_id) REFERENCES fiscal_ctes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_documentos_vinculados" ADD CONSTRAINT "fiscal_documentos_vinculados_mdfe_id_fkey" FOREIGN KEY (mdfe_id) REFERENCES fiscal_mdfes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_documentos_vinculados" ADD CONSTRAINT "fiscal_documentos_vinculados_ordem_servico_id_fkey" FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_mdfes" ADD CONSTRAINT "fiscal_mdfes_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_mdfes" ADD CONSTRAINT "fiscal_mdfes_filial_id_fkey" FOREIGN KEY (filial_id) REFERENCES filiais(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_mdfes" ADD CONSTRAINT "fiscal_mdfes_ordem_servico_id_fkey" FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_nfse" ADD CONSTRAINT "fiscal_nfse_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_nfse" ADD CONSTRAINT "fiscal_nfse_filial_id_fkey" FOREIGN KEY (filial_id) REFERENCES filiais(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_nfse" ADD CONSTRAINT "fiscal_nfse_ordem_servico_id_fkey" FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."fiscal_xml_recebidos" ADD CONSTRAINT "fiscal_xml_recebidos_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."historico_alocacoes_escala" ADD CONSTRAINT "historico_alocacoes_escala_alocacao_id_fkey" FOREIGN KEY (alocacao_id) REFERENCES alocacoes_escala(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_agenda_atividades" ADD CONSTRAINT "ia_agenda_atividades_agenda_id_fkey" FOREIGN KEY (agenda_id) REFERENCES ia_agenda_trabalho(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_agenda_atividades" ADD CONSTRAINT "ia_agenda_atividades_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_agenda_trabalho" ADD CONSTRAINT "ia_agenda_trabalho_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_agentes_execucao" ADD CONSTRAINT "ia_agentes_execucao_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_aprendizado_eventos" ADD CONSTRAINT "ia_aprendizado_eventos_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_aprovacoes_fila" ADD CONSTRAINT "ia_aprovacoes_fila_aprovador_id_fkey" FOREIGN KEY (aprovador_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_aprovacoes_fila" ADD CONSTRAINT "ia_aprovacoes_fila_execucao_ferramenta_id_fkey" FOREIGN KEY (execucao_ferramenta_id) REFERENCES ia_execucoes_ferramentas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_aprovacoes_fila" ADD CONSTRAINT "ia_aprovacoes_fila_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_aprovacoes_humanas" ADD CONSTRAINT "ia_aprovacoes_humanas_setor_id_fkey" FOREIGN KEY (setor_id) REFERENCES ia_setores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_auditoria_performance" ADD CONSTRAINT "ia_auditoria_performance_missao_execucao_id_fkey" FOREIGN KEY (missao_execucao_id) REFERENCES ia_missoes_execucao(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_auditoria_performance" ADD CONSTRAINT "ia_auditoria_performance_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_autoridade_acoes" ADD CONSTRAINT "ia_autoridade_acoes_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_autoridade_acoes" ADD CONSTRAINT "ia_autoridade_acoes_supervisor_robo_id_fkey" FOREIGN KEY (supervisor_robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_comunicacoes_fila_robos" ADD CONSTRAINT "ia_comunicacoes_fila_robos_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_comunicacoes_robos" ADD CONSTRAINT "ia_comunicacoes_robos_destino_robo_id_fkey" FOREIGN KEY (destino_robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_comunicacoes_robos" ADD CONSTRAINT "ia_comunicacoes_robos_origem_robo_id_fkey" FOREIGN KEY (origem_robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_comunicacoes_robos" ADD CONSTRAINT "ia_comunicacoes_robos_resposta_robo_id_fkey" FOREIGN KEY (resposta_robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conector_robo" ADD CONSTRAINT "ia_conector_robo_conector_id_fkey" FOREIGN KEY (conector_id) REFERENCES ia_conectores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conector_robo" ADD CONSTRAINT "ia_conector_robo_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conhecimento" ADD CONSTRAINT "ia_conhecimento_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conhecimento" ADD CONSTRAINT "ia_conhecimento_setor_id_fkey" FOREIGN KEY (setor_id) REFERENCES ia_setores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conhecimento_distribuicao" ADD CONSTRAINT "ia_conhecimento_distribuicao_conhecimento_id_fkey" FOREIGN KEY (conhecimento_id) REFERENCES ia_conhecimento(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_conhecimento_distribuicao" ADD CONSTRAINT "ia_conhecimento_distribuicao_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_credenciais" ADD CONSTRAINT "ia_credenciais_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_escalonamento_config" ADD CONSTRAINT "ia_escalonamento_config_aprovador_robo_id_fkey" FOREIGN KEY (aprovador_robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_conectores" ADD CONSTRAINT "ia_execucoes_conectores_aprovacao_id_fkey" FOREIGN KEY (aprovacao_id) REFERENCES automacoes_aprovacoes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_conectores" ADD CONSTRAINT "ia_execucoes_conectores_conector_id_fkey" FOREIGN KEY (conector_id) REFERENCES ia_conectores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_conectores" ADD CONSTRAINT "ia_execucoes_conectores_ferramenta_id_fkey" FOREIGN KEY (ferramenta_id) REFERENCES ia_ferramentas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_conectores" ADD CONSTRAINT "ia_execucoes_conectores_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_conectores" ADD CONSTRAINT "ia_execucoes_conectores_tarefa_id_fkey" FOREIGN KEY (tarefa_id) REFERENCES automacoes_tarefas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_ferramentas" ADD CONSTRAINT "ia_execucoes_ferramentas_agente_execucao_id_fkey" FOREIGN KEY (agente_execucao_id) REFERENCES ia_agentes_execucao(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_ferramentas" ADD CONSTRAINT "ia_execucoes_ferramentas_aprovacao_id_fkey" FOREIGN KEY (aprovacao_id) REFERENCES automacoes_aprovacoes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_ferramentas" ADD CONSTRAINT "ia_execucoes_ferramentas_ferramenta_id_fkey" FOREIGN KEY (ferramenta_id) REFERENCES ia_ferramentas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_ferramentas" ADD CONSTRAINT "ia_execucoes_ferramentas_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_execucoes_ferramentas" ADD CONSTRAINT "ia_execucoes_ferramentas_tarefa_id_fkey" FOREIGN KEY (tarefa_id) REFERENCES automacoes_tarefas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fila_trabalho" ADD CONSTRAINT "ia_fila_trabalho_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fila_trabalho" ADD CONSTRAINT "ia_fila_trabalho_trabalho_id_fkey" FOREIGN KEY (trabalho_id) REFERENCES ia_trabalhos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_etapas" ADD CONSTRAINT "ia_fluxos_etapas_destino_robo_id_fkey" FOREIGN KEY (destino_robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_etapas" ADD CONSTRAINT "ia_fluxos_etapas_fluxo_id_fkey" FOREIGN KEY (fluxo_id) REFERENCES ia_fluxos_empresa(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_etapas" ADD CONSTRAINT "ia_fluxos_etapas_origem_robo_id_fkey" FOREIGN KEY (origem_robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_execucao_log" ADD CONSTRAINT "ia_fluxos_execucao_log_etapa_id_fkey" FOREIGN KEY (etapa_id) REFERENCES ia_fluxos_etapas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_execucao_log" ADD CONSTRAINT "ia_fluxos_execucao_log_fluxo_id_fkey" FOREIGN KEY (fluxo_id) REFERENCES ia_fluxos_empresa(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_execucao_log" ADD CONSTRAINT "ia_fluxos_execucao_log_robo_destino_id_fkey" FOREIGN KEY (robo_destino_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_fluxos_execucao_log" ADD CONSTRAINT "ia_fluxos_execucao_log_robo_origem_id_fkey" FOREIGN KEY (robo_origem_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_governanca_log" ADD CONSTRAINT "ia_governanca_log_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_historico_indicadores" ADD CONSTRAINT "ia_historico_indicadores_indicador_id_fkey" FOREIGN KEY (indicador_id) REFERENCES ia_indicadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_historico_indicadores" ADD CONSTRAINT "ia_historico_indicadores_meta_id_fkey" FOREIGN KEY (meta_id) REFERENCES ia_metas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_historico_indicadores" ADD CONSTRAINT "ia_historico_indicadores_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_historico_trabalho" ADD CONSTRAINT "ia_historico_trabalho_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_historico_trabalho" ADD CONSTRAINT "ia_historico_trabalho_trabalho_id_fkey" FOREIGN KEY (trabalho_id) REFERENCES ia_trabalhos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_identidades" ADD CONSTRAINT "ia_identidades_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_indicadores" ADD CONSTRAINT "ia_indicadores_meta_id_fkey" FOREIGN KEY (meta_id) REFERENCES ia_metas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_indicadores" ADD CONSTRAINT "ia_indicadores_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_integracoes_externas_logs" ADD CONSTRAINT "ia_integracoes_externas_logs_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_integracoes_externas_logs" ADD CONSTRAINT "ia_integracoes_externas_logs_sessao_id_fkey" FOREIGN KEY (sessao_id) REFERENCES ia_sessoes_operacionais(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_kpis_robo" ADD CONSTRAINT "ia_kpis_robo_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_limites_operacionais" ADD CONSTRAINT "ia_limites_operacionais_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_metas" ADD CONSTRAINT "ia_metas_missao_id_fkey" FOREIGN KEY (missao_id) REFERENCES ia_missoes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_metas" ADD CONSTRAINT "ia_metas_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_missoes" ADD CONSTRAINT "ia_missoes_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_missoes_execucao" ADD CONSTRAINT "ia_missoes_execucao_missao_id_fkey" FOREIGN KEY (missao_id) REFERENCES ia_missoes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_missoes_execucao" ADD CONSTRAINT "ia_missoes_execucao_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_modelos_mensagem" ADD CONSTRAINT "ia_modelos_mensagem_setor_id_fkey" FOREIGN KEY (setor_id) REFERENCES ia_setores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_regras" ADD CONSTRAINT "ia_regras_setor_id_fkey" FOREIGN KEY (setor_id) REFERENCES ia_setores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_robo_ferramentas" ADD CONSTRAINT "ia_robo_ferramentas_ferramenta_id_fkey" FOREIGN KEY (ferramenta_id) REFERENCES ia_ferramentas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_robo_ferramentas" ADD CONSTRAINT "ia_robo_ferramentas_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_score_robo" ADD CONSTRAINT "ia_score_robo_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_sessoes_operacionais" ADD CONSTRAINT "ia_sessoes_operacionais_identidade_id_fkey" FOREIGN KEY (identidade_id) REFERENCES ia_identidades(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_sessoes_operacionais" ADD CONSTRAINT "ia_sessoes_operacionais_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_sugestoes_melhoria" ADD CONSTRAINT "ia_sugestoes_melhoria_origem_insight_id_fkey" FOREIGN KEY (origem_insight_id) REFERENCES ia_insights_automaticos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_tarefas_automaticas" ADD CONSTRAINT "ia_tarefas_automaticas_setor_id_fkey" FOREIGN KEY (setor_id) REFERENCES ia_setores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_trabalhos" ADD CONSTRAINT "ia_trabalhos_atribuido_por_robo_fkey" FOREIGN KEY (atribuido_por_robo) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_trabalhos" ADD CONSTRAINT "ia_trabalhos_criado_por_robo_fkey" FOREIGN KEY (criado_por_robo) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ia_trabalhos" ADD CONSTRAINT "ia_trabalhos_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."leads" ADD CONSTRAINT "leads_campanha_id_fkey" FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_conhecimento" ADD CONSTRAINT "memoria_conhecimento_processamento_id_fkey" FOREIGN KEY (processamento_id) REFERENCES processamento_fila(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_conhecimento" ADD CONSTRAINT "memoria_conhecimento_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_conversas" ADD CONSTRAINT "memoria_conversas_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_entidades" ADD CONSTRAINT "memoria_entidades_criado_por_robo_fkey" FOREIGN KEY (criado_por_robo) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_entidades" ADD CONSTRAINT "memoria_entidades_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_eventos" ADD CONSTRAINT "memoria_eventos_criado_por_robo_fkey" FOREIGN KEY (criado_por_robo) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_eventos" ADD CONSTRAINT "memoria_eventos_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_preferencias" ADD CONSTRAINT "memoria_preferencias_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_resumos" ADD CONSTRAINT "memoria_resumos_gerado_por_fkey" FOREIGN KEY (gerado_por) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."memoria_resumos" ADD CONSTRAINT "memoria_resumos_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."motorista_app_sessoes" ADD CONSTRAINT "motorista_app_sessoes_motorista_id_fkey" FOREIGN KEY (motorista_id) REFERENCES prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."motorista_checkins" ADD CONSTRAINT "motorista_checkins_escala_id_fkey" FOREIGN KEY (escala_id) REFERENCES escala_operacional(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."motorista_checkins" ADD CONSTRAINT "motorista_checkins_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ocorrencias" ADD CONSTRAINT "ocorrencias_alocacao_id_fkey" FOREIGN KEY (alocacao_id) REFERENCES alocacoes_escala(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ocorrencias" ADD CONSTRAINT "ocorrencias_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ocorrencias" ADD CONSTRAINT "ocorrencias_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ocorrencias" ADD CONSTRAINT "ocorrencias_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operacao_mensagens" ADD CONSTRAINT "operacao_mensagens_alocacao_id_fkey" FOREIGN KEY (alocacao_id) REFERENCES alocacoes_escala(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operacao_mensagens" ADD CONSTRAINT "operacao_mensagens_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."operacao_mensagens" ADD CONSTRAINT "operacao_mensagens_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ordens_servico" ADD CONSTRAINT "ordens_servico_cliente_fkey" FOREIGN KEY (cliente) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ordens_servico" ADD CONSTRAINT "ordens_servico_pedido_portal_id_fkey" FOREIGN KEY (pedido_portal_id) REFERENCES portal_pedidos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ordens_servico" ADD CONSTRAINT "ordens_servico_prestador_fkey" FOREIGN KEY (prestador) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."ordens_servico" ADD CONSTRAINT "ordens_servico_veiculo_alocado_fkey" FOREIGN KEY (veiculo_alocado) REFERENCES veiculos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."os_historico" ADD CONSTRAINT "os_historico_ordem_servico_id_fkey" FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."os_ocorrencias" ADD CONSTRAINT "fk_ocorrencia_os" FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."os_ocorrencias" ADD CONSTRAINT "fk_ocorrencia_prestador" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."os_pod" ADD CONSTRAINT "fk_pod_os" FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."os_pod" ADD CONSTRAINT "fk_pod_prestador" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pagamentos_prestadores" ADD CONSTRAINT "fk_fechamento_pai" FOREIGN KEY (fechamento_id) REFERENCES pagamentos_prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pagamentos_prestadores" ADD CONSTRAINT "pagamentos_prestadores_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pagamentos_prestadores_itens" ADD CONSTRAINT "pagamentos_prestadores_itens_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."pagamentos_prestadores_itens" ADD CONSTRAINT "pagamentos_prestadores_itens_pagamento_id_fkey" FOREIGN KEY (pagamento_id) REFERENCES pagamentos_prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_alertas" ADD CONSTRAINT "patio_alertas_checkin_id_fkey" FOREIGN KEY (checkin_id) REFERENCES patio_checkins(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_alertas" ADD CONSTRAINT "patio_alertas_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_checkins" ADD CONSTRAINT "patio_checkins_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_checkins" ADD CONSTRAINT "patio_checkins_doca_id_fkey" FOREIGN KEY (doca_id) REFERENCES patio_docas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_checkins" ADD CONSTRAINT "patio_checkins_liberado_por_fkey" FOREIGN KEY (liberado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_checkins" ADD CONSTRAINT "patio_checkins_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_checkins" ADD CONSTRAINT "patio_checkins_unidade_id_fkey" FOREIGN KEY (unidade_id) REFERENCES patio_unidades(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_docas" ADD CONSTRAINT "patio_docas_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_docas" ADD CONSTRAINT "patio_docas_unidade_id_fkey" FOREIGN KEY (unidade_id) REFERENCES patio_unidades(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_eventos" ADD CONSTRAINT "patio_eventos_checkin_id_fkey" FOREIGN KEY (checkin_id) REFERENCES patio_checkins(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_eventos" ADD CONSTRAINT "patio_eventos_responsavel_id_fkey" FOREIGN KEY (responsavel_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_eventos" ADD CONSTRAINT "patio_eventos_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_fila" ADD CONSTRAINT "patio_fila_chamado_por_fkey" FOREIGN KEY (chamado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_fila" ADD CONSTRAINT "patio_fila_checkin_id_fkey" FOREIGN KEY (checkin_id) REFERENCES patio_checkins(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_fila" ADD CONSTRAINT "patio_fila_doca_sugerida_id_fkey" FOREIGN KEY (doca_sugerida_id) REFERENCES patio_docas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_fila" ADD CONSTRAINT "patio_fila_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_fila" ADD CONSTRAINT "patio_fila_unidade_id_fkey" FOREIGN KEY (unidade_id) REFERENCES patio_unidades(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_regras_fila" ADD CONSTRAINT "patio_regras_fila_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_regras_fila" ADD CONSTRAINT "patio_regras_fila_unidade_id_fkey" FOREIGN KEY (unidade_id) REFERENCES patio_unidades(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_rodizio" ADD CONSTRAINT "patio_rodizio_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_rodizio" ADD CONSTRAINT "patio_rodizio_unidade_id_fkey" FOREIGN KEY (unidade_id) REFERENCES patio_unidades(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_unidades" ADD CONSTRAINT "patio_unidades_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."patio_unidades" ADD CONSTRAINT "patio_unidades_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_notificacoes" ADD CONSTRAINT "portal_notificacoes_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."portal_ocorrencias" ADD CONSTRAINT "portal_ocorrencias_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestador_disponibilidade" ADD CONSTRAINT "fk_prestador_disp" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestador_os" ADD CONSTRAINT "fk_prestador_os_os" FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestador_os" ADD CONSTRAINT "fk_prestador_os_prestador" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestadores" ADD CONSTRAINT "prestadores_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."prestadores_ocorrencias" ADD CONSTRAINT "prestadores_ocorrencias_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."processamento_fila" ADD CONSTRAINT "processamento_fila_academia_material_id_fkey" FOREIGN KEY (academia_material_id) REFERENCES academia_materiais(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."processamento_fila" ADD CONSTRAINT "processamento_fila_curso_id_fkey" FOREIGN KEY (curso_id) REFERENCES academia_cursos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."processamento_fila" ADD CONSTRAINT "processamento_fila_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."provider_documents" ADD CONSTRAINT "provider_documents_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."raciocinio_auditoria" ADD CONSTRAINT "raciocinio_auditoria_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_candidatos" ADD CONSTRAINT "fk_recrutamento_candidatos_prestador" FOREIGN KEY (prestador_id) REFERENCES recrutamento_prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."recrutamento_whatsapp_mensagens" ADD CONSTRAINT "recrutamento_whatsapp_mensagens_conversa_id_fkey" FOREIGN KEY (conversa_id) REFERENCES recrutamento_whatsapp_conversas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rede_oportunidades" ADD CONSTRAINT "rede_oportunidades_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rede_oportunidades" ADD CONSTRAINT "rede_oportunidades_prestador_aceite_id_fkey" FOREIGN KEY (prestador_aceite_id) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rede_visualizacoes" ADD CONSTRAINT "rede_visualizacoes_oportunidade_id_fkey" FOREIGN KEY (oportunidade_id) REFERENCES rede_oportunidades(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rede_visualizacoes" ADD CONSTRAINT "rede_visualizacoes_prestador_id_fkey" FOREIGN KEY (prestador_id) REFERENCES prestadores(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."reembolsos_prestador" ADD CONSTRAINT "reembolsos_prestador_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."regras_fiscais_cte" ADD CONSTRAINT "regras_fiscais_cte_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."regras_fiscais_cte" ADD CONSTRAINT "regras_fiscais_cte_emitente_id_fkey" FOREIGN KEY (emitente_id) REFERENCES configuracoes_fiscais(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."regras_fiscais_nfse" ADD CONSTRAINT "regras_fiscais_nfse_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."regras_fiscais_nfse" ADD CONSTRAINT "regras_fiscais_nfse_emitente_id_fkey" FOREIGN KEY (emitente_id) REFERENCES configuracoes_fiscais(id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rota_execucoes" ADD CONSTRAINT "rota_execucoes_rota_id_fkey" FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rota_paradas" ADD CONSTRAINT "rota_paradas_alocacao_id_fkey" FOREIGN KEY (alocacao_id) REFERENCES alocacoes_escala(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rota_paradas" ADD CONSTRAINT "rota_paradas_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rota_paradas" ADD CONSTRAINT "rota_paradas_rota_id_fkey" FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rotas" ADD CONSTRAINT "rotas_alocacao_id_fkey" FOREIGN KEY (alocacao_id) REFERENCES alocacoes_escala(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rotas" ADD CONSTRAINT "rotas_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rotas" ADD CONSTRAINT "rotas_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rotinas_execucoes_ia" ADD CONSTRAINT "rotinas_execucoes_ia_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rotinas_execucoes_ia" ADD CONSTRAINT "rotinas_execucoes_ia_rotina_id_fkey" FOREIGN KEY (rotina_id) REFERENCES rotinas_ia(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."rotinas_ia" ADD CONSTRAINT "rotinas_ia_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."route_stops" ADD CONSTRAINT "route_stops_operation_id_fkey" FOREIGN KEY (operation_id) REFERENCES driver_operations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tenant_usuarios" ADD CONSTRAINT "tenant_usuarios_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."tracking_public_links" ADD CONSTRAINT "tracking_public_links_os_id_fkey" FOREIGN KEY (os_id) REFERENCES ordens_servico(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."treinamento_arquivos_ia" ADD CONSTRAINT "treinamento_arquivos_ia_conhecimento_id_fkey" FOREIGN KEY (conhecimento_id) REFERENCES ia_conhecimento(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."treinamento_arquivos_ia" ADD CONSTRAINT "treinamento_arquivos_ia_robo_id_fkey" FOREIGN KEY (robo_id) REFERENCES automacoes_robos(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."usuarios_cliente" ADD CONSTRAINT "usuarios_cliente_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."usuarios_cliente" ADD CONSTRAINT "usuarios_cliente_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."veiculos" ADD CONSTRAINT "veiculos_prestador_vinculado_fkey" FOREIGN KEY (prestador_vinculado) REFERENCES prestadores(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."whatsapp_conversas" ADD CONSTRAINT "whatsapp_conversas_instancia_id_fkey" FOREIGN KEY (instancia_id) REFERENCES whatsapp_instancias(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."whatsapp_mensagens" ADD CONSTRAINT "whatsapp_mensagens_conversa_id_fkey" FOREIGN KEY (conversa_id) REFERENCES whatsapp_conversas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE public."whatsapp_mensagens" ADD CONSTRAINT "whatsapp_mensagens_instancia_id_fkey" FOREIGN KEY (instancia_id) REFERENCES whatsapp_instancias(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 7. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_academia_cursos_robo ON public.academia_cursos USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_academia_cursos_status ON public.academia_cursos USING btree (status);
CREATE INDEX IF NOT EXISTS idx_academia_materiais_curso ON public.academia_materiais USING btree (curso_id);
CREATE INDEX IF NOT EXISTS idx_academia_materiais_tipo ON public.academia_materiais USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_academia_progresso_curso ON public.academia_progresso USING btree (curso_id);
CREATE INDEX IF NOT EXISTS idx_academia_progresso_robo ON public.academia_progresso USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_agentes_ia_ativo ON public.agentes_ia_internos USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_agentes_ia_codigo ON public.agentes_ia_internos USING btree (codigo);
CREATE INDEX IF NOT EXISTS idx_agentes_ia_setor ON public.agentes_ia_internos USING btree (setor);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_cliente ON public.alocacoes_escala USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_data ON public.alocacoes_escala USING btree (data_escala);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_data_escala ON public.alocacoes_escala USING btree (data_escala DESC);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_data_prestador ON public.alocacoes_escala USING btree (data_escala, prestador_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_data_status ON public.alocacoes_escala USING btree (data_escala, status);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_etapa_app ON public.alocacoes_escala USING btree ((((metadata -> 'app_motorista'::text) ->> 'etapa_atual'::text))) WHERE ((metadata -> 'app_motorista'::text) IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_metadata ON public.alocacoes_escala USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_os ON public.alocacoes_escala USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_prestador ON public.alocacoes_escala USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_prestador_id ON public.alocacoes_escala USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_status ON public.alocacoes_escala USING btree (status);
CREATE INDEX IF NOT EXISTS idx_alocacoes_escala_tags ON public.alocacoes_escala USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_created ON public.ia_aprendizado_eventos USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_entidade ON public.ia_aprendizado_eventos USING btree (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_origem ON public.ia_aprendizado_eventos USING btree (origem);
CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_robo ON public.ia_aprendizado_eventos USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_aprendizado_eventos_tipo ON public.ia_aprendizado_eventos USING btree (tipo_evento);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_fila_aprovador ON public.ia_aprovacoes_fila USING btree (aprovador_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_fila_robo ON public.ia_aprovacoes_fila USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_fila_status ON public.ia_aprovacoes_fila USING btree (status);
CREATE INDEX IF NOT EXISTS idx_auth_eventos_criado ON public.auth_eventos_auditoria USING btree (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auth_eventos_email ON public.auth_eventos_auditoria USING btree (email);
CREATE INDEX IF NOT EXISTS idx_auth_eventos_tipo ON public.auth_eventos_auditoria USING btree (tipo_evento);
CREATE INDEX IF NOT EXISTS idx_auth_eventos_user ON public.auth_eventos_auditoria USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_auto_aprov_status ON public.automacoes_aprovacoes USING btree (status);
CREATE INDEX IF NOT EXISTS idx_auto_aprov_tarefa ON public.automacoes_aprovacoes USING btree (tarefa_id);
CREATE INDEX IF NOT EXISTS idx_auto_aprov_tipo ON public.automacoes_aprovacoes USING btree (tipo_aprovacao);
CREATE INDEX IF NOT EXISTS idx_auto_logs_acao ON public.automacoes_logs USING btree (acao);
CREATE INDEX IF NOT EXISTS idx_auto_logs_criado ON public.automacoes_logs USING btree (criado_em);
CREATE INDEX IF NOT EXISTS idx_auto_logs_robo ON public.automacoes_logs USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_auto_logs_tarefa ON public.automacoes_logs USING btree (tarefa_id);
CREATE INDEX IF NOT EXISTS idx_auto_tarefas_prioridade ON public.automacoes_tarefas USING btree (prioridade);
CREATE INDEX IF NOT EXISTS idx_auto_tarefas_robo ON public.automacoes_tarefas USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_auto_tarefas_setor ON public.automacoes_tarefas USING btree (setor);
CREATE INDEX IF NOT EXISTS idx_auto_tarefas_status ON public.automacoes_tarefas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_automacoes_execucoes_status ON public.automacoes_execucoes USING btree (status);
CREATE INDEX IF NOT EXISTS idx_automacoes_fila_status ON public.automacoes_fila USING btree (status);
CREATE INDEX IF NOT EXISTS idx_automacoes_instrucoes_robo ON public.automacoes_instrucoes USING btree (robo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_automacoes_instrucoes_robo_ativo ON public.automacoes_instrucoes USING btree (robo_id) WHERE (ativo = true);
CREATE INDEX IF NOT EXISTS idx_automacoes_instrucoes_status ON public.automacoes_instrucoes USING btree (status);
CREATE INDEX IF NOT EXISTS idx_automacoes_regras_ativa ON public.automacoes_regras USING btree (ativa);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_agente_interno ON public.automacoes_robos USING btree (is_agente_interno) WHERE (is_agente_interno = true);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_ativo ON public.automacoes_robos USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_exige_aprovacao ON public.automacoes_robos USING btree (exige_aprovacao_humana);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_modo ON public.automacoes_robos USING btree (modo);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_modo_atual ON public.automacoes_robos USING btree (modo_atual);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_permite_envio ON public.automacoes_robos USING btree (permite_envio_externo);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_setor ON public.automacoes_robos USING btree (setor);
CREATE INDEX IF NOT EXISTS idx_automacoes_robos_status ON public.automacoes_robos USING btree (status);
CREATE INDEX IF NOT EXISTS idx_autoridade_acao ON public.ia_autoridade_acoes USING btree (acao_tipo);
CREATE INDEX IF NOT EXISTS idx_autoridade_robo ON public.ia_autoridade_acoes USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_biblioteca_pasta ON public.biblioteca_documentos USING btree (pasta);
CREATE INDEX IF NOT EXISTS idx_campanhas_status ON public.campanhas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_candidato_documentos_candidato_id_rc ON public.candidato_documentos USING btree (candidato_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_cpf ON public.candidatos USING btree (cpf);
CREATE INDEX IF NOT EXISTS idx_candidatos_criado_em ON public.candidatos USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_candidatos_prestador ON public.candidatos USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_regiao ON public.candidatos USING btree (regiao);
CREATE INDEX IF NOT EXISTS idx_candidatos_status ON public.candidatos USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ce_events_alocacao_id ON public.communication_events USING btree (alocacao_id);
CREATE INDEX IF NOT EXISTS idx_ce_events_cliente_id ON public.communication_events USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_ce_events_created_at ON public.communication_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ce_events_evento ON public.communication_events USING btree (evento);
CREATE INDEX IF NOT EXISTS idx_ce_events_os_id ON public.communication_events USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_ce_events_publico ON public.communication_events USING btree (publico);
CREATE INDEX IF NOT EXISTS idx_ce_events_status ON public.communication_events USING btree (status_envio);
CREATE INDEX IF NOT EXISTS idx_cert_ativo ON public.certificados_fiscais USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_cert_emitente ON public.certificados_fiscais USING btree (emitente_id);
CREATE INDEX IF NOT EXISTS idx_cf_ambiente ON public.configuracoes_fiscais USING btree (ambiente_fiscal);
CREATE INDEX IF NOT EXISTS idx_cf_ativo ON public.configuracoes_fiscais USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_cf_cnpj ON public.configuracoes_fiscais USING btree (cnpj);
CREATE INDEX IF NOT EXISTS idx_cf_padrao ON public.configuracoes_fiscais USING btree (padrao);
CREATE INDEX IF NOT EXISTS idx_clientes_contratos_cliente_id ON public.clientes_contratos USING btree (cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_composicao_os_unique ON public.composicao_financeira_os USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_comunic_created ON public.ia_comunicacoes_robos USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comunic_destino ON public.ia_comunicacoes_robos USING btree (destino_robo_id);
CREATE INDEX IF NOT EXISTS idx_comunic_origem ON public.ia_comunicacoes_robos USING btree (origem_robo_id);
CREATE INDEX IF NOT EXISTS idx_comunic_status ON public.ia_comunicacoes_robos USING btree (status);
CREATE INDEX IF NOT EXISTS idx_comunic_tarefa ON public.ia_comunicacoes_robos USING btree (tarefa_id);
CREATE INDEX IF NOT EXISTS idx_comunic_tipo ON public.ia_comunicacoes_robos USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_canal ON public.comunicacoes_mensagens USING btree (canal);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_mensagens_modo_homolog ON public.comunicacoes_mensagens USING btree (modo_homologacao);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_mensagens_motivo_bloqueio ON public.comunicacoes_mensagens USING btree (motivo_bloqueio);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_modo_homolog ON public.comunicacoes_mensagens USING btree (modo_homologacao);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_motivo_bloqueio ON public.comunicacoes_mensagens USING btree (motivo_bloqueio);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_robo ON public.comunicacoes_mensagens USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_status ON public.comunicacoes_mensagens USING btree (status);
CREATE INDEX IF NOT EXISTS idx_comunicacoes_tarefa ON public.comunicacoes_mensagens USING btree (tarefa_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_fiscais_ativo ON public.configuracoes_fiscais USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_configuracoes_fiscais_padrao ON public.configuracoes_fiscais USING btree (padrao) WHERE (padrao = true);
CREATE INDEX IF NOT EXISTS idx_contratos_gerados_metadata ON public.contratos_gerados USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_contratos_gerados_numero ON public.contratos_gerados USING btree (numero_contrato);
CREATE INDEX IF NOT EXISTS idx_contratos_gerados_prestador_id ON public.contratos_gerados USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_convites_email ON public.convites USING btree (email);
CREATE INDEX IF NOT EXISTS idx_convites_tenant ON public.convites USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cp_prefs_cliente_id ON public.communication_preferences USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_criativos_campanha ON public.criativos USING btree (campanha_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversas_canal ON public.crm_conversas USING btree (canal);
CREATE INDEX IF NOT EXISTS idx_crm_conversas_status ON public.crm_conversas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_crm_followups_lead_id ON public.crm_followups USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_followups_status ON public.crm_followups USING btree (status);
CREATE INDEX IF NOT EXISTS idx_crm_historico_lead_id ON public.crm_historico USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_interacoes_data ON public.crm_interacoes_prestadores USING btree (data DESC);
CREATE INDEX IF NOT EXISTS idx_crm_interacoes_prestador_id ON public.crm_interacoes_prestadores USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at ON public.crm_leads USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_crm_leads_estagio ON public.crm_leads USING btree (estagio);
CREATE INDEX IF NOT EXISTS idx_crm_leads_origem ON public.crm_leads USING btree (origem);
CREATE INDEX IF NOT EXISTS idx_crm_leads_responsavel ON public.crm_leads USING btree (responsavel);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON public.crm_leads USING btree (status);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_conversa_id ON public.crm_mensagens USING btree (conversa_id);
CREATE INDEX IF NOT EXISTS idx_crm_mensagens_direction ON public.crm_mensagens USING btree (direction);
CREATE INDEX IF NOT EXISTS idx_ct_templates_ativo ON public.communication_templates USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_ct_templates_codigo ON public.communication_templates USING btree (codigo);
CREATE INDEX IF NOT EXISTS idx_ct_templates_evento ON public.communication_templates USING btree (evento);
CREATE INDEX IF NOT EXISTS idx_ct_templates_publico ON public.communication_templates USING btree (publico);
CREATE INDEX IF NOT EXISTS idx_decisoes_created ON public.diretor_virtual_decisoes_ia USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisoes_robo ON public.diretor_virtual_decisoes_ia USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_decisoes_status ON public.diretor_virtual_decisoes_ia USING btree (status);
CREATE INDEX IF NOT EXISTS idx_decisoes_tipo ON public.diretor_virtual_decisoes_ia USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_driver_id ON public.delivery_proofs USING btree (driver_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_proofs_idempotency ON public.delivery_proofs USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_operation_id ON public.delivery_proofs USING btree (operation_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_parada_id ON public.delivery_proofs USING btree (parada_id) WHERE (parada_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_desp_oper_categoria ON public.despesas_operacionais USING btree (categoria);
CREATE INDEX IF NOT EXISTS idx_desp_oper_competencia ON public.despesas_operacionais USING btree (data_competencia);
CREATE INDEX IF NOT EXISTS idx_desp_oper_veiculo ON public.despesas_operacionais USING btree (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_dest_autorizados_ambiente ON public.comunicacoes_destinatarios_autorizados USING btree (ambiente);
CREATE INDEX IF NOT EXISTS idx_dest_autorizados_permitido ON public.comunicacoes_destinatarios_autorizados USING btree (permitido);
CREATE INDEX IF NOT EXISTS idx_dest_autorizados_setor ON public.comunicacoes_destinatarios_autorizados USING btree (setor);
CREATE INDEX IF NOT EXISTS idx_dest_autorizados_tipo ON public.comunicacoes_destinatarios_autorizados USING btree (tipo_destinatario);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dest_autorizados_unique ON public.comunicacoes_destinatarios_autorizados USING btree (tipo_destinatario, COALESCE(origem_id, ''::text), canal, setor, ambiente);
CREATE UNIQUE INDEX IF NOT EXISTS idx_diretor_virtual_unique ON public.diretor_virtual_ia USING btree ((true));
CREATE INDEX IF NOT EXISTS idx_distribuicao_ativo ON public.ia_conhecimento_distribuicao USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_distribuicao_conhecimento ON public.ia_conhecimento_distribuicao USING btree (conhecimento_id);
CREATE INDEX IF NOT EXISTS idx_distribuicao_robo ON public.ia_conhecimento_distribuicao USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_prestador ON public.documentos_prestadores USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_driver_operations_driver_id ON public.driver_operations USING btree (driver_id);
CREATE INDEX IF NOT EXISTS idx_enderecos_cliente_cliente ON public.enderecos_cliente USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_enderecos_cliente_uso ON public.enderecos_cliente USING btree (cliente_id, contador_uso DESC);
CREATE INDEX IF NOT EXISTS idx_enderecos_clientes_cep ON public.enderecos_clientes USING btree (cep);
CREATE INDEX IF NOT EXISTS idx_enderecos_clientes_cliente_id ON public.enderecos_clientes USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_alocacao ON public.entregas_protocolo USING btree (alocacao_id);
CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_alocacao_id ON public.entregas_protocolo USING btree (alocacao_id);
CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_parada_id ON public.entregas_protocolo USING btree (parada_id) WHERE (parada_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_prestador ON public.entregas_protocolo USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_escala_data_operacao ON public.escala_operacional USING btree (data_operacao);
CREATE INDEX IF NOT EXISTS idx_escala_prestador ON public.escala_operacional USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_escala_status ON public.escala_operacional USING btree (status);
CREATE INDEX IF NOT EXISTS idx_escalonamento_tipo ON public.ia_escalonamento_config USING btree (tipo_acao);
CREATE INDEX IF NOT EXISTS idx_eventos_created ON public.diretor_virtual_eventos_ia USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_created ON public.eventos_oficiais USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_entity ON public.eventos_oficiais USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_source ON public.eventos_oficiais USING btree (source);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_status ON public.eventos_oficiais USING btree (status);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_tenant ON public.eventos_oficiais USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_type ON public.eventos_oficiais USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_eventos_oficiais_visibility ON public.eventos_oficiais USING btree (visibility);
CREATE INDEX IF NOT EXISTS idx_eventos_robo ON public.diretor_virtual_eventos_ia USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_eventos_rotina ON public.diretor_virtual_eventos_ia USING btree (rotina_id);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON public.diretor_virtual_eventos_ia USING btree (tipo_evento);
CREATE INDEX IF NOT EXISTS idx_fatura_itens_fatura ON public.fatura_itens USING btree (fatura_id);
CREATE INDEX IF NOT EXISTS idx_fatura_itens_os ON public.fatura_itens USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cliente_status ON public.faturas USING btree (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_faturas_tenant_status ON public.faturas USING btree (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_faturas_vencimento ON public.faturas USING btree (vencimento);
CREATE INDEX IF NOT EXISTS idx_fb_data ON public.financeiro_baixas USING btree (data_baixa);
CREATE INDEX IF NOT EXISTS idx_fb_estorno ON public.financeiro_baixas USING btree (estornada) WHERE (estornada = true);
CREATE INDEX IF NOT EXISTS idx_fb_titulo ON public.financeiro_baixas USING btree (titulo_tabela, titulo_id);
CREATE INDEX IF NOT EXISTS idx_fb_titulo_id ON public.financeiro_baixas USING btree (titulo_id);
CREATE INDEX IF NOT EXISTS idx_fdv_chave ON public.fiscal_documentos_vinculados USING btree (chave_acesso);
CREATE INDEX IF NOT EXISTS idx_fdv_cte ON public.fiscal_documentos_vinculados USING btree (cte_id);
CREATE INDEX IF NOT EXISTS idx_fdv_mdfe ON public.fiscal_documentos_vinculados USING btree (mdfe_id);
CREATE INDEX IF NOT EXISTS idx_fdv_os ON public.fiscal_documentos_vinculados USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_fdv_status ON public.fiscal_documentos_vinculados USING btree (status);
CREATE INDEX IF NOT EXISTS idx_fdv_tipo ON public.fiscal_documentos_vinculados USING btree (tipo_documento);
CREATE INDEX IF NOT EXISTS idx_fila_created ON public.ia_comunicacoes_fila_robos USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_fila_robo ON public.ia_comunicacoes_fila_robos USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_fila_status ON public.ia_comunicacoes_fila_robos USING btree (status);
CREATE INDEX IF NOT EXISTS idx_financeiro_pagar_os_id ON public.financeiro_pagar USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_pagar_prestador_status ON public.financeiro_pagar USING btree (prestador, status);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_cliente_status ON public.financeiro_receber USING btree (cliente_id, status);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_fatura_id ON public.financeiro_receber USING btree (fatura_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_os_id ON public.financeiro_receber USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_chave_acesso ON public.fiscal_ctes USING btree (chave_acesso);
CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_cliente_id ON public.fiscal_ctes USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_data_emissao ON public.fiscal_ctes USING btree (data_emissao);
CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_os_id ON public.fiscal_ctes USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_ctes_status ON public.fiscal_ctes USING btree (status);
CREATE INDEX IF NOT EXISTS idx_fiscal_docs_chave ON public.fiscal_documentos_vinculados USING btree (chave_acesso);
CREATE INDEX IF NOT EXISTS idx_fiscal_docs_os ON public.fiscal_documentos_vinculados USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_docs_status ON public.fiscal_documentos_vinculados USING btree (status);
CREATE INDEX IF NOT EXISTS idx_fiscal_events_doc ON public.fiscal_events USING btree (documento_tipo, documento_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_historico_status_data ON public.fiscal_historico_status USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_historico_status_doc ON public.fiscal_historico_status USING btree (documento_tipo, documento_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_logs_entidade ON public.fiscal_logs USING btree (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_chave_acesso ON public.fiscal_mdfes USING btree (chave_acesso);
CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_cliente_id ON public.fiscal_mdfes USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_data_emissao ON public.fiscal_mdfes USING btree (data_emissao);
CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_os_id ON public.fiscal_mdfes USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_mdfes_status ON public.fiscal_mdfes USING btree (status);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_chave_acesso ON public.fiscal_nfse USING btree (chave_acesso);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_cliente_id ON public.fiscal_nfse USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_data_emissao ON public.fiscal_nfse USING btree (data_emissao);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_os_id ON public.fiscal_nfse USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfse_status ON public.fiscal_nfse USING btree (status);
CREATE INDEX IF NOT EXISTS idx_fluxo_recrutamento_ordem ON public.fluxo_recrutamento USING btree (ordem);
CREATE INDEX IF NOT EXISTS idx_fluxos_empresa_ativo ON public.ia_fluxos_empresa USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_fluxos_empresa_tipo ON public.ia_fluxos_empresa USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_fluxos_etapas_destino ON public.ia_fluxos_etapas USING btree (destino_robo_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_etapas_fluxo ON public.ia_fluxos_etapas USING btree (fluxo_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_etapas_ordem ON public.ia_fluxos_etapas USING btree (fluxo_id, ordem);
CREATE INDEX IF NOT EXISTS idx_fluxos_etapas_origem ON public.ia_fluxos_etapas USING btree (origem_robo_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_created ON public.ia_fluxos_execucao_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_execucao ON public.ia_fluxos_execucao_log USING btree (fluxo_execucao_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_fluxo ON public.ia_fluxos_execucao_log USING btree (fluxo_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_robo ON public.ia_fluxos_execucao_log USING btree (robo_destino_id);
CREATE INDEX IF NOT EXISTS idx_fluxos_exec_log_status ON public.ia_fluxos_execucao_log USING btree (status);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj ON public.fornecedores USING btree (cpf_cnpj);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fornecedores_cpf_cnpj_unique ON public.fornecedores USING btree (cpf_cnpj) WHERE (status = 'ativo'::text);
CREATE INDEX IF NOT EXISTS idx_fornecedores_razao_social ON public.fornecedores USING btree (razao_social);
CREATE INDEX IF NOT EXISTS idx_fornecedores_status ON public.fornecedores USING btree (status);
CREATE INDEX IF NOT EXISTS idx_fp_fornecedor_cadastro_id ON public.financeiro_pagar USING btree (fornecedor_cadastro_id);
CREATE INDEX IF NOT EXISTS idx_gatilhos_ativo ON public.automacoes_gatilhos USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_gatilhos_evento ON public.automacoes_gatilhos USING btree (evento);
CREATE INDEX IF NOT EXISTS idx_gatilhos_exec_evento ON public.automacoes_gatilhos_execucao USING btree (evento);
CREATE INDEX IF NOT EXISTS idx_gatilhos_exec_gatilho ON public.automacoes_gatilhos_execucao USING btree (gatilho_id);
CREATE INDEX IF NOT EXISTS idx_gatilhos_exec_status ON public.automacoes_gatilhos_execucao USING btree (status);
CREATE INDEX IF NOT EXISTS idx_gatilhos_prioridade ON public.automacoes_gatilhos USING btree (prioridade);
CREATE INDEX IF NOT EXISTS idx_gatilhos_robo ON public.automacoes_gatilhos USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_gatilhos_setor ON public.automacoes_gatilhos USING btree (setor);
CREATE INDEX IF NOT EXISTS idx_governanca_log_acao ON public.ia_governanca_log USING btree (acao_tipo);
CREATE INDEX IF NOT EXISTS idx_governanca_log_robo ON public.ia_governanca_log USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_historico_alocacao ON public.historico_alocacoes_escala USING btree (alocacao_id);
CREATE INDEX IF NOT EXISTS idx_historico_created ON public.historico_alocacoes_escala USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hml_cp_marcador ON public._hml_seed_checkpoint USING btree (marcador);
CREATE INDEX IF NOT EXISTS idx_hml_cp_status ON public._hml_seed_checkpoint USING btree (status);
CREATE INDEX IF NOT EXISTS idx_homologacoes_candidato ON public.homologacoes USING btree (candidato_id);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_atividades_agenda ON public.ia_agenda_atividades USING btree (agenda_id);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_atividades_horario ON public.ia_agenda_atividades USING btree (horario_inicio);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_atividades_robo ON public.ia_agenda_atividades USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_atividades_tipo ON public.ia_agenda_atividades USING btree (tipo_atividade);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_trabalho_dia ON public.ia_agenda_trabalho USING btree (dia_semana);
CREATE INDEX IF NOT EXISTS idx_ia_agenda_trabalho_robo ON public.ia_agenda_trabalho USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_agentes_execucao_estado ON public.ia_agentes_execucao USING btree (estado);
CREATE INDEX IF NOT EXISTS idx_ia_agentes_execucao_robo ON public.ia_agentes_execucao USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_aprovacoes_status ON public.ia_aprovacoes_humanas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_auditoria_perf_created ON public.ia_auditoria_performance USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_auditoria_perf_robo ON public.ia_auditoria_performance USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_auditoria_perf_tipo ON public.ia_auditoria_performance USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_ia_conector_robo_ativo ON public.ia_conector_robo USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_ia_conector_robo_conector ON public.ia_conector_robo USING btree (conector_id);
CREATE INDEX IF NOT EXISTS idx_ia_conector_robo_robo ON public.ia_conector_robo USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_conectores_ativo ON public.ia_conectores USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_ia_conectores_codigo ON public.ia_conectores USING btree (codigo_unico);
CREATE INDEX IF NOT EXISTS idx_ia_conectores_provedor ON public.ia_conectores USING btree (provedor);
CREATE INDEX IF NOT EXISTS idx_ia_conectores_provedor_tipo ON public.ia_conectores USING btree (provedor, tipo);
CREATE INDEX IF NOT EXISTS idx_ia_conectores_tipo ON public.ia_conectores USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_aprovado ON public.ia_conhecimento USING btree (aprovado_por);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_categoria ON public.ia_conhecimento USING btree (categoria);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_robo ON public.ia_conhecimento USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_setor ON public.ia_conhecimento USING btree (setor_id);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_status ON public.ia_conhecimento USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_tipo_conhecimento ON public.ia_conhecimento USING btree (tipo_conhecimento);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_validade ON public.ia_conhecimento USING btree (validade_inicio, validade_fim);
CREATE INDEX IF NOT EXISTS idx_ia_conhecimento_versao ON public.ia_conhecimento USING btree (versao);
CREATE INDEX IF NOT EXISTS idx_ia_credenciais_provedor ON public.ia_credenciais USING btree (provedor);
CREATE INDEX IF NOT EXISTS idx_ia_credenciais_robo ON public.ia_credenciais USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_credenciais_tipo ON public.ia_credenciais USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_ia_credenciais_zoho_status ON public.ia_credenciais_zoho USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_custos_data ON public.ia_custos_ia USING btree (tempo_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_custos_provedor ON public.ia_custos_ia USING btree (provedor, tempo_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_custos_tenant ON public.ia_custos_ia USING btree (tenant_id, tempo_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_custos_tipo ON public.ia_custos_ia USING btree (tipo_tarefa, tempo_execucao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_decisoes_criado_em ON public.ia_decisoes_logs USING btree (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ia_decisoes_setor ON public.ia_decisoes_logs USING btree (setor);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_conector ON public.ia_execucoes_conectores USING btree (conector_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_data ON public.ia_execucoes_conectores USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_duracao ON public.ia_execucoes_conectores USING btree (duracao_ms);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_robo ON public.ia_execucoes_conectores USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_status ON public.ia_execucoes_conectores USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_conectores_tentativa ON public.ia_execucoes_conectores USING btree (tentativa);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_data ON public.ia_execucoes_ferramentas USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_ferramenta ON public.ia_execucoes_ferramentas USING btree (ferramenta_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_ferramentas_agente ON public.ia_execucoes_ferramentas USING btree (agente_execucao_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_ferramentas_passo ON public.ia_execucoes_ferramentas USING btree (agente_execucao_id, passo_ordem);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_robo ON public.ia_execucoes_ferramentas USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_execucoes_status ON public.ia_execucoes_ferramentas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_ferramentas_ativo ON public.ia_ferramentas USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_ia_ferramentas_categoria ON public.ia_ferramentas USING btree (categoria);
CREATE INDEX IF NOT EXISTS idx_ia_ferramentas_codigo ON public.ia_ferramentas USING btree (codigo_unico);
CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_ordem ON public.ia_fila_trabalho USING btree (ordem_execucao);
CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_proxima ON public.ia_fila_trabalho USING btree (proxima_execucao) WHERE (proxima_execucao IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_robo ON public.ia_fila_trabalho USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_status ON public.ia_fila_trabalho USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_fila_trabalho_trabalho ON public.ia_fila_trabalho USING btree (trabalho_id);
CREATE INDEX IF NOT EXISTS idx_ia_historico_indicadores_data ON public.ia_historico_indicadores USING btree (data_apuracao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_historico_indicadores_meta ON public.ia_historico_indicadores USING btree (meta_id);
CREATE INDEX IF NOT EXISTS idx_ia_historico_indicadores_robo ON public.ia_historico_indicadores USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_historico_trabalho_data ON public.ia_historico_trabalho USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_historico_trabalho_robo ON public.ia_historico_trabalho USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_historico_trabalho_trabalho ON public.ia_historico_trabalho USING btree (trabalho_id);
CREATE INDEX IF NOT EXISTS idx_ia_identidades_perfil ON public.ia_identidades USING btree (perfil);
CREATE INDEX IF NOT EXISTS idx_ia_identidades_robo ON public.ia_identidades USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_identidades_status ON public.ia_identidades USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_indicadores_data ON public.ia_indicadores USING btree (data_apuracao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_indicadores_meta ON public.ia_indicadores USING btree (meta_id);
CREATE INDEX IF NOT EXISTS idx_ia_indicadores_robo ON public.ia_indicadores USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_integracoes_logs_canal ON public.ia_integracoes_externas_logs USING btree (canal);
CREATE INDEX IF NOT EXISTS idx_ia_integracoes_logs_criado ON public.ia_integracoes_externas_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_integracoes_logs_robo ON public.ia_integracoes_externas_logs USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_integracoes_logs_status ON public.ia_integracoes_externas_logs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_kpis_robo_periodicidade ON public.ia_kpis_robo USING btree (periodicidade);
CREATE INDEX IF NOT EXISTS idx_ia_kpis_robo_robo ON public.ia_kpis_robo USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_limites_operacionais_acao ON public.ia_limites_operacionais USING btree (acao_tipo);
CREATE INDEX IF NOT EXISTS idx_ia_limites_operacionais_robo ON public.ia_limites_operacionais USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_logs_criado_em ON public.ia_logs USING btree (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ia_logs_provider ON public.ia_logs USING btree (provider);
CREATE INDEX IF NOT EXISTS idx_ia_logs_telefone ON public.ia_logs USING btree (telefone) WHERE (telefone IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ia_metas_missao ON public.ia_metas USING btree (missao_id);
CREATE INDEX IF NOT EXISTS idx_ia_metas_periodicidade ON public.ia_metas USING btree (periodicidade);
CREATE INDEX IF NOT EXISTS idx_ia_metas_robo ON public.ia_metas USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_metas_status ON public.ia_metas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_exec_missao ON public.ia_missoes_execucao USING btree (missao_id);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_exec_robo ON public.ia_missoes_execucao USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_exec_status ON public.ia_missoes_execucao USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_prioridade ON public.ia_missoes USING btree (prioridade);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_robo ON public.ia_missoes USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_status ON public.ia_missoes USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_missoes_vigencia ON public.ia_missoes USING btree (inicio_vigencia, fim_vigencia);
CREATE INDEX IF NOT EXISTS idx_ia_modelos_setor ON public.ia_modelos_mensagem USING btree (setor_id);
CREATE INDEX IF NOT EXISTS idx_ia_regras_setor ON public.ia_regras USING btree (setor_id);
CREATE INDEX IF NOT EXISTS idx_ia_robo_ferramentas_ativo ON public.ia_robo_ferramentas USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_ia_robo_ferramentas_ferramenta ON public.ia_robo_ferramentas USING btree (ferramenta_id);
CREATE INDEX IF NOT EXISTS idx_ia_robo_ferramentas_robo ON public.ia_robo_ferramentas USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_score_robo_geral ON public.ia_score_robo USING btree (score_geral DESC);
CREATE INDEX IF NOT EXISTS idx_ia_sessoes_inicio ON public.ia_sessoes_operacionais USING btree (inicio DESC);
CREATE INDEX IF NOT EXISTS idx_ia_sessoes_robo ON public.ia_sessoes_operacionais USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_sessoes_status ON public.ia_sessoes_operacionais USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_tarefas_status ON public.ia_tarefas_automaticas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_data_criacao ON public.ia_trabalhos USING btree (data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_origem ON public.ia_trabalhos USING btree (origem);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_prioridade ON public.ia_trabalhos USING btree (prioridade);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_robo ON public.ia_trabalhos USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_status ON public.ia_trabalhos USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_tipo ON public.ia_trabalhos USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_ia_trabalhos_vencimento ON public.ia_trabalhos USING btree (data_vencimento) WHERE (data_vencimento IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_insights_created ON public.ia_insights_automaticos USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_prioridade ON public.ia_insights_automaticos USING btree (prioridade);
CREATE INDEX IF NOT EXISTS idx_insights_status ON public.ia_insights_automaticos USING btree (status);
CREATE INDEX IF NOT EXISTS idx_integracoes_config_tipo ON public.integracoes_config USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_leads_campanha ON public.leads USING btree (campanha_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads USING btree (status);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_busca ON public.memoria_conhecimento USING gin (to_tsvector('portuguese'::regconfig, conteudo));
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_categoria ON public.memoria_conhecimento USING btree (categoria);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_data ON public.memoria_conhecimento USING btree (data_ref DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_robo ON public.memoria_conhecimento USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_score ON public.memoria_conhecimento USING btree (score_relevancia DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_conhecimento_tags ON public.memoria_conhecimento USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_memoria_conversas_data ON public.memoria_conversas USING btree (data_fim DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_memoria_conversas_entidade ON public.memoria_conversas USING btree (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_conversas_robo ON public.memoria_conversas USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_nome ON public.memoria_entidades USING gin (to_tsvector('portuguese'::regconfig, nome));
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_relevancia ON public.memoria_entidades USING btree (relevancia DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_resumo ON public.memoria_entidades USING gin (to_tsvector('portuguese'::regconfig, COALESCE(resumo, ''::text)));
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_robo ON public.memoria_entidades USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_tipo_id ON public.memoria_entidades USING btree (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_entidades_ultima ON public.memoria_entidades USING btree (ultima_interacao DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_eventos_data ON public.memoria_eventos USING btree (data_evento DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_eventos_entidade ON public.memoria_eventos USING btree (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_eventos_robo ON public.memoria_eventos USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_eventos_tipo ON public.memoria_eventos USING btree (tipo_evento);
CREATE INDEX IF NOT EXISTS idx_memoria_preferencias_categoria ON public.memoria_preferencias USING btree (categoria);
CREATE INDEX IF NOT EXISTS idx_memoria_preferencias_entidade ON public.memoria_preferencias USING btree (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_preferencias_robo ON public.memoria_preferencias USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_memoria_resumos_data ON public.memoria_resumos USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memoria_resumos_entidade ON public.memoria_resumos USING btree (entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_memoria_resumos_robo ON public.memoria_resumos USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_metricas_robo ON public.diretor_virtual_metricas_ia USING btree (robo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metricas_robo_unique ON public.diretor_virtual_metricas_ia USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_motorista_checkins_escala ON public.motorista_checkins USING btree (escala_id);
CREATE INDEX IF NOT EXISTS idx_motorista_checkins_prestador ON public.motorista_checkins USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_motorista_sessoes_token ON public.motorista_app_sessoes USING btree (token);
CREATE INDEX IF NOT EXISTS idx_municipios_ibge_codigo ON public.municipios_ibge USING btree (codigo);
CREATE INDEX IF NOT EXISTS idx_municipios_ibge_nome_uf ON public.municipios_ibge USING btree (nome, uf);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_alocacao_id ON public.ocorrencias USING btree (alocacao_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_cliente_id ON public.ocorrencias USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_created_at ON public.ocorrencias USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_os ON public.os_ocorrencias USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_os_id ON public.ocorrencias USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_prestador ON public.prestadores_ocorrencias USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_prestador_id ON public.ocorrencias USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_status ON public.ocorrencias USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_tenant_id ON public.ocorrencias USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_tipo ON public.ocorrencias USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_oper_localizacao_alocacao ON public.operacao_localizacao USING btree (alocacao_id);
CREATE INDEX IF NOT EXISTS idx_oper_localizacao_os ON public.operacao_localizacao USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_oper_localizacao_prestador ON public.operacao_localizacao USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_oper_localizacao_tempo ON public.operacao_localizacao USING btree (atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_operacao_mensagens_alocacao ON public.operacao_mensagens USING btree (alocacao_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operacao_mensagens_nao_lidas ON public.operacao_mensagens USING btree (sender_type, status) WHERE (status = 'enviada'::text);
CREATE INDEX IF NOT EXISTS idx_operacao_mensagens_prestador ON public.operacao_mensagens USING btree (prestador_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operation_timeline_events_created_at ON public.operation_timeline_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_timeline_events_driver_id ON public.operation_timeline_events USING btree (driver_id);
CREATE INDEX IF NOT EXISTS idx_operation_timeline_events_operation_id ON public.operation_timeline_events USING btree (operation_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_numero ON public.orcamentos USING btree (numero);
CREATE INDEX IF NOT EXISTS idx_orcamentos_os_vinculada_id ON public.orcamentos USING btree (os_vinculada_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente_data ON public.ordens_servico USING btree (cliente_id, data);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_created_at ON public.ordens_servico USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_orcamento_id ON public.ordens_servico USING btree (orcamento_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_pedido_portal ON public.ordens_servico USING btree (pedido_portal_id) WHERE (pedido_portal_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_prestador_data ON public.ordens_servico USING btree (prestador_id, data);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON public.ordens_servico USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_valor_cliente ON public.ordens_servico USING btree (valor_cliente);
CREATE INDEX IF NOT EXISTS idx_os_cliente ON public.ordens_servico USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_data_servico ON public.ordens_servico USING btree (data_servico);
CREATE INDEX IF NOT EXISTS idx_os_historico_ordem_servico_id ON public.os_historico USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_os_prestador ON public.ordens_servico USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_os_status ON public.ordens_servico USING btree (status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_os ON public.pagamentos_prestadores USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_periodo ON public.pagamentos_prestadores USING btree (periodo_inicio, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestador ON public.pagamentos_prestadores USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_os_id ON public.pagamentos_prestadores USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_prestadores_prestador_status ON public.pagamentos_prestadores USING btree (prestador_id, status_pagamento);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON public.pagamentos_prestadores USING btree (status_pagamento);
CREATE INDEX IF NOT EXISTS idx_pagar_fornecedor ON public.financeiro_pagar USING btree (fornecedor);
CREATE INDEX IF NOT EXISTS idx_pagar_status ON public.financeiro_pagar USING btree (status);
CREATE INDEX IF NOT EXISTS idx_pagar_vencimento ON public.financeiro_pagar USING btree (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_patio_alertas_resolvido ON public.patio_alertas USING btree (resolvido) WHERE (resolvido = false);
CREATE INDEX IF NOT EXISTS idx_patio_alertas_tenant ON public.patio_alertas USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_cliente ON public.patio_checkins USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_doca ON public.patio_checkins USING btree (doca_id);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_os ON public.patio_checkins USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_placa ON public.patio_checkins USING btree (veiculo_placa);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_posicao ON public.patio_checkins USING btree (posicao_fila) WHERE (posicao_fila > 0);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_status ON public.patio_checkins USING btree (status);
CREATE INDEX IF NOT EXISTS idx_patio_checkins_tenant ON public.patio_checkins USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_docas_status ON public.patio_docas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_patio_docas_tenant ON public.patio_docas USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_docas_unidade ON public.patio_docas USING btree (unidade_id);
CREATE INDEX IF NOT EXISTS idx_patio_eventos_checkin ON public.patio_eventos USING btree (checkin_id);
CREATE INDEX IF NOT EXISTS idx_patio_eventos_created ON public.patio_eventos USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patio_eventos_tenant ON public.patio_eventos USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_fila_checkin ON public.patio_fila USING btree (checkin_id);
CREATE INDEX IF NOT EXISTS idx_patio_fila_posicao ON public.patio_fila USING btree (unidade_id, posicao);
CREATE INDEX IF NOT EXISTS idx_patio_fila_status ON public.patio_fila USING btree (status);
CREATE INDEX IF NOT EXISTS idx_patio_fila_tenant ON public.patio_fila USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_regras_tenant ON public.patio_regras_fila USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_regras_unidade ON public.patio_regras_fila USING btree (unidade_id);
CREATE INDEX IF NOT EXISTS idx_patio_rodizio_tenant ON public.patio_rodizio USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patio_rodizio_tipo ON public.patio_rodizio USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_patio_unidades_status ON public.patio_unidades USING btree (status);
CREATE INDEX IF NOT EXISTS idx_patio_unidades_tenant ON public.patio_unidades USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pending_uploads_driver_id ON public.pending_uploads USING btree (driver_id);
CREATE INDEX IF NOT EXISTS idx_perfis_papel ON public.perfis_permissoes USING btree (papel);
CREATE INDEX IF NOT EXISTS idx_pod_os ON public.os_pod USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_portal_avaliacoes_cliente ON public.portal_avaliacoes USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_avaliacoes_created ON public.portal_avaliacoes USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_avaliacoes_nota ON public.portal_avaliacoes USING btree (nota);
CREATE INDEX IF NOT EXISTS idx_portal_avaliacoes_os ON public.portal_avaliacoes USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_portal_comprovantes_cliente ON public.portal_comprovantes USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_comprovantes_created ON public.portal_comprovantes USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_comprovantes_os ON public.portal_comprovantes USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_portal_comprovantes_tipo ON public.portal_comprovantes USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_portal_faturas_cliente ON public.portal_faturas USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_faturas_created ON public.portal_faturas USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_faturas_numero ON public.portal_faturas USING btree (numero);
CREATE INDEX IF NOT EXISTS idx_portal_faturas_status ON public.portal_faturas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_portal_faturas_vencimento ON public.portal_faturas USING btree (vencimento);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_cliente ON public.portal_notificacoes USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_created ON public.portal_notificacoes USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_lida ON public.portal_notificacoes USING btree (lida);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_origem ON public.portal_notificacoes USING btree (origem_id, origem_tipo);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_os ON public.portal_notificacoes USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_prestador ON public.portal_notificacoes USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_portal_ocorrencias_cliente ON public.portal_ocorrencias USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_ocorrencias_created ON public.portal_ocorrencias USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_ocorrencias_status ON public.portal_ocorrencias USING btree (status);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_cidade ON public.portal_pedidos USING btree (entrega_cidade);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_cliente ON public.portal_pedidos USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_created ON public.portal_pedidos USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_idempotency ON public.portal_pedidos USING btree (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_numero ON public.portal_pedidos USING btree (numero_pedido);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_os_vinculada ON public.portal_pedidos USING btree (os_vinculada_id) WHERE (os_vinculada_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_pedidos_os_vinculada_unique ON public.portal_pedidos USING btree (os_vinculada_id) WHERE (os_vinculada_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_prioridade ON public.portal_pedidos USING btree (prioridade);
CREATE INDEX IF NOT EXISTS idx_portal_pedidos_status ON public.portal_pedidos USING btree (status);
CREATE INDEX IF NOT EXISTS idx_portal_preferencias_cliente ON public.portal_preferencias_cliente USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_cliente ON public.portal_protocolos USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_created ON public.portal_protocolos USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_os ON public.portal_protocolos USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_parada_id ON public.portal_protocolos USING btree (parada_id) WHERE (parada_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_protocolo ON public.portal_protocolos USING btree (protocolo);
CREATE INDEX IF NOT EXISTS idx_portal_protocolos_status ON public.portal_protocolos USING btree (status);
CREATE INDEX IF NOT EXISTS idx_portal_relatorios_cliente ON public.portal_relatorios USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_relatorios_created ON public.portal_relatorios USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_relatorios_tipo ON public.portal_relatorios USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_portal_rotas_cliente ON public.portal_rotas USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_rotas_created ON public.portal_rotas USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_rotas_status ON public.portal_rotas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_alocacao ON public.portal_tracking_realtime USING btree (alocacao_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_alocacao_captured ON public.portal_tracking_realtime USING btree (alocacao_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_captured ON public.portal_tracking_realtime USING btree (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_cliente ON public.portal_tracking_realtime USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_os ON public.portal_tracking_realtime USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_prestador ON public.portal_tracking_realtime USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_tenant ON public.portal_tracking_realtime USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_portal_tracking_updated ON public.portal_tracking_realtime USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_postagens_data ON public.postagens USING btree (data_planejada);
CREATE INDEX IF NOT EXISTS idx_pp_fechamento_id ON public.pagamentos_prestadores USING btree (fechamento_id) WHERE (fechamento_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_pp_fechamento_tipo ON public.pagamentos_prestadores USING btree (tipo_pagamento, prestador_id, periodo_inicio) WHERE (tipo_pagamento = 'fechamento'::text);
CREATE INDEX IF NOT EXISTS idx_prestador_os_os ON public.prestador_os USING btree (ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_prestador_os_prestador ON public.prestador_os USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_prestadores_app_cpf_cnpj ON public.prestadores_app USING btree (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_prestadores_app_email ON public.prestadores_app USING btree (email);
CREATE INDEX IF NOT EXISTS idx_prestadores_app_nivel ON public.prestadores_app USING btree (nivel_motorista);
CREATE INDEX IF NOT EXISTS idx_prestadores_app_status ON public.prestadores_app USING btree (status_operacional);
CREATE INDEX IF NOT EXISTS idx_prestadores_auth_user_id ON public.prestadores USING btree (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_prestadores_liberado_app ON public.prestadores USING btree (liberado_app);
CREATE INDEX IF NOT EXISTS idx_prestadores_origem ON public.prestadores USING btree (origem);
CREATE INDEX IF NOT EXISTS idx_processamento_fila_curso ON public.processamento_fila USING btree (curso_id);
CREATE INDEX IF NOT EXISTS idx_processamento_fila_data ON public.processamento_fila USING btree (data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_processamento_fila_robo ON public.processamento_fila USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_processamento_fila_status ON public.processamento_fila USING btree (status);
CREATE INDEX IF NOT EXISTS idx_processamento_fila_tipo ON public.processamento_fila USING btree (tipo_arquivo);
CREATE INDEX IF NOT EXISTS idx_provider_docs_prestador ON public.provider_documents USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_raciocinio_auditoria_data ON public.raciocinio_auditoria USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raciocinio_auditoria_robo ON public.raciocinio_auditoria USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_rascunhos_cpf_cnpj ON public.rascunhos_prestador USING btree (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_rascunhos_draft_token ON public.rascunhos_prestador USING btree (draft_token);
CREATE INDEX IF NOT EXISTS idx_rec_automacoes_status ON public.recrutamento_automacoes USING btree (status);
CREATE INDEX IF NOT EXISTS idx_rec_automacoes_tipo ON public.recrutamento_automacoes USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_receber_cliente ON public.financeiro_receber USING btree (cliente);
CREATE INDEX IF NOT EXISTS idx_receber_status ON public.financeiro_receber USING btree (status);
CREATE INDEX IF NOT EXISTS idx_receber_vencimento ON public.financeiro_receber USING btree (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_classificacao ON public.recrutamento_candidatos USING btree (classificacao_comprometimento);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_data_atualizacao ON public.recrutamento_candidatos USING btree (data_atualizacao);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_nome ON public.recrutamento_candidatos USING btree (nome);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_prestador_id ON public.recrutamento_candidatos USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_prioridade ON public.recrutamento_candidatos USING btree (prioridade);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_risco ON public.recrutamento_candidatos USING btree (risco_desistencia);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_score ON public.recrutamento_candidatos USING btree (score);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_score_comp ON public.recrutamento_candidatos USING btree (score_comprometimento);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_stage ON public.recrutamento_candidatos USING btree (stage);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_status_documental ON public.recrutamento_candidatos USING btree (status_documental);
CREATE INDEX IF NOT EXISTS idx_recrutamento_candidatos_tags ON public.recrutamento_candidatos USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_recrutamento_conversas_status ON public.recrutamento_whatsapp_conversas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_recrutamento_conversas_telefone ON public.recrutamento_whatsapp_conversas USING btree (telefone);
CREATE INDEX IF NOT EXISTS idx_recrutamento_mensagens_conversa ON public.recrutamento_whatsapp_mensagens USING btree (conversa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_cliente ON public.recrutamento_operacoes USING btree (cliente);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_created_at ON public.recrutamento_operacoes USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_financeiro ON public.recrutamento_operacoes USING gin (financeiro);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_meta ON public.recrutamento_operacoes USING gin (meta);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_nome ON public.recrutamento_operacoes USING btree (nome);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_prioridade ON public.recrutamento_operacoes USING btree (prioridade);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_regiao ON public.recrutamento_operacoes USING btree (regiao);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_status ON public.recrutamento_operacoes USING btree (status);
CREATE INDEX IF NOT EXISTS idx_recrutamento_operacoes_tipo_veiculo ON public.recrutamento_operacoes USING btree (tipo_veiculo);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_cpf_cnpj ON public.recrutamento_prestadores USING btree (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_data_cadastro ON public.recrutamento_prestadores USING btree (data_cadastro);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_nome ON public.recrutamento_prestadores USING btree (nome);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_onboarding ON public.recrutamento_prestadores USING btree (onboarding);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_regioes ON public.recrutamento_prestadores USING gin (regioes_atuacao);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_score ON public.recrutamento_prestadores USING gin (score);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_status ON public.recrutamento_prestadores USING btree (status);
CREATE INDEX IF NOT EXISTS idx_recrutamento_prestadores_tags ON public.recrutamento_prestadores USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_rede_oportunidades_os_id ON public.rede_oportunidades USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_rede_oportunidades_prazo ON public.rede_oportunidades USING btree (prazo_expiracao) WHERE (status = 'publicada'::rede_oportunidade_status);
CREATE INDEX IF NOT EXISTS idx_rede_oportunidades_status ON public.rede_oportunidades USING btree (status);
CREATE INDEX IF NOT EXISTS idx_rede_visualizacoes_oportunidade ON public.rede_visualizacoes USING btree (oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_rede_visualizacoes_prestador ON public.rede_visualizacoes USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_regras_fiscais_cte_ativo ON public.regras_fiscais_cte USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_regras_fiscais_cte_cliente ON public.regras_fiscais_cte USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_regras_fiscais_cte_uf ON public.regras_fiscais_cte USING btree (uf_origem, uf_destino);
CREATE INDEX IF NOT EXISTS idx_regras_fiscais_nfse_ativo ON public.regras_fiscais_nfse USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_regras_fiscais_nfse_municipio ON public.regras_fiscais_nfse USING btree (municipio_prestacao);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_cliente ON public.automacoes_regras_operacao USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_robo ON public.automacoes_regras_operacao USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_setor ON public.automacoes_regras_operacao USING btree (setor);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_status ON public.automacoes_regras_operacao USING btree (status);
CREATE INDEX IF NOT EXISTS idx_regras_operacao_validade ON public.automacoes_regras_operacao USING btree (validade_inicio, validade_fim);
CREATE INDEX IF NOT EXISTS idx_rfc_ativo ON public.regras_fiscais_cte USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_rfc_cliente ON public.regras_fiscais_cte USING btree (cliente_id);
CREATE INDEX IF NOT EXISTS idx_rfc_padrao ON public.regras_fiscais_cte USING btree (padrao);
CREATE INDEX IF NOT EXISTS idx_rfc_ufs ON public.regras_fiscais_cte USING btree (uf_origem, uf_destino);
CREATE INDEX IF NOT EXISTS idx_rota_execucoes_prestador_id ON public.rota_execucoes USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_rota_execucoes_rota_id ON public.rota_execucoes USING btree (rota_id);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_alocacao_id ON public.rota_paradas USING btree (alocacao_id);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_alocacao_id_sequencia ON public.rota_paradas USING btree (alocacao_id, sequencia);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_cidade ON public.rota_paradas USING btree (cidade);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_os_id ON public.rota_paradas USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_rota_id ON public.rota_paradas USING btree (rota_id);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_status ON public.rota_paradas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_rotas_data ON public.rotas USING btree (data_rota);
CREATE INDEX IF NOT EXISTS idx_rotas_operation_mode ON public.rotas USING btree (operation_mode);
CREATE INDEX IF NOT EXISTS idx_rotas_os_id ON public.rotas USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_rotas_prestador_id ON public.rotas USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_rotas_status ON public.rotas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_rotinas_execucoes_robo_id ON public.rotinas_execucoes_ia USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_rotinas_execucoes_rotina_id ON public.rotinas_execucoes_ia USING btree (rotina_id);
CREATE INDEX IF NOT EXISTS idx_rotinas_execucoes_started_at ON public.rotinas_execucoes_ia USING btree (started_at);
CREATE INDEX IF NOT EXISTS idx_rotinas_execucoes_status ON public.rotinas_execucoes_ia USING btree (status);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_ativo ON public.rotinas_ia USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_pendentes ON public.rotinas_ia USING btree (ativo, status, proxima_execucao) WHERE ((ativo = true) AND (status = ANY (ARRAY['pending'::status_rotina_ia, 'success'::status_rotina_ia, 'error'::status_rotina_ia])));
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_proxima_execucao ON public.rotinas_ia USING btree (proxima_execucao);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_robo_id ON public.rotinas_ia USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_status ON public.rotinas_ia USING btree (status);
CREATE INDEX IF NOT EXISTS idx_rotinas_ia_tipo ON public.rotinas_ia USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_route_stops_operation_id ON public.route_stops USING btree (operation_id);
CREATE INDEX IF NOT EXISTS idx_rp_created_at ON public.reembolsos_prestador USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rp_os_id ON public.reembolsos_prestador USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_rp_prestador ON public.reembolsos_prestador USING btree (prestador);
CREATE INDEX IF NOT EXISTS idx_rp_status ON public.reembolsos_prestador USING btree (status);
CREATE INDEX IF NOT EXISTS idx_rp_tenant_id ON public.reembolsos_prestador USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_seguros_apolices_status ON public.seguros_apolices USING btree (status);
CREATE INDEX IF NOT EXISTS idx_seguros_apolices_veiculo ON public.seguros_apolices USING btree (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_seguros_apolices_vigencia_fim ON public.seguros_apolices USING btree (vigencia_fim);
CREATE INDEX IF NOT EXISTS idx_sinistros_data_evento ON public.sinistros USING btree (data_evento);
CREATE INDEX IF NOT EXISTS idx_sinistros_os_id ON public.sinistros USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_sinistros_status ON public.sinistros USING btree (status);
CREATE INDEX IF NOT EXISTS idx_sugestoes_insight ON public.ia_sugestoes_melhoria USING btree (origem_insight_id);
CREATE INDEX IF NOT EXISTS idx_sugestoes_status ON public.ia_sugestoes_melhoria USING btree (status);
CREATE INDEX IF NOT EXISTS idx_sugestoes_tipo ON public.ia_sugestoes_melhoria USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_busca ON public.tabela_prestador USING btree (nome, tipo_veiculo, uf);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_operacional_prestador ON public.tabela_prestador_operacional USING btree (prestador_id);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_operacional_tipo ON public.tabela_prestador_operacional USING btree (tipo_veiculo);
CREATE INDEX IF NOT EXISTS idx_tabela_prestador_tenant ON public.tabela_prestador USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_cliente_veiculo ON public.tabelas_valores USING btree (cliente, tipo_veiculo);
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_tenant ON public.tabelas_valores USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tabelas_valores_universal_veiculo ON public.tabelas_valores USING btree (universal, tipo_veiculo);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants USING btree (status);
CREATE INDEX IF NOT EXISTS idx_tpl_ativo ON public.tracking_public_links USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_tpl_os_id ON public.tracking_public_links USING btree (os_id);
CREATE INDEX IF NOT EXISTS idx_tpl_token ON public.tracking_public_links USING btree (token_publico);
CREATE INDEX IF NOT EXISTS idx_transferencias_data ON public.financeiro_transferencias USING btree (data);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON public.financeiro_transferencias USING btree (conta_destino_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_origem ON public.financeiro_transferencias USING btree (conta_origem_id);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_busca ON public.treinamento_arquivos_ia USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_categoria ON public.treinamento_arquivos_ia USING btree (categoria);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_conhecimento ON public.treinamento_arquivos_ia USING btree (conhecimento_id);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_criado_em ON public.treinamento_arquivos_ia USING btree (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_robo ON public.treinamento_arquivos_ia USING btree (robo_id);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_status ON public.treinamento_arquivos_ia USING btree (status);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_tipo ON public.treinamento_arquivos_ia USING btree (tipo_arquivo);
CREATE INDEX IF NOT EXISTS idx_treinamento_arquivos_validade ON public.treinamento_arquivos_ia USING btree (validade_inicio, validade_fim);
CREATE INDEX IF NOT EXISTS idx_tu_papel ON public.tenant_usuarios USING btree (tenant_id, papel);
CREATE INDEX IF NOT EXISTS idx_tu_tenant ON public.tenant_usuarios USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tu_user ON public.tenant_usuarios USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_tu_user_status ON public.tenant_usuarios USING btree (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_disponibilidade ON public.prestador_disponibilidade USING btree (prestador_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_prestador_os ON public.prestador_os USING btree (prestador_id, ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_prestador ON public.veiculos USING btree (prestador_vinculado);
CREATE INDEX IF NOT EXISTS idx_veiculos_prestador_vinculado ON public.veiculos USING btree (prestador_vinculado);
CREATE INDEX IF NOT EXISTS idx_versoes_ativo ON public.ia_versoes_sistema USING btree (ativo);
CREATE INDEX IF NOT EXISTS idx_versoes_entidade ON public.ia_versoes_sistema USING btree (entidade_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_versoes_entidade_versao ON public.ia_versoes_sistema USING btree (tipo, entidade_id, versao);
CREATE INDEX IF NOT EXISTS idx_versoes_tipo ON public.ia_versoes_sistema USING btree (tipo);
CREATE INDEX IF NOT EXISTS idx_webhooks_recebidos_processado ON public.webhooks_recebidos USING btree (processado);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_instancia ON public.whatsapp_conversas USING btree (instancia_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_status ON public.whatsapp_conversas USING btree (status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_telefone ON public.whatsapp_conversas USING btree (telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversas_ultima_interacao ON public.whatsapp_conversas USING btree (ultima_interacao DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instancias_nome ON public.whatsapp_instancias USING btree (nome);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instancias_status ON public.whatsapp_instancias USING btree (status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_conversa ON public.whatsapp_mensagens USING btree (conversa_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_criado_em ON public.whatsapp_mensagens USING btree (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_instancia ON public.whatsapp_mensagens USING btree (instancia_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_telefone ON public.whatsapp_mensagens USING btree (telefone);
CREATE INDEX IF NOT EXISTS operacao_localizacao_location_idx ON public.operacao_localizacao USING btree (latitude, longitude);
CREATE UNIQUE INDEX IF NOT EXISTS operation_km_operation_id_key ON public.operation_km USING btree (operation_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contas_financeiras_principal ON public.contas_financeiras USING btree (principal) WHERE principal;
CREATE UNIQUE INDEX IF NOT EXISTS uq_eventos_oficiais_dedup ON public.eventos_oficiais USING btree (event_type, entity_type, entity_id) WHERE (event_type !~~ 'auth.%'::text);
CREATE UNIQUE INDEX IF NOT EXISTS uq_operacao_mensagens_idempotency ON public.operacao_mensagens USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uq_recibos_numero ON public.recibos USING btree (numero);

-- ============================================================================
-- 8. FUNCTIONS & RPCS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.aceitar_os(p_prestador_id uuid, p_ordem_servico_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  v_os_status text;
  v_ja_vinculada boolean;
begin
  -- verifica status atual da OS
  select status
    into v_os_status
  from ordens_servico
  where id = p_ordem_servico_id;

  if v_os_status is null then
    return jsonb_build_object(
      'success', false,
      'message', 'OS não encontrada'
    );
  end if;

  if v_os_status not in ('pendente', 'disponivel') then
    return jsonb_build_object(
      'success', false,
      'message', 'OS não está mais disponível para aceite'
    );
  end if;

  -- verifica se já existe vínculo desse prestador com essa OS
  select exists(
    select 1
    from prestador_os
    where prestador_id = p_prestador_id
      and ordem_servico_id = p_ordem_servico_id
  )
  into v_ja_vinculada;

  if v_ja_vinculada then
    return jsonb_build_object(
      'success', false,
      'message', 'Prestador já vinculado a esta OS'
    );
  end if;

  -- cria vínculo
  insert into prestador_os (
    prestador_id,
    ordem_servico_id,
    status,
    created_at,
    updated_at
  )
  values (
    p_prestador_id,
    p_ordem_servico_id,
    'aceita',
    now(),
    now()
  );

  return jsonb_build_object(
    'success', true,
    'message', 'OS aceita com sucesso'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.aceitar_viagem(token_acesso text, escala_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    motorista_id UUID;
BEGIN
    -- Validate token and get motorista (driver) ID from session table
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    -- Update escala_operacional status to "aceito"
    UPDATE escala_operacional
    SET status = 'aceito', atualizado_em = now()
    WHERE id = escala_id AND prestador_id = motorista_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.app_s6_cpf_cnpj_ja_cadastrado(p_cpf_cnpj text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_normalized TEXT;
  v_exists BOOLEAN := FALSE;
BEGIN
  IF p_cpf_cnpj IS NULL OR trim(p_cpf_cnpj) = '' THEN
    RETURN FALSE;
  END IF;

  -- Normaliza: remove pontuação, mantém apenas dígitos
  v_normalized := regexp_replace(trim(p_cpf_cnpj), '[^0-9]', '', 'g');

  IF length(v_normalized) < 11 THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM prestadores
    WHERE regexp_replace(coalesce(cpf_cnpj, ''), '[^0-9]', '', 'g') = v_normalized
    LIMIT 1
  ) INTO v_exists;

  RETURN v_exists;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.app_s6_criar_prestador(p_nome_completo text, p_cpf_cnpj text DEFAULT NULL::text, p_data_nascimento text DEFAULT NULL::text, p_telefone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_auth_email text DEFAULT NULL::text, p_senha text DEFAULT NULL::text, p_status text DEFAULT 'em_analise'::text, p_origem text DEFAULT 'app_prestador'::text, p_liberado_app boolean DEFAULT false, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auth_uid UUID;
  v_existing_id UUID;
  v_new_id UUID;
  v_nome TEXT;
  v_cpf TEXT;
  vTelefone TEXT;
  vEmail TEXT;
  vMeta JSONB;
BEGIN
  -- ========================================================================
  -- SEGURANÇA: auth.uid() obrigatório (fail-closed)
  -- ========================================================================
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autenticado'
      USING ERRCODE = 'P0001';
  END IF;

  -- ========================================================================
  -- IDEMPOTENCIA: se já existe prestador para este auth_user, retorna
  -- ========================================================================
  SELECT id INTO v_existing_id
  FROM prestadores
  WHERE auth_user_id = v_auth_uid
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('prestador_id', v_existing_id);
  END IF;

  -- ========================================================================
  -- SEGURANÇA:Overrides de segurança — ignora valores enviados pelo cliente
  -- ========================================================================
  v_nome  := trim(coalesce(p_nome_completo, ''));
  v_cpf   := CASE WHEN trim(coalesce(p_cpf_cnpj, '')) = '' THEN NULL
                  ELSE trim(p_cpf_cnpj) END;
  vTelefone := CASE WHEN trim(coalesce(p_telefone, '')) = '' THEN NULL
                    ELSE trim(p_telefone) END;
  vEmail    := CASE WHEN trim(coalesce(p_email, '')) = '' THEN NULL
                    ELSE trim(p_email) END;
  vMeta     := coalesce(p_metadata, '{}'::jsonb);

  -- Validação: nome é obrigatório
  IF v_nome = '' THEN
    RAISE EXCEPTION 'Nome completo é obrigatório'
      USING ERRCODE = 'P0002';
  END IF;

  -- ========================================================================
  -- INSERT em prestadores
  -- ========================================================================
  INSERT INTO prestadores (
    nome_completo,
    cpf_cnpj,
    data_nascimento,
    telefone,
    email,
    auth_user_id,
    status,
    liberado_app,
    origem,
    origem_cadastro,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    v_nome,
    v_cpf,
    CASE WHEN p_data_nascimento IS NOT NULL AND trim(p_data_nascimento) != ''
         THEN p_data_nascimento::date
         ELSE NULL END,
    vTelefone,
    vEmail,
    v_auth_uid,           -- anti-spoof: sempre auth.uid()
    'em_analise',         -- fixo: nunca liberado
    false,                -- fixo: nunca liberado
    coalesce(p_origem, 'app_prestador'),
    'app_motorista',      -- detectado pelo bridge enterpriseKanbanService
    vMeta,
    now(),
    now()
  )
  RETURNING id INTO v_new_id;

  -- ========================================================================
  -- RETORNO: formato { prestador_id: UUID }
  -- ========================================================================
  RETURN jsonb_build_object('prestador_id', v_new_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_status_viagem(token_acesso text, escala_id uuid, novo_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    UPDATE escala_operacional
    SET status = novo_status, atualizado_em = now()
    WHERE id = escala_id AND prestador_id = motorista_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_timestamp_credenciais_zoho()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.atualizar_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_detalhe_os(p_ordem_servico_id uuid)
 RETURNS TABLE(os_id uuid, numero text, status text, data date, tipo_operacao text, carga_tipo text, peso numeric, volumes integer, modalidade text, prioridade text, valor_cliente numeric, custo_prestador numeric, veiculo_tipo text, carga_descricao text, enderecos jsonb, adicionais jsonb, ajudante jsonb, carga jsonb, documentos jsonb, anexos jsonb, created_at timestamp without time zone)
 LANGUAGE sql
AS $function$
  select
    os.id as os_id,
    os.numero,
    os.status,
    os.data,
    os.tipo_operacao,
    os.carga_tipo,
    os.peso,
    os.volumes,
    os.modalidade,
    os.prioridade,
    os.valor_cliente,
    os.custo_prestador,
    os.veiculo_tipo,
    os.carga_descricao,
    os.enderecos,
    os.adicionais,
    os.ajudante,
    os.carga,
    os.documentos,
    os.anexos,
    os.created_at
  from ordens_servico os
  where os.id = p_ordem_servico_id;
$function$
;

CREATE OR REPLACE FUNCTION public.buscar_os_disponiveis(p_prestador_id uuid)
 RETURNS TABLE(os_id uuid, numero text, status text, veiculo_tipo text, enderecos jsonb, created_at timestamp without time zone)
 LANGUAGE sql
AS $function$
  select
    os.id as os_id,
    os.numero,
    os.status,
    os.veiculo_tipo,
    os.enderecos,
    os.created_at
  from ordens_servico os
  where os.status in ('pendente', 'disponivel')

    and not exists (
      select 1
      from prestador_os po
      where po.ordem_servico_id = os.id
        and po.prestador_id = p_prestador_id
    )

    and exists (
      select 1
      from veiculos v
      where v.prestador_vinculado = p_prestador_id
        and v.tipo_veiculo = os.veiculo_tipo
        and (v.status is null or lower(v.status) in ('ativo', 'disponivel', 'aprovado'))
    )

  order by os.created_at desc;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_margens_financeiras_os()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN

  NEW.imposto_valor :=
    (NEW.valor_cliente * COALESCE(NEW.imposto_percentual, 0)) / 100;

  NEW.margem_bruta :=
    NEW.valor_cliente
    - NEW.valor_prestador
    - COALESCE(NEW.pedagio_valor, 0)
    - COALESCE(NEW.outros_custos, 0);

  NEW.margem_liquida :=
    NEW.margem_bruta
    - COALESCE(NEW.imposto_valor, 0)
    - COALESCE(NEW.seguro_valor, 0);

  IF NEW.valor_cliente > 0 THEN
    NEW.percentual_margem_liquida :=
      (NEW.margem_liquida / NEW.valor_cliente) * 100;
  ELSE
    NEW.percentual_margem_liquida := 0;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_automacoes_instrucoes_ativa()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.ativo = true AND NEW.status = 'publicado' THEN
    UPDATE automacoes_instrucoes
    SET ativo = false
    WHERE robo_id = NEW.robo_id
      AND id <> NEW.id
      AND ativo = true;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.converter_pedido_para_os(p_pedido_id uuid, p_operador_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido RECORD;
  v_tenant_id UUID;
  v_os_id UUID;
  v_os_numero TEXT;
  v_status_atual TEXT;
BEGIN
  -- ============================================================
  -- VALIDAÇÕES
  -- ============================================================

  -- 1. Buscar pedido
  SELECT * INTO v_pedido
  FROM portal_pedidos
  WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PEDIDO_NAO_ENCONTRADO',
      'message', 'Pedido não encontrado'
    );
  END IF;

  v_tenant_id := public.current_tenant_id_safe();

  -- 2. Validar tenant
  IF v_pedido.cliente_id IS NOT NULL THEN
    -- Verificar se o cliente pertence ao tenant atual
    -- (a função current_tenant_id_safe já filtra)
  END IF;

  -- 3. Verificar se já foi convertido (usa coluna existente os_vinculada_id)
  IF v_pedido.os_vinculada_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'pedido_id', v_pedido.id,
      'ordem_servico_id', v_pedido.os_vinculada_id,
      'numero_os', (SELECT numero FROM ordens_servico WHERE id = v_pedido.os_vinculada_id),
      'status_pedido', v_pedido.status,
      'status_os', (SELECT status FROM ordens_servico WHERE id = v_pedido.os_vinculada_id),
      'created', false,
      'message', 'Pedido já convertido anteriormente'
    );
  END IF;

  v_status_atual := v_pedido.status;

  -- 4. Validar status
  IF v_status_atual NOT IN ('enviado', 'em_analise', 'aprovado') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'STATUS_INVALIDO',
      'message', format('Pedido em status "%s" não pode ser convertido', v_status_atual),
      'status_atual', v_status_atual
    );
  END IF;

  -- 5. Validar campos obrigatórios
  IF v_pedido.coleta_cidade IS NULL OR v_pedido.entrega_cidade IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CAMPOS_OBRIGATORIOS',
      'message', 'Cidade de coleta e destino são obrigatórias'
    );
  END IF;

  -- ============================================================
  -- GERAR NÚMERO DA OS
  -- ============================================================
  v_os_numero := format(
    'OS-%s-%s',
    to_char(now(), 'YYYYMM'),
    LPAD(floor(random() * 900000 + 100000)::TEXT, 6, '0')
  );

  -- ============================================================
  -- INSERIR ORDEM DE SERVIÇO
  -- ============================================================
  INSERT INTO ordens_servico (
    numero,
    data,
    cliente_id,
    cliente,
    unidade,
    status,
    origem,
    destino,
    tipo_operacao,
    carga_descricao,
    peso,
    volumes,
    valor_declarado,
    tipo_carga,
    observacoes_gerais,
    carga,
    valor_cliente,
    custo_prestador,
    data_programada,
    pedido_portal_id,
    created_at,
    updated_at,
    prioridade
  ) VALUES (
    v_os_numero,
    now()::DATE,
    v_pedido.cliente_id,    -- cliente_id (TEXT legado) recebe UUID como string
    v_pedido.cliente_id,    -- cliente (UUID) recebe UUID direto
    v_pedido.filial,
    'rascunho',
    format('%s/%s', COALESCE(v_pedido.coleta_cidade, ''), COALESCE(v_pedido.coleta_uf, '')),
    format('%s/%s', COALESCE(v_pedido.entrega_cidade, ''), COALESCE(v_pedido.entrega_uf, '')),
    'fracionado',
    COALESCE(v_pedido.descricao, 'Pedido Portal'),
    COALESCE(v_pedido.peso, 0),
    COALESCE(v_pedido.volumes, 1),
    COALESCE(v_pedido.valor_declarado, 0),
    COALESCE(v_pedido.tipo_carga, 'seca'),
    COALESCE(v_pedido.observacoes, ''),
    jsonb_build_object(
      'tipo', COALESCE(v_pedido.tipo_carga, 'seca'),
      'descricao', COALESCE(v_pedido.descricao, 'Pedido Portal'),
      'volumes', COALESCE(v_pedido.volumes, 1),
      'peso', COALESCE(v_pedido.peso, 0),
      'cubagem', 0,
      'valorDeclarado', COALESCE(v_pedido.valor_declarado, 0),
      'refrigerada', COALESCE(v_pedido.tipo_carga = 'refrigerado', false)
    ),
    0,
    0,
    v_pedido.coleta_data,
    v_pedido.id,
    now(),
    now(),
    COALESCE(v_pedido.prioridade, 'normal')
  )
  RETURNING id INTO v_os_id;

  -- ============================================================
  -- ATUALIZAR ENDEREÇOS NA OS (coluna enderecos JSONB)
  -- ============================================================
  UPDATE ordens_servico SET enderecos = jsonb_build_array(
    jsonb_build_object(
      'sequencia', 0,
      'tipo', 'coleta',
      'cep', v_pedido.coleta_cep,
      'logradouro', v_pedido.coleta_rua,
      'numero', v_pedido.coleta_numero,
      'complemento', v_pedido.coleta_complemento,
      'bairro', v_pedido.coleta_bairro,
      'cidade', v_pedido.coleta_cidade,
      'uf', v_pedido.coleta_uf,
      'endereco', format('%s, %s', COALESCE(v_pedido.coleta_rua, ''), COALESCE(v_pedido.coleta_numero, '')),
      'referencia', v_pedido.coleta_referencia
    ),
    jsonb_build_object(
      'sequencia', 1,
      'tipo', 'entrega',
      'cep', v_pedido.entrega_cep,
      'logradouro', v_pedido.entrega_rua,
      'numero', v_pedido.entrega_numero,
      'complemento', v_pedido.entrega_complemento,
      'bairro', v_pedido.entrega_bairro,
      'cidade', v_pedido.entrega_cidade,
      'uf', v_pedido.entrega_uf,
      'endereco', format('%s, %s', COALESCE(v_pedido.entrega_rua, ''), COALESCE(v_pedido.entrega_numero, '')),
      'responsavel', v_pedido.entrega_destinatario,
      'telefone', v_pedido.entrega_telefone,
      'email', v_pedido.entrega_email,
      'referencia', v_pedido.entrega_referencia
    )
  ) WHERE id = v_os_id;

  -- ============================================================
  -- ATUALIZAR PEDIDO COM VÍNCULO DA OS
  -- ============================================================
  UPDATE portal_pedidos
  SET
    os_vinculada_id = v_os_id,
    status = 'convertido',
    converted_at = now(),
    updated_at = now(),
    erro_processamento = NULL,
    codigo_erro = NULL
  WHERE id = p_pedido_id;

  -- ============================================================
  -- PUBLICAR EVENTO NO EVENT BUS
  -- ============================================================
  BEGIN
    INSERT INTO eventos_oficiais (
      tenant_id,
      event_type,
      entity_type,
      entity_id,
      entity_number,
      status,
      source,
      created_by,
      visibility,
      payload,
      metadata
    ) VALUES (
      public.current_tenant_id_safe(),
      'portal.order.converted_to_service_order',
      'portal_pedido',
      v_os_id,
      v_os_numero,
      'active',
      'service',
      p_operador_id,
      'internal',
      jsonb_build_object(
        'pedido_id', p_pedido_id,
        'ordem_servico_id', v_os_id,
        'numero_os', v_os_numero,
        'cliente_id', v_pedido.cliente_id
      ),
      jsonb_build_object(
        'correlation_id', gen_random_uuid()::TEXT,
        'published_at', now()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Falha na publicação não deve impedir a conversão
    NULL;
  END;

  -- ============================================================
  -- RETORNO
  -- ============================================================
  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'ordem_servico_id', v_os_id,
    'numero_os', v_os_numero,
    'status_pedido', 'convertido',
    'status_os', 'rascunho',
    'created', true,
    'message', format('Ordem de Serviço %s criada com sucesso', v_os_numero)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error_code', 'ERRO_CONVERSAO',
    'message', format('Erro ao converter pedido: %s', SQLERRM),
    'pedido_id', p_pedido_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_tenant_id_safe()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_tenant_id', true)::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN '00000000-0000-0000-0000-000000000001'::uuid;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.draft_create(p_cpf_cnpj text, p_current_step integer, p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_id UUID;
    v_token UUID;
BEGIN
    INSERT INTO public.rascunhos_prestador (cpf_cnpj, current_step, dados, status)
    VALUES (p_cpf_cnpj, p_current_step, p_dados, 'em_preenchimento')
    RETURNING id, draft_token INTO v_id, v_token;

    RETURN jsonb_build_object(
        'id', v_id,
        'draft_token', v_token,
        'cpf_cnpj', p_cpf_cnpj,
        'current_step', p_current_step,
        'status', 'em_preenchimento'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.draft_delete(p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    DELETE FROM public.rascunhos_prestador
    WHERE draft_token = p_token;

    RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.draft_fetch(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    SELECT row_to_json(r.*)::jsonb INTO v_result
    FROM public.rascunhos_prestador r
    WHERE draft_token = p_token AND status = 'em_preenchimento'
    LIMIT 1;

    RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.draft_submit(p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    UPDATE public.rascunhos_prestador
    SET status = 'enviado_para_analise'
    WHERE draft_token = p_token AND status = 'em_preenchimento';

    RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.draft_update(p_token uuid, p_current_step integer, p_dados jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    UPDATE public.rascunhos_prestador
    SET current_step = p_current_step, dados = p_dados
    WHERE draft_token = p_token AND status = 'em_preenchimento';

    RETURN FOUND;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f35_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f36_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f38_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.f39_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(p_oportunidade_id uuid, p_prestador_uuid uuid, p_auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os_id UUID;
  v_status_oportunidade rede_oportunidade_status;
  v_prestador_status TEXT;
  v_os_status TEXT;
  v_os_record RECORD;
  v_alocacao_id UUID;
  v_rota_id UUID;
  v_cliente_id UUID;
  v_veiculo_necessario JSONB;
  v_valor_prestador NUMERIC;
  v_tipo_operacao TEXT;
  v_tipo_reversa TEXT;
  v_operation_mode TEXT;
BEGIN
  IF p_auth_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_user_id) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário de autenticação inválido');
    END IF;
  END IF;
  SELECT r.os_id, r.status, r.valor_prestador, r.veiculo_necessario
  INTO v_os_id, v_status_oportunidade, v_valor_prestador, v_veiculo_necessario
  FROM public.rede_oportunidades r WHERE r.id = p_oportunidade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Oportunidade não encontrada');
  END IF;
  IF v_status_oportunidade NOT IN ('publicada', 'visualizada', 'interessada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', format('Oportunidade no estado %s não pode ser aceita', v_status_oportunidade));
  END IF;
  SELECT status INTO v_prestador_status FROM public.prestadores WHERE id = p_prestador_uuid;
  IF v_prestador_status IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não encontrado');
  END IF;
  IF v_prestador_status != 'ativo' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador não está ativo');
  END IF;
  SELECT * INTO v_os_record FROM public.ordens_servico WHERE id = v_os_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS vinculada não encontrada');
  END IF;
  IF v_os_record.status IN ('finalizada', 'cancelada', 'entregue') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS não pode mais receber prestador');
  END IF;
  v_os_status := v_os_record.status;
  v_tipo_operacao := COALESCE(v_os_record.tipo_operacao, '');
  v_tipo_reversa := COALESCE(v_os_record.tipo_reversa, 'sem_reversa');
  v_cliente_id := CASE
    WHEN v_os_record.cliente_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN v_os_record.cliente_id::uuid
    ELSE NULL
  END;
  IF v_tipo_operacao ILIKE '%multiparada%' OR v_tipo_operacao ILIKE '%e-commerce%' OR v_tipo_operacao ILIKE '%distribuição%' OR v_tipo_operacao ILIKE '%distribuicao%' THEN
    v_operation_mode := 'multi_stop_route';
  ELSIF v_tipo_reversa != 'sem_reversa' THEN
    v_operation_mode := 'reverse_logistics';
  ELSE
    v_operation_mode := 'standard_delivery';
  END IF;
  UPDATE public.rede_oportunidades SET status = 'aceita', prestador_aceite_id = p_prestador_uuid, aceite_em = NOW()
  WHERE id = p_oportunidade_id;
  UPDATE public.ordens_servico SET prestador_id = p_prestador_uuid::TEXT, prestador = p_prestador_uuid,
    status = CASE WHEN v_os_status IN ('pendente', 'rascunho') THEN 'agendada' ELSE v_os_status END
  WHERE id = v_os_id;
  IF EXISTS (SELECT 1 FROM public.alocacoes_escala WHERE ordem_servico_id = v_os_id) THEN
    UPDATE public.alocacoes_escala SET
      prestador_id = p_prestador_uuid,
      status = 'aceita',
      cliente_id = COALESCE(cliente_id, v_cliente_id),
      valor_frete = COALESCE(v_os_record.valor_cliente, 0),
      valor_repasse = COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
      aceite_prestador = true,
      data_aceite = NOW(),
      tipo_reversa = CASE WHEN alocacoes_escala.tipo_reversa = 'sem_reversa' THEN v_tipo_reversa ELSE alocacoes_escala.tipo_reversa END,
      metadata = alocacoes_escala.metadata || jsonb_build_object('aceite_tipo', 'rede_enterprise', 'operation_mode', v_operation_mode, 'os_numero', v_os_record.numero)
    WHERE ordem_servico_id = v_os_id
    RETURNING id INTO v_alocacao_id;
  ELSE
    INSERT INTO public.alocacoes_escala (ordem_servico_id, prestador_id, cliente_id, status, data_escala, tipo_veiculo, placa, origem, destino, valor_frete, valor_repasse, km_previstos, aceite_prestador, data_aceite, tipo_reversa, observacoes, metadata)
    VALUES (v_os_id, p_prestador_uuid, v_cliente_id, 'aceita', COALESCE(v_os_record.data_programada, CURRENT_DATE),
      COALESCE(v_veiculo_necessario->>'tipo', v_os_record.veiculo_tipo, ''), v_os_record.placa_alocada,
      CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
      CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 1 THEN v_os_record.enderecos::jsonb->jsonb_array_length(v_os_record.enderecos::jsonb)-1->>'cidade' ELSE v_os_record.destino END,
      COALESCE(v_os_record.valor_cliente, 0), COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
      v_os_record.distancia_km, true, NOW(), v_tipo_reversa, v_os_record.observacoes_gerais,
      jsonb_build_object('aceite_tipo', 'rede_enterprise', 'oportunidade_id', p_oportunidade_id, 'origem', 'rede_prestadores', 'operation_mode', v_operation_mode, 'tipo_operacao', v_tipo_operacao, 'os_numero', v_os_record.numero))
    RETURNING id INTO v_alocacao_id;
  END IF;
  IF v_operation_mode = 'multi_stop_route' AND v_os_record.enderecos IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.rotas WHERE os_id = v_os_id) THEN
      UPDATE public.rotas SET prestador_id = p_prestador_uuid, status = 'em_andamento'
      WHERE os_id = v_os_id
      RETURNING id INTO v_rota_id;
    ELSE
      INSERT INTO public.rotas (os_id, cliente_id, data_rota, status, origem, distancia_km, duracao_min, peso_total, volumes_total, prestador_id, tipo_rota, metadata)
      VALUES (v_os_id, v_cliente_id, COALESCE(v_os_record.data_programada, CURRENT_DATE), 'em_andamento',
        CASE WHEN jsonb_array_length(v_os_record.enderecos::jsonb) > 0 THEN v_os_record.enderecos::jsonb->0->>'cidade' ELSE v_os_record.origem END,
        v_os_record.distancia_km, v_os_record.tempo_minutos, v_os_record.peso, v_os_record.volumes, p_prestador_uuid,
        CASE WHEN v_tipo_operacao ILIKE '%refrigerado%' THEN 'refrigerada' ELSE 'seca' END,
        jsonb_build_object('operation_mode', v_operation_mode, 'alocacao_id', v_alocacao_id, 'tipo_operacao', v_tipo_operacao))
      RETURNING id INTO v_rota_id;
    END IF;
    INSERT INTO public.rota_paradas (rota_id, sequencia, cliente_nome, endereco, numero, bairro, cidade, uf, cep, latitude, longitude, peso, volumes, cubagem, temperatura, observacoes, status)
    SELECT v_rota_id, seq,
      COALESCE(e->>'nome_destinatario', e->>'nome', ''), COALESCE(e->>'logradouro', e->>'endereco', ''),
      COALESCE(e->>'numero', ''), COALESCE(e->>'bairro', ''), COALESCE(e->>'cidade', ''), COALESCE(e->>'uf', ''),
      COALESCE(e->>'cep', ''), COALESCE((e->>'latitude')::numeric, NULL), COALESCE((e->>'longitude')::numeric, NULL),
      v_os_record.peso / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1),
      GREATEST(CEIL(COALESCE(v_os_record.volumes, 0) / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1)), 1),
      v_os_record.cubagem / GREATEST(jsonb_array_length(v_os_record.enderecos::jsonb), 1),
      CASE WHEN v_os_record.carga_refrigerada THEN 'refrigerada' ELSE 'seca' END,
      COALESCE(e->>'instrucoes', e->>'observacoes', ''), 'pendente'
    FROM jsonb_array_elements(v_os_record.enderecos::jsonb) WITH ORDINALITY AS e(elem, seq)
    ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.portal_notificacoes (prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at)
  VALUES (p_prestador_uuid, 'Nova operação disponível',
    format('Você aceitou a oportunidade #%s. Operação: %s.', UPPER(SUBSTRING(v_os_id::TEXT, 1, 8)), v_operation_mode),
    'oportunidade_aceita', v_os_id, 'rede_oportunidades', false, NOW());
  INSERT INTO public.os_historico (os_id, acao, status_novo, usuario)
  VALUES (v_os_id, format('Prestador aceitou via Rede [mode=%s]', v_operation_mode), 'agendada',
          CASE WHEN p_auth_user_id IS NOT NULL THEN p_auth_user_id::TEXT ELSE 'Sistema Rede' END);
  DELETE FROM public.rede_visualizacoes WHERE oportunidade_id = p_oportunidade_id AND prestador_id != p_prestador_uuid;
  RETURN jsonb_build_object('sucesso', true, 'os_id', v_os_id, 'alocacao_id', v_alocacao_id, 'rota_id', v_rota_id, 'prestador_id', p_prestador_uuid, 'operation_mode', v_operation_mode,
    'mensagem', format('Oportunidade aceita. Modo: %s. Alocação criada.', v_operation_mode));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_atualizar_etapa_app(p_alocacao_id uuid, p_etapa text, p_payload jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT ''::text, p_auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_authenticated_uid UUID;
    v_prestador_id UUID;
    v_alocacao RECORD;
    v_etapa_atual TEXT;
    v_ultima_idempotency TEXT;
    v_updated_meta JSONB;
    v_app_meta JSONB;
    v_status_update TEXT;
    v_allowed BOOLEAN;
    v_event_id UUID;
    v_tenant_id UUID;
    v_os_id TEXT;
BEGIN
    v_authenticated_uid := auth.uid();
    IF v_authenticated_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
    END IF;

    IF p_auth_user_id IS NOT NULL AND p_auth_user_id <> v_authenticated_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'AUTH_USER_ID_INVALIDO');
    END IF;

    SELECT id INTO v_prestador_id
    FROM public.prestadores
    WHERE auth_user_id = v_authenticated_uid;

    IF v_prestador_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_ENCONTRADO');
    END IF;

    SELECT ae.*,
           ae.metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
           ae.metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency
    INTO v_alocacao
    FROM public.alocacoes_escala ae
    WHERE ae.id = p_alocacao_id;

    IF v_alocacao.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
    END IF;

    IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
    END IF;

    v_tenant_id := v_alocacao.tenant_id;
    v_os_id := v_alocacao.ordem_servico_id;

    IF v_alocacao.status IN ('cancelada', 'recusada') THEN
        RETURN jsonb_build_object('success', false, 'error', 'OPERACAO_CANCELADA');
    END IF;

    IF v_alocacao.status = 'concluida' OR (v_alocacao.metadata->'app_motorista'->>'servico_finalizado')::BOOLEAN = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'OPERACAO_FINALIZADA');
    END IF;

    v_etapa_atual := COALESCE(v_alocacao.etapa_atual, '');
    v_ultima_idempotency := COALESCE(v_alocacao.ultima_idempotency, '');

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' AND p_idempotency_key = v_ultima_idempotency THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Etapa já registrada (idempotente).',
            'etapa', p_etapa,
            'idempotent', true
        );
    END IF;

    v_allowed := false;

    IF v_etapa_atual = '' AND p_etapa = 'viagem_aceita' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'viagem_aceita' AND p_etapa = 'cheguei_coleta' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'cheguei_coleta' AND p_etapa = 'carregamento_iniciado' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'carregamento_iniciado' AND p_etapa = 'carregamento_finalizado' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'carregamento_finalizado' AND p_etapa IN ('romaneio_informado', 'foto_romaneio', 'km_inicial_informado', 'saiu_em_rota') THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'romaneio_informado' AND p_etapa IN ('foto_romaneio', 'km_inicial_informado') THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'foto_romaneio' AND p_etapa = 'km_inicial_informado' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'km_inicial_informado' AND p_etapa = 'saiu_em_rota' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'saiu_em_rota' AND p_etapa = 'chegou_entrega' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'chegou_entrega' AND p_etapa = 'descarregamento_iniciado' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'descarregamento_iniciado' AND p_etapa = 'descarga_finalizada' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'descarga_finalizada' AND p_etapa = 'km_final_informado' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'km_final_informado' AND p_etapa = 'assinatura_capturada' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'assinatura_capturada' AND p_etapa = 'pod_registrado' THEN v_allowed := true; END IF;
    IF v_etapa_atual = 'pod_registrado' AND p_etapa = 'servico_finalizado' THEN v_allowed := true; END IF;

    IF NOT v_allowed THEN
        RETURN jsonb_build_object(
            'success', false, 'error', 'TRANSICAO_INVALIDA',
            'message', format('de "%s" para "%s"', v_etapa_atual, p_etapa),
            'etapa_atual', v_etapa_atual,
            'etapa_solicitada', p_etapa
        );
    END IF;

    IF p_etapa = 'servico_finalizado' THEN
        IF NOT (v_alocacao.metadata->'app_motorista'->>'pod_registrado')::BOOLEAN = true THEN
            RETURN jsonb_build_object(
                'success', false, 'error', 'FINALIZACAO_SEM_POD',
                'message', 'Operação não pode ser finalizada sem POD registrado.'
            );
        END IF;
    END IF;

    v_app_meta := COALESCE(v_alocacao.metadata->'app_motorista', '{}'::JSONB);

    v_app_meta := jsonb_set(v_app_meta, '{etapa_atual}', to_jsonb(p_etapa));
    v_app_meta := jsonb_set(v_app_meta, '{ultima_acao}', to_jsonb(p_etapa));
    v_app_meta := jsonb_set(v_app_meta, '{atualizado_por_app}', 'true'::JSONB);

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        v_app_meta := jsonb_set(v_app_meta, '{ultima_idempotency}', to_jsonb(p_idempotency_key));
    END IF;

    IF p_payload IS NOT NULL AND p_payload <> '{}'::JSONB THEN
        v_app_meta := v_app_meta || p_payload;
    END IF;

    v_updated_meta := COALESCE(v_alocacao.metadata, '{}'::JSONB);
    v_updated_meta := jsonb_set(v_updated_meta, '{app_motorista}', v_app_meta);

    v_status_update := NULL;

    IF p_etapa = 'viagem_aceita' THEN
        v_status_update := 'aceita';
    ELSIF p_etapa = 'cheguei_coleta' THEN
        v_status_update := 'em_rota';
    ELSIF p_etapa = 'servico_finalizado' THEN
        v_status_update := 'concluida';
    END IF;

    UPDATE public.alocacoes_escala SET
        metadata = v_updated_meta,
        status = COALESCE(v_status_update, status),
        aceite_prestador = CASE WHEN p_etapa = 'viagem_aceita' THEN true ELSE aceite_prestador END,
        data_aceite = CASE WHEN p_etapa = 'viagem_aceita' THEN NOW() ELSE data_aceite END,
        horario_inicio_real = CASE WHEN p_etapa = 'cheguei_coleta' THEN NOW() ELSE horario_inicio_real END,
        horario_fim_real = CASE WHEN p_etapa = 'servico_finalizado' THEN NOW() ELSE horario_fim_real END,
        finalizada = CASE WHEN p_etapa = 'servico_finalizado' THEN true ELSE finalizada END,
        data_finalizacao = CASE WHEN p_etapa = 'servico_finalizado' THEN NOW() ELSE data_finalizacao END,
        updated_at = NOW()
    WHERE id = p_alocacao_id
      AND prestador_id = v_prestador_id;

    v_event_id := gen_random_uuid();

    INSERT INTO public.eventos_oficiais (
        id, tenant_id, event_type, entity_type, entity_id, entity_number,
        status, source, created_by, visibility, payload, metadata,
        created_at, processed_at, version, retry_count
    ) VALUES (
        v_event_id,
        v_tenant_id,
        CASE
            WHEN p_etapa = 'viagem_aceita' THEN 'operation_accepted'
            WHEN p_etapa = 'cheguei_coleta' THEN 'arrived_pickup'
            WHEN p_etapa = 'carregamento_iniciado' THEN 'loading_started'
            WHEN p_etapa = 'carregamento_finalizado' THEN 'loading_finished'
            WHEN p_etapa = 'romaneio_informado' THEN 'romaneio_informado'
            WHEN p_etapa = 'foto_romaneio' THEN 'romaneio_foto'
            WHEN p_etapa = 'km_inicial_informado' THEN 'km_registered'
            WHEN p_etapa = 'saiu_em_rota' THEN 'route_started'
            WHEN p_etapa = 'chegou_entrega' THEN 'arrived_delivery'
            WHEN p_etapa = 'descarregamento_iniciado' THEN 'unloading_started'
            WHEN p_etapa = 'descarga_finalizada' THEN 'unloading_finished'
            WHEN p_etapa = 'km_final_informado' THEN 'km_final'
            WHEN p_etapa = 'assinatura_capturada' THEN 'signature_captured'
            WHEN p_etapa = 'pod_registrado' THEN 'pod_sent'
            WHEN p_etapa = 'servico_finalizado' THEN 'operation_finished'
            ELSE p_etapa
        END,
        'alocacao',
        p_alocacao_id,
        v_os_id,
        COALESCE(v_status_update, 'em_andamento'),
        'app_motorista',
        v_prestador_id,
        'internal',
        jsonb_build_object(
            'etapa', p_etapa,
            'etapa_anterior', v_etapa_atual,
            'payload', p_payload,
            'idempotency_key', p_idempotency_key
        ),
        jsonb_build_object(
            'app_motorista', v_app_meta,
            'prestador_id', v_prestador_id
        ),
        NOW(),
        NULL,
        '1.0',
        0
    );

    INSERT INTO public.operation_timeline_events (
        id, operation_id, driver_id, type, title, metadata, event_time, created_at
    ) VALUES (
        v_event_id,
        p_alocacao_id::TEXT,
        v_prestador_id::TEXT,
        CASE
            WHEN p_etapa = 'viagem_aceita' THEN 'operation_accepted'
            WHEN p_etapa = 'cheguei_coleta' THEN 'arrived_pickup'
            WHEN p_etapa = 'carregamento_iniciado' THEN 'loading_started'
            WHEN p_etapa = 'carregamento_finalizado' THEN 'loading_finished'
            WHEN p_etapa = 'saiu_em_rota' THEN 'route_started'
            WHEN p_etapa = 'chegou_entrega' THEN 'arrived_delivery'
            WHEN p_etapa = 'descarregamento_iniciado' THEN 'unloading_started'
            WHEN p_etapa = 'descarga_finalizada' THEN 'unloading_finished'
            WHEN p_etapa = 'assinatura_capturada' THEN 'signature_captured'
            WHEN p_etapa = 'pod_registrado' THEN 'pod_sent'
            WHEN p_etapa = 'servico_finalizado' THEN 'operation_finished'
            ELSE p_etapa
        END,
        p_etapa,
        jsonb_build_object('etapa', p_etapa, 'payload', p_payload),
        NOW(),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Etapa avançada com sucesso.',
        'etapa', p_etapa,
        'etapa_anterior', v_etapa_atual,
        'status', COALESCE(v_status_update, v_alocacao.status),
        'event_id', v_event_id,
        'idempotent', false
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_atualizar_reversa_app(p_alocacao_id uuid, p_reversa_status text DEFAULT 'coletada'::text, p_reversa_qtd_coletada integer DEFAULT 0, p_reversa_motivo_divergencia text DEFAULT ''::text, p_reversa_responsavel text DEFAULT ''::text, p_reversa_telefone text DEFAULT ''::text, p_reversa_data_realizada timestamp with time zone DEFAULT now(), p_reversa_fotos text[] DEFAULT '{}'::text[], p_reversa_assinatura_url text DEFAULT ''::text, p_reversa_latitude numeric DEFAULT 0, p_reversa_longitude numeric DEFAULT 0, p_auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_authenticated_uid UUID;
    v_prestador_id UUID;
    v_alocacao_prestador_id UUID;
    v_prev_qtd INT;
BEGIN
    v_authenticated_uid := auth.uid();
    IF v_authenticated_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
    END IF;

    IF p_auth_user_id IS NOT NULL AND p_auth_user_id <> v_authenticated_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'AUTH_USER_ID_INVALIDO');
    END IF;

    SELECT id INTO v_prestador_id
    FROM public.prestadores
    WHERE auth_user_id = v_authenticated_uid;

    IF v_prestador_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_ENCONTRADO');
    END IF;

    SELECT ae.prestador_id, ae.reversa_qtd_volumes
    INTO v_alocacao_prestador_id, v_prev_qtd
    FROM public.alocacoes_escala ae
    WHERE ae.id = p_alocacao_id;

    IF v_alocacao_prestador_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
    END IF;

    IF v_alocacao_prestador_id IS DISTINCT FROM v_prestador_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
    END IF;

    IF p_reversa_qtd_coletada < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'QUANTIDADE_INVALIDA');
    END IF;

    IF v_prev_qtd IS NOT NULL AND v_prev_qtd <> p_reversa_qtd_coletada
       AND (p_reversa_motivo_divergencia IS NULL OR p_reversa_motivo_divergencia = '') THEN
        RETURN jsonb_build_object('success', false, 'error', 'DIVERGENCIA_SEM_JUSTIFICATIVA');
    END IF;

    UPDATE public.alocacoes_escala SET
        coleta_reversa = true,
        reversa_qtd_coletada = p_reversa_qtd_coletada,
        reversa_motivo_divergencia = p_reversa_motivo_divergencia,
        reversa_responsavel = p_reversa_responsavel,
        reversa_telefone = p_reversa_telefone,
        reversa_assinatura_url = p_reversa_assinatura_url,
        reversa_latitude = p_reversa_latitude,
        reversa_longitude = p_reversa_longitude,
        reversa_data_realizada = p_reversa_data_realizada,
        reversa_status = p_reversa_status,
        reversa_fotos = p_reversa_fotos,
        updated_at = NOW()
    WHERE id = p_alocacao_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Reversa atualizada com sucesso.',
        'alocacao_id', p_alocacao_id,
        'reversa_status', p_reversa_status,
        'reversa_qtd_coletada', p_reversa_qtd_coletada
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_atualizar_status_parada(p_parada_id uuid, p_status text, p_recebedor text DEFAULT NULL::text, p_assinatura_url text DEFAULT NULL::text, p_pod_url text DEFAULT NULL::text, p_fotos jsonb DEFAULT '[]'::jsonb, p_ocorrencia text DEFAULT NULL::text, p_latitude_fim numeric DEFAULT NULL::numeric, p_longitude_fim numeric DEFAULT NULL::numeric, p_volumes_entregues integer DEFAULT NULL::integer, p_observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_authenticated_uid    uuid;
    v_prestador_id         uuid;
    v_parada_id            uuid;
    v_parada_rota_id       uuid;
    v_parada_alocacao_id   uuid;
    v_parada_os_id         uuid;
    v_status_anterior      text;
    v_alocacao_prestador   uuid;
    v_os_id                uuid;
    v_total_paradas        integer;
    v_paradas_terminal     integer;
    v_rota_total           integer;
    v_rota_terminal        integer;
BEGIN
    -- ============================================================
    -- 1. Autenticação
    -- ============================================================
    v_authenticated_uid := auth.uid();
    IF v_authenticated_uid IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'success', false, 'erro', 'USUARIO_NAO_AUTENTICADO');
    END IF;

    -- ============================================================
    -- 2. Vínculo do prestador autenticado
    -- ============================================================
    SELECT id INTO v_prestador_id
    FROM public.prestadores
    WHERE auth_user_id = v_authenticated_uid;

    IF v_prestador_id IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'success', false, 'erro', 'PRESTADOR_NAO_ENCONTRADO');
    END IF;

    -- ============================================================
    -- 3. Validação do status aceito (mesmos valores da função atual)
    -- ============================================================
    IF p_status IS NULL OR p_status NOT IN (
        'pendente', 'em_deslocamento', 'chegou', 'entregue',
        'nao_entregue', 'ocorrencia', 'reentrega', 'devolucao', 'cancelada'
    ) THEN
        RETURN jsonb_build_object(
            'sucesso', false, 'success', false,
            'erro', 'STATUS_INVALIDO', 'status', p_status
        );
    END IF;

    -- ============================================================
    -- 4. Localizar a parada SEM JOIN com rotas (correção BUG-A21-01)
    --    rota_paradas é a fonte oficial; rota_id pode ser NULL.
    -- ============================================================
    SELECT rp.id, rp.rota_id, rp.alocacao_id, rp.os_id, rp.status
    INTO v_parada_id, v_parada_rota_id, v_parada_alocacao_id, v_parada_os_id, v_status_anterior
    FROM public.rota_paradas rp
    WHERE rp.id = p_parada_id;

    IF v_parada_id IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'success', false, 'erro', 'Parada não encontrada');
    END IF;

    -- ============================================================
    -- 5. Contexto por alocação + pertencimento ao prestador
    -- ============================================================
    IF v_parada_alocacao_id IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'success', false, 'erro', 'ALOCACAO_NAO_ENCONTRADA');
    END IF;

    SELECT ae.prestador_id, ae.ordem_servico_id
    INTO v_alocacao_prestador, v_os_id
    FROM public.alocacoes_escala ae
    WHERE ae.id = v_parada_alocacao_id;

    IF v_alocacao_prestador IS NULL THEN
        RETURN jsonb_build_object('sucesso', false, 'success', false, 'erro', 'ALOCACAO_NAO_ENCONTRADA');
    END IF;

    IF v_alocacao_prestador IS DISTINCT FROM v_prestador_id THEN
        RETURN jsonb_build_object('sucesso', false, 'success', false, 'erro', 'ALOCACAO_OUTRO_PRESTADOR');
    END IF;

    -- OS real: prioriza rota_paradas.os_id; senão alocacoes_escala.ordem_servico_id.
    -- NUNCA usa alocacao_id como OS.
    v_os_id := COALESCE(v_parada_os_id, v_os_id);

    -- ============================================================
    -- 6. Atualizar a parada (rota_paradas NÃO possui updated_at)
    -- ============================================================
    UPDATE public.rota_paradas SET
        status = p_status,
        recebedor = COALESCE(p_recebedor, recebedor),
        assinatura_url = COALESCE(p_assinatura_url, assinatura_url),
        pod_url = COALESCE(p_pod_url, pod_url),
        ocorrencia = COALESCE(p_ocorrencia, ocorrencia),
        latitude_fim = COALESCE(p_latitude_fim, latitude_fim),
        longitude_fim = COALESCE(p_longitude_fim, longitude_fim),
        volumes_entregues = COALESCE(p_volumes_entregues, volumes_entregues),
        observacoes = COALESCE(p_observacoes, observacoes),
        fotos = CASE
                    WHEN p_fotos IS NOT NULL
                     AND jsonb_typeof(p_fotos) = 'array'
                     AND jsonb_array_length(p_fotos) > 0
                    THEN p_fotos
                    ELSE fotos
                END,
        data_hora = NOW(),
        data_entrega = CASE
                           WHEN p_status IN (
                               'entregue', 'nao_entregue', 'ocorrencia',
                               'reentrega', 'devolucao', 'cancelada'
                           ) THEN NOW()
                           ELSE data_entrega
                       END
    WHERE id = p_parada_id;

    -- ============================================================
    -- 7. Contabilizar paradas da mesma alocacao_id (status terminal)
    -- ============================================================
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE status IN (
               'entregue', 'nao_entregue', 'ocorrencia',
               'reentrega', 'devolucao', 'cancelada'
           ))
    INTO v_total_paradas, v_paradas_terminal
    FROM public.rota_paradas
    WHERE alocacao_id = v_parada_alocacao_id;

    -- ============================================================
    -- 8. Concluir alocação somente quando TODAS as paradas terminarem
    -- ============================================================
    IF v_total_paradas > 0 AND v_paradas_terminal = v_total_paradas THEN
        UPDATE public.alocacoes_escala SET
            status = 'concluida',
            finalizada = true,
            data_finalizacao = NOW(),
            horario_fim_real = NOW(),
            updated_at = NOW()
        WHERE id = v_parada_alocacao_id
          AND prestador_id = v_prestador_id;
    END IF;

    -- ============================================================
    -- 9. Rota vinculada (rota_id IS NOT NULL) — somente colunas
    --    comprovadas de public.rotas: status e completed_at
    -- ============================================================
    IF v_parada_rota_id IS NOT NULL THEN
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE status IN (
                   'entregue', 'nao_entregue', 'ocorrencia',
                   'reentrega', 'devolucao', 'cancelada'
               ))
        INTO v_rota_total, v_rota_terminal
        FROM public.rota_paradas
        WHERE rota_id = v_parada_rota_id;

        IF v_rota_total > 0 AND v_rota_terminal = v_rota_total THEN
            UPDATE public.rotas SET
                status = 'concluida',
                completed_at = NOW()
            WHERE id = v_parada_rota_id;
        END IF;
    END IF;

    -- ============================================================
    -- 10. OS real: somente quando existe OS E a alocação concluiu
    -- ============================================================
    IF v_os_id IS NOT NULL
       AND v_total_paradas > 0
       AND v_paradas_terminal = v_total_paradas THEN
        UPDATE public.ordens_servico SET
            status = 'concluida'
        WHERE id = v_os_id
          AND (prestador_id IS NULL OR prestador_id = v_prestador_id);

        INSERT INTO public.os_historico (
            ordem_servico_id, descricao, acao, status_novo, usuario
        ) VALUES (
            v_os_id,
            format('Parada %s finalizada com status %s', p_parada_id, p_status),
            'atualizar_status_parada',
            p_status,
            v_authenticated_uid::text
        );
    END IF;

    -- ============================================================
    -- 11. Retorno: sucesso (legado) + success (App corrigido)
    -- ============================================================
    RETURN jsonb_build_object(
        'sucesso', true,
        'success', true,
        'message', 'Status da parada atualizado com sucesso.',
        'parada_id', p_parada_id,
        'status', p_status,
        'status_anterior', v_status_anterior,
        'alocacao_id', v_parada_alocacao_id,
        'alocacao_concluida', (v_total_paradas > 0 AND v_paradas_terminal = v_total_paradas),
        'os_id', v_os_id
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_avancar_etapa_app_motorista(p_alocacao_id uuid, p_etapa text, p_payload jsonb DEFAULT '{}'::jsonb, p_idempotency_key text DEFAULT NULL::text, p_auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_id UUID;
  v_alocacao RECORD;
  v_tenant_id UUID;
  v_os_id UUID;
  v_etapa_atual TEXT;
  v_ultima_idempotency TEXT;
  v_allowed BOOLEAN;
  v_app_meta JSONB;
  v_updated_meta JSONB;
  v_status_update TEXT;
  v_event_id UUID;
  v_evento_tipo TEXT;
  v_romaneio_app TEXT;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  IF p_auth_user_id IS NOT NULL AND p_auth_user_id <> v_authenticated_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_USER_ID_INVALIDO');
  END IF;

  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid;

  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;

  SELECT ae.*,
    ae.metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
    ae.metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency
  INTO v_alocacao
  FROM public.alocacoes_escala ae
  WHERE ae.id = p_alocacao_id;

  IF v_alocacao.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;

  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;

  v_tenant_id := v_alocacao.tenant_id;
  v_os_id := v_alocacao.ordem_servico_id;

  IF v_alocacao.status IN ('cancelada', 'recusada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'OPERACAO_CANCELADA');
  END IF;

  IF v_alocacao.status = 'concluida' OR (v_alocacao.metadata->'app_motorista'->>'servico_finalizado')::BOOLEAN = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'OPERACAO_FINALIZADA');
  END IF;

  v_etapa_atual := COALESCE(v_alocacao.etapa_atual, '');
  v_ultima_idempotency := COALESCE(v_alocacao.ultima_idempotency, '');

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' AND p_idempotency_key = v_ultima_idempotency THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Etapa já registrada (idempotente).',
      'etapa', p_etapa,
      'idempotent', true
    );
  END IF;

  v_allowed := false;

  IF v_etapa_atual = '' AND p_etapa = 'viagem_aceita' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'viagem_aceita' AND p_etapa = 'cheguei_coleta' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'cheguei_coleta' AND p_etapa = 'carregamento_iniciado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'carregamento_iniciado' AND p_etapa = 'carregamento_finalizado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'carregamento_finalizado' AND p_etapa IN ('romaneio_informado', 'foto_romaneio', 'km_inicial_informado', 'saiu_em_rota') THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'romaneio_informado' AND p_etapa IN ('foto_romaneio', 'km_inicial_informado') THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'foto_romaneio' AND p_etapa = 'km_inicial_informado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'km_inicial_informado' AND p_etapa = 'saiu_em_rota' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'saiu_em_rota' AND p_etapa = 'chegou_entrega' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'chegou_entrega' AND p_etapa = 'descarregamento_iniciado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'descarregamento_iniciado' AND p_etapa = 'descarga_finalizada' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'descarga_finalizada' AND p_etapa = 'km_final_informado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'km_final_informado' AND p_etapa = 'assinatura_capturada' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'assinatura_capturada' AND p_etapa = 'pod_registrado' THEN v_allowed := true; END IF;
  IF v_etapa_atual = 'pod_registrado' AND p_etapa = 'servico_finalizado' THEN v_allowed := true; END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'TRANSICAO_INVALIDA',
      'message', format('Transição inválida: de "%s" para "%s"', v_etapa_atual, p_etapa),
      'etapa_atual', v_etapa_atual,
      'etapa_solicitada', p_etapa
    );
  END IF;

  IF p_etapa = 'servico_finalizado' THEN
    IF NOT (v_alocacao.metadata->'app_motorista'->>'pod_registrado')::BOOLEAN = true THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'FINALIZACAO_SEM_POD',
        'message', 'Operação não pode ser finalizada sem POD registrado.'
      );
    END IF;
  END IF;

  v_app_meta := COALESCE(v_alocacao.metadata->'app_motorista', '{}'::JSONB);
  v_app_meta := jsonb_set(v_app_meta, '{etapa_atual}', to_jsonb(p_etapa));
  v_app_meta := jsonb_set(v_app_meta, '{ultima_acao}', to_jsonb(p_etapa));
  v_app_meta := jsonb_set(v_app_meta, '{atualizado_por_app}', 'true'::JSONB);

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    v_app_meta := jsonb_set(v_app_meta, '{ultima_idempotency}', to_jsonb(p_idempotency_key));
  END IF;

  IF p_payload IS NOT NULL AND p_payload <> '{}'::JSONB THEN
    v_app_meta := v_app_meta || p_payload;
  END IF;

  v_updated_meta := COALESCE(v_alocacao.metadata, '{}'::JSONB);
  v_updated_meta := jsonb_set(v_updated_meta, '{app_motorista}', v_app_meta);

  v_status_update := NULL;
  IF p_etapa = 'viagem_aceita' THEN v_status_update := 'aceita';
  ELSIF p_etapa = 'cheguei_coleta' THEN v_status_update := 'em_rota';
  ELSIF p_etapa = 'servico_finalizado' THEN v_status_update := 'concluida';
  END IF;

  -- 10.1 A31-C/A31-D — Sincronizar romaneio para ordens_servico.romaneio
  v_romaneio_app := NULLIF(BTRIM(COALESCE(p_payload->>'romaneio', '')), '');
  IF p_etapa = 'romaneio_informado' AND v_os_id IS NOT NULL AND v_romaneio_app IS NOT NULL THEN
    UPDATE public.ordens_servico
    SET romaneio = v_romaneio_app,
        updated_at = NOW()
    WHERE id = v_os_id;
  END IF;

  UPDATE public.alocacoes_escala SET
    metadata = v_updated_meta,
    status = COALESCE(v_status_update, status),
    aceite_prestador = CASE WHEN p_etapa = 'viagem_aceita' THEN true ELSE aceite_prestador END,
    data_aceite = CASE WHEN p_etapa = 'viagem_aceita' THEN NOW() ELSE data_aceite END,
    horario_inicio_real = CASE WHEN p_etapa = 'cheguei_coleta' THEN NOW() ELSE horario_inicio_real END,
    horario_fim_real = CASE WHEN p_etapa = 'servico_finalizado' THEN NOW() ELSE horario_fim_real END,
    finalizada = CASE WHEN p_etapa = 'servico_finalizado' THEN true ELSE finalizada END,
    data_finalizacao = CASE WHEN p_etapa = 'servico_finalizado' THEN NOW() ELSE data_finalizacao END,
    updated_at = NOW()
  WHERE id = p_alocacao_id
    AND prestador_id = v_prestador_id;

  v_evento_tipo := CASE
    WHEN p_etapa = 'viagem_aceita' THEN 'operation_accepted'
    WHEN p_etapa = 'cheguei_coleta' THEN 'arrived_pickup'
    WHEN p_etapa = 'carregamento_iniciado' THEN 'loading_started'
    WHEN p_etapa = 'carregamento_finalizado' THEN 'loading_finished'
    WHEN p_etapa = 'romaneio_informado' THEN 'romaneio_informado'
    WHEN p_etapa = 'foto_romaneio' THEN 'romaneio_foto'
    WHEN p_etapa = 'km_inicial_informado' THEN 'km_registered'
    WHEN p_etapa = 'saiu_em_rota' THEN 'route_started'
    WHEN p_etapa = 'chegou_entrega' THEN 'arrived_delivery'
    WHEN p_etapa = 'descarregamento_iniciado' THEN 'unloading_started'
    WHEN p_etapa = 'descarga_finalizada' THEN 'unloading_finished'
    WHEN p_etapa = 'km_final_informado' THEN 'km_final'
    WHEN p_etapa = 'assinatura_capturada' THEN 'signature_captured'
    WHEN p_etapa = 'pod_registrado' THEN 'pod_sent'
    WHEN p_etapa = 'servico_finalizado' THEN 'operation_finished'
    ELSE p_etapa
  END;

  v_event_id := gen_random_uuid();
  INSERT INTO public.eventos_oficiais (
    id, tenant_id, event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility, payload, metadata,
    created_at, processed_at, version, retry_count
  ) VALUES (
    v_event_id,
    v_tenant_id,
    v_evento_tipo,
    'alocacao',
    p_alocacao_id,
    v_os_id::TEXT,
    COALESCE(v_status_update, 'em_andamento'),
    'app_motorista',
    v_prestador_id,
    'internal',
    jsonb_build_object(
      'etapa', p_etapa,
      'etapa_anterior', v_etapa_atual,
      'payload', p_payload,
      'idempotency_key', p_idempotency_key
    ),
    jsonb_build_object(
      'app_motorista', v_app_meta,
      'prestador_id', v_prestador_id
    ),
    NOW(),
    NULL,
    '1.0',
    0
  );

  INSERT INTO public.operation_timeline_events (
    id, operation_id, driver_id, type, title, metadata, event_time, created_at
  ) VALUES (
    v_event_id,
    p_alocacao_id::TEXT,
    v_prestador_id::TEXT,
    v_evento_tipo,
    p_etapa,
    jsonb_build_object('etapa', p_etapa, 'payload', p_payload),
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Etapa avançada com sucesso.',
    'etapa', p_etapa,
    'etapa_anterior', v_etapa_atual,
    'status', COALESCE(v_status_update, v_alocacao.status),
    'event_id', v_event_id,
    'idempotent', false,
    'romaneio_sync', CASE WHEN p_etapa = 'romaneio_informado' AND v_os_id IS NOT NULL AND v_romaneio_app IS NOT NULL THEN true ELSE false END
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_bridge_prestador_para_recrutamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_rp_id UUID;
  v_exists BOOLEAN;
  v_candidato_id UUID;
  v_nome TEXT;
  v_telefone TEXT;
  v_email TEXT;
  v_cidade TEXT;
  v_uf TEXT;
  v_tipo_veiculo TEXT;
  v_placa TEXT;
  v_cpf TEXT;
  v_now TEXT;
  v_tags JSONB;
BEGIN
  -- ====================================================================
  -- GUARD 1: Só processa prestadores de origem App
  -- ====================================================================
  IF NEW.origem != 'app_prestador' AND NEW.origem_cadastro != 'app_motorista' THEN
    RETURN NEW;
  END IF;

  -- ====================================================================
  -- EXTRACT: Dados do prestador operacional
  -- ====================================================================
  v_now := to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_nome := COALESCE(NEW.nome_completo, 'Sem nome');
  v_telefone := COALESCE(NEW.telefone, NEW.whatsapp, '');
  v_email := COALESCE(NEW.email, '');
  v_cidade := COALESCE(NEW.endereco->>'cidade', '');
  v_uf := COALESCE(NEW.endereco->>'uf', NEW.endereco->>'estado', '');
  v_cpf := COALESCE(NEW.cpf_cnpj, '');

  IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'veiculo' THEN
    v_tipo_veiculo := COALESCE(NEW.metadata->'veiculo'->>'tipo', '');
    v_placa := COALESCE(NEW.metadata->'veiculo'->>'placa', '');
  ELSE
    v_tipo_veiculo := '';
    v_placa := '';
  END IF;

  -- ====================================================================
  -- GUARD 2: Idempotência — já existe recrutamento_prestadores com mesmo CPF?
  -- ====================================================================
  IF v_cpf != '' THEN
    SELECT id INTO v_rp_id
    FROM public.recrutamento_prestadores
    WHERE cpf_cnpj = v_cpf
    LIMIT 1;
  END IF;

  -- ====================================================================
  -- STEP 1: Criar recrutamento_prestadores (FK target)
  -- ====================================================================
  IF v_rp_id IS NULL THEN
    INSERT INTO public.recrutamento_prestadores (
      nome, cpf_cnpj, contatos, endereco, tipo_veiculo, placa_veiculo,
      status, origem_cadastro, data_cadastro, ultima_atividade,
      created_at, updated_at
    ) VALUES (
      v_nome, v_cpf,
      jsonb_build_array(
        jsonb_build_object('tipo', 'telefone', 'valor', v_telefone, 'principal', true),
        jsonb_build_object('tipo', 'email', 'valor', v_email, 'principal', false)
      ),
      jsonb_build_object('cidade', v_cidade, 'estado', v_uf),
      v_tipo_veiculo, v_placa,
      'novo', 'app_motorista', v_now, v_now,
      NOW(), NOW()
    )
    RETURNING id INTO v_rp_id;

    RAISE NOTICE 'REC-06.1 BRIDGE: recrutamento_prestadores % criado para prestador %', v_rp_id, NEW.id;
  ELSE
    RAISE NOTICE 'REC-06.1 BRIDGE: recrutamento_prestadores % já existe (cpf %) — reutilizando', v_rp_id, v_cpf;
  END IF;

  -- ====================================================================
  -- GUARD 3: Idempotência — já existe candidato vinculado a este recrutamento_prestadores?
  -- ====================================================================
  SELECT EXISTS(
    SELECT 1 FROM public.recrutamento_candidatos
    WHERE prestador_id = v_rp_id
    LIMIT 1
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE 'REC-06.1 BRIDGE: candidato já existe para recrutamento_prestadores % — skip', v_rp_id;
    RETURN NEW;
  END IF;

  -- ====================================================================
  -- STEP 2: Criar recrutamento_candidatos (pipeline)
  -- ====================================================================
  v_tags := jsonb_build_array(
    'app_motorista',
    'bridge_automatico',
    'origem:' || COALESCE(NEW.origem, 'app_prestador')
  );

  INSERT INTO public.recrutamento_candidatos (
    nome, telefone, email, cidade, uf, veiculo, placa,
    stage, status_documental, prioridade, validade_cnh,
    tags, observacoes_ia, data_entrada, data_atualizacao,
    prestador_id, created_at, updated_at
  ) VALUES (
    v_nome, v_telefone, v_email, v_cidade, v_uf, v_tipo_veiculo, v_placa,
    'novo_cadastro', 'pendente', 'normal', '',
    v_tags,
    '[REC-06.1] Candidato criado via bridge prestador→recrutamento. Prestador ID: ' || NEW.id || '. Auth User ID: ' || COALESCE(NEW.auth_user_id::text, 'N/A'),
    v_now, v_now,
    v_rp_id, NOW(), NOW()
  )
  RETURNING id INTO v_candidato_id;

  RAISE NOTICE 'REC-06.1 BRIDGE: candidato % criado para prestador % via recrutamento_prestadores %',
    v_candidato_id, NEW.id, v_rp_id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista(p_auth_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid UUID;
  v_prestador_id UUID;
  v_operacoes JSONB;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;
  IF p_auth_user_id IS NOT NULL AND p_auth_user_id <> v_authenticated_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_USER_ID_INVALIDO');
  END IF;
  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid;
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_ENCONTRADO');
  END IF;
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ae.id,
      'prestador_id', ae.prestador_id,
      'status', ae.status,
      'rota', ae.rota,
      'origem', ae.origem,
      'destino', ae.destino,
      'data_escala', ae.data_escala,
      'turno', ae.turno,
      'tipo_veiculo', ae.tipo_veiculo,
      'placa', ae.placa,
      'quantidade_paradas', ae.quantidade_paradas,
      'valor_repasse', ae.valor_repasse,
      'km_previstos', ae.km_previstos,
      'valor_km', ae.valor_km,
      'observacoes', ae.observacoes,
      'operation_mode', ae.operation_mode,
      'coleta_reversa', ae.coleta_reversa,
      'tenant_id', ae.tenant_id,
      'metadata', ae.metadata,
      'endereco_origem', ae.endereco_origem,
      'endereco_destino', ae.endereco_destino,
      'horario_saida', ae.horario_saida,
      'horario_retorno_previsto', ae.horario_retorno_previsto,
      'aceite_prestador', ae.aceite_prestador,
      'data_aceite', ae.data_aceite,
      'horario_inicio_real', ae.horario_inicio_real,
      'horario_fim_real', ae.horario_fim_real,
      'finalizada', ae.finalizada,
      'data_finalizacao', ae.data_finalizacao,
      'created_at', ae.created_at,
      'updated_at', ae.updated_at,
      'paradas', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'parada_id', rp.id,
              'sequencia', rp.sequencia,
              'destinatario', COALESCE(rp.destinatario, rp.cliente_nome, ''),
              'endereco', COALESCE(rp.endereco, ''),
              'logradouro', rp.logradouro,
              'numero', rp.numero,
              'complemento', rp.complemento,
              'bairro', rp.bairro,
              'cidade', rp.cidade,
              'uf', rp.uf,
              'cep', rp.cep,
              'referencia', rp.referencia,
              'latitude', rp.latitude,
              'longitude', rp.longitude,
              'portaria', rp.portaria,
              'doca', rp.doca,
              'procedimento_entrada', rp.procedimento_entrada,
              'procedimento_saida', rp.procedimento_saida,
              'contato_nome', rp.contato_nome,
              'contato_telefone', rp.contato_telefone,
              'pedido', rp.pedido,
              'nota_fiscal', rp.nota_fiscal,
              'peso', rp.peso,
              'volumes', rp.volumes,
              'prioridade', rp.prioridade,
              'janela_inicio', rp.janela_entrega,
              'instrucoes', rp.instrucoes,
              'status', rp.status,
              'data_prevista', rp.data_prevista
            )
            ORDER BY rp.sequencia
          )
          FROM public.rota_paradas rp
          WHERE rp.alocacao_id = ae.id
        ),
        '[]'::JSONB
      )
    )
    ORDER BY ae.data_escala DESC NULLS LAST, ae.created_at DESC
  ), '[]'::JSONB) INTO v_operacoes
  FROM public.alocacoes_escala ae
  WHERE ae.prestador_id = v_prestador_id
    AND (ae.status IS DISTINCT FROM 'cancelada')
    AND (ae.status IS DISTINCT FROM 'recusada');
  RETURN jsonb_build_object(
    'success', true,
    'operacoes', v_operacoes,
    'total', jsonb_array_length(v_operacoes)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_buscar_oportunidades_para_prestador(p_prestador_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prestador public.prestadores%ROWTYPE;
  v_veiculos_tipos text[];
  v_max_capacidade numeric;
  v_oportunidades jsonb;
BEGIN
  -- Valida o prestador requisitante (cadastro real).
  SELECT * INTO v_prestador
  FROM public.prestadores
  WHERE id = p_prestador_uuid AND status = 'ativo';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PRESTADOR_NAO_ENCONTRADO',
      'oportunidades', '[]'::jsonb
    );
  END IF;

  -- Veículos ativos do prestador (compatibilidade de tipo e capacidade).
  SELECT
    COALESCE(
      array_agg(DISTINCT v.tipo_veiculo)
        FILTER (WHERE v.tipo_veiculo IS NOT NULL AND v.tipo_veiculo <> ''),
      '{}'::text[]
    ),
    COALESCE(MAX(v.capacidade_kg), 0)
  INTO v_veiculos_tipos, v_max_capacidade
  FROM public.veiculos v
  WHERE v.prestador_vinculado = p_prestador_uuid
    AND v.status = 'Ativo';

  -- Oportunidades abertas compatíveis + dados exibíveis da OS.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ro.id,
        'os_id', ro.os_id,
        'status', ro.status,
        'valor_prestador', ro.valor_prestador,
        'veiculo_necessario', ro.veiculo_necessario,
        'tipo_veiculo', ro.tipo_veiculo,
        'regiao', ro.regiao,
        'requisitos', ro.requisitos,
        'prazo_expiracao', ro.prazo_expiracao,
        'aceite_em', ro.aceite_em,
        'created_at', ro.created_at,
        -- Dados da OS (somente exibíveis — NUNCA valor_cliente/margem/custos).
        'numero', os.numero,
        'tipo_operacao', os.tipo_operacao,
        'tipo_reversa', os.tipo_reversa,
        'data_programada', os.data_programada,
        'peso', os.peso,
        'volumes', os.volumes,
        'cubagem', os.cubagem,
        'carga_refrigerada', os.carga_refrigerada,
        'origem', os.origem,
        'destino', os.destino,
        'origem_endereco',
          CASE WHEN coleta.logradouro IS NOT NULL THEN
            CONCAT_WS(', ',
              NULLIF(coleta.logradouro, ''),
              NULLIF(coleta.numero, ''),
              NULLIF(coleta.bairro, ''),
              NULLIF(coleta.cidade, ''),
              NULLIF(coleta.uf, '')
            )
          ELSE NULL END,
        'cidade_coleta', coleta.cidade,
        'latitude_coleta', coleta.latitude,
        'longitude_coleta', coleta.longitude,
        'destino_endereco',
          CASE WHEN entrega.logradouro IS NOT NULL THEN
            CONCAT_WS(', ',
              NULLIF(entrega.logradouro, ''),
              NULLIF(entrega.numero, ''),
              NULLIF(entrega.bairro, ''),
              NULLIF(entrega.cidade, ''),
              NULLIF(entrega.uf, '')
            )
          ELSE NULL END,
        'cidade_destino', entrega.cidade,
        'observacoes', os.observacoes_gerais,
        'distancia_km', os.distancia_km
      )
      ORDER BY ro.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_oportunidades
  FROM public.rede_oportunidades ro
  JOIN public.ordens_servico os ON os.id = ro.os_id
  LEFT JOIN LATERAL (
    SELECT
      e->>'logradouro' AS logradouro,
      e->>'numero'    AS numero,
      e->>'bairro'    AS bairro,
      e->>'cidade'    AS cidade,
      e->>'uf'        AS uf,
      NULLIF(e->>'latitude', '')::numeric  AS latitude,
      NULLIF(e->>'longitude', '')::numeric AS longitude
    FROM jsonb_array_elements(COALESCE(os.enderecos, '[]'::jsonb)) AS e
    WHERE e->>'tipo' = 'coleta'
    ORDER BY COALESCE(NULLIF(e->>'sequencia', ''), '0')
    LIMIT 1
  ) coleta ON true
  LEFT JOIN LATERAL (
    SELECT
      e->>'logradouro' AS logradouro,
      e->>'numero'     AS numero,
      e->>'bairro'     AS bairro,
      e->>'cidade'     AS cidade,
      e->>'uf'         AS uf
    FROM jsonb_array_elements(COALESCE(os.enderecos, '[]'::jsonb)) AS e
    WHERE e->>'tipo' = 'entrega'
    ORDER BY COALESCE(NULLIF(e->>'sequencia', ''), '0')
    LIMIT 1
  ) entrega ON true
  WHERE ro.status IN ('publicada', 'visualizada', 'interessada')
    AND ro.prestador_aceite_id IS NULL
    AND (ro.prazo_expiracao IS NULL OR ro.prazo_expiracao >= now())
    -- Compatibilidade de região (quando a oportunidade define região).
    -- "Todas as capitais" no cadastro é tratado como curinga. Região do
    -- prestador ausente também não restringe (cadastro incompleto).
    AND (
      ro.regiao IS NULL OR ro.regiao = ''
      OR v_prestador.regiao_principal IS NULL
      OR v_prestador.regiao_principal ILIKE '%todas as capitais%'
      OR v_prestador.regiao_principal ILIKE '%' || ro.regiao || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(v_prestador.regioes_secundarias) rs
        WHERE rs ILIKE '%' || ro.regiao || '%'
      )
    )
    -- Compatibilidade de veículo (tipo exigido pertence aos veículos do
    -- prestador). Taxonomia única compartilhada (TIPOS_VEICULO no TMS);
    -- comparação case-insensitive (dados reais têm "VUC"/"vuc"/"fiorino").
    AND (
      COALESCE((ro.veiculo_necessario->>'tipo'), '') = ''
      OR EXISTS (
        SELECT 1 FROM unnest(v_veiculos_tipos) vt
        WHERE LOWER(vt) = LOWER((ro.veiculo_necessario->>'tipo'))
      )
    )
    -- Capacidade suportada.
    AND (
      COALESCE((ro.veiculo_necessario->>'capacidade_kg')::numeric, 0) <= 0
      OR v_max_capacidade >= (ro.veiculo_necessario->>'capacidade_kg')::numeric
    )
    -- Carga refrigerada.
    AND (
      COALESCE((ro.veiculo_necessario->>'termica'), '') <> 'refrigerado'
      OR v_prestador.aceita_refrigerada = true
    );

  RETURN jsonb_build_object(
    'success', true,
    'oportunidades', v_oportunidades,
    'total', jsonb_array_length(v_oportunidades)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_buscar_prestadores_compativeis(p_oportunidade_id uuid)
 RETURNS TABLE(prestador_id uuid, nome_completo text, telefone text, whatsapp text, score_interno numeric, tipo_veiculo text, placa text, capacidade_kg numeric, regiao_principal text, aceita_refrigerada boolean, status text, score_match numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_os_id UUID;
  v_veiculo JSONB;
  v_regiao TEXT;
  v_requisitos JSONB;
  v_regiao_like TEXT;
  v_regiao_cidade TEXT;
  v_regiao_estado TEXT;
BEGIN
  SELECT r.os_id, r.veiculo_necessario, r.regiao, r.requisitos
  INTO v_os_id, v_veiculo, v_regiao, v_requisitos
  FROM rede_oportunidades r
  WHERE r.id = p_oportunidade_id AND r.status = 'publicada';

  IF NOT FOUND THEN RETURN; END IF;

  -- Preparar variações de região para matching flexível
  v_regiao_like := '%' || COALESCE(v_regiao, '') || '%';
  v_regiao_cidade := split_part(COALESCE(v_regiao, ''), '/', 1);
  v_regiao_estado := split_part(COALESCE(v_regiao, ''), '/', 2);

  RETURN QUERY
  WITH prestadores_filtrados AS (
    SELECT
      p.id,
      p.nome_completo,
      p.telefone,
      p.whatsapp,
      COALESCE(p.score_interno, 0) as score_interno,
      v.tipo_veiculo,
      v.placa,
      v.capacidade_kg,
      p.regiao_principal,
      p.aceita_refrigerada,
      p.status
    FROM prestadores p
    LEFT JOIN LATERAL (
      SELECT v2.tipo_veiculo, v2.placa, v2.capacidade_kg
      FROM veiculos v2
      WHERE v2.prestador_vinculado::text = p.id::text AND v2.status = 'Ativo'
      LIMIT 1
    ) v ON true
    WHERE
      p.status = 'ativo'
      AND (
        v_regiao IS NULL OR v_regiao = '' OR
        p.regiao_principal ILIKE v_regiao_like OR
        EXISTS (SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE v_regiao_like) OR
        (v_regiao_cidade <> '' AND (p.regiao_principal ILIKE '%' || v_regiao_cidade || '%' OR EXISTS (SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE '%' || v_regiao_cidade || '%'))) OR
        (v_regiao_estado <> '' AND (p.regiao_principal ILIKE '%' || v_regiao_estado || '%' OR EXISTS (SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE '%' || v_regiao_estado || '%')))
      )
  )
  SELECT
    pf.id, pf.nome_completo, pf.telefone, pf.whatsapp, pf.score_interno,
    pf.tipo_veiculo, pf.placa, pf.capacidade_kg, pf.regiao_principal,
    pf.aceita_refrigerada, pf.status,
    (
      CASE WHEN pf.tipo_veiculo IS NOT NULL AND (v_veiculo->>'tipo' IS NULL OR pf.tipo_veiculo ILIKE '%' || COALESCE(v_veiculo->>'tipo', '') || '%') THEN 35 ELSE 0 END +
      CASE WHEN pf.regiao_principal IS NOT NULL AND (v_regiao IS NULL OR v_regiao = '' OR pf.regiao_principal ILIKE v_regiao_like) THEN 25
           WHEN v_regiao IS NOT NULL AND v_regiao <> '' THEN 15 ELSE 0 END +
      CASE WHEN (v_veiculo->>'termica' IS NULL OR v_veiculo->>'termica' = 'seco') THEN 10 WHEN pf.aceita_refrigerada THEN 10 ELSE 0 END +
      CASE WHEN COALESCE(pf.score_interno, 0) >= 0.8 THEN 10 WHEN COALESCE(pf.score_interno, 0) >= 0.5 THEN 5 ELSE 0 END + 10 +
      CASE WHEN pf.tipo_veiculo IS NOT NULL THEN 10 ELSE 0 END
    )::NUMERIC AS score_match
  FROM prestadores_filtrados pf
  WHERE (v_veiculo IS NULL OR v_veiculo = '{}'::jsonb OR pf.tipo_veiculo IS NOT NULL)
  ORDER BY score_match DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_calcular_financeiro_operacao(p_alocacao_id uuid, p_modo text DEFAULT 'completo'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rec RECORD;
  v_valor_cliente NUMERIC := 0;
  v_valor_prestador NUMERIC := 0;
  v_pedagio NUMERIC := 0;
  v_ajudante NUMERIC := 0;
  v_adicional NUMERIC := 0;
  v_desconto NUMERIC := 0;
  v_reversa_cliente NUMERIC := 0;
  v_reversa_prestador NUMERIC := 0;
  v_base_prestador NUMERIC := 0;
  v_diaria NUMERIC := 0;
  v_km_adicional NUMERIC := 0;
  v_espera NUMERIC := 0;
  v_segunda_saida NUMERIC := 0;
  v_terceira_saida NUMERIC := 0;
  v_bonificacao NUMERIC := 0;
  v_total_cliente NUMERIC := 0;
  v_total_prestador NUMERIC := 0;
  v_margem NUMERIC := 0;
BEGIN
  SELECT * INTO v_rec FROM public.alocacoes_escala WHERE id = p_alocacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Alocação não encontrada');
  END IF;

  v_valor_cliente := COALESCE(v_rec.valor_frete, 0);
  v_valor_prestador := COALESCE(v_rec.valor_repasse, 0);
  v_pedagio := COALESCE(v_rec.valor_pedagio, 0);
  v_ajudante := COALESCE(v_rec.valor_ajudante, 0);
  v_adicional := COALESCE(v_rec.valor_adicional, 0);
  v_desconto := COALESCE(v_rec.valor_desconto, 0);
  v_reversa_cliente := COALESCE(v_rec.reversa_valor_cliente, 0);
  v_reversa_prestador := COALESCE(v_rec.reversa_valor_prestador, 0);

  -- Calcular adicionais de diária, km extra, etc
  v_diaria := COALESCE(v_rec.diarias_adicionais, 0) * COALESCE(v_rec.valor_diaria, 0);
  IF v_rec.km_realizados > v_rec.km_previstos AND v_rec.km_previstos > 0 THEN
    v_km_adicional := (v_rec.km_realizados - v_rec.km_previstos) * COALESCE(v_rec.valor_km, 0);
  END IF;
  IF v_rec.segunda_saida THEN v_segunda_saida := COALESCE(v_rec.valor_segunda_saida, 0); END IF;
  IF v_rec.terceira_saida THEN v_terceira_saida := COALESCE(v_rec.valor_terceira_saida, 0); END IF;

  v_base_prestador := v_valor_prestador + v_pedagio + v_ajudante + v_adicional +
    v_diaria + v_km_adicional + v_espera + v_segunda_saida + v_terceira_saida +
    v_bonificacao + v_reversa_prestador;
  v_total_prestador := v_base_prestador - v_desconto;
  v_total_cliente := v_valor_cliente + v_reversa_cliente;

  IF v_total_cliente > 0 THEN
    v_margem := ROUND((v_total_cliente - v_total_prestador) / v_total_cliente * 100, 2);
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'alocacao_id', p_alocacao_id,
    'valor_cliente', v_total_cliente,
    'valor_prestador', v_total_prestador,
    'valor_base_prestador', v_valor_prestador,
    'pedagio', v_pedagio,
    'ajudante', v_ajudante,
    'adicional', v_adicional,
    'desconto', v_desconto,
    'diaria', v_diaria,
    'km_adicional', v_km_adicional,
    'espera', v_espera,
    'segunda_saida', v_segunda_saida,
    'terceira_saida', v_terceira_saida,
    'bonificacao', v_bonificacao,
    'reversa_cliente', v_reversa_cliente,
    'reversa_prestador', v_reversa_prestador,
    'margem_percentual', v_margem,
    'km_previstos', v_rec.km_previstos,
    'km_realizados', v_rec.km_realizados
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_cancelar_fatura(p_fatura_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura public.faturas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  SELECT * INTO v_fatura FROM public.faturas WHERE id = p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_ENCONTRADA');
  END IF;

  IF v_fatura.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_JA_CANCELADA');
  END IF;

  -- Cancela a fatura
  UPDATE public.faturas
  SET status = 'cancelada',
      cancelado_em = now(),
      cancelado_por = auth.uid(),
      motivo_cancelamento = p_motivo,
      atualizado_em = now()
  WHERE id = p_fatura_id;

  -- Cancela itens (libera os serviços; o anti-duplicidade ignora fatura cancelada)
  UPDATE public.fatura_itens SET status = 'cancelado', atualizado_em = now()
  WHERE fatura_id = p_fatura_id AND status = 'ativo';

  -- Cancela a Conta a Receber vinculada, se existir
  IF v_fatura.conta_receber_id IS NOT NULL THEN
    UPDATE public.financeiro_receber
    SET status = 'cancelado', observacoes = COALESCE(observacoes, '') || ' | Cancelada pela Fatura ' || COALESCE(v_fatura.numero, '')
    WHERE id = v_fatura.conta_receber_id AND status NOT IN ('pago');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'status', 'cancelada',
    'servicos_liberados', true
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_confirmar_pagamento_fechamento(p_fechamento_id uuid, p_data_pagamento date DEFAULT CURRENT_DATE)
 RETURNS TABLE(sucesso boolean, mensagem text, fechamento_id uuid, itens_processados integer, itens_ignorados integer, total_baixas integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_fechamento       RECORD;
    v_item             RECORD;
    v_res              RECORD;
    v_data             DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
    v_processados      INTEGER := 0;
    v_ignorados        INTEGER := 0;
    v_total_baixas     INTEGER := 0;
    v_total_itens      INTEGER := 0;
    v_total_valor      NUMERIC(18,2) := 0;
BEGIN
    -- 1. Valida fechamento
    SELECT id, status_pagamento, status_aprovacao, status_conferencia, status, valor_liquido
      INTO v_fechamento
      FROM public.pagamentos_prestadores
     WHERE id = p_fechamento_id
       AND tipo_pagamento = 'fechamento'
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Fechamento nao encontrado.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.status_pagamento = 'pago' OR v_fechamento.status = 'pago' THEN
        RETURN QUERY SELECT false, 'Fechamento ja esta pago.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF v_fechamento.status_aprovacao <> 'aprovado' THEN
        RETURN QUERY SELECT false, 'Fechamento nao esta aprovado.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    -- 1.1 Reconciliacao: soma dos itens deve bater com o valor do fechamento
    SELECT COUNT(*), COALESCE(SUM(valor_liquido), 0)
      INTO v_total_itens, v_total_valor
      FROM public.pagamentos_prestadores
     WHERE pagamentos_prestadores.fechamento_id = p_fechamento_id
       AND pagamentos_prestadores.id <> p_fechamento_id;

    IF v_total_itens = 0 THEN
        RETURN QUERY SELECT false, 'Fechamento nao possui itens vinculados.', p_fechamento_id, 0, 0, 0;
        RETURN;
    END IF;

    IF ROUND(COALESCE(v_fechamento.valor_liquido, 0)::NUMERIC, 2) <> ROUND(v_total_valor, 2) THEN
        RETURN QUERY SELECT false,
                            'Divergencia de valores no fechamento: fechamento=' || COALESCE(v_fechamento.valor_liquido, 0) || ', itens=' || v_total_valor || '.',
                            p_fechamento_id,
                            0,
                            0,
                            0;
        RETURN;
    END IF;

    -- 2. Itera pelos itens vinculados
    FOR v_item IN
        SELECT id, status_pagamento, status
          FROM public.pagamentos_prestadores
         WHERE pagamentos_prestadores.fechamento_id = p_fechamento_id
           AND pagamentos_prestadores.id <> p_fechamento_id
         ORDER BY id
    LOOP
        -- Idempotência: ignora itens já pagos
        IF v_item.status_pagamento = 'pago' OR v_item.status = 'pago' THEN
            v_ignorados := v_ignorados + 1;
            CONTINUE;
        END IF;

        IF v_item.status_pagamento = 'cancelado' OR v_item.status = 'cancelado' THEN
            RAISE EXCEPTION 'Item % do fechamento esta cancelado; pagamento nao pode prosseguir.', v_item.id;
        END IF;

        -- Chama RPC existente para cada item (mesma transação)
        SELECT r.sucesso, r.mensagem, r.baixa_id
          INTO v_res
          FROM public.f_confirmar_pagamento_prestador(v_item.id, v_data) r;

        IF NOT v_res.sucesso THEN
            RAISE EXCEPTION 'Item % do fechamento falhou: %', v_item.id, COALESCE(v_res.mensagem, 'erro desconhecido');
        END IF;

        v_processados := v_processados + 1;
        IF v_res.baixa_id IS NOT NULL THEN
            v_total_baixas := v_total_baixas + 1;
        END IF;
    END LOOP;

    -- 3. Atualiza fechamento para pago
    UPDATE public.pagamentos_prestadores
       SET status = 'pago',
           status_pagamento = 'pago',
           status_conferencia = 'conferido',
           data_pagamento = v_data
     WHERE id = p_fechamento_id;

    RETURN QUERY SELECT true,
                        'Fechamento pago com sucesso. Itens processados: ' || v_processados || ', ignorados: ' || v_ignorados || ', baixas: ' || v_total_baixas || '.',
                        p_fechamento_id,
                        v_processados,
                        v_ignorados,
                        v_total_baixas;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_confirmar_pagamento_prestador(p_pagamento_id uuid, p_data_pagamento date DEFAULT CURRENT_DATE, p_valor_pago numeric DEFAULT NULL::numeric)
 RETURNS TABLE(sucesso boolean, mensagem text, pagamento_id uuid, titulo_id uuid, baixa_id uuid, valor_pagamento numeric, valor_liquidado numeric, saldo_restante numeric, conta_financeira_id uuid, conta_financeira text, status_pagamento text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_pagamento    RECORD;
    v_titulo       RECORD;
    v_conta        RECORD;
    v_total_baixado NUMERIC(18,2);
    v_saldo        NUMERIC(18,2);
    v_titulos      INTEGER;
    v_baixa_id     UUID;
    v_valor        NUMERIC(18,2);
    v_data         DATE := COALESCE(p_data_pagamento, CURRENT_DATE);
    v_eh_parcial   BOOLEAN := FALSE;
BEGIN
    SELECT p.*
      INTO v_pagamento
      FROM public.pagamentos_prestadores p
     WHERE p.id = p_pagamento_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Pagamento de prestador nao encontrado.',
            p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF p_valor_pago IS NOT NULL AND p_valor_pago > 0 THEN
        v_valor := ROUND(p_valor_pago::NUMERIC, 2);
        v_eh_parcial := TRUE;
    ELSIF p_valor_pago IS NOT NULL AND p_valor_pago <= 0 THEN
        -- Valor parcial informado mas invalido → rejeitar explicitamente
        RETURN QUERY SELECT false, 'Valor do pagamento parcial deve ser maior que zero.',
            p_pagamento_id, NULL::UUID, NULL::UUID, NULL::NUMERIC, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, NULL::TEXT;
        RETURN;
    ELSE
        v_valor := ROUND(COALESCE(v_pagamento.valor_liquido, 0)::NUMERIC, 2);
        v_eh_parcial := FALSE;
    END IF;

    IF v_pagamento.status_pagamento = 'pago' OR v_pagamento.status = 'pago' THEN
        RETURN QUERY SELECT false, 'Pagamento ja esta marcado como pago.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_pagamento.status_pagamento = 'cancelado' OR v_pagamento.status = 'cancelado' THEN
        RETURN QUERY SELECT false, 'Pagamento cancelado nao pode ser confirmado.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_valor <= 0 THEN
        RETURN QUERY SELECT false, 'Valor do pagamento deve ser maior que zero.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    SELECT c.id, c.nome
      INTO v_conta
      FROM public.contas_financeiras c
     WHERE c.ativa = true
     ORDER BY c.principal DESC, c.nome ASC
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Nenhuma conta financeira ativa esta configurada.',
            v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::TEXT, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    -- Localizar titulo financeiro
    IF v_pagamento.os_id IS NOT NULL THEN
        -- COM OS: tenta por valor exato primeiro, depois por saldo
        SELECT count(*)::INTEGER INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE fp.os_id = v_pagamento.os_id::TEXT
           AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );

        IF v_titulos = 1 THEN
            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE fp.os_id = v_pagamento.os_id::TEXT
               AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        ELSE
            SELECT count(*)::INTEGER INTO v_titulos
              FROM public.financeiro_pagar fp
             WHERE fp.os_id = v_pagamento.os_id::TEXT
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               );

            IF v_titulos <> 1 THEN
                RETURN QUERY SELECT false,
                    CASE WHEN v_titulos = 0
                         THEN 'Nao existe titulo financeiro aberto para esta OS e prestador.'
                         ELSE 'Existe mais de um titulo candidato para a mesma OS; conciliacao ambigua.'
                    END,
                    v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                    NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
                RETURN;
            END IF;

            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE fp.os_id = v_pagamento.os_id::TEXT
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        END IF;
    ELSE
        -- SEM OS: tenta por valor exato primeiro, depois por saldo
        SELECT count(*)::INTEGER INTO v_titulos
          FROM public.financeiro_pagar fp
         WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
           AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
           AND (
                TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
             OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
             OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
           );

        IF v_titulos = 1 THEN
            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = v_valor
               AND COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        ELSE
            SELECT count(*)::INTEGER INTO v_titulos
              FROM public.financeiro_pagar fp
             WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               );

            IF v_titulos <> 1 THEN
                RETURN QUERY SELECT false,
                    CASE WHEN v_titulos = 0
                         THEN 'Nao existe titulo financeiro aberto de mesma origem e prestador.'
                         ELSE 'Existem varios titulos de mesmo prestador; vinculo explicito e obrigatorio.'
                    END,
                    v_pagamento.id, NULL::UUID, NULL::UUID, v_valor, NULL::NUMERIC,
                    NULL::NUMERIC, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
                RETURN;
            END IF;

            SELECT fp.* INTO v_titulo
              FROM public.financeiro_pagar fp
             WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
               AND (
                    TRIM(COALESCE(fp.prestador, '')) = TRIM(COALESCE(v_pagamento.prestador_id::TEXT, ''))
                 OR LOWER(TRIM(COALESCE(fp.prestador, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
                 OR LOWER(TRIM(COALESCE(fp.fornecedor_nome, ''))) = LOWER(TRIM(COALESCE(v_pagamento.prestador_nome, '')))
               )
             FOR UPDATE;
        END IF;
    END IF;

    SELECT COALESCE(SUM(fb.valor_baixado), 0)::NUMERIC(18,2)
      INTO v_total_baixado
      FROM public.financeiro_baixas fb
     WHERE fb.titulo_tabela = 'financeiro_pagar'
       AND fb.titulo_id = v_titulo.id
       AND NOT COALESCE(fb.estornada, false);

    v_saldo := ROUND(COALESCE(v_titulo.valor, 0)::NUMERIC, 2) - v_total_baixado;

    IF v_valor > v_saldo THEN
        RETURN QUERY SELECT false,
            'Valor do pagamento (R$ ' || v_valor || ') excede o saldo restante (R$ ' || v_saldo || ').',
            v_pagamento.id, v_titulo.id, NULL::UUID, v_valor, v_total_baixado,
            v_saldo, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    IF v_saldo <= 0 THEN
        RETURN QUERY SELECT false,
            'Titulo ja esta integralmente quitado.',
            v_pagamento.id, v_titulo.id, NULL::UUID, v_valor, v_total_baixado,
            v_saldo, v_conta.id, v_conta.nome, v_pagamento.status_pagamento;
        RETURN;
    END IF;

    INSERT INTO public.financeiro_baixas (
        titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
        data_baixa, forma_pagamento, conta_financeira, conta_financeira_id,
        observacao, estornada
    ) VALUES (
        'financeiro_pagar', v_titulo.id, v_titulo.valor, v_valor,
        v_saldo - v_valor,
        v_data, 'Pagamento Prestador', v_conta.nome, v_conta.id,
        CASE WHEN v_eh_parcial
             THEN 'Baixa parcial - pagamento prestador ' || LEFT(v_pagamento.id::TEXT, 8)
             ELSE 'Baixa atomica - pagamento prestador ' || LEFT(v_pagamento.id::TEXT, 8)
        END,
        false
    ) RETURNING id INTO v_baixa_id;

    IF (v_saldo - v_valor) > 0 THEN
        UPDATE public.financeiro_pagar
           SET status = 'parcial',
               data_pagamento = v_data,
               data_efetiva_pgto = v_data,
               conta_pagadora = v_conta.nome,
               observacoes = CASE
                   WHEN observacoes IS NULL OR observacoes = ''
                   THEN 'Baixa parcial R$ ' || v_valor || ' de R$ ' || v_titulo.valor
                   ELSE observacoes || E'\nBaixa parcial R$ ' || v_valor || ' de R$ ' || v_titulo.valor
               END
         WHERE id = v_titulo.id;
    ELSE
        UPDATE public.financeiro_pagar
           SET status = 'pago',
               data_pagamento = v_data,
               data_efetiva_pgto = v_data,
               conta_pagadora = v_conta.nome,
               observacoes = CASE
                   WHEN observacoes IS NULL OR observacoes = ''
                   THEN 'Baixa integral de pagamento de prestador.'
                   ELSE observacoes || E'\nBaixa integral de pagamento de prestador.'
               END
         WHERE id = v_titulo.id;
    END IF;

    IF (v_saldo - v_valor) > 0 THEN
        UPDATE public.pagamentos_prestadores
           SET status_conferencia = 'conferido',
               data_pagamento = v_data
         WHERE id = v_pagamento.id;
    ELSE
        UPDATE public.pagamentos_prestadores
           SET status = 'pago',
               status_pagamento = 'pago',
               status_conferencia = 'conferido',
               data_pagamento = v_data
         WHERE id = v_pagamento.id;
    END IF;

    RETURN QUERY SELECT
        true,
        CASE WHEN v_eh_parcial
             THEN 'Pagamento parcial registrado. Saldo restante: R$ ' || (v_saldo - v_valor) || '.'
             ELSE 'Pagamento confirmado com baixa integral.'
        END,
        v_pagamento.id,
        v_titulo.id,
        v_baixa_id,
        v_valor,
        v_valor,
        v_saldo - v_valor,
        v_conta.id,
        v_conta.nome,
        CASE WHEN (v_saldo - v_valor) > 0 THEN 'pendente' ELSE 'pago' END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_contar_mensagens_nao_lidas_torre()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = auth.uid()) THEN
    RETURN 0;
  END IF;
  SELECT count(*)::integer INTO v_total
  FROM public.operacao_mensagens
  WHERE sender_type = 'prestador' AND status = 'enviada';
  RETURN v_total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_emitir_fatura(p_fatura_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura public.faturas%ROWTYPE;
  v_numero text;
  v_receber_id uuid;
  v_vencimento date;
  v_obs_romaneios text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Lock transacional na fatura (impede emissão concorrente)
  SELECT * INTO v_fatura FROM public.faturas WHERE id = p_fatura_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_NAO_ENCONTRADA');
  END IF;

  IF v_fatura.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_CANCELADA');
  END IF;
  IF v_fatura.status = 'emitida' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_JA_EMITIDA');
  END IF;
  IF v_fatura.status NOT IN ('rascunho','aguardando_aprovacao','aprovada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'STATUS_INVALIDO_EMISSAO');
  END IF;

  -- Deve haver itens
  IF NOT EXISTS (SELECT 1 FROM public.fatura_itens WHERE fatura_id = p_fatura_id AND status = 'ativo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'FATURA_SEM_ITENS');
  END IF;

  -- Numeração sequencial transacional
  v_numero := public.f_gerar_numero_fatura(p_fatura_id);
  IF v_numero IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'FALHA_GERAR_NUMERO');
  END IF;

  -- Vencimento sugerido: vencimento da fatura, senão emissão + 30 dias
  v_vencimento := COALESCE(v_fatura.vencimento, v_fatura.data_emissao + 30);

  -- Cria Conta a Receber vinculada (FK fatura_id)
  INSERT INTO public.financeiro_receber (
    cliente_id, descricao, valor, vencimento, data_vencimento, data_emissao,
    status, cliente, cliente_nome, fatura, numero, os_vinculadas,
    valor_bruto, valor_liquido, fatura_id
  ) VALUES (
    v_fatura.cliente_id,
    'Fatura ' || v_numero,
    v_fatura.valor_total,
    v_vencimento,
    v_vencimento,
    CURRENT_DATE,
    'aberto',
    (SELECT COALESCE(c.nome_fantasia, c.razao_social, '') FROM public.clientes c WHERE c.id = v_fatura.cliente_id),
    (SELECT COALESCE(c.nome_fantasia, c.razao_social, '') FROM public.clientes c WHERE c.id = v_fatura.cliente_id),
    v_numero,
    v_numero,
    NULL,
    v_fatura.valor_bruto,
    v_fatura.valor_total,
    p_fatura_id
  )
  RETURNING id INTO v_receber_id;

  -- Marca fatura emitida
  UPDATE public.faturas
  SET status = 'emitida',
      numero = v_numero,
      conta_receber_id = v_receber_id,
      vencimento = v_vencimento,
      atualizado_por = auth.uid(),
      atualizado_em = now()
  WHERE id = p_fatura_id;

  RETURN jsonb_build_object(
    'success', true,
    'fatura_id', p_fatura_id,
    'numero', v_numero,
    'conta_receber_id', v_receber_id,
    'valor_total', v_fatura.valor_total,
    'vencimento', v_vencimento
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_enviar_mensagem_torre(p_alocacao_id uuid, p_mensagem text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid uuid;
  v_prestador_id uuid;
  v_alocacao record;
  v_mensagem_id uuid;
  v_existente uuid;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Idempotência: mesma chave retorna a mensagem já criada
  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_existente FROM public.operacao_mensagens
    WHERE idempotency_key = p_idempotency_key AND sender_type = 'prestador'
    LIMIT 1;
    IF v_existente IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'duplicada', true, 'mensagem_id', v_existente);
    END IF;
  END IF;

  -- Resolver prestador autenticado
  SELECT id INTO v_prestador_id
  FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid
    AND status = 'ativo'
    AND liberado_app = true;
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_VINCULADO');
  END IF;

  -- Validar alocação pertence ao prestador
  SELECT id, ordem_servico_id, prestador_id, status
    INTO v_alocacao
  FROM public.alocacoes_escala
  WHERE id = p_alocacao_id;
  IF v_alocacao.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;
  IF v_alocacao.prestador_id IS DISTINCT FROM v_prestador_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;
  IF v_alocacao.status IN ('cancelada', 'recusada') THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_INATIVA');
  END IF;

  -- Validar mensagem
  IF p_mensagem IS NULL OR btrim(p_mensagem) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MENSAGEM_VAZIA');
  END IF;
  IF length(p_mensagem) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MENSAGEM_MUITO_LONGA');
  END IF;

  INSERT INTO public.operacao_mensagens (
    alocacao_id, os_id, prestador_id, sender_type, sender_user_id,
    mensagem, status, idempotency_key
  ) VALUES (
    p_alocacao_id,
    v_alocacao.ordem_servico_id,
    v_prestador_id,
    'prestador',
    v_authenticated_uid,
    btrim(p_mensagem),
    'enviada',
    NULLIF(p_idempotency_key, '')
  )
  RETURNING id INTO v_mensagem_id;

  RETURN jsonb_build_object('success', true, 'mensagem_id', v_mensagem_id, 'created_at', now());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_estornar_baixa_financeira(p_baixa_id uuid, p_motivo_estorno text DEFAULT NULL::text)
 RETURNS TABLE(sucesso boolean, mensagem text, saldo_restante numeric, status_titulo text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_baixa            RECORD;
    v_valor_original   NUMERIC(18,2);
    v_total_baixado    NUMERIC(18,2);
    v_saldo            NUMERIC(18,2);
    v_novo_status      TEXT;
BEGIN
    SELECT id, titulo_tabela, titulo_id, estornada
      INTO v_baixa
      FROM public.financeiro_baixas
     WHERE id = p_baixa_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Baixa não encontrada.', NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_baixa.estornada THEN
        RETURN QUERY SELECT false, 'Baixa já estornada.', NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_baixa.titulo_tabela NOT IN ('financeiro_pagar','financeiro_receber') THEN
        RETURN QUERY SELECT false, 'Tabela de título não suportada.', NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    -- Marca como estornada — nunca apaga o registro
    UPDATE public.financeiro_baixas
       SET estornada      = true,
           data_estorno   = now(),
           motivo_estorno = p_motivo_estorno
     WHERE id = p_baixa_id;

    -- Recalcula total baixado (excluindo a baixa estornada) e saldo
    SELECT COALESCE(SUM(valor_baixado), 0)
      INTO v_total_baixado
      FROM public.financeiro_baixas
     WHERE titulo_tabela = v_baixa.titulo_tabela
       AND titulo_id = v_baixa.titulo_id
       AND NOT estornada;

    IF v_baixa.titulo_tabela = 'financeiro_pagar' THEN
        SELECT valor
          INTO v_valor_original
          FROM public.financeiro_pagar
         WHERE id = v_baixa.titulo_id;
    ELSE
        SELECT valor
          INTO v_valor_original
          FROM public.financeiro_receber
         WHERE id = v_baixa.titulo_id;
    END IF;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Título de origem não encontrado.', NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    v_saldo := v_valor_original - v_total_baixado;
    IF v_saldo < 0 THEN
        v_saldo := 0;
    END IF;

    IF v_total_baixado <= 0 THEN
        -- Nenhuma baixa válida restante → título volta a aberto
        v_novo_status := 'aberto';
        IF v_baixa.titulo_tabela = 'financeiro_pagar' THEN
            UPDATE public.financeiro_pagar
               SET status            = v_novo_status,
                   data_pagamento    = NULL,
                   data_efetiva_pgto = NULL
             WHERE id = v_baixa.titulo_id;
        ELSE
            UPDATE public.financeiro_receber
               SET status         = v_novo_status,
                   data_pagamento = NULL
             WHERE id = v_baixa.titulo_id;
        END IF;
    ELSIF v_saldo > 0 THEN
        v_novo_status := 'parcial';
        IF v_baixa.titulo_tabela = 'financeiro_pagar' THEN
            UPDATE public.financeiro_pagar SET status = v_novo_status WHERE id = v_baixa.titulo_id;
        ELSE
            UPDATE public.financeiro_receber SET status = v_novo_status WHERE id = v_baixa.titulo_id;
        END IF;
    ELSE
        v_novo_status := 'pago';
        IF v_baixa.titulo_tabela = 'financeiro_pagar' THEN
            UPDATE public.financeiro_pagar SET status = v_novo_status WHERE id = v_baixa.titulo_id;
        ELSE
            UPDATE public.financeiro_receber SET status = v_novo_status WHERE id = v_baixa.titulo_id;
        END IF;
    END IF;

    RETURN QUERY SELECT true, 'Baixa estornada. Registro preservado.', v_saldo, v_novo_status;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_gerar_numero_fatura(p_fatura_id uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ano integer;
  v_seq_name text;
  v_numero text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  v_ano := EXTRACT(YEAR FROM now())::integer;
  v_seq_name := 'seq_fatura_' || v_ano::text;

  -- Cria a sequência do ano se não existir (aditivo, on-demand)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_seq_name AND c.relkind = 'S'
  ) THEN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I START 1', v_seq_name);
  END IF;

  -- nextval é atômico e serializa chamadas concorrentes → impede duplicidade
  EXECUTE format('SELECT nextval(''public.%I'')', v_seq_name) INTO v_numero;

  RETURN format('FAT-%s-%s', v_ano, LPAD(v_numero, 6, '0'));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_km_evidencias_operacao(p_os_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_os_numero text;
  v_alocacoes jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Guard via tenant_usuarios (usuário TMS ativo). Sem has_role/profiles/user_roles.
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_usuarios tu
    WHERE tu.user_id = v_uid AND tu.status = 'ativo'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SEM_PERMISSAO');
  END IF;

  IF p_os_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS_INVALIDA');
  END IF;

  SELECT numero INTO v_os_numero
  FROM public.ordens_servico
  WHERE id = p_os_id;

  -- OS → alocação (alocacoes_escala.ordem_servico_id). Cada alocação traz:
  --   km (operation_km por operation_id = alocação), tempos e timeline
  --   (operation_timeline_events.operation_id é TEXT → cast a.id::TEXT).
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'alocacao_id', a.id,
        'status', a.status,
        'finalizada', a.finalizada,
        'placa', a.placa,
        'tipo_veiculo', a.tipo_veiculo,
        'tempos', jsonb_build_object(
          'data_escala', a.data_escala,
          'data_aceite', a.data_aceite,
          'horario_inicio_real', a.horario_inicio_real,
          'horario_fim_real', a.horario_fim_real,
          'data_finalizacao', a.data_finalizacao,
          'tempo_total_minutos', a.tempo_total_minutos,
          'updated_at', a.updated_at
        ),
        'km', (
          SELECT jsonb_build_object(
            'km_inicial', km.km_inicial,
            'km_final', km.km_final,
            'km_rodado', COALESCE(km.km_rodado,
              CASE WHEN km.km_inicial IS NOT NULL AND km.km_final IS NOT NULL
                   THEN km.km_final - km.km_inicial END),
            'km_adicional', km.km_adicional,
            'valor_adicional_estimado', km.valor_adicional_estimado,
            'foto_km_inicial_url', km.foto_km_inicial_url,
            'foto_km_final_url', km.foto_km_final_url,
            'updated_at', km.updated_at
          )
          FROM public.operation_km km
          WHERE km.operation_id = a.id
          LIMIT 1
        ),
        'timeline', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'type', t.type,
                'title', t.title,
                'event_time', t.event_time,
                'metadata', t.metadata
              ) ORDER BY t.event_time ASC NULLS LAST, t.created_at ASC
            )
            FROM public.operation_timeline_events t
            WHERE t.operation_id = a.id::TEXT
          ),
          '[]'::jsonb
        )
      ) ORDER BY a.data_escala ASC, a.created_at ASC
    ),
    '[]'::jsonb
  ) INTO v_alocacoes
  FROM public.alocacoes_escala a
  WHERE a.ordem_servico_id = p_os_id;

  RETURN jsonb_build_object(
    'success', true,
    'os_id', p_os_id,
    'os_numero', v_os_numero,
    'total_alocacoes', COALESCE(jsonb_array_length(v_alocacoes), 0),
    'alocacoes', v_alocacoes
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_log_tabela_alteracao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN NEW.versao := COALESCE(OLD.versao, 0) + 1; NEW.updated_at := NOW(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.f_marcar_mensagens_lidas_app(p_alocacao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid uuid;
  v_prestador_id uuid;
  v_count integer;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  SELECT id INTO v_prestador_id FROM public.prestadores
  WHERE auth_user_id = v_authenticated_uid;
  IF v_prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PRESTADOR_NAO_VINCULADO');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.alocacoes_escala
    WHERE id = p_alocacao_id AND prestador_id = v_prestador_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_OUTRO_PRESTADOR');
  END IF;

  UPDATE public.operacao_mensagens
  SET status = 'lida', read_at = now()
  WHERE alocacao_id = p_alocacao_id
    AND sender_type = 'torre'
    AND status = 'enviada';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'atualizadas', v_count);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_marcar_mensagens_lidas_torre(p_alocacao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid uuid;
  v_count integer;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = v_authenticated_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTORIZADO_TORRE');
  END IF;

  UPDATE public.operacao_mensagens
  SET status = 'lida', read_at = now()
  WHERE alocacao_id = p_alocacao_id
    AND sender_type = 'prestador'
    AND status = 'enviada';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'atualizadas', v_count);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_obter_cliente_id_do_usuario()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
        DECLARE v_cliente_id uuid;
        BEGIN
          SELECT uc.cliente_id INTO v_cliente_id
          FROM public.usuarios_cliente uc WHERE uc.auth_user_id = auth.uid() LIMIT 1;
          IF v_cliente_id IS NULL THEN
            SELECT c.id INTO v_cliente_id
            FROM public.clientes c
            JOIN public.tenant_usuarios tu ON tu.tenant_id = c.tenant_id
            WHERE tu.user_id = auth.uid() LIMIT 1;
          END IF;
          RETURN v_cliente_id;
        END; $function$
;

CREATE OR REPLACE FUNCTION public.f_obter_prestador_por_auth()
 RETURNS TABLE(nome_completo text, prestador_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT p.nome_completo, p.id
    FROM public.prestadores p
    WHERE p.auth_user_id = auth.uid()
    LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.f_rec_automacoes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_recalcular_totais_fatura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fatura_id uuid;
BEGIN
  v_fatura_id := NEW.fatura_id;
  IF TG_OP = 'DELETE' THEN
    v_fatura_id := OLD.fatura_id;
  END IF;

  UPDATE public.faturas f
  SET
    valor_bruto = COALESCE((
      SELECT SUM(i.valor_base) FROM public.fatura_itens i
      WHERE i.fatura_id = v_fatura_id AND i.status = 'ativo'
    ), 0),
    valor_total = COALESCE((
      SELECT SUM(i.valor_total) FROM public.fatura_itens i
      WHERE i.fatura_id = v_fatura_id AND i.status = 'ativo'
    ), 0),
    descontos = COALESCE((
      SELECT SUM(i.valor_descontos) FROM public.fatura_itens i
      WHERE i.fatura_id = v_fatura_id AND i.status = 'ativo'
    ), 0),
    atualizado_em = now()
  WHERE f.id = v_fatura_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_registrar_baixa_financeira(p_titulo_tabela text, p_titulo_id uuid, p_valor_baixado numeric, p_data_baixa date DEFAULT CURRENT_DATE, p_forma_pagamento text DEFAULT NULL::text, p_conta_financeira text DEFAULT NULL::text, p_conta_financeira_id uuid DEFAULT NULL::uuid, p_referencia_bancaria text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text, p_usuario_id uuid DEFAULT NULL::uuid, p_usuario_nome text DEFAULT NULL::text)
 RETURNS TABLE(sucesso boolean, mensagem text, baixa_id uuid, saldo_restante numeric, status_titulo text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_valor_original   NUMERIC(18,2);
    v_status_atual     TEXT;
    v_total_baixado    NUMERIC(18,2);
    v_saldo            NUMERIC(18,2);
    v_novo_saldo       NUMERIC(18,2);
    v_novo_status      TEXT;
    v_baixa_id         UUID;
    v_linha_historico  TEXT;
BEGIN
    IF p_valor_baixado IS NULL OR p_valor_baixado <= 0 THEN
        RETURN QUERY SELECT false, 'Valor da baixa deve ser maior que zero.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF p_titulo_tabela = 'financeiro_pagar' THEN
        SELECT valor, status INTO v_valor_original, v_status_atual
          FROM public.financeiro_pagar WHERE id = p_titulo_id FOR UPDATE;
    ELSIF p_titulo_tabela = 'financeiro_receber' THEN
        SELECT valor, status INTO v_valor_original, v_status_atual
          FROM public.financeiro_receber WHERE id = p_titulo_id FOR UPDATE;
    ELSE
        RETURN QUERY SELECT false, 'Tabela de título não suportada.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Título não encontrado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_status_atual IN ('cancelado','cancelada') THEN
        RETURN QUERY SELECT false, 'Não é permitido baixar título cancelado.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_status_atual IN ('pago','paga') THEN
        RETURN QUERY SELECT false, 'Título já quitado. Não é permitida nova baixa.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    SELECT COALESCE(SUM(valor_baixado), 0) INTO v_total_baixado
      FROM public.financeiro_baixas
     WHERE titulo_tabela = p_titulo_tabela AND titulo_id = p_titulo_id AND NOT estornada;

    v_saldo := v_valor_original - v_total_baixado;

    IF v_saldo <= 0 THEN
        RETURN QUERY SELECT false, 'Título já quitado. Não é permitida nova baixa.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF p_valor_baixado > v_saldo THEN
        RETURN QUERY SELECT false,
            'Valor da baixa excede o saldo restante (' || v_saldo || ').',
            NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    v_novo_saldo := v_saldo - p_valor_baixado;

    IF v_novo_saldo < 0 THEN
        RETURN QUERY SELECT false, 'Saldo não pode ficar negativo.', NULL::UUID, NULL::NUMERIC, NULL::TEXT;
        RETURN;
    END IF;

    IF v_novo_saldo > 0 THEN
        v_novo_status := 'parcial';
    ELSE
        v_novo_status := 'pago';
    END IF;

    INSERT INTO public.financeiro_baixas (
        titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
        data_baixa, forma_pagamento, conta_financeira, conta_financeira_id,
        referencia_bancaria, observacao, usuario_id, usuario_nome
    ) VALUES (
        p_titulo_tabela, p_titulo_id, v_valor_original, p_valor_baixado, v_novo_saldo,
        p_data_baixa, p_forma_pagamento, p_conta_financeira, p_conta_financeira_id,
        p_referencia_bancaria, p_observacao, p_usuario_id, p_usuario_nome
    ) RETURNING id INTO v_baixa_id;

    v_linha_historico := 'Baixa R$ ' || p_valor_baixado || ' em ' || p_data_baixa
                         || '. Saldo restante: R$ ' || v_novo_saldo || '.';

    IF p_titulo_tabela = 'financeiro_pagar' THEN
        UPDATE public.financeiro_pagar
           SET status            = v_novo_status,
               data_pagamento    = p_data_baixa,
               data_efetiva_pgto = p_data_baixa,
               conta_pagadora    = COALESCE(p_conta_financeira, conta_pagadora),
               observacoes       = CASE
                                     WHEN observacoes IS NULL OR observacoes = '' THEN v_linha_historico
                                     ELSE observacoes || E'\n' || v_linha_historico
                                   END
         WHERE id = p_titulo_id;
    ELSE
        UPDATE public.financeiro_receber
           SET status            = v_novo_status,
               data_pagamento    = p_data_baixa,
               conta_entrada     = COALESCE(p_conta_financeira, conta_entrada),
               observacoes       = CASE
                                     WHEN observacoes IS NULL OR observacoes = '' THEN v_linha_historico
                                     ELSE observacoes || E'\n' || v_linha_historico
                                   END
         WHERE id = p_titulo_id;
    END IF;

    RETURN QUERY SELECT true, 'Baixa registrada com sucesso.', v_baixa_id, v_novo_saldo, v_novo_status;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_registrar_notificacao_app(p_prestador_id uuid, p_titulo text, p_mensagem text, p_tipo text DEFAULT 'operacao'::text, p_origem_id uuid DEFAULT NULL::uuid, p_origem_tipo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_notificacao_id UUID;
BEGIN
  INSERT INTO public.portal_notificacoes (
    prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at
  ) VALUES (
    p_prestador_id, p_titulo, p_mensagem, p_tipo, p_origem_id, p_origem_tipo, false, NOW()
  ) RETURNING id INTO v_notificacao_id;

  RETURN v_notificacao_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_reprocessar_pedido_portal(p_pedido_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pedido RECORD;
  v_os_count INTEGER;
BEGIN
  -- Buscar pedido
  SELECT * INTO v_pedido FROM public.portal_pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Pedido não encontrado');
  END IF;

  -- Verificar se já tem OS válida
  IF v_pedido.os_vinculada_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_os_count FROM public.ordens_servico WHERE id = v_pedido.os_vinculada_id;
    IF v_os_count > 0 THEN
      RETURN jsonb_build_object('sucesso', true, 'os_id', v_pedido.os_vinculada_id, 'mensagem', 'Pedido já possui OS vinculada');
    END IF;
  END IF;

  -- Atualizar tentativas
  UPDATE public.portal_pedidos SET
    tentativas_processamento = COALESCE(tentativas_processamento, 0) + 1,
    ultima_tentativa_em = NOW(),
    status = 'enviado'
  WHERE id = p_pedido_id;

  RETURN jsonb_build_object('sucesso', true, 'mensagem', 'Pedido reenviado para processamento. Tentativa #' || (v_pedido.tentativas_processamento + 1));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_responder_mensagem_torre(p_alocacao_id uuid, p_mensagem text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_authenticated_uid uuid;
  v_alocacao record;
  v_mensagem_id uuid;
  v_existente uuid;
  v_notificacao_id uuid;
BEGIN
  v_authenticated_uid := auth.uid();
  IF v_authenticated_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTENTICADO');
  END IF;

  -- Somente usuário TMS pode responder
  IF NOT EXISTS (SELECT 1 FROM public.tenant_usuarios WHERE user_id = v_authenticated_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'USUARIO_NAO_AUTORIZADO_TORRE');
  END IF;

  -- Idempotência (resposta da torre)
  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT id INTO v_existente FROM public.operacao_mensagens
    WHERE idempotency_key = p_idempotency_key AND sender_type = 'torre'
    LIMIT 1;
    IF v_existente IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'duplicada', true, 'mensagem_id', v_existente);
    END IF;
  END IF;

  -- Validar alocação (para identificar o prestador e o os_id)
  SELECT id, ordem_servico_id, prestador_id, status INTO v_alocacao
  FROM public.alocacoes_escala WHERE id = p_alocacao_id;
  IF v_alocacao.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_NAO_ENCONTRADA');
  END IF;
  IF v_alocacao.prestador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALOCACAO_SEM_PRESTADOR');
  END IF;

  -- Validar mensagem
  IF p_mensagem IS NULL OR btrim(p_mensagem) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MENSAGEM_VAZIA');
  END IF;
  IF length(p_mensagem) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MENSAGEM_MUITO_LONGA');
  END IF;

  INSERT INTO public.operacao_mensagens (
    alocacao_id, os_id, prestador_id, sender_type, sender_user_id,
    mensagem, status, idempotency_key
  ) VALUES (
    p_alocacao_id,
    v_alocacao.ordem_servico_id,
    v_alocacao.prestador_id,
    'torre',
    v_authenticated_uid,
    btrim(p_mensagem),
    'enviada',
    NULLIF(p_idempotency_key, '')
  )
  RETURNING id INTO v_mensagem_id;

  -- Notificar o App (infra real existente)
  BEGIN
    v_notificacao_id := public.f_registrar_notificacao_app(
      v_alocacao.prestador_id,
      'Nova mensagem da Torre',
      left(btrim(p_mensagem), 120),
      'operacao_mensagem',
      p_alocacao_id,
      'alocacao'
    );
  EXCEPTION WHEN OTHERS THEN
    v_notificacao_id := NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'mensagem_id', v_mensagem_id,
    'notificacao_id', v_notificacao_id,
    'created_at', now()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_scan_validade_documentos()
 RETURNS TABLE(candidato_id uuid, nome text, tipo_documento text, validade date, dias_para_vencer integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    rc.id AS candidato_id,
    rc.nome,
    doc->>'nome' AS tipo_documento,
    (doc->>'dataValidade')::DATE AS validade,
    ((doc->>'dataValidade')::DATE - CURRENT_DATE) AS dias_para_vencer
  FROM public.recrutamento_candidatos rc,
       jsonb_array_elements(rc.documentos) AS doc
  WHERE rc.documentos IS NOT NULL
    AND jsonb_typeof(rc.documentos) = 'array'
    AND (doc->>'dataValidade') IS NOT NULL
    AND (doc->>'dataValidade') != ''
    AND ((doc->>'dataValidade')::DATE - CURRENT_DATE) <= 30
    AND ((doc->>'dataValidade')::DATE - CURRENT_DATE) >= -365;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_sync_delivery_proof_to_entregas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_alocacao_id UUID;
  v_prestador_id UUID;
  v_tenant_id UUID;
  v_ordem_servico_id UUID;
BEGIN
  BEGIN
    v_alocacao_id := CAST(NEW.operation_id AS UUID);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_alocacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ae.prestador_id, COALESCE(ae.tenant_id, NULL::uuid), ae.ordem_servico_id
  INTO v_prestador_id, v_tenant_id, v_ordem_servico_id
  FROM public.alocacoes_escala ae
  WHERE ae.id = v_alocacao_id;

  IF EXISTS (
    SELECT 1 FROM public.entregas_protocolo
    WHERE alocacao_id = v_alocacao_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.entregas_protocolo (
    alocacao_id, prestador_id, ordem_servico_id,
    nome_recebedor, documento_recebedor, receiver_relationship,
    observacao, foto_entrega_url, foto_canhoto_url, assinatura_url,
    data_hora_entrega, latitude, longitude, gps_accuracy,
    status, tenant_id
  ) VALUES (
    v_alocacao_id, v_prestador_id, v_ordem_servico_id,
    COALESCE(NEW.receiver_name, 'Motorista'),
    NEW.receiver_document, NEW.receiver_relationship,
    NEW.observation, NEW.photo_url, NEW.foto_canhoto_url, NEW.signature_url,
    COALESCE(NEW.delivered_at, NOW()),
    NEW.latitude, NEW.longitude, NEW.gps_accuracy,
    CASE
      WHEN NEW.status = 'delivered' THEN 'entregue'
      WHEN NEW.status = 'delivered_with_note' THEN 'entregue_ressalva'
      WHEN NEW.status = 'not_delivered' THEN 'nao_entregue'
      ELSE COALESCE(NEW.status, 'entregue')
    END,
    COALESCE(v_tenant_id, NEW.tenant_id, public.current_tenant_id_safe())
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_sync_tracking_to_oper_localizacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
     DECLARE v_prestador_id UUID; v_os_id UUID;
     BEGIN
       SELECT ae.prestador_id, ae.ordem_servico_id INTO v_prestador_id, v_os_id
       FROM public.alocacoes_escala ae WHERE ae.id = NEW.alocacao_id;
       INSERT INTO public.operacao_localizacao (alocacao_id, os_id, prestador_id, latitude, longitude, velocidade, precisao, tenant_id, atualizado_em)
       VALUES (NEW.alocacao_id, v_os_id, v_prestador_id, NEW.latitude, NEW.longitude, NEW.velocidade, NEW.precisao,
         COALESCE(NEW.tenant_id, public.current_tenant_id_safe()), COALESCE(NEW.captured_at, NOW()))
       ON CONFLICT DO NOTHING;
       RETURN NEW;
     END;
     $function$
;

CREATE OR REPLACE FUNCTION public.f_transferir_entre_contas(p_conta_origem_id uuid, p_conta_destino_id uuid, p_valor numeric, p_data date DEFAULT CURRENT_DATE, p_taxa numeric DEFAULT 0, p_historico text DEFAULT NULL::text, p_usuario_id uuid DEFAULT NULL::uuid, p_usuario_nome text DEFAULT NULL::text)
 RETURNS TABLE(sucesso boolean, mensagem text, transferencia_id uuid)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_transferencia_id UUID;
    v_origem_saldo     NUMERIC(18,2);
    v_total_sair       NUMERIC(18,2);
BEGIN
    IF p_valor IS NULL OR p_valor <= 0 THEN
        RETURN QUERY SELECT false, 'Valor da transferência deve ser maior que zero.', NULL::UUID;
        RETURN;
    END IF;

    IF p_conta_origem_id = p_conta_destino_id THEN
        RETURN QUERY SELECT false, 'Conta de origem e destino devem ser diferentes.', NULL::UUID;
        RETURN;
    END IF;

    SELECT saldo INTO v_origem_saldo
      FROM public.contas_financeiras
     WHERE id = p_conta_origem_id AND ativa = true
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Conta de origem não encontrada ou inativa.', NULL::UUID;
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.contas_financeiras WHERE id = p_conta_destino_id AND ativa = true) THEN
        RETURN QUERY SELECT false, 'Conta de destino não encontrada ou inativa.', NULL::UUID;
        RETURN;
    END IF;

    v_total_sair := p_valor + COALESCE(p_taxa, 0);
    IF v_origem_saldo < v_total_sair THEN
        RETURN QUERY SELECT false,
            'Saldo insuficiente na conta de origem. Disponível: R$ ' || v_origem_saldo || '. Necessário: R$ ' || v_total_sair || '.',
            NULL::UUID;
        RETURN;
    END IF;

    INSERT INTO public.financeiro_transferencias (
        data, conta_origem_id, conta_destino_id, valor, taxa,
        historico, usuario_id, usuario_nome, tenant_id
    ) VALUES (
        p_data, p_conta_origem_id, p_conta_destino_id, p_valor, p_taxa,
        COALESCE(p_historico, 'Transferência entre contas'),
        p_usuario_id, p_usuario_nome, public.current_tenant_id_safe()
    ) RETURNING id INTO v_transferencia_id;

    UPDATE public.contas_financeiras SET saldo = saldo - v_total_sair WHERE id = p_conta_origem_id;
    UPDATE public.contas_financeiras SET saldo = saldo + p_valor WHERE id = p_conta_destino_id;

    RETURN QUERY SELECT true, 'Transferência realizada com sucesso.', v_transferencia_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_atualizar_status_alocacao_tracking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  
  UPDATE alocacoes_escala SET
    metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
      'ultima_posicao', jsonb_build_object(
        'latitude', NEW.latitude,
        'longitude', NEW.longitude,
        'velocidade', NEW.velocidade,
        'captured_at', NEW.captured_at,
        'atualizado_em', NOW()
      ),
      'tracking_status', 'online'
    ),
    updated_at = NOW()
  WHERE id = NEW.alocacao_id;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_cancelar_financeiro_alocacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_os_id TEXT;
    v_os_id_uuid UUID;
    v_error_msg TEXT;
    v_updated_receber INT;
    v_updated_pagar INT;
    v_updated_pagamentos INT;
BEGIN
    IF NEW.status != 'cancelada' THEN
        RETURN NEW;
    END IF;

    IF OLD.status = 'cancelada' THEN
        RETURN NEW;
    END IF;

    v_os_id := COALESCE(NEW.ordem_servico_id::TEXT, NEW.id::TEXT);
    v_os_id_uuid := COALESCE(NEW.ordem_servico_id, NEW.id);

    BEGIN
        UPDATE public.financeiro_receber
        SET status = 'cancelada'
        WHERE os_id = v_os_id
          AND status NOT IN ('pago', 'recebido', 'cancelada');
        GET DIAGNOSTICS v_updated_receber = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        v_updated_receber := -1;
    END;

    BEGIN
        UPDATE public.financeiro_pagar
        SET status = 'cancelada'
        WHERE os_id = v_os_id
          AND status NOT IN ('pago', 'cancelada');
        GET DIAGNOSTICS v_updated_pagar = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        v_updated_pagar := -1;
    END;

    BEGIN
        UPDATE public.pagamentos_prestadores
        SET status_pagamento = 'cancelado',
            status_conferencia = 'cancelado'
        WHERE os_id = v_os_id_uuid
          AND (status_pagamento IS DISTINCT FROM 'cancelado');
        GET DIAGNOSTICS v_updated_pagamentos = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        v_updated_pagamentos := -1;
    END;

    IF v_updated_receber > 0 OR v_updated_pagar > 0 OR v_updated_pagamentos > 0 THEN
        RAISE WARNING '[CANCEL] Alocação % cancelada: receber=% pagar=% pagamentos=%',
            NEW.id, v_updated_receber, v_updated_pagar, v_updated_pagamentos;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[CANCEL-ERR] Alocação %: %', NEW.id, v_error_msg;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_event_bus_consumer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_notification JSONB;
  v_os_status TEXT;
  v_alerta_titulo TEXT;
  v_alerta_descricao TEXT;
BEGIN
  
  
  
  IF NEW.status != 'active' OR NEW.source NOT IN ('trigger', 'service') THEN
    RETURN NEW;
  END IF;

  
  
  
  
  
  IF NEW.event_type = 'os.ordem_servico.criada' THEN
    v_notification := jsonb_build_object(
      'titulo', 'Nova Ordem de Serviço',
      'mensagem', 'OS ' || COALESCE(NEW.payload->>'numero', NEW.payload->>'os_numero', '') || ' criada.',
      'tipo', 'os_criada',
      'referencia_id', NEW.entity_id,
      'event_type', NEW.event_type
    );

    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'Nova Ordem de Serviço',
      'OS ' || COALESCE(NEW.payload->>'numero', NEW.payload->>'os_numero', '') || ' criada com sucesso.',
      'os_criada',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;

    
    INSERT INTO escalonamentos_humanos (
      origem, modulo, tipo, titulo, descricao, prioridade, status, created_at
    ) VALUES (
      'trigger',
      'operacao',
      'os_criada',
      'Nova OS: ' || COALESCE(NEW.payload->>'numero', NEW.payload->>'os_numero', ''),
      'OS criada para ' || COALESCE(NEW.payload->>'cliente_nome', 'cliente'),
      'baixa',
      'pendente',
      NOW()
    );
  END IF;

  
  
  
  
  IF NEW.event_type = 'os.ordem_servico.finalizada' THEN
    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'OS Finalizada',
      'OS ' || COALESCE(NEW.payload->>'numero', NEW.payload->>'os_numero', '') || ' foi finalizada.',
      'os_finalizada',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  
  
  
  
  IF NEW.event_type = 'escala.alocacao.aceita' THEN
    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'Motorista a caminho',
      'O motorista aceitou a corrida e está a caminho da coleta.',
      'motorista_aceitou',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  
  
  
  
  IF NEW.event_type = 'escala.alocacao.concluida' THEN
    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'Entrega Realizada',
      'A entrega foi concluída. Confira os detalhes no Portal.',
      'entrega_concluida',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  
  
  
  
  IF NEW.event_type = 'entrega.comprovante.pod_enviado' THEN
    INSERT INTO portal_notificacoes (
      cliente_id, titulo, mensagem, tipo, lida, created_at
    ) VALUES (
      (NEW.payload->>'cliente_id')::UUID,
      'Comprovante de Entrega',
      'O comprovante de entrega já está disponível.',
      'comprovante_disponivel',
      false,
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  
  
  
  
  IF NEW.event_type = 'portal.ocorrencia.aberta' THEN
    v_alerta_titulo := 'Ocorrência no Portal: ' || COALESCE(NEW.payload->>'tipo', '');
    v_alerta_descricao := COALESCE(NEW.payload->>'descricao', 'Ocorrência registrada pelo cliente.');

    INSERT INTO escalonamentos_humanos (
      origem, modulo, tipo, titulo, descricao, prioridade, status, created_at
    ) VALUES (
      'portal',
      'operacao',
      'ocorrencia_cliente',
      v_alerta_titulo,
      v_alerta_descricao,
      'alta',
      'pendente',
      NOW()
    );
  END IF;

  
  
  
  
  IF NEW.event_type = 'portal.pedido.criado' THEN
    INSERT INTO escalonamentos_humanos (
      origem, modulo, tipo, titulo, descricao, prioridade, status, created_at
    ) VALUES (
      'portal',
      'comercial',
      'novo_pedido',
      'Novo Pedido: ' || COALESCE(NEW.payload->>'numero_pedido', ''),
      'Pedido criado no Portal. Aguarda processamento.',
      'media',
      'pendente',
      NOW()
    );
  END IF;

  
  
  
  
  IF NEW.event_type = 'financeiro.receber.pago' THEN
    INSERT INTO escalonamentos_humanos (
      origem, modulo, tipo, titulo, descricao, prioridade, status, created_at
    ) VALUES (
      'trigger',
      'financeiro',
      'recebimento',
      'Pagamento Recebido: R$ ' || COALESCE(ROUND((NEW.payload->>'valor')::NUMERIC, 2)::TEXT, '0,00'),
      'Cliente: ' || COALESCE(NEW.payload->>'cliente', ''),
      'baixa',
      'resolvido',
      NOW()
    );
  END IF;

  
  UPDATE public.eventos_oficiais
  SET processed_at = NOW(),
      metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('consumed_by', 'f_trg_event_bus_consumer', 'consumed_at', NOW())
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_expiracao_oportunidade()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.prazo_expiracao IS NOT NULL AND NEW.prazo_expiracao < NOW() AND NEW.status = 'publicada' THEN
    NEW.status = 'expirada';
    NEW.expirada_em = NOW();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_fatura_itens_anti_duplicidade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_os_ja_faturada uuid;
  v_status_fatura text;
BEGIN
  IF NEW.os_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_status_fatura FROM public.faturas WHERE id = NEW.fatura_id;

  -- Regra: mesmo serviço ativo não pode estar em duas faturas válidas
  -- (válidas = não canceladas). Fatura cancelada libera o serviço.
  IF v_status_fatura IS DISTINCT FROM 'cancelada' THEN
    SELECT fi.id INTO v_os_ja_faturada
    FROM public.fatura_itens fi
    JOIN public.faturas f ON f.id = fi.fatura_id
    WHERE fi.os_id = NEW.os_id
      AND fi.status = 'ativo'
      AND f.status IS DISTINCT FROM 'cancelada'
      AND fi.fatura_id IS DISTINCT FROM NEW.fatura_id
    LIMIT 1;

    IF v_os_ja_faturada IS NOT NULL THEN
      RAISE EXCEPTION 'SERVIÇO_JA_FATURADO: A OS % já está vinculada a outra fatura ativa.', NEW.os_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_fatura_itens_bloqueio_emissao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.faturas WHERE id = NEW.fatura_id;
  IF v_status IN ('emitida','cancelada') THEN
    RAISE EXCEPTION 'FATURA_BLOQUEADA: Não é permitido alterar itens de fatura % (status %). Use cancelamento/correção controlada.', v_status, v_status;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_impedir_duplicidade_pedido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'programado' AND OLD.status IN ('programado', 'processando') THEN
    RAISE EXCEPTION 'Pedido já foi processado (status %)', OLD.status;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_notificar_oportunidade_rede()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'publicada' THEN
    INSERT INTO public.portal_notificacoes (
      prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at, metadata
    ) SELECT
      p.id,
      'Nova oportunidade na Rede',
      format('Nova oportunidade #%s disponível na sua região.', UPPER(SUBSTRING(NEW.os_id::TEXT, 1, 8))),
      'nova_oportunidade',
      NEW.id,
      'rede_oportunidades',
      false,
      NOW(),
      jsonb_build_object('regiao', NEW.regiao, 'valor', NEW.valor_prestador)
    FROM public.prestadores p
    WHERE p.status = 'ativo'
      AND (NEW.regiao IS NULL OR p.regiao_principal ILIKE '%' || COALESCE(NEW.regiao, '') || '%')
    LIMIT 50; -- Evitar explosão de notificações
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_notificar_os_para_app()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.prestador IS NOT NULL AND (OLD IS NULL OR OLD.prestador IS DISTINCT FROM NEW.prestador) THEN
    INSERT INTO public.portal_notificacoes (
      prestador_id, titulo, mensagem, tipo, origem_id, origem_tipo, lida, created_at
    ) VALUES (
      NEW.prestador,
      'Nova operação',
      format('Nova OS %s atribuída a você.', COALESCE(NEW.numero, SUBSTRING(NEW.id::TEXT, 1, 8))),
      'nova_os',
      NEW.id,
      'ordens_servico',
      false,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_novo_candidato_evento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_automacao_id UUID;
BEGIN
  -- Verificar se existe automação ativa do tipo 'notifcacao' (novo candidato)
  SELECT id INTO v_automacao_id
  FROM public.recrutamento_automacoes
  WHERE tipo = 'notificacao' AND status = 'ativa'
  LIMIT 1;

  -- Se não há automação ativa, apenas retorna (sem bloquear INSERT)
  IF v_automacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Inserir evento no Event Bus (best-effort — não bloqueia o cadastro)
  BEGIN
    INSERT INTO public.eventos_oficiais (
      event_type, entity_type, entity_id, payload, source, visibility
    ) VALUES (
      'recrutamento.candidato.criado',
      'recrutamento_candidatos',
      NEW.id,
      jsonb_build_object(
        'candidato_id', NEW.id,
        'nome', NEW.nome,
        'telefone', NEW.telefone,
        'cidade', NEW.cidade,
        'uf', NEW.uf,
        'stage', NEW.stage,
        'score', NEW.score,
        'automacao_id', v_automacao_id
      ),
      'trigger_db',
      'internal'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'REC-06.2C.1 [novo_candidato]: falha ao inserir evento: %', SQLERRM;
  END;

  -- NÃO atualizar contadores aqui — eventProcessorWorker atualiza após processamento
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_propagar_financeiro_alocacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE
  v_cliente_nome TEXT; v_prestador_nome TEXT; v_prestador_doc TEXT;
  v_os_id UUID; v_os_numero TEXT; v_data_venc_30 DATE;
  v_valor_cliente NUMERIC; v_valor_prestador NUMERIC;
  v_pedagio_valor NUMERIC; v_adicional_valor NUMERIC;
  v_ajudante_valor NUMERIC; v_desconto_valor NUMERIC;
  v_outros_custos NUMERIC; v_valor_liquido NUMERIC;
  v_is_concluida BOOLEAN; v_error_msg TEXT;
  v_fallback_cliente TEXT; v_fallback_prestador TEXT;
  v_status_financeiro TEXT;
  v_reversa_cliente NUMERIC; v_reversa_prestador NUMERIC;
  v_execucao_id UUID;
BEGIN
  v_execucao_id := gen_random_uuid();
  IF NEW.status = 'cancelada' THEN RETURN NEW; END IF;
  BEGIN
    v_valor_cliente := COALESCE(NEW.valor_frete, 0);
    v_valor_prestador := COALESCE(NEW.valor_repasse, 0);
    v_pedagio_valor := COALESCE(NEW.valor_pedagio, 0);
    v_adicional_valor := COALESCE(NEW.valor_adicional, 0);
    v_ajudante_valor := COALESCE(NEW.valor_ajudante, 0);
    v_desconto_valor := COALESCE(NEW.valor_desconto_prestador, 0);
    v_reversa_cliente := COALESCE(NEW.reversa_valor_cliente, 0);
    v_reversa_prestador := COALESCE(NEW.reversa_valor_prestador, 0);
    IF v_valor_cliente = 0 AND v_valor_prestador = 0 AND v_reversa_cliente = 0 AND v_reversa_prestador = 0 THEN RETURN NEW; END IF;
    v_valor_cliente := v_valor_cliente + v_reversa_cliente;
    v_valor_prestador := v_valor_prestador + v_reversa_prestador;
    v_fallback_cliente := COALESCE(NEW.cliente_id::TEXT, 'cliente_nao_informado');
    v_fallback_prestador := COALESCE(NEW.prestador_id::TEXT, 'prestador_nao_informado');
    BEGIN
      SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || v_fallback_cliente) INTO STRICT v_cliente_nome FROM clientes c WHERE c.id = NEW.cliente_id;
    EXCEPTION WHEN OTHERS THEN v_cliente_nome := 'Cliente #' || v_fallback_cliente; END;
    BEGIN
      SELECT COALESCE(p.nome_completo, 'Prestador #' || v_fallback_prestador), COALESCE(p.cpf_cnpj, '') INTO STRICT v_prestador_nome, v_prestador_doc FROM prestadores p WHERE p.id = NEW.prestador_id;
    EXCEPTION WHEN OTHERS THEN v_prestador_nome := 'Prestador #' || v_fallback_prestador; v_prestador_doc := ''; END;
    v_data_venc_30 := CURRENT_DATE + 30;
    v_is_concluida := (NEW.status = 'concluida' AND NEW.finalizada = true);
    v_status_financeiro := CASE WHEN v_is_concluida THEN 'aberto' ELSE 'pendente' END;
    IF NEW.ordem_servico_id IS NOT NULL THEN
      v_os_id := NEW.ordem_servico_id;
      v_os_numero := 'OS-ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    ELSE
      v_os_id := NEW.id;
      v_os_numero := 'ALOC-' || TO_CHAR(COALESCE(NEW.data_escala, CURRENT_DATE), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
    END IF;
    v_outros_custos := v_adicional_valor + v_ajudante_valor - v_desconto_valor;
    v_valor_liquido := v_valor_prestador + v_pedagio_valor + v_outros_custos;
    -- OS (preservado do comportamento pré-02B; casts corrigidos para schema real)
    BEGIN
      INSERT INTO ordens_servico (id, numero, cliente, cliente_id, prestador, prestador_id, status, data, tipo_veiculo, origem, destino, valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos, tipo_reversa, reversa_qtd_volumes, observacoes_gerais, created_at, updated_at)
      VALUES (v_os_id, v_os_numero, NEW.cliente_id, v_cliente_nome, NEW.prestador_id, v_prestador_nome, CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END, COALESCE(NEW.data_escala, CURRENT_DATE), NEW.tipo_veiculo, NEW.origem, NEW.destino, v_valor_cliente, v_valor_prestador, v_pedagio_valor, to_jsonb(v_adicional_valor), to_jsonb(v_ajudante_valor), v_desconto_valor, NEW.tipo_reversa, NEW.reversa_qtd_volumes, NEW.observacoes, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET status = CASE WHEN v_is_concluida THEN 'finalizada' ELSE 'pendente' END, valor_cliente = v_valor_cliente, custo_prestador = v_valor_prestador, tipo_reversa = COALESCE(NEW.tipo_reversa, ordens_servico.tipo_reversa), updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN NULL; END;
    -- Receber
    IF v_valor_cliente > 0 AND NEW.cliente_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_receber (os_id, descricao, valor, data_vencimento, status, cliente, cliente_nome, cliente_id)
        VALUES (v_os_id::TEXT, 'Faturamento ' || v_os_numero || CASE WHEN v_reversa_cliente > 0 THEN ' (c/ reversa)' ELSE '' END, v_valor_cliente, v_data_venc_30, v_status_financeiro, v_cliente_nome, v_cliente_nome, NEW.cliente_id)
        ON CONFLICT (os_id) DO UPDATE SET valor = v_valor_cliente, status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_receber.status = 'aberto' THEN 'aberto' ELSE 'pendente' END, data_vencimento = v_data_venc_30;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    -- Pagar (CORREÇÃO: valor = v_valor_liquido)
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO financeiro_pagar (os_id, descricao, valor, data_vencimento, status, prestador, fornecedor_id, fornecedor_nome, desconto)
        VALUES (v_os_id::TEXT, 'Repasse ' || v_os_numero || CASE WHEN v_reversa_prestador > 0 THEN ' (c/ reversa)' ELSE '' END, v_valor_liquido, v_data_venc_30, v_status_financeiro, v_prestador_nome, NEW.prestador_id, v_prestador_nome, v_desconto_valor)
        ON CONFLICT (os_id) DO UPDATE SET valor = v_valor_liquido, status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_pagar.status = 'aberto' THEN 'aberto' ELSE 'pendente' END, data_vencimento = v_data_venc_30, fornecedor_id = NEW.prestador_id, fornecedor_nome = v_prestador_nome, desconto = v_desconto_valor, prestador = v_prestador_nome;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    -- Pagamentos prestadores
    IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
      BEGIN
        INSERT INTO pagamentos_prestadores (prestador_id, prestador_nome, prestador_documento, os_id, valor_liquido, valor_servicos, pedagio, adicionais, status_conferencia, status_pagamento, origem_lancamento, quantidade_os, periodo_inicio, periodo_fim, categoria_financeira, data_prevista_pagamento, competencia, impacto_dre, impacto_fluxo_caixa)
        VALUES (NEW.prestador_id, v_prestador_nome, v_prestador_doc, v_os_id, v_valor_liquido, v_valor_prestador, v_pedagio_valor, v_outros_custos, CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END, CASE WHEN v_is_concluida THEN 'pendente' ELSE 'nao_vencido' END, 'escala_direta', 1, COALESCE(NEW.data_escala, CURRENT_DATE), COALESCE(NEW.data_escala, CURRENT_DATE), 'Custo Logistico', v_data_venc_30, COALESCE(NEW.data_escala, CURRENT_DATE), true, true)
        ON CONFLICT (os_id) DO UPDATE SET valor_liquido = v_valor_liquido, valor_servicos = v_valor_prestador, status_conferencia = CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END, prestador_id = NEW.prestador_id, prestador_nome = v_prestador_nome, prestador_documento = COALESCE(v_prestador_doc, '');
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    -- Composicao
    IF v_is_concluida AND v_valor_cliente > 0 THEN
      DECLARE v_imp NUMERIC; v_seg NUMERIC; v_mb NUMERIC; v_ml NUMERIC; BEGIN
        v_imp := ROUND(v_valor_cliente * 4.5 / 100, 2);
        v_seg := ROUND(v_valor_cliente * 0.01, 2);
        v_mb := v_valor_cliente - v_valor_prestador - v_pedagio_valor - v_outros_custos;
        v_ml := v_mb - v_imp - v_seg;
        INSERT INTO composicao_financeira_os (os_id, cliente_id, prestador_id, valor_cliente, valor_prestador, imposto_percentual, imposto_valor, seguro_valor, pedagio_valor, outros_custos, combustivel_valor, ajudante_valor, adicional_valor, desconto_valor, margem_bruta, margem_liquida, percentual_margem_bruta, percentual_margem_liquida, origem_calculo)
        VALUES (v_os_id, NEW.cliente_id, NEW.prestador_id, v_valor_cliente, v_valor_prestador, 4.5, v_imp, v_seg, v_pedagio_valor, v_outros_custos, 0, v_ajudante_valor, v_adicional_valor, v_desconto_valor, v_mb, v_ml, CASE WHEN v_valor_cliente > 0 THEN ROUND(v_mb / v_valor_cliente * 100, 2) ELSE 0 END, CASE WHEN v_valor_cliente > 0 THEN ROUND(v_ml / v_valor_cliente * 100, 2) ELSE 0 END, 'escala_direta')
        ON CONFLICT (os_id) DO UPDATE SET valor_cliente = v_valor_cliente, valor_prestador = v_valor_prestador, margem_bruta = v_mb, margem_liquida = v_ml;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;
    RAISE WARNING '[M108F] Erro (alocacao %): %', NEW.id, v_error_msg;
    RETURN NEW;
  END;
END;

$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_propagar_financeiro_os()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente_nome       TEXT;
  v_prestador_nome     TEXT;
  v_prestador_doc      TEXT;
  v_data_venc_30       DATE;
  v_valor_cliente      NUMERIC;
  v_valor_prestador    NUMERIC;
  v_outros_custos      NUMERIC;
  v_valor_liquido      NUMERIC;
  v_margem_bruta       NUMERIC;
  v_margem_liquida     NUMERIC;
  v_imposto_valor      NUMERIC;
  v_seguro_valor       NUMERIC;
  v_is_finalizada      BOOLEAN;
BEGIN
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  v_valor_cliente   := COALESCE(NEW.valor_cliente, 0);
  v_valor_prestador := COALESCE(NEW.custo_prestador, 0);

  IF v_valor_cliente = 0 AND v_valor_prestador = 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT COALESCE(c.nome_fantasia, c.razao_social, 'Cliente #' || NEW.cliente_id)
      INTO STRICT v_cliente_nome
      FROM clientes c WHERE c.id = NEW.cliente;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      v_cliente_nome := COALESCE(NEW.cliente::TEXT, 'Cliente #' || NEW.cliente_id);
    WHEN OTHERS THEN
      v_cliente_nome := COALESCE(NEW.cliente::TEXT, NEW.cliente_id, 'Cliente');
  END;

  BEGIN
    SELECT COALESCE(p.nome_completo, 'Prestador #' || NEW.prestador_id),
           COALESCE(p.cpf_cnpj, '')
      INTO STRICT v_prestador_nome, v_prestador_doc
      FROM prestadores p WHERE p.id = NEW.prestador;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      v_prestador_nome := COALESCE(NEW.prestador::TEXT, 'Prestador #' || NEW.prestador_id);
      v_prestador_doc := '';
    WHEN OTHERS THEN
      v_prestador_nome := COALESCE(NEW.prestador::TEXT, NEW.prestador_id, 'Prestador');
      v_prestador_doc := '';
  END;

  v_data_venc_30  := CURRENT_DATE + 30;
  v_is_finalizada := (NEW.status = 'finalizada');

  v_outros_custos := COALESCE(
      (CASE
        WHEN NEW.adicionais IS NULL THEN 0
        WHEN jsonb_typeof(NEW.adicionais) = 'number' THEN (NEW.adicionais #>> '{}')::NUMERIC
        ELSE COALESCE((NEW.adicionais->>'valor')::NUMERIC, 0)
      END), 0
    )
    + COALESCE(
      (CASE
        WHEN NEW.ajudante IS NULL THEN 0
        WHEN jsonb_typeof(NEW.ajudante) = 'number' THEN (NEW.ajudante #>> '{}')::NUMERIC
        ELSE COALESCE((NEW.ajudante->>'valor')::NUMERIC, 0)
      END), 0
    )
    - COALESCE(NEW.descontos, 0);

  v_valor_liquido := v_valor_prestador
                   + COALESCE(NEW.pedagio, 0)
                   + v_outros_custos;

  -- 1. financeiro_receber
  IF v_valor_cliente > 0 THEN
    PERFORM 1 FROM financeiro_receber WHERE os_id = NEW.id::TEXT LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO financeiro_receber (
        os_id, descricao, valor, data_vencimento, status,
        cliente, cliente_nome, cliente_id
      ) VALUES (
        NEW.id::TEXT,
        'Faturamento ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
        v_valor_cliente,
        v_data_venc_30,
        CASE WHEN v_is_finalizada THEN 'aberto' ELSE 'pendente' END,
        v_cliente_nome,
        v_cliente_nome,
        NEW.cliente
      );
    ELSE
      UPDATE financeiro_receber SET
        valor          = v_valor_cliente,
        cliente        = v_cliente_nome,
        cliente_nome   = v_cliente_nome,
        cliente_id     = NEW.cliente,
        status         = CASE WHEN v_is_finalizada THEN 'aberto'
                              WHEN financeiro_receber.status = 'aberto' THEN 'aberto'
                              ELSE 'pendente' END,
        descricao      = 'Faturamento ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
        data_vencimento = v_data_venc_30,
        updated_at     = NOW()
      WHERE os_id = NEW.id::TEXT;
    END IF;
  END IF;

  -- 2. financeiro_pagar (CORREÇÃO: valor = v_valor_liquido)
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    PERFORM 1 FROM financeiro_pagar WHERE os_id = NEW.id::TEXT LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO financeiro_pagar (
        os_id, descricao, valor, data_vencimento, status,
        prestador, fornecedor_id, fornecedor_nome
      ) VALUES (
        NEW.id::TEXT,
        'Repasse ' || COALESCE(NEW.numero, 'OS#' || SUBSTRING(NEW.id::TEXT, 1, 8)),
        v_valor_liquido,
        v_data_venc_30,
        CASE WHEN v_is_finalizada THEN 'aberto' ELSE 'pendente' END,
        v_prestador_nome,
        NEW.prestador,
        v_prestador_nome
      );
    ELSE
      UPDATE financeiro_pagar SET
        valor          = v_valor_liquido,
        prestador      = v_prestador_nome,
        fornecedor_id  = NEW.prestador,
        fornecedor_nome = v_prestador_nome,
        status         = CASE WHEN v_is_finalizada THEN 'aberto'
                              WHEN financeiro_pagar.status = 'aberto' THEN 'aberto'
                              ELSE 'pendente' END,
        data_vencimento = v_data_venc_30,
        updated_at     = NOW()
      WHERE os_id = NEW.id::TEXT;
    END IF;
  END IF;

  -- 3. pagamentos_prestadores
  IF v_valor_prestador > 0 AND NEW.prestador_id IS NOT NULL THEN
    PERFORM 1 FROM pagamentos_prestadores WHERE os_id = NEW.id LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO pagamentos_prestadores (
        prestador_id, prestador_nome, prestador_documento,
        os_id, qtd_os,
        valor_liquido, valor_servicos, pedagio, adicionais,
        status_conferencia, status_pagamento,
        origem_lancamento, quantidade_os,
        categoria_financeira, data_prevista_pagamento,
        competencia, impacto_dre, impacto_fluxo_caixa,
        periodo_inicio, periodo_fim
      ) VALUES (
        NEW.prestador,
        v_prestador_nome,
        COALESCE(v_prestador_doc, ''),
        NEW.id,
        1,
        v_valor_liquido,
        v_valor_prestador,
        COALESCE(NEW.pedagio, 0),
        v_outros_custos,
        'em_aberto',
        'pendente',
        'os_direta',
        1,
        'Custo Logístico',
        v_data_venc_30,
        CURRENT_DATE,
        true, true,
        CURRENT_DATE, CURRENT_DATE
      );
    ELSE
      UPDATE pagamentos_prestadores SET
        prestador_id        = NEW.prestador,
        prestador_nome      = v_prestador_nome,
        prestador_documento = COALESCE(v_prestador_doc, ''),
        valor_liquido       = v_valor_liquido,
        valor_servicos      = v_valor_prestador,
        pedagio             = COALESCE(NEW.pedagio, 0),
        adicionais          = v_outros_custos,
        status_conferencia  = 'em_aberto',
        competencia         = CURRENT_DATE,
        updated_at          = NOW()
      WHERE os_id = NEW.id;
    END IF;
  END IF;

    -- 4. composicao_financeira_os (apenas na finalização)
    IF v_is_finalizada AND v_valor_cliente > 0 THEN
      v_imposto_valor  := ROUND(v_valor_cliente * 4.5 / 100, 2);
      v_seguro_valor   := ROUND(v_valor_cliente * 0.01, 2);
      v_margem_bruta   := v_valor_cliente
                        - v_valor_prestador
                        - COALESCE(NEW.pedagio, 0)
                        - v_outros_custos;
      v_margem_liquida := v_margem_bruta - v_imposto_valor - v_seguro_valor;

      PERFORM 1 FROM composicao_financeira_os WHERE os_id = NEW.id LIMIT 1;
      IF NOT FOUND THEN
        INSERT INTO composicao_financeira_os (
        os_id, cliente_id, prestador_id,
        valor_cliente, valor_prestador,
        imposto_percentual, imposto_valor, seguro_valor,
        pedagio_valor, outros_custos,
        margem_bruta, margem_liquida,
        percentual_margem_bruta, percentual_margem_liquida,
        origem_calculo
      ) VALUES (
        NEW.id,
        NEW.cliente,
        NEW.prestador,
        v_valor_cliente,
        v_valor_prestador,
        4.5,
        v_imposto_valor,
        v_seguro_valor,
        COALESCE(NEW.pedagio, 0),
        v_outros_custos,
        v_margem_bruta,
        v_margem_liquida,
        CASE WHEN v_valor_cliente > 0
             THEN ROUND(v_margem_bruta / v_valor_cliente * 100, 2)
             ELSE 0 END,
        CASE WHEN v_valor_cliente > 0
             THEN ROUND(v_margem_liquida / v_valor_cliente * 100, 2)
             ELSE 0 END,
        'os_direta'
      );
    ELSE
      UPDATE composicao_financeira_os SET
        valor_cliente              = v_valor_cliente,
        valor_prestador            = v_valor_prestador,
        imposto_percentual         = 4.5,
        imposto_valor              = v_imposto_valor,
        seguro_valor               = v_seguro_valor,
        pedagio_valor              = COALESCE(NEW.pedagio, 0),
        outros_custos              = v_outros_custos,
        margem_bruta               = v_margem_bruta,
        margem_liquida             = v_margem_liquida,
        percentual_margem_bruta    = CASE WHEN v_valor_cliente > 0
                                          THEN ROUND(v_margem_bruta / v_valor_cliente * 100, 2)
                                          ELSE 0 END,
        percentual_margem_liquida  = CASE WHEN v_valor_cliente > 0
                                          THEN ROUND(v_margem_liquida / v_valor_cliente * 100, 2)
                                          ELSE 0 END,
        origem_calculo             = 'os_direta'
      WHERE os_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_rede_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_score_limiar_evento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_automacao RECORD;
  v_limiar INT;
  v_eventos_inseridos INT := 0;
BEGIN
  -- Só processa se score mudou
  IF OLD.score IS NOT DISTINCT FROM NEW.score THEN
    RETURN NEW;
  END IF;

  -- Para cada automação ativa do tipo 'score'
  FOR v_automacao IN
    SELECT id, trigger
    FROM public.recrutamento_automacoes
    WHERE tipo = 'score' AND status = 'ativa'
  LOOP
    -- Extrair limiar do JSONB trigger
    v_limiar := (v_automacao.trigger->>'score_min')::INT;

    -- Se limiar não configurado ou inválido, skip
    IF v_limiar IS NULL OR v_limiar < 0 OR v_limiar > 100 THEN
      CONTINUE;
    END IF;

    -- Condição de cruzamento: OLD < limiar AND NEW >= limiar
    IF COALESCE(OLD.score, 0) < v_limiar AND NEW.score >= v_limiar THEN
      BEGIN
        INSERT INTO public.eventos_oficiais (
          event_type, entity_type, entity_id, payload, source, visibility
        ) VALUES (
          'recrutamento.score.limiar_cruzado',
          'recrutamento_candidatos',
          NEW.id,
          jsonb_build_object(
            'candidato_id', NEW.id,
            'nome', NEW.nome,
            'score_anterior', OLD.score,
            'score_novo', NEW.score,
            'limiar_configurado', v_limiar,
            'classificacao', NEW.classificacao_comprometimento,
            'automacao_id', v_automacao.id
          ),
          'trigger_db',
          'internal'
        );
        v_eventos_inseridos := v_eventos_inseridos + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'REC-06.2C.1 [score_limiar]: falha ao inserir evento: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  -- NÃO atualizar contadores aqui — eventProcessorWorker atualiza após processamento
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_trg_tracking_iniciado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    DECLARE
      v_count INT;
    BEGIN
      SELECT COUNT(*) INTO v_count 
        FROM portal_tracking_realtime 
        WHERE alocacao_id = NEW.alocacao_id;
      
      IF v_count = 1 THEN
        INSERT INTO eventos_oficiais (
          tenant_id, event_type, entity_type, entity_id,
          status, source, visibility, payload, metadata
        ) VALUES (
          COALESCE(NEW.tenant_id, current_tenant_id_safe()),
          'tracking.iniciado',
          'alocacao',
          NEW.alocacao_id,
          'pendente',
          'sistema',
          'public',
          jsonb_build_object(
            'title', 'Rastreamento iniciado',
            'description', 'Motorista começou a transmitir localização'
          ),
          jsonb_build_object(
            'alocacao_id', NEW.alocacao_id,
            'prestador_id', NEW.prestador_id,
            'os_id', NEW.os_id,
            'latitude', NEW.latitude,
            'longitude', NEW.longitude
          )
        );
      END IF;
      RETURN NEW;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.f_trg_validade_documento_evento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_automacao_id UUID;
  v_doc JSONB;
  v_nome TEXT;
  v_validade DATE;
  v_dias INTEGER;
  v_documento_status TEXT;
BEGIN
  -- Verificar se existe automação ativa do tipo 'validade_documento'
  SELECT id INTO v_automacao_id
  FROM public.recrutamento_automacoes
  WHERE tipo = 'validade_documento' AND status = 'ativa'
  LIMIT 1;

  -- Se não há automação ativa, retorna
  IF v_automacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Iterar documentos do array JSONB
  IF NEW.documentos IS NOT NULL AND jsonb_typeof(NEW.documentos) = 'array' THEN
    FOR v_doc IN SELECT jsonb_array_elements(NEW.documentos)
    LOOP
      v_nome := v_doc->>'nome';
      v_documento_status := v_doc->>'status';

      -- Pular se não tem data de validade
      BEGIN
        v_validade := (v_doc->>'dataValidade')::DATE;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;

      IF v_validade IS NULL THEN
        CONTINUE;
      END IF;

      v_dias := v_validade - CURRENT_DATE;

      -- Documento vencido (dias < 0) ou próximo do vencimento (≤30 dias)
      IF v_dias <= 30 THEN
        BEGIN
          INSERT INTO public.eventos_oficiais (
            event_type, entity_type, entity_id, payload, source, visibility
          ) VALUES (
            'recrutamento.documento.vencimento_proximo',
            'recrutamento_candidatos',
            NEW.id,
            jsonb_build_object(
              'candidato_id', NEW.id,
              'nome_candidato', NEW.nome,
              'tipo_documento', v_nome,
              'validade', v_validade::TEXT,
              'dias_para_vencer', v_dias,
              'status_documento', v_documento_status,
              'ja_vencido', v_dias < 0,
              'automacao_id', v_automacao_id
            ),
            'trigger_db',
            'internal'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'REC-06.2C.1 [validade_doc]: falha ao inserir evento: %', SQLERRM;
        END;
      END IF;
    END LOOP;
  END IF;

  -- NÃO atualizar contadores aqui — eventProcessorWorker atualiza após processamento
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.f_usuario_pode_acessar_cliente(p_cliente_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
        DECLARE v_tenant_id uuid; v_papel text;
        BEGIN
          SELECT tu.tenant_id, COALESCE(tu.papel, '') INTO v_tenant_id, v_papel
          FROM public.tenant_usuarios tu WHERE tu.user_id = auth.uid();
          IF v_tenant_id IS NULL THEN RETURN false; END IF;
          IF v_papel IN ('super_admin', 'admin') THEN RETURN true; END IF;
          IF EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = p_cliente_id AND c.tenant_id = v_tenant_id)
          THEN RETURN true; END IF;
          RETURN false;
        END; $function$
;

CREATE OR REPLACE FUNCTION public.f_usuario_pode_acessar_tenant(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_papel text;
BEGIN
  SELECT tu.tenant_id, COALESCE(tu.papel, '') INTO v_tenant_id, v_papel
  FROM public.tenant_usuarios tu
  WHERE tu.user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  -- super_admin/admin liberados (padrão atual do projeto)
  IF v_papel IN ('super_admin', 'admin') THEN
    RETURN true;
  END IF;

  -- demais usuários: somente no próprio tenant; tenant nulo vira o próprio
  RETURN COALESCE(p_tenant_id, v_tenant_id) = v_tenant_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_rascunhos_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fornecedores_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.gerar_numero_contrato()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  proximo_numero integer;
  numero_final text;
begin
  select coalesce(count(*), 0) + 1
  into proximo_numero
  from public.contratos_gerados;

  numero_final := 'CTR-' || extract(year from now())::text || '-' || lpad(proximo_numero::text, 6, '0');

  return numero_final;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gerar_numero_contrato_operacao()
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
    DECLARE ano TEXT; proximo INTEGER;
    BEGIN
      ano := EXTRACT(YEAR FROM NOW())::TEXT;
      SELECT COALESCE(MAX(NULLIF(SUBSTRING(numero FROM 10 FOR 6), '')::INTEGER), 0) + 1 INTO proximo
        FROM public.contratos_operacao WHERE numero LIKE 'CTR-OP-' || ano || '-%';
      RETURN 'CTR-OP-' || ano || '-' || LPAD(proximo::TEXT, 6, '0');
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.gerar_numero_pedido()
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    ano text;
    proximo_numero integer;
    numero_formatado text;
BEGIN
    ano := EXTRACT(YEAR FROM now())::text;
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN numero_pedido ~ ('^PED-' || ano || '-[0-9]{6}$')
            THEN NULLIF(SUBSTRING(numero_pedido FROM 8 FOR 6), '')::integer
            ELSE NULL
        END
    ), 0) + 1
    INTO proximo_numero
    FROM public.portal_pedidos
    WHERE numero_pedido LIKE 'PED-' || ano || '-%';
    
    numero_formatado := 'PED-' || ano || '-' || LPAD(proximo_numero::text, 6, '0');
    RETURN numero_formatado;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN NULLIF(current_setting('app.tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.listar_usuarios_vinculados(p_cliente_id uuid)
 RETURNS TABLE(id uuid, auth_user_id uuid, email text, ativo boolean, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT
    uc.id,
    uc.auth_user_id,
    au.email,
    uc.ativo,
    uc.created_at
  FROM public.usuarios_cliente uc
  JOIN auth.users au ON au.id = uc.auth_user_id
  WHERE uc.cliente_id = p_cliente_id AND uc.ativo = true;
$function$
;

CREATE OR REPLACE FUNCTION public.notificar_xml_recebido()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Future: quando um anexo XML for recebido por contato@ ou operacional@,
  -- este trigger ser?? chamado para criar tarefa para o Fiscal IA.
  -- Exemplo de uso futuro:
  --
  -- INSERT INTO automacoes_tarefas (robo_id, setor, tipo_tarefa, titulo, descricao, prioridade, payload)
  -- VALUES (
  --   (SELECT id FROM automacoes_robos WHERE setor = 'Fiscal' LIMIT 1),
  --   'Fiscal',
  --   'analise_xml',
  --   'XML recebido - ' || COALESCE(NEW.remetente, 'desconhecido'),
  --   'Documento XML recebido para an??lise fiscal. Anexo: ' || COALESCE(NEW.nome_arquivo, 'N/A'),
  --   'alta',
  --   jsonb_build_object('anexo_id', NEW.id, 'conteudo', NEW.conteudo_xml, 'remetente', NEW.remetente)
  -- );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.obter_cliente_id_do_usuario()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
    DECLARE v_cliente_id uuid;
    BEGIN
      SELECT uc.cliente_id INTO v_cliente_id
      FROM public.usuarios_cliente uc WHERE uc.auth_user_id = auth.uid() LIMIT 1;
      RETURN v_cliente_id;
    END; $function$
;

CREATE OR REPLACE FUNCTION public.ocorrencias_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pull_automacoes_pendentes(limit_num integer DEFAULT 20)
 RETURNS SETOF automacoes_fila
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.recuperar_rotinas_travadas()
 RETURNS TABLE(rotina_id uuid, execucao_id uuid, minutos_travado numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    BEGIN
      RETURN QUERY
      WITH travadas AS (
        SELECT re.rotina_id, re.id AS execucao_id,
               EXTRACT(EPOCH FROM (now() - re.started_at)) / 60 AS minutos
        FROM rotinas_execucoes_ia re
        WHERE re.status = 'running'
          AND re.started_at < now() - interval '5 minutes'
      )
      UPDATE rotinas_execucoes_ia re
      SET status = 'error',
          erro = 'Timeout automático: execução travada por mais de 5 minutos',
          logs = COALESCE(re.logs, '') || E'
[' || now()::text || '] TIMEOUT: execução travada',
          finished_at = now()
      FROM travadas t
      WHERE re.id = t.execucao_id;

      RETURN QUERY
      UPDATE rotinas_ia r
      SET status = 'error'::text::status_rotina_ia
      FROM travadas t
      WHERE r.id = t.rotina_id
        AND r.status = 'running'::text::status_rotina_ia;

      RETURN QUERY
      SELECT t.rotina_id, t.execucao_id, t.minutos
      FROM travadas t;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.recusar_viagem(token_acesso text, escala_id uuid, motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    UPDATE escala_operacional
    SET status = 'recusado', observacoes = motivo, atualizado_em = now()
    WHERE id = escala_id AND prestador_id = motorista_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_checkin_motorista(token_acesso text, escala_id uuid, tipo text, latitude numeric, longitude numeric, observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    INSERT INTO motorista_checkins (
        prestador_id,
        escala_id,
        tipo,
        latitude,
        longitude,
        observacao,
        created_at
    ) VALUES (
        motorista_id,
        escala_id,
        tipo,
        latitude,
        longitude,
        observacao,
        now()
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_historico_alocacao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Apenas registra se o status mudou
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id,
            evento,
            status_anterior,
            status_novo,
            descricao,
            payload,
            created_by
        ) VALUES (
            NEW.id,
            'mudanca_status',
            OLD.status,
            NEW.status,
            'Status alterado de ' || OLD.status || ' para ' || NEW.status,
            jsonb_build_object(
                'status_anterior', OLD.status,
                'status_novo', NEW.status,
                'updated_by', NEW.updated_by
            ),
            NEW.updated_by
        );
    END IF;
    
    -- Registra aceite do prestador
    IF (TG_OP = 'UPDATE' AND OLD.aceite_prestador = false AND NEW.aceite_prestador = true) THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id,
            evento,
            descricao,
            payload,
            created_by
        ) VALUES (
            NEW.id,
            'aceite_prestador',
            'Prestador aceitou a alocação',
            jsonb_build_object(
                'prestador_id', NEW.prestador_id,
                'data_aceite', NEW.data_aceite
            ),
            NEW.updated_by
        );
    END IF;
    
    -- Registra finalização
    IF (TG_OP = 'UPDATE' AND OLD.finalizada = false AND NEW.finalizada = true) THEN
        INSERT INTO public.historico_alocacoes_escala (
            alocacao_id,
            evento,
            descricao,
            payload,
            created_by
        ) VALUES (
            NEW.id,
            'finalizacao',
            'Alocação finalizada',
            jsonb_build_object(
                'data_finalizacao', NEW.data_finalizacao,
                'km_realizados', NEW.km_realizados,
                'tempo_total_minutos', NEW.tempo_total_minutos
            ),
            NEW.updated_by
        );
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_localizacao_motorista(token_acesso text, escala_id uuid, latitude numeric, longitude numeric, velocidade numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    INSERT INTO operacao_localizacao (
        escala_id,
        latitude,
        longitude,
        velocidade,
        status,
        atualizado_em,
        origem
    ) VALUES (
        escala_id,
        latitude,
        longitude,
        velocidade,
        'em_rota',
        now(),
        'driver_app'
    );
    -- Also update escala_operacional for realtime panel
    UPDATE escala_operacional SET status = 'em_rota', atualizado_em = now() WHERE id = escala_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_posicao_motorista(p_latitude numeric, p_longitude numeric, p_alocacao_id uuid, p_ordem_servico_id uuid DEFAULT NULL::uuid, p_captured_at timestamp with time zone DEFAULT now(), p_precisao numeric DEFAULT 0, p_velocidade numeric DEFAULT 0, p_direcao numeric DEFAULT 0, p_bateria numeric DEFAULT NULL::numeric, p_altitude numeric DEFAULT NULL::numeric, p_status_operacional text DEFAULT 'em_deslocamento'::text, p_origem text DEFAULT 'app_motorista'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_prestador_id UUID;
    v_tenant_id UUID;
    v_alocacao_status TEXT;
    v_alocacao_prestador_id UUID;
    v_alocacao_tenant_id UUID;
    v_os_id UUID;
    v_cliente_id UUID;
    v_veiculo_id UUID;
    v_last_pos RECORD;
    v_tracking_id UUID;
    v_is_first BOOLEAN := false;
BEGIN
    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 1: usuário autenticado
    -- ══════════════════════════════════════════════════════════════════════
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'USUARIO_NAO_AUTENTICADO',
            'error_code', 'UNAUTHENTICATED',
            'message', 'Usuário não autenticado. Faça login novamente.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 2: prestador existe e está autorizado
    -- Resolve SOMENTE o prestador (tenant vem da alocação — coluna real)
    -- ══════════════════════════════════════════════════════════════════════
    SELECT id INTO v_prestador_id
    FROM public.prestadores
    WHERE auth_user_id = auth.uid()
      AND status = 'ativo'
      AND liberado_app = true;

    IF v_prestador_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'PRESTADOR_NAO_VINCULADO',
            'error_code', 'PRESTADOR_NOT_FOUND',
            'message', 'Prestador não encontrado ou não autorizado.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 3: alocação existe + resolução de relacionamentos reais
    -- (tenant_id da alocação — coluna existente; os_id/cliente_id derivados)
    -- ══════════════════════════════════════════════════════════════════════
    SELECT ae.status, ae.prestador_id, ae.ordem_servico_id, ae.cliente_id, ae.tenant_id
    INTO v_alocacao_status, v_alocacao_prestador_id, v_os_id, v_cliente_id, v_alocacao_tenant_id
    FROM public.alocacoes_escala ae
    WHERE ae.id = p_alocacao_id;

    IF v_alocacao_prestador_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'ALOCACAO_NAO_ENCONTRADA',
            'error_code', 'ALOCACAO_NOT_FOUND',
            'message', 'Alocação não encontrada.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 4: alocação pertence ao prestador autenticado
    -- ══════════════════════════════════════════════════════════════════════
    IF v_alocacao_prestador_id != v_prestador_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'ALOCACAO_OUTRO_PRESTADOR',
            'error_code', 'ALOCACAO_WRONG_PRESTADOR',
            'message', 'Esta alocação não pertence ao seu vínculo.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 5: alocação está ativa
    -- ══════════════════════════════════════════════════════════════════════
    IF v_alocacao_status IN ('cancelada', 'concluida', 'recusada') THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'ALOCACAO_INATIVA',
            'error_code', 'ALOCACAO_INACTIVE',
            'message', 'Alocação não está mais ativa (status: ' || v_alocacao_status || ').'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- Tenant: derivado da alocação autenticada (coluna REAL)
    -- Fallback seguro: current_tenant_id_safe() quando a alocação não tiver tenant
    -- ══════════════════════════════════════════════════════════════════════
    v_tenant_id := COALESCE(v_alocacao_tenant_id, public.current_tenant_id_safe());

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 6: coordenadas válidas (0,0 é inválido)
    -- ══════════════════════════════════════════════════════════════════════
    IF p_latitude = 0 AND p_longitude = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'COORDENADA_INVALIDA',
            'error_code', 'INVALID_COORDS',
            'message', 'Coordenada 0,0 rejeitada. GPS indisponível.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÃO 7: coordenadas dentro dos limites geográficos
    -- ══════════════════════════════════════════════════════════════════════
    IF p_latitude < -90 OR p_latitude > 90 OR p_longitude < -180 OR p_longitude > 180 THEN
        RETURN jsonb_build_object(
            'success', false,
            'ok', false,
            'error', 'COORDENADA_FORA_LIMITE',
            'error_code', 'COORDS_OUT_OF_RANGE',
            'message', 'Coordenada fora dos limites permitidos.'
        );
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- Resolução do veículo vinculado ao prestador (best-effort, coluna real)
    -- ══════════════════════════════════════════════════════════════════════
    BEGIN
        SELECT v.id INTO v_veiculo_id
        FROM public.veiculos v
        WHERE v.prestador_vinculado = v_prestador_id
        ORDER BY v.updated_at DESC NULLS LAST, v.created_at DESC NULLS LAST
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_veiculo_id := NULL;
    END;

    -- ══════════════════════════════════════════════════════════════════════
    -- DEDUPLICAÇÃO: mesma coordenada nos últimos 10s
    -- ══════════════════════════════════════════════════════════════════════
    SELECT latitude, longitude, captured_at INTO v_last_pos
    FROM public.portal_tracking_realtime
    WHERE alocacao_id = p_alocacao_id
      AND prestador_id = v_prestador_id
    ORDER BY captured_at DESC
    LIMIT 1;

    IF v_last_pos.captured_at IS NOT NULL THEN
        IF v_last_pos.captured_at > (p_captured_at - INTERVAL '10 seconds') THEN
            IF (v_last_pos.latitude = p_latitude AND v_last_pos.longitude = p_longitude) THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'ok', true,
                    'error', 'POSICAO_DUPLICADA',
                    'error_code', 'DUPLICATE_POSITION',
                    'duplicada', true,
                    'deduplicated', true,
                    'message', 'Posição duplicada. Ignorada.'
                );
            END IF;
        END IF;
    ELSE
        v_is_first := true;
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- INSERT na tabela de tracking (APENAS colunas existentes)
    -- os_id pode ser NULL (alocação sem OS) — NÃO impede o registro.
    -- p_altitude / p_status_operacional preservados em metadata (JSONB).
    -- CORREÇÃO A25-H2: RETORNING id INTO v_tracking_id (UUID),
    -- sem cast implícito UUID → JSONB (elimina erro 22P02).
    -- ══════════════════════════════════════════════════════════════════════
    INSERT INTO public.portal_tracking_realtime (
        alocacao_id,
        os_id,
        prestador_id,
        veiculo_id,
        cliente_id,
        tenant_id,
        status,
        latitude,
        longitude,
        precisao,
        velocidade,
        direcao,
        bateria,
        captured_at,
        origem,
        metadata
    ) VALUES (
        p_alocacao_id,
        COALESCE(v_os_id, p_ordem_servico_id),
        v_prestador_id,
        v_veiculo_id,
        v_cliente_id,
        v_tenant_id,
        'online',
        p_latitude,
        p_longitude,
        p_precisao,
        p_velocidade,
        p_direcao,
        p_bateria,
        p_captured_at,
        p_origem,
        jsonb_build_object(
            'altitude', p_altitude,
            'status_operacional', p_status_operacional
        )
    )
    RETURNING id INTO v_tracking_id;

    -- ══════════════════════════════════════════════════════════════════════
    -- Evento: primeiro ponto de tracking (best-effort)
    -- ══════════════════════════════════════════════════════════════════════
    IF v_is_first THEN
        BEGIN
            INSERT INTO public.operation_timeline_events (
                operation_id,
                driver_id,
                type,
                title,
                description,
                metadata
            ) VALUES (
                p_alocacao_id,
                v_prestador_id,
                'tracking.iniciado',
                'Tracking Iniciado',
                'O motorista iniciou o envio de localização em tempo real.',
                jsonb_build_object(
                    'source', p_origem,
                    'alocacao_id', p_alocacao_id,
                    'latitude', p_latitude,
                    'longitude', p_longitude
                )
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- ══════════════════════════════════════════════════════════════════════
    -- RESPOSTA DE SUCESSO
    -- 'id' agora é v_tracking_id (UUID serializado corretamente por
    -- jsonb_build_object). FORMATO DO CONTRATO PRESERVADO.
    -- ══════════════════════════════════════════════════════════════════════
    RETURN jsonb_build_object(
        'success', true,
        'ok', true,
        'id', v_tracking_id,
        'alocacao_id', p_alocacao_id,
        'os_id', COALESCE(v_os_id, p_ordem_servico_id),
        'prestador_id', v_prestador_id,
        'veiculo_id', v_veiculo_id,
        'tenant_id', v_tenant_id,
        'primeiro_ponto', v_is_first,
        'message', 'Posição registrada com sucesso.'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reportar_ocorrencia_motorista(token_acesso text, escala_id uuid, tipo text, descricao text, latitude numeric, longitude numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    motorista_id UUID;
BEGIN
    SELECT motorista_id INTO motorista_id FROM motorista_app_sessoes WHERE token = token_acesso AND ativo = TRUE;
    IF motorista_id IS NULL THEN
        RAISE EXCEPTION 'Token inválido ou sessão expirada';
    END IF;
    -- Insert a record in escalonamentos_humanos for human handling
    INSERT INTO escalonamentos_humanos (
        origem,
        modulo,
        referencia_id,
        tipo,
        prioridade,
        status,
        titulo,
        descricao,
        mensagem_original,
        intencao,
        confianca,
        payload
    ) VALUES (
        'driver_app',
        'ocorrencia',
        escala_id,
        tipo,
        'alta',
        'aberto',
        concat('Ocorrência ', tipo, ' - ', descricao),
        descricao,
        concat('Motorista ', motorista_id, ': ', descricao),
        tipo,
        100,
        jsonb_build_object(
            'latitude', latitude,
            'longitude', longitude,
            'escala_id', escala_id
        )
    );
    -- Optionally update the operation status
    UPDATE escala_operacional SET status = 'ocorrencia', atualizado_em = now() WHERE id = escala_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_tenant_context(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM set_config('app.tenant_id', p_tenant_id::TEXT, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_escala_validacoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    conflito int;
BEGIN
    -- Conflito de motorista (mesmo motorista em outra operação com sobreposição de horário)
    SELECT COUNT(*) INTO conflito FROM public.escala_operacional
    WHERE motorista_nome = NEW.motorista_nome
      AND id <> NEW.id
      AND (
        (inicio_previsto, fim_previsto) OVERLAPS (NEW.inicio_previsto, NEW.fim_previsto)
      );
    IF conflito > 0 THEN
        INSERT INTO public.escalonamentos_humanos (
            origem, modulo, referencia_id, tipo, prioridade, status, titulo, descricao, mensagem_original, intencao, confianca
        ) VALUES (
            'escala_operacional', 'operacional', NEW.id, 'conflito_motorista', 'critica', 'aberto',
            'Conflito de Motorista Detectado',
            'Motorista '||NEW.motorista_nome||' está programado em outra operação no mesmo período.',
            'Conflito de motorista na escala.',
            'conflito', 100
        );
    END IF;
    -- Conflito de veículo (mesmo veículo em outra operação sobreposta)
    SELECT COUNT(*) INTO conflito FROM public.escala_operacional
    WHERE veiculo_id = NEW.veiculo_id
      AND id <> NEW.id
      AND (
        (inicio_previsto, fim_previsto) OVERLAPS (NEW.inicio_previsto, NEW.fim_previsto)
      );
    IF conflito > 0 THEN
        INSERT INTO public.escalonamentos_humanos (
            origem, modulo, referencia_id, tipo, prioridade, status, titulo, descricao, mensagem_original, intencao, confianca
        ) VALUES (
            'escala_operacional', 'operacional', NEW.id, 'conflito_veiculo', 'critica', 'aberto',
            'Conflito de Veículo Detectado',
            'Veículo '||NEW.placa||' está programado em outra operação no mesmo período.',
            'Conflito de veículo na escala.',
            'conflito', 100
        );
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_cancelada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'escala.alocacao.cancelada',
    'alocacao',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.updated_by,
    'internal',
    jsonb_build_object(
      'alocacao_id', NEW.id,
      'os_id', NEW.ordem_servico_id,
      'prestador_id', NEW.prestador_id,
      'motivo_cancelamento', NEW.observacoes_internas,  -- FIX: column exists
      'status_anterior', OLD.status,
      'data_cancelamento', NOW()
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_alocacao_cancelada',
      'source_table', 'alocacoes_escala'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_criada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'escala.alocacao.criada',
    'alocacao',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.created_by,
    'internal',
    jsonb_build_object(
      'alocacao_id', NEW.id,
      'os_id', NEW.ordem_servico_id,
      'prestador_id', NEW.prestador_id,
      'cliente_id', NEW.cliente_id,
      'data_escala', NEW.data_escala,
      'status', NEW.status,
      'origem', NEW.origem,
      'destino', NEW.destino
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_alocacao_criada',
      'source_table', 'alocacoes_escala'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_motorista_trocado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'escala.alocacao.motorista_trocado',
    'alocacao',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.updated_by,
    'internal',
    jsonb_build_object(
      'alocacao_id', NEW.id,
      'os_id', NEW.ordem_servico_id,
      'prestador_anterior', OLD.prestador_id,
      'prestador_novo', NEW.prestador_id,
      'motivo_troca', NEW.motivo_troca_motorista,
      'data_troca', NOW()
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_alocacao_motorista_trocado',
      'source_table', 'alocacoes_escala'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_alocacao_recusada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'escala.alocacao.recusada',
    'alocacao',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.updated_by,
    'internal',
    jsonb_build_object(
      'alocacao_id', NEW.id,
      'os_id', NEW.ordem_servico_id,
      'prestador_id', NEW.prestador_id,
      'motivo_recusa', NEW.motivo_recusa,
      'data_recusa', NOW()
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_alocacao_recusada',
      'source_table', 'alocacoes_escala'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_financeiro_receber_criado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'financeiro.receber.criado',
    'financeiro_receber',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NULL,
    'internal',
    jsonb_build_object(
      'financeiro_id', NEW.id,
      'os_id', NEW.os_id,
      'cliente', NEW.cliente,
      'valor', NEW.valor,
      'data_vencimento', NEW.data_vencimento,
      'status', NEW.status
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_financeiro_receber_criado',
      'source_table', 'financeiro_receber'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_financeiro_receber_pago()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status IN ('pago', 'recebido', 'baixado') AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.eventos_oficiais (
      event_type, entity_type, entity_id, entity_number,
      status, source, created_by, visibility,
      payload, metadata
    ) VALUES (
      'financeiro.receber.pago',
      'financeiro_receber',
      NEW.id,
      NULL,
      'active',
      'trigger',
      NULL,
      'public',
      jsonb_build_object(
        'financeiro_id', NEW.id,
        'os_id', NEW.os_id,
        'cliente', NEW.cliente,
        'valor', NEW.valor,
        'data_pagamento', NOW(),
        'status', NEW.status
      ),
      jsonb_build_object(
        'trigger_name', 'trg_evento_financeiro_receber_pago',
        'source_table', 'financeiro_receber'
      )
    )
    ON CONFLICT (event_type, entity_type, entity_id)
    WHERE event_type NOT LIKE 'auth.%'
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_operacao_finalizada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      DECLARE
          v_prestador_nome TEXT;
          v_os_numero TEXT;
          v_recebedor_nome TEXT;
      BEGIN
          SELECT COALESCE(nome_completo, 'Prestador') INTO v_prestador_nome
          FROM public.prestadores WHERE id = NEW.prestador_id;
          SELECT numero INTO v_os_numero
          FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;
          SELECT nome_recebedor INTO v_recebedor_nome
          FROM public.entregas_protocolo WHERE alocacao_id = NEW.id
          ORDER BY created_at DESC LIMIT 1;
          INSERT INTO public.eventos_oficiais (
              event_type, entity_type, entity_id, entity_number,
              status, source, created_by, visibility,
              payload, metadata
          ) VALUES (
              'escala.alocacao.concluida',
              'alocacao',
              NEW.id,
              v_os_numero,
              'active',
              'trigger',
              NEW.updated_by,
              'public',
              jsonb_build_object(
                  'alocacao_id', NEW.id,
                  'os_id', NEW.ordem_servico_id,
                  'os_numero', v_os_numero,
                  'prestador_id', NEW.prestador_id,
                  'prestador_nome', v_prestador_nome,
                  'data_finalizacao', NEW.data_finalizacao,
                  'km_realizados', NEW.km_realizados,
                  'tempo_total_minutos', NEW.tempo_total_minutos,
                  'comprovante_url', NEW.comprovante_url,
                  'recebedor_nome', v_recebedor_nome,
                  'status', NEW.status,
                  'observacoes', NEW.observacoes
              ),
              jsonb_build_object(
                  'trigger_name', 'trg_evento_operacao_finalizada',
                  'source_table', 'alocacoes_escala'
              )
          );
          RETURN NEW;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_os_cancelada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    DECLARE
      v_cliente_nome TEXT;
    BEGIN
      SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
      FROM public.clientes WHERE id = NEW.cliente;
      INSERT INTO public.eventos_oficiais (
        event_type, entity_type, entity_id, entity_number,
        status, source, created_by, visibility,
        payload, metadata
      ) VALUES (
        'os.ordem_servico.cancelada',
        'ordem_servico',
        NEW.id,
        NEW.numero,
        'active',
        'trigger',
        NULL,
        'internal',
        jsonb_build_object(
          'os_id', NEW.id,
          'numero', NEW.numero,
          'cliente_id', NEW.cliente,
          'cliente_nome', v_cliente_nome,
          'status_anterior', OLD.status,
          'status_novo', NEW.status
        ),
        jsonb_build_object(
          'trigger_name', 'trg_evento_os_cancelada',
          'source_table', 'ordens_servico'
        )
      )
      ON CONFLICT (event_type, entity_type, entity_id)
      WHERE event_type NOT LIKE 'auth.%'
      DO NOTHING;
      RETURN NEW;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_os_criada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    DECLARE
        v_cliente_nome TEXT;
    BEGIN
        SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
        FROM public.clientes WHERE id = NEW.cliente;
        INSERT INTO public.eventos_oficiais (
            event_type, entity_type, entity_id, entity_number,
            status, source, created_by, visibility,
            payload, metadata
        ) VALUES (
            'os.ordem_servico.criada',
            'ordem_servico',
            NEW.id,
            NEW.numero,
            'active',
            'trigger',
            NULL,
            'internal',
            jsonb_build_object(
                'os_id', NEW.id,
                'numero', NEW.numero,
                'cliente_id', NEW.cliente,
                'cliente_nome', v_cliente_nome,
                'status', NEW.status,
                'origem', NEW.origem,
                'destino', NEW.destino,
                'valor_cliente', NEW.valor_cliente,
                'tipo_carga', NEW.tipo_carga,
                'peso', NEW.peso,
                'volumes', NEW.volumes,
                'data_programada', NEW.data_programada
            ),
            jsonb_build_object(
                'trigger_name', 'trg_evento_os_criada',
                'source_table', 'ordens_servico'
            )
        );
        RETURN NEW;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_os_finalizada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    DECLARE
        v_cliente_nome TEXT;
    BEGIN
        SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
        FROM public.clientes WHERE id = NEW.cliente;
        INSERT INTO public.eventos_oficiais (
            event_type, entity_type, entity_id, entity_number,
            status, source, created_by, visibility,
            payload, metadata
        ) VALUES (
            'os.ordem_servico.finalizada',
            'ordem_servico',
            NEW.id,
            NEW.numero,
            'active',
            'trigger',
            NULL,
            'public',
            jsonb_build_object(
                'os_id', NEW.id,
                'numero', NEW.numero,
                'cliente_id', NEW.cliente,
                'cliente_nome', v_cliente_nome,
                'status', NEW.status,
                'valor_cliente', NEW.valor_cliente,
                'custo_prestador', NEW.custo_prestador,
                'data_programada', NEW.data_programada
            ),
            jsonb_build_object(
                'trigger_name', 'trg_evento_os_finalizada',
                'source_table', 'ordens_servico'
            )
        );
        RETURN NEW;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_os_status_changed()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    DECLARE
      v_cliente_nome TEXT;
    BEGIN
      IF NEW.status IN ('finalizada', 'encerrada', 'cancelada') THEN
        RETURN NEW;
      END IF;
      SELECT COALESCE(nome_fantasia, razao_social, 'Cliente') INTO v_cliente_nome
      FROM public.clientes WHERE id = NEW.cliente;
      INSERT INTO public.eventos_oficiais (
        event_type, entity_type, entity_id, entity_number,
        status, source, created_by, visibility,
        payload, metadata
      ) VALUES (
        'os.ordem_servico.status_changed',
        'ordem_servico',
        NEW.id,
        NEW.numero,
        'active',
        'trigger',
        NULL,
        'internal',
        jsonb_build_object(
          'os_id', NEW.id,
          'numero', NEW.numero,
          'cliente_id', NEW.cliente,
          'cliente_nome', v_cliente_nome,
          'status_anterior', OLD.status,
          'status_novo', NEW.status
        ),
        jsonb_build_object(
          'trigger_name', 'trg_evento_os_status_changed',
          'source_table', 'ordens_servico'
        )
      )
      ON CONFLICT (event_type, entity_type, entity_id)
      WHERE event_type NOT LIKE 'auth.%'
      DO NOTHING;
      RETURN NEW;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_pod_enviado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'entrega.comprovante.pod_enviado',
    'entrega_protocolo',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NULL,
    'internal',
    jsonb_build_object(
      'protocolo_id', NEW.id,
      'alocacao_id', NEW.alocacao_id,
      'nome_recebedor', NEW.nome_recebedor,
      'data_hora_entrega', NEW.data_hora_entrega,
      'foto_entrega_url', NEW.foto_entrega_url,
      'assinatura_url', NEW.assinatura_url,
      'foto_canhoto_url', NEW.foto_canhoto_url,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude,
      'observacao', NEW.observacao
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_pod_enviado',
      'source_table', 'entregas_protocolo'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_portal_ocorrencia_aberta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'portal.ocorrencia.aberta',
    'portal_ocorrencia',
    NEW.id,
    NULL,
    'active',
    'trigger',
    NEW.cliente_id,
    'internal',
    jsonb_build_object(
      'ocorrencia_id', NEW.id,
      'cliente_id', NEW.cliente_id,
      'os_id', NEW.os_id,
      'tipo', NEW.tipo,
      'descricao', NEW.descricao,
      'status', NEW.status
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_portal_ocorrencia_aberta',
      'source_table', 'portal_ocorrencias'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_portal_pedido_criado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.eventos_oficiais (
    event_type, entity_type, entity_id, entity_number,
    status, source, created_by, visibility,
    payload, metadata
  ) VALUES (
    'portal.pedido.criado',
    'portal_pedido',
    NEW.id,
    NEW.numero_pedido,
    'active',
    'trigger',
    NEW.cliente_id,
    'internal',
    jsonb_build_object(
      'pedido_id', NEW.id,
      'cliente_id', NEW.cliente_id,
      'numero_pedido', NEW.numero_pedido,
      'tipo_servico', NEW.tipo_carga,
      'status', NEW.status,
      'total_pedido', COALESCE((NEW.metadata->>'preco_final')::numeric, 0),
      'cidade_origem', NEW.coleta_cidade,
      'cidade_destino', NEW.entrega_cidade
    ),
    jsonb_build_object(
      'trigger_name', 'trg_evento_portal_pedido_criado',
      'source_table', 'portal_pedidos'
    )
  )
  ON CONFLICT (event_type, entity_type, entity_id)
  WHERE event_type NOT LIKE 'auth.%'
  DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_evento_prestador_aceitou()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      DECLARE
          v_prestador_nome TEXT;
          v_os_numero TEXT;
      BEGIN
          SELECT COALESCE(nome_completo, 'Prestador') INTO v_prestador_nome
          FROM public.prestadores WHERE id = NEW.prestador_id;
          SELECT numero INTO v_os_numero
          FROM public.ordens_servico WHERE id = NEW.ordem_servico_id;
          INSERT INTO public.eventos_oficiais (
              event_type, entity_type, entity_id, entity_number,
              status, source, created_by, visibility,
              payload, metadata
          ) VALUES (
              'escala.alocacao.aceita',
              'alocacao',
              NEW.id,
              v_os_numero,
              'active',
              'trigger',
              NEW.updated_by,
              'internal',
              jsonb_build_object(
                  'alocacao_id', NEW.id,
                  'os_id', NEW.ordem_servico_id,
                  'os_numero', v_os_numero,
                  'prestador_id', NEW.prestador_id,
                  'prestador_nome', v_prestador_nome,
                  'data_aceite', NEW.data_aceite,
                  'status', NEW.status,
                  'cliente_id', NEW.cliente_id,
                  'origem', NEW.origem,
                  'destino', NEW.destino
              ),
              jsonb_build_object(
                  'trigger_name', 'trg_evento_prestador_aceitou',
                  'source_table', 'alocacoes_escala'
              )
          );
          RETURN NEW;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.trg_eventos_oficiais_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.processed_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_f_derivar_reembolso_prestador()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_prestador_nome TEXT;
    v_prestador_id UUID;
    v_tenant_id UUID;
BEGIN
    -- 1. Validar autenticação
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'M129-C.2: Usuário não autenticado';
    END IF;

    -- 2. Buscar prestador vinculado ao auth.uid()
    SELECT p.nome_completo, p.id
    INTO STRICT v_prestador_nome, v_prestador_id
    FROM public.prestadores p
    WHERE p.auth_user_id = auth.uid();

    -- 3. Derivar tenant_id
    v_tenant_id := public.current_tenant_id_safe();

    -- 4. Forçar prestador (ignorar qualquer valor enviado pelo App)
    NEW.prestador := v_prestador_nome;

    -- 5. Forçar tenant_id
    NEW.tenant_id := v_tenant_id;

    -- 6. Forçar created_by
    NEW.created_by := auth.uid();

    -- 7. Forçar status = pendente
    IF NEW.status IS DISTINCT FROM 'pendente' THEN
        RAISE EXCEPTION 'M129-C.2: Status do reembolso deve ser pendente';
    END IF;
    NEW.status := 'pendente';

    -- 8. Validar tipo
    IF NEW.tipo IS NULL OR NEW.tipo NOT IN ('pedagio', 'ajudante', 'estadia', 'diaria', 'outros') THEN
        RAISE EXCEPTION 'M129-C.2: Tipo inválido. Valores permitidos: pedagio, ajudante, estadia, diaria, outros';
    END IF;

    -- 9. Validar valor > 0
    IF NEW.valor IS NULL OR NEW.valor <= 0 THEN
        RAISE EXCEPTION 'M129-C.2: Valor deve ser maior que zero';
    END IF;

    -- 10. Validar descrição
    IF NEW.descricao IS NULL OR length(trim(NEW.descricao)) = 0 THEN
        RAISE EXCEPTION 'M129-C.2: Descrição não pode estar vazia';
    END IF;

    -- 11. Validar OS (se fornecida)
    IF NEW.os_id IS NOT NULL THEN
        -- 11a. OS existe?
        IF NOT EXISTS (SELECT 1 FROM public.ordens_servico WHERE id = NEW.os_id) THEN
            RAISE EXCEPTION 'M129-C.2: OS inexistente';
        END IF;

        -- 11b. OS pertence ao prestador? (via alocacoes_escala.prestador_id)
        IF NOT EXISTS (
            SELECT 1
            FROM public.alocacoes_escala
            WHERE ordem_servico_id = NEW.os_id
              AND prestador_id = v_prestador_id
        ) THEN
            RAISE EXCEPTION 'M129-C.2: OS não pertence a este prestador';
        END IF;

        -- 11c. OS do mesmo tenant?
        IF NOT EXISTS (
            SELECT 1
            FROM public.ordens_servico
            WHERE id = NEW.os_id
              AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'M129-C.2: OS de outro tenant';
        END IF;
    END IF;

    -- 12. Garantir timestamps
    IF NEW.created_at IS NULL THEN
        NEW.created_at := now();
    END IF;
    NEW.updated_at := now();

    RETURN NEW;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE EXCEPTION 'M129-C.2: Usuário sem prestador vinculado';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_guardar_pagar_pago_sem_baixa()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_tem_baixa boolean;
BEGIN
  -- Só valida quando status muda para pago/paga/baixado
  IF NEW.status IN ('pago', 'paga', 'baixado') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'paga', 'baixado')) THEN
    
    -- Verificar se existe baixa não estornada
    SELECT EXISTS(
      SELECT 1 FROM public.financeiro_baixas
      WHERE titulo_tabela = 'financeiro_pagar'
        AND titulo_id = NEW.id
        AND NOT estornada
    ) INTO v_tem_baixa;
    
    IF NOT v_tem_baixa THEN
      RAISE EXCEPTION 'Não é permitido marcar conta a pagar como % sem baixa financeira correspondente. Use o fluxo oficial de baixa.', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_guardar_receber_pago_sem_baixa()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_tem_baixa boolean;
BEGIN
  -- Só valida quando status muda para pago/recebido/baixado
  IF NEW.status IN ('pago', 'recebido', 'baixado') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('pago', 'recebido', 'baixado')) THEN
    
    -- Verificar se existe baixa não estornada
    SELECT EXISTS(
      SELECT 1 FROM public.financeiro_baixas
      WHERE titulo_tabela = 'financeiro_receber'
        AND titulo_id = NEW.id
        AND NOT estornada
    ) INTO v_tem_baixa;
    
    IF NOT v_tem_baixa THEN
      RAISE EXCEPTION 'Não é permitido marcar recebível como % sem baixa financeira correspondente. Use o fluxo oficial de baixa.', NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_ia_logs_escalonamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.try_cast_uuid(p_text text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  IF p_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN p_text::uuid;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_alocacoes_escala_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_comunicacoes_robos_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_configuracoes_fiscais_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_diretor_virtual_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_fiscal_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_gatilhos_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_hml_seed_checkpoint_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_operacao_localizacao_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_patio_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_reembolsos_prestador_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_regras_fiscais_cte_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_regras_fiscais_nfse_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_regras_operacao_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_rotinas_ia_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tenants_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_tenant_access(p_tenant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_usuarios
        WHERE tenant_id = p_tenant_id
          AND user_id = auth.uid()
          AND status = 'ativo'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_tenant_role(p_tenant_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_papel TEXT;
BEGIN
    SELECT papel INTO v_papel FROM tenant_usuarios
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid() AND status = 'ativo';
    RETURN v_papel;
END;
$function$
;

-- ============================================================================
-- 9. VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW public."central_ia_dashboard_view" AS
 SELECT 'robo'::text AS tipo_entidade,
    ar.id,
    ar.nome,
    ar.setor,
    ar.status,
    ar.modo,
    ar.ultima_execucao,
    ar.total_execucoes,
    ar.total_erros,
    ar.ativo,
    ar.criado_em
   FROM automacoes_robos ar
UNION ALL
 SELECT 'tarefa'::text AS tipo_entidade,
    ita.id,
    ita.titulo AS nome,
    COALESCE(iset.nome, ita.tipo_tarefa) AS setor,
        CASE
            WHEN ita.status = 'pendente'::text THEN 'pendente'::text
            WHEN ita.status = 'em_andamento'::text THEN 'ativo'::text
            WHEN ita.status = 'concluido'::text THEN 'concluido'::text
            WHEN ita.status = 'erro'::text THEN 'erro'::text
            ELSE 'inativo'::text
        END AS status,
    'assistido'::text AS modo,
    ita.executado_em AS ultima_execucao,
    0 AS total_execucoes,
        CASE
            WHEN ita.status = 'erro'::text THEN 1
            ELSE 0
        END AS total_erros,
        CASE
            WHEN ita.status <> ALL (ARRAY['cancelada'::text, 'erro'::text, 'concluido'::text]) THEN true
            ELSE false
        END AS ativo,
    ita.criado_em
   FROM ia_tarefas_automaticas ita
     LEFT JOIN ia_setores iset ON iset.id = ita.setor_id
UNION ALL
 SELECT 'aprovacao'::text AS tipo_entidade,
    iah.id,
    iah.titulo AS nome,
    COALESCE(iset.nome, 'Geral'::text) AS setor,
    iah.status,
    'manual'::text AS modo,
    iah.criado_em AS ultima_execucao,
    0 AS total_execucoes,
    0 AS total_erros,
        CASE
            WHEN iah.status = ANY (ARRAY['pendente'::text, 'em_analise'::text]) THEN true
            ELSE false
        END AS ativo,
    iah.criado_em
   FROM ia_aprovacoes_humanas iah
     LEFT JOIN ia_setores iset ON iset.id = iah.setor_id;;

CREATE OR REPLACE VIEW public."portal_cliente_alocacoes_view" AS
 SELECT id,
    ordem_servico_id,
    cliente_id,
    prestador_id,
    status,
    aceite_prestador,
    data_aceite,
    horario_inicio_real,
    horario_fim_real,
    finalizada,
    comprovante_url,
    assinatura_url,
    fotos_entrega,
    created_at
   FROM alocacoes_escala ae
  WHERE (cliente_id IN ( SELECT uc.cliente_id
           FROM usuarios_cliente uc
          WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true));;

CREATE OR REPLACE VIEW public."portal_cliente_financeiro_view" AS
 SELECT id,
    cliente_id,
    fatura,
    descricao AS competencia,
    data_vencimento,
    valor,
    status,
    os_id,
    created_at
   FROM financeiro_receber fr
  WHERE (cliente_id IN ( SELECT uc.cliente_id
           FROM usuarios_cliente uc
          WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true));;

CREATE OR REPLACE VIEW public."portal_cliente_ordens_view" AS
 SELECT id,
    numero,
    status,
    cliente,
    cliente_id,
    origem,
    destino,
    data_servico,
    data,
    created_at,
    valor_cliente,
    peso,
    volumes,
    carga_descricao,
    carga_descricao AS mercadoria,
    prestador,
    tipo_veiculo,
    placa_alocada,
    veiculo
   FROM ordens_servico os
  WHERE (cliente_id::uuid IN ( SELECT uc.cliente_id
           FROM usuarios_cliente uc
          WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true));;

CREATE OR REPLACE VIEW public."portal_cliente_pedidos_view" AS
 SELECT id,
    cliente_id,
    numero_pedido,
    status,
    solicitante_nome,
    solicitante_email,
    solicitante_telefone,
    filial,
    centro_custo,
    prioridade,
    coleta_cep,
    coleta_rua,
    coleta_numero,
    coleta_complemento,
    coleta_bairro,
    coleta_cidade,
    coleta_uf,
    coleta_referencia,
    coleta_data,
    entrega_destinatario,
    entrega_telefone,
    entrega_email,
    entrega_notificar_whatsapp,
    entrega_notificar_email,
    entrega_cep,
    entrega_rua,
    entrega_numero,
    entrega_complemento,
    entrega_bairro,
    entrega_cidade,
    entrega_uf,
    entrega_referencia,
    entrega_data,
    descricao,
    volumes,
    peso,
    comprimento,
    largura,
    altura,
    valor_declarado,
    tipo_carga,
    observacoes,
    veiculo_sugerido,
    prazo_estimado,
    payload_n8n,
    os_vinculada_id,
    metadata,
    solicitacao_via,
    data_solicitada,
    created_at,
    updated_at
   FROM portal_pedidos pp
  WHERE (cliente_id IN ( SELECT uc.cliente_id
           FROM usuarios_cliente uc
          WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true));;

CREATE OR REPLACE VIEW public."portal_cliente_perfil_view" AS
 SELECT id,
    razao_social,
    nome_fantasia,
    cnpj,
    ie,
    inscricao_municipal,
    segmento,
    porte,
    status,
    logo,
    cep,
    logradouro,
    numero,
    bairro,
    complemento,
    cidade,
    uf,
    contato_principal,
    telefone,
    whatsapp,
    email,
    site,
    responsavel_operacional,
    responsavel_financeiro,
    responsavel_comercial,
    regime_tributario,
    optante_simples,
    aliquota_iss,
    cnae,
    cfop_padrao,
    tipo_frete_preferencial,
    veiculo_preferencial,
    horario_entrega_preferencial,
    exige_agendamento,
    exige_sla,
    notificar_email,
    notificar_whatsapp,
    notificar_mudanca_status,
    notificar_comprovante,
    created_at,
    updated_at
   FROM clientes c
  WHERE id = obter_cliente_id_do_usuario();;

CREATE OR REPLACE VIEW public."portal_cliente_pods_view" AS
 SELECT id,
    alocacao_id,
    prestador_id,
    nome_recebedor,
    documento_recebedor,
    foto_entrega_url,
    foto_canhoto_url,
    assinatura_url,
    data_hora_entrega,
    observacao,
    created_at
   FROM entregas_protocolo ep
  WHERE (alocacao_id IN ( SELECT ae.id
           FROM alocacoes_escala ae
          WHERE (ae.cliente_id IN ( SELECT uc.cliente_id
                   FROM usuarios_cliente uc
                  WHERE uc.auth_user_id = auth.uid() AND uc.ativo = true))));;

CREATE OR REPLACE VIEW public."prestadores_public" AS
 SELECT id,
    nome,
    tipo_veiculo,
    refrigerado,
    nivel_motorista,
    score,
    status_operacional
   FROM prestadores_app
  WHERE status_operacional = 'Aprovado'::text;;

CREATE OR REPLACE VIEW public."vw_app_motorista_operacoes" AS
 SELECT id,
    empresa_id,
    cliente_id,
    prestador_id,
    ordem_servico_id,
    ordem_carregamento_id,
    data_escala,
    turno,
    tipo_veiculo,
    placa,
    regiao,
    rota,
    origem,
    destino,
    status,
    status_pagamento,
    quantidade_entregas,
    quantidade_coletas,
    quantidade_paradas,
    km_previstos,
    km_realizados,
    valor_frete,
    valor_repasse,
    valor_pedagio,
    valor_combustivel,
    valor_ajudante,
    valor_adicional,
    valor_desconto,
    valor_total,
    valor_tipo,
    valor_percentual,
    valor_fixo,
    combustivel_valor,
    km_rodados,
    valor_km,
    pedagio_franquia,
    pedagio_excedente,
    pedagio_cobrar_excedente,
    diarias_adicionais,
    valor_diaria,
    segunda_saida,
    valor_segunda_saida,
    terceira_saida,
    valor_terceira_saida,
    saidas_adicionais,
    valor_saida_adicional,
    ajudantes,
    valor_ajudante_unit,
    reembolsos_outros,
    valor_reembolso_outros,
    horario_saida,
    horario_retorno_previsto,
    horario_inicio_real,
    horario_fim_real,
    tempo_total_minutos,
    aceite_prestador,
    data_aceite,
    motivo_recusa,
    finalizada,
    data_finalizacao,
    comprovante_url,
    assinatura_url,
    fotos_entrega,
    ocorrencias_count,
    ocorrencias_descricao,
    observacoes,
    instrucoes_operacionais,
    observacoes_internas,
    tabela_valores_id,
    tem_regra_especial,
    metadata,
    tags,
    created_at,
    updated_at,
    created_by,
    updated_by,
    tenant_id,
    tipo_reversa,
    reversa_valor_cliente,
    reversa_valor_prestador,
    reversa_qtd_volumes,
    reversa_status,
    reversa_pod_url,
    reversa_fotos,
    reversa_observacoes,
    reversa_realizada_em,
    reversa_qtd_coletada,
    reversa_endereco_coleta,
    reversa_endereco_devolucao,
    reversa_unidade_cobranca,
    reversa_valor_unitario,
    reversa_divergencia,
    reversa_motivo_divergencia,
    reversa_responsavel,
    reversa_documento_responsavel,
    reversa_telefone,
    reversa_data_prevista,
    reversa_data_realizada,
    reversa_valor_adicional,
    reversa_assinatura_url,
    reversa_latitude,
    reversa_longitude,
    coleta_reversa,
    operation_mode,
    motivo_troca_motorista,
    endereco_origem,
    endereco_destino
   FROM alocacoes_escala ae;;

CREATE OR REPLACE VIEW public."vw_app_motorista_paradas" AS
 SELECT id AS parada_id,
    rota_id,
    sequencia,
    COALESCE(destinatario, cliente_nome, ''::text) AS destinatario,
    COALESCE(endereco, ''::text) AS endereco,
    cliente_nome,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    cep,
    referencia,
    latitude,
    longitude,
    portaria,
    doca,
    procedimento_entrada,
    procedimento_saida,
    estacionamento,
    documento_necessario,
    codigo_acesso,
    exigencia_epi,
    exige_ajudante,
    restricao_veiculo,
    restricao_altura,
    outras_restricoes,
    contato_nome,
    contato_telefone,
    responsavel_local,
    recebedor_previsto,
    pedido,
    nota_fiscal,
    contato,
    peso,
    volumes,
    cubagem,
    temperatura_carga,
    prioridade,
    janela_entrega AS janela_inicio,
    ''::text AS janela_fim,
    horario_limite,
    instrucoes,
    observacoes,
    status,
    recebedor,
    assinatura_url,
    pod_url,
    fotos,
    ocorrencia,
    data_hora AS arrived_at,
    data_entrega AS completed_at,
    data_prevista,
    created_at,
    created_at AS updated_at
   FROM rota_paradas rp
  WHERE alocacao_id IS NOT NULL;;

CREATE OR REPLACE VIEW public."vw_app_notificacoes_pendentes" AS
 SELECT id,
    prestador_id,
    titulo,
    mensagem,
    tipo,
    origem_id,
    origem_tipo,
    lida,
    created_at
   FROM portal_notificacoes
  WHERE lida = false
  ORDER BY created_at DESC;;

CREATE OR REPLACE VIEW public."vw_hierarquia_tabelas" AS
 SELECT 'tabelas_valores'::text AS tipo,
    id,
    nome,
    cliente,
    tipo_veiculo,
    valor_base,
    franquia_km,
    valor_km_excedente,
    percentual_prestador,
    universal,
    data_inicio,
    data_fim,
    versao,
    prioridade,
    ativo,
    created_at,
    updated_at,
        CASE
            WHEN universal THEN 3
            WHEN cliente IS NOT NULL AND data_inicio IS NOT NULL THEN 1
            WHEN cliente IS NOT NULL THEN 2
            ELSE 4
        END AS nivel_hierarquia
   FROM tabelas_valores t
  WHERE ativo = true;;

CREATE OR REPLACE VIEW public."vw_motorista_checklist" AS
 SELECT id,
    tipo,
    latitude,
    longitude,
    observacao,
    created_at,
    escala_id
   FROM motorista_checkins c
  WHERE prestador_id = auth.uid();;

CREATE OR REPLACE VIEW public."vw_motorista_dashboard" AS
 SELECT m.id AS motorista_id,
    m.nome_completo AS motorista_nome,
    os.id AS escala_id,
    os.status,
    os.inicio_previsto,
    os.fim_previsto,
    v.placa,
    v.modelo,
    os.prioridade,
    os.observacoes
   FROM escala_operacional os
     JOIN prestadores m ON os.prestador_id = m.id
     LEFT JOIN veiculos v ON os.veiculo_id = v.id
  WHERE os.prestador_id = auth.uid();;

CREATE OR REPLACE VIEW public."vw_motorista_documentos" AS
 SELECT id,
    tipo,
    url,
    created_at AS data_expiracao
   FROM documentos_prestadores d
  WHERE prestador_id = auth.uid();;

CREATE OR REPLACE VIEW public."vw_motorista_financeiro" AS
 SELECT f.id AS financeiro_id,
    f.valor,
    f.status,
    f.vencimento,
    os.id AS escala_id,
    os.status AS operacao_status
   FROM financeiro_pagar f
     LEFT JOIN ordens_servico os ON f.os_id::uuid = os.id
  WHERE f.fornecedor_id = auth.uid();;

CREATE OR REPLACE VIEW public."vw_motorista_viagens" AS
 SELECT os.id AS escala_id,
    os.data_operacao,
    os.inicio_previsto,
    os.fim_previsto,
    os.status,
    os.prioridade,
    r.id AS rota_id,
    r.nome AS rota_nome,
    v.placa,
    v.modelo
   FROM escala_operacional os
     LEFT JOIN rotas r ON os.rota_id = r.id
     LEFT JOIN veiculos v ON os.veiculo_id = v.id
  WHERE os.prestador_id = auth.uid()
  ORDER BY os.data_operacao DESC;;

CREATE OR REPLACE VIEW public."vw_noc_operacional" AS
 SELECT ae.id AS alocacao_id,
    ae.status AS status_operacao,
    ae.prestador_id,
    COALESCE(p.nome_completo, 'N/I'::text) AS motorista_nome,
    ae.tipo_veiculo,
    ae.placa,
    ae.cliente_id,
    COALESCE(c.nome_fantasia, c.razao_social, 'N/I'::text) AS cliente_nome,
    ae.origem,
    ae.destino,
    ae.data_escala,
    ae.km_previstos,
    ae.valor_frete AS valor_cliente,
    ae.valor_repasse AS valor_prestador,
    ae.aceite_prestador,
    ae.data_aceite,
    ae.finalizada,
    ae.ordem_servico_id,
    os.numero AS os_numero,
    os.tipo_operacao,
    ae.tipo_reversa,
    ae.reversa_valor_cliente,
    ae.reversa_valor_prestador,
    ae.reversa_status,
    ae.comprovante_url,
    ae.assinatura_url,
        CASE
            WHEN ae.comprovante_url IS NOT NULL OR ae.assinatura_url IS NOT NULL THEN true
            ELSE false
        END AS tem_pod,
    ae.created_at AS aloc_criada_em,
    ae.updated_at AS aloc_atualizada_em,
    ae.tenant_id,
    ol.latitude AS tracking_lat,
    ol.longitude AS tracking_lng,
    ol.velocidade AS tracking_velocidade,
    ol.atualizado_em AS tracking_ultima_atualizacao,
        CASE
            WHEN ae.status = 'em_rota'::text AND ae.data_escala < CURRENT_DATE THEN 'atrasado'::text
            WHEN ae.status = 'em_rota'::text THEN 'em_dia'::text
            WHEN (ae.status = ANY (ARRAY['planejada'::text, 'aguardando_aceite'::text])) AND ae.data_escala < CURRENT_DATE THEN 'urgente'::text
            WHEN ae.status = ANY (ARRAY['planejada'::text, 'aguardando_aceite'::text]) THEN 'pendente'::text
            WHEN ae.status = 'aceita'::text THEN 'confirmado'::text
            WHEN ae.status = 'concluida'::text THEN 'concluido'::text
            ELSE ae.status
        END AS sla_status,
        CASE
            WHEN ae.reversa_valor_cliente > 0::numeric AND ae.reversa_status IS NULL THEN 'reversa_pendente'::text
            WHEN ae.finalizada = true AND ae.comprovante_url IS NULL AND ae.assinatura_url IS NULL THEN 'pod_pendente'::text
            WHEN ae.status = 'em_rota'::text AND ol.latitude IS NULL THEN 'sem_sinal_gps'::text
            ELSE NULL::text
        END AS alerta
   FROM alocacoes_escala ae
     LEFT JOIN prestadores p ON p.id = ae.prestador_id
     LEFT JOIN clientes c ON c.id = ae.cliente_id
     LEFT JOIN ordens_servico os ON os.id = ae.ordem_servico_id
     LEFT JOIN LATERAL ( SELECT operacao_localizacao.latitude,
            operacao_localizacao.longitude,
            operacao_localizacao.velocidade,
            operacao_localizacao.atualizado_em
           FROM operacao_localizacao
          WHERE operacao_localizacao.alocacao_id = ae.id
          ORDER BY operacao_localizacao.atualizado_em DESC
         LIMIT 1) ol ON true
  WHERE ae.status <> ALL (ARRAY['cancelada'::text, 'recusada'::text]);;

CREATE OR REPLACE VIEW public."vw_relatorio_faturamento_cliente" AS
 SELECT c.id AS cliente_id,
    COALESCE(c.nome_fantasia, c.razao_social, 'Avulso'::text) AS cliente_nome,
    COALESCE(c.cnpj, ''::text) AS cliente_cnpj,
    count(DISTINCT os.id) AS quantidade_os,
    COALESCE(sum(os.valor_cliente), 0::numeric) AS valor_faturado,
    COALESCE(sum(
        CASE
            WHEN fr.status = 'paga'::text THEN fr.valor
            ELSE 0::numeric
        END), 0::numeric) AS valor_pago,
    COALESCE(sum(
        CASE
            WHEN fr.status = ANY (ARRAY['a vencer'::text, 'vencida'::text]) THEN fr.valor
            ELSE 0::numeric
        END), 0::numeric) AS valor_pendente,
        CASE
            WHEN count(DISTINCT os.id) > 0 THEN COALESCE(sum(os.valor_cliente), 0::numeric) / count(DISTINCT os.id)::numeric
            ELSE 0::numeric
        END AS ticket_medio,
    max(os.data) AS ultima_operacao,
    COALESCE(sum(os.margem_liquida), 0::numeric) AS margem_total,
    max(c.created_at) AS created_at
   FROM clientes c
     LEFT JOIN ordens_servico os ON try_cast_uuid(os.cliente_id) = c.id AND (os.status <> ALL (ARRAY['cancelada'::text, 'rascunho'::text]))
     LEFT JOIN financeiro_receber fr ON fr.cliente_id = c.id
  GROUP BY c.id, c.nome_fantasia, c.razao_social, c.cnpj;;

CREATE OR REPLACE VIEW public."vw_relatorio_faturamento_detalhado" AS
 SELECT os.id AS os_id,
    os.numero AS os_numero,
    os.created_at,
    os.data,
    c.id AS cliente_id,
    COALESCE(c.nome_fantasia, c.razao_social, 'Avulso'::text) AS cliente_nome,
    COALESCE(c.cnpj, ''::text) AS cliente_cnpj,
    os.status,
    COALESCE(os.valor_cliente, 0::numeric) AS valor_cliente,
    COALESCE(os.custo_prestador, 0::numeric) AS custo_prestador,
    COALESCE(os.margem_liquida, 0::numeric) AS margem_liquida,
    COALESCE(os.pedagio, 0::numeric) AS pedagio,
    COALESCE(os.adicionais::numeric, 0::numeric) AS adicionais,
    COALESCE(os.descontos, 0::numeric) AS descontos,
    os.veiculo_tipo,
    os.enderecos,
    os.created_at AS data_cadastro
   FROM ordens_servico os
     LEFT JOIN clientes c ON c.id = try_cast_uuid(os.cliente_id);;

CREATE OR REPLACE VIEW public."vw_relatorio_pagamento_detalhado" AS
 SELECT os.id AS os_id,
    os.numero AS os_numero,
    os.data,
    os.created_at,
    p.id AS prestador_id,
    COALESCE(p.nome_completo, 'Não identificado'::text) AS prestador_nome,
    COALESCE(p.cpf_cnpj, ''::text) AS prestador_cpf_cnpj,
    COALESCE(c.nome_fantasia, c.razao_social, 'Avulso'::text) AS cliente_nome,
    os.status,
    os.veiculo_tipo AS tipo_servico,
    COALESCE(os.valor_cliente, 0::numeric) AS valor_cliente,
    COALESCE(os.custo_prestador, 0::numeric) AS valor_prestador,
    COALESCE(os.pedagio, 0::numeric) AS pedagio,
    COALESCE(os.adicionais::numeric, 0::numeric) AS adicionais,
    COALESCE(os.descontos, 0::numeric) AS descontos,
    COALESCE(os.custo_prestador, 0::numeric) + COALESCE(os.adicionais::numeric, 0::numeric) - COALESCE(os.descontos, 0::numeric) AS valor_final_repasse,
    COALESCE(pp.status_pagamento, 'pendente'::text) AS status_pagamento,
    os.enderecos
   FROM ordens_servico os
     LEFT JOIN prestadores p ON p.id = try_cast_uuid(os.prestador_id)
     LEFT JOIN clientes c ON c.id = try_cast_uuid(os.cliente_id)
     LEFT JOIN pagamentos_prestadores pp ON pp.os_id = os.id;;

CREATE OR REPLACE VIEW public."vw_relatorio_pagamento_prestador" AS
 SELECT p.id AS prestador_id,
    COALESCE(p.nome_completo, 'Não identificado'::text) AS prestador_nome,
    COALESCE(p.cpf_cnpj, ''::text) AS prestador_cpf_cnpj,
    p.tipo_parceiro,
    p.status AS prestador_status,
    COALESCE(p.score_interno, 0::numeric) AS score,
    count(DISTINCT os.id) AS quantidade_operacoes,
    COALESCE(sum(os.custo_prestador), 0::numeric) AS valor_total_repasses,
    COALESCE(avg(os.custo_prestador), 0::numeric) AS media_operacional,
    min(os.data) AS primeira_operacao,
    max(os.data) AS ultima_operacao,
    COALESCE(sum(
        CASE
            WHEN pp.status_pagamento = ANY (ARRAY['pendente'::text, 'nao_pago'::text]) THEN os.custo_prestador
            ELSE 0::numeric
        END), 0::numeric) AS valor_pendente,
    COALESCE(sum(
        CASE
            WHEN pp.status_pagamento = 'pago'::text THEN os.custo_prestador
            ELSE 0::numeric
        END), 0::numeric) AS valor_pago
   FROM prestadores p
     LEFT JOIN ordens_servico os ON try_cast_uuid(os.prestador_id) = p.id AND os.status = 'finalizada'::text
     LEFT JOIN pagamentos_prestadores pp ON pp.prestador_id = p.id
  GROUP BY p.id, p.nome_completo, p.cpf_cnpj, p.tipo_parceiro, p.status, p.score_interno;;

CREATE OR REPLACE VIEW public."vw_relatorio_prestadores_analise" AS
 SELECT p.id AS prestador_id,
    COALESCE(p.nome_completo, 'Não identificado'::text) AS prestador_nome,
    COALESCE(p.cpf_cnpj, ''::text) AS cpf_cnpj,
    p.tipo_parceiro AS tipo_prestador,
    COALESCE(p.score_interno, 0::numeric) AS score,
    p.status AS status_operacional,
    count(DISTINCT v.id) AS quantidade_veiculos,
    COALESCE(string_agg(DISTINCT v.placa, ', '::text), ''::text) AS veiculos_placa,
    count(DISTINCT os.id) AS operacoes_realizadas,
    COALESCE(sum(os.custo_prestador), 0::numeric) AS valor_total_recebido,
    max(os.data) AS ultima_operacao,
    COALESCE(avg(os.custo_prestador), 0::numeric) AS media_por_operacao
   FROM prestadores p
     LEFT JOIN veiculos v ON v.prestador_vinculado = p.id
     LEFT JOIN ordens_servico os ON try_cast_uuid(os.prestador_id) = p.id AND os.status = 'finalizada'::text
  GROUP BY p.id, p.nome_completo, p.cpf_cnpj, p.tipo_parceiro, p.score_interno, p.status;;

CREATE OR REPLACE VIEW public."vw_route_stops_driver" AS
 SELECT id,
    alocacao_id AS operation_id,
    sequencia,
    COALESCE(destinatario, cliente_nome, ''::text) AS nome,
    COALESCE(endereco, ''::text) AS endereco,
    rota_id,
    janela_entrega AS janela_inicio,
    ''::text AS janela_fim,
    volumes::text AS volumes,
    peso::text AS peso,
    ''::text AS produto,
    nota_fiscal AS nf,
    contato,
    instrucoes,
    latitude,
    longitude,
    status,
    data_hora AS arrived_at,
    data_entrega AS completed_at,
    created_at,
    created_at AS updated_at
   FROM rota_paradas rp
  WHERE alocacao_id IS NOT NULL;;

-- ============================================================================
-- 10. TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS "trg_hml_cp_updated_at" ON public."_hml_seed_checkpoint";
CREATE TRIGGER trg_hml_cp_updated_at BEFORE UPDATE ON _hml_seed_checkpoint FOR EACH ROW EXECUTE FUNCTION update_hml_seed_checkpoint_updated_at();
DROP TRIGGER IF EXISTS "trg_agentes_ia_updated_at" ON public."agentes_ia_internos";
CREATE TRIGGER trg_agentes_ia_updated_at BEFORE UPDATE ON agentes_ia_internos FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();
DROP TRIGGER IF EXISTS "trg_alocacoes_escala_updated_at" ON public."alocacoes_escala";
CREATE TRIGGER trg_alocacoes_escala_updated_at BEFORE UPDATE ON alocacoes_escala FOR EACH ROW EXECUTE FUNCTION update_alocacoes_escala_updated_at();
DROP TRIGGER IF EXISTS "trg_cancelar_financeiro_alocacao" ON public."alocacoes_escala";
CREATE TRIGGER trg_cancelar_financeiro_alocacao BEFORE UPDATE OF status ON alocacoes_escala FOR EACH ROW WHEN (new.status = 'cancelada'::text AND old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION f_trg_cancelar_financeiro_alocacao();
DROP TRIGGER IF EXISTS "trg_evento_alocacao_cancelada" ON public."alocacoes_escala";
CREATE TRIGGER trg_evento_alocacao_cancelada AFTER UPDATE OF status ON alocacoes_escala FOR EACH ROW WHEN (new.status = 'cancelada'::text AND old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION trg_evento_alocacao_cancelada();
DROP TRIGGER IF EXISTS "trg_evento_alocacao_criada" ON public."alocacoes_escala";
CREATE TRIGGER trg_evento_alocacao_criada AFTER INSERT ON alocacoes_escala FOR EACH ROW EXECUTE FUNCTION trg_evento_alocacao_criada();
DROP TRIGGER IF EXISTS "trg_evento_alocacao_motorista_trocado" ON public."alocacoes_escala";
CREATE TRIGGER trg_evento_alocacao_motorista_trocado AFTER UPDATE OF prestador_id ON alocacoes_escala FOR EACH ROW WHEN (old.prestador_id IS DISTINCT FROM new.prestador_id) EXECUTE FUNCTION trg_evento_alocacao_motorista_trocado();
DROP TRIGGER IF EXISTS "trg_evento_alocacao_recusada" ON public."alocacoes_escala";
CREATE TRIGGER trg_evento_alocacao_recusada AFTER UPDATE OF status ON alocacoes_escala FOR EACH ROW WHEN (new.status = 'recusada'::text AND old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION trg_evento_alocacao_recusada();
DROP TRIGGER IF EXISTS "trg_evento_operacao_finalizada" ON public."alocacoes_escala";
CREATE TRIGGER trg_evento_operacao_finalizada AFTER UPDATE OF finalizada ON alocacoes_escala FOR EACH ROW WHEN (new.finalizada = true AND old.finalizada IS DISTINCT FROM new.finalizada AND new.status <> 'cancelada'::text) EXECUTE FUNCTION trg_evento_operacao_finalizada();
DROP TRIGGER IF EXISTS "trg_evento_prestador_aceitou" ON public."alocacoes_escala";
CREATE TRIGGER trg_evento_prestador_aceitou AFTER UPDATE OF aceite_prestador ON alocacoes_escala FOR EACH ROW WHEN (new.aceite_prestador = true AND old.aceite_prestador IS DISTINCT FROM new.aceite_prestador) EXECUTE FUNCTION trg_evento_prestador_aceitou();
DROP TRIGGER IF EXISTS "trg_propagar_financeiro_alocacao" ON public."alocacoes_escala";
CREATE TRIGGER trg_propagar_financeiro_alocacao AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse, valor_pedagio, valor_combustivel, valor_ajudante, valor_adicional, valor_desconto, valor_desconto_prestador, tipo_reversa, reversa_valor_cliente, reversa_valor_prestador, prestador_id ON alocacoes_escala FOR EACH ROW EXECUTE FUNCTION f_trg_propagar_financeiro_alocacao();
DROP TRIGGER IF EXISTS "trg_registrar_historico_alocacao" ON public."alocacoes_escala";
CREATE TRIGGER trg_registrar_historico_alocacao AFTER INSERT OR UPDATE ON alocacoes_escala FOR EACH ROW EXECUTE FUNCTION registrar_historico_alocacao();
DROP TRIGGER IF EXISTS "trg_gatilhos_updated_at" ON public."automacoes_gatilhos";
CREATE TRIGGER trg_gatilhos_updated_at BEFORE UPDATE ON automacoes_gatilhos FOR EACH ROW EXECUTE FUNCTION update_gatilhos_updated_at();
DROP TRIGGER IF EXISTS "trg_automacoes_instrucoes_ativa" ON public."automacoes_instrucoes";
CREATE TRIGGER trg_automacoes_instrucoes_ativa AFTER INSERT OR UPDATE OF ativo, status ON automacoes_instrucoes FOR EACH ROW WHEN (new.ativo = true AND new.status = 'publicado'::text) EXECUTE FUNCTION check_automacoes_instrucoes_ativa();
DROP TRIGGER IF EXISTS "trg_regras_operacao_updated_at" ON public."automacoes_regras_operacao";
CREATE TRIGGER trg_regras_operacao_updated_at BEFORE UPDATE ON automacoes_regras_operacao FOR EACH ROW EXECUTE FUNCTION update_regras_operacao_updated_at();
DROP TRIGGER IF EXISTS "trg_cert_updated_at" ON public."certificados_fiscais";
CREATE TRIGGER trg_cert_updated_at BEFORE UPDATE ON certificados_fiscais FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "trg_calcular_margens_financeiras_os" ON public."composicao_financeira_os";
CREATE TRIGGER trg_calcular_margens_financeiras_os BEFORE INSERT OR UPDATE ON composicao_financeira_os FOR EACH ROW EXECUTE FUNCTION calcular_margens_financeiras_os();
DROP TRIGGER IF EXISTS "trg_margem" ON public."composicao_financeira_os";
CREATE TRIGGER trg_margem BEFORE INSERT OR UPDATE ON composicao_financeira_os FOR EACH ROW EXECUTE FUNCTION calcular_margens_financeiras_os();
DROP TRIGGER IF EXISTS "trg_cf_updated_at" ON public."configuracoes_fiscais";
CREATE TRIGGER trg_cf_updated_at BEFORE UPDATE ON configuracoes_fiscais FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "update_configuracoes_fiscais_modtime" ON public."configuracoes_fiscais";
CREATE TRIGGER update_configuracoes_fiscais_modtime BEFORE UPDATE ON configuracoes_fiscais FOR EACH ROW EXECUTE FUNCTION update_configuracoes_fiscais_updated_at();
DROP TRIGGER IF EXISTS "trg_sync_delivery_proof_to_entregas" ON public."delivery_proofs";
CREATE TRIGGER trg_sync_delivery_proof_to_entregas AFTER INSERT ON delivery_proofs FOR EACH ROW EXECUTE FUNCTION f_sync_delivery_proof_to_entregas();
DROP TRIGGER IF EXISTS "trg_diretor_virtual_updated_at" ON public."diretor_virtual_ia";
CREATE TRIGGER trg_diretor_virtual_updated_at BEFORE UPDATE ON diretor_virtual_ia FOR EACH ROW EXECUTE FUNCTION update_diretor_virtual_updated_at();
DROP TRIGGER IF EXISTS "trg_enderecos_clientes_updated_at" ON public."enderecos_clientes";
CREATE TRIGGER trg_enderecos_clientes_updated_at BEFORE UPDATE ON enderecos_clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "trg_evento_pod_enviado" ON public."entregas_protocolo";
CREATE TRIGGER trg_evento_pod_enviado AFTER INSERT ON entregas_protocolo FOR EACH ROW EXECUTE FUNCTION trg_evento_pod_enviado();
DROP TRIGGER IF EXISTS "trg_escala_validacoes_insert" ON public."escala_operacional";
CREATE TRIGGER trg_escala_validacoes_insert AFTER INSERT OR UPDATE ON escala_operacional FOR EACH ROW EXECUTE FUNCTION trg_escala_validacoes();
DROP TRIGGER IF EXISTS "trg_event_bus_consumer" ON public."eventos_oficiais";
CREATE TRIGGER trg_event_bus_consumer AFTER INSERT ON eventos_oficiais FOR EACH ROW EXECUTE FUNCTION f_trg_event_bus_consumer();
DROP TRIGGER IF EXISTS "trg_eventos_oficiais_updated_at" ON public."eventos_oficiais";
CREATE TRIGGER trg_eventos_oficiais_updated_at BEFORE UPDATE ON eventos_oficiais FOR EACH ROW EXECUTE FUNCTION trg_eventos_oficiais_updated_at();
DROP TRIGGER IF EXISTS "trg_fatura_itens_anti_duplicidade" ON public."fatura_itens";
CREATE TRIGGER trg_fatura_itens_anti_duplicidade BEFORE INSERT OR UPDATE ON fatura_itens FOR EACH ROW EXECUTE FUNCTION f_trg_fatura_itens_anti_duplicidade();
DROP TRIGGER IF EXISTS "trg_fatura_itens_bloqueio_emissao" ON public."fatura_itens";
CREATE TRIGGER trg_fatura_itens_bloqueio_emissao BEFORE INSERT OR DELETE OR UPDATE ON fatura_itens FOR EACH ROW EXECUTE FUNCTION f_trg_fatura_itens_bloqueio_emissao();
DROP TRIGGER IF EXISTS "trg_fatura_itens_recalcular_totais" ON public."fatura_itens";
CREATE TRIGGER trg_fatura_itens_recalcular_totais AFTER INSERT OR DELETE OR UPDATE ON fatura_itens FOR EACH ROW EXECUTE FUNCTION f_recalcular_totais_fatura();
DROP TRIGGER IF EXISTS "trg_financeiro_baixas_updated_at" ON public."financeiro_baixas";
CREATE TRIGGER trg_financeiro_baixas_updated_at BEFORE UPDATE ON financeiro_baixas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "trg_guardar_pagar_pago_sem_baixa" ON public."financeiro_pagar";
CREATE TRIGGER trg_guardar_pagar_pago_sem_baixa BEFORE INSERT OR UPDATE OF status ON financeiro_pagar FOR EACH ROW EXECUTE FUNCTION trg_guardar_pagar_pago_sem_baixa();
DROP TRIGGER IF EXISTS "trg_evento_financeiro_receber_criado" ON public."financeiro_receber";
CREATE TRIGGER trg_evento_financeiro_receber_criado AFTER INSERT ON financeiro_receber FOR EACH ROW EXECUTE FUNCTION trg_evento_financeiro_receber_criado();
DROP TRIGGER IF EXISTS "trg_evento_financeiro_receber_pago" ON public."financeiro_receber";
CREATE TRIGGER trg_evento_financeiro_receber_pago AFTER UPDATE OF status ON financeiro_receber FOR EACH ROW EXECUTE FUNCTION trg_evento_financeiro_receber_pago();
DROP TRIGGER IF EXISTS "trg_guardar_receber_pago_sem_baixa" ON public."financeiro_receber";
CREATE TRIGGER trg_guardar_receber_pago_sem_baixa BEFORE INSERT OR UPDATE OF status ON financeiro_receber FOR EACH ROW EXECUTE FUNCTION trg_guardar_receber_pago_sem_baixa();
DROP TRIGGER IF EXISTS "update_fiscal_ctes_modtime" ON public."fiscal_ctes";
CREATE TRIGGER update_fiscal_ctes_modtime BEFORE UPDATE ON fiscal_ctes FOR EACH ROW EXECUTE FUNCTION update_fiscal_updated_at_column();
DROP TRIGGER IF EXISTS "trg_fdv_updated_at" ON public."fiscal_documentos_vinculados";
CREATE TRIGGER trg_fdv_updated_at BEFORE UPDATE ON fiscal_documentos_vinculados FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "update_fiscal_docs_modtime" ON public."fiscal_documentos_vinculados";
CREATE TRIGGER update_fiscal_docs_modtime BEFORE UPDATE ON fiscal_documentos_vinculados FOR EACH ROW EXECUTE FUNCTION update_fiscal_updated_at_column();
DROP TRIGGER IF EXISTS "update_fiscal_mdfes_modtime" ON public."fiscal_mdfes";
CREATE TRIGGER update_fiscal_mdfes_modtime BEFORE UPDATE ON fiscal_mdfes FOR EACH ROW EXECUTE FUNCTION update_fiscal_updated_at_column();
DROP TRIGGER IF EXISTS "update_fiscal_nfse_modtime" ON public."fiscal_nfse";
CREATE TRIGGER update_fiscal_nfse_modtime BEFORE UPDATE ON fiscal_nfse FOR EACH ROW EXECUTE FUNCTION update_fiscal_updated_at_column();
DROP TRIGGER IF EXISTS "trg_fornecedores_updated_at" ON public."fornecedores";
CREATE TRIGGER trg_fornecedores_updated_at BEFORE UPDATE ON fornecedores FOR EACH ROW EXECUTE FUNCTION fornecedores_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_agenda_atividades_updated_at" ON public."ia_agenda_atividades";
CREATE TRIGGER trg_ia_agenda_atividades_updated_at BEFORE UPDATE ON ia_agenda_atividades FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_agenda_trabalho_updated_at" ON public."ia_agenda_trabalho";
CREATE TRIGGER trg_ia_agenda_trabalho_updated_at BEFORE UPDATE ON ia_agenda_trabalho FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_agentes_execucao_updated_at" ON public."ia_agentes_execucao";
CREATE TRIGGER trg_ia_agentes_execucao_updated_at BEFORE UPDATE ON ia_agentes_execucao FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_aprovacoes_fila_updated_at" ON public."ia_aprovacoes_fila";
CREATE TRIGGER trg_aprovacoes_fila_updated_at BEFORE UPDATE ON ia_aprovacoes_fila FOR EACH ROW EXECUTE FUNCTION f35_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_aprovacoes_atualizado_em" ON public."ia_aprovacoes_humanas";
CREATE TRIGGER trg_ia_aprovacoes_atualizado_em BEFORE UPDATE ON ia_aprovacoes_humanas FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
DROP TRIGGER IF EXISTS "trg_autoridade_updated_at" ON public."ia_autoridade_acoes";
CREATE TRIGGER trg_autoridade_updated_at BEFORE UPDATE ON ia_autoridade_acoes FOR EACH ROW EXECUTE FUNCTION f35_updated_at();
DROP TRIGGER IF EXISTS "trg_comunicacoes_robos_updated_at" ON public."ia_comunicacoes_robos";
CREATE TRIGGER trg_comunicacoes_robos_updated_at BEFORE UPDATE ON ia_comunicacoes_robos FOR EACH ROW EXECUTE FUNCTION update_comunicacoes_robos_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_conhecimento_atualizado_em" ON public."ia_conhecimento";
CREATE TRIGGER trg_ia_conhecimento_atualizado_em BEFORE UPDATE ON ia_conhecimento FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
DROP TRIGGER IF EXISTS "trg_ia_credenciais_updated_at" ON public."ia_credenciais";
CREATE TRIGGER trg_ia_credenciais_updated_at BEFORE UPDATE ON ia_credenciais FOR EACH ROW EXECUTE FUNCTION f36_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_credenciais_zoho_atualizado" ON public."ia_credenciais_zoho";
CREATE TRIGGER trg_ia_credenciais_zoho_atualizado BEFORE UPDATE ON ia_credenciais_zoho FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp_credenciais_zoho();
DROP TRIGGER IF EXISTS "trg_ia_fila_trabalho_updated_at" ON public."ia_fila_trabalho";
CREATE TRIGGER trg_ia_fila_trabalho_updated_at BEFORE UPDATE ON ia_fila_trabalho FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_fluxos_empresa_updated" ON public."ia_fluxos_empresa";
CREATE TRIGGER trg_fluxos_empresa_updated BEFORE UPDATE ON ia_fluxos_empresa FOR EACH ROW EXECUTE FUNCTION f39_updated_at();
DROP TRIGGER IF EXISTS "trg_fluxos_etapas_updated" ON public."ia_fluxos_etapas";
CREATE TRIGGER trg_fluxos_etapas_updated BEFORE UPDATE ON ia_fluxos_etapas FOR EACH ROW EXECUTE FUNCTION f39_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_identidades_updated_at" ON public."ia_identidades";
CREATE TRIGGER trg_ia_identidades_updated_at BEFORE UPDATE ON ia_identidades FOR EACH ROW EXECUTE FUNCTION f36_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_kpis_robo_updated" ON public."ia_kpis_robo";
CREATE TRIGGER trg_ia_kpis_robo_updated BEFORE UPDATE ON ia_kpis_robo FOR EACH ROW EXECUTE FUNCTION f38_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_limites_operacionais_updated_at" ON public."ia_limites_operacionais";
CREATE TRIGGER trg_ia_limites_operacionais_updated_at BEFORE UPDATE ON ia_limites_operacionais FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_logs_escalonamento_insert" ON public."ia_logs";
CREATE TRIGGER trg_ia_logs_escalonamento_insert AFTER INSERT ON ia_logs FOR EACH ROW EXECUTE FUNCTION trg_ia_logs_escalonamento();
DROP TRIGGER IF EXISTS "trg_ia_metas_updated_at" ON public."ia_metas";
CREATE TRIGGER trg_ia_metas_updated_at BEFORE UPDATE ON ia_metas FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_missoes_updated_at" ON public."ia_missoes";
CREATE TRIGGER trg_ia_missoes_updated_at BEFORE UPDATE ON ia_missoes FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_missoes_exec_updated" ON public."ia_missoes_execucao";
CREATE TRIGGER trg_ia_missoes_exec_updated BEFORE UPDATE ON ia_missoes_execucao FOR EACH ROW EXECUTE FUNCTION f38_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_modelos_atualizado_em" ON public."ia_modelos_mensagem";
CREATE TRIGGER trg_ia_modelos_atualizado_em BEFORE UPDATE ON ia_modelos_mensagem FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
DROP TRIGGER IF EXISTS "trg_ia_regras_atualizado_em" ON public."ia_regras";
CREATE TRIGGER trg_ia_regras_atualizado_em BEFORE UPDATE ON ia_regras FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
DROP TRIGGER IF EXISTS "trg_ia_score_robo_updated" ON public."ia_score_robo";
CREATE TRIGGER trg_ia_score_robo_updated BEFORE UPDATE ON ia_score_robo FOR EACH ROW EXECUTE FUNCTION f38_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_sessoes_updated_at" ON public."ia_sessoes_operacionais";
CREATE TRIGGER trg_ia_sessoes_updated_at BEFORE UPDATE ON ia_sessoes_operacionais FOR EACH ROW EXECUTE FUNCTION f36_updated_at();
DROP TRIGGER IF EXISTS "trg_ia_setores_atualizado_em" ON public."ia_setores";
CREATE TRIGGER trg_ia_setores_atualizado_em BEFORE UPDATE ON ia_setores FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
DROP TRIGGER IF EXISTS "trg_ia_tarefas_atualizado_em" ON public."ia_tarefas_automaticas";
CREATE TRIGGER trg_ia_tarefas_atualizado_em BEFORE UPDATE ON ia_tarefas_automaticas FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
DROP TRIGGER IF EXISTS "trg_ia_trabalhos_updated_at" ON public."ia_trabalhos";
CREATE TRIGGER trg_ia_trabalhos_updated_at BEFORE UPDATE ON ia_trabalhos FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_integracoes_config_atualizado_em" ON public."integracoes_config";
CREATE TRIGGER trg_integracoes_config_atualizado_em BEFORE UPDATE ON integracoes_config FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
DROP TRIGGER IF EXISTS "trg_memoria_conversas_updated_at" ON public."memoria_conversas";
CREATE TRIGGER trg_memoria_conversas_updated_at BEFORE UPDATE ON memoria_conversas FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_memoria_entidades_updated_at" ON public."memoria_entidades";
CREATE TRIGGER trg_memoria_entidades_updated_at BEFORE UPDATE ON memoria_entidades FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_memoria_preferencias_updated_at" ON public."memoria_preferencias";
CREATE TRIGGER trg_memoria_preferencias_updated_at BEFORE UPDATE ON memoria_preferencias FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();
DROP TRIGGER IF EXISTS "trg_ocorrencias_updated_at" ON public."ocorrencias";
CREATE TRIGGER trg_ocorrencias_updated_at BEFORE UPDATE ON ocorrencias FOR EACH ROW EXECUTE FUNCTION ocorrencias_updated_at();
DROP TRIGGER IF EXISTS "trg_operacao_localizacao_update" ON public."operacao_localizacao";
CREATE TRIGGER trg_operacao_localizacao_update BEFORE INSERT OR UPDATE ON operacao_localizacao FOR EACH ROW EXECUTE FUNCTION update_operacao_localizacao_timestamp();
DROP TRIGGER IF EXISTS "trg_evento_os_cancelada" ON public."ordens_servico";
CREATE TRIGGER trg_evento_os_cancelada AFTER UPDATE OF status ON ordens_servico FOR EACH ROW WHEN (new.status = 'cancelada'::text AND old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION trg_evento_os_cancelada();
DROP TRIGGER IF EXISTS "trg_evento_os_criada" ON public."ordens_servico";
CREATE TRIGGER trg_evento_os_criada AFTER INSERT ON ordens_servico FOR EACH ROW EXECUTE FUNCTION trg_evento_os_criada();
DROP TRIGGER IF EXISTS "trg_evento_os_finalizada" ON public."ordens_servico";
CREATE TRIGGER trg_evento_os_finalizada AFTER UPDATE OF status ON ordens_servico FOR EACH ROW WHEN ((new.status = ANY (ARRAY['finalizada'::text, 'encerrada'::text])) AND old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION trg_evento_os_finalizada();
DROP TRIGGER IF EXISTS "trg_evento_os_status_changed" ON public."ordens_servico";
CREATE TRIGGER trg_evento_os_status_changed AFTER UPDATE OF status ON ordens_servico FOR EACH ROW WHEN (old.status IS DISTINCT FROM new.status) EXECUTE FUNCTION trg_evento_os_status_changed();
DROP TRIGGER IF EXISTS "trg_notificar_os_para_app" ON public."ordens_servico";
CREATE TRIGGER trg_notificar_os_para_app AFTER INSERT OR UPDATE OF prestador_id ON ordens_servico FOR EACH ROW EXECUTE FUNCTION f_trg_notificar_os_para_app();
DROP TRIGGER IF EXISTS "trg_propagar_financeiro_os" ON public."ordens_servico";
CREATE TRIGGER trg_propagar_financeiro_os AFTER INSERT OR UPDATE OF valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos, status ON ordens_servico FOR EACH ROW WHEN (new.status IS DISTINCT FROM 'cancelada'::text) EXECUTE FUNCTION f_trg_propagar_financeiro_os();
DROP TRIGGER IF EXISTS "trg_patio_checkins_updated_at" ON public."patio_checkins";
CREATE TRIGGER trg_patio_checkins_updated_at BEFORE UPDATE ON patio_checkins FOR EACH ROW EXECUTE FUNCTION update_patio_updated_at();
DROP TRIGGER IF EXISTS "trg_patio_docas_updated_at" ON public."patio_docas";
CREATE TRIGGER trg_patio_docas_updated_at BEFORE UPDATE ON patio_docas FOR EACH ROW EXECUTE FUNCTION update_patio_updated_at();
DROP TRIGGER IF EXISTS "trg_patio_fila_updated_at" ON public."patio_fila";
CREATE TRIGGER trg_patio_fila_updated_at BEFORE UPDATE ON patio_fila FOR EACH ROW EXECUTE FUNCTION update_patio_updated_at();
DROP TRIGGER IF EXISTS "trg_patio_regras_updated_at" ON public."patio_regras_fila";
CREATE TRIGGER trg_patio_regras_updated_at BEFORE UPDATE ON patio_regras_fila FOR EACH ROW EXECUTE FUNCTION update_patio_updated_at();
DROP TRIGGER IF EXISTS "trg_patio_rodizio_updated_at" ON public."patio_rodizio";
CREATE TRIGGER trg_patio_rodizio_updated_at BEFORE UPDATE ON patio_rodizio FOR EACH ROW EXECUTE FUNCTION update_patio_updated_at();
DROP TRIGGER IF EXISTS "trg_patio_unidades_updated_at" ON public."patio_unidades";
CREATE TRIGGER trg_patio_unidades_updated_at BEFORE UPDATE ON patio_unidades FOR EACH ROW EXECUTE FUNCTION update_patio_updated_at();
DROP TRIGGER IF EXISTS "trg_evento_portal_ocorrencia_aberta" ON public."portal_ocorrencias";
CREATE TRIGGER trg_evento_portal_ocorrencia_aberta AFTER INSERT ON portal_ocorrencias FOR EACH ROW EXECUTE FUNCTION trg_evento_portal_ocorrencia_aberta();
DROP TRIGGER IF EXISTS "update_portal_ocorrencias_updated_at" ON public."portal_ocorrencias";
CREATE TRIGGER update_portal_ocorrencias_updated_at BEFORE UPDATE ON portal_ocorrencias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "trg_evento_portal_pedido_criado" ON public."portal_pedidos";
CREATE TRIGGER trg_evento_portal_pedido_criado AFTER INSERT ON portal_pedidos FOR EACH ROW EXECUTE FUNCTION trg_evento_portal_pedido_criado();
DROP TRIGGER IF EXISTS "trg_impedir_duplicidade_pedido" ON public."portal_pedidos";
CREATE TRIGGER trg_impedir_duplicidade_pedido BEFORE UPDATE OF status ON portal_pedidos FOR EACH ROW EXECUTE FUNCTION f_trg_impedir_duplicidade_pedido();
DROP TRIGGER IF EXISTS "update_portal_pedidos_updated_at" ON public."portal_pedidos";
CREATE TRIGGER update_portal_pedidos_updated_at BEFORE UPDATE ON portal_pedidos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_portal_preferencias_updated_at" ON public."portal_preferencias_cliente";
CREATE TRIGGER update_portal_preferencias_updated_at BEFORE UPDATE ON portal_preferencias_cliente FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "update_portal_rotas_updated_at" ON public."portal_rotas";
CREATE TRIGGER update_portal_rotas_updated_at BEFORE UPDATE ON portal_rotas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "trg_atualizar_status_alocacao_tracking" ON public."portal_tracking_realtime";
CREATE TRIGGER trg_atualizar_status_alocacao_tracking AFTER INSERT ON portal_tracking_realtime FOR EACH ROW EXECUTE FUNCTION f_trg_atualizar_status_alocacao_tracking();
DROP TRIGGER IF EXISTS "trg_sync_tracking_to_oper_localizacao" ON public."portal_tracking_realtime";
CREATE TRIGGER trg_sync_tracking_to_oper_localizacao AFTER INSERT ON portal_tracking_realtime FOR EACH ROW EXECUTE FUNCTION f_sync_tracking_to_oper_localizacao();
DROP TRIGGER IF EXISTS "trg_tracking_iniciado" ON public."portal_tracking_realtime";
CREATE TRIGGER trg_tracking_iniciado AFTER INSERT ON portal_tracking_realtime FOR EACH ROW EXECUTE FUNCTION f_trg_tracking_iniciado();
DROP TRIGGER IF EXISTS "trg_bridge_prestador_para_recrutamento" ON public."prestadores";
CREATE TRIGGER trg_bridge_prestador_para_recrutamento AFTER INSERT ON prestadores FOR EACH ROW EXECUTE FUNCTION f_bridge_prestador_para_recrutamento();
DROP TRIGGER IF EXISTS "set_prestadores_app_updated_at" ON public."prestadores_app";
CREATE TRIGGER set_prestadores_app_updated_at BEFORE UPDATE ON prestadores_app FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "trg_rascunhos_updated_at" ON public."rascunhos_prestador";
CREATE TRIGGER trg_rascunhos_updated_at BEFORE UPDATE ON rascunhos_prestador FOR EACH ROW EXECUTE FUNCTION fn_rascunhos_updated_at();
DROP TRIGGER IF EXISTS "trg_rec_automacoes_updated_at" ON public."recrutamento_automacoes";
CREATE TRIGGER trg_rec_automacoes_updated_at BEFORE UPDATE ON recrutamento_automacoes FOR EACH ROW EXECUTE FUNCTION f_rec_automacoes_updated_at();
DROP TRIGGER IF EXISTS "trg_novo_candidato_evento" ON public."recrutamento_candidatos";
CREATE TRIGGER trg_novo_candidato_evento AFTER INSERT ON recrutamento_candidatos FOR EACH ROW EXECUTE FUNCTION f_trg_novo_candidato_evento();
DROP TRIGGER IF EXISTS "trg_score_limiar_evento" ON public."recrutamento_candidatos";
CREATE TRIGGER trg_score_limiar_evento AFTER UPDATE OF score ON recrutamento_candidatos FOR EACH ROW WHEN (old.score IS DISTINCT FROM new.score) EXECUTE FUNCTION f_trg_score_limiar_evento();
DROP TRIGGER IF EXISTS "trg_validade_documento_evento" ON public."recrutamento_candidatos";
CREATE TRIGGER trg_validade_documento_evento AFTER INSERT OR UPDATE OF documentos ON recrutamento_candidatos FOR EACH ROW EXECUTE FUNCTION f_trg_validade_documento_evento();
DROP TRIGGER IF EXISTS "trg_notificar_oportunidade_rede" ON public."rede_oportunidades";
CREATE TRIGGER trg_notificar_oportunidade_rede AFTER INSERT ON rede_oportunidades FOR EACH ROW EXECUTE FUNCTION f_trg_notificar_oportunidade_rede();
DROP TRIGGER IF EXISTS "trg_rede_oportunidades_expiracao" ON public."rede_oportunidades";
CREATE TRIGGER trg_rede_oportunidades_expiracao BEFORE INSERT OR UPDATE ON rede_oportunidades FOR EACH ROW EXECUTE FUNCTION f_trg_expiracao_oportunidade();
DROP TRIGGER IF EXISTS "trg_rede_oportunidades_updated_at" ON public."rede_oportunidades";
CREATE TRIGGER trg_rede_oportunidades_updated_at BEFORE UPDATE ON rede_oportunidades FOR EACH ROW EXECUTE FUNCTION f_trg_rede_updated_at();
DROP TRIGGER IF EXISTS "trg_rp_derivar_prestador" ON public."reembolsos_prestador";
CREATE TRIGGER trg_rp_derivar_prestador BEFORE INSERT ON reembolsos_prestador FOR EACH ROW EXECUTE FUNCTION trg_f_derivar_reembolso_prestador();
DROP TRIGGER IF EXISTS "trg_rp_updated_at" ON public."reembolsos_prestador";
CREATE TRIGGER trg_rp_updated_at BEFORE UPDATE ON reembolsos_prestador FOR EACH ROW EXECUTE FUNCTION update_reembolsos_prestador_updated_at();
DROP TRIGGER IF EXISTS "trg_rfc_updated_at" ON public."regras_fiscais_cte";
CREATE TRIGGER trg_rfc_updated_at BEFORE UPDATE ON regras_fiscais_cte FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS "update_regras_fiscais_cte_modtime" ON public."regras_fiscais_cte";
CREATE TRIGGER update_regras_fiscais_cte_modtime BEFORE UPDATE ON regras_fiscais_cte FOR EACH ROW EXECUTE FUNCTION update_regras_fiscais_cte_updated_at();
DROP TRIGGER IF EXISTS "update_regras_fiscais_nfse_modtime" ON public."regras_fiscais_nfse";
CREATE TRIGGER update_regras_fiscais_nfse_modtime BEFORE UPDATE ON regras_fiscais_nfse FOR EACH ROW EXECUTE FUNCTION update_regras_fiscais_nfse_updated_at();
DROP TRIGGER IF EXISTS "trg_rotinas_ia_updated_at" ON public."rotinas_ia";
CREATE TRIGGER trg_rotinas_ia_updated_at BEFORE UPDATE ON rotinas_ia FOR EACH ROW EXECUTE FUNCTION update_rotinas_ia_updated_at();
DROP TRIGGER IF EXISTS "trigger_update_seguros_apolices" ON public."seguros_apolices";
CREATE TRIGGER trigger_update_seguros_apolices BEFORE UPDATE ON seguros_apolices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "trigger_update_sinistros_updated_at" ON public."sinistros";
CREATE TRIGGER trigger_update_sinistros_updated_at BEFORE UPDATE ON sinistros FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS "trg_tabela_prestador_version" ON public."tabela_prestador";
CREATE TRIGGER trg_tabela_prestador_version BEFORE UPDATE ON tabela_prestador FOR EACH ROW EXECUTE FUNCTION f_log_tabela_alteracao();
DROP TRIGGER IF EXISTS "trg_tabelas_valores_version" ON public."tabelas_valores";
CREATE TRIGGER trg_tabelas_valores_version BEFORE UPDATE ON tabelas_valores FOR EACH ROW EXECUTE FUNCTION f_log_tabela_alteracao();
DROP TRIGGER IF EXISTS "trg_tu_updated_at" ON public."tenant_usuarios";
CREATE TRIGGER trg_tu_updated_at BEFORE UPDATE ON tenant_usuarios FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();
DROP TRIGGER IF EXISTS "trg_tenants_updated_at" ON public."tenants";
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_tenants_updated_at();
DROP TRIGGER IF EXISTS "trg_whatsapp_conversas_atualizado_em" ON public."whatsapp_conversas";
CREATE TRIGGER trg_whatsapp_conversas_atualizado_em BEFORE UPDATE ON whatsapp_conversas FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();
DROP TRIGGER IF EXISTS "trg_whatsapp_instancias_atualizado_em" ON public."whatsapp_instancias";
CREATE TRIGGER trg_whatsapp_instancias_atualizado_em BEFORE UPDATE ON whatsapp_instancias FOR EACH ROW EXECUTE FUNCTION atualizar_atualizado_em();

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================================
ALTER TABLE public."academia_cursos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."academia_materiais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."academia_progresso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."agentes_ia_internos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."alocacoes_escala" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."auth_eventos_auditoria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."automacoes_aprovacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."automacoes_execucoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."automacoes_fila" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."automacoes_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."automacoes_regras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."automacoes_robos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."automacoes_tarefas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."biblioteca_documentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."campanhas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."candidato_documentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."candidatos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."central_integracoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."centros_custo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."certificados_fiscais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."clientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."clientes_contratos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."communication_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."communication_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."communication_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."composicao_financeira" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."composicao_financeira_os" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."comunicacoes_destinatarios_autorizados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."comunicacoes_mensagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."configuracoes_fiscais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."configuracoes_sistema" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contas_financeiras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contratos_gerados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contratos_historico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contratos_modelos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contratos_operacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contratos_operacao_execucao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contratos_operacao_rotas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."convites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."criativos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_conversas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_followups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_historico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_interacoes_prestadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_mensagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."crm_templates_mensagem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."delivery_proofs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."despesas_operacionais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."diretor_virtual_decisoes_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."diretor_virtual_eventos_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."diretor_virtual_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."diretor_virtual_metricas_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."documentos_prestadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."driver_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."driver_operations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."driver_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."enderecos_cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."enderecos_clientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."entregas_protocolo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."escalonamentos_humanos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."eventos_oficiais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fatura_itens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."faturas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."filiais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."financeiro_baixas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."financeiro_pagar" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."financeiro_receber" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."financeiro_transferencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fiscal_ctes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fiscal_documentos_vinculados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fiscal_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fiscal_historico_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fiscal_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fiscal_mdfes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fiscal_nfse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fluxo_recrutamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fornecedores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."historico_alocacoes_escala" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."homologacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_agenda_atividades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_agenda_trabalho" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_agentes_execucao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_aprendizado_eventos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_aprovacoes_fila" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_aprovacoes_humanas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_auditoria_performance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_autoridade_acoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_comunicacoes_fila_robos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_comunicacoes_robos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_conector_robo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_conectores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_conhecimento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_conhecimento_distribuicao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_contextos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_credenciais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_credenciais_zoho" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_decisoes_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_escalonamento_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_execucoes_conectores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_execucoes_ferramentas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_ferramentas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_fila_trabalho" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_fluxos_empresa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_fluxos_etapas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_fluxos_execucao_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_governanca_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_historico_indicadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_historico_trabalho" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_identidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_indicadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_insights_automaticos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_integracoes_externas_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_kpis_robo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_limites_operacionais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_metas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_missoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_missoes_execucao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_modelos_mensagem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_providers_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_regras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_robo_ferramentas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_score_robo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_sessoes_operacionais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_setores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_sugestoes_melhoria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_tarefas_automaticas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_trabalhos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ia_versoes_sistema" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."integracoes_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."integracoes_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."memoria_conhecimento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."memoria_conversas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."memoria_entidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."memoria_eventos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."memoria_preferencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."memoria_resumos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."modelos_mensagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."municipios_ibge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ocorrencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."operacao_localizacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."operacao_mensagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."operacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."operation_km" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."operation_timeline_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."orcamentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ordens_servico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."os_historico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."os_ocorrencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."os_pod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pagamento_prestadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pagamentos_prestadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pagamentos_prestadores_itens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patio_alertas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patio_checkins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patio_docas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patio_eventos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patio_fila" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patio_regras_fila" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patio_rodizio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."patio_unidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pending_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."perfis_permissoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."permissoes_prestador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_avaliacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_comprovantes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_faturas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_notificacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_ocorrencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_pedidos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_preferencias_cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_protocolos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_relatorios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_rotas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."portal_tracking_realtime" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."postagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."prestador_disponibilidade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."prestador_os" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."prestadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."prestadores_app" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."prestadores_ocorrencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."processamento_fila" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."provider_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."raciocinio_auditoria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rascunhos_prestador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recibos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recrutamento_automacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recrutamento_candidatos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recrutamento_ia_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recrutamento_operacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recrutamento_prestadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recrutamento_whatsapp_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recrutamento_whatsapp_conversas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."recrutamento_whatsapp_mensagens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rede_oportunidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rede_visualizacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reembolsos_prestador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."regioes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."regras_fiscais_cte" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."regras_fiscais_nfse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."roles_permissoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rota_execucoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rota_paradas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rotas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rotinas_execucoes_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rotinas_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."route_stops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."seguros_apolices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sinistros" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tabela_prestador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tabela_prestador_operacional" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tabela_valores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tabelas_valores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenant_usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tracking_public_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."treinamento_arquivos_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."unidades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."usuarios_cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."veiculos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."webhooks_recebidos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."whatsapp_conversas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."whatsapp_instancias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."whatsapp_mensagens" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academia_cursos_delete" ON public."academia_cursos";
CREATE POLICY "academia_cursos_delete" ON public."academia_cursos" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "academia_cursos_insert" ON public."academia_cursos";
CREATE POLICY "academia_cursos_insert" ON public."academia_cursos" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "academia_cursos_select" ON public."academia_cursos";
CREATE POLICY "academia_cursos_select" ON public."academia_cursos" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "academia_cursos_update" ON public."academia_cursos";
CREATE POLICY "academia_cursos_update" ON public."academia_cursos" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "academia_materiais_delete" ON public."academia_materiais";
CREATE POLICY "academia_materiais_delete" ON public."academia_materiais" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "academia_materiais_insert" ON public."academia_materiais";
CREATE POLICY "academia_materiais_insert" ON public."academia_materiais" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "academia_materiais_select" ON public."academia_materiais";
CREATE POLICY "academia_materiais_select" ON public."academia_materiais" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "academia_materiais_update" ON public."academia_materiais";
CREATE POLICY "academia_materiais_update" ON public."academia_materiais" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "academia_progresso_delete" ON public."academia_progresso";
CREATE POLICY "academia_progresso_delete" ON public."academia_progresso" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "academia_progresso_insert" ON public."academia_progresso";
CREATE POLICY "academia_progresso_insert" ON public."academia_progresso" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "academia_progresso_select" ON public."academia_progresso";
CREATE POLICY "academia_progresso_select" ON public."academia_progresso" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "academia_progresso_update" ON public."academia_progresso";
CREATE POLICY "academia_progresso_update" ON public."academia_progresso" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "agentes_ia_admin_all" ON public."agentes_ia_internos";
CREATE POLICY "agentes_ia_admin_all" ON public."agentes_ia_internos" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "agentes_ia_select_anon" ON public."agentes_ia_internos";
CREATE POLICY "agentes_ia_select_anon" ON public."agentes_ia_internos" FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "Prestador can update own alocacoes" ON public."alocacoes_escala";
CREATE POLICY "Prestador can update own alocacoes" ON public."alocacoes_escala" FOR UPDATE TO authenticated USING ((prestador_id IN ( SELECT prestadores.id
   FROM prestadores
  WHERE prestadores.auth_user_id = auth.uid()))) WITH CHECK ((prestador_id IN ( SELECT prestadores.id
   FROM prestadores
  WHERE prestadores.auth_user_id = auth.uid())));
DROP POLICY IF EXISTS "Prestador can view own alocacoes" ON public."alocacoes_escala";
CREATE POLICY "Prestador can view own alocacoes" ON public."alocacoes_escala" FOR SELECT TO authenticated USING ((prestador_id IN ( SELECT prestadores.id
   FROM prestadores
  WHERE prestadores.auth_user_id = auth.uid())));
DROP POLICY IF EXISTS "ae_delete_tms" ON public."alocacoes_escala";
CREATE POLICY "ae_delete_tms" ON public."alocacoes_escala" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios tu
  WHERE tu.user_id = auth.uid() AND tu.tenant_id = alocacoes_escala.tenant_id AND tu.status = 'ativo'::text)));
DROP POLICY IF EXISTS "ae_insert_tms" ON public."alocacoes_escala";
CREATE POLICY "ae_insert_tms" ON public."alocacoes_escala" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios tu
  WHERE tu.user_id = auth.uid() AND tu.tenant_id = alocacoes_escala.tenant_id AND tu.status = 'ativo'::text)));
DROP POLICY IF EXISTS "ae_select_cliente" ON public."alocacoes_escala";
CREATE POLICY "ae_select_cliente" ON public."alocacoes_escala" FOR SELECT TO authenticated USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "ae_select_tms" ON public."alocacoes_escala";
CREATE POLICY "ae_select_tms" ON public."alocacoes_escala" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios tu
  WHERE tu.user_id = auth.uid() AND tu.tenant_id = alocacoes_escala.tenant_id AND tu.status = 'ativo'::text)));
DROP POLICY IF EXISTS "ae_update_tms" ON public."alocacoes_escala";
CREATE POLICY "ae_update_tms" ON public."alocacoes_escala" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios tu
  WHERE tu.user_id = auth.uid() AND tu.tenant_id = alocacoes_escala.tenant_id AND tu.status = 'ativo'::text))) WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios tu
  WHERE tu.user_id = auth.uid() AND tu.tenant_id = alocacoes_escala.tenant_id AND tu.status = 'ativo'::text)));
DROP POLICY IF EXISTS "auth_eventos_insert_anon" ON public."auth_eventos_auditoria";
CREATE POLICY "auth_eventos_insert_anon" ON public."auth_eventos_auditoria" FOR INSERT TO authenticated, anon WITH CHECK (true);
DROP POLICY IF EXISTS "auth_eventos_select_auth" ON public."auth_eventos_auditoria";
CREATE POLICY "auth_eventos_select_auth" ON public."auth_eventos_auditoria" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auto_aprovacoes_admin_all" ON public."automacoes_aprovacoes";
CREATE POLICY "auto_aprovacoes_admin_all" ON public."automacoes_aprovacoes" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir tudo em automacoes_execucoes" ON public."automacoes_execucoes";
CREATE POLICY "Permitir tudo em automacoes_execucoes" ON public."automacoes_execucoes" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Permitir tudo em automacoes_fila" ON public."automacoes_fila";
CREATE POLICY "Permitir tudo em automacoes_fila" ON public."automacoes_fila" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "auto_logs_admin_all" ON public."automacoes_logs";
CREATE POLICY "auto_logs_admin_all" ON public."automacoes_logs" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir tudo em automacoes_regras" ON public."automacoes_regras";
CREATE POLICY "Permitir tudo em automacoes_regras" ON public."automacoes_regras" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "automacoes_robos_admin_all" ON public."automacoes_robos";
CREATE POLICY "automacoes_robos_admin_all" ON public."automacoes_robos" FOR ALL TO public USING (auth.role() = 'authenticated'::text) WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "auto_tarefas_admin_all" ON public."automacoes_tarefas";
CREATE POLICY "auto_tarefas_admin_all" ON public."automacoes_tarefas" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bd_delete" ON public."biblioteca_documentos";
CREATE POLICY "bd_delete" ON public."biblioteca_documentos" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "bd_insert" ON public."biblioteca_documentos";
CREATE POLICY "bd_insert" ON public."biblioteca_documentos" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "bd_select" ON public."biblioteca_documentos";
CREATE POLICY "bd_select" ON public."biblioteca_documentos" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bd_update" ON public."biblioteca_documentos";
CREATE POLICY "bd_update" ON public."biblioteca_documentos" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "candidato_documentos_delete" ON public."candidato_documentos";
CREATE POLICY "candidato_documentos_delete" ON public."candidato_documentos" FOR DELETE TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "candidato_documentos_insert" ON public."candidato_documentos";
CREATE POLICY "candidato_documentos_insert" ON public."candidato_documentos" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "candidato_documentos_select" ON public."candidato_documentos";
CREATE POLICY "candidato_documentos_select" ON public."candidato_documentos" FOR SELECT TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "candidato_documentos_update" ON public."candidato_documentos";
CREATE POLICY "candidato_documentos_update" ON public."candidato_documentos" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "candidatos_insert" ON public."candidatos";
CREATE POLICY "candidatos_insert" ON public."candidatos" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text OR auth.role() = 'anon'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "candidatos_select" ON public."candidatos";
CREATE POLICY "candidatos_select" ON public."candidatos" FOR SELECT TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'anon'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "candidatos_update" ON public."candidatos";
CREATE POLICY "candidatos_update" ON public."candidatos" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "central_integracoes_insert" ON public."central_integracoes";
CREATE POLICY "central_integracoes_insert" ON public."central_integracoes" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "central_integracoes_select" ON public."central_integracoes";
CREATE POLICY "central_integracoes_select" ON public."central_integracoes" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "central_integracoes_update" ON public."central_integracoes";
CREATE POLICY "central_integracoes_update" ON public."central_integracoes" FOR UPDATE TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public."certificados_fiscais";
CREATE POLICY "Enable insert for authenticated" ON public."certificados_fiscais" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Enable select for authenticated" ON public."certificados_fiscais";
CREATE POLICY "Enable select for authenticated" ON public."certificados_fiscais" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Enable update for authenticated" ON public."certificados_fiscais";
CREATE POLICY "Enable update for authenticated" ON public."certificados_fiscais" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "cliente_select_own" ON public."clientes";
CREATE POLICY "cliente_select_own" ON public."clientes" FOR SELECT TO authenticated USING (id = obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "cliente_update_own" ON public."clientes";
CREATE POLICY "cliente_update_own" ON public."clientes" FOR UPDATE TO authenticated USING (id = obter_cliente_id_do_usuario()) WITH CHECK (id = obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "clientes_delete_own" ON public."clientes";
CREATE POLICY "clientes_delete_own" ON public."clientes" FOR DELETE TO authenticated USING (f_usuario_pode_acessar_cliente(id));
DROP POLICY IF EXISTS "clientes_insert_own" ON public."clientes";
CREATE POLICY "clientes_insert_own" ON public."clientes" FOR INSERT TO authenticated WITH CHECK (f_usuario_pode_acessar_tenant(tenant_id));
DROP POLICY IF EXISTS "clientes_select_own" ON public."clientes";
CREATE POLICY "clientes_select_own" ON public."clientes" FOR SELECT TO authenticated, anon USING (f_usuario_pode_acessar_cliente(id) OR id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "clientes_select_own_tenant" ON public."clientes";
CREATE POLICY "clientes_select_own_tenant" ON public."clientes" FOR SELECT TO authenticated USING (tenant_id IS NOT NULL AND f_usuario_pode_acessar_tenant(tenant_id));
DROP POLICY IF EXISTS "clientes_update_own" ON public."clientes";
CREATE POLICY "clientes_update_own" ON public."clientes" FOR UPDATE TO authenticated USING (f_usuario_pode_acessar_cliente(id)) WITH CHECK (f_usuario_pode_acessar_cliente(id));
DROP POLICY IF EXISTS "ce_events_insert_tenant" ON public."communication_events";
CREATE POLICY "ce_events_insert_tenant" ON public."communication_events" FOR INSERT TO authenticated, anon WITH CHECK (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "ce_events_select_tenant" ON public."communication_events";
CREATE POLICY "ce_events_select_tenant" ON public."communication_events" FOR SELECT TO authenticated, anon USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "cp_prefs_insert_tenant" ON public."communication_preferences";
CREATE POLICY "cp_prefs_insert_tenant" ON public."communication_preferences" FOR INSERT TO authenticated, anon WITH CHECK (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "cp_prefs_select_tenant" ON public."communication_preferences";
CREATE POLICY "cp_prefs_select_tenant" ON public."communication_preferences" FOR SELECT TO authenticated, anon USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "ct_templates_insert_tenant" ON public."communication_templates";
CREATE POLICY "ct_templates_insert_tenant" ON public."communication_templates" FOR INSERT TO authenticated, anon WITH CHECK (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "ct_templates_select_tenant" ON public."communication_templates";
CREATE POLICY "ct_templates_select_tenant" ON public."communication_templates" FOR SELECT TO authenticated, anon USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "cfo_insert_tms" ON public."composicao_financeira_os";
CREATE POLICY "cfo_insert_tms" ON public."composicao_financeira_os" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cfo_select_tms" ON public."composicao_financeira_os";
CREATE POLICY "cfo_select_tms" ON public."composicao_financeira_os" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cfo_update_tms" ON public."composicao_financeira_os";
CREATE POLICY "cfo_update_tms" ON public."composicao_financeira_os" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "dest_autorizados_admin_all" ON public."comunicacoes_destinatarios_autorizados";
CREATE POLICY "dest_autorizados_admin_all" ON public."comunicacoes_destinatarios_autorizados" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "comunicacoes_admin_all" ON public."comunicacoes_mensagens";
CREATE POLICY "comunicacoes_admin_all" ON public."comunicacoes_mensagens" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all operations" ON public."configuracoes_fiscais";
CREATE POLICY "Allow all operations" ON public."configuracoes_fiscais" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public."configuracoes_fiscais";
CREATE POLICY "Enable insert for authenticated" ON public."configuracoes_fiscais" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Enable select for authenticated" ON public."configuracoes_fiscais";
CREATE POLICY "Enable select for authenticated" ON public."configuracoes_fiscais" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Enable update for authenticated" ON public."configuracoes_fiscais";
CREATE POLICY "Enable update for authenticated" ON public."configuracoes_fiscais" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "configuracoes_sistema_insert" ON public."configuracoes_sistema";
CREATE POLICY "configuracoes_sistema_insert" ON public."configuracoes_sistema" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "configuracoes_sistema_select" ON public."configuracoes_sistema";
CREATE POLICY "configuracoes_sistema_select" ON public."configuracoes_sistema" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "configuracoes_sistema_update" ON public."configuracoes_sistema";
CREATE POLICY "configuracoes_sistema_update" ON public."configuracoes_sistema" FOR UPDATE TO public WITH CHECK (true);
DROP POLICY IF EXISTS "contas_fin_delete_auth" ON public."contas_financeiras";
CREATE POLICY "contas_fin_delete_auth" ON public."contas_financeiras" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "contas_fin_insert_auth" ON public."contas_financeiras";
CREATE POLICY "contas_fin_insert_auth" ON public."contas_financeiras" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "contas_fin_select_auth" ON public."contas_financeiras";
CREATE POLICY "contas_fin_select_auth" ON public."contas_financeiras" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "contas_fin_update_auth" ON public."contas_financeiras";
CREATE POLICY "contas_fin_update_auth" ON public."contas_financeiras" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "cg_insert_tms" ON public."contratos_gerados";
CREATE POLICY "cg_insert_tms" ON public."contratos_gerados" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cg_select_tms" ON public."contratos_gerados";
CREATE POLICY "cg_select_tms" ON public."contratos_gerados" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cg_update_tms" ON public."contratos_gerados";
CREATE POLICY "cg_update_tms" ON public."contratos_gerados" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid()))) WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "contratos_insert_tms" ON public."contratos_gerados";
CREATE POLICY "contratos_insert_tms" ON public."contratos_gerados" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "contratos_select_prestador" ON public."contratos_gerados";
CREATE POLICY "contratos_select_prestador" ON public."contratos_gerados" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM prestadores
  WHERE prestadores.id = contratos_gerados.prestador_id AND prestadores.auth_user_id = auth.uid())));
DROP POLICY IF EXISTS "contratos_select_tms" ON public."contratos_gerados";
CREATE POLICY "contratos_select_tms" ON public."contratos_gerados" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "contratos_update_tms" ON public."contratos_gerados";
CREATE POLICY "contratos_update_tms" ON public."contratos_gerados" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "chist_insert_tms" ON public."contratos_historico";
CREATE POLICY "chist_insert_tms" ON public."contratos_historico" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "chist_select_tms" ON public."contratos_historico";
CREATE POLICY "chist_select_tms" ON public."contratos_historico" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "historico_insert_tms" ON public."contratos_historico";
CREATE POLICY "historico_insert_tms" ON public."contratos_historico" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "historico_select_tms" ON public."contratos_historico";
CREATE POLICY "historico_select_tms" ON public."contratos_historico" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cm_insert_tms" ON public."contratos_modelos";
CREATE POLICY "cm_insert_tms" ON public."contratos_modelos" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cm_select_tms" ON public."contratos_modelos";
CREATE POLICY "cm_select_tms" ON public."contratos_modelos" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cm_update_tms" ON public."contratos_modelos";
CREATE POLICY "cm_update_tms" ON public."contratos_modelos" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid()))) WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "modelos_insert_tms" ON public."contratos_modelos";
CREATE POLICY "modelos_insert_tms" ON public."contratos_modelos" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "modelos_select_tms" ON public."contratos_modelos";
CREATE POLICY "modelos_select_tms" ON public."contratos_modelos" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "modelos_update_tms" ON public."contratos_modelos";
CREATE POLICY "modelos_update_tms" ON public."contratos_modelos" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "convites_delete" ON public."convites";
CREATE POLICY "convites_delete" ON public."convites" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "convites_insert" ON public."convites";
CREATE POLICY "convites_insert" ON public."convites" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "convites_select" ON public."convites";
CREATE POLICY "convites_select" ON public."convites" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cc_insert_tms" ON public."crm_conversas";
CREATE POLICY "cc_insert_tms" ON public."crm_conversas" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cc_select_tms" ON public."crm_conversas";
CREATE POLICY "cc_select_tms" ON public."crm_conversas" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cc_update_tms" ON public."crm_conversas";
CREATE POLICY "cc_update_tms" ON public."crm_conversas" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cf_delete_tms" ON public."crm_followups";
CREATE POLICY "cf_delete_tms" ON public."crm_followups" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cf_insert_tms" ON public."crm_followups";
CREATE POLICY "cf_insert_tms" ON public."crm_followups" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cf_select_tms" ON public."crm_followups";
CREATE POLICY "cf_select_tms" ON public."crm_followups" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cf_update_tms" ON public."crm_followups";
CREATE POLICY "cf_update_tms" ON public."crm_followups" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "ch_delete_tms" ON public."crm_historico";
CREATE POLICY "ch_delete_tms" ON public."crm_historico" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "ch_insert_tms" ON public."crm_historico";
CREATE POLICY "ch_insert_tms" ON public."crm_historico" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "ch_select_tms" ON public."crm_historico";
CREATE POLICY "ch_select_tms" ON public."crm_historico" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cip_delete_tms" ON public."crm_interacoes_prestadores";
CREATE POLICY "cip_delete_tms" ON public."crm_interacoes_prestadores" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cip_insert_tms" ON public."crm_interacoes_prestadores";
CREATE POLICY "cip_insert_tms" ON public."crm_interacoes_prestadores" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cip_select_tms" ON public."crm_interacoes_prestadores";
CREATE POLICY "cip_select_tms" ON public."crm_interacoes_prestadores" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cip_update_tms" ON public."crm_interacoes_prestadores";
CREATE POLICY "cip_update_tms" ON public."crm_interacoes_prestadores" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cl_delete_tms" ON public."crm_leads";
CREATE POLICY "cl_delete_tms" ON public."crm_leads" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cl_insert_tms" ON public."crm_leads";
CREATE POLICY "cl_insert_tms" ON public."crm_leads" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cl_select_tms" ON public."crm_leads";
CREATE POLICY "cl_select_tms" ON public."crm_leads" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cl_update_tms" ON public."crm_leads";
CREATE POLICY "cl_update_tms" ON public."crm_leads" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "crm_leads_delete_tms" ON public."crm_leads";
CREATE POLICY "crm_leads_delete_tms" ON public."crm_leads" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "crm_leads_insert_tms" ON public."crm_leads";
CREATE POLICY "crm_leads_insert_tms" ON public."crm_leads" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "crm_leads_select_tms" ON public."crm_leads";
CREATE POLICY "crm_leads_select_tms" ON public."crm_leads" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "crm_leads_update_tms" ON public."crm_leads";
CREATE POLICY "crm_leads_update_tms" ON public."crm_leads" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid()))) WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cm_insert_tms" ON public."crm_mensagens";
CREATE POLICY "cm_insert_tms" ON public."crm_mensagens" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cm_select_tms" ON public."crm_mensagens";
CREATE POLICY "cm_select_tms" ON public."crm_mensagens" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "cm_update_tms" ON public."crm_mensagens";
CREATE POLICY "cm_update_tms" ON public."crm_mensagens" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "ctm_insert_tms" ON public."crm_templates_mensagem";
CREATE POLICY "ctm_insert_tms" ON public."crm_templates_mensagem" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "ctm_select_tms" ON public."crm_templates_mensagem";
CREATE POLICY "ctm_select_tms" ON public."crm_templates_mensagem" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "ctm_update_tms" ON public."crm_templates_mensagem";
CREATE POLICY "ctm_update_tms" ON public."crm_templates_mensagem" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "dp_insert_authenticated" ON public."delivery_proofs";
CREATE POLICY "dp_insert_authenticated" ON public."delivery_proofs" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "dp_select_own" ON public."delivery_proofs";
CREATE POLICY "dp_select_own" ON public."delivery_proofs" FOR SELECT TO authenticated USING (driver_id = auth.uid()::text);
DROP POLICY IF EXISTS "despesas_delete" ON public."despesas_operacionais";
CREATE POLICY "despesas_delete" ON public."despesas_operacionais" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "despesas_insert" ON public."despesas_operacionais";
CREATE POLICY "despesas_insert" ON public."despesas_operacionais" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "despesas_select" ON public."despesas_operacionais";
CREATE POLICY "despesas_select" ON public."despesas_operacionais" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "despesas_update" ON public."despesas_operacionais";
CREATE POLICY "despesas_update" ON public."despesas_operacionais" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "dv_decisoes_insert" ON public."diretor_virtual_decisoes_ia";
CREATE POLICY "dv_decisoes_insert" ON public."diretor_virtual_decisoes_ia" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_decisoes_select" ON public."diretor_virtual_decisoes_ia";
CREATE POLICY "dv_decisoes_select" ON public."diretor_virtual_decisoes_ia" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_decisoes_update" ON public."diretor_virtual_decisoes_ia";
CREATE POLICY "dv_decisoes_update" ON public."diretor_virtual_decisoes_ia" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_eventos_insert" ON public."diretor_virtual_eventos_ia";
CREATE POLICY "dv_eventos_insert" ON public."diretor_virtual_eventos_ia" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_eventos_select" ON public."diretor_virtual_eventos_ia";
CREATE POLICY "dv_eventos_select" ON public."diretor_virtual_eventos_ia" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_insert" ON public."diretor_virtual_ia";
CREATE POLICY "dv_insert" ON public."diretor_virtual_ia" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_select" ON public."diretor_virtual_ia";
CREATE POLICY "dv_select" ON public."diretor_virtual_ia" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_update" ON public."diretor_virtual_ia";
CREATE POLICY "dv_update" ON public."diretor_virtual_ia" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_metricas_insert" ON public."diretor_virtual_metricas_ia";
CREATE POLICY "dv_metricas_insert" ON public."diretor_virtual_metricas_ia" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_metricas_select" ON public."diretor_virtual_metricas_ia";
CREATE POLICY "dv_metricas_select" ON public."diretor_virtual_metricas_ia" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "dv_metricas_update" ON public."diretor_virtual_metricas_ia";
CREATE POLICY "dv_metricas_update" ON public."diretor_virtual_metricas_ia" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Permitir insert documentos prestadores" ON public."documentos_prestadores";
CREATE POLICY "Permitir insert documentos prestadores" ON public."documentos_prestadores" FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir select documentos prestadores" ON public."documentos_prestadores";
CREATE POLICY "Permitir select documentos prestadores" ON public."documentos_prestadores" FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Permitir update documentos prestadores" ON public."documentos_prestadores";
CREATE POLICY "Permitir update documentos prestadores" ON public."documentos_prestadores" FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "driver_incidents_own" ON public."driver_incidents";
CREATE POLICY "driver_incidents_own" ON public."driver_incidents" FOR ALL TO public USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
DROP POLICY IF EXISTS "driver_operations_own" ON public."driver_operations";
CREATE POLICY "driver_operations_own" ON public."driver_operations" FOR ALL TO public USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
DROP POLICY IF EXISTS "driver_profiles_own" ON public."driver_profiles";
CREATE POLICY "driver_profiles_own" ON public."driver_profiles" FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Prestador can insert enderecos_clientes" ON public."enderecos_clientes";
CREATE POLICY "Prestador can insert enderecos_clientes" ON public."enderecos_clientes" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Prestador can update enderecos_clientes" ON public."enderecos_clientes";
CREATE POLICY "Prestador can update enderecos_clientes" ON public."enderecos_clientes" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Prestador can view enderecos_clientes" ON public."enderecos_clientes";
CREATE POLICY "Prestador can view enderecos_clientes" ON public."enderecos_clientes" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated select all protocolo" ON public."entregas_protocolo";
CREATE POLICY "Authenticated select all protocolo" ON public."entregas_protocolo" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Prestador insert own protocolo" ON public."entregas_protocolo";
CREATE POLICY "Prestador insert own protocolo" ON public."entregas_protocolo" FOR INSERT TO public WITH CHECK (prestador_id = auth.uid()::text::uuid);
DROP POLICY IF EXISTS "Prestador select own protocolo" ON public."entregas_protocolo";
CREATE POLICY "Prestador select own protocolo" ON public."entregas_protocolo" FOR SELECT TO public USING (prestador_id = auth.uid()::text::uuid);
DROP POLICY IF EXISTS "entregas_protocolo_select_authenticated" ON public."entregas_protocolo";
CREATE POLICY "entregas_protocolo_select_authenticated" ON public."entregas_protocolo" FOR SELECT TO authenticated USING (tenant_id = current_tenant_id_safe() OR tenant_id IS NULL);
DROP POLICY IF EXISTS "Permitir tudo em escalonamentos_humanos" ON public."escalonamentos_humanos";
CREATE POLICY "Permitir tudo em escalonamentos_humanos" ON public."escalonamentos_humanos" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "eventos_oficiais_admin_delete" ON public."eventos_oficiais";
CREATE POLICY "eventos_oficiais_admin_delete" ON public."eventos_oficiais" FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "eventos_oficiais_admin_insert" ON public."eventos_oficiais";
CREATE POLICY "eventos_oficiais_admin_insert" ON public."eventos_oficiais" FOR INSERT TO authenticated, anon WITH CHECK (true);
DROP POLICY IF EXISTS "eventos_oficiais_admin_select" ON public."eventos_oficiais";
CREATE POLICY "eventos_oficiais_admin_select" ON public."eventos_oficiais" FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "eventos_oficiais_admin_update" ON public."eventos_oficiais";
CREATE POLICY "eventos_oficiais_admin_update" ON public."eventos_oficiais" FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "fatit_delete_tms" ON public."fatura_itens";
CREATE POLICY "fatit_delete_tms" ON public."fatura_itens" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fatit_insert_tms" ON public."fatura_itens";
CREATE POLICY "fatit_insert_tms" ON public."fatura_itens" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fatit_select_tms" ON public."fatura_itens";
CREATE POLICY "fatit_select_tms" ON public."fatura_itens" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fatit_update_tms" ON public."fatura_itens";
CREATE POLICY "fatit_update_tms" ON public."fatura_itens" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fat_delete_tms" ON public."faturas";
CREATE POLICY "fat_delete_tms" ON public."faturas" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "fat_insert_tms" ON public."faturas";
CREATE POLICY "fat_insert_tms" ON public."faturas" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "fat_select_tms" ON public."faturas";
CREATE POLICY "fat_select_tms" ON public."faturas" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "fat_update_tms" ON public."faturas";
CREATE POLICY "fat_update_tms" ON public."faturas" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "fb_insert_tms" ON public."financeiro_baixas";
CREATE POLICY "fb_insert_tms" ON public."financeiro_baixas" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fb_select_tms" ON public."financeiro_baixas";
CREATE POLICY "fb_select_tms" ON public."financeiro_baixas" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fb_update_tms" ON public."financeiro_baixas";
CREATE POLICY "fb_update_tms" ON public."financeiro_baixas" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid()))) WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fp_delete_tms" ON public."financeiro_pagar";
CREATE POLICY "fp_delete_tms" ON public."financeiro_pagar" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fp_insert_tms" ON public."financeiro_pagar";
CREATE POLICY "fp_insert_tms" ON public."financeiro_pagar" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fp_select_tms" ON public."financeiro_pagar";
CREATE POLICY "fp_select_tms" ON public."financeiro_pagar" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fp_update_tms" ON public."financeiro_pagar";
CREATE POLICY "fp_update_tms" ON public."financeiro_pagar" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fr_delete_tms" ON public."financeiro_receber";
CREATE POLICY "fr_delete_tms" ON public."financeiro_receber" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fr_insert_tms" ON public."financeiro_receber";
CREATE POLICY "fr_insert_tms" ON public."financeiro_receber" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fr_select_cliente" ON public."financeiro_receber";
CREATE POLICY "fr_select_cliente" ON public."financeiro_receber" FOR SELECT TO authenticated USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "fr_select_own" ON public."financeiro_receber";
CREATE POLICY "fr_select_own" ON public."financeiro_receber" FOR SELECT TO authenticated, anon USING (cliente_id = f_obter_cliente_id_do_usuario() OR f_usuario_pode_acessar_cliente(cliente_id));
DROP POLICY IF EXISTS "fr_select_tms" ON public."financeiro_receber";
CREATE POLICY "fr_select_tms" ON public."financeiro_receber" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fr_update_tms" ON public."financeiro_receber";
CREATE POLICY "fr_update_tms" ON public."financeiro_receber" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "transferencias_insert_tenant" ON public."financeiro_transferencias";
CREATE POLICY "transferencias_insert_tenant" ON public."financeiro_transferencias" FOR INSERT TO public WITH CHECK (tenant_id = current_tenant_id_safe() OR current_tenant_id_safe() IS NULL);
DROP POLICY IF EXISTS "transferencias_select_tenant" ON public."financeiro_transferencias";
CREATE POLICY "transferencias_select_tenant" ON public."financeiro_transferencias" FOR SELECT TO public USING (tenant_id = current_tenant_id_safe() OR current_tenant_id_safe() IS NULL);
DROP POLICY IF EXISTS "fcte_insert_tms" ON public."fiscal_ctes";
CREATE POLICY "fcte_insert_tms" ON public."fiscal_ctes" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fcte_select_cliente" ON public."fiscal_ctes";
CREATE POLICY "fcte_select_cliente" ON public."fiscal_ctes" FOR SELECT TO authenticated USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "fcte_select_tms" ON public."fiscal_ctes";
CREATE POLICY "fcte_select_tms" ON public."fiscal_ctes" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fcte_update_tms" ON public."fiscal_ctes";
CREATE POLICY "fcte_update_tms" ON public."fiscal_ctes" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fdv_insert_tms" ON public."fiscal_documentos_vinculados";
CREATE POLICY "fdv_insert_tms" ON public."fiscal_documentos_vinculados" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fdv_select_tms" ON public."fiscal_documentos_vinculados";
CREATE POLICY "fdv_select_tms" ON public."fiscal_documentos_vinculados" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fdv_update_tms" ON public."fiscal_documentos_vinculados";
CREATE POLICY "fdv_update_tms" ON public."fiscal_documentos_vinculados" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fe_select_tms" ON public."fiscal_events";
CREATE POLICY "fe_select_tms" ON public."fiscal_events" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fhs_select_tms" ON public."fiscal_historico_status";
CREATE POLICY "fhs_select_tms" ON public."fiscal_historico_status" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fl_select_tms" ON public."fiscal_logs";
CREATE POLICY "fl_select_tms" ON public."fiscal_logs" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fmdfe_insert_tms" ON public."fiscal_mdfes";
CREATE POLICY "fmdfe_insert_tms" ON public."fiscal_mdfes" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fmdfe_select_cliente" ON public."fiscal_mdfes";
CREATE POLICY "fmdfe_select_cliente" ON public."fiscal_mdfes" FOR SELECT TO authenticated USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "fmdfe_select_tms" ON public."fiscal_mdfes";
CREATE POLICY "fmdfe_select_tms" ON public."fiscal_mdfes" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fmdfe_update_tms" ON public."fiscal_mdfes";
CREATE POLICY "fmdfe_update_tms" ON public."fiscal_mdfes" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fnfse_insert_tms" ON public."fiscal_nfse";
CREATE POLICY "fnfse_insert_tms" ON public."fiscal_nfse" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fnfse_select_cliente" ON public."fiscal_nfse";
CREATE POLICY "fnfse_select_cliente" ON public."fiscal_nfse" FOR SELECT TO authenticated USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "fnfse_select_tms" ON public."fiscal_nfse";
CREATE POLICY "fnfse_select_tms" ON public."fiscal_nfse" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fnfse_update_tms" ON public."fiscal_nfse";
CREATE POLICY "fnfse_update_tms" ON public."fiscal_nfse" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fr_delete" ON public."fluxo_recrutamento";
CREATE POLICY "fr_delete" ON public."fluxo_recrutamento" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "fr_insert" ON public."fluxo_recrutamento";
CREATE POLICY "fr_insert" ON public."fluxo_recrutamento" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "fr_select" ON public."fluxo_recrutamento";
CREATE POLICY "fr_select" ON public."fluxo_recrutamento" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fr_update" ON public."fluxo_recrutamento";
CREATE POLICY "fr_update" ON public."fluxo_recrutamento" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "fn_delete_tms" ON public."fornecedores";
CREATE POLICY "fn_delete_tms" ON public."fornecedores" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fn_insert_tms" ON public."fornecedores";
CREATE POLICY "fn_insert_tms" ON public."fornecedores" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fn_select_tms" ON public."fornecedores";
CREATE POLICY "fn_select_tms" ON public."fornecedores" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "fn_update_tms" ON public."fornecedores";
CREATE POLICY "fn_update_tms" ON public."fornecedores" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "hae_insert_prestador" ON public."historico_alocacoes_escala";
CREATE POLICY "hae_insert_prestador" ON public."historico_alocacoes_escala" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM alocacoes_escala ae
     JOIN prestadores p ON p.id = ae.prestador_id
  WHERE ae.id = historico_alocacoes_escala.alocacao_id AND p.auth_user_id = auth.uid())));
DROP POLICY IF EXISTS "hae_insert_tms" ON public."historico_alocacoes_escala";
CREATE POLICY "hae_insert_tms" ON public."historico_alocacoes_escala" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "hae_select_tms" ON public."historico_alocacoes_escala";
CREATE POLICY "hae_select_tms" ON public."historico_alocacoes_escala" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "hom_delete" ON public."homologacoes";
CREATE POLICY "hom_delete" ON public."homologacoes" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "hom_insert" ON public."homologacoes";
CREATE POLICY "hom_insert" ON public."homologacoes" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "hom_select" ON public."homologacoes";
CREATE POLICY "hom_select" ON public."homologacoes" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "hom_update" ON public."homologacoes";
CREATE POLICY "hom_update" ON public."homologacoes" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "ia_agenda_atividades_delete" ON public."ia_agenda_atividades";
CREATE POLICY "ia_agenda_atividades_delete" ON public."ia_agenda_atividades" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_agenda_atividades_insert" ON public."ia_agenda_atividades";
CREATE POLICY "ia_agenda_atividades_insert" ON public."ia_agenda_atividades" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_agenda_atividades_select" ON public."ia_agenda_atividades";
CREATE POLICY "ia_agenda_atividades_select" ON public."ia_agenda_atividades" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_agenda_atividades_update" ON public."ia_agenda_atividades";
CREATE POLICY "ia_agenda_atividades_update" ON public."ia_agenda_atividades" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "ia_agenda_trabalho_delete" ON public."ia_agenda_trabalho";
CREATE POLICY "ia_agenda_trabalho_delete" ON public."ia_agenda_trabalho" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_agenda_trabalho_insert" ON public."ia_agenda_trabalho";
CREATE POLICY "ia_agenda_trabalho_insert" ON public."ia_agenda_trabalho" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_agenda_trabalho_select" ON public."ia_agenda_trabalho";
CREATE POLICY "ia_agenda_trabalho_select" ON public."ia_agenda_trabalho" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_agenda_trabalho_update" ON public."ia_agenda_trabalho";
CREATE POLICY "ia_agenda_trabalho_update" ON public."ia_agenda_trabalho" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "ia_agentes_execucao_delete" ON public."ia_agentes_execucao";
CREATE POLICY "ia_agentes_execucao_delete" ON public."ia_agentes_execucao" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_agentes_execucao_insert" ON public."ia_agentes_execucao";
CREATE POLICY "ia_agentes_execucao_insert" ON public."ia_agentes_execucao" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_agentes_execucao_select" ON public."ia_agentes_execucao";
CREATE POLICY "ia_agentes_execucao_select" ON public."ia_agentes_execucao" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_agentes_execucao_update" ON public."ia_agentes_execucao";
CREATE POLICY "ia_agentes_execucao_update" ON public."ia_agentes_execucao" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Gerenciar aprendizado eventos" ON public."ia_aprendizado_eventos";
CREATE POLICY "Gerenciar aprendizado eventos" ON public."ia_aprendizado_eventos" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Aprovador pode atualizar" ON public."ia_aprovacoes_fila";
CREATE POLICY "Aprovador pode atualizar" ON public."ia_aprovacoes_fila" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Robos podem criar aprovacoes" ON public."ia_aprovacoes_fila";
CREATE POLICY "Robos podem criar aprovacoes" ON public."ia_aprovacoes_fila" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Todos podem ver aprovacoes" ON public."ia_aprovacoes_fila";
CREATE POLICY "Todos podem ver aprovacoes" ON public."ia_aprovacoes_fila" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Gerenciar auditoria perf" ON public."ia_auditoria_performance";
CREATE POLICY "Gerenciar auditoria perf" ON public."ia_auditoria_performance" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Gerenciar autoridade" ON public."ia_autoridade_acoes";
CREATE POLICY "Gerenciar autoridade" ON public."ia_autoridade_acoes" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Todos podem ver autoridade" ON public."ia_autoridade_acoes";
CREATE POLICY "Todos podem ver autoridade" ON public."ia_autoridade_acoes" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "fila_insert" ON public."ia_comunicacoes_fila_robos";
CREATE POLICY "fila_insert" ON public."ia_comunicacoes_fila_robos" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "fila_select" ON public."ia_comunicacoes_fila_robos";
CREATE POLICY "fila_select" ON public."ia_comunicacoes_fila_robos" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "fila_update" ON public."ia_comunicacoes_fila_robos";
CREATE POLICY "fila_update" ON public."ia_comunicacoes_fila_robos" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "comunic_insert" ON public."ia_comunicacoes_robos";
CREATE POLICY "comunic_insert" ON public."ia_comunicacoes_robos" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "comunic_select" ON public."ia_comunicacoes_robos";
CREATE POLICY "comunic_select" ON public."ia_comunicacoes_robos" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "comunic_update" ON public."ia_comunicacoes_robos";
CREATE POLICY "comunic_update" ON public."ia_comunicacoes_robos" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "ia_conector_robo_delete" ON public."ia_conector_robo";
CREATE POLICY "ia_conector_robo_delete" ON public."ia_conector_robo" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_conector_robo_insert" ON public."ia_conector_robo";
CREATE POLICY "ia_conector_robo_insert" ON public."ia_conector_robo" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_conector_robo_select" ON public."ia_conector_robo";
CREATE POLICY "ia_conector_robo_select" ON public."ia_conector_robo" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_conector_robo_update" ON public."ia_conector_robo";
CREATE POLICY "ia_conector_robo_update" ON public."ia_conector_robo" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "ia_conectores_delete" ON public."ia_conectores";
CREATE POLICY "ia_conectores_delete" ON public."ia_conectores" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_conectores_insert" ON public."ia_conectores";
CREATE POLICY "ia_conectores_insert" ON public."ia_conectores" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_conectores_select" ON public."ia_conectores";
CREATE POLICY "ia_conectores_select" ON public."ia_conectores" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_conectores_update" ON public."ia_conectores";
CREATE POLICY "ia_conectores_update" ON public."ia_conectores" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "ia_conhecimento_admin_all" ON public."ia_conhecimento";
CREATE POLICY "ia_conhecimento_admin_all" ON public."ia_conhecimento" FOR ALL TO public USING (auth.role() = 'authenticated'::text) WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "distrib_delete" ON public."ia_conhecimento_distribuicao";
CREATE POLICY "distrib_delete" ON public."ia_conhecimento_distribuicao" FOR DELETE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "distrib_insert" ON public."ia_conhecimento_distribuicao";
CREATE POLICY "distrib_insert" ON public."ia_conhecimento_distribuicao" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "distrib_select" ON public."ia_conhecimento_distribuicao";
CREATE POLICY "distrib_select" ON public."ia_conhecimento_distribuicao" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "distrib_update" ON public."ia_conhecimento_distribuicao";
CREATE POLICY "distrib_update" ON public."ia_conhecimento_distribuicao" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Permitir tudo em ia_contextos" ON public."ia_contextos";
CREATE POLICY "Permitir tudo em ia_contextos" ON public."ia_contextos" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Gerenciar credenciais" ON public."ia_credenciais";
CREATE POLICY "Gerenciar credenciais" ON public."ia_credenciais" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Gestores podem atualizar credenciais Zoho" ON public."ia_credenciais_zoho";
CREATE POLICY "Gestores podem atualizar credenciais Zoho" ON public."ia_credenciais_zoho" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Gestores podem deletar credenciais Zoho" ON public."ia_credenciais_zoho";
CREATE POLICY "Gestores podem deletar credenciais Zoho" ON public."ia_credenciais_zoho" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "Gestores podem inserir credenciais Zoho" ON public."ia_credenciais_zoho";
CREATE POLICY "Gestores podem inserir credenciais Zoho" ON public."ia_credenciais_zoho" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Gestores podem ler credenciais Zoho" ON public."ia_credenciais_zoho";
CREATE POLICY "Gestores podem ler credenciais Zoho" ON public."ia_credenciais_zoho" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Gerenciar escalonamento" ON public."ia_escalonamento_config";
CREATE POLICY "Gerenciar escalonamento" ON public."ia_escalonamento_config" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Todos podem ver escalonamento" ON public."ia_escalonamento_config";
CREATE POLICY "Todos podem ver escalonamento" ON public."ia_escalonamento_config" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_execucoes_conectores_delete" ON public."ia_execucoes_conectores";
CREATE POLICY "ia_execucoes_conectores_delete" ON public."ia_execucoes_conectores" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_execucoes_conectores_insert" ON public."ia_execucoes_conectores";
CREATE POLICY "ia_execucoes_conectores_insert" ON public."ia_execucoes_conectores" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_execucoes_conectores_select" ON public."ia_execucoes_conectores";
CREATE POLICY "ia_execucoes_conectores_select" ON public."ia_execucoes_conectores" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_execucoes_conectores_update" ON public."ia_execucoes_conectores";
CREATE POLICY "ia_execucoes_conectores_update" ON public."ia_execucoes_conectores" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "ia_execucoes_ferramentas_delete" ON public."ia_execucoes_ferramentas";
CREATE POLICY "ia_execucoes_ferramentas_delete" ON public."ia_execucoes_ferramentas" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_execucoes_ferramentas_insert" ON public."ia_execucoes_ferramentas";
CREATE POLICY "ia_execucoes_ferramentas_insert" ON public."ia_execucoes_ferramentas" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_execucoes_ferramentas_select" ON public."ia_execucoes_ferramentas";
CREATE POLICY "ia_execucoes_ferramentas_select" ON public."ia_execucoes_ferramentas" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_execucoes_ferramentas_update" ON public."ia_execucoes_ferramentas";
CREATE POLICY "ia_execucoes_ferramentas_update" ON public."ia_execucoes_ferramentas" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "ia_ferramentas_delete" ON public."ia_ferramentas";
CREATE POLICY "ia_ferramentas_delete" ON public."ia_ferramentas" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_ferramentas_insert" ON public."ia_ferramentas";
CREATE POLICY "ia_ferramentas_insert" ON public."ia_ferramentas" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_ferramentas_select" ON public."ia_ferramentas";
CREATE POLICY "ia_ferramentas_select" ON public."ia_ferramentas" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_ferramentas_update" ON public."ia_ferramentas";
CREATE POLICY "ia_ferramentas_update" ON public."ia_ferramentas" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "ia_fila_trabalho_delete" ON public."ia_fila_trabalho";
CREATE POLICY "ia_fila_trabalho_delete" ON public."ia_fila_trabalho" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_fila_trabalho_insert" ON public."ia_fila_trabalho";
CREATE POLICY "ia_fila_trabalho_insert" ON public."ia_fila_trabalho" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_fila_trabalho_select" ON public."ia_fila_trabalho";
CREATE POLICY "ia_fila_trabalho_select" ON public."ia_fila_trabalho" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_fila_trabalho_update" ON public."ia_fila_trabalho";
CREATE POLICY "ia_fila_trabalho_update" ON public."ia_fila_trabalho" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Gerenciar fluxos empresa" ON public."ia_fluxos_empresa";
CREATE POLICY "Gerenciar fluxos empresa" ON public."ia_fluxos_empresa" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Gerenciar fluxos etapas" ON public."ia_fluxos_etapas";
CREATE POLICY "Gerenciar fluxos etapas" ON public."ia_fluxos_etapas" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Gerenciar fluxos exec log" ON public."ia_fluxos_execucao_log";
CREATE POLICY "Gerenciar fluxos exec log" ON public."ia_fluxos_execucao_log" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Sistema pode inserir governanca log" ON public."ia_governanca_log";
CREATE POLICY "Sistema pode inserir governanca log" ON public."ia_governanca_log" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Todos podem ver governanca log" ON public."ia_governanca_log";
CREATE POLICY "Todos podem ver governanca log" ON public."ia_governanca_log" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_historico_indicadores_delete" ON public."ia_historico_indicadores";
CREATE POLICY "ia_historico_indicadores_delete" ON public."ia_historico_indicadores" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_historico_indicadores_insert" ON public."ia_historico_indicadores";
CREATE POLICY "ia_historico_indicadores_insert" ON public."ia_historico_indicadores" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_historico_indicadores_select" ON public."ia_historico_indicadores";
CREATE POLICY "ia_historico_indicadores_select" ON public."ia_historico_indicadores" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_historico_trabalho_delete" ON public."ia_historico_trabalho";
CREATE POLICY "ia_historico_trabalho_delete" ON public."ia_historico_trabalho" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_historico_trabalho_insert" ON public."ia_historico_trabalho";
CREATE POLICY "ia_historico_trabalho_insert" ON public."ia_historico_trabalho" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_historico_trabalho_select" ON public."ia_historico_trabalho";
CREATE POLICY "ia_historico_trabalho_select" ON public."ia_historico_trabalho" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Gerenciar identidades" ON public."ia_identidades";
CREATE POLICY "Gerenciar identidades" ON public."ia_identidades" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ia_indicadores_delete" ON public."ia_indicadores";
CREATE POLICY "ia_indicadores_delete" ON public."ia_indicadores" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_indicadores_insert" ON public."ia_indicadores";
CREATE POLICY "ia_indicadores_insert" ON public."ia_indicadores" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_indicadores_select" ON public."ia_indicadores";
CREATE POLICY "ia_indicadores_select" ON public."ia_indicadores" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_indicadores_update" ON public."ia_indicadores";
CREATE POLICY "ia_indicadores_update" ON public."ia_indicadores" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Gerenciar insights" ON public."ia_insights_automaticos";
CREATE POLICY "Gerenciar insights" ON public."ia_insights_automaticos" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Gerenciar integracoes externas" ON public."ia_integracoes_externas_logs";
CREATE POLICY "Gerenciar integracoes externas" ON public."ia_integracoes_externas_logs" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Gerenciar kpis robo" ON public."ia_kpis_robo";
CREATE POLICY "Gerenciar kpis robo" ON public."ia_kpis_robo" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ia_limites_operacionais_delete" ON public."ia_limites_operacionais";
CREATE POLICY "ia_limites_operacionais_delete" ON public."ia_limites_operacionais" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_limites_operacionais_insert" ON public."ia_limites_operacionais";
CREATE POLICY "ia_limites_operacionais_insert" ON public."ia_limites_operacionais" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_limites_operacionais_select" ON public."ia_limites_operacionais";
CREATE POLICY "ia_limites_operacionais_select" ON public."ia_limites_operacionais" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_limites_operacionais_update" ON public."ia_limites_operacionais";
CREATE POLICY "ia_limites_operacionais_update" ON public."ia_limites_operacionais" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Permitir escrita total logs" ON public."ia_logs";
CREATE POLICY "Permitir escrita total logs" ON public."ia_logs" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Permitir leitura total logs" ON public."ia_logs";
CREATE POLICY "Permitir leitura total logs" ON public."ia_logs" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_metas_delete" ON public."ia_metas";
CREATE POLICY "ia_metas_delete" ON public."ia_metas" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_metas_insert" ON public."ia_metas";
CREATE POLICY "ia_metas_insert" ON public."ia_metas" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_metas_select" ON public."ia_metas";
CREATE POLICY "ia_metas_select" ON public."ia_metas" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_metas_update" ON public."ia_metas";
CREATE POLICY "ia_metas_update" ON public."ia_metas" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "ia_missoes_delete" ON public."ia_missoes";
CREATE POLICY "ia_missoes_delete" ON public."ia_missoes" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_missoes_insert" ON public."ia_missoes";
CREATE POLICY "ia_missoes_insert" ON public."ia_missoes" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_missoes_select" ON public."ia_missoes";
CREATE POLICY "ia_missoes_select" ON public."ia_missoes" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_missoes_update" ON public."ia_missoes";
CREATE POLICY "ia_missoes_update" ON public."ia_missoes" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Gerenciar missoes exec" ON public."ia_missoes_execucao";
CREATE POLICY "Gerenciar missoes exec" ON public."ia_missoes_execucao" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Permitir escrita total provedores" ON public."ia_providers_config";
CREATE POLICY "Permitir escrita total provedores" ON public."ia_providers_config" FOR ALL TO public USING (true);
DROP POLICY IF EXISTS "Permitir leitura total provedores" ON public."ia_providers_config";
CREATE POLICY "Permitir leitura total provedores" ON public."ia_providers_config" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_robo_ferramentas_delete" ON public."ia_robo_ferramentas";
CREATE POLICY "ia_robo_ferramentas_delete" ON public."ia_robo_ferramentas" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_robo_ferramentas_insert" ON public."ia_robo_ferramentas";
CREATE POLICY "ia_robo_ferramentas_insert" ON public."ia_robo_ferramentas" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_robo_ferramentas_select" ON public."ia_robo_ferramentas";
CREATE POLICY "ia_robo_ferramentas_select" ON public."ia_robo_ferramentas" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_robo_ferramentas_update" ON public."ia_robo_ferramentas";
CREATE POLICY "ia_robo_ferramentas_update" ON public."ia_robo_ferramentas" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Gerenciar score robo" ON public."ia_score_robo";
CREATE POLICY "Gerenciar score robo" ON public."ia_score_robo" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Gerenciar sessoes" ON public."ia_sessoes_operacionais";
CREATE POLICY "Gerenciar sessoes" ON public."ia_sessoes_operacionais" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Gerenciar sugestoes" ON public."ia_sugestoes_melhoria";
CREATE POLICY "Gerenciar sugestoes" ON public."ia_sugestoes_melhoria" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ia_trabalhos_delete" ON public."ia_trabalhos";
CREATE POLICY "ia_trabalhos_delete" ON public."ia_trabalhos" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "ia_trabalhos_insert" ON public."ia_trabalhos";
CREATE POLICY "ia_trabalhos_insert" ON public."ia_trabalhos" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "ia_trabalhos_select" ON public."ia_trabalhos";
CREATE POLICY "ia_trabalhos_select" ON public."ia_trabalhos" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "ia_trabalhos_update" ON public."ia_trabalhos";
CREATE POLICY "ia_trabalhos_update" ON public."ia_trabalhos" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "Gerenciar versoes" ON public."ia_versoes_sistema";
CREATE POLICY "Gerenciar versoes" ON public."ia_versoes_sistema" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "il_insert_tms" ON public."integracoes_logs";
CREATE POLICY "il_insert_tms" ON public."integracoes_logs" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "il_select_tms" ON public."integracoes_logs";
CREATE POLICY "il_select_tms" ON public."integracoes_logs" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "memoria_conhecimento_delete" ON public."memoria_conhecimento";
CREATE POLICY "memoria_conhecimento_delete" ON public."memoria_conhecimento" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "memoria_conhecimento_insert" ON public."memoria_conhecimento";
CREATE POLICY "memoria_conhecimento_insert" ON public."memoria_conhecimento" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "memoria_conhecimento_select" ON public."memoria_conhecimento";
CREATE POLICY "memoria_conhecimento_select" ON public."memoria_conhecimento" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "memoria_conhecimento_update" ON public."memoria_conhecimento";
CREATE POLICY "memoria_conhecimento_update" ON public."memoria_conhecimento" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "memoria_conversas_delete" ON public."memoria_conversas";
CREATE POLICY "memoria_conversas_delete" ON public."memoria_conversas" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "memoria_conversas_insert" ON public."memoria_conversas";
CREATE POLICY "memoria_conversas_insert" ON public."memoria_conversas" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "memoria_conversas_select" ON public."memoria_conversas";
CREATE POLICY "memoria_conversas_select" ON public."memoria_conversas" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "memoria_conversas_update" ON public."memoria_conversas";
CREATE POLICY "memoria_conversas_update" ON public."memoria_conversas" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "memoria_entidades_delete" ON public."memoria_entidades";
CREATE POLICY "memoria_entidades_delete" ON public."memoria_entidades" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "memoria_entidades_insert" ON public."memoria_entidades";
CREATE POLICY "memoria_entidades_insert" ON public."memoria_entidades" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "memoria_entidades_select" ON public."memoria_entidades";
CREATE POLICY "memoria_entidades_select" ON public."memoria_entidades" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "memoria_entidades_update" ON public."memoria_entidades";
CREATE POLICY "memoria_entidades_update" ON public."memoria_entidades" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "memoria_eventos_delete" ON public."memoria_eventos";
CREATE POLICY "memoria_eventos_delete" ON public."memoria_eventos" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "memoria_eventos_insert" ON public."memoria_eventos";
CREATE POLICY "memoria_eventos_insert" ON public."memoria_eventos" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "memoria_eventos_select" ON public."memoria_eventos";
CREATE POLICY "memoria_eventos_select" ON public."memoria_eventos" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "memoria_eventos_update" ON public."memoria_eventos";
CREATE POLICY "memoria_eventos_update" ON public."memoria_eventos" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "memoria_preferencias_delete" ON public."memoria_preferencias";
CREATE POLICY "memoria_preferencias_delete" ON public."memoria_preferencias" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "memoria_preferencias_insert" ON public."memoria_preferencias";
CREATE POLICY "memoria_preferencias_insert" ON public."memoria_preferencias" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "memoria_preferencias_select" ON public."memoria_preferencias";
CREATE POLICY "memoria_preferencias_select" ON public."memoria_preferencias" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "memoria_preferencias_update" ON public."memoria_preferencias";
CREATE POLICY "memoria_preferencias_update" ON public."memoria_preferencias" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "memoria_resumos_delete" ON public."memoria_resumos";
CREATE POLICY "memoria_resumos_delete" ON public."memoria_resumos" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "memoria_resumos_insert" ON public."memoria_resumos";
CREATE POLICY "memoria_resumos_insert" ON public."memoria_resumos" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "memoria_resumos_select" ON public."memoria_resumos";
CREATE POLICY "memoria_resumos_select" ON public."memoria_resumos" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "memoria_resumos_update" ON public."memoria_resumos";
CREATE POLICY "memoria_resumos_update" ON public."memoria_resumos" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "mm_delete" ON public."modelos_mensagens";
CREATE POLICY "mm_delete" ON public."modelos_mensagens" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "mm_insert" ON public."modelos_mensagens";
CREATE POLICY "mm_insert" ON public."modelos_mensagens" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "mm_select" ON public."modelos_mensagens";
CREATE POLICY "mm_select" ON public."modelos_mensagens" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "mm_update" ON public."modelos_mensagens";
CREATE POLICY "mm_update" ON public."modelos_mensagens" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public."municipios_ibge";
CREATE POLICY "Enable insert for authenticated users" ON public."municipios_ibge" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public."municipios_ibge";
CREATE POLICY "Enable select for authenticated users" ON public."municipios_ibge" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "ocorrencias_delete_tenant" ON public."ocorrencias";
CREATE POLICY "ocorrencias_delete_tenant" ON public."ocorrencias" FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "ocorrencias_insert_tenant" ON public."ocorrencias";
CREATE POLICY "ocorrencias_insert_tenant" ON public."ocorrencias" FOR INSERT TO authenticated, anon WITH CHECK (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "ocorrencias_select_tenant" ON public."ocorrencias";
CREATE POLICY "ocorrencias_select_tenant" ON public."ocorrencias" FOR SELECT TO authenticated, anon USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "ocorrencias_update_tenant" ON public."ocorrencias";
CREATE POLICY "ocorrencias_update_tenant" ON public."ocorrencias" FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "oper_localizacao_insert_prestador" ON public."operacao_localizacao";
CREATE POLICY "oper_localizacao_insert_prestador" ON public."operacao_localizacao" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM prestadores
  WHERE prestadores.auth_user_id = auth.uid())) OR (EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "oper_localizacao_select" ON public."operacao_localizacao";
CREATE POLICY "oper_localizacao_select" ON public."operacao_localizacao" FOR SELECT TO authenticated USING (tenant_id = current_tenant_id_safe() OR tenant_id IS NULL);
DROP POLICY IF EXISTS "operacao_mensagens_select_prestador" ON public."operacao_mensagens";
CREATE POLICY "operacao_mensagens_select_prestador" ON public."operacao_mensagens" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM prestadores p
  WHERE p.auth_user_id = auth.uid() AND p.id = operacao_mensagens.prestador_id)));
DROP POLICY IF EXISTS "operacao_mensagens_select_torre" ON public."operacao_mensagens";
CREATE POLICY "operacao_mensagens_select_torre" ON public."operacao_mensagens" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "op_delete" ON public."operacoes";
CREATE POLICY "op_delete" ON public."operacoes" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "op_insert" ON public."operacoes";
CREATE POLICY "op_insert" ON public."operacoes" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "op_select" ON public."operacoes";
CREATE POLICY "op_select" ON public."operacoes" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "op_update" ON public."operacoes";
CREATE POLICY "op_update" ON public."operacoes" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "operation_km_own" ON public."operation_km";
CREATE POLICY "operation_km_own" ON public."operation_km" FOR ALL TO public USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
DROP POLICY IF EXISTS "Drivers can insert own timeline events" ON public."operation_timeline_events";
CREATE POLICY "Drivers can insert own timeline events" ON public."operation_timeline_events" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = driver_id);
DROP POLICY IF EXISTS "Drivers can view own timeline events" ON public."operation_timeline_events";
CREATE POLICY "Drivers can view own timeline events" ON public."operation_timeline_events" FOR SELECT TO authenticated USING (auth.uid()::text = driver_id);
DROP POLICY IF EXISTS "timeline_own" ON public."operation_timeline_events";
CREATE POLICY "timeline_own" ON public."operation_timeline_events" FOR ALL TO public USING (driver_id = auth.uid()::text) WITH CHECK (driver_id = auth.uid()::text);
DROP POLICY IF EXISTS "orc_delete_tms" ON public."orcamentos";
CREATE POLICY "orc_delete_tms" ON public."orcamentos" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "orc_insert_tms" ON public."orcamentos";
CREATE POLICY "orc_insert_tms" ON public."orcamentos" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "orc_select_cliente" ON public."orcamentos";
CREATE POLICY "orc_select_cliente" ON public."orcamentos" FOR SELECT TO authenticated USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "orc_select_tms" ON public."orcamentos";
CREATE POLICY "orc_select_tms" ON public."orcamentos" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "orc_update_tms" ON public."orcamentos";
CREATE POLICY "orc_update_tms" ON public."orcamentos" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "os_insert_portal" ON public."ordens_servico";
CREATE POLICY "os_insert_portal" ON public."ordens_servico" FOR INSERT TO authenticated WITH CHECK (cliente_id::uuid = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "os_insert_tms" ON public."ordens_servico";
CREATE POLICY "os_insert_tms" ON public."ordens_servico" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "os_select_own" ON public."ordens_servico";
CREATE POLICY "os_select_own" ON public."ordens_servico" FOR SELECT TO authenticated USING (cliente_id IS NOT NULL AND cliente_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text AND ((cliente_id::uuid IN ( SELECT f_obter_cliente_id_do_usuario() AS f_obter_cliente_id_do_usuario)) OR f_usuario_pode_acessar_cliente(cliente_id::uuid)));
DROP POLICY IF EXISTS "os_select_tms" ON public."ordens_servico";
CREATE POLICY "os_select_tms" ON public."ordens_servico" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios tu
  WHERE tu.user_id = auth.uid() AND tu.tenant_id = ordens_servico.tenant_id AND tu.status = 'ativo'::text)));
DROP POLICY IF EXISTS "os_update_tms" ON public."ordens_servico";
CREATE POLICY "os_update_tms" ON public."ordens_servico" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe()) WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "oh_insert_auth" ON public."os_historico";
CREATE POLICY "oh_insert_auth" ON public."os_historico" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "oh_select_auth" ON public."os_historico";
CREATE POLICY "oh_select_auth" ON public."os_historico" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow all pagamentos_prestadores" ON public."pagamentos_prestadores";
CREATE POLICY "Allow all pagamentos_prestadores" ON public."pagamentos_prestadores" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all pagamentos_prestadores_itens" ON public."pagamentos_prestadores_itens";
CREATE POLICY "Allow all pagamentos_prestadores_itens" ON public."pagamentos_prestadores_itens" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patio_alertas_all" ON public."patio_alertas";
CREATE POLICY "patio_alertas_all" ON public."patio_alertas" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patio_alertas_select" ON public."patio_alertas";
CREATE POLICY "patio_alertas_select" ON public."patio_alertas" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "patio_checkins_all" ON public."patio_checkins";
CREATE POLICY "patio_checkins_all" ON public."patio_checkins" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patio_checkins_select" ON public."patio_checkins";
CREATE POLICY "patio_checkins_select" ON public."patio_checkins" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "patio_docas_all" ON public."patio_docas";
CREATE POLICY "patio_docas_all" ON public."patio_docas" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patio_docas_select" ON public."patio_docas";
CREATE POLICY "patio_docas_select" ON public."patio_docas" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "patio_eventos_all" ON public."patio_eventos";
CREATE POLICY "patio_eventos_all" ON public."patio_eventos" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patio_eventos_select" ON public."patio_eventos";
CREATE POLICY "patio_eventos_select" ON public."patio_eventos" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "patio_fila_all" ON public."patio_fila";
CREATE POLICY "patio_fila_all" ON public."patio_fila" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patio_fila_select" ON public."patio_fila";
CREATE POLICY "patio_fila_select" ON public."patio_fila" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "patio_regras_all" ON public."patio_regras_fila";
CREATE POLICY "patio_regras_all" ON public."patio_regras_fila" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patio_regras_select" ON public."patio_regras_fila";
CREATE POLICY "patio_regras_select" ON public."patio_regras_fila" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "patio_rodizio_all" ON public."patio_rodizio";
CREATE POLICY "patio_rodizio_all" ON public."patio_rodizio" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patio_rodizio_select" ON public."patio_rodizio";
CREATE POLICY "patio_rodizio_select" ON public."patio_rodizio" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "patio_unidades_all" ON public."patio_unidades";
CREATE POLICY "patio_unidades_all" ON public."patio_unidades" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "patio_unidades_select" ON public."patio_unidades";
CREATE POLICY "patio_unidades_select" ON public."patio_unidades" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pending_uploads_own" ON public."pending_uploads";
CREATE POLICY "pending_uploads_own" ON public."pending_uploads" FOR ALL TO public USING (driver_id = auth.uid()::text) WITH CHECK (driver_id = auth.uid()::text);
DROP POLICY IF EXISTS "perfis_select_all" ON public."perfis_permissoes";
CREATE POLICY "perfis_select_all" ON public."perfis_permissoes" FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "pa_insert_own" ON public."portal_avaliacoes";
CREATE POLICY "pa_insert_own" ON public."portal_avaliacoes" FOR INSERT TO authenticated WITH CHECK (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "pa_select_own" ON public."portal_avaliacoes";
CREATE POLICY "pa_select_own" ON public."portal_avaliacoes" FOR SELECT TO authenticated, anon USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "portal_avaliacoes_insert" ON public."portal_avaliacoes";
CREATE POLICY "portal_avaliacoes_insert" ON public."portal_avaliacoes" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "portal_comprovantes_insert" ON public."portal_comprovantes";
CREATE POLICY "portal_comprovantes_insert" ON public."portal_comprovantes" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "pf_select_own" ON public."portal_faturas";
CREATE POLICY "pf_select_own" ON public."portal_faturas" FOR SELECT TO authenticated, anon USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "portal_faturas_insert" ON public."portal_faturas";
CREATE POLICY "portal_faturas_insert" ON public."portal_faturas" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "notificacoes_insert_service" ON public."portal_notificacoes";
CREATE POLICY "notificacoes_insert_service" ON public."portal_notificacoes" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pn_select_own" ON public."portal_notificacoes";
CREATE POLICY "pn_select_own" ON public."portal_notificacoes" FOR SELECT TO authenticated USING (cliente_id = f_obter_cliente_id_do_usuario() OR (prestador_id IN ( SELECT p.id
   FROM prestadores p
  WHERE p.auth_user_id = auth.uid())));
DROP POLICY IF EXISTS "pn_update_own" ON public."portal_notificacoes";
CREATE POLICY "pn_update_own" ON public."portal_notificacoes" FOR UPDATE TO authenticated USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "portal_notificacoes_insert" ON public."portal_notificacoes";
CREATE POLICY "portal_notificacoes_insert" ON public."portal_notificacoes" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "po_insert_own" ON public."portal_ocorrencias";
CREATE POLICY "po_insert_own" ON public."portal_ocorrencias" FOR INSERT TO authenticated WITH CHECK (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "po_select_own" ON public."portal_ocorrencias";
CREATE POLICY "po_select_own" ON public."portal_ocorrencias" FOR SELECT TO authenticated, anon USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "portal_ocorrencias_insert" ON public."portal_ocorrencias";
CREATE POLICY "portal_ocorrencias_insert" ON public."portal_ocorrencias" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "pp_insert_own" ON public."portal_pedidos";
CREATE POLICY "pp_insert_own" ON public."portal_pedidos" FOR INSERT TO authenticated WITH CHECK (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "pp_select_own" ON public."portal_pedidos";
CREATE POLICY "pp_select_own" ON public."portal_pedidos" FOR SELECT TO authenticated, anon USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "pp_update_own" ON public."portal_pedidos";
CREATE POLICY "pp_update_own" ON public."portal_pedidos" FOR UPDATE TO authenticated USING (cliente_id = f_obter_cliente_id_do_usuario()) WITH CHECK (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "portal_preferencias_insert" ON public."portal_preferencias_cliente";
CREATE POLICY "portal_preferencias_insert" ON public."portal_preferencias_cliente" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "portal_protocolos_insert" ON public."portal_protocolos";
CREATE POLICY "portal_protocolos_insert" ON public."portal_protocolos" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "pprot_select_own" ON public."portal_protocolos";
CREATE POLICY "pprot_select_own" ON public."portal_protocolos" FOR SELECT TO authenticated, anon USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "portal_relatorios_insert" ON public."portal_relatorios";
CREATE POLICY "portal_relatorios_insert" ON public."portal_relatorios" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "portal_rotas_insert" ON public."portal_rotas";
CREATE POLICY "portal_rotas_insert" ON public."portal_rotas" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "prota_select_own" ON public."portal_rotas";
CREATE POLICY "prota_select_own" ON public."portal_rotas" FOR SELECT TO authenticated, anon USING (cliente_id = f_obter_cliente_id_do_usuario());
DROP POLICY IF EXISTS "portal_tracking_insert" ON public."portal_tracking_realtime";
CREATE POLICY "portal_tracking_insert" ON public."portal_tracking_realtime" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ptr_insert_auth" ON public."portal_tracking_realtime";
CREATE POLICY "ptr_insert_auth" ON public."portal_tracking_realtime" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ptr_select_auth" ON public."portal_tracking_realtime";
CREATE POLICY "ptr_select_auth" ON public."portal_tracking_realtime" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tracking_insert_prestador" ON public."portal_tracking_realtime";
CREATE POLICY "tracking_insert_prestador" ON public."portal_tracking_realtime" FOR INSERT TO authenticated WITH CHECK ((prestador_id IN ( SELECT prestadores.id
   FROM prestadores
  WHERE prestadores.auth_user_id = auth.uid())));
DROP POLICY IF EXISTS "tracking_prestador_select" ON public."portal_tracking_realtime";
CREATE POLICY "tracking_prestador_select" ON public."portal_tracking_realtime" FOR SELECT TO authenticated USING ((prestador_id IN ( SELECT prestadores.id
   FROM prestadores
  WHERE prestadores.auth_user_id = auth.uid())) OR (tenant_id IN ( SELECT portal_tracking_realtime.tenant_id
   FROM prestadores
  WHERE prestadores.auth_user_id = auth.uid())));
DROP POLICY IF EXISTS "tracking_select_tenant" ON public."portal_tracking_realtime";
CREATE POLICY "tracking_select_tenant" ON public."portal_tracking_realtime" FOR SELECT TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "prestadores_delete_tms" ON public."prestadores";
CREATE POLICY "prestadores_delete_tms" ON public."prestadores" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "prestadores_insert_tms" ON public."prestadores";
CREATE POLICY "prestadores_insert_tms" ON public."prestadores" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "prestadores_select_own" ON public."prestadores";
CREATE POLICY "prestadores_select_own" ON public."prestadores" FOR SELECT TO authenticated USING (auth_user_id IS NULL OR auth_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text OR auth_user_id = auth.uid());
DROP POLICY IF EXISTS "prestadores_select_portal" ON public."prestadores";
CREATE POLICY "prestadores_select_portal" ON public."prestadores" FOR SELECT TO authenticated USING (f_obter_cliente_id_do_usuario() IS NOT NULL);
DROP POLICY IF EXISTS "prestadores_select_tms" ON public."prestadores";
CREATE POLICY "prestadores_select_tms" ON public."prestadores" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "prestadores_update_own" ON public."prestadores";
CREATE POLICY "prestadores_update_own" ON public."prestadores" FOR UPDATE TO authenticated USING (auth_user_id IS NOT NULL AND auth_user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text AND auth_user_id = auth.uid());
DROP POLICY IF EXISTS "prestadores_update_tms" ON public."prestadores";
CREATE POLICY "prestadores_update_tms" ON public."prestadores" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "Users can insert own record" ON public."prestadores_app";
CREATE POLICY "Users can insert own record" ON public."prestadores_app" FOR INSERT TO public WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own record" ON public."prestadores_app";
CREATE POLICY "Users can update own record" ON public."prestadores_app" FOR UPDATE TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can view own record" ON public."prestadores_app";
CREATE POLICY "Users can view own record" ON public."prestadores_app" FOR SELECT TO public USING (auth.uid() = id);
DROP POLICY IF EXISTS "prestadores_app_own" ON public."prestadores_app";
CREATE POLICY "prestadores_app_own" ON public."prestadores_app" FOR ALL TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "processamento_fila_delete" ON public."processamento_fila";
CREATE POLICY "processamento_fila_delete" ON public."processamento_fila" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "processamento_fila_insert" ON public."processamento_fila";
CREATE POLICY "processamento_fila_insert" ON public."processamento_fila" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "processamento_fila_select" ON public."processamento_fila";
CREATE POLICY "processamento_fila_select" ON public."processamento_fila" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "processamento_fila_update" ON public."processamento_fila";
CREATE POLICY "processamento_fila_update" ON public."processamento_fila" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "pd_delete" ON public."provider_documents";
CREATE POLICY "pd_delete" ON public."provider_documents" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "pd_insert" ON public."provider_documents";
CREATE POLICY "pd_insert" ON public."provider_documents" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pd_select" ON public."provider_documents";
CREATE POLICY "pd_select" ON public."provider_documents" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pd_update" ON public."provider_documents";
CREATE POLICY "pd_update" ON public."provider_documents" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "raciocinio_auditoria_delete" ON public."raciocinio_auditoria";
CREATE POLICY "raciocinio_auditoria_delete" ON public."raciocinio_auditoria" FOR DELETE TO public USING (true);
DROP POLICY IF EXISTS "raciocinio_auditoria_insert" ON public."raciocinio_auditoria";
CREATE POLICY "raciocinio_auditoria_insert" ON public."raciocinio_auditoria" FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "raciocinio_auditoria_select" ON public."raciocinio_auditoria";
CREATE POLICY "raciocinio_auditoria_select" ON public."raciocinio_auditoria" FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "raciocinio_auditoria_update" ON public."raciocinio_auditoria";
CREATE POLICY "raciocinio_auditoria_update" ON public."raciocinio_auditoria" FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "rascunhos_delete_token" ON public."rascunhos_prestador";
CREATE POLICY "rascunhos_delete_token" ON public."rascunhos_prestador" FOR DELETE TO authenticated, anon USING (draft_token = current_setting('request.header.x-draft-token'::text, true)::uuid);
DROP POLICY IF EXISTS "rascunhos_insert_token" ON public."rascunhos_prestador";
CREATE POLICY "rascunhos_insert_token" ON public."rascunhos_prestador" FOR INSERT TO authenticated, anon WITH CHECK (true);
DROP POLICY IF EXISTS "rascunhos_select_token" ON public."rascunhos_prestador";
CREATE POLICY "rascunhos_select_token" ON public."rascunhos_prestador" FOR SELECT TO authenticated, anon USING (draft_token = current_setting('request.header.x-draft-token'::text, true)::uuid);
DROP POLICY IF EXISTS "rascunhos_update_token" ON public."rascunhos_prestador";
CREATE POLICY "rascunhos_update_token" ON public."rascunhos_prestador" FOR UPDATE TO authenticated, anon USING (draft_token = current_setting('request.header.x-draft-token'::text, true)::uuid);
DROP POLICY IF EXISTS "recibos_insert_auth" ON public."recibos";
CREATE POLICY "recibos_insert_auth" ON public."recibos" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "recibos_select_auth" ON public."recibos";
CREATE POLICY "recibos_select_auth" ON public."recibos" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "recibos_update_auth" ON public."recibos";
CREATE POLICY "recibos_update_auth" ON public."recibos" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rec_automacoes_delete" ON public."recrutamento_automacoes";
CREATE POLICY "rec_automacoes_delete" ON public."recrutamento_automacoes" FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "rec_automacoes_insert" ON public."recrutamento_automacoes";
CREATE POLICY "rec_automacoes_insert" ON public."recrutamento_automacoes" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rec_automacoes_select" ON public."recrutamento_automacoes";
CREATE POLICY "rec_automacoes_select" ON public."recrutamento_automacoes" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rec_automacoes_update" ON public."recrutamento_automacoes";
CREATE POLICY "rec_automacoes_update" ON public."recrutamento_automacoes" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "recrutamento_candidatos_delete" ON public."recrutamento_candidatos";
CREATE POLICY "recrutamento_candidatos_delete" ON public."recrutamento_candidatos" FOR DELETE TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "recrutamento_candidatos_insert" ON public."recrutamento_candidatos";
CREATE POLICY "recrutamento_candidatos_insert" ON public."recrutamento_candidatos" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "recrutamento_candidatos_select" ON public."recrutamento_candidatos";
CREATE POLICY "recrutamento_candidatos_select" ON public."recrutamento_candidatos" FOR SELECT TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "recrutamento_candidatos_update" ON public."recrutamento_candidatos";
CREATE POLICY "recrutamento_candidatos_update" ON public."recrutamento_candidatos" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "recrutamento_operacoes_delete" ON public."recrutamento_operacoes";
CREATE POLICY "recrutamento_operacoes_delete" ON public."recrutamento_operacoes" FOR DELETE TO authenticated USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "recrutamento_operacoes_insert" ON public."recrutamento_operacoes";
CREATE POLICY "recrutamento_operacoes_insert" ON public."recrutamento_operacoes" FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "recrutamento_operacoes_select" ON public."recrutamento_operacoes";
CREATE POLICY "recrutamento_operacoes_select" ON public."recrutamento_operacoes" FOR SELECT TO authenticated USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "recrutamento_operacoes_update" ON public."recrutamento_operacoes";
CREATE POLICY "recrutamento_operacoes_update" ON public."recrutamento_operacoes" FOR UPDATE TO authenticated USING (auth.role() = 'authenticated'::text) WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "recrutamento_prestadores_delete" ON public."recrutamento_prestadores";
CREATE POLICY "recrutamento_prestadores_delete" ON public."recrutamento_prestadores" FOR DELETE TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "recrutamento_prestadores_insert" ON public."recrutamento_prestadores";
CREATE POLICY "recrutamento_prestadores_insert" ON public."recrutamento_prestadores" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "recrutamento_prestadores_select" ON public."recrutamento_prestadores";
CREATE POLICY "recrutamento_prestadores_select" ON public."recrutamento_prestadores" FOR SELECT TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "recrutamento_prestadores_update" ON public."recrutamento_prestadores";
CREATE POLICY "recrutamento_prestadores_update" ON public."recrutamento_prestadores" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text OR auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "rede_oportunidades_all_authenticated" ON public."rede_oportunidades";
CREATE POLICY "rede_oportunidades_all_authenticated" ON public."rede_oportunidades" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rede_oportunidades_select_anon" ON public."rede_oportunidades";
CREATE POLICY "rede_oportunidades_select_anon" ON public."rede_oportunidades" FOR SELECT TO anon USING (status = ANY (ARRAY['publicada'::rede_oportunidade_status, 'visualizada'::rede_oportunidade_status, 'interessada'::rede_oportunidade_status]));
DROP POLICY IF EXISTS "rede_visualizacoes_all_anon" ON public."rede_visualizacoes";
CREATE POLICY "rede_visualizacoes_all_anon" ON public."rede_visualizacoes" FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rede_visualizacoes_all_authenticated" ON public."rede_visualizacoes";
CREATE POLICY "rede_visualizacoes_all_authenticated" ON public."rede_visualizacoes" FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rp_delete_tenant" ON public."reembolsos_prestador";
CREATE POLICY "rp_delete_tenant" ON public."reembolsos_prestador" FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "rp_insert_tenant" ON public."reembolsos_prestador";
CREATE POLICY "rp_insert_tenant" ON public."reembolsos_prestador" FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "rp_select_tenant" ON public."reembolsos_prestador";
CREATE POLICY "rp_select_tenant" ON public."reembolsos_prestador" FOR SELECT TO authenticated, anon USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "rp_update_tenant" ON public."reembolsos_prestador";
CREATE POLICY "rp_update_tenant" ON public."reembolsos_prestador" FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "Allow all operations" ON public."regras_fiscais_cte";
CREATE POLICY "Allow all operations" ON public."regras_fiscais_cte" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public."regras_fiscais_cte";
CREATE POLICY "Enable insert for authenticated" ON public."regras_fiscais_cte" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Enable select for authenticated" ON public."regras_fiscais_cte";
CREATE POLICY "Enable select for authenticated" ON public."regras_fiscais_cte" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Enable update for authenticated" ON public."regras_fiscais_cte";
CREATE POLICY "Enable update for authenticated" ON public."regras_fiscais_cte" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "Allow all operations" ON public."regras_fiscais_nfse";
CREATE POLICY "Allow all operations" ON public."regras_fiscais_nfse" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rota_paradas_insert_authenticated" ON public."rota_paradas";
CREATE POLICY "rota_paradas_insert_authenticated" ON public."rota_paradas" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rota_paradas_select_anon" ON public."rota_paradas";
CREATE POLICY "rota_paradas_select_anon" ON public."rota_paradas" FOR SELECT TO anon USING ((rota_id IN ( SELECT rotas.id
   FROM rotas
  WHERE (rotas.prestador_id IN ( SELECT prestadores.id
           FROM prestadores
          WHERE rotas.tenant_id = current_tenant_id_safe())))));
DROP POLICY IF EXISTS "rota_paradas_select_authenticated" ON public."rota_paradas";
CREATE POLICY "rota_paradas_select_authenticated" ON public."rota_paradas" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rota_paradas_update_authenticated" ON public."rota_paradas";
CREATE POLICY "rota_paradas_update_authenticated" ON public."rota_paradas" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rp_select_portal" ON public."rota_paradas";
CREATE POLICY "rp_select_portal" ON public."rota_paradas" FOR SELECT TO authenticated, anon USING ((rota_id IN ( SELECT rotas.id
   FROM rotas
  WHERE rotas.cliente_id = f_obter_cliente_id_do_usuario())));
DROP POLICY IF EXISTS "rotas_insert_authenticated" ON public."rotas";
CREATE POLICY "rotas_insert_authenticated" ON public."rotas" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rotas_insert_tms" ON public."rotas";
CREATE POLICY "rotas_insert_tms" ON public."rotas" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rotas_select_anon_suas" ON public."rotas";
CREATE POLICY "rotas_select_anon_suas" ON public."rotas" FOR SELECT TO anon USING ((prestador_id IN ( SELECT prestadores.id
   FROM prestadores
  WHERE rotas.tenant_id = current_tenant_id_safe())));
DROP POLICY IF EXISTS "rotas_select_authenticated" ON public."rotas";
CREATE POLICY "rotas_select_authenticated" ON public."rotas" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rotas_select_portal" ON public."rotas";
CREATE POLICY "rotas_select_portal" ON public."rotas" FOR SELECT TO authenticated, anon USING (cliente_id = f_obter_cliente_id_do_usuario() OR cliente_id IS NULL);
DROP POLICY IF EXISTS "rotas_update_authenticated" ON public."rotas";
CREATE POLICY "rotas_update_authenticated" ON public."rotas" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "rotinas_execucoes_delete_policy" ON public."rotinas_execucoes_ia";
CREATE POLICY "rotinas_execucoes_delete_policy" ON public."rotinas_execucoes_ia" FOR DELETE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "rotinas_execucoes_insert_policy" ON public."rotinas_execucoes_ia";
CREATE POLICY "rotinas_execucoes_insert_policy" ON public."rotinas_execucoes_ia" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "rotinas_execucoes_select_policy" ON public."rotinas_execucoes_ia";
CREATE POLICY "rotinas_execucoes_select_policy" ON public."rotinas_execucoes_ia" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "rotinas_execucoes_update_policy" ON public."rotinas_execucoes_ia";
CREATE POLICY "rotinas_execucoes_update_policy" ON public."rotinas_execucoes_ia" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "rotinas_ia_delete_policy" ON public."rotinas_ia";
CREATE POLICY "rotinas_ia_delete_policy" ON public."rotinas_ia" FOR DELETE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "rotinas_ia_insert_policy" ON public."rotinas_ia";
CREATE POLICY "rotinas_ia_insert_policy" ON public."rotinas_ia" FOR INSERT TO public WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "rotinas_ia_select_policy" ON public."rotinas_ia";
CREATE POLICY "rotinas_ia_select_policy" ON public."rotinas_ia" FOR SELECT TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "rotinas_ia_update_policy" ON public."rotinas_ia";
CREATE POLICY "rotinas_ia_update_policy" ON public."rotinas_ia" FOR UPDATE TO public USING (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "route_stops_own" ON public."route_stops";
CREATE POLICY "route_stops_own" ON public."route_stops" FOR ALL TO public USING ((operation_id IN ( SELECT driver_operations.id
   FROM driver_operations
  WHERE driver_operations.driver_id = auth.uid())));
DROP POLICY IF EXISTS "Allow all on tabela_prestador" ON public."tabela_prestador";
CREATE POLICY "Allow all on tabela_prestador" ON public."tabela_prestador" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tp_delete_tenant" ON public."tabela_prestador";
CREATE POLICY "tp_delete_tenant" ON public."tabela_prestador" FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tp_insert_tenant" ON public."tabela_prestador";
CREATE POLICY "tp_insert_tenant" ON public."tabela_prestador" FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tp_select_tenant" ON public."tabela_prestador";
CREATE POLICY "tp_select_tenant" ON public."tabela_prestador" FOR SELECT TO authenticated, anon USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tp_update_tenant" ON public."tabela_prestador";
CREATE POLICY "tp_update_tenant" ON public."tabela_prestador" FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tv_delete_tenant" ON public."tabelas_valores";
CREATE POLICY "tv_delete_tenant" ON public."tabelas_valores" FOR DELETE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tv_insert_tenant" ON public."tabelas_valores";
CREATE POLICY "tv_insert_tenant" ON public."tabelas_valores" FOR INSERT TO authenticated WITH CHECK (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tv_insert_tms" ON public."tabelas_valores";
CREATE POLICY "tv_insert_tms" ON public."tabelas_valores" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tv_select_tenant" ON public."tabelas_valores";
CREATE POLICY "tv_select_tenant" ON public."tabelas_valores" FOR SELECT TO authenticated, anon USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tv_select_tms" ON public."tabelas_valores";
CREATE POLICY "tv_select_tms" ON public."tabelas_valores" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tv_update_tenant" ON public."tabelas_valores";
CREATE POLICY "tv_update_tenant" ON public."tabelas_valores" FOR UPDATE TO authenticated USING (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tv_update_tms" ON public."tabelas_valores";
CREATE POLICY "tv_update_tms" ON public."tabelas_valores" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())) AND tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tu_insert_auth" ON public."tenant_usuarios";
CREATE POLICY "tu_insert_auth" ON public."tenant_usuarios" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "tu_select_anon" ON public."tenant_usuarios";
CREATE POLICY "tu_select_anon" ON public."tenant_usuarios" FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "tu_update_auth" ON public."tenant_usuarios";
CREATE POLICY "tu_update_auth" ON public."tenant_usuarios" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "tenants_insert_auth" ON public."tenants";
CREATE POLICY "tenants_insert_auth" ON public."tenants" FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "tenants_select_anon" ON public."tenants";
CREATE POLICY "tenants_select_anon" ON public."tenants" FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS "tenants_update_auth" ON public."tenants";
CREATE POLICY "tenants_update_auth" ON public."tenants" FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "tpl_links_insert_tenant" ON public."tracking_public_links";
CREATE POLICY "tpl_links_insert_tenant" ON public."tracking_public_links" FOR INSERT TO authenticated, anon WITH CHECK (tenant_id = current_tenant_id_safe());
DROP POLICY IF EXISTS "tpl_links_select_public" ON public."tracking_public_links";
CREATE POLICY "tpl_links_select_public" ON public."tracking_public_links" FOR SELECT TO authenticated, anon USING (ativo = true);
DROP POLICY IF EXISTS "treinamento_arquivos_admin_all" ON public."treinamento_arquivos_ia";
CREATE POLICY "treinamento_arquivos_admin_all" ON public."treinamento_arquivos_ia" FOR ALL TO public USING (auth.role() = 'authenticated'::text) WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "treinamento_arquivos_anon_all" ON public."treinamento_arquivos_ia";
CREATE POLICY "treinamento_arquivos_anon_all" ON public."treinamento_arquivos_ia" FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_all" ON public."usuarios_cliente";
CREATE POLICY "admin_all" ON public."usuarios_cliente" FOR ALL TO public USING (auth.role() = 'authenticated'::text) WITH CHECK (auth.role() = 'authenticated'::text);
DROP POLICY IF EXISTS "cliente_read_own" ON public."usuarios_cliente";
CREATE POLICY "cliente_read_own" ON public."usuarios_cliente" FOR SELECT TO public USING (auth.uid() = auth_user_id AND ativo = true);
DROP POLICY IF EXISTS "veiculos_delete_tms" ON public."veiculos";
CREATE POLICY "veiculos_delete_tms" ON public."veiculos" FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "veiculos_insert_prestador" ON public."veiculos";
CREATE POLICY "veiculos_insert_prestador" ON public."veiculos" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM prestadores p
  WHERE p.id = veiculos.prestador_vinculado AND p.auth_user_id = auth.uid())));
DROP POLICY IF EXISTS "veiculos_insert_tms" ON public."veiculos";
CREATE POLICY "veiculos_insert_tms" ON public."veiculos" FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "veiculos_select_portal" ON public."veiculos";
CREATE POLICY "veiculos_select_portal" ON public."veiculos" FOR SELECT TO authenticated USING (f_obter_cliente_id_do_usuario() IS NOT NULL);
DROP POLICY IF EXISTS "veiculos_select_tms" ON public."veiculos";
CREATE POLICY "veiculos_select_tms" ON public."veiculos" FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "veiculos_update_tms" ON public."veiculos";
CREATE POLICY "veiculos_update_tms" ON public."veiculos" FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM tenant_usuarios
  WHERE tenant_usuarios.user_id = auth.uid())));
DROP POLICY IF EXISTS "Permitir tudo em webhooks_recebidos" ON public."webhooks_recebidos";
CREATE POLICY "Permitir tudo em webhooks_recebidos" ON public."webhooks_recebidos" FOR ALL TO public USING (true);
