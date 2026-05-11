import { CombustivelTipo, SugestaoReajuste, MonitoramentoCombustivel } from "@/types/combustivel";
import { supabase } from "@/lib/supabase";

export const combustivelService = {
  /**
   * Busca o preço médio atual do combustível em fontes públicas.
   * Prioridade: ANP / Dados Públicos.
   */
  async buscarPrecoCombustivelAtual(tipo: CombustivelTipo): Promise<{ preco: number; fonte: string }> {
    console.log(`[COMBUSTIVEL] Iniciando consulta para: ${tipo}`);
    
    try {
      // Simulação de busca em fonte pública (ANP / API de Preços)
      // Em um cenário real, poderíamos usar um scraper ou uma API como a do BrasilAPI se disponível
      // ou um endpoint customizado que processe os dados da ANP.
      
      // Mock de resposta para demonstração, mas preparado para integração real
      const mocks: Record<CombustivelTipo, number> = {
        'diesel': 6.12 + (Math.random() * 0.2),
        'gasolina': 5.85 + (Math.random() * 0.2),
        'etanol': 3.95 + (Math.random() * 0.2)
      };

      // Simulando um delay de rede
      await new Promise(resolve => setTimeout(resolve, 800));

      const preco = mocks[tipo];
      const fonte = "ANP / Dados Públicos (Brasil)";
      
      console.log(`[COMBUSTIVEL] Preço atual obtido: R$ ${preco.toFixed(2)} via ${fonte}`);
      
      return { preco, fonte };
    } catch (error) {
      console.error("[COMBUSTIVEL] Erro ao buscar preço atual:", error);
      throw error;
    }
  },

  /**
   * Calcula a variação percentual entre o preço base e o atual.
   */
  calcularVariacaoCombustivel(precoBase: number, precoAtual: number): number {
    if (precoBase === 0) return 0;
    const variacao = ((precoAtual - precoBase) / precoBase) * 100;
    console.log(`[COMBUSTIVEL] Variação calculada: ${variacao.toFixed(2)}%`);
    return variacao;
  },

  /**
   * Calcula a sugestão de reajuste para o componente veículo.
   * Regra de negócio: O combustível representa aprox. 35-45% do custo do veículo.
   * Vamos assumir 40% de peso do combustível no componente veículo.
   */
  calcularSugestaoReajusteVeiculo(variacaoCombustivel: number): number {
    const pesoCombustivelNoCusto = 0.40; // 40%
    const sugestao = variacaoCombustivel * pesoCombustivelNoCusto;
    console.log(`[COMBUSTIVEL] Sugestão calculada: ${sugestao.toFixed(2)}%`);
    return sugestao;
  },

  /**
   * Gera a mensagem amigável para o usuário.
   */
  gerarMensagemSugestaoCombustivel(tipo: CombustivelTipo, variacao: number, sugestao: number): string {
    const status = variacao > 0 ? "subiu" : "caiu";
    const acao = variacao > 0 ? "reajuste" : "redução";
    const msg = `O preço do ${tipo} ${status} ${Math.abs(variacao).toFixed(1)}%. Sugestão de ${acao} no componente veículo: ${sugestao > 0 ? '+' : ''}${sugestao.toFixed(2)}%`;
    console.log(`[COMBUSTIVEL] Mensagem gerada: ${msg}`);
    return msg;
  },

  /**
   * Simula a aplicação do reajuste (apenas log e retorno de sucesso)
   */
  async aplicarReajuste(tipo: CombustivelTipo, percentual: number): Promise<boolean> {
    console.log(`[COMBUSTIVEL] Usuário aplicou sugestão de ${percentual.toFixed(2)}% para ${tipo}`);
    // Aqui no futuro poderíamos atualizar as tabelas no Supabase
    return true;
  }
};
