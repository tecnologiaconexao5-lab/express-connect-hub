// src/services/mappers.ts

// Função para transformar os dados do orçamento para o formato que o Supabase entende (snake_case)
export const toOSInsert = (orc: any) => {
  return {
    id: orc.id, // Não precisa de conversão, pois já está no formato correto
    cliente: orc.cliente,
    cliente_cnpj: orc.clienteCnpj, // Exemplo de conversão de camelCase para snake_case
    unidade: orc.unidade,
    // Adicione outros campos necessários aqui, sempre aplicando a conversão de camelCase para snake_case
    centro_custo: orc.centroCusto,  // Exemplo de outro campo camelCase para snake_case
    data_emissao: orc.dataEmissao, // Outro exemplo
    // Adicione todos os outros campos necessários aqui
  };
};