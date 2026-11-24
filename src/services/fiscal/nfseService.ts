import { supabase } from "@/lib/supabase";
import { buscarRegraNfse } from "@/services/fiscal/regrasFiscaisNfseService";
import { buscarCodigoIbge } from "@/services/fiscal/ibgeService";
import { somenteDigitos } from "@/lib/formatacaoCadastros";

/** Matriz oficial da NFS-e Nacional (CONEXAO TRANSPORTES LTDA). */
const CNPJ_MATRIZ_NFSE = "31227975000180";

/** Descrição padrão oficial da NFS-e (editável no Passo 3). */
const DESCRICAO_SERVICO_PADRAO =
  "Prestação de serviços de coleta e entrega de mercadorias, conforme programação operacional definida pelo contratante.";

function somenteDigitosCnpj(valor: string | null | undefined): string {
  return (valor || "").replace(/\D/g, "");
}

type EmitenteRow = {
  id: string;
  padrao: boolean | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  ie: string | null;
  /** Inscrição municipal — string (preserva zeros à esquerda, ex.: 000000060458216). */
  inscricao_municipal: string | null;
  /** JSONB do emitente (nfse_nacional.op_simp_nac / reg_ap_trib_sn etc.). */
  metadata?: Record<string, unknown> | null;
  cidade: string | null;
  uf: string | null;
};

export interface GerarNfseParams {
  origem: "os" | "cte" | "avulso";
  origem_id: string;
  /** Cliente vinculado quando a emissao e avulsa (sem OS/CT-e). */
  cliente_id?: string | null;
  descricao_servico?: string;
  municipio_prestacao?: string;
  /** Codigo IBGE do municipio de prestacao (evita lookup por nome). */
  codigo_municipio_prestacao?: string | null;
  /** Overrides do modal (vencem os dados derivados da origem). */
  tomador_nome?: string;
  tomador_cnpj?: string;
  tomador_email?: string;
  tomador_telefone?: string;
  tomador_logradouro?: string;
  tomador_numero?: string;
  tomador_complemento?: string;
  tomador_bairro?: string;
  tomador_municipio?: string;
  tomador_uf?: string;
  tomador_cep?: string;
  valor_servico?: number;
  valor_desconto?: number;
  codigo_servico?: string;
  /** Código NBS (Nomenclatura Brasileira de Serviços) — padrão 1.0501.15.00. */
  codigo_nbs?: string;
  aliquota_iss?: number | null;
  iss_retido?: boolean;
  /** Data de competencia AAAA-MM-DD (padrao: hoje em America/Sao_Paulo). */
  data_competencia?: string;
  /** Documento do tomador: CNPJ (14) ou CPF (11). */
  tomador_tipo_documento?: "cnpj" | "cpf";
  tomador_cpf?: string;
  /** Inscricao Municipal do tomador (opcional). */
  tomador_inscricao_municipal?: string;
  /** Pedido de compra / informacoes complementares (opcional). */
  pedido_compra?: string;
  enviar_email_tomador?: boolean;
  retencoes?: {
    pis?: number;
    cofins?: number;
    csll?: number;
    irrf?: number;
    inss?: number;
  };
  exigibilidade_iss?: string;
  tributos_aproximados?: {
    tipo: "valor" | "percentual";
    valor: number;
  };
}

export async function gerarRascunhoNfse(params: GerarNfseParams) {
  try {
    const validacoes: { campo: string; mensagem: string; severidade: string }[] = [];

    // 0. Verificar duplicidade (apenas quando ha OS/CT-e de origem)
    if (params.origem !== "avulso") {
      const { data: existente } = await supabase
        .from("fiscal_nfse")
        .select("id")
        .eq("ordem_servico_id", params.origem_id)
        .in("status", ["rascunho", "processando", "autorizado"])
        .limit(1);

      if (existente && existente.length > 0) {
        return { success: false, error: "Já existe NFS-e para esta OS." };
      }
    }

    // Emitente: prioriza a MATRIZ da NFS-e Nacional (CNPJ 31.227.975/0001-80).
    // Fallback para o emitente padrao (CT-e) apenas se a matriz nao existir.
    const { data: emitentesAtivos } = await supabase
      .from("configuracoes_fiscais")
      .select("*")
      .eq("ativo", true);

    const listaEmitentes = (emitentesAtivos || []) as EmitenteRow[];
    const emitente =
      listaEmitentes.find(
        (e) => somenteDigitosCnpj(e.cnpj) === CNPJ_MATRIZ_NFSE,
      ) ||
      listaEmitentes.find((e) => e.padrao === true) ||
      null;

    // Buscar dados de origem (OS ou CT-e)
    let tomador: any = null;
    let valorServico: number | null = null;
    let clienteId: string | null = null;
    let ordemServicoId: string | null = null;

    if (params.origem === "avulso") {
      // Emissao avulsa: sem OS/CT-e. Usa o cliente selecionado no modal.
      clienteId = params.cliente_id || null;
      if (clienteId) {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", clienteId)
          .maybeSingle();
        if (cliente) {
          tomador = { nome: cliente.razao_social || cliente.nome_fantasia, cnpj: cliente.cnpj, ie: cliente.ie };
        }
      }
    } else if (params.origem === "cte") {
      const { data: cte } = await supabase
        .from("fiscal_ctes")
        .select("*, ordens_servico(*)")
        .eq("id", params.origem_id)
        .maybeSingle();

      if (cte) {
        const pf = cte.metadata?.payload_focus || {};
        tomador = pf.tomador || null;
        valorServico = cte.valor ?? 0;
        clienteId = cte.cliente_id || null;
        ordemServicoId = cte.ordem_servico_id || null;

        const { data: cliente } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", clienteId)
          .maybeSingle();

        if (cliente) {
          tomador = { nome: cliente.razao_social || cliente.nome_fantasia, cnpj: cliente.cnpj, ie: cliente.ie };
        }
      }
    } else {
      const { data: os } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("id", params.origem_id)
        .maybeSingle();

      if (os) {
        valorServico = os.valor_cliente ?? 0;
        clienteId = os.cliente_id || null;

        if (os.cliente_id) {
          const { data: cliente } = await supabase
            .from("clientes")
            .select("*")
            .eq("id", os.cliente_id)
            .maybeSingle();
          if (cliente) {
            tomador = { nome: cliente.razao_social || cliente.nome_fantasia, cnpj: cliente.cnpj, ie: cliente.ie };
          }
        } else if (os.cliente) {
          tomador = { nome: os.cliente, cnpj: null, ie: null };
        }
      }
    }

    // Overrides do modal (vencem os dados derivados da origem)
    const enderecoTomador = {
      logradouro: params.tomador_logradouro || null,
      numero: params.tomador_numero || null,
      complemento: params.tomador_complemento || null,
      bairro: params.tomador_bairro || null,
      municipio: params.tomador_municipio || null,
      uf: params.tomador_uf || null,
      cep: params.tomador_cep || null,
    };
    const temEnderecoTomador = Object.values(enderecoTomador).some(Boolean);

    if (
      params.tomador_nome || params.tomador_cnpj || params.tomador_cpf ||
      params.tomador_email || params.tomador_telefone ||
      params.tomador_inscricao_municipal || temEnderecoTomador
    ) {
      const tipoDocumento = params.tomador_tipo_documento ||
        (somenteDigitos(params.tomador_cpf) ? "cpf" : "cnpj");
      tomador = {
        ...(tomador || {}),
        nome: params.tomador_nome || tomador?.nome || null,
        cnpj: tipoDocumento === "cnpj"
          ? (params.tomador_cnpj || tomador?.cnpj || null)
          : null,
        cpf: tipoDocumento === "cpf"
          ? (params.tomador_cpf || tomador?.cpf || null)
          : null,
        email: params.tomador_email || tomador?.email || null,
        telefone: params.tomador_telefone || tomador?.telefone || null,
        inscricao_municipal: params.tomador_inscricao_municipal ||
          tomador?.inscricao_municipal || null,
        endereco: temEnderecoTomador
          ? enderecoTomador
          : (tomador?.endereco || null),
      };
    }
    if (typeof params.valor_servico === "number" && params.valor_servico > 0) {
      valorServico = params.valor_servico;
    }
    const valorDesconto = Number(params.valor_desconto ?? 0) || 0;

    const retencoes = params.retencoes || {};
    const totalRetencoes = ["pis", "cofins", "csll", "irrf", "inss"]
      .reduce(function(total, chave) {
        const valor = Number(
          (retencoes as Record<string, unknown>)[chave] ?? 0,
        );
        return total + (Number.isFinite(valor) && valor > 0 ? valor : 0);
      }, 0);

    // Validacoes
    if (!emitente || !emitente.razao_social)
      validacoes.push({ campo: "emitente", mensagem: "Emitente padrao nao configurado", severidade: "erro" });
    if (!tomador || !tomador.nome)
      validacoes.push({ campo: "tomador", mensagem: "Tomador/cliente nao identificado", severidade: "erro" });
    const documentoTomadorDigitos = somenteDigitos(tomador?.cnpj) ||
      somenteDigitos(tomador?.cpf);
    if (!documentoTomadorDigitos)
      validacoes.push({ campo: "tomador.documento", mensagem: "CNPJ/CPF do tomador ausente", severidade: "erro" });
    const imTomadorNumerica = somenteDigitos(tomador?.inscricao_municipal);
    if (imTomadorNumerica.length > 15)
      validacoes.push({ campo: "tomador.inscricao_municipal", mensagem: "IM do tomador deve ter no maximo 15 digitos", severidade: "erro" });
    if (totalRetencoes > (valorServico || 0) - valorDesconto)
      validacoes.push({ campo: "retencoes", mensagem: "Retencoes nao podem exceder o valor liquido do servico", severidade: "erro" });
    if (!params.municipio_prestacao && !params.codigo_municipio_prestacao)
      validacoes.push({ campo: "municipio_prestacao", mensagem: "Municipio de prestacao ausente", severidade: "erro" });
    if (!valorServico || valorServico <= 0)
      validacoes.push({ campo: "valor_servico", mensagem: "Valor do servico ausente ou zerado", severidade: "erro" });
    if (valorDesconto < 0)
      validacoes.push({ campo: "valor_desconto", mensagem: "Desconto nao pode ser negativo", severidade: "erro" });
    if (valorDesconto > (valorServico || 0))
      validacoes.push({ campo: "valor_desconto", mensagem: "Desconto nao pode ser maior que o valor do servico", severidade: "erro" });

    // Buscar regra municipal: primeiro pela chave IBGE (padrao nacional),
    // depois pelo nome do municipio (compatibilidade com regras legadas).
    const chaveRegraIbge = params.codigo_municipio_prestacao || null;
    let regraMunicipal = chaveRegraIbge
      ? await buscarRegraNfse({
        emitente_id: emitente?.id || null,
        cliente_id: clienteId,
        municipio_prestacao: chaveRegraIbge,
      })
      : null;

    if (!regraMunicipal) {
      regraMunicipal = await buscarRegraNfse({
        emitente_id: emitente?.id || null,
        cliente_id: clienteId,
        municipio_prestacao: params.municipio_prestacao || null,
      });
    }

    // Overrides do modal vencem a regra municipal
    const codigoServico = params.codigo_servico?.trim() || regraMunicipal?.codigo_servico || null;
    const aliquotaIss = params.aliquota_iss != null
      ? Number(params.aliquota_iss)
      : (regraMunicipal?.aliquota_iss ?? null);
    const issRetido = params.iss_retido != null
      ? params.iss_retido
      : (regraMunicipal?.iss_retido ?? null);

    if (!codigoServico)
      validacoes.push({ campo: "codigo_servico", mensagem: "Codigo do servico municipal nao configurado", severidade: "aviso" });
    if (aliquotaIss == null)
      validacoes.push({ campo: "aliquota_iss", mensagem: "Aliquota ISS nao configurada", severidade: "aviso" });
    if (issRetido == null)
      validacoes.push({ campo: "iss_retido", mensagem: "Definicao de ISS retido nao configurada", severidade: "aviso" });

    // Codigo IBGE do municipio de prestacao (usa o informado pelo modal)
    const codigoMunicipioPrestacao = params.codigo_municipio_prestacao
      || (params.municipio_prestacao
        ? await buscarCodigoIbge(params.municipio_prestacao, emitente?.uf || "")
        : null);

    if (!codigoMunicipioPrestacao) {
      validacoes.push({ campo: "codigo_municipio_prestacao", mensagem: `Municipio "${params.municipio_prestacao || "?"}" nao encontrado na tabela municipios_ibge`, severidade: "erro" });
    }

    const dataCompetencia = /^\d{4}-\d{2}-\d{2}$/.test(params.data_competencia || "")
      ? String(params.data_competencia)
      : new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const valorLiquido = Math.max(
      0,
      Number(((valorServico || 0) - valorDesconto - totalRetencoes).toFixed(2)),
    );

    const emitenteMeta = (emitente?.metadata || {}) as Record<string, unknown>;
    const nfseNacionalMeta = (emitenteMeta.nfse_nacional || {}) as Record<string, unknown>;

    const metadata = {
      origem: params.origem,
      emitente: emitente ? {
        nome: emitente.razao_social || emitente.nome_fantasia,
        cnpj: emitente.cnpj,
        ie: emitente.ie,
        // Gravado como string para preservar zeros à esquerda (ex.: 000000060458216).
        inscricao_municipal: emitente.inscricao_municipal,
        // Regime tributário configurado no Editar Emitente (fallback 3/1).
        op_simp_nac: String(emitenteMeta.op_simp_nac ?? nfseNacionalMeta.op_simp_nac ?? "3"),
        reg_ap_trib_sn: String(emitenteMeta.reg_ap_trib_sn ?? nfseNacionalMeta.reg_ap_trib_sn ?? "1"),
        cidade: emitente.cidade,
        uf: emitente.uf,
      } : null,
      tomador,
      servico: params.descricao_servico?.trim() || regraMunicipal?.descricao_servico || DESCRICAO_SERVICO_PADRAO,
      competencia: dataCompetencia.slice(0, 7),
      data_competencia: dataCompetencia,
      pedido_compra: params.pedido_compra?.trim() || null,
      enviar_email_tomador: params.enviar_email_tomador === true,
      retencoes: {
        pis: Number(retencoes.pis ?? 0) || 0,
        cofins: Number(retencoes.cofins ?? 0) || 0,
        csll: Number(retencoes.csll ?? 0) || 0,
        irrf: Number(retencoes.irrf ?? 0) || 0,
        inss: Number(retencoes.inss ?? 0) || 0,
      },
      exigibilidade_iss: String(params.exigibilidade_iss || "tributavel"),
      tributos_aproximados: params.tributos_aproximados &&
          Number(params.tributos_aproximados.valor) > 0
        ? {
          tipo: params.tributos_aproximados.tipo === "valor"
            ? "valor"
            : "percentual",
          valor: Number(params.tributos_aproximados.valor),
        }
        : null,
      valor_servico: valorServico,
      valor_desconto: valorDesconto,
      valor_liquido: valorLiquido,
      municipio_prestacao: params.municipio_prestacao || null,
      codigo_servico: codigoServico,
      codigo_nbs: params.codigo_nbs?.trim() || null,
      aliquota_iss: aliquotaIss,
      iss_retido: issRetido,
      codigo_municipio_prestacao: codigoMunicipioPrestacao,
      validacoes_pendentes: validacoes,
      pronto_para_emissao: validacoes.filter(function(v) { return v.severidade === "erro"; }).length === 0,
    };

    const numero = "NFSE-" + Date.now().toString().slice(-8);

    const { data: nfse, error } = await supabase
      .from("fiscal_nfse")
      .insert([{
        numero,
        cliente_id: clienteId,
        ordem_servico_id: ordemServicoId || (params.origem === "avulso" ? null : params.origem_id),
        valor: valorLiquido,
        status: "rascunho",
        data_emissao: null,
        metadata,
      }])
      .select("*")
      .single();

    if (error || !nfse) throw new Error("Erro ao criar NFS-e: " + (error?.message || ""));

    await supabase.from("fiscal_events").insert([{
      documento_tipo: "NFSE",
      documento_id: nfse.id,
      tipo_evento: "CRIACAO_RASCUNHO_NFSE",
      descricao: "NFS-e rascunho gerada — " + params.origem,
      metadata: { origem: params.origem, origem_id: params.origem_id, total_pendencias: validacoes.length },
    }]);

    await supabase.from("fiscal_logs").insert([{
      entidade_tipo: "NFSE",
      entidade_id: nfse.id,
      acao: "GERAR_RASCUNHO_NFSE",
      request: { ...params },
      response: { nfse_id: nfse.id, status: "sucesso", pendencias: validacoes.length },
    }]);

    return { success: true, nfse };
  } catch (error: any) {
    console.error("[NfseService] Erro:", error);
    return { success: false, error: error.message };
  }
}
