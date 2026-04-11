export interface ContaFinanceira {
  id: string;
  nome: string;
  tipo: "corrente" | "poupanca" | "digital" | "caixa" | "investimento" | "transitoria";
  banco: string;
  agencia: string;
  conta: string;
  digito: string;
  titular: string;
  cpfCnpj?: string;
  saldoInicial: number;
  saldoAtual: number;
  ativa: boolean;
  principal: boolean;
  empresaId?: string;
  unidadeId?: string;
  planoContaId?: string;
  centroResultadoId?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Transferencia {
  id: string;
  contaOrigemId: string;
  contaDestinoId: string;
  valor: number;
  data: string;
  descricao: string;
  taxa?: number;
  status: "pendente" | "realizada" | "cancelada";
  createdAt: string;
}

export interface Recebivel {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteDocumento?: string;
  documento: string;
  serie?: string;
  osVinculadas?: string;
  contratoVinculado?: string;
  propostaVinculada?: string;
  categoriaId?: string;
  planoContaId?: string;
  centroResultadoId?: string;
  valorBruto: number;
  desconto: number;
  juros: number;
  multa: number;
  valorLiquido: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento?: string;
  dataRecebimento?: string;
  status: "pendente" | "pago" | "vencido" | "parcial" | "cancelado";
  formaRecebimento?: string;
  contaFinanceiraId?: string;
  recorrente: boolean;
  quantidadeParcelas?: number;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Pagavel {
  id: string;
  fornecedorId: string;
  fornecedorNome: string;
  fornecedorDocumento?: string;
  documento: string;
  tipoDocumento?: string;
  categoriaId?: string;
  planoContaId?: string;
  centroResultadoId?: string;
  unidadeId?: string;
  valorOriginal: number;
  juros: number;
  multa: number;
  desconto: number;
  valorFinal: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPagamento?: string;
  contaPagadoraId?: string;
  formaPagamento?: string;
  numeroBoleto?: string;
  codigoBarras?: string;
  status: "pendente" | "pago" | "vencido" | "parcial" | "cancelado";
  despesaFixa: boolean;
  recorrente: boolean;
  quantidadeParcelas?: number;
  contratoVinculado?: string;
  osVinculada?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CentroResultado {
  id: string;
  nome: string;
  codigo: string;
  tipo: "receita" | "despesa" | "mixto";
  ativo: boolean;
}

export interface PlanoConta {
  id: string;
  codigo: string;
  nome: string;
  tipo: "receita" | "despesa" | "ativo" | "passivo";
  nivel: number;
  paiId?: string;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  nomeFantasia?: string;
  documento: string;
  tipoDocumento: "cpf" | "cnpj";
  email?: string;
  telefone?: string;
  ativo: boolean;
}

export interface Fornecedor {
  id: string;
  nome: string;
  documento: string;
  tipoDocumento: "cpf" | "cnpj";
  email?: string;
  telefone?: string;
  segmento?: string;
  ativo: boolean;
}

export const TIPOS_CONTA = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Conta Poupança" },
  { value: "digital", label: "Conta Digital" },
  { value: "caixa", label: "Caixa Interno" },
  { value: "investimento", label: "Conta Investimento" },
  { value: "transitoria", label: "Conta Transitória" },
] as const;

export const BANCOS = [
  { value: "itau", label: "Itaú" },
  { value: "bradesco", label: "Bradesco" },
  { value: "bb", label: "Banco do Brasil" },
  { value: "santander", label: "Santander" },
  { value: "caixa", label: "Caixa Econômica" },
  { value: "nubank", label: "Nubank" },
  { value: "inter", label: "Inter" },
  { value: "c6", label: "C6 Bank" },
] as const;

export const UNIDADES = [
  { value: "matriz_sp", label: "Matriz (SP)" },
  { value: "filial_rj", label: "Filial (RJ)" },
  { value: "filial_mg", label: "Filial (MG)" },
  { value: "filial_pr", label: "Filial (PR)" },
] as const;

export const CATEGORIAS_RECEITA = [
  { value: "frete", label: "Frete", tipo: "receita" },
  { value: "armazenagem", label: "Armazenagem", tipo: "receita" },
  { value: "last-mile", label: "Last Mile", tipo: "receita" },
  { value: "distribuicao", label: "Distribuição", tipo: "receita" },
  { value: "operacao-dedicada", label: "Operação Dedicada", tipo: "receita" },
  { value: "cross-docking", label: "Cross-docking", tipo: "receita" },
  { value: "receita-financeira", label: "Receita Financeira", tipo: "receita" },
  { value: "outras-receitas", label: "Outras Receitas", tipo: "receita" },
] as const;

export const CATEGORIAS_DESPESA = [
  { value: "combustivel", label: "Combustível", tipo: "despesa" },
  { value: "pedagio", label: "Pedágio", tipo: "despesa" },
  { value: "manutencao", label: "Manutenção", tipo: "despesa" },
  { value: "pneus", label: "Pneus", tipo: "despesa" },
  { value: "folha-operacional", label: "Folha Operacional", tipo: "despesa" },
  { value: "terceiros", label: "Terceiros/Agregados", tipo: "despesa" },
  { value: "impostos", label: "Impostos", tipo: "despesa" },
  { value: "aluguel", label: "Aluguel", tipo: "despesa" },
  { value: "tecnologia", label: "Tecnologia", tipo: "despesa" },
  { value: "marketing", label: "Marketing", tipo: "despesa" },
  { value: "administrativo", label: "Despesas Administrativas", tipo: "despesa" },
  { value: "despesas-financeiras", label: "Despesas Financeiras", tipo: "despesa" },
  { value: "seguros", label: "Seguros", tipo: "despesa" },
  { value: "depreciacao", label: "Depreciação", tipo: "despesa" },
  { value: "provisoes", label: "Provisões", tipo: "despesa" },
  { value: "outras-despesas", label: "Outras Despesas", tipo: "despesa" },
] as const;

export const FORMAS_PAGAMENTO = [
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "deposito", label: "Depósito" },
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "debito", label: "Cartão de Débito" },
] as const;

export const STATUS_RECEBIVEL = [
  { value: "pendente", label: "Pendente", color: "bg-blue-100 text-blue-700" },
  { value: "pago", label: "Pago", color: "bg-green-100 text-green-700" },
  { value: "vencido", label: "Vencido", color: "bg-red-100 text-red-700" },
  { value: "parcial", label: "Parcial", color: "bg-yellow-100 text-yellow-700" },
  { value: "cancelado", label: "Cancelado", color: "bg-gray-100 text-gray-500" },
] as const;

export const STATUS_PAGAVEL = [
  { value: "pendente", label: "Pendente", color: "bg-blue-100 text-blue-700" },
  { value: "pago", label: "Pago", color: "bg-green-100 text-green-700" },
  { value: "vencido", label: "Vencido", color: "bg-red-100 text-red-700" },
  { value: "parcial", label: "Parcial", color: "bg-yellow-100 text-yellow-700" },
  { value: "cancelado", label: "Cancelado", color: "bg-gray-100 text-gray-500" },
] as const;

export const formatCurrency = (value: number): string => {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const formatDate = (date: string | Date): string => {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
};

export const formatDateTime = (date: string | Date): string => {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR");
};

export const formatDocument = (doc: string): string => {
  if (!doc) return "-";
  const numbers = doc.replace(/\D/g, "");
  if (numbers.length === 11) {
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (numbers.length === 14) {
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
};

export const getStatusColor = (status: string, tipo: "receita" | "despesa" = "receita"): string => {
  const cores: Record<string, string> = {
    pendente: "bg-blue-100 text-blue-700 border-blue-200",
    pago: "bg-green-100 text-green-700 border-green-200",
    vencido: "bg-red-100 text-red-700 border-red-200",
    parcial: "bg-yellow-100 text-yellow-700 border-yellow-200",
    cancelado: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return cores[status] || "bg-gray-100 text-gray-700 border-gray-200";
};

export const safeNumber = (value: any, defaultValue = 0): number => {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
};

export const safeString = (value: any, defaultValue = ""): string => {
  return typeof value === "string" ? value : defaultValue;
};

export const capitalize = (str: string): string => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erro desconhecido";
};

export const formatCurrencyInput = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "0";
  return (Number(numbers) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
};

export const parseCurrencyInput = (value: string): number => {
  const numbers = value.replace(/\D/g, "");
  return Number(numbers) / 100;
};

export const formatDateForInput = (date: string | Date | undefined): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
};

export const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

export const isValidNumber = (value: any): boolean => {
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const mockClientes: Cliente[] = [
  { id: "1", nome: "Magazine Luiza S.A.", nomeFantasia: "Magazine Luiza", documento: "47.960.950/0001-62", tipoDocumento: "cnpj", email: "financeiro@magazineluiza.com.br", telefone: "(11) 3500-0000", ativo: true },
  { id: "2", nome: "Amazon Serviços de Logística do Brasil Ltda.", nomeFantasia: "Amazon Brasil", documento: "15.436.940/0001-62", tipoDocumento: "cnpj", email: "logistica@amazon.com.br", telefone: "(11) 3224-0000", ativo: true },
  { id: "3", nome: "Mercado Livre Internet Ltda.", nomeFantasia: "Mercado Livre", documento: "03.432.307/0001-41", tipoDocumento: "cnpj", email: "contas@mercadolivre.com.br", telefone: "(11) 3003-0000", ativo: true },
  { id: "4", nome: "Shopee Commerce Brasil Ltda.", nomeFantasia: "Shopee", documento: "20.870.774/0001-06", tipoDocumento: "cnpj", email: "financeiro@shopee.com.br", telefone: "(11) 4000-0000", ativo: true },
  { id: "5", nome: "Lojas Americanas S.A.", nomeFantasia: "Americanas", documento: "06.169.553/0001-64", tipoDocumento: "cnpj", email: "pagamentos@americanas.com.br", telefone: "(11) 4003-0000", ativo: true },
  { id: "6", nome: "Tech Solutions Tecnologia Ltda.", nomeFantasia: "Tech Solutions", documento: "12.345.678/0001-90", tipoDocumento: "cnpj", email: "financeiro@techsolutions.com.br", telefone: "(11) 99999-0001", ativo: true },
  { id: "7", nome: "Indústria Global S.A.", nomeFantasia: "Indústria Global", documento: "98.765.432/0001-10", tipoDocumento: "cnpj", email: "financeiro@industriaglobal.com.br", telefone: "(11) 99999-0002", ativo: true },
  { id: "8", nome: "Distribuidora Beta Ltda.", nomeFantasia: "Distribuidora Beta", documento: "55.555.555/0001-11", tipoDocumento: "cnpj", email: "financeiro@distribuidorabeta.com.br", telefone: "(11) 99999-0003", ativo: true },
];

export const mockFornecedores: Fornecedor[] = [
  { id: "1", nome: "João Silva - ME", documento: "123.456.789-00", tipoDocumento: "cpf", email: "joao@transporte.com", telefone: "(11) 99999-1111", segmento: "Transporte", ativo: true },
  { id: "2", nome: "Transporte Rápido LTDA", documento: "12.345.678/0001-90", tipoDocumento: "cnpj", email: "contato@transporterapido.com.br", telefone: "(11) 99999-2222", segmento: "Transporte", ativo: true },
  { id: "3", nome: "Maria Freitas", documento: "987.654.321-00", tipoDocumento: "cpf", email: "maria@freitas.com", telefone: "(11) 99999-3333", segmento: "Transporte", ativo: true },
  { id: "4", nome: "Companhia de Energia Elétrica", documento: "33.333.333/0001-33", tipoDocumento: "cnpj", email: "financeiro@energia.com.br", telefone: "(11) 99999-4444", segmento: "Utilidade", ativo: true },
  { id: "5", nome: "Locação de Galpões Ltda.", documento: "44.444.444/0001-44", tipoDocumento: "cnpj", email: "financeiro@locacaogalpao.com.br", telefone: "(11) 99999-5555", segmento: "Imóvel", ativo: true },
  { id: "6", nome: "Posto Ipiranga S.A.", documento: "55.555.555/0001-55", tipoDocumento: "cnpj", email: "financeiro@ipiranga.com.br", telefone: "(11) 99999-6666", segmento: "Combustível", ativo: true },
  { id: "7", nome: "Concessionária de Pedágio BR-101", documento: "66.666.666/0001-66", tipoDocumento: "cnpj", email: "financeiro@pedagiobr101.com.br", telefone: "(11) 99999-7777", segmento: "Pedágio", ativo: true },
  { id: "8", nome: "Seguradora Sancor Brasil S.A.", documento: "77.777.777/0001-77", tipoDocumento: "cnpj", email: "sinistros@sancor.com.br", telefone: "(11) 99999-8888", segmento: "Seguro", ativo: true },
];

export const mockContasBancarias: ContaFinanceira[] = [
  { id: "1", nome: "Conta Corrente Principal", tipo: "corrente", banco: "Itaú", agencia: "1234", conta: "56789", digito: "0", titular: "Express Connect Transportes LTDA", cpfCnpj: "12.345.678/0001-90", saldoInicial: 100000, saldoAtual: 145000.50, ativa: true, principal: true, unidadeId: "matriz_sp", criadoEm: "2026-01-01", atualizadoEm: "2026-04-10" },
  { id: "2", nome: "Conta Reserva / Impostos", tipo: "poupanca", banco: "Bradesco", agencia: "4321", conta: "98765", digito: "4", titular: "Express Connect Transportes LTDA", cpfCnpj: "12.345.678/0001-90", saldoInicial: 50000, saldoAtual: 85200.00, ativa: true, principal: false, unidadeId: "matriz_sp", criadoEm: "2026-01-15", atualizadoEm: "2026-04-08" },
  { id: "3", nome: "Cartão Corporativo Digital", tipo: "digital", banco: "Nubank", agencia: "0001", conta: "11223344", digito: "5", titular: "Express Connect Hub", cpfCnpj: "12.345.678/0001-90", saldoInicial: 10000, saldoAtual: 12500.00, ativa: true, principal: false, unidadeId: "matriz_sp", criadoEm: "2026-02-01", atualizadoEm: "2026-04-05" },
  { id: "4", nome: "Caixa Interno Matriz", tipo: "caixa", banco: "-", agencia: "-", conta: "-", digito: "", titular: "Financeiro Interno", saldoInicial: 1000, saldoAtual: 1250.75, ativa: true, principal: false, unidadeId: "matriz_sp", observacoes: "Pequenos gastos operacionais", criadoEm: "2026-01-01", atualizadoEm: "2026-04-09" },
];

export const mockRecebiveis: Recebivel[] = [
  { id: "1", clienteId: "1", clienteNome: "Magazine Luiza S.A.", clienteDocumento: "47.960.950/0001-62", documento: "FAT-0045", osVinculadas: "OS-401, OS-402", categoriaId: "frete", valorBruto: 14500.00, desconto: 0, juros: 0, multa: 0, valorLiquido: 14500.00, dataEmissao: "2026-04-01", dataVencimento: "2026-04-15", status: "pendente", formaRecebimento: "boleto", recorrente: false, criadoEm: "2026-04-01", atualizadoEm: "2026-04-01" },
  { id: "2", clienteId: "6", clienteNome: "Tech Solutions Tecnologia", clienteDocumento: "12.345.678/0001-90", documento: "FAT-0038", osVinculadas: "OS-380", categoriaId: "last-mile", valorBruto: 8200.50, desconto: 0, juros: 0, multa: 0, valorLiquido: 8200.50, dataEmissao: "2026-03-25", dataVencimento: "2026-04-08", status: "vencido", formaRecebimento: "transferencia", recorrente: false, criadoEm: "2026-03-25", atualizadoEm: "2026-04-08" },
  { id: "3", clienteId: "7", clienteNome: "Indústria Global S.A.", clienteDocumento: "98.765.432/0001-10", documento: "FAT-0035", osVinculadas: "OS-350, OS-355", categoriaId: "distribuicao", valorBruto: 5400.00, desconto: 540, juros: 0, multa: 0, valorLiquido: 4860.00, dataEmissao: "2026-03-20", dataVencimento: "2026-03-30", dataPagamento: "2026-03-28", status: "pago", formaRecebimento: "pix", recorrente: false, criadoEm: "2026-03-20", atualizadoEm: "2026-03-28" },
  { id: "4", clienteId: "2", clienteNome: "Amazon Serviços", clienteDocumento: "15.436.940/0001-62", documento: "FAT-0052", osVinculadas: "OS-420", categoriaId: "frete", valorBruto: 18500.00, desconto: 0, juros: 0, multa: 0, valorLiquido: 18500.00, dataEmissao: "2026-04-05", dataVencimento: "2026-04-20", status: "pendente", formaRecebimento: "boleto", recorrente: false, criadoEm: "2026-04-05", atualizadoEm: "2026-04-05" },
  { id: "5", clienteId: "3", clienteNome: "Mercado Livre", clienteDocumento: "03.432.307/0001-41", documento: "FAT-0051", osVinculadas: "OS-415", categoriaId: "last-mile", valorBruto: 12400.00, desconto: 0, juros: 0, multa: 0, valorLiquido: 12400.00, dataEmissao: "2026-04-03", dataVencimento: "2026-04-18", status: "pendente", formaRecebimento: "transferencia", recorrente: false, criadoEm: "2026-04-03", atualizadoEm: "2026-04-03" },
];

export const mockPagaveis: Pagavel[] = [
  { id: "1", fornecedorId: "1", fornecedorNome: "João Silva - ME", fornecedorDocumento: "123.456.789-00", documento: "NF-8599", tipoDocumento: "NF", categoriaId: "folha-operacional", valorOriginal: 1200.00, juros: 0, multa: 0, desconto: 0, valorFinal: 1200.00, dataEmissao: "2026-04-01", dataVencimento: "2026-04-10", status: "pendente", despesaFixa: true, recorrente: true, criadoEm: "2026-04-01", atualizadoEm: "2026-04-01" },
  { id: "2", fornecedorId: "2", fornecedorNome: "Transporte Rápido LTDA", fornecedorDocumento: "12.345.678/0001-90", documento: "NF-8600", tipoDocumento: "NF", categoriaId: "terceiros", valorOriginal: 8500.00, juros: 0, multa: 0, desconto: 0, valorFinal: 8500.00, dataEmissao: "2026-04-02", dataVencimento: "2026-04-12", status: "pendente", despesaFixa: false, recorrente: false, osVinculada: "OS-4821", criadoEm: "2026-04-02", atualizadoEm: "2026-04-02" },
  { id: "3", fornecedorId: "4", fornecedorNome: "Companhia de Energia", fornecedorDocumento: "33.333.333/0001-33", documento: "NF-902", tipoDocumento: "NF", categoriaId: "energia", valorOriginal: 4500.00, juros: 0, multa: 0, desconto: 0, valorFinal: 4500.00, dataEmissao: "2026-04-01", dataVencimento: "2026-04-20", status: "pendente", despesaFixa: true, recorrente: true, criadoEm: "2026-04-01", atualizadoEm: "2026-04-01" },
  { id: "4", fornecedorId: "5", fornecedorNome: "Locação de Galpões", fornecedorDocumento: "44.444.444/0001-44", documento: "BOL-001", tipoDocumento: "Boleto", categoriaId: "aluguel", valorOriginal: 15000.00, juros: 0, multa: 0, desconto: 0, valorFinal: 15000.00, dataEmissao: "2026-04-01", dataVencimento: "2026-04-25", status: "pendente", despesaFixa: true, recorrente: true, criadoEm: "2026-04-01", atualizadoEm: "2026-04-01" },
  { id: "5", fornecedorId: "6", fornecedorNome: "Posto Ipiranga", fornecedorDocumento: "55.555.555/0001-55", documento: "NF-1542", tipoDocumento: "NF", categoriaId: "combustivel", valorOriginal: 4500.00, juros: 0, multa: 0, desconto: 0, valorFinal: 4500.00, dataEmissao: "2026-04-05", dataVencimento: "2026-04-15", status: "pago", dataPagamento: "2026-04-12", despesaFixa: false, recorrente: false, criadoEm: "2026-04-05", atualizadoEm: "2026-04-12" },
];

export const mockTransferencias: Transferencia[] = [
  { id: "1", contaOrigemId: "1", contaDestinoId: "4", valor: 500, data: "2026-04-05", descricao: "Reposição caixa matriz", status: "realizada", createdAt: "2026-04-05T10:00:00Z" },
  { id: "2", contaOrigemId: "1", contaDestinoId: "2", valor: 10000, data: "2026-04-08", descricao: "Reserva investimentos", status: "realizada", createdAt: "2026-04-08T14:30:00Z" },
];

export const mockCentrosResultado: CentroResultado[] = [
  { id: "1", nome: "Matriz SP", codigo: "MATRIZ", tipo: "mixto", ativo: true },
  { id: "2", nome: "Filial RJ", codigo: "FILIAL_RJ", tipo: "mixto", ativo: true },
  { id: "3", nome: "Filial MG", codigo: "FILIAL_MG", tipo: "mixto", ativo: true },
  { id: "4", nome: "Operação Sudeste", codigo: "OP_SUDESTE", tipo: "receita", ativo: true },
  { id: "5", nome: "Operação Sul", codigo: "OP_SUL", tipo: "receita", ativo: true },
];

export const mockPlanoContas: PlanoConta[] = [
  { id: "1", codigo: "1", nome: "Receita Bruta", tipo: "receita", nivel: 1, ativo: true },
  { id: "2", codigo: "1.1", nome: "Frete", tipo: "receita", nivel: 2, paiId: "1", ativo: true },
  { id: "3", codigo: "1.2", nome: "Armazenagem", tipo: "receita", nivel: 2, paiId: "1", ativo: true },
  { id: "4", codigo: "1.3", nome: "Last Mile", tipo: "receita", nivel: 2, paiId: "1", ativo: true },
  { id: "5", codigo: "2", nome: "Despesas Operacionais", tipo: "despesa", nivel: 1, ativo: true },
  { id: "6", codigo: "2.1", nome: "Combustível", tipo: "despesa", nivel: 2, paiId: "5", ativo: true },
  { id: "7", codigo: "2.2", nome: "Pedágio", tipo: "despesa", nivel: 2, paiId: "5", ativo: true },
  { id: "8", codigo: "2.3", nome: "Manutenção", tipo: "despesa", nivel: 2, paiId: "5", ativo: true },
  { id: "9", codigo: "3", nome: "Despesas Administrativas", tipo: "despesa", nivel: 1, ativo: true },
  { id: "10", codigo: "3.1", nome: "Aluguel", tipo: "despesa", nivel: 2, paiId: "9", ativo: true },
  { id: "11", codigo: "3.2", nome: "Tecnologia", tipo: "despesa", nivel: 2, paiId: "9", ativo: true },
];