import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, RadialBarChart, RadialBar, Line, Legend
} from 'recharts'
import {
  Users, UserCheck, Clock, AlertTriangle, Target, TrendingUp,
  CheckCircle2, Ban, Truck, MapPin, FileText,
  Shield, Activity, Award, Search,
  Thermometer, Bell, UserX, Car, ChevronRight,
  BarChart3, Layers
} from 'lucide-react'
import { useDashboardRecrutamento, type DashboardData } from '../hooks/useDashboardRecrutamento'
import { PageHeader } from '../components/design-system/PageHeader'
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent, PremiumCardFooter } from '../components/design-system/PremiumCard'
import { PremiumBadge } from '../components/design-system/PremiumBadge'
import { SkeletonCard } from '../components/design-system/SkeletonCard'
import { cn } from '../utils/cn'

const CORES = ['#F97316', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#6366F1', '#84CC16']
const CORES_PIE = ['#F97316', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B']
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtN = (v: number) => v.toLocaleString('pt-BR')
const fmtP = (v: number) => `${v.toFixed(1)}%`

const ttStyle = {
  backgroundColor: 'hsl(var(--card))',
  borderColor: 'hsl(var(--border))',
  color: 'hsl(var(--foreground))',
  borderRadius: '8px',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
}

type IconComponent = React.ComponentType<{ className?: string }>

function KpiCard({ title, value, icon: Icon, subtitle, trend, accent, onClick }: {
  title: string; value: string; icon: IconComponent; subtitle?: string; trend?: { value: number; label: string }; accent?: string; onClick?: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={cn(
        'relative rounded-xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm transition-all duration-300',
        'hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5',
        onClick && 'cursor-pointer'
      )}
    >
      <div className={cn('absolute top-0 left-0 right-0 h-0.5 rounded-t-xl', accent || 'bg-primary/40')} />
      <div className="flex items-start justify-between mb-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{value}</span>
        {subtitle && <p className="text-xs text-muted-foreground/60">{subtitle}</p>}
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/40">
          <TrendingUp className={cn('w-3 h-3', trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400')} />
          <span className={cn('text-xs font-medium', trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-muted-foreground/50">{trend.label}</span>
        </div>
      )}
    </motion.div>
  )
}

function AlertaBadge({ variant, children }: { variant: 'critical' | 'warning' | 'info'; children: React.ReactNode }) {
  const styles = {
    critical: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium', styles[variant])}>
      <span className={cn('w-1.5 h-1.5 rounded-full', variant === 'critical' ? 'bg-rose-400' : variant === 'warning' ? 'bg-amber-400' : 'bg-blue-400')} />
      {children}
    </span>
  )
}

function FiltrosBar({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Search className="w-4 h-4" />
        <span className="font-medium text-foreground">Filtros</span>
      </div>
      <div className="h-4 w-px bg-border/50" />
      <span className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full border border-border/30">
        {fmtN(data.kpis.totalCandidatos)} candidatos
      </span>
      <span className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full border border-border/30">
        {fmtN(data.kpis.totalPrestadores)} prestadores
      </span>
      <span className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full border border-border/30">
        {fmtN(data.kpis.totalVeiculos)} veículos
      </span>
      <span className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-full border border-border/30">
        {fmtN(data.kpis.totalOperacoes)} operações
      </span>
      <div className="ml-auto flex items-center gap-2">
        <PremiumBadge variant="success" dot size="sm">Tempo real</PremiumBadge>
      </div>
    </div>
  )
}

function AlertaCard({ icon: Icon, label, value, variant, onClick }: {
  icon: IconComponent; label: string; value: string; variant: 'critical' | 'warning' | 'info'; onClick?: () => void
}) {
  const variantStyles = {
    critical: 'border-l-rose-500/50 bg-rose-500/5',
    warning: 'border-l-amber-500/50 bg-amber-500/5',
    info: 'border-l-blue-500/50 bg-blue-500/5',
  }
  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-border/40 border-l-2 transition-all cursor-pointer hover:bg-muted/20',
        variantStyles[variant]
      )}
    >
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        variant === 'critical' ? 'bg-rose-500/10 text-rose-400' :
        variant === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
      <AlertaBadge variant={variant}>{variant}</AlertaBadge>
    </motion.div>
  )
}

function CustomTooltip({ active, payload, label, formatter }: {
  active?: boolean; payload?: Array<{ value: number; name: string; color: string; payload: Record<string, unknown>; dataKey: string | number }>; label?: string; formatter?: (v: number) => string
}) {
  if (!active || !payload) return null
  return (
    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-xl text-xs" style={ttStyle}>
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium text-foreground">{formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardRecrutamento() {
  const { data, loading, error } = useDashboardRecrutamento()
  const [selectedChart, setSelectedChart] = useState<string | null>(null)

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={<Activity className="w-5 h-5 text-primary" />}
          title="Dashboard de Recrutamento"
          description="Visão executiva do ecossistema de gestão de prestadores"
        />
        <PremiumCard className="border-rose-500/30 bg-rose-500/5">
          <PremiumCardContent className="flex items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
            <div>
              <p className="font-semibold text-foreground">Erro ao carregar dados</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </PremiumCardContent>
        </PremiumCard>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={<Activity className="w-5 h-5 text-primary" />}
          title="Dashboard de Recrutamento"
          description="Visão executiva do ecossistema de gestão de prestadores"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard lines={8} />
          <SkeletonCard lines={8} />
        </div>
      </div>
    )
  }

  const { kpis } = data

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Activity className="w-5 h-5 text-primary" />}
        title="Dashboard de Recrutamento"
        description="Visão executiva em tempo real — recrutamento inteligente de prestadores"
      />

      <FiltrosBar data={data} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard title="Candidatos Ativos" value={fmtN(kpis.candidatosAtivos)} icon={Users} subtitle={`${fmtN(kpis.totalCandidatos)} total`} trend={{ value: 12, label: 'vs mês anterior' }} accent="bg-blue-500/60" />
        <KpiCard title="Aprovados" value={fmtN(kpis.aprovados)} icon={CheckCircle2} subtitle={`${fmtP(kpis.taxaConversao)} conversão`} trend={{ value: 8, label: 'vs mês anterior' }} accent="bg-emerald-500/60" />
        <KpiCard title="Pendências" value={fmtN(kpis.pendentes)} icon={Clock} subtitle="aguardando análise" accent="bg-amber-500/60" />
        <KpiCard title="Bloqueados" value={fmtN(kpis.bloqueados)} icon={Ban} subtitle="reprovados no processo" accent="bg-rose-500/60" />
        <KpiCard title="Tempo Médio Aprovação" value={`${kpis.tempoMedioAprovacao}d`} icon={Clock} subtitle="dias em média" trend={{ value: -5, label: 'redução' }} accent="bg-violet-500/60" />
        <KpiCard title="Score Médio" value={fmtN(kpis.scoreMedio)} icon={Award} subtitle="pontos" trend={{ value: 3, label: 'melhora' }} accent="bg-cyan-500/60" />
        <KpiCard title="Retenção" value={fmtP(kpis.retencao)} icon={Shield} subtitle="prestadores ativos" trend={{ value: 2, label: 'estabilidade' }} accent="bg-emerald-500/60" />
        <KpiCard title="Taxa Conversão" value={fmtP(kpis.taxaConversao)} icon={Target} subtitle="aprovados / total" trend={{ value: 5, label: 'crescimento' }} accent="bg-orange-500/60" />
        <KpiCard title="Regiões Críticas" value={fmtN(kpis.regioesCriticas)} icon={MapPin} subtitle="sem cobertura" accent="bg-rose-500/60" />
        <KpiCard title="Veículos Disponíveis" value={fmtN(kpis.veiculosDisponiveis)} icon={Truck} subtitle={`${fmtN(kpis.totalVeiculos)} frota total`} trend={{ value: 10, label: 'disponibilidade' }} accent="bg-blue-500/60" />
        <KpiCard title="Operações sem Cobertura" value={fmtN(kpis.operacoesSemCobertura)} icon={AlertTriangle} subtitle="demanda não atendida" accent="bg-rose-500/60" />
        <KpiCard title="Prestadores" value={fmtN(kpis.totalPrestadores)} icon={UserCheck} subtitle={`${kpis.candidatosAtivos} em processo`} trend={{ value: 15, label: 'crescimento' }} accent="bg-primary/60" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <PremiumCard className="xl:col-span-2">
          <PremiumCardHeader>
            <PremiumCardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Evolução do Recrutamento
            </PremiumCardTitle>
            <PremiumBadge variant="info" dot size="sm">12 meses</PremiumBadge>
          </PremiumCardHeader>
          <PremiumCardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.evolucaoRecrutamento}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="candidatos" name="Candidatos" fill={CORES[0]} radius={[2, 2, 0, 0]} />
                <Bar dataKey="aprovados" name="Aprovados" fill={CORES[2]} radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="pendentes" name="Pendentes" stroke={CORES[3]} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </PremiumCardContent>
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Alertas Inteligentes
            </PremiumCardTitle>
            <PremiumBadge variant={data.alertas.cnhVencendo > 0 ? 'danger' : 'success'} dot size="sm">
              {data.alertas.cnhVencendo > 0 ? `${data.alertas.cnhVencendo} críticos` : 'ok'}
            </PremiumBadge>
          </PremiumCardHeader>
          <PremiumCardContent className="space-y-2">
            <AlertaCard icon={FileText} label="CNH vencendo" value={`${data.alertas.cnhVencendo} prestadores`} variant="critical" />
            <AlertaCard icon={Users} label="Excesso de demanda" value={`${data.alertas.excessoDemanda} vagas sem cobertura`} variant="warning" />
            <AlertaCard icon={Car} label="Falta de veículos" value={`${data.alertas.faltaVeiculos} veículos necessários`} variant="warning" />
            <AlertaCard icon={FileText} label="Documentos pendentes" value={`${data.alertas.documentosPendentes} documentos`} variant="info" />
            <AlertaCard icon={UserX} label="Prestadores inativos" value={`${data.alertas.prestadoresInativos} inativos`} variant="info" />
          </PremiumCardContent>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Aprovações
            </PremiumCardTitle>
          </PremiumCardHeader>
          <PremiumCardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.aprovacoes}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="valor" name="Aprovações" fill={CORES[2]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </PremiumCardContent>
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle className="text-sm flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-blue-400" />
              Distribuição Veículos
            </PremiumCardTitle>
          </PremiumCardHeader>
          <PremiumCardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data.distribuicaoVeiculos}
                  dataKey="valor"
                  nameKey="tipo"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {data.distribuicaoVeiculos.map((_, i) => (
                    <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2">
              {data.distribuicaoVeiculos.slice(0, 4).map((item, i) => (
                <span key={item.tipo} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CORES_PIE[i] }} />
                  {item.tipo}: {item.valor}
                </span>
              ))}
            </div>
          </PremiumCardContent>
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-violet-400" />
              Regiões
            </PremiumCardTitle>
          </PremiumCardHeader>
          <PremiumCardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.distribuicaoRegioes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="regiao" width={60} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="valor" name="Prestadores" radius={[0, 3, 3, 0]}>
                  {data.distribuicaoRegioes.map((_, i) => (
                    <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </PremiumCardContent>
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle className="text-sm flex items-center gap-2">
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              Score Médio
            </PremiumCardTitle>
          </PremiumCardHeader>
          <PremiumCardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="20%" outerRadius="90%"
                barSize={12}
                data={data.scoreMedioGeral.map((item, i) => ({ ...item, fill: CORES_PIE[i % CORES_PIE.length] }))}
                startAngle={180} endAngle={0}
              >
                <RadialBar dataKey="score" name="Score" cornerRadius={6} label={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, position: 'insideStart' }} />
                <Tooltip content={<CustomTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          </PremiumCardContent>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Disponibilidade Operacional
            </PremiumCardTitle>
            <PremiumBadge variant="info" dot size="sm">status</PremiumBadge>
          </PremiumCardHeader>
          <PremiumCardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.disponibilidadeOperacional}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="status" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="valor" name="Prestadores" radius={[4, 4, 0, 0]}>
                  {data.disponibilidadeOperacional.map((_, i) => (
                    <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </PremiumCardContent>
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Status Documental
            </PremiumCardTitle>
            <PremiumBadge variant={data.alertas.documentosPendentes > 0 ? 'warning' : 'success'} dot size="sm">
              {data.alertas.documentosPendentes} pendentes
            </PremiumBadge>
          </PremiumCardHeader>
          <PremiumCardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.statusDocumental}
                  dataKey="valor"
                  nameKey="status"
                  cx="50%" cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  label={({ status, valor }) => `${status}: ${valor}`}
                  labelLine={true}
                >
                  {data.statusDocumental.map((_, i) => (
                    <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </PremiumCardContent>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PremiumCard className="lg:col-span-2">
          <PremiumCardHeader>
            <PremiumCardTitle className="flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Ranking Operacional de Prestadores
            </PremiumCardTitle>
            <PremiumBadge variant="info" dot size="sm">top 15</PremiumBadge>
          </PremiumCardHeader>
          <PremiumCardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">#</th>
                    <th className="text-left py-2.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Nome</th>
                    <th className="text-left py-2.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Score</th>
                    <th className="text-left py-2.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Veículo</th>
                    <th className="text-left py-2.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Região</th>
                    <th className="text-left py-2.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Operações</th>
                    <th className="text-left py-2.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rankingPrestadores.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-2">
                        <span className={cn(
                          'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold',
                          i === 0 ? 'bg-amber-500/20 text-amber-400' :
                          i === 1 ? 'bg-zinc-400/20 text-zinc-400' :
                          i === 2 ? 'bg-orange-600/20 text-orange-600' :
                          'bg-muted/30 text-muted-foreground'
                        )}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-medium text-foreground">{p.nome}</td>
                      <td className="py-2.5 px-2">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                          p.score >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
                          p.score >= 60 ? 'bg-amber-500/15 text-amber-400' :
                          'bg-rose-500/15 text-rose-400'
                        )}>
                          {p.score}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">{p.veiculo}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{p.regiao}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{p.operacoes}</td>
                      <td className="py-2.5 px-2">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                          p.status === 'ativo' ? 'bg-emerald-500/15 text-emerald-400' :
                          p.status === 'suspenso' ? 'bg-rose-500/15 text-rose-400' :
                          p.status === 'em_triagem' ? 'bg-violet-500/15 text-violet-400' :
                          'bg-muted/30 text-muted-foreground'
                        )}>
                          {p.status === 'ativo' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {p.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCardContent>
          <PremiumCardFooter>
            <span className="text-xs text-muted-foreground/50">Baseado em score interno, volume de operações e regularidade documental</span>
          </PremiumCardFooter>
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Regiões Críticas
            </PremiumCardTitle>
            <PremiumBadge variant={data.regioesCriticasList.length > 0 ? 'danger' : 'success'} dot size="sm">
              {data.regioesCriticasList.length} críticas
            </PremiumBadge>
          </PremiumCardHeader>
          <PremiumCardContent className="space-y-2">
            {data.regioesCriticasList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400" />
                <p className="text-sm">Nenhuma região crítica</p>
                <p className="text-xs">Todas as regiões têm cobertura adequada</p>
              </div>
            ) : (
              data.regioesCriticasList.map((r, i) => (
                <motion.div
                  key={r.regiao}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-border/30 hover:bg-muted/20 transition-colors"
                >
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold',
                    r.deficit > 5 ? 'bg-rose-500/15 text-rose-400' :
                    r.deficit > 2 ? 'bg-amber-500/15 text-amber-400' :
                    'bg-blue-500/15 text-blue-400'
                  )}>
                    {r.deficit}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.regiao}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.candidatos} candidatos · {r.prestadores} prestadores · {r.vagas} vagas
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </motion.div>
              ))
            )}
          </PremiumCardContent>
          <PremiumCardFooter>
            <span className="text-xs text-muted-foreground/50">Déficit = vagas abertas sem prestador disponível</span>
          </PremiumCardFooter>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard
          icon={<UserCheck className="w-5 h-5" />}
          label="Novos Prestadores"
          value={fmtN(kpis.totalPrestadores)}
          subtitle="cadastrados no sistema"
          action="Ver todos"
          accent="bg-blue-500/10 text-blue-400"
        />
        <ActionCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Homologados"
          value={fmtN(kpis.aprovados)}
          subtitle="aprovados no processo"
          action="Ver lista"
          accent="bg-emerald-500/10 text-emerald-400"
        />
        <ActionCard
          icon={<Target className="w-5 h-5" />}
          label="Taxa de Conversão"
          value={fmtP(kpis.taxaConversao)}
          subtitle="candidatos → aprovados"
          action="Analisar funil"
          accent="bg-violet-500/10 text-violet-400"
        />
        <ActionCard
          icon={<Award className="w-5 h-5" />}
          label="Score Médio Geral"
          value={fmtN(kpis.scoreMedio)}
          subtitle="pontos"
          action="Ver ranking"
          accent="bg-amber-500/10 text-amber-400"
        />
      </div>
    </div>
  )
}

function ActionCard({ icon, label, value, subtitle, action, accent }: {
  icon: React.ReactNode; label: string; value: string; subtitle?: string; action?: string; accent?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', accent || 'bg-primary/10 text-primary')}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground/50">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <div className="flex items-center gap-1 text-xs font-medium text-primary/70 hover:text-primary transition-colors">
          {action} <ChevronRight className="w-3 h-3" />
        </div>
      )}
    </motion.div>
  )
}
