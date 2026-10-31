import { useState, useEffect, useRef } from "react";
import { Search, Loader2, X, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { BadgeCadastroIncompleto } from "@/components/ui/BadgeCadastroIncompleto";

interface SearchableSelectProps {
  table: string;
  labelField: string;
  valueField?: string;
  returnField?: string;
  searchFields: string[];
  placeholder?: string;
  value: string | null;
  onChange: (value: string | null, record: any) => void;
  filters?: Record<string, any>;
  renderOption?: (record: any) => React.ReactNode;
  /** Campo secundário exibido abaixo do rótulo (ex.: cnpj). Apenas visual. */
  secondaryField?: string;
  /** Desabilita o campo (somente leitura, sem abertura do dropdown). */
  disabled?: boolean;
  /** Habilita a linha "Cadastrar '<termo>'" no dropdown (cadastro rápido). */
  allowQuickCreate?: boolean;
  /** Cria o registro rápido a partir do termo digitado. Deve retornar o registro criado (ou null). */
  onQuickCreate?: (termo: string) => Promise<Record<string, unknown> | null>;
  /** Marca um registro como incompleto (exibe o badge "Cadastro Incompleto" na opção). */
  isIncomplete?: (record: Record<string, unknown>) => boolean;
}

export function SearchableSelect({
  table,
  labelField,
  valueField = "id",
  returnField,
  searchFields,
  placeholder = "Buscar...",
  value,
  onChange,
  filters,
  renderOption,
  secondaryField,
  disabled = false,
  allowQuickCreate = false,
  onQuickCreate,
  isIncomplete,
}: SearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<any>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isQuickCreating, setIsQuickCreating] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Busca inicial caso já exista value preenchido
  useEffect(() => {
    if (value && !selectedValue) {
      const fetchInitial = async () => {
        const { data } = await supabase.from(table).select("*").eq(valueField, value).single();
        if (data) {
          setSelectedValue(data);
          setSearchTerm(data[labelField]);
        }
      };
      fetchInitial();
    } else if (!value) {
       setSelectedValue(null);
       setSearchTerm("");
    }
  }, [value, table, labelField, valueField]);

  useEffect(() => {
    if (!isOpen) return;
    
    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      
      let query = supabase.from(table).select("*").limit(10);
      
      if (searchTerm) {
         // Build OR query like: nome.ilike.%termo%,cnpj.ilike.%termo%
         const orString = searchFields.map(f => `${f}.ilike.%${searchTerm}%`).join(",");
         query = query.or(orString);
      }
      
      if (filters) {
         Object.entries(filters).forEach(([k, v]) => {
            if (Array.isArray(v)) {
               // Filtro por lista (ex.: status em ["ativo","pre-cadastro"]).
               if (v.length > 0) query = query.in(k, v);
               return;
            }
            if (v === undefined || v === null) return;
            query = query.eq(k, v);
         });
      }

      const { data, error } = await query;
      
      if (!error && data) {
         setResults(data);
      } else {
         setResults([]);
      }
      setActiveIndex(-1);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, isOpen, table, searchFields, filters]);

  // Mantém o item ativo visível durante navegação por teclado
  useEffect(() => {
    if (activeIndex < 0) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleSelect = (record: any) => {
    setSelectedValue(record);
    setSearchTerm(record[labelField]);
    setIsOpen(false);
    setActiveIndex(-1);
    const returnVal = returnField ? record[returnField] : record[valueField];
    onChange(returnVal, record);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedValue(null);
    setSearchTerm("");
    onChange(null, null);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const termoRapido = searchTerm.trim();
  const podeCriarRapido =
    allowQuickCreate && !!onQuickCreate && !disabled && !isLoading && termoRapido.length > 0;

  const handleQuickCreate = async () => {
    if (!podeCriarRapido || isQuickCreating || !onQuickCreate) return;
    setIsQuickCreating(true);
    try {
      const criado = await onQuickCreate(termoRapido);
      if (criado) {
        handleSelect(criado);
      }
    } catch {
      // Erro tratado pelo chamador (que normalmente exibe toast). Mantém o dropdown aberto.
    } finally {
      setIsQuickCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (results.length === 0 ? -1 : (prev + 1) % results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (results.length === 0 ? -1 : prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelect(results[activeIndex]);
      } else if (podeCriarRapido) {
        void handleQuickCreate();
      }
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        <Input 
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          disabled={disabled}
          onChange={(e) => {
             if (disabled) return;
             setSearchTerm(e.target.value);
             if (!isOpen) setIsOpen(true);
             if (selectedValue) {
                // Se alterar recomeça a busca
                setSelectedValue(null);
                onChange(null, null);
             }
          }}
          onClick={() => { if (!disabled) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          className="pr-10"
        />
        <div className="absolute right-2 flex items-center gap-1">
           {searchTerm && !disabled && (
             <X className="w-4 h-4 text-slate-400 hover:text-red-500 cursor-pointer" onClick={handleClear} />
           )}
           {isLoading ? (
             <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
           ) : (
             <Search className="w-4 h-4 text-slate-400" />
           )}
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {isLoading && results.length === 0 ? (
             <div className="flex items-center justify-center gap-2 p-3 text-sm text-slate-500">
               <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
             </div>
          ) : results.length === 0 && !podeCriarRapido ? (
             <div className="p-3 text-sm text-slate-500 text-center">Nenhum resultado encontrado.</div>
          ) : (
             <ul ref={listRef} className="py-1">
               {results.map((item, idx) => {
                 const selected = !!selectedValue && item[valueField] === selectedValue[valueField];
                 const incompleto = isIncomplete ? isIncomplete(item) : false;
                 return (
                   <li 
                     key={item[valueField] || idx}
                     data-index={idx}
                     onClick={() => handleSelect(item)}
                     onMouseEnter={() => setActiveIndex(idx)}
                     className={cn(
                       "cursor-pointer px-3 py-2.5 text-sm transition-colors",
                       activeIndex === idx ? "bg-slate-100" : "hover:bg-slate-50",
                     )}
                   >
                     {renderOption ? renderOption(item) : (
                       <div className="flex flex-col">
                         <span className={cn("truncate font-semibold text-slate-800", selected && "text-primary")}>
                           {item[labelField]}
                         </span>
                         <span className="flex items-center gap-1.5">
                           {secondaryField && item[secondaryField] ? (
                             <span className="truncate text-xs text-slate-400">{item[secondaryField]}</span>
                           ) : null}
                           {incompleto ? <BadgeCadastroIncompleto /> : null}
                         </span>
                       </div>
                     )}
                   </li>
                 );
               })}
               {podeCriarRapido ? (
                 <li
                   onClick={() => void handleQuickCreate()}
                   onMouseEnter={() => setActiveIndex(-1)}
                   className="cursor-pointer border-t border-slate-100 bg-primary/5 px-3 py-2.5 text-sm transition-colors hover:bg-primary/10"
                 >
                   <div className="flex items-center gap-2 font-semibold text-primary">
                     {isQuickCreating ? (
                       <Loader2 className="h-4 w-4 animate-spin" />
                     ) : (
                       <UserPlus className="h-4 w-4" />
                     )}
                     <span className="truncate">
                       {isQuickCreating ? "Cadastrando..." : <>Cadastrar <span className="font-bold">"{termoRapido}"</span></>}
                     </span>
                   </div>
                 </li>
               ) : null}
             </ul>
          )}
        </div>
      )}
    </div>
  );
}
