import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, RefreshCw } from "lucide-react";
import { buscarLogsLocais, buscarLogsSupabase, limparLogsLocais, IntegrationLogEntry } from "@/services/integracoes/integrationLogger";

type FonteLogs = "local" | "supabase" | "todos";

export function LogsIntegracoes() {
  const [logs, setLogs] = useState<IntegrationLogEntry[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [fonte, setFonte] = useState<FonteLogs>("todos");

  const carregarLogs = async () => {
    setCarregando(true);
    let logsLocais: IntegrationLogEntry[] = [];
    let logsSupabase: IntegrationLogEntry[] = [];

    if (fonte === "local" || fonte === "todos") {
      logsLocais = await buscarLogsLocais();
    }

    if (fonte === "supabase" || fonte === "todos") {
      logsSupabase = await buscarLogsSupabase();
    }

    // Mesclar e ordenar por data (mais recente primeiro)
    const todosLogs = [...logsLocais, ...logsSupabase];
    todosLogs.sort((a, b) => {
      const dateA = new Date(a.data_hora || 0).getTime();
      const dateB = new Date(b.data_hora || 0).getTime();
      return dateB - dateA;
    });

    // Remover duplicatas simples (mesmo tipo, ação e data/hora)
    const unicos = todosLogs.filter((log, index, self) =>
      index === self.findIndex(t =>
        t.tipo_integracao === log.tipo_integracao &&
        t.acao === log.acao &&
        t.data_hora === log.data_hora
      )
    );

    setLogs(unicos);
    setCarregando(false);
  };

  useEffect(() => {
    carregarLogs();
  }, [fonte]);

  const handleLimparLocais = () => {
    limparLogsLocais();
    carregarLogs();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sucesso': return 'text-green-600 bg-green-50';
      case 'erro': return 'text-red-600 bg-red-50';
      case 'aviso': return 'text-yellow-600 bg-yellow-50';
      case 'teste': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Logs de Integrações</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={carregarLogs} disabled={carregando}>
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleLimparLocais}>
            <Trash2 className="w-4 h-4" />
            Limpar Locais
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button 
          variant={fonte === "todos" ? "default" : "outline"} 
          size="sm" 
          onClick={() => setFonte("todos")}
        >
          Todos
        </Button>
        <Button 
          variant={fonte === "local" ? "default" : "outline"} 
          size="sm" 
          onClick={() => setFonte("local")}
        >
          Local
        </Button>
        <Button 
          variant={fonte === "supabase" ? "default" : "outline"} 
          size="sm" 
          onClick={() => setFonte("supabase")}
        >
          Supabase
        </Button>
      </div>

      {carregando ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum log encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {logs.map((log, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
                      {log.status}
                    </span>
                    <span className="text-sm font-semibold">{log.tipo_integracao}</span>
                    <span className="text-sm text-muted-foreground">{log.acao}</span>
                  </div>
                  <p className="text-sm">{log.mensagem}</p>
                  {log.erro_detalhes && (
                    <p className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded">
                      {log.erro_detalhes}
                    </p>
                  )}
                  {log.payload_resumido && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600">Payload Resumido</summary>
                      <pre className="mt-1 p-2 bg-gray-50 rounded overflow-x-auto">
                        {JSON.stringify(log.payload_resumido, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="text-xs text-muted-foreground text-right min-w-[120px]">
                  {formatDate(log.data_hora)}
                  {log.duracao_ms && (
                    <div>{log.duracao_ms}ms</div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
