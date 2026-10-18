-- M36 — Estratégia Configurável do Hunter Comercial
-- Adiciona colunas JSONB para estratégia completa sem engessamento

ALTER TABLE comercial_hunter_config ADD COLUMN IF NOT EXISTS estrategia JSONB DEFAULT '{}';
ALTER TABLE comercial_hunter_config ADD COLUMN IF NOT EXISTS ia_config JSONB DEFAULT '{}';

-- Atualizar registros existentes com estratégia padrão
UPDATE comercial_hunter_config SET estrategia = '{
  "segmentos_alvo": ["Farmacias", "Laboratorios", "Distribuidoras", "Industrias", "E-commerce", "Autopecas", "Hospitais", "Clinicas", "Pet Shops", "Graficas", "Confeccoes", "Cosmeticos", "Alimentos", "Bebidas", "Eletronicos", "Materiais Medicos", "Materiais Eletricos"],
  "segmentos_proibidos": ["Transportadoras", "Operadores Logisticos", "Motoboys"],
  "palavras_chave_prospeccao": ["logistica", "transporte", "frete", "distribuicao", "entregas", "cargas"],
  "palavras_excluir": ["concorrente", "transportadora"],
  "concorrentes": ["transportadora", "operador logistico", "empresa de frete", "empresa de mudanca", "motoboy", "logistica", "transportes", "transportador", "carreteiro", "entregas"],
  "scoring": {
    "pesos": {
      "segmento_prioritario": 20,
      "possui_frota_propria": 5,
      "entregas_frequentes": 15,
      "em_expansao": 10,
      "novas_unidades": 10,
      "contratando_motoristas": 8,
      "reclamando_entregas": 12,
      "crescendo": 8,
      "porte_grande": 15,
      "porte_medio": 10,
      "porte_pequeno": 3,
      "volume_alto": 10,
      "necessidade_logistica": 10
    },
    "thresholds": {
      "em_chamas": 80,
      "quente": 60,
      "morno": 40
    },
    "probabilidade_ranges": {
      "em_chamas": {"min": 75, "max": 90},
      "quente": {"min": 55, "max": 75},
      "morno": {"min": 30, "max": 50},
      "frio": {"min": 10, "max": 25}
    }
  },
  "lead_quente": {
    "score_minimo": 80,
    "criterios_extra": ["Alto volume estimado", "Segmento prioritário", "Em expansão", "Necessidade logística urgente"]
  },
  "descarte": {
    "score_minimo_auto": 20,
    "concorrente_automatico": true,
    "motivos_auto": ["Score abaixo do mínimo", "Concorrente direto", "Fora do perfil comercial", "Segmento proibido", "Palavra-chave bloqueada"]
  },
  "anti_duplicidade": {
    "ativo": true,
    "criterios": ["empresa", "cnpj", "email", "telefone", "dominio"],
    "check_resultados_anteriores": true,
    "check_crm_leads": true
  },
  "canais": {
    "whatsapp": true,
    "email": true,
    "linkedin": false,
    "instagram": false,
    "ligacao": true,
    "ordem_prioridade": ["whatsapp", "email", "ligacao", "linkedin", "instagram"]
  },
  "tom_voz": {
    "estilo": "consultivo",
    "formalidade": "semiformal",
    "comprimento_maximo": 300,
    "regras": ["Seja natural e profissional", "Nunca pareça spam ou genérico", "Use linguagem corporativa brasileira", "Seja objetiva e mostre valor", "Máximo 3 parágrafos por mensagem"]
  },
  "followup": {
    "dias": [2, 5, 10, 20],
    "max_followups": 4,
    "tempo_recontato_dias": 30,
    "arquivar_apos_dias": 30,
    "mensagem_personalizada": true
  },
  "limites": {
    "leads_por_dia": 10,
    "prospeccoes_por_ciclo": 20,
    "orcamento_diario": 10.00,
    "orcamento_mensal": 200.00,
    "max_tokens_por_ciclo": 50000
  },
  "ia": {
    "provider": "groq",
    "model": "llama-3.1-8b-instant",
    "temperature": 0.7,
    "max_tokens": 2000,
    "fallback_provider": "groq",
    "fallback_model": "llama-3.1-8b-instant"
  },
  "abordagem": {
    "empresa_nome": "Conexao Express Transportes",
    "assunto_email_padrao": "Apresentacao Conexao Express",
    "comprimento_max_whatsapp": 300,
    "duracao_script_ligacao_seg": 30,
    "incluir_assinatura": true,
    "assinatura": "Atenciosamente, Equipe Comercial - Conexao Express"
  },
  "orcamento": {
    "diario": 10.00,
    "mensal": 200.00,
    "alerta_atingir": 80
  }
}'::jsonb WHERE estrategia = '{}'::jsonb;

UPDATE comercial_hunter_config SET ia_config = '{
  "provider": "groq",
  "model": "llama-3.1-8b-instant",
  "temperature_prospeccao": 0.7,
  "temperature_enriquecimento": 0.5,
  "temperature_validacao": 0.3,
  "temperature_abordagem": 0.7,
  "max_tokens_prospeccao": 2000,
  "max_tokens_enriquecimento": 1500,
  "max_tokens_validacao": 500,
  "max_tokens_abordagem": 1500,
  "fallback_provider": "groq",
  "fallback_model": "llama-3.1-8b-instant"
}'::jsonb WHERE ia_config = '{}'::jsonb;
