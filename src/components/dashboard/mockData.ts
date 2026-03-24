// Mock data for all dashboard tabs

export const kpisExecutivo = {
  faturamentoMes: 1847650.0,
  totalOperacoes: 3842,
  prestadoresAtivos: 127,
  margemMedia: 18.4,
  clientesAtivos: 89,
  ordensConcluidas: 3214,
  ticketMedio: 480.75,
  entregaNoPrazo: 94.2,
};

export const faturamentoMensal = [
  { mes: "Out", valor: 1420000 },
  { mes: "Nov", valor: 1580000 },
  { mes: "Dez", valor: 1710000 },
  { mes: "Jan", valor: 1620000 },
  { mes: "Fev", valor: 1750000 },
  { mes: "Mar", valor: 1847650 },
];

export const operacoesSemana = [
  { semana: "Sem 1", operacoes: 820 },
  { semana: "Sem 2", operacoes: 915 },
  { semana: "Sem 3", operacoes: 870 },
  { semana: "Sem 4", operacoes: 960 },
  { semana: "Sem 5", operacoes: 890 },
  { semana: "Sem 6", operacoes: 1020 },
  { semana: "Sem 7", operacoes: 980 },
  { semana: "Sem 8", operacoes: 1050 },
];

export const operacoesTipoVeiculo = [
  { tipo: "Van", valor: 1250 },
  { tipo: "Truck", valor: 980 },
  { tipo: "Carreta", valor: 720 },
  { tipo: "Utilitário", valor: 540 },
  { tipo: "Moto", valor: 352 },
];

export const topClientes = [
  { cliente: "Magazine Luiza", volume: 620 },
  { cliente: "Americanas", volume: 510 },
  { cliente: "Mercado Livre", volume: 480 },
  { cliente: "Amazon BR", volume: 390 },
  { cliente: "Shopee", volume: 340 },
];

// Operacional
export const statusOperacional = [
  { nome: "Rascunho", qtd: 12, cor: "bg-gray-400" },
  { nome: "Aguardando Aprovação", qtd: 28, cor: "bg-yellow-500" },
  { nome: "Aguardando Programação", qtd: 15, cor: "bg-orange-400" },
  { nome: "Em Programação", qtd: 9, cor: "bg-orange-500" },
  { nome: "Programada", qtd: 34, cor: "bg-blue-400" },
  { nome: "Aguardando Parceiro", qtd: 18, cor: "bg-purple-400" },
  { nome: "Aguardando Veículo", qtd: 7, cor: "bg-indigo-400" },
  { nome: "Aguardando Coleta", qtd: 22, cor: "bg-cyan-400" },
  { nome: "Em Coleta", qtd: 16, cor: "bg-teal-400" },
  { nome: "Carregando", qtd: 11, cor: "bg-emerald-400" },
  { nome: "Saiu para Rota", qtd: 45, cor: "bg-green-500" },
  { nome: "Em Operação", qtd: 38, cor: "bg-green-600" },
  { nome: "Em Entrega", qtd: 52, cor: "bg-lime-500" },
  { nome: "Com Ocorrência", qtd: 14, cor: "bg-red-500" },
  { nome: "Aguardando Baixa", qtd: 19, cor: "bg-amber-500" },
  { nome: "Finalizada", qtd: 3214, cor: "bg-green-700" },
  { nome: "Reentrega", qtd: 8, cor: "bg-rose-400" },
  { nome: "Devolução", qtd: 5, cor: "bg-red-400" },
  { nome: "Retorno à Base", qtd: 3, cor: "bg-slate-500" },
];

export const operacoesPorRegiao = [
  { regiao: "Sudeste", valor: 1580 },
  { regiao: "Sul", valor: 820 },
  { regiao: "Nordeste", valor: 640 },
  { regiao: "Centro-Oeste", valor: 480 },
  { regiao: "Norte", valor: 322 },
];

export const osPorDia = Array.from({ length: 30 }, (_, i) => ({
  dia: `${i + 1}`,
  os: Math.floor(100 + Math.random() * 80),
}));

export const ocorrenciasPorMotivo = [
  { motivo: "Endereço não localizado", qtd: 42 },
  { motivo: "Destinatário ausente", qtd: 38 },
  { motivo: "Avaria na carga", qtd: 15 },
  { motivo: "Recusa do destinatário", qtd: 12 },
  { motivo: "Atraso na coleta", qtd: 28 },
  { motivo: "Veículo quebrado", qtd: 8 },
];

export const ultimasOrdens = [
  { id: "OS-4821", cliente: "Magazine Luiza", origem: "SP", destino: "RJ", status: "Em Entrega", data: "24/03/2026" },
  { id: "OS-4820", cliente: "Amazon BR", origem: "SP", destino: "MG", status: "Saiu para Rota", data: "24/03/2026" },
  { id: "OS-4819", cliente: "Mercado Livre", origem: "PR", destino: "SC", status: "Em Coleta", data: "24/03/2026" },
  { id: "OS-4818", cliente: "Shopee", origem: "SP", destino: "BA", status: "Com Ocorrência", data: "24/03/2026" },
  { id: "OS-4817", cliente: "Americanas", origem: "RJ", destino: "ES", status: "Programada", data: "23/03/2026" },
  { id: "OS-4816", cliente: "Casas Bahia", origem: "SP", destino: "PR", status: "Finalizada", data: "23/03/2026" },
  { id: "OS-4815", cliente: "Ponto", origem: "MG", destino: "GO", status: "Em Operação", data: "23/03/2026" },
  { id: "OS-4814", cliente: "Renner", origem: "RS", destino: "SC", status: "Aguardando Parceiro", data: "23/03/2026" },
  { id: "OS-4813", cliente: "C&A", origem: "SP", destino: "SP", status: "Finalizada", data: "22/03/2026" },
  { id: "OS-4812", cliente: "Riachuelo", origem: "RN", destino: "PB", status: "Finalizada", data: "22/03/2026" },
];

export const ultimasOcorrencias = [
  { id: "OC-312", os: "OS-4818", motivo: "Endereço não localizado", parceiro: "TransLog SP", data: "24/03/2026" },
  { id: "OC-311", os: "OS-4810", motivo: "Destinatário ausente", parceiro: "RápidoFrete", data: "24/03/2026" },
  { id: "OC-310", os: "OS-4805", motivo: "Avaria na carga", parceiro: "LogExpress MG", data: "23/03/2026" },
  { id: "OC-309", os: "OS-4798", motivo: "Recusa do destinatário", parceiro: "Veloz Cargas", data: "23/03/2026" },
  { id: "OC-308", os: "OS-4792", motivo: "Atraso na coleta", parceiro: "Sul Express", data: "22/03/2026" },
];

export const parceirosAguardando = [
  { nome: "RápidoFrete", regiao: "SP Capital", os: 3, desde: "24/03 08:30" },
  { nome: "LogExpress MG", regiao: "BH Metro", os: 2, desde: "24/03 09:15" },
  { nome: "Veloz Cargas", regiao: "RJ Interior", os: 1, desde: "24/03 10:00" },
];

// Comercial
export const kpisComercial = {
  orcamentosEmitidos: 142,
  aprovados: 89,
  perdidos: 32,
  valorOrcado: 2150000,
  valorConvertido: 1340000,
  taxaConversao: 62.7,
};

export const funilComercial = [
  { etapa: "Rascunho", valor: 142 },
  { etapa: "Enviado", valor: 118 },
  { etapa: "Aprovado", valor: 89 },
  { etapa: "OS Gerada", valor: 74 },
];

export const valorPorCliente = [
  { cliente: "Magazine Luiza", valor: 420000 },
  { cliente: "Americanas", valor: 310000 },
  { cliente: "Mercado Livre", valor: 280000 },
  { cliente: "Amazon BR", valor: 190000 },
  { cliente: "Shopee", valor: 140000 },
];

export const conversoesSemana = [
  { semana: "Sem 1", conversoes: 8 },
  { semana: "Sem 2", conversoes: 12 },
  { semana: "Sem 3", conversoes: 10 },
  { semana: "Sem 4", conversoes: 15 },
  { semana: "Sem 5", conversoes: 11 },
  { semana: "Sem 6", conversoes: 18 },
  { semana: "Sem 7", conversoes: 14 },
  { semana: "Sem 8", conversoes: 16 },
];

export const motivosPerda = [
  { motivo: "Preço alto", valor: 14 },
  { motivo: "Prazo longo", valor: 8 },
  { motivo: "Cobertura insuficiente", valor: 5 },
  { motivo: "Concorrente", valor: 3 },
  { motivo: "Desistência", valor: 2 },
];

// Financeiro
export const kpisFinanceiro = {
  aFaturar: 485000,
  faturado: 1362650,
  aReceber: 620000,
  recebido: 742650,
  aPagar: 890000,
  pago: 680000,
  margemMedia: 18.4,
  provisao: 245000,
};

export const receitaDespesaLucro = [
  { mes: "Out", receita: 1420000, despesa: 1150000, lucro: 270000 },
  { mes: "Nov", receita: 1580000, despesa: 1280000, lucro: 300000 },
  { mes: "Dez", receita: 1710000, despesa: 1390000, lucro: 320000 },
  { mes: "Jan", receita: 1620000, despesa: 1340000, lucro: 280000 },
  { mes: "Fev", receita: 1750000, despesa: 1410000, lucro: 340000 },
  { mes: "Mar", receita: 1847650, despesa: 1510000, lucro: 337650 },
];

export const faturamentoPorCliente = [
  { cliente: "Magazine Luiza", valor: 380000 },
  { cliente: "Americanas", valor: 290000 },
  { cliente: "Mercado Livre", valor: 260000 },
  { cliente: "Amazon BR", valor: 210000 },
  { cliente: "Shopee", valor: 150000 },
];

export const previstoRealizado = [
  { mes: "Out", previsto: 1500000, realizado: 1420000 },
  { mes: "Nov", previsto: 1600000, realizado: 1580000 },
  { mes: "Dez", previsto: 1700000, realizado: 1710000 },
  { mes: "Jan", previsto: 1650000, realizado: 1620000 },
  { mes: "Fev", previsto: 1800000, realizado: 1750000 },
  { mes: "Mar", previsto: 1900000, realizado: 1847650 },
];

export const despesasPorCategoria = [
  { categoria: "Frete Parceiros", valor: 680000 },
  { categoria: "Combustível", valor: 220000 },
  { categoria: "Manutenção", valor: 150000 },
  { categoria: "Pessoal Adm.", valor: 310000 },
  { categoria: "Impostos", valor: 150000 },
];

// Alertas
export const alertasCriticos = [
  { texto: "OS-4818 com ocorrência aberta há 4h", detalhe: "Endereço não localizado — Shopee" },
  { texto: "Integração CT-e com erro desde 08:00", detalhe: "Timeout na SEFAZ-SP" },
  { texto: "Prestador RápidoFrete bloqueado com 3 OS ativas", detalhe: "Documentação vencida" },
];

export const alertasAtencao = [
  { texto: "2 orçamentos vencem hoje", detalhe: "Magazine Luiza (ORC-421), Renner (ORC-418)" },
  { texto: "5 documentos vencem em 7 dias", detalhe: "CNH de 3 parceiros, CRLV de 2 veículos" },
  { texto: "OS-4814 sem parceiro há mais de 2h", detalhe: "Renner — RS→SC" },
  { texto: "Contrato Americanas vence em 28 dias", detalhe: "Contrato #CT-089" },
  { texto: "Tabela de valores vencida para 2 clientes", detalhe: "Casas Bahia, Riachuelo" },
  { texto: "Veículo ABC-1234 com doc vencendo", detalhe: "CRLV vence em 5 dias" },
];

export const alertasInformativos = [
  { texto: "12 OS sem comprovante de entrega", detalhe: "Últimas 48h" },
  { texto: "Prestador Sul Express com pendência documental", detalhe: "Seguro RCTR-C vencido" },
  { texto: "3 clientes sem tabela de valores ativa", detalhe: "C&A, Riachuelo, Ponto" },
];

export const CORES_GRAFICOS = [
  "hsl(24, 95%, 53%)",   // primary/orange
  "hsl(213, 50%, 30%)",  // dark blue
  "hsl(180, 50%, 45%)",  // teal
  "hsl(45, 90%, 55%)",   // amber
  "hsl(280, 50%, 55%)",  // purple
  "hsl(150, 50%, 45%)",  // green
  "hsl(0, 70%, 55%)",    // red
  "hsl(200, 60%, 50%)",  // sky
];
