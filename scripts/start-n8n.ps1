# Iniciar e Verificar n8n
# Execute: .\scripts\start-n8n.ps1

$ComposeFile = "C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub\docker\n8n\docker-compose.simple.yml"
$DataDir = "C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub\docker\n8n\data"

Write-Host "=== N8N TMS - VERIFICAÇÃO ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar pasta de dados
Write-Host "1. Verificando pasta de dados..." -ForegroundColor Yellow
if (Test-Path $DataDir) {
    Write-Host "   ✓ Pasta existe: $DataDir" -ForegroundColor Green
    Get-ChildItem $DataDir | ForEach-Object {
        Write-Host "   - $($_.Name)" -ForegroundColor White
    }
} else {
    Write-Host "   ✗ Pasta não existe, criando..." -ForegroundColor Red
    New-Item -ItemType Directory -Path $DataDir -Force
    New-Item -ItemType Directory -Path "$DataDir\workflows" -Force
    New-Item -ItemType Directory -Path "$DataDir\credentials" -Force
    New-Item -ItemType Directory -Path "$DataDir\evolution" -Force
}

# 2. Iniciar containers
Write-Host "`n2. Iniciando containers..." -ForegroundColor Yellow
Set-Location (Split-Path $ComposeFile)
docker-compose -f $ComposeFile up -d

# 3. Verificar containers
Write-Host "`n3. Verificando containers..." -ForegroundColor Yellow
docker ps --filter "name=n8n" --filter "name=evolution" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 4. Verificar volumes
Write-Host "`n4. Volumes persistentes:" -ForegroundColor Yellow
docker volume ls --filter "name=n8n"

# 5. Verificar healthcheck
Write-Host "`n5. Healthcheck..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

$Health = Invoke-WebRequest -Uri "http://localhost:5678/healthz" -UseBasicParsing -ErrorAction SilentlyContinue
if ($Health.StatusCode -eq 200) {
    Write-Host "   ✓ n8n respondendo na porta 5678" -ForegroundColor Green
} else {
    Write-Host "   ✗ n8n não respondendo ainda, aguarde..." -ForegroundColor Yellow
}

# 6. Testar evolução
Write-Host "`n6. Evolution API..." -ForegroundColor Yellow
$EvolutionHealth = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -ErrorAction SilentlyContinue
if ($EvolutionHealth.StatusCode -eq 200) {
    Write-Host "   ✓ Evolution API respondendo na porta 8080" -ForegroundColor Green
} else {
    Write-Host "   ✗ Evolution API não respondendo ainda" -ForegroundColor Yellow
}

# 7. URLs de acesso
Write-Host "`n=== ACESSO ===" -ForegroundColor Cyan
Write-Host "n8n:          http://localhost:5678" -ForegroundColor White
Write-Host "Evolution:    http://localhost:8080" -ForegroundColor White

Write-Host "`n=== VERIFICAÇÃO CONCLUÍDA ===" -ForegroundColor Green