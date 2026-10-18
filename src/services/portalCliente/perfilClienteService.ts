import { supabase } from "@/lib/supabase";

export interface PerfilCliente {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  ie?: string;
  inscricao_municipal?: string;
  segmento?: string;
  porte?: string;
  status?: string;
  logo?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  complemento?: string;
  cidade?: string;
  uf?: string;
  contato_principal?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  responsavel_operacional?: string;
  responsavel_financeiro?: string;
  responsavel_comercial?: string;
  regime_tributario?: string;
  optante_simples?: boolean;
  aliquota_iss?: number;
  cnae?: string;
  cfop_padrao?: string;
  tipo_frete_preferencial?: string;
  veiculo_preferencial?: string;
  horario_entrega_preferencial?: string;
  exige_agendamento?: boolean;
  exige_sla?: boolean;
  notificar_email?: boolean;
  notificar_whatsapp?: boolean;
  notificar_mudanca_status?: boolean;
  notificar_comprovante?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UsuarioVinculado {
  id: string;
  auth_user_id: string;
  email?: string;
  nome?: string;
  ativo: boolean;
  created_at: string;
}

const CAMPOS_PERMITIDOS_UPDATE = [
  "contato_principal", "telefone", "whatsapp", "email", "site",
  "cep", "logradouro", "numero", "bairro", "complemento", "cidade", "uf",
  "responsavel_operacional", "responsavel_financeiro", "responsavel_comercial",
  "tipo_frete_preferencial", "veiculo_preferencial", "horario_entrega_preferencial",
  "optante_simples",
  "notificar_email", "notificar_whatsapp", "notificar_mudanca_status", "notificar_comprovante",
];

export async function buscarPerfilCompleto(clienteId: string): Promise<PerfilCliente | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", clienteId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar perfil:", error);
    return null;
  }

  return data as PerfilCliente | null;
}

export async function atualizarPerfil(
  clienteId: string,
  dados: Partial<PerfilCliente>
): Promise<{ sucesso: boolean; erro?: string }> {
  const camposFiltrados: Record<string, any> = {};
  for (const campo of CAMPOS_PERMITIDOS_UPDATE) {
    if (campo in dados) {
      camposFiltrados[campo] = (dados as any)[campo];
    }
  }

  if (Object.keys(camposFiltrados).length === 0) {
    return { sucesso: false, erro: "Nenhum campo permitido para alteração." };
  }

  const { error } = await supabase
    .from("clientes")
    .update(camposFiltrados)
    .eq("id", clienteId);

  if (error) {
    console.error("Erro ao atualizar perfil:", error);
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true };
}

export async function buscarUsuariosVinculados(clienteId: string): Promise<UsuarioVinculado[]> {
  try {
    const { data, error } = await supabase
      .rpc("listar_usuarios_vinculados", { p_cliente_id: clienteId });

    if (error || !data) {
      if (error?.code === "PGRST202") {
        console.warn("Funcao listar_usuarios_vinculados ainda nao criada no banco. Migration pendente.");
      } else {
        console.error("Erro ao buscar usuarios vinculados:", error);
      }
      return [];
    }

    return (data as any[]).map((v: any) => ({
      id: v.id,
      auth_user_id: v.auth_user_id,
      email: v.email || "—",
      ativo: v.ativo,
      created_at: v.created_at,
    }));
  } catch (err) {
    console.warn("Erro ao buscar usuarios vinculados (fallback):", err);
    return [];
  }
}
