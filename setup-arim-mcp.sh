#!/usr/bin/env bash
# ARIM MCP 설치 스크립트 — Claude Code(CLI) + Claude Desktop 앱 둘 다 등록
MCP="/Users/amdmania/Project/arimair-mcp/build/index.js"
# 서버 주소는 운영 서버로 고정한다
URL="https://monitor.arimair.com"

if [ ! -f "$MCP" ]; then echo "빌드 파일을 찾을 수 없습니다: $MCP (npm run build 를 먼저 실행하세요)"; exit 1; fi

echo "ARIM 서버: $URL"
read -r -p "ARIM 아이디: " AUSER
read -r -s -p "ARIM 비밀번호 (자동로그인용, 비우면 나중에 arim_login): " APASS; echo
read -r -p "계정 유형 [admin]: " ATYPE
ATYPE="${ATYPE:-admin}"

# 1) Claude Code (CLI)
if command -v claude >/dev/null 2>&1; then
  echo "[1/2] Claude Code 등록..."
  claude mcp remove arim 2>/dev/null || true
  if [ -n "$APASS" ]; then
    claude mcp add arim -s user -t stdio \
      -e ARIM_API_BASE_URL="$URL" -e ARIM_MCP_USER="$AUSER" -e ARIM_MCP_PASS="$APASS" -e ARIM_MCP_USER_TYPE="$ATYPE" \
      -- node "$MCP" && echo "  OK Claude Code 완료"
  else
    claude mcp add arim -s user -t stdio \
      -e ARIM_API_BASE_URL="$URL" -- node "$MCP" && echo "  OK Claude Code 완료 (자격증명 없이)"
  fi
else
  echo "[1/2] 'claude' CLI 미설치 → 건너뜀"
fi

# 2) Claude Desktop
CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
echo "[2/2] Claude 데스크톱 설정..."
mkdir -p "$(dirname "$CFG")"
if [ -f "$CFG" ]; then cp "$CFG" "$CFG.bak.$(date +%s)"; echo "  (기존 설정 백업)"; fi
AUSER="$AUSER" APASS="$APASS" ATYPE="$ATYPE" MCP="$MCP" URL="$URL" CFG="$CFG" python3 - <<'PY'
import json, os
cfg=os.environ["CFG"]
try: data=json.load(open(cfg))
except Exception: data={}
if not isinstance(data, dict): data={}
data.setdefault("mcpServers", {})
env={"ARIM_API_BASE_URL": os.environ["URL"]}
if os.environ.get("APASS"):
    env["ARIM_MCP_USER"]=os.environ["AUSER"]
    env["ARIM_MCP_PASS"]=os.environ["APASS"]
    env["ARIM_MCP_USER_TYPE"]=os.environ["ATYPE"]
data["mcpServers"]["arim"]={"command":"node","args":[os.environ["MCP"]],"env":env}
json.dump(data, open(cfg,"w"), indent=2, ensure_ascii=False)
print("  OK Claude 데스크톱 완료:", cfg)
PY

echo
echo "끝! Claude 데스크톱 앱을 완전히 종료했다가 다시 열면 arim 도구가 활성화됩니다."
if [ -z "$APASS" ]; then echo "→ 비밀번호를 비웠으니 연결 후 arim_login 도구로 로그인하세요."; fi
