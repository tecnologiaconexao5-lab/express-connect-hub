import { supabase } from "@/lib/supabase";

export async function gerarRascunhoMdfe(cteIds: string[]) {
  try {
    if (!cteIds.length) throw new Error("Selecione pelo menos 1 CT-e.");

    // 0. Verificar duplicidade
    const { data: mdfesAtivos } = await supabase
      .from("fiscal_mdfes")
      .select("id, metadata")
      .in("status", ["rascunho", "processando", "autorizado"]);

    const jaExiste = (mdfesAtivos || []).some((m: any) => {
      const vinculados: { cte_id: string }[] = m.metadata?.ctes_vinculados || [];
      return vinculados.some((v) => cteIds.includes(v.cte_id));
    });

    if (jaExiste) {
      return { success: false, error: "Já existe MDF-e para estes CT-es." };
    }

    const { data: ctes, error: cteErr } = await supabase
      .from("fiscal_ctes")
      .select("*")
      .in("id", cteIds);

    if (cteErr || !ctes?.length) throw new Error("CT-es nao encontrados.");

    const validacoes: { campo: string; mensagem: string; severidade: string }[] = [];

    // --- Extrair emitente do CT-e mais completo ---
    let emitente: any = null;
    let motorista: any = null;
    let veiculo: any = null;
    const motoristasEncontrados: any[] = [];
    const veiculosEncontrados: any[] = [];

    for (const ct of ctes) {
      const pf = ct.metadata?.payload_focus || {};

      // Emitente — pegar do primeiro CT-e que tiver
      if (!emitente?.nome && pf.emitente?.nome) {
        emitente = pf.emitente;
      }

      let mot = pf.motorista;
      let veic = pf.veiculo;

      // Se faltar motorista no CT-e, buscar da OS → prestador
      if ((!mot || !mot.nome) && ct.ordem_servico_id) {
        const osId = ct.ordem_servico_id;
        const { data: os } = await supabase
          .from("ordens_servico")
          .select("prestador_id, prestador, veiculo_alocado, veiculo_tipo")
          .eq("id", osId)
          .maybeSingle();

        if (os) {
          if (!mot || !mot.nome) {
            let nome: string | null = null;
            let cpf: string | null = null;

            if (os.prestador_id) {
              const { data: pres } = await supabase
                .from("prestadores")
                .select("nome_completo, cpf_cnpj")
                .eq("id", os.prestador_id)
                .maybeSingle();
              if (pres) {
                nome = pres.nome_completo || null;
                cpf = pres.cpf_cnpj || null;
              }
            } else if (os.prestador) {
              nome = os.prestador;
            }

            mot = { nome, cpf };
          }

          if ((!veic || !veic.placa) && os.veiculo_alocado) {
            let placa: string | null = null;
            let tipo: string | null = null;
            let renavam: string | null = null;
            let tara_kg: number | null = null;
            let capacidade_kg: number | null = null;
            let capacidade_m3: number | null = null;
            let uf_licenciamento: string | null = null;
            let tipo_rodado: string | null = null;
            let tipo_carroceria: string | null = null;

            // veiculo_alocado e UUID
            const { data: veicDb } = await supabase
              .from("veiculos")
              .select("placa, tipo_veiculo, renavam, tara_kg, capacidade_kg, capacidade_m3, uf_licenciamento, tipo_rodado, tipo_carroceria")
              .eq("id", os.veiculo_alocado)
              .maybeSingle();
            if (veicDb) {
              placa = veicDb.placa || null;
              tipo = veicDb.tipo_veiculo || os.veiculo_tipo || null;
              renavam = veicDb.renavam || null;
              tara_kg = veicDb.tara_kg ?? null;
              capacidade_kg = veicDb.capacidade_kg ?? null;
              capacidade_m3 = veicDb.capacidade_m3 ?? null;
              uf_licenciamento = veicDb.uf_licenciamento || null;
              tipo_rodado = veicDb.tipo_rodado || null;
              tipo_carroceria = veicDb.tipo_carroceria || null;
            } else {
              // fallback: tentar como placa
              const { data: veicByPlaca } = await supabase
                .from("veiculos")
                .select("placa, tipo_veiculo, renavam, tara_kg, capacidade_kg, capacidade_m3, uf_licenciamento, tipo_rodado, tipo_carroceria")
                .eq("placa", os.veiculo_alocado)
                .maybeSingle();
              if (veicByPlaca) {
                placa = veicByPlaca.placa || null;
                tipo = veicByPlaca.tipo_veiculo || os.veiculo_tipo || null;
                renavam = veicByPlaca.renavam || null;
                tara_kg = veicByPlaca.tara_kg ?? null;
                capacidade_kg = veicByPlaca.capacidade_kg ?? null;
                capacidade_m3 = veicByPlaca.capacidade_m3 ?? null;
                uf_licenciamento = veicByPlaca.uf_licenciamento || null;
                tipo_rodado = veicByPlaca.tipo_rodado || null;
                tipo_carroceria = veicByPlaca.tipo_carroceria || null;
              }
            }

            veic = {
              placa: placa || veic?.placa || null,
              tipo: tipo || veic?.tipo || os.veiculo_tipo || null,
              renavam: renavam || veic?.renavam || null,
              tara_kg: tara_kg ?? veic?.tara_kg ?? null,
              capacidade_kg: capacidade_kg ?? veic?.capacidade_kg ?? null,
              capacidade_m3: capacidade_m3 ?? veic?.capacidade_m3 ?? null,
              uf_licenciamento: uf_licenciamento || veic?.uf_licenciamento || null,
              tipo_rodado: tipo_rodado || veic?.tipo_rodado || null,
              tipo_carroceria: tipo_carroceria || veic?.tipo_carroceria || null,
            };
          }
        }
      }

      if (mot?.nome || mot?.cpf) motoristasEncontrados.push(mot);
      if (veic?.placa) veiculosEncontrados.push(veic);

      if (!motorista?.nome && mot?.nome) motorista = mot;
      if (!veiculo?.placa && veic?.placa) veiculo = veic;
    }

    // --- Validacoes ---
    if (!emitente?.nome)
      validacoes.push({ campo: "emitente", mensagem: "Emitente nao identificado nos CT-es", severidade: "erro" });

    // Verificar consistencia de motoristas
    const motNomes = new Set(motoristasEncontrados.map(function(m) { return m.nome; }).filter(Boolean));
    if (motNomes.size > 1) {
      validacoes.push({ campo: "motorista", mensagem: "CT-es selecionados possuem motoristas diferentes", severidade: "erro" });
    }
    if (motoristasEncontrados.length === 0 || !motorista?.nome) {
      validacoes.push({ campo: "motorista", mensagem: "Motorista nao identificado nos CT-es nem na OS", severidade: "erro" });
    }
    if (!motorista?.cpf) {
      validacoes.push({ campo: "motorista.cpf", mensagem: "CPF/CNPJ do motorista ausente", severidade: "erro" });
    }

    // Verificar consistencia de veiculos
    const veicPlacas = new Set(veiculosEncontrados.map(function(v) { return v.placa; }).filter(Boolean));
    if (veicPlacas.size > 1) {
      validacoes.push({ campo: "veiculo.placa", mensagem: "CT-es selecionados possuem veiculos diferentes", severidade: "erro" });
    }
    if (veiculosEncontrados.length === 0 || !veiculo?.placa) {
      validacoes.push({ campo: "veiculo.placa", mensagem: "Placa do veiculo ausente nos CT-es e na OS", severidade: "erro" });
    }
    if (!veiculo?.renavam) {
      validacoes.push({ campo: "veiculo.renavam", mensagem: "RENAVAM do veiculo ausente", severidade: "erro" });
    }
    if (!veiculo?.tara_kg) {
      validacoes.push({ campo: "veiculo.tara_kg", mensagem: "Tara do veiculo (kg) ausente", severidade: "erro" });
    }
    if (!veiculo?.capacidade_kg) {
      validacoes.push({ campo: "veiculo.capacidade_kg", mensagem: "Capacidade em kg do veiculo ausente", severidade: "erro" });
    }
    if (!veiculo?.uf_licenciamento) {
      validacoes.push({ campo: "veiculo.uf_licenciamento", mensagem: "UF de licenciamento do veiculo ausente", severidade: "erro" });
    }
    if (!veiculo?.tipo_rodado) {
      validacoes.push({ campo: "veiculo.tipo_rodado", mensagem: "Tipo de rodado do veiculo ausente", severidade: "erro" });
    }
    if (!veiculo?.tipo_carroceria) {
      validacoes.push({ campo: "veiculo.tipo_carroceria", mensagem: "Tipo de carroceria do veiculo ausente", severidade: "erro" });
    }

    // Verificar se todos os CT-es vinculados tem chave_acesso (autorizados)
    let todosAutorizados = true;
    for (const ct of ctes) {
      if (!ct.chave_acesso || ct.status !== "autorizado") {
        todosAutorizados = false;
        break;
      }
    }
    if (!todosAutorizados) {
      validacoes.push({
        campo: "ctes_vinculados.chave_acesso",
        mensagem: "MDF-e exige CT-e autorizado com chave de acesso. Todos os CT-es devem estar autorizados.",
        severidade: "erro",
      });
    }

    // --- Dados agregados ---
    const ufsOrigem = new Set<string>();
    const ufsDestino = new Set<string>();
    let valorTotal = 0;

    for (const ct of ctes) {
      const p = ct.metadata?.payload_focus || {};
      if (p.origem?.uf) ufsOrigem.add(p.origem.uf);
      if (p.destino?.uf) ufsDestino.add(p.destino.uf);
      valorTotal += p.valores?.valor_total ?? ct.valor ?? 0;
    }

    if (ufsOrigem.size === 0)
      validacoes.push({ campo: "uf_inicio", mensagem: "UF de origem nao identificada", severidade: "erro" });
    if (ufsDestino.size === 0)
      validacoes.push({ campo: "uf_fim", mensagem: "UF de destino nao identificada", severidade: "erro" });

    const metadata = {
      emitente,
      motorista,
      veiculo,
      ctes_vinculados: ctes.map(function(ct) {
        const p = ct.metadata?.payload_focus || {};
        return {
          cte_id: ct.id,
          cte_numero: ct.numero || p.os_numero || null,
          tomador: p.tomador?.nome || null,
          valor: ct.valor ?? 0,
          origem: p.origem?.cidade ? p.origem.cidade + "/" + (p.origem.uf || "") : null,
          destino: p.destino?.cidade ? p.destino.cidade + "/" + (p.destino.uf || "") : null,
          chave_acesso: ct.chave_acesso || null,
          status: ct.status || null,
        };
      }),
      emitente_id: ctes[0]?.metadata?.emitente_id || null,
      valor_total: valorTotal,
      uf_inicio: [...ufsOrigem].join(", ") || null,
      uf_fim: [...ufsDestino].join(", ") || null,
      qtde_ctes: ctes.length,
      validacoes_pendentes: validacoes,
      pronto_para_emissao: validacoes.length === 0,
    };

    const numero = "MDFE-" + Date.now().toString().slice(-8);

    const { data: mdfe, error: mdfeErr } = await supabase
      .from("fiscal_mdfes")
      .insert([{
        numero,
        valor: valorTotal,
        status: "rascunho",
        data_emissao: new Date().toISOString(),
        metadata,
      }])
      .select("*")
      .single();

    if (mdfeErr || !mdfe) throw new Error("Erro ao criar MDF-e: " + (mdfeErr?.message || ""));

    await supabase.from("fiscal_events").insert([{
      documento_tipo: "MDFE",
      documento_id: mdfe.id,
      tipo_evento: "CRIACAO_RASCUNHO_MDFE",
      descricao: "MDF-e rascunho gerado com " + ctes.length + " CT-e(s)",
      metadata: { cte_ids: cteIds, emitente_id: metadata.emitente_id, total_pendencias: validacoes.length },
    }]);

    await supabase.from("fiscal_logs").insert([{
      entidade_tipo: "MDFE",
      entidade_id: mdfe.id,
      acao: "GERAR_RASCUNHO_MDFE",
      request: { cte_ids: cteIds, qtde_ctes: ctes.length },
      response: { mdfe_id: mdfe.id, status: "sucesso", pendencias: validacoes.length },
    }]);

    return { success: true, mdfe };
  } catch (error: any) {
    console.error("[MdfeService] Erro:", error);
    return { success: false, error: error.message };
  }
}
