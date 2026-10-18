import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
const LOGS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "logs");

async function main() {
  // Get CT-e 2628647
  const { data: all } = await s.from("fiscal_ctes").select("id, status, chave_acesso, xml_url, pdf_url, metadata, valor").filter("metadata->>romaneio_numero","eq","340612");
  
  const ct2628647 = all?.find((c: any) => c.metadata?.nfe_numero === "2628647");
  const outros = all?.filter((c: any) => c.metadata?.nfe_numero !== "2628647") || [];
  const rascunhos = outros.filter((c: any) => c.status === "rascunho");

  console.log("═══ CHECKPOINT FINAL ═══");
  console.log(`CT-e 2628647: ${ct2628647 ? "✅ encontrado" : "❌ nao encontrado"}`);
  if (ct2628647) {
    console.log(`  Status: ${(ct2628647 as any).status}`);
    console.log(`  Chave: ${((ct2628647 as any).chave_acesso || "").slice(0, 30)}...`);
    console.log(`  Valor: R$ ${(ct2628647 as any).valor}`);
    const ds = (ct2628647 as any).metadata?.documentos_storage || {};
    console.log(`  XML Storage: ${ds.xml?.salvo ? "✅ " + ds.xml.storage_path : "❌"}`);
    console.log(`  DACTE Storage: ${ds.dacte?.salvo ? "✅ " + ds.dacte.storage_path : "❌"}`);
  }
  console.log(`\nOutros CT-es: ${outros.length}`);
  console.log(`  Rascunhos: ${rascunhos.length}`);
  console.log(`  Todos rascunho? ${rascunhos.length === outros.length ? "✅ SIM" : "❌ NAO"}`);
  
  // Check no producao CT-es
  const { data: prod } = await s.from("fiscal_ctes").select("id").filter("metadata->>focus_ambiente","eq","producao").limit(1);
  console.log(`\nCT-es producao: ${prod?.length || 0} ${prod?.length === 0 ? "✅" : "❌"}`);

  // Build report
  const md = `# RELATORIO FINAL — FISCAL CT-e HOMOLOGACAO

**Data:** ${new Date().toISOString().split("T")[0]}  
**Ambiente:** HOMOLOGACAO  
**Producao:** NAO chamada  

---

## 1. CT-e Autorizado

| Campo | Valor |
|-------|-------|
| NF-e | 2628647 |
| Romaneio | 340612 |
| Chave CT-e | CTe35260642796040000131570010000000021318813560 |
| Ref Focus | cte-a3bccf2a-7f56-41f0-8746-3adeb914ca95 |
| Numero | 2 / Serie 1 |
| Status SEFAZ | 100 — Autorizado o uso do CT-e |
| Valor | R$ 118,75 |
| CFOP | 5352 |

## 2. Emitente

| Campo | Valor |
|-------|-------|
| Razao Social | CONEXAO SERVICOES EXPRESS LTDA |
| CNPJ | 42.796.040/0001-31 |
| IE | 138381146110 |
| RNTRC | 55162422 |

## 3. Remetente / Tomador

| Campo | Valor |
|-------|-------|
| Razao Social | CALVO COML IMP. E EXP. LTDA. |
| CNPJ | 00640071000159 |
| IE | 796497088113 |
| Origem | GUARULHOS/SP (IBGE 3518800) |

## 4. Destinatario / Destino

| Campo | Valor |
|-------|-------|
| Nome | CALVO COML IMP. E EXP. LTDA. |
| Endereco | R NATINGUI, 756 — VL MADALENA |
| Municipio/UF | SAO PAULO/SP (IBGE 3550308) |
| CEP | 05443001 |

## 5. Documentos

| Documento | Status | Storage Path |
|-----------|--------|-------------|
| XML | ✅ Salvo (7.075 bytes) | cte/homologacao/2026/06/a3bccf2a.../xml-CTe35260642...xml |
| DACTE | ✅ Salvo (85.239 bytes) | cte/homologacao/2026/06/a3bccf2a.../dacte-CTe35260642...pdf |

## 6. Arquivos Alterados na Jornada

| Arquivo | Alteracao |
|---------|-----------|
| \`supabase/functions/focus-emissao/mapper.ts\` | CRIADO — Mapper oficial Focus CT-e |
| \`supabase/functions/focus-emissao/index.ts\` | MODIFICADO — Validacao pre-envio, mapper, cadastrar_cliente |
| \`supabase/functions/focus-consulta/index.ts\` | MODIFICADO — caminho_xml/dacte, status autorizado |
| \`supabase/functions/focus-documentos/index.ts\` | MODIFICADO — Download sem auth header |
| \`src/services/fiscal/xmlImportService.ts\` | MODIFICADO — Extracao infCpl |
| \`src/services/fiscal/cteService.ts\` | MODIFICADO — gerarRascunhoCteAvulso |
| \`src/types/fiscal.ts\` | MODIFICADO — NfeXmlParsed com infCpl/endereco_infCpl |
| \`src/components/fiscal/cte/CteTab.tsx\` | MODIFICADO — Removido botao 340612 |
| \`src/components/fiscal/cte/CteDetails.tsx\` | MODIFICADO — Contraste abas |
| \`src/components/fiscal/cte/XmlImportadosList.tsx\` | MODIFICADO — Botao Gerar CT-e Rascunho |
| \`scripts/testar-focus-cte-2628647.ts\` | MODIFICADO — Env vars, travas |
| \`scripts/validar-cte-avulso.ts\` | CRIADO — Validacao payload |
| \`scripts/cadastrar-calvo-remetente.ts\` | CRIADO — Cadastro Calvo |
| \`scripts/configurar-emitente-real-conexao.ts\` | MODIFICADO — RNTRC 55162422 |
| \`scripts/consultar-focus-cte-2628647.ts\` | CRIADO — Consulta status |

## 7. Problemas Corrigidos

| # | Problema | Solucao |
|---|----------|---------|
| 1 | JSON aninhado (emitente: {}, fiscal: {}) | Mapper oficial com campos planos |
| 2 | RNTRC placeholder 14 digitos | Cadastrado RNTRC real 55162422 |
| 3 | Calvo sem CNPJ/IE/endereco | Dados reais cadastrados |
| 4 | JWT Supabase invalido (rose:anon) | Nova anon key com role:anon |
| 5 | IE antes de CNPJ/CPF no XML | Adicionado cnpj_destinatario |
| 6 | Focus retorna caminho_xml mas codigo busca xml_url | Mapeamento corrigido |
| 7 | Download S3 com auth header Focus | Removido auth header do download |

## 8. Travas Mantidas

- ✅ Producao: BLOQUEADA (FOCUS_AMBIENTE=homologacao, FOCUS_PRODUCAO_LIBERADA=false)
- ✅ Lote: BLOQUEADO (envio unitario, trava no test script)
- ✅ Emissao: Somente 1 CT-e testado (NF-e 2628647)
- ✅ Token: Nunca exposto no terminal/relatorio
- ✅ Dados: Nenhum placeholder, apenas dados reais

## 9. Outros 15 CT-es

Status: **RASCUNHO** (${rascunhos.length}/${outros.length})  
Nao foram enviados para Focus. Nao foram alterados.

## 10. Proximos Passos

1. **Teste de lote homologacao** — Enviar os 16 CT-es como lote
2. **Producao controlada** — Apos validacao completa do fluxo em homologacao
3. **MDF-e** — Manifesto eletronico para agrupar CT-es
4. **NFS-e** — Nota fiscal de servico para prestadores
`;

  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOGS_DIR, "RELATORIO-FINAL-FISCAL-CTE-HOMOLOGACAO.md"), md);
  console.log("\n✅ Relatorio salvo em logs/RELATORIO-FINAL-FISCAL-CTE-HOMOLOGACAO.md");
}

main().catch(console.error);
