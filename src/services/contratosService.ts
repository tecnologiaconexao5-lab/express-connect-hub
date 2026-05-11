import { supabase } from "@/lib/supabase";

export interface ContratoGerado {
  id: string;
  numero_contrato: string;
  prestador_id?: string;
  prestador_nome?: string;
  prestador_cpf?: string;
  prestador_cnpj?: string;
  prestador_rntrc?: string;
  prestador_telefone?: string;
  modelo_id?: string;
  tipo_contrato: string;
  status: "pendente" | "enviado" | "aceito_whatsapp" | "assinado" | "recusado" | "cancelado" | string;
  conteudo_html?: string;
  pdf_url?: string;
  hash_documento?: string;
  aceite_whatsapp?: boolean;
  aceite_whatsapp_data?: string;
  aceite_whatsapp_numero?: string;
  aceite_whatsapp_mensagem?: string;
  assinatura_eletronica?: boolean;
  assinatura_data?: string;
  assinatura_ip?: string;
  assinatura_navegador?: string;
  assinatura_geolocalizacao?: string;
  assinatura_imagem?: string;
  created_at: string;
  updated_at: string;
}

export interface ContratoModelo {
  id: string;
  nome: string;
  tipo: string;
  conteudo_base: string;
  variaveis: string[];
  ativa: boolean;
  versao?: number;
  criado_por?: string;
  created_at: string;
  updated_at?: string;
}

export interface ContratoHistorico {
  id: string;
  contrato_id: string;
  acao: string;
  descricao?: string;
  detalhes?: Record<string, any>;
  usuario?: string;
  ip?: string;
  created_at: string;
}

export interface VariaveisContrato {
  prestador_nome?: string;
  prestador_cpf?: string;
  prestador_cnpj?: string;
  prestador_rntrc?: string;
  prestador_telefone?: string;
  prestador_whatsapp?: string;
  prestador_placa?: string;
  prestador_modelo?: string;
  prestador_tipo_veiculo?: string;
  prestador_tipo_carga?: string;
  prestador_valor_saida?: string;
  prestador_endereco?: string;
  empresa_nome?: string;
  empresa_cnpj?: string;
  empresa_endereco?: string;
  data_atual: string;
}

// =====================================================
// GERADOR DE NÚMERO DE CONTRATO
// =====================================================
export async function gerarNumeroContrato(): Promise<string> {
  const BASE_CONTRATO_NUMERO = 869;
  const ano = new Date().getFullYear();

  try {
    // Buscar o maior número de contrato do ano atual
    const { data, error } = await supabase
      .from('contratos_gerados')
      .select('numero_contrato')
      .like('numero_contrato', `CTR-${ano}-%`)
      .order('numero_contrato', { ascending: false })
      .limit(1);

    if (error) throw error;

    let proximoNumero = BASE_CONTRATO_NUMERO;

    if (data && data.length > 0) {
      const ultimoNumeroStr = data[0].numero_contrato.split('-').pop();
      const ultimoNumero = parseInt(ultimoNumeroStr || "0");
      if (!isNaN(ultimoNumero)) {
        proximoNumero = Math.max(BASE_CONTRATO_NUMERO, ultimoNumero + 1);
      }
    }

    return `CTR-${ano}-${String(proximoNumero).padStart(6, '0')}`;
  } catch (error) {
    console.error("[ContratosService] Erro ao gerar número:", error);
    // Fallback seguro mas tentando manter a lógica
    return `CTR-${ano}-${String(BASE_CONTRATO_NUMERO).padStart(6, '0')}`;
  }
}

// =====================================================
// GERADOR DE HASH SHA256
// =====================================================
export async function gerarHashDocumento(conteudo: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(conteudo);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// =====================================================
// PARSER DE VARIÁVEIS DINÂMICAS
// =====================================================
export function parseVariables(
  template: string,
  variaveis: VariaveisContrato & { 
    numero_contrato?: string; 
    hash_documento?: string;
    franquia_km?: string;
    forma_pagamento?: string;
    periodicidade_pagamento?: string;
    pagamento_prazo?: string;
  }
): string {
  const ano = new Date().getFullYear();
  const numContrato = variaveis.numero_contrato || `CTR-${ano}-000869`;
  const numAnexo = numContrato.replace('CTR', 'ANX') + '-01';
  
  const replacements: Record<string, string> = {
    '{{prestador_nome}}': variaveis.prestador_nome || 'Não informado',
    '{{prestador_cpf}}': variaveis.prestador_cpf || 'Não informado',
    '{{prestador_cnpj}}': variaveis.prestador_cnpj || 'Não informado',
    '{{prestador_cpf_cnpj}}': variaveis.prestador_cpf || variaveis.prestador_cnpj || 'Não informado',
    '{{prestador_rg}}': 'Não informado',
    '{{prestador_rntrc}}': variaveis.prestador_rntrc || 'Não informado',
    '{{prestador_telefone}}': variaveis.prestador_telefone || 'Não informado',
    '{{prestador_whatsapp}}': variaveis.prestador_whatsapp || variaveis.prestador_telefone || 'Não informado',
    '{{prestador_email}}': 'Não informado',
    '{{prestador_endereco}}': variaveis.prestador_endereco || 'Não informado',
    '{{prestador_placa}}': variaveis.prestador_placa || 'Não informado',
    '{{prestador_modelo}}': variaveis.prestador_modelo || 'Não informado',
    '{{prestador_tipo_veiculo}}': variaveis.prestador_tipo_veiculo || 'Não informado',
    '{{prestador_tipo_carga}}': variaveis.prestador_tipo_carga || 'Não informado',
    '{{prestador_valor_saida}}': variaveis.prestador_valor_saida || 'A DEFINIR',
    '{{valor_saida}}': variaveis.prestador_valor_saida || 'A DEFINIR',
    '{{franquia_km}}': variaveis.franquia_km || '0 km',
    '{{valor_km_excedente}}': 'A DEFINIR',
    '{{forma_pagamento}}': variaveis.forma_pagamento || 'Pix',
    '{{periodicidade_pagamento}}': variaveis.periodicidade_pagamento || 'Quinzenal',
    '{{pagamento_prazo}}': variaveis.pagamento_prazo || '30 dias',
    '{{empresa_nome}}': variaveis.empresa_nome || 'Conexão Express Transportes LTDA',
    '{{empresa_cnpj}}': variaveis.empresa_cnpj || '31.227.975/0001-80',
    '{{empresa_endereco}}': variaveis.empresa_endereco || 'Avenida Goitacazes, 45, São Caetano do Sul/SP',
    '{{hash_empresa}}': `CE-EMPRESA-31227975000180`,
    '{{data_atual}}': variaveis.data_atual || new Date().toLocaleDateString('pt-BR'),
    '{{numero_contrato}}': numContrato,
    '{{numero_anexo}}': numAnexo,
    '{{hash_documento}}': variaveis.hash_documento || '[HASH]',
  };

  let conteudo = template;
  for (const [key, value] of Object.entries(replacements)) {
    // Previne "R$ R$ 0,00"
    if (value.startsWith("R$ ") && (conteudo.includes(`R$ ${key}`) || conteudo.includes(`R$${key}`))) {
      conteudo = conteudo.split(`R$ ${key}`).join(value);
      conteudo = conteudo.split(`R$${key}`).join(value);
    } else {
      conteudo = conteudo.split(key).join(value);
    }
  }

  // Limpeza final de variáveis não preenchidas
  conteudo = conteudo.replace(/\{\{[^}]+\}\}/g, "Não informado");

  return conteudo;
}

// =====================================================
// GERAR CONTEÚDO BASE DO CONTRATO
// =====================================================
export function gerarConteudoContrato(
  tipo: string,
  variaveis: VariaveisContrato
): string {
  const dataExtenso = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const variaveisParseadas = {
    ...variaveis,
    data_atual: dataExtenso
  };

  if (tipo === 'TAC') {
    return `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #F97316; margin: 0;">CONEXÃO EXPRESS</h1>
    <p style="color: #666; margin: 5px 0;">Transporte e Logística</p>
  </div>

  <h2 style="color: #333; border-bottom: 2px solid #F97316; padding-bottom: 10px;">
    CONTRATO DE TRANSPORTE AUTÔNOMO DE CARGA - TAC
  </h2>

  <p style="text-align: right; color: #666;">
    Nº: <strong>{{numero_contrato}}</strong><br>
    Data: {{data_atual}}
  </p>

  <h3 style="color: #F97316; margin-top: 30px;">1. PARTES</h3>
  <p><strong>CONTRATANTE:</strong> ${variaveisParseadas.empresa_nome}, CNPJ: ${variaveisParseadas.empresa_cnpj}, Endereço: ${variaveisParseadas.empresa_endereco}</p>
  <p><strong>CONTRATADO:</strong> ${variaveisParseadas.prestador_nome}, CPF: ${variaveisParseadas.prestador_cpf}</p>

  <h3 style="color: #F97316; margin-top: 30px;">2. OBJETO</h3>
  <p>Constitui objeto deste contrato a prestação de serviços de transporte de carga por meio de veículo próprio, sob regime autônomo, mediante as condições aqui pactuadas.</p>

  <h3 style="color: #F97316; margin-top: 30px;">3. VEICULO</h3>
  <p>Veículo: ${variaveisParseadas.prestador_modelo} - Placa: ${variaveisParseadas.prestador_placa}</p>
  <p>Tipo: ${variaveisParseadas.prestador_tipo_veiculo} - Carga: ${variaveisParseadas.prestador_tipo_carga}</p>

  <h3 style="color: #F97316; margin-top: 30px;">4. VALOR</h3>
  <p>Valor por viagem/saída: <strong>R$ ${variaveisParseadas.prestador_valor_saida}</strong></p>

  <h3 style="color: #F97316; margin-top: 30px;">5. OBRIGAÇÕES</h3>
  <p>5.1 - O contratado compromete-se a realizar o transporte com diligence e segurança.</p>
  <p>5.2 - O veículo deverá estar em perfeito estado de conservação e com documentação regular.</p>
  <p>5.3 - O contratado é responsável civil e criminalmente pela carga transportada.</p>

  <h3 style="color: #F97316; margin-top: 30px;">6. ACEITE</h3>
  <p>O aceite deste contrato via WhatsApp ou assinatura eletrônico tem valor jurídico equivalente à assinatura física, conforme Medida Provisória nº 2.200-2/2001 e Lei nº 11.419/2006.</p>

  <div style="margin-top: 50px; padding: 20px; border: 1px solid #ccc;">
    <p><strong>CONTRATADO:</strong> ${variaveisParseadas.prestador_nome}</p>
    <p><strong>CPF:</strong> ${variaveisParseadas.prestador_cpf}</p>
    <p><strong>Data do Aceite:</strong> {{data_atual}}</p>
  </div>

  <div style="margin-top: 20px; font-size: 10px; color: #999; text-align: center;">
    Hash de Validação: {{hash_documento}}<br>
    Este documento foi generado electronicamente e possui valor jurídicos.
  </div>
</div>`;
  }

  return `<div style="font-family: Arial, sans-serif; padding: 20px;">
    <h1>Contrato ${tipo}</h1>
    <p>Contrato de Transporte - ${variaveisParseadas.prestador_nome}</p>
  </div>`;
}

// =====================================================
// CRIAR CONTRATO
// =====================================================
export async function criarContrato(
  prestador: {
    id?: string;
    nome: string;
    cpf: string;
    cnpj?: string;
    rntrc?: string;
    telefone?: string;
    placa?: string;
    modelo?: string;
    tipo_veiculo?: string;
    tipo_carga?: string;
    valor_saida?: string | number;
    valor_diaria?: string | number;
    valor_fixo_mensal?: string | number;
    valorSaida?: string | number;
    valorDiaria?: string | number;
    diaria?: string | number;
  },
  tipoContrato: string = 'TAC'
): Promise<ContratoGerado | null> {
  try {
    // Lógica de prioridade para o valor do contrato
    const valorRaw = 
      prestador.valor_saida ||
      prestador.valorSaida ||
      prestador.valor_diaria ||
      prestador.valorDiaria ||
      prestador.diaria;
    
    const valorFormatado = valorRaw && valorRaw !== 0
      ? `R$ ${Number(valorRaw).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
      : 'A DEFINIR';

    const variaveis: VariaveisContrato = {
      prestador_nome: prestador.nome,
      prestador_cpf: prestador.cpf,
      prestador_cnpj: prestador.cnpj,
      prestador_rntrc: prestador.rntrc,
      prestador_telefone: prestador.telefone,
      prestador_whatsapp: prestador.telefone,
      prestador_placa: prestador.placa,
      prestador_modelo: prestador.modelo,
      prestador_tipo_veiculo: prestador.tipo_veiculo,
      prestador_tipo_carga: prestador.tipo_carga,
      prestador_valor_saida: valorFormatado,
      empresa_nome: 'Conexão Express Transportes LTDA',
      empresa_cnpj: '31.227.975/0001-80',
      empresa_endereco: 'Avenida Goitacazes, 45, São Caetano do Sul/SP',
      data_atual: new Date().toLocaleDateString('pt-BR'),
    };

    const conteudoHtml = gerarConteudoContrato(tipoContrato, variaveis);
    const hash = await gerarHashDocumento(conteudoHtml);
    const numeroContrato = await gerarNumeroContrato();

    const payload = {
      numero_contrato: numeroContrato,
      prestador_id: prestador.id || null,
      modelo_id: null,
      tipo_contrato: tipoContrato,
      prestador_nome: prestador.nome,
      prestador_cpf: prestador.cpf,
      prestador_cnpj: prestador.cnpj,
      prestador_rntrc: prestador.rntrc,
      prestador_telefone: prestador.telefone,
      conteudo_html: conteudoHtml,
      hash_documento: hash,
      status: 'pendente',
      valor_contrato: typeof valorRaw === 'number' ? valorRaw : (valorRaw ? parseFloat(String(valorRaw)) : null),
      metadata: {
        ...variaveis,
        valor_original: valorRaw
      }
    };

    console.log('[ContratosService] Payload insert:', JSON.stringify(payload, null, 2));

    const { data, error } = await supabase
      .from('contratos_gerados')
      .insert([payload])
      .select()
      .single();

    console.log('[ContratosService] INSERT DATA:', data);
    console.log('[ContratosService] INSERT ERROR:', error);

    if (error) throw error;

    try {
      await supabase.rpc('registrar_contrato_historico', {
        p_contrato_id: data.id,
        p_acao: 'criado',
        p_descricao: `Contrato ${numeroContrato} criado`,
        p_detalhes: JSON.stringify({ tipo: tipoContrato }),
      });
    } catch (histErr) {
      console.warn('[ContratosService] Erro ao registrar histórico (não crítico):', histErr);
    }

    return data;
  } catch (error) {
    console.error('[ContratosService] Erro ao criar contrato:', error);
    return null;
  }
}

// =====================================================
// ATUALIZAR STATUS DO CONTRATO
// =====================================================
export async function atualizarStatusContrato(
  id: string,
  novoStatus: string,
  detalhes: Record<string, any> = {}
): Promise<boolean> {
  try {
    const updateData: Record<string, any> = {
      status: novoStatus,
      updated_at: new Date().toISOString(),
    };

    if (novoStatus === 'enviado') {
      updateData.status = 'enviado';
    } else if (novoStatus === 'aceito_whatsapp') {
      updateData.aceite_whatsapp = true;
      updateData.aceite_whatsapp_data = new Date().toISOString();
      updateData.aceite_whatsapp_numero = detalhes.numero;
      updateData.aceite_whatsapp_mensagem = detalhes.mensagem;
    } else if (novoStatus === 'assinado') {
      updateData.assinatura_eletronica = true;
      updateData.assinatura_data = new Date().toISOString();
      updateData.assinatura_ip = detalhes.ip;
      updateData.assinatura_navegador = detalhes.navegador;
      updateData.assinatura_geolocalizacao = detalhes.geolocalizacao;
      updateData.assinatura_imagem = detalhes.assinatura;
    }

    const { error } = await supabase
      .from('contratos_gerados')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    await supabase.rpc('registrar_contrato_historico', {
      p_contrato_id: id,
      p_acao: novoStatus,
      p_descricao: `Status alterado para ${novoStatus}`,
      p_detalhes: JSON.stringify(detalhes),
    });

    return true;
  } catch (error) {
    console.error('[ContratosService] Erro ao atualizar status:', error);
    return false;
  }
}

// =====================================================
// LISTAR MODELOS DE CONTRATO (com ativo:true por padrão)
// =====================================================
export async function buscarModelosContratos(tipoFiltro?: string): Promise<ContratoModelo[]> {
  try {
    let query = supabase
      .from('contratos_modelos')
      .select('*')
      .eq('ativa', true)
      .order('created_at', { ascending: false });

    if (tipoFiltro) {
      query = query.eq('tipo', tipoFiltro);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[ContratosService] Erro ao buscar modelos:', error);
    return [];
  }
}

// =====================================================
// CRIAR MODELO DE CONTRATO
// =====================================================
export async function criarModeloContrato(payload: {
  nome: string;
  tipo: string;
  conteudo_base: string;
  variaveis: string[];
  ativa?: boolean;
}): Promise<ContratoModelo | null> {
  try {
    const insertPayload = {
      nome: payload.nome,
      tipo: payload.tipo,
      conteudo_base: payload.conteudo_base,
      variaveis: payload.variaveis,
      ativa: payload.ativa !== undefined ? payload.ativa : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('contratos_modelos')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error('[ContratosService] Erro ao criar modelo:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[ContratosService] Erro ao criar modelo:', error);
    return null;
  }
}

// =====================================================
// ATUALIZAR MODELO DE CONTRATO
// =====================================================
export async function atualizarModeloContrato(
  id: string,
  payload: Partial<{
    nome: string;
    tipo: string;
    conteudo_base: string;
    variaveis: string[];
    ativa: boolean;
  }>
): Promise<ContratoModelo | null> {
  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (payload.nome !== undefined) updatePayload.nome = payload.nome;
    if (payload.tipo !== undefined) updatePayload.tipo = payload.tipo;
    if (payload.conteudo_base !== undefined) updatePayload.conteudo_base = payload.conteudo_base;
    if (payload.variaveis !== undefined) updatePayload.variaveis = payload.variaveis;
    if (payload.ativa !== undefined) updatePayload.ativa = payload.ativa;

    const { data, error } = await supabase
      .from('contratos_modelos')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[ContratosService] Erro ao atualizar modelo:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('[ContratosService] Erro ao atualizar modelo:', error);
    return null;
  }
}

// =====================================================
// EXCLUIR MODELO DE CONTRATO (soft delete)
// =====================================================
export async function excluirModeloContrato(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('contratos_modelos')
      .update({ ativa: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[ContratosService] Erro ao excluir modelo:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('[ContratosService] Erro ao excluir modelo:', error);
    return false;
  }
}

// =====================================================
// BUSCAR CONTRATOS
// =====================================================
export async function buscarContratos(
  prestadorId?: string,
  status?: string,
  limit: number = 50
): Promise<ContratoGerado[]> {
  try {
    let query = supabase
      .from('contratos_gerados')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (prestadorId) {
      query = query.eq('prestador_id', prestadorId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[ContratosService] Erro ao buscar contratos:', error);
    return [];
  }
}

// =====================================================
// BUSCAR CONTRATO POR ID
// =====================================================
export async function buscarContratoPorId(
  id: string
): Promise<ContratoGerado | null> {
  try {
    const { data, error } = await supabase
      .from('contratos_gerados')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[ContratosService] Erro ao buscar contrato:', error);
    return null;
  }
}

// =====================================================
// BUSCAR HISTÓRICO DO CONTRATO
// =====================================================
export async function buscarHistoricoContrato(
  contratoId: string
): Promise<ContratoHistorico[]> {
  try {
    const { data, error } = await supabase
      .from('contratos_historico')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[ContratosService] Erro ao buscar histórico:', error);
    return [];
  }
}

// =====================================================
// ENVIAR PARA ACEITE WHATSAPP
// =====================================================
export async function enviarContratoWhatsApp(
  contratoId: string,
  telefone: string
): Promise<boolean> {
  try {
    const contrato = await buscarContratoPorId(contratoId);
    if (!contrato) throw new Error('Contrato não encontrado');

    const mensagem = `Olá ${contrato.prestador_nome},

Segue contrato operacional ${contrato.tipo_contrato} da Conexão Express Transportes.

Ao responder "LI E ACEITO" você declara concordância integral com as cláusulas contratuais apresentadas.

Contrato nº ${contrato.numero_contrato}

*Atenção: Esta mensagem possui valor jurídico conforme MP 2.200-2/2001.*`;

    const { error } = await supabase
      .from('contratos_gerados')
      .update({
        status: 'enviado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contratoId);

    if (error) throw error;

    await supabase.rpc('registrar_contrato_historico', {
      p_contrato_id: contratoId,
      p_acao: 'enviado_whatsapp',
      p_descricao: 'Contrato enviado para aceite via WhatsApp',
      p_detalhes: JSON.stringify({ telefone }),
    });

    console.log('[ContratosService] Mensagem para WhatsApp:', mensagem);
    return true;
  } catch (error) {
    console.error('[ContratosService] Erro ao enviar WhatsApp:', error);
    return false;
  }
}

// =====================================================
// CONFIRMAR ACEITE WHATSAPP
// =====================================================
export async function confirmarAceiteWhatsApp(
  contratoId: string,
  numero: string,
  mensagem: string
): Promise<boolean> {
  const mensagemLower = mensagem.toLowerCase().trim();
  
  if (!mensagemLower.includes('li e aceito') && !mensagemLower.includes('aceito')) {
    return false;
  }

  return await atualizarStatusContrato(contratoId, 'aceito_whatsapp', {
    numero,
    mensagem,
  });
}

// =====================================================
// REGISTRAR ASSINATURA ELETRÔNICA
// =====================================================
export async function registrarAssinatura(
  contratoId: string,
  assinatura: string,
  nome: string,
  cpf: string
): Promise<boolean> {
  try {
    const ip = await fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(d => d.ip)
      .catch(() => '0.0.0.0');

    const navegador = navigator.userAgent;
    
    let geolocalizacao = '';
    if (navigator.geolocation) {
      geolocalizacao = await new Promise<string>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
          () => resolve('')
        );
      }).catch(() => '');
    }

    const sucesso = await atualizarStatusContrato(contratoId, 'assinado', {
      assinatura,
      ip,
      navegador,
      geolocalizacao,
    });

    return sucesso;
  } catch (error) {
    console.error('[ContratosService] Erro ao registrar assinatura:', error);
    return false;
  }
}

// =====================================================
// SALVAR PDF NO STORAGE
// =====================================================
export async function salvarPDFStorage(
  contratoId: string,
  pdfBase64: string
): Promise<string | null> {
  try {
    const contrato = await buscarContratoPorId(contratoId);
    if (!contrato) throw new Error('Contrato não encontrado');

    const fileName = `${contrato.prestador_id || 'sem_prestador'}/${contrato.numero_contrato}.pdf`;
    const bucket = 'contratos';

    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    await supabase
      .from('contratos_gerados')
      .update({ pdf_url: publicUrl })
      .eq('id', contratoId);

    return publicUrl;
  } catch (error) {
    console.error('[ContratosService] Erro ao salvar PDF:', error);
    return null;
  }
}