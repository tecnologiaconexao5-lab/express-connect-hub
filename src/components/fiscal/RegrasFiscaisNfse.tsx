import { useState, useEffect } from "react";
import { Stamp, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { listarRegrasNfse, salvarRegraNfse, type RegraFiscalNfse } from "@/services/fiscal/regrasFiscaisNfseService";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function RegrasFiscaisNfse() {
  const [regras, setRegras] = useState<RegraFiscalNfse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [emitentes, setEmitentes] = useState<any[]>([]);

  const [form, setForm] = useState({
    emitente_id: null as string | null, cliente_id: null as string | null,
    municipio_prestacao: "", uf: "",
    codigo_servico: "", descricao_servico: "",
    aliquota_iss: null as number | null, iss_retido: null as boolean | null,
    observacao: "", ativo: true,
  });

  useEffect(function() { carregar(); }, []);

  const carregar = async function() {
    setLoading(true);
    const [r, e, c] = await Promise.all([
      listarRegrasNfse(),
      supabase.from("configuracoes_fiscais").select("id, apelido, razao_social").limit(10),
      supabase.from("clientes").select("id, razao_social, nome_fantasia").limit(20),
    ]);
    setRegras(r);
    setEmitentes(e.data || []);
    setClientes(c.data || []);
    setLoading(false);
  };

  const handleSave = async function() {
    if (!form.municipio_prestacao || !form.codigo_servico) { toast.error("Municipio e Codigo de Servico sao obrigatorios."); return; }
    setSaving(true);
    const { success, error } = await salvarRegraNfse(form);
    if (success) { toast.success("Regra NFS-e salva!"); setForm({ emitente_id: null, cliente_id: null, municipio_prestacao: "", uf: "", codigo_servico: "", descricao_servico: "", aliquota_iss: null, iss_retido: null, observacao: "", ativo: true }); carregar(); }
    else toast.error("Erro: " + (error || ""));
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <ProgressiveBlocksLoader size="normal" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3"><Stamp className="w-6 h-6 text-primary" /><div><CardTitle>Regras Municipais NFS-e</CardTitle><CardDescription>Codigo de servico, aliquota ISS e retencao por municipio</CardDescription></div></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label>Emitente</Label>
              <Select value={form.emitente_id || "todos"} onValueChange={function(v) { setForm(function(p) { return { ...p, emitente_id: v === "todos" ? null : v }; }); }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(emitentes||[]).map(function(e) { return <SelectItem key={e.id} value={e.id}>{e.apelido || e.razao_social}</SelectItem>; })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={form.cliente_id || "todos"} onValueChange={function(v) { setForm(function(p) { return { ...p, cliente_id: v === "todos" ? null : v }; }); }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(clientes||[]).map(function(c) { return <SelectItem key={c.id} value={c.id}>{c.razao_social || c.nome_fantasia}</SelectItem>; })}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Municipio Prestacao *</Label><Input value={form.municipio_prestacao} onChange={function(e) { setForm(function(p) { return { ...p, municipio_prestacao: e.target.value }; }); }} placeholder="SAO PAULO" /></div>
            <div>
              <Label>UF</Label>
              <Select value={form.uf || undefined} onValueChange={function(v) { setForm(function(p) { return { ...p, uf: v || null }; }); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{UFS.map(function(u) { return <SelectItem key={u} value={u}>{u}</SelectItem>; })}</SelectContent>
              </Select>
            </div>
            <div><Label>Codigo Servico *</Label><Input value={form.codigo_servico} onChange={function(e) { setForm(function(p) { return { ...p, codigo_servico: e.target.value }; }); }} placeholder="1.01" /></div>
            <div><Label>Descricao Servico</Label><Input value={form.descricao_servico || ""} onChange={function(e) { setForm(function(p) { return { ...p, descricao_servico: e.target.value || null }; }); }} placeholder="Transporte de cargas" /></div>
            <div><Label>Aliquota ISS (%)</Label><Input type="number" value={form.aliquota_iss ?? ""} onChange={function(e) { setForm(function(p) { return { ...p, aliquota_iss: e.target.value ? parseFloat(e.target.value) : null }; }); }} placeholder="5" /></div>
            <div className="flex items-end gap-4">
              <div className="flex items-center gap-2"><Switch checked={!!form.iss_retido} onCheckedChange={function(v) { setForm(function(p) { return { ...p, iss_retido: v }; }); }} /><Label>ISS Retido</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={function(v) { setForm(function(p) { return { ...p, ativo: v }; }); }} /><Label>Ativo</Label></div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Regra</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Regras Cadastradas ({regras.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Municipio</TableHead><TableHead>Cod. Servico</TableHead><TableHead>ISS%</TableHead><TableHead>Retido</TableHead><TableHead className="text-right">Ativo</TableHead></TableRow></TableHeader>
            <TableBody>
              {regras.length === 0 ? <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">Nenhuma regra cadastrada.</TableCell></TableRow>
               : regras.map(function(r) { return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.municipio_prestacao}{r.uf ? "/"+r.uf : ""}</TableCell>
                    <TableCell className="font-mono">{r.codigo_servico}</TableCell>
                    <TableCell>{r.aliquota_iss != null ? r.aliquota_iss+"%" : "-"}</TableCell>
                    <TableCell>{r.iss_retido ? "Sim" : r.iss_retido === false ? "Nao" : "-"}</TableCell>
                    <TableCell className="text-right"><Badge variant="outline" className={r.ativo ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>{r.ativo ? "Sim" : "Nao"}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
