// MCP 서버 실행 환경변수를 읽어 접속 설정으로 만드는 모듈

export interface AppConfig {
  baseUrl: string;
  defaultUserId?: string;
  defaultPassword?: string;
  defaultUserType: string;
  timeoutMs: number;
}

export function loadConfig(): AppConfig {
  return {
    baseUrl: (process.env.ARIM_API_BASE_URL ?? "https://monitor.arimair.com").replace(/\/+$/, ""),
    defaultUserId: process.env.ARIM_MCP_USER,
    defaultPassword: process.env.ARIM_MCP_PASS,
    defaultUserType: process.env.ARIM_MCP_USER_TYPE ?? "admin",
    timeoutMs: parseInt(process.env.ARIM_API_TIMEOUT ?? "20000", 10),
  };
}
