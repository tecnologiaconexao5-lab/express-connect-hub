param(
    [string]$workDir = "C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub",
    [string]$evidenceDir = "$env:TEMP\s02d-evidence"
)

$ErrorActionPreference = "Continue"
New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null

$debugOut = "$evidenceDir\supabase-start-debug.txt"
$pgLogs = "$evidenceDir\postgres-logs.txt"
$inspectionOut = "$evidenceDir\inspection.txt"

Write-Host "=== FIN-SANE-02D-42501 ROOT CAUSE REPRO ==="
Write-Host "Evidence dir: $evidenceDir"

# Cleanup only supabase containers/volumes
Write-Host "[1] Cleanup supabase containers/volumes..."
docker rm -f $(docker ps -a --filter "name=supabase" -q) 2>$null | Out-Null
docker volume rm $(docker volume ls -q --filter "name=supabase") 2>$null | Out-Null

# Start background log watcher
Write-Host "[2] Starting log watcher..."
$logWatcher = Start-Job -ScriptBlock {
    param($pgLogs)
    $captured = @()
    $started = $false
    for ($i = 0; $i -lt 300; $i++) {
        $containerId = docker ps -q --filter "name=supabase_db_express-connect-hub" 2>$null
        if ($containerId) {
            if (-not $started) {
                $started = $true
                # Start following logs
                docker logs -f $containerId 2>&1 | ForEach-Object { 
                    $_ | Out-File -Append -FilePath $pgLogs -Encoding utf8
                }
            }
        }
        Start-Sleep -Seconds 1
    }
} -ArgumentList $pgLogs

# Start supabase start --debug
Write-Host "[3] Running npx supabase start --debug (this may take 2-3 minutes)..."
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$workDir`" && npx supabase start --debug > `"$debugOut`" 2>&1" -PassThru -NoNewWindow

# Poll for 42501 and inspect immediately
$inspected = $false
$maxWait = 300
$elapsed = 0
while (-not $proc.HasExited -and $elapsed -lt $maxWait) {
    Start-Sleep -Seconds 2
    $elapsed += 2
    
    # Check if 42501 appeared in debug output
    if (Test-Path $debugOut) {
        $debugContent = Get-Content $debugOut -Raw -ErrorAction SilentlyContinue
        if ($debugContent -match "SQLSTATE 42501" -and -not $inspected) {
            Write-Host "    [${elapsed}s] 42501 detected in debug output. Inspecting DB immediately..."
            $containerId = docker ps -q --filter "name=supabase_db_express-connect-hub" 2>$null
            if ($containerId) {
                $sql = @"
SELECT 'CURRENT_USER' AS label, current_user::text AS value
UNION ALL
SELECT 'SESSION_USER', session_user::text;

SELECT 'SCHEMA_OWNER' AS label, n.nspname AS schema_name, r.rolname AS owner
FROM pg_namespace n JOIN pg_roles r ON n.nspowner = r.oid
WHERE n.nspname = 'supabase_migrations';

SELECT 'TABLE_OWNER' AS label, c.relname AS table_name, r.rolname AS owner
FROM pg_class c JOIN pg_roles r ON c.relowner = r.oid
WHERE c.relname = 'schema_migrations' AND c.relnamespace = 'supabase_migrations'::regnamespace;

SELECT 'SCHEMA_ACL' AS label, n.nspname AS schema_name, n.nspacl::text AS acl
FROM pg_namespace n WHERE n.nspname = 'supabase_migrations';

SELECT 'TABLE_ACL' AS label, c.relname AS table_name, c.relacl::text AS acl
FROM pg_class c WHERE c.relname = 'schema_migrations' AND c.relnamespace = 'supabase_migrations'::regnamespace;

SELECT 'SCHEMA_PRIVS' AS label, grantee, privilege_type
FROM information_schema.schema_privileges
WHERE schema_name = 'supabase_migrations';

SELECT 'TABLE_PRIVS' AS label, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations';

SELECT 'HAS_USAGE_SUPABASE_ADMIN' AS label, has_schema_privilege('supabase_admin', 'supabase_migrations', 'USAGE')::text AS value;

SELECT 'ROLES' AS label, rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb
FROM pg_roles WHERE rolname IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin');
"@
                docker exec $containerId psql -U postgres -c "$sql" 2>&1 | Out-File -Append -FilePath $inspectionOut -Encoding utf8
                Write-Host "    Inspection saved to $inspectionOut"
            } else {
                "CONTAINER NOT FOUND FOR INSPECTION" | Out-File -Append -FilePath $inspectionOut -Encoding utf8
            }
            $inspected = $true
        }
    }
}

if (-not $proc.HasExited) {
    Write-Host "    Timeout reached. Stopping process..."
    $proc.Kill()
    $proc.WaitForExit(5000)
}

$exitCode = $proc.ExitCode
Write-Host "    supabase start exit code: $exitCode"

# Stop log watcher
Stop-Job $logWatcher
Remove-Job $logWatcher -Force

# Final summary
Write-Host ""
Write-Host "=== EVIDENCE FILES ==="
Write-Host "Debug output: $debugOut ($(if(Test-Path $debugOut){(Get-Item $debugOut).Length}else{0}) bytes)"
Write-Host "Postgres logs: $pgLogs ($(if(Test-Path $pgLogs){(Get-Item $pgLogs).Length}else{0}) bytes)"
Write-Host "Inspection: $inspectionOut ($(if(Test-Path $inspectionOut){(Get-Item $inspectionOut).Length}else{0}) bytes)"

Write-Host ""
Write-Host "=== DEBUG TAIL ==="
if (Test-Path $debugOut) {
    Get-Content $debugOut -Tail 30
}

Write-Host ""
Write-Host "=== INSPECTION ==="
if (Test-Path $inspectionOut) {
    Get-Content $inspectionOut
}
