# ARIM MCP 서버

아림에어 모니터링 시스템의 측정 데이터·통계·보정·리포트를 Claude에서 직접 조회하는 MCP(stdio) 서버.

**조회 전용입니다.** 서버 상태를 바꾸는 기능(리포트 발행, 보정 적용, 디바이스 명령, 백필, 알람 등록/삭제)은 포함하지 않습니다.

## 설치

**Node.js 18 이상**이 필요합니다.

### macOS / Linux

```bash
cd /Users/<사용자>/Project/arimair-mcp
npm install
npm run build
./setup-arim-mcp.sh     # Claude Code + Claude Desktop 자동 등록
```

### Windows

저장소를 원하는 위치(예: `C:\Users\<사용자>\arimair-mcp`)에 두고, 그 폴더에서 실행합니다.
설치 스크립트는 **자기 위치를 기준으로 경로를 잡으므로** 어디에 두든 그대로 동작합니다.

PowerShell에서:

```powershell
cd C:\Users\<사용자>\arimair-mcp
npm install
npm run build
powershell -ExecutionPolicy Bypass -File .\setup-arim-mcp.ps1
```

`-ExecutionPolicy Bypass`는 서명되지 않은 스크립트 실행을 이번 한 번만 허용하는 옵션입니다.
시스템 정책을 바꾸지 않습니다.

### 설치 스크립트가 하는 일 (공통)

서버 주소는 운영 서버(`https://monitor.arimair.com`)로 **고정**되어 있어 묻지 않습니다.
두 스크립트 모두 아이디·비밀번호·계정 유형만 물어본 뒤 아래 두 곳에 등록합니다.

- Claude Code CLI (`claude mcp add arim -s user`) — `claude` 명령이 없으면 건너뜁니다
- Claude Desktop 설정 파일 — 기존 파일은 `.bak.<타임스탬프>`로 백업하고, **이미 등록된 다른 MCP 서버는 보존**합니다

| OS | Claude Desktop 설정 경로 |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

등록 후 **Claude Desktop을 완전히 종료했다가 다시 열어야** 도구가 나타납니다.

### 수동 등록

```bash
# macOS / Linux
claude mcp add arim -s user -t stdio \
  -e ARIM_API_BASE_URL=https://monitor.arimair.com \
  -e ARIM_MCP_USER=<아이디> \
  -e ARIM_MCP_PASS=<비밀번호> \
  -- node /Users/<사용자>/Project/arimair-mcp/build/index.js
```

```powershell
# Windows (PowerShell) — 경로는 실제 설치 위치로
claude mcp add arim -s user -t stdio `
  -e "ARIM_API_BASE_URL=https://monitor.arimair.com" `
  -e "ARIM_MCP_USER=<아이디>" `
  -e "ARIM_MCP_PASS=<비밀번호>" `
  -- node C:\Users\<사용자>\arimair-mcp\build\index.js
```

비밀번호를 등록하지 않았다면 연결 후 `arim_login` 도구로 로그인하면 됩니다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `ARIM_API_BASE_URL` | `https://monitor.arimair.com` | 대상 서버 주소. 설치 스크립트가 이 값으로 고정 등록하므로 평소 건드릴 일이 없고, 로컬 서버로 붙여 테스트할 때만 `http://localhost:9080` 등으로 바꿉니다 |
| `ARIM_MCP_USER` | — | 자동 로그인 아이디 |
| `ARIM_MCP_PASS` | — | 자동 로그인 비밀번호 |
| `ARIM_MCP_USER_TYPE` | `admin` | `admin` 또는 `user` |
| `ARIM_API_TIMEOUT` | `20000` | 요청 타임아웃(ms) |

자격증명을 환경변수로 넣어두면 첫 도구 호출 시 자동 로그인하고, 세션이 만료되면 한 번 재로그인 후 재시도합니다.

## 인증 방식

ARIM 서버는 JWT를 발급하지 않고 **HttpSession + 세션 쿠키**(Spring Session 의 `SESSION`)로 인증합니다.
MCP는 `/account/login` 호출로 받은 쿠키를 보관해 이후 요청에 실어 보냅니다.

모든 요청에 `X-Mcp-Client: 1` 헤더를 붙입니다. 서버의 `AuthorizeInterceptor`는 이 헤더가 있으면
로그인 페이지로 302 리다이렉트하는 대신 **401 JSON**을 돌려주며, MCP는 이를 세션 만료로 판단해 재로그인합니다.

## 사이트

측정기·측정데이터·통계·리포트 조회는 모두 **현재 선택된 사이트**를 기준으로 합니다.
서버 내부적으로는 세션의 `monitorId`(모니터링 대상 관리자 계정)이지만, 도구에서는 "사이트"로 다룹니다.
웹 화면 상단의 사이트 선택 콤보와 같은 것입니다.

```
site_list                        → 선택 가능한 사이트와 현재 사이트
site_select { site: "울산 환경보건센터" }   → 사이트 변경
```

`site_select`는 사이트 이름 일부만 줘도 됩니다. 등록된 이름과 말하는 순서가 달라도(예: 등록명은
`[환경보건센터] 울산 울산대`) 낱말이 모두 들어 있으면 찾습니다. 표시명(`company`)과 담당자명(`name`),
`siteId` 모두를 대상으로 검색합니다.

- 후보가 여럿이면 임의로 고르지 않고 후보 목록을 돌려줍니다 (예: "환경보건센터" → 9곳)
- 정확한 이름이 있으면 부분일치보다 우선합니다 (예: "도로교통연구원" → `arimsc_ex`)

일반사용자 계정은 승인받은 공급자만, 관리자 계정은 전체 목록을 봅니다 (웹 화면과 동일한 규칙).

## 도구 목록

### 인증
| 도구 | 설명 |
|---|---|
| `arim_login` | 로그인 (환경변수 자격증명 사용 가능) |
| `arim_whoami` | 로그인 상태 / monitorId / 시스템 설정 조회 |
| `arim_logout` | 세션 종료 |

### 사이트
| 도구 | 설명 |
|---|---|
| `site_list` | 선택 가능한 사이트 목록과 현재 사이트 |
| `site_select` | 조회 대상 사이트 변경 |

### 측정기
| 도구 | 설명 |
|---|---|
| `device_list` | 측정기 목록 |
| `device_get` | 측정기 상세 |
| `device_realtime` | 전체 측정기 최신값 (원시) |
| `device_realtime_correction` | 전체 측정기 최신값 (보정 적용) |
| `device_nearby_stations` | 인근 에어코리아 측정소 |

### 측정 데이터
| 도구 | 설명 |
|---|---|
| `data_search` | 기간 조회 (기간별 원시/시간평균/일평균 자동 전환) |
| `data_raw_search` | 항상 분단위 원시 조회 |
| `data_recent` | 최근 수집 데이터 |

### 통계·기상
| 도구 | 설명 |
|---|---|
| `stat_daily_avg` | 평균 데이터 조회 |
| `stat_collection_rate` | 측정기 × 일자별 수집률(결측률) |
| `stat_weather_stations` | KMA 관측소 목록 |
| `stat_weather` | KMA 관측 이력 (시간별/일별) |
| `sensor_list` | 센서 메타 (단위·소수점 자릿수) |

### 보정
| 도구 | 설명 |
|---|---|
| `correction_devices` | 보정 대상 측정기 및 적용 현황 |
| `correction_trend` | 보정 인자 추이 (최근 12개월) |
| `correction_compare` | 보정 전/후 시계열 비교 |
| `correction_factors` | 특정 적용월의 보정 인자 |
| `correction_versions` | 보정 모델 버전 이력 |

### 리포트
| 도구 | 설명 |
|---|---|
| `report_list` | 발행 이력 |
| `report_get` | 이력 상세 |
| `report_months` | 발행 대상 월 목록 |
| `report_v2_html` | 신규 리포트(V2) HTML 본문 |

### 알람
| 도구 | 설명 |
|---|---|
| `alarm_list` | 알람 발생 이력 |
| `alarm_config_list` | 센서 임계치 문자 알림 설정 |

### 모니터링 집계
| 도구 | 설명 |
|---|---|
| `monitor_device_state` | 가동/통신 상태 집계 |
| `monitor_working_percent` | 정상 가동률 |
| `monitor_data_count` | 수집 건수 집계 |
| `monitor_fault_devices` | 고장·이상 측정기 |
| `monitor_search` | 모니터링 기준 기간 조회 |
| `monitor_rose` / `monitor_rose_search` | 오염장미도 |

## 대량 응답 처리

시계열 조회 도구는 `maxRows`(기본 500)를 받습니다. 서버는 행 수 상한이 없어 1일치 분단위 조회만으로도
1,400행 이상이 나오므로, 초과 시 **균등 간격 샘플링**하고 응답에 `totalRows` / `returnedRows` / `sampled`를
함께 돌려줍니다. 마지막(최신) 행은 항상 보존합니다.

## 서버 측 의존 사항

이 MCP는 아래 서버 변경을 전제로 합니다.

| 위치 | 변경 |
|---|---|
| `route/AuthorizeInterceptor.java` | `X-Mcp-Client: 1` 헤더일 때 401 JSON 반환 |
| `controller/AccountController.java` | `GET /account/me` 추가 |
| `controller/SettingController.java` | `GET /setting/sensorlist` 추가 |

`/account/me`, `/setting/sensorlist`가 없으면 `arim_whoami`, `sensor_list`, `alarm_config_list`(adminId 생략 시)만
동작하지 않고 나머지 도구는 정상 동작합니다. `site_list`도 동작하지만, `/account/me`가 없으면 현재 사이트를
서버에 물어볼 수 없어 **이 세션에서 `site_select`로 고른 값**을 현재 사이트로 표시합니다.

사이트 기능 자체는 서버 수정 없이 기존 API(`/site/update/{id}`, `/admin/list`, `/datarequest/providerlist`)만 씁니다.
