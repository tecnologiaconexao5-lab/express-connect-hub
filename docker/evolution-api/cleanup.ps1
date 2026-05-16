param(
  [switch]$Force
)

Write-Host "=== LIMPEZA TOTAL — Evolution API + n8n ===" -ForegroundColor Yellow
Write-Host ""

if (-not $Force) {
  Write-Host "ATENCAO: Isso vai remover TODOS os containers, volumes e dados:" -ForegroundColor Red
  Write-Host "  - Postgres (evolution_db, n8n_db)" -ForegroundColor Red
  Write-Host "  - Redis (cache)" -ForegroundColor Red
  Write-Host "  - Instancias da Evolution API" -ForegroundColor Red
  Write-Host "  - Dados do n8n" -ForegroundColor Red
  Write-Host ""
  $confirm = Read-Host "Tem certeza? (digite 'SIM' para confirmar)"
  if ($confirm -ne "SIM") {
    Write-Host "Cancelado." -ForegroundColor Green
    exit
  }
}

Write-Host "[1/4] Parando containers..." -ForegroundColor Cyan
docker-compose -f "$PSScriptRoot\..\..\docker-compose.yml" down --remove-orphans 2>$null

Write-Host "[2/4] Removendo volumes antigos..." -ForegroundColor Cyan
docker volume rm tms_pg_data 2>$null
docker volume rm tms_redis_data 2>$null
docker volume rm tms_n8n_data 2>$null
docker volume rm tms_evolution_instances 2>$null

# Also remove old standalone volumes
docker volume rm evolution-api_postgres_data 2>$null
docker volume rm evolution-api_redis_data 2>$null
docker volume rm evolution-api_evolution_instances 2>$null

Write-Host "[3/4] Removendo containers antigos (se houver)..." -ForegroundColor Cyan
docker rm -f tms_postgres 2>$null
docker rm -f tms_redis 2>$null
docker rm -f tms_n8n 2>$null
docker rm -f tms_evolution 2>$null
docker rm -f evolution-api 2>$null
docker rm -f postgres 2>$null
docker rm -f redis 2>$null
docker rm -f evolution_api 2>$null
docker rm -f n8n_tms 2>$null

Write-Host "[4/4] Removendo dados locais de sessao..." -ForegroundColor Cyan
$sessionsDir = "$env:USERPROFILE\.evolution-http"
if (Test-Path $sessionsDir) {
  Remove-Item -Recurse -Force $sessionsDir -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "=== LIMPEZA CONCLUIDA ===" -ForegroundColor Green
Write-Host "Execute o script 'start.ps1' para subir tudo do zero." -ForegroundColor Yellow
