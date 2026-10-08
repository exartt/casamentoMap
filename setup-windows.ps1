# Prepara o ambiente local no Windows: Node.js 22, dependências, MySQL no Docker, build e testes.
# Uso: dê dois cliques em setup-windows.cmd, ou rode no PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

function Get-NodeVersion {
  try { return (& node --version 2>$null) } catch { return $null }
}

Write-Step 'Verificando o Node.js'
$nodeVersion = Get-NodeVersion
if ($nodeVersion -and $nodeVersion -match '^v22\.') {
  Write-Host "Node $nodeVersion encontrado."
} else {
  if ($nodeVersion) { Write-Host "Node $nodeVersion encontrado, mas o projeto pede a versão 22." }
  Write-Step 'Instalando o Node.js 22 (versão portátil, sem precisar de administrador)'
  $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'
  $latest = ($index | Where-Object { $_.version -like 'v22.*' } | Select-Object -First 1).version
  if (-not $latest) { throw 'Não foi possível descobrir a versão mais recente do Node 22.' }
  $zipName = "node-$latest-win-x64.zip"
  $zipPath = Join-Path $env:TEMP $zipName
  $programs = Join-Path $env:LOCALAPPDATA 'Programs'
  $target = Join-Path $programs 'nodejs-22'
  Write-Host "Baixando $zipName…"
  Invoke-WebRequest -Uri "https://nodejs.org/dist/$latest/$zipName" -OutFile $zipPath
  if (Test-Path $target) { Remove-Item -Recurse -Force $target }
  New-Item -ItemType Directory -Force -Path $programs | Out-Null
  Expand-Archive -Path $zipPath -DestinationPath $programs -Force
  Rename-Item -Path (Join-Path $programs "node-$latest-win-x64") -NewName 'nodejs-22'
  Remove-Item $zipPath -Force
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not ($userPath -split ';' | Where-Object { $_ -eq $target })) {
    [Environment]::SetEnvironmentVariable('Path', "$target;$userPath", 'User')
  }
  $env:Path = "$target;$env:Path"
  $nodeVersion = Get-NodeVersion
  if (-not $nodeVersion) { throw 'O Node foi extraído, mas não respondeu. Abra um novo terminal e rode node --version.' }
  Write-Host "Node $nodeVersion instalado em $target (adicionado ao PATH do usuário)."
}

Write-Step 'Instalando as dependências (npm install)'
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install falhou' }

Write-Step 'Criando o arquivo .env (se não existir)'
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env'; Write-Host '.env criado a partir de .env.example' } else { Write-Host '.env já existe' }

Write-Step 'Subindo o MySQL 8 no Docker'
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw 'docker compose up falhou. O Docker Desktop está aberto?' }

Write-Step 'Aguardando o MySQL aceitar conexões'
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
  $status = (docker inspect --format '{{.State.Health.Status}}' mesas-mysql) 2>$null
  if ($status -eq 'healthy') { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw 'O MySQL não ficou pronto em 3 minutos.' }
Write-Host 'MySQL pronto.'

Write-Step 'Build (vite + esbuild)'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'npm run build falhou' }

Write-Step 'Testes (vitest)'
npm test
if ($LASTEXITCODE -ne 0) { throw 'npm test falhou' }

Write-Host "`nTudo pronto." -ForegroundColor Green
Write-Host 'Para desenvolver:            npm run dev   (abra http://localhost:5173)' -ForegroundColor Green
Write-Host 'Para o build de produção:    npm start     (abra http://localhost:3000)' -ForegroundColor Green
