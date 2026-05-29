// ============================================================
// PDF Generator — Conexão Express
//
// Ponto de entrada unificado para geração de PDFs profissionais.
// Internamente delega para o novo sistema de renderização corporativa.
//
// EXPORTAÇÕES (mantidas para compatibilidade):
//   generatePDFCliente(data)        — PDF da OS para o cliente
//   generatePDFPrestador(data)      — PDF da OS para o prestador
//   generateProfessionalPDF(data)   — PDF genérico (delega para cliente)
//   gerarMensagemWhatsAppOS(data)   — Mensagem WhatsApp formatada
//   copiarWhatsApp()                — Utilitário de cópia
// ============================================================

import { generateClientReport } from "./pdf/clientReport";
import { generatePrestadorReport } from "./pdf/prestadorReport";

// ===================== PDF CLIENTE (NOVO — CORPORATIVO) =====================
export const generatePDFCliente = async (data: any) => {
  await generateClientReport(data);
};

// ===================== PDF PRESTADOR (NOVO — CORPORATIVO) =====================
export const generatePDFPrestador = async (data: any) => {
  await generatePrestadorReport(data);
};

// ===================== PDF GENÉRICO (compatibilidade) =====================
export const generateProfessionalPDF = async (
  data: any,
  _type: "ORÇAMENTO" | "ORDEM DE SERVIÇO"
) => {
  await generateClientReport(data);
};

// ===================== WHATSAPP =====================
export const gerarMensagemWhatsAppOS = (data: any): string => {
  const enderecos = data.enderecos || [];
  const origem =
    enderecos.find((e: any) => e.tipo === "coleta") || enderecos[0];
  const destino =
    [...enderecos]
      .reverse()
      .find((e: any) => e.tipo === "entrega") ||
    enderecos[enderecos.length - 1];

  let msg = `🚚 *OS ${data.numero || "N/A"} - ${data.tipoOperacao || "Serviço"}*\n\n`;
  msg += `📦 *CARGA*: ${data.carga?.tipo || "Seca"} | ${data.carga?.volumes || 0} vol | ${data.carga?.peso || 0} kg\n`;
  msg += `🚛 *VEÍCULO*: ${data.veiculoTipo?.toUpperCase() || "Não definido"} | Placa: ${data.veiculoPlaca || "Pendente"}\n\n`;

  if (enderecos.length > 0) {
    msg += `📍 *ITINERÁRIO*:\n`;
    enderecos.forEach((end: any, idx: number) => {
      const icon =
        end.tipo === "coleta"
          ? "1️⃣ RETIRAR"
          : end.tipo === "entrega"
            ? `${idx + 1}️⃣ ENTREGAR`
            : `${idx + 1}️⃣ PARADA`;
      msg += `*${icon}*\n`;
      msg += `${end.nomeLocal ? end.nomeLocal + " - " : ""}${end.endereco || "Endereço não informado"}\n`;
      if (end.responsavel)
        msg += `👤 Contato: ${end.responsavel}${end.telefone ? " (" + end.telefone + ")" : ""}\n`;
      if (idx < enderecos.length - 1) msg += `\n`;
    });
    msg += `\n`;
  }

  msg += `🛣️ *DISTÂNCIA*: ${(data.distanciaRota?.distanciaKm?.toFixed(1) || data.distanciaKm || 0)} km\n`;
  msg += `⏱️ *TEMPO ESTIMADO*: ${data.distanciaRota?.duracaoTexto || data.tempoEstimado || "—"}\n\n`;

  msg += `💰 *VALOR QUE SERÁ PAGO*: R$ ${(data.custoPrestador || 0).toFixed(2)}\n`;
  if (data.pedagio > 0) msg += `💳 Pedágio: R$ ${data.pedagio.toFixed(2)}\n`;
  msg += `💳 Pagamento: ${data.statusFaturamento || "Pendente"}\n\n`;

  msg += `📝 *INSTRUÇÕES*:\n${data.instrucoesOperacionaisOS || "Sem instruções adicionais."}`;

  return msg;
};

export const copiarWhatsApp = () => {
  const msg =
    "Para usar, chame gerarMensagemWhatsAppOS(data) com os dados da OS";
  navigator.clipboard.writeText(msg);
};
