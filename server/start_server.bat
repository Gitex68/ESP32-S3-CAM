@echo off
echo ============================================================
echo    SERVEUR MANGEOIRE CONNECTEE ESP32-S3
echo ============================================================
echo.
echo Demarrage du serveur...
echo.

cd /d "%~dp0"
python app.py

pause
