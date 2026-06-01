import { supabase } from "@/lib/supabase";

export interface MunicipioIbge {
  id: string;
  codigo: string;
  nome: string;
  uf: string;
}

export async function buscarCodigoIbge(cidade: string, uf: string): Promise<string | null> {
  if (!cidade?.trim() || !uf?.trim()) return null;

  const nome = cidade.trim();
  const sigla = uf.trim().toUpperCase();

  const { data } = await supabase
    .from("municipios_ibge")
    .select("codigo")
    .ilike("nome", nome)
    .eq("uf", sigla)
    .limit(1)
    .maybeSingle();

  return data?.codigo || null;
}

export async function buscarOuCriarCodigoIbge(cidade: string, uf: string): Promise<string | null> {
  const existente = await buscarCodigoIbge(cidade, uf);
  return existente;
}

export async function listarMunicipiosIbge(): Promise<MunicipioIbge[]> {
  const { data } = await supabase
    .from("municipios_ibge")
    .select("*")
    .order("nome")
    .limit(500);

  return data || [];
}
