param(
    [switch]$SkipCreateInstance
)

Write-Host "=== INICIALIZACAO - Evolution API ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[Passo 1] Verificando container tms_evolution..." -ForegroundColor Yellow
$running = docker ps --filter "name=tms_evolution" --filter "status=running" --format "{{.Names}}"

if ($running -eq "tms_evolution") {
    Write-Host "  Container tms_evolution ja esta rodando. Pulando docker compose up." -ForegroundColor Green
} else {
    Write-Host "  Container nao encontrado. Subindo containers..." -ForegroundColor Cyan
    docker-compose -f "$PSScriptRoot\..\..\docker-compose.yml" up -d

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: Falha ao subir containers." -ForegroundColor Red
        exit 1
    }
}

Write-Host "[Passo 2] Aguardando Evolution API..." -ForegroundColor Yellow
$maxRetries = 30
$retry = 0
do {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8080" -ErrorAction SilentlyContinue
        if ($response.status -eq 200) { break }
    } catch {}
    $retry++
    Write-Host "  Aguardando... ($retry/$maxRetries)" -ForegroundColor Gray
} while ($retry -lt $maxRetries)

if ($retry -ge $maxRetries) {
    Write-Host "ERRO: Evolution API nao respondeu a tempo." -ForegroundColor Red
    docker logs tms_evolution --tail 50
    exit 1
}

Write-Host "  Evolution API esta ONLINE!" -ForegroundColor Green

$envPath = "$PSScriptRoot\..\..\.env"
$apiKey = "123456"
if (Test-Path $envPath) {
    $lines = Get-Content $envPath
    foreach ($line in $lines) {
        if ($line -match '^EVOLUTION_API_KEY=(.+)') {
            $apiKey = $matches[1]
            break
        }
    }
}
Write-Host "  API Key: $apiKey" -ForegroundColor Gray

if (-not $SkipCreateInstance) {
    Write-Host ""
    Write-Host "[Passo 3] Verificando instancia tms..." -ForegroundColor Yellow

    $instanceExists = $false
    try {
        $instances = Invoke-RestMethod -Uri "http://localhost:8080/instance/fetchInstances" -Method Get -Headers @{"apikey" = $apiKey} -ErrorAction SilentlyContinue
        if ($instances -is [array]) {
            foreach ($inst in $instances) {
                if ($inst.instanceName -eq "tms") {
                    $instanceExists = $true
                    break
                }
            }
        }
    } catch {}

    if (-not $instanceExists) {
        Write-Host "[Passo 4] Criando instancia tms..." -ForegroundColor Cyan
        $body = @{instanceName = "tms"; integration = "WHATSAPP-BAILEYS"} | ConvertTo-Json
        try {
            $instance = Invoke-RestMethod -Uri "http://localhost:8080/instance/create" -Method Post -Headers @{
                "apikey"       = $apiKey
                "Content-Type" = "application/json"
            } -Body $body
            Write-Host "  Instancia criada:" -ForegroundColor Green
            $instance | ConvertTo-Json -Depth 3 | Write-Host
        } catch {
            Write-Host "  Erro ao criar instancia: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  Instancia tms ja existe." -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "[Passo 5] Conectando instancia tms..." -ForegroundColor Cyan
    try {
        $qr = Invoke-RestMethod -Uri "http://localhost:8080/instance/connect/tms" -Method Get -Headers @{"apikey" = $apiKey}

        if ($qr.base64) {
            Write-Host "  QR Code gerado!" -ForegroundColor Green

            $base64img = $qr.base64
            $htmlPath = "$PSScriptRoot\qr-tms.html"

            $htmlTemplate = @'
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>QR Code TMS</title>
<style>
body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;margin:0;font-family:sans-serif}
.card{background:white;padding:40px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.12);text-align:center}
img{width:350px;height:350px;border:4px solid #198754;border-radius:12px}
h2{color:#198754;margin-top:0}
</style></head><body>
<div class="card">
<h2>WhatsApp TMS</h2>
<img src="__BASE64__" alt="QR Code">
<p>Escaneie com o WhatsApp do celular</p>
</div></body></html>
'@
            $html = $htmlTemplate -replace '__BASE64__', $base64img
            Set-Content -Path $htmlPath -Value $html -Encoding UTF8
            Write-Host "  QR Code salvo em: docker/evolution-api/qr-tms.html" -ForegroundColor Yellow
            Start-Process $htmlPath
        } else {
            Write-Host "  Resposta do connect:" -ForegroundColor Yellow
            $qr | ConvertTo-Json -Depth 3 | Write-Host
        }
    } catch {
        Write-Host "  Erro ao conectar:" -ForegroundColor Yellow
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $reader.ReadToEnd() | Write-Host
        } catch {
            Write-Host "  $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    Write-Host "[Passo 6] Estado da conexao..." -ForegroundColor Yellow
    try {
        $state = Invoke-RestMethod -Uri "http://localhost:8080/instance/connectionState/tms" -Method Get -Headers @{"apikey" = $apiKey}
        Write-Host "  Estado:" -ForegroundColor White
        $state | ConvertTo-Json -Depth 2 | Write-Host
    } catch {
        Write-Host "  Nao foi possivel verificar estado." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TUDO PRONTO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Endpoints:" -ForegroundColor White
Write-Host "  Evolution API: http://localhost:8080" -ForegroundColor Yellow
Write-Host "  n8n:           http://localhost:5679" -ForegroundColor Yellow
Write-Host "  QR Code:       docker/evolution-api/qr-tms.html" -ForegroundColor Yellow
Write-Host ""
Write-Host "Teste de envio:" -ForegroundColor White
Write-Host "  Invoke-RestMethod -Uri http://localhost:8080/message/sendText/tms -Method Post -Headers @{apikey='$apiKey'; 'Content-Type'='application/json'} -Body (ConvertTo-Json @{number='5511912133010'; text='Teste Evolution TMS'})" -ForegroundColor Yellow
Write-Host ""
Write-Host "Logs:" -ForegroundColor White
Write-Host "  docker logs tms_evolution -f" -ForegroundColor Gray
Write-Host "  docker logs tms_n8n -f" -ForegroundColor Gray
