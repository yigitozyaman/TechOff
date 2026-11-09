@echo off
chcp 65001 > nul
cd /d "C:\Users\grafik.user2\Desktop\Calisma\Y"
powershell -ExecutionPolicy Bypass -File "DosyaAdlandirmaToplu.ps1" %*