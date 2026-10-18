# Reset de Senha — Supabase Auth — Guia de Configuracao

> **Missao:** 08 | **Data:** 2026-06-26

---

## 1. O Que Foi Implementado

- **Pagina `/forgot-password`** — Usuario informa e-mail, sistema envia link de recuperacao via Supabase Auth
- **Pagina `/reset-password`** — Usuario clica no link do e-mail, define nova senha
- **Login.tsx** — Link "Esqueci minha senha" agora leva para pagina real

---

## 2. Como Configurar no Supabase

### 2.1 Configurar URL do Site
1. Acessar Supabase Dashboard → Authentication → URL Configuration
2. Site URL: `https://tms.suaempresa.com.br` (ou `http://localhost:8800` para dev)
3. Redirect URLs (adicionar todos):
   - `https://tms.suaempresa.com.br/reset-password`
   - `http://localhost:8800/reset-password`

### 2.2 Configurar Templates de E-mail
1. Authentication → Email Templates
2. Editar "Reset Password":
   - Subject: `Redefinir sua senha — Express Connect Hub`
   - Usar `{{ .RedirectTo }}` como link
   - Exemplo: `Clique aqui para redefinir: {{ .RedirectTo }}`

### 2.3 Habilitar Provedor de E-mail
- Authentication → Providers → Email
- Habilitar "Enable email confirmations" se desejar
- Configurar SMTP customizado OU usar o servidor de e-mail padrao do Supabase (limitado a 4 e-mails/hora no plano gratuito)

---

## 3. Variaveis de Ambiente

```env
# URL base da aplicacao (usada como redirectTo)
VITE_APP_URL=https://tms.suaempresa.com.br

# Credenciais Supabase (ja existentes)
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

---

## 4. Como Testar

1. Acessar o sistema → Login → "Esqueci minha senha"
2. Informar e-mail cadastrado
3. Verificar caixa de entrada (e spam)
4. Clicar no link recebido
5. Definir nova senha (minimo 6 caracteres)
6. Fazer login com a nova senha

---

## 5. Problemas Comuns

| Problema | Solucao |
|----------|---------|
| E-mail nao chega | Verificar spam. Plano gratuito do Supabase: max 4 e-mails/hora. Configurar SMTP proprio. |
| Link expirado | O link do Supabase expira em 1 hora. Solicitar novo reset. |
| "Link invalido" | A URL `redirectTo` deve estar cadastrada em Authentication → Redirect URLs |
| Erro ao definir senha | Senha deve ter no minimo 6 caracteres |

---

## 6. Seguranca

- `supabase.auth.resetPasswordForEmail()` usa a anon key (publica) — seguro
- `supabase.auth.updateUser()` requer a session JWT do link — seguro
- Service role key NAO e usada no frontend
- A mensagem "Se este e-mail estiver cadastrado..." nao revela se o e-mail existe (protecao contra enumeracao)

---

*Documento gerado para Missao 08 — OpenCode Go Pro*
