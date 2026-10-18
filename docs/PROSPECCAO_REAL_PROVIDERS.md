# Prospeccao Real com Providers Plugaveis

## Arquitetura

Antes (Missao 36 original):
```
IA (LLM) "inventa" empresas → Enriquecimento → Score → Lead
           ↑
     Sem origem real
```

Agora (Missao 37):
```
Provider Manual    ─┐
Provider Mock      ─┤
Provider WebSearch ─┤  → Pipeline → Normalizacao → Anti-duplicidade
Provider GoogleMaps─┤                          ↓
Provider Catalogos ─┤                    Enriquecimento IA
Provider Social    ─┘                          ↓
                                              Score
                                                ↓
                                    Supervisor IA → Lead no CRM
                                                ↓
                                          Origem rastreavel
```

## Providers Disponiveis

| Provider | ID | Tipo | Confianca | Requer Chave | Requer Acao Manual |
|----------|----|------|-----------|-------------|-------------------|
| Insercao Manual | manual | Entrada direta | Alta | Nao | Sim |
| Mock (Simulado) | mock | Homologacao | Simulada | Nao | Nao |
| Busca Web | web_search | API | Media | Sim (SerpAPI/Google CSE) | Nao |
| Google Maps | google_maps | API | Alta | Sim (Places API) | Nao |
| Catalogos | catalogo | Sugestao | Media | Nao | Sim |
| Redes Sociais | social_assistido | Assistido | Media | Nao | Sim |

## Fluxo de Execucao

1. Hunter carrega config do tenant
2. Pipeline executa providers na ordem de prioridade configurada
3. Cada provider retorna ProspectBruto[] com origem rastreavel
4. Pipeline filtra prospects invalidos (empresa/cidade/estado vazios)
5. Pipeline valida origem (anti-invencao)
6. Hunter aplica anti-duplicidade
7. Hunter enriquece com IA (sugere dados faltantes)
8. Hunter aplica score
9. Supervisor IA valida potencial
10. Lead criado no CRM apenas se origem identificavel
