const fs = require('fs');

let service = fs.readFileSync('src/services/roteirizacaoService.ts', 'utf8');

const newDistribuicao = `
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
     const sugestoes Extras = sugerirVeiculosNecessarios(pedidosNaoAlocados, ['seco', 'refrigerado']);
     const sugestoesFormatadas = sugestoesExtras.map(s => \`\${s.quantidade}x \${getNomeTipoVeiculo(s.tipo)}\`);
     
     alertasGlobais.push({
      tipo: 'aviso',
      codigo: 'PEDIDOS_NAO_ALOCADOS_FROTA',
      mensagem: \`\${pedidosNaoAlocados.length} pedidos sobraram. Sugestão extra: \${sugestoesFormatadas.join(', ') || 'Nenhuma'}\`,
      pedidoIds: pedidosNaoAlocados.map(p => p.id),
     });
  }

  return resultado;
};
`;

service = service.replace(/export const distribuirPedidosEntreVeiculos \= \([\s\S]*?(?=export const gerarResumoRoteirizacao)/, newDistribuicao);

fs.writeFileSync('src/services/roteirizacaoService.ts', service);
console.log('Done Service');
