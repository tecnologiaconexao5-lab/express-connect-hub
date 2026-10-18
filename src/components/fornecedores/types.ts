export type TipoPessoa = "PF" | "PJ";
export type StatusFornecedor = "ativo" | "inativo";

export interface Fornecedor {
  id: string;
  tipo_pessoa: TipoPessoa;
  razao_social: string;
  nome_fantasia: string | null;
  cpf_cnpj: string;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  observacoes: string | null;
  status: StatusFornecedor;
  created_at: string;
  updated_at: string;
}

export const TIPO_PESSOA_LABEL: Record<TipoPessoa, string> = {
  PF: "Pessoa Fisica",
  PJ: "Pessoa Juridica",
};

export const STATUS_FORNECEDOR_LABEL: Record<StatusFornecedor, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

export const STATUS_FORNECEDOR_COR: Record<StatusFornecedor, string> = {
  ativo: "bg-green-500 text-white",
  inativo: "bg-gray-400 text-white",
};

export const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];
