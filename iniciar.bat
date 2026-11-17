@echo off
REM Arranca la pagina web de AgroAndes en http://localhost:8000
cd /d "%~dp0"

if not exist backend\.venv (
  echo Instalando el backend por primera vez...
  python -m venv backend\.venv || goto error
  backend\.venv\Scripts\python -m pip install -r backend\requirements.txt || goto error
)

if not exist frontend\dist (
  echo Compilando el frontend por primera vez...
  pushd frontend
  call npm install || goto error
  call npm run build || goto error
  popd
)

echo.
echo Pagina lista en http://localhost:8000  (cierra esta ventana para apagarla)
start "" http://localhost:8000
cd backend
.venv\Scripts\python -m uvicorn app.main:app --port 8000
goto fin

:error
echo.
echo Algo fallo durante la instalacion. Revisa que tengas Python y Node.js instalados.
pause
:fin
