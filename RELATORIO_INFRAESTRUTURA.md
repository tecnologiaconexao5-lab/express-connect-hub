==============================================
RELATÓRIO DE INFRAESTRUTURA - N8N + TMS
==============================================

ARQUIVOS CRIADOS:
-----------------
1. docker-compose.yml (raiz do projeto)
   - Serviços: n8n, evolution-api, postgres, redis
   - Volumes persistentes configurados
   - Healthcheck em todos os serviços

2. iniciar_tudo.bat (raiz do projeto)
   - Sobe containers Docker
   - Aguarda 5 segundos
   - Inicia TMS (npm run dev)

3. parar_tudo.bat (raiz do projeto)
   - Para todos os containers Docker

PORTAS CONFIGURADAS:
-------------------
- n8n: 5679 (externa) -> 5678 (interna) [5678 estava em uso]
- evolution-api: 8081 (externa) -> 8080 (interna) [8080 estava em uso]
- postgres: 5432
- redis: 6379

ACESSOS:
-------
- n8n: http://localhost:5679
  Usuário: admin
  Senha: 123456

- evolution-api: http://localhost:8081

COMANDO ÚNICO PARA SUBIR TUDO:
------------------------------
Basta executar na raiz do projeto:
  iniciar_tudo.bat

OU manualmente:
  docker-compose up -d && timeout /t 5 && npm run dev

COMO PARAR TUDO:
---------------
  parar_tudo.bat

OBSERVAÇÕES:
------------
- O docker-compose.yml foi ajustado para não conflitar com portas já em uso
- O TMS não foi alterado, apenas adicionada infraestrutura externa
- Todos os serviços têm restart: always para inicialização automática
- Volumes persistentes garantem que dados não sejam perdidos
==============================================
