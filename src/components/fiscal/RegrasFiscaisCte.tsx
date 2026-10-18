import { useState, useEffect } from "react";
import { FileText, Save, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";
import {
  listarRegrasFiscaisCte,
  salvarRegraFiscalCte,
  type SalvarRegraFiscalCteInput,
  type RegraFiscalCte,
} from "@/services/fiscal/regrasFiscaisCteService";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function RegrasFiscaisCte() {
  const [regras, setRegras] = useState<RegraFiscalCte[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);

  const [form, setForm] = useState<SalvarRegraFiscalCteInput>({
    cliente_id: null,
    uf_origem: "",
    uf_destino: "",
    tipo_operacao: "",
    cfop: "",
    natureza_operacao: "",
    aliquota_icms: null,
    observacao: "",
    ativo: true,
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    const [regrasData, { data: clis }] = await Promise.all([
      listarRegrasFiscaisCte(),
      supabase.from("clientes").select("id, razao_social, nome_fantasia").limit(20),
    ]);
    setRegras(regrasData);
    setClientes(clis || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.cfop) {
      toast.error("CFOP e obrigatorio.");
      return;
    }
    setSaving(true);
    const { success, error } = await salvarRegraFiscalCte(form);
    if (success) {
      toast.success("Regra fiscal salva com sucesso!");
      setForm({ cliente_id: null, uf_origem: "", uf_destino: "", tipo_operacao: "", cfop: "", natureza_operacao: "", aliquota_icms: null, observacao: "", ativo: true });
      carregarDados();
    } else {
      toast.error("Erro ao salvar: " + (error || ""));
    }
    setSaving(false);
  };

  const updateField = (field: keyof SalvarRegraFiscalCteInput, value: any) => {
    setForm(function(prev) { return { ...prev, [field]: value }; });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <ProgressiveBlocksLoader size="normal" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Regras Fiscais CT-e</CardTitle>
              <CardDescription>Configuracao de CFOP, natureza de operacao e aliquotas por cliente/UF</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label>Cliente (opcional)</Label>
              <Select
                value={form.cliente_id || "todos"}
                onValueChange={function(v) { updateField("cliente_id", v === "todos" ? null : v); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  {(clientes || []).map(function(c) {
                    return <SelectItem key={c.id} value={c.id}>{c.razao_social || c.nome_fantasia}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>UF Origem</Label>
              <Select value={form.uf_origem || undefined} onValueChange={function(v) { updateField("uf_origem", v || null); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {UFS.map(function(uf) { return <SelectItem key={uf} value={uf}>{uf}</SelectItem>; })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>UF Destino</Label>
              <Select value={form.uf_destino || undefined} onValueChange={function(v) { updateField("uf_destino", v || null); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {UFS.map(function(uf) { return <SelectItem key={uf} value={uf}>{uf}</SelectItem>; })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo Operacao</Label>
              <Input
                value={form.tipo_operacao || ""}
                onChange={function(e) { updateField("tipo_operacao", e.target.value); }}
                placeholder="TRANSPORTE DE CARGAS"
              />
            </div>
            <div>
              <Label>CFOP *</Label>
              <Input
                value={form.cfop}
                onChange={function(e) { updateField("cfop", e.target.value); }}
                placeholder="5352"
              />
            </div>
            <div>
              <Label>Natureza da Operacao</Label>
              <Input
                value={form.natureza_operacao || ""}
                onChange={function(e) { updateField("natureza_operacao", e.target.value); }}
                placeholder="Prestacao de servico de transporte"
              />
            </div>
            <div>
              <Label>Aliquota ICMS (%)</Label>
              <Input
                type="number"
                value={form.aliquota_icms ?? ""}
                onChange={function(e) { updateField("aliquota_icms", e.target.value ? parseFloat(e.target.value) : null); }}
                placeholder="12"
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo ?? true} onCheckedChange={function(v) { updateField("ativo", v); }} />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Regra
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras Cadastradas ({regras.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>UF Origem</TableHead>
                <TableHead>UF Destino</TableHead>
                <TableHead>Tipo Operacao</TableHead>
                <TableHead>CFOP</TableHead>
                <TableHead>Natureza</TableHead>
                <TableHead>Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nenhuma regra fiscal cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                regras.map(function(r) {
                  const clienteNome = r.cliente_id
                    ? (clientes.find(function(c) { return c.id === r.cliente_id; })?.razao_social || r.cliente_id?.substring(0, 8))
                    : "Todos";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{clienteNome}</TableCell>
                      <TableCell>{r.uf_origem || "-"}</TableCell>
                      <TableCell>{r.uf_destino || "-"}</TableCell>
                      <TableCell className="text-xs">{r.tipo_operacao || "-"}</TableCell>
                      <TableCell className="font-mono font-bold">{r.cfop}</TableCell>
                      <TableCell className="text-xs">{r.natureza_operacao || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={r.ativo ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                          {r.ativo ? "Sim" : "Nao"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
