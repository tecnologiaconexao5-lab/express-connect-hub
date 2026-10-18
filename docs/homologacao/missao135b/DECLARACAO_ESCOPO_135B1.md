# MISSÃO 135-B.1 — DECLARAÇÃO OBRIGATÓRIA DE ESCOPO

## PROJETO
TMS / Portal do Cliente / Supabase.

## MÓDULO
Implantação e homologação real da conversão Pedido → OS.

## ARQUIVOS PREVISTOS
Nenhum arquivo funcional novo. Poderão ser alterados apenas:
- migration da missão (se houver erro real de aplicação)
- testes SQL
- testes Playwright
- documentação
- scripts de homologação
- arquivos de evidência

## IMPACTO NO TMS
OS gerada pelo Portal aparece no fluxo oficial do TMS.

## IMPACTO NO PORTAL DO CLIENTE
Pedido mostra status e vínculo com a OS.

## IMPACTO NO APP PRESTADOR
Nenhum código Flutter alterado.

## RISCO
- migration não aplicada
- diferenças entre schema local e remoto
- RLS
- UUIDs
- duplicidade de OS
- evento duplicado
- OS parcial
- teste de homologação interferir em dados existentes
