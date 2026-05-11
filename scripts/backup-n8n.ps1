# Backup Automático do n8n
# Execute: .\scripts\backup-n8n.ps1

$BackupDir = "C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub\docker\n8n\data\backup"
$SourceDir = "C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub\docker\n8n\data"
$Date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupName = "n8n_backup_$Date.zip"

# Criar diretório de backup se não existir
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force
}

Write-Host "=== BACKUP N8N TMS ===" -ForegroundColor Cyan
Write-Host "Iniciando backup..."

# Parar containers antes do backup (opcional - garante consistência)
Write-Host "Parando containers..."
docker-compose -f "C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub\docker\n8n\docker-compose.yml" down 2>$null

# Criar arquivo compactado
Write-Host "Compactando dados..."
Compress-Archive -Path "$SourceDir\*" -DestinationPath "$BackupDir\$BackupName" -Force

# Listar arquivos de backup
Write-Host "`nBackups disponíveis:" -ForegroundColor Yellow
Get-ChildItem $BackupDir | Sort-Object LastWriteTime -Descending | Select-Object Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}}, LastWriteTime

# Remover backups antigos (manter últimos 10)
$OldBackups = Get-ChildItem $BackupDir | Sort-Object LastWriteTime -Descending | Select-Object -Skip 10
foreach ($Old in $OldBackups) {
    Write-Host "Removendo backup antigo: $($Old.Name)" -ForegroundColor Gray
    Remove-Item $Old.FullName -Force
}

# Iniciar containers novamente
Write-Host "`nIniciando containers..."
docker-compose -f "C:\Users\DIEGO BALBINO\Desktop\Pasta Compartilhada\DOCUMENTOS EMPRESA\08_TECNOLOGIA_SISTEMAS\express-connect-hub\docker\n8n\docker-compose.yml" up -d

Write-Host "`n=== BACKUP CONCLUÍDO ===" -ForegroundColor Green
Write-Host "Arquivo: $BackupName" -ForegroundColor White
Write-Host "Local: $BackupDir" -ForegroundColor White