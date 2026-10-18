import { supabase } from "@/lib/supabase";
import { buscarEmitenteAtivo } from "@/services/fiscal/configuracoesFiscaisService";
import { buscarCfop } from "@/services/fiscal/regrasFiscaisCteService";
import { buscarCodigoIbge } from "@/services/fiscal/ibgeService";
import type { RateioItem } from "@/services/fiscal/rateioFreteCteService";
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

export interface GerarLoteInput {
  documentosIds: string[];
  rateios: RateioItem[];
  osId?: string | null;
  valorTotalRota: number;
  regraRateio: string;
  loteId: string;
}

export interface ValidacaoDocumentoLote {
  docId: string;
  numeroNfe: string | null;
  valido: boolean;
  erros: string[];
  avisos: string[];
}

export interface GerarLoteResultado {
  loteId: string;
  total: number;
  gerados: number;
  falhas: number;
  ctes: any[];
  erros: string[];
}

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

function enderecoRealToFocusCteEndereco(real: EnderecoRealEntrega | null): FocusCteEndereco | null {
  if (!real || (!real.municipio && !real.logradouro)) return null;
  return {
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

function buildObservacao(endereco: EnderecoRealEntrega | null, fonte: string = "xml", pendente: boolean = false, enderecoCompleto?: string | null): string | null {
  if (!endereco || (!endereco.logradouro && !endereco.municipio)) return null;

  // Regra Calvo: so usar endereco de fonte valida (romaneio ou manual) e confirmado
  if (pendente) return null;
  if (fonte === "xml") return null;

  // Usar string completa se disponivel
  if (enderecoCompleto && enderecoCompleto.trim().length > 10) {
    return `ENTREGA: ${enderecoCompleto.trim()}`;
  }

  const partes = [
    endereco.logradouro,
    endereco.numero ? `, ${endereco.numero}` : "",
  ];
  if (endereco.bairro) partes.push(` - ${endereco.bairro}`);
  if (endereco.municipio) partes.push(` - ${endereco.municipio}`);
  if (endereco.uf) partes.push(`/${endereco.uf}`);
  if (endereco.cep) partes.push(` - CEP ${endereco.cep}`);
  const texto = partes.join("").trim().replace(/\s+/g, " ");
  return texto ? `ENTREGA: ${texto}` : null;
}

export function validarDocumentosParaLote(docs: any[]): ValidacaoDocumentoLote[] {
  return docs.map((doc) => {
    const erros: string[] = [];
    const avisos: string[] = [];
    const meta = doc.metadata || {};

    if (!doc.chave_acesso) {
      erros.push("Chave da NF-e ausente");
    }
    if (!doc.numero) {
      erros.push("Numero da NF-e ausente");
    }

    const enderecoReal = meta.endereco_real_entrega as EnderecoRealEntrega | undefined;
    if (!enderecoReal?.municipio || !enderecoReal?.uf) {
      erros.push("Endereco real de entrega ausente ou incompleto");
    }

    const fonte = meta.fonte_endereco_entrega || "xml";
    if (fonte === "xml") {
      // Se tem romaneio Calvo, endereco do XML nao pode ser usado como destino
      if (meta.romaneio_numero) {
        erros.push("Endereco de entrega veio do XML, mas romaneio Calvo exige coluna Entrega do PDF. Confira o endereco real.");
      } else {
        avisos.push("Endereco de entrega veio do XML (fiscal). Confira se e o endereco real.");
      }
    }

    if (meta.pendente_conferencia_endereco === true) {
      erros.push("Endereco real pendente de conferencia");
    }

    return {
      docId: doc.id,
      numeroNfe: doc.numero || null,
      valido: erros.length === 0,
      erros,
      avisos,
    };
  });
}

export async function gerarRascunhoCteLote(input: GerarLoteInput): Promise<GerarLoteResultado> {
  const errosGerais: string[] = [];
  const ctesGerados: any[] = [];
  let falhas = 0;

  const { documentosIds, rateios, osId, valorTotalRota, regraRateio, loteId } = input;

  if (!documentosIds.length) {
    return { loteId, total: 0, gerados: 0, falhas: 0, ctes: [], erros: ["Nenhum documento selecionado."] };
  }

  // 1. Buscar documentos
  const { data: docs } = await supabase
    .from("fiscal_documentos_vinculados")
    .select("*")
    .in("id", documentosIds)
    .order("created_at", { ascending: true });

  if (!docs || docs.length === 0) {
    return { loteId, total: documentosIds.length, gerados: 0, falhas: documentosIds.length, ctes: [], erros: ["Documentos nao encontrados."] };
  }

  // 2. Validar
  const validacoes = validarDocumentosParaLote(docs);
  const invalidos = validacoes.filter((v) => !v.valido);
  if (invalidos.length > 0) {
    errosGerais.push(
      `${invalidos.length} documento(s) com pendencias: ` +
      invalidos.map((v) => `NF-e ${v.numeroNfe || "S/N"}: ${v.erros.join("; ")}`).join(" | ")
    );
  }

  // 3. Buscar OS (pode ser a mesma para todos)
  let os: any = null;
  let clienteData: any = null;
  let prestadorData: any = null;
  let veiculoData: any = null;

  if (osId) {
    const { data: osData } = await supabase
      .from("ordens_servico")
      .select("*")
      .eq("id", osId)
      .single();
    os = osData;
  }

  // Se documentos tem OS vinculada, usar a primeira encontrada
  if (!os) {
    const docComOs = docs.find((d) => d.ordem_servico_id);
    if (docComOs) {
      const { data: osData } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("id", docComOs.ordem_servico_id)
        .single();
      os = osData;
    }
  }

  // Se nao tem OS, buscar cliente Calvo pelo emitente do documento
  if (!clienteData) {
    const primeiroDoc = docs[0];
    const emitenteNome = primeiroDoc?.emitente_nome || "";
    // Buscar cliente pelo nome do emitente (ex: "CALVO")
    if (emitenteNome) {
      const { data: clientePorEmitente } = await supabase
        .from("clientes")
        .select("*")
        .or(`razao_social.ilike.%${emitenteNome.slice(0, 10)}%,nome_fantasia.ilike.%${emitenteNome.slice(0, 10)}%`)
        .limit(1)
        .maybeSingle();
      if (clientePorEmitente) clienteData = clientePorEmitente;
    }
    // Fallback: buscar qualquer cliente Calvo
    if (!clienteData) {
      const { data: clienteCalvo } = await supabase
        .from("clientes")
        .select("*")
        .or("razao_social.ilike.%calvo%,nome_fantasia.ilike.%calvo%")
        .limit(1)
        .maybeSingle();
      if (clienteCalvo) clienteData = clienteCalvo;
    }
  }

  // Buscar prestador e veiculo mesmo sem OS (pelo primeiro doc ou emitente)
  if (!prestadorData && os?.prestador_id) {
    const { data: prest } = await supabase
      .from("prestadores")
      .select("*")
      .eq("id", (os as any).prestador_id)
      .maybeSingle();
    prestadorData = prest;
  }

  if (os) {
    const relatedQueries: Promise<any>[] = [];

    if ((os as any).cliente_id) {
      relatedQueries.push(
        supabase.from("clientes").select("*").eq("id", (os as any).cliente_id).maybeSingle()
          .then(({ data }) => { clienteData = data; })
      );
    }

    if ((os as any).prestador_id) {
      relatedQueries.push(
        supabase.from("prestadores").select("*").eq("id", (os as any).prestador_id).maybeSingle()
          .then(({ data }) => { prestadorData = data; })
      );
    }

    if (os.veiculo_alocado) {
      relatedQueries.push(
        supabase.from("veiculos").select("*").eq("placa", os.veiculo_alocado).limit(1).maybeSingle()
          .then(({ data }) => { veiculoData = data; })
      );
    }

    if (relatedQueries.length > 0) await Promise.all(relatedQueries);
  }

  // 4. Dados comuns do emitente
  const emitenteDb = await buscarEmitenteAtivo();

  // 5. Endereco de origem da OS (fallback)
  const enderecosArray: any[] = Array.isArray(os?.enderecos) ? os.enderecos : [];
  let origemEndereco: FocusCteEndereco | null = null;

  for (const end of enderecosArray) {
    const tipo = (end.tipo || "").toLowerCase();
    const parsed = parseEnderecoFromJson(end);
    if (!parsed) continue;
    if (tipo.includes("origem") || tipo.includes("coleta") || tipo.includes("retirada")) {
      origemEndereco = parsed;
      break;
    }
  }
  if (!origemEndereco && enderecosArray.length > 0) {
    origemEndereco = parseEnderecoFromJson(enderecosArray[0]);
  }

  const totalDocs = docs.length;
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
  };

  const tomador: FocusCteTomador = {
    nome: clienteData?.razao_social || clienteData?.nome_fantasia || os?.cliente || null,
    cnpj: clienteData?.cnpj || null,
    ie: clienteData?.ie || null,
    endereco: clienteData ? {
      logradouro: clienteData.logradouro || null,
      numero: clienteData.numero || null,
      complemento: null, bairro: null,
      cidade: clienteData.cidade || null,
      uf: clienteData.uf || null,
      cep: null, latitude: null, longitude: null, pais: "Brasil",
    } : null,
  };

  const ieTomador = (clienteData?.ie || "").trim().toUpperCase();
  tomador.indicador_ie = ieTomador === "ISENTO" ? "2" : ieTomador ? "1" : "9";

  const veiculo: FocusCteVeiculo = {
    placa: veiculoData?.placa || os?.veiculo_alocado || null,
    tipo: veiculoData?.tipo_veiculo || os?.veiculo_tipo || null,
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
    nome: motoristaData?.nome_completo || motoristaData?.nome_fantasia || os?.prestador || null,
    cpf: motoristaData?.cpf_cnpj || null,
    telefone: motoristaData?.telefone || motoristaData?.whatsapp || null,
  };

  // 6. Gerar um CT-e por documento
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const rateio = rateios.find((r) => r.documentoId === doc.id);
    if (!rateio) {
      falhas++;
      errosGerais.push(`Rateio nao encontrado para documento ${doc.id.substring(0, 8)}`);
      continue;
    }

    try {
      const meta = doc.metadata || {};
      const enderecoReal = meta.endereco_real_entrega as EnderecoRealEntrega | undefined;
      const fonteEndereco = meta.fonte_endereco_entrega || "xml";
      const pendente = meta.pendente_conferencia_endereco === true;

      let destinoEndereco = enderecoRealToFocusCteEndereco(enderecoReal || null);

      // Regra Calvo: NAO usar municipio do XML como destino do CT-e
      // Se nao ha endereco real do romaneio ou manual, o destino fica vazio (CT-e bloqueado pela validacao)
      if (!destinoEndereco && doc.municipio_destino && doc.uf_destino && !pendente) {
        // So permite fallback para XML se nao for contexto Calvo (sem romaneio)
        const temRomaneio = meta.romaneio_numero;
        if (!temRomaneio) {
          destinoEndereco = {
            cidade: doc.municipio_destino,
            uf: doc.uf_destino,
            pais: "Brasil",
          };
        }
      }

      const observacaoCte = buildObservacao(enderecoReal || null, fonteEndereco, pendente, meta.endereco_completo);

      const documentosVinculados: FocusCteDocumentoVinculado[] = [{
        tipo: doc.tipo_documento || "NFE",
        chave_acesso: doc.chave_acesso || null,
        numero: doc.numero || null,
        serie: doc.serie || null,
        valor: doc.valor_total ?? null,
        data_emissao: meta.data_emissao || null,
      }];

      const carga: FocusCteCarga = {
        tipo: os?.carga_tipo || null,
        descricao: doc.produto_predominante || os?.carga_descricao || null,
        peso_kg: meta.romaneio_peso ? parseFloat(meta.romaneio_peso) : (doc.peso_bruto ?? null),
        volumes: meta.romaneio_caixas ? parseInt(meta.romaneio_caixas, 10) : (doc.volumes ?? null),
        valor_declarado: doc.valor_total ?? null,
        cfop: null,
        natureza_operacao: os?.tipo_operacao || null,
        quantidade_notas: 1,
      };

      // Regra Calvo: usar metadata.valor_rateio_cte quando disponivel (coluna Rateio do romaneio)
      const valorRateioMetadata = typeof meta.valor_rateio_cte === "number" ? meta.valor_rateio_cte : null;
      const valorRateado = valorRateioMetadata ?? rateio.valorRateado;

      const valores: FocusCteValores = {
        valor_total: valorRateado,
        valor_frete: valorRateado,
        valor_pedagio: os?.pedagio ? (os.pedagio / docs.length) : null,
        valor_seguro: null,
        valor_desconto: null,
        valor_outros: null,
      };

      const fiscal: FocusCteFiscal = {
        cfop: null,
        natureza_operacao: os?.tipo_operacao || null,
        icms_aliquota: null,
        icms_base_calculo: null,
        icms_valor: null,
        regime_tributario: null,
      };

      // Buscar CFOP
      const regraCfop = await buscarCfop({
        cliente_id: (os as any)?.cliente_id || clienteData?.id || null,
        uf_origem: origemEndereco?.uf || null,
        uf_destino: destinoEndereco?.uf || null,
        tipo_operacao: os?.tipo_operacao || null,
      });

      if (regraCfop) {
        carga.cfop = regraCfop.cfop;
        fiscal.cfop = regraCfop.cfop;
        if (regraCfop.natureza_operacao) fiscal.natureza_operacao = regraCfop.natureza_operacao;
        if (regraCfop.aliquota_icms != null) fiscal.icms_aliquota = regraCfop.aliquota_icms;
      }

      // Fallback CFOP: se nao ha regra cadastrada, usar defaults por tipo de operacao
      if (!carga.cfop) {
        const ufOrigem = origemEndereco?.uf?.toUpperCase() || "";
        const ufDestino = destinoEndereco?.uf?.toUpperCase() || "";
        const cidadeOrigem = (origemEndereco?.cidade || "").toUpperCase();
        const cidadeDestino = (destinoEndereco?.cidade || "").toUpperCase();

        if (ufOrigem && ufDestino) {
          if (ufOrigem === ufDestino) {
            // Mesmo estado: intermunicipal (5352) ou mesmo municipio (5351)
            carga.cfop = cidadeOrigem === cidadeDestino ? "5351" : "5352";
            fiscal.cfop = carga.cfop;
            fiscal.natureza_operacao = fiscal.natureza_operacao || "TRANSPORTE DE CARGA";
          } else {
            // Interestadual
            carga.cfop = "6352";
            fiscal.cfop = carga.cfop;
            fiscal.natureza_operacao = fiscal.natureza_operacao || "TRANSPORTE DE CARGA";
          }
        }
      }

      // ICMS
      const aliquotaIcms = fiscal.icms_aliquota ?? 12;
      const baseIcms = valores.valor_total ?? 0;
      fiscal.icms_aliquota = aliquotaIcms;
      fiscal.icms_base_calculo = baseIcms > 0 ? baseIcms : null;
      fiscal.icms_valor = baseIcms > 0 ? parseFloat((baseIcms * aliquotaIcms / 100).toFixed(2)) : null;

      // Codigo IBGE
      let codIbgeDestino: string | null = null;
      if (destinoEndereco?.cidade && destinoEndereco?.uf) {
        codIbgeDestino = await buscarCodigoIbge(destinoEndereco.cidade!, destinoEndereco.uf!);
      }
      if (destinoEndereco) (destinoEndereco as any).codigo_municipio = codIbgeDestino;

      if (origemEndereco?.cidade && origemEndereco?.uf) {
        const codIbgeOrigem = await buscarCodigoIbge(origemEndereco.cidade!, origemEndereco.uf!);
        (origemEndereco as any).codigo_municipio = codIbgeOrigem;
      }

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
        modal: "01",
        tipo_servico: 0,
        observacao: observacaoCte,
      };

      const validacoes: FiscalValidationIssue[] = [];
      if (!destinoEndereco?.cidade) {
        validacoes.push({ campo: "destino", mensagem: "Endereco de destino ausente", severidade: "erro" });
      }
      if (!carga.cfop) {
        validacoes.push({ campo: "carga.cfop", mensagem: "CFOP nao definido", severidade: "erro" });
      }

      // Determinar origem operacional do CT-e
      const temOs = !!(os?.id || doc.ordem_servico_id);
      const temRomaneio = !!meta.romaneio_numero;
      const origemCte = temOs ? "os" : temRomaneio ? "romaneio_faturamento" : "lote";

      const metadata: CteMetadata = {
        payload_focus: payloadFocus as any,
        validacoes_pendentes: validacoes,
        pronto_para_emissao: validacoes.length === 0,
        origem: "geracao_lote_rateio",
        origem_cte: origemCte,
        os_numero: os?.numero || null,
        os_obrigatoria: temOs,
        veiculo_tipo: os?.veiculo_tipo || null,
        distancia: os?.distancia_km ?? null,
        emitente_id: emitenteDb?.id || null,
        endereco_real_entrega_usado: enderecoReal || null,
        observacao_cte: observacaoCte,
        fonte_endereco_entrega: meta.fonte_endereco_entrega || "manual",
        pendente_conferencia_endereco: false,
        romaneio_numero: meta.romaneio_numero || null,
        operacao_tipo: temRomaneio && !temOs ? "fixa_calvo" : null,
      };

      const ctePayload: Record<string, any> = {
        ordem_servico_id: os?.id || doc.ordem_servico_id || null,
        cliente_id: (os as any)?.cliente_id || clienteData?.id || null,
        filial_id: (os as any)?.filial_id || null,
        valor: valorRateado,
        status: "rascunho",
        data_emissao: new Date().toISOString(),
        metadata: {
          ...metadata,
          nfe_numero: doc.numero || null,
          nfe_chave: doc.chave_acesso || null,
          nfe_serie: doc.serie || null,
          destinatario_nome: doc.destinatario_nome || null,
          tomador_nome: clienteData?.razao_social || clienteData?.nome_fantasia || doc.emitente_nome || null,
          cliente_nome: clienteData?.razao_social || clienteData?.nome_fantasia || clienteData?.nome || null,
          cfop: fiscal.cfop || carga.cfop || null,
          natureza_operacao: fiscal.natureza_operacao || carga.natureza_operacao || null,
          origem_municipio: origemEndereco?.cidade || null,
          origem_uf: origemEndereco?.uf || null,
          romaneio_numero: meta.romaneio_numero || null,
          rateio: {
            lote_id: loteId,
            regra_rateio: regraRateio,
            valor_total_rota: valorTotalRota,
            valor_rateado: valorRateado,
            indice: i + 1,
            total_documentos: totalDocs,
            ajuste_centavos: rateio.ajuste,
          },
        },
      };

      const { data: cte, error: cteError } = await supabase
        .from("fiscal_ctes")
        .insert([ctePayload])
        .select("*")
        .single();

      if (cteError || !cte) {
        throw new Error(`Erro ao criar CT-e: ${cteError?.message}`);
      }

      await supabase.from("fiscal_events").insert([{
        documento_tipo: "CTE",
        documento_id: cte.id,
        tipo_evento: "CRIACAO_RASCUNHO_LOTE",
        descricao: `CT-e rascunho gerado em lote ${loteId} — NF-e ${doc.numero || "S/N"}`,
        metadata: {
          lote_id: loteId,
          doc_id: doc.id,
          pronto_para_emissao: metadata.pronto_para_emissao,
          total_pendencias: validacoes.length,
        },
      }]);

      await supabase.from("fiscal_logs").insert([{
        entidade_tipo: "CTE",
        entidade_id: cte.id,
        acao: "GERAR_RASCUNHO_LOTE",
        request: {
          lote_id: loteId,
          doc_id: doc.id,
          regra_rateio: regraRateio,
          valor_rateado: rateio.valorRateado,
        },
        response: {
          cte_id: cte.id,
          status: "sucesso",
          pronto_para_emissao: metadata.pronto_para_emissao,
          pendencias: validacoes.length,
        },
      }]);

      ctesGerados.push(cte);
    } catch (err: any) {
      falhas++;
      errosGerais.push(`NF-e ${doc.numero || "S/N"}: ${err.message}`);
    }
  }

  return {
    loteId,
    total: docs.length,
    gerados: ctesGerados.length,
    falhas,
    ctes: ctesGerados,
    erros: errosGerais,
  };
}
