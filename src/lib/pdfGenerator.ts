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
//   gerarMensagemWhatsAppMotoboy()  — TEMPLATE 1 (Resumo da Rota; privacidade,
//                                     ícone de veículo e links curtos do Maps)
//   gerarMensagemOrientacaoExecucao() — TEMPLATE 2 (Orientação de Execução)
//   gerarMensagemWhatsAppOS(data)   — alias do TEMPLATE 1 (Resumo da Rota)
//   gerarMensagemOSGrupo(data)      — alias do TEMPLATE 1 (divulgação)
//   gerarMensagemWhatsAppClienteRastreio(data) — link de rastreio do cliente
//   copiarWhatsApp()                — Utilitário de cópia
// ============================================================

import { generateClientReport } from "./pdf/clientReport";
import { generatePrestadorReport } from "./pdf/prestadorReport";
import {
  gerarMensagemOSGrupo,
  gerarMensagemOrientacaoExecucao,
  gerarMensagemWhatsAppClienteRastreio,
  gerarMensagemWhatsAppMotoboy,
} from "./osWhatsAppMessage";

export {
  gerarMensagemOSGrupo,
  gerarMensagemOrientacaoExecucao,
  gerarMensagemWhatsAppClienteRastreio,
  gerarMensagemWhatsAppMotoboy,
};

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
// Template 1 (RESUMO DA ROTA) do motoboy (privacidade de número, ícone
// dinâmico, links curtos do Maps) — compartilhado com o /os-mobile.
export const gerarMensagemWhatsAppOS = (data: any): string =>
  gerarMensagemWhatsAppMotoboy(data);

export const copiarWhatsApp = () => {
  const msg =
    "Para usar, chame gerarMensagemWhatsAppOS(data) com os dados da OS";
  navigator.clipboard.writeText(msg);
};
