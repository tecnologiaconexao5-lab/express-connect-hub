/**
 * CLIENTES-02 — Integridade referencial na exclusão de clientes.
 *
 * A tabela `clientes` possui FKs com DELETE SET NULL (OS, faturas, financeiro,
 * alocações, rotas, ocorrências) e CASCADE (contratos, portal_ocorrencias,
 * usuarios_cliente). Excluir um cliente com histórico apagaria/desvincularia
 * dados comerciais e financeiros reais.
 *
 * Este helper detecta vínculos ANTES de permitir a exclusão física.
 */

import { supabase } from "@/lib/supabase";

export interface ClienteReferenciaTabela {
  tabela: string;
  coluna: string;
  label: string;
}

export const CLIENTE_REFERENCIA_TABELAS: ClienteReferenciaTabela[] = [
  { tabela: "ordens_servico",      coluna: "cliente",     label: "Ordens de Serviço" },
  { tabela: "alocacoes_escala",    coluna: "cliente_id",  label: "Programação Operacional/Alocações" },
  { tabela: "faturas",             coluna: "cliente_id",  label: "Faturas" },
  { tabela: "financeiro_receber",  coluna: "cliente_id",  label: "Contas a Receber" },
  { tabela: "financeiro_pagar",    coluna: "cliente_id",  label: "Contas a Pagar" },
  { tabela: "clientes_contratos",  coluna: "cliente_id",  label: "Contratos" },
  { tabela: "portal_ocorrencias",  coluna: "cliente_id",  label: "Ocorrências do Portal" },
  { tabela: "usuarios_cliente",    coluna: "cliente_id",  label: "Usuários do Cliente" },
  { tabela: "fiscal_ctes",         coluna: "cliente_id",  label: "CT-e" },
  { tabela: "fiscal_mdfes",        coluna: "cliente_id",  label: "MDF-e" },
  { tabela: "fiscal_nfse",         coluna: "cliente_id",  label: "NFS-e" },
];

export interface ClienteReferencia {
  tabela: string;
  label: string;
  count: number;
}

/**
 * Retorna a lista de vínculos existentes (count > 0) para o cliente.
 * Tabelas sem acesso/permissão são ignoradas (não bloqueiam por erro de leitura).
 */
export async function verificarReferenciasCliente(clienteId: string): Promise<ClienteReferencia[]> {
  if (!clienteId) return [];
  const resultados = await Promise.all(
    CLIENTE_REFERENCIA_TABELAS.map(async ({ tabela, coluna, label }) => {
      try {
        const { count, error } = await supabase
          .from(tabela)
          .select("id", { count: "exact", head: true })
          .eq(coluna, clienteId);
        if (error) return null;
        return { tabela, label, count: count ?? 0 } as ClienteReferencia;
      } catch {
        return null;
      }
    })
  );
  return resultados.filter((r): r is ClienteReferencia => !!r && r.count > 0);
}
