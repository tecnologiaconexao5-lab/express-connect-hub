import { normalizarStatusParaBanco, normalizarStatusParaUI, isStatusCancelado } from "@/components/operacao/escalaStatus";

const STORAGE_KEY = "conexao_escala_operacional";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAMPO_CAMEL_PARA_BANCO: Record<string, string> = {
  prestadorId: "prestador_id",
  clienteId: "cliente_id",
  data: "data_escala",
  status: "status",
  turno: "turno",
  horarioInicio: "horario_saida",
  horarioFim: "horario_retorno_previsto",
  statusPagamento: "status_pagamento",
};

const CAMPOS_UI_REMOVIDOS = new Set([
  "prestadorNome", "clienteNome", "tipo", "totals",
  "kmInicial", "kmFinal",
  "tempoChegadaPatio", "tempoInicioCarregamento", "tempoFimCarregamento",
  "tempoSaidaRua", "tempoFinalizacaoEntregas",
  "prestadorVeiculo", "financeiro", "checklist",
  "os", "id",
]);

function isCamelCase(obj: Record<string, any>): boolean {
  if (!obj || typeof obj !== "object") return false;
  const camelKeys = ["prestadorId", "prestadorNome", "clienteId", "clienteNome", "horarioInicio", "horarioFim"];
  return camelKeys.some((k) => k in obj);
}

function isSnakeCase(obj: Record<string, any>): boolean {
  if (!obj || typeof obj !== "object") return false;
  const snakeKeys = ["prestador_id", "data_escala", "tipo_veiculo", "ordem_servico_id"];
  return snakeKeys.some((k) => k in obj);
}

export function normalizarNumeroFinanceiro(valor: any, padrao = 0): number {
  if (valor === null || valor === undefined) return padrao;
  if (typeof valor === "number") return Number.isNaN(valor) ? padrao : valor;
  if (typeof valor === "string") {
    const parsed = parseFloat(valor.replace(",", "."));
    return Number.isNaN(parsed) ? padrao : parsed;
  }
  return padrao;
}

export function normalizarFinanceiroAlocacao(aloc: Record<string, any>): Record<string, any> {
  const r = { ...aloc };
  const nf = normalizarNumeroFinanceiro;

  if (r.financeiro && typeof r.financeiro === "object") {
    const f = r.financeiro;
    r.financeiro = {
      valorTipo: f.valorTipo || "fixo",
      valorPercentual: nf(f.valorPercentual),
      valorFixo: nf(f.valorFixo),
      combustivel: nf(f.combustivel),
      kmRodados: nf(f.kmRodados),
      valorKm: nf(f.valorKm),
      pedagio: nf(f.pedagio),
      pedagioFranquia: nf(f.pedagioFranquia),
      pedagioExcedente: nf(f.pedagioExcedente),
      pedagioCobrarExcedente: !!f.pedagioCobrarExcedente,
      diariasAdicionais: nf(f.diariasAdicionais),
      valorDiaria: nf(f.valorDiaria),
      segundaSaida: !!f.segundaSaida,
      valorSegundaSaida: nf(f.valorSegundaSaida),
      terceiraSaida: !!f.terceiraSaida,
      valorTerceiraSaida: nf(f.valorTerceiraSaida),
      saidasAdicionais: nf(f.saidasAdicionais),
      valorSaidaAdicional: nf(f.valorSaidaAdicional),
      ajudantes: nf(f.ajudantes),
      valorAjudante: nf(f.valorAjudante),
      desconto: nf(f.desconto),
      reembolsosOutros: f.reembolsosOutros || "",
      valorReembolsoOutros: nf(f.valorReembolsoOutros),
    };
  }

  if (!r.totals || typeof r.totals !== "object") {
    r.totals = { valorBase: 0, totalAdicionais: 0, totalDescontos: 0, total: 0 };
  } else {
    r.totals = {
      valorBase: nf(r.totals.valorBase),
      totalAdicionais: nf(r.totals.totalAdicionais),
      totalDescontos: nf(r.totals.totalDescontos),
      total: nf(r.totals.total),
    };
  }

  r.quantidadeEntregas = nf(r.quantidadeEntregas);
  r.kmInicial = nf(r.kmInicial);
  r.kmFinal = nf(r.kmFinal);
  r.kmRodados = nf(r.kmRodados);

  if (isStatusCancelado(aloc.status)) {
    r.statusPagamento = "cancelado";
  } else if (!r.statusPagamento) {
    r.statusPagamento = "pendente";
  }

  return r;
}

export function detectarFormato(obj: Record<string, any>): "camel" | "snake" | "desconhecido" {
  if (isCamelCase(obj)) return "camel";
  if (isSnakeCase(obj)) return "snake";
  return "desconhecido";
}

export function mapearLocalParaBanco(local: Record<string, any>): Record<string, any> {
  const normalizado = normalizarFinanceiroAlocacao(local);
  const banco: Record<string, any> = {};

  for (const [key, value] of Object.entries(normalizado)) {
    if (CAMPOS_UI_REMOVIDOS.has(key)) continue;
    if (CAMPO_CAMEL_PARA_BANCO[key]) {
      banco[ CAMPO_CAMEL_PARA_BANCO[key] ] = value;
    } else {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      banco[snakeKey] = value;
    }
  }

  if (normalizado.id !== undefined) {
    const idStr = String(normalizado.id);
    const isUuid = UUID_RE.test(idStr);
    if (isUuid) {
      banco.id = idStr;
    } else {
      delete banco.id;
    }
  }

  if (normalizado.os !== undefined) {
    if (UUID_RE.test(String(normalizado.os))) {
      banco.ordem_servico_id = String(normalizado.os);
    } else {
      console.warn("[EscalaMapper] Campo 'os' não é UUID válido, não será salvo em ordem_servico_id:", normalizado.os);
    }
  }

  if (normalizado.prestadorId !== undefined) {
    const val = String(normalizado.prestadorId);
    if (!val) {
      delete banco.prestador_id;
    } else if (!UUID_RE.test(val)) {
      console.error("[UUID_INVALIDO] prestador_id:", normalizado.prestadorId);
      delete banco.prestador_id;
    }
  }
  if (normalizado.clienteId !== undefined) {
    const clienteVal = String(normalizado.clienteId);
    if (!clienteVal) {
      delete banco.cliente_id;
    } else if (!UUID_RE.test(clienteVal)) {
      console.error("[UUID_INVALIDO] cliente_id:", normalizado.clienteId);
      delete banco.cliente_id;
    }
  }

  if (normalizado.data !== undefined) {
    const d = normalizado.data;
    if (d instanceof Date) {
      banco.data_escala = d.toISOString().split("T")[0];
    } else if (typeof d === "string") {
      banco.data_escala = d.split("T")[0];
    }
  }

  if (normalizado.horarioInicio !== undefined) banco.horario_saida = normalizado.horarioInicio;
  if (normalizado.horarioFim !== undefined) banco.horario_retorno_previsto = normalizado.horarioFim;

  if (normalizado.status !== undefined) {
    banco.status = normalizarStatusParaBanco(normalizado.status);
  }

  if (normalizado.prestadorVeiculo && typeof normalizado.prestadorVeiculo === "object") {
    banco.tipo_veiculo = normalizado.prestadorVeiculo.tipo_veiculo || banco.tipo_veiculo || "vuc";
    banco.placa = normalizado.prestadorVeiculo.placa || banco.placa || "";
  }

  if (!banco.tipo_veiculo) banco.tipo_veiculo = "vuc";

  const nf = normalizarNumeroFinanceiro;
  if (normalizado.financeiro && typeof normalizado.financeiro === "object") {
    const fin = normalizado.financeiro;
    banco.valor_tipo = fin.valorTipo;
    banco.valor_percentual = nf(fin.valorPercentual);
    banco.valor_fixo = nf(fin.valorFixo);
    // valorCliente fica na raiz do objeto local (não dentro de financeiro)
    banco.valor_frete = nf(normalizado.valorCliente ?? fin.valorCliente ?? 0);
    banco.valor_repasse = nf(fin.valorFixo);
    banco.combustivel_valor = nf(fin.combustivel);
    banco.km_rodados = nf(fin.kmRodados);
    banco.km_previstos = nf(fin.kmRodados);
    banco.valor_km = nf(fin.valorKm);
    banco.valor_pedagio = nf(fin.pedagio);
    banco.pedagio_franquia = nf(fin.pedagioFranquia);
    banco.pedagio_excedente = nf(fin.pedagioExcedente);
    banco.pedagio_cobrar_excedente = !!fin.pedagioCobrarExcedente;
    banco.diarias_adicionais = nf(fin.diariasAdicionais);
    banco.valor_diaria = nf(fin.valorDiaria);
    banco.segunda_saida = !!fin.segundaSaida;
    banco.valor_segunda_saida = nf(fin.valorSegundaSaida);
    banco.terceira_saida = !!fin.terceiraSaida;
    banco.valor_terceira_saida = nf(fin.valorTerceiraSaida);
    banco.saidas_adicionais = nf(fin.saidasAdicionais);
    banco.valor_saida_adicional = nf(fin.valorSaidaAdicional);
    banco.ajudantes = nf(fin.ajudantes);
    banco.valor_ajudante_unit = nf(fin.valorAjudante);
    banco.valor_ajudante = nf(fin.valorAjudante);
    banco.valor_desconto = nf(fin.desconto);
    banco.reembolsos_outros = fin.reembolsosOutros || "";
    banco.valor_reembolso_outros = nf(fin.valorReembolsoOutros);
  }

  if (normalizado.statusPagamento !== undefined) {
    banco.status_pagamento = normalizado.statusPagamento;
  }

  return banco;
}

export function mapearBancoParaLocal(banco: Record<string, any>): Record<string, any> {
  const local: Record<string, any> = {};

  const financeiro: Record<string, any> = {};

  // NOVO: Extrair nomes de JOINs (quando viêm de listarAlocacoes com JOINs)
  if (banco.prestadores && typeof banco.prestadores === 'object' && banco.prestadores.nome_completo) {
    local.prestadorNome = banco.prestadores.nome_completo;
  }
  if (banco.clientes && typeof banco.clientes === 'object') {
    local.clienteNome = banco.clientes.nome_fantasia || banco.clientes.razao_social || 'NÃO INFORMADO';
  }
  if (banco.ordens_servico && typeof banco.ordens_servico === 'object' && banco.ordens_servico.numero) {
    local.osNumero = banco.ordens_servico.numero;
  }

  for (const [key, value] of Object.entries(banco)) {
    // Ignorar objetos aninhados de JOINs
    if (key === 'prestadores' || key === 'clientes' || key === 'ordens_servico') {
      continue;
    }

    const snakeKey = key;
    let camelKey = snakeKey.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

    if (snakeKey === "ordem_servico_id") camelKey = "os";
    if (snakeKey === "data_escala") {
      camelKey = "data";
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        local["data"] = value + "T12:00:00";
        continue;
      }
    }
    if (snakeKey === "horario_saida") camelKey = "horarioInicio";
    if (snakeKey === "horario_retorno_previsto") camelKey = "horarioFim";
    if (snakeKey === "status_pagamento") camelKey = "statusPagamento";
    if (snakeKey === "prestador_id") camelKey = "prestadorId";
    if (snakeKey === "cliente_id") camelKey = "clienteId";
    if (snakeKey === "empresa_id") camelKey = "empresaId";

    if (CAMPOS_UI_REMOVIDOS.has(camelKey)) continue;

    if (snakeKey === "tipo_veiculo" || snakeKey === "placa") {
      continue;
    }

    const camposFinanceiros = new Set([
      "valor_tipo", "valor_percentual", "valor_fixo", "valor_frete", "valor_repasse",
      "combustivel_valor", "km_rodados", "km_previstos", "valor_km", "valor_pedagio", "pedagio_franquia",
      "pedagio_excedente", "pedagio_cobrar_excedente", "diarias_adicionais",
      "valor_diaria", "segunda_saida", "valor_segunda_saida", "terceira_saida",
      "valor_terceira_saida", "saidas_adicionais", "valor_saida_adicional",
      "ajudantes", "valor_ajudante_unit", "reembolsos_outros",
      "valor_reembolso_outros", "valor_desconto", "valor_ajudante",
    ]);

    if (camposFinanceiros.has(snakeKey)) {
      const finCamel = snakeKey.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
      const finMap: Record<string, string> = {
        valorTipo: "valorTipo",
        valorPercentual: "valorPercentual",
        valorFixo: "valorFixo",
        valorFrete: "valorCliente",
        valorRepasse: "valorFixo",
        combustivelValor: "combustivel",
        kmRodados: "kmRodados",
        kmPrevistos: "kmRodados",
        valorKm: "valorKm",
        valorPedagio: "pedagio",
        pedagioFranquia: "pedagioFranquia",
        pedagioExcedente: "pedagioExcedente",
        pedagioCobrarExcedente: "pedagioCobrarExcedente",
        diariasAdicionais: "diariasAdicionais",
        valorDiaria: "valorDiaria",
        segundaSaida: "segundaSaida",
        valorSegundaSaida: "valorSegundaSaida",
        terceiraSaida: "terceiraSaida",
        valorTerceiraSaida: "valorTerceiraSaida",
        saidasAdicionais: "saidasAdicionais",
        valorSaidaAdicional: "valorSaidaAdicional",
        ajudantes: "ajudantes",
        valorAjudanteUnit: "valorAjudante",
        reembolsosOutros: "reembolsosOutros",
        valorReembolsoOutros: "valorReembolsoOutros",
        valorDesconto: "desconto",
        valorAjudante: "valorAjudante",
      };
      const targetKey = finMap[finCamel] || finCamel;
      financeiro[targetKey] = value;
      continue;
    }

    local[camelKey] = value;
  }

  if (Object.keys(financeiro).length > 0) {
    financeiro.valorTipo = financeiro.valorTipo || "fixo";
    if (financeiro.combustivel === undefined) financeiro.combustivel = financeiro.combustivelValor ?? 0;
    delete financeiro.combustivelValor;
    if (financeiro.valorAjudante === undefined) financeiro.valorAjudante = financeiro.valorAjudanteUnit ?? 0;
    delete financeiro.valorAjudanteUnit;
    local.financeiro = financeiro;

    // Reconstruir totals a partir dos campos financeiros do banco
    // valor_total é generated column no banco = valor_repasse + pedagio + combustivel + ajudante + adicional - desconto
    // Aqui usamos os campos disponíveis para montar o mesmo cálculo no frontend
    const nfLocal = normalizarNumeroFinanceiro;
    const valorBase = nfLocal(financeiro.valorFixo);            // repasse ao prestador
    const pedagio = nfLocal(financeiro.pedagio);
    const combustivel = nfLocal(financeiro.combustivel);
    const ajudanteTotal = nfLocal(financeiro.valorAjudante) * Math.max(nfLocal(financeiro.ajudantes), 1 * (nfLocal(financeiro.valorAjudante) > 0 ? 1 : 0));
    const adicionais = pedagio + combustivel;
    const descontos = nfLocal(financeiro.desconto);
    const totalCalculado = valorBase + adicionais - descontos;
    local.totals = {
      valorBase,
      totalAdicionais: adicionais,
      totalDescontos: descontos,
      total: totalCalculado,
    };
    // valorCliente (valor cobrado do cliente) fica na raiz do objeto local
    if (banco.valor_frete !== undefined && nfLocal(banco.valor_frete) > 0) {
      local.valorCliente = nfLocal(banco.valor_frete);
    }
  }

  if (banco.tipo_veiculo || banco.placa) {
    local.prestadorVeiculo = {
      tipo_veiculo: banco.tipo_veiculo || "vuc",
      placa: banco.placa || "",
      refrigerado: banco.refrigerado || false,
    };
  }

  if (local.data === undefined && banco.data_escala) {
    const raw = banco.data_escala;
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      local.data = raw + "T12:00:00";
    } else {
      local.data = raw;
    }
  }

  if (local.status !== undefined) {
    local.status = normalizarStatusParaUI(local.status);
  }

  if (!local.id && banco.id) local.id = String(banco.id);

  return normalizarFinanceiroAlocacao(local);
}

export function regularizarItem(item: Record<string, any>): Record<string, any> {
  if (!item || typeof item !== "object") return item;
  const formato = detectarFormato(item);
  if (formato === "camel") return item;
  if (formato === "snake") return mapearBancoParaLocal(item);

  const tentativaSnake = mapearBancoParaLocal(item);
  if (tentativaSnake.id || tentativaSnake.data) return tentativaSnake;

  return item;
}

export function carregarLocalStorage(): Record<string, any>[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(regularizarItem);
  } catch {
    return [];
  }
}

export function salvarLocalStorage(items: Record<string, any>[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("[EscalaMapper] Não foi possível salvar no localStorage", error);
  }
}
