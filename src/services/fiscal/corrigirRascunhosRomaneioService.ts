import { supabase } from "@/lib/supabase";
import type { FiscalValidationIssue, FocusCtePayloadDraft, EnderecoRealEntrega } from "@/types/fiscal";

interface CorrecaoResultado {
  cteId: string;
  numeroCte: string;
  nfeNumero: string;
  corrigido: boolean;
  erros: string[];
  alteracoes: string[];
}

export interface CorrecaoRomaneioResultado {
  romaneio: string;
  total: number;
  corrigidos: number;
  falhas: number;
  resultados: CorrecaoResultado[];
  erros: string[];
}

function determineCfop(origemUf: string | null, destinoUf: string | null, origemCidade: string | null, destinoCidade: string | null): { cfop: string; natureza: string } {
  const ufOrig = (origemUf || "").trim().toUpperCase();
  const ufDest = (destinoUf || "").trim().toUpperCase();
  const cidOrig = (origemCidade || "").trim().toUpperCase();
  const cidDest = (destinoCidade || "").trim().toUpperCase();

  if (!ufOrig || !ufDest) {
    return { cfop: "5352", natureza: "PRESTACAO DE SERVICO DE TRANSPORTE" };
  }

  if (ufOrig === ufDest) {
    if (cidOrig && cidDest && cidOrig === cidDest) {
      return { cfop: "5351", natureza: "PRESTACAO DE SERVICO DE TRANSPORTE MUNICIPAL" };
    }
    return { cfop: "5352", natureza: "PRESTACAO DE SERVICO DE TRANSPORTE INTERMUNICIPAL" };
  }

  return { cfop: "6352", natureza: "PRESTACAO DE SERVICO DE TRANSPORTE INTERESTADUAL" };
}

export async function corrigirRascunhosRomaneio(romaneioNumero: string): Promise<CorrecaoRomaneioResultado> {
  const errosGerais: string[] = [];
  const resultados: CorrecaoResultado[] = [];
  let corrigidos = 0;
  let falhas = 0;

  if (!romaneioNumero) {
    return { romaneio: "", total: 0, corrigidos: 0, falhas: 0, resultados: [], erros: ["Numero do romaneio nao informado."] };
  }

  const { data: ctes, error: queryError } = await supabase
    .from("fiscal_ctes")
    .select("*")
    .eq("status", "rascunho")
    .order("data_emissao", { ascending: true });

  if (queryError) {
    return { romaneio: romaneioNumero, total: 0, corrigidos: 0, falhas: 0, resultados: [], erros: [queryError.message] };
  }

  const ctesRomaneio = (ctes || []).filter((cte: any) => {
    const meta = cte.metadata || {};
    return meta.romaneio_numero === romaneioNumero;
  });

  if (ctesRomaneio.length === 0) {
    return { romaneio: romaneioNumero, total: 0, corrigidos: 0, falhas: 0, resultados: [], erros: ["Nenhum CT-e rascunho encontrado para este romaneio."] };
  }

  const CALVO_NOME = "CALVO COML IMP. E EXP. LTDA.";

  for (const cte of ctesRomaneio) {
    const alteracoes: string[] = [];
    const erros: string[] = [];
    const meta = (cte.metadata || {}) as Record<string, any>;
    const pf = (meta.payload_focus || {}) as Record<string, any>;

    try {
      const updates: Record<string, any> = {};
      const newMeta = { ...meta };

      // 1. Tomador (apenas em metadata — tabela nao tem coluna tomador_nome)
      if (!newMeta.tomador_nome || newMeta.tomador_nome === "-") {
        newMeta.tomador_nome = CALVO_NOME;
        alteracoes.push("metadata.tomador_nome");
      }

      if (!newMeta.cliente_nome) {
        newMeta.cliente_nome = CALVO_NOME;
        alteracoes.push("metadata.cliente_nome");
      }

      // 2. NF-e
      if (!newMeta.nfe_numero) {
        newMeta.nfe_numero = cte.numero_nfe || meta.nfe_numero || null;
        if (newMeta.nfe_numero) alteracoes.push("metadata.nfe_numero");
      }

      if (!newMeta.nfe_chave) {
        newMeta.nfe_chave = meta.nfe_chave || null;
        if (newMeta.nfe_chave) alteracoes.push("metadata.nfe_chave");
      }

      if (!newMeta.nfe_serie) {
        newMeta.nfe_serie = meta.nfe_serie || null;
        if (newMeta.nfe_serie) alteracoes.push("metadata.nfe_serie");
      }

      // 3. Payload Focus - Tomador
      if (pf && Object.keys(pf).length > 0) {
        let payloadChanged = false;
        const newPf = { ...pf };

        if (!newPf.tomador || !newPf.tomador.nome) {
          newPf.tomador = {
            ...newPf.tomador,
            nome: CALVO_NOME,
          };
          payloadChanged = true;
          alteracoes.push("payload_focus.tomador");
        }

        // 4. Payload Focus - Origem (GUARULHOS/SP)
        if (!newPf.origem || !newPf.origem.cidade) {
          newPf.origem = {
            ...newPf.origem,
            cidade: "GUARULHOS",
            uf: "SP",
            pais: "Brasil",
          };
          payloadChanged = true;
          alteracoes.push("payload_focus.origem");
        }

        if (!newPf.remetente || !newPf.remetente.cidade) {
          newPf.remetente = {
            ...newPf.remetente,
            cidade: "GUARULHOS",
            uf: "SP",
            pais: "Brasil",
          };
          payloadChanged = true;
          alteracoes.push("payload_focus.remetente");
        }

        // 5. CFOP
        const destinoCidade = newPf.destino?.cidade || meta.endereco_real_entrega_usado?.municipio || null;
        const destinoUf = newPf.destino?.uf || meta.endereco_real_entrega_usado?.uf || null;
        const origemCidade = newPf.origem?.cidade || "GUARULHOS";
        const origemUf = newPf.origem?.uf || "SP";

        const { cfop, natureza } = determineCfop(origemUf, destinoUf, origemCidade, destinoCidade);

        if (!newPf.fiscal) {
          newPf.fiscal = {};
          payloadChanged = true;
        }

        if (!newPf.fiscal.cfop) {
          newPf.fiscal = { ...newPf.fiscal, cfop, natureza_operacao: natureza };
          payloadChanged = true;
          alteracoes.push("payload_focus.fiscal.cfop");
        }

        if (!newPf.fiscal.natureza_operacao) {
          newPf.fiscal = { ...newPf.fiscal, natureza_operacao: natureza };
          payloadChanged = true;
        }

        if (!newPf.carga) {
          newPf.carga = {};
          payloadChanged = true;
        }

        if (!newPf.carga.cfop) {
          newPf.carga = { ...newPf.carga, cfop, natureza_operacao: natureza };
          payloadChanged = true;
          alteracoes.push("payload_focus.carga.cfop");
        }

        if (!newPf.carga.natureza_operacao) {
          newPf.carga = { ...newPf.carga, natureza_operacao: natureza };
          payloadChanged = true;
        }

        if (payloadChanged) {
          newMeta.payload_focus = newPf;
        }
      }

      // 6. Metadata fiscal fields
      if (!newMeta.cfop) {
        const { cfop } = determineCfop(
          newMeta.payload_focus?.origem?.uf || "SP",
          newMeta.payload_focus?.destino?.uf || "SP",
          newMeta.payload_focus?.origem?.cidade || "GUARULHOS",
          newMeta.payload_focus?.destino?.cidade || "SAO PAULO"
        );
        newMeta.cfop = cfop;
        alteracoes.push("metadata.cfop");
      }

      if (!newMeta.natureza_operacao) {
        newMeta.natureza_operacao = newMeta.payload_focus?.fiscal?.natureza_operacao
          || newMeta.payload_focus?.carga?.natureza_operacao
          || "PRESTACAO DE SERVICO DE TRANSPORTE INTERMUNICIPAL";
        alteracoes.push("metadata.natureza_operacao");
      }

      if (!newMeta.origem_municipio) {
        newMeta.origem_municipio = "GUARULHOS";
        alteracoes.push("metadata.origem_municipio");
      }

      if (!newMeta.origem_uf) {
        newMeta.origem_uf = "SP";
        alteracoes.push("metadata.origem_uf");
      }

      // 7. Tomador nome no metadata
      if (!newMeta.tomador_nome || newMeta.tomador_nome === "-") {
        newMeta.tomador_nome = CALVO_NOME;
        alteracoes.push("metadata.tomador_nome");
      }

      // 8. Remove CFOP from validacoes_pendentes
      const validacoes: FiscalValidationIssue[] = Array.isArray(newMeta.validacoes_pendentes)
        ? newMeta.validacoes_pendentes
        : [];

      const validacoesAntes = validacoes.length;
      const validacoesFiltradas = validacoes.filter(
        (v) => !(v.campo === "carga.cfop" || v.mensagem?.toLowerCase().includes("cfop"))
      );
      newMeta.validacoes_pendentes = validacoesFiltradas;

      if (validacoesAntes !== validacoesFiltradas.length) {
        alteracoes.push("validacoes_pendentes (removido CFOP)");
      }

      // Reavalia pronto_para_emissao
      const errosRestantes = validacoesFiltradas.filter((v) => v.severidade === "erro");
      newMeta.pronto_para_emissao = errosRestantes.length === 0;

      if (newMeta.pronto_para_emissao && alteracoes.length > 0) {
        alteracoes.push("pronto_para_emissao=TRUE");
      }

      updates.metadata = newMeta;

      const { error: updateError } = await supabase
        .from("fiscal_ctes")
        .update(updates)
        .eq("id", cte.id);

      if (updateError) {
        erros.push(updateError.message);
        falhas++;
      } else {
        corrigidos++;
      }

      resultados.push({
        cteId: cte.id,
        numeroCte: cte.numero || "S/N",
        nfeNumero: newMeta.nfe_numero || "S/N",
        corrigido: !updateError,
        erros,
        alteracoes,
      });
    } catch (err: any) {
      falhas++;
      resultados.push({
        cteId: cte.id,
        numeroCte: cte.numero || "S/N",
        nfeNumero: meta.nfe_numero || "S/N",
        corrigido: false,
        erros: [err.message],
        alteracoes: [],
      });
    }
  }

  return {
    romaneio: romaneioNumero,
    total: ctesRomaneio.length,
    corrigidos,
    falhas,
    resultados,
    erros: errosGerais,
  };
}
