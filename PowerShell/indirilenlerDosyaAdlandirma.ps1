# ==========================================
# TÜRKÇE KARAKTER VE KODLAMA AYARLARI
# ==========================================
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$DownloadsPath = "$env:USERPROFILE\Downloads"
$BaseTargetPath = "\\192.168.1.4\Ortak\HAKED" + [char]0x0130 + "S - CEREN KAYA - YEDEK\Yi" + [char]0x011F + "it Hakedi" + [char]0x015F

# 1. İndirilenler klasöründeki son 10 dosyayı listele
$files = Get-ChildItem -Path $DownloadsPath -File | 
    Where-Object { $_.Extension -notmatch '\.(tmp|crdownload|part)$' } | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 10

if (-not $files) {
    Write-Host "Indirilenler klasorunde dosya bulunamadi." -ForegroundColor Red
    Pause
    exit
}

# 2. Kullanıcıya Seçim Listesi Gösterme
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " INDIRILENLER KLASORUNDEKI SON DOSYALAR" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

for ($i = 0; $i -lt $files.Count; $i++) {
    $num = $i + 1
    $fileName = $files[$i].Name
    $fileDate = $files[$i].LastWriteTime.ToString("dd.MM.yyyy HH:mm")
    Write-Host " [$num] $fileName  ($fileDate)" -ForegroundColor Yellow
}
Write-Host "==========================================" -ForegroundColor Cyan

# Kullanıcıdan dosya seçmesini iste
$selection = Read-Host "Islem yapmak istediginiz dosyanin numarasini girin (1-$($files.Count))"

# Seçimin geçerli olup olmadığını kontrol et
if ($selection -match '^\d+$' -and [int]$selection -ge 1 -and [int]$selection -le $files.Count) {
    $selectedFile = $files[[int]$selection - 1]
} else {
    Write-Host "Gecersiz secim yaptiniz. Islem iptal edildi." -ForegroundColor Red
    Pause
    exit
}

Write-Host ""
Write-Host "Secilen Dosya: $($selectedFile.Name)" -ForegroundColor Green
Write-Host ""

# 3. İnteraktif Bilgi Girdileri
$prefix      = Read-Host "Belge Kaynagi"
$projectName = Read-Host "Proje Adi / Parsel"
$firmName  = Read-Host "Firma Adi"
$subject     = Read-Host "Dosya Konusu"

if ([string]::IsNullOrWhiteSpace($projectName)) {
    Write-Host "Proje adi girilmedi. Islem iptal edildi." -ForegroundColor Red
    Pause
    exit
}

if ([string]::IsNullOrWhiteSpace($prefix)) {
    $prefix = "gelen"
}

# 4. Tarih Oluşturma ve Yeni İsim
$dateStr = Get-Date -Format "yyyyMMdd"
$extension = $selectedFile.Extension
$newFileName = "${prefix}_${projectName}_${firmName}_${subject}_${dateStr}${extension}"

$destinationPath = Join-Path -Path $BaseTargetPath -ChildPath $newFileName

# 5. Taşıma İşlemi (Direkt ana klasörün içine atar)
try {
    Move-Item -LiteralPath $selectedFile.FullName -Destination $destinationPath -Force
    Write-Host ""
    Write-Host "[BASARILI] Dosya basariyla tasindi ve adlandirildi!" -ForegroundColor Green
    Write-Host "Yeni Isim: $newFileName" -ForegroundColor Yellow
    Write-Host "Yeni Konum: $destinationPath" -ForegroundColor Gray
} catch {
    Write-Host ""
    Write-Host "[HATA] Dosya tasinirken bir hata olustu: $_" -ForegroundColor Red
}

Write-Host ""
Pause