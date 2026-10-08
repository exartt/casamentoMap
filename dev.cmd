@echo off
rem Dois cliques aqui sobem o MySQL (Docker) e o app em modo de desenvolvimento.
rem Depois abra http://localhost:5173 no navegador. Feche esta janela para parar.
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\nodejs-22;%PATH%"
docker compose up -d
call npm.cmd run dev
pause
