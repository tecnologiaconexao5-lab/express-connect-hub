$file = "src\lib\dbMappers.ts"
$lines = Get-Content $file
$before = $lines[0..133]
$after  = $lines[174..($lines.Count - 1)]

$newBlock = @"
export interface PrestadorRow {
  id: string;
  foto?: string;
  nome_completo?: string;
  cpf_cnpj?: string;
  rg?: string;
  data_nascimento?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  tipo_parceiro?: string;
  status?: string;
  endereco?: string;
  regiao_principal?: string;
  observacoes?: string;
  aceita_refrigerada?: boolean;
  aceita_urbana?: boolean;
  aceita_dedicada?: boolean;
  aceita_esporadica?: boolean;
  score_interno?: number;
  indice_aceite?: number;
  indice_comparecimento?: number;
  indice_entrega_prazo?: number;
  qtd_operacoes?: number;
  conferencia_manual?: boolean;
  data_cadastro?: string;
  ultima_atualizacao?: string;
  created_at?: string;
  updated_at?: string;
}

// Colunas reais: id, nome_razao, cpf_cnpj, tipo_parceiro, status, score, user_id, created_at
const PRESTADOR_ALLOWLIST: string[] = [
  'nome_razao', 'cpf_cnpj', 'tipo_parceiro', 'status', 'score', 'user_id', 'created_at', 'updated_at',
];

export const sanitizePrestadorPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(payload)) {
    if (PRESTADOR_ALLOWLIST.includes(key)) {
      sanitized[key] = payload[key];
    } else {
      console.warn('[PRESTADOR REMOVIDO DO PAYLOAD] campo: ' + key);
    }
  }
  console.log('[PRESTADOR SANITIZED PAYLOAD]', sanitized);
  return sanitized;
};

export const toPrestadorInsert = (form: Partial<PrestadorForm>): Record<string, unknown> => {
  const has = (v: unknown) => v !== undefined && v !== null && v !== '';
  const raw: Record<string, unknown> = {};
  if (has(form.nomeCompleto)) raw.nome_razao   = String(form.nomeCompleto);
  if (has(form.cpfCnpj))      raw.cpf_cnpj     = String(form.cpfCnpj);
  if (has(form.tipoParceiro)) raw.tipo_parceiro = String(form.tipoParceiro);
  if (has(form.status))       raw.status        = String(form.status);
  if (has(form.scoreInterno)) raw.score         = Number(form.scoreInterno);
  raw.created_at = new Date().toISOString();
  const d = sanitizePrestadorPayload(raw);
  console.log('[DEBUG toPrestadorInsert] Payload gerado:', JSON.stringify(d, null, 2));
  return d;
};

export const toPrestadorUpdate = (form: Partial<PrestadorForm>): Record<string, unknown> => {
  const has = (v: unknown) => v !== undefined && v !== null && v !== '';
  const raw: Record<string, unknown> = {};
  if (has(form.nomeCompleto)) raw.nome_razao   = String(form.nomeCompleto);
  if (has(form.cpfCnpj))      raw.cpf_cnpj     = String(form.cpfCnpj);
  if (has(form.tipoParceiro)) raw.tipo_parceiro = String(form.tipoParceiro);
  if (has(form.status))       raw.status        = String(form.status);
  if (has(form.scoreInterno)) raw.score         = Number(form.scoreInterno);
  raw.updated_at = new Date().toISOString();
  const d = sanitizePrestadorPayload(raw);
  console.log('[DEBUG toPrestadorUpdate] Payload gerado:', JSON.stringify(d, null, 2));
  return d;
};

"@

$newLines = $newBlock -split "`n"
$result = $before + $newLines + $after
Set-Content -Path $file -Value $result -Encoding UTF8
Write-Host "Done. Total lines: $($result.Count)"
