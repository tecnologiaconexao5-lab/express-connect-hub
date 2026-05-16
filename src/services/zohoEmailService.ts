// ============================================================
// SERVIÇO: Zoho Email via Webhook n8n
// Envia follow-ups comerciais de forma segura e com fallback
// ============================================================

import { supabase } from "@/lib/supabase";

export interface FollowUpPayload {
  leadId: string;
  leadEmpresa: string;
  to: string;
  subject: string;
  message: string;
  tipo: "primeiro_contato" | "proposta_enviada" | "lembrete_d1" | "lembrete_d3" | "lembrete_d7" | "reativacao";
  canal: "email" | "whatsapp";
}

export interface FollowUpResult {
  success: boolean;
  erro?: string;
  followupId?: string;
  pendente?: boolean;
}

// ─── Verifica se o webhook está configurado ──────────────────
const getWebhookUrl = (): string | null => {
  const url = import.meta.env.VITE_N8N_WEBHOOK_ZOHO_EMAIL;
  return url && url.trim() ? url.trim() : null;
};

// ─── Registrar follow-up na tabela crm_followups ─────────────
export const registrarFollowUp = async (
  payload: FollowUpPayload,
  status: "enviado" | "pendente" | "erro",
  erro?: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("crm_followups")
      .insert([{
        lead_id: payload.leadId,
        canal: payload.canal,
        tipo: payload.tipo,
        assunto: payload.subject,
        mensagem: payload.message,
        status,
        agendado_para: new Date().toISOString(),
        enviado_em: status === "enviado" ? new Date().toISOString() : null,
        erro: erro || null,
        metadata: { to: payload.to, empresa: payload.leadEmpresa },
        created_at: new Date().toISOString(),
      }])
      .select("id")
      .single();

    if (error) {
      console.error("[ZohoEmail] Erro ao registrar followup:", error.message);
      return null;
    }
    return data?.id || null;
  } catch (e: any) {
    console.error("[ZohoEmail] Exceção ao registrar:", e.message);
    return null;
  }
};

// ─── Registrar no histórico do lead ──────────────────────────
export const registrarHistoricoCRM = async (
  leadId: string,
  tipo: string,
  titulo: string,
  descricao: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    await supabase.from("crm_historico").insert([{
      lead_id: leadId,
      tipo,
      titulo,
      descricao,
      metadata,
      created_at: new Date().toISOString(),
    }]);
  } catch (e: any) {
    console.error("[CRM Histórico] Erro:", e.message);
  }
};

// ─── Enviar follow-up (via webhook n8n → Zoho) ───────────────
export const enviarFollowUp = async (
  payload: FollowUpPayload
): Promise<FollowUpResult> => {
  const webhookUrl = getWebhookUrl();

  // Sem webhook configurado → salva como pendente com aviso amigável
  if (!webhookUrl) {
    console.warn("[ZohoEmail] VITE_N8N_WEBHOOK_ZOHO_EMAIL não configurado. Salvando como pendente.");

    const followupId = await registrarFollowUp(payload, "pendente", "Webhook não configurado");
    await registrarHistoricoCRM(
      payload.leadId,
      "followup_pendente",
      `Follow-up agendado (${payload.tipo})`,
      `${payload.subject} — Pendente: webhook não configurado`,
      { canal: payload.canal, to: payload.to }
    );

    return {
      success: false,
      pendente: true,
      followupId: followupId || undefined,
      erro: "Webhook de email não configurado. Follow-up salvo como pendente.",
    };
  }

  // Enviar via webhook n8n
  try {
    const webhookPayload = {
      setor: "comercial",
      evento: "followup_email",
      leadId: payload.leadId,
      empresa: payload.leadEmpresa,
      to: payload.to,
      subject: payload.subject,
      message: payload.message,
      tipo: payload.tipo,
      canal: payload.canal,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      const erroTexto = `HTTP ${response.status}: ${response.statusText}`;
      const followupId = await registrarFollowUp(payload, "erro", erroTexto);
      await registrarHistoricoCRM(
        payload.leadId,
        "followup_erro",
        `Erro ao enviar follow-up (${payload.tipo})`,
        erroTexto,
        { canal: payload.canal }
      );
      return { success: false, erro: erroTexto, followupId: followupId || undefined };
    }

    const followupId = await registrarFollowUp(payload, "enviado");
    await registrarHistoricoCRM(
      payload.leadId,
      "followup_enviado",
      `Follow-up enviado via ${payload.canal}`,
      `Assunto: ${payload.subject}`,
      { canal: payload.canal, to: payload.to, tipo: payload.tipo }
    );

    console.log("[ZohoEmail] Follow-up enviado com sucesso:", followupId);
    return { success: true, followupId: followupId || undefined };

  } catch (e: any) {
    const erroTexto = e.name === "TimeoutError" ? "Timeout: webhook demorou mais de 10s" : (e.message || "Erro desconhecido");
    const followupId = await registrarFollowUp(payload, "erro", erroTexto);
    await registrarHistoricoCRM(
      payload.leadId,
      "followup_erro",
      `Erro ao enviar follow-up`,
      erroTexto,
      { canal: payload.canal }
    );
    console.error("[ZohoEmail] Exceção:", erroTexto);
    return { success: false, erro: erroTexto, followupId: followupId || undefined };
  }
};

// ─── Templates de follow-up ───────────────────────────────────
export const FOLLOWUP_TEMPLATES: Record<
  string,
  { titulo: string; assunto: string; mensagem: string; tipo: FollowUpPayload["tipo"] }
> = {
  primeiro_contato: {
    titulo: "Primeiro Contato",
    assunto: "Conexão Express — Otimização Logística para {{empresa}}",
    mensagem: `Olá {{nome}},\n\nMeu nome é Diego, da Conexão Express Transportes.\n\nVi que a {{empresa}} atua no segmento logístico e acredito que podemos ajudar a reduzir custos e aumentar a eficiência das entregas.\n\nPodemos conversar 15 minutos esta semana?\n\nAtenciosamente,\nEquipe Comercial — Conexão Express`,
    tipo: "primeiro_contato",
  },
  apos_proposta: {
    titulo: "Após Proposta Enviada",
    assunto: "Re: Proposta Conexão Express — {{empresa}}",
    mensagem: `Olá {{nome}},\n\nPassando para confirmar que recebeu nossa proposta e verificar se surgiu alguma dúvida.\n\nEstamos à disposição para ajustes ou uma apresentação detalhada.\n\nAtenciosamente,\nEquipe Comercial — Conexão Express`,
    tipo: "proposta_enviada",
  },
  lembrete_educado: {
    titulo: "Lembrete Educado (D+3)",
    assunto: "Conexão Express — Retomando contato com {{empresa}}",
    mensagem: `Olá {{nome}},\n\nSei que a agenda está corrida, mas queria retomar nossa conversa sobre a otimização logística da {{empresa}}.\n\nTemos condições especiais válidas por mais alguns dias.\n\nQual seria o melhor horário para conversarmos?\n\nAtenciosamente,\nEquipe Comercial — Conexão Express`,
    tipo: "lembrete_d3",
  },
  reativacao: {
    titulo: "Reativação de Lead",
    assunto: "Conexão Express — Novidades para {{empresa}}",
    mensagem: `Olá {{nome}},\n\nFaz um tempo que não nos falamos. A Conexão Express lançou novas soluções que podem ser exatamente o que a {{empresa}} precisa.\n\nPosso agendar uma apresentação rápida de 20 minutos?\n\nAtenciosamente,\nEquipe Comercial — Conexão Express`,
    tipo: "reativacao",
  },
};
