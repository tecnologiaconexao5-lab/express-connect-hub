import { supabase } from "@/lib/supabase";
import { buscarRegraNfse } from "@/services/fiscal/regrasFiscaisNfseService";
import { buscarCodigoIbge } from "@/services/fiscal/ibgeService";

export interface GerarNfseParams {
  origem: "os" | "cte";
  origem_id: string;
  descricao_servico?: string;
  municipio_prestacao?: string;
}

export async function gerarRascunhoNfse(params: GerarNfseParams) {
  try {
    const validacoes: { campo: string; mensagem: string; severidade: string }[] = [];

    // 0. Verificar duplicidade
    const { data: existente } = await supabase
      .from("fiscal_nfse")
      .select("id")
      .eq("ordem_servico_id", params.origem_id)
      .in("status", ["rascunho", "processando", "autorizado"])
      .limit(1);

    if (existente && existente.length > 0) {
      return { success: false, error: "Já existe NFS-e para esta OS." };
    }

    // Buscar emitente padrao
    const { data: emitente } = await supabase
      .from("configuracoes_fiscais")
      .select("*")
      .eq("ativo", true)
      .eq("padrao", true)
      .limit(1)
      .maybeSingle();

    // Buscar dados de origem (OS ou CT-e)
    let tomador: any = null;
    let valorServico: number | null = null;
    let clienteId: string | null = null;
    let ordemServicoId: string | null = null;

    if (params.origem === "cte") {
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

    // Validacoes
    if (!emitente || !emitente.razao_social)
      validacoes.push({ campo: "emitente", mensagem: "Emitente padrao nao configurado", severidade: "erro" });
    if (!tomador || !tomador.nome)
      validacoes.push({ campo: "tomador", mensagem: "Tomador/cliente nao identificado", severidade: "erro" });
    if (!tomador || !tomador.cnpj)
      validacoes.push({ campo: "tomador.cnpj", mensagem: "CNPJ do tomador ausente", severidade: "erro" });
    if (!params.municipio_prestacao)
      validacoes.push({ campo: "municipio_prestacao", mensagem: "Municipio de prestacao ausente", severidade: "erro" });
    if (!valorServico || valorServico <= 0)
      validacoes.push({ campo: "valor_servico", mensagem: "Valor do servico ausente ou zerado", severidade: "erro" });

    // Buscar regra municipal
    const regraMunicipal = await buscarRegraNfse({
      emitente_id: emitente?.id || null,
      cliente_id: clienteId,
      municipio_prestacao: params.municipio_prestacao || null,
    });

    const codigoServico = regraMunicipal?.codigo_servico || null;
    const aliquotaIss = regraMunicipal?.aliquota_iss ?? null;
    const issRetido = regraMunicipal?.iss_retido ?? null;

    if (!codigoServico)
      validacoes.push({ campo: "codigo_servico", mensagem: "Codigo do servico municipal nao configurado", severidade: "aviso" });
    if (aliquotaIss == null)
      validacoes.push({ campo: "aliquota_iss", mensagem: "Aliquota ISS nao configurada", severidade: "aviso" });
    if (issRetido == null)
      validacoes.push({ campo: "iss_retido", mensagem: "Definicao de ISS retido nao configurada", severidade: "aviso" });

    // Buscar codigo IBGE do municipio de prestacao
    const codigoMunicipioPrestacao = params.municipio_prestacao
      ? await buscarCodigoIbge(params.municipio_prestacao, emitente?.uf || "")
      : null;

    if (params.municipio_prestacao && !codigoMunicipioPrestacao) {
      validacoes.push({ campo: "codigo_municipio_prestacao", mensagem: `Municipio "${params.municipio_prestacao}" nao encontrado na tabela municipios_ibge`, severidade: "erro" });
    }

    const metadata = {
      emitente: emitente ? {
        nome: emitente.razao_social || emitente.nome_fantasia,
        cnpj: emitente.cnpj,
        ie: emitente.ie,
        cidade: emitente.cidade,
        uf: emitente.uf,
      } : null,
      tomador,
      servico: regraMunicipal?.descricao_servico || params.descricao_servico || "Prestacao de servico de transporte",
      valor_servico: valorServico,
      municipio_prestacao: params.municipio_prestacao || null,
      codigo_servico: codigoServico,
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
        ordem_servico_id: ordemServicoId || params.origem_id,
        valor: valorServico || 0,
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
