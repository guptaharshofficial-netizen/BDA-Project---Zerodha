@echo off
rem Equivalent of "make dev": open http://localhost:8000 once it says "Uvicorn running"
where py >nul 2>nul && (set PY=py -3) || (set PY=python)
cd /d "%~dp0backend"
start "" http://localhost:8000
%PY% -m uvicorn yourbroker.api:app --port 8000
