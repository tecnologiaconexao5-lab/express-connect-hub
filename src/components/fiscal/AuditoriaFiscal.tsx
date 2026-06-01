import { useState, useEffect } from "react";
import { Search, CheckCircle2, XCircle, AlertTriangle, ShieldAlert, Loader2, FileSpreadsheet, Truck, Stamp, Building2, FileText, UploadCloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

interface Alerta {
  categoria: string;
  severidade: "critico" | "aviso";
  descricao: string;
  documento: string;
  sugestao: string;
}

export default function AuditoriaFiscal() {
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [totais, setTotais] = useState({ criticos: 0, avisos: 0, prontos: 0, comProblema: 0 });

  useEffect(function() { auditar(); }, []);

  const auditar = async function() {
    setLoading(true);
    const a: Alerta[] = [];

    const [ctesRes, mdfesRes, nfsesRes, emisRes, regrasCteRes, regrasNfseRes, xmlsRes] = await Promise.all([
      supabase.from("fiscal_ctes").select("*").order("created_at",{ascending:false}),
      supabase.from("fiscal_mdfes").select("*").order("created_at",{ascending:false}),
      supabase.from("fiscal_nfse").select("*").order("created_at",{ascending:false}),
      supabase.from("configuracoes_fiscais").select("*"),
      supabase.from("regras_fiscais_cte").select("*"),
      supabase.from("regras_fiscais_nfse").select("*"),
      supabase.from("fiscal_documentos_vinculados").select("*"),
    ]);

    const ctes = ctesRes.data || [];
    const mdfes = mdfesRes.data || [];
    const nfses = nfsesRes.data || [];
    const emis = emisRes.data || [];
    const regrasCte = regrasCteRes.data || [];
    const regrasNfse = regrasNfseRes.data || [];
    const xmls = xmlsRes.data || [];

    // --- CT-e ---
    let ctesProntos = 0;
    let ctesComProblema = 0;
    for (const ct of ctes) {
      const pf = ct.metadata?.payload_focus || {};
      const v = ct.metadata?.validacoes_pendentes || [];
      const pronto = ct.metadata?.pronto_para_emissao;
      const docs = pf.documentos_vinculados || [];

      if (!pronto) { ctesComProblema++; a.push({ categoria:"CT-e",severidade:"aviso",descricao:"CT-e com pendencias fiscais",documento:ct.numero||ct.id?.substring(0,8),sugestao:"Resolva as pendencias no detalhe do CT-e."}); }
      if (docs.length === 0) { ctesComProblema++; a.push({ categoria:"CT-e",severidade:"aviso",descricao:"CT-e sem XML NF-e vinculado",documento:ct.numero||ct.id?.substring(0,8),sugestao:"Importe e vincule um XML NF-e a este CT-e."}); }
      if (!ct.metadata?.emitente_id) { ctesComProblema++; a.push({ categoria:"CT-e",severidade:"critico",descricao:"CT-e sem emitente_id no metadata",documento:ct.numero||ct.id?.substring(0,8),sugestao:"Regenere o CT-e apos configurar o emitente padrao."}); }
      if (!pf.fiscal?.cfop && !pf.carga?.cfop) { ctesComProblema++; a.push({ categoria:"CT-e",severidade:"critico",descricao:"CT-e sem CFOP configurado",documento:ct.numero||ct.id?.substring(0,8),sugestao:"Configure regra fiscal CFOP no modulo Regras CT-e."}); }
      if (pronto) ctesProntos++;
    }

    // --- MDF-e ---
    let mdfesProntos = 0;
    for (const m of mdfes) {
      const v = m.metadata?.validacoes_pendentes || [];
      const ctesVinc = m.metadata?.ctes_vinculados || [];
      if (!m.metadata?.pronto_para_emissao) { a.push({ categoria:"MDF-e",severidade:"aviso",descricao:"MDF-e com pendencias fiscais",documento:m.numero||m.id?.substring(0,8),sugestao:"Resolva as pendencias no detalhe do MDF-e."}); }
      if (ctesVinc.length === 0) { a.push({ categoria:"MDF-e",severidade:"critico",descricao:"MDF-e sem CT-es vinculados",documento:m.numero||m.id?.substring(0,8),sugestao:"Gere o MDF-e a partir de CT-es existentes."}); }
      if (!m.metadata?.motorista?.nome) { a.push({ categoria:"MDF-e",severidade:"critico",descricao:"MDF-e sem motorista definido",documento:m.numero||m.id?.substring(0,8),sugestao:"Vincule prestador/motorista a OS dos CT-es."}); }
      if (!m.metadata?.veiculo?.placa) { a.push({ categoria:"MDF-e",severidade:"critico",descricao:"MDF-e sem placa do veiculo",documento:m.numero||m.id?.substring(0,8),sugestao:"Vincule veiculo a OS dos CT-es."}); }
      if (m.metadata?.pronto_para_emissao) mdfesProntos++;
    }

    // --- NFS-e ---
    let nfsesProntos = 0;
    for (const n of nfses) {
      const m = n.metadata || {};
      const v = m.validacoes_pendentes || [];
      if (!m.pronto_para_emissao) { a.push({ categoria:"NFS-e",severidade:"aviso",descricao:"NFS-e com pendencias fiscais",documento:n.numero||n.id?.substring(0,8),sugestao:"Resolva as pendencias no detalhe da NFS-e."}); }
      if (!m.codigo_servico) { a.push({ categoria:"NFS-e",severidade:"critico",descricao:"NFS-e sem codigo de servico municipal",documento:n.numero||n.id?.substring(0,8),sugestao:"Configure regra municipal no modulo Regras NFS-e."}); }
      if (m.aliquota_iss == null) { a.push({ categoria:"NFS-e",severidade:"critico",descricao:"NFS-e sem aliquota ISS",documento:n.numero||n.id?.substring(0,8),sugestao:"Configure aliquota ISS na regra municipal."}); }
      if (m.iss_retido == null) { a.push({ categoria:"NFS-e",severidade:"aviso",descricao:"NFS-e sem definicao de ISS retido",documento:n.numero||n.id?.substring(0,8),sugestao:"Defina ISS retido na regra municipal."}); }
      if (m.pronto_para_emissao) nfsesProntos++;
    }

    // --- Emitentes ---
    const emisAtivos = emis.filter(function(e:any){return e.ativo;});
    const padroes = emisAtivos.filter(function(e:any){return e.padrao;});
    if (emisAtivos.length > 3) a.push({ categoria:"Emitentes",severidade:"critico",descricao:"Mais de 3 emitentes ativos ("+emisAtivos.length+")",documento:"configuracoes_fiscais",sugestao:"Desative emitentes excedentes. Limite: 3."});
    if (padroes.length === 0) a.push({ categoria:"Emitentes",severidade:"critico",descricao:"Nenhum emitente padrao definido",documento:"configuracoes_fiscais",sugestao:"Defina um emitente como padrao na aba Emitente."});
    if (padroes.length > 1) a.push({ categoria:"Emitentes",severidade:"critico",descricao:"Mais de 1 emitente padrao definido ("+padroes.length+")",documento:"configuracoes_fiscais",sugestao:"Mantenha apenas 1 emitente como padrao."});
    for (const e of emisAtivos) {
      if (!e.cnpj) a.push({ categoria:"Emitentes",severidade:"critico",descricao:"Emitente sem CNPJ",documento:e.apelido||e.razao_social||e.id?.substring(0,8),sugestao:"Preencha o CNPJ do emitente."});
      if (!e.ie) a.push({ categoria:"Emitentes",severidade:"aviso",descricao:"Emitente sem IE",documento:e.apelido||e.razao_social||e.id?.substring(0,8),sugestao:"Preencha a Inscricao Estadual do emitente."});
      if (!e.rntrc) a.push({ categoria:"Emitentes",severidade:"aviso",descricao:"Emitente sem RNTRC",documento:e.apelido||e.razao_social||e.id?.substring(0,8),sugestao:"Preencha o RNTRC para transporte."});
    }

    // --- Regras ---
    const regrasCteAtivas = regrasCte.filter(function(r:any){return r.ativo;});
    const regrasNfseAtivas = regrasNfse.filter(function(r:any){return r.ativo;});
    if (regrasCteAtivas.length === 0) a.push({ categoria:"Regras",severidade:"critico",descricao:"Nenhuma regra CFOP ativa para CT-e",documento:"regras_fiscais_cte",sugestao:"Cadastre pelo menos 1 regra CFOP geral na aba Regras CT-e."});
    if (regrasNfseAtivas.length === 0) a.push({ categoria:"Regras",severidade:"critico",descricao:"Nenhuma regra municipal ativa para NFS-e",documento:"regras_fiscais_nfse",sugestao:"Cadastre regra municipal na aba Regras NFS-e."});

    // --- XMLs ---
    const xmlsAguardando = xmls.filter(function(x:any){return x.status==="aguardando_vinculo";});
    for (const x of xmlsAguardando) a.push({ categoria:"XMLs",severidade:"aviso",descricao:"XML NF-e aguardando vinculo",documento:x.emitente_nome||x.id?.substring(0,8),sugestao:"Vincule o XML a uma OS na aba CT-e."});

    setAlertas(a);
    const criticos = a.filter(function(x){return x.severidade==="critico";});
    const avisos = a.filter(function(x){return x.severidade==="aviso";});
    setTotais({
      criticos: criticos.length,
      avisos: avisos.length,
      prontos: ctesProntos + mdfesProntos + nfsesProntos,
      comProblema: ctesComProblema,
    });
    setLoading(false);
  };

  const categorias = ["CT-e","MDF-e","NFS-e","Emitentes","Regras","XMLs"];
  const icons: Record<string,any> = { "CT-e": FileSpreadsheet, "MDF-e": Truck, "NFS-e": Stamp, "Emitentes": Building2, "Regras": FileText, "XMLs": UploadCloud };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard title="Criticos" value={totais.criticos} icon={XCircle} color="text-red-600" bg="bg-red-50" />
        <MiniCard title="Avisos" value={totais.avisos} icon={AlertTriangle} color="text-amber-600" bg="bg-amber-50" />
        <MiniCard title="Docs Prontos" value={totais.prontos} icon={CheckCircle2} color="text-green-600" bg="bg-green-50" />
        <MiniCard title="Com Problema" value={totais.comProblema} icon={ShieldAlert} color="text-slate-600" bg="bg-slate-50" />
      </div>

      {categorias.map(function(cat) {
        const itens = alertas.filter(function(a) { return a.categoria === cat; });
        if (itens.length === 0) return null;
        const Icon = icons[cat] || Search;
        return (
          <Card key={cat}>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Icon className="w-4 h-4 text-muted-foreground" />{cat} ({itens.length})</CardTitle></CardHeader>
            <CardContent className="divide-y">
              {itens.map(function(item, i) {
                return (
                  <div key={i} className="flex items-start gap-3 py-2">
                    {item.severidade === "critico" ? <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={item.severidade === "critico" ? "bg-red-50 text-red-700 border-red-200 text-xs" : "bg-amber-50 text-amber-700 border-amber-200 text-xs"}>
                          {item.severidade}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">{item.documento}</span>
                      </div>
                      <p className="text-sm mt-0.5">{item.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.sugestao}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MiniCard({ title, value, icon: Icon, color, bg }: { title: string; value: number; icon: any; color: string; bg: string }) {
  return <div className={"p-4 rounded-lg border " + bg + " border-border"}><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground font-medium">{title}</p><Icon className={"w-4 h-4 " + color} /></div><p className={"text-2xl font-bold mt-1 " + color}>{value}</p></div>;
}
