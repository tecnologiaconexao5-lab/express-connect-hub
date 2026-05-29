import { useState, useEffect, useMemo, useCallback } from 'react'
import { Truck, MapPin, Clock, Star, Shield, RotateCcw, Search, Users, CheckCircle, Bookmark, BookmarkCheck, Filter, Send, ArrowRightFromLine, Pencil } from 'lucide-react'
import { enterpriseKanbanService } from './enterpriseKanbanService'
import type { EnterpriseCandidate, DisponibilidadeTipo, ReservaContexto } from './enterpriseKanbanTypes'
import { cn } from '../../utils/cn'
import { ContextoReservaModal } from './ContextoReservaModal'
import { toast } from 'sonner'

const DISP_LABEL: Record<DisponibilidadeTipo, string> = {
  imediata: 'Imediata',
  parcial: 'Parcial',
  indisponivel: 'Indisponível',
}

const DISP_COLOR: Record<DisponibilidadeTipo, string> = {
  imediata: 'text-emerald-400 bg-emerald-500/10',
  parcial: 'text-amber-400 bg-amber-500/10',
  indisponivel: 'text-zinc-400 bg-zinc-500/10',
}

export function PrestadoresAptos() {
  const [aptos, setAptos] = useState<EnterpriseCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroRegiao, setFiltroRegiao] = useState('')
  const [filtroVeiculo, setFiltroVeiculo] = useState('')
  const [filtroDisp, setFiltroDisp] = useState<DisponibilidadeTipo | ''>('')
  const [soPreSelecionados, setSoPreSelecionados] = useState(false)
  const [soEnviadosEscala, setSoEnviadosEscala] = useState(false)
  const [contextoModalId, setContextoModalId] = useState<string | null>(null)
  const [contextoModalData, setContextoModalData] = useState<ReservaContexto | undefined>(undefined)

  const carregar = useCallback(async () => {
    const list = await enterpriseKanbanService.listarPrestadoresAptos()
    setAptos(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abrirContexto = useCallback((candidate: EnterpriseCandidate) => {
    setContextoModalId(candidate.id)
    setContextoModalData(candidate.reservaContexto)
  }, [])

  const toggleEnviarEscala = useCallback(async (candidate: EnterpriseCandidate) => {
    const isEnviado = candidate.tags.includes('enviadoEscala' as any)
    const novasTags = isEnviado
      ? candidate.tags.filter(t => t !== 'enviadoEscala')
      : [...candidate.tags, 'enviadoEscala' as any]

    try {
      await enterpriseKanbanService.atualizar(candidate.id, { tags: novasTags } as any)
      setAptos(prev => prev.map(c =>
        c.id === candidate.id ? { ...c, tags: novasTags } : c
      ))
      await enterpriseKanbanService.registrarEvento(candidate.id, {
        tipo: 'observacao_adicionada',
        descricao: isEnviado
          ? 'Removido da shortlist operacional (Escala)'
          : 'Enviado para shortlist operacional (Escala)',
        data: new Date().toISOString(),
      })
      toast.success(isEnviado ? 'Removido da Escala' : 'Enviado para Escala')
    } catch {
      toast.error('Erro ao enviar para Escala')
    }
  }, [])

  const togglePreSelecao = useCallback(async (candidate: EnterpriseCandidate) => {
    const isPre = candidate.tags.includes('preSelecionado')
    const novasTags = isPre
      ? candidate.tags.filter(t => t !== 'preSelecionado')
      : [...candidate.tags, 'preSelecionado' as any]

    try {
      await enterpriseKanbanService.atualizar(candidate.id, { tags: novasTags } as any)
      setAptos(prev => prev.map(c =>
        c.id === candidate.id ? { ...c, tags: novasTags } : c
      ))
      toast.success(isPre ? 'Pré-seleção removida' : 'Prestador pré-selecionado')
    } catch {
      toast.error('Erro ao alterar pré-seleção')
    }
  }, [])

  const filtrados = useMemo(() => {
    let list = aptos
    if (soPreSelecionados) {
      list = list.filter(c => c.tags.includes('preSelecionado' as any))
    }
    if (soEnviadosEscala) {
      list = list.filter(c => c.tags.includes('enviadoEscala' as any))
    }
    if (filtroRegiao) {
      const q = filtroRegiao.toLowerCase()
      list = list.filter(c =>
        c.cidade.toLowerCase().includes(q) ||
        c.uf.toLowerCase().includes(q) ||
        c.regioesAtuacao.some(r => r.toLowerCase().includes(q))
      )
    }
    if (filtroVeiculo) {
      const q = filtroVeiculo.toLowerCase()
      list = list.filter(c => c.veiculo.toLowerCase().includes(q))
    }
    if (filtroDisp) {
      list = list.filter(c => c.disponibilidadeTipo === filtroDisp)
    }
    return list
  }, [aptos, soPreSelecionados, soEnviadosEscala, filtroRegiao, filtroVeiculo, filtroDisp])

  const preCount = aptos.filter(c => c.tags.includes('preSelecionado' as any)).length
  const escalaCount = aptos.filter(c => c.tags.includes('enviadoEscala' as any)).length
  const temFiltro = soPreSelecionados || soEnviadosEscala || filtroRegiao || filtroVeiculo || filtroDisp

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">{aptos.length} aptos</span>
        </div>
        {preCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <BookmarkCheck className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-violet-400">{preCount} pré-selecionados</span>
          </div>
        )}
        <button
          onClick={() => setSoPreSelecionados(!soPreSelecionados)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            soPreSelecionados
              ? 'bg-violet-500/15 text-violet-400 border-violet-500/30'
              : 'text-muted-foreground/40 border-border/30 hover:text-muted-foreground/60 hover:border-border/60',
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          {soPreSelecionados ? 'Mostrando pré-selecionados' : 'Pré-selecionados'}
        </button>
        <button
          onClick={() => setSoEnviadosEscala(!soEnviadosEscala)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            soEnviadosEscala
              ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
              : 'text-muted-foreground/40 border-border/30 hover:text-muted-foreground/60 hover:border-border/60',
          )}
        >
          <Send className="w-3.5 h-3.5" />
          {soEnviadosEscala ? 'Mostrando reservas' : 'Reservas Escala'}
          {escalaCount > 0 && !soEnviadosEscala && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          )}
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              value={filtroRegiao}
              onChange={e => setFiltroRegiao(e.target.value)}
              placeholder="Região..."
              className="w-28 pl-7 pr-2 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
            />
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              value={filtroVeiculo}
              onChange={e => setFiltroVeiculo(e.target.value)}
              placeholder="Veículo..."
              className="w-28 pl-7 pr-2 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40"
            />
          </div>
          <select
            value={filtroDisp}
            onChange={e => setFiltroDisp(e.target.value as DisponibilidadeTipo | '')}
            className="w-28 h-7 rounded-lg border border-border/40 bg-muted/20 px-2 text-xs text-foreground focus:outline-none focus:border-primary/40"
          >
            <option value="">Disponibilidade</option>
            <option value="imediata">Imediata</option>
            <option value="parcial">Parcial</option>
          </select>
          {temFiltro && (
            <button
              onClick={() => { setSoPreSelecionados(false); setSoEnviadosEscala(false); setFiltroRegiao(''); setFiltroVeiculo(''); setFiltroDisp('') }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-muted-foreground/40 hover:text-foreground hover:bg-muted/50"
            >
              <RotateCcw className="w-3 h-3" /> Limpar
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse h-28 rounded-xl bg-muted/30 border border-border/40" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground/50">
            {aptos.length === 0 ? 'Nenhum prestador apto disponível' : 'Nenhum resultado para os filtros atuais'}
          </p>
          {aptos.length === 0 && (
            <p className="text-xs text-muted-foreground/30 mt-1">
              Prestadores com documentação completa e status operacional "apto" aparecerão aqui.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtrados.map(candidate => (
            <div
              key={candidate.id}
              className="rounded-xl border border-border/50 bg-card hover:border-emerald-500/30 hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-200 p-4 space-y-3 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden ring-2 ring-border/40 bg-muted shrink-0">
                  <img src={candidate.foto} alt={candidate.nome} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{candidate.nome}</p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 mt-0.5">
                    <Truck className="w-3 h-3 shrink-0" />
                    <span className="truncate">{candidate.veiculo}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="font-mono text-[10px]">{candidate.placa}</span>
                  </div>
                </div>
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border',
                    candidate.score >= 75 ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/15' :
                    candidate.score >= 55 ? 'text-amber-400 border-amber-500/25 bg-amber-500/15' :
                    'text-rose-400 border-rose-500/25 bg-rose-500/15'
                  )}
                >
                  <Star className="w-2.5 h-2.5 fill-current" />
                  {candidate.score}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground/60 bg-muted/30">
                  <MapPin className="w-3 h-3" />
                  {candidate.cidade}, {candidate.uf}
                </span>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium', DISP_COLOR[candidate.disponibilidadeTipo])}>
                  <Clock className="w-3 h-3" />
                  {DISP_LABEL[candidate.disponibilidadeTipo]}
                </span>
                {candidate.regioesAtuacao.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-blue-400 bg-blue-500/10">
                    <MapPin className="w-3 h-3" />
                    {candidate.regioesAtuacao.join(', ')}
                  </span>
                )}
              </div>

              {candidate.horariosDisponiveis && (
                <p className="text-[10px] text-muted-foreground/40">
                  Horários: {candidate.horariosDisponiveis}
                  {candidate.diasDisponiveis.length > 0 && ` · Dias: ${candidate.diasDisponiveis.join('-')}`}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1 border-t border-border/20">
                <button
                  onClick={() => togglePreSelecao(candidate)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                    candidate.tags.includes('preSelecionado' as any)
                      ? 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25'
                      : 'bg-muted/20 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  {candidate.tags.includes('preSelecionado' as any) ? (
                    <><BookmarkCheck className="w-3.5 h-3.5" /> Pré-selecionado</>
                  ) : (
                    <><Bookmark className="w-3.5 h-3.5" /> Pré-selecionar</>
                  )}
                </button>
                <button
                  onClick={() => toggleEnviarEscala(candidate)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                    candidate.tags.includes('enviadoEscala' as any)
                      ? 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25'
                      : 'bg-muted/20 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  {candidate.tags.includes('enviadoEscala' as any) ? (
                    <><ArrowRightFromLine className="w-3.5 h-3.5" /> Remover da Escala</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> Enviar para Escala</>
                  )}
                </button>
                {candidate.tags.includes('preSelecionado' as any) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20">
                    <BookmarkCheck className="w-3 h-3" />
                    Pré-selecionado
                  </span>
                )}
                {candidate.tags.includes('enviadoEscala' as any) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20">
                    <Send className="w-3 h-3" />
                    Enviado para Escala
                  </span>
                )}
                {candidate.tags.includes('enviadoEscala' as any) && (
                  <button
                    onClick={() => abrirContexto(candidate)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-all ml-auto"
                    title="Editar contexto"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              {candidate.tags.includes('enviadoEscala' as any) && candidate.reservaContexto && (
                <div className="pt-1 space-y-1">
                  {candidate.reservaContexto.cliente && (
                    <p className="text-[10px] text-muted-foreground/50">
                      <span className="font-medium text-muted-foreground/70">Reservado para:</span> {candidate.reservaContexto.cliente}
                      {candidate.reservaContexto.operacao && ` · ${candidate.reservaContexto.operacao}`}
                    </p>
                  )}
                  {candidate.reservaContexto.regiao && (
                    <p className="text-[10px] text-muted-foreground/50">
                      <span className="font-medium text-muted-foreground/70">Região:</span> {candidate.reservaContexto.regiao}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium',
                      candidate.reservaContexto.prioridade === 'alta' ? 'text-rose-400 bg-rose-500/10' :
                      candidate.reservaContexto.prioridade === 'media' ? 'text-amber-400 bg-amber-500/10' :
                      'text-blue-400 bg-blue-500/10',
                    )}>
                      {candidate.reservaContexto.prioridade === 'alta' ? 'Alta prioridade' :
                       candidate.reservaContexto.prioridade === 'media' ? 'Média prioridade' :
                       'Baixa prioridade'}
                    </span>
                    {candidate.reservaContexto.observacao && (
                      <span className="text-[9px] text-muted-foreground/40 truncate max-w-[200px]">
                        {candidate.reservaContexto.observacao}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {contextoModalId && (
        <ContextoReservaModal
          candidateId={contextoModalId}
          contextoAtual={contextoModalData}
          open={true}
          onClose={() => setContextoModalId(null)}
          onSave={() => carregar()}
        />
      )}
    </div>
  )
}
