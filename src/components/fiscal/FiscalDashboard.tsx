import { useState, useEffect } from "react";
import { LayoutDashboard, FileSpreadsheet, Truck, Stamp, UploadCloud, Building2, FileCheck, AlertTriangle, CheckCircle2, Terminal, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

export default function FiscalDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({});

  useEffect(function() {
    carregar();
  }, []);

  const carregar = async function() {
    setLoading(true);

    const queries = await Promise.all([
      supabase.from("fiscal_ctes").select("status, metadata").order("created_at", { ascending: false }),
      supabase.from("fiscal_mdfes").select("status").order("created_at", { ascending: false }),
      supabase.from("fiscal_nfse").select("status").order("created_at", { ascending: false }),
      supabase.from("fiscal_documentos_vinculados").select("status").order("created_at", { ascending: false }),
      supabase.from("configuracoes_fiscais").select("*").eq("ativo", true),
      supabase.from("regras_fiscais_cte").select("id").eq("ativo", true),
      supabase.from("fiscal_logs").select("*").order("created_at", { ascending: false }).limit(10),
    ]);

    const ctes = queries[0].data || [];
    const mdfes = queries[1].data || [];
    const nfses = queries[2].data || [];
    const xmls = queries[3].data || [];
    const emitentes = queries[4].data || [];
    const regras = queries[5].data || [];
    const logs = queries[6].data || [];

    const ctesProntos = ctes.filter(function(c: any) { return c.metadata?.pronto_para_emissao; });
    const ctesComPendencia = ctes.filter(function(c: any) { return !c.metadata?.pronto_para_emissao; });

    let errosTotal = 0;
    let avisosTotal = 0;
    for (const c of ctes) {
      const vals = c.metadata?.validacoes_pendentes || [];
      errosTotal += vals.filter(function(v: any) { return v.severidade === "erro"; }).length;
      avisosTotal += vals.filter(function(v: any) { return v.severidade === "aviso"; }).length;
    }

    setData({
      ctes,
      ctesProntos: ctesProntos.length,
      ctesComPendencia: ctesComPendencia.length,
      ctesRascunho: ctes.filter(function(c: any) { return c.status === "rascunho"; }).length,
      ctesAutorizado: ctes.filter(function(c: any) { return c.status === "autorizado" || c.status === "Autorizado"; }).length,
      ctesCancelado: ctes.filter(function(c: any) { return c.status === "cancelado" || c.status === "Cancelado"; }).length,
      ctesRejeitado: ctes.filter(function(c: any) { return c.status === "rejeitado" || c.status === "Rejeitado"; }).length,
      mdfes,
      mdfesRascunho: mdfes.filter(function(m: any) { return m.status === "rascunho" || m.status === "Aberto"; }).length,
      mdfesEmitido: mdfes.filter(function(m: any) { return m.status === "emitido" || m.status === "Encerrado" || m.status === "Autorizado"; }).length,
      mdfesCancelado: mdfes.filter(function(m: any) { return m.status === "cancelado" || m.status === "Cancelado"; }).length,
      nfses,
      nfsesRascunho: nfses.filter(function(n: any) { return n.status === "rascunho" || n.status === "pendente"; }).length,
      nfsesEmitida: nfses.filter(function(n: any) { return n.status === "emitido" || n.status === "autorizado" || n.status === "Autorizado"; }).length,
      nfsesCancelada: nfses.filter(function(n: any) { return n.status === "cancelado" || n.status === "Cancelado"; }).length,
      xmls,
      xmlsImportados: xmls.length,
      xmlsVinculados: xmls.filter(function(x: any) { return x.status === "vinculado"; }).length,
      xmlsAguardando: xmls.filter(function(x: any) { return x.status === "aguardando_vinculo"; }).length,
      emitentes,
      emitentePadrao: emitentes.find(function(e: any) { return e.padrao; }),
      regrasAtivas: regras.length,
      errosTotal,
      avisosTotal,
      logs,
    });
    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <span>Ambiente interno preparado. Emissao real depende de Focus NFe, token e certificado digital A1.</span>
      </div>

      {/* LINHA 1: CT-e */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniCard title="CT-e Total" value={data.ctes.length} icon={FileSpreadsheet} color="text-blue-600" bg="bg-blue-50" />
        <MiniCard title="Rascunho" value={data.ctesRascunho} icon={FileSpreadsheet} color="text-slate-600" bg="bg-slate-50" />
        <MiniCard title="Pronto Interno" value={data.ctesProntos} icon={CheckCircle2} color="text-green-600" bg="bg-green-50" />
        <MiniCard title="Com Pendencia" value={data.ctesComPendencia} icon={AlertTriangle} color="text-amber-600" bg="bg-amber-50" />
        <MiniCard title="Autorizados" value={data.ctesAutorizado} icon={FileCheck} color="text-emerald-600" bg="bg-emerald-50" />
        <MiniCard title="Cancelados" value={data.ctesRejeitado + data.ctesCancelado} icon={AlertTriangle} color="text-red-600" bg="bg-red-50" />
      </div>

      {/* LINHA 2: MDF-e + NFS-e */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard title="MDF-e Total" value={data.mdfes.length} icon={Truck} color="text-purple-600" bg="bg-purple-50" />
        <MiniCard title="Rascunho" value={data.mdfesRascunho} icon={Truck} color="text-purple-600" bg="bg-purple-50" />
        <MiniCard title="MDF-e Autorizados" value={data.mdfesEmitido} icon={FileCheck} color="text-purple-600" bg="bg-purple-50" />
        <MiniCard title="MDF-e Cancelados" value={data.mdfesCancelado} icon={AlertTriangle} color="text-purple-600" bg="bg-purple-50" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MiniCard title="NFS-e Total" value={data.nfses.length} icon={Stamp} color="text-teal-600" bg="bg-teal-50" />
        <MiniCard title="NFS-e Autorizadas" value={data.nfsesEmitida} icon={FileCheck} color="text-teal-600" bg="bg-teal-50" />
        <MiniCard title="NFS-e Pendentes" value={data.nfsesRascunho} icon={Stamp} color="text-teal-600" bg="bg-teal-50" />
      </div>

      {/* LINHA 3: XML + Emitentes + Regras */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><UploadCloud className="w-4 h-4 text-orange-500" />XML NF-e</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center py-1"><span className="text-sm text-muted-foreground">Importados</span><span className="font-semibold">{data.xmlsImportados}</span></div>
            <div className="flex justify-between items-center py-1"><span className="text-sm text-muted-foreground">Vinculados</span><span className="font-semibold text-green-600">{data.xmlsVinculados}</span></div>
            <div className="flex justify-between items-center py-1"><span className="text-sm text-muted-foreground">Aguardando</span><span className="font-semibold text-amber-600">{data.xmlsAguardando}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-500" />Emitentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center py-1"><span className="text-sm text-muted-foreground">Ativos</span><span className="font-semibold">{data.emitentes.length}/3</span></div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-muted-foreground">Padrao</span>
              <span className="font-semibold text-sm">{data.emitentePadrao?.apelido || data.emitentePadrao?.razao_social || "-"}</span>
            </div>
            <div className="flex justify-between items-center py-1"><span className="text-sm text-muted-foreground">CNPJ padrao</span><span className="text-xs font-mono">{data.emitentePadrao?.cnpj || "-"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FileCheck className="w-4 h-4 text-green-500" />Regras CFOP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center py-1"><span className="text-sm text-muted-foreground">Ativas</span><span className="font-semibold">{data.regrasAtivas}</span></div>
            <div className="flex justify-between items-center py-1"><span className="text-sm text-muted-foreground">CFOP principal</span><span className="text-xs font-mono">5352</span></div>
          </CardContent>
        </Card>
      </div>

      {/* LINHA 4: Pendencias Fiscais */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Pendencias Fiscais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{data.errosTotal}</p>
              <p className="text-xs text-red-500">Erros criticos</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{data.avisosTotal}</p>
              <p className="text-xs text-amber-500">Avisos</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{data.ctesProntos}</p>
              <p className="text-xs text-green-500">CT-es prontos</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-600">{data.ctesComPendencia}</p>
              <p className="text-xs text-slate-500">CT-es com pendencia</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LINHA 5: Ultimos Logs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Terminal className="w-4 h-4 text-slate-500" />Ultimos Logs Fiscais</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum log registrado.</p>
          ) : (
            <div className="divide-y">
              {data.logs.map(function(log: any) {
                return (
                  <div key={log.id} className="flex items-center justify-between px-6 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">{log.acao}</Badge>
                        <span className="text-xs text-muted-foreground truncate">{log.entidade_tipo} ({log.entidade_id ? log.entidade_id.substring(0, 8) : "-"})</span>
                      </div>
                      {log.response && <p className="text-xs text-muted-foreground mt-1 truncate">{JSON.stringify(log.response)}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniCard({ title, value, icon: Icon, color, bg }: { title: string; value: number; icon: any; color: string; bg: string }) {
  return (
    <div className={`p-4 rounded-lg border ${bg} border-border`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
