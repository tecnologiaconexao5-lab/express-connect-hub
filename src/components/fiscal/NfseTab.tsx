import { useEffect, useState } from "react";
import { Stamp, PlusCircle, RefreshCw, Loader2, ShieldAlert, XCircle, AlertTriangle, CheckCircle2, Send, Eye, AlertCircle, GitBranch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { gerarRascunhoNfse } from "@/services/fiscal/nfseService";
import { buscarRegraNfse } from "@/services/fiscal/regrasFiscaisNfseService";
import { alterarStatusFiscalInterno, listarHistoricoStatus } from "@/services/fiscal/fiscalStatusService";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const fmtFin = function(v: number) { return v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"; };

export default function NfseTab() {
  const [nfses, setNfses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [showGerar, setShowGerar] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedNfse, setSelectedNfse] = useState<any>(null);
  const [showPreEmissao, setShowPreEmissao] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [regraSugerida, setRegraSugerida] = useState<any>(null);
  const [avisoRegra, setAvisoRegra] = useState("");
  const [showSimulacao, setShowSimulacao] = useState(false);
  const [simulacaoAcao, setSimulacaoAcao] = useState("");
  const [motivoSimulacao, setMotivoSimulacao] = useState("");
  const [historico, setHistorico] = useState<any[]>([]);

  const [gerarForm, setGerarForm] = useState({
    origem: "os" as "os" | "cte",
    origem_id: "",
    municipio: "SAO PAULO",
    uf: "SP",
    codigo_servico: "",
    descricao_servico: "",
    aliquota_iss: "" as string,
    iss_retido: false,
    tomador_nome: "",
    tomador_cnpj: "",
    emitente_nome: "",
    emitente_cnpj: "",
    valor_servico: 0 as number,
  });
  const [origens, setOrigens] = useState<any[]>([]);

  useEffect(function() { fetchNfses(); }, []);

  const fetchNfses = async function() {
    try {
      setLoading(true);
      setErro("");
      const { data, error } = await sup.from("fiscal_nfse").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setNfses(data || []);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar NFS-e");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGerar = async function() {
    setRegraSugerida(null);
    setAvisoRegra("");
    setGerarForm({
      origem: "os", origem_id: "", municipio: "SAO PAULO", uf: "SP",
      codigo_servico: "", descricao_servico: "", aliquota_iss: "",
      iss_retido: false, tomador_nome: "", tomador_cnpj: "",
      emitente_nome: "", emitente_cnpj: "", valor_servico: 0,
    });

    // Pre-carregar emitente padrao
    const { data: emit } = await sup.from("configuracoes_fiscais").select("*").eq("ativo",true).eq("padrao",true).limit(1).maybeSingle();
    if (emit) {
      setGerarForm(function(p) { return { ...p, emitente_nome: emit.razao_social||emit.nome_fantasia||"", emitente_cnpj: emit.cnpj||"", municipio: emit.cidade||"SAO PAULO", uf: emit.uf||"SP" }; });
    }

    fetchOrigens("os");
    setShowGerar(true);
  };

  const fetchOrigens = async function(tipo: "os" | "cte") {
    if (tipo === "os") {
      const { data } = await sup.from("ordens_servico").select("id, numero, cliente_id, valor_cliente").not("cliente_id","is",null).limit(20).order("created_at",{ascending:false});
      setOrigens(data || []);
    } else {
      const { data } = await sup.from("fiscal_ctes").select("id, numero, cliente_id, valor").eq("status","rascunho").limit(20).order("created_at",{ascending:false});
      setOrigens(data || []);
    }
  };

  const handleOrigemChange = async function(origemId: string) {
    if (!origemId) return;
    setGerarForm(function(p) { return { ...p, origem_id: origemId }; });

    // Buscar dados da origem
    if (gerarForm.origem === "os") {
      const { data: os } = await sup.from("ordens_servico").select("*").eq("id", origemId).maybeSingle();
      if (os) {
        setGerarForm(function(p) { return { ...p, valor_servico: os.valor_cliente||0 }; });
        if (os.cliente_id) {
          const { data: cli } = await sup.from("clientes").select("*").eq("id", os.cliente_id).maybeSingle();
          if (cli) {
            setGerarForm(function(p) { return { ...p, tomador_nome: cli.razao_social||cli.nome_fantasia||"", tomador_cnpj: cli.cnpj||"" }; });
          }
        }
      }
    } else {
      const { data: cte } = await sup.from("fiscal_ctes").select("*").eq("id", origemId).maybeSingle();
      if (cte) {
        const pf = cte.metadata?.payload_focus||{};
        setGerarForm(function(p) { return { ...p, valor_servico: cte.valor||0, tomador_nome: pf.tomador?.nome||"", tomador_cnpj: pf.tomador?.cnpj||"" }; });
      }
    }
  };

  const handleMunicipioBlur = async function() {
    if (!gerarForm.municipio) return;
    const { data: emit } = await sup.from("configuracoes_fiscais").select("*").eq("ativo",true).eq("padrao",true).limit(1).maybeSingle();
    const rule = await buscarRegraNfse({
      emitente_id: emit?.id||null,
      cliente_id: null,
      municipio_prestacao: gerarForm.municipio,
    });
    if (rule) {
      setRegraSugerida(rule);
      setAvisoRegra("");
      setGerarForm(function(p) { return { ...p, codigo_servico: rule.codigo_servico, descricao_servico: rule.descricao_servico||p.descricao_servico, aliquota_iss: rule.aliquota_iss != null ? String(rule.aliquota_iss) : p.aliquota_iss, iss_retido: rule.iss_retido ?? p.iss_retido }; });
    } else {
      setRegraSugerida(null);
      setAvisoRegra("Nao ha regra NFS-e para este municipio. Configure na aba Regras NFS-e.");
    }
  };

  const handleGerar = async function() {
    if (!gerarForm.origem_id) { toast.error("Selecione a origem."); return; }
    setGerando(true);
    const result = await gerarRascunhoNfse({
      origem: gerarForm.origem,
      origem_id: gerarForm.origem_id,
      municipio_prestacao: gerarForm.municipio,
      descricao_servico: gerarForm.descricao_servico || "Prestacao de servico de transporte",
    });
    if (result.success) { toast.success("NFS-e rascunho gerada!"); setShowGerar(false); fetchNfses(); }
    else toast.error("Erro: " + (result.error || ""));
    setGerando(false);
  };

  const openDetails = function(nfse: any) { setSelectedNfse(nfse); setShowDetails(true); fetchHistorico(nfse.id); };

  const fetchHistorico = async function(nfseId: string) {
    const data = await listarHistoricoStatus("NFSE", nfseId);
    setHistorico(data);
  };

  const openSimulacao = function(acao: string) { setSimulacaoAcao(acao); setMotivoSimulacao(""); setShowSimulacao(true); };

  const handleSimular = async function() {
    if (!motivoSimulacao.trim()) { toast.error("Informe o motivo da simulacao."); return; }
    const statusNovo = simulacaoAcao === "cancelar" ? "cancelada_simulada" : "rejeitada_simulada";
    const result = await alterarStatusFiscalInterno({ documentoTipo:"NFSE",documentoId:selectedNfse?.id,statusNovo,motivo:motivoSimulacao });
    if (result.success) { toast.success("Simulacao concluida: "+simulacaoAcao); setShowSimulacao(false); fetchHistorico(selectedNfse?.id); }
    else toast.error("Erro: "+(result.error||""));
  };

  const handlePreEmissao = async function() {
    setShowPreEmissao(true);
    try { await sup.from("fiscal_logs").insert([{ entidade_tipo:"NFSE",entidade_id:selectedNfse?.id,acao:"PRE_EMISSAO_NFSE_VISUALIZADA",request:{nfse_id:selectedNfse?.id},response:{status:"dados_internos_prontos"}}]); } catch{}
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">NFS-e</h2><p className="text-muted-foreground text-sm">Nota Fiscal de Servico Eletronica.</p></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchNfses} disabled={loading}><RefreshCw className="w-4 h-4 mr-2" /> Atualizar</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleOpenGerar}><PlusCircle className="w-4 h-4 mr-2" /> Novo Rascunho NFS-e</Button>
        </div>
      </div>

      <Card className="w-full">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nº NFS-e</TableHead><TableHead>Tomador</TableHead><TableHead>Servico</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Pendencias</TableHead><TableHead className="text-right">Acoes</TableHead></TableRow></TableHeader>
            <TableBody>
              {erro ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-red-500"><AlertCircle className="w-5 h-5 mx-auto mb-1" /><p className="text-sm">{erro}</p><Button variant="link" size="sm" onClick={fetchNfses}>Tentar novamente</Button></TableCell></TableRow>
               : loading ? <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
               : nfses.length === 0 ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Nenhuma NFS-e encontrada.</TableCell></TableRow>
               : nfses.map(function(n) {
                   const m = n.metadata || {};
                   const v = m.validacoes_pendentes || [];
                   return (
                     <TableRow key={n.id}>
                       <TableCell className="font-semibold text-green-700">{n.numero || "-"}</TableCell>
                       <TableCell className="text-sm">{m.tomador?.nome || "-"}</TableCell>
                       <TableCell className="text-xs">{m.servico || "-"}</TableCell>
                       <TableCell className="font-medium">{fmtFin(n.valor)}</TableCell>
                       <TableCell><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{n.status}</Badge></TableCell>
                       <TableCell>
                         {v.length === 0 ? <Badge className="bg-green-100 text-green-700 border-green-200 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />0</Badge>
                          : <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />{v.length}</Badge>}
                       </TableCell>
                       <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={function(){openDetails(n);}}><Eye className="w-4 h-4" /></Button></TableCell>
                     </TableRow>
                   );
                 })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Gerar NFS-e */}
      <Dialog open={showGerar} onOpenChange={setShowGerar}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gerar NFS-e Rascunho</DialogTitle><DialogDescription>Selecione a origem e confirme os dados</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <Select value={gerarForm.origem} onValueChange={function(v:any){setGerarForm(function(p){return{...p,origem:v,origem_id:""}});fetchOrigens(v);}}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="os">Ordem de Servico</SelectItem><SelectItem value="cte">CT-e Pronto</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>{gerarForm.origem==="os"?"Ordem de Servico":"CT-e"}</Label>
                <Select value={gerarForm.origem_id} onValueChange={handleOrigemChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {origens.map(function(o:any){return <SelectItem key={o.id} value={o.id}>{o.numero||o.id?.substring(0,8)}</SelectItem>;})}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-3">
              <Label className="text-xs text-muted-foreground mb-2 block">Dados do Documento</Label>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Emitente</Label><Input value={gerarForm.emitente_nome} disabled className="bg-muted text-xs" /></div>
                <div><Label>CNPJ Emitente</Label><Input value={gerarForm.emitente_cnpj} disabled className="bg-muted text-xs" /></div>
                <div><Label>Tomador</Label><Input value={gerarForm.tomador_nome} onChange={function(e){setGerarForm(function(p){return{...p,tomador_nome:e.target.value}});}} /></div>
                <div><Label>CNPJ Tomador</Label><Input value={gerarForm.tomador_cnpj} onChange={function(e){setGerarForm(function(p){return{...p,tomador_cnpj:e.target.value}});}} /></div>
                <div><Label>Valor Servico</Label><Input type="number" value={gerarForm.valor_servico||""} onChange={function(e){setGerarForm(function(p){return{...p,valor_servico:parseFloat(e.target.value)||0}});}} /></div>
              </div>
            </div>

            <div className="border-t pt-3">
              <Label className="text-xs text-muted-foreground mb-2 block">Dados Municipais</Label>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Municipio Prestacao</Label><Input value={gerarForm.municipio} onChange={function(e){setGerarForm(function(p){return{...p,municipio:e.target.value}});}} onBlur={handleMunicipioBlur} /></div>
                <div>
                  <Label>UF</Label>
                  <Select value={gerarForm.uf||undefined} onValueChange={function(v){setGerarForm(function(p){return{...p,uf:v}});handleMunicipioBlur();}}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UFS.map(function(u){return<SelectItem key={u} value={u}>{u}</SelectItem>;})}</SelectContent>
                  </Select>
                </div>
                <div><Label>Codigo Servico</Label><Input value={gerarForm.codigo_servico} onChange={function(e){setGerarForm(function(p){return{...p,codigo_servico:e.target.value}});}} /></div>
                <div><Label>Descricao Servico</Label><Input value={gerarForm.descricao_servico} onChange={function(e){setGerarForm(function(p){return{...p,descricao_servico:e.target.value}});}} /></div>
                <div><Label>Aliquota ISS (%)</Label><Input value={gerarForm.aliquota_iss} onChange={function(e){setGerarForm(function(p){return{...p,aliquota_iss:e.target.value}});}} /></div>
                <div className="flex items-end pb-1"><div className="flex items-center gap-2"><Switch checked={gerarForm.iss_retido} onCheckedChange={function(v){setGerarForm(function(p){return{...p,iss_retido:v}});}} /><Label>ISS Retido</Label></div></div>
              </div>
            </div>

            {regraSugerida && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                Regra municipal encontrada: {regraSugerida.municipio_prestacao}/{regraSugerida.uf} | Cod: {regraSugerida.codigo_servico} | ISS: {regraSugerida.aliquota_iss}% | Retido: {regraSugerida.iss_retido?"Sim":"Nao"}
              </div>
            )}
            {avisoRegra && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {avisoRegra}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={function(){setShowGerar(false);}}>Cancelar</Button>
            <Button onClick={handleGerar} disabled={gerando||!gerarForm.origem_id}>{gerando?<Loader2 className="w-4 h-4 animate-spin mr-2"/>:<Stamp className="w-4 h-4 mr-2"/>}Gerar Rascunho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedNfse && (function() {
            const m = selectedNfse.metadata || {};
            const v = Array.isArray(m.validacoes_pendentes) ? m.validacoes_pendentes : [];
            const pronto = m.pronto_para_emissao;
            const erros = v.filter(function(x:any){return x.severidade==="erro";});
            const avisos = v.filter(function(x:any){return x.severidade==="aviso";});
            const temErros = erros.length > 0;
            return (
              <>
                <DialogHeader><DialogTitle className="flex items-center gap-2"><Stamp className="w-5 h-5 text-green-600" />NFS-e {selectedNfse.numero}</DialogTitle><DialogDescription>{selectedNfse.status}</DialogDescription></DialogHeader>
                <div className="space-y-3 py-2">
                  <div className={"p-3 rounded-lg border-2 "+(temErros?"bg-red-50 border-red-200":"bg-green-50 border-green-200")}>
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><ShieldAlert className={"w-4 h-4 "+(temErros?"text-red-600":"text-green-600")}/><span className="font-semibold text-sm">STATUS FISCAL</span></div><Badge className={temErros?"bg-red-100 text-red-700 border-red-200":"bg-green-100 text-green-700 border-green-200"}>{temErros?"COM PENDENCIA":"PRONTO INTERNO"}</Badge></div>
                  </div>
                  {erros.length>0&&<div className="border rounded-lg"><div className="p-3 border-b bg-red-50/50"><span className="font-semibold text-xs text-red-800">PENDENCIAS ({erros.length})</span></div><div className="p-3 space-y-1">{erros.map(function(e:any,i:number){return<div key={i} className="flex items-start gap-2 text-xs"><XCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0"/><span className="text-red-700">{e.mensagem}</span></div>;})}</div></div>}
                  {avisos.length>0&&<div className="border rounded-lg"><div className="p-3 border-b bg-amber-50/50"><span className="font-semibold text-xs text-amber-800">AVISOS ({avisos.length})</span></div><div className="p-3 space-y-1">{avisos.map(function(a:any,i:number){return<div key={i} className="flex items-start gap-2 text-xs"><AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0"/><span className="text-amber-700">{a.mensagem}</span></div>;})}</div></div>}
                  <div className="border rounded-lg p-3 bg-slate-50 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Emitente</span><span className="font-medium">{m.emitente?.nome||"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tomador</span><span className="font-medium">{m.tomador?.nome||"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Servico</span><span>{m.servico||"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Codigo</span><span className="font-mono">{m.codigo_servico||"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">ISS%</span><span>{m.aliquota_iss!=null?m.aliquota_iss+"%":"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">ISS Retido</span><span>{m.iss_retido===true?"Sim":m.iss_retido===false?"Nao":"-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold">{fmtFin(m.valor_servico)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Municipio</span><span>{m.municipio_prestacao||"-"}</span></div>
                  </div>

                  {/* CICLO DE VIDA */}
                  <div className="border rounded-lg mt-3">
                    <div className="p-3 border-b bg-slate-50/50 flex items-center justify-between"><div className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-slate-600" /><span className="font-semibold text-xs text-slate-800">CICLO DE VIDA INTERNO</span></div><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{selectedNfse.status}</Badge></div>
                    <div className="p-3 space-y-2"><div className="flex gap-2"><Button variant="outline" size="sm" className="text-xs" onClick={function(){openSimulacao("cancelar");}}><XCircle className="w-3 h-3 mr-1" />Simular Cancelamento</Button><Button variant="outline" size="sm" className="text-xs" onClick={function(){openSimulacao("rejeitar");}}><AlertTriangle className="w-3 h-3 mr-1" />Simular Rejeicao</Button></div><p className="text-[10px] text-muted-foreground italic">Simulacoes internas. Nao comunicam com prefeitura ou Focus.</p>{historico.length>0&&<div className="mt-2 pt-2 border-t"><span className="text-xs font-semibold text-muted-foreground">Historico</span><div className="space-y-1 mt-1">{historico.slice(0,3).map(function(h:any,i:number){return <div key={i} className="text-[10px] flex items-center gap-1"><span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span><span className="font-mono">{h.status_anterior}→{h.status_novo}</span></div>;})}</div></div>}</div>
                  </div>

                  <Tooltip><TooltipTrigger asChild><span className="w-full inline-block"><Button className="w-full" disabled={temErros} variant={temErros?"outline":"default"} onClick={pronto&&!temErros?handlePreEmissao:undefined}><Stamp className="w-4 h-4 mr-2"/>Pre-emissao NFS-e</Button></span></TooltipTrigger>{temErros&&<TooltipContent><p>Corrija as pendencias antes da emissao.</p></TooltipContent>}</Tooltip>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal Simulacao */}
      <Dialog open={showSimulacao} onOpenChange={setShowSimulacao}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Simular {simulacaoAcao==="cancelar"?"Cancelamento":"Rejeicao"} — NFS-e</DialogTitle><DialogDescription>Esta acao e uma simulacao interna.</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2"><div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">Nao comunica com prefeitura ou Focus NFe.</div><div><Label>Motivo *</Label><Input value={motivoSimulacao} onChange={function(e){setMotivoSimulacao(e.target.value);}} placeholder="Teste de homologacao..." /></div></div>
          <DialogFooter><Button variant="outline" onClick={function(){setShowSimulacao(false);}}>Cancelar</Button><Button variant="destructive" onClick={handleSimular} disabled={!motivoSimulacao.trim()}>Confirmar Simulacao</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Pre-emissao */}
      <Dialog open={showPreEmissao} onOpenChange={setShowPreEmissao}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-primary"/>Pre-emissao NFS-e</DialogTitle><DialogDescription>Dados internos prontos</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2"><div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600"/><span className="text-sm font-medium text-green-800">Dados internos prontos</span></div><div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"><div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0"/><p className="text-xs text-amber-800">Esta NFS-e esta pronta em dados internos, mas a emissao real ainda depende de configuracao Focus NFe, token, certificado digital A1 e ambiente fiscal.</p></div></div></div>
          <DialogFooter><Button variant="outline" onClick={function(){setShowPreEmissao(false);}}>Fechar</Button><Button onClick={function(){setShowPreEmissao(false);}}>Entendi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
