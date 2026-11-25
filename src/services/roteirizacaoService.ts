import {
  PedidoRoteirizacao,
  VeiculoRoteirizacao,
  TipoVeiculo,
  CAPACIDADES_PADRAO_VEICULOS,
  ResultadoRoteirizacao,
  RotaGerada,
  AlertaRoteirizacao,
  GrupoPedidos,
  FaixaCep,
  ModoRoteirizacao,
  ParadaSequencia,
  OrigemCalculoDistancia,
  ResultadoCalculoDistancia,
  SugestaoFrotaCenario,
  SugestaoComparativaRegiao,
} from '@/types/roteirizacao';

export const calcularCubagemPedido = (pedido: PedidoRoteirizacao): number => {
  if (pedido.comprimentoCm && pedido.larguraCm && pedido.alturaCm && pedido.quantidadeVolumes) {
    return ((pedido.comprimentoCm * pedido.larguraCm * pedido.alturaCm * pedido.quantidadeVolumes) / 1000000);
  }
  return pedido.cubagemM3 || 0;
};

export const calcularTotaisPedidos = (pedidos: PedidoRoteirizacao[]) => {
  const pesoTotal = pedidos.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
  const cubagemTotal = pedidos.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
  const volumesTotal = pedidos.reduce((acc, p) => acc + (p.quantidadeVolumes || 0), 0);
  const regioes = [...new Set(pedidos.map(p => p.bairro || p.cidade || 'sem_regiao'))];
  
  return {
    totalPedidos: pedidos.length,
    pesoTotalKg: pesoTotal,
    cubagemTotalM3: cubagemTotal,
    volumesTotal,
    regioesIdentificadas: regioes,
  };
};

export const getCapacidadePadrao = (tipo: TipoVeiculo) => {
  return CAPACIDADES_PADRAO_VEICULOS.find(c => c.tipo === tipo);
};

export const calcularCapacidadeVeiculo = (veiculo: VeiculoRoteirizacao) => {
  return {
    capacidadePesoKg: veiculo.capacidadePesoKg,
    capacidadeCubagemM3: veiculo.capacidadeCubagemM3,
  };
};

export const validarCompatibilidadeCargaVeiculo = (
  pedido: PedidoRoteirizacao,
  veiculo: VeiculoRoteirizacao,
  pesoAtual: number,
  cubagemAtual: number
): { valido: boolean; razoes: string[] } => {
  const razoes: string[] = [];
  const pesoPedido = pedido.pesoKg || 0;
  const cubagemPedido = calcularCubagemPedido(pedido);

  if (pesoPedido + pesoAtual > veiculo.capacidadePesoKg) {
    razoes.push('Peso excedido');
  }

  if (cubagemPedido + cubagemAtual > veiculo.capacidadeCubagemM3) {
    razoes.push('Cubagem excedida');
  }

  if (pedido.secoOuRefrigerado === 'refrigerado' && veiculo.tipoOperacao !== 'refrigerado') {
    razoes.push('Veículo incompatível com carga refrigerada');
  }

  if (
    pedido.secoOuRefrigerado === 'refrigerado' &&
    veiculo.temperaturaMinima &&
    pedido.temperaturaMinima < veiculo.temperaturaMinima
  ) {
    razoes.push('Temperatura mínima incompatível');
  }

  return { valido: razoes.length === 0, razoes };
};

export const grupoPorPrefixoCep = (cep: string): string => {
  if (!cep || cep.length < 3) return '000';
  return cep.substring(0, 3);
};

export const agruparPorFaixaCep = (pedidos: PedidoRoteirizacao[]): GrupoPedidos[] => {
  const grupos: Map<string, PedidoRoteirizacao[]> = new Map();

  pedidos.forEach(pedido => {
    const faixa = grupoPorPrefixoCep(pedido.cep);
    if (!grupos.has(faixa)) {
      grupos.set(faixa, []);
    }
    grupos.get(faixa)!.push(pedido);
  });

  return Array.from(grupos.entries()).map(([nome, pedidosGrupo], index) => {
    const pesoTotal = pedidosGrupo.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
    const cubagemTotal = pedidosGrupo.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
    
    return {
      id: `faixa_${index}`,
      nome: `CEP ${nome}000 - ${nome}999`,
      tipo: 'faixa_cep',
      pedidos: pedidosGrupo,
      pesoTotalKg: pesoTotal,
      cubagemTotalM3: cubagemTotal,
    };
  });
};

export const agruparPorRegiao = (pedidos: PedidoRoteirizacao[]): GrupoPedidos[] => {
  const grupos: Map<string, PedidoRoteirizacao[]> = new Map();

  pedidos.forEach(pedido => {
    const regiao = pedido.bairro || pedido.cidade || 'sem_regiao';
    if (!grupos.has(regiao)) {
      grupos.set(regiao, []);
    }
    grupos.get(regiao)!.push(pedido);
  });

  return Array.from(grupos.entries()).map(([nome, pedidosGrupo], index) => {
    const pesoTotal = pedidosGrupo.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
    const cubagemTotal = pedidosGrupo.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
    
    return {
      id: `regiao_${index}`,
      nome,
      tipo: 'regiao',
      pedidos: pedidosGrupo,
      pesoTotalKg: pesoTotal,
      cubagemTotalM3: cubagemTotal,
    };
  });
};

export const agruparPorCidade = (pedidos: PedidoRoteirizacao[]): GrupoPedidos[] => {
  const grupos: Map<string, PedidoRoteirizacao[]> = new Map();

  pedidos.forEach(pedido => {
    const cidade = pedido.cidade || 'sem_cidade';
    if (!grupos.has(cidade)) {
      grupos.set(cidade, []);
    }
    grupos.get(cidade)!.push(pedido);
  });

  return Array.from(grupos.entries()).map(([nome, pedidosGrupo], index) => {
    const pesoTotal = pedidosGrupo.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
    const cubagemTotal = pedidosGrupo.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
    
    return {
      id: `cidade_${index}`,
      nome,
      tipo: 'cidade',
      pedidos: pedidosGrupo,
      pesoTotalKg: pesoTotal,
      cubagemTotalM3: cubagemTotal,
    };
  });
};

export const validarPedido = (pedido: PedidoRoteirizacao): AlertaRoteirizacao[] => {
  const alertas: AlertaRoteirizacao[] = [];

  if (!pedido.cep) {
    alertas.push({
      tipo: 'erro',
      codigo: 'SEM_CEP',
      mensagem: `Pedido ${pedido.numeroPedido} sem CEP`,
      pedidoIds: [pedido.id],
    });
  }

  if (!pedido.pesoKg || pedido.pesoKg <= 0) {
    alertas.push({
      tipo: 'erro',
      codigo: 'SEM_PESO',
      mensagem: `Pedido ${pedido.numeroPedido} sem peso`,
      pedidoIds: [pedido.id],
    });
  }

  if (!pedido.comprimentoCm || !pedido.larguraCm || !pedido.alturaCm) {
    alertas.push({
      tipo: 'aviso',
      codigo: 'SEM_DIMENSAO',
      mensagem: `Pedido ${pedido.numeroPedido} sem dimensões`,
      pedidoIds: [pedido.id],
    });
  }

  if (pedido.secoOuRefrigerado === 'refrigerado' && !pedido.temperaturaMinima) {
    alertas.push({
      tipo: 'erro',
      codigo: 'SEM_TEMPERATURA',
      mensagem: `Pedido refrigerado ${pedido.numeroPedido} sem temperatura mínima`,
      pedidoIds: [pedido.id],
    });
  }

  return alertas;
};

export const validarListaPedidos = (pedidos: PedidoRoteirizacao[]): AlertaRoteirizacao[] => {
  // Dedup por codigo + numero do pedido/OS (evita SEM_PESO/SEM_DIMENSAO repetidos).
  const vistos = new Set<string>();
  const out: AlertaRoteirizacao[] = [];
  for (const pedido of pedidos) {
    for (const alerta of validarPedido(pedido)) {
      const chave = `${alerta.codigo}::${pedido.numeroPedido || pedido.id}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      out.push(alerta);
    }
  }
  return out;
};

/** Normaliza o `tipo_veiculo` do banco para o enum da roteirizacao. */
export const normalizarTipoVeiculo = (valor: unknown): TipoVeiculo => {
  const t = String(valor || "").toLowerCase();
  if (t.includes("moto")) return "Moto";
  if (t.includes("fiorino")) return "Fiorino";
  if (t.includes("hr") || t.includes("bongo")) return "HR_Bongo";
  if (t.includes("van") || t.includes("vuc") || t.includes("kombi")) return "Van_VUC";
  if (t.includes("3/4") || t.includes("34") || t.includes("tres") || t.includes("três")) return "Caminhao_34";
  if (t.includes("toco")) return "Caminhao_Toco";
  if (t.includes("truck") || t.includes("bitruck")) return "Caminhao_Truck";
  if (t.includes("carreta") || t.includes("bitrem")) return "Carreta";
  return "Van_VUC";
};

const TIPOS_POR_CAPACIDADE: TipoVeiculo[] = [
  'Moto',
  'Fiorino',
  'Van_VUC',
  'HR_Bongo',
  'Caminhao_34',
  'Caminhao_Toco',
  'Caminhao_Truck',
  'Carreta',
];

/** Tipos exibidos nas sugestoes comparativas (curto/médio porte). */
const TIPOS_SUGESTAO: TipoVeiculo[] = [
  'Moto',
  'Fiorino',
  'HR_Bongo',
  'Van_VUC',
  'Caminhao_34',
];

/**
 * Quantidade REAL de veiculos de um tipo para atender, simultaneamente,
 * peso (kg), cubagem (m³ quando > 0) e maximo de paradas por turno.
 */
export const dimensionarQuantidadeFrota = (
  pedidos: PedidoRoteirizacao[],
  tipo: TipoVeiculo,
): number => {
  if (pedidos.length === 0) return 0;
  const cap = getCapacidadePadrao(tipo);
  if (!cap) return 0;

  const peso = pedidos.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
  const cubagem = pedidos.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
  const paradas = pedidos.length;

  const porPeso = cap.capacidadePesoKg > 0
    ? Math.ceil(peso / cap.capacidadePesoKg)
    : 1;
  const porCubagem = (cubagem > 0 && cap.capacidadeCubagemM3 > 0)
    ? Math.ceil(cubagem / cap.capacidadeCubagemM3)
    : 1;
  const porParadas = (cap.maxParadas && cap.maxParadas > 0)
    ? Math.ceil(paradas / cap.maxParadas)
    : 1;

  return Math.max(1, porPeso, porCubagem, porParadas);
};

const melhorComposicaoPara = (
  pedidos: PedidoRoteirizacao[],
): { tipo: TipoVeiculo; quantidade: number } | null => {
  let melhor: { tipo: TipoVeiculo; quantidade: number } | null = null;
  for (const tipo of TIPOS_POR_CAPACIDADE) {
    const quantidade = dimensionarQuantidadeFrota(pedidos, tipo);
    if (quantidade <= 0) continue;
    const capAtual = getCapacidadePadrao(tipo)?.capacidadePesoKg || 0;
    const capMelhor = melhor
      ? (getCapacidadePadrao(melhor.tipo)?.capacidadePesoKg || 0)
      : Infinity;
    if (
      !melhor || quantidade < melhor.quantidade ||
      (quantidade === melhor.quantidade && capAtual < capMelhor)
    ) {
      melhor = { tipo, quantidade };
    }
  }
  return melhor;
};

export const sugerirVeiculosNecessarios = (
  pedidos: PedidoRoteirizacao[],
  modos: ('seco' | 'refrigerado')[],
): {
  tipo: TipoVeiculo;
  quantidade: number;
  capacidadePesoKg: number;
  capacidadeCubagemM3: number;
  maxParadas: number;
  refrigerado?: boolean;
}[] => {
  const resultado: {
    tipo: TipoVeiculo;
    quantidade: number;
    capacidadePesoKg: number;
    capacidadeCubagemM3: number;
    maxParadas: number;
    refrigerado?: boolean;
  }[] = [];

  const seco = pedidos.filter(p => p.secoOuRefrigerado === 'seco');
  const refrigerado = pedidos.filter(p => p.secoOuRefrigerado === 'refrigerado');

  if (modos.includes('seco') && seco.length > 0) {
    const comp = melhorComposicaoPara(seco);
    if (comp) {
      const cap = getCapacidadePadrao(comp.tipo);
      resultado.push({
        tipo: comp.tipo,
        quantidade: comp.quantidade,
        capacidadePesoKg: cap?.capacidadePesoKg || 0,
        capacidadeCubagemM3: cap?.capacidadeCubagemM3 || 0,
        maxParadas: cap?.maxParadas || 0,
      });
    }
  }

  if (modos.includes('refrigerado') && refrigerado.length > 0) {
    const cap = getCapacidadePadrao('Van_VUC');
    resultado.push({
      tipo: 'Van_VUC',
      quantidade: dimensionarQuantidadeFrota(refrigerado, 'Van_VUC'),
      capacidadePesoKg: cap?.capacidadePesoKg || 0,
      capacidadeCubagemM3: cap?.capacidadeCubagemM3 || 0,
      maxParadas: cap?.maxParadas || 0,
      refrigerado: true,
    });
  }

  return resultado;
};

/**
 * Sugestoes comparativas de frota por regiao (bairro/cidade) e no consolidado.
 * Cada cenario respeita peso + cubagem + maximo de paradas do veiculo.
 */
export const gerarSugestoesComparativasPorRegiao = (
  pedidos: PedidoRoteirizacao[],
): SugestaoComparativaRegiao[] => {
  const montarCenario = (
    lista: PedidoRoteirizacao[],
    tipo: TipoVeiculo,
  ): SugestaoFrotaCenario => {
    const cap = getCapacidadePadrao(tipo);
    const quantidade = dimensionarQuantidadeFrota(lista, tipo);
    const nome = getNomeTipoVeiculo(tipo);
    return {
      tipo,
      tipoNome: nome,
      quantidade,
      capacidadePesoKg: cap?.capacidadePesoKg || 0,
      capacidadeCubagemM3: cap?.capacidadeCubagemM3 || 0,
      maxParadas: cap?.maxParadas || 0,
      resumo: `${quantidade} ${nome} (${cap?.capacidadePesoKg || 0} kg)`,
    };
  };

  const criar = (
    regiao: string,
    lista: PedidoRoteirizacao[],
  ): SugestaoComparativaRegiao => {
    const peso = lista.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
    const cubagem = lista.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
    const cenarios = TIPOS_SUGESTAO
      .map(tipo => montarCenario(lista, tipo))
      .filter(c => c.quantidade > 0);
    const recomendado = [...cenarios].sort((a, b) =>
      a.quantidade - b.quantidade ||
      a.capacidadePesoKg - b.capacidadePesoKg
    )[0] || null;
    return {
      regiao,
      paradas: lista.length,
      pesoKg: Math.round(peso * 10) / 10,
      cubagemM3: Math.round(cubagem * 100) / 100,
      recomendado,
      cenarios,
    };
  };

  const saida: SugestaoComparativaRegiao[] = [];
  if (pedidos.length === 0) return saida;

  agruparPorRegiao(pedidos).forEach(grupo => {
    saida.push(criar(grupo.nome, grupo.pedidos));
  });
  saida.push(criar('Consolidado geral', pedidos));
  return saida;
};


export const distribuirPedidosEntreVeiculos = (
  pedidos: PedidoRoteirizacao[],
  veiculosDisponiveis: VeiculoRoteirizacao[],
  modoRoteirizacao: ModoRoteirizacao = 'disponiveis'
): { veiculo: VeiculoRoteirizacao; pedidos: PedidoRoteirizacao[]; alertas: AlertaRoteirizacao[] }[] => {
  const resultado: { veiculo: VeiculoRoteirizacao; pedidos: PedidoRoteirizacao[]; alertas: AlertaRoteirizacao[] }[] = [];
  const pedidosNaoAlocados: PedidoRoteirizacao[] = [];
  const alertasGlobais: AlertaRoteirizacao[] = [];

  // 1. Filtrar veículos (no modo sugestão nós usamos os veículos virtuais gerados por sugerirVeiculosNecessarios)
  let veiculosBase = [...veiculosDisponiveis];
  if (modoRoteirizacao === 'disponiveis') {
    veiculosBase = veiculosBase.filter(v => v.disponivel);
  }

  // Ordena os veículos: Refrigerados primeiro, depois por capacidade (maior primeiro)
  const veiculosOrdenados = veiculosBase.sort((a, b) => {
    if (a.tipoOperacao === 'refrigerado' && b.tipoOperacao !== 'refrigerado') return -1;
    if (a.tipoOperacao !== 'refrigerado' && b.tipoOperacao === 'refrigerado') return 1;
    return (b.capacidadePesoKg || 0) - (a.capacidadePesoKg || 0);
  });

  // Ordena os pedidos (urgentes/refrigerados primeiro)
  const pedidosOrdenados = [...pedidos].sort((a, b) => {
    if (a.prioridade === 'urgente' && b.prioridade !== 'urgente') return -1;
    if (a.prioridade !== 'urgente' && b.prioridade === 'urgente') return 1;
    if (a.secoOuRefrigerado === 'refrigerado' && b.secoOuRefrigerado !== 'refrigerado') return -1;
    return 0;
  });

  // Estado de alocação de veículos
  const alocacoesVeiculos = veiculosOrdenados.map(v => ({
    veiculo: v,
    pesoAtual: 0,
    cubagemAtual: 0,
    pedidosAlocados: [] as PedidoRoteirizacao[]
  }));

  // Distribuição principal
  pedidosOrdenados.forEach(pedido => {
    // Apenas tenta alocar pedidos válidos
    const errosPedido = validarPedido(pedido).filter(a => a.tipo === 'erro');
    if (errosPedido.length > 0) {
      pedidosNaoAlocados.push(pedido);
      return;
    }

    let alocado = false;

    // Tentar encontrar o melhor veículo
    for (const aloc of alocacoesVeiculos) {
      const veiculo = aloc.veiculo;
      
      // Validação de compatibilidade
      const compatibilidade = validarCompatibilidadeCargaVeiculo(pedido, veiculo, aloc.pesoAtual, aloc.cubagemAtual);
      
      if (compatibilidade.valido) {
        // Validação heurística de CEP (se o veículo tiver base, prioriza a mesma região de CEP, mas não obriga)
        // Se o veículo estiver vazio, ele aceita a primeira carga que define sua "região"
        const cepPrefixo = grupoPorPrefixoCep(pedido.cep);
        const cepBasePrefixo = grupoPorPrefixoCep(veiculo.cepBasePrestador || '');
        
        let pontuacaoAfinidade = 0;
        
        // Afinidade por CEP base do prestador
        if (veiculo.cepBasePrestador && cepBasePrefixo === cepPrefixo) {
            pontuacaoAfinidade += 10;
        }

        // Afinidade com a carga atual do veículo
        if (aloc.pedidosAlocados.length > 0) {
           const cepMaioria = grupoPorPrefixoCep(aloc.pedidosAlocados[0].cep);
           if (cepMaioria === cepPrefixo) pontuacaoAfinidade += 5;
        } else {
           pontuacaoAfinidade += 5; // veículo vazio aceita bem
        }

        if (pontuacaoAfinidade >= 5) {
          aloc.pedidosAlocados.push(pedido);
          aloc.pesoAtual += pedido.pesoKg || 0;
          aloc.cubagemAtual += calcularCubagemPedido(pedido);
          alocado = true;
          break; // vai para o próximo pedido
        }
      }
    }

    // Se a primeira passada restrita não alocou, tenta sem restrição heurística de afinidade de CEP
    if (!alocado) {
       for (const aloc of alocacoesVeiculos) {
          const compatibilidade = validarCompatibilidadeCargaVeiculo(pedido, aloc.veiculo, aloc.pesoAtual, aloc.cubagemAtual);
          if (compatibilidade.valido) {
            aloc.pedidosAlocados.push(pedido);
            aloc.pesoAtual += pedido.pesoKg || 0;
            aloc.cubagemAtual += calcularCubagemPedido(pedido);
            alocado = true;
            break;
          }
       }
    }

    if (!alocado) {
      pedidosNaoAlocados.push(pedido);
    }
  });

  alocacoesVeiculos.forEach(aloc => {
    if (aloc.pedidosAlocados.length > 0) {
      resultado.push({
        veiculo: aloc.veiculo,
        pedidos: aloc.pedidosAlocados,
        alertas: [],
      });
    }
  });

  // Geração de Sugestão de Veículos Extras (Tarefas 4)
  if (pedidosNaoAlocados.length > 0) {
     const sugestoesExtras = sugerirVeiculosNecessarios(pedidosNaoAlocados, ['seco', 'refrigerado']);
     const sugestoesFormatadas = sugestoesExtras.map(s => `${s.quantidade}x ${getNomeTipoVeiculo(s.tipo)}`);
     
     alertasGlobais.push({
      tipo: 'aviso',
      codigo: 'PEDIDOS_NAO_ALOCADOS_FROTA',
      mensagem: `${pedidosNaoAlocados.length} pedidos sobraram. Sugestão extra: ${sugestoesFormatadas.join(', ') || 'Nenhuma'}`,
      pedidoIds: pedidosNaoAlocados.map(p => p.id),
     });
  }

  return resultado;
};
export const gerarResumoRoteirizacao = (
  resultado: ReturnType<typeof distribuirPedidosEntreVeiculos>,
  pedidosOriginais: PedidoRoteirizacao[]
): {
  totalPedidos: number;
  pesoTotalKg: number;
  cubagemTotalM3: number;
  veiculosUtilizados: number;
  pedidosNaoAlocados: number;
  ocupacaoMedia: number;
} => {
  let pesoTotal = 0;
  let cubagemTotal = 0;
  let totalPedidosAlocados = 0;

  resultado.forEach(r => {
    totalPedidosAlocados += r.pedidos.length;
    pesoTotal += r.pedidos.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
    cubagemTotal += r.pedidos.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
  });

  const ocupacaoTotal = resultado.reduce((acc, r) => {
    const capacidade = r.veiculo.capacidadePesoKg;
    const pesoUsado = r.pedidos.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
    return acc + (capacidade > 0 ? (pesoUsado / capacidade) * 100 : 0);
  }, 0);

  return {
    totalPedidos: pedidosOriginais.length,
    pesoTotalKg: pesoTotal,
    cubagemTotalM3: cubagemTotal,
    veiculosUtilizados: resultado.length,
    pedidosNaoAlocados: pedidosOriginais.length - totalPedidosAlocados,
    ocupacaoMedia: resultado.length > 0 ? ocupacaoTotal / resultado.length : 0,
  };
};

export const gerarAlertasPorDemandaxFrota = (
  pedidos: PedidoRoteirizacao[],
  veiculosDisponiveis: VeiculoRoteirizacao[]
): AlertaRoteirizacao[] => {
  const alertas: AlertaRoteirizacao[] = [];
  const totais = calcularTotaisPedidos(pedidos);
  
  const capacidadeTotalPeso = veiculosDisponiveis
    .filter(v => v.disponivel)
    .reduce((acc, v) => acc + v.capacidadePesoKg, 0);
  
  const capacidadeTotalCubagem = veiculosDisponiveis
    .filter(v => v.disponivel)
    .reduce((acc, v) => acc + v.capacidadeCubagemM3, 0);

  if (totais.pesoTotalKg > capacidadeTotalPeso) {
    alertas.push({
      tipo: 'erro',
      codigo: 'PESO_EXCEDE_FROTA',
      mensagem: `Peso total (${totais.pesoTotalKg}kg) excede capacidade da frota (${capacidadeTotalPeso}kg)`,
    });
  }

  if (totais.cubagemTotalM3 > capacidadeTotalCubagem) {
    alertas.push({
      tipo: 'erro',
      codigo: 'CUBAGEM_EXCEDE_FROTA',
      mensagem: `Cubagem total (${totais.cubagemTotalM3}m³) excede capacidade da frota (${capacidadeTotalCubagem}m³)`,
    });
  }

  if (pedidos.length > veiculosDisponiveis.filter(v => v.disponivel).length * 30) {
    alertas.push({
      tipo: 'sugestao',
      codigo: 'SUGESTAO_SEGUNDA_SAIDA',
      mensagem: 'Considere segunda saída ou veículos extras',
    });
  }

  return alertas;
};

export const converterPedidoPlanilha = (dados: Record<string, string>): PedidoRoteirizacao => {
  const comprimento = parseFloat(dados.comprimento_cm) || 0;
  const largura = parseFloat(dados.largura_cm) || 0;
  const altura = parseFloat(dados.altura_cm) || 0;
  const quantidade = parseInt(dados.quantidade_volumes) || 1;
  const cubagem = (comprimento * largura * altura * quantidade) / 1000000;

  return {
    id: `pedido_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    numeroPedido: dados.numero_pedido || '',
    cliente: dados.cliente || '',
    destinatario: dados.destinatario || '',
    telefone: dados.telefone || '',
    cep: dados.cep || '',
    enderecoCompleto: dados.endereco || '',
    bairro: dados.bairro || '',
    cidade: dados.cidade || '',
    estado: dados.estado || '',
    pesoKg: parseFloat(dados.peso_kg) || 0,
    quantidadeVolumes: quantidade,
    comprimentoCm: comprimento,
    larguraCm: largura,
    alturaCm: altura,
    cubagemM3: cubagem,
    tipoCarga: dados.tipo_carga as 'seco' | 'refrigerado' || 'seco',
    secoOuRefrigerado: dados.seco_ou_refrigerado as 'seco' | 'refrigerado' || 'seco',
    temperaturaMinima: dados.temperatura_minima ? parseFloat(dados.temperatura_minima) : undefined,
    janelaInicio: dados.janela_inicio || undefined,
    janelaFim: dados.janela_fim || undefined,
    prioridade: (dados.prioridade as 'baixa' | 'media' | 'alta' | 'urgente') || 'media',
    observacoes: dados.observacoes || undefined,
    status: 'pendente',
  };
};

export const getNomeTipoVeiculo = (tipo: TipoVeiculo): string => {
  const nomes: Record<TipoVeiculo, string> = {
    'Moto': 'Moto',
    'Fiorino': 'Fiorino',
    'HR_Bongo': 'Hyundai HR / Bongo',
    'Van_VUC': 'Van / VUC',
    'Caminhao_34': 'Caminhão 3/4',
    'Caminhao_Toco': 'Caminhão Toco',
    'Caminhao_Truck': 'Caminhão Truck',
    'Carreta': 'Carreta',
  };
  return nomes[tipo];
};

export const getIconeTipoVeiculo = (tipo: TipoVeiculo): string => {
  const icones: Record<TipoVeiculo, string> = {
    'Moto': '🏍',
    'Fiorino': '🚐',
    'HR_Bongo': '🚐',
    'Van_VUC': '🚚',
    'Caminhao_34': '🚛',
    'Caminhao_Toco': '🚛',
    'Caminhao_Truck': '🚛',
    'Carreta': '🚜',
  };
  return icones[tipo];
};

const calcularDistanciaHaversine = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const getPrefixoCep = (cep: string): string => {
  if (!cep || cep.length < 3) return '000';
  return cep.substring(0, 3);
};

const mesmaFaixaCep = (cep1: string, cep2: string): boolean => {
  return getPrefixoCep(cep1) === getPrefixoCep(cep2);
};

const mesmaCidade = (p1: PedidoRoteirizacao, p2: PedidoRoteirizacao): boolean => {
  if (!p1.cidade || !p2.cidade) return false;
  return p1.cidade.toLowerCase() === p2.cidade.toLowerCase();
};

export const optimizarSequenciaParadas = (
  pedidos: PedidoRoteirizacao[],
  cepBase?: string
): PedidoRoteirizacao[] => {
  if (pedidos.length <= 1) return pedidos;

  const pedidosConvertidos: ParadaSequencia[] = pedidos.map(p => ({
    id: p.id,
    numeroPedido: p.numeroPedido,
    cep: p.cep,
    enderecoCompleto: p.enderecoCompleto,
    bairro: p.bairro,
    cidade: p.cidade,
    latitude: p.latitude,
    longitude: p.longitude,
    prioridade: p.prioridade,
    secoOuRefrigerado: p.secoOuRefrigerado,
    janelaInicio: p.janelaInicio,
    janelaFim: p.janelaFim,
  }));

  const prioritarios = pedidosConvertidos.filter(p => 
    p.prioridade === 'urgente' || p.secoOuRefrigerado === 'refrigerado'
  );
  const normais = pedidosConvertidos.filter(p => 
    p.prioridade !== 'urgente' && p.secoOuRefrigerado !== 'refrigerado'
  );

  const ordenarProximos = (paradas: ParadaSequencia[]): ParadaSequencia[] => {
    if (paradas.length <= 1) return paradas;

    const resultado: ParadaSequencia[] = [];
    const restantes = [...paradas];

    let atual = restantes.shift()!;
    resultado.push(atual);

    while (restantes.length > 0) {
      let menorDistancia = Infinity;
      let indiceMaisProximo = 0;

      for (let i = 0; i < restantes.length; i++) {
        let distancia = Infinity;

        if (atual.latitude && atual.longitude && 
            restantes[i].latitude && restantes[i].longitude) {
          distancia = calcularDistanciaHaversine(
            atual.latitude, atual.longitude,
            restantes[i].latitude!, restantes[i].longitude!
          );
        } else if (mesmaCidade(atual as any, restantes[i] as any)) {
          distancia = 2;
        } else if (mesmaFaixaCep(atual.cep, restantes[i].cep)) {
          distancia = 3;
        } else {
          distancia = 10;
        }

        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          indiceMaisProximo = i;
        }
      }

      atual = restantes.splice(indiceMaisProximo, 1)[0];
      resultado.push(atual);
    }

    return resultado;
  };

  const ordensPrioritarios = ordenarProximos(prioritarios);
  const ordensNormais = ordenarProximos(normais);

  const resultado: PedidoRoteirizacao[] = [];
  ordensPrioritarios.forEach(p => {
    const orig = pedidos.find(ped => ped.id === p.id);
    if (orig) resultado.push(orig);
  });
  ordensNormais.forEach(p => {
    const orig = pedidos.find(ped => ped.id === p.id);
    if (orig) resultado.push(orig);
  });

  return resultado;
};

export const estimarDistanciaTempoLocal = (
  pedidos: PedidoRoteirizacao[],
  origemCepBase?: string
): ResultadoCalculoDistancia => {
  if (pedidos.length === 0) {
    return {
      distanciaTotalKm: 0,
      tempoTotalMinutos: 0,
      origemCalculo: 'estimativa_local',
      alertas: ['Nenhum pedido para calcular'],
    };
  }

  const alertas: string[] = [];
  let temCoordenadas = 0;
  let mesmaCidadeCount = 0;
  let regiaoMetropolitanCount = 0;
  let cidadesDiferentesCount = 0;

  const primeiraCidade = pedidos[0]?.cidade?.toLowerCase() || '';

  for (let i = 0; i < pedidos.length; i++) {
    if (pedidos[i].latitude && pedidos[i].longitude) {
      temCoordenadas++;
    }

    if (i > 0) {
      const cidadeAtual = pedidos[i].cidade?.toLowerCase() || '';
      if (cidadeAtual === primeiraCidade && primeiraCidade !== '') {
        mesmaCidadeCount++;
      } else if (cidadeAtual !== '') {
        cidadesDiferentesCount++;
      }
    }
  }

  let kmPorParada: number;
  let minPorParada: number;

  if (mesmaCidadeCount > cidadesDiferentesCount) {
    kmPorParada = 4 + Math.random() * 4;
    minPorParada = 8 + Math.random() * 5;
    alertas.push('Estimativa baseada em mesma cidade');
  } else if (cidadesDiferentesCount > 0) {
    kmPorParada = 8 + Math.random() * 7;
    minPorParada = 15 + Math.random() * 10;
    alertas.push('Estimativa baseada em múltiplas cidades');
  } else {
    kmPorParada = 6 + Math.random() * 6;
    minPorParada = 10 + Math.random() * 8;
    alertas.push('Estimativa baseada em região');
  }

  if (temCoordenadas > 0) {
    const percentualComCoords = (temCoordenadas / pedidos.length) * 100;
    if (percentualComCoords < 50) {
      alertas.push(`Apenas ${temCoordenadas} de ${pedidos.length} pedidos têm coordenadas (${percentualComCoords.toFixed(0)}%)`);
    }
  }

  const distanciaTotal = kmPorParada * pedidos.length;
  const tempoTotal = minPorParada * pedidos.length;

  return {
    distanciaTotalKm: Math.round(distanciaTotal * 10) / 10,
    tempoTotalMinutos: Math.round(tempoTotal),
    origemCalculo: 'estimativa_local',
    alertas,
  };
};