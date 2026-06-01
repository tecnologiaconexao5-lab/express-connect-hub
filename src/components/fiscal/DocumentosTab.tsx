import { useState, useEffect } from "react";
import { FileText, FileSpreadsheet, Truck, Stamp, Eye, Loader2, Search, Download, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";

interface DocFiscal {
  id: string; tipo: string; numero: string | null; status: string;
  valor: number | null; chave_acesso: string | null; protocolo: string | null;
  xml_url: string | null; pdf_url: string | null; data_emissao: string | null;
  metadata: any;
}

const fmtFin = function(v: number) { return v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "-"; };

export default function DocumentosTab() {
  const [docs, setDocs] = useState<DocFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [previewDoc, setPreviewDoc] = useState<DocFiscal | null>(null);

  useEffect(function() { fetchDocs(); }, []);

  const fetchDocs = async function() {
    setLoading(true);
    const [ctes, mdfes, nfses] = await Promise.all([
      sup.from("fiscal_ctes").select("*").order("created_at",{ascending:false}),
      sup.from("fiscal_mdfes").select("*").order("created_at",{ascending:false}),
      sup.from("fiscal_nfse").select("*").order("created_at",{ascending:false}),
    ]);
    const all = [
      ...(ctes.data||[]).map(function(d:any){return{...d,tipo:"CT-e"};}),
      ...(mdfes.data||[]).map(function(d:any){return{...d,tipo:"MDF-e"};}),
      ...(nfses.data||[]).map(function(d:any){return{...d,tipo:"NFS-e"};}),
    ] as DocFiscal[];
    setDocs(all);
    setLoading(false);
  };

  const filtered = docs.filter(function(d) {
    if (filtroTipo !== "todos" && d.tipo !== filtroTipo) return false;
    if (search) {
      const s = search.toLowerCase();
      return (d.numero||"").toLowerCase().includes(s) || (d.chave_acesso||"").toLowerCase().includes(s);
    }
    return true;
  });

  const getBadge = function(d: DocFiscal) {
    const meta = d.metadata || {};
    const pronto = meta.pronto_para_emissao;
    if (pronto) return <Badge className="bg-green-100 text-green-700 border-green-200">PRONTO INTERNO</Badge>;
    if (pronto === false) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">COM PENDENCIA</Badge>;
    return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{d.status}</Badge>;
  };

  const getTipoIcon = function(tipo: string) {
    switch(tipo) { case "CT-e": return FileSpreadsheet; case "MDF-e": return Truck; case "NFS-e": return Stamp; default: return FileText; }
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Documentos Fiscais</h2><p className="text-muted-foreground text-sm">Visao unificada de todos os documentos fiscais.</p></div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar numero, chave..." className="pl-9" value={search} onChange={function(e){setSearch(e.target.value);}} />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="CT-e">CT-e</SelectItem>
            <SelectItem value="MDF-e">MDF-e</SelectItem>
            <SelectItem value="NFS-e">NFS-e</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Numero</TableHead><TableHead>Status</TableHead><TableHead>Valor</TableHead><TableHead>Chave/Protocolo</TableHead><TableHead>XML</TableHead><TableHead>PDF</TableHead><TableHead className="text-right">Acoes</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
               : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Nenhum documento encontrado.</TableCell></TableRow>
               : filtered.map(function(d) {
                   const Icon = getTipoIcon(d.tipo);
                   return (
                     <TableRow key={d.id}>
                       <TableCell><div className="flex items-center gap-1"><Icon className="w-4 h-4 text-muted-foreground" /><span className="text-xs font-medium">{d.tipo}</span></div></TableCell>
                       <TableCell className="font-mono text-xs">{d.numero||"-"}</TableCell>
                       <TableCell>{getBadge(d)}</TableCell>
                       <TableCell className="text-xs">{fmtFin(d.valor||0)}</TableCell>
                       <TableCell className="text-[10px] font-mono text-muted-foreground max-w-[120px] truncate">{d.chave_acesso||d.protocolo||"Aguardando integracao fiscal"}</TableCell>
                       <TableCell>{d.xml_url ? <Download className="w-4 h-4 text-green-500"/> : <AlertCircle className="w-4 h-4 text-muted-foreground/30"/>}</TableCell>
                       <TableCell>{d.pdf_url ? <Download className="w-4 h-4 text-red-500"/> : <AlertCircle className="w-4 h-4 text-muted-foreground/30"/>}</TableCell>
                       <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={function(){setPreviewDoc(d);}}><Eye className="w-4 h-4" /></Button></TableCell>
                     </TableRow>
                   );
                 })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={!!previewDoc} onOpenChange={function(){setPreviewDoc(null);}}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {previewDoc && (function() {
            const pf = previewDoc.metadata?.payload_focus || previewDoc.metadata || {};
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {previewDoc.tipo==="CT-e"?<FileSpreadsheet className="w-5 h-5 text-blue-600"/>:previewDoc.tipo==="MDF-e"?<Truck className="w-5 h-5 text-purple-600"/>:<Stamp className="w-5 h-5 text-green-600"/>}
                    Previa — {previewDoc.tipo} {previewDoc.numero||"S/N"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="p-2 bg-slate-100 border border-slate-300 rounded text-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">DOCUMENTO INTERNO DE HOMOLOGACAO</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-xs text-muted-foreground">Emitente</span><p className="font-medium">{pf.emitente?.nome||"-"}</p><p className="text-xs text-muted-foreground">{pf.emitente?.cnpj||""}</p></div>
                    <div><span className="text-xs text-muted-foreground">Tomador</span><p className="font-medium">{pf.tomador?.nome||"-"}</p><p className="text-xs text-muted-foreground">{pf.tomador?.cnpj||""}</p></div>
                    <div><span className="text-xs text-muted-foreground">Valor</span><p className="font-medium">{fmtFin(previewDoc.valor||pf.valor_servico||pf.valor_total||0)}</p></div>
                    <div><span className="text-xs text-muted-foreground">Status</span><p>{getBadge(previewDoc)}</p></div>
                    {pf.origem?.cidade && <div><span className="text-xs text-muted-foreground">Origem</span><p className="font-medium">{pf.origem.cidade}/{pf.origem.uf}</p></div>}
                    {pf.destino?.cidade && <div><span className="text-xs text-muted-foreground">Destino</span><p className="font-medium">{pf.destino.cidade}/{pf.destino.uf}</p></div>}
                    {pf.carga?.descricao && <div><span className="text-xs text-muted-foreground">Carga</span><p className="font-medium text-xs">{pf.carga.descricao}</p></div>}
                    {pf.fiscal?.cfop && <div><span className="text-xs text-muted-foreground">CFOP</span><p className="font-mono">{pf.fiscal.cfop||pf.carga?.cfop||"-"}</p></div>}
                    {pf.motorista?.nome && <div><span className="text-xs text-muted-foreground">Motorista</span><p>{pf.motorista.nome}</p></div>}
                    {pf.veiculo?.placa && <div><span className="text-xs text-muted-foreground">Veiculo</span><p>{pf.veiculo.placa}</p></div>}
                    {pf.servico && <div className="col-span-2"><span className="text-xs text-muted-foreground">Servico</span><p className="font-medium">{pf.servico}</p></div>}
                    {pf.codigo_servico && <div><span className="text-xs text-muted-foreground">Cod. Servico</span><p className="font-mono">{pf.codigo_servico}</p></div>}
                    {pf.aliquota_iss!=null && <div><span className="text-xs text-muted-foreground">ISS</span><p>{pf.aliquota_iss}%</p></div>}
                    {pf.municipio_prestacao && <div><span className="text-xs text-muted-foreground">Municipio</span><p>{pf.municipio_prestacao}</p></div>}
                    {pf.ctes_vinculados && <div className="col-span-2"><span className="text-xs text-muted-foreground">CT-es Vinculados</span><p>{pf.ctes_vinculados.length} documento(s)</p></div>}
                    <div className="col-span-2"><span className="text-xs text-muted-foreground">Chave</span><p className="text-[10px] font-mono text-muted-foreground break-all">{previewDoc.chave_acesso||"Aguardando integracao fiscal"}</p></div>
                    <div className="col-span-2"><span className="text-xs text-muted-foreground">Protocolo</span><p className="text-xs font-mono text-muted-foreground">{previewDoc.protocolo||"Aguardando integracao fiscal"}</p></div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
