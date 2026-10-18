import { buscarTabelaValoresCliente, buscarTabelaPrestador, buscarAliquotaIss } from "./buscarTabelasService";
import type {
  PricingInput,
  PricingOutput,
  PricingAdicionaisCliente,
  PricingAdicionaisPrestador,
  PricingDescontosPrestador,
  PricingMargem,
  PricingRegraAplicada,
  PricingAlerta,
  PricingFontesDados,
  TabelaValorAplicada,
  TabelaPrestadorAplicada,
} from "./types";

const N = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

function calcularKmExcedente(kmRodados: number, franquia: number): number {
  return Math.max(0, kmRodados - franquia);
}

function calcularEspera(
  minutosTotais: number,
  adicionaisTabela: Record<string, any> | undefined
): { total: number; minutosFree: number; valorHora: number; horasCobradas: number } {
  if (!adicionaisTabela?.espera?.ativo) return { total: 0, minutosFree: 0, valorHora: 0, horasCobradas: 0 };

  const esperaConfig = adicionaisTabela.espera;
  const faixas = esperaConfig.faixas || [];
  const minutosFree = N(esperaConfig.minutosFree || 60);
  const valorHora = N(esperaConfig.valorHora || 0);

  if (faixas.length > 0) {
    const faixaOrdenada = [...faixas].sort((a: any, b: any) => N(b.inicio) - N(a.inicio));
    const faixaAtingida = faixaOrdenada.find((f: any) => minutosTotais >= N(f.inicio));
    if (faixaAtingida) {
      return { total: N(faixaAtingida.valor), minutosFree, valorHora, horasCobradas: 0 };
    }
  }

  const minutosExcedentes = Math.max(0, minutosTotais - minutosFree);
  const horasCobradas = Math.ceil(minutosExcedentes / 60);
  return { total: horasCobradas * valorHora, minutosFree, valorHora, horasCobradas };
}

/**
 * Fórmula unificada de margem — idêntica aos triggers M66/M80b.
 *
 * Fórmula oficial (M80, linhas 245-248):
 *   outros_custos = adicionais + ajudante - descontos
 *   margem_bruta = valor_cliente - valor_prestador - pedagio - outros_custos
 *   imposto = 4.5%, seguro = 1%
 *   margem_liquida = margem_bruta - imposto - seguro
 *
 * Chamada pelo engine TS, pelos componentse, e deve ser a ÚNICA autoridade de margem.
 */
export function calcularMargemUnificada(params: {
  valorCliente: number;
  valorPrestador: number;
  pedagio: number;
  adicionais: number;
  ajudante: number;
  descontos: number;
  reversaCliente?: number;
  reversaPrestador?: number;
  impostoPercentual?: number;
  seguroPercentual?: number;
}): {
  outros_custos: number;
  margem_bruta: number;
  margem_liquida: number;
  imposto_valor: number;
  seguro_valor: number;
  percentual_margem_bruta: number;
  percentual_margem_liquida: number;
} {
  const impostoPerc = params.impostoPercentual ?? 4.5;
  const seguroPerc = params.seguroPercentual ?? 1;
  const reversaCliente = params.reversaCliente ?? 0;
  const reversaPrestador = params.reversaPrestador ?? 0;
  const valorClienteTotal = params.valorCliente + reversaCliente;
  const valorPrestadorTotal = params.valorPrestador + reversaPrestador;
  const outros_custos = params.adicionais + params.ajudante - params.descontos;
  const margem_bruta = valorClienteTotal - valorPrestadorTotal - params.pedagio - outros_custos;
  const imposto_valor = Math.round(valorClienteTotal * impostoPerc / 100 * 100) / 100;
  const seguro_valor = Math.round(valorClienteTotal * seguroPerc / 100 * 100) / 100;
  const margem_liquida = margem_bruta - imposto_valor - seguro_valor;
  const percentual_margem_bruta = valorClienteTotal > 0
    ? Math.round(margem_bruta / valorClienteTotal * 10000) / 100
    : 0;
  const percentual_margem_liquida = valorClienteTotal > 0
    ? Math.round(margem_liquida / valorClienteTotal * 10000) / 100
    : 0;

  return {
    outros_custos,
    margem_bruta,
    margem_liquida,
    imposto_valor,
    seguro_valor,
    percentual_margem_bruta,
    percentual_margem_liquida,
  };
}

/**
 * Bridge síncrona para componentes que já têm a tabela em estado.
 * Usa calcularMargemUnificada() — mesma fórmula dos triggers.
 * Prestador calculado via % da tabela (fallback) OU via tabela_prestador se informada.
 */
export function calcularPrecoRapido(
  tabela: TabelaValorAplicada,
  distanciaKm: number,
  params?: {
    minutosEspera?: number;
    adicionais?: Record<string, any>;
    percentualPrestadorOverride?: number;
    pedagio?: number;
    ajudante?: number;
    desconto?: number;
    tabelaPrestador?: {
      valor_minimo?: number;
      km_incluso?: number;
      valor_km?: number;
      valor_saida?: number;
    };
  }
): {
  valorCliente: number;
  valorPrestador: number;
  kmExcedente: number;
  descricao: string;
  margem: ReturnType<typeof calcularMargemUnificada>;
} {
  const franquia = tabela.franquia_km || 0;
  const valorKmExc = tabela.valor_km_excedente || 0;
  const kmExc = Math.max(0, distanciaKm - franquia);
  const kmExcValor = kmExc * valorKmExc;
  const valorBase = tabela.valor_base || 0;
  const valorCliente = valorBase + kmExcValor;
  const pedagio = params?.pedagio ?? 0;
  const ajudanteValor = params?.ajudante ?? 0;
  const descontoValor = params?.desconto ?? 0;

  // Calcular valor do prestador: prioriza tabela_prestador se informada
  let valorPrestador: number;
  const tp = params?.tabelaPrestador;
  if (tp && (tp.valor_minimo || tp.valor_saida)) {
    const basePrest = (tp.valor_minimo ?? 0) + (tp.valor_saida ?? 0);
    const kmIncPrest = tp.km_incluso ?? 0;
    const kmExcPrest = Math.max(0, distanciaKm - kmIncPrest);
    const kmExcPrestValor = kmExcPrest * (tp.valor_km ?? 0);
    valorPrestador = basePrest + kmExcPrestValor;
  } else {
    const percPrest = params?.percentualPrestadorOverride ?? tabela.percentual_prestador ?? 80;
    valorPrestador = valorCliente * (percPrest / 100);
  }

  const margem = calcularMargemUnificada({
    valorCliente,
    valorPrestador,
    pedagio,
    adicionais: 0,
    ajudante: ajudanteValor,
    descontos: descontoValor,
  });

  return {
    valorCliente,
    valorPrestador,
    kmExcedente: kmExc,
    descricao: `Base R$ ${valorBase.toFixed(2)} + ${kmExc}km exced. R$ ${kmExcValor.toFixed(2)}`,
    margem,
  };
}

export async function calcularPreco(input: PricingInput): Promise<PricingOutput> {
  const memoria: string[] = [];
  const alertas: PricingAlerta[] = [];
  const regras_aplicadas: PricingRegraAplicada[] = [];
  const fontes_dados: PricingFontesDados = {
    tabelas_valores: false,
    tabela_prestador: false,
    prestadores_cadastro: false,
    veiculos: false,
    clientes_aliquota: false,
    fallback_hardcoded: false,
  };

  const timestamp = new Date().toISOString();
  memoria.push(`[${timestamp}] Iniciando cálculo de precificação`);
  memoria.push(`Cliente: ${input.cliente_id}, Prestador: ${input.prestador_id || "N/A"}`);
  memoria.push(`Veículo: ${input.tipo_veiculo}, Distância: ${input.distancia_km}km, Operação: ${input.tipo_operacao}`);

  // 1. Buscar tabela de valores do cliente
  const { tabela: tabCliente, alertas: alertasCliente, memoria: memCliente } = await buscarTabelaValoresCliente(input);
  memoria.push(...memCliente);
  alertas.push(...alertasCliente);
  if (tabCliente.fonte === 'tabelas_valores' || tabCliente.fonte === 'universal') {
    fontes_dados.tabelas_valores = true;
  }
  if (tabCliente.fonte === 'fallback_hardcoded') {
    fontes_dados.fallback_hardcoded = true;
  }

  // 2. Buscar tabela/custo do prestador
  const { tabela: tabPrest, alertas: alertasPrest, memoria: memPrest } = await buscarTabelaPrestador(input);
  memoria.push(...memPrest);
  alertas.push(...alertasPrest);
  if (tabPrest.fonte === 'tabela_prestador') fontes_dados.tabela_prestador = true;
  if (tabPrest.fonte === 'prestadores_cadastro') fontes_dados.prestadores_cadastro = true;
  if (tabPrest.fonte === 'veiculos') fontes_dados.veiculos = true;

  // 3. Buscar aliquota de ISS
  const aliquotaIss = await buscarAliquotaIss(input.cliente_id);
  fontes_dados.clientes_aliquota = aliquotaIss > 0;

  // 4. Calcular KM
  const kmRodados = Math.max(0, input.distancia_km);
  const franquiaKmCliente = tabCliente.franquia_km;
  const kmExcedenteCliente = calcularKmExcedente(kmRodados, franquiaKmCliente);
  const valorKmExcedenteCliente = tabCliente.valor_km_excedente;
  const totalKmExcedenteCliente = kmExcedenteCliente * valorKmExcedenteCliente;

  memoria.push(`6. KM: ${kmRodados}km rodados, franquia ${franquiaKmCliente}km, excedente ${kmExcedenteCliente}km`);

  // 5. Calcular valor base do cliente
  const valorBaseClienteOriginal = tabCliente.valor_base;
  let valorBaseCliente = valorBaseClienteOriginal;

  // Regra especial DVL (hora de saída)
  if (input.hora_saida !== undefined && input.hora_saida > 0) {
    let multiplicador = 1.0;
    if (input.hora_saida <= 11) multiplicador = 1.0;
    else if (input.hora_saida <= 14) multiplicador = 1.50;
    else if (input.hora_saida <= 16) multiplicador = 1.70;
    else multiplicador = 1.85;

    if (multiplicador > 1.0) {
      valorBaseCliente = valorBaseClienteOriginal * multiplicador;
      regras_aplicadas.push({
        tipo: 'regra_especial_dvl',
        descricao: `Regra especial DVL: hora_saída=${input.hora_saida}, multiplicador=${multiplicador}x`,
        impacto_cliente: valorBaseCliente - valorBaseClienteOriginal,
        impacto_prestador: 0,
      });
      memoria.push(`7. Regra especial DVL aplicada: hora=${input.hora_saida}, mult=${multiplicador}x`);
    }
  }

  // Overbooking (substitui valor base, não soma)
  let overbookingClienteValor = 0;
  let overbookingPrestadorValor = 0;
  const overbooking = input.overbooking;
  if (overbooking?.ativo && N(overbooking.valor_base) > 0) {
    if (overbooking.tipo === 'percentual' || !overbooking.tipo) {
      overbookingClienteValor = N(overbooking.valor_base) * N(overbooking.percentual_cliente ?? 0) / 100;
    } else {
      overbookingClienteValor = N(overbooking.valor_cliente ?? 0);
    }
    overbookingPrestadorValor = overbookingClienteValor * N(overbooking.percentual_prestador ?? 0) / 100;

    const valorBaseOriginal = valorBaseCliente;
    valorBaseCliente = overbookingClienteValor;

    regras_aplicadas.push({
      tipo: 'overbooking',
      descricao: `Overbooking: valor base substituído de ${valorBaseOriginal} para ${valorBaseCliente}`,
      impacto_cliente: overbookingClienteValor - valorBaseOriginal,
      impacto_prestador: overbookingPrestadorValor,
    });
    memoria.push(`8. Overbooking ativo. Valor base substituído: ${valorBaseOriginal} → ${valorBaseCliente}`);
  }

  // 6. Calcular adicionais do cliente
  const esperaCalc = calcularEspera(N(input.minutos_espera ?? 0), tabCliente.adicionais);
  const adicionaisManuais = input.adicionais_manuais || {};

  // MISSÃO 108-F: Calcular reversa
  const reversa = input.reversa;
  let reversaClienteValor = 0;
  let reversaPrestadorValor = 0;
  if (reversa?.ativo && reversa.tipo !== 'coleta_reversa') {
    // Reversa usa regras da tabela de valores ou input manual
    const tabRev = tabCliente.adicionais?.devolucao || tabCliente.adicionais?.reentrega || {};
    if (reversa.calculo_cliente === 'valor_fixo') {
      reversaClienteValor = N(reversa.valor_cliente ?? tabRev.valor ?? 0);
    } else if (reversa.calculo_cliente === 'percentual') {
      reversaClienteValor = totalCliente * N(reversa.percentual_cliente ?? tabRev.valor ?? 0) / 100;
    } else if (reversa.calculo_cliente === 'por_volume') {
      reversaClienteValor = N(reversa.volumes_previstos ?? 1) * N(reversa.valor_cliente ?? tabRev.valor ?? 0);
    } else if (reversa.calculo_cliente === 'por_parada') {
      reversaClienteValor = N(input.quantidade_paradas ?? 1) * N(reversa.valor_cliente ?? tabRev.valor ?? 0);
    } else if (reversa.calculo_cliente === 'negociado') {
      reversaClienteValor = N(reversa.valor_cliente ?? 0);
    }
    // Prestador
    if (reversa.calculo_prestador === 'valor_fixo') {
      reversaPrestadorValor = N(reversa.valor_prestador ?? 0);
    } else if (reversa.calculo_prestador === 'percentual') {
      reversaPrestadorValor = reversaClienteValor * N(reversa.percentual_prestador ?? 80) / 100;
    } else if (reversa.calculo_prestador === 'por_volume') {
      reversaPrestadorValor = N(reversa.volumes_previstos ?? 1) * N(reversa.valor_prestador ?? 0);
    } else if (reversa.calculo_prestador === 'negociado') {
      reversaPrestadorValor = N(reversa.valor_prestador ?? 0);
    }
    if (reversaClienteValor > 0 || reversaPrestadorValor > 0) {
      regras_aplicadas.push({
        tipo: 'reversa_' + reversa.tipo,
        descricao: `Reversa: cliente R$ ${reversaClienteValor.toFixed(2)}, prestador R$ ${reversaPrestadorValor.toFixed(2)}`,
        impacto_cliente: reversaClienteValor,
        impacto_prestador: reversaPrestadorValor,
      });
      memoria.push(`Reversa ${reversa.tipo}: cliente +R$ ${reversaClienteValor.toFixed(2)}, prestador +R$ ${reversaPrestadorValor.toFixed(2)}`);
    }
  }

  // Adicionais da escala (segunda/terceira saída cobrados do cliente)
  const po = input.prestador_operacional || {};
  const segundaSaidaCliente = po.segunda_saida && po.segunda_saida_cobrar_cliente !== false ? N(po.valor_segunda_saida ?? 0) : 0;
  const terceiraSaidaCliente = po.terceira_saida && po.terceira_saida_cobrar_cliente !== false ? N(po.valor_terceira_saida ?? 0) : 0;

  const adicionaisCliente: PricingAdicionaisCliente = {
    km_excedente: totalKmExcedenteCliente,
    espera: esperaCalc.total,
    pedagio_cobrado: N(adicionaisManuais.pedagio_cobrado_cliente ?? 0),
    reentrega: N(adicionaisManuais.reentrega_cliente ?? 0),
    agendamento: N(adicionaisManuais.agendamento_cliente ?? 0),
    segunda_saida: segundaSaidaCliente,
    terceira_saida: terceiraSaidaCliente,
    ajuste_manual: N(adicionaisManuais.ajuste_cliente_valor ?? 0),
    overbooking: overbookingClienteValor,
    outros: 0,
  };

  const totalAdicionaisCliente = Object.values(adicionaisCliente).reduce((a, b) => a + b, 0);
  const totalCliente = valorBaseCliente + totalAdicionaisCliente;

  memoria.push(`9. Valor base cliente: R$ ${valorBaseCliente.toFixed(2)}`);
  memoria.push(`10. Adicionais cliente: KM excedente R$ ${totalKmExcedenteCliente.toFixed(2)}, espera R$ ${esperaCalc.total.toFixed(2)}, outros R$ ${(totalAdicionaisCliente - totalKmExcedenteCliente - esperaCalc.total).toFixed(2)}`);

  // 7. Calcular valor do prestador
  // Prioridade 1: usar tabela_prestador encontrada
  let basePrestador = 0;
  let franquiaKmPrestador = 0;
  let valorKmPrestador = 0;
  let kmExcedenteMotorista = 0;
  let totalKmExcedentePrestador = 0;

  if (tabPrest.fonte === 'tabela_prestador') {
    // Usa tabela_prestador: valor_minimo + km excedente
    basePrestador = N(tabPrest.valor_minimo ?? 0) + N(tabPrest.valor_saida ?? 0);
    franquiaKmPrestador = N(tabPrest.km_incluso ?? 0);
    valorKmPrestador = N(tabPrest.valor_km ?? 0);
    kmExcedenteMotorista = calcularKmExcedente(kmRodados, franquiaKmPrestador);
    totalKmExcedentePrestador = kmExcedenteMotorista * valorKmPrestador;
    memoria.push(`11. Custo prestador via tabela_prestador: mínimo=${tabPrest.valor_minimo}, saída=${tabPrest.valor_saida}, km_incluso=${franquiaKmPrestador}`);
  } else if (tabPrest.fonte === 'prestadores_cadastro') {
    // Usa valores do cadastro do prestador
    basePrestador = N(tabPrest.valor_minimo ?? 0); // valor_diaria ou valor_saida
    franquiaKmPrestador = N(tabPrest.km_incluso ?? 0);
    valorKmPrestador = N(tabPrest.valor_km ?? 0);
    kmExcedenteMotorista = calcularKmExcedente(kmRodados, franquiaKmPrestador);
    totalKmExcedentePrestador = kmExcedenteMotorista * valorKmPrestador;
    memoria.push(`11. Custo prestador via cadastro: diária=${tabPrest.valor_minimo}, km=${valorKmPrestador}, franquia=${franquiaKmPrestador}`);
  } else if (tabPrest.fonte === 'veiculos') {
    basePrestador = N(tabPrest.valor_minimo ?? 0);
    valorKmPrestador = N(tabPrest.valor_km ?? 0);
    kmExcedenteMotorista = kmExcedenteCliente;
    totalKmExcedentePrestador = kmExcedenteMotorista * valorKmPrestador;
    memoria.push(`11. Custo prestador via veículo: custo_diaria=${tabPrest.valor_minimo}, custo_km=${valorKmPrestador}`);
  } else {
    // Fallback: percentual da tabela de valores do cliente
    const percPrestador = tabCliente.percentual_prestador / 100;
    basePrestador = totalCliente * percPrestador;
    kmExcedenteMotorista = kmExcedenteCliente;
    valorKmPrestador = N(adicionaisManuais.km_excedente_prestador_valor ?? 0);
    totalKmExcedentePrestador = kmExcedenteMotorista * valorKmPrestador;

    if (tabCliente.fonte !== 'fallback_hardcoded') {
      memoria.push(`11. Custo prestador via percentual da tabela: ${tabCliente.percentual_prestador}% de R$ ${totalCliente.toFixed(2)} = R$ ${basePrestador.toFixed(2)}`);
    } else {
      alertas.push({
        tipo: 'warning',
        mensagem: 'Custo do prestador calculado como percentual da tabela do cliente por falta de tabela_prestador.',
        campo: 'prestador_id'
      });
    }
  }

  // Overbooking no prestador
  const basePrestadorOriginal = basePrestador;
  if (overbooking?.ativo && overbookingClienteValor > 0) {
    basePrestador = overbookingPrestadorValor > 0 ? overbookingPrestadorValor : basePrestador;
  }

  // Adicionais do prestador
  const ajudanteValor = N(po.ajudantes ?? 0) * N(po.valor_ajudante ?? 0);
  const diariasAdicionaisValor = N(po.diarias_adicionais ?? 0) * N(po.valor_diaria ?? basePrestador);
  const segundaSaidaValor = po.segunda_saida && po.segunda_saida_pagar_prestador !== false ? N(po.valor_segunda_saida ?? 0) : 0;
  const terceiraSaidaValor = po.terceira_saida && po.terceira_saida_pagar_prestador !== false ? N(po.valor_terceira_saida ?? 0) : 0;
  const saidasAdicionaisValor = N(po.saidas_adicionais ?? 0) * N(po.valor_saida_adicional ?? 0);

  const adicionaisPrestador: PricingAdicionaisPrestador = {
    km_excedente: totalKmExcedentePrestador,
    espera: 0,
    ajudante: ajudanteValor,
    pedagio: N(po.pedagio ?? 0),
    segunda_saida: segundaSaidaValor,
    terceira_saida: terceiraSaidaValor,
    saidas_adicionais: saidasAdicionaisValor,
    diarias_adicionais: diariasAdicionaisValor,
    reembolso_outros: N(po.valor_reembolso_outros ?? 0),
    overbooking: overbookingPrestadorValor,
  };

  const totalAdicionaisPrestador = Object.values(adicionaisPrestador).reduce((a, b) => a + b, 0);

  // Descontos do prestador
  const descontosPrestador: PricingDescontosPrestador = {
    combustivel: N(po.combustivel ?? 0),
    outros: N(po.desconto ?? 0),
  };
  const totalDescontosPrestador = descontosPrestador.combustivel + descontosPrestador.outros;

  const totalPrestador = basePrestador + totalAdicionaisPrestador - totalDescontosPrestador;

  memoria.push(`12. Base prestador: R$ ${basePrestador.toFixed(2)}, adicionais: R$ ${totalAdicionaisPrestador.toFixed(2)}, descontos: R$ ${totalDescontosPrestador.toFixed(2)}`);

  // 8. Custos operacionais
  const custosOperacionais = {
    pedagio: adicionaisPrestador.pedagio,
    combustivel: descontosPrestador.combustivel,
    ajudante: ajudanteValor,
    outros: 0,
    total: adicionaisPrestador.pedagio + descontosPrestador.combustivel + ajudanteValor,
  };

  // 9. Margem — FÓRMULA UNIFICADA (idêntica aos triggers M66/M80b)
  //   outros_custos = adicionais + ajudante - descontos
  //   margem_bruta = valor_cliente - valor_prestador - pedagio - outros_custos
  const margemUnificada = calcularMargemUnificada({
    valorCliente: totalCliente,
    valorPrestador: totalPrestador,
    pedagio: adicionaisPrestador.pedagio,
    adicionais: adicionaisCliente.km_excedente + adicionaisCliente.espera + adicionaisCliente.reentrega + adicionaisCliente.agendamento + adicionaisCliente.ajuste_manual,
    ajudante: ajudanteValor,
    descontos: descontosPrestador.combustivel + descontosPrestador.outros,
    reversaCliente: reversaClienteValor,
    reversaPrestador: reversaPrestadorValor,
    impostoPercentual: aliquotaIss,
  });

  const margem: PricingMargem = {
    bruta: margemUnificada.margem_bruta,
    liquida: margemUnificada.margem_liquida,
    percentual_bruta: margemUnificada.percentual_margem_bruta,
    percentual_liquida: margemUnificada.percentual_margem_liquida,
    imposto_valor: margemUnificada.imposto_valor,
    seguro_valor: margemUnificada.seguro_valor,
    imposto_percentual: aliquotaIss,
  };

  memoria.push(`13. Margem bruta: R$ ${margem.bruta.toFixed(2)} (${margem.percentual_bruta}%)`);
  memoria.push(`14. Imposto (${aliquotaIss}%): R$ ${margemUnificada.imposto_valor.toFixed(2)}, Seguro (1%): R$ ${margemUnificada.seguro_valor.toFixed(2)}`);
  memoria.push(`15. Margem líquida: R$ ${margem.liquida.toFixed(2)} (${margem.percentual_liquida}%)`);

  // 10. Validações
  const pode_salvar = tabPrest.fonte !== 'nao_encontrada' && tabCliente.fonte !== 'nao_encontrada';
  let motivo_bloqueio: string | undefined;

  if (tabPrest.fonte === 'nao_encontrada') {
    motivo_bloqueio = 'Custo do prestador não encontrado em nenhuma tabela ou cadastro.';
    alertas.push({ tipo: 'error', mensagem: motivo_bloqueio, campo: 'prestador_id' });
  }
  if (tabCliente.fonte === 'nao_encontrada') {
    motivo_bloqueio = 'Tabela de preços do cliente não encontrada.';
    alertas.push({ tipo: 'error', mensagem: motivo_bloqueio, campo: 'cliente_id' });
  }
  if (margemLiquida < 0) {
    alertas.push({
      tipo: 'warning',
      mensagem: `Margem líquida negativa (${margem.percentual_liquida}%). Revisar preços ou custos.`,
      campo: 'margem'
    });
  }

  // 11. Montar saída
  const output: PricingOutput = {
    sucesso: pode_salvar,
    modo: input.modo,
    timestamp,

    cliente: {
      id: input.cliente_id,
      tabela_aplicada: tabCliente,
      valor_base: valorBaseCliente,
      valor_base_original: valorBaseClienteOriginal,
      adicionais: adicionaisCliente,
      total_adicionais: totalAdicionaisCliente,
      reversa_valor: reversaClienteValor,
      total: Math.round((totalCliente + reversaClienteValor) * 100) / 100,
    },

    prestador: {
      id: input.prestador_id || null,
      tabela_aplicada: tabPrest,
      valor_base: basePrestador,
      valor_base_original: basePrestadorOriginal,
      detalhes_km: {
        franquia: franquiaKmPrestador,
        excedente: kmExcedenteMotorista,
        valor_km: valorKmPrestador,
        total_excedente: totalKmExcedentePrestador,
      },
      adicionais: adicionaisPrestador,
      total_adicionais: totalAdicionaisPrestador,
      descontos: descontosPrestador,
      total_descontos: totalDescontosPrestador,
      reversa_valor: reversaPrestadorValor,
      total: Math.round((totalPrestador + reversaPrestadorValor) * 100) / 100,
    },

    custos_operacionais: custosOperacionais,
    margem,
    regras_aplicadas,
    memoria_calculo: memoria,
    alertas,
    pode_salvar,
    motivo_bloqueio,
    fontes_dados,
  };

  return output;
}
