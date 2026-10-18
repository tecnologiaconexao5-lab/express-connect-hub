export type ProviderResult = {
  sucesso: boolean;
  data?: Record<string, unknown>;
  erro?: string;
};

export type TestConnectionResult = {
  ok: boolean;
  mensagem: string;
};

export type ProviderParams = {
  acao: string;
  payload: Record<string, unknown>;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  roboId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export interface IProvider {
  readonly nome: string;
  readonly tipo: string;
  readonly provedor: string;
  execute(params: ProviderParams): Promise<ProviderResult>;
  testConnection(config: Record<string, unknown>): Promise<TestConnectionResult>;
}
