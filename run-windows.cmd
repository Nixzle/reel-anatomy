@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (
  echo Python 3.10+ is required for source mode. Use the packaged Windows release instead.
  pause
  exit /b 1
)
python app.py
