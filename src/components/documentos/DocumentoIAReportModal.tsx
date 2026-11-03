import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  FilePlus2,
  ClipboardCheck,
  ShieldCheck,
  ListChecks,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RelatorioIA, StatusRelatorioIA } from "@/services/documentos/documentosMetadataService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento?: { nome?: string | null; tipo?: string | null } | null;
  resultado: RelatorioIA | null;
  loading?: boolean;
  onReanalisar?: () => void;
  onGerarNovaVersao?: () => void;
}

function estiloStatus(status?: StatusRelatorioIA) {
  if (status === "APROVADO NA CONFERÊNCIA") {
    return { badge: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: CheckCircle2 };
  }
  if (status === "APROVADO COM RESSALVAS") {
    return { badge: "border-amber-200 bg-amber-50 text-amber-700", icon: AlertTriangle };
  }
  if (status === "NECESSITA DE CORREÇÃO") {
    return { badge: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
  }
  return { badge: "border-violet-200 bg-violet-50 text-violet-700", icon: Info };
}

const STATUS_ROTULO: Record<StatusRelatorioIA, string> = {
  "APROVADO NA CONFERÊNCIA": "APROVADO NA CONFERÊNCIA",
  "APROVADO COM RESSALVAS": "APROVADO COM RESSALVAS",
  "NECESSITA DE CORREÇÃO": "NECESSITA DE CORREÇÃO",
  "AGUARDANDO CONFERÊNCIA HUMANA": "AGUARDANDO CONFERÊNCIA HUMANA",
};

function ListaVazia({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-3 text-sm text-muted-foreground">
      {texto}
    </p>
  );
}

function Secao({
  titulo,
  icone,
  cor = "text-muted-foreground",
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  cor?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${cor}`}>
        {icone}
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export function DocumentoIAReportModal({
  open,
  onOpenChange,
  documento,
  resultado,
  loading = false,
  onReanalisar,
  onGerarNovaVersao,
}: Props) {
  const estilo = estiloStatus(resultado?.status);
  const Icone = estilo.icon;
  const temSugestao =
    Boolean(resultado?.sugestao_correcao) ||
    (resultado?.recomendacoes?.length ?? 0) > 0 ||
    resultado?.status === "NECESSITA DE CORREÇÃO";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Relatório de IA — {documento?.tipo || "Documento"}
          </DialogTitle>
          <DialogDescription>
            Conferência automática de {documento?.nome || documento?.tipo || "documento"}.
            {resultado?.origem === "simulado" ? " Resultado gerado em modo simulado." : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Analisando documento com IA...</p>
            <p className="text-xs">Isso pode levar alguns segundos.</p>
          </div>
        ) : !resultado ? (
          <div className="rounded-xl border border-border/40 bg-muted/20 p-5 text-sm text-muted-foreground">
            Nenhum resultado de análise disponível.
          </div>
        ) : (
          <div className="space-y-5">
            <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm font-black uppercase tracking-wide ${estilo.badge}`}>
              <Icone className="h-5 w-5 shrink-0" />
              {STATUS_ROTULO[resultado.status] || resultado.status}
            </div>

            <Secao titulo="Informações Verificadas" icone={<ClipboardCheck className="h-4 w-4" />} cor="text-primary">
              {resultado.informacoes_verificadas?.length ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {resultado.informacoes_verificadas.map((info, idx) => (
                    <div key={`${info.campo}-${idx}`} className="rounded-lg border border-border/40 bg-muted/10 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{info.campo}</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{info.valor}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <ListaVazia texto="Nenhuma informação verificada." />
              )}
            </Secao>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Secao titulo="Itens Corretos" icone={<CheckCircle2 className="h-4 w-4" />} cor="text-emerald-600">
                {resultado.itens_corretos?.length ? (
                  <ul className="space-y-2">
                    {resultado.itens_corretos.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-2.5 text-sm text-emerald-800">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ListaVazia texto="Nenhum item correto registrado." />
                )}
              </Secao>

              <Secao titulo="Informações Ausentes" icone={<AlertTriangle className="h-4 w-4" />} cor="text-amber-600">
                {resultado.informacoes_ausentes?.length ? (
                  <ul className="space-y-2">
                    {resultado.informacoes_ausentes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 rounded-lg border border-amber-200/60 bg-amber-50/60 p-2.5 text-sm text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ListaVazia texto="Nenhuma informação ausente." />
                )}
              </Secao>
            </div>

            <Secao titulo="Erros Identificados" icone={<XCircle className="h-4 w-4" />} cor="text-rose-600">
              {resultado.erros_identificados?.length ? (
                <ul className="space-y-2">
                  {resultado.erros_identificados.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 rounded-lg border border-rose-200/60 bg-rose-50/60 p-2.5 text-sm text-rose-800">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ListaVazia texto="Nenhum erro identificado." />
              )}
            </Secao>

            <Secao titulo="Recomendações" icone={<ListChecks className="h-4 w-4" />} cor="text-blue-600">
              {resultado.recomendacoes?.length ? (
                <ul className="space-y-2">
                  {resultado.recomendacoes.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 rounded-lg border border-blue-200/60 bg-blue-50/60 p-2.5 text-sm text-blue-800">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ListaVazia texto="Nenhuma recomendação registrada." />
              )}
            </Secao>

            {(resultado.sugestao_correcao || (resultado.observacoes?.length ?? 0) > 0) && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" /> Sugestão de Correção
                </p>
                {resultado.sugestao_correcao && (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{resultado.sugestao_correcao}</p>
                )}
                {resultado.observacoes?.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {resultado.observacoes.map((obs, idx) => (
                      <li key={idx}>• {obs}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}

            {resultado.gerado_em && (
              <p className="text-xs text-muted-foreground">
                Gerado em {new Date(resultado.gerado_em).toLocaleString("pt-BR")}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border/30 pt-4">
              {onGerarNovaVersao && temSugestao && (
                <Button variant="outline" className="gap-1.5" onClick={onGerarNovaVersao}>
                  <FilePlus2 className="h-4 w-4" /> Gerar Nova Versão
                </Button>
              )}
              {onReanalisar && (
                <Button variant="outline" className="gap-1.5" onClick={onReanalisar}>
                  <RefreshCw className="h-4 w-4" /> Reanalisar
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
