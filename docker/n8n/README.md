# N8N + Evolution API - Configuração

## Quick Start

### 1. Iniciar n8n
```powershell
cd docker/n8n
docker-compose -f docker-compose.simple.yml up -d
```

### 2. Acessar
- **n8n:** http://localhost:5678
- **Evolution API:** http://localhost:8080

### 3. Primeiro Acesso n8n
1. Abra http://localhost:5678
2. Crie sua conta (primeiro acesso)
3. Configure as credenciais da Evolution API

---

## Estrutura de Arquivos

```
docker/
└── n8n/
    ├── docker-compose.yml          # Versão PostgreSQL
    ├── docker-compose.simple.yml    # Versão SQLite (recomendado)
    ├── README.md                    # Este arquivo
    └── data/                        # Dados persistentes
        ├── workflows/               # Workflows salvos
        ├── credentials/             # Credenciais criptografadas
        ├── evolution/               # Dados do WhatsApp
        └── backup/                  # Backups automáticos
```

---

## Comandos Úteis

### Iniciar
```powershell
docker-compose -f docker-compose.simple.yml up -d
```

### Parar
```powershell
docker-compose -f docker-compose.simple.yml down
```

### Ver logs
```powershell
docker logs n8n_tms -f
docker logs evolution_api -f
```

### Reiniciar
```powershell
docker restart n8n_tms
docker restart evolution_api
```

### Ver status
```powershell
docker ps
docker volume ls
```

---

## Backup Automático

```powershell
.\scripts\backup-n8n.ps1
```

O backup cria um arquivo compactado em `docker/n8n/data/backup/`

---

## Configuração Evolution API

No n8n, crie credenciais com:
- **Instance Name:** express-tms
- **API Key:** minha_chave_segura_123
- **URL:** http://evolution_api:8080

---

## Variáveis de Ambiente

### n8n
- `N8N_HOST=localhost`
- `N8N_PORT=5678`
- `N8N_PROTOCOL=http`
- `TZ=America/Sao_Paulo`
- `GENERIC_TIMEZONE=America/Sao_Paulo`

### Evolution API
- `SERVER_PORT=8080`
- `AUTHENTICATION_API_KEY=sua_chave_aqui`
- `WEBHOOK_GLOBAL_URL=http://n8n:5678/webhook`

---

## Persistência

Os volumes estão configurados para persistir:
- `/home/node/.n8n` → dados do n8n
- `./data/workflows` → workflows
- `./data/credentials` → credenciais
- `./data/evolution` → sessões do WhatsApp

Após reiniciar o Docker/Windows, tudo permanece.

---

## Troubleshooting

### n8n não inicia
```powershell
docker logs n8n_tms
```

### Evolution API não conecta
```powershell
docker logs evolution_api
docker network inspect tms_network
```

### Rede entre containers não funciona
Verificar se estão na mesma network `tms_network`

---

## Próximos Passos

1. ✅ Configurar n8n persistente
2. 🔄 Configurar Evolution API
3. ⏳ Criar workflows no n8n
4. ⏳ Conectar com TMS via webhook

---

*Última atualização: 07/05/2026*