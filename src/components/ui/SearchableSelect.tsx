import { useState, useEffect, useRef } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

interface SearchableSelectProps {
  table: string;
  labelField: string;
  valueField?: string;
  searchFields: string[];
  placeholder?: string;
  value: string | null;
  onChange: (value: string | null, record: any) => void;
  filters?: Record<string, any>;
  renderOption?: (record: any) => React.ReactNode;
}

export function SearchableSelect({
  table,
  labelField,
  valueField = "id",
  searchFields,
  placeholder = "Buscar...",
  value,
  onChange,
  filters,
  renderOption
}: SearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<any>(null);
  
  const wrapperRef = useRef<HTMLDivElement>(null);

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
            query = query.eq(k, v);
         });
      }

      const { data, error } = await query;
      
      if (!error && data) {
         setResults(data);
      } else {
         setResults([]);
      }
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, isOpen, table, searchFields, filters]);

  const handleSelect = (record: any) => {
    setSelectedValue(record);
    setSearchTerm(record[labelField]);
    setIsOpen(false);
    onChange(record[valueField], record);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedValue(null);
    setSearchTerm("");
    onChange(null, null);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        <Input 
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
             setSearchTerm(e.target.value);
             if (!isOpen) setIsOpen(true);
             if (selectedValue) {
                // Se alterar recomeça a busca
                setSelectedValue(null);
                onChange(null, null);
             }
          }}
          onClick={() => setIsOpen(true)}
          className="pr-10"
        />
        <div className="absolute right-2 flex items-center gap-1">
           {searchTerm && (
             <X className="w-4 h-4 text-slate-400 hover:text-red-500 cursor-pointer" onClick={handleClear} />
           )}
           {isLoading ? (
             <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
           ) : (
             <Search className="w-4 h-4 text-slate-400" />
           )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {results.length === 0 && !isLoading ? (
             <div className="p-3 text-sm text-slate-500 text-center">Nenhum resultado encontrado.</div>
          ) : (
             <ul>
               {results.map((item, idx) => (
                 <li 
                   key={item[valueField] || idx}
                   onClick={() => handleSelect(item)}
                   className="p-2 px-3 text-sm hover:bg-slate-50 cursor-pointer border-b last:border-0"
                 >
                   {renderOption ? renderOption(item) : item[labelField]}
                 </li>
               ))}
             </ul>
          )}
        </div>
      )}
    </div>
  );
}
