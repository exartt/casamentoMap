@echo off
rem Dois cliques aqui preparam o ambiente local (Node 22, npm install, MySQL no Docker, build e testes).
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0setup-windows.ps1"
