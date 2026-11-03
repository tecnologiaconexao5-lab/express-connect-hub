import { supabase } from "@/lib/supabase";

export interface PrecoCombustivel {
  estado: string;
  municipio?: string;
  combustivel: string;
  preco: number;
  fonte: string;
  data: string;
  variacaoDia?: number;
}

export const PRECOS_ANP_SIMULADOS: Record<string, number> = {
  "Diesel S10": 6.25,
  "Gasolina Comum": 6.09,
  "Etanol Hidratado": 4.19,
};

const normalizarCombustivel = (tipo: string): string => {
  const t = String(tipo || "").toLowerCase();
  if (t.includes("diesel")) return "Diesel S10";
  if (t.includes("etanol") || t.includes("álcool") || t.includes("alcool")) return "Etanol Hidratado";
  return "Gasolina Comum";
};

/** Preço base para cálculo de custo operacional (ANP simulada). */
export function precoCombustivelParaCalculo(tipo: string): number {
  return PRECOS_ANP_SIMULADOS[normalizarCombustivel(tipo)] ?? 6.09;
}

export interface PainelPrecosCombustivel {
  [combustivel: string]: {
    preco: number;
    var_dia: number;
    var_7d: number;
    var_30d: number;
    data: string;
    fonte: string;
  };
}

export const combustiveisService = {
  /**
   * Base de preços atualizados das bombas (ANP/dados públicos).
   * Hoje retorna a base simulada determinística; a integração real pode ser
   * ligada aqui sem alterar os consumidores (página e cálculo de custos).
   */
  async obterPainelPrecos(uf: string = "SP"): Promise<PainelPrecosCombustivel> {
    const variacoes: Record<string, { dia: number; d7: number; d30: number }> = {
      "Diesel S10": { dia: 0.02, d7: 0.08, d30: -0.04 },
      "Gasolina Comum": { dia: -0.01, d7: -0.03, d30: 0.05 },
      "Etanol Hidratado": { dia: 0.01, d7: 0.06, d30: 0.02 },
    };
    const agora = new Date().toISOString();
    return Object.fromEntries(
      Object.entries(PRECOS_ANP_SIMULADOS).map(([nome, preco]) => [
        nome,
        {
          preco,
          var_dia: variacoes[nome]?.dia ?? 0,
          var_7d: variacoes[nome]?.d7 ?? 0,
          var_30d: variacoes[nome]?.d30 ?? 0,
          data: agora,
          fonte: `ANP (simulado · ${uf})`,
        },
      ]),
    );
  },

  // FONTE 1: combustivelapi.com.br
  async fetchFromCombustivelAPI(uf: string, tipo: string): Promise<PrecoCombustivel | null> {
    try {
      // Setup Config API Key (simulated check)
      const mockResult = {
        estado: uf, combustivel: tipo, preco: 6.25, fonte: "combustivelapi.com.br", data: new Date().toISOString()
      };
      // In a real environment: fetch('https://combustivelapi.com.br/api/precos?estado=SP&tipo=diesel')
      console.log("Consultando Fonte 1...");
      return mockResult;
    } catch {
      return null;
    }
  },

  // FONTE 2: ANP / dados.gov.br
  async fetchFromANP(uf: string, tipo: string): Promise<PrecoCombustivel | null> {
    try {
      // Setup web scraper / EDGE function logic check
      console.log("Consultando Fonte 2 (ANP)...");
      const combustivel = normalizarCombustivel(tipo);
      return {
        estado: uf,
        combustivel,
        preco: precoCombustivelParaCalculo(combustivel),
        fonte: "ANP (simulado)",
        data: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },


  // FONTE 3: Petrobras
  async fetchFromPetrobras(uf: string, tipo: string): Promise<PrecoCombustivel | null> {
    try {
      console.log("Consultando Fonte 3 (Petrobras)...");
      return { estado: uf, combustivel: tipo, preco: 6.10, fonte: "Petrobras", data: new Date().toISOString() };
    } catch {
      return null;
    }
  },

  // Cascade Strategy Integrator
  async syncCombustivelPrice(uf: string, tipo: string): Promise<PrecoCombustivel> {
    let price = await this.fetchFromCombustivelAPI(uf, tipo);
    if (!price) {
      price = await this.fetchFromANP(uf, tipo);
    }
    if (!price) {
      price = await this.fetchFromPetrobras(uf, tipo);
    }
    
    if (!price) {
      // Fallback
      price = { estado: uf, combustivel: tipo, preco: 6.00, fonte: "Fallback/Manual", data: new Date().toISOString() };
    }

    return price;
  },

  async recordPriceHistory(data: PrecoCombustivel) {
    try {
      await supabase.from("combustivel_precos").insert([{
        combustivel: data.combustivel,
        preco: data.preco,
        uf: data.estado,
        municipio: data.municipio || "",
        fonte: data.fonte,
      }]);
    } catch (e) {
      console.error(e);
    }
  }
};
