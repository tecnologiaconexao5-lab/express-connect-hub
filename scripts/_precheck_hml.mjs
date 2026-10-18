import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const state = JSON.parse(readFileSync("tests/e2e/.auth/storageState.json", "utf8"));
const origin = state.origins?.find(o => o.origin?.includes("localhost")) || state.origins?.[0];
const ls = origin?.localStorage || [];
const tokenItem = ls.find(i => i.name.includes("sb-") && i.name.includes("auth-token"));
const token = tokenItem ? JSON.parse(tokenItem.value).access_token : null;
console.log("Token found:", !!token);

const supabase = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs",
  { global: { headers: { Authorization: `Bearer ${token}` } } }
);

const r = {};
r.aloc = await supabase.from("alocacoes_escala").select("*").eq("id", "09b7126a-7f68-48cf-aca1-72de65ff4fcc").single();
r.fr = await supabase.from("financeiro_receber").select("*").eq("id", "53e7ccb9-ab9e-4282-82bb-0e736487d99f").single();
r.fp = await supabase.from("financeiro_pagar").select("*").eq("id", "df755520-4db1-4feb-97c3-6bd0f768fb60").single();
r.pp = await supabase.from("pagamentos_prestadores").select("id, status, situacao, valor_liquido, os_id, prestador_id, created_at, updated_at").eq("id", "534e674d-8c3d-4d69-abf7-cd818e88f06e").single();
r.cf = await supabase.from("composicao_financeira_os").select("*").eq("os_id", "28640e7b-fbe5-4141-a59a-c5bead26d25a");
r.os = await supabase.from("ordens_servico").select("*").eq("id", "28640e7b-fbe5-4141-a59a-c5bead26d25a").single();
r.dupRec = await supabase.from("financeiro_receber").select("id").eq("origem_id", "09b7126a-7f68-48cf-aca1-72de65ff4fcc");
r.dupPag = await supabase.from("financeiro_pagar").select("id").eq("os_id", "28640e7b-fbe5-4141-a59a-c5bead26d25a");
r.dupPre = await supabase.from("pagamentos_prestadores").select("id").eq("os_id", "28640e7b-fbe5-4141-a59a-c5bead26d25a");

const results = {
  alocacao: { exists: !!r.aloc.data, status: r.aloc.data?.status, error: r.aloc.error?.message },
  financeiro_receber: { exists: !!r.fr.data, status: r.fr.data?.status, valor: r.fr.data?.valor, error: r.fr.error?.message },
  financeiro_pagar: { exists: !!r.fp.data, status: r.fp.data?.status, valor: r.fp.data?.valor, error: r.fp.error?.message },
  pagamentos_prestadores: { exists: !!r.pp.data, status: r.pp.data?.status, situacao: r.pp.data?.situacao, valor_liquido: r.pp.data?.valor_liquido, error: r.pp.error?.message },
  composicao_financeira_os: { count: r.cf.data?.length ?? 0, error: r.cf.error?.message },
  os: { exists: !!r.os.data, status: r.os.data?.status, error: r.os.error?.message },
  duplicatas: {
    receber: r.dupRec.data?.length ?? 0,
    pagar: r.dupPag.data?.length ?? 0,
    prestador: r.dupPre.data?.length ?? 0,
  },
};
console.log(JSON.stringify(results, null, 2));
