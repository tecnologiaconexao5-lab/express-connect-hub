import { useState, useEffect } from "react";
import { Plus, Search, Edit, Trash2, Filter, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

export interface FieldConfig {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
}

interface GenericCrudProps {
  tableName: string;
  title: string;
  fields: FieldConfig[];
  searchFields: string[];
}

export const GenericCrud = ({ tableName, title, fields, searchFields }: GenericCrudProps) => {
  const [data, setData] = useState<any[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tableName]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const { data: res, error } = await supabase.from(tableName).select("*").order("id");
      if (error) throw error;
      setData(res || []);
    } catch (error: any) {
      if (error.code !== "42P01") { // Ignore table does not exist for UI demos, but log others
        toast.error(`Erro ao carregar dados de ${title}. Tabela "${tableName}" pode não existir.`);
      }
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = data.filter((item) => {
    if (!busca) return true;
    const searchLow = busca.toLowerCase();
    return searchFields.some(f => String(item[f] || "").toLowerCase().includes(searchLow));
  });

  const handleOpenForm = (item?: any) => {
    setFormData(item || {});
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      let query;
      if (formData.id) {
        query = supabase.from(tableName).update(formData).eq("id", formData.id);
      } else {
        query = supabase.from(tableName).insert([formData]);
      }
      const { error } = await query;
      if (error) throw error;
      
      toast.success(`${title} ${formData.id ? "atualizado" : "cadastrado"} com sucesso!`);
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(`Erro ao salvar dados em ${tableName}. Tabela não encontrada ou permissões insuficientes.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isDeletingId) return;
    try {
      const { error } = await supabase.from(tableName).delete().eq("id", isDeletingId);
      if (error) throw error;
      toast.success("Registro removido com sucesso!");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover registro.");
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{filtered.length} registro(s) listado(s)</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="gap-2 bg-primary">
          <Plus className="w-4 h-4" /> Cadastrar {title}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={`Buscar em ${title.toLowerCase()}...`} 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            className="pl-9" 
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Filter className="w-4 h-4" /> Filtros</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {fields.slice(0, 5).map(f => <TableHead key={f.name}>{f.label}</TableHead>)}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground border-dashed border-2 m-4 rounded-xl">Sem registros.<br/><span className="text-xs opacity-60">Pode ser necessário adicionar colunas ou criar a tabela no Supabase.</span></TableCell></TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    {fields.slice(0, 5).map(f => (
                      <TableCell key={f.name}>
                        {f.name === 'status' ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item[f.name] === "Ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                            {item[f.name] || "Ativo"}
                          </span>
                        ) : String(item[f.name] || "—")}
                      </TableCell>
                    ))}
                    <TableCell className="text-right flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => handleOpenForm(item)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setIsDeletingId(item.id)}>
                        <Trash2 className="w-4 h-4 text-destructive/70" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Form */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{formData.id ? "Editar" : "Cadastrar"} {title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
              {fields.map(field => (
                <div key={field.name} className="flex flex-col gap-2">
                  <Label htmlFor={field.name}>{field.label} {field.required && "*"}</Label>
                  
                  {field.type === "select" ? (
                    <Select value={formData[field.name] || ""} onValueChange={(v) => setFormData({...formData, [field.name]: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {field.options?.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : field.type === "textarea" ? (
                    <textarea 
                      id={field.name}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData[field.name] || ""} 
                      onChange={(e) => setFormData({...formData, [field.name]: e.target.value})}
                      required={field.required}
                    />
                  ) : (
                    <Input 
                      id={field.name}
                      type={field.type || "text"}
                      value={formData[field.name] || ""} 
                      onChange={(e) => setFormData({...formData, [field.name]: e.target.value})}
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!isDeletingId} onOpenChange={(open) => !open && setIsDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertCircle className="w-5 h-5"/> Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esse registro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
