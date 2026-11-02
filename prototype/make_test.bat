@echo off
rem Equivalent of "make test"
where py >nul 2>nul && (set PY=py -3) || (set PY=python)
cd /d "%~dp0backend"
%PY% -m pytest -q
