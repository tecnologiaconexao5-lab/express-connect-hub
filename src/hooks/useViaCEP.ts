import { useState } from 'react';

export function useViaCEP() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscarCEP = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      
      if (data.erro) {
        setError('CEP não encontrado');
        return null;
      }
      
      return {
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf,
        complemento: data.complemento || ''
      };
    } catch {
      setError('Erro ao buscar CEP');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { buscarCEP, loading, error };
}
