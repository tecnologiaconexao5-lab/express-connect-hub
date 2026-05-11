import {
  enviarEmailCliente,
  enviarEmailOperacional,
  enviarEmailComercial,
  enviarEmailFinanceiro,
  EmailEvent,
  sendToN8N,
} from "./zohoEmailService";
import { generateHTMLTemplate } from "./emailTemplates";

export type EventoEmail =
  | "cliente_criado"
  | "os_criada"
  | "os_finalizada"
  | "orcamento_enviado"
  | "orcamento_aprovado"
  | "entrega_concluida"
  | "comprovante_disponivel"
  | "boleto_disponivel"
  | "xml_recebido"
  | "followup_comercial"
  | "pesquisa_satisfacao"
  | "pagamento_prestador";

export interface AutomacaoEmailParams {
  evento: EventoEmail;
  destinatario: string;
  dados: Record<string, unknown>;
}

const mapEventoToEmailFunction = async (
  evento: EventoEmail,
  destinatario: string,
  dados: Record<string, unknown>
): Promise<{ success: boolean; reason?: string }> => {
  switch (evento) {
    case "cliente_criado":
      return enviarEmailCliente(destinatario, "boas_vindas", {
        nome: dados.nome,
        email: dados.email,
        tipo_conta: dados.tipo,
        link_portal: dados.link_portal,
      });

    case "os_criada":
      return enviarEmailOSCriada(destinatario, dados);

    case "os_finalizada":
      return enviarEmailOperacional(destinatario, "entrega", dados);

    case "orcamento_enviado":
      return enviarEmailOrcamento(destinatario, dados);

    case "orcamento_aprovado":
      return enviarEmailComercial(destinatario, "followup", {
        proposta: dados.numero_orcamento,
        status: "aprovado",
      });

    case "entrega_concluida":
      return enviarEmailOperacional(destinatario, "entrega", dados);

    case "comprovante_disponivel":
      return enviarEmailComprovanteEntrega(destinatario, dados);

    case "boleto_disponivel":
      return enviarEmailFinanceiro(destinatario, "boleto", dados);

    case "xml_recebido":
      return { success: true };

    case "followup_comercial":
      return enviarEmailComercial(destinatario, "followup", dados);

    case "pesquisa_satisfacao":
      return enviarEmailPesquisaSatisfacao(destinatario, dados);

    case "pagamento_prestador":
      return enviarEmailFinanceiro(destinatario, "pagamento_prestador", dados);

    default:
      return { success: false, reason: "Evento desconhecido" };
  }
};

export const processarEventoEmail = async (
  params: AutomacaoEmailParams
): Promise<{ success: boolean; reason?: string }> => {
  const { evento, destinatario, dados } = params;

  if (!destinatario) {
    console.warn("[EmailAutomation] Destinatário vazio. Pulando.");
    return { success: false, reason: "Destinatário vazio" };
  }

  const emailEvent: EmailEvent = {
    setor: getSetorFromEvento(evento),
    canal: "email",
    provedor: "zoho",
    evento,
    destinatario,
    assunto: getAssuntoFromEvento(evento, dados),
    dados,
    origem: "tms_conexao_express",
  };

  await sendToN8N(emailEvent);

  return mapEventoToEmailFunction(evento, destinatario, dados);
};

const getSetorFromEvento = (
  evento: EventoEmail
): "comercial" | "operacional" | "financeiro" | "fiscal" | "cliente" => {
  const setorMap: Record<EventoEmail, string> = {
    cliente_criado: "cliente",
    os_criada: "operacional",
    os_finalizada: "operacional",
    orcamento_enviado: "comercial",
    orcamento_aprovado: "comercial",
    entrega_concluida: "operacional",
    comprovante_disponivel: "cliente",
    boleto_disponivel: "financeiro",
    xml_recebido: "fiscal",
    followup_comercial: "comercial",
    pesquisa_satisfacao: "cliente",
    pagamento_prestador: "financeiro",
  };

  return (setorMap[evento] || "cliente") as any;
};

const getAssuntoFromEvento = (
  evento: EventoEmail,
  dados: Record<string, unknown>
): string => {
  const assuntos: Record<EventoEmail, string> = {
    cliente_criado: "Bem-vindo ao TMS Conexão Express",
    os_criada: `OS ${dados.numero_os || ""} criada`,
    os_finalizada: `OS ${dados.numero_os || ""} finalizada`,
    orcamento_enviado: `Orçamento ${dados.numero || ""}`,
    orcamento_aprovado: "Orçamento aprovado",
    entrega_concluida: "Entrega concluída",
    comprovante_disponivel: "Comprovante disponível",
    boleto_disponivel: "Boleto disponível",
    xml_recebido: "XML fiscal recebido",
    followup_comercial: "Follow-up comercial",
    pesquisa_satisfacao: "Pesquisa de satisfação",
    pagamento_prestador: "Pagamento processado",
  };

  return assuntos[evento] || "Mensagem TMS";
};

export const agendarEmail = (
  params: AutomacaoEmailParams,
  delayMs: number
): Promise<{ success: boolean; reason?: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      processarEventoEmail(params).then(resolve);
    }, delayMs);
  });
};

export const processarLoteEmails = async (
  eventos: AutomacaoEmailParams[]
): Promise<{ total: number; sucessos: number; falhas: number }> => {
  let sucessos = 0;
  let falhas = 0;

  for (const evento of eventos) {
    const result = await processarEventoEmail(evento);
    if (result.success) {
      sucessos++;
    } else {
      falhas++;
    }
  }

  return { total: eventos.length, sucessos, falhas };
};

export const templateEmailHTML = (
  templateName: string,
  data: Record<string, unknown>
): string => {
  return generateHTMLTemplate(templateName, data);
};