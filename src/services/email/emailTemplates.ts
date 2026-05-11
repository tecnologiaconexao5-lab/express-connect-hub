export interface TemplateData {
  [key: string]: unknown;
}

export const generateHTMLTemplate = (
  templateName: string,
  data: TemplateData
): string => {
  const baseStyles = `
    <style>
      body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
      .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 20px; text-align: center; }
      .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
      .content { padding: 20px; }
      .footer { background-color: #1e293b; color: #94a3b8; padding: 15px; text-align: center; font-size: 12px; }
      .btn { display: inline-block; background-color: #f97316; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
      .info-box { background-color: #f8fafc; border-left: 4px solid #f97316; padding: 15px; margin: 15px 0; }
      .label { font-weight: 600; color: #475569; }
      .value { color: #1e293b; }
    </style>
  `;

  const templates: Record<string, (data: TemplateData) => string> = {
    orcamento: (d) => `
      <div class="info-box">
        <p><span class="label">Número:</span> <span class="value">${d.numero}</span></p>
        <p><span class="label">Valor:</span> <span class="value">R$ ${d.valor}</span></p>
        <p><span class="label">Validade:</span> <span class="value">${d.validade}</span></p>
      </div>
      <p>Para aprovação, clique no botão abaixo:</p>
      <a href="${d.link_aprovacao}" class="btn">Aprovar Orçamento</a>
    `,
    os_detalhes: (d) => `
      <div class="info-box">
        <p><span class="label">OS:</span> <span class="value">${d.numero_os}</span></p>
        <p><span class="label">Cliente:</span> <span class="value">${d.cliente}</span></p>
        <p><span class="label">Rota:</span> <span class="value">${d.rota}</span></p>
        <p><span class="label">Status:</span> <span class="value">${d.status}</span></p>
      </div>
    `,
    comprovante: (d) => `
      <div class="info-box">
        <p><span class="label">OS:</span> <span class="value">${d.numero_os}</span></p>
        <p><span class="label">Data Entrega:</span> <span class="value">${d.data_entrega}</span></p>
        <p><span class="label">Recebedor:</span> <span class="value">${d.recebedor}</span></p>
      </div>
      <a href="${d.link_comprovante}" class="btn">Baixar Comprovante</a>
    `,
    pesquisa_satisfacao: (d) => `
      <p>Sua opinião é muito importante para nós!</p>
      <a href="${d.link_pesquisa}" class="btn">Responder Pesquisa</a>
      <p>Tempo estimado: 2 minutos.</p>
    `,
    boleto: (d) => `
      <div class="info-box">
        <p><span class="label">Documento:</span> <span class="value">${d.documento}</span></p>
        <p><span class="label">Valor:</span> <span class="value">R$ ${d.valor}</span></p>
        <p><span class="label">Vencimento:</span> <span class="value">${d.vencimento}</span></p>
        <p><span class="label">Pagador:</span> <span class="value">${d.pagador}</span></p>
      </div>
      <a href="${d.link_boleto}" class="btn">Pagar Boleto</a>
    `,
    followup: (d) => `
      <p>Olá! Gostaria de saber o feedback sobre ${d.proposta_orcamento}.</p>
      <p>Estamos à disposição para esclarecer qualquer dúvida.</p>
      <a href="${d.link_responder}" class="btn">Responder</a>
    `,
    boas_vindas: (d) => `
      <p>Bem-vindo, ${d.nome}!</p>
      <p>Seu cadastro foi realizado com sucesso em nosso sistema de gestão logística.</p>
      <div class="info-box">
        <p><span class="label">Conta:</span> <span class="value">${d.email}</span></p>
        <p><span class="label">Tipo:</span> <span class="value">${d.tipo_conta}</span></p>
      </div>
      <a href="${d.link_portal}" class="btn">Acessar Portal</a>
    `,
    pagamento_prestador: (d) => `
      <div class="info-box">
        <p><span class="label">Valor:</span> <span class="value">R$ ${d.valor}</span></p>
        <p><span class="label">OS(s):</span> <span class="value">${d.os_list}</span></p>
        <p><span class="label">Data:</span> <span class="value">${d.data_pagamento}</span></p>
        <p><span class="label">Banco:</span> <span class="value">${d.banco}</span></p>
      </div>
    `,
  };

  const templateBody = templates[templateName]
    ? templates[templateName](data)
    : "<p>Mensagem automática do TMS Conexão Express.</p>";

  return `
    <!DOCTYPE html>
    <html>
    <head>${baseStyles}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>TMS Conexão Express</h1>
        </div>
        <div class="content">
          ${templateBody}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Conexão Express Logística. Todos os direitos reservados.</p>
          <p>Este é um email automático. Por favor, não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const getTemplateVariables = (templateName: string): string[] => {
  const variables: Record<string, string[]> = {
    orcamento: ["numero", "valor", "validade", "link_aprovacao", "cliente"],
    os_detalhes: ["numero_os", "cliente", "rota", "status", "prestador", "placa"],
    comprovante: ["numero_os", "data_entrega", "recebedor", "link_comprovante"],
    pesquisa_satisfacao: ["link_pesquisa", "os_numero", "cliente_nome"],
    boleto: ["documento", "valor", "vencimento", "pagador", "link_boleto"],
    followup: ["proposta_orcamento", "link_responder", "contato_nome"],
    boas_vindas: ["nome", "email", "tipo_conta", "link_portal"],
    pagamento_prestador: ["valor", "os_list", "data_pagamento", "banco"],
  };

  return variables[templateName] || [];
};

export const validateTemplateData = (
  templateName: string,
  data: TemplateData
): { valid: boolean; missing: string[] } => {
  const required = getTemplateVariables(templateName);
  const missing = required.filter((v) => !data[v]);

  return {
    valid: missing.length === 0,
    missing,
  };
};