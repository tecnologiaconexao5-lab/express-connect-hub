import { supabase } from "@/lib/supabase";

export interface ContatoProposta {
  clienteId: string | null;
  telefone: string | null;
  origem: "lead" | "cliente" | "nenhum";
}

function normalizarTelefone(valor?: string | null): string | null {
  const digitos = String(valor || "").replace(/\D/g, "");
  if (digitos.length < 10) return null;
  if (digitos.startsWith("55") && digitos.length >= 12) return digitos;
  return `55${digitos}`;
}

async function buscarLeadPorId(id: string) {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("id, telefone, whatsapp, cliente_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data as {
    id: string;
    telefone: string | null;
    whatsapp: string | null;
    cliente_id: string | null;
  } | null;
}

async function buscarLeadPorProposta(propostaId: string) {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("id, telefone, whatsapp, cliente_id")
    .ilike("proposta_url", `%proposta=${propostaId}%`)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as {
    id: string;
    telefone: string | null;
    whatsapp: string | null;
    cliente_id: string | null;
  } | null;
}

async function buscarLeadPorNome(nome: string) {
  const campos = "id, telefone, whatsapp, cliente_id";
  const porNome = await supabase
    .from("crm_leads")
    .select(campos)
    .ilike("nome", `%${nome}%`)
    .limit(1)
    .maybeSingle();
  if (porNome.data) return porNome.data as {
    id: string;
    telefone: string | null;
    whatsapp: string | null;
    cliente_id: string | null;
  };
  if (porNome.error) return null;

  const porEmpresa = await supabase
    .from("crm_leads")
    .select(campos)
    .ilike("empresa", `%${nome}%`)
    .limit(1)
    .maybeSingle();
  if (porEmpresa.error) return null;
  return (porEmpresa.data as {
    id: string;
    telefone: string | null;
    whatsapp: string | null;
    cliente_id: string | null;
  } | null);
}

async function buscarClientePorId(id: string) {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, telefone, whatsapp")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data as { id: string; telefone: string | null; whatsapp: string | null } | null;
}

async function buscarClientePorNome(nome: string) {
  const porFantasia = await supabase
    .from("clientes")
    .select("id, telefone, whatsapp")
    .ilike("nome_fantasia", `%${nome}%`)
    .limit(1)
    .maybeSingle();
  if (porFantasia.data) return porFantasia.data as {
    id: string;
    telefone: string | null;
    whatsapp: string | null;
  };
  if (porFantasia.error) return null;

  const porRazao = await supabase
    .from("clientes")
    .select("id, telefone, whatsapp")
    .ilike("razao_social", `%${nome}%`)
    .limit(1)
    .maybeSingle();
  if (porRazao.error) return null;
  return (porRazao.data as {
    id: string;
    telefone: string | null;
    whatsapp: string | null;
  } | null);
}

/**
 * Resolve telefone/WhatsApp e cliente_id de uma proposta.
 * Ordem: lead por id -> lead pela URL da proposta -> cliente por id ->
 * lead por nome/empresa -> cliente por nome fantasia/razão social.
 */
export async function resolverContatoProposta(input: {
  propostaId?: string | null;
  leadId?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
}): Promise<ContatoProposta> {
  try {
    if (input.leadId) {
      const lead = await buscarLeadPorId(input.leadId);
      if (lead) {
        return {
          clienteId: lead.cliente_id || input.clienteId || null,
          telefone: normalizarTelefone(lead.whatsapp || lead.telefone),
          origem: "lead",
        };
      }
    }

    if (input.propostaId) {
      const lead = await buscarLeadPorProposta(input.propostaId);
      if (lead) {
        return {
          clienteId: lead.cliente_id || input.clienteId || null,
          telefone: normalizarTelefone(lead.whatsapp || lead.telefone),
          origem: "lead",
        };
      }
    }

    if (input.clienteId) {
      const cliente = await buscarClientePorId(input.clienteId);
      if (cliente) {
        return {
          clienteId: cliente.id,
          telefone: normalizarTelefone(cliente.whatsapp || cliente.telefone),
          origem: "cliente",
        };
      }
    }

    const nome = input.clienteNome?.trim();
    if (nome) {
      const lead = await buscarLeadPorNome(nome);
      if (lead) {
        return {
          clienteId: lead.cliente_id || input.clienteId || null,
          telefone: normalizarTelefone(lead.whatsapp || lead.telefone),
          origem: "lead",
        };
      }

      const cliente = await buscarClientePorNome(nome);
      if (cliente) {
        return {
          clienteId: cliente.id,
          telefone: normalizarTelefone(cliente.whatsapp || cliente.telefone),
          origem: "cliente",
        };
      }
    }
  } catch (error) {
    console.warn("[Propostas] Não foi possível resolver o contato no CRM:", error);
  }

  return {
    clienteId: input.clienteId || null,
    telefone: null,
    origem: "nenhum",
  };
}
