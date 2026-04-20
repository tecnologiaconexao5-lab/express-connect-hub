export interface CEPResponse {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  complemento: string;
}

export interface CEPError {
  message: string;
  type: 'INVALID' | 'NOT_FOUND' | 'NETWORK_ERROR';
}

const CEP_REGEX = /^\d{8}$/;

export function validarCEP(cep: string): boolean {
  const limpo = cep.replace(/\D/g, '');
  return CEP_REGEX.test(limpo);
}

export function limparCEP(cep: string): string {
  return cep.replace(/\D/g, '');
}

export async function buscarCEP(cep: string): Promise<CEPResponse | CEPError> {
  const cepLimpo = limparCEP(cep);
  
  if (!validarCEP(cepLimpo)) {
    return { message: 'CEP inválido. Use 8 dígitos.', type: 'INVALID' };
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    
    if (!res.ok) {
      return { message: 'Erro de conexão com a API.', type: 'NETWORK_ERROR' };
    }

    const data = await res.json();

    if (data.erro) {
      return { message: 'CEP não encontrado.', type: 'NOT_FOUND' };
    }

    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      estado: data.uf || '',
      complemento: data.complemento || ''
    };
  } catch {
    return { message: 'Erro ao consultar CEP. Verifique sua conexão.', type: 'NETWORK_ERROR' };
  }
}

export function aplicarCEPNoEndereco(
  enderecoAtual: Record<string, string>,
  dadosCEP: CEPResponse
): Record<string, string> {
  const result = { ...enderecoAtual };
  if (!result.logradouro) result.logradouro = dadosCEP.logradouro;
  if (!result.bairro) result.bairro = dadosCEP.bairro;
  if (!result.cidade) result.cidade = dadosCEP.cidade;
  if (!result.estado) result.estado = dadosCEP.estado;
  if (dadosCEP.complemento && !result.complemento) {
    result.complemento = dadosCEP.complemento;
  }
  return result;
}