@echo off
rem One-time: install Python packages
where py >nul 2>nul && (set PY=py -3) || (set PY=python)
%PY% -m pip install -r "%~dp0requirements.txt"
