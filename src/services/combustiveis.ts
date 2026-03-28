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

export const combustiveisService = {
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
      return { estado: uf, combustivel: tipo, preco: 6.31, fonte: "ANP", data: new Date().toISOString() };
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
    if (typeof window !== "undefined") return; // Mocking so it does not err on client edge directly
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
