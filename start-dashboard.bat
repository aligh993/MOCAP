@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 "%~dp0scripts\serve.py"
) else (
  python "%~dp0scripts\serve.py"
)
if errorlevel 1 pause
