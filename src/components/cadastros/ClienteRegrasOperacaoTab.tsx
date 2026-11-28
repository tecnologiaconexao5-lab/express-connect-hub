import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2, Pencil, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CAMPOS_REGRA,
  excluirRegraOperacao,
  listarRegrasOperacaoCliente,
  modalidadeRegraLabel,
  MODALIDADES_REGRA,
  salvarRegraOperacao,
  type ModalidadeRegra,
  type RegraOperacaoCliente,
} from "@/services/clientes/regrasOperacaoClienteService";

interface Props {
  clienteId?: string;
}

type ValoresRegra = Pick<
  RegraOperacaoCliente,
  | "exige_leitura_volumes"
  | "exige_foto_coleta"
  | "exige_foto_entrega"
  | "exige_assinatura"
  | "exige_pin_entrega"
  | "exige_controle_temperatura"
  | "permite_entrega_parcial"
>;

const REGRA_INICIAL: ValoresRegra = {
  exige_leitura_volumes: false,
  exige_foto_coleta: false,
  exige_foto_entrega: false,
  exige_assinatura: false,
  exige_pin_entrega: false,
  exige_controle_temperatura: false,
  permite_entrega_parcial: false,
};

export default function ClienteRegrasOperacaoTab({ clienteId }: Props) {
  const [regras, setRegras] = useState<RegraOperacaoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<RegraOperacaoCliente | null>(null);
  const [modalidade, setModalidade] = useState<ModalidadeRegra>("todas");
  const [valores, setValores] = useState<ValoresRegra>(REGRA_INICIAL);
  const [instrucoes, setInstrucoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!clienteId) {
      setRegras([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRegras(await listarRegrasOperacaoCliente(clienteId));
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrirNova() {
    setEditando(null);
    setModalidade("todas");
    setValores(REGRA_INICIAL);
    setInstrucoes("");
    setDialogOpen(true);
  }

  function abrirEdicao(regra: RegraOperacaoCliente) {
    setEditando(regra);
    setModalidade(regra.modalidade);
    setValores({
      exige_leitura_volumes: regra.exige_leitura_volumes,
      exige_foto_coleta: regra.exige_foto_coleta,
      exige_foto_entrega: regra.exige_foto_entrega,
      exige_assinatura: regra.exige_assinatura,
      exige_pin_entrega: regra.exige_pin_entrega,
      exige_controle_temperatura: regra.exige_controle_temperatura,
      permite_entrega_parcial: regra.permite_entrega_parcial,
    });
    setInstrucoes(regra.instrucoes_padrao || "");
    setDialogOpen(true);
  }

  async function salvar() {
    if (!clienteId) return;
    setSalvando(true);
    try {
      await salvarRegraOperacao({
        id: editando?.id,
        cliente_id: clienteId,
        modalidade,
        ...valores,
        instrucoes_padrao: instrucoes || null,
      });
      toast.success("Procedimentos da operação salvos.");
      setDialogOpen(false);
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar os procedimentos.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(regra: RegraOperacaoCliente) {
    if (!window.confirm(`Remover os procedimentos de ${modalidadeRegraLabel(regra.modalidade)}?`)) return;
    try {
      await excluirRegraOperacao(regra.id);
      toast.success("Procedimentos removidos.");
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  if (!clienteId) {
    return <p className="text-sm text-muted-foreground">Salve o cliente para configurar os procedimentos operacionais.</p>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Procedimentos por cliente e modalidade
          </CardTitle>
          <CardDescription>
            Defina o que o App do prestador parceiro deve exigir em cada modalidade de prestação deste cliente.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void carregar()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={abrirNova}><Plus className="w-4 h-4 mr-1.5" /> Novo procedimento</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando procedimentos...</div>
        ) : regras.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum procedimento configurado. Crie um conjunto de regras para este cliente.
          </div>
        ) : (
          regras.map((regra) => {
            const ativos = CAMPOS_REGRA.filter((c) => Boolean(regra[c.campo]));
            return (
              <div key={regra.id} className="rounded-xl border p-4 flex flex-col lg:flex-row lg:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                      {modalidadeRegraLabel(regra.modalidade)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{ativos.length} exigência(s) ativa(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {ativos.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Nenhuma exigência — operação simplificada.</span>
                    ) : (
                      ativos.map((c) => (
                        <Badge key={c.campo} variant="secondary" className="text-[11px]">{c.label}</Badge>
                      ))
                    )}
                  </div>
                  {regra.instrucoes_padrao && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                      <ClipboardList className="w-3.5 h-3.5 inline mr-1" /> {regra.instrucoes_padrao}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => abrirEdicao(regra)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-red-700" onClick={() => void remover(regra)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar procedimento" : "Novo procedimento"}</DialogTitle>
            <DialogDescription>As exigências são aplicadas ao App do prestador parceiro na operação deste cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Modalidade de prestação</Label>
              <Select value={modalidade} onValueChange={(v) => setModalidade(v as ModalidadeRegra)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES_REGRA.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {CAMPOS_REGRA.map((campo) => (
                <div key={campo.campo} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{campo.label}</p>
                    <p className="text-xs text-muted-foreground">{campo.descricao}</p>
                  </div>
                  <Switch
                    checked={Boolean(valores[campo.campo])}
                    onCheckedChange={(checked) => setValores((prev) => ({ ...prev, [campo.campo]: checked }))}
                  />
                </div>
              ))}
            </div>

            <div>
              <Label>Instruções padrão para o prestador parceiro</Label>
              <Textarea
                rows={3}
                value={instrucoes}
                onChange={(e) => setInstrucoes(e.target.value)}
                placeholder="Orientações exibidas no App durante a operação..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar procedimentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
