// src/services/mensagensTemplates.ts
export interface TemplateMensagem {
  id: string;
  chave: string;
  evento: string;
  canal: string;
  idioma: string;
  titulo: string;
  corpo: string;
}

export const TEMPLATES_MENSAGENS: TemplateMensagem[] = [
  {
    id: "tpl-os-criada-001",
    chave: "OS_CRIADA",
    evento: "os_criada",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Confirmação de criação da OS",
    corpo: `Olá, {{nome_destinatario}}! 👋

Sua OS {{os_numero}} foi criada com sucesso! ✅

📋 Resumo:
• Coleta: {{endereco_coleta}}
• Entrega: {{endereco_entrega}}
• Data programada: {{data_programada}}
• Valor: R$ {{valor_os}}

🚚 Seu código de rastreio:
{{url_rastreio}}

Acompanhe cada etapa da entrega em tempo real.`,
  },
  {
    id: "tpl-os-iniciada-001",
    chave: "OS_INICIADA",
    evento: "os_iniciada",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Aviso de início da operação",
    corpo: `Olá, {{nome_destinatario}}! 🚚

A OS {{os_numero}} acaba de ser iniciada!

📍 Nosso motorista {{nome_prestador}} já está a caminho da coleta.
⏰ Previsão de coleta: {{previsao_coleta}}

Acompanhe em tempo real:
{{url_rastreio}}`,
  },
  {
    id: "tpl-saida-coleta-001",
    chave: "SAIDA_COLETA",
    evento: "os_saida_coleta",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Aviso de saída para coleta",
    corpo: `Olá, {{nome_destinatario}}! 📦

A coleta da OS {{os_numero}} foi iniciada!

🚛 Saindo agora para {{endereco_coleta}}.
📞 Contato: {{telefone_prestador}}

Acompanhe aqui:
{{url_rastreio}}`,
  },
  {
    id: "tpl-saida-entrega-001",
    chave: "SAIDA_ENTREGA",
    evento: "os_saida_entrega",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Aviso de saída para entrega",
    corpo: `Olá, {{nome_destinatario}}! 📦

A OS {{os_numero}} está a caminho da entrega!

🚛 Saindo de {{endereco_coleta}} com destino a {{endereco_entrega}}.
⏰ Previsão de chegada: {{previsao_entrega}}
📞 {{nome_prestador}}: {{telefone_prestador}}

Acompanhe em tempo real:
{{url_rastreio}}`,
  },
  {
    id: "tpl-chegada-proxima-001",
    chave: "CHEGADA_PROXIMA",
    evento: "os_chegada_destino",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Aviso de chegada próxima",
    corpo: `Olá, {{nome_destinatario}}! 📍

Atenção! A OS {{os_numero}} está se aproximando do destino!

🏁 Destino: {{endereco_entrega}}
⏰ Previsão: {{previsao_entrega}}
📞 {{nome_prestador}}: {{telefone_prestador}}

Fique atento para receber! 👍`,
  },
  {
    id: "tpl-tentativa-001",
    chave: "TENTATIVA_ENTREGA",
    evento: "os_tentativa_entrega",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Tentativa de entrega",
    corpo: `Olá, {{nome_destinatario}}! ⚠️

Não foi possível realizar a entrega da OS {{os_numero}} neste momento.

📋 Motivo: {{motivo}}
⏰ Nova tentativa prevista: {{data_reentrega}}

Para mais informações, entre em contato:
📞 {{telefone_prestador}}

Acompanhe:
{{url_rastreio}}`,
  },
  {
    id: "tpl-reentrega-001",
    chave: "REENTREGA",
    evento: "os_reentrega",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Agendamento de reentrega",
    corpo: `Olá, {{nome_destinatario}}! 📦

Sua reentrega foi agendada!

🔄 OS {{os_numero}} | Tentativa {{tentativa_numero}}
📅 Nova data: {{data_reentrega}}
📍 Local: {{endereco_entrega}}
⏰ Janela: {{janela_entrega}}

🚛 {{nome_prestador}} estará no local.
📞 {{telefone_prestador}}`,
  },
  {
    id: "tpl-finalizada-001",
    chave: "OS_FINALIZADA",
    evento: "os_finalizada",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Aviso de finalização",
    corpo: `Olá, {{nome_destinatario}}! ✅

A OS {{os_numero}} foi finalizada com sucesso!

🏁 Entrega realizada em {{endereco_entrega}}.
📦 Volumes: {{volumes}} | Peso: {{peso}}kg
⏱️ {{nome_prestador}} finalizou às {{hora_finalizacao}}.

Agradecemos a confiança! 🙏
📋 Sua nota fiscal está disponível no portal.`,
  },
  {
    id: "tpl-baixa-evidencia-001",
    chave: "BAIXA_EVIDENCIA",
    evento: "os_baixa_evidencia",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Confirmação de baixa com evidência",
    corpo: `Olá, {{nome_destinatario}}! 📋

Evidência da OS {{os_numero}} registrada!

✅ Status: {{status_baixa}}
📝 Obs: {{observacao_baixa}}
📸 Comprovante: {{url_comprovante}}
📞 Responsável: {{nome_prestador}}

Emitido em {{data_baixa}}.`,
  },
  {
    id: "tpl-orcamento-criado-001",
    chave: "ORCAMENTO_CRIADO",
    evento: "orcamento_criado",
    canal: "whatsapp",
    idioma: "pt-BR",
    titulo: "Confirmação de criação de orçamento",
    corpo: `Olá, {{nome_cliente}}! 🎉

Seu orçamento foi criado!

📄 Nº {{numero_orcamento}}
💰 Valor estimado: R$ {{valor_orcamento}}
📦 Volume previsto: {{volumes}} volumes
🛣️ Distância: {{distancia}}km

Aguarde aprovação para geração da OS.`,
  },
];

export function renderizarTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

export function getTemplatePorChave(chave: string): TemplateMensagem | undefined {
  return TEMPLATES_MENSAGENS.find((t) => t.chave === chave);
}

export function getTemplatesPorEvento(evento: string): TemplateMensagem[] {
  return TEMPLATES_MENSAGENS.filter((t) => t.evento === evento);
}