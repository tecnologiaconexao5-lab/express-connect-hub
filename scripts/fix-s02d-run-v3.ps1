param(
    [int]$MaxWait = 300
)

$ErrorActionPreference = "Continue"
$workDir = "C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub"
$img = "public.ecr.aws/supabase/postgres:17.6.1.147"
$vol = "supabase_db_express-connect-hub"
$net = "supabase_network_express-connect-hub"
$port = 54322

Write-Host "=== S02D FIX RUNNER v3 ==="

# 1. Cleanup
Write-Host "[1] Cleanup..."
docker rm -f supabase_db_express-connect-hub 2>$null
docker volume rm $vol 2>$null
docker network rm $net 2>$null

# 2. Create volume + network
Write-Host "[2] Criando volume e network..."
docker volume create $vol | Out-Null
docker network create $net 2>$null | Out-Null

# 3. Start postgres manually
Write-Host "[3] Iniciando postgres..."
docker run -d --name supabase_db_express-connect-hub `
  --network $net `
  -p "${port}:5432" `
  -v "${vol}:/var/lib/postgresql/data" `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=postgres `
  -e POSTGRES_HOST_AUTH_METHOD=trust `
  $img | Out-Null

# 4. Wait for healthy
Write-Host "[4] Aguardando DB healthy..."
$elapsed = 0
while ($elapsed -lt $MaxWait) {
    $status = docker inspect --format='{{.State.Health.Status}}' supabase_db_express-connect-hub 2>$null
    if ($status -eq "healthy") {
        Write-Host "    DB healthy em ${elapsed}s"
        break
    }
    Start-Sleep -Seconds 3
    $elapsed += 3
}
if ($elapsed -ge $MaxWait) { Write-Host "TIMEOUT"; exit 1 }

# 5. Wait for schema to appear (CLI init creates it)
Write-Host "[5] Aguardando schema supabase_migrations..."
$schemaFound = $false
$elapsed2 = 0
while ($elapsed2 -lt $MaxWait) {
    $check = docker exec supabase_db_express-connect-hub psql -U postgres -t -c "SELECT 1 FROM pg_namespace WHERE nspname='supabase_migrations'" 2>&1
    if ($check -match "1") {
        Write-Host "    Schema encontrado em ${elapsed2}s"
        $schemaFound = $true
        break
    }
    Start-Sleep -Seconds 2
    $elapsed2 += 2
}
if (-not $schemaFound) {
    Write-Host "    Schema NAO encontrado. Criando manualmente..."
    docker exec supabase_db_express-connect-hub psql -U postgres -c "
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT,
        statements TEXT[]
      );
      ALTER SCHEMA supabase_migrations OWNER TO postgres;
    " 2>&1
}

# 6. Apply fix — comprehensive
Write-Host "[6] Aplicando fix de permissoes..."
$fixResult = docker exec supabase_db_express-connect-hub psql -U postgres -c "
  -- Grant to ALL possible roles
  GRANT ALL ON SCHEMA supabase_migrations TO postgres;
  GRANT ALL ON SCHEMA supabase_migrations TO supabase_admin;
  GRANT ALL ON SCHEMA supabase_migrations TO authenticated;
  GRANT ALL ON SCHEMA supabase_migrations TO service_role;
  
  GRANT ALL ON ALL TABLES IN SCHEMA supabase_migrations TO postgres;
  GRANT ALL ON ALL TABLES IN SCHEMA supabase_migrations TO supabase_admin;
  GRANT ALL ON ALL TABLES IN SCHEMA supabase_migrations TO authenticated;
  GRANT ALL ON ALL TABLES IN SCHEMA supabase_migrations TO service_role;
  
  GRANT ALL ON ALL SEQUENCES IN SCHEMA supabase_migrations TO postgres;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA supabase_migrations TO supabase_admin;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA supabase_migrations TO authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA supabase_migrations TO service_role;
  
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_migrations GRANT ALL ON TABLES TO postgres;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_migrations GRANT ALL ON TABLES TO supabase_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_migrations GRANT ALL ON TABLES TO authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA supabase_migrations GRANT ALL ON TABLES TO service_role;

  -- Also grant on public schema just in case
  GRANT USAGE ON SCHEMA public TO supabase_admin;
  
  -- Verify
  SELECT grantee, privilege_type FROM information_schema.schema_privileges WHERE schema_name = 'supabase_migrations' ORDER BY grantee;
" 2>&1
Write-Host "    Fix result: $fixResult"

# 7. Run supabase start --exclude postgres
Write-Host "[7] Rodando supabase start --exclude postgres..."
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$workDir`" && npx supabase start --exclude postgres 2>&1" -PassThru -NoNewWindow
$proc.WaitForExit()
$exitCode = $proc.ExitCode
Write-Host "    supabase start exit code: $exitCode"

# 8. Status
Write-Host "[8] supabase status..."
npx supabase status 2>&1

Write-Host ""
Write-Host "=== FIM (exit: $exitCode) ==="
