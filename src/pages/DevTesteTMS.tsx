// src/pages/DevTesteTMS.tsx
import { useState } from "react";
import { Play, CheckCircle, XCircle, Trash2, UserPlus, FileText } from "lucide-react";
import { testeCompletoTMS } from "@/lib/testes/testeTMSCompleto";
import { testarFluxoDocumentos, testarAntiDuplicidade } from "@/lib/testes/testeDocumentos";
import { checarDuplicidade, ativarPrestador } from "@/services/recrutamentoIntegracao";
import type { ResultadoTeste } from "@/lib/testes/testeTMSCompleto";

interface TesteRecrutamento {
  sucesso: boolean;
  tipo?: "criado" | "atualizado" | "ja_existente";
  prestador_id?: string;
  mensagem?: string;
}

interface TesteDocumentos {
  sucesso: boolean;
  duracaoTotal: string;
  mensagem?: string;
}

const DevTesteTMS = () => {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const [loadingRecrutamento, setLoadingRecrutamento] = useState(false);
  const [resultadoRecrutamento, setResultadoRecrutamento] = useState<TesteRecrutamento | null>(null);
  const [loadingDocumentos, setLoadingDocumentos] = useState(false);
  const [resultadoDocumentos, setResultadoDocumentos] = useState<TesteDocumentos | null>(null);

  const executar = async () => {
    setLoading(true);
    setResultado(null);
    try {
      const res = await testeCompletoTMS({ limparAoFim: false, verbose: false });
      setResultado(res);
    } catch (e: any) {
      setResultado({
        sucesso: false,
        duracaoTotal: "0ms",
        logs: [{ passo: 0, etapa: "Exceção", status: "fail", mensagem: e.message, erro: e.message }],
        ids: {},
      });
    } finally {
      setLoading(false);
    }
  };

  const limparDadosTeste = async () => {
    if (!resultado?.ids) return;
    const { supabase: sb } = await import("@/lib/supabase");
    const promises = [
      resultado.ids.financeiroReceber
        ? sb.from("financeiro_receber").delete().eq("id", resultado.ids.financeiroReceber)
        : Promise.resolve(),
      resultado.ids.financeiroPagar
        ? sb.from("financeiro_pagar").delete().eq("id", resultado.ids.financeiroPagar)
        : Promise.resolve(),
      resultado.ids.os
        ? sb.from("ordens_servico").delete().eq("id", resultado.ids.os)
        : Promise.resolve(),
      resultado.ids.orcamento
        ? sb.from("orcamentos").delete().eq("id", resultado.ids.orcamento)
        : Promise.resolve(),
    ];
    await Promise.allSettled(promises);
    setResultado(null);
  };

  const executarTesteRecrutamento = async () => {
    setLoadingRecrutamento(true);
    setResultadoRecrutamento(null);
    try {
      const cpfTeste = `00000000191`;
      const duplicado = await checarDuplicidade({
        id: "",
        nome_completo: "TESTE AUTO PRESTADOR",
        cpf_cnpj: cpfTeste,
        telefone: "(11) 99999-TEST",
        whatsapp: "(11) 99999-TEST",
        email: `teste-recrutamento-${Date.now()}@conexaexpress.com.br`,
        status: "aprovado",
        created_at: new Date().toISOString(),
        score_perfil: 0,
        prioridade: 0,
      });

      if (duplicado) {
        setResultadoRecrutamento({
          sucesso: true,
          tipo: "ja_existente",
          prestador_id: duplicado.prestador.id,
          mensagem: `Duplicidade detectada via ${duplicado.campo}. Anti-duplicidade funcionando.`,
        });
        setLoadingRecrutamento(false);
        return;
      }

      const resultado = await ativarPrestador({
        id: "teste-" + Date.now(),
        nome_completo: "TESTE AUTO PRESTADOR",
        cpf_cnpj: cpfTeste,
        telefone: "(11) 99999-TEST",
        whatsapp: "(11) 99999-TEST",
        email: `teste-recrutamento-${Date.now()}@conexaexpress.com.br`,
        cidade: "São Paulo",
        uf: "SP",
        tipo_veiculo: "HR",
        status: "aprovado",
        created_at: new Date().toISOString(),
        score_perfil: 85,
        prioridade: 1,
      });

      setResultadoRecrutamento({
        sucesso: resultado.success,
        tipo: resultado.tipo,
        prestador_id: resultado.prestador_id,
        mensagem: resultado.mensagem,
      });
    } catch (e: any) {
      setResultadoRecrutamento({
        sucesso: false,
        mensagem: e.message,
      });
} finally {
      setLoadingRecrutamento(false);
    }
  };

  const executarTesteDocumentos = async () => {
    setLoadingDocumentos(true);
    setResultadoDocumentos(null);
    try {
      const res = await testarFluxoDocumentos({ limparAoFim: false });
      setResultadoDocumentos({
        sucesso: res.sucesso,
        duracaoTotal: res.duracaoTotal,
        mensagem: res.logs.map(l => `${l.passo}. ${l.etapa}: ${l.status}`).join(" | "),
      });
    } catch (e: any) {
      setResultadoDocumentos({
        sucesso: false,
        duracaoTotal: "0ms",
        mensagem: e.message,
      });
    } finally {
      setLoadingDocumentos(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Play className="w-8 h-8 text-orange-500" />
            Painel de Testes TMS
          </h1>
          <p className="text-muted-foreground">Validação automatizada do fluxo completo</p>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h2 className="font-semibold text-orange-900 mb-2">⚠️ Modo Desenvolvimento</h2>
        <p className="text-sm text-orange-800">
          Este painel é exclusivamente para testes manuais. Dados de teste são criados com prefixo
          <code className="bg-orange-100 px-1 rounded">TESTE-AUTO</code>. Execute em
          ambiente de desenvolvimento.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={executar}
          disabled={loading}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-lg disabled:opacity-50 transition-colors"
        >
          <Play className="w-5 h-5" />
          {loading ? "Executando..." : "Rodar Teste Completo"}
        </button>

        {resultado?.ids && (
          <button
            onClick={limparDadosTeste}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-lg transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            Limpar Dados de Teste
          </button>
        )}
      </div>

      <div className="border-t pt-6 mt-6">
        <h2 className="text-lg font-bold mb-3">Teste — Recrutamento Inteligente → Prestadores</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            Simula o fluxo completo: criar candidato → checar duplicidade → ativar como prestador.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={executarTesteRecrutamento}
            disabled={loadingRecrutamento}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-3 rounded-lg disabled:opacity-50 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            {loadingRecrutamento ? "Executando..." : "Testar Integração Recrutamento"}
          </button>
        </div>
        {resultadoRecrutamento && (
          <div className={`mt-4 px-4 py-3 rounded-lg font-semibold ${
            resultadoRecrutamento.sucesso ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
          }`}>
            {resultadoRecrutamento.sucesso ? <CheckCircle className="w-5 h-5 inline mr-2" /> : <XCircle className="w-5 h-5 inline mr-2" />}
            {resultadoRecrutamento.mensagem}
            {resultadoRecrutamento.prestador_id && (
              <span className="font-mono ml-2">ID: {resultadoRecrutamento.prestador_id}</span>
            )}
          </div>
        )}
      </div>

      <div className="border-t pt-6 mt-6">
        <h2 className="text-lg font-bold mb-3">Teste — Documentos de Prestadores</h2>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-purple-800">
            Testa o fluxo completo: candidato → documento → ativar → migração para prestador.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={executarTesteDocumentos}
            disabled={loadingDocumentos}
            className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-bold px-6 py-3 rounded-lg disabled:opacity-50 transition-colors"
          >
            <FileText className="w-5 h-5" />
            {loadingDocumentos ? "Executando..." : "Testar Documentos"}
          </button>
        </div>
        {resultadoDocumentos && (
          <div className={`mt-4 px-4 py-3 rounded-lg font-semibold ${
            resultadoDocumentos.sucesso ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
          }`}>
            {resultadoDocumentos.sucesso ? <CheckCircle className="w-5 h-5 inline mr-2" /> : <XCircle className="w-5 h-5 inline mr-2" />}
            {resultadoDocumentos.mensagem}
          </div>
        )}
      </div>

      {resultado && (
        <div className="space-y-3">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-bold text-lg ${
              resultado.sucesso
                ? "bg-green-100 text-green-900 border border-green-300"
                : "bg-red-100 text-red-900 border border-red-300"
            }`}
          >
            {resultado.sucesso ? (
              <CheckCircle className="w-6 h-6" />
            ) : (
              <XCircle className="w-6 h-6" />
            )}
            {resultado.sucesso ? "Fluxo Validado" : "Falha no Fluxo"} — {resultado.duracaoTotal}
          </div>

          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Passo</th>
                  <th className="text-left px-4 py-2 font-semibold">Etapa</th>
                  <th className="text-left px-4 py-2 font-semibold">Status</th>
                  <th className="text-left px-4 py-2 font-semibold">Mensagem</th>
                  <th className="text-left px-4 py-2 font-semibold">Erro</th>
                </tr>
              </thead>
              <tbody>
                {resultado.logs.map((log, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2 font-mono text-muted-foreground">{log.passo}</td>
                    <td className="px-4 py-2">{log.etapa}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                          log.status === "ok"
                            ? "bg-green-100 text-green-800"
                            : log.status === "fail"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2">{log.mensagem}</td>
                    <td className="px-4 py-2 text-red-600">{log.erro || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Object.keys(resultado.ids).length > 0 && (
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2">IDs Gerados</h3>
              <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                {Object.entries(resultado.ids).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-muted-foreground">{k}:</span>{" "}
                    <span className="bg-background px-2 py-0.5 rounded border">{v || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DevTesteTMS;