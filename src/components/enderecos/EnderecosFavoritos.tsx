import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Search, Star, Building, Home, Briefcase, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export interface EnderecoCompleto {
  cep: string;
  endereco: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  uf: string;
  contato?: string;
  telefone?: string;
  instrucoes?: string;
  janelaInicio?: string;
  janelaFim?: string;
}

export function FavoritosDropdown({ onSelect }: { onSelect: (end: EnderecoCompleto) => void }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [favoritos, setFavoritos] = useState<any[]>([]);

  useEffect(() => {
    // Mock fetch favoritos
    setFavoritos([
      { id: 1, nome: "CD Matriz São Paulo", tipo: "coleta", cep: "01000-000", endereco: "Av Paulista, 1000", cidade: "São Paulo", uf: "SP", usos: 45, padrao: true, instrucoes: "Procurar doca 2", contato: "João Moura", telefone: "11999999999", janelaInicio: "08:00", janelaFim: "18:00" },
      { id: 2, nome: "Filial ABC", tipo: "ambos", cep: "09000-000", endereco: "Rua das Indústrias, 45", cidade: "Santo André", uf: "SP", usos: 12, padrao: false, instrucoes: "Entrar pela lateral" },
      { id: 3, nome: "Cliente Nuty Açaí", tipo: "entrega", cep: "20000-000", endereco: "Av Rio Branco, 400", cidade: "Rio de Janeiro", uf: "RJ", usos: 8, padrao: false }
    ]);
  }, []);

  const filtrados = favoritos.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()) || f.cidade.toLowerCase().includes(busca.toLowerCase()));

  const handleSelect = (f: any) => {
    onSelect(f);
    setOpen(false);
    toast.success(`Endereço "${f.nome}" carregado.`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:text-orange-700 whitespace-nowrap">
          <MapPin className="w-3.5 h-3.5" /> Favoritos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500 fill-yellow-500"/> Meus Endereços Salvos</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, cidade..." className="pl-9" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filtrados.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Nenhum endereço encontrado.</p>}
            {filtrados.map(f => (
              <div key={f.id} className="p-3 border rounded-lg hover:border-primary/50 hover:bg-muted/20 cursor-pointer flex justify-between items-center transition" onClick={() => handleSelect(f)}>
                <div className="flex gap-3">
                  <div className="mt-1">
                    {f.tipo === 'coleta' ? <Building className="w-4 h-4 text-blue-500"/> : f.tipo === 'entrega' ? <Home className="w-4 h-4 text-green-500"/> : <Briefcase className="w-4 h-4 text-orange-500"/>}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <p className="font-semibold text-sm text-slate-800">{f.nome}</p>
                       {f.padrao && <Badge variant="secondary" className="text-[9px] h-4 py-0 select-none">Padrão</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.endereco} - {f.cidade}/{f.uf}</p>
                    {f.usos > 0 && <p className="text-[10px] text-muted-foreground/60 mt-1 mt-0.5">Usado {f.usos} vezes</p>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs font-semibold text-primary">Usar</Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SaveFavoritoButton({ endereco }: { endereco: Partial<EnderecoCompleto> }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  // Só mostra se tiver o basico
  if (!endereco.endereco || !endereco.cep) return null;

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setOpen(false);
      toast.success(`Endereço "${nome}" salvo nos favoritos! ⭐`);
    }, 800);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 whitespace-nowrap px-2" title="Salvar este endereço nos favoritos">
          <Star className="w-3.5 h-3.5" /> Salvar Endereço
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>⭐ Salvar como Favorito</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/30 p-3 rounded text-sm text-muted-foreground">
             <p className="font-medium text-slate-800">{endereco.endereco}</p>
             <p className="text-xs">{endereco.cidade} - {endereco.uf} ({endereco.cep})</p>
          </div>
          <div className="space-y-2">
             <Label>Dê um nome a este endereço</Label>
             <Input placeholder="Ex: Filial São Bernardo, CD Principal, Cliente X Matriz..." value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Instruções padrão (opcional)</Label>
               <Input value={endereco.instrucoes || ""} placeholder="Ex: Procurar doca 2" />
             </div>
             <div className="space-y-2">
               <Label>Contato no local</Label>
               <Input value={endereco.contato || ""} placeholder="Ex: João da Recepção" />
             </div>
          </div>
          <Button onClick={handleSave} disabled={!nome || saving} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold">
             {saving ? "Salvando..." : "Salvar nos Favoritos"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
