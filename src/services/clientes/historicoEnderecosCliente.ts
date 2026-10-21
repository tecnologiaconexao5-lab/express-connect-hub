import { supabase } from "@/lib/supabase";
import {
  montarHistoricoEnderecosCliente,
  type EnderecoHistoricoCliente,
} from "@/lib/historicoEnderecosCliente";

export {
  montarHistoricoEnderecosCliente,
  normalizarTextoEndereco,
  type EnderecoHistoricoCliente,
  type OrigemEnderecoHistorico,
} from "@/lib/historicoEnderecosCliente";

const COLUNAS_ENDERECO_COMPLETAS =
  "id, nome_local, tipo_endereco, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia, instrucoes, contato_local, telefone_local, portaria, doca, procedimento_entrada, procedimento_saida, restricoes, latitude, longitude";
const COLUNAS_ENDERECO_BASE =
  "id, nome_local, tipo_endereco, cep, logradouro, numero, complemento, bairro, cidade, uf, latitude, longitude";

const cacheEnderecosCliente = new Map<string, Promise<EnderecoHistoricoCliente[]>>();

const consultarEnderecosCadastro = async (clienteId: string) => {
  const completo = await supabase
    .from("enderecos_clientes")
    .select(COLUNAS_ENDERECO_COMPLETAS)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!completo.error && completo.data) {
    return completo.data as unknown as Record<string, unknown>[];
  }

  const base = await supabase
    .from("enderecos_clientes")
    .select(COLUNAS_ENDERECO_BASE)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!base.error && base.data) {
    return base.data as unknown as Record<string, unknown>[];
  }

  return [] as Record<string, unknown>[];
};

const consultarEnderecosOS = async (clienteId: string) => {
  const { data, error } = await supabase
    .from("ordens_servico")
    .select("enderecos")
    .or(`cliente_id.eq.${clienteId},cliente.eq.${clienteId}`)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [] as unknown[];
  return data as unknown[];
};

export const limparCacheHistoricoEnderecos = (clienteId?: string) => {
  if (clienteId) cacheEnderecosCliente.delete(clienteId);
  else cacheEnderecosCliente.clear();
};

export const buscarHistoricoEnderecosCliente = (
  clienteId: string,
): Promise<EnderecoHistoricoCliente[]> => {
  if (!clienteId) return Promise.resolve([]);
  const existente = cacheEnderecosCliente.get(clienteId);
  if (existente) return existente;

  const promessa = (async () => {
    const [cadastro, os] = await Promise.all([
      consultarEnderecosCadastro(clienteId).catch(() => [] as Record<string, unknown>[]),
      consultarEnderecosOS(clienteId).catch(() => [] as unknown[]),
    ]);
    return montarHistoricoEnderecosCliente(cadastro, os);
  })().catch(() => [] as EnderecoHistoricoCliente[]);

  cacheEnderecosCliente.set(clienteId, promessa);
  return promessa;
};
