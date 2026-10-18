import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data: rowData } = await supabase.from('ordens_servico').select('*').limit(1);
  const dbKeys = rowData && rowData.length > 0 ? Object.keys(rowData[0]) : [];
  
  const mapperKeys = [
    'numero', 'data', 'cliente_id', 'cliente', 'unidade', 'centro_custo',
    'orcamento_origem', 'prestador', 'prestador_id', 'veiculo_alocado',
    'tipo_operacao', 'modalidade', 'prioridade', 'status', 'responsavel',
    'ref_cliente', 'pedido_interno', 'sla_operacao', 'observacoes_gerais',
    'comprovante_obrigatorio', 'cte_obrigatorio', 'xml_obrigatorio',
    'operacao_dedicada', 'carga_tipo', 'carga_descricao', 'carga',
    'tipo_veiculo', 'veiculo_subcategoria', 'veiculo_carroceria',
    'veiculo_termica', 'veiculo_placa', 'is_reserva', 'retorno_obrigatorio',
    'data_agendada', 'observacao_agendamento', 'data_programada',
    'janela_operacional', 'previsao_inicio', 'previsao_termino',
    'tipo_escala', 'instrucoes_operacionais', 'observacao_torre',
    'tabela_aplicada', 'valor_cliente', 'custo_prestador', 'pedagio',
    'ajudante', 'adicionais', 'descontos', 'reembolso_previsto',
    'conta_contabil', 'centro_custo_fin', 'status_faturamento',
    'status_pagamento', 'email_destinatario', 'whatsapp_destinatario',
    'notificar_destinatario', 'eventos_tracker', 'faixa_aplicada',
    'lucro_estimado', 'margem_lucro', 'veiculo_sugerido',
    'instrucoes_operacionais_os', 'recebedor_nome', 'recebedor_documento',
    'localizacao_entrega_json', 'created_at', 'updated_at'
  ];
  
  const missingInDb = mapperKeys.filter(k => !dbKeys.includes(k));
  console.log("Fields in Mapper but NOT in Database:");
  console.log(missingInDb);
}
check();
