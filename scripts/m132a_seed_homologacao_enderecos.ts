// =============================================================
// MISSÃO 132-A — Seed de dados de homologação com endereços
// operacionais completos para validação do contrato
// OperationalAddress.
//
// Cria/atualiza dados para:
//   - OS-HML-DIRETA-001  (operação direta)
//   - OS-HML-ESCALA-001  (operação em escala)
//   - OS-HML-MULTI-001   (operação multi-paradas)
//
// Uso:
//   npx tsx scripts/m132a_seed_homologacao_enderecos.ts
// =============================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://uwrvzsjtpgaifkktpepn.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseKey) {
  console.error("[M132A] ERRO: SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY não configurada.");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ---- IDs conhecidos ----
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const PRESTADOR_TESTE_ID = "e6646799-fbac-453e-a3ef-afdfc01a7085";

// ---- Helpers ----
function operationalAddressJSON(data: Record<string, any>) {
  return {
    tipo_ponto: data.tipo_ponto || "coleta",
    nome_local: data.nome_local || null,
    sequencia: data.sequencia || 1,
    endereco: data.endereco || null,
    cep: data.cep || null,
    logradouro: data.logradouro || null,
    numero: data.numero || null,
    complemento: data.complemento || null,
    bairro: data.bairro || null,
    cidade: data.cidade || null,
    estado: data.estado || null,
    uf: data.uf || data.estado || null,
    endereco_formatado: data.endereco_formatado || null,
    referencia: data.referencia || null,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    contato_nome: data.contato_nome || null,
    contato_telefone: data.contato_telefone || null,
    responsavel: data.responsavel || null,
    recebedor_previsto: data.recebedor_previsto || null,
    janela_inicio: data.janela_inicio || null,
    janela_fim: data.janela_fim || null,
    horario_limite: data.horario_limite || null,
    instrucoes: data.instrucoes || null,
    observacoes: data.observacoes || null,
    procedimento_entrada: data.procedimento_entrada || null,
    procedimento_saida: data.procedimento_saida || null,
    portaria: data.portaria || null,
    doca: data.doca || null,
    estacionamento: data.estacionamento || null,
    documento_necessario: data.documento_necessario || null,
    codigo_acesso: data.codigo_acesso || null,
    exigencia_epi: data.exigencia_epi ?? false,
    exige_ajudante: data.exige_ajudante ?? false,
    restricao_veiculo: data.restricao_veiculo || null,
    restricao_altura: data.restricao_altura || null,
    outras_restricoes: data.outras_restricoes || null,
    restricoes: data.restricoes || null,
    prioridade: data.prioridade || "normal",
    agendamento: data.agendamento ?? false,
  };
}

async function garantirCliente(dados: {
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  cidade: string;
  uf: string;
}) {
  const { data: existente } = await sb
    .from("clientes")
    .select("id")
    .eq("cnpj", dados.cnpj)
    .maybeSingle();

  if (existente) {
    console.log(`[M132A] Cliente ${dados.nome_fantasia} já existe: ${existente.id}`);
    return existente.id;
  }

  const { data: novo, error } = await sb
    .from("clientes")
    .insert({
      tenant_id: TENANT_ID,
      nome_fantasia: dados.nome_fantasia,
      razao_social: dados.razao_social,
      cnpj: dados.cnpj,
      cidade: dados.cidade,
      uf: dados.uf,
      status: "Ativo",
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[M132A] Erro ao criar cliente ${dados.nome_fantasia}:`, error);
    throw error;
  }
  console.log(`[M132A] Cliente ${dados.nome_fantasia} criado: ${novo.id}`);
  return novo.id;
}

async function garantirOS(osData: Record<string, any>, enderecos: any[]) {
  const numero = osData.numero;

  const { data: existente } = await sb
    .from("ordens_servico")
    .select("id, enderecos")
    .eq("numero", numero)
    .maybeSingle();

  if (existente) {
    // Atualizar enderecos se já existe
    const { error } = await sb
      .from("ordens_servico")
      .update({ enderecos: enderecos })
      .eq("id", existente.id);

    if (error) {
      console.error(`[M132A] Erro ao atualizar enderecos da OS ${numero}:`, error);
      return null;
    }
    console.log(`[M132A] OS ${numero} atualizada com enderecos: ${existente.id}`);

    // Atualizar alocacao existente com endereco_origem/destino
    const coleta = enderecos.find((e: any) => e.tipo === "coleta" || e.tipo === "origem");
    const entrega = enderecos.find((e: any) => e.tipo === "entrega" || e.tipo === "destino");

    if (coleta || entrega) {
      const { data: alocacoes } = await sb
        .from("alocacoes_escala")
        .select("id")
        .eq("ordem_servico_id", existente.id)
        .limit(1);

      if (alocacoes && alocacoes.length > 0) {
        const alocUpdate: Record<string, any> = {};
        if (coleta) {
          alocUpdate.endereco_origem = operationalAddressJSON(coleta);
          alocUpdate.origem = `${coleta.logradouro || ""}, ${coleta.numero || ""} - ${coleta.bairro || ""}, ${coleta.cidade || ""}/${coleta.uf || coleta.estado || ""}`;
        }
        if (entrega) {
          alocUpdate.endereco_destino = operationalAddressJSON(entrega);
          alocUpdate.destino = `${entrega.logradouro || ""}, ${entrega.numero || ""} - ${entrega.bairro || ""}, ${entrega.cidade || ""}/${entrega.uf || entrega.estado || ""}`;
        }
        await sb.from("alocacoes_escala").update(alocUpdate).eq("id", alocacoes[0].id);
        console.log(`[M132A] Alocação ${alocacoes[0].id} atualizada com enderecos operacionais`);
      }
    }

    return existente.id;
  }

  // Criar nova OS
  const { data: nova, error } = await sb
    .from("ordens_servico")
    .insert({
      tenant_id: TENANT_ID,
      numero: numero,
      cliente_id: osData.cliente_id,
      cliente: osData.cliente_nome || "Cliente Homologação",
      status: osData.status || "pendente",
      tipo_operacao: osData.tipo_operacao || "Coleta e Entrega",
      data: osData.data || new Date().toISOString(),
      enderecos: enderecos,
      volumes: osData.volumes || 10,
      peso: osData.peso || 100,
      carga_descricao: osData.carga_descricao || "Carga de homologação",
      instrucoes_operacionais_os: osData.instrucoes_operacionais_os || null,
      observacoes_gerais: osData.observacoes_gerais || null,
      veiculo_tipo: osData.veiculo_tipo || "VUC",
      valor_cliente: osData.valor_cliente || 500,
      custo_prestador: osData.custo_prestador || 300,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[M132A] Erro ao criar OS ${numero}:`, error);
    return null;
  }
  console.log(`[M132A] OS ${numero} criada: ${nova.id}`);
  return nova.id;
}

async function garantirAlocacao(osId: string, prestadorId: string, dados: {
  data_escala: string;
  endereco_origem: any;
  endereco_destino: any;
  status?: string;
  tipo_veiculo?: string;
  valor_frete?: number;
  valor_repasse?: number;
}) {
  const { data: existente } = await sb
    .from("alocacoes_escala")
    .select("id")
    .eq("ordem_servico_id", osId)
    .maybeSingle();

  const origemStr = dados.endereco_origem
    ? `${dados.endereco_origem.logradouro || ""}, ${dados.endereco_origem.numero || ""} - ${dados.endereco_origem.bairro || ""}, ${dados.endereco_origem.cidade || ""}/${dados.endereco_origem.uf || ""}`
    : null;
  const destinoStr = dados.endereco_destino
    ? `${dados.endereco_destino.logradouro || ""}, ${dados.endereco_destino.numero || ""} - ${dados.endereco_destino.bairro || ""}, ${dados.endereco_destino.cidade || ""}/${dados.endereco_destino.uf || ""}`
    : null;

  const payload = {
    ordem_servico_id: osId,
    prestador_id: prestadorId,
    data_escala: dados.data_escala,
    status: dados.status || "aceita",
    tipo_veiculo: dados.tipo_veiculo || "VUC",
    valor_frete: dados.valor_frete || 500,
    valor_repasse: dados.valor_repasse || 300,
    origem: origemStr,
    destino: destinoStr,
    endereco_origem: dados.endereco_origem ? operationalAddressJSON(dados.endereco_origem) : null,
    endereco_destino: dados.endereco_destino ? operationalAddressJSON(dados.endereco_destino) : null,
    metadata: { origem: "homologacao_m132a" },
  };

  if (existente) {
    const { error } = await sb.from("alocacoes_escala").update(payload).eq("id", existente.id);
    if (error) {
      console.error(`[M132A] Erro ao atualizar alocacao para OS ${osId}:`, error);
      return;
    }
    console.log(`[M132A] Alocação ${existente.id} atualizada`);
  } else {
    const { data: nova, error } = await sb.from("alocacoes_escala").insert([payload]).select("id").single();
    if (error) {
      console.error(`[M132A] Erro ao criar alocacao para OS ${osId}:`, error);
      return;
    }
    console.log(`[M132A] Alocação criada: ${nova.id}`);
  }
}

async function criarParadas(rotaId: string | null, paradas: any[]) {
  if (!rotaId) return;

  // Remover paradas antigas
  await sb.from("rota_paradas").delete().eq("rota_id", rotaId);

  for (let i = 0; i < paradas.length; i++) {
    const p = paradas[i];
    const { error } = await sb.from("rota_paradas").insert({
      rota_id: rotaId,
      sequencia: i + 1,
      cliente_nome: p.cliente_nome || "Cliente Homologação",
      endereco: p.endereco,
      numero: p.numero,
      bairro: p.bairro,
      cidade: p.cidade,
      uf: p.uf,
      cep: p.cep,
      complemento: p.complemento || null,
      referencia: p.referencia || null,
      latitude: p.latitude || null,
      longitude: p.longitude || null,
      contato: p.contato || null,
      contato_nome: p.contato_nome || null,
      contato_telefone: p.contato_telefone || null,
      instrucoes: p.instrucoes || null,
      portaria: p.portaria || null,
      doca: p.doca || null,
      procedimento_entrada: p.procedimento_entrada || null,
      procedimento_saida: p.procedimento_saida || null,
      prioridade: p.prioridade || "normal",
      janela_entrega: p.janela_entrega || null,
      janela_inicio: p.janela_inicio || null,
      janela_fim: p.janela_fim || null,
      volumes: p.volumes || 0,
      peso: p.peso || 0,
      status: "pendente",
      restricao_veiculo: p.restricao_veiculo || null,
      restricao_altura: p.restricao_altura || null,
      exigencia_epi: p.exigencia_epi ?? false,
      exige_ajudante: p.exige_ajudante ?? false,
    });

    if (error) {
      console.error(`[M132A] Erro ao criar parada ${i + 1} da rota ${rotaId}:`, error);
    } else {
      console.log(`[M132A] Parada ${i + 1} criada na rota ${rotaId}`);
    }
  }
}

// =============================================================
// MAIN
// =============================================================
async function main() {
  console.log("[M132A] Iniciando seed de homologação de endereços operacionais...\n");

  // 1. Garantir cliente DVL (base para homologação)
  const clienteId = await garantirCliente({
    nome_fantasia: "DVL DISTRIBUIDORA",
    razao_social: "DVL DISTRIBUIDORA LTDA",
    cnpj: "12.345.678/0001-90",
    cidade: "São Paulo",
    uf: "SP",
  });

  const clienteHMLLabel = "Cliente Homologação Paulista";

  // =============================================================
  // OS-HML-DIRETA-001 — Operação Direta
  // =============================================================
  console.log("\n--- OS-HML-DIRETA-001 ---");

  const dirEnderecos = [
    {
      sequencia: 1,
      tipo: "coleta",
      nomeLocal: "Centro de Distribuição Guarulhos",
      logradouro: "Rua Jamil João Zarif",
      numero: "684",
      complemento: "Unidades 20 a 23",
      bairro: "Jardim Santa Vicência",
      cidade: "Guarulhos",
      estado: "SP",
      uf: "SP",
      cep: "07190-000",
      referencia: "Próximo ao acesso do Aeroporto de Guarulhos",
      portaria: "Portaria de cargas",
      doca: "Confirmar no local",
      instrucoes: "Apresentar documento na portaria e aguardar orientação da operação.",
      endereco: "Rua Jamil João Zarif, 684 - Jardim Santa Vicência, Guarulhos/SP",
      janelaInicio: "06:00",
      janelaFim: "12:00",
      latitude: -23.4321,
      longitude: -46.5012,
      agendamento: true,
      statusPonto: "pendente",
      observacoes: "",
      contato: "",
      contatoNome: "Portaria CD Guarulhos",
      contatoTelefone: "(11) 4000-0001",
      exigenciaEpi: true,
      documentoNecessario: "Documento com foto e CTE",
    },
    {
      sequencia: 2,
      tipo: "entrega",
      nomeLocal: clienteHMLLabel,
      logradouro: "Avenida Paulista",
      numero: "1000",
      complemento: "Entrada de cargas pela lateral",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      estado: "SP",
      uf: "SP",
      cep: "01310-100",
      referencia: "Próximo à estação Trianon-Masp",
      contatoNome: "Recebimento Homologação",
      contatoTelefone: "(11) 99999-0001",
      instrucoes: "Confirmar o responsável antes de iniciar o descarregamento.",
      endereco: "Avenida Paulista, 1000 - Bela Vista, São Paulo/SP",
      janelaInicio: "08:00",
      janelaFim: "17:00",
      latitude: -23.5610,
      longitude: -46.6560,
      agendamento: true,
      statusPonto: "pendente",
      observacoes: "",
      contato: "",
      portaria: "Portaria principal - acesso de cargas pela lateral",
      doca: "Doca 03 - aguardar liberação",
      procedimentoEntrada: "Anunciar na portaria principal. Seguir para doca 03. Aguardar conferência documental.",
      procedimentoSaida: "Após descarregamento, retirar canhoto na portaria.",
      exigenciaEpi: true,
      exigenciaEpi: false,
      exigeAjudante: true,
      restricaoVeiculo: "VUC ou caminhão de pequeno porte",
      restricaoAltura: "3.5m",
    },
  ];

  // Fix: remover duplicata de exigenciaEpi
  delete dirEnderecos[1].exigenciaEpi;

  const dirOsId = await garantirOS(
    {
      numero: "OS-HML-DIRETA-001",
      cliente_id: clienteId,
      cliente_nome: clienteHMLLabel,
      tipo_operacao: "Coleta e Entrega",
      status: "pendente",
      volumes: 50,
      peso: 500,
      carga_descricao: "Produtos diversos para homologação",
      veiculo_tipo: "VUC",
      valor_cliente: 850.00,
      custo_prestador: 520.00,
    },
    dirEnderecos
  );

  if (dirOsId) {
    await garantirAlocacao(dirOsId, PRESTADOR_TESTE_ID, {
      data_escala: new Date().toISOString().split("T")[0],
      endereco_origem: dirEnderecos[0],
      endereco_destino: dirEnderecos[1],
      status: "aceita",
      valor_frete: 850.00,
      valor_repasse: 520.00,
    });
  }

  // =============================================================
  // OS-HML-ESCALA-001 — Operação em Escala
  // =============================================================
  console.log("\n--- OS-HML-ESCALA-001 ---");

  const escEnderecos = [
    {
      sequencia: 1,
      tipo: "coleta",
      nomeLocal: "CD Homologação Osasco",
      logradouro: "Rua da Logística",
      numero: "500",
      complemento: "Galpão B",
      bairro: "Jardim das Flores",
      cidade: "Osasco",
      estado: "SP",
      uf: "SP",
      cep: "06200-000",
      referencia: "Próximo ao Shopping União",
      portaria: "Portaria 2 - Galpão B",
      doca: "Doca 05",
      instrucoes: "Carregamento programado das 06h às 10h.",
      endereco: "Rua da Logística, 500 - Jardim das Flores, Osasco/SP",
      janelaInicio: "06:00",
      janelaFim: "10:00",
      latitude: -23.5320,
      longitude: -46.7910,
      contatoNome: "Expedição Homologação",
      contatoTelefone: "(11) 99999-0002",
      agendamento: true,
      statusPonto: "pendente",
      observacoes: "",
      contato: "",
      documentoNecessario: "CTE e NF",
      codigoAcesso: "SENHA-789",
    },
    {
      sequencia: 2,
      tipo: "entrega",
      nomeLocal: "Depósito Homologação Zona Sul",
      logradouro: "Avenida Interlagos",
      numero: "2500",
      complemento: "Loja 5 - Recebimento",
      bairro: "Interlagos",
      cidade: "São Paulo",
      estado: "SP",
      uf: "SP",
      cep: "04770-000",
      referencia: "Próximo ao autódromo",
      contatoNome: "Almoxarifado Homologação",
      contatoTelefone: "(11) 99999-0003",
      instrucoes: "Descarregamento com agendamento. Confirmar 30min antes.",
      endereco: "Avenida Interlagos, 2500 - Interlagos, São Paulo/SP",
      janelaInicio: "13:00",
      janelaFim: "17:00",
      latitude: -23.7200,
      longitude: -46.6960,
      portaria: "Portaria de entregas - acesso pela marginal",
      doca: "Doca 02",
      procedimentoEntrada: "Informar na guarita. Estacionar na doca 02. Aguardar conferência.",
      procedimentoSaida: "Sair pela portaria de entregas.",
      exigenciaEpi: true,
      restricaoVeiculo: "Caminhão até 12t",
      agendamento: true,
      statusPonto: "pendente",
      observacoes: "",
      contato: "",
    },
  ];

  const escOsId = await garantirOS(
    {
      numero: "OS-HML-ESCALA-001",
      cliente_id: clienteId,
      cliente_nome: "Depósito Homologação Zona Sul",
      tipo_operacao: "Coleta e Entrega",
      status: "agendada",
      volumes: 30,
      peso: 2000,
      carga_descricao: "Materiais de construção para homologação",
      veiculo_tipo: "Toco",
      valor_cliente: 1200.00,
      custo_prestador: 750.00,
    },
    escEnderecos
  );

  if (escOsId) {
    await garantirAlocacao(escOsId, PRESTADOR_TESTE_ID, {
      data_escala: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      endereco_origem: escEnderecos[0],
      endereco_destino: escEnderecos[1],
      status: "aceita",
      tipo_veiculo: "Toco",
      valor_frete: 1200.00,
      valor_repasse: 750.00,
    });
  }

  // =============================================================
  // OS-HML-MULTI-001 — Operação Multi-paradas
  // =============================================================
  console.log("\n--- OS-HML-MULTI-001 ---");

  const multiEnderecos = [
    {
      sequencia: 1,
      tipo: "coleta",
      nomeLocal: "CD Homologação Guarulhos",
      logradouro: "Estrada do Caminho Aéreo",
      numero: "1500",
      complemento: "Galpão Central",
      bairro: "Jardim Fortaleza",
      cidade: "Guarulhos",
      estado: "SP",
      uf: "SP",
      cep: "07140-000",
      referencia: "Próximo ao Campo de Marte",
      portaria: "Portaria única",
      doca: "Doca 01 a 04",
      instrucoes: "Carregamento geral. Conferir documentação com segurança.",
      endereco: "Estrada do Caminho Aéreo, 1500 - Jardim Fortaleza, Guarulhos/SP",
      janelaInicio: "05:00",
      janelaFim: "08:00",
      latitude: -23.4680,
      longitude: -46.5330,
      contatoNome: "Expedição CD",
      contatoTelefone: "(11) 99999-0004",
      agendamento: true,
      statusPonto: "pendente",
      observacoes: "",
      contato: "",
    },
    {
      sequencia: 2,
      tipo: "entrega",
      nomeLocal: "Filial Homologação Zona Norte",
      logradouro: "Avenida Engenheiro Caetano Álvares",
      numero: "3200",
      bairro: "Limão",
      cidade: "São Paulo",
      estado: "SP",
      uf: "SP",
      cep: "02730-000",
      referencia: "Próximo ao CEAGESP",
      contatoNome: "Homologação Norte",
      contatoTelefone: "(11) 99999-0005",
      instrucoes: "Entrega com paleteira. Descarregamento rápido.",
      endereco: "Avenida Engenheiro Caetano Álvares, 3200 - Limão, São Paulo/SP",
      janelaInicio: "09:00",
      janelaFim: "12:00",
      latitude: -23.4930,
      longitude: -46.6430,
      portaria: "Portaria de carga/descarga",
      doca: "Doca 01",
      volumes: 15,
      peso: 300,
      prioridade: "alta",
      statusPonto: "pendente",
      observacoes: "",
      contato: "",
    },
    {
      sequencia: 3,
      tipo: "entrega",
      nomeLocal: "Filial Homologação Zona Oeste",
      logradouro: "Rua Pio XI",
      numero: "1800",
      bairro: "Alto da Lapa",
      cidade: "São Paulo",
      estado: "SP",
      uf: "SP",
      cep: "05060-000",
      referencia: "Próximo ao Hospital São Camilo",
      contatoNome: "Homologação Oeste",
      contatoTelefone: "(11) 99999-0006",
      instrucoes: "Entregar no almoxarifado. Campainha no portão lateral.",
      endereco: "Rua Pio XI, 1800 - Alto da Lapa, São Paulo/SP",
      janelaInicio: "13:00",
      janelaFim: "15:00",
      latitude: -23.5340,
      longitude: -46.6800,
      portaria: "Portão lateral - sinalizar entregas",
      volumes: 10,
      peso: 200,
      prioridade: "normal",
      exigenciaEpi: true,
      statusPonto: "pendente",
      observacoes: "",
      contato: "",
    },
  ];

  const multiOsId = await garantirOS(
    {
      numero: "OS-HML-MULTI-001",
      cliente_id: clienteId,
      cliente_nome: "Homologação Multi-paradas",
      tipo_operacao: "Distribuição",
      status: "agendada",
      volumes: 35,
      peso: 800,
      carga_descricao: "Carga rateada para múltiplas filiais",
      veiculo_tipo: "VUC",
      instrucoes_operacionais_os: "Rota homologação multi-paradas. Respeitar ordem das paradas.",
      valor_cliente: 1500.00,
      custo_prestador: 950.00,
    },
    multiEnderecos
  );

  if (multiOsId) {
    await garantirAlocacao(multiOsId, PRESTADOR_TESTE_ID, {
      data_escala: new Date(Date.now() + 172800000).toISOString().split("T")[0],
      endereco_origem: multiEnderecos[0],
      endereco_destino: multiEnderecos[multiEnderecos.length - 1],
      status: "aceita",
      valor_frete: 1500.00,
      valor_repasse: 950.00,
    });

    // Criar rota para multi-paradas
    const { data: rota } = await sb.from("rotas").insert({
      nome: "Rota Homologação Multi-paradas",
      prestador_id: PRESTADOR_TESTE_ID,
      os_id: multiOsId,
      status: "em_andamento",
      operation_mode: "multi_stop_route",
      numero_paradas: multiEnderecos.length - 1,
      paradas_pendentes: multiEnderecos.length - 1,
      distancia_km: 65,
      metadata: { origem: "homologacao_m132a" },
    }).select("id").single();

    if (rota) {
      // Parada 1
      await criarParadas(rota.id, [
        {
          ...multiEnderecos[1],
          cliente_nome: "Filial Homologação Zona Norte",
          volumes: 15,
          peso: 300,
          prioridade: "alta",
          janela_entrega: "09:00-12:00",
        },
        {
          ...multiEnderecos[2],
          cliente_nome: "Filial Homologação Zona Oeste",
          volumes: 10,
          peso: 200,
          prioridade: "normal",
          janela_entrega: "13:00-15:00",
        },
      ]);
    }
  }

  console.log("\n[M132A] ✅ Seed de homologação concluído!");
  console.log("[M132A] OS criadas/atualizadas:");
  console.log("   OS-HML-DIRETA-001 — Operação Direta");
  console.log("   OS-HML-ESCALA-001 — Operação em Escala");
  console.log("   OS-HML-MULTI-001 — Operação Multi-paradas");
  console.log("\n[M132A] O contrato OperationalAddress está disponível nas colunas:");
  console.log("   ordens_servico.enderecos (JSONB array)");
  console.log("   alocacoes_escala.endereco_origem (JSONB)");
  console.log("   alocacoes_escala.endereco_destino (JSONB)");
  console.log("   rota_paradas (colunas estruturadas)");
}

main().catch((err) => {
  console.error("[M132A] Erro fatal:", err);
  process.exit(1);
});
