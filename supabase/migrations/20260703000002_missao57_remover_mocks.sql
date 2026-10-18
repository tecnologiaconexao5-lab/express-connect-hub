-- MISSÃO 57 — Remover Mocks e localStorage dos Módulos Críticos
-- Seed data for paginação + tabelas reais
-- ============================================================

-- Seed CLIENTES (50 registros para paginação)
INSERT INTO public.clientes (
  id, nome, razao_social, cnpj_cpf, telefone, email, 
  tipo_cliente, status, created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  'Cliente Pag ' || LPAD(i::text, 3, '0'),
  'RAZAO SOCIAL ' || LPAD(i::text, 3, '0') || ' LTDA',
  LPAD((10000000000000 + i)::text, 14, '0'),
  '(11) 9' || LPAD((9000 + i)::text, 4, '0') || '-' || LPAD(i::text, 4, '0'),
  'cliente' || i || '@email.com.br',
  CASE WHEN i % 3 = 0 THEN 'transportador' WHEN i % 3 = 1 THEN 'embarcador' ELSE 'ambos' END,
  'ativo',
  now() - (i || ' days')::interval,
  now()
FROM generate_series(1, 50) AS i
WHERE NOT EXISTS (
  SELECT 1 FROM public.clientes WHERE nome LIKE 'Cliente Pag %' LIMIT 1
);

-- Seed PRESTADORES (50 registros para paginação)
INSERT INTO public.prestadores (
  id, nome, razao_social, cpf_cnpj, telefone, email, 
  tipo_prestador, status, created_at, updated_at
)
SELECT 
  gen_random_uuid(),
  'Prestador Pag ' || LPAD(i::text, 3, '0'),
  'PRESTADOR ' || LPAD(i::text, 3, '0') || ' TRANSPORTES LTDA',
  LPAD((20000000000000 + i)::text, 14, '0'),
  '(11) 9' || LPAD((8000 + i)::text, 4, '0') || '-' || LPAD(i::text, 4, '0'),
  'prestador' || i || '@email.com.br',
  CASE WHEN i % 2 = 0 THEN 'pessoa_juridica' ELSE 'pessoa_fisica' END,
  'ativo',
  now() - (i || ' days')::interval,
  now()
FROM generate_series(1, 50) AS i
WHERE NOT EXISTS (
  SELECT 1 FROM public.prestadores WHERE nome LIKE 'Prestador Pag %' LIMIT 1
);

-- Seed RECRUTAMENTO_CANDIDATOS (20 registros)
INSERT INTO public.recrutamento_candidatos (
  id, nome, score, cidade, uf, veiculo, placa,
  status_documental, prioridade, validade_cnh, stage,
  telefone, email, data_entrada, data_atualizacao, tags, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  nome,
  (40 + floor(random() * 60))::int,
  cidade,
  uf,
  veiculo,
  'ABC-' || LPAD((1000 + row_number() OVER ())::text, 4, '0'),
  (ARRAY['completo', 'pendente', 'incompleto', 'analise'])[floor(random() * 4 + 1)]::text,
  (ARRAY['alta', 'media', 'baixa'])[floor(random() * 3 + 1)]::text,
  (ARRAY['valida', 'valida', 'valida', 'vencendo', 'vencida'])[floor(random() * 5 + 1)]::text,
  (ARRAY['novo_cadastro', 'triagem', 'entrevista', 'analise_documentos', 'aprovado'])[floor(random() * 5 + 1)]::text,
  '(11) 9' || LPAD((7000 + row_number() OVER ())::text, 4, '0') || '-' || LPAD(row_number() OVER ()::int, 4, '0'),
  'candidato' || row_number() OVER () || '@email.com',
  now() - ((row_number() OVER () * 2) || ' days')::interval,
  now() - (row_number() OVER () || ' days')::interval,
  (ARRAY['["experiente"]'::jsonb, '["veiculo_proprio"]'::jsonb, '["disponivel_imediato"]'::jsonb, '["experiente","veiculo_proprio"]'::jsonb, '["recomendado"]'::jsonb])[floor(random() * 5 + 1)],
  now() - ((row_number() OVER () * 2) || ' days')::interval,
  now()
FROM (
  SELECT unnest(ARRAY[
    'Ana Clara Oliveira', 'Bruno Santos Lima', 'Carlos Eduardo Pereira',
    'Daniela Souza Costa', 'Eduardo Almeida Neto', 'Fernanda Lima Rocha',
    'Gabriel Barbosa Santos', 'Helena Martins Dias', 'Igor Costa Ribeiro',
    'Julia Oliveira Campos', 'Lucas Henrique Silva', 'Mariana Fernandes Souza',
    'Nelson Batista Alves', 'Patricia Gomes Correia', 'Rafael Torres Mendes'
  ]) AS nome
  UNION ALL
  SELECT unnest(ARRAY[
    'Sabrina Castro Lima', 'Thiago Nogueira Pinto', 'Vanessa Oliveira Rios',
    'William Cardoso Braga', 'Yasmin Santos Teixeira'
  ]) AS nome
) AS nomes
CROSS JOIN LATERAL (
  SELECT 
    (ARRAY['São Paulo','Guarulhos','Campinas','Santo André','Osasco','Rio de Janeiro','Niterói','Duque de Caxias','Belo Horizonte','Contagem','Uberlândia','Curitiba','Londrina','Porto Alegre','Florianópolis','Joinville','Salvador','Recife','Fortaleza','Brasília'])[floor(random() * 20 + 1)] AS cidade,
    (ARRAY['SP','SP','SP','SP','SP','RJ','RJ','RJ','MG','MG','MG','PR','PR','RS','SC','SC','BA','PE','CE','DF'])[floor(random() * 20 + 1)] AS uf,
    (ARRAY['Fiorino','VUC','Toco','Truck','Carreta','Van','Fiorino','VUC','Truck','Carreta','Van','Fiorino','Toco','Truck','Carreta','VUC','Fiorino','Toco','Truck','Carreta'])[floor(random() * 20 + 1)] AS veiculo
) AS dados
WHERE NOT EXISTS (
  SELECT 1 FROM public.recrutamento_candidatos WHERE nome = nomes.nome LIMIT 1
);

-- Seed entregas_protocolo (10 registros para POD)
INSERT INTO public.entregas_protocolo (
  id, alocacao_id, prestador_id, nome_recebedor, documento_recebedor,
  observacao, data_hora_entrega, latitude, longitude, status, created_at
)
SELECT
  gen_random_uuid(),
  NULL, NULL,
  (ARRAY['José Pereira', 'Maria Souza', 'Carlos Lima', 'Ana Oliveira', 'Pedro Santos'])[floor(random() * 5 + 1)],
  'Doc ' || LPAD((1000 + i)::text, 6, '0'),
  'Entrega realizada conforme pedido',
  now() - (i || ' days')::interval,
  (-23.5 - random() * 0.1)::numeric(10,4),
  (-46.6 - random() * 0.1)::numeric(10,4),
  'entregue',
  now() - (i || ' days')::interval
FROM generate_series(1, 10) AS i
WHERE NOT EXISTS (
  SELECT 1 FROM public.entregas_protocolo LIMIT 1
);
