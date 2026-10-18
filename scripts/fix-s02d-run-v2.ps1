param(
    [int]$PollInterval = 2,
    [int]$MaxWait = 300
)

$ErrorActionPreference = "SilentlyContinue"
$workDir = "C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub"
$fixSQL = "GRANT ALL ON SCHEMA supabase_migrations TO supabase_admin; ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_migrations GRANT ALL ON TABLES TO supabase_admin; GRANT ALL ON ALL TABLES IN SCHEMA supabase_migrations TO supabase_admin;"

Write-Host "=== S02D FIX RUNNER ==="
Write-Host "Poll interval: ${PollInterval}s | Max wait: ${MaxWait}s"

# Start supabase start as a detached process
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$workDir`" && npx supabase start 2>&1 > `"$env:TEMP\ss_out2.txt`"" -PassThru -WindowStyle Hidden
Write-Host "supabase started as PID $($proc.Id)"

$elapsed = 0
$applied = $false
$containerGone = $false

while ($elapsed -lt $MaxWait) {
    # Check if process is still running
    $procCheck = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
    if (-not $procCheck) {
        Write-Host "[${elapsed}s] Process ended"
        break
    }

    # Check if DB container exists
    $containerStatus = docker ps -a --filter "name=supabase_db_express-connect-hub" --format "{{.Status}}" 2>&1

    if ($containerStatus -match "Up") {
        # Try to apply fix
        $result = docker exec supabase_db_express-connect-hub psql -U postgres -c "$fixSQL" 2>&1

        if ($LASTEXITCODE -eq 0 -and $result -notmatch "error|denied|does not exist") {
            Write-Host "[${elapsed}s] FIX APLICADO COM SUCESSO!"
            Write-Host "Result: $result"
            $applied = $true
            break
        } else {
            if ($elapsed % 10 -eq 0) {
                Write-Host "[${elapsed}s] Container UP, aguardando schema... ($result)"
            }
        }
    } else {
        if ($elapsed % 15 -eq 0) {
            Write-Host "[${elapsed}s] Container ainda nao existe ou foi derrubado"
        }
    }

    Start-Sleep -Seconds $PollInterval
    $elapsed += $PollInterval
}

if ($applied) {
    Write-Host ""
    Write-Host "=== FIX APLICADO. Aguardando supabase start finalizar ==="
    # Wait for the process to finish
    $proc.WaitForExit()
    Write-Host "=== supabase start finalizou (exit code: $($proc.ExitCode)) ==="

    # Show output
    Write-Host ""
    Write-Host "=== OUTPUT ==="
    Get-Content "$env:TEMP\ss_out2.txt" -ErrorAction SilentlyContinue
} else {
    Write-Host ""
    Write-Host "=== FIX NAO APLICOU ==="
    Write-Host "Container status: $containerStatus"
    Get-Content "$env:TEMP\ss_out2.txt" -ErrorAction SilentlyContinue
}
