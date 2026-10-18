import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Package, Truck, CheckCircle2, Clock, MapPin, Search, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const STATUS_MAP: Record<string, { label: string; step: number; color: string }> = {
  rascunho: { label: "Registrado", step: 1, color: "bg-slate-500" },
  pendente: { label: "Pendente", step: 1, color: "bg-slate-500" },
  agendada: { label: "Agendado", step: 1, color: "bg-blue-500" },
  em_andamento: { label: "Em Andamento", step: 2, color: "bg-blue-500" },
  em_rota: { label: "Em Transito", step: 3, color: "bg-orange-500" },
  coletado: { label: "Coletado", step: 2, color: "bg-blue-500" },
  entregue: { label: "Entregue", step: 4, color: "bg-green-500" },
  finalizada: { label: "Entregue", step: 4, color: "bg-green-500" },
  concluida: { label: "Concluido", step: 4, color: "bg-green-500" },
  cancelada: { label: "Cancelado", step: 0, color: "bg-red-500" },
  ocorrencia: { label: "Ocorrencia", step: 3, color: "bg-amber-500" },
};

const STEPS = ["Registrado", "Em Andamento", "Em Transito", "Entregue"];

export default function Tracking() {
  const { codigo } = useParams();
  const [codigoBusca, setCodigoBusca] = useState(codigo || "");
  const [loading, setLoading] = useState(false);
  const [os, setOs] = useState<any>(null);
  const [eventos, setEventos] = useState<any[]>([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (codigo) buscarRastreio(codigo);
  }, [codigo]);

  const buscarRastreio = async (cod: string) => {
    setLoading(true);
    setErro("");
    try {
      const termo = cod.trim().toUpperCase();
      // Buscar por numero da OS ou ID parcial da alocacao
      const { data: osData, error: osErr } = await supabase
        .from("ordens_servico")
        .select("id, numero, status, data_programada, origem, destino, prestador, veiculo_placa, tipo_operacao")
        .or(`numero.eq.${termo},id.eq.${termo}`)
        .limit(1)
        .maybeSingle();

      if (osErr || !osData) {
        // Tentar buscar por alocacao
        const { data: alocData } = await supabase
          .from("alocacoes_escala")
          .select("id, status, data_escala, prestador_nome, placa, ordem_servico_id, origem, destino")
          .or(`id.eq.${termo},ordem_servico_id.eq.${termo}`)
          .limit(1)
          .maybeSingle();

        if (alocData) {
          setOs({
            codigo: alocData.id.slice(0, 8).toUpperCase(),
            status: alocData.status,
            data_programada: alocData.data_escala,
            origem: alocData.origem || "—",
            destino: alocData.destino || "—",
            prestador: alocData.prestador_nome || "—",
            placa: alocData.placa || "—",
            fonte: "operacao",
          });
          await carregarEventos(alocData.id);
        } else {
          setErro("Codigo nao encontrado. Verifique e tente novamente.");
        }
      } else {
        setOs({
          codigo: osData.numero || osData.id.slice(0, 8).toUpperCase(),
          status: osData.status,
          data_programada: osData.data_programada,
          origem: osData.origem || "—",
          destino: osData.destino || "—",
          prestador: osData.prestador || "—",
          placa: osData.veiculo_placa || "—",
          tipo: osData.tipo_operacao,
          fonte: "os",
        });
        await carregarEventos(osData.id);
      }
    } catch (e) {
      setErro("Erro ao consultar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const carregarEventos = async (refId: string) => {
    try {
      // Buscar historico da escala e auditoria operacional
      const [histRes, auditRes] = await Promise.all([
        supabase.from("historico_alocacoes_escala").select("evento, descricao, created_at").or(`alocacao_id.eq.${refId},alocacao_id.in.(select id from alocacoes_escala where ordem_servico_id.eq.${refId})`).order("created_at", { ascending: true }).limit(20),
        supabase.from("auditoria_operacional").select("acao, dados_novos, created_at").eq("os_id", refId).order("created_at", { ascending: true }).limit(20),
      ]);

      const evts: any[] = [];
      if (histRes.data) {
        histRes.data.forEach((h: any) => {
          evts.push({
            titulo: h.evento === 'criacao' ? 'Operacao registrada' :
                    h.evento === 'aceite' ? 'Motorista confirmou' :
                    h.evento === 'inicio_rota' ? 'Em rota de entrega' :
                    h.evento === 'finalizacao' ? 'Entrega concluida' :
                    h.evento === 'cancelamento' ? 'Operacao cancelada' :
                    h.evento === 'troca_motorista' ? 'Motorista substituido' :
                    h.evento === 'troca_veiculo' ? 'Veiculo substituido' : h.evento || 'Atualizacao',
            data: h.created_at ? new Date(h.created_at).toLocaleDateString('pt-BR') : '',
            hora: h.created_at ? new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
            fonte: h.evento === 'finalizacao' || h.evento === 'cancelamento' ? 'operacao' : 'sistema',
          });
        });
      }
      if (auditRes.data) {
        auditRes.data.forEach((a: any) => {
          evts.push({
            titulo: a.acao === 'criacao' ? 'Solicitacao criada' :
                    a.acao === 'finalizacao' ? 'Entrega finalizada' :
                    a.acao === 'cancelamento' ? 'Operacao cancelada' :
                    a.acao === 'edicao' ? 'Dados atualizados pela operacao' : a.acao || 'Atualizacao',
            data: a.created_at ? new Date(a.created_at).toLocaleDateString('pt-BR') : '',
            hora: a.created_at ? new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
            fonte: 'operacao',
          });
        });
      }
      evts.sort((a, b) => new Date(a.data + 'T' + a.hora).getTime() - new Date(b.data + 'T' + b.hora).getTime());
      setEventos(evts.length > 0 ? evts : [
        { titulo: "Solicitacao registrada", data: new Date().toLocaleDateString('pt-BR'), hora: "", fonte: "sistema" }
      ]);
    } catch { /* eventos opcionais */ }
  };

  const getStep = () => {
    const s = os?.status;
    if (!s) return 0;
    const mapped = STATUS_MAP[s];
    if (s === 'cancelada') return 0;
    return mapped?.step || 1;
  };

  const step = getStep();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
        <p className="font-bold text-slate-500">Consultando...</p>
      </div>
    );
  }

  if (!os && !codigo) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col pt-20 items-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center mb-6 shadow-lg"><Package className="w-8 h-8 text-white" /></div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Rastreamento Express</h1>
        <p className="text-slate-500 mb-8 text-center max-w-sm">Informe o codigo da sua OS para acompanhar o status da entrega.</p>
        <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
          <label className="text-sm font-medium mb-2 block">Codigo de Rastreio</label>
          <div className="flex gap-2">
            <Input className="h-12 text-lg font-bold uppercase" placeholder="CEX-... ou ID" value={codigoBusca} onChange={e => setCodigoBusca(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && buscarRastreio(codigoBusca)} />
            <Button className="h-12 px-6 bg-orange-500 hover:bg-orange-600 font-bold" onClick={() => buscarRastreio(codigoBusca)}><Search className="w-5 h-5" /></Button>
          </div>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col pt-20 items-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mb-6"><AlertTriangle className="w-8 h-8 text-slate-400" /></div>
        <h1 className="text-xl font-bold text-slate-700 mb-2">Nao Encontrado</h1>
        <p className="text-slate-500 mb-8 text-center">{erro}</p>
        <Button variant="outline" onClick={() => { setOs(null); setErro(""); setCodigoBusca(""); }}>Buscar Outro Codigo</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b py-4 px-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-bold text-lg text-white shadow-md">CE</div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-slate-800 leading-none">Rastreamento</h1>
              <p className="text-xs text-slate-500">Atualizado pela operacao</p>
            </div>
          </div>
          <Link to="/portal-cliente" className="text-sm text-orange-600 hover:underline font-medium">Portal do Cliente</Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-20 pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10 mb-10">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">
                {os.fonte === 'operacao' ? 'Atualizado pela operacao' : 'Status da OS'}
              </p>
              <h2 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">{os.codigo}</h2>
              {os.data_programada && (
                <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl text-slate-700 font-medium">
                  <Clock className="w-5 h-5 text-slate-400" />
                  Previsao: <strong className="text-slate-800">{new Date(os.data_programada).toLocaleDateString('pt-BR')}</strong>
                </div>
              )}
            </div>
            <div>
              <Badge className={`${STATUS_MAP[os.status]?.color || 'bg-slate-500'} text-white font-bold text-sm px-4 py-1.5 uppercase shadow-md`}>
                {STATUS_MAP[os.status]?.label || os.status}
              </Badge>
            </div>
          </div>

          {/* Progress Bar */}
          {step > 0 && (
            <div className="flex w-full items-center justify-between mb-8 relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 z-0 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all duration-1000" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
              </div>
              {STEPS.map((label, i) => {
                const done = i + 1 <= step;
                return (
                  <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${done ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>
                      {done && i + 1 < step ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                    </div>
                    <span className={`text-[10px] sm:text-xs font-bold uppercase ${done ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {os.status === 'cancelada' && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>Esta operacao foi cancelada. Entre em contato com a transportadora para mais informacoes.</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-8 border-t border-slate-100">
            <div className="flex gap-4 items-center p-3 rounded-2xl bg-slate-50"><div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center"><MapPin className="w-5 h-5 text-slate-500" /></div><div><p className="text-[10px] font-bold text-slate-400 uppercase">Origem</p><p className="text-sm font-bold text-slate-700">{os.origem}</p></div></div>
            <div className="flex gap-4 items-center p-3 rounded-2xl bg-slate-50"><div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center"><MapPin className="w-5 h-5 text-orange-500" /></div><div><p className="text-[10px] font-bold text-slate-400 uppercase">Destino</p><p className="text-sm font-bold text-slate-700">{os.destino}</p></div></div>
            <div className="flex gap-4 items-center p-3 rounded-2xl bg-slate-50"><div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center"><Truck className="w-5 h-5 text-slate-500" /></div><div><p className="text-[10px] font-bold text-slate-400 uppercase">Transportador</p><p className="text-sm font-bold text-slate-700">{os.prestador}{os.placa ? ` (${os.placa})` : ''}</p></div></div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 pb-12">
          <h3 className="text-lg font-bold text-slate-800 mb-8 border-b pb-4">Historico de Atualizacoes</h3>
          <div className="relative border-l-2 border-slate-100 ml-4 space-y-8">
            {eventos.length > 0 ? [...eventos].reverse().map((ev, i) => (
              <div key={i} className="relative pl-8">
                <div className={`absolute w-6 h-6 rounded-full border-4 flex items-center justify-center -left-[13px] top-1 ${i === 0 ? 'bg-orange-500 border-orange-100 shadow-lg ring-4 ring-orange-500/20' : 'bg-slate-200 border-white'}`}>
                  {i === 0 && <div className="w-2 h-2 bg-white rounded-full animate-ping" />}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                  <div>
                    <h4 className={`text-base font-bold ${i === 0 ? 'text-orange-600' : 'text-slate-700'}`}>{ev.titulo}</h4>
                    {ev.fonte === 'operacao' && <p className="text-xs text-slate-400 mt-0.5">Atualizado pela equipe de operacao</p>}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-sm font-bold text-slate-600">{ev.data}</p>
                    <p className="text-xs text-slate-400 font-medium">{ev.hora}</p>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-slate-400 text-sm pl-4">Nenhum evento registrado ainda.</p>
            )}
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-slate-500 text-sm border-t bg-white">
        <p>Rastreamento Express Connect Hub</p>
      </footer>
    </div>
  );
}
