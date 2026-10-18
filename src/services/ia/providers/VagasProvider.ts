import type { IProvider, ProviderParams, ProviderResult, TestConnectionResult } from "./ProviderInterface";

export class VagasProvider implements IProvider {
  readonly nome = "Plataforma de Vagas";
  readonly tipo = "PLATAFORMA_VAGAS";
  readonly provedor = "Gupy/Indeed";

  async execute(params: ProviderParams): Promise<ProviderResult> {
    const { acao } = params;

    try {
      switch (acao) {
        case "publicar_vaga":
          return this.publicarVaga(params);

        case "atualizar_vaga":
          return this.atualizarVaga(params);

        case "listar_vagas":
          return this.listarVagas(params);

        case "health_check":
          return await this.testConnectionInternal(params.config);

        default:
          return { sucesso: false, erro: `Ação desconhecida para VagasProvider: ${acao}` };
      }
    } catch (err) {
      return { sucesso: false, erro: err instanceof Error ? err.message : "Erro desconhecido no VagasProvider" };
    }
  }

  private async publicarVaga(params: ProviderParams): Promise<ProviderResult> {
    const { payload } = params;
    const titulo = payload.titulo as string;
    const descricao = payload.descricao as string;
    const plataforma = (payload.plataforma as string) || "generica";
    const empresa = (payload.empresa as string) || "Conexao Express";

    if (!titulo || !descricao) {
      return { sucesso: false, erro: "Campos obrigatórios: titulo, descricao" };
    }

    return {
      sucesso: true,
      data: {
        status: "preparado",
        plataforma,
        titulo,
        empresa,
        mensagem: `Vaga "${titulo}" preparada para publicação em ${plataforma}. Configure as credenciais da plataforma para envio real.`,
        observacao: "Driver de plataforma específica (Gupy, Indeed, LinkedIn) será ativado em versão futura.",
        vagaSimulada: { titulo, descricao: descricao.slice(0, 100), empresa, plataforma },
      },
    };
  }

  private async atualizarVaga(params: ProviderParams): Promise<ProviderResult> {
    const { payload } = params;
    return {
      sucesso: true,
      data: {
        status: "simulado",
        vagaId: payload.vagaId as string,
        mensagem: `Atualização de vaga simulada. Implementação por plataforma pendente.`,
      },
    };
  }

  private async listarVagas(params: ProviderParams): Promise<ProviderResult> {
    return {
      sucesso: true,
      data: {
        status: "simulado",
        mensagem: "Listagem de vagas simulada. Conecte-se a uma plataforma para dados reais.",
        vagas: [],
      },
    };
  }

  private async testConnectionInternal(config: Record<string, unknown>): Promise<ProviderResult> {
    const apiKey = config?.api_key as string || import.meta.env.VITE_VAGAS_API_KEY;
    return {
      sucesso: true,
      data: {
        status: apiKey ? "configurado" : "sem_credencial",
        mensagem: apiKey ? "Credencial de vagas configurada" : "Nenhuma credencial de vagas configurada. Configure VITE_VAGAS_API_KEY.",
      },
    };
  }

  async testConnection(config: Record<string, unknown>): Promise<TestConnectionResult> {
    const result = await this.testConnectionInternal(config);
    return { ok: result.sucesso, mensagem: (result.data?.mensagem as string) || "Teste concluído" };
  }
}
