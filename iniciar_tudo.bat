@echo off
echo ================================================
echo Iniciando infraestrutura (Docker Compose)...
echo ================================================
docker-compose up -d

echo Aguardando 5 segundos para os servicos estabilizarem...
timeout /t 5 /nobreak > nul

echo ================================================
echo Iniciando TMS (npm run dev)...
echo ================================================
npm run dev
