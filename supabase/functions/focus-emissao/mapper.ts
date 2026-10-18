export interface FocusCtePayloadInterno {
  emitente?: {
    nome?: string | null;
    cnpj?: string | null;
    ie?: string | null;
    rntrc?: string | null;
    regime_tributario?: string | null;
    inscricao_estadual?: string | null;
    inscricao_municipal?: string | null;
    endereco?: {
      logradouro?: string | null;
      numero?: string | null;
      complemento?: string | null;
      bairro?: string | null;
      cidade?: string | null;
      uf?: string | null;
      cep?: string | null;
      pais?: string | null;
      codigo_municipio?: string | null;
    } | null;
  } | null;
  tomador?: {
    nome?: string | null;
    cnpj?: string | null;
    ie?: string | null;
    indicador_ie?: string | null;
    endereco?: any;
  } | null;
  remetente?: {
    cidade?: string | null;
    uf?: string | null;
    pais?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cep?: string | null;
    codigo_municipio?: string | null;
  } | null;
  destinatario?: {
    cidade?: string | null;
    uf?: string | null;
    pais?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cep?: string | null;
    codigo_municipio?: string | null;
    nome?: string | null;
  } | null;
  destino?: {
    cidade?: string | null;
    uf?: string | null;
    pais?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cep?: string | null;
    codigo_municipio?: string | null;
  } | null;
  origem?: {
    cidade?: string | null;
    uf?: string | null;
    codigo_municipio?: string | null;
  } | null;
  carga?: {
    cfop?: string | null;
    descricao?: string | null;
    peso_kg?: number | null;
    volumes?: number | null;
    valor_declarado?: number | null;
  } | null;
  fiscal?: {
    cfop?: string | null;
    natureza_operacao?: string | null;
    icms_aliquota?: number | null;
    icms_base_calculo?: number | null;
    icms_valor?: number | null;
  } | null;
  valores?: {
    valor_frete?: number | null;
    valor_total?: number | null;
  } | null;
  documentos_vinculados?: Array<{
    tipo?: string | null;
    chave_acesso?: string | null;
  }> | null;
  modal?: string | null;
  tipo_servico?: number | null;
  observacao?: string | null;
}

export interface ClienteDb {
  id?: string;
  cnpj?: string | null;
  ie?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  codigo_ibge?: number | null;
}

export interface ValidationBlock {
  campo: string;
  mensagem: string;
}

export function validarPayloadAntesDeEnviar(
  payload: FocusCtePayloadInterno,
  clienteRemetente?: ClienteDb | null,
): ValidationBlock[] {
  const erros: ValidationBlock[] = [];
  const cnpjRem = clienteRemetente?.cnpj || payload.tomador?.cnpj || null;

  if (!cnpjRem || String(cnpjRem).replace(/[^0-9]/g, "").length < 14) {
    erros.push({
      campo: "remetente.cnpj",
      mensagem: "CNPJ do remetente/tomador ausente ou incompleto. Cadastre o cliente (Calvo) na tabela clientes com CNPJ de 14 digitos.",
    });
  }

  const rem = payload.remetente || {};
  const dest = payload.destinatario || payload.destino || {};

  if (!rem.logradouro) {
    erros.push({
      campo: "remetente.logradouro",
      mensagem: "Logradouro do remetente (origem) ausente.",
    });
  }
  if (!dest.logradouro) {
    erros.push({
      campo: "destinatario.logradouro",
      mensagem: "Logradouro do destinatario (destino) ausente.",
    });
  }

  const rntrcRaw = (payload.emitente?.rntrc || "").replace(/[^0-9]/g, "");
  if (rntrcRaw.length !== 8) {
    erros.push({
      campo: "emitente.rntrc",
      mensagem: "RNTRC do emitente ausente ou invalido (deve ter exatamente 8 digitos). Cadastre o RNTRC real em configuracoes_fiscais.",
    });
  }

  return erros;
}

export function converterPayloadInternoParaFocusCteOficial(
  payload: FocusCtePayloadInterno,
  clienteRemetente?: ClienteDb | null,
): Record<string, any> {
  const result: Record<string, any> = {};

  const emit = payload.emitente || {};
  const tom = payload.tomador || {};
  const rem = payload.remetente || {};
  const dest = payload.destinatario || payload.destino || {};
  const orig = payload.origem || {};
  const carga = payload.carga || {};
  const fisc = payload.fiscal || {};
  const vals = payload.valores || {};
  const docs = payload.documentos_vinculados || [];

  const regime = (emit.regime_tributario || "").toLowerCase();

  const somenteNumeros = (v: string | null | undefined): string =>
    (v || "").replace(/[^0-9]/g, "");

  const str = (v: any): string => (v != null ? String(v) : "");

  const cnpjRem = clienteRemetente?.cnpj || tom.cnpj || null;
  const ieRem = clienteRemetente?.ie || tom.ie || null;
  const nomeRem = clienteRemetente?.razao_social
    || clienteRemetente?.nome_fantasia
    || tom.nome
    || "";

  const origemCidade = str(orig.cidade || rem.cidade || "");
  const origemUf = str(orig.uf || rem.uf || "");
  const destinoCidade = str(dest.cidade || "");
  const destinoUf = str(dest.uf || "");

  const codIbgeOrigem = orig.codigo_municipio || rem.codigo_municipio || null;
  const codIbgeDestino = dest.codigo_municipio || null;

  const valorTotal = vals.valor_total ?? vals.valor_frete ?? 0;

  const rntrcRaw = somenteNumeros(emit.rntrc || "");
  const rntrcValido = (rntrcRaw.length === 8) ? rntrcRaw : "";


  // ── Core fields ──────────────────────────────────────────────

  result.cfop = parseInt(str(carga.cfop || fisc.cfop || "0"), 10) || undefined;
  result.natureza_operacao = str(carga.natureza_operacao || fisc.natureza_operacao || "");
  result.data_emissao = new Date().toISOString();
  result.tipo_documento = 0;

  result.municipio_envio = origemCidade;
  result.uf_envio = origemUf;
  result.municipio_inicio = origemCidade;
  result.uf_inicio = origemUf;
  result.municipio_fim = destinoCidade;
  result.uf_fim = destinoUf;

  if (codIbgeOrigem) {
    result.codigo_municipio_envio = parseInt(codIbgeOrigem, 10);
    result.codigo_municipio_inicio = parseInt(codIbgeOrigem, 10);
  }
  if (codIbgeDestino) {
    result.codigo_municipio_fim = parseInt(codIbgeDestino, 10);
  }

  result.modal = str(payload.modal || "01");
  result.tipo_servico = payload.tipo_servico ?? 0;

  // ── Emitente ─────────────────────────────────────────────────
  // Ordem XML: CNPJ (obrig), IE (obrig), IEST, xNome (obrig), xFant,
  //   xLgr (obrig), nro (obrig), xCpl, xBairro (obrig),
  //   cMun (obrig), xMun (obrig), CEP, UF (obrig), fone, CRT

  result.cnpj_emitente = somenteNumeros(emit.cnpj || "");
  result.cnpj_emitente = somenteNumeros(emit.cnpj || "");
  result.inscricao_estadual_emitente = str(emit.ie || emit.inscricao_estadual || "");
  result.nome_emitente = str(emit.nome || "");

  const endEmit = emit.endereco || {};
  if (endEmit.logradouro) {
    result.logradouro_emitente = str(endEmit.logradouro);
    result.numero_emitente = str(endEmit.numero || "");
    result.bairro_emitente = str(endEmit.bairro || "");
    result.codigo_municipio_emitente = endEmit.codigo_municipio ? parseInt(str(endEmit.codigo_municipio), 10) : undefined;
    result.municipio_emitente = str(endEmit.cidade || "");
    result.cep_emitente = somenteNumeros(endEmit.cep || "");
    result.uf_emitente = str(endEmit.uf || "");
  }

  if (regime.includes("normal")) {
    result.regime_tributario_emitente = 3;
  } else if (regime.includes("simples")) {
    result.regime_tributario_emitente = 1;
  }

  // ── Remetente ────────────────────────────────────────────────
  // Ordem XML: CNPJ ou CPF (obrig), IE, xNome (obrig), xFant,
  //   fone, xLgr (obrig), nro (obrig), xCpl, xBairro (obrig),
  //   cMun (obrig), xMun (obrig), CEP, UF (obrig), cPais, xPais, email

  if (cnpjRem) {
    result.cnpj_remetente = somenteNumeros(cnpjRem);
  }
  if (ieRem && cnpjRem) {
    result.inscricao_estadual_remetente = str(ieRem);
  }
  result.nome_remetente = str(nomeRem);

  // Usar endereco do cliente se disponivel, senao usar dados da origem
  if (clienteRemetente?.logradouro) {
    result.logradouro_remetente = str(clienteRemetente.logradouro);
    result.numero_remetente = str(clienteRemetente.numero || "");
    result.bairro_remetente = str(clienteRemetente.bairro || "");
    result.cep_remetente = somenteNumeros(clienteRemetente.cep || "");
  } else {
    result.logradouro_remetente = str(rem.logradouro || "");
    result.numero_remetente = str(rem.numero || "");
    result.bairro_remetente = str(rem.bairro || "");
    result.cep_remetente = somenteNumeros(rem.cep || "");
  }

  result.municipio_remetente = origemCidade;
  result.uf_remetente = origemUf;

  if (codIbgeOrigem) {
    result.codigo_municipio_remetente = parseInt(codIbgeOrigem, 10);
  } else if (clienteRemetente?.codigo_ibge) {
    result.codigo_municipio_remetente = clienteRemetente.codigo_ibge;
  } else if (origemCidade === "GUARULHOS" && origemUf === "SP") {
    result.codigo_municipio_remetente = 3518800;
  }

  result.pais_remetente = str(rem.pais || "Brasil");
  result.codigo_pais_remetente = 1058;

  // ── Destinatario ─────────────────────────────────────────────
  // Ordem XML: CNPJ ou CPF, IE, xNome (obrig), fone, ISUF,
  //   xLgr (obrig), nro (obrig), xCpl, xBairro (obrig),
  //   cMun (obrig), xMun (obrig), CEP, UF (obrig), cPais, xPais, email

  // Se o destinatario for a mesma empresa que o remetente (Calvo),
  // usar o mesmo CNPJ/IE. Senao, buscar dados reais.
  if (cnpjRem) {
    result.cnpj_destinatario = cnpjRem;
    if (ieRem) result.inscricao_estadual_destinatario = str(ieRem);
  }

  result.nome_destinatario = str(dest.nome || nomeRem || "");
  result.logradouro_destinatario = str(dest.logradouro || "");
  result.numero_destinatario = str(dest.numero || "");
  result.bairro_destinatario = str(dest.bairro || "");
  result.municipio_destinatario = destinoCidade;
  result.uf_destinatario = destinoUf;
  result.cep_destinatario = somenteNumeros(dest.cep || "");

  if (codIbgeDestino) {
    result.codigo_municipio_destinatario = parseInt(codIbgeDestino, 10);
  } else if (destinoCidade === "SAO PAULO" && destinoUf === "SP") {
    result.codigo_municipio_destinatario = 3550308;
  }

  result.pais_destinatario = str(dest.pais || "Brasil");
  result.codigo_pais_destinatario = 1058;

  // ── Tomador ──────────────────────────────────────────────────

  result.tomador = 0; // 0 = Remetente e o tomador do servico

  const ieTomadorRaw = (ieRem || tom.ie || "").trim().toUpperCase();
  if (ieTomadorRaw === "ISENTO") {
    result.indicador_inscricao_estadual_tomador = 2;
  } else if (tom.indicador_ie === "2") {
    result.indicador_inscricao_estadual_tomador = 2;
  } else if (ieTomadorRaw) {
    result.indicador_inscricao_estadual_tomador = 1;
  } else {
    result.indicador_inscricao_estadual_tomador = 9;
  }

  // ── Valores ──────────────────────────────────────────────────

  result.valor_total = valorTotal;
  result.valor_receber = valorTotal;

  // ── ICMS ─────────────────────────────────────────────────────
  // Para Simples Nacional: ICMSSN (indSN + campos)
  // Para Regime Normal: ICMS (CST + campos)

  if (regime.includes("simples")) {
    result.icms_indicador_simples_nacional = 1;
    result.icms_situacao_tributaria = "90_simples_nacional";
  } else {
    result.icms_situacao_tributaria = "00";
  }

  result.icms_base_calculo = fisc.icms_base_calculo ?? valorTotal;
  result.icms_aliquota = fisc.icms_aliquota ?? 12;
  result.icms_valor = fisc.icms_valor ?? parseFloat((valorTotal * 12 / 100).toFixed(2));

  // ── Carga ────────────────────────────────────────────────────
  // Ordem XML: vCarga, proPred, xOutCat, quantidades[],
  //   onde cada item: cUnid, tpMed, qCarga

  result.valor_total_carga = carga.valor_declarado ?? 0;
  result.produto_predominante = str(carga.descricao || "");

  const peso = carga.peso_kg ?? 0;
  if (peso > 0) {
    result.quantidades = [{
      codigo_unidade_medida: "01",
      tipo_medida: "PESO BRUTO",
      quantidade: peso,
    }];
  }

  // ── NF-es vinculadas ─────────────────────────────────────────

  if (docs.length > 0) {
    result.nfes = docs
      .filter((d) => d.chave_acesso)
      .map((d) => ({
        chave_nfe: str(d.chave_acesso || ""),
      }));
  }

  // ── Modal rodoviario ─────────────────────────────────────────

  result.rntrc = rntrcValido;
  result.modal_rodoviario = {
    rntrc: rntrcValido,
  };

  // ── Observacao ───────────────────────────────────────────────

  result.observacao = str(payload.observacao || "");

  // ── Outros campos padrao ─────────────────────────────────────

  result.retirar_mercadoria = 1;
  result.detalhes_retirar = "NAO SE APLICA";

  // ── Limpeza: remover campos undefined e strings vazias ───────
  Object.keys(result).forEach((k) => {
    const v = result[k];
    if (v === undefined || v === null) {
      delete result[k];
    } else if (typeof v === "string" && v === "") {
      delete result[k];
    }
  });

  return result;
}
