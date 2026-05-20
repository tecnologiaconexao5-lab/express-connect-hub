import { supabase } from "@/lib/supabase";

export interface ConfiguracaoSistemaRegistro {
  id: string;
  chave: string;
  valor: any;
  updated_at: string;
}

export type ConfigSource = "supabase" | "local";

const LOCAL_STORAGE_KEY = "configuracoes_sistema_offline";

function lerConfiguracoesLocalStorage(): Record<string, any> {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn("Erro ao ler configurações do localStorage:", error);
    return {};
  }
}

function salvarConfiguracoesLocalStorage(values: Record<string, any>) {
  try {
    const current = lerConfiguracoesLocalStorage();
    const merged = { ...current, ...values };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn("Erro ao salvar configurações no localStorage:", error);
  }
}

function filtrarChaves(values: Record<string, any>, chaves: string[]) {
  return chaves.reduce<Record<string, any>>((acc, chave) => {
    if (values && Object.prototype.hasOwnProperty.call(values, chave)) {
      acc[chave] = values[chave];
    }
    return acc;
  }, {});
}

export async function carregarConfiguracoesSistemaComFonte(chaves: string[]) {
  try {
    const { data, error } = await supabase
      .from<ConfiguracaoSistemaRegistro>("configuracoes_sistema")
      .select("chave, valor")
      .in("chave", chaves);

    if (!error && data) {
      const resultado = data.reduce<Record<string, any>>((acc, item) => {
        acc[item.chave] = item.valor;
        return acc;
      }, {} as Record<string, any>);

      salvarConfiguracoesLocalStorage(resultado);
      return { source: "supabase" as const, data: resultado };
    }
  } catch (error) {
    console.warn("Supabase indisponível ao carregar configurações, usando localStorage:", error);
  }

  return { source: "local" as const, data: filtrarChaves(lerConfiguracoesLocalStorage(), chaves) };
}

export async function salvarConfiguracoesSistemaComFonte(values: Record<string, any>) {
  const payload = Object.entries(values).map(([chave, valor]) => ({
    chave,
    valor,
    updated_at: new Date().toISOString(),
  }));

  try {
    const { error } = await supabase
      .from("configuracoes_sistema")
      .upsert(payload, { onConflict: "chave" });

    if (!error) {
      salvarConfiguracoesLocalStorage(values);
      return { success: true, source: "supabase" as const };
    }
    console.warn("Erro ao salvar configurações no Supabase, usando localStorage:", error.message);
  } catch (error) {
    console.warn("Supabase indisponível ao salvar configurações, usando localStorage:", error);
  }

  salvarConfiguracoesLocalStorage(values);
  return { success: true, source: "local" as const };
}

export async function carregarConfiguracoesSistema(chaves: string[]) {
  const result = await carregarConfiguracoesSistemaComFonte(chaves);
  return result.data;
}

export async function salvarConfiguracoesSistema(values: Record<string, any>) {
  const result = await salvarConfiguracoesSistemaComFonte(values);
  return result.success;
}

export async function carregarConfiguracaoSistema(chave: string) {
  const data = await carregarConfiguracoesSistema([chave]);
  return data?.[chave] ?? null;
}

export async function salvarConfiguracaoSistema(chave: string, valor: any) {
  return salvarConfiguracoesSistema({ [chave]: valor });
}
