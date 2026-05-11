import { supabase } from "@/lib/supabase";

export interface PedidoPortal {
  id: string;
  cliente_id?: string;
  numero_pedido: string;
  status: "rascunho" | "enviado" | "em_analise" | "programado" | "coleta" | "em_rota" | "entregue" | "cancelado";
  
  // Solicitante
  solicitante_nome?: string;
  solicitante_email?: string;
  solicitante_telefone?: string;
  
  // Unidade
  filial?: string;
  centro_custo?: string;
  
  // Prioridade
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  
  // Coleta
  coleta_cep?: string;
  coleta_rua?: string;
  coleta_numero?: string;
  coleta_complemento?: string;
  coleta_bairro?: string;
  coleta_cidade?: string;
  coleta_uf?: string;
  coleta_referencia?: string;
  coleta_data?: string;
  
  // Entrega
  entrega_destinatario?: string;
  entrega_telefone?: string;
  entrega_email?: string;
  entrega_notificar_whatsapp?: boolean;
  entrega_notificar_email?: boolean;
  entrega_cep?: string;
  entrega_rua?: string;
  entrega_numero?: string;
  entrega_complemento?: string;
  entrega_bairro?: string;
  entrega_cidade?: string;
  entrega_uf?: string;
  entrega_referencia?: string;
  entrega_data?: string;
  
  // Mercadoria
  descricao?: string;
  volumes?: number;
  peso?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  valor_declarado?: number;
  tipo_carga?: string;
  observacoes?: string;
  
  // Inteligência
  veiculo_sugerido?: string;
  prazo_estimado?: string;
  
  // Automação
  payload_n8n?: Record<string, any>;
  os_vinculada_id?: string;
  metadata?: Record<string, any>;
  
  created_at: string;
  updated_at: string;
}

export interface PedidoFormData {
  // Solicitante
  solicitante_nome?: string;
  solicitante_email?: string;
  solicitante_telefone?: string;
  
  // Unidade
  filial?: string;
  centro_custo?: string;
  
  // Prioridade
  prioridade?: string;
  
  // Coleta
  coleta_cep?: string;
  coleta_rua?: string;
  coleta_numero?: string;
  coleta_complemento?: string;
  coleta_bairro?: string;
  coleta_cidade?: string;
  coleta_uf?: string;
  coleta_referencia?: string;
  coleta_data?: string;
  
  // Entrega
  entrega_destinatario?: string;
  entrega_telefone?: string;
  entrega_email?: string;
  entrega_notificar_whatsapp?: boolean;
  entrega_notificar_email?: boolean;
  entrega_cep?: string;
  entrega_rua?: string;
  entrega_numero?: string;
  entrega_complemento?: string;
  entrega_bairro?: string;
  entrega_cidade?: string;
  entrega_uf?: string;
  entrega_referencia?: string;
  entrega_data?: string;
  
  // Mercadoria
  descricao?: string;
  volumes?: number;
  peso?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  valor_declarado?: number;
  tipo_carga?: string;
  observacoes?: string;
}

// =====================================================
// SUGESTÃO DE VEÍCULO
// =====================================================
export function sugerirVeiculo(peso: number, tipoCarga?: string): string {
  if (!peso || peso <= 0) return "Consulte";
  
  if (tipoCarga?.toLowerCase().includes('refrigerado') || tipoCarga?.toLowerCase().includes('frio')) {
    if (peso <= 500) return "Van Refrigerada";
    if (peso <= 1500) return "HR Refrigerada";
    return "Truck Refrigerado";
  }
  
  if (peso <= 20) return "Moto";
  if (peso <= 150) return "Moto + Baú";
  if (peso <= 400) return "Fiorino";
  if (peso <= 800) return "Van";
  if (peso <= 1500) return "HR";
  if (peso <= 3000) return "VUC";
  if (peso <= 6000) return "Truck 3/4";
  if (peso <= 10000) return "Truck";
  return "Carreta";
}

// =====================================================
// ESTIMATIVA DE PRAZO
// =====================================================
export function estimarPrazo(origem: string, destino: string): string {
  if (!origem || !destino) return "A definir";
  
  const mismaRegiao = origem.toLowerCase() === destino.toLowerCase();
  
  if (mismaRegiao) {
    return "2-4 horas";
  }
  
  const mesmaUF = dados.coleta_uf?.toLowerCase() === dados.entrega_uf?.toLowerCase(); 
  if (mesmaUF) {
    return "Same-day ou 24h";
  }
  
  return "24-48 horas";
}

// =====================================================
// CRIAR PEDIDO
// =====================================================
export async function criarPedidoPortal(
  dados: PedidoFormData,
  clienteId?: string
): Promise<PedidoPortal | null> {
  try {
    // Gerar número do pedido
    const { data: numeroData, error: numeroError } = await supabase.rpc('gerar_numero_pedido');
    if (numeroError) throw numeroError;
    const numeroPedido = numeroData || `PED-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`;
    
    // Calcular sugestões
    const veiculoSugerido = sugerirVeiculo(dados.peso, dados.tipo_carga);
    const prazoEstimado = estimarPrazo(dados.coleta_cidade, dados.entrega_cidade);
    
    // Gerar payload n8n
    const payloadN8n = {
      setor: "portal_cliente",
      evento: "novo_pedido",
      pedido_id: null,
      cliente_id: clienteId,
      coleta: {
        cep: dados.coleta_cep,
        rua: dados.coleta_rua,
        numero: dados.coleta_numero,
        complemento: dados.coleta_complemento,
        bairro: dados.coleta_bairro,
        cidade: dados.coleta_cidade,
        uf: dados.coleta_uf,
        referencia: dados.coleta_referencia,
        data: dados.coleta_data,
      },
      entrega: {
        destinatario: dados.entrega_destinatario,
        telefone: dados.entrega_telefone,
        email: dados.entrega_email,
        notificar_whatsapp: dados.entrega_notificar_whatsapp,
        notificar_email: dados.entrega_notificar_email,
        cep: dados.entrega_cep,
        rua: dados.entrega_rua,
        numero: dados.entrega_numero,
        complemento: dados.entrega_complemento,
        bairro: dados.entrega_bairro,
        cidade: dados.entrega_cidade,
        uf: dados.entrega_uf,
        referencia: dados.entrega_referencia,
        data: dados.entrega_data,
      },
      mercadoria: {
        descricao: dados.descricao,
        volumes: dados.volumes,
        peso: dados.peso,
        dimensoes: {
          comprimento: dados.comprimento,
          largura: dados.largura,
          altura: dados.altura,
        },
        valor_declarado: dados.valor_declarado,
        tipo_carga: dados.tipo_carga,
        observacoes: dados.observacoes,
      },
      prioridade: dados.prioridade || "normal",
      veiculo_sugerido: veiculoSugerido,
      prazo_estimado: prazoEstimado,
      criado_em: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('portal_pedidos')
      .insert([{
        cliente_id: clienteId,
        numero_pedido: numeroPedido,
        status: 'enviado',
        
        // Solicitante
        solicitante_nome: dados.solicitante_nome,
        solicitante_email: dados.solicitante_email,
        solicitante_telefone: dados.solicitante_telefone,
        
        // Unidade
        filial: dados.filial,
        centro_custo: dados.centro_custo,
        
        // Prioridade
        prioridade: dados.prioridade || 'normal',
        
        // Coleta
        coleta_cep: dados.coleta_cep,
        coleta_rua: dados.coleta_rua,
        coleta_numero: dados.coleta_numero,
        coleta_complemento: dados.coleta_complemento,
        coleta_bairro: dados.coleta_bairro,
        coleta_cidade: dados.coleta_cidade,
        coleta_uf: dados.coleta_uf,
        coleta_referencia: dados.coleta_referencia,
        coleta_data: dados.coleta_data,
        
        // Entrega
        entrega_destinatario: dados.entrega_destinatario,
        entrega_telefone: dados.entrega_telefone,
        entrega_email: dados.entrega_email,
        entrega_notificar_whatsapp: dados.entrega_notificar_whatsapp,
        entrega_notificar_email: dados.entrega_notificar_email,
        entrega_cep: dados.entrega_cep,
        entrega_rua: dados.entrega_rua,
        entrega_numero: dados.entrega_numero,
        entrega_complemento: dados.entrega_complemento,
        entrega_bairro: dados.entrega_bairro,
        entrega_cidade: dados.entrega_cidade,
        entrega_uf: dados.entrega_uf,
        entrega_referencia: dados.entrega_referencia,
        entrega_data: dados.entrega_data,
        
        // Mercadoria
        descricao: dados.descricao,
        volumes: dados.volumes || 1,
        peso: dados.peso || 0,
        comprimento: dados.comprimento,
        largura: dados.largura,
        altura: dados.altura,
        valor_declarado: dados.valor_declarado,
        tipo_carga: dados.tipo_carga,
        observacoes: dados.observacoes,
        
        // Inteligência
        veiculo_sugerido: veiculoSugerido,
        prazo_estimado: prazoEstimado,
        
        // Automação
        payload_n8n: payloadN8n,
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('[PedidosService] Erro ao criar pedido:', error);
    return null;
  }
}

// =====================================================
// BUSCAR PEDIDOS
// =====================================================
export async function buscarPedidosPortal(
  clienteId?: string,
  status?: string,
  limit: number = 50
): Promise<PedidoPortal[]> {
  try {
    let query = supabase
      .from('portal_pedidos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('[PedidosService] Erro ao buscar pedidos:', error);
    return [];
  }
}

// =====================================================
// BUSCAR PEDIDO POR ID
// =====================================================
export async function buscarPedidoPorId(
  id: string
): Promise<PedidoPortal | null> {
  try {
    const { data, error } = await supabase
      .from('portal_pedidos')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[PedidosService] Erro ao buscar pedido:', error);
    return null;
  }
}

// =====================================================
// ATUALIZAR PEDIDO
// =====================================================
export async function atualizarPedidoPortal(
  id: string,
  dados: Partial<PedidoFormData>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('portal_pedidos')
      .update({
        ...dados,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[PedidosService] Erro ao atualizar pedido:', error);
    return false;
  }
}

// =====================================================
// CANCELAR PEDIDO
// =====================================================
export async function cancelarPedidoPortal(
  id: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('portal_pedidos')
      .update({
        status: 'cancelado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[PedidosService] Erro ao cancelar pedido:', error);
    return false;
  }
}

// =====================================================
// VALIDAR CAMPOS OBRIGATÓRIOS
// =====================================================
export function validarPedido(dados: PedidoFormData): { valido: boolean; erros: string[] } {
  const erros: string[] = [];
  
  if (!dados.entrega_destinatario?.trim()) {
    erros.push('Nome do destinatário é obrigatório');
  }
  
  if (!dados.entrega_cidade?.trim()) {
    erros.push('Cidade de entrega é obrigatória');
  }
  
  if (!dados.descricao?.trim()) {
    erros.push('Descrição da mercadoria é obrigatória');
  }
  
  if (!dados.entrega_telefone?.trim() && !dados.entrega_email?.trim()) {
    erros.push('Telefone ou email do destinatário é obrigatório');
  }
  
  if (!dados.coleta_cidade?.trim()) {
    erros.push('Cidade de coleta é obrigatória');
  }
  
  if (dados.peso && dados.peso <= 0) {
    erros.push('Peso deve ser maior que zero');
  }
  
  return {
    valido: erros.length === 0,
    erros,
  };
}

// =====================================================
// CORES POR STATUS
// =====================================================
export const statusCores: Record<string, string> = {
  rascunho: 'bg-slate-100 text-slate-600',
  enviado: 'bg-blue-100 text-blue-600',
  em_analise: 'bg-amber-100 text-amber-600',
  programado: 'bg-purple-100 text-purple-600',
  coleta: 'bg-orange-100 text-orange-600',
  em_rota: 'bg-orange-100 text-orange-600',
  entregue: 'bg-emerald-100 text-emerald-600',
  cancelado: 'bg-red-100 text-red-600',
};

// =====================================================
// CORES POR PRIORIDADE
// =====================================================
export const prioridadeCores: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  urgente: 'bg-red-100 text-red-600',
};