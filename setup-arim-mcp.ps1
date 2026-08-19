# ARIM MCP 설치 스크립트 (Windows) — Claude Code(CLI) + Claude Desktop 앱 둘 다 등록
# 실행: 이 폴더에서  powershell -ExecutionPolicy Bypass -File .\setup-arim-mcp.ps1

$ErrorActionPreference = "Stop"

# claude mcp remove 는 등록이 없으면 0 이 아닌 코드로 끝난다.
# PowerShell 7.3+ 에서 이 설정이 켜져 있으면 그것만으로 스크립트가 중단되므로 꺼둔다 (5.1 에는 이 변수가 없다).
if (Test-Path Variable:PSNativeCommandUseErrorActionPreference) {
    $PSNativeCommandUseErrorActionPreference = $false
}

# 스크립트가 놓인 폴더를 기준으로 잡는다 (설치 경로가 PC마다 다르므로 하드코딩하지 않는다)
$McpPath = Join-Path $PSScriptRoot "build\index.js"

# 서버 주소는 운영 서버로 고정한다
$Url = "https://monitor.arimair.com"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js 가 설치되어 있지 않거나 PATH 에 없습니다. https://nodejs.org 에서 설치 후 다시 실행하세요." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $McpPath)) {
    Write-Host "빌드 파일을 찾을 수 없습니다: $McpPath" -ForegroundColor Red
    Write-Host "먼저 이 폴더에서 다음을 실행하세요:  npm install ; npm run build" -ForegroundColor Yellow
    exit 1
}

# ── 입력 ──────────────────────────────────────────────
Write-Host "ARIM 서버: $Url"

$ArimUser = Read-Host "ARIM 아이디"

$SecurePass = Read-Host "ARIM 비밀번호 (자동로그인용, 비우면 나중에 arim_login)" -AsSecureString
$ArimPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePass)
)

$UserType = Read-Host "계정 유형 [admin]"
if ([string]::IsNullOrWhiteSpace($UserType)) { $UserType = "admin" }

# ── 1) Claude Code (CLI) ──────────────────────────────
Write-Host ""
Write-Host "[1/2] Claude Code 등록..."

$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($claude) {
    # 기존 등록이 없으면 오류가 나므로 무시한다
    & claude mcp remove arim 2>$null | Out-Null

    if (-not [string]::IsNullOrWhiteSpace($ArimPass)) {
        & claude mcp add arim -s user -t stdio `
            -e "ARIM_API_BASE_URL=$Url" `
            -e "ARIM_MCP_USER=$ArimUser" `
            -e "ARIM_MCP_PASS=$ArimPass" `
            -e "ARIM_MCP_USER_TYPE=$UserType" `
            -- node $McpPath
    }
    else {
        & claude mcp add arim -s user -t stdio `
            -e "ARIM_API_BASE_URL=$Url" `
            -- node $McpPath
    }

    if ($LASTEXITCODE -eq 0) { Write-Host "  OK Claude Code 완료" -ForegroundColor Green }
    else { Write-Host "  실패 (exit $LASTEXITCODE)" -ForegroundColor Red }
}
else {
    Write-Host "  'claude' CLI 미설치 → 건너뜀" -ForegroundColor Yellow
}

# ── 2) Claude Desktop ─────────────────────────────────
Write-Host ""
Write-Host "[2/2] Claude 데스크톱 설정..."

$Cfg = Join-Path $env:APPDATA "Claude\claude_desktop_config.json"
$CfgDir = Split-Path $Cfg -Parent
if (-not (Test-Path $CfgDir)) { New-Item -ItemType Directory -Path $CfgDir -Force | Out-Null }

if (Test-Path $Cfg) {
    $backup = "$Cfg.bak.$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
    Copy-Item $Cfg $backup
    Write-Host "  (기존 설정 백업: $backup)"
}

# 기존 설정을 읽어 mcpServers 항목만 갈아끼운다
$data = $null
if (Test-Path $Cfg) {
    try { $data = Get-Content $Cfg -Raw -Encoding UTF8 | ConvertFrom-Json }
    catch { Write-Host "  기존 설정을 읽을 수 없어 새로 만듭니다." -ForegroundColor Yellow }
}
if ($null -eq $data) { $data = [PSCustomObject]@{} }
if ($data.PSObject.Properties.Name -notcontains "mcpServers") {
    $data | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([PSCustomObject]@{})
}

$env_ = [ordered]@{ "ARIM_API_BASE_URL" = $Url }
if (-not [string]::IsNullOrWhiteSpace($ArimPass)) {
    $env_["ARIM_MCP_USER"]      = $ArimUser
    $env_["ARIM_MCP_PASS"]      = $ArimPass
    $env_["ARIM_MCP_USER_TYPE"] = $UserType
}

$entry = [ordered]@{
    command = "node"
    args    = @($McpPath)
    env     = $env_
}

if ($data.mcpServers.PSObject.Properties.Name -contains "arim") {
    $data.mcpServers.arim = $entry
}
else {
    $data.mcpServers | Add-Member -NotePropertyName "arim" -NotePropertyValue $entry
}

# Claude Desktop 은 BOM 없는 UTF-8 을 기대한다. Set-Content -Encoding UTF8 은 5.1 에서 BOM 을 붙이므로 쓰지 않는다.
$json = $data | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($Cfg, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "  OK Claude 데스크톱 완료: $Cfg" -ForegroundColor Green

Write-Host ""
Write-Host "끝! Claude 데스크톱 앱을 완전히 종료했다가 다시 열면 arim 도구가 활성화됩니다."
if ([string]::IsNullOrWhiteSpace($ArimPass)) {
    Write-Host "→ 비밀번호를 비웠으니 연결 후 arim_login 도구로 로그인하세요." -ForegroundColor Yellow
}
