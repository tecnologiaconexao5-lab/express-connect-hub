// ============================================================
// SHOWCASE MASTER — Ciclo de vida completo TMS (Desktop) x App (Mobile)
// ============================================================
// Duas janelas lado a lado, em velocidade humana (slowMo 1500):
//   1. Mobile  -> cadastro do motorista -> "Aguardando análise"
//   2. Desktop -> lista de cadastros pendentes -> "Aprovar Prestador"
//   3. Desktop -> OS em aberto -> "Enviar para Rede de Oportunidades"
//   4. Mobile  -> login -> aba Rede -> OS disponível -> "Aceitar"
//   5. Desktop -> Torre de Controle atualiza timeline/alerta com o aceite
//
// Execução: npm run test:master
// Backend 100% mockado — nenhum dado real é criado/alterado.
// ============================================================

import { test, expect, chromium, devices, type Browser, type Page } from "@playwright/test";

test.setTimeout(600_000);

const EMAIL_MOTORISTA = "joao.piloto.master@conexaoexpress.com.br";
const SENHA_MOTORISTA = "demo1234";
const EMAIL_OPERADOR = "operador.master@conexaoexpress.com.br";
const CANDIDATO_ID = "e2e-master-candidato";
const PRESTADOR_ID = "e2e-master-prestador";
const CLIENTE_ID = "e2e-master-cliente";
const OS_ID = "e2e-master-os-001";
const OS_NUMERO = "OS-202610-888001";
const ALOCACAO_ID = "e2e-master-aloc-001";

const MOTORISTA = {
  nome: "João Piloto E2E",
  cpf: "52998224725",
  nascimento: "1990-05-10",
  modelo: "Honda CG 160",
  placa: "ABC-1234",
  ano: "2024",
};

// Estado compartilhado entre as duas janelas (simula banco/socket).
const estado = {
  aprovado: false,
  publicada: false,
  aceita: false,
  aceiteEm: new Date().toISOString(),
  chegou: false,
  chegadaEm: new Date().toISOString(),
  concluida: false,
  conclusaoEm: new Date().toISOString(),
  fotoEntregaUrl: "",
  assinaturaUrl: "",
};

const GPS_CHECKIN = { latitude: -23.5614, longitude: -46.6559 };

const PENDING_PRESTADOR = () => ({
  id: PRESTADOR_ID,
  nome_completo: MOTORISTA.nome,
  cpf_cnpj: MOTORISTA.cpf,
  telefone: "(11) 99999-8888",
  whatsapp: "(11) 99999-8888",
  status: estado.aprovado ? "ativo" : "em_analise",
  origem_cadastro: "app_motorista",
  tipo_parceiro: "autonomo",
  regiao_principal: "Grande SP",
  data_cadastro: new Date().toISOString().slice(0, 10),
  valor_diaria: 180,
  score_interno: 86,
  liberado_app: estado.aprovado,
  veiculos: [],
  documentos: [],
  contatos_emergencia: [],
});

const OS_ABERTA = () => ({
  id: OS_ID,
  numero: OS_NUMERO,
  status: estado.concluida ? "finalizada" : estado.aceita ? "em_rota" : "pendente",
  status_operacional: estado.concluida ? "finalizada" : estado.aceita ? "em_rota" : "aguardando_aceite",
  cliente: CLIENTE_ID,
  cliente_id: CLIENTE_ID,
  prestador: estado.aceita ? PRESTADOR_ID : null,
  prestador_id: estado.aceita ? PRESTADOR_ID : null,
  veiculo_tipo: "Moto",
  tipo_carga: "seca",
  placa: MOTORISTA.placa,
  origem: "Rua Augusta, 500 - Consolação, São Paulo/SP",
  destino: "Av. Paulista, 1000 - Bela Vista, São Paulo/SP",
  distancia_km: 12.4,
  valor_cliente: 320,
  custo_prestador: 185.5,
  peso: 18,
  volumes: 1,
  data: new Date().toISOString().slice(0, 10),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  enderecos: [],
  previsao_termino: null,
});

const OPORTUNIDADE = () => ({
  id: "op-e2e-master-001",
  os_id: OS_ID,
  status: estado.aceita ? "aceita" : "publicada",
  valor_prestador: 185.5,
  veiculo_necessario: { tipo: "Moto", capacidade_kg: 30 },
  regiao: "São Paulo",
  prazo_expiracao: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  ordens_servico: {
    numero: OS_NUMERO,
    origem: "Rua Augusta, 500 - Consolação, São Paulo/SP",
    destino: "Av. Paulista, 1000 - Bela Vista, São Paulo/SP",
    distancia_km: 12.4,
    tipo_carga: "seca",
    peso: 18,
  },
});

const EVENTO_CRIACAO = {
  id: "ev-master-criacao",
  event_type: "os.ordem_servico.criada",
  entity_type: "ordem_servico",
  entity_id: OS_ID,
  entity_number: OS_NUMERO,
  status: "pendente",
  source: "tms",
  created_by: "operador",
  visibility: "public",
  payload: {
    os_numero: OS_NUMERO,
    cliente_nome: "Cliente Demo E2E",
    prestador_nome: MOTORISTA.nome,
  },
  metadata: {},
  created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  processed_at: null,
  version: 1,
  retry_count: 0,
};

function eventoAceite() {
  return {
    id: "ev-master-aceite",
    event_type: "escala.alocacao.aceita",
    entity_type: "alocacao",
    entity_id: ALOCACAO_ID,
    entity_number: OS_NUMERO,
    status: "aceita",
    source: "app_motorista",
    created_by: "joao.piloto.master",
    visibility: "public",
    payload: {
      os_numero: OS_NUMERO,
      cliente_nome: "Cliente Demo E2E",
      prestador_nome: MOTORISTA.nome,
    },
    metadata: {},
    created_at: estado.aceiteEm,
    processed_at: null,
    version: 1,
    retry_count: 0,
  };
}

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function eventoChegada() {
  return {
    id: "ev-master-chegada",
    event_type: "arrived_pickup",
    entity_type: "alocacao",
    entity_id: ALOCACAO_ID,
    entity_number: OS_NUMERO,
    status: "chegou",
    source: "app_motorista",
    created_by: "joao.piloto.master",
    visibility: "public",
    payload: {
      os_numero: OS_NUMERO,
      cliente_nome: "Cliente Demo E2E",
      prestador_nome: MOTORISTA.nome,
      etapa: "chegada",
      latitude: GPS_CHECKIN.latitude,
      longitude: GPS_CHECKIN.longitude,
    },
    metadata: { latitude: GPS_CHECKIN.latitude, longitude: GPS_CHECKIN.longitude },
    created_at: estado.chegadaEm,
    processed_at: null,
    version: 1,
    retry_count: 0,
  };
}

function eventosConclusao() {
  return [
    {
      id: "ev-master-finalizada",
      event_type: "os.ordem_servico.finalizada",
      entity_type: "ordem_servico",
      entity_id: OS_ID,
      entity_number: OS_NUMERO,
      status: "finalizada",
      source: "app_motorista",
      created_by: "joao.piloto.master",
      visibility: "public",
      payload: {
        os_numero: OS_NUMERO,
        cliente_nome: "Cliente Demo E2E",
        prestador_nome: MOTORISTA.nome,
      },
      metadata: {},
      created_at: estado.conclusaoEm,
      processed_at: null,
      version: 1,
      retry_count: 0,
    },
    {
      id: "ev-master-pod",
      event_type: "pod_sent",
      entity_type: "alocacao",
      entity_id: ALOCACAO_ID,
      entity_number: OS_NUMERO,
      status: "entregue",
      source: "app_motorista",
      created_by: "joao.piloto.master",
      visibility: "public",
      payload: {
        os_numero: OS_NUMERO,
        cliente_nome: "Cliente Demo E2E",
        prestador_nome: MOTORISTA.nome,
      },
      metadata: {},
      created_at: estado.conclusaoEm,
      processed_at: null,
      version: 1,
      retry_count: 0,
    },
  ];
}

const POSICAO_GPS = () => ({
  id: "pos-master-001",
  alocacao_id: ALOCACAO_ID,
  os_id: OS_ID,
  prestador_id: PRESTADOR_ID,
  cliente_id: CLIENTE_ID,
  latitude: GPS_CHECKIN.latitude,
  longitude: GPS_CHECKIN.longitude,
  velocidade: 0,
  precisao: 5,
  bateria: 88,
  status: "chegou",
  origem: "app_motorista",
  captured_at: estado.chegadaEm,
  created_at: estado.chegadaEm,
});

const POD_ENTREGA = () => ({
  id: "pod-master-001",
  alocacao_id: ALOCACAO_ID,
  ordem_servico_id: OS_ID,
  prestador_id: PRESTADOR_ID,
  nome_recebedor: "Recebedor App E2E",
  documento_recebedor: "12345678900",
  receiver_relationship: "Recebedor",
  observacao: "Baixa realizada pelo App do Motorista",
  foto_entrega_url: estado.fotoEntregaUrl || "https://mock.local/pod-foto.png",
  foto_canhoto_url: null,
  assinatura_url: estado.assinaturaUrl || "https://mock.local/pod-assinatura.png",
  data_hora_entrega: estado.conclusaoEm,
  latitude: GPS_CHECKIN.latitude,
  longitude: GPS_CHECKIN.longitude,
  gps_accuracy: 5,
  status: "entregue",
  created_at: estado.conclusaoEm,
});

function jwtDemo(email: string, sub: string): string {
  const agora = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub,
      email,
      role: "authenticated",
      aud: "authenticated",
      iat: agora,
      exp: agora + 3600,
    }),
  ).toString("base64url");
  return `${header}.${payload}.master-assinatura`;
}

function sessaoDemo(email: string, sub: string, nome: string) {
  return {
    access_token: jwtDemo(email, sub),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `master-refresh-${sub}`,
    user: {
      id: sub,
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { name: nome },
      created_at: new Date().toISOString(),
    },
  };
}

const TENANT_USUARIO_OPERADOR = {
  papel: "operacional",
  status: "ativo",
  tenant_id: "tenant-e2e",
  tenants: {
    id: "tenant-e2e",
    nome: "Conexão Express",
    slug: "conexao-express",
    plano: "pro",
    status: "ativo",
  },
};

const TENANT_USUARIO_MOTORISTA = {
  ...TENANT_USUARIO_OPERADOR,
  papel: "prestador",
};

async function pausa(ms = 1800) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function legenda(page: Page, lado: "DESKTOP" | "MOBILE", texto: string) {
  console.log(`\n[${lado}] ${texto}`);
  await page.evaluate(
    ({ titulo, cor, distancia }) => {
      const id = "master-legenda";
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.style.position = "fixed";
        el.style.left = "50%";
        el.style.transform = "translateX(-50%)";
        el.style.color = "#fff";
        el.style.padding = "9px 18px";
        el.style.borderRadius = "999px";
        el.style.font = "700 12px/1.4 system-ui, sans-serif";
        el.style.boxShadow = "0 8px 24px rgba(0,0,0,.35)";
        el.style.zIndex = "99999";
        el.style.pointerEvents = "none";
        el.style.maxWidth = "92vw";
        el.style.textAlign = "center";
        document.body.appendChild(el);
      }
      el.style.bottom = distancia;
      el.style.background = cor;
      el.textContent = `🎬 ${titulo}`;
    },
    {
      titulo: texto,
      cor: lado === "DESKTOP" ? "#1d4ed8" : "#047857",
      distancia: lado === "DESKTOP" ? "18px" : "84px",
    },
  );
  await pausa(1300);
}

async function marcarJanela(page: Page, texto: string, cor: string) {
  await page.evaluate(
    ({ titulo, corFundo }) => {
      const id = "master-titulo-janela";
      if (document.getElementById(id)) return;
      const el = document.createElement("div");
      el.id = id;
      el.style.position = "fixed";
      el.style.top = "0";
      el.style.left = "0";
      el.style.right = "0";
      el.style.background = corFundo;
      el.style.color = "#fff";
      el.style.padding = "4px 10px";
      el.style.font = "800 11px/1.5 system-ui, sans-serif";
      el.style.textAlign = "center";
      el.style.letterSpacing = "0.06em";
      el.style.zIndex = "99999";
      el.style.pointerEvents = "none";
      el.textContent = titulo;
      document.body.appendChild(el);
    },
    { titulo: texto, corFundo: cor },
  );
}

async function mockAuth(page: Page, email: string, sub: string, nome: string) {
  const session = sessaoDemo(email, sub, nome);
  await page.route("**/auth/v1/**", (route) => {
    const url = route.request().url();
    if (url.includes("/auth/v1/token")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
  });
}

async function mockDesktop(page: Page) {
  await mockAuth(page, EMAIL_OPERADOR, "user-master-operador", "Operador Master");

  await page.route("**/rest/v1/**", (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();
    const accept = request.headers()["accept"] || "";

    if (url.includes("/rest/v1/tenant_usuarios")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([TENANT_USUARIO_OPERADOR]),
      });
    }

    // ---------- Prestadores (cadastros pendentes) ----------
    if (url.includes("/rest/v1/prestadores")) {
      if (method === "PATCH" || method === "PUT") {
        estado.aprovado = true;
        console.log("\n[DESKTOP] PATCH prestadores -> status ativo (aprovado no mock)");
        return route.fulfill({ status: 204, body: "" });
      }
      if (method === "HEAD" || (url.includes("count=exact") && !url.includes("select=*"))) {
        const pendentes = !estado.aprovado && url.includes("origem_cadastro");
        return route.fulfill({
          status: 200,
          headers: { "content-range": pendentes ? "0-0/1" : "*/0" },
          body: "",
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([PENDING_PRESTADOR()]),
      });
    }

    if (url.includes("/rest/v1/veiculos")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    // ---------- OS / Rede de Oportunidades ----------
    if (url.includes("/rest/v1/rede_oportunidades")) {
      if (method === "POST") {
        estado.publicada = true;
        console.log("\n[DESKTOP] POST rede_oportunidades -> OS publicada na Rede");
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          headers: { "content-range": "0-0/1" },
          body: JSON.stringify(OPORTUNIDADE()),
        });
      }
      if (method === "PATCH" || method === "PUT") {
        return route.fulfill({ status: 204, body: "" });
      }
      // Verificação de oportunidade existente (maybeSingle).
      if (accept.includes("pgrst.object")) {
        if (!estado.publicada) {
          return route.fulfill({
            status: 406,
            contentType: "application/json",
            body: JSON.stringify({
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned",
              details: "Results contain 0 rows",
              hint: null,
            }),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(OPORTUNIDADE()),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(estado.publicada ? [OPORTUNIDADE()] : []),
      });
    }

    if (url.includes("/rest/v1/ordens_servico")) {
      if (method === "PATCH" || method === "PUT") {
        return route.fulfill({ status: 204, body: "" });
      }
      if (accept.includes("pgrst.object")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(OS_ABERTA()),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([OS_ABERTA()]),
      });
    }

    if (url.includes("/rest/v1/alocacoes_escala")) {
      if (method === "PATCH" || method === "PUT") {
        return route.fulfill({ status: 204, body: "" });
      }
      if (url.includes("metadata")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: ALOCACAO_ID,
            ordem_servico_id: estado.aceita ? OS_ID : null,
            prestador_id: PRESTADOR_ID,
            cliente_id: CLIENTE_ID,
            status: estado.concluida ? "concluida" : estado.aceita ? "em_rota" : "aguardando_aceite",
            finalizada: estado.concluida,
            data_finalizacao: estado.concluida ? estado.conclusaoEm : null,
            created_at: new Date().toISOString(),
          },
        ]),
      });
    }

    if (url.includes("/rest/v1/portal_tracking_realtime")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(estado.chegou ? [POSICAO_GPS()] : []),
      });
    }

    if (url.includes("/rest/v1/entregas_protocolo")) {
      if (!estado.concluida) {
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      if (accept.includes("pgrst.object")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(POD_ENTREGA()),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([POD_ENTREGA()]),
      });
    }

    if (url.includes("/rest/v1/eventos_oficiais")) {
      const eventos = [
        EVENTO_CRIACAO,
        ...(estado.aceita ? [eventoAceite()] : []),
        ...(estado.chegou ? [eventoChegada()] : []),
        ...(estado.concluida ? eventosConclusao() : []),
      ];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(eventos) });
    }

    if (url.includes("/rest/v1/clientes")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: CLIENTE_ID, nome_fantasia: "Cliente Demo E2E", razao_social: "Cliente Demo E2E LTDA" },
        ]),
      });
    }

    if (method === "POST") {
      const body = accept.includes("pgrst.object") ? { id: "mock-post" } : [{ id: "mock-post" }];
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify(body),
      });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/functions/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/storage/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

async function mockMobile(page: Page) {
  await mockAuth(page, EMAIL_MOTORISTA, "user-master-motorista", MOTORISTA.nome);

  await page.route("**/rest/v1/**", (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (url.includes("/rest/v1/tenant_usuarios")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([TENANT_USUARIO_MOTORISTA]),
      });
    }

    if (url.includes("/rest/v1/rpc/f_obter_prestador_por_auth")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ prestador_id: PRESTADOR_ID, nome_completo: MOTORISTA.nome }]),
      });
    }

    if (url.includes("/rest/v1/rede_oportunidades")) {
      if (method === "PATCH" || method === "PUT") {
        estado.aceita = true;
        estado.aceiteEm = new Date().toISOString();
        console.log("\n[MOBILE] PATCH rede_oportunidades -> aceite gravado no mock");
        return route.fulfill({ status: 204, body: "" });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify(estado.publicada ? [OPORTUNIDADE()] : []),
      });
    }

    if (url.includes("/rest/v1/portal_tracking_realtime")) {
      estado.chegou = true;
      estado.chegadaEm = new Date().toISOString();
      console.log(
        `\n[MOBILE] POST portal_tracking_realtime -> GPS ${GPS_CHECKIN.latitude}, ${GPS_CHECKIN.longitude} (check-in)`,
      );
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "pos-master-001" }),
      });
    }

    if (url.includes("/rest/v1/entregas_protocolo")) {
      estado.concluida = true;
      estado.conclusaoEm = new Date().toISOString();
      try {
        const payload = JSON.parse(request.postData() || "[]");
        const linha = Array.isArray(payload) ? payload[0] : payload;
        estado.fotoEntregaUrl = String(linha?.foto_entrega_url || "");
        estado.assinaturaUrl = String(linha?.assinatura_url || "");
      } catch {
        // payload opcional no mock
      }
      console.log("\n[MOBILE] POST entregas_protocolo -> POD (foto + assinatura) gravado");
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "pod-master-001" }),
      });
    }

    if (url.includes("/rest/v1/ordens_servico") && (method === "PATCH" || method === "PUT")) {
      estado.concluida = true;
      estado.conclusaoEm = estado.conclusaoEm || new Date().toISOString();
      console.log("\n[MOBILE] PATCH ordens_servico -> status finalizada");
      return route.fulfill({ status: 204, body: "" });
    }

    if (url.includes("/rest/v1/alocacoes_escala") && (method === "PATCH" || method === "PUT")) {
      return route.fulfill({ status: 204, body: "" });
    }

    if (url.includes("/rest/v1/prestadores")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([PENDING_PRESTADOR()]),
      });
    }

    if (method === "POST") {
      const accept = request.headers()["accept"] || "";
      const body = accept.includes("pgrst.object") ? { id: CANDIDATO_ID } : [{ id: CANDIDATO_ID }];
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify(body),
      });
    }

    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/functions/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/storage/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

async function enviarArquivo(page: Page, indice: number) {
  await page.locator('input[type="file"]').nth(indice).setInputFiles({
    name: `documento-master-${indice}.png`,
    mimeType: "image/png",
    buffer: PNG_1X1,
  });
}

async function avancarCadastro(page: Page) {
  await page.getByRole("button", { name: /Continuar/ }).click();
  await pausa(1500);
}

async function selecionarOpcao(page: Page, indice: number, opcao: string) {
  await page.getByRole("combobox").nth(indice).click();
  await pausa(800);
  await page.getByRole("option", { name: opcao, exact: true }).click();
  await pausa(800);
}

async function preencherCadastroMobile(page: Page) {
  await legenda(page, "MOBILE", "Passo 1/5 — Cadastro do motorista no App");
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Conexão Express/i }).first()).toBeVisible();
  await pausa(1200);

  await page.goto("/cadastro-prestador", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Dados Pessoais")).toBeVisible();
  await pausa(1000);

  await page.getByLabel("Nome Completo").fill(MOTORISTA.nome);
  await pausa(1000);
  await page.getByLabel("CPF").fill(MOTORISTA.cpf);
  await pausa(1000);
  await page.getByLabel("Data de Nascimento").fill(MOTORISTA.nascimento);
  await pausa(1000);
  await enviarArquivo(page, 0);
  await enviarArquivo(page, 1);
  await expect(page.locator('img[alt="Tire sua selfie"]')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('img[alt="Foto da CNH (frente)"]')).toBeVisible({ timeout: 30000 });
  await pausa(1500);
  await avancarCadastro(page);

  await expect(page.getByText("Informações do seu veículo")).toBeVisible();
  await selecionarOpcao(page, 0, "Moto");
  await page.getByLabel("Modelo").fill(MOTORISTA.modelo);
  await pausa(1000);
  await page.getByLabel("Placa").fill(MOTORISTA.placa);
  await pausa(1000);
  await page.getByLabel("Ano").fill(MOTORISTA.ano);
  await pausa(1000);
  await selecionarOpcao(page, 1, "Até 500 kg");
  await enviarArquivo(page, 0);
  await pausa(1500);
  await avancarCadastro(page);

  await expect(page.getByText("Envie seus documentos digitalizados")).toBeVisible();
  await enviarArquivo(page, 0);
  await enviarArquivo(page, 1);
  await pausa(1500);
  await page.getByLabel("Banco").fill("Banco E2E");
  await pausa(900);
  await page.getByLabel("Chave PIX").fill(MOTORISTA.cpf);
  await pausa(900);
  await avancarCadastro(page);

  await expect(page.getByText("Defina sua área e horários de atuação")).toBeVisible();
  await page.getByRole("button", { name: "Grande SP", exact: true }).click();
  await pausa(800);
  await selecionarOpcao(page, 0, "Carga Seca");
  await page.getByRole("button", { name: "Municipal", exact: true }).click();
  await pausa(1200);
  await avancarCadastro(page);

  await expect(page.getByText("Aceite os termos e assine digitalmente")).toBeVisible();
  await page.getByText("Aceito os termos da LGPD").click();
  await pausa(700);
  await page.getByText("Aceito o contrato de prestação de serviços").click();
  await pausa(700);
  await page.getByText("Aceito o termo de responsabilidade").click();
  await pausa(700);

  const canvas = page.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas de assinatura não encontrado");
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3, { steps: 20 });
  await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2, { steps: 20 });
  await page.mouse.up();
  await pausa(1200);
  await page.getByRole("button", { name: /Confirmar/ }).click();
  await expect(page.getByText("Assinatura registrada")).toBeVisible();
  await pausa(1200);

  await page.getByRole("button", { name: /Finalizar Cadastro/ }).click();
  await expect(page.getByRole("heading", { name: "Cadastro Completo!" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Aguardando análise")).toBeVisible();
  await pausa(3000);
}

test.describe("Showcase Master — ciclo completo TMS x App", () => {
  test("cadastro -> aprovação -> publicação na Rede -> aceite -> Torre", async () => {
    estado.aprovado = false;
    estado.publicada = false;
    estado.aceita = false;
    estado.aceiteEm = new Date().toISOString();
    estado.chegou = false;
    estado.chegadaEm = new Date().toISOString();
    estado.concluida = false;
    estado.conclusaoEm = new Date().toISOString();
    estado.fotoEntregaUrl = "";
    estado.assinaturaUrl = "";

    // Showcase SEMPRE visual: janelas reais abertas no Windows, lado a lado.
    const posicaoDesktop = ["--window-position=0,0", "--window-size=1000,900"];
    const posicaoMobile = ["--window-position=1000,0", "--window-size=460,900"];

    let browserDesktop: Browser | null = null;
    let browserMobile: Browser | null = null;

    try {
      browserDesktop = await chromium.launch({ headless: false, slowMo: 1500, args: posicaoDesktop });
      browserMobile = await chromium.launch({ headless: false, slowMo: 1500, args: posicaoMobile });

      const desktop = await browserDesktop.newContext({
        viewport: { width: 1440, height: 900 },
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      });
      const mobile = await browserMobile.newContext({
        ...devices["iPhone 13"],
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
        geolocation: { latitude: GPS_CHECKIN.latitude, longitude: GPS_CHECKIN.longitude },
        permissions: ["geolocation"],
      });

      const pageTms = await desktop.newPage();
      const pageApp = await mobile.newPage();

      await mockDesktop(pageTms);
      await mockMobile(pageApp);

      await marcarJanela(pageTms, "TMS DESKTOP — OPERADOR", "#1d4ed8");
      await marcarJanela(pageApp, "APP MOBILE — MOTORISTA", "#047857");

      // ============================================================
      // PASSO 1 — Mobile: cadastro completo
      // ============================================================
      await preencherCadastroMobile(pageApp);

      // ============================================================
      // PASSO 2 — Desktop: aprovar prestador
      // ============================================================
      await legenda(pageTms, "DESKTOP", "Passo 2/5 — Operador aprovando o cadastro do motorista");
      await pageTms.goto("/login", { waitUntil: "domcontentloaded" });
      await pageTms.locator('input[type="email"]').fill(EMAIL_OPERADOR);
      await pausa(900);
      await pageTms.locator('input[type="password"]').fill("demo1234");
      await pausa(900);
      await pageTms.getByRole("button", { name: /Entrar/ }).click();
      await pageTms.waitForURL(/\/operacao/, { timeout: 30000 });
      await pausa(1200);

      await pageTms.goto("/cadastros/prestadores", { waitUntil: "domcontentloaded" });
      await expect(pageTms.getByText(MOTORISTA.nome).first()).toBeVisible({ timeout: 30000 });
      await pausa(1500);
      await pageTms.getByRole("button", { name: /Aprovar Prestador/ }).click();
      await expect(pageTms.getByText(new RegExp(`${MOTORISTA.nome} aprovado`))).toBeVisible({
        timeout: 15000,
      });
      await legenda(pageTms, "DESKTOP", "Prestador aprovado — liberado para operar");
      await pausa(2500);

      // ============================================================
      // PASSO 3 — Desktop: publicar OS na Rede
      // ============================================================
      await legenda(pageTms, "DESKTOP", "Passo 3/5 — Enviando a OS em aberto para a Rede");
      await pageTms.goto("/operacao?tab=os", { waitUntil: "domcontentloaded" });
      await expect(pageTms.getByText(OS_NUMERO).first()).toBeVisible({ timeout: 30000 });
      await pausa(1500);
      await pageTms.getByTitle("Publicar na Rede de Prestadores").first().click();
      await expect(pageTms.getByText(new RegExp(`${OS_NUMERO} publicada na Rede`))).toBeVisible({
        timeout: 15000,
      });
      await legenda(pageTms, "DESKTOP", "OS publicada na Rede de Oportunidades");
      await pausa(2500);

      // ============================================================
      // PASSO 4 — Mobile: login, aba Rede e aceite
      // ============================================================
      await legenda(pageApp, "MOBILE", "Passo 4/5 — Motorista logado abre a aba Rede");
      await pageApp.goto("/login", { waitUntil: "domcontentloaded" });
      await pageApp.locator('input[type="email"]').fill(EMAIL_MOTORISTA);
      await pausa(900);
      await pageApp.locator('input[type="password"]').fill(SENHA_MOTORISTA);
      await pausa(900);
      await pageApp.getByRole("button", { name: /Entrar/ }).click();
      await pageApp.waitForURL(/\/app-prestador/, { timeout: 30000 });
      await pausa(1500);

      await pageApp.goto("/portal-prestador", { waitUntil: "domcontentloaded" });
      await expect(pageApp.getByRole("button", { name: "Rede", exact: true })).toBeVisible({
        timeout: 30000,
      });
      await pageApp.getByRole("button", { name: "Rede", exact: true }).click();
      await expect(pageApp.getByRole("heading", { name: /Rede de Oportunidades/ })).toBeVisible();
      await pausa(1500);

      await legenda(pageApp, "MOBILE", "Atualizando a Rede — a OS publicada aparece para o motorista");
      await pageApp.getByRole("button", { name: "Atualizar oportunidades" }).click();
      const card = pageApp.getByTestId("rede-oportunidade-card").first();
      await expect(card).toBeVisible({ timeout: 30000 });
      await expect(card).toContainText(OS_NUMERO);
      await expect(card).toContainText(/185,50/);
      await expect(card).toContainText("12,4 km");
      await pausa(2500);

      await legenda(pageApp, "MOBILE", "Abrindo detalhes e aceitando a OS");
      await card.click();
      await expect(pageApp.getByRole("heading", { name: "Detalhes da Oportunidade" })).toBeVisible();
      await pausa(2000);
      await pageApp.getByRole("button", { name: /Aceitar Oportunidade/ }).click();
      await expect(pageApp.getByText("Oportunidade aceita!")).toBeVisible({ timeout: 15000 });
      await pausa(2500);

      // ============================================================
      // PASSO 5 — Desktop: Torre reage ao aceite
      // ============================================================
      await legenda(pageTms, "DESKTOP", "Passo 5/5 — Torre de Controle recebe o aceite do motorista");
      await pageTms.goto("/torre-controle", { waitUntil: "domcontentloaded" });
      await expect(pageTms.getByRole("heading", { name: /Torre de Controle Operacional/ })).toBeVisible({
        timeout: 30000,
      });
      await pausa(1200);
      await pageTms.getByRole("button", { name: "Atualizar", exact: true }).click();
      await expect(pageTms.getByText("2 eventos")).toBeVisible({ timeout: 30000 });
      await expect(pageTms.getByText(/escala alocacao aceita/i)).toBeVisible({ timeout: 30000 });
      await expect(pageTms.getByText(new RegExp(MOTORISTA.nome)).first()).toBeVisible();
      await legenda(pageTms, "DESKTOP", "Alerta/Timeline atualizados: OS aceita por João Piloto E2E");
      await pausa(4000);

      // ============================================================
      // PASSO 6 — Mobile: abrir a OS em andamento
      // ============================================================
      await legenda(pageApp, "MOBILE", "[MOBILE] Passo 6 - Abrindo a OS em andamento");
      await pageApp.getByRole("button", { name: /Ver OS em andamento/ }).click();
      await expect(pageApp.getByRole("heading", { name: "OS em Andamento" })).toBeVisible({
        timeout: 15000,
      });
      await pausa(2000);

      // ============================================================
      // PASSO 7 — Mobile: check-in "Cheguei no local" (GPS)
      // ============================================================
      await legenda(pageApp, "MOBILE", "[MOBILE] Passo 7 - Check-in: Cheguei no local (GPS)");
      await pageApp.getByRole("button", { name: /Cheguei no local/ }).click();
      await expect(pageApp.getByText(/GPS -23.56140, -46.65590/)).toBeVisible({ timeout: 15000 });
      await expect(pageApp.getByRole("button", { name: /Chegada registrada/ })).toBeVisible();
      await legenda(pageApp, "MOBILE", "Check-in registrado — GPS enviado para a Torre");
      await pausa(3000);

      // ============================================================
      // PASSO 8 — Desktop: Torre exibe o GPS do motorista
      // ============================================================
      await legenda(pageTms, "DESKTOP", "[DESKTOP] Passo 8 - Torre recebe o GPS do motorista");
      await pageTms.goto("/torre-controle", { waitUntil: "domcontentloaded" });
      await expect(pageTms.getByRole("heading", { name: /Torre de Controle Operacional/ })).toBeVisible({
        timeout: 30000,
      });
      await expect(pageTms.getByText("GPS Ativo: 1")).toBeVisible({ timeout: 30000 });
      const marcadorVerde = pageTms.locator('div[style*="rgb(34, 197, 94)"]').first();
      await expect(marcadorVerde).toBeVisible({ timeout: 30000 });
      await expect(pageTms.getByText(/Chegou na coleta/).first()).toBeVisible({ timeout: 30000 });
      await legenda(pageTms, "DESKTOP", "Marcador verde no GPS + timeline: Chegou na coleta");
      await pausa(4000);
      await pageTms.screenshot({ path: "test-results/master/torre-gps.png", fullPage: false });

      // ============================================================
      // PASSO 9 — Mobile: POD (foto + assinatura) e baixa final
      // ============================================================
      await legenda(pageApp, "MOBILE", "[MOBILE] Passo 9 - POD: foto do comprovante + assinatura");
      await pageApp.getByTestId("pod-foto-input").setInputFiles({
        name: "comprovante-entrega.png",
        mimeType: "image/png",
        buffer: PNG_1X1,
      });
      await expect(pageApp.getByAltText("Comprovante de entrega")).toBeVisible({ timeout: 15000 });
      await pausa(1500);

      const canvasAssinatura = pageApp.locator("canvas").first();
      await canvasAssinatura.scrollIntoViewIfNeeded();
      const caixaAssinatura = await canvasAssinatura.boundingBox();
      if (!caixaAssinatura) throw new Error("Canvas de assinatura do POD não encontrado");
      await pageApp.mouse.move(caixaAssinatura.x + 30, caixaAssinatura.y + caixaAssinatura.height / 2);
      await pageApp.mouse.down();
      await pageApp.mouse.move(
        caixaAssinatura.x + caixaAssinatura.width / 2,
        caixaAssinatura.y + caixaAssinatura.height / 3,
        { steps: 20 },
      );
      await pageApp.mouse.move(
        caixaAssinatura.x + caixaAssinatura.width - 30,
        caixaAssinatura.y + caixaAssinatura.height / 2,
        { steps: 20 },
      );
      await pageApp.mouse.up();
      await pausa(800);
      await pageApp.getByRole("button", { name: /Confirmar assinatura/ }).click();
      await expect(pageApp.getByText("Assinatura registrada").first()).toBeVisible();
      await pausa(1200);

      await pageApp.getByRole("button", { name: /Finalizar OS/ }).click();
      await expect(pageApp.getByText("OS finalizada com sucesso", { exact: true })).toBeVisible({
        timeout: 30000,
      });
      await legenda(pageApp, "MOBILE", "Baixa concluída — POD enviado à Torre");
      await pausa(3000);
      await pageApp.screenshot({ path: "test-results/master/app-pod.png", fullPage: false });

      // ============================================================
      // PASSO 10 — Desktop: OS concluída + evidência no TMS
      // ============================================================
      await legenda(pageTms, "DESKTOP", "[DESKTOP] Passo 10 - Torre acusa OS concluída");
      await pageTms.goto("/torre-controle", { waitUntil: "domcontentloaded" });
      await expect(pageTms.getByRole("heading", { name: /Torre de Controle Operacional/ })).toBeVisible({
        timeout: 30000,
      });
      await expect(pageTms.getByText("5 eventos")).toBeVisible({ timeout: 30000 });
      await expect(pageTms.getByText("Concluída", { exact: true }).first()).toBeVisible({
        timeout: 30000,
      });
      await expect(pageTms.getByText(/POD enviado|Evidência/).first()).toBeVisible({
        timeout: 30000,
      });
      await pageTms.getByRole("button", { name: "Atualizar", exact: true }).click();
      await legenda(pageTms, "DESKTOP", "Timeline: OS concluída + POD enviado");

      await legenda(pageTms, "DESKTOP", "Operador abre a OS no TMS e visualiza a evidência");
      await pageTms.goto("/operacao?tab=os", { waitUntil: "domcontentloaded" });
      const linhaOS = pageTms.getByText(OS_NUMERO).first();
      await expect(linhaOS).toBeVisible({ timeout: 30000 });
      await linhaOS.hover();
      await pausa(800);
      await pageTms.getByTitle("Ver comprovantes").first().click();
      const dialogComprovantes = pageTms.getByRole("dialog");
      await expect(dialogComprovantes.getByText("Comprovantes da Entrega")).toBeVisible({
        timeout: 30000,
      });
      await expect(dialogComprovantes.getByText(/Com POD/)).toBeVisible({ timeout: 30000 });
      await expect(dialogComprovantes.getByText(/1 completa/)).toBeVisible();
      await expect(dialogComprovantes.getByText("Foto", { exact: true })).toBeVisible();
      await expect(dialogComprovantes.getByText("Assinatura", { exact: true })).toBeVisible();
      await legenda(pageTms, "DESKTOP", "Evidência de entrega confirmada: foto + assinatura");
      await pausa(4000);

      await pageTms.screenshot({ path: "test-results/master/tms-comprovantes.png", fullPage: false });
      await pageApp.screenshot({ path: "test-results/master/app-aceite.png", fullPage: false });

      await desktop.close();
      await mobile.close();
      console.log("\n[MASTER] Ciclo completo TMS x App concluído ✅");
    } finally {
      await browserDesktop?.close().catch(() => undefined);
      await browserMobile?.close().catch(() => undefined);
    }
  });
});
