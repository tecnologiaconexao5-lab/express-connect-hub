import type {
  FreightProviderInterface,
  FreightCotacaoParams,
} from "./FreightProviderInterface";
// FIX-CRITICO (W7): timeout 8s + 1 retry — ver invokeCotacaoComRetry.ts
import { invokeCotacaoComRetry } from "./invokeCotacaoComRetry";

export class EdgeFreightProvider implements FreightProviderInterface {
  private readonly codigo: string;

  constructor(codigo: string) {
    this.codigo = codigo;
  }

  async calcularCotacao(params: FreightCotacaoParams): Promise<any> {
    // FIX W7/W8: resposta pode trazer isSimulation=true (provedores simulados)
    return await invokeCotacaoComRetry({ provider: this.codigo, params });
  }
}
