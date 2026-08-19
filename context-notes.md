# ARIM MCP 서버 컨텍스트 노트

## 2026-08-19 — 초기 조사

### 왜 JWT가 아니라 쿠키인가
참고 프로젝트 hubinflow-mcp는 `/api/Account/Login`이 JWT를 발급하지만, ARIM은 JWT를 발급하지 않는다.
`AccountController.login()`은 `HttpSession`에 `admin` 또는 `user` 속성을 심고 `ApiResponse{success,message}`만
돌려준다. 인증 상태는 전적으로 **세션 쿠키**로 유지된다. Spring Session(Redis)을 쓰므로 쿠키 이름은
JSESSIONID 가 아니라 `SESSION` 이다 — api-client 는 이름을 가정하지 않고 Set-Cookie 를 전부 보관한다.
→ api-client는 Set-Cookie를 캡처해 이후 요청에 `Cookie` 헤더로 재전송하는 방식으로 구현.

### Spring Security는 사실상 비활성
`SecurityConfig.configure(WebSecurity)`에서 `web.ignoring().antMatchers("/**")` 이므로
Security 필터 체인이 모든 경로를 통과시킨다. 실제 인가는 `AuthorizeInterceptor` 하나가 담당한다.
`BCryptPasswordEncoder` 빈만 로그인 검증에 쓰인다.

### 미인증 응답을 401로 바꾼 이유
`AuthorizeInterceptor`는 세션이 없으면 `/login`으로 302 리다이렉트한다. fetch는 리다이렉트를 따라가므로
MCP 클라이언트는 **200 + 로그인 페이지 HTML**을 받게 되어 (a) JSON 파싱 실패, (b) 세션 만료 감지 불가로
자동 재로그인이 불가능하다.
→ `X-Mcp-Client: 1` 헤더가 있을 때만 401 JSON을 반환하도록 했다. 전용 헤더로 한정한 이유는
`Accept: application/json` 기준으로 하면 기존 JSP 화면의 ajax 호출 동작까지 바뀌기 때문이다.

### monitorId가 모든 조회의 축
로그인 시 세션에 `monitorId`가 저장되고, 대부분의 조회 API가 이 값을 소유자(owner_id) 필터로 쓴다.
`admin` 계정으로 로그인하면 `adminMapper.selectAdminList().get(0).getAdminId()`(첫 관리자)가 들어간다.
매퍼 쿼리는 `<if test="ownerId != 'admin'">and owner_id=#{ownerId}</if>` 패턴이라
**`monitorId`가 문자열 `"admin"`이면 소유자 필터가 통째로 해제**된다.

### user 계정으로 로그인하면 조회가 비는 이유 (4.4 보류 사유)
`AccountController`의 user 분기는 `monitorId`를 세션에 넣지 않는다. 컨트롤러들은
`String.valueOf(session.getAttribute("monitorId"))`를 쓰므로 문자열 `"null"`이 되고,
`owner_id='null'` 조건이 걸려 결과가 항상 빈다.

단순히 `monitorId`를 채워 넣으면 `DeviceInfoController.list()`의 user 분기에서
`data_request.devices`가 비어 있을 때 `selectDeviceInfoList("admin")`이 호출되어
**전체 디바이스가 노출**된다. 현재는 `"null"` 덕분에 우연히 막혀 있는 상태다.
설계 의도는 `DataRequestMapper.selectUserAllowedDeviceIds()` 기준(devices 비면 공급자 소유 전체)이므로,
`monitorId`만 고치는 것으로는 의도와 맞지 않는다. → 노출 범위를 확정한 뒤 적용하기로 하고 보류.

관련 배경: `data_request.devices`에 명시된 device의 `owner_id`는 요청의 `admin_id`와 다를 수 있어,
devices가 지정되면 소유자 조건을 걸면 안 된다.

### 대량 응답은 서버가 아니라 MCP에서 막는다
`/devicedata/dataSearch`는 조회 기간에 따라 원시(분단위) / 시간평균 / 일평균을 자동 전환하지만
행 수 상한이 없다. 1일치 원시 조회면 1,440행 × 센서 수가 그대로 나온다.
서버에 `limit`을 추가하면 기존 화면의 그래프가 잘리므로, MCP 도구에서 `maxRows`(기본 500) 초과 시
균등 샘플링하고 원본 행 수를 함께 알려주는 방식을 택했다.

### 센서 메타는 API가 없었다
센서의 단위·소수점 자릿수(`Sensor.unit`, `Sensor.digit`)는 `DeviceDataController`가 JSP에
JSON 문자열로 직접 조립해 내려보내는 것이 전부였다. MCP가 값을 해석하려면 필요해
`GET /setting/sensorlist`를 추가했다. `digit`은 `"F1"`, `"F2"` 같은 형식이라 숫자만 뽑아 써야 한다.

### Windows 설치 스크립트에서 인코딩이 중요한 이유
`setup-arim-mcp.ps1`은 **UTF-8 BOM + CRLF**로 저장해야 한다.
Windows 기본 셸인 Windows PowerShell 5.1은 BOM 없는 UTF-8 `.ps1`을 ANSI(CP949)로 읽어
스크립트 안의 한국어 안내 문구가 전부 깨진다. 파일을 수정할 때 BOM이 유지되는지 확인할 것.

반대로 스크립트가 **출력하는** `claude_desktop_config.json`은 BOM이 없어야 해서
`Set-Content -Encoding UTF8`(5.1에서 BOM을 붙인다) 대신
`[System.IO.File]::WriteAllText(..., New-Object System.Text.UTF8Encoding($false))`를 쓴다.

설정 병합은 기존 파일을 읽어 `mcpServers.arim`만 갈아끼운다. 다른 MCP 서버 등록과
`mcpServers` 밖의 설정이 보존되는지, 재실행해도 결과가 같은지(멱등) 실제로 돌려서 확인했다.
`$data.PSObject.Properties.Name`은 항목이 하나면 문자열로 언랩되어 `.Contains()`가
부분 문자열 검사로 동작하므로, 키 존재 확인은 반드시 `-contains` / `-notcontains` 연산자를 쓴다.

`claude mcp remove arim`은 등록이 없을 때 0이 아닌 코드로 끝난다. PowerShell 7.3+에서
`$PSNativeCommandUseErrorActionPreference`가 켜져 있으면 이것만으로 스크립트가 중단되므로
스크립트 앞부분에서 (변수가 있을 때만) 꺼둔다.
