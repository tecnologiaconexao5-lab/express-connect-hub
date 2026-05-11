import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { buscarCEP } from "@/services/cepService";
import { buscarEnderecos, extrairDadosDaSuggestion, MapboxSuggestion } from "@/services/maps/mapboxAutocomplete";

export interface EnderecoType {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  referencia?: string;
  latitude?: number;
  longitude?: number;
  enderecoFormatado?: string;
  mapboxPlaceId?: string;
}

interface EnderecoCompletoProps {
  value: EnderecoType;
  onChange: (endereco: EnderecoType) => void;
  label?: string;
  required?: boolean;
}

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", 
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", 
  "SP", "SE", "TO"
];

const mascaraCep = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, "$1-$2");
  return v;
};

export function EnderecoCompleto({ value, onChange, label, required }: EnderecoCompletoProps) {
  const safeValue: EnderecoType = value || { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", referencia: "" };
  
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepInput, setCepInput] = useState(safeValue.cep || "");
  
  const [logradouroInput, setLogradouroInput] = useState(safeValue.logradouro || "");
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingMapbox, setLoadingMapbox] = useState(false);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (safeValue.cep) setCepInput(safeValue.cep);
  }, [safeValue.cep]);

  useEffect(() => {
    if (safeValue.logradouro) setLogradouroInput(safeValue.logradouro);
  }, [safeValue.logradouro]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (field: keyof EnderecoType, val: string) => {
    const copia = { ...safeValue };
    (copia as any)[field] = val;
    onChange(copia);
  };

  const handleCepBlur = async () => {
    const limpo = cepInput.replace(/\D/g, "");
    if (limpo.length !== 8) return;

    const temEnderecoValido = (str?: string) => {
      if (!str || !str.trim()) return false;
      if (str.includes(" , ") || str.includes(" - ")) return false;
      return str.length > 3;
    };

    if (temEnderecoValido(safeValue.logradouro) && temEnderecoValido(safeValue.bairro) && temEnderecoValido(safeValue.cidade) && temEnderecoValido(safeValue.estado)) return;

    const copia = { ...safeValue };
    copia.cep = cepInput;
    onChange(copia);

    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      
      if (data.erro) {
         toast.error("CEP não encontrado.");
      } else {
        const updated = { ...safeValue };
        updated.cep = data.cep || cepInput;
        updated.logradouro = data.logradouro || "";
        updated.complemento = data.complemento || "";
        updated.bairro = data.bairro || "";
        updated.cidade = data.localidade || "";
        updated.estado = data.uf || "";
        setLogradouroInput(data.logradouro || "");
        onChange(updated);
      }
    } catch {
      toast.error("Erro ao buscar CEP. Verifique sua conexão.");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleLogradouroChange = useCallback((val: string) => {
    setLogradouroInput(val);
    handleChange("logradouro", val);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (val.length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoadingMapbox(true);
      try {
        const resultado = await buscarEnderecos(val, { limit: 5 });
        setSuggestions(resultado.suggestions);
        setShowSuggestions(true);
      } catch (err) {
        console.error("[Mapbox autocomplete] Erro:", err);
      } finally {
        setLoadingMapbox(false);
      }
    }, 400);
  }, [onChange, safeValue]);

  const handleSelectSuggestion = useCallback((suggestion: MapboxSuggestion) => {
    const dados = extrairDadosDaSuggestion(suggestion);
    
    const updated: EnderecoType = {
      ...safeValue,
      logradouro: dados.logradouro,
      numero: dados.numero,
      bairro: dados.bairro,
      cidade: dados.cidade,
      estado: dados.estado,
      cep: dados.cep,
      latitude: dados.latitude,
      longitude: dados.longitude,
      enderecoFormatado: dados.enderecoFormatado,
      mapboxPlaceId: dados.mapboxPlaceId,
    };
    
    setLogradouroInput(dados.logradouro);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange(updated);
  }, [onChange, safeValue]);

  return (
    <div ref={containerRef} className="space-y-3">
      {label && <Label className="text-xs font-medium text-muted-foreground">{label}</Label>}
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-1">
          <Label className="text-[10px] text-muted-foreground">CEP</Label>
          <div className="relative">
            <Input 
              value={cepInput} 
              onChange={(e) => setCepInput(mascaraCep(e.target.value))}
              onBlur={handleCepBlur}
              placeholder="00000-000"
              maxLength={9}
            />
            {loadingCep && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <div className="md:col-span-3 relative">
          <Label className="text-[10px] text-muted-foreground">Logradouro (Rua/Av) *</Label>
          <div className="relative">
            <Input 
              value={logradouroInput} 
              onChange={(e) => handleLogradouroChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Digite o endereço para buscar sugestões"
            />
            {loadingMapbox && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 text-sm transition-colors"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    <div className="font-medium text-gray-900 text-xs">
                      {suggestion.address ? `${suggestion.text}, ${suggestion.address}` : suggestion.text}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{suggestion.place_name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <div className="col-span-1">
          <Label className="text-[10px] text-muted-foreground">Número</Label>
          <Input 
            value={safeValue.numero || ""} 
            onChange={(e) => handleChange("numero", e.target.value)}
            placeholder="Nº"
          />
        </div>
        <div className="col-span-2 md:col-span-2">
          <Label className="text-[10px] text-muted-foreground">Complemento</Label>
          <Input 
            value={safeValue.complemento || ""} 
            onChange={(e) => handleChange("complemento", e.target.value)}
            placeholder="Apto, sala, etc"
          />
        </div>
        <div className="col-span-2 md:col-span-3">
          <Label className="text-[10px] text-muted-foreground">Bairro</Label>
          <Input 
            value={safeValue.bairro || ""} 
            onChange={(e) => handleChange("bairro", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2 md:col-span-3">
          <Label className="text-[10px] text-muted-foreground">Cidade</Label>
          <Input 
            value={safeValue.cidade || ""} 
            onChange={(e) => handleChange("cidade", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">UF</Label>
          <Select value={safeValue.estado || ""} onValueChange={(v) => handleChange("estado", v)}>
            <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
            <SelectContent>
              {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground">Referência / Instruções</Label>
        <Input 
          value={safeValue.referencia || ""} 
          onChange={(e) => handleChange("referencia", e.target.value)}
          placeholder="Próximo a..., referência..."
        />
      </div>

      {(safeValue.latitude && safeValue.longitude) && (
        <div className="text-[10px] text-green-600 bg-green-50 p-2 rounded flex items-center gap-2">
          <span className="font-medium">✓</span> Coordenadas capturadas: {safeValue.latitude?.toFixed(5)}, {safeValue.longitude?.toFixed(5)}
        </div>
      )}
    </div>
  );
}

export default EnderecoCompleto;