// ============================================================
// FASE 8 — Comunicação Integrada e Reativação de Talentos
// WhatsApp, notificação no App e histórico em crm_interacoes_prestadores.
// ============================================================
import { supabase } from "@/lib/supabase";
import { crmService } from "@/modules/recrutamento/services/crmService";

export type CanalTalent = "whatsapp" | "app";

export const TEMPLATE_REATIVACAO =
  "Olá, {nome}! Aqui é a Conexão Express. Estamos atualizando nosso banco de talentos e queremos saber: você está disponível para novas operações? Se sim, responda esta mensagem com sua disponibilidade atual (dias e horários).";

export function montarTemplateReativacao(nome: string, regiao?: string | null): string {
  const saudacao = `Olá, ${nome || "parceiro"}!`;
  return (
    `${saudacao} Aqui é a Conexão Express. Estamos atualizando nosso banco de talentos e queremos saber: ` +
    `você está disponível para novas operações${regiao ? ` na região de ${regiao}` : ""}? ` +
    `Se sim, responda esta mensagem com sua disponibilidade atual (dias e horários).`
  );
}

export function linkWhatsAppTalent(telefone?: string | null, mensagem?: string): string {
  const numero = String(telefone || "").replace(/\D/g, "");
  const texto = encodeURIComponent(mensagem || "");
  return `https://wa.me/55${numero}${texto ? `?text=${texto}` : ""}`;
}

async function registrarCRM(input: {
  prestadorId: string;
  prestadorNome: string;
  canal: CanalTalent;
  titulo: string;
  descricao: string;
  usuario?: string;
}): Promise<void> {
  try {
    await crmService.criar({
      prestadorId: input.prestadorId,
      prestadorNome: input.prestadorNome,
      tipo: input.canal === "whatsapp" ? "whatsapp" : "observacao",
      titulo: input.titulo,
      descricao: input.descricao,
      data: new Date().toISOString(),
      usuario: input.usuario || "TMS",
      proximaAcao: "",
      dataProximoContato: "",
      status: "realizado",
      anexos: [],
    });
  } catch (error) {
    console.warn("[TalentComunicacao] Falha ao registrar CRM:", error);
  }
}

export async function enviarWhatsAppTalent(input: {
  prestadorId: string;
  nome: string;
  telefone?: string | null;
  mensagem: string;
  usuario?: string;
}): Promise<string> {
  const url = linkWhatsAppTalent(input.telefone, input.mensagem);
  await registrarCRM({
    prestadorId: input.prestadorId,
    prestadorNome: input.nome,
    canal: "whatsapp",
    titulo: "WhatsApp enviado",
    descricao: input.mensagem,
    usuario: input.usuario,
  });
  return url;
}

export async function notificarAppTalent(input: {
  prestadorId: string;
  nome: string;
  mensagem: string;
  osId?: string | null;
  usuario?: string;
}): Promise<void> {
  const { error } = await supabase.from("portal_notificacoes").insert([
    {
      prestador_id: input.prestadorId,
      os_id: input.osId || null,
      tipo: "mensagem_torre",
      titulo: "Mensagem da Conexão Express",
      mensagem: input.mensagem,
      canal: "app",
      lida: false,
      prioridade: "alta",
      referencia_id: input.osId || null,
      origem_id: input.osId || null,
      origem_tipo: input.osId ? "ordem_servico" : "prestador",
    },
  ]);
  if (error) throw error;

  await registrarCRM({
    prestadorId: input.prestadorId,
    prestadorNome: input.nome,
    canal: "app",
    titulo: "Notificação enviada no App",
    descricao: input.mensagem,
    usuario: input.usuario,
  });
}

export interface ResultadoReativacao {
  mensagem: string;
  whatsappUrl: string;
  novoStage: string;
}

export async function reativarCandidatoTalent(input: {
  prestadorId: string;
  nome: string;
  telefone?: string | null;
  regiao?: string | null;
  stageAtual?: string | null;
  usuario?: string;
}): Promise<ResultadoReativacao> {
  const stageAtual = String(input.stageAtual || "");
  const novoStage =
    stageAtual === "homologado_indisponivel"
      ? "homologado_disponivel"
      : "em_triagem";

  const { data: candidato } = await supabase
    .from("recrutamento_candidatos")
    .select("id")
    .eq("prestador_id", input.prestadorId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (candidato?.id) {
    const { error } = await supabase
      .from("recrutamento_candidatos")
      .update({
        stage: novoStage,
        updated_at: new Date().toISOString(),
        data_atualizacao: new Date().toISOString(),
      })
      .eq("id", candidato.id);

    if (error) {
      console.warn("[TalentComunicacao] Falha ao reativar candidato:", error);
    }
  }

  const mensagem = montarTemplateReativacao(input.nome, input.regiao);
  await registrarCRM({
    prestadorId: input.prestadorId,
    prestadorNome: input.nome,
    canal: "whatsapp",
    titulo: "Reativação de candidato",
    descricao: mensagem,
    usuario: input.usuario,
  });

  return {
    mensagem,
    whatsappUrl: linkWhatsAppTalent(input.telefone, mensagem),
    novoStage,
  };
}

export async function listarComunicacoesPrestador(prestadorId: string) {
  return crmService.listarPorPrestador(prestadorId);
}
