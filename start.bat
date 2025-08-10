@echo off
setlocal enableextensions

REM start.bat — Lance backend (Flask) et frontend (React) dans 2 fenêtres

set ROOT=%~dp0
pushd "%ROOT%"

REM --- Backend ---
if not exist .venv (
  echo [Backend] Creation venv .venv
  py -m venv .venv || python -m venv .venv
)

set VENV_PY=%ROOT%\.venv\Scripts\python.exe
if not exist "%VENV_PY%" (
  echo [Backend] Venv invalide. Supprimez .venv et relancez.
  goto :end
)

"%VENV_PY%" -m pip install --upgrade pip >nul 2>&1
"%VENV_PY%" -m pip install -r backend\requirements.txt

if "%JWT_SECRET_KEY%"=="" set JWT_SECRET_KEY=change_me_dev
if "%UPLOAD_FOLDER%"=="" set UPLOAD_FOLDER=%ROOT%backend\uploads
if not exist "%UPLOAD_FOLDER%" mkdir "%UPLOAD_FOLDER%"
set FLASK_ENV=development

echo [Backend] Start http://localhost:5000
start powershell -NoExit -Command "& '%VENV_PY%' '%ROOT%backend\app.py'"

REM --- Frontend ---
if "%REACT_APP_API_URL%"=="" set REACT_APP_API_URL=http://localhost:5000/api

echo [Frontend] npm install
pushd frontend
call npm install --no-fund --no-audit
popd

echo [Frontend] Start http://localhost:3000
start powershell -NoExit -Command "cd '%ROOT%frontend'; npm start"

echo.
echo Tout est lance. Backend: http://localhost:5000  Frontend: http://localhost:3000

echo (Fermer cette fenetre ne tue pas les 2 consoles ouvertes)
:end
endlocal

