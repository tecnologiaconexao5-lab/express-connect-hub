import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buscarEnderecos, extrairDadosDaSuggestion, MapboxSuggestion, mapboxAutocomplete } from "@/services/maps/mapboxAutocomplete";
import { buscarCEP, validarCEP, CEPResponse } from "@/services/cepService";

interface EnderecoAutocompleteProps {
  value: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    uf?: string;
    cep?: string;
    latitude?: number;
    longitude?: number;
    enderecoFormatado?: string;
    mapboxPlaceId?: string;
  };
  onChange: (value: EnderecoAutocompleteProps["value"]) => void;
  label?: string;
  tipoInput?: "logradouro" | "cep";
  disabled?: boolean;
}

export const EnderecoAutocomplete = ({
  value,
  onChange,
  label = "Endereço",
  tipoInput = "logradouro",
  disabled = false,
}: EnderecoAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(value.logradouro || "");
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCEPChange = useCallback(async (cep: string) => {
    setInputValue(cep);
    
    if (cep.length === 8 && validarCEP(cep)) {
      setLoading(true);
      setError(null);
      
      const resultado = await buscarCEP(cep);
      
      if ("message" in resultado) {
        setError(resultado.message);
      } else {
        const dadosCEP: CEPResponse = resultado;
        onChange({
          ...value,
          logradouro: dadosCEP.logradouro,
          bairro: dadosCEP.bairro,
          cidade: dadosCEP.cidade,
          estado: dadosCEP.estado,
          uf: dadosCEP.estado,
          cep: cep,
          complemento: dadosCEP.complemento,
        });
        setInputValue(dadosCEP.logradouro || "");
      }
      setLoading(false);
    }
  }, [onChange, value]);

  const handleLogradouroChange = useCallback((text: string) => {
    setInputValue(text);
    setError(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      
      try {
        const resultado = await buscarEnderecos(text, { limit: 6 });
        
        if (resultado.error) {
          console.warn("[Autocomplete] Erro:", resultado.error);
        }
        
        setSuggestions(resultado.suggestions);
        setShowSuggestions(true);
      } catch (err) {
        console.error("[Autocomplete] Erro:", err);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handleSelectSuggestion = useCallback((suggestion: MapboxSuggestion) => {
    const dados = extrairDadosDaSuggestion(suggestion);
    
    onChange({
      ...value,
      logradouro: dados.logradouro,
      numero: dados.numero,
      bairro: dados.bairro,
      cidade: dados.cidade,
      estado: dados.estado,
      uf: dados.estado,
      cep: dados.cep,
      latitude: dados.latitude,
      longitude: dados.longitude,
      enderecoFormatado: dados.enderecoFormatado,
      mapboxPlaceId: dados.mapboxPlaceId,
    });
    
    setInputValue(dados.logradouro);
    setSuggestions([]);
    setShowSuggestions(false);
  }, [onChange, value]);

  return (
    <div ref={containerRef} className="relative">
      <Label className="text-xs font-medium text-muted-foreground mb-1">
        {label}
      </Label>
      
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value;
            if (tipoInput === "cep") {
              handleCEPChange(val.replace(/\D/g, "").slice(0, 8));
            } else {
              handleLogradouroChange(val);
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={
            tipoInput === "cep" 
              ? "CEP (8 dígitos)" 
              : "Digite o endereço..."
          }
          disabled={disabled}
          className={loading ? "pr-10" : ""}
        />
        
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 text-sm transition-colors"
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <div className="font-medium text-gray-900">
                {suggestion.address 
                  ? `${suggestion.text}, ${suggestion.address}`
                  : suggestion.text
                }
              </div>
              <div className="text-xs text-gray-500 truncate">
                {suggestion.place_name}
              </div>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && inputValue.length >= 3 && suggestions.length === 0 && !loading && !error && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-center text-sm text-gray-500">
          Nenhum endereço encontrado
        </div>
      )}
    </div>
  );
};

export default EnderecoAutocomplete;