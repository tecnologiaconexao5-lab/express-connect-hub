import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
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
import { supabase } from "@/lib/supabase";

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

/* MISSÃO ENDERECOS-INTELIGENTES — endereços salvos do cliente */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EnderecoSalvoCliente {
  id: string;
  nomeLocal?: string | null;
  tipoEndereco?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  referencia?: string | null;
  instrucoes?: string | null;
  contatoLocal?: string | null;
  telefoneLocal?: string | null;
  portaria?: string | null;
  doca?: string | null;
  procedimentoEntrada?: string | null;
  procedimentoSaida?: string | null;
  restricoes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  usos: number;
}

const normalizarTexto = (v?: string | null) =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const chaveEndereco = (logradouro?: string | null, numero?: string | null) =>
  `${normalizarTexto(logradouro)}|${normalizarTexto(numero)}`;

const COLUNAS_ENDERECO_COMPLETAS =
  "id, nome_local, tipo_endereco, cep, logradouro, numero, complemento, bairro, cidade, uf, referencia, instrucoes, contato_local, telefone_local, portaria, doca, procedimento_entrada, procedimento_saida, restricoes, latitude, longitude";
const COLUNAS_ENDERECO_BASE =
  "id, nome_local, tipo_endereco, cep, logradouro, numero, complemento, bairro, cidade, uf, latitude, longitude";

const cacheEnderecosCliente = new Map<string, Promise<EnderecoSalvoCliente[]>>();

const carregarEnderecosSalvosCliente = (clienteId: string): Promise<EnderecoSalvoCliente[]> => {
  const existente = cacheEnderecosCliente.get(clienteId);
  if (existente) return existente;

  const promessa = (async (): Promise<EnderecoSalvoCliente[]> => {
    let consulta = supabase
      .from("enderecos_clientes")
      .select(COLUNAS_ENDERECO_COMPLETAS)
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(20);
    let resultado: any = await consulta;
    if (resultado.error) {
      // Colunas extras da M132-A podem não existir em alguns ambientes → tenta base
      resultado = await supabase
        .from("enderecos_clientes")
        .select(COLUNAS_ENDERECO_BASE)
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(20);
    }
    const linhas = resultado.data;
    if (resultado.error || !linhas) return [];

    const usos = new Map<string, number>();
    try {
      const { data: oss } = await supabase
        .from("ordens_servico")
        .select("enderecos")
        .eq("cliente_id", clienteId)
        .limit(100);
      (oss || []).forEach((os: any) => {
        const lista = Array.isArray(os?.enderecos) ? os.enderecos : [];
        lista.forEach((e: any) => {
          if (!e?.logradouro) return;
          const chave = chaveEndereco(e.logradouro, e.numero);
          usos.set(chave, (usos.get(chave) || 0) + 1);
        });
      });
    } catch {
      // contagem de uso é opcional — não bloqueia a lista
    }

    const lista = (linhas as any[]).map((l) => ({
      id: l.id,
      nomeLocal: l.nome_local,
      tipoEndereco: l.tipo_endereco,
      cep: l.cep,
      logradouro: l.logradouro,
      numero: l.numero,
      complemento: l.complemento,
      bairro: l.bairro,
      cidade: l.cidade,
      uf: l.uf,
      referencia: l.referencia,
      instrucoes: l.instrucoes,
      contatoLocal: l.contato_local,
      telefoneLocal: l.telefone_local,
      portaria: l.portaria,
      doca: l.doca,
      procedimentoEntrada: l.procedimento_entrada,
      procedimentoSaida: l.procedimento_saida,
      restricoes: l.restricoes,
      latitude: l.latitude,
      longitude: l.longitude,
      usos: usos.get(chaveEndereco(l.logradouro, l.numero)) || 0,
    })) as EnderecoSalvoCliente[];

    // mais usados primeiro (sort estável preserva created_at desc em empates)
    lista.sort((a, b) => (b.usos || 0) - (a.usos || 0));
    return lista;
  })().catch(() => [] as EnderecoSalvoCliente[]);

  cacheEnderecosCliente.set(clienteId, promessa);
  return promessa;
};

export function EnderecoCompleto({ value, onChange, label, required, clienteId, readOnly, hideOperationalDetails = false, hideDebugInfo = false }: EnderecoCompletoProps) {
  const safeValue: EnderecoType = value || { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", referencia: "" };
  
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepInput, setCepInput] = useState(safeValue.cep || "");
  
  const [logradouroInput, setLogradouroInput] = useState(safeValue.logradouro || "");
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingMapbox, setLoadingMapbox] = useState(false);
  const [showOperacional, setShowOperacional] = useState(false);
  const [enderecosSalvos, setEnderecosSalvos] = useState<EnderecoSalvoCliente[]>([]);
  
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
    carregarEnderecosSalvosCliente(clienteId).then((lista) => {
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
  const textoBusca = normalizarTexto(logradouroInput);
  const enderecosSalvosFiltrados = !textoBusca
    ? enderecosSalvos
    : enderecosSalvos.filter((e) =>
        normalizarTexto(e.logradouro).includes(textoBusca) ||
        normalizarTexto(e.nomeLocal).includes(textoBusca) ||
        normalizarTexto(e.bairro).includes(textoBusca) ||
        normalizarTexto(e.cep).includes(textoBusca)
      );

  const handleSelectEnderecoSalvo = useCallback((salvo: EnderecoSalvoCliente) => {
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
    toast.success(salvo.nomeLocal ? `Endereço "${salvo.nomeLocal}" aplicado` : "Endereço salvo do cliente aplicado");
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
                      Endereços salvos do cliente
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
                          {salvo.tipoEndereco || "Endereço"}
                          {salvo.usos > 0 ? ` · Usado em ${salvo.usos} OS${salvo.usos > 1 ? "s" : ""}` : ""}
                        </div>
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