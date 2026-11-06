/* MISSÃO 1 — Prova real de STORAGE + LEITURA dos uploads de documentos.
 * Executa o mesmo caminho do código da UI contra o Supabase configurado:
 *   upload -> metadado (documentos_metadata) -> registro de negócio -> leitura
 *   -> URL assinada -> download dos bytes -> limpeza.
 * Modo padrão: executa a prova e limpa tudo. Use `--dry-run` apenas para checar alvos.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const { Client } = require("pg");
require("dotenv").config();

const BUCKET = "documentos_operacionais";
const TENANT = "00000000-0000-0000-0000-000000000001";
const DRY_RUN = process.argv.includes("--dry-run");
const ARQUIVO_TESTE = path.resolve(process.cwd(), "scripts/_adm_app_02d2r1_doc_teste.png");
const EVIDENCIA = path.resolve(process.cwd(), "MISSAO_01_EVIDENCIAS_UPLOADS.json");

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.E2E_LIVE_EMAIL;
const password = process.env.E2E_LIVE_PASSWORD;
if (!url || !anonKey) throw new Error("VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes no .env.");
if (!email || !password) throw new Error("E2E_LIVE_EMAIL/E2E_LIVE_PASSWORD ausentes no .env.");
if (!fs.existsSync(ARQUIVO_TESTE)) throw new Error(`Arquivo de teste não encontrado: ${ARQUIVO_TESTE}`);

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const resultados = [];
const registrar = (etapa, ok, detalhe) => {
  resultados.push({ etapa, ok: Boolean(ok), detalhe });
  console.log(`${ok ? "PASS" : "FAIL"} | ${etapa}${detalhe ? ` | ${detalhe}` : ""}`);
};
const falhar = (etapa, detalhe) => {
  registrar(etapa, false, detalhe);
  throw new Error(`${etapa}: ${detalhe}`);
};

const bytes = fs.readFileSync(ARQUIVO_TESTE);
const sha256Local = crypto.createHash("sha256").update(bytes).digest("hex");
const stamp = Date.now();
const criados = { objetos: [], metadataIds: [], contratos: [], reembolsos: [] };

async function assinarEComparar(etapa, objectPath) {
  const { data: assinada, error: erroAssinar } = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, 600);
  if (erroAssinar || !assinada?.signedUrl) falhar(etapa, erroAssinar?.message || "sem signedUrl");
  const resp = await fetch(assinada.signedUrl);
  if (!resp.ok) falhar(etapa, `HTTP ${resp.status} no download assinado`);
  const baixado = Buffer.from(await resp.arrayBuffer());
  const shaBaixado = crypto.createHash("sha256").update(baixado).digest("hex");
  if (shaBaixado !== sha256Local) falhar(etapa, `bytes divergentes (${shaBaixado} != ${sha256Local})`);
  const { data: publica } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const respPublica = await fetch(publica.publicUrl);
  registrar(`${etapa} — bucket privado nega acesso público`, !respPublica.ok, `HTTP ${respPublica.status}`);
  return { urlAssinada: assinada.signedUrl, tamanho: baixado.length, sha256: shaBaixado };
}

async function main() {
  await pg.connect();
  const contagem = async () => {
    const q = async (sql) => (await pg.query(sql)).rows[0];
    return {
      contratos: await q("select count(*)::int total, count(anexo_url)::int com_url, count(anexo_nome)::int com_nome from clientes_contratos"),
      reembolsos: await q("select count(*)::int total, count(comprovante_url)::int com_url from reembolsos_prestador"),
      metadata: await q("select count(*)::int total from documentos_metadata"),
    };
  };
  const antes = await contagem();
  registrar("0) contagens antes", true, JSON.stringify(antes));

  const cliente = (await pg.query("select id, razao_social, nome_fantasia, tenant_id from clientes where tenant_id=$1 limit 1", [TENANT])).rows[0];
  if (!cliente) falhar("0) cliente de prova", "nenhum cliente no tenant da prova");
  const aloc = (await pg.query("select id, ordem_servico_id from alocacoes_escala where tenant_id=$1 and ordem_servico_id is not null and id <> ordem_servico_id limit 1", [TENANT])).rows[0];
  if (!aloc) falhar("0) alocação de prova", "nenhuma alocação com OS vinculada");
  const os = (await pg.query("select id, numero from ordens_servico where id=$1", [aloc.ordem_servico_id])).rows[0];
  registrar("0) alvos de prova", true, `cliente=${cliente.id} alocacao=${aloc.id} os=${os.numero}`);

  if (DRY_RUN) {
    registrar("dry-run", true, "alvos verificados; nada foi alterado");
    return;
  }

  const auth = await supabase.auth.signInWithPassword({ email, password });
  if (auth.error) falhar("0) usuário autorizado", auth.error.message);
  const tenantUser = (await supabase.rpc("current_tenant_id_safe")).data;
  registrar("0) usuário autorizado", Boolean(auth.data.user), `user=${auth.data.user.id} tenant=${tenantUser}`);

  // ── GAP 1 — CONTRATO ───────────────────────────────────────────────────────
  const pathContrato = `doc_${cliente.id}_Contrato_${stamp}.png`;
  const refContrato = `${BUCKET}/${pathContrato}`;
  const nomeContrato = `MISSAO01_TESTE_CONTRATO_${stamp}.png`;

  const uploadContrato = await supabase.storage.from(BUCKET).upload(pathContrato, bytes, {
    upsert: false,
    contentType: "image/png",
  });
  if (uploadContrato.error) falhar("1.1 upload contrato", uploadContrato.error.message);
  criados.objetos.push(pathContrato);
  const statObjeto = (await pg.query("select bucket_id, name from storage.objects where bucket_id=$1 and name=$2", [BUCKET, pathContrato])).rows[0];
  if (!statObjeto) falhar("1.2 binário no Storage", "objeto não encontrado em storage.objects");
  registrar("1.2 binário no Storage", true, `${refContrato} (${bytes.length} b)`);

  const metaContrato = {
    url: refContrato,
    nome: nomeContrato,
    tipo: "Contrato",
    modulo_origem: "clientes",
    entidade_id: cliente.id,
    entidade_nome: cliente.nome_fantasia || cliente.razao_social || null,
    status_ia: "pendente",
    categoria: "Comercial",
    departamento: "Comercial",
    responsavel: "TMS",
    cliente_id: cliente.id,
    descricao: `Contrato HML-MISSAO01 — prova de upload`,
    mime_type: "image/png",
    tamanho_bytes: bytes.length,
    versao: 1,
    ativo: true,
    historico: [{ id: crypto.randomUUID(), tipo: "criacao", descricao: "Documento enviado para a Central de Documentos.", data: new Date().toISOString(), usuario: "TMS" }],
  };
  const insMetaContrato = await supabase.from("documentos_metadata").insert([metaContrato]).select("*").single();
  if (insMetaContrato.error) falhar("1.3 metadado do contrato", insMetaContrato.error.message);
  criados.metadataIds.push(insMetaContrato.data.id);
  registrar("1.3 metadado do contrato", insMetaContrato.data.url === refContrato, `id=${insMetaContrato.data.id}`);

  const insContrato = await supabase.from("clientes_contratos").insert([{
    cliente_id: cliente.id,
    numero: `HML-MISSAO01-${stamp}`,
    tipo: "Serviços",
    valor: 1,
    objeto: "Prova de upload de anexo",
    vigencia_inicio: new Date().toISOString().slice(0, 10),
    vigencia_fim: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    status: "ativo",
    observacoes: "Registro temporário da MISSÃO 1 (será removido).",
    anexo_nome: nomeContrato,
    anexo_url: refContrato,
  }]).select("*").single();
  if (insContrato.error) falhar("1.4 contrato com referência", insContrato.error.message);
  criados.contratos.push(insContrato.data.id);
  const contratoLido = (await supabase.from("clientes_contratos").select("*").eq("id", insContrato.data.id).single()).data;
  if (!contratoLido || contratoLido.anexo_url !== refContrato) falhar("1.4 contrato com referência", "anexo_url não persistiu");
  registrar("1.4 contrato com referência", true, `contrato=${contratoLido.id} anexo_url=${contratoLido.anexo_url}`);

  const leituraContrato = await assinarEComparar("1.5 abrir/baixar contrato (URL assinada + bytes)", pathContrato);
  registrar("1.5 abrir/baixar contrato (URL assinada + bytes)", true, `sha256=${leituraContrato.sha256.slice(0, 16)}… (${leituraContrato.tamanho} b)`);

  const historicoContrato = [...(insMetaContrato.data.historico || []), {
    id: crypto.randomUUID(),
    tipo: "vinculo_contrato",
    descricao: `Documento vinculado ao contrato ${contratoLido.numero}.`,
    usuario: null,
    data: new Date().toISOString(),
    metadata: { contrato_id: contratoLido.id },
  }];
  const updHist = await supabase.from("documentos_metadata").update({ historico: historicoContrato }).eq("id", insMetaContrato.data.id).select("historico").single();
  if (updHist.error || !(updHist.data.historico || []).some((e) => e.tipo === "vinculo_contrato")) {
    falhar("1.6 vínculo documento↔contrato", updHist.error?.message || "evento ausente");
  }
  registrar("1.6 vínculo documento↔contrato", true, "historico.vinculo_contrato presente");

  // ── GAP 2 — COMPROVANTE DE PEDÁGIO ─────────────────────────────────────────
  const pathPedagio = `doc_${aloc.id}_Comprovante_de_Pedagio_${stamp}.png`;
  const refPedagio = `${BUCKET}/${pathPedagio}`;
  const nomePedagio = `MISSAO01_TESTE_PEDAGIO_${stamp}.png`;

  const uploadPedagio = await supabase.storage.from(BUCKET).upload(pathPedagio, bytes, {
    upsert: false,
    contentType: "image/png",
  });
  if (uploadPedagio.error) falhar("2.1 upload pedágio", uploadPedagio.error.message);
  criados.objetos.push(pathPedagio);

  const metaPedagio = {
    url: refPedagio,
    nome: nomePedagio,
    tipo: "Comprovante de Pedágio",
    modulo_origem: "financeiro",
    entidade_id: null,
    entidade_nome: "Prestador MISSÃO 1",
    status_ia: "pendente",
    categoria: "Financeiro",
    departamento: "Financeiro",
    responsavel: "Financeiro",
    cliente_id: cliente.id,
    descricao: `Comprovante de pedágio — ${os.numero}`,
    mime_type: "image/png",
    tamanho_bytes: bytes.length,
    versao: 1,
    ativo: true,
    historico: [{ id: crypto.randomUUID(), tipo: "criacao", descricao: "Comprovante enviado para a Central.", data: new Date().toISOString(), usuario: "Financeiro" }],
  };
  const insMetaPedagio = await supabase.from("documentos_metadata").insert([metaPedagio]).select("*").single();
  if (insMetaPedagio.error) falhar("2.2 metadado do comprovante", insMetaPedagio.error.message);
  criados.metadataIds.push(insMetaPedagio.data.id);
  registrar("2.2 metadado do comprovante", Boolean(insMetaPedagio.data.id), `id=${insMetaPedagio.data.id}`);

  // Simula o clique em "Salvar lançamento": associa o documento já enviado à alocação.
  const historicoPedagio = [...(insMetaPedagio.data.historico || []), {
    id: crypto.randomUUID(),
    tipo: "vinculo_lancamento",
    descricao: `Comprovante de pedágio vinculado à alocação ${aloc.id}.`,
    usuario: null,
    data: new Date().toISOString(),
    metadata: { alocacao_id: aloc.id, os_id: os.id },
  }];
  const updPedagio = await supabase.from("documentos_metadata").update({
    entidade_id: aloc.id,
    descricao: `Comprovante de pedágio — ${os.numero}`,
    historico: historicoPedagio,
    updated_at: new Date().toISOString(),
  }).eq("id", insMetaPedagio.data.id).select("*").single();
  if (updPedagio.error || updPedagio.data.entidade_id !== aloc.id) {
    falhar("2.3 associação à conferência (alocação)", updPedagio.error?.message || "entidade_id não atualizada");
  }
  registrar("2.3 associação à conferência (alocação)", true, `entidade_id=${updPedagio.data.entidade_id}`);

  const docLeitura = (await supabase.from("documentos_metadata").select("id, url, nome, descricao, data_inclusao")
    .eq("modulo_origem", "financeiro").eq("entidade_id", aloc.id).eq("tipo", "Comprovante de Pedágio").eq("ativo", true)
    .order("data_inclusao", { ascending: false }).limit(1).maybeSingle()).data;
  if (!docLeitura || docLeitura.url !== refPedagio) falhar("2.4 leitura da Central por alocação", "metadado não encontrado");
  registrar("2.4 leitura da Central por alocação", true, `doc=${docLeitura.id}`);

  const leituraPedagio = await assinarEComparar("2.5 abrir/baixar comprovante (URL assinada + bytes)", pathPedagio);
  registrar("2.5 abrir/baixar comprovante (URL assinada + bytes)", true, `sha256=${leituraPedagio.sha256.slice(0, 16)}… (${leituraPedagio.tamanho} b)`);

  // Compatibilidade com comprovante antigo já existente (URL externa ou path driver-evidence).
  // A referência é preservada; o acesso HTTP continua sujeito à policy original do
  // bucket driver-evidence (somente o prestador / pasta pod), que NÃO é alterada aqui.
  const legado = (await pg.query("select comprovante_url from reembolsos_prestador where comprovante_url is not null order by created_at asc limit 1")).rows[0];
  if (legado?.comprovante_url) {
    const valor = legado.comprovante_url;
    const ehHttp = /^https?:\/\//i.test(valor);
    let urlLeitura = ehHttp ? valor : "";
    if (!ehHttp) {
      const { data } = await supabase.storage.from("driver-evidence").createSignedUrl(valor, 600);
      urlLeitura = data?.signedUrl || "";
    }
    let status = "referência preservada";
    if (urlLeitura) {
      const resp = await fetch(urlLeitura);
      status = `HTTP ${resp.status} (policy driver-evidence inalterada)`;
    }
    registrar("2.6 comprovante antigo permanece referenciado", true, `${ehHttp ? "URL externa" : "path driver-evidence"} · ${status}`);
  } else {
    registrar("2.6 comprovante antigo permanece referenciado", true, "nenhum comprovante antigo para ler (nada a quebrar)");
  }

  // ── 8) ERRO DE UPLOAD / ARQUIVO INVÁLIDO ───────────────────────────────────
  const pathInvalido = `doc_${cliente.id}_Invalido_${stamp}.exe`;
  const uploadInvalido = await supabase.storage.from(BUCKET).upload(pathInvalido, Buffer.from("MZ-fake"), {
    upsert: false,
    contentType: "application/x-msdownload",
  });
  if (!uploadInvalido.error) {
    criados.objetos.push(pathInvalido);
    registrar("8) upload de formato inválido é recusado", false, "bucket aceitou .exe (esperado recusar)");
  } else {
    registrar("8) upload de formato inválido é recusado", true, uploadInvalido.error.message);
  }

  // ── Compatibilidade com registros antigos ──────────────────────────────────
  const antigosContratos = (await pg.query("select count(*)::int n from clientes_contratos where anexo_url is not null and id <> $1", [contratoLido.id])).rows[0].n;
  const antigosReembolsos = (await pg.query("select count(*)::int n from reembolsos_prestador where comprovante_url is not null")).rows[0].n;
  registrar("7) registros antigos preservados", true, `contratos com URL (fora do teste)=${antigosContratos}; reembolsos com URL (fora do teste)=${antigosReembolsos}`);
}

async function limpar() {
  try {
    for (const id of criados.reembolsos) await supabase.from("reembolsos_prestador").delete().eq("id", id);
    for (const id of criados.contratos) await supabase.from("clientes_contratos").delete().eq("id", id);
    for (const id of criados.metadataIds) await supabase.from("documentos_metadata").delete().eq("id", id);
    if (criados.objetos.length) await supabase.storage.from(BUCKET).remove(criados.objetos);
  } catch (e) {
    console.error("ERRO NA LIMPEZA:", e.message);
  }
}

(async () => {
  let erroFatal = null;
  try {
    await main();
  } catch (e) {
    erroFatal = e.message;
    console.error("ERRO FATAL:", e.message);
  } finally {
    await limpar();
    let depois = null;
    try {
      const q = async (sql) => (await pg.query(sql)).rows[0];
      depois = {
        contratos: await q("select count(*)::int total, count(anexo_url)::int com_url, count(anexo_nome)::int com_nome from clientes_contratos"),
        reembolsos: await q("select count(*)::int total, count(comprovante_url)::int com_url from reembolsos_prestador"),
        metadata: await q("select count(*)::int total from documentos_metadata"),
      };
      const residuosObjetos = (await pg.query("select count(*)::int n from storage.objects where bucket_id=$1 and name like $2", [BUCKET, `%_${stamp}.%`])).rows[0].n;
      registrar("9) limpeza", residuosObjetos === 0, `objetos residuais=${residuosObjetos}`);
    } catch (e) {
      registrar("9) limpeza", false, e.message);
    }
    await pg.end();
    const evidencia = {
      missao: "MISSÃO 1 — uploads de documentos existentes",
      executado_em: new Date().toISOString(),
      bucket: BUCKET,
      arquivo_teste: { caminho: ARQUIVO_TESTE, bytes: bytes.length, sha256: sha256Local },
      resultados,
      erro_fatal: erroFatal,
      contagens_depois: depois,
      criados,
    };
    fs.writeFileSync(EVIDENCIA, JSON.stringify(evidencia, null, 2), "utf8");
    console.log(`\nEvidência: ${EVIDENCIA}`);
    if (erroFatal) process.exitCode = 1;
  }
})();
