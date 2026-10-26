// ============================================================
// MISSAO COTACAO-EXPRESS-V2 — campo de endereço do fluxo conversacional
// Autocomplete Mapbox (mesma fonte do TMS) desenhado para "boliche"
// de chat: digita → sugestões → toque preenche. Sempre controlado
// (texto + sugestao ficam no pai) para o chat guardar o histórico.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buscarSugestoesEnderecos, type SugestaoEndereco } from "@/services/maps/mapboxProvider";

const DEBOUNCE_MS = 300;

export interface CampoEnderecoChatProps {
  id: string;
  texto: string;
  sugestao: SugestaoEndereco | null;
  onTexto: (valor: string) => void;
  onSelecionar: (sugestao: SugestaoEndereco) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function CampoEnderecoChat({
  id,
  texto,
  sugestao,
  onTexto,
  onSelecionar,
  placeholder = "CEP, bairro ou rua",
  autoFocus = false,
}: CampoEnderecoChatProps) {
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const sequenciaRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao tocar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent) => {
      if (!containerRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  // Busca com debounce + descarte de respostas velhas
  useEffect(() => {
    const termo = texto.trim();
    const digitando = !sugestao || termo !== sugestao.place_name;
    if (digitando) setSugestoes([]);
    if (termo.length < 3 || !digitando) {
      setCarregando(false);
      return;
    }

    const meu = ++sequenciaRef.current;
    const timer = window.setTimeout(async () => {
      setCarregando(true);
      try {
        const resultados = await buscarSugestoesEnderecos(termo);
        if (meu !== sequenciaRef.current) return;
        setSugestoes(resultados);
        setAberto(resultados.length > 0);
      } catch {
        if (meu !== sequenciaRef.current) return;
        setSugestoes([]);
      } finally {
        if (meu === sequenciaRef.current) setCarregando(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [texto, sugestao]);

  const selecionar = useCallback(
    (item: SugestaoEndereco) => {
      setAberto(false);
      setSugestoes([]);
      onSelecionar(item);
    },
    [onSelecionar],
  );

  const teclado = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === "Escape") {
      setAberto(false);
      return;
    }
    if (evento.key === "Enter" && aberto && sugestoes.length > 0) {
      evento.preventDefault();
      selecionar(sugestoes[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-500" />
        <Input
          id={id}
          className="h-12 rounded-xl pl-9 text-base"
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={aberto}
          value={texto}
          onChange={(e) => {
            onTexto(e.target.value);
            setAberto(true);
          }}
          onFocus={() => sugestoes.length > 0 && setAberto(true)}
          onKeyDown={teclado}
        />
        {carregando && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {sugestao && !aberto && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <MapPin className="h-3.5 w-3.5" /> {sugestao.cidade || "Endereço selecionado"}
          {sugestao.uf ? ` · ${sugestao.uf}` : ""}
        </p>
      )}

      {aberto && sugestoes.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {sugestoes.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => selecionar(item)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-orange-50"
              >
                <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.place_name}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {[item.bairro, item.cidade, item.uf].filter(Boolean).join(" · ") || " "}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
