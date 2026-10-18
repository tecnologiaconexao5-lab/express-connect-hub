# ============================================================
# FIN-SANE-02D — Execution Script
# Data: 2026-09-15
# Ambiente: LOCAL APENAS — Producao ZERO WRITES
# ============================================================
# PRE-REQUISITO: Docker Desktop INICIADO
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts/fix-s02d-run.ps1
# ============================================================

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "FIN-SANE-02D — Fix supabase_migrations permissions" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Docker
Write-Host "[1/7] Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerPs = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker nao esta rodando" }
    Write-Host "  OK: Docker esta ativo" -ForegroundColor Green
} catch {
    Write-Host "  ERRO: Docker Desktop nao esta rodando!" -ForegroundColor Red
    Write-Host "  Inicie Docker Desktop e execute novamente." -ForegroundColor Red
    exit 1
}

# 2. Listar containers Supabase
Write-Host "[2/7] Procurando containers Supabase..." -ForegroundColor Yellow
$containers = docker ps -a --filter "name=supabase" --format "{{.Names}} {{.Status}}" 2>&1
if ($containers -match "supabase") {
    Write-Host "  Containers encontrados:" -ForegroundColor Green
    $containers | ForEach-Object { Write-Host "    $_" }
} else {
    Write-Host "  Nenhum container Supabase encontrado." -ForegroundColor Yellow
    Write-Host "  O Supabase ainda nao foi iniciado neste projeto." -ForegroundColor Yellow
    Write-Host "  Execute: npx supabase start" -ForegroundColor Yellow
    Write-Host "  (ira falhar, mas criara os containers. Depois execute este script novamente.)" -ForegroundColor Yellow
    exit 1
}

# 3. Encontrar container do banco
$dbContainer = docker ps -a --filter "name=supabase" --format "{{.Names}}" | Where-Object { $_ -match "db" } | Select-Object -First 1
if (-not $dbContainer) {
    Write-Host "  Container de banco nao encontrado. Tentando primeiro container..." -ForegroundColor Yellow
    $dbContainer = docker ps -a --filter "name=supabase" --format "{{.Names}}" | Select-Object -First 1
}

Write-Host "  Container DB: $dbContainer" -ForegroundColor Green

# 4. Iniciar container se parado
$state = docker inspect --format '{{.State.Status}}' $dbContainer 2>&1
if ($state -ne "running") {
    Write-Host "[3/7] Iniciando container DB..." -ForegroundColor Yellow
    docker start $dbContainer
    Write-Host "  Aguardando 5s para DB inicializar..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
} else {
    Write-Host "[3/7] Container DB ja esta rodando" -ForegroundColor Green
}

# 5. Executar SQL de correcao
Write-Host "[4/7] Executando SQL de correcao..." -ForegroundColor Yellow
$sqlFile = Join-Path $PSScriptRoot "fix-s02d-supabase-migrations-perms.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "  ERRO: Arquivo SQL nao encontrado: $sqlFile" -ForegroundColor Red
    exit 1
}

# Copiar SQL para dentro do container e executar
docker cp $sqlFile "${dbContainer}:/tmp/fix-perms.sql"
$result = docker exec $dbContainer psql -U postgres -d postgres -f /tmp/fix-perms.sql 2>&1
Write-Host "  Resultado SQL:" -ForegroundColor Green
$result | ForEach-Object { Write-Host "    $_" }

# 6. Verificar
Write-Host "[5/7] Verificando permissoes..." -ForegroundColor Yellow
$verify = docker exec $dbContainer psql -U postgres -d postgres -c "
SELECT schema_name, schema_owner
FROM information_schema.schemata
WHERE schema_name = 'supabase_migrations';
" 2>&1
$verify | ForEach-Object { Write-Host "    $_" }

$verify2 = docker exec $dbContainer psql -U postgres -d postgres -c "
SELECT grantee, privilege_type
FROM information_schema.schema_privileges
WHERE schema_name = 'supabase_migrations';
" 2>&1
$verify2 | ForEach-Object { Write-Host "    $_" }

# 7. Parar container
Write-Host "[6/7] Parando container DB..." -ForegroundColor Yellow
docker stop $dbContainer | Out-Null
Write-Host "  Container parado" -ForegroundColor Green

Write-Host "[7/7] Pronto!" -ForegroundColor Green
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "PROXIMO PASSO: Execute npx supabase start" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Se supabase start funcionar:" -ForegroundColor Green
Write-Host "  npx supabase status" -ForegroundColor White
Write-Host ""
Write-Host "Se supabase start falhar:" -ForegroundColor Red
Write-Host "  PARAR. Nao tentar outras solucoes." -ForegroundColor Red
