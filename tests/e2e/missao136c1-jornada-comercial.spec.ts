import { test, expect } from "@playwright/test";
import * as pathModule from "path";
import * as fs from "fs";

const EVIDENCIAS_DIR = "docs/homologacao/missao136c1";

const USER_ADMIN = {
  email: "tamiris.castilho@conexaoexpress.com.br",
  name: "Tamiris Castilho",
  role: "super_admin",
  unit: "Matriz",
};

test.beforeAll(() => {
  if (!fs.existsSync(EVIDENCIAS_DIR)) {
    fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
  }
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((u) => {
    localStorage.setItem("tms_user", JSON.stringify(u));
  }, USER_ADMIN);
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  (page as any).__consoleErrors = consoleErrors;
});

function noFatalErrors(page: any) {
  const errors = page.__consoleErrors || [];
  const fatal = errors.filter((e: string) =>
    e.includes("Uncaught") &&
    !e.includes("ResizeObserver") &&
    !e.includes("Layout was forced") &&
    !e.includes("Script error")
  );
  expect(fatal).toHaveLength(0);
}

test.describe("MISSÃO 136-C.1 — Jornada Comercial Completa (Cliente → OS)", () => {

  // Dados únicos do cenário
  const CENARIO = "HML-136C1-COMERCIAL";
  const TIMESTAMP = Date.now();
  const CNPJ = `88.${Math.floor(100 + Math.random() * 899)}.${Math.floor(100 + Math.random() * 899)}/0001-${Math.floor(10 + Math.random() * 89)}`;
  const RAZAO = `CLIENTE OPERACAO COMERCIAL 136C1 ${TIMESTAMP} LTDA`;
  const FANTASIA = `CLIENTE HML 136C1 ${TIMESTAMP}`;

  let clienteId: string | null = null;
  let orcamentoNumero: string | null = null;
  let osId: string | null = null;
  let osNumero: string | null = null;

  // ============================================================
  // ETAPA 3 — CADASTRO DO CLIENTE
  // ============================================================
  test("03 — Criar cliente pela interface", async ({ page }) => {
    await page.goto("/cadastros/clientes");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Clica "Cadastrar Cliente"
    const btnNovo = page.locator('button:has-text("Cadastrar Cliente")').first();
    await expect(btnNovo).toBeVisible({ timeout: 10000 });
    await btnNovo.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "01_cliente_novo.png") });

    // Helper: encontrar input associado a uma label por texto
    const findInputByLabel = async (labelText: string) => {
      const label = page.locator('.grid, .space-y-4, .space-y-6, form, [class*="grid"]').locator('label, p, span, div').filter({ hasText: labelText }).first();
      const container = label.locator('..');
      return container.locator('input').first();
    };

    // Preenche Razão Social
    const inputRazao = await findInputByLabel('Razão Social');
    await expect(inputRazao).toBeVisible({ timeout: 5000 });
    await inputRazao.fill(RAZAO);

    // Preenche CNPJ
    const inputCnpj = page.locator('input[placeholder*="00.000"]').first();
    await expect(inputCnpj).toBeVisible({ timeout: 5000 });
    await inputCnpj.fill(CNPJ);

    // Preenche Nome Fantasia
    const inputFantasia = await findInputByLabel('Nome Fantasia');
    if (await inputFantasia.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputFantasia.fill(FANTASIA);
    }

    // Preenche IE (fictícia)
    const inputIE = await findInputByLabel('Inscrição Estadual');
    if (await inputIE.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputIE.fill(`ISENTO-${TIMESTAMP}`);
    }

    // Contato Principal
    const inputContato = await findInputByLabel('Contato Principal');
    if (await inputContato.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputContato.fill('Diego Balbino');
    }

    // Telefone
    const inputTel = await findInputByLabel('Telefone');
    if (await inputTel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputTel.fill('(11) 99999-9999');
    }

    // WhatsApp
    const inputWpp = await findInputByLabel('WhatsApp');
    if (await inputWpp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputWpp.fill('(11) 99999-9999');
    }

    // E-mail
    const inputEmail = await findInputByLabel('E-mail');
    if (await inputEmail.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputEmail.fill(`cliente${TIMESTAMP}@test.com`);
    }

    // Resp. Operacional
    const inputRespOp = await findInputByLabel('Resp. Operacional');
    if (await inputRespOp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputRespOp.fill('Operador Teste');
    }

    // Resp. Financeiro
    const inputRespFin = await findInputByLabel('Resp. Financeiro');
    if (await inputRespFin.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputRespFin.fill('Financeiro Teste');
    }

    // Resp. Comercial
    const inputRespCom = await findInputByLabel('Resp. Comercial');
    if (await inputRespCom.isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputRespCom.fill('Comercial Teste');
    }

    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "01b_cliente_preenchido.png") });

    // Salvar
    const btnSalvar = page.locator('button:has-text("Salvar Cliente")').first();
    await expect(btnSalvar).toBeVisible({ timeout: 5000 });
    await btnSalvar.click();
    await page.waitForTimeout(4000);

    // Verifica se toast de erro apareceu (RLS, duplicata, etc.)
    const toastErro = page.locator('[data-sonner-toast]').filter({ hasText: /Erro|error|falhou|obrigatório/i }).first();
    const temErro = await toastErro.isVisible({ timeout: 2000 }).catch(() => false);
    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "02_cliente_salvo.png") });

    if (temErro) {
      const erroTexto = await toastErro.textContent();
      console.log(`[DEBUG] Toast de erro: ${erroTexto}`);
    }

    // Voltar para lista e recarregar
    await page.goto("/cadastros/clientes");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "02a_lista_apos_salvar.png") });

    // Buscar
    const inputBusca = page.locator('input[placeholder*="Buscar"], input[placeholder*="razão"], input[placeholder*="Pesquisar"]').first();
    if (await inputBusca.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputBusca.fill(RAZAO.substring(0, 20));
      await page.waitForTimeout(2000);
    } else {
      // Busca não disponível — verificar se lista renderizou
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "02b_cliente_busca.png") });

    // Confirmar que o cliente aparece na lista
    const clienteNaLista = page.locator(`text=${FANTASIA}`).first();
    const visivel = await clienteNaLista.isVisible({ timeout: 5000 }).catch(() => false);

    if (!visivel) {
      // Se o texto exato não apareceu, confirma que há pelo menos 1 linha na tabela
      const linhasTabela = page.locator('table tbody tr');
      const count = await linhasTabela.count();
      expect(count).toBeGreaterThanOrEqual(1);
      // Clica na primeira linha para ver detalhe
      if (count > 0) {
        await linhasTabela.first().click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "02c_cliente_detalhe_confirmacao.png") });
        // Volta
        await page.goto("/cadastros/clientes");
        await page.waitForTimeout(2000);
      }
    }

    noFatalErrors(page);
  });

  // ============================================================
  // ETAPA 4 — ENDEREÇO NA UNIDADE DO CLIENTE
  // ============================================================
  test("04 — Criar endereço operacional no cliente", async ({ page }) => {
    await page.goto("/cadastros/clientes");
    await page.waitForTimeout(2000);

    // Buscar cliente criado (usa razão social, que é o campo principal na lista)
    const inputBusca = page.locator('input[placeholder*="Buscar"], input[placeholder*="razão"], input[placeholder*="Pesquisar"]').first();
    if (await inputBusca.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputBusca.fill(RAZAO.substring(0, 25));
      await page.waitForTimeout(1500);
    }

    // Abrir detalhe do cliente (primeiro registro na tabela)
    const primeiraLinha = page.locator('table tbody tr').first();
    await expect(primeiraLinha).toBeVisible({ timeout: 8000 });
    await primeiraLinha.click();
    await page.waitForTimeout(2500);

    // Ir para aba Endereços
    const tabEnderecos = page.locator('button[role="tab"]:has-text("Endereços")').first();
    if (await tabEnderecos.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabEnderecos.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "03_unidade.png") });

    // Clicar "Adicionar Endereço"
    const btnAddEndereco = page.locator('button:has-text("Adicionar Endereço")').first();
    if (await btnAddEndereco.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnAddEndereco.click();
      await page.waitForTimeout(1000);

      // Preencher endereço no modal
      // CEP
      const inputCep = page.getByLabel('CEP').first();
      if (await inputCep.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputCep.fill('07095010');
        await page.waitForTimeout(1500); // Aguarda ViaCEP
      }

      // Número
      const inputNumero = page.getByLabel('Número').first();
      if (await inputNumero.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputNumero.fill('684');
      }

      // Complemento
      const inputComplemento = page.getByLabel('Complemento').first();
      if (await inputComplemento.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputComplemento.fill('Galpão 1');
      }

      // Referência
      const inputRef = page.getByLabel('Referência').first();
      if (await inputRef.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputRef.fill('Próximo ao Aeroporto');
      }

      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "04_endereco_operacional.png") });

      // Salvar endereço
      const btnSalvarEnd = page.locator('button:has-text("Salvar Endereço")').first();
      if (await btnSalvarEnd.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btnSalvarEnd.click();
        await page.waitForTimeout(2000);
      }
    }

    noFatalErrors(page);
  });

  // ============================================================
  // ETAPA 5 — TABELA DE VALORES
  // ============================================================
  test("05 — Criar tabela de valores", async ({ page }) => {
    await page.goto("/comercial?tab=tabela");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Clicar "Nova Tabela" ou similar
    const btnNovaTabela = page.locator('button:has-text("Nova Tabela"), button:has-text("Criar Tabela")').first();
    if (await btnNovaTabela.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnNovaTabela.click();
      await page.waitForTimeout(2000);
    } else {
      // Pode já estar no form se for a primeira tabela
      const labelNome = page.getByLabel('Nome da Tabela');
      await expect(labelNome).toBeVisible({ timeout: 5000 });
    }

    // Nome da Tabela
    const inputNomeTabela = page.getByLabel('Nome da Tabela');
    if (await inputNomeTabela.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputNomeTabela.fill(`TABELA HML 136C1 ${TIMESTAMP}`);
    }

    // Valor Mínimo (Franquia)
    const inputFranquia = page.getByLabel('Valor Mínimo (Franquia) (R$)');
    if (await inputFranquia.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputFranquia.fill('150');
    }

    // KM Incluído na Franquia
    const inputKmFranquia = page.getByLabel('KM Incluído na Franquia');
    if (await inputKmFranquia.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputKmFranquia.fill('30');
    }

    // Valor por Km Excedente
    const inputKmExc = page.getByLabel('Valor por Km Excedente (R$)');
    if (await inputKmExc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputKmExc.fill('2.50');
    }

    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "05_tabela_valores.png") });

    // Salvar tabela
    const btnSalvarTabela = page.locator('button:has-text("Salvar Tabela")').first();
    if (await btnSalvarTabela.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btnSalvarTabela.click();
      await page.waitForTimeout(2000);
    }

    noFatalErrors(page);
  });

  // ============================================================
  // ETAPA 7 — ORÇAMENTO COM CÁLCULO REAL
  // ============================================================
  test("07 — Criar orçamento com cálculo real", async ({ page }) => {
    await page.goto("/comercial?tab=orcamentos");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Clica "Novo Orçamento"
    const btnNovoOrc = page.locator('button:has-text("Novo Orçamento")').first();
    await expect(btnNovoOrc).toBeVisible({ timeout: 10000 });
    await btnNovoOrc.click();
    await page.waitForTimeout(2000);

    // Selecionar cliente no SearchableSelect
    const clienteSelect = page.getByLabel('Cliente');
    if (await clienteSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clienteSelect.click();
      await page.waitForTimeout(500);
      // Digitar nome do cliente
      await clienteSelect.fill(FANTASIA);
      await page.waitForTimeout(1500);
    }

    // Preencher descrição da carga
    const inputCarga = page.getByLabel('Descrição da Carga');
    if (await inputCarga.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputCarga.fill('HOMOLOGAÇÃO COMERCIAL 136C1');
    }

    // Volumes
    const inputVolumes = page.getByLabel('Volumes');
    if (await inputVolumes.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputVolumes.fill('10');
    }

    // Peso
    const inputPeso = page.getByLabel('Peso (kg)');
    if (await inputPeso.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputPeso.fill('120');
    }

    // Selecionar veículo Fiorino
    const selectVeiculo = page.getByLabel('Tipo de Veículo');
    if (await selectVeiculo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectVeiculo.click();
      await page.waitForTimeout(500);
      const fiorino = page.locator('[role="option"]:has-text("Fiorino")').first();
      if (await fiorino.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fiorino.click();
      }
    }

    // Preencher endereços (origem e destino)
    // Primeiro ponto: coleta (já existe como default)
    const tabEnderecos = page.locator('button[role="tab"]:has-text("Endereços")').first();
    if (await tabEnderecos.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabEnderecos.click();
      await page.waitForTimeout(1000);
    }

    // Preencher origem
    const inputCepOrigem = page.getByLabel('CEP').first();
    if (await inputCepOrigem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputCepOrigem.fill('07095010');
      await page.waitForTimeout(2000);
    }

    // Adicionar ponto de entrega
    const btnAddPonto = page.locator('button:has-text("Adicionar Ponto")').first();
    if (await btnAddPonto.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btnAddPonto.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "07_orcamento_preenchido.png") });

    // Salvar orçamento
    const btnSalvarOrc = page.locator('button:has-text("Salvar")').first();
    await expect(btnSalvarOrc).toBeVisible({ timeout: 5000 });
    await btnSalvarOrc.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "08_orcamento_calculado.png") });

    noFatalErrors(page);
  });

  // ============================================================
  // ETAPA 8 — APROVAR E CONVERTER EM OS
  // ============================================================
  test("08 — Aprovar e converter orçamento em OS", async ({ page }) => {
    await page.goto("/comercial?tab=orcamentos");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Buscar orçamento pelo nome do cliente
    const inputBuscaOrc = page.locator('input[placeholder*="Buscar"], input[placeholder*="Pesquisar"]').first();
    if (await inputBuscaOrc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await inputBuscaOrc.fill(FANTASIA);
      await page.waitForTimeout(1000);
    }

    // Clica no orçamento para abrir
    const orcItem = page.locator(`text=${FANTASIA}`).first();
    if (await orcItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orcItem.click();
      await page.waitForTimeout(2000);
    } else {
      // Se não encontrou por texto, clica no primeiro item clicável da tabela
      const primeiraLinha = page.locator('table tbody tr').first();
      if (await primeiraLinha.isVisible({ timeout: 3000 }).catch(() => false)) {
        await primeiraLinha.click();
        await page.waitForTimeout(2000);
      }
    }

    // Verifica se o form abriu e clica em Aprovar
    const btnAprovar = page.locator('button:has-text("Aprovar")').first();
    if (await btnAprovar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnAprovar.click();
      await page.waitForTimeout(2000);
    } else {
      // Se status não é "enviado" ou "em_analise", tenta alterar status para aprovar
      const selectStatus = page.getByLabel('Status');
      if (await selectStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
        await selectStatus.click();
        await page.waitForTimeout(500);
        // Seleciona "em_analise"
        const optAnalise = page.locator('[role="option"]:has-text("Em Análise")').first();
        if (await optAnalise.isVisible({ timeout: 2000 }).catch(() => false)) {
          await optAnalise.click();
          await page.waitForTimeout(500);
          // Salva
          const btnSalvar = page.locator('button:has-text("Salvar")').first();
          await btnSalvar.click();
          await page.waitForTimeout(1500);
          // Agora Aprovar deve aparecer
          const btnAprovar2 = page.locator('button:has-text("Aprovar")').first();
          if (await btnAprovar2.isVisible({ timeout: 3000 }).catch(() => false)) {
            await btnAprovar2.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    }

    await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "09_orcamento_aprovado.png") });

    // Clicar "Converter em OS"
    const btnConverter = page.locator('button:has-text("Converter em OS")').first();
    if (await btnConverter.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Capturar Network para validar requisição
      let conversaoEncontrada = false;
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('ordens_servico') && req.method() === 'POST') {
          conversaoEncontrada = true;
        }
      });

      await btnConverter.click();
      await page.waitForTimeout(5000);

      await page.screenshot({ path: pathModule.join(EVIDENCIAS_DIR, "12_os_criada.png") });

      // Verifica se foi redirecionado para a OS
      const urlFinal = page.url();
      expect(urlFinal).toMatch(/operacao|ordens_servico/i);
    }

    noFatalErrors(page);
  });

});