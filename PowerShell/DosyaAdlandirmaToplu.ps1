# ==========================================
# SURUKLE - BIRAK DOSYA YENIDEN ADLANDIRMA
# ==========================================
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$dateStr = Get-Date -Format "yyyyMMdd"
$selectedFiles = $args

if (-not $selectedFiles -or $selectedFiles.Count -eq 0) {
    Write-Host "[HATA] Dosya algilanamadi!" -ForegroundColor Red
    Write-Host "Lutfen dosyalari mouse ile tutup bu bat dosyasinin uzerine birakin." -ForegroundColor Yellow
    Pause
    exit
}

$fileCount = $selectedFiles.Count

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Secilen Dosya Sayisi: $fileCount" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
foreach ($f in $selectedFiles) {
    if (Test-Path $f) {
        Write-Host " - $(Split-Path $f -Leaf)" -ForegroundColor Gray
    }
}
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# SENARYO 1: TEK DOSYA BIRAKILDIYSA (Tarih ve akilli bosluk temizligi ile)
if ($fileCount -eq 1) {
    $file = $selectedFiles[0]
    if (-not (Test-Path $file)) { Write-Host "Dosya bulunamadi." -ForegroundColor Red; Pause; exit }

    $extension = [System.IO.Path]::GetExtension($file)
    
    $projectName = Read-Host "Proje Adi"
    $companyName = Read-Host "Firma Adi"
    $subject     = Read-Host "Dosya Konusu"

    if ([string]::IsNullOrWhiteSpace($projectName)) {
        Write-Host "Proje adi girilmedi. Islem iptal edildi." -ForegroundColor Red
        Pause
        exit
    }

    $parts = @()
    if (-not [string]::IsNullOrWhiteSpace($projectName)) { $parts += $projectName.Trim() }
    if (-not [string]::IsNullOrWhiteSpace($companyName)) { $parts += $companyName.Trim() }
    if (-not [string]::IsNullOrWhiteSpace($subject))     { $parts += $subject.Trim() }
    $parts += $dateStr

    $newFileName = ($parts -join "_") + $extension

    try {
        Rename-Item -LiteralPath $file -NewName $newFileName -Force
        Write-Host ""
        Write-Host "[BASARILI] Dosya adi degistirildi!" -ForegroundColor Green
        Write-Host "Yeni Isim: $newFileName" -ForegroundColor Yellow
    } catch {
        Write-Host "[HATA] $_" -ForegroundColor Red
    }
}
# SENARYO 2: BIRDEN FAZLA DOSYA BIRAKILDIYSA (Tarihsiz, sadece ortak isim ve sira numarasi)
else {
    $commonName = Read-Host "Toplu Dosyalar Icin Ortak Isim"

    if ([string]::IsNullOrWhiteSpace($commonName)) {
        Write-Host "Ortak isim girilmedi. Islem iptal edildi." -ForegroundColor Red
        Pause
        exit
    }

    $index = 1
    foreach ($file in $selectedFiles) {
        if (Test-Path $file) {
            $extension = [System.IO.Path]::GetExtension($file)
            $newFileName = "${commonName}_${index}${extension}"

            try {
                Rename-Item -LiteralPath $file -NewName $newFileName -Force
                Write-Host "[BASARILI] ($index/$fileCount) Yeniden Adlandirildi: $newFileName" -ForegroundColor Green
            } catch {
                Write-Host "[HATA] Dosya adi degistirilemedi: $_" -ForegroundColor Red
            }
            $index++
        }
    }
}

Write-Host ""
Write-Host "Tum islemler tamamlandi." -ForegroundColor Cyan
Pause