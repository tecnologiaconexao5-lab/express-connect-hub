$relatoriosDir = "docs\auditoria\relatorios"
$caminhoAbsoluto = Join-Path (Get-Location) $relatoriosDir

if (-not (Test-Path $relatoriosDir)) {
    Write-Host "Nenhum diretorio de relatorios encontrado em: $caminhoAbsoluto"
    exit 1
}

$arquivos = Get-ChildItem -Path $relatoriosDir -Filter "*.txt" | Sort-Object LastWriteTime -Descending

if ($arquivos.Count -eq 0) {
    Write-Host "Nenhum arquivo .txt encontrado em: $caminhoAbsoluto"
    exit 0
}

$maisRecente = $arquivos[0]
$caminhoCompleto = $maisRecente.FullName

Write-Host "Caminho absoluto : $caminhoCompleto"
Write-Host "Tamanho          : $($maisRecente.Length) bytes"
Write-Host "Data             : $($maisRecente.LastWriteTime)"
$hash = Get-FileHash -Path $caminhoCompleto -Algorithm SHA256
Write-Host "SHA256           : $($hash.Hash)"

Start-Process notepad.exe -ArgumentList "`"$caminhoCompleto`""

Get-Content -Raw $caminhoCompleto | Set-Clipboard

Write-Host ""
Write-Host "=================================="
Write-Host "RELATORIO COPIADO COM SUCESSO"
Write-Host "=================================="
