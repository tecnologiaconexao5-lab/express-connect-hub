import { supabase } from "@/lib/supabase";

export interface VerificacaoInadimplencia {
  inadimplente: boolean;
  totalEmAberto: number;
  diasEmAtraso: number;
  quantidadeTitulos: number;
  mensagem?: string;
}

const STATUS_INADIMPLENTES = ["aberto", "vencido", "atrasado"];

export async function verificarInadimplenciaCliente(
  clienteId: string,
  limiteDiasAtraso: number = 30,
  limiteValorAberto: number = 100
): Promise<VerificacaoInadimplencia> {
  const resultado: VerificacaoInadimplencia = {
    inadimplente: false,
    totalEmAberto: 0,
    diasEmAtraso: 0,
    quantidadeTitulos: 0,
  };

  if (!clienteId) return resultado;

  try {
    const hoje = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("financeiro_receber")
      .select("valor, data_vencimento, status")
      .eq("cliente_id", clienteId)
      .in("status", STATUS_INADIMPLENTES);

    if (error) {
      console.error("[InadimplenciaService] Erro ao consultar:", error);
      return resultado;
    }

    if (!data || data.length === 0) return resultado;

    let totalEmAberto = 0;
    let maiorDiasAtraso = 0;
    let quantidadeTitulos = 0;

    for (const titulo of data) {
      const venc = titulo.data_vencimento;
      if (!venc) continue;

      const diasAtraso = Math.floor(
        (new Date(hoje).getTime() - new Date(venc).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diasAtraso > 0 && titulo.valor > 0) {
        totalEmAberto += titulo.valor;
        quantidadeTitulos++;
        if (diasAtraso > maiorDiasAtraso) maiorDiasAtraso = diasAtraso;
      }
    }

    resultado.totalEmAberto = Math.round(totalEmAberto * 100) / 100;
    resultado.diasEmAtraso = maiorDiasAtraso;
    resultado.quantidadeTitulos = quantidadeTitulos;

    const isInadimplente =
      maiorDiasAtraso >= limiteDiasAtraso && totalEmAberto >= limiteValorAberto;

    resultado.inadimplente = isInadimplente;

    if (isInadimplente) {
      resultado.mensagem = `Cliente possui ${quantidadeTitulos} título(s) em aberto totalizando R$ ${totalEmAberto.toFixed(2)} com até ${maiorDiasAtraso} dia(s) de atraso.`;
    }

    return resultado;
  } catch (e: any) {
    console.error("[InadimplenciaService] Erro geral:", e);
    return resultado;
  }
}

export async function verificarInadimplenciaEName(
  clienteNome: string,
  limiteDiasAtraso: number = 30,
  limiteValorAberto: number = 100
): Promise<VerificacaoInadimplencia> {
  const resultado: VerificacaoInadimplencia = {
    inadimplente: false,
    totalEmAberto: 0,
    diasEmAtraso: 0,
    quantidadeTitulos: 0,
  };

  if (!clienteNome) return resultado;

  try {
    const { data: clientes } = await supabase
      .from("clientes")
      .select("id")
      .ilike("nome_fantasia", `%${clienteNome}%`)
      .limit(1);

    if (!clientes || clientes.length === 0) return resultado;

    return verificarInadimplenciaCliente(clientes[0].id, limiteDiasAtraso, limiteValorAberto);
  } catch (e: any) {
    console.error("[InadimplenciaService] Erro ao buscar cliente por nome:", e);
    return resultado;
  }
}
