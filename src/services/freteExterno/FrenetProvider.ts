import type {
  FreightProviderInterface,
  FreightCotacaoParams,
} from "./FreightProviderInterface";
// FIX-CRITICO (W7): timeout 8s + 1 retry — ver invokeCotacaoComRetry.ts
import { invokeCotacaoComRetry } from "./invokeCotacaoComRetry";

export class FrenetProvider implements FreightProviderInterface {
  async calcularCotacao(params: FreightCotacaoParams): Promise<any> {
    // FIX W7: Frenet real (isSimulation=false) com timeout/retry na edge
    return await invokeCotacaoComRetry({ provider: "FRENET", params });
  }
}
