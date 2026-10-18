-- =============================================================
-- MISSÃO 132-A — CONTRATO ENTERPRISE DE ENDEREÇOS OPERACIONAIS
-- =============================================================
-- 
-- Cria o contrato oficial de endereços operacionais (OperationalAddress)
-- sem quebrar compatibilidade com dados existentes.
--
-- Estratégia:
--   - alocacoes_escala: JSONB (endereco_origem, endereco_destino)
--   - rota_paradas: colunas estruturadas (portaria, doca, procedimentos...)
--   - enderecos_clientes: colunas adicionais (referencia, contato, instruções...)
--   - ordens_servico: já usa JSONB (enderecos) — schema ampliado via OS-Endereco
-- 
-- Nenhum campo existente é removido ou alterado.
-- =============================================================

-- =============================================================
-- 1. alocacoes_escala — endereços operacionais JSONB
-- =============================================================
-- Armazena snapshots independentes de origem e destino.
-- Cada alocação preserva os dados do momento da sincronização.
-- Não substitui origem/destino TEXT existentes (compatibilidade).
-- =============================================================

ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS endereco_origem JSONB,
  ADD COLUMN IF NOT EXISTS endereco_destino JSONB;

COMMENT ON COLUMN public.alocacoes_escala.endereco_origem IS
  'Snapshot do endereço de origem (OperationalAddress JSON). Missão 132-A.';
COMMENT ON COLUMN public.alocacoes_escala.endereco_destino IS
  'Snapshot do endereço de destino (OperationalAddress JSON). Missão 132-A.';

-- Índice GIN para consultas futuras em JSONB
CREATE INDEX IF NOT EXISTS idx_alocacoes_endereco_origem
  ON public.alocacoes_escala USING GIN (endereco_origem);
CREATE INDEX IF NOT EXISTS idx_alocacoes_endereco_destino
  ON public.alocacoes_escala USING GIN (endereco_destino);

-- =============================================================
-- 2. rota_paradas — campos operacionais de endereço
-- =============================================================
-- rota_paradas já possui: endereco, numero, bairro, cidade, uf, cep,
-- complemento, latitude, longitude, contato, instrucoes, prioridade.
-- Adicionar campos operacionais faltantes.
-- =============================================================

ALTER TABLE public.rota_paradas
  ADD COLUMN IF NOT EXISTS referencia TEXT,
  ADD COLUMN IF NOT EXISTS portaria TEXT,
  ADD COLUMN IF NOT EXISTS doca TEXT,
  ADD COLUMN IF NOT EXISTS procedimento_entrada TEXT,
  ADD COLUMN IF NOT EXISTS procedimento_saida TEXT,
  ADD COLUMN IF NOT EXISTS estacionamento TEXT,
  ADD COLUMN IF NOT EXISTS documento_necessario TEXT,
  ADD COLUMN IF NOT EXISTS codigo_acesso TEXT,
  ADD COLUMN IF NOT EXISTS exigencia_epi BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS exige_ajudante BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS restricao_veiculo TEXT,
  ADD COLUMN IF NOT EXISTS restricao_altura TEXT,
  ADD COLUMN IF NOT EXISTS outras_restricoes TEXT,
  ADD COLUMN IF NOT EXISTS contato_nome TEXT,
  ADD COLUMN IF NOT EXISTS contato_telefone TEXT,
  ADD COLUMN IF NOT EXISTS janela_inicio TEXT,
  ADD COLUMN IF NOT EXISTS janela_fim TEXT,
  ADD COLUMN IF NOT EXISTS data_prevista DATE;

COMMENT ON COLUMN public.rota_paradas.referencia IS 'Ponto de referência do local';
COMMENT ON COLUMN public.rota_paradas.portaria IS 'Portaria de acesso (ex: Portaria de cargas)';
COMMENT ON COLUMN public.rota_paradas.doca IS 'Doca de carga/descarga';
COMMENT ON COLUMN public.rota_paradas.procedimento_entrada IS 'Procedimento para entrada no local';
COMMENT ON COLUMN public.rota_paradas.procedimento_saida IS 'Procedimento para saída do local';
COMMENT ON COLUMN public.rota_paradas.estacionamento IS 'Informações de estacionamento';
COMMENT ON COLUMN public.rota_paradas.documento_necessario IS 'Documento exigido para acesso';
COMMENT ON COLUMN public.rota_paradas.codigo_acesso IS 'Código de acesso/senha';
COMMENT ON COLUMN public.rota_paradas.exigencia_epi IS 'Exige EPI para acesso ao local';
COMMENT ON COLUMN public.rota_paradas.exige_ajudante IS 'Exige ajudante para descarga';
COMMENT ON COLUMN public.rota_paradas.restricao_veiculo IS 'Restrição de tipo de veículo';
COMMENT ON COLUMN public.rota_paradas.restricao_altura IS 'Restrição de altura máxima';
COMMENT ON COLUMN public.rota_paradas.outras_restricoes IS 'Outras restrições operacionais';
COMMENT ON COLUMN public.rota_paradas.contato_nome IS 'Nome do contato no local';
COMMENT ON COLUMN public.rota_paradas.contato_telefone IS 'Telefone do contato no local';
COMMENT ON COLUMN public.rota_paradas.janela_inicio IS 'Início da janela de entrega';
COMMENT ON COLUMN public.rota_paradas.janela_fim IS 'Fim da janela de entrega';
COMMENT ON COLUMN public.rota_paradas.data_prevista IS 'Data prevista para a parada';

-- =============================================================
-- 3. enderecos_clientes — campos adicionais
-- =============================================================
-- A interface EnderecoCliente já possui: referencia, contatoLocal,
-- telefoneLocal, instrucoes, janelaPadrao, restricoes, agendamento.
-- Adicionar ao banco os campos faltantes + campos operacionais.
-- =============================================================

ALTER TABLE public.enderecos_clientes
  ADD COLUMN IF NOT EXISTS referencia TEXT,
  ADD COLUMN IF NOT EXISTS contato_local TEXT,
  ADD COLUMN IF NOT EXISTS telefone_local TEXT,
  ADD COLUMN IF NOT EXISTS instrucoes TEXT,
  ADD COLUMN IF NOT EXISTS janela_inicio TEXT,
  ADD COLUMN IF NOT EXISTS janela_fim TEXT,
  ADD COLUMN IF NOT EXISTS restricoes TEXT,
  ADD COLUMN IF NOT EXISTS nome_local TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS portaria TEXT,
  ADD COLUMN IF NOT EXISTS doca TEXT,
  ADD COLUMN IF NOT EXISTS procedimento_entrada TEXT,
  ADD COLUMN IF NOT EXISTS procedimento_saida TEXT;

COMMENT ON COLUMN public.enderecos_clientes.referencia IS 'Ponto de referência';
COMMENT ON COLUMN public.enderecos_clientes.contato_local IS 'Nome do contato no local';
COMMENT ON COLUMN public.enderecos_clientes.telefone_local IS 'Telefone do contato';
COMMENT ON COLUMN public.enderecos_clientes.instrucoes IS 'Instruções operacionais padrão';
COMMENT ON COLUMN public.enderecos_clientes.janela_inicio IS 'Janela padrão início';
COMMENT ON COLUMN public.enderecos_clientes.janela_fim IS 'Janela padrão fim';
COMMENT ON COLUMN public.enderecos_clientes.restricoes IS 'Restrições operacionais';
COMMENT ON COLUMN public.enderecos_clientes.nome_local IS 'Nome do local/endereço';
COMMENT ON COLUMN public.enderecos_clientes.latitude IS 'Latitude do endereço';
COMMENT ON COLUMN public.enderecos_clientes.longitude IS 'Longitude do endereço';
COMMENT ON COLUMN public.enderecos_clientes.portaria IS 'Portaria de acesso';
COMMENT ON COLUMN public.enderecos_clientes.doca IS 'Doca padrão';
COMMENT ON COLUMN public.enderecos_clientes.procedimento_entrada IS 'Procedimento de entrada padrão';
COMMENT ON COLUMN public.enderecos_clientes.procedimento_saida IS 'Procedimento de saída padrão';

-- =============================================================
-- 4. vw_app_motorista_operacoes — ATUALIZAR VIEW
-- =============================================================
-- Adicionar endereco_origem e endereco_destino como JSONB
-- =============================================================

CREATE OR REPLACE VIEW public.vw_app_motorista_operacoes AS
SELECT
  a.id AS alocacao_id,
  a.ordem_servico_id AS os_id,
  a.prestador_id AS motorista_id,
  a.prestador_id,
  a.cliente_id,
  a.status,
  a.data_escala,
  COALESCE(
    a.metadata->>'operation_mode',
    CASE
      WHEN r.operation_mode IS NOT NULL THEN r.operation_mode
      WHEN a.tipo_reversa IS NOT NULL AND a.tipo_reversa != 'sem_reversa' THEN 'reversa'
      WHEN r.id IS NOT NULL THEN 'multi_stop_route'
      ELSE 'direta'
    END
  ) AS operation_mode,
  a.metadata,
  os.numero AS os_numero,
  os.romaneio,
  os.tipo_operacao,
  os.prioridade,
  os.instrucoes_operacionais_os,
  os.enderecos,
  a.data_aceite,
  a.horario_inicio_real,
  a.horario_fim_real,
  a.tempo_total_minutos,
  r.horario_previsto,
  a.origem,
  a.destino,
  a.endereco_origem,
  a.endereco_destino,
  v_join.id AS veiculo_id,
  a.tipo_veiculo,
  v_join.placa AS veiculo_placa,
  a.placa,
  CASE WHEN v_join.id IS NOT NULL THEN 'veiculo_cadastrado' ELSE 'prestador_fallback' END AS veiculo_origem,
  os.carga_tipo,
  os.carga_refrigerada,
  os.tipo_carga,
  os.carga_descricao,
  os.volumes,
  os.peso,
  os.cubagem,
  os.pallets,
  os.valor_declarado,
  pr.nome_completo AS motorista_nome,
  pr.nome_completo AS prestador_nome,
  pr.nome_fantasia AS prestador_nome_fantasia,
  pr.telefone AS motorista_telefone,
  pr.whatsapp AS motorista_whatsapp,
  c.nome_fantasia AS cliente_nome,
  c.razao_social AS cliente_razao_social,
  c.telefone AS cliente_telefone,
  c.cidade AS cliente_cidade,
  c.uf AS cliente_uf,
  a.valor_frete,
  a.valor_repasse,
  a.km_previstos,
  a.km_realizados,
  a.aceite_prestador,
  r.id AS rota_id,
  r.nome AS rota_nome,
  r.status AS rota_status,
  r.distancia_km AS rota_distancia_km,
  r.numero_paradas,
  r.paradas_pendentes,
  (SELECT COUNT(*)::INTEGER FROM public.rota_paradas rp WHERE rp.rota_id = r.id AND rp.status = 'pendente') AS paradas_pendentes_count,
  r.operation_mode AS rota_operation_mode,
  a.tipo_reversa,
  CASE WHEN a.tipo_reversa IS NOT NULL AND a.tipo_reversa != 'sem_reversa' THEN true ELSE false END AS possui_reversa,
  a.reversa_status,
  a.reversa_qtd_volumes,
  a.reversa_qtd_coletada,
  a.reversa_unidade_cobranca,
  a.reversa_motivo_divergencia,
  a.reversa_responsavel,
  a.reversa_telefone,
  a.reversa_data_prevista,
  a.reversa_observacoes,
  a.reversa_endereco_coleta,
  a.reversa_endereco_devolucao,
  a.reversa_valor_prestador,
  a.reversa_pod_url,
  a.reversa_fotos,
  a.reversa_realizada_em,
  a.reversa_assinatura_url,
  a.reversa_latitude,
  a.reversa_longitude,
  a.observacoes,
  a.instrucoes_operacionais,
  tr.latitude,
  tr.longitude,
  tr.velocidade,
  tr.updated_at AS ultima_atualizacao
FROM public.alocacoes_escala a
LEFT JOIN public.clientes c ON c.id = a.cliente_id
LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
LEFT JOIN public.prestadores pr ON pr.id = a.prestador_id
LEFT JOIN LATERAL (
  SELECT v.id, v.placa
  FROM public.veiculos v
  WHERE v.prestador_vinculado::text = a.prestador_id::text
    AND (v.placa = a.placa OR (a.placa IS NULL AND v.placa IS NOT NULL))
  ORDER BY v.placa = a.placa DESC NULLS LAST
  LIMIT 1
) v_join ON true
LEFT JOIN public.rotas r ON r.alocacao_id = a.id
LEFT JOIN LATERAL (
  SELECT tr.latitude, tr.longitude, tr.velocidade, tr.updated_at
  FROM public.portal_tracking_realtime tr
  WHERE tr.alocacao_id = a.id
  ORDER BY tr.updated_at DESC NULLS LAST
  LIMIT 1
) tr ON true
WHERE a.prestador_id IS NOT NULL;

-- =============================================================
-- 5. vw_app_motorista_paradas — ATUALIZAR VIEW
-- =============================================================
-- Adicionar novos campos operacionais
-- =============================================================

CREATE OR REPLACE VIEW public.vw_app_motorista_paradas AS
SELECT
  rp.id AS parada_id,
  rp.rota_id,
  rp.sequencia,
  rp.cliente_nome AS destinatario,
  rp.endereco,
  rp.numero,
  rp.bairro,
  rp.cidade,
  rp.uf,
  rp.cep,
  rp.complemento,
  rp.referencia,
  rp.latitude,
  rp.longitude,
  rp.peso,
  rp.volumes,
  rp.cubagem,
  rp.temperatura AS tipo_carga,
  rp.prioridade,
  rp.janela_entrega,
  rp.janela_inicio,
  rp.janela_fim,
  rp.data_prevista,
  rp.instrucoes,
  rp.portaria,
  rp.doca,
  rp.procedimento_entrada,
  rp.procedimento_saida,
  rp.estacionamento,
  rp.documento_necessario,
  rp.codigo_acesso,
  rp.exigencia_epi,
  rp.exige_ajudante,
  rp.restricao_veiculo,
  rp.restricao_altura,
  rp.outras_restricoes,
  rp.contato_nome,
  rp.contato_telefone,
  rp.status,
  rp.recebedor,
  rp.assinatura_url,
  rp.pod_url,
  rp.fotos,
  rp.ocorrencia,
  rp.data_hora,
  rp.latitude_fim,
  rp.longitude_fim,
  rp.data_entrega,
  rp.volumes_entregues,
  rp.observacoes,
  rp.os_id,
  rp.alocacao_id,
  rp.pedido,
  rp.nota_fiscal,
  rp.contato,
  rp.tipo_carga AS tipo_carga_parada
FROM public.rota_paradas rp
ORDER BY rp.sequencia;

-- =============================================================
-- 6. f_buscar_operacoes_motorista — NÃO requer alteração
-- =============================================================
-- A RPC consome vw_app_motorista_operacoes e retorna todas as colunas.
-- Como a view foi atualizada, a RPC passa a retornar
-- endereco_origem e endereco_destino automaticamente.
-- =============================================================

-- =============================================================
-- 7. Índices para novos campos de rota_paradas
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_rota_paradas_referencia ON public.rota_paradas (referencia);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_portaria ON public.rota_paradas (portaria);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_data_prevista ON public.rota_paradas (data_prevista);

-- =============================================================
-- 8. Índices para novos campos de enderecos_clientes
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_enderecos_clientes_contato ON public.enderecos_clientes (contato_local);
CREATE INDEX IF NOT EXISTS idx_enderecos_clientes_referencia ON public.enderecos_clientes (referencia);
