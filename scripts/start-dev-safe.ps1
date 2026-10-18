param(
  [string]$Port = "8800",
  [int]$TimeoutSeconds = 60
)

Write-Output "=== START-DEV-SAFE ==="
Write-Output "Porta: $Port"
Write-Output "Timeout: ${TimeoutSeconds}s"

# 1. Matar processos node antigos
Write-Output "[1/5] Matando processos node antigos..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Liberar porta
Write-Output "[2/5] Liberando porta $Port ..."
$connections = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
foreach ($conn in $connections) {
  $parts = $conn -split '\s+'
  $pid = $parts[-1]
  if ($pid -match '^\d+$') {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 1

# 3. Verificar porta livre
Write-Output "[3/5] Verificando porta $Port ..."
$check = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
if ($check) {
  Write-Error "Porta $Port ainda ocupada. Abortando."
  exit 1
}
Write-Output "  OK: Porta $Port livre."

# 4. Iniciar Vite com log e timeout
Write-Output "[4/5] Iniciando 'npm run dev -- --host 0.0.0.0 --port $Port --strictPort' ..."
$logFile = Join-Path $PSScriptRoot "..\vite-dev.log"
$job = Start-Job -ScriptBlock {
  param($port)
  $env:CI = "false"
  Set-Location -LiteralPath $using:PSScriptRoot\..
  npm run dev -- --host 0.0.0.0 --port $port --strictPort 2>&1
} -ArgumentList $Port

$elapsed = 0
$start = Get-Date
$ok = $false

while ($elapsed -lt $TimeoutSeconds) {
  Start-Sleep -Seconds 2
  $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds)

  # Testar se Vite subiu
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
      $ok = $true
      break
    }
  } catch {
    # ainda subindo - normal
  }
}

if (-not $ok) {
  Write-Error "[ERRO] Vite não subiu em ${TimeoutSeconds}s. Capturando log..."
  $jobOutput = Receive-Job -Job $job -Keep -ErrorAction SilentlyContinue
  Write-Output "=== LOG DO VITE ==="
  $jobOutput | ForEach-Object { Write-Output $_ }
  Write-Output "=== FIM DO LOG ==="
  Stop-Job -Job $job -ErrorAction SilentlyContinue
  Remove-Job -Job $job -ErrorAction SilentlyContinue
  exit 1
}

Write-Output "[5/5] VITE OK EM http://localhost:$Port (${elapsed}s)"
Write-Output "=== PRONTO ==="
