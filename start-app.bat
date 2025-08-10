@echo off
setlocal
set DEVROOT=C:\dev\travel-tracker-pwa

:: Kill éventuels Node/Python
for /f "tokens=2 delims== " %%p in ('wmic process where "name='node.exe'" get ProcessId /value ^| find "="') do taskkill /F /PID %%p >nul 2>&1

:: Backend
start "BACKEND" cmd /c "cd /d %DEVROOT%\backend && if not exist venv (python -m venv venv) && call venv\Scripts\activate && flask run --host=0.0.0.0 --port=5000"

:: Frontend sur port 3010
start "FRONTEND" cmd /c "cd /d %DEVROOT%\frontend && npm start -- --port 3010"
endlocal
