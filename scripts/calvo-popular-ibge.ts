import { createClient } from "@supabase/supabase-js";
const s = createClient("https://uwrvzsjtpgaifkktpepn.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs");

// Try to auth first
await s.auth.signInWithPassword({ email: "admin@conexaoexpress.com.br", password: "admin123" }).catch(() => {});

const municipios = [
  { codigo: "3550308", nome: "São Paulo", uf: "SP" },
  { codigo: "3509502", nome: "Campinas", uf: "SP" },
  { codigo: "4106902", nome: "Curitiba", uf: "PR" },
  { codigo: "3118601", nome: "Contagem", uf: "MG" },
  { codigo: "3518800", nome: "Guarulhos", uf: "SP" },
  { codigo: "3524402", nome: "Jacareí", uf: "SP" },
  { codigo: "3546801", nome: "Santa Isabel", uf: "SP" },
  { codigo: "3304557", nome: "Rio de Janeiro", uf: "RJ" },
  { codigo: "3106200", nome: "Belo Horizonte", uf: "MG" },
];

for (const m of municipios) {
  const { error } = await s.from("municipios_ibge").upsert(m, { onConflict: "codigo" }).select("codigo");
  console.log(error ? "ERRO " + m.codigo + ": " + error.message : "OK " + m.codigo + " " + m.nome + "/" + m.uf);
}

const { count } = await s.from("municipios_ibge").select("*", { count: "exact", head: true });
console.log("\nTotal municipios_ibge:", count);
