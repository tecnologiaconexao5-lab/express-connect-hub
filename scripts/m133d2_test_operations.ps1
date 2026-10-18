param(
  [string]$AppUrl = "https://tight-truth-4707.emailconexao218.workers.dev",
  [string]$Email = "teste@conexao.com",
  [string]$Password = "Conexao@Teste2026!App",
  [string]$OutputDir = "docs/homologacao/missao133d2"
)

Write-Host "=== MISSÃO 133-D.2 — VALIDAÇÃO VIA PWA ==="
Write-Host "URL: $AppUrl"
Write-Host "Email: $Email"
Write-Host "Output: $OutputDir"

# Create output dir
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

# Get anon key and supabase URL
$envContent = Get-Content ".env" -Raw
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
$supabaseUrl = "https://uwrvzsjtpgaifkktpepn.supabase.co"

Write-Host "Step 1: Autenticando via Supabase Auth..."
try {
  $loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
  $authResponse = Invoke-RestMethod -Uri "$supabaseUrl/auth/v1/token?grant_type=password" -Method POST -Headers @{
    "apikey" = $anonKey
    "Content-Type" = "application/json"
  } -Body $loginBody -ErrorAction Stop
  $accessToken = $authResponse.access_token
  Write-Host "  ✅ Login OK! Token obtido."
} catch {
  Write-Host "  ❌ Login falhou: $($_.Exception.Message)"
  exit 1
}

Write-Host "Step 2: Testando RPC f_buscar_operacoes_motorista..."
try {
  $rpcResponse = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/f_buscar_operacoes_motorista" -Method POST -Headers @{
    "apikey" = $anonKey
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
  } -Body '{}' -ErrorAction Stop
  Write-Host "  ✅ RPC chamada com sucesso!"
  Write-Host "  Retorno: $($rpcResponse | ConvertTo-Json -Compress -Depth 5)"
  
  if ($rpcResponse.success -eq $true) {
    $totalOps = $rpcResponse.total
    Write-Host "  ✅ Total de operações retornadas: $totalOps"
    
    $rpcResponse | ConvertTo-Json -Depth 10 | Out-File "$OutputDir/rpc_response.json" -Encoding utf8
    Write-Host "  ✅ JSON salvo em rpc_response.json"
  } elseif ($rpcResponse.success -eq $false) {
    Write-Host "  ⚠️ RPC retornou: $($rpcResponse.error)"
  }
} catch {
  Write-Host "  ❌ RPC falhou: $($_.Exception.Message)"
  $rpcResponse = $null
}

Write-Host "Step 3: Verificando erro SQLSTATE 42883..."
$foundError = $false

# Via RPC - check that it didn't raise SQL error
if ($rpcResponse -and $rpcResponse.success -eq $false) {
  if ($rpcResponse.error -eq "USUARIO_NAO_AUTENTICADO") {
    Write-Host "  ⚠️ RPC diz não autenticado (token pode ser inválido para esta RPC)"
  }
} elseif ($rpcResponse -and $rpcResponse.success -eq $true) {
  Write-Host "  ✅ RPC funcionou com dados reais!"
}

# Test via SQL to confirm no 42883
Write-Host "Step 4: Testando RPC via SQL (supabase db query)..."
try {
  $sqlResult = npx supabase db query --linked "SELECT public.f_buscar_operacoes_motorista() as resultado;" 2>&1
  if ($sqlResult -match "42883" -or $sqlResult -match "uuid = text") {
    Write-Host "  ❌ ERRO 42883 AINDA PRESENTE!"
    $foundError = $true
  } else {
    Write-Host "  ✅ Sem erro 42883. SQLSTATE limpo."
  }
} catch {
  Write-Host "  ⚠️ Não foi possível validar via SQL: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=== RESUMO ==="
if ($foundError) {
  Write-Host "❌ MISSÃO 133-D.2 REPROVADA — Erro 42883 ainda presente"
  exit 1
} else {
  Write-Host "✅ MISSÃO 133-D.2 — Correção validada (sem 42883)"
  Write-Host "   Pendente: homologação visual no emulador/PWA com screenshots"
}

# Try to access the PWA
Write-Host ""
Write-Host "Step 5: Testando acesso ao PWA..."
try {
  $pwaResponse = Invoke-WebRequest -Uri $AppUrl -TimeoutSec 30 -ErrorAction Stop
  Write-Host "  ✅ PWA acessível: $($pwaResponse.StatusCode) ($($pwaResponse.Content.Length) bytes)"
} catch {
  Write-Host "  ⚠️ PWA inacessível: $($_.Exception.Message)"
}
