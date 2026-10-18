import { supabase } from "@/lib/supabase";
import { criarOrdemServico } from "@/services/ordemServicoService";
import { sincronizarComEscala } from "@/services/ordemServicoService";
import { publicarOportunidade } from "@/services/operacao/redePrestadoresService";

export interface ContratoOperacao {
  id: string;
  tenant_id: string;
  numero: string;
  cliente_id: string;
  cliente_nome: string;
  data_inicio: string;
  data_fim: string | null;
  frequencia: 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'data_especifica';
  dias_semana: number[];
  dia_mes: number | null;
  datas_especificas: string[];
  horario_inicio: string;
  horario_fim: string;
  tabela_valores_id: string | null;
  tipo_reversa: string;
  prestador_id: string | null;
  usar_rede: boolean;
  ativo: boolean;
  suspenso_ate: string | null;
}

export interface ContratoOperacaoRota {
  id: string;
  contrato_id: string;
  nome: string;
  ordem: number;
  origem_cidade: string;
  origem_uf: string;
  destino_cidade: string;
  destino_uf: string;
  tipo_veiculo: string;
  tipo_operacao: string;
  distancia_km: number;
  tabela_valores_id: string | null;
  prestador_id: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
}

/**
 * Verifica se uma data deve gerar operação baseado na frequência do contrato.
 */
function deveGerar(data: Date, contrato: ContratoOperacao): boolean {
  if (!contrato.ativo) return false;
  if (contrato.suspenso_ate && new Date(contrato.suspenso_ate) > data) return false;
  if (contrato.data_fim && new Date(contrato.data_fim) < data) return false;

  const diaSemana = data.getDay();
  const diaMes = data.getDate();

  switch (contrato.frequencia) {
    case 'diaria':
      return contrato.dias_semana.length === 0 || contrato.dias_semana.includes(diaSemana);
    case 'semanal':
      return contrato.dias_semana.includes(diaSemana);
    case 'quinzenal':
      return diaMes === 1 || diaMes === 15 || diaMes === (contrato.dia_mes ?? 1);
    case 'mensal':
      return diaMes === (contrato.dia_mes ?? 1);
    case 'data_especifica': {
      const dataStr = data.toISOString().split('T')[0];
      return (contrato.datas_especificas || []).includes(dataStr);
    }
    default:
      return false;
  }
}

/**
 * Gera OS para um contrato em uma data específica.
 */
export async function gerarOSdoContrato(
  contrato: ContratoOperacao,
  rota: ContratoOperacaoRota,
  dataOperacao: Date
): Promise<{ sucesso: boolean; os_id?: string; erro?: string }> {
  try {
    const dataStr = dataOperacao.toISOString().split('T')[0];

    // Verificar duplicidade
    const { data: existente } = await supabase
      .from("contratos_operacao_execucao")
      .select("id, status, os_id")
      .eq("rota_id", rota.id)
      .eq("data_operacao", dataStr)
      .maybeSingle();

    if (existente) {
      if (existente.status === 'gerada' && existente.os_id) {
        return { sucesso: true, os_id: existente.os_id };
      }
      return { sucesso: false, erro: 'Já existe execução para esta data' };
    }

    // Criar OS
    const osInput = {
      cliente_id: contrato.cliente_id,
      cliente: contrato.cliente_nome,
      status: 'pendente' as const,
      tipo_operacao: rota.tipo_operacao,
      tipo_veiculo: rota.tipo_veiculo,
      data_programada: dataStr,
      origem: rota.origem_cidade,
      destino: rota.destino_cidade,
      enderecos: [
        { tipo: 'coleta', cidade: rota.origem_cidade, uf: rota.origem_uf, logradouro: rota.origem_logradouro || '', numero: rota.origem_numero || '', bairro: rota.origem_bairro || '' },
        { tipo: 'entrega', cidade: rota.destino_cidade, uf: rota.destino_uf, logradouro: rota.destino_logradouro || '', numero: rota.destino_numero || '', bairro: rota.destino_bairro || '' },
      ],
      distancia_km: rota.distancia_km,
      tipo_reversa: contrato.tipo_reversa !== 'sem_reversa' ? contrato.tipo_reversa : undefined,
      modalidade: 'contrato',
    };

    const osResult = await criarOrdemServico(osInput as any);
    if (!osResult.sucesso || !osResult.os_id) {
      // Registrar falha
      await supabase.from("contratos_operacao_execucao").insert({
        contrato_id: contrato.id,
        rota_id: rota.id,
        data_geracao: new Date().toISOString().split('T')[0],
        data_operacao: dataStr,
        status: 'falha',
        erro: osResult.erro || 'Erro ao criar OS',
      });
      return { sucesso: false, erro: osResult.erro };
    }

    // Registrar execução
    await supabase.from("contratos_operacao_execucao").insert({
      contrato_id: contrato.id,
      rota_id: rota.id,
      os_id: osResult.os_id,
      data_geracao: new Date().toISOString().split('T')[0],
      data_operacao: dataStr,
      status: 'gerada',
    });

    // Se contrato tem prestador fixo, criar alocação
    const prestadorId = rota.prestador_id || contrato.prestador_id;
    if (prestadorId) {
      try {
        const { data: osData } = await supabase
          .from("ordens_servico")
          .select("*")
          .eq("id", osResult.os_id)
          .single();
        if (osData) {
          await sincronizarComEscala({ ...osData, prestador_id: prestadorId });
        }
      } catch { /* não crítico */ }
    }

    // Se contrato usa Rede, publicar oportunidade
    if (contrato.usar_rede && !prestadorId) {
      try {
        await publicarOportunidade({
          os_id: osResult.os_id,
          valor_prestador: 0,
          veiculo_necessario: { tipo: rota.tipo_veiculo, termica: 'seco' },
          regiao: rota.origem_cidade,
        });
      } catch { /* não crítico */ }
    }

    return { sucesso: true, os_id: osResult.os_id };
  } catch (err: any) {
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Gera operações para um contrato em um período.
 */
export async function gerarOperacoesPeriodo(
  contratoId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<{ geradas: number; falhas: number; erros: string[] }> {
  const result = { geradas: 0, falhas: 0, erros: [] as string[] };

  // Buscar contrato
  const { data: contrato } = await supabase
    .from("contratos_operacao")
    .select("*")
    .eq("id", contratoId)
    .single() as unknown as { data: ContratoOperacao | null };

  if (!contrato) {
    result.erros.push("Contrato não encontrado");
    return result;
  }

  // Buscar rotas
  const { data: rotas } = await supabase
    .from("contratos_operacao_rotas")
    .select("*")
    .eq("contrato_id", contratoId)
    .eq("ativo", true)
    .order("ordem") as unknown as { data: ContratoOperacaoRota[] | null };

  if (!rotas || rotas.length === 0) {
    result.erros.push("Nenhuma rota ativa no contrato");
    return result;
  }

  // Iterar por cada dia do período
  const dataAtual = new Date(dataInicio);
  while (dataAtual <= dataFim) {
    if (deveGerar(dataAtual, contrato)) {
      // Para cada rota, gerar OS
      for (const rota of rotas) {
        const r = await gerarOSdoContrato(contrato, rota, new Date(dataAtual));
        if (r.sucesso) {
          result.geradas++;
        } else {
          result.falhas++;
          result.erros.push(`${dataAtual.toISOString().split('T')[0]} / ${rota.nome}: ${r.erro}`);
        }
      }
    }
    dataAtual.setDate(dataAtual.getDate() + 1);
  }

  return result;
}
