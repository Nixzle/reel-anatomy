@echo off
setlocal
cd /d "%~dp0"
if exist "dist\ReelAnatomy\ReelAnatomy.exe" (
  "dist\ReelAnatomy\ReelAnatomy.exe"
  exit /b
)
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" app.py
  exit /b
)
python app.py
if errorlevel 1 pause
