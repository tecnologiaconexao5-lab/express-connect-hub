import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditarSistema, type RelatorioAuditoria } from "@/services/ia/uiConsolidationService";

const GRAVIDADE_CORES: Record<string, string> = {
  baixa: "bg-yellow-100 text-yellow-800 border-yellow-300",
  media: "bg-orange-100 text-orange-800 border-orange-300",
  alta: "bg-red-100 text-red-800 border-red-300",
};

const TIPO_LABELS: Record<string, string> = {
  duplicacao: "Duplicação de Entidade",
  conflito_status: "Conflito de Status",
  dados_divergentes: "Dados Divergentes",
};

export function AuditoriaTab() {
  const [relatorio, setRelatorio] = useState<RelatorioAuditoria | null>(null);
  const [loading, setLoading] = useState(false);

  async function executarAuditoria() {
    setLoading(true);
    try {
      const result = await auditarSistema();
      setRelatorio(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileSearch className="h-5 w-5" />
            Auditoria Visual do Sistema
          </h2>
          <p className="text-sm text-muted-foreground">
            Relatório read-only de duplicações, conflitos de estado e dados divergentes entre fontes
          </p>
        </div>
        <Button onClick={executarAuditoria} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Auditando..." : "Executar Auditoria"}
        </Button>
      </div>

      {relatorio && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Robôs (Bruto)</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{relatorio.total_robos_bruto}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Robôs (Únicos)</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-green-600">{relatorio.total_robos_unicos}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Duplicatas Removidas</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${relatorio.duplicatas_removidas > 0 ? "text-orange-600" : "text-green-600"}`}>
                  {relatorio.duplicatas_removidas}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Fontes Analisadas</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-mono text-xs">{relatorio.fontes.join(", ")}</p></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {relatorio.inconsistencias.length > 0 ? (
                  <><AlertTriangle className="h-4 w-4 text-red-500" />Inconsistências Detectadas</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 text-green-500" />Nenhuma Inconsistência</>
                )}
                <Badge variant="outline" className="ml-2">{relatorio.inconsistencias.length}</Badge>
              </CardTitle>
              <CardDescription>Realizado em {new Date(relatorio.timestamp).toLocaleString("pt-BR")}</CardDescription>
            </CardHeader>
            {relatorio.inconsistencias.length > 0 && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Gravidade</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatorio.inconsistencias.map((inc, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant="outline">{TIPO_LABELS[inc.tipo] || inc.tipo}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={GRAVIDADE_CORES[inc.gravidade]}>{inc.gravidade}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{inc.entidade_nome}</TableCell>
                        <TableCell className="text-sm">{inc.descricao}</TableCell>
                        <TableCell>
                          {inc.detalhes && (
                            <pre className="text-[10px] font-mono bg-muted p-1 rounded max-w-[200px] overflow-x-auto">
                              {JSON.stringify(inc.detalhes, null, 1)}
                            </pre>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo da Consolidação</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Dados brutos:</strong> {relatorio.total_robos_bruto} registros retornados do banco.
              </p>
              <p>
                <strong>Após normalização:</strong> {relatorio.total_robos_unicos} robôs únicos (chave: <code>robo_id</code>).
              </p>
              <p>
                <strong>Duplicatas:</strong> {relatorio.duplicatas_removidas} entradas removidas por ID duplicado.
              </p>
              <p>
                <strong>Status:</strong> Conflitos resolvidos por prioridade (erro &gt; ativo &gt; pausado &gt; inativo).
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                * Auditoria puramente visual. Nenhuma regra de negócio ou dado foi alterado.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {!relatorio && !loading && (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <FileSearch className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Clique em "Executar Auditoria" para gerar o relatório</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
