# DOCUMENTAÇÃO MASTER — TMS CONEXÃO EXPRESS

## 1. Projeto oficial
- Nome técnico: express-connect-hub
- Sistema: Conexão Express TMS
- GitHub: tecnologiaconexao5-lab/express-connect-hub
- Branch produção: main

## 2. Hospedagem
- Frontend: Vercel
- URL atual: https://express-connect-hub.vercel.app
- Futuro domínio: tms.conexaoexpress.com.br

## 3. Banco de dados
- Supabase
- Usado para: login, dados, cadastros, operações, storage

## 4. Desenvolvimento
- Editor: VSCode
- Comando local: npm run dev
- Localhost: http://localhost:8800

## 5. Integrações previstas
- n8n
- Evolution API / WhatsApp
- Mapbox
- ViaCEP
- Banco Afi
- Focus CT-e
- Groq
- Gemini
- OpenAI
- Zoho Email

## 6. Segurança
- Nunca subir .env no GitHub
- Chaves reais ficam na Vercel e ambiente local
- Usar .env.example como modelo sem senhas

## 7. Deploy
- Alterar no VSCode
- git add .
- git commit -m "descrição"
- git push origin main
- Vercel atualiza automaticamente

## 8. Pendências principais
- Finalizar Recrutamento/Pipeline
- Finalizar Portal Prestador
- Finalizar Central Documental
- Finalizar Automações
- Revisar Portal Cliente