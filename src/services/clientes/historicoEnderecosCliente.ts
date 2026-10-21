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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Colunas garantidas da tabela `enderecos_clientes` no banco de produção.
 * Os campos operacionais extras (nome_local, referencia, latitude...) são
 * opcionais e podem não existir em todos os ambientes — por isso a leitura usa
 * `select("*")` e o insert tenta os extras com fallback para o conjunto base.
 */
const CAMPOS_BASE = [
  "tipo_endereco",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
] as const;

export interface EnderecoFavoritoInput {
  tipoEndereco?: string;
  nomeLocal?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  referencia?: string;
  instrucoes?: string;
  contatoLocal?: string;
  telefoneLocal?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const cacheEnderecosCliente = new Map<string, Promise<EnderecoHistoricoCliente[]>>();

const textoLimpo = (valor: unknown): string | null => {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo ? limpo : null;
};

const consultarEnderecosCadastro = async (clienteId: string) => {
  // REGRA: sempre filtrado por cliente_id — cada cliente vê apenas os
  // próprios locais (cadastro + favoritos).
  const { data, error } = await supabase
    .from("enderecos_clientes")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data) {
    if (error) {
      console.warn("[historicoEnderecos] Falha ao carregar endereços do cliente:", error.message);
    }
    return [] as Record<string, unknown>[];
  }

  return data as unknown as Record<string, unknown>[];
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
  if (!clienteId || !UUID_REGEX.test(clienteId)) return Promise.resolve([]);
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

const montarPayloadFavorito = (
  clienteId: string,
  endereco: EnderecoFavoritoInput,
  incluirExtras: boolean,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = { cliente_id: clienteId };
  CAMPOS_BASE.forEach((campo) => {
    if (campo === "tipo_endereco") {
      payload[campo] = textoLimpo(endereco.tipoEndereco) || "Entrega";
      return;
    }
    if (campo === "uf") {
      payload[campo] = textoLimpo(endereco.uf)?.toUpperCase() || null;
      return;
    }
    payload[campo] = textoLimpo((endereco as Record<string, unknown>)[campo]) || null;
  });
  if (!incluirExtras) return payload;

  payload.nome_local = textoLimpo(endereco.nomeLocal);
  payload.referencia = textoLimpo(endereco.referencia);
  payload.contato_local = textoLimpo(endereco.contatoLocal);
  payload.telefone_local = textoLimpo(endereco.telefoneLocal);
  payload.instrucoes = textoLimpo(endereco.instrucoes);
  payload.restricoes = textoLimpo((endereco as Record<string, unknown>).restricoes);
  payload.latitude = Number.isFinite(endereco.latitude) ? endereco.latitude : null;
  payload.longitude = Number.isFinite(endereco.longitude) ? endereco.longitude : null;
  payload.portaria = textoLimpo((endereco as Record<string, unknown>).portaria);
  payload.doca = textoLimpo((endereco as Record<string, unknown>).doca);
  payload.procedimento_entrada = textoLimpo(
    (endereco as Record<string, unknown>).procedimentoEntrada,
  );
  payload.procedimento_saida = textoLimpo(
    (endereco as Record<string, unknown>).procedimentoSaida,
  );
  return payload;
};

/**
 * Salva (ou atualiza) um endereço como favorito do cliente em
 * `enderecos_clientes`. O vínculo é sempre por `cliente_id`, garantindo que o
 * autocomplete de paradas traga apenas os locais daquele cliente.
 */
export const salvarEnderecoFavoritoCliente = async (
  clienteId: string,
  endereco: EnderecoFavoritoInput,
): Promise<{ ok: boolean; atualizado?: boolean; erro?: string }> => {
  if (!clienteId || !UUID_REGEX.test(clienteId)) {
    return { ok: false, erro: "Cliente inválido para salvar o endereço favorito" };
  }
  const logradouro = textoLimpo(endereco.logradouro);
  if (!logradouro) {
    return { ok: false, erro: "Endereço sem logradouro não pode ser salvo como favorito" };
  }

  const numero = textoLimpo(endereco.numero) || "";

  // Deduplica por cliente + logradouro + número (evita favoritos repetidos).
  const { data: candidatos } = await supabase
    .from("enderecos_clientes")
    .select("id, numero")
    .eq("cliente_id", clienteId)
    .eq("logradouro", logradouro)
    .limit(10);

  const normalizarNumero = (valor: unknown): string => {
    if (valor === null || valor === undefined) return "";
    return String(valor).trim();
  };

  const existente = ((candidatos || []) as Record<string, unknown>[]).find(
    (linha) => normalizarNumero(linha.numero) === numero,
  );

  const idExistente =
    existente && typeof existente.id === "string" ? String(existente.id) : null;

  const salvar = async (incluirExtras: boolean) => {
    if (idExistente) {
      return supabase
        .from("enderecos_clientes")
        .update(montarPayloadFavorito(clienteId, endereco, incluirExtras))
        .eq("id", idExistente)
        .eq("cliente_id", clienteId);
    }
    return supabase
      .from("enderecos_clientes")
      .insert([montarPayloadFavorito(clienteId, endereco, incluirExtras)]);
  };

  let resultado = await salvar(true);
  // Ambientes sem as colunas operacionais extras: persiste o conjunto base.
  if (resultado.error) {
    resultado = await salvar(false);
  }

  if (resultado.error) {
    return { ok: false, erro: resultado.error.message };
  }

  limparCacheHistoricoEnderecos(clienteId);
  return { ok: true, atualizado: Boolean(idExistente) };
};
