import { supabase } from "@/lib/supabase";
import { buscarEmitenteAtivo } from "@/services/fiscal/configuracoesFiscaisService";
import { buscarCfop } from "@/services/fiscal/regrasFiscaisCteService";
import { buscarCodigoIbge } from "@/services/fiscal/ibgeService";
import type {
  FocusCtePayloadDraft,
  FocusCteEmitente,
  FocusCteTomador,
  FocusCteEndereco,
  FocusCteCarga,
  FocusCteVeiculo,
  FocusCteMotorista,
  FocusCteDocumentoVinculado,
  FocusCteValores,
  FocusCteFiscal,
  FiscalValidationIssue,
  CteMetadata,
  EnderecoRealEntrega,
} from "@/types/fiscal";

function parseEnderecoFromJson(endereco: any): FocusCteEndereco | null {
  if (!endereco) return null;
  return {
    logradouro: endereco.endereco || endereco.logradouro || null,
    numero: endereco.numero || null,
    complemento: endereco.complemento || null,
    bairro: endereco.bairro || null,
    cidade: endereco.cidade || null,
    uf: endereco.uf || endereco.estado || null,
    cep: endereco.cep || null,
    latitude: endereco.latitude ? String(endereco.latitude) : null,
    longitude: endereco.longitude ? String(endereco.longitude) : null,
    pais: endereco.pais || "Brasil",
  };
}

export async function gerarRascunhoCte(osId: string) {
  try {
    const validacoes: FiscalValidationIssue[] = [];

    // 0. Verificar duplicidade
    const { data: existente } = await supabase
      .from("fiscal_ctes")
      .select("id")
      .eq("ordem_servico_id", osId)
      .in("status", ["rascunho", "processando", "autorizado"])
      .limit(1);

    if (existente && existente.length > 0) {
      return { success: false, error: "Já existe CT-e para esta OS." };
    }

    // 1. Buscar OS real
    const { data: os, error: osError } = await supabase
      .from("ordens_servico")
      .select("*")
      .eq("id", osId)
      .single();

    if (osError || !os) {
      throw new Error("OS não encontrada");
    }

    // 2. Buscar dados relacionados
    let clienteData: any = null;
    let prestadorData: any = null;
    let veiculoData: any = null;

    const relatedQueries: Promise<any>[] = [];

    if ((os as any).cliente_id) {
      relatedQueries.push(
        supabase
          .from("clientes")
          .select("*")
          .eq("id", (os as any).cliente_id)
          .maybeSingle()
          .then(({ data }) => {
            clienteData = data;
          })
      );
    } else if (os.cliente) {
      relatedQueries.push(
        supabase
          .from("clientes")
          .select("*")
          .or(`razao_social.eq.${os.cliente},nome_fantasia.eq.${os.cliente}`)
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            clienteData = data;
          })
      );
    }

    if ((os as any).prestador_id) {
      relatedQueries.push(
        supabase
          .from("prestadores")
          .select("*")
          .eq("id", (os as any).prestador_id)
          .maybeSingle()
          .then(({ data }) => {
            prestadorData = data;
          })
      );
    } else if (os.prestador) {
      relatedQueries.push(
        supabase
          .from("prestadores")
          .select("*")
          .or(`nome_completo.eq.${os.prestador},nome_fantasia.eq.${os.prestador}`)
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            prestadorData = data;
          })
      );
    }

    if (os.veiculo_alocado) {
      relatedQueries.push(
        supabase
          .from("veiculos")
          .select("*")
          .eq("placa", os.veiculo_alocado)
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            veiculoData = data;
          })
      );
    }

    if (relatedQueries.length > 0) {
      await Promise.all(relatedQueries);
    }

    // 2b. Buscar documentos fiscais vinculados a esta OS
    let docsVinculados: any[] = [];
    try {
      const { data: docsData } = await supabase
        .from("fiscal_documentos_vinculados")
        .select("*")
        .eq("ordem_servico_id", osId)
        .eq("status", "vinculado")
        .order("created_at", { ascending: false });
      docsVinculados = docsData || [];
    } catch {
      docsVinculados = [];
    }

    // 3. Parse enderecos do JSONB da OS
    const enderecosArray: any[] = Array.isArray(os.enderecos)
      ? os.enderecos
      : [];

    let origemEndereco: FocusCteEndereco | null = null;
    let destinoEndereco: FocusCteEndereco | null = null;

    for (let i = 0; i < enderecosArray.length; i++) {
      const end = enderecosArray[i];
      const tipo = (end.tipo || "").toLowerCase();
      const parsed = parseEnderecoFromJson(end);
      if (!parsed) continue;

      if (tipo.includes("origem") || tipo.includes("coleta") || tipo.includes("retirada")) {
        if (!origemEndereco) origemEndereco = parsed;
      } else if (tipo.includes("destino") || tipo.includes("entrega")) {
        if (!destinoEndereco) destinoEndereco = parsed;
      } else {
        if (!origemEndereco) origemEndereco = parsed;
        else if (!destinoEndereco) destinoEndereco = parsed;
      }
    }

    // 4. Montar payload_focus
    const emitenteDb = await buscarEmitenteAtivo();

    const emitente: FocusCteEmitente = {
      nome: emitenteDb?.razao_social || emitenteDb?.nome_fantasia || null,
      cnpj: emitenteDb?.cnpj || null,
      ie: emitenteDb?.ie || null,
      rntrc: emitenteDb?.rntrc || null,
      endereco: emitenteDb
        ? {
            logradouro: emitenteDb.logradouro || null,
            numero: emitenteDb.numero || null,
            complemento: emitenteDb.complemento || null,
            bairro: emitenteDb.bairro || null,
            cidade: emitenteDb.cidade || null,
            uf: emitenteDb.uf || null,
            cep: emitenteDb.cep || null,
            latitude: null,
            longitude: null,
            pais: "Brasil",
          }
        : null,
    };

    const tomador: FocusCteTomador = {
      nome: clienteData?.razao_social || clienteData?.nome_fantasia || os.cliente || null,
      cnpj: clienteData?.cnpj || null,
      ie: clienteData?.ie || null,
      endereco: clienteData
        ? {
            logradouro: clienteData.logradouro || null,
            numero: clienteData.numero || null,
            complemento: null,
            bairro: null,
            cidade: clienteData.cidade || null,
            uf: clienteData.uf || null,
            cep: null,
            latitude: null,
            longitude: null,
            pais: "Brasil",
          }
        : null,
    };

    // Determinar indicador_ie do tomador
    const ieTomador = (clienteData?.ie || "").trim().toUpperCase();
    if (ieTomador === "ISENTO") {
      tomador.indicador_ie = "2";
    } else if (ieTomador) {
      tomador.indicador_ie = "1";
    } else {
      tomador.indicador_ie = "9";
    }

    // Mapear documentos vinculados do XML NF-e
    const documentosVinculados: FocusCteDocumentoVinculado[] = docsVinculados.map((d: any) => ({
      tipo: d.tipo_documento || "NFE",
      chave_acesso: d.chave_acesso || null,
      numero: d.numero || null,
      serie: d.serie || null,
      valor: d.valor_total ?? null,
      data_emissao: d.metadata?.data_emissao || null,
    }));

    // Enriquecer carga com dados do XML vinculado se a OS nao tiver
    const primeiroDoc = docsVinculados[0];
    const cargaFromXml = primeiroDoc
      ? {
          descricao: primeiroDoc.produto_predominante || null,
          peso_kg: primeiroDoc.peso_bruto ?? null,
          volumes: primeiroDoc.volumes ?? null,
          valor_declarado: primeiroDoc.valor_total ?? null,
        }
      : null;

    const carga: FocusCteCarga = {
      tipo: os.carga_tipo || (os.carga && typeof os.carga === "object" ? (os.carga as any).tipo : null) || null,
      descricao: os.carga_descricao || (os.carga && typeof os.carga === "object" ? (os.carga as any).descricao : null) || cargaFromXml?.descricao || null,
      peso_kg: os.peso ?? cargaFromXml?.peso_kg ?? null,
      volumes: os.volumes ?? cargaFromXml?.volumes ?? null,
      valor_declarado: os.valor_declarado ?? cargaFromXml?.valor_declarado ?? null,
      cfop: null,
      natureza_operacao: os.tipo_operacao || null,
      quantidade_notas: (os.qtd_notas ?? docsVinculados.length) || null,
    };

    // Enriquecer origem/destino com XML se OS nao tiver
    if (!origemEndereco && primeiroDoc && (primeiroDoc.municipio_origem || primeiroDoc.uf_origem)) {
      origemEndereco = {
        cidade: primeiroDoc.municipio_origem || null,
        uf: primeiroDoc.uf_origem || null,
        pais: "Brasil",
      };
    }

    // Prioridade: endereco_real_entrega do documento vinculado > destino da OS > destino do XML
    let enderecoRealEntrega: EnderecoRealEntrega | null = null;
    let fonteEnderecoEntrega: "manual" | "xml" | "romaneio" = "xml";
    let pendenteConferenciaEndereco = true;

    if (primeiroDoc?.metadata?.endereco_real_entrega) {
      const real = primeiroDoc.metadata.endereco_real_entrega as EnderecoRealEntrega;
      if (real.municipio && real.uf) {
        enderecoRealEntrega = real;
        fonteEnderecoEntrega = primeiroDoc.metadata.fonte_endereco_entrega || "manual";
        pendenteConferenciaEndereco = false;

        destinoEndereco = {
          logradouro: real.logradouro || null,
          numero: real.numero || null,
          complemento: real.complemento || null,
          bairro: real.bairro || null,
          cidade: real.municipio || null,
          uf: real.uf || null,
          cep: real.cep || null,
          pais: "Brasil",
        };
      }
    }

    if (!destinoEndereco && primeiroDoc && (primeiroDoc.municipio_destino || primeiroDoc.uf_destino)) {
      destinoEndereco = {
        cidade: primeiroDoc.municipio_destino || null,
        uf: primeiroDoc.uf_destino || null,
        pais: "Brasil",
      };
    }

    const veiculo: FocusCteVeiculo = {
      placa: veiculoData?.placa || os.veiculo_alocado || null,
      tipo: veiculoData?.tipo_veiculo || os.veiculo_tipo || null,
      renavam: veiculoData?.renavam || null,
      tara_kg: veiculoData?.tara_kg ?? null,
      capacidade_kg: veiculoData?.capacidade_kg ?? null,
      capacidade_m3: veiculoData?.capacidade_m3 ?? null,
      marca: veiculoData?.marca || null,
      modelo: veiculoData?.modelo || null,
      uf_licenciamento: veiculoData?.uf_licenciamento || null,
      tipo_rodado: veiculoData?.tipo_rodado || null,
      tipo_carroceria: veiculoData?.tipo_carroceria || null,
    };

    const motoristaData = prestadorData;
    const motorista: FocusCteMotorista = {
      nome: motoristaData?.nome_completo || motoristaData?.nome_fantasia || os.prestador || null,
      cpf: motoristaData?.cpf_cnpj || null,
      telefone: motoristaData?.telefone || motoristaData?.whatsapp || null,
    };

    const valores: FocusCteValores = {
      valor_total: os.valor_cliente ?? 0,
      valor_frete: os.valor_cliente ?? 0,
      valor_pedagio: os.pedagio ?? null,
      valor_seguro: null,
      valor_desconto: os.descontos ?? null,
      valor_outros: (os.ajudante ?? 0) + (os.adicionais ?? 0) || null,
    };

    const fiscal: FocusCteFiscal = {
      cfop: null,
      natureza_operacao: os.tipo_operacao || null,
      icms_aliquota: null,
      icms_base_calculo: null,
      icms_valor: null,
      regime_tributario: null,
    };

    // Buscar regra fiscal CFOP
    const regraCfop = await buscarCfop({
      cliente_id: (os as any).cliente_id || null,
      uf_origem: origemEndereco?.uf || null,
      uf_destino: destinoEndereco?.uf || null,
      tipo_operacao: os.tipo_operacao || null,
    });

    if (regraCfop) {
      carga.cfop = regraCfop.cfop;
      fiscal.cfop = regraCfop.cfop;
      if (regraCfop.natureza_operacao) {
        fiscal.natureza_operacao = regraCfop.natureza_operacao;
      }
      if (regraCfop.aliquota_icms != null) {
        fiscal.icms_aliquota = regraCfop.aliquota_icms;
      }
    }

    // Fallback CFOP: se nao ha regra cadastrada, usar defaults
    if (!carga.cfop) {
      const ufOrigem = origemEndereco?.uf?.toUpperCase() || "";
      const ufDestino = destinoEndereco?.uf?.toUpperCase() || "";
      const cidadeOrigem = (origemEndereco?.cidade || "").toUpperCase();
      const cidadeDestino = (destinoEndereco?.cidade || "").toUpperCase();
      if (ufOrigem && ufDestino) {
        if (ufOrigem === ufDestino) {
          carga.cfop = cidadeOrigem === cidadeDestino ? "5351" : "5352";
          fiscal.cfop = carga.cfop;
          fiscal.natureza_operacao = fiscal.natureza_operacao || "TRANSPORTE DE CARGA";
        } else {
          carga.cfop = "6352";
          fiscal.cfop = carga.cfop;
          fiscal.natureza_operacao = fiscal.natureza_operacao || "TRANSPORTE DE CARGA";
        }
      }
    }

    // ICMS — calculo basico
    // TODO: Aliquota ICMS definitiva deve vir de regra fiscal por UF/CFOP/cliente.
    //       O fallback de 12% é temporario e sera substituido pela regra real.
    const aliquotaIcms = fiscal.icms_aliquota ?? 12;
    const baseIcms = valores.valor_total ?? 0;
    fiscal.icms_aliquota = aliquotaIcms;
    fiscal.icms_base_calculo = baseIcms > 0 ? baseIcms : null;
    fiscal.icms_valor = baseIcms > 0 ? parseFloat((baseIcms * aliquotaIcms / 100).toFixed(2)) : null;

    // Enriquecer enderecos com codigo IBGE
    const [codIbgeOrigem, codIbgeDestino] = await Promise.all([
      origemEndereco?.cidade && origemEndereco?.uf ? buscarCodigoIbge(origemEndereco.cidade!, origemEndereco.uf!) : null,
      destinoEndereco?.cidade && destinoEndereco?.uf ? buscarCodigoIbge(destinoEndereco.cidade!, destinoEndereco.uf!) : null,
    ]);

    if (origemEndereco) (origemEndereco as any).codigo_municipio = codIbgeOrigem;
    if (destinoEndereco) (destinoEndereco as any).codigo_municipio = codIbgeDestino;
    if (emitente.endereco) {
      const codIbgeEmit = emitente.endereco.cidade && emitente.endereco.uf
        ? await buscarCodigoIbge(emitente.endereco.cidade!, emitente.endereco.uf!)
        : null;
      (emitente.endereco as any).codigo_municipio = codIbgeEmit;
    }
    if (tomador.endereco) {
      const codIbgeTom = tomador.endereco.cidade && tomador.endereco.uf
        ? await buscarCodigoIbge(tomador.endereco.cidade!, tomador.endereco.uf!)
        : null;
      (tomador.endereco as any).codigo_municipio = codIbgeTom;
    }

    // Validar codigo IBGE
    if (!codIbgeOrigem) {
      validacoes.push({ campo: "origem.codigo_municipio", mensagem: `Municipio "${origemEndereco?.cidade}/${origemEndereco?.uf}" nao encontrado na tabela municipios_ibge`, severidade: "erro" });
    }
    if (!codIbgeDestino) {
      validacoes.push({ campo: "destino.codigo_municipio", mensagem: `Municipio "${destinoEndereco?.cidade}/${destinoEndereco?.uf}" nao encontrado na tabela municipios_ibge`, severidade: "erro" });
    }

    // Montar observacao com endereco real de entrega
    let observacaoCte: string | null = null;
    if (enderecoRealEntrega) {
      observacaoCte = [
        enderecoRealEntrega.logradouro,
        enderecoRealEntrega.numero ? `, ${enderecoRealEntrega.numero}` : "",
        enderecoRealEntrega.complemento ? ` ${enderecoRealEntrega.complemento}` : "",
        enderecoRealEntrega.bairro ? ` ${enderecoRealEntrega.bairro}` : "",
        enderecoRealEntrega.municipio ? ` ${enderecoRealEntrega.municipio}` : "",
        enderecoRealEntrega.uf ? `/${enderecoRealEntrega.uf}` : "",
        enderecoRealEntrega.cep ? ` CEP ${enderecoRealEntrega.cep}` : "",
      ].join("").trim().replace(/\s+/g, " ") || null;
    }

    // Default rodoviario/normal. Futuramente parametrizar por tipo de operacao.
    const modal = "01";
    const tipo_servico = 0;

    const payloadFocus: FocusCtePayloadDraft = {
      emitente,
      tomador,
      remetente: origemEndereco,
      destinatario: destinoEndereco,
      origem: origemEndereco,
      destino: destinoEndereco,
      carga,
      veiculo,
      motorista,
      documentos_vinculados: documentosVinculados,
      valores,
      fiscal,
      modal,
      tipo_servico,
      observacao: observacaoCte,
    };

    // 5. Montar validacoes_pendentes
    if (!emitente.nome) {
      validacoes.push({ campo: "emitente.nome", mensagem: "Emitente não configurado no sistema", severidade: "erro" });
    }
    if (!emitente.cnpj) {
      validacoes.push({ campo: "emitente.cnpj", mensagem: "CNPJ do emitente não configurado", severidade: "erro" });
    }
    if (!emitente.endereco || !emitente.endereco.cidade) {
      validacoes.push({ campo: "emitente.endereco", mensagem: "Endereco do emitente nao configurado", severidade: "erro" });
    }

    if (!tomador.nome) {
      validacoes.push({ campo: "tomador.nome", mensagem: "Cliente (tomador) não identificado na OS", severidade: "erro" });
    }
    if (!tomador.cnpj) {
      validacoes.push({ campo: "tomador.cnpj", mensagem: "CNPJ do tomador ausente no cadastro do cliente", severidade: "erro" });
    }
    if (tomador.indicador_ie === "9" && tomador.cnpj) {
      validacoes.push({ campo: "tomador.indicador_ie", mensagem: "Tomador CNPJ sem IE — indicador_ie definido como nao contribuinte", severidade: "aviso" });
    }

    if (!origemEndereco || !origemEndereco.cidade) {
      validacoes.push({ campo: "origem", mensagem: "Endereco de origem/coleta ausente ou incompleto na OS", severidade: "erro" });
    }
    if (!destinoEndereco || !destinoEndereco.cidade) {
      validacoes.push({ campo: "destino", mensagem: "Endereco de destino/entrega ausente ou incompleto na OS", severidade: "erro" });
    }

    if (!carga.descricao && !carga.tipo) {
      validacoes.push({ campo: "carga.descricao", mensagem: "Descricao ou tipo da carga ausente na OS", severidade: "erro" });
    }
    if (!carga.peso_kg) {
      validacoes.push({ campo: "carga.peso_kg", mensagem: "Peso da carga nao informado na OS", severidade: "aviso" });
    }
    if (!carga.valor_declarado) {
      validacoes.push({ campo: "carga.valor_declarado", mensagem: "Valor declarado da carga ausente na OS", severidade: "aviso" });
    }
    if (!carga.cfop) {
      validacoes.push({ campo: "carga.cfop", mensagem: "CFOP nao definido — necessario para emissao fiscal", severidade: "erro" });
    }
    if (!carga.natureza_operacao) {
      validacoes.push({ campo: "carga.natureza_operacao", mensagem: "Natureza da operacao ausente na OS", severidade: "erro" });
    }

    if (!veiculo.placa) {
      validacoes.push({ campo: "veiculo.placa", mensagem: "Placa do veiculo ausente — veiculo_alocado nao preenchido na OS", severidade: "erro" });
    }
    if (!veiculo.tipo) {
      validacoes.push({ campo: "veiculo.tipo", mensagem: "Tipo do veiculo ausente na OS ou no cadastro do veiculo", severidade: "aviso" });
    }

    if (!motorista.nome) {
      validacoes.push({ campo: "motorista.nome", mensagem: "Motorista/prestador nao vinculado a OS", severidade: "erro" });
    }
    if (!motorista.cpf) {
      validacoes.push({ campo: "motorista.cpf", mensagem: "CPF/CNPJ do motorista ausente no cadastro do prestador", severidade: "erro" });
    }

    if (!fiscal.cfop) {
      validacoes.push({ campo: "fiscal.cfop", mensagem: "CFOP fiscal nao configurado", severidade: "erro" });
    }
    if (!fiscal.icms_base_calculo || fiscal.icms_base_calculo <= 0) {
      validacoes.push({ campo: "fiscal.icms_base_calculo", mensagem: "Base de calculo do ICMS nao informada", severidade: "erro" });
    }
    if (!fiscal.icms_aliquota || fiscal.icms_aliquota <= 0) {
      validacoes.push({ campo: "fiscal.icms_aliquota", mensagem: "Aliquota de ICMS nao informada", severidade: "erro" });
    }

    if (documentosVinculados.length === 0) {
      validacoes.push({ campo: "documentos_vinculados", mensagem: "Documento fiscal vinculado ausente", severidade: "aviso" });
    }

    if (!(os as any).filial_id && !os.unidade && (!emitente.endereco || !emitente.endereco.cidade)) {
      validacoes.push({ campo: "emitente.filial", mensagem: "Filial/unidade nao identificada na OS", severidade: "aviso" });
    }

    // 6. Inserir em fiscal_ctes
    const metadata: CteMetadata = {
      payload_focus: payloadFocus,
      validacoes_pendentes: validacoes,
      pronto_para_emissao: validacoes.length === 0,
      origem: "geracao_rascunho_os",
      os_numero: os.numero,
      veiculo_tipo: os.veiculo_tipo || null,
      distancia: os.distancia_km ?? null,
      emitente_id: emitenteDb?.id || null,
      endereco_real_entrega_usado: enderecoRealEntrega || null,
      observacao_cte: observacaoCte,
      fonte_endereco_entrega: fonteEnderecoEntrega,
      pendente_conferencia_endereco: pendenteConferenciaEndereco,
    };

    const ctePayload = {
      ordem_servico_id: os.id,
      cliente_id: (os as any).cliente_id || null,
      filial_id: (os as any).filial_id || null,
      valor: os.valor_cliente || 0,
      status: "rascunho",
      data_emissao: new Date().toISOString(),
      metadata,
    };

    const { data: cte, error: cteError } = await supabase
      .from("fiscal_ctes")
      .insert([ctePayload])
      .select("*")
      .single();

    if (cteError || !cte) {
      throw new Error(`Erro ao criar CT-e: ${cteError?.message}`);
    }

    // 7. Inserir em fiscal_events
    const eventPayload = {
      documento_tipo: "CTE",
      documento_id: cte.id,
      tipo_evento: "CRIACAO_RASCUNHO",
      descricao: `CT-e rascunho gerado a partir da OS ${os.numero}`,
      metadata: {
        os_id: os.id,
        pronto_para_emissao: metadata.pronto_para_emissao,
        total_pendencias: validacoes.length,
      },
    };

    await supabase.from("fiscal_events").insert([eventPayload]);

    // 8. Inserir em fiscal_logs
    const logPayload = {
      entidade_tipo: "CTE",
      entidade_id: cte.id,
      acao: "GERAR_RASCUNHO",
      request: {
        os_id: os.id,
        os_numero: os.numero,
      },
      response: {
        cte_id: cte.id,
        status: "sucesso",
        pronto_para_emissao: metadata.pronto_para_emissao,
        pendencias: validacoes.length,
      },
    };

    await supabase.from("fiscal_logs").insert([logPayload]);

    return { success: true, cte };
  } catch (error: any) {
    console.error("[CteService] Erro ao gerar rascunho:", error);
    return { success: false, error: error.message };
  }
}

export interface GerarCteAvulsoInput {
  documentoId: string;
  valorFrete: number;
  observacao?: string | null;
}

export async function gerarRascunhoCteAvulso(input: GerarCteAvulsoInput) {
  const { documentoId, valorFrete } = input;
  try {
    // 0. Verificar duplicidade por chave
    const { data: doc } = await supabase
      .from("fiscal_documentos_vinculados")
      .select("*")
      .eq("id", documentoId)
      .single();

    if (!doc) return { success: false, error: "Documento nao encontrado." };

    const chave = (doc as any).chave_acesso;
    if (chave) {
      const { data: existente } = await supabase
        .from("fiscal_ctes")
        .select("id, status")
        .filter("metadata->>nfe_chave", "eq", chave)
        .limit(1);
      if (existente && existente.length > 0) {
        return { success: false, error: `Ja existe CT-e para esta NF-e (status: ${existente[0].status}).` };
      }
    }

    // 1. Emitente
    const emitenteDb = await buscarEmitenteAtivo();

    // 2. Tomador (buscar por nome do emitente do XML = Calvo)
    const tomadorNome = (doc as any).emitente_nome || "";
    let tomadorDb: any = null;
    if (tomadorNome) {
      const termo = tomadorNome.slice(0, 10);
      const { data: cliente } = await supabase
        .from("clientes")
        .select("cnpj, ie, razao_social, nome_fantasia, logradouro, numero, bairro, cidade, uf, cep")
        .or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`)
        .limit(1)
        .maybeSingle();
      tomadorDb = cliente;
    }

    // 3. Metadados do documento
    const meta = (doc as any).metadata || {};
    const enderecoReal = meta.endereco_real_entrega as EnderecoRealEntrega | undefined;
    const observacaoCte = input.observacao
      || meta.endereco_completo
        ? `ENTREGA: ${meta.endereco_completo}`
        : null;

    // 4. Origem (Guarulhos/SP para Calvo)
    const origemEndereco: FocusCteEndereco = {
      logradouro: tomadorDb?.logradouro || null,
      numero: tomadorDb?.numero || null,
      complemento: null,
      bairro: tomadorDb?.bairro || null,
      cidade: tomadorDb?.cidade || "GUARULHOS",
      uf: tomadorDb?.uf || "SP",
      cep: tomadorDb?.cep || null,
      pais: "Brasil",
    };

    // 5. Destino (do endereco real ou do XML)
    const destinoEndereco: FocusCteEndereco = enderecoReal?.municipio && enderecoReal?.logradouro ? {
      logradouro: enderecoReal.logradouro || null,
      numero: enderecoReal.numero || null,
      complemento: enderecoReal.complemento || null,
      bairro: enderecoReal.bairro || null,
      cidade: enderecoReal.municipio || null,
      uf: enderecoReal.uf || null,
      cep: enderecoReal.cep || null,
      pais: "Brasil",
    } : {
      logradouro: meta.endereco_fiscal_xml?.logradouro || null,
      numero: meta.endereco_fiscal_xml?.numero || null,
      bairro: meta.endereco_fiscal_xml?.bairro || null,
      cidade: (doc as any).municipio_destino || null,
      uf: (doc as any).uf_destino || null,
      cep: meta.endereco_fiscal_xml?.cep || null,
      pais: "Brasil",
    };

    // 6. Codigo IBGE destino
    let codIbgeDestino: string | null = enderecoReal?.codigo_ibge || meta.endereco_fiscal_xml?.codigo_ibge || null;
    if (!codIbgeDestino && destinoEndereco.cidade && destinoEndereco.uf) {
      codIbgeDestino = await buscarCodigoIbge(destinoEndereco.cidade, destinoEndereco.uf);
    }
    (destinoEndereco as any).codigo_municipio = codIbgeDestino;

    // 7. Codigo IBGE origem
    if (origemEndereco.cidade && origemEndereco.uf) {
      const codIbgeOrigem = await buscarCodigoIbge(origemEndereco.cidade, origemEndereco.uf);
      (origemEndereco as any).codigo_municipio = codIbgeOrigem;
    }

    // 8. CFOP
    const regraCfop = await buscarCfop({
      cliente_id: tomadorDb?.id || null,
      uf_origem: origemEndereco.uf || null,
      uf_destino: destinoEndereco.uf || null,
      tipo_operacao: null,
    });
    let cfopValor = regraCfop?.cfop || null;
    if (!cfopValor) {
      cfopValor = (origemEndereco.uf === destinoEndereco.uf) ? "5352" : "6352";
    }

    // 9. ICMS
    const aliquotaIcms = regraCfop?.aliquota_icms ?? 12;
    const icmsBase = valorFrete;
    const icmsValor = parseFloat((icmsBase * aliquotaIcms / 100).toFixed(2));

    // 10. Documentos vinculados (a propria NF-e)
    const documentosVinculados: FocusCteDocumentoVinculado[] = [{
      tipo: "NFE",
      chave_acesso: chave || null,
      numero: (doc as any).numero || null,
      serie: (doc as any).serie || null,
      valor: (doc as any).valor_total ?? null,
      data_emissao: null,
    }];

    // 11. Emitente
    const emitente: FocusCteEmitente = {
      nome: emitenteDb?.razao_social || emitenteDb?.nome_fantasia || null,
      cnpj: emitenteDb?.cnpj || null,
      ie: emitenteDb?.ie || null,
      rntrc: emitenteDb?.rntrc || null,
      endereco: emitenteDb ? {
        logradouro: emitenteDb.logradouro || null,
        numero: emitenteDb.numero || null,
        complemento: emitenteDb.complemento || null,
        bairro: emitenteDb.bairro || null,
        cidade: emitenteDb.cidade || null,
        uf: emitenteDb.uf || null,
        cep: emitenteDb.cep || null,
        latitude: null, longitude: null, pais: "Brasil",
      } : null,
      regime_tributario: emitenteDb?.regime_tributario || null,
    };

    // 12. Tomador
    const ieTomador = (tomadorDb?.ie || "").trim().toUpperCase();
    const tomador: FocusCteTomador = {
      nome: tomadorDb?.razao_social || tomadorDb?.nome_fantasia || (doc as any).emitente_nome || null,
      cnpj: tomadorDb?.cnpj || null,
      ie: tomadorDb?.ie || null,
      endereco: tomadorDb ? {
        logradouro: tomadorDb.logradouro || null,
        numero: tomadorDb.numero || null,
        complemento: null, bairro: tomadorDb.bairro || null,
        cidade: tomadorDb.cidade || null,
        uf: tomadorDb.uf || null,
        cep: tomadorDb.cep || null,
        latitude: null, longitude: null, pais: "Brasil",
      } : null,
      indicador_ie: ieTomador === "ISENTO" ? "2" : ieTomador ? "1" : "9",
    };

    // 13. Carga
    const carga: FocusCteCarga = {
      cfop: cfopValor,
      tipo: null,
      descricao: (doc as any).produto_predominante || null,
      peso_kg: (doc as any).peso_bruto ?? null,
      volumes: (doc as any).volumes ?? null,
      valor_declarado: (doc as any).valor_total ?? null,
      natureza_operacao: regraCfop?.natureza_operacao || "PRESTACAO DE SERVICO DE TRANSPORTE INTERMUNICIPAL",
      quantidade_notas: 1,
    };

    // 14. Valores
    const valores: FocusCteValores = {
      valor_total: valorFrete,
      valor_frete: valorFrete,
      valor_pedagio: null,
      valor_seguro: null,
      valor_desconto: null,
      valor_outros: null,
    };

    // 15. Fiscal
    const fiscal: FocusCteFiscal = {
      cfop: cfopValor,
      natureza_operacao: regraCfop?.natureza_operacao || "PRESTACAO DE SERVICO DE TRANSPORTE INTERMUNICIPAL",
      icms_aliquota: aliquotaIcms,
      icms_base_calculo: icmsBase,
      icms_valor: icmsValor,
      regime_tributario: emitenteDb?.regime_tributario || null,
    };

    // 16. Payload focus
    const payloadFocus: FocusCtePayloadDraft = {
      emitente,
      tomador,
      remetente: origemEndereco,
      destinatario: destinoEndereco,
      origem: origemEndereco,
      destino: destinoEndereco,
      carga,
      veiculo: {},
      motorista: {},
      documentos_vinculados: documentosVinculados,
      valores,
      fiscal,
      modal: "01",
      tipo_servico: 0,
      observacao: observacaoCte || null,
    };

    // 17. Validacoes
    const validacoesPendentes: FiscalValidationIssue[] = [];
    if (!destinoEndereco?.cidade) {
      validacoesPendentes.push({ campo: "destino", mensagem: "Endereco de destino ausente", severidade: "erro" });
    }
    if (!cfopValor) {
      validacoesPendentes.push({ campo: "carga.cfop", mensagem: "CFOP nao definido", severidade: "erro" });
    }
    if (!valorFrete || valorFrete <= 0) {
      validacoesPendentes.push({ campo: "valores.valor_total", mensagem: "Valor do frete nao informado", severidade: "erro" });
    }
    if (!tomadorDb?.cnpj) {
      validacoesPendentes.push({ campo: "tomador.cnpj", mensagem: "CNPJ do tomador/remetente ausente. Cadastre a Calvo na tabela clientes.", severidade: "erro" });
    }

    // 18. Metadata
    const metadata: CteMetadata = {
      payload_focus: payloadFocus as any,
      validacoes_pendentes: validacoesPendentes,
      pronto_para_emissao: validacoesPendentes.length === 0,
      origem: "geracao_avulsa",
      origem_cte: "xml_manual",
      os_numero: null,
      os_obrigatoria: false,
      veiculo_tipo: null,
      distancia: null,
      emitente_id: emitenteDb?.id || null,
      endereco_real_entrega_usado: enderecoReal || null,
      observacao_cte: observacaoCte,
      fonte_endereco_entrega: meta.fonte_endereco_entrega || "manual",
      pendente_conferencia_endereco: false,
      romaneio_numero: null,
      operacao_tipo: null,
    };

    // 19. CT-e payload
    const ctePayload: Record<string, any> = {
      ordem_servico_id: null,
      cliente_id: tomadorDb?.id || null,
      filial_id: null,
      valor: valorFrete,
      status: "rascunho",
      data_emissao: new Date().toISOString(),
      metadata: {
        ...metadata,
        nfe_numero: (doc as any).numero || null,
        nfe_chave: chave || null,
        nfe_serie: (doc as any).serie || null,
        destinatario_nome: (doc as any).destinatario_nome || null,
        tomador_nome: tomadorDb?.razao_social || tomadorDb?.nome_fantasia || (doc as any).emitente_nome || null,
        cliente_nome: tomadorDb?.razao_social || tomadorDb?.nome_fantasia || null,
        cfop: cfopValor,
        natureza_operacao: fiscal.natureza_operacao || carga.natureza_operacao || null,
        origem_municipio: origemEndereco?.cidade || null,
        origem_uf: origemEndereco?.uf || null,
        valor_frete_manual: valorFrete,
        fonte_valor_frete: "manual",
        documento_vinculado_id: documentoId,
      },
    };

    // 20. Insert
    const { data: cte, error: cteError } = await supabase
      .from("fiscal_ctes")
      .insert([ctePayload])
      .select("*")
      .single();

    if (cteError || !cte) {
      throw new Error(`Erro ao criar CT-e: ${cteError?.message}`);
    }

    // 21. Events + Logs
    await supabase.from("fiscal_events").insert([{
      documento_tipo: "CTE",
      documento_id: cte.id,
      tipo_evento: "CRIACAO_RASCUNHO_AVULSO",
      descricao: `CT-e rascunho avulso gerado — NF-e ${(doc as any).numero || "S/N"} | Valor R$ ${valorFrete.toFixed(2)}`,
      metadata: {
        documento_vinculado_id: documentoId,
        pronto_para_emissao: metadata.pronto_para_emissao,
        total_pendencias: validacoesPendentes.length,
        valor_frete_manual: valorFrete,
      },
    }]);

    await supabase.from("fiscal_logs").insert([{
      entidade_tipo: "CTE",
      entidade_id: cte.id,
      acao: "GERAR_RASCUNHO_AVULSO",
      request: {
        documento_id: documentoId,
        valor_frete: valorFrete,
        nfe_numero: (doc as any).numero,
        nfe_chave: chave,
      },
      response: {
        cte_id: cte.id,
        status: "sucesso",
        pronto_para_emissao: metadata.pronto_para_emissao,
        pendencias: validacoesPendentes.length,
      },
    }]);

    return { success: true, cte, pendencias: validacoesPendentes };
  } catch (error: any) {
    console.error("[CteService] Erro ao gerar rascunho avulso:", error);
    return { success: false, error: error.message };
  }
}
