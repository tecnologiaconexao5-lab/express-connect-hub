// =============================================================================
// [NEUTRALIZADO] DevTesteTMS — era a pagina /dev-teste (Painel de Testes TMS)
// TMS-FIN-DATA-04D3B
// -----------------------------------------------------------------------------
// Esta pagina foi REMOVIDA do roteamento e do bundle (App.tsx) porque executava
// harnesses de teste (DML) contra o Supabase.
//
// SUBSTITUTOS (laboratorio, com guard fail-closed e fora do bundle):
//   scripts/lab/testeTMSCompleto.ts     -> fluxo completo TMS
//   scripts/lab/testeDocumentos.ts      -> documentos de prestadores
//   scripts/lab/executarTesteReal.js|.cjs  -> fluxo Escala → App Prestador
//   scripts/lab/testarEdgeFunction.cjs  -> Edge Function criar-alocacao-escala
//   scripts/lab/seed-relatorios.cjs     -> massa minima de relatorios
//   scripts/lab/testeMissaoOSCompleta.ts, testeM66Corrigido.ts (04D3A)
//
// Regras dos harnesses: PROD SEMPRE bloqueado; QA exige destino QA +
// ALLOW_TEST_WRITES=true.
//
// Este arquivo NAO deve conter imports de UI/serviços nem efeitos colaterais.
// =============================================================================

export default function DevTesteTMS() {
  throw new Error(
    "DevTesteTMS foi neutralizado (TMS-FIN-DATA-04D3B). Use os harnesses em scripts/lab/ com ALLOW_TEST_WRITES em QA."
  );
}
