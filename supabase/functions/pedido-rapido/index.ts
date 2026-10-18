// ============================================================
// Edge Function: pedido-rapido
// MISSÃO CRIACAO-PORTAL-PEDIDO-RAPIDO-WHATSAPP
// OVERHAUL-UX-PEDIDO-RAPIDO-PREMIUM — duas ações:
//   • action "criar" (default) — grava pedido em portal_pedidos
//     (status 'em_analise', fila do TMS), aceitando ATÉ 8 PARADAS
//     de entrega + retorno à origem, nível de serviço, dimensões
//     e janela de horário (novos campos no metadata).
//     REFINAMENTO-MODALIDADES — aceita modalidade
//     "coleta_entrega" | "retirada" | "aereo" (item 2):
//       - coleta_entrega: valida coleta+entrega (comportamento original)
//       - retirada: coleta vazia (carga entra na nossa base)
//       - aereo: valida remetente/destinatário completos + valor da NF;
//         coleta = remetente, entrega = destinatário (sem cidade/UF)
//     ITEM-3 — grava TAMBÉM em orcamentos (status "em_analise",
//     numero ORC-YYYYMM-XXXX, pedido_interno = numeroPedido) e
//     referencia o orçamento no alerta do setor comercial.
//   • action "estimar" — precificação em tempo real: consulta a
//     tabela de valores do cliente (ou tabela universal/padrão por
//     tipo de veículo) e devolve o valor de venda estimado com a
//     mesma fórmula do precificacaoEngine (valor_base + km
//     excedente × valor_km_excedente). Roda com service_role
//     (anon é bloqueado por RLS em tabelas_valores).
// Endpoint PUBLICO (link WhatsApp), sem auth — precedente:
// functions/cotacao-frete (CORS *, sem auth).
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const MAX_PARADAS = 8;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface PedidoRapidoColeta {
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  referencia?: string;
  /** REFINAMENTO-B2B — nome do contato a procurar no local da coleta */
  contato?: string | null;
  /** Envio aéreo — telefone do contato no endereço (remetente/destinatário) */
  telefone?: string;
}

interface PedidoRapidoEntrega extends PedidoRapidoColeta {
  destinatario?: string | null;
}

/** REFINAMENTO-MODALIDADES (item 2) — pessoa física/jurídica do Envio Aéreo */
interface PedidoRapidoPessoa {
  nome?: string;
  doc?: string;
  endereco?: string;
  telefone?: string;
}

interface EstimarBody {
  action: "estimar";
  clienteId?: string | null;
  tipoVeiculo?: string | null;
  distanciaKm?: number | null;
  paradas?: number | null;
}

interface CriarBody {
  action?: "criar";
  clienteId?: string | null;
  clienteCnpj?: string | null;
  solicitanteNome?: string | null;
  solicitanteTelefone?: string | null;
  solicitanteEmail?: string | null;
  /** REFINAMENTO-MODALIDADES (item 2) */
  modalidade?: "coleta_entrega" | "retirada" | "aereo" | null;
  coleta?: PedidoRapidoColeta;
  entrega?: PedidoRapidoEntrega;
  entregas?: PedidoRapidoEntrega[];
  retornoOrigem?: boolean | null;
  nivelServico?: "urgente" | "normal" | "agendado" | null;
  veiculoTipo?: string | null;
  /** Envio aéreo — remetente e destinatário (dados completos) */
  remetente?: PedidoRapidoPessoa | null;
  destinatario?: PedidoRapidoPessoa | null;
  /** ITEM-3 — estimativa exibida pelo front (vira valor do orçamento) */
  valorEstimado?: number | null;
  distanciaKm?: number | null;
  dimensoes?: { comprimentoCm?: number; larguraCm?: number; alturaCm?: number } | null;
  janelaHorario?: { inicio?: string; fim?: string } | null;
  descricao?: string | null;
  volumes?: number | null;
  peso?: number | null;
  valorDeclarado?: number | null;
  tipoCarga?: string | null;
  observacoes?: string | null;
  origem?: string | null;
}

type PedidoRapidoBody = (CriarBody | EstimarBody) & { action?: string };

interface TabelaRow {
  id: string;
  nome: string;
  tipo_veiculo: string;
  valor_base: number | null;
  franquia_km: number | null;
  valor_km_excedente: number | null;
  ativo: boolean;
  cliente?: string | null;
}

const soDigitos = (v?: string | null): string => (v || "").replace(/\D/g, "");
const texto = (v: unknown, max = 500): string => {
  if (v == null) return "";
  return String(v).trim().slice(0, max);
};
const numero = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function gerarNumeroPedido(supabase: ReturnType<typeof createClient>): Promise<{ numero: string; fallback: boolean }> {
  const { data, error } = await supabase.rpc("gerar_numero_pedido");
  if (!error && data) return { numero: String(data), fallback: false };
  // Fallback deterministico por timestamp (nao aleatorio) — RPC indisponivel.
  const ts = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const s =
    `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}` +
    `${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  return { numero: `PR-${s}`, fallback: true };
}

async function resolverCliente(
  supabase: ReturnType<typeof createClient>,
  body: CriarBody
): Promise<string | null> {
  const clienteId = texto(body.clienteId, 64);
  if (clienteId) return clienteId;
  const cnpj = soDigitos(body.clienteCnpj);
  if (!cnpj) return null;
  const { data } = await supabase
    .from("clientes")
    .select("id, cnpj")
    .eq("cnpj", cnpj)
    .limit(1)
    .maybeSingle();
  return (data?.id as string) || null;
}

// ------------------------------------------------------------
// PRECIFICAÇÃO EM TEMPO REAL (action "estimar")
// Hierarquia simplificada (espelha buscarTabelasService):
//   1. Tabela negociada do cliente (cliente = cliente_id) + veículo
//   2. Tabela universal/padrão (sem cliente) + veículo
// Fórmula = precificacaoEngine.calcularPrecoRapido:
//   valor = valor_base + max(0, km - franquia_km) × valor_km_excedente
// ------------------------------------------------------------
async function estimarValor(
  supabase: ReturnType<typeof createClient>,
  body: EstimarBody
) {
  const tipoVeiculo = texto(body.tipoVeiculo, 40).toLowerCase();
  const clienteId = texto(body.clienteId, 64);
  const distanciaKm = Math.max(0, numero(body.distanciaKm));
  const paradas = Math.max(1, Math.round(numero(body.paradas) || 1));

  if (!tipoVeiculo) throw new HttpError(400, "Informe o tipo de veiculo");
  if (distanciaKm <= 0) throw new HttpError(400, "Distancia invalida para estimativa");

  const cols = "id, nome, tipo_veiculo, valor_base, franquia_km, valor_km_excedente, ativo, cliente";
  let tabela: TabelaRow | null = null;
  let fonte = "sem_tabela";

  // Nível 1: tabela negociada do cliente
  if (clienteId) {
    const { data } = await supabase
      .from("tabelas_valores")
      .select(cols)
      .eq("ativo", true)
      .eq("cliente", clienteId)
      .ilike("tipo_veiculo", tipoVeiculo)
      .order("prioridade", { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as { data: TabelaRow | null };
    if (data) {
      tabela = data;
      fonte = "tabela_cliente";
    }
  }

  // Nível 2: tabela universal/padrão por tipo de veículo (flag universal, espelha buscarTabelasService nível 5/6)
  if (!tabela) {
    const { data } = await supabase
      .from("tabelas_valores")
      .select(cols)
      .eq("ativo", true)
      .eq("universal", true)
      .ilike("tipo_veiculo", tipoVeiculo)
      .order("prioridade", { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as { data: TabelaRow | null };
    if (data) {
      tabela = data;
      fonte = "tabela_padrao";
    }
  }

  if (!tabela) {
    return {
      success: true,
      valor: null,
      moeda: "BRL",
      distanciaKm,
      paradas,
      fonte: "sem_tabela" as const,
      tabela: null,
      mensagem: "Sem tabela de valores para este tipo de veiculo — nosso time fara a melhor proposta.",
    };
  }

  const franquia = Number(tabela.franquia_km || 0);
  const kmExcedente = Math.max(0, distanciaKm - franquia);
  const valorKmExc = Number(tabela.valor_km_excedente || 0);
  const valorBase = Number(tabela.valor_base || 0);
  // Paradas adicionais (rota multimaradas) — acréscimo estimado de 10% por parada extra
  const paradasExtras = Math.max(0, paradas - 1);
  const valorParadas = valorBase > 0 ? valorBase * 0.1 * paradasExtras : 0;
  const valor = Math.round((valorBase + kmExcedente * valorKmExc + valorParadas) * 100) / 100;

  return {
    success: true,
    valor,
    moeda: "BRL",
    distanciaKm: Math.round(distanciaKm * 10) / 10,
    paradas,
    fonte,
    tabela: { id: tabela.id, nome: tabela.nome },
    formula: {
      valorBase,
      franquiaKm: franquia,
      kmExcedente: Math.round(kmExcedente * 10) / 10,
      valorKmExcedente: valorKmExc,
      acrescimoParadasExtras: Math.round(valorParadas * 100) / 100,
    },
    aviso: "Valor estimado — sujeito a confirmação operacional (distância, pedágio e disponibilidade).",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo nao permitido" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new HttpError(500, "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nao configuradas");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = (await req.json()) as PedidoRapidoBody;
    if (!body || typeof body !== "object") throw new HttpError(400, "Payload invalido");

    // ---------- ACTION: ESTIMAR (precificação em tempo real) ----------
    if (texto(body.action, 20) === "estimar") {
      const resultado = await estimarValor(supabase, body as EstimarBody);
      return new Response(JSON.stringify(resultado), { status: 200, headers: CORS_HEADERS });
    }

    // ---------- ACTION: CRIAR (default) ----------
    const criar = body as CriarBody;
    const coleta = criar.coleta || {};
    const entregas: PedidoRapidoEntrega[] = Array.isArray(criar.entregas) && criar.entregas.length > 0
      ? criar.entregas.slice(0, MAX_PARADAS)
      : criar.entrega
        ? [criar.entrega]
        : [];
    const entrega = entregas[0] || {};

    const coletaCidade = texto(coleta.cidade, 120);
    const coletaUf = texto(coleta.uf, 2).toUpperCase();
    const entregaCidade = texto(entrega.cidade, 120);
    const entregaUf = texto(entrega.uf, 2).toUpperCase();
    const volumes = Math.max(1, Math.round(numero(criar.volumes) || 1));
    const peso = Math.max(0, numero(criar.peso));

    // REFINAMENTO-MODALIDADES (item 2) — valida conforme a aba escolhida
    const modalidadeBruta = texto(criar.modalidade, 20);
    const modalidade: "coleta_entrega" | "retirada" | "aereo" =
      modalidadeBruta === "retirada" || modalidadeBruta === "aereo" ? modalidadeBruta : "coleta_entrega";

    const dim = criar.dimensoes || {};
    const dimensoes = {
      comprimentoCm: Math.max(0, numero(dim.comprimentoCm)),
      larguraCm: Math.max(0, numero(dim.larguraCm)),
      alturaCm: Math.max(0, numero(dim.alturaCm)),
    };

    if (modalidade === "coleta_entrega" && (!coletaCidade || coletaUf.length !== 2)) {
      throw new HttpError(400, "Coleta: cidade e UF sao obrigatorias");
    }
    if (modalidade === "aereo") {
      const validarPessoa = (rotulo: string, p: PedidoRapidoPessoa | null | undefined) => {
        if (!texto(p?.nome, 120)) throw new HttpError(400, `Envio aereo: informe o nome do ${rotulo}`);
        if (!texto(p?.doc, 20)) throw new HttpError(400, `Envio aereo: informe o CPF/CNPJ do ${rotulo}`);
        if (!texto(p?.endereco, 300)) throw new HttpError(400, `Envio aereo: informe o endereco do ${rotulo}`);
        if (!texto(p?.telefone, 40)) throw new HttpError(400, `Envio aereo: informe o telefone do ${rotulo}`);
      };
      validarPessoa("remetente", criar.remetente);
      validarPessoa("destinatario", criar.destinatario);
      if (peso <= 0) throw new HttpError(400, "Envio aereo: informe o peso total em kg");
      if (dimensoes.comprimentoCm <= 0 || dimensoes.larguraCm <= 0 || dimensoes.alturaCm <= 0) {
        throw new HttpError(400, "Envio aereo: informe as dimensoes (C x L x A em cm)");
      }
      if (Math.max(0, numero(criar.valorDeclarado)) <= 0) {
        throw new HttpError(400, "Envio aereo: informe o valor da NF");
      }
    }
    if (entregas.length === 0) {
      throw new HttpError(400, "Entrega: informe ao menos um destino e obrigatorio");
    }
    if (modalidade !== "aereo" && (!entregaCidade || entregaUf.length !== 2)) {
      throw new HttpError(400, "Entrega: ao menos um destino com cidade e UF e obrigatorio");
    }
    if (entregas.length > MAX_PARADAS) {
      throw new HttpError(400, `Limite de ${MAX_PARADAS} paradas de entrega. Para rotas complexas, contate o time operacional.`);
    }
    if (!texto(criar.solicitanteNome, 120)) {
      throw new HttpError(400, "Informe o nome do solicitante");
    }

    const nivelServico = texto(criar.nivelServico, 20);
    const veiculoTipo = texto(criar.veiculoTipo, 40);
    const janelaInicio = texto(criar.janelaHorario?.inicio, 5);
    const janelaFim = texto(criar.janelaHorario?.fim, 5);

    const clienteId = await resolverCliente(supabase, criar);
    const { numero: numeroPedido, fallback } = await gerarNumeroPedido(supabase);

    const origem = texto(criar.origem, 60) || "pedido_rapido_whatsapp";
    const userAgent = req.headers.get("user-agent") || "";
    const retornoOrigem = Boolean(criar.retornoOrigem);
    const prioridadePedido = nivelServico === "urgente" ? "alta" : "normal";

    const row = {
      cliente_id: clienteId,
      numero_pedido: numeroPedido,
      status: "em_analise",
      prioridade: prioridadePedido,
      solicitante_nome: texto(criar.solicitanteNome, 120),
      solicitante_telefone: texto(criar.solicitanteTelefone, 40),
      solicitante_email: texto(criar.solicitanteEmail, 160),
      coleta_cep: soDigitos(coleta.cep) || null,
      coleta_rua: texto(coleta.rua, 200),
      coleta_numero: texto(coleta.numero, 40),
      coleta_complemento: texto(coleta.complemento, 120),
      coleta_bairro: texto(coleta.bairro, 120),
      coleta_cidade: coletaCidade,
      coleta_uf: coletaUf,
      coleta_referencia: texto(coleta.referencia, 200),
      entrega_destinatario: texto(entrega.destinatario, 120),
      entrega_telefone: texto(entrega.telefone, 40),
      entrega_cep: soDigitos(entrega.cep) || null,
      entrega_rua: texto(entrega.rua, 200),
      entrega_numero: texto(entrega.numero, 40),
      entrega_complemento: texto(entrega.complemento, 120),
      entrega_bairro: texto(entrega.bairro, 120),
      entrega_cidade: entregaCidade,
      entrega_uf: entregaUf,
      entrega_referencia: texto(entrega.referencia, 200),
      descricao: texto(criar.descricao, 500),
      volumes,
      peso,
      valor_declarado: Math.max(0, numero(criar.valorDeclarado)),
      tipo_carga: texto(criar.tipoCarga, 40),
      observacoes: texto(criar.observacoes, 500),
      payload_n8n: {
        setor: "portal_cliente",
        evento: "novo_pedido_rapido",
        origem,
      },
      metadata: {
        origem,
        canal: "whatsapp",
        cliente_cnpj: texto(criar.clienteCnpj, 20),
        user_agent: userAgent.slice(0, 300),
        numero_fallback: fallback,
        criado_em: new Date().toISOString(),
        // REFINAMENTO-MODALIDADES (item 2)
        modalidade,
        remetente: modalidade === "aereo"
          ? {
              nome: texto(criar.remetente?.nome, 120),
              doc: texto(criar.remetente?.doc, 20),
              endereco: texto(criar.remetente?.endereco, 300),
              telefone: texto(criar.remetente?.telefone, 40),
            }
          : null,
        destinatario_aereo: modalidade === "aereo"
          ? {
              nome: texto(criar.destinatario?.nome, 120),
              doc: texto(criar.destinatario?.doc, 20),
              endereco: texto(criar.destinatario?.endereco, 300),
              telefone: texto(criar.destinatario?.telefone, 40),
            }
          : null,
        // ITEM-3 — estimativa exibida no front (base do orçamento)
        valor_estimado: Math.max(0, numero(criar.valorEstimado)) || null,
        distancia_km: Math.max(0, numero(criar.distanciaKm)) || null,
        // OVERHAUL-PREMIUM — roteirização multimaradas + novos campos
        total_paradas: entregas.length,
        retorno_origem: retornoOrigem,
        nivel_servico: nivelServico || "normal",
        veiculo_tipo: veiculoTipo || null,
        dimensoes_cm: dimensoes,
        janela_horario: { inicio: janelaInicio || null, fim: janelaFim || null },
        // REFINAMENTO-B2B — contato a procurar no local da coleta
        coleta_contato: texto(coleta.contato, 120) || null,
        entregas: entregas.map((e, i) => ({
          ordem: i + 1,
          destinatario: texto(e.destinatario, 120) || null,
          cep: soDigitos(e.cep) || null,
          rua: texto(e.rua, 200),
          numero: texto(e.numero, 40),
          complemento: texto(e.complemento, 120),
          bairro: texto(e.bairro, 120),
          cidade: texto(e.cidade, 120),
          uf: texto(e.uf, 2).toUpperCase(),
          referencia: texto(e.referencia, 200),
        })),
      },
    };

    const { data: pedido, error } = await supabase
      .from("portal_pedidos")
      .insert([row])
      .select("id, numero_pedido, status")
      .single();
    if (error || !pedido) {
      console.error("[pedido-rapido] insert error:", error?.message, error?.details);
      throw new HttpError(502, `Falha ao gravar pedido: ${error?.message || "sem retorno"}`);
    }

    // Resumo da rota conforme a modalidade (item 2)
    const rotaResumo =
      modalidade === "aereo"
        ? `Aéreo: ${texto(criar.remetente?.nome, 80) || "Remetente"} → ${texto(criar.destinatario?.nome, 80) || "Destinatário"}`
        : modalidade === "retirada"
          ? entregas.length === 1
            ? `Retirada na base → ${entregaCidade}/${entregaUf}`
            : `Retirada na base → ${entregas.length} destinos${retornoOrigem ? " + retorno à origem" : ""}`
          : entregas.length === 1
            ? `${coletaCidade}/${coletaUf} → ${entregaCidade}/${entregaUf}`
            : `${coletaCidade}/${coletaUf} → ${entregas.length} destinos${retornoOrigem ? " + retorno à origem" : ""}`;

    // ------------------------------------------------------------
    // ITEM-3 — INSERT ADITIVO EM ORÇAMENTOS (status "em_analise")
    // O pedido CONTINUA indo para portal_pedidos (fila "Em Análise"
    // do TMS — fluxo inalterado) e PASSA A GERAR também um
    // orçamento comercial (numero ORC-YYYYMM-XXXX,
    // pedido_interno = numeroPedido para rastreio).
    // Aditivo de propósito: não substitui portal_pedidos para não
    // quebrar a fila existente. Falha aqui NÃO derruba o pedido.
    // ------------------------------------------------------------
    let orcamentoNumero: string | null = null;
    let orcamentoId: string | null = null;
    try {
      const hoje = new Date();
      const pad2 = (n: number) => String(n).padStart(2, "0");
      const seqOrc = String(Math.floor(1000 + Math.random() * 9000));
      const numeroOrcamento = `ORC-${hoje.getFullYear()}${pad2(hoje.getMonth() + 1)}-${seqOrc}`;

      // orcamentos.cliente é TEXT legado com o NOME do cliente
      let clienteNome = "";
      if (clienteId) {
        const { data: cli } = await supabase
          .from("clientes")
          .select("nome_fantasia, razao_social")
          .eq("id", clienteId)
          .maybeSingle();
        clienteNome = texto(cli?.nome_fantasia, 120) || texto(cli?.razao_social, 120);
      }

      const enderecosOrcamento = [
        ...(modalidade !== "retirada" && (coleta.rua || coletaCidade)
          ? [{
              tipo: "coleta",
              cep: soDigitos(coleta.cep) || null,
              logradouro: texto(coleta.rua, 200),
              numero: texto(coleta.numero, 40),
              complemento: texto(coleta.complemento, 120),
              bairro: texto(coleta.bairro, 120),
              cidade: coletaCidade,
              estado: coletaUf,
              uf: coletaUf,
              referencia: texto(coleta.referencia, 200),
            }]
          : []),
        ...entregas.map((e, i) => ({
          tipo: "entrega",
          ordem: i + 1,
          destinatario: texto(e.destinatario, 120) || null,
          cep: soDigitos(e.cep) || null,
          logradouro: texto(e.rua, 200),
          numero: texto(e.numero, 40),
          complemento: texto(e.complemento, 120),
          bairro: texto(e.bairro, 120),
          cidade: texto(e.cidade, 120),
          estado: texto(e.uf, 2).toUpperCase(),
          uf: texto(e.uf, 2).toUpperCase(),
          referencia: texto(e.referencia, 200),
        })),
      ];

      const valorEstimado = Math.max(0, numero(criar.valorEstimado)) || null;
      const distanciaKm = Math.max(0, numero(criar.distanciaKm)) || null;
      const tipoCargaOrc = texto(criar.tipoCarga, 40);

      const { data: orcamento, error: orcError } = await supabase
        .from("orcamentos")
        .insert([
          {
            numero: numeroOrcamento,
            cliente_id: clienteId,
            cliente: clienteNome || texto(criar.solicitanteNome, 120) || "Não identificado",
            cliente_cnpj: texto(criar.clienteCnpj, 20),
            status: "em_analise",
            modalidade: "esporadico",
            prioridade: prioridadePedido,
            descricao: texto(criar.descricao, 500) || "Pedido Rápido",
            observacoes_gerais:
              `${rotaResumo}${texto(criar.observacoes, 400) ? ` · ${texto(criar.observacoes, 400)}` : ""}`,
            valor_base: valorEstimado,
            valor_final: valorEstimado,
            distancia_rota: distanciaKm
              ? { distancia_km: distanciaKm, distancia_texto: `${distanciaKm} km`, maps_provider: "mapbox" }
              : null,
            data_emissao: hoje.toISOString().slice(0, 10),
            pedido_interno: numeroPedido,
            veiculo_tipo: veiculoTipo || null,
            carga_descricao: texto(criar.descricao, 500),
            carga_peso: peso,
            carga_volumes: volumes,
            carga_valor_declarado: Math.max(0, numero(criar.valorDeclarado)) || null,
            carga_tipo: tipoCargaOrc || null,
            carga_fragil: tipoCargaOrc === "fragil",
            carga_refrigerado: tipoCargaOrc === "refrigerado",
            enderecos: enderecosOrcamento,
            historico: [
              {
                data: hoje.toLocaleString("pt-BR"),
                acao: `Criado via Pedido Rápido (${numeroPedido})`,
                usuario: "Sistema",
              },
            ],
          },
        ])
        .select("id, numero")
        .single();
      if (orcError) throw orcError;
      orcamentoNumero = (orcamento?.numero as string) || numeroOrcamento;
      orcamentoId = (orcamento?.id as string) || null;
    } catch (eOrc) {
      // A fila do TMS (portal_pedidos) já foi gravada — não falha o pedido.
      console.error("[pedido-rapido] orcamentos insert error:", eOrc instanceof Error ? eOrc.message : eOrc);
    }

    // Alerta a base operacional (fila "Em Analise" do TMS + notificacao portal)
    const { error: notifError } = await supabase.from("portal_notificacoes").insert([
      {
        cliente_id: clienteId,
        tipo: "pedido",
        titulo: "Novo pedido via Portal Rapido (WhatsApp)",
        mensagem:
          `Pedido ${numeroPedido} aberto via link rapido — ` +
          `${rotaResumo} · ${volumes} vol · ${peso} kg` +
          `${nivelServico ? ` · nível ${nivelServico}` : ""}` +
          `${texto(criar.solicitanteTelefone, 40) ? ` · contato ${texto(criar.solicitanteTelefone, 40)}` : ""}`,
        canal: "portal",
        prioridade: "alta",
        metadata: { pedido_id: pedido.id, origem },
      },
    ]);
    if (notifError) {
      // Nao falha o pedido por causa da notificacao — loga e segue.
      console.error("[pedido-rapido] notificacao error:", notifError.message);
    }

    // REFINAMENTO-B2B — ALERTA AO SETOR COMERCIAL (WhatsApp).
    // Insere uma notificação DEDICADA em portal_notificacoes com a flag
    // metadata.webhook_disparo = true e metadata.setor = "comercial".
    // Qualquer ouvinte externo (n8n / webhook) que filtre esta flag pode
    // disparar imediatamente uma mensagem de WhatsApp para o time comercial
    // tratar o lead (pedido aberto por link público sem cliente identificado
    // é lead quente de precificação).
    try {
      await supabase.from("portal_notificacoes").insert([
        {
          cliente_id: clienteId,
          tipo: "comercial",
          titulo: "🔔 Pedido Rápido — Responder cliente (proposta comercial)",
          mensagem:
            `NOVO PEDIDO ${numeroPedido} aguardando proposta comercial. ` +
            (orcamentoNumero ? `Orçamento ${orcamentoNumero} (em análise). ` : "") +
            `${rotaResumo} · ${volumes} vol · ${peso} kg` +
            `${veiculoTipo ? ` · veículo ${veiculoTipo}` : ""}` +
            `${texto(criar.solicitanteTelefone, 40) ? ` · WhatsApp ${texto(criar.solicitanteTelefone, 40)}` : ""}` +
            `${texto(coleta.contato, 120) ? ` · procurar por ${texto(coleta.contato, 120)}` : ""}`,
          canal: "whatsapp",
          prioridade: "urgente",
          metadata: {
            setor: "comercial",
            webhook_disparo: true, // ← flag para ouvinte externo (n8n) disparar WhatsApp
            pedido_id: pedido.id,
            numero_pedido: numeroPedido,
            // ITEM-3 — referência do orçamento criado aditivamente
            orcamento_numero: orcamentoNumero,
            orcamento_id: orcamentoId,
            contato_solicitante: texto(criar.solicitanteTelefone, 40) || null,
            origem,
          },
        },
      ]);
    } catch (eComercial) {
      // Nao falha o pedido — apenas loga (mesmo tratamento da notificacao operacional).
      console.error("[pedido-rapido] notificacao comercial error:", eComercial instanceof Error ? eComercial.message : eComercial);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pedidoId: pedido.id,
        numeroPedido: pedido.numero_pedido,
        status: pedido.status,
        clienteIdentificado: Boolean(clienteId),
        totalParadas: entregas.length,
        retornoOrigem,
        modalidade,
        // ITEM-3 — orçamento gerado aditivamente (null se o insert falhou)
        orcamentoNumero,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Erro inesperado";
    if (!(e instanceof HttpError)) console.error("[pedido-rapido] fatal:", e);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: CORS_HEADERS,
    });
  }
});
