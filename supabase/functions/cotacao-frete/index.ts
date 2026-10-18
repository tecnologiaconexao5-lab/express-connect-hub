import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface CotacaoParams {
  cepOrigem: string;
  cepDestino: string;
  volumes: unknown[];
  valorNota: number;
}

interface CotacaoRequestBody {
  provider: string;
  params: CotacaoParams;
}

interface FrenetItem {
  peso?: number;
  comprimento?: number;
  altura?: number;
  largura?: number;
  quantidade?: number;
}

interface FrenetServico {
  ServiceDescription?: string;
  Carrier?: string;
  Error?: boolean;
  ShippingPrice?: number;
  DeliveryTime?: number;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const FRENET_QUOTE_URL = "https://api.frenet.com.br/shipping/quote";
const DIMENSAO_PADRAO_CM = 20;
const PESO_PADRAO_KG = 1;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function cotarFrenet(params: CotacaoParams) {
  const token = Deno.env.get("FRENET_TOKEN") ?? "";
  if (!token) {
    throw new HttpError(500, "Token da Frenet não configurado no servidor");
  }

  const sellerCep = (Deno.env.get("FRENET_SELLER_CEP") ?? "00000000").replace(/\D/g, "");
  const recipientCep = (params?.cepDestino || "").replace(/\D/g, "");
  const volumes = Array.isArray(params?.volumes) ? params.volumes : [];

  const shippingItemArray = volumes.map((item) => {
    const i = item as FrenetItem;
    return {
      Weight: Number(i?.peso) > 0 ? Number(i.peso) : PESO_PADRAO_KG,
      Length: Number(i?.comprimento) > 0 ? Number(i.comprimento) : DIMENSAO_PADRAO_CM,
      Height: Number(i?.altura) > 0 ? Number(i.altura) : DIMENSAO_PADRAO_CM,
      Width: Number(i?.largura) > 0 ? Number(i.largura) : DIMENSAO_PADRAO_CM,
      Quantity: Number(i?.quantidade) > 0 ? Number(i.quantidade) : 1,
    };
  });

  if (shippingItemArray.length === 0) {
    shippingItemArray.push({
      Weight: PESO_PADRAO_KG,
      Length: DIMENSAO_PADRAO_CM,
      Height: DIMENSAO_PADRAO_CM,
      Width: DIMENSAO_PADRAO_CM,
      Quantity: 1,
    });
  }

  const payload = {
    SellerCEP: sellerCep,
    RecipientCEP: recipientCep,
    ShipmentInvoiceValue: Number(params?.valorNota) || 0,
    ShippingItemArray: shippingItemArray,
    RecipientCountry: "BR",
  };

  // FIX-CRITICO (W7): timeout 8s + 1 retry com backoff — evita travar o
  // sistema de cotação quando a Frenet demora/responde mal.
  const FETCH_TIMEOUT_MS = 8000;
  const RETRY_BACKOFF_MS = 800;

  const fetchFrenetComRetry = async (): Promise<Response> => {
    let ultimoErro: unknown;
    for (let tentativa = 0; tentativa <= 1; tentativa++) {
      try {
        return await fetch(FRENET_QUOTE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            token,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
      } catch (err) {
        ultimoErro = err;
        const motivo =
          err instanceof DOMException && err.name === "TimeoutError" ? "timeout 8s" : (err as Error)?.message || "erro de rede";
        console.warn(`[cotacao-frete] Frenet tentativa ${tentativa + 1} falhou (${motivo})`);
        if (tentativa < 1) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      }
    }
    throw ultimoErro instanceof Error
      ? new HttpError(504, `Frenet indisponível (timeout/rede): ${ultimoErro.message}`)
      : new HttpError(504, "Frenet indisponível (timeout/rede)");
  };

  const response = await fetchFrenetComRetry();

  if (!response.ok) {
    throw new HttpError(response.status, `API da Frenet retornou HTTP ${response.status}`);
  }

  const data = await response.json();

  const servicos = (data?.ShippingSevicesArray ?? []).filter(
    (servico: FrenetServico) =>
      servico && servico.Error === false && Number(servico.ShippingPrice) > 0
  );

  if (servicos.length === 0) {
    throw new HttpError(422, "Nenhum serviço válido retornado pela Frenet para esta rota");
  }

  const maisBarato = servicos.reduce((melhor: FrenetServico, atual: FrenetServico) =>
    Number(atual.ShippingPrice) < Number(melhor.ShippingPrice) ? atual : melhor
  );

  return {
    provedor: `Frenet - ${maisBarato.ServiceDescription || maisBarato.Carrier || "Serviço"}`,
    valor: Number(maisBarato.ShippingPrice),
    prazo: Number(maisBarato.DeliveryTime) || 0,
    isSimulation: false,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const body = (await req.json()) as CotacaoRequestBody;
    const provider = (body?.provider || "").toUpperCase();
    const params = body?.params;

    if (!provider || !params) {
      return new Response(JSON.stringify({ error: "provider e params são obrigatórios" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    switch (provider) {
      case "FRENET": {
        const resultado = await cotarFrenet(params);
        return new Response(JSON.stringify(resultado), { status: 200, headers: CORS_HEADERS });
      }
      // FIX-CRITICO (W8): flag explícita isSimulation — o front diferencia
      // preço real (Frenet) de estimativa simulada dos demais provedores.
      case "AZUL_CARGO": {
        return new Response(JSON.stringify({ provedor: "Azul Cargo Logistics (Simulação)", valor: 185.5, prazo: 1, isSimulation: true }), { status: 200, headers: CORS_HEADERS });
      }
      case "GOLLOG": {
        return new Response(JSON.stringify({ provedor: "Gollog (Simulação)", valor: 199.9, prazo: 2, isSimulation: true }), { status: 200, headers: CORS_HEADERS });
      }
      case "LATAM_CARGO": {
        return new Response(JSON.stringify({ provedor: "Latam Cargo (Simulação)", valor: 212.75, prazo: 1, isSimulation: true }), { status: 200, headers: CORS_HEADERS });
      }
      case "RODONAVES": {
        return new Response(JSON.stringify({ provedor: "RTE Rodonaves (Simulação)", valor: 148.3, prazo: 3, isSimulation: true }), { status: 200, headers: CORS_HEADERS });
      }
      case "JAMEF": {
        return new Response(JSON.stringify({ provedor: "Jamef Encomendas Urgentes (Simulação)", valor: 176.4, prazo: 2, isSimulation: true }), { status: 200, headers: CORS_HEADERS });
      }
      case "BRASPRESS": {
        return new Response(JSON.stringify({ provedor: "Braspress (Simulação)", valor: 163.9, prazo: 3, isSimulation: true }), { status: 200, headers: CORS_HEADERS });
      }
      case "KANGU": {
        return new Response(JSON.stringify({ provedor: "Kangu - Mercado Livre (Simulação)", valor: 158.2, prazo: 4, isSimulation: true }), { status: 200, headers: CORS_HEADERS });
      }
      default:
        return new Response(JSON.stringify({ error: `Provedor não suportado: ${provider}` }), {
          status: 400,
          headers: CORS_HEADERS,
        });
    }
  } catch (e: unknown) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), { status, headers: CORS_HEADERS });
  }
});
