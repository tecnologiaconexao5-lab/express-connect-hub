import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export interface EnderecoType {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  referencia?: string;
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

// Funcao mascara CEP
const mascaraCep = (v: string) => {
  v = v.replace(/\D/g, "");
  if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, "$1-$2");
  return v;
};

export function EnderecoCompleto({ value, onChange, label, required }: EnderecoCompletoProps) {
  const [loadingCep, setLoadingCep] = useState(false);

  const handleChange = (field: keyof EnderecoType, val: string) => {
    onChange({ ...value, [field]: val });
  };

  const handleBlurCep = async () => {
    const limpo = value.cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      
      if (data.erro) {
         toast.error("CEP não encontrado.");
         return;
      }

      onChange({
        ...value,
        logradouro: data.logradouro || value.logradouro,
        bairro: data.bairro || value.bairro,
        cidade: data.localidade || value.cidade,
        estado: data.uf || value.estado,
      });
      toast.success("Endereço preenchido via ViaCEP.");
    } catch {
      toast.error("Erro ao consultar o CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
       {label && <h4 className="text-sm font-semibold text-slate-800 border-b pb-2 mb-4">{label}</h4>}
       
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 space-y-1 relative">
             <Label>CEP {required && <span className="text-red-500">*</span>}</Label>
             <div className="relative">
               <Input 
                 value={value.cep} 
                 onChange={(e) => handleChange("cep", mascaraCep(e.target.value))} 
                 onBlur={handleBlurCep}
                 placeholder="00000-000"
                 maxLength={9}
                 className={loadingCep ? "pr-8" : ""}
               />
               {loadingCep && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-slate-400" />}
             </div>
          </div>
          <div className="col-span-1 md:col-span-3 space-y-1">
             <Label>Logradouro (Rua/Av) {required && <span className="text-red-500">*</span>}</Label>
             <Input value={value.logradouro} onChange={(e) => handleChange("logradouro", e.target.value)} />
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
             <Label>Número {required && <span className="text-red-500">*</span>}</Label>
             <Input value={value.numero} onChange={(e) => handleChange("numero", e.target.value)} />
          </div>
          <div className="space-y-1">
             <Label>Complemento</Label>
             <Input value={value.complemento} onChange={(e) => handleChange("complemento", e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1">
             <Label>Bairro {required && <span className="text-red-500">*</span>}</Label>
             <Input value={value.bairro} onChange={(e) => handleChange("bairro", e.target.value)} />
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-3 space-y-1">
             <Label>Cidade {required && <span className="text-red-500">*</span>}</Label>
             <Input value={value.cidade} onChange={(e) => handleChange("cidade", e.target.value)} />
          </div>
          <div className="md:col-span-1 space-y-1">
             <Label>UF {required && <span className="text-red-500">*</span>}</Label>
             <Select value={value.estado || ""} onValueChange={(v) => handleChange("estado", v)}>
               <SelectTrigger className="bg-white"><SelectValue placeholder="UF" /></SelectTrigger>
               <SelectContent>
                 {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
               </SelectContent>
             </Select>
          </div>
          <div className="md:col-span-2 space-y-1">
             <Label>Ponto de Referência</Label>
             <Input value={value.referencia || ""} onChange={(e) => handleChange("referencia", e.target.value)} />
          </div>
       </div>
    </div>
  );
}
