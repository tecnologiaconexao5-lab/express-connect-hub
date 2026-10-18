import { useState } from "react";
import { motion } from "framer-motion";
import { User, Truck, MapPin, Clock, LogOut, CreditCard, ChevronRight, ImageOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalPrestadorStore } from "@/stores/portalPrestadorStore";
import ScoreGauge, { ScoreBreakdownBar } from "@/components/onboarding/ScoreGauge";
import { Button } from "@/components/ui/button";

export default function PerfilTab() {
  const { perfil, score, loading, disponivel, toggleDisponivel } = usePortalPrestadorStore();
  const [fotoErro, setFotoErro] = useState(false);

  if (loading && !perfil.nome) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-primary/20 bg-muted flex items-center justify-center">
            {fotoErro || !perfil.foto ? (
              <User className="w-6 h-6 text-muted-foreground" />
            ) : (
              <img src={perfil.foto} alt={perfil.nome} className="w-full h-full object-cover" onError={() => setFotoErro(true)} />
            )}
          </div>
          <div className={cn("absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center", disponivel ? "bg-green-500" : "bg-muted-foreground")}>
            <div className={cn("w-2 h-2 rounded-full", disponivel ? "bg-white" : "bg-background")} />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-foreground">{perfil.nome || "Prestador"}</p>
          <p className="text-xs text-muted-foreground">{perfil.email || "Sem e-mail cadastrado"}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", score?.classification === "Diamante" ? "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30" : score?.classification === "Ouro" ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30" : score?.classification === "Prata" ? "bg-slate-100 text-slate-700 border-slate-200" : "bg-amber-100 text-amber-800 border-amber-200")}>
              {score?.classification || "Bronze"}
            </span>
            <span className="text-[10px] text-muted-foreground">Score {score?.total || 0}</span>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-center mb-4">
          {score ? <ScoreGauge score={score} size="md" /> : <div className="w-32 h-32 rounded-full bg-muted animate-pulse" />}
        </div>
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detalhamento</p>
          <ScoreBreakdownBar label="Documentação" value={Math.round(score?.breakdown?.documentacao || 0)} max={25} color={score?.color || "#cd7f32"} />
          <ScoreBreakdownBar label="Experiência" value={Math.round(score?.breakdown?.experiencia || 0)} max={15} color={score?.color || "#cd7f32"} />
          <ScoreBreakdownBar label="Região" value={Math.round(score?.breakdown?.regiao || 0)} max={15} color={score?.color || "#cd7f32"} />
          <ScoreBreakdownBar label="Disponibilidade" value={Math.round(score?.breakdown?.disponibilidade || 0)} max={15} color={score?.color || "#cd7f32"} />
          <ScoreBreakdownBar label="Veículo" value={Math.round(score?.breakdown?.veiculo || 0)} max={15} color={score?.color || "#cd7f32"} />
          <ScoreBreakdownBar label="Histórico" value={Math.round(score?.breakdown?.historico || 0)} max={10} color={score?.color || "#cd7f32"} />
          <ScoreBreakdownBar label="Perfil Operacional" value={Math.round(score?.breakdown?.perfilOperacional || 0)} max={5} color={score?.color || "#cd7f32"} />
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Disponibilidade
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Status</span>
            <button onClick={toggleDisponivel} className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all", disponivel ? "bg-green-100 text-green-700 dark:bg-green-900/30" : "bg-muted text-muted-foreground")}>
              {disponivel ? "Disponível" : "Indisponível"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Horários</span>
            <span className="text-sm text-muted-foreground">{perfil.horariosInicio || "N/I"} — {perfil.horariosFim || "N/I"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Regiões</span>
            <span className="text-sm text-muted-foreground">{perfil.regioes.length} regiões</span>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" />
          Veículos
        </h3>
        {perfil.veiculos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum veículo cadastrado</p>
        ) : (
          <div className="space-y-2">
            {perfil.veiculos.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <div>
                  <p className="text-sm font-medium text-foreground">{v.modelo}</p>
                  <p className="text-xs text-muted-foreground">{v.placa} · {v.ano} · {v.tipo}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl border border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          Dados Bancários
        </h3>
        {!perfil.dadosBancarios.banco && !perfil.dadosBancarios.pix ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado bancário cadastrado</p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Banco</span>
              <span className="text-foreground font-medium">{perfil.dadosBancarios.banco || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agência</span>
              <span className="text-foreground font-medium">{perfil.dadosBancarios.agencia || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Conta</span>
              <span className="text-foreground font-medium">{perfil.dadosBancarios.conta || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">PIX</span>
              <span className="text-foreground font-medium text-xs">{perfil.dadosBancarios.pix || "-"}</span>
            </div>
          </div>
        )}
      </div>

      <Button variant="outline" className="w-full gap-2 rounded-xl h-12 text-sm text-destructive border-destructive/30 hover:bg-destructive/10">
        <LogOut className="w-4 h-4" />
        Sair do Portal
      </Button>
    </div>
  );
}
