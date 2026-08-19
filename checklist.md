# ARIM MCP 서버 체크리스트

계획: `docs/plan-mcp-server.md`

## 1. 서버(Java) 수정

- [x] 4.1 `AuthorizeInterceptor` — `X-Mcp-Client: 1` 헤더일 때 401 JSON 반환
- [x] 4.2 `AccountController` — `GET /account/me` 추가
- [x] 4.3 `SettingController` — `GET /setting/sensorlist` 추가
- [x] 4.4 `AccountController` + `DeviceInfoController` — user 로그인 시 `monitorId` 설정, user 분기를 `selectUserAllowedDeviceIds` 기준으로 통일
- [x] 컴파일 확인 (`./mvnw -q compile`)

## 2. MCP 프로젝트 뼈대

- [x] `package.json` / `tsconfig.json` / `.gitignore`
- [x] `src/config.ts` — env 로딩
- [x] `src/types.ts` — 응답 DTO 타입
- [x] `src/api-client.ts` — 세션 쿠키 기반 클라이언트 + 자동 재로그인
- [x] `src/tools/_shared.ts` — ok/err/handle + 대량 응답 축약

## 3. 도구 구현 (조회 전용)

- [x] `tools/auth.ts` — arim_login, arim_whoami, arim_logout
- [x] `tools/site.ts` — site_list, site_select (실제 사이트 51건으로 매칭 검증)
- [x] `tools/device.ts` — device_list/get/realtime/realtime_correction/nearby_stations
- [x] `tools/data.ts` — data_search, data_raw_search, data_recent
- [x] `tools/statistics.ts` — stat_daily_avg, stat_collection_rate, stat_weather, stat_weather_stations, sensor_list
- [x] `tools/correction.ts` — correction_devices/trend/compare/factors/versions
- [x] `tools/report.ts` — report_list/get/months
- [x] `tools/alarm.ts` — alarm_list, alarm_config_list
- [x] `tools/monitor.ts` — monitor_device_state/data_count/fault_devices/search/rose
- [x] `src/index.ts` — 도구 그룹 등록

## 4. 부속물

- [x] `README.md` — 설치·환경변수·도구 목록
- [x] `setup-arim-mcp.sh` — macOS / Linux 등록 스크립트
- [x] `setup-arim-mcp.ps1` — Windows 등록 스크립트 (구문 검사 + JSON 병합 로직 검증 완료)
- [x] `README.md` — OS별 설치 절차 추가

## 5. 검증

- [x] `npm install && npm run build` 성공
- [x] MCP 도구 등록 확인 (tools/list → 34개)
- [x] 서버 수정 4건 라우팅 검증 (401 JSON / 302 보존 / me / sensorlist)
- [x] 로그인 실패 메시지 파싱, PUBLIC 엔드포인트 JSON 파싱, 401 감지 후 자동 재로그인 경로
- [ ] 로그인 후 실데이터 조회 스모크 테스트 — **테스트 계정 비밀번호 필요**
