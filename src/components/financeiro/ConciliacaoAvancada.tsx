import { useState, useEffect } from "react";
import { ArrowRightLeft, Landmark, Calendar, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

// ============================================================================
// F0-L — Conciliação bancária: honesta (sem dados mock como reais).
// Não existe estrutura de extrato/importação OFX/CSV funcional no projeto.
// A tela deixa claro que a conciliação ainda NÃO está configurada e prepara a
// entrada (conta financeira real + período) para uma futura importação.
// ============================================================================

interface ContaFinanceira {
  id: string;
  nome: string;
  banco?: string | null;
  ativa?: boolean;
}

export default function ConciliacaoAvancada() {
  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [contaId, setContaId] = useState("todas");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("contas_financeiras")
      .select("id, nome, banco, ativa")
      .order("nome")
      .then(({ data, error }) => {
        if (!ativo) return;
        if (!error && data) setContas(data as ContaFinanceira[]);
        setCarregando(false);
      });
    return () => { ativo = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6 text-primary" /> Conciliação Bancária
        </h2>
        <p className="text-sm text-muted-foreground">Cruzamento entre extrato bancário e os títulos do Financeiro</p>
      </div>

      <Card className="border-amber-300 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-5 h-5" /> Conciliação bancária ainda não configurada
          </CardTitle>
          <CardDescription>
            Não existe importação de extrato (OFX/CSV) nem vínculo de conciliação funcionando no projeto.
            Esta tela não exibe dados fictícios: enquanto a integração bancária não for configurada,
            nenhuma conciliação é apresentada como real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Conta Financeira</Label>
              <Select value={contaId} onValueChange={setContaId}>
                <SelectTrigger className="h-9"><Landmark className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as contas</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}{c.banco ? ` (${c.banco})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {carregando && <p className="text-[10px] text-muted-foreground">Carregando contas...</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Período Inicial</Label>
              <Input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Período Final</Label>
              <Input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4" />
            Importação OFX/CSV e processamento do retorno serão habilitados quando a integração bancária existir (evolução futura).
          </div>
          <Button disabled title="Importação ainda não configurada">
            <Calendar className="w-4 h-4 mr-2" /> Importar Extrato (OFX/CSV) — indisponível
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
