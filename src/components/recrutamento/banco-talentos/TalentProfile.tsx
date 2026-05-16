import { motion } from "framer-motion";
import { X, MapPin, Truck, Star, Clock, FileText, Heart, Phone, Mail, Award, Shield, TrendingUp, Package, CheckCircle2, AlertTriangle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTalentBankStore } from "@/stores/talentBankStore";
import ScoreGauge, { ScoreBreakdownBar } from "@/components/onboarding/ScoreGauge";
import { calculateScore } from "@/services/scoreEngine";

const NIVEL_STYLES = { diamante: "text-cyan-600 bg-cyan-50 border-cyan-200", ouro: "text-yellow-600 bg-yellow-50 border-yellow-200", prata: "text-slate-500 bg-slate-100 border-slate-200", bronze: "text-amber-800 bg-amber-100 border-amber-200" };

interface TalentProfileProps {
  onClose: () => void;
}

export default function TalentProfile({ onClose }: TalentProfileProps) {
  const { talentos, talentoAtivo, toggleFavorito, adicionarTagPersonalizada, shortlists, adicionarTalentShortlist } = useTalentBankStore();
  const t = talentos.find((t) => t.id === talentoAtivo);

  if (!t) return (
    <div className="h-full flex items-center justify-center p-4">
      <p className="text-sm text-muted-foreground">Selecione um talento</p>
    </div>
  );

  const scoreCalc = calculateScore({
    nome: t.nome, cpf: t.cpf, selfieUrl: null, cnhUrl: null,
    tipoVeiculo: t.veiculo.tipo, modelo: t.veiculo.modelo, placa: t.veiculo.placa, ano: t.veiculo.ano.toString(), capacidade: t.veiculo.capacidade, fotosVeiculo: [],
    crlvUrl: null, comprovanteUrl: null, anttUrl: null, moppUrl: null, seguroUrl: null, chavePix: "", banco: "",
    regioes: t.regioesAtuacao, horariosInicio: t.horarios.inicio, horariosFim: t.horarios.fim, tipoCarga: t.cargaPreferida[0] || "",
    tipoViagem: t.perfisOperacionais.includes("viagem") ? ["Interestadual"] : ["Municipal"],
    fazColeta: t.fazColeta, fazEntrega: t.fazEntrega, distanciaMaxima: t.distanciaMaxima.toString(),
    documentValidations: t.documentos.reduce((acc, d) => ({ ...acc, [d.tipo.toLowerCase()]: { approved: d.status === "aprovado", confidence: d.status === "aprovado" ? 85 : 30 } }), {}),
    stepsCompleted: [t.statusDocumental !== "pendente", true, true, true, true],
    isComplete: t.statusDocumental === "completo",
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted ring-2 ring-primary/20">
              <img src={t.foto} alt="" className="w-full h-full object-cover" />
            </div>
            <div className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-background", t.disponivel ? "bg-green-500" : "bg-muted-foreground")} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{t.nome}</p>
            <p className="text-[10px] text-muted-foreground">{t.veiculo.tipo} · {t.veiculo.placa}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => toggleFavorito(t.id)} className={cn("w-7 h-7 rounded-lg flex items-center justify-center", t.favorito ? "text-red-500" : "text-muted-foreground hover:bg-muted")}>
            <Heart className={cn("w-3.5 h-3.5", t.favorito && "fill-current")} />
          </button>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-4">
          <ScoreGauge score={scoreCalc} size="sm" />
          <div className="flex-1 space-y-2">
            <ScoreBreakdownBar label="Documentação" value={Math.round(scoreCalc.breakdown.documentacao)} max={25} color={scoreCalc.color} />
            <ScoreBreakdownBar label="Experiência" value={Math.round(scoreCalc.breakdown.experiencia)} max={15} color={scoreCalc.color} />
            <ScoreBreakdownBar label="Região" value={Math.round(scoreCalc.breakdown.regiao)} max={15} color={scoreCalc.color} />
            <ScoreBreakdownBar label="Disponibilidade" value={Math.round(scoreCalc.breakdown.disponibilidade)} max={15} color={scoreCalc.color} />
            <ScoreBreakdownBar label="Veículo" value={Math.round(scoreCalc.breakdown.veiculo)} max={15} color={scoreCalc.color} />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Informações</p>
          <InfoRow icon={User} label="Telefone" value={t.telefone} />
          <InfoRow icon={Mail} label="Email" value={t.email} />
          <InfoRow icon={Calendar} label="Cadastro" value={new Date(t.dataCadastro).toLocaleDateString("pt-BR")} />
          <InfoRow icon={MapPin} label="Localização" value={`${t.cidade}, ${t.bairro} — ${t.regiao}, ${t.estado}`} />
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Veículo</p>
          <InfoRow icon={Truck} label="Tipo" value={t.veiculo.tipo} />
          <InfoRow icon={Truck} label="Modelo" value={t.veiculo.modelo} />
          <InfoRow icon={Shield} label="Placa" value={t.veiculo.placa} />
          <InfoRow icon={Award} label="Ano" value={t.veiculo.ano.toString()} />
          <InfoRow icon={Package} label="Capacidade" value={t.veiculo.capacidade} />
          <InfoRow icon={Truck} label="Carroceria" value={t.veiculo.carroceria} />
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Documentos</p>
          {t.documentos.map((doc) => (
            <div key={doc.tipo} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {doc.status === "aprovado" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                <span className="text-xs text-foreground">{doc.tipo}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded", doc.status === "aprovado" ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50")}>
                  {doc.status === "aprovado" ? "OK" : doc.status === "pendente" ? "Pendente" : "Expirado"}
                </span>
                <span className="text-[9px] text-muted-foreground">vence {new Date(doc.vencimento).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Performance</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Viagens", value: t.totalViagens, icon: Truck },
              { label: "Taxa Aceite", value: `${t.taxaAceite}%`, icon: TrendingUp },
              { label: "Experiência", value: `${t.experienciaAnos} anos`, icon: Clock },
              { label: "Compatibilidade", value: `${t.scoreCompatibilidade}%`, icon: Star },
            ].map((m) => (
              <div key={m.label} className="p-2.5 rounded-lg bg-muted/30">
                <div className="flex items-center gap-1.5 text-xs">
                  <m.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="font-bold text-foreground">{m.value}</span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {t.tagsAutomaticas.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-primary/10 text-primary border border-primary/20">{tag.replace("_", " ")}</span>
            ))}
            {t.tagsPersonalizadas.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-purple-50 text-purple-700 border border-purple-200">{tag}</span>
            ))}
            <button onClick={() => { const tag = prompt("Nova tag:"); if (tag) adicionarTagPersonalizada(t.id, tag); }} className="px-2 py-0.5 rounded-full text-[9px] font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40">
              + Tag
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Adicionar à Shortlist</p>
          <div className="space-y-1.5">
            {shortlists.map((sl) => (
              <button key={sl.id} onClick={() => adicionarTalentShortlist(sl.id, t.id)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sl.cor }} />
                <span className="text-foreground">{sl.nome}</span>
                <span className="text-muted-foreground ml-auto">{sl.talentos.length} talentos</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
