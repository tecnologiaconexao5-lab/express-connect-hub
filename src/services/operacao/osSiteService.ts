// ============================================================
// OS originadas pela Cotação Express — leitura compartilhada
// (header/notificações, Dashboard e card de solicitações).
// ============================================================
import { supabase } from "@/lib/supabase";
import {
  clienteNomeDaCotacaoOS,
  obterAgendamentoClienteOS,
} from "@/lib/cotacaoOS";

interface OSsiteRow {
  id?: string | null;
  numero?: string | null;
  cliente?: string | null;
  status?: string | null;
  prestador?: string | null;
  carga?: unknown;
  observacoes_gerais?: string | null;
  created_at?: string | null;
  clientes?: { nome_fantasia?: string | null; razao_social?: string | null } | null;
}

export interface OSSiteResumo {
  id: string;
  numero: string;
  clienteNome: string;
  status: string;
  prestador: string;
  agendada: boolean;
  agendamento: string;
  createdAt: string;
}

const SELECT_OS_SITE =
  "id, numero, cliente, status, prestador, carga, observacoes_gerais, created_at, clientes(nome_fantasia, razao_social)";

const mapear = (row: OSsiteRow): OSSiteResumo | null => {
  const id = row.id ? String(row.id) : "";
  if (!id) return null;
  const clienteJoin =
    row.clientes?.nome_fantasia || row.clientes?.razao_social || "";
  const clienteNome =
    clienteJoin ||
    clienteNomeDaCotacaoOS(row.observacoes_gerais) ||
    "Cliente Cotação";
  const agendamento = obterAgendamentoClienteOS({
    carga: row.carga,
    observacoes: row.observacoes_gerais,
  });

  return {
    id,
    numero: row.numero || "—",
    clienteNome,
    status: String(row.status || ""),
    prestador: String(row.prestador || ""),
    agendada: agendamento.agendada,
    agendamento: agendamento.dataHora,
    createdAt: row.created_at || "",
  };
};

/** OS recentes marcadas com `carga.origem_cotacao`. */
export async function listarOSSite(limite = 30, desde?: string): Promise<OSSiteResumo[]> {
  try {
    let query = supabase
      .from("ordens_servico")
      .select(SELECT_OS_SITE)
      .not("carga->>origem_cotacao", "is", null)
      .order("created_at", { ascending: false })
      .limit(limite);

    if (desde) query = query.gte("created_at", desde);

    const { data, error } = await query;
    if (error) throw error;
    return ((data as unknown as OSsiteRow[]) || [])
      .map(mapear)
      .filter((item): item is OSSiteResumo => Boolean(item));
  } catch {
    return [];
  }
}

export async function buscarOSSitePorId(id: string): Promise<OSSiteResumo | null> {
  if (!id) return null;
  try {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(SELECT_OS_SITE)
      .eq("id", id)
      .not("carga->>origem_cotacao", "is", null)
      .maybeSingle();
    if (error) throw error;
    return data ? mapear(data as unknown as OSsiteRow) : null;
  } catch {
    return null;
  }
}

const STATUS_ENCERRADOS = ["finalizada", "cancelada"];

/** Pendentes de despacho (sem prestador e não encerradas). */
export function osSitePendente(os: OSSiteResumo): boolean {
  return (
    !os.prestador.trim() &&
    !STATUS_ENCERRADOS.includes(os.status.toLowerCase())
  );
}
