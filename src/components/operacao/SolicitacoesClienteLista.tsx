import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Clock, Package, Search, ExternalLink } from "lucide-react";

interface Solicitacao {
  id: string;
  numero_pedido: string;
  status: string;
  solicitante_nome: string;
  solicitante_email: string;
  coleta_cidade: string;
  coleta_uf: string;
  entrega_destinatario: string;
  entrega_cidade: string;
  entrega_uf: string;
  descricao: string;
  volumes: number;
  peso: number;
  prioridade: string;
  veiculo_sugerido: string;
  observacoes: string;
  os_vinculada_id: string | null;
  created_at: string;
}

export default function SolicitacoesClienteLista() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [solicitacaoAtual, setSolicitacaoAtual] = useState<Solicitacao | null>(null);
  const [osNumero, setOsNumero] = useState("");

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("portal_pedidos")
      .select("*")
      .in("status", ["enviado", "em_analise", "programado"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setSolicitacoes(data);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const analisar = async (id: string) => {
    await supabase
      .from("portal_pedidos")
      .update({ status: "em_analise", updated_at: new Date().toISOString() })
      .eq("id", id);
    carregar();
  };

  const abrirProgramar = (s: Solicitacao) => {
    setSolicitacaoAtual(s);
    setOsNumero("");
    setDialogAberto(true);
  };

  const programar = async () => {
    if (!solicitacaoAtual || !osNumero.trim()) return;
    await supabase
      .from("portal_pedidos")
      .update({
        status: "programado",
        os_vinculada_id: osNumero.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", solicitacaoAtual.id);
    setDialogAberto(false);
    setSolicitacaoAtual(null);
    carregar();
  };

  const filtradas = busca
    ? solicitacoes.filter(s =>
        [s.numero_pedido, s.solicitante_nome, s.entrega_destinatario, s.coleta_cidade, s.entrega_cidade]
          .some(v => v?.toLowerCase().includes(busca.toLowerCase()))
      )
    : solicitacoes;

  const prioridadeBadge = (p: string) => {
    const map: Record<string, string> = {
      alta: "bg-red-100 text-red-700 border-red-200",
      urgente: "bg-orange-100 text-orange-700 border-orange-200",
      normal: "bg-blue-100 text-blue-700 border-blue-200",
      baixa: "bg-slate-100 text-slate-700 border-slate-200"
    };
    return map[p] || "bg-slate-100 text-slate-700 border-slate-200";
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { label: string; css: string }> = {
      enviado: { label: "Pendente", css: "bg-amber-50 text-amber-700 border-amber-200" },
      em_analise: { label: "Em Análise", css: "bg-blue-50 text-blue-700 border-blue-200" },
      programado: { label: "Programado", css: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    };
    return map[s] || { label: s, css: "bg-slate-100 text-slate-700 border-slate-200" };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Solicitações de Clientes</h2>
          <p className="text-sm text-muted-foreground">Pedidos enviados pelo Painel do Cliente</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 w-64" />
          </div>
          <Button variant="outline" size="sm" onClick={carregar}>Atualizar</Button>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Package className="w-8 h-8 mx-auto mb-2 animate-pulse" /><p>Carregando solicitações...</p></CardContent></Card>
      ) : filtradas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30" /><p className="font-medium">Nenhuma solicitação pendente</p><p className="text-sm mt-1">Todas as solicitações foram processadas.</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Pedido</TableHead>
                  <TableHead className="text-xs">Cliente</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Coleta</TableHead>
                  <TableHead className="text-xs">Destinatário</TableHead>
                  <TableHead className="text-xs">Entrega</TableHead>
                  <TableHead className="text-xs">Mercadoria</TableHead>
                  <TableHead className="text-xs">Prioridade</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">OS</TableHead>
                  <TableHead className="text-xs text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((s) => {
                  const st = statusBadge(s.status);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs font-bold">{s.numero_pedido}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate" title={s.solicitante_nome || s.solicitante_email}>
                        {s.solicitante_nome || s.solicitante_email || "-"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{s.coleta_cidade || "-"}{s.coleta_uf ? `/${s.coleta_uf}` : ""}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{s.entrega_destinatario || "-"}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate">{s.entrega_cidade || "-"}{s.entrega_uf ? `/${s.entrega_uf}` : ""}</TableCell>
                      <TableCell className="text-xs">{s.descricao?.substring(0, 25) || "-"}{s.volumes ? ` (${s.volumes} vol)` : ""}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${prioridadeBadge(s.prioridade)}`}>{s.prioridade || "normal"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${st.css}`}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{s.os_vinculada_id ? s.os_vinculada_id.substring(0, 8)+"..." : "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {s.status === "enviado" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => analisar(s.id)}>
                              <Clock className="w-3 h-3 mr-1" /> Analisar
                            </Button>
                          )}
                          {s.status !== "programado" && (
                            <Button size="sm" variant="default" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => abrirProgramar(s)}>
                              <CheckCircle className="w-3 h-3 mr-1" /> Programar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programar Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Vincular o pedido <strong>{solicitacaoAtual?.numero_pedido}</strong> a uma Ordem de Serviço existente.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="osNumero">Número da OS</Label>
              <Input id="osNumero" placeholder="Ex: OS-202606-000001" value={osNumero} onChange={e => setOsNumero(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button onClick={programar} disabled={!osNumero.trim()}>
              <CheckCircle className="w-4 h-4 mr-2" /> Confirmar Programação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
