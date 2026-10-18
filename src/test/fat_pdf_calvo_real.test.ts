import { describe, it, expect, vi, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ============================================================================
// FATURA REAL — cliente CALVO (modelo "calvo")
//
// Prova os dois ajustes do documento destinado ao CLIENTE:
//  • FATURA-CLIENTE-01: "Nº Conexão" e "Nº Cliente" NÃO aparecem no PDF;
//  • FATURA-CLIENTE-02: o endereço REAL do cliente (aba Endereços →
//    `enderecos_clientes`, via `enderecoCompleto`) é renderizado.
//
// O client anon do app não lê `faturas`/`clientes`/`enderecos_clientes`
// (RLS devolve 0 linhas), então o módulo "@/lib/supabase" é substituído por
// um adapter somente-LEITURA sobre o PostgreSQL real (DATABASE_URL).
// Nenhuma escrita acontece: a cadeia inteira gera apenas SELECTs.
//
// Fluxo exercitado é o MESMO da tela:
//   buscarFaturaComItens → buscarClienteParaFatura (enderecos_clientes)
//   → buscarDadosEmpresaParaFatura → montarInputPdfFatura → gerarPDFFatura
// ============================================================================

vi.mock("@/lib/supabase", async () => {
  const { criarSupabasePgAdapter } = await import("./helpers/supabasePgAdapter");
  return { supabase: criarSupabasePgAdapter() };
});

import { supabase } from "@/lib/supabase";
import {
  buscarFaturaComItens,
  buscarClienteParaFatura,
  buscarDadosEmpresaParaFatura,
  montarInputPdfFatura,
} from "@/services/financeiro/faturaService";
import type { FaturaComItens } from "@/services/financeiro/faturaService";
import { gerarPDFFatura } from "@/utils/pdfFatura";
import { fecharPool } from "./helpers/supabasePgAdapter";

const OUT_DIR = path.join(process.cwd(), "test-results", "fat-pdf-calvo");
const OUT_PDF = path.join(OUT_DIR, "fatura_real_calvo.pdf");

const brl = (v: number) =>
  (v || 0)
    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    .replace(/\u00a0/g, " ");

/** Remove os bytes de codificação 0x00 que o jsPDF usa como alta ordem por glifo. */
  const textoDoPdf = (buf: Buffer) => buf.toString("latin1").split("\u0000").join("");

async function ler(tabela: string, col: string, valor: unknown) {
  const { data, error } = await supabase.from(tabela).select("*").eq(col, valor);
  if (error) throw new Error(`${tabela}: ${error.message}`);
  return data as Record<string, unknown>[];
}

afterAll(async () => {
  await fecharPool();
});

describe("FATURA REAL — cliente CALVO (modelo calvo)", () => {
  it(
    "gera o PDF real sem 'Nº Conexão'/'Nº Cliente' e com o endereço cadastrado do cliente",
    async () => {
      // ── 1. localiza a fatura do cliente Calvo ──────────────────────────────
      const { data: faturas, error } = await supabase
        .from("faturas")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(300);
      expect(error, `leitura de faturas falhou: ${error?.message}`).toBeNull();
      expect(faturas?.length, "nenhuma fatura legível (DATABASE_URL/RLS?)").toBeGreaterThan(0);

      const alvo =
        (faturas as unknown as Record<string, unknown>[]).find((f) => f.numero === "FAT-2026-000014") ||
        (faturas as unknown as Record<string, unknown>[]).find(
          (f) => f.status === "emitida" && (f.metadata as { modelo?: string } | null)?.modelo === "calvo"
        );
      expect(alvo, "FAT-2026-000014 (ou fatura Calvo emitida) não encontrada").toBeTruthy();

      const detalhe = (await buscarFaturaComItens(String(alvo!.id))) as FaturaComItens | null;
      expect(detalhe, "buscarFaturaComItens retornou null").toBeTruthy();
      expect(detalhe!.itens.length, "fatura sem itens").toBeGreaterThan(0);
      expect(detalhe!.modelo, "modelo da fatura não é 'calvo'").toBe("calvo");

      const clienteId = String(detalhe!.cliente_id);

      // ── 2. snapshot (prova de que NADA é alterado — somente leitura) ───────
      const antes = JSON.stringify({
        cliente: await ler("clientes", "id", clienteId),
        enderecos: await ler("enderecos_clientes", "cliente_id", clienteId),
        fatura: await ler("faturas", "id", detalhe!.id),
      });

      // ── 3. mesmas chamadas da tela ─────────────────────────────────────────
      const cliente = await buscarClienteParaFatura(clienteId);
      expect(cliente, "buscarClienteParaFatura retornou null").toBeTruthy();
      expect(cliente!.razaoSocial).toMatch(/calvo/i);
      // caso real: cadastro sem logradouro → SÓ o enderecos_clientes resolve
      expect(cliente!.enderecoCompleto, "enderecoCompleto vazio (enderecos_clientes?)").toBeTruthy();
      expect(cliente!.enderecoCompleto).toContain("Jamil");
      expect(cliente!.enderecoCompleto).toContain("07143-000");
      expect(cliente!.enderecoCompleto).toContain("Guarulhos");

      const empresa = await buscarDadosEmpresaParaFatura();
      const input = montarInputPdfFatura(detalhe!, empresa, cliente);
      expect(input.modelo).toBe("calvo");
      expect(input.dadosCliente?.enderecoCompleto).toBe(cliente!.enderecoCompleto);

      // ── 4. gera o PDF real ─────────────────────────────────────────────────
      const doc = await gerarPDFFatura(input);
      const buf = Buffer.from(doc.output("arraybuffer"));
      expect(buf.length, "PDF muito pequeno").toBeGreaterThan(5000);
      if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(OUT_PDF, buf);
      const texto = textoDoPdf(buf);

      // ── FATURA-CLIENTE-01 — números internos NÃO no documento ─────────────
      expect(texto).not.toContain("Nº Conexão");
      expect(texto).not.toContain("Nº Cliente");
      expect(texto).not.toContain("Nº Conexão:");
      expect(texto).not.toMatch(/Nº Cliente:/);

      // ── FATURA-CLIENTE-02 — endereço REAL do cliente ──────────────────────
      expect(texto).toContain(`Cobrança para: ${cliente!.razaoSocial}`);
      expect(texto).toContain("Jamil");
      expect(texto).toContain("684");
      expect(texto).toContain("07143-000");
      expect(texto).toContain("Guarulhos/SP");
      expect(texto).toContain("Rua Jamil João Zarif, 684");

      // ── restante do documento intacto ─────────────────────────────────────
      expect(texto).toContain(String(detalhe!.numero)); // FAT-2026-000014
      expect(texto).toContain("FATURA");
      expect(texto).toContain("DESCRIÇÃO");
      expect(texto).toContain("PARCELA");
      expect(texto).toContain("VENCIMENTO");
      expect(texto).toContain("VALOR");
      expect(texto).toContain("CNPJ:");
      expect(texto).toContain("IE:");
      expect(texto).toContain(brl(input.total));
      expect(texto).toContain("Dados para Transferência Bancária");
      expect(texto).toContain(`Fatura ${String(detalhe!.numero)} - Conexão Express`);
      expect(texto).toContain("Conexão Express");
      // autotable quebra células longas em várias linhas → checa um trecho curto
      const descItem = String(detalhe!.itens[0].descricao || detalhe!.itens[0].romaneio || "").trim();
      const trechoItem = descItem.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
      if (trechoItem) expect(texto).toContain(trechoItem);

      // ── 5. prova de que NENHUM dado foi alterado ───────────────────────────
      const depois = JSON.stringify({
        cliente: await ler("clientes", "id", clienteId),
        enderecos: await ler("enderecos_clientes", "cliente_id", clienteId),
        fatura: await ler("faturas", "id", detalhe!.id),
      });
      expect(depois).toBe(antes);

      console.log("[FAT-PDF-CALVO] PDF real gerado em:", OUT_PDF, "| bytes:", buf.length);
      console.log("[FAT-PDF-CALVO] fatura:", String(detalhe!.numero), "| modelo:", input.modelo);
      console.log("[FAT-PDF-CALVO] enderecoCompleto:", cliente!.enderecoCompleto);
      console.log("[FAT-PDF-CALVO] endereco (cadastro):", cliente!.endereco || "(vazio)");
      console.log("[FAT-PDF-CALVO] total:", brl(input.total), "| itens:", input.itens.length);
    },
    120000
  );
});
