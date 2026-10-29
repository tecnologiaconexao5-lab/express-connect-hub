import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ChevronDown, ChevronRight, MapPin, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { buscarCEP } from "@/services/cepService";
import {
  buscarEnderecos,
  extrairDadosDaSuggestion,
  extrairDadosDePlaceName,
  complementarDadosEndereco,
  cepCompleto,
  MapboxSuggestion,
} from "@/services/maps/mapboxAutocomplete";
import {
  buscarHistoricoEnderecosCliente,
  normalizarTextoEndereco,
  type EnderecoHistoricoCliente,
} from "@/services/clientes/historicoEnderecosCliente";

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
  /** MISSÃO 132-A — Campos operacionais de endereço */
  portaria?: string;
  doca?: string;
  procedimentoEntrada?: string;
  procedimentoSaida?: string;
  estacionamento?: string;
  documentoNecessario?: string;
  codigoAcesso?: string;
  exigenciaEpi?: boolean;
  exigeAjudante?: boolean;
  restricaoVeiculo?: string;
  restricaoAltura?: string;
  outrasRestricoes?: string;
  contatoNome?: string;
  contatoTelefone?: string;
  horarioLimite?: string;
  dataPrevista?: string;
}

interface EnderecoCompletoProps {
  value: EnderecoType;
  onChange: (endereco: EnderecoType) => void;
  label?: string;
  required?: boolean;
  /** MISSÃO ENDERECOS-INTELIGENTES — cliente dono do endereço (oferece endereços salvos) */
  clienteId?: string;
  /** Desabilita edição (modo ver / OS finalizada) */
  readOnly?: boolean;
  /** OVERHAUL-UX-PEDIDO-RAPIDO — oculta a seção "Dados operacionais do local" (portaria, doca, etc.) em fluxos públicos */
  hideOperationalDetails?: boolean;
  /** REFINAMENTO-B2B — oculta o box verde de debug "Coordenadas capturadas" (dado interno, não exibir ao cliente) */
  hideDebugInfo?: boolean;
  /** Notifica quando um endereço salvo/recente do cliente é aplicado (preenche campos extras do formulário) */
  onSelectEnderecoSalvo?: (endereco: EnderecoHistoricoCliente) => void;
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function EnderecoCompleto({ value, onChange, label, required, clienteId, readOnly, hideOperationalDetails = false, hideDebugInfo = false, onSelectEnderecoSalvo }: EnderecoCompletoProps) {
  const safeValue: EnderecoType = value || { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", referencia: "" };
  
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepInput, setCepInput] = useState(safeValue.cep || "");
  
  const [logradouroInput, setLogradouroInput] = useState(safeValue.logradouro || "");
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingMapbox, setLoadingMapbox] = useState(false);
  const [showOperacional, setShowOperacional] = useState(false);
  const [enderecosSalvos, setEnderecosSalvos] = useState<EnderecoHistoricoCliente[]>([]);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // FIX-AUTOCOMPLETE — cancela o complemento assíncrono (CEP/Bairro/Cidade/UF)
  // se o usuário editar o endereço enquanto a resposta chega.
  const selecaoTokenRef = useRef(0);

  useEffect(() => {
    if (safeValue.cep) setCepInput(safeValue.cep);
  }, [safeValue.cep]);

  useEffect(() => {
    if (safeValue.logradouro) setLogradouroInput(safeValue.logradouro);
  }, [safeValue.logradouro]);

  // MISSÃO ENDERECOS-INTELIGENTES — carrega endereços salvos do cliente selecionado
  useEffect(() => {
    let ativo = true;
    setEnderecosSalvos([]);
    if (!clienteId || !UUID_REGEX.test(clienteId)) return;
    buscarHistoricoEnderecosCliente(clienteId).then((lista) => {
      if (ativo) setEnderecosSalvos(lista);
    });
    return () => { ativo = false; };
  }, [clienteId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (field: keyof EnderecoType, val: string | boolean) => {
    selecaoTokenRef.current++; // edição manual cancela complemento pendente
    const copia = { ...safeValue };
    (copia as any)[field] = val;
    onChange(copia);
  };

  const temConteudo = (str?: string) => {
    if (!str || !str.trim()) return false;
    return str.trim().length > 2;
  };

  const handleCepBlur = async () => {
    selecaoTokenRef.current++;
    const limpo = cepInput.replace(/\D/g, "");
    if (limpo.length !== 8) return;

    const copia = { ...safeValue };
    copia.cep = cepInput;
    onChange(copia);

    if (temConteudo(safeValue.logradouro) && temConteudo(safeValue.bairro) && temConteudo(safeValue.cidade) && temConteudo(safeValue.estado)) {
      setLoadingCep(false);
      return;
    }

    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      
      if (data.erro) {
         toast.error("CEP não encontrado.");
      } else {
        const updated = { ...safeValue };
        updated.cep = data.cep || cepInput;
        if (data.logradouro && !temConteudo(safeValue.logradouro)) updated.logradouro = data.logradouro;
        if (data.complemento && !temConteudo(safeValue.complemento)) updated.complemento = data.complemento;
        if (data.bairro && !temConteudo(safeValue.bairro)) updated.bairro = data.bairro;
        if (data.localidade && !temConteudo(safeValue.cidade)) updated.cidade = data.localidade;
        if (data.uf && !temConteudo(safeValue.estado)) updated.estado = data.uf;
        
        if ((!data.logradouro || !data.bairro) && !temConteudo(safeValue.logradouro) && !temConteudo(safeValue.bairro)) {
           toast.info("CEP geral ou incompleto. Preencha os campos ausentes.");
        }
        if (data.logradouro) setLogradouroInput(data.logradouro);
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
    // FIX-USABILIDADE — parsing SÍNCRONO do place_name garante que Bairro e CEP
    // sejam preenchidos imediatamente ao escolher a rua (sem esperar rede).
    const parsed = extrairDadosDePlaceName(suggestion.place_name, suggestion.text);

    // NUNCA injeta CEP parcial (<8 dígitos). Só usa CEP completo da sugestão,
    // do place_name ou um CEP já completo existente no formulário.
    const cepSelecionado =
      (cepCompleto(dados.cep) ? dados.cep : undefined) ||
      (cepCompleto(parsed.cep) ? parsed.cep : undefined) ||
      (cepCompleto(safeValue.cep) ? safeValue.cep : undefined) ||
      "";

    const updated: EnderecoType = {
      ...safeValue,
      logradouro: dados.logradouro || safeValue.logradouro,
      numero: dados.numero || safeValue.numero,
      bairro: dados.bairro || safeValue.bairro || parsed.bairro,
      cidade: dados.cidade || safeValue.cidade || parsed.cidade,
      estado: dados.estado || safeValue.estado || parsed.estado,
      cep: cepSelecionado,
      latitude: dados.latitude,
      longitude: dados.longitude,
      enderecoFormatado: dados.enderecoFormatado,
      mapboxPlaceId: dados.mapboxPlaceId,
    };

    setLogradouroInput(dados.logradouro);
    if (cepSelecionado) {
      setCepInput(mascaraCep(String(cepSelecionado).replace(/\D/g, "")));
    } else {
      setCepInput(""); // limpa prefixo incompleto herdado
    }
    setSuggestions([]);
    setShowSuggestions(false);
    onChange(updated);

    // FIX-AUTOCOMPLETE — o context do Mapbox frequentemente não traz
    // CEP/bairro/cidade/UF no Brasil. Complementa o que ainda faltou
    // (reverse geocoding) e grava apenas os campos realmente vazios.
    const base = {
      cep: updated.cep,
      bairro: updated.bairro,
      cidade: updated.cidade,
      estado: updated.estado,
    };
    const precisaComplementar =
      !base.cep?.trim() || !base.bairro?.trim() || !base.cidade?.trim() || !base.estado?.trim();
    if (!precisaComplementar) return;

    const token = ++selecaoTokenRef.current;
    complementarDadosEndereco(base, suggestion)
      .then((patch) => {
        if (selecaoTokenRef.current !== token) return; // usuário editou no meio
        const chaves = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => patch[k]);
        if (chaves.length === 0) return;
        if (patch.cep) setCepInput(mascaraCep(String(patch.cep).replace(/\D/g, "")));
        onChange({ ...updated, ...patch });
      })
      .catch(() => {
        // complemento é best-effort — nunca bloqueia a seleção
      });
  }, [onChange, safeValue]);

  // MISSÃO ENDERECOS-INTELIGENTES — filtragem e aplicação de endereço salvo do cliente
  const textoBusca = normalizarTextoEndereco(logradouroInput);
  const enderecosSalvosFiltrados = !textoBusca
    ? enderecosSalvos
    : enderecosSalvos.filter((e) =>
        normalizarTextoEndereco(e.logradouro).includes(textoBusca) ||
        normalizarTextoEndereco(e.nomeLocal).includes(textoBusca) ||
        normalizarTextoEndereco(e.bairro).includes(textoBusca) ||
        normalizarTextoEndereco(e.cep).includes(textoBusca)
      );

  const handleSelectEnderecoSalvo = useCallback((salvo: EnderecoHistoricoCliente) => {
    selecaoTokenRef.current++; // cancela complemento Mapbox pendente
    const logradouro = salvo.logradouro || "";
    const linhas = [
      [logradouro, salvo.numero].filter(Boolean).join(", "),
      [salvo.bairro, [salvo.cidade, salvo.uf].filter(Boolean).join("/")].filter(Boolean).join(", "),
    ].filter(Boolean).join(" - ");

    const atualizado: EnderecoType = {
      ...safeValue,
      cep: salvo.cep || safeValue.cep || "",
      logradouro: logradouro || safeValue.logradouro || "",
      numero: salvo.numero ?? safeValue.numero ?? "",
      complemento: salvo.complemento || safeValue.complemento || "",
      bairro: salvo.bairro || safeValue.bairro || "",
      cidade: salvo.cidade || safeValue.cidade || "",
      estado: salvo.uf || safeValue.estado || "",
      referencia: salvo.referencia || salvo.instrucoes || safeValue.referencia || "",
      latitude: salvo.latitude ?? safeValue.latitude,
      longitude: salvo.longitude ?? safeValue.longitude,
      enderecoFormatado: linhas || safeValue.enderecoFormatado,
      portaria: salvo.portaria || safeValue.portaria || "",
      doca: salvo.doca || safeValue.doca || "",
      procedimentoEntrada: salvo.procedimentoEntrada || safeValue.procedimentoEntrada || "",
      procedimentoSaida: salvo.procedimentoSaida || safeValue.procedimentoSaida || "",
      contatoNome: salvo.contatoLocal || safeValue.contatoNome || "",
      contatoTelefone: salvo.telefoneLocal || safeValue.contatoTelefone || "",
      outrasRestricoes: salvo.restricoes || safeValue.outrasRestricoes || "",
    };

    if (logradouro) setLogradouroInput(logradouro);
    if (salvo.cep) setCepInput(salvo.cep);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange(atualizado);
    onSelectEnderecoSalvo?.(salvo);
    toast.success(salvo.nomeLocal ? `Endereço "${salvo.nomeLocal}" aplicado` : "Endereço do cliente aplicado");
  }, [onChange, onSelectEnderecoSalvo, safeValue]);

  return (
    <div ref={containerRef} className="space-y-3">
      {label && <Label className="text-xs font-medium text-muted-foreground">{label}</Label>}

      {/* ETAPA-4 — Endereços salvos/mais usados do cliente (seleção rápida) */}
      {clienteId && enderecosSalvos.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
            Endereços salvos do cliente
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
              {enderecosSalvos.length}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[...enderecosSalvos]
              .sort((a, b) => (Number(b.usos) || 0) - (Number(a.usos) || 0))
              .slice(0, 6)
              .map((salvo) => (
                <button
                  key={salvo.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => handleSelectEnderecoSalvo(salvo)}
                  className="flex max-w-[220px] items-center gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={[salvo.logradouro, salvo.numero, salvo.bairro, salvo.cidade, salvo.uf].filter(Boolean).join(", ")}
                >
                  <MapPin className="h-3 w-3 shrink-0 text-amber-600" />
                  <span className="truncate">{salvo.nomeLocal || salvo.logradouro || "Endereço"}</span>
                  {salvo.usos > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1 text-[9px] font-bold text-amber-700">
                      {salvo.usos}×
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-1">
          <Label className="text-[10px] text-muted-foreground">CEP</Label>
          <div className="relative">
            <Input 
              value={cepInput} 
              onChange={(e) => setCepInput(mascaraCep(e.target.value))}
              onBlur={handleCepBlur}
              onFocus={() => { if (enderecosSalvosFiltrados.length > 0) setShowSuggestions(true); }}
              placeholder="00000-000"
              maxLength={9}
              disabled={readOnly}
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
              onFocus={() => { if (enderecosSalvosFiltrados.length > 0 || suggestions.length > 0) setShowSuggestions(true); }}
              placeholder="Digite o endereço para buscar sugestões"
              disabled={readOnly}
            />
            {loadingMapbox && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            
            {showSuggestions && (enderecosSalvosFiltrados.length > 0 || suggestions.length > 0) && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {enderecosSalvosFiltrados.length > 0 && (
                  <div className="border-b">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border-b border-amber-100">
                      Endereços salvos e recentes do cliente
                    </div>
                    {enderecosSalvosFiltrados.map((salvo) => (
                      <button
                        key={salvo.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-amber-100 last:border-b-0 text-sm transition-colors"
                        onClick={() => handleSelectEnderecoSalvo(salvo)}
                      >
                        <div className="font-medium text-gray-900 text-xs">
                          {salvo.nomeLocal ? `${salvo.nomeLocal} · ` : ""}
                          {salvo.logradouro || "Sem logradouro"}{salvo.numero ? `, ${salvo.numero}` : ""}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {[salvo.bairro, [salvo.cidade, salvo.uf].filter(Boolean).join("/"), salvo.cep].filter(Boolean).join(" · ")}
                        </div>
                        <div className="text-[10px] text-amber-700 font-medium">
                          {salvo.origem === "cadastro" ? salvo.tipoEndereco || "Cadastro" : "Recente"}
                          {salvo.usos > 0 ? ` · Usado em ${salvo.usos} OS${salvo.usos > 1 ? "s" : ""}` : ""}
                        </div>
                        {(salvo.contatoLocal || salvo.telefoneLocal) && (
                          <div className="text-[10px] text-gray-600 break-words">
                            👤 Procurar: {salvo.contatoLocal || "Contato não informado"}
                            {salvo.telefoneLocal ? ` · ${salvo.telefoneLocal}` : ""}
                          </div>
                        )}
                        {salvo.instrucoes && (
                          <div className="text-[10px] text-gray-600 break-words">
                            📝 {salvo.instrucoes}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
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
            disabled={readOnly}
          />
        </div>
        <div className="col-span-2 md:col-span-2">
          <Label className="text-[10px] text-muted-foreground">Complemento</Label>
          <Input 
            value={safeValue.complemento || ""} 
            onChange={(e) => handleChange("complemento", e.target.value)}
            placeholder="Apto, sala, etc"
            disabled={readOnly}
          />
        </div>
        <div className="col-span-2 md:col-span-3">
          <Label className="text-[10px] text-muted-foreground">Bairro</Label>
          <Input 
            value={safeValue.bairro || ""} 
            onChange={(e) => handleChange("bairro", e.target.value)}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2 md:col-span-3">
          <Label className="text-[10px] text-muted-foreground">Cidade</Label>
          <Input 
            value={safeValue.cidade || ""} 
            onChange={(e) => handleChange("cidade", e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">UF</Label>
          <Select value={safeValue.estado || ""} onValueChange={(v) => handleChange("estado", v)} disabled={readOnly}>
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
          disabled={readOnly}
        />
      </div>

      {/* MISSÃO 132-A — Dados operacionais do local */}
      {!hideOperationalDetails && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowOperacional(!showOperacional)}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 transition-colors"
          >
            {showOperacional ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Dados operacionais do local
          </button>

          {showOperacional && (
            <div className="mt-2 space-y-3 border border-blue-100 bg-blue-50/30 p-3 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Portaria</Label>
                <Input
                  value={safeValue.portaria || ""}
                  onChange={(e) => handleChange("portaria", e.target.value)}
                  placeholder="Portaria de cargas"
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Doca</Label>
                <Input
                  value={safeValue.doca || ""}
                  onChange={(e) => handleChange("doca", e.target.value)}
                  placeholder="Doca 01"
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Contato no local</Label>
                <Input
                  value={safeValue.contatoNome || ""}
                  onChange={(e) => handleChange("contatoNome", e.target.value)}
                  placeholder="Nome do contato"
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Telefone do contato</Label>
                <Input
                  value={safeValue.contatoTelefone || ""}
                  onChange={(e) => handleChange("contatoTelefone", e.target.value)}
                  placeholder="(11) 99999-9999"
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Procedimento de entrada</Label>
                <Textarea
                  value={safeValue.procedimentoEntrada || ""}
                  onChange={(e) => handleChange("procedimentoEntrada", e.target.value)}
                  placeholder="Apresentar documento na portaria..."
                  rows={2}
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Procedimento de saída</Label>
                <Textarea
                  value={safeValue.procedimentoSaida || ""}
                  onChange={(e) => handleChange("procedimentoSaida", e.target.value)}
                  placeholder="Procedimento para saída..."
                  rows={2}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Estacionamento</Label>
                <Input
                  value={safeValue.estacionamento || ""}
                  onChange={(e) => handleChange("estacionamento", e.target.value)}
                  placeholder="Estacionamento interno, pátio..."
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Documento necessário</Label>
                <Input
                  value={safeValue.documentoNecessario || ""}
                  onChange={(e) => handleChange("documentoNecessario", e.target.value)}
                  placeholder="RG, CTE, NF..."
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Código de acesso</Label>
                <Input
                  value={safeValue.codigoAcesso || ""}
                  onChange={(e) => handleChange("codigoAcesso", e.target.value)}
                  placeholder="Senha ou código"
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Restrição de veículo</Label>
                <Input
                  value={safeValue.restricaoVeiculo || ""}
                  onChange={(e) => handleChange("restricaoVeiculo", e.target.value)}
                  placeholder="VUC, cavalo mecânico..."
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Restrição de altura</Label>
                <Input
                  value={safeValue.restricaoAltura || ""}
                  onChange={(e) => handleChange("restricaoAltura", e.target.value)}
                  placeholder="4.5m"
                  disabled={readOnly}
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Checkbox
                  id="exigenciaEpi"
                  checked={safeValue.exigenciaEpi || false}
                  onCheckedChange={(v) => handleChange("exigenciaEpi", Boolean(v))}
                  disabled={readOnly}
                />
                <Label htmlFor="exigenciaEpi" className="text-[11px] cursor-pointer">Exige EPI</Label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Checkbox
                  id="exigeAjudante"
                  checked={safeValue.exigeAjudante || false}
                  onCheckedChange={(v) => handleChange("exigeAjudante", Boolean(v))}
                  disabled={readOnly}
                />
                <Label htmlFor="exigeAjudante" className="text-[11px] cursor-pointer">Exige ajudante</Label>
              </div>
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground">Outras restrições</Label>
              <Input
                value={safeValue.outrasRestricoes || ""}
                onChange={(e) => handleChange("outrasRestricoes", e.target.value)}
                placeholder="Outras restrições operacionais..."
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </div>
      )}

      {!hideDebugInfo && (safeValue.latitude && safeValue.longitude) && (
        <div className="text-[10px] text-green-600 bg-green-50 p-2 rounded flex items-center gap-2">
          <span className="font-medium">✓</span> Coordenadas capturadas: {safeValue.latitude?.toFixed(5)}, {safeValue.longitude?.toFixed(5)}
        </div>
      )}
    </div>
  );
}

export default EnderecoCompleto;