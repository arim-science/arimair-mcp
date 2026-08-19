// ARIM 서버 응답 DTO 타입 — 서버가 HashMap 을 그대로 내려주는 경우가 많아 느슨하게 잡는다

/** 서버 공통 응답 (com.arimsc.model.ApiResponse) */
export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: string;
  status?: string;
}

/** 로그인 결과 (MCP 내부용) */
export interface AuthResult {
  userId: string;
  userType: string;
  message: string;
}

/** GET /account/me */
export interface MeResult {
  loggedIn: boolean;
  userType: string | null;
  id: string | null;
  name: string | null;
  role: string | null;
  permission: string | null;
  monitorId: string | null;
  setting: Record<string, unknown> | null;
}

/** 측정기 (com.arimsc.model.DeviceInfo) */
export interface DeviceInfo {
  id: string;
  name?: string;
  address?: string;
  latitude?: string;
  /** 서버 필드명 오타가 그대로 노출된다 (longitude 아님) */
  longitue?: string;
  type?: string;
  sensorState?: string;
  networkState?: string;
  useYn?: string;
  ownerId?: string;
  lastUpdate?: string;
  correctionYn?: string;
  [key: string]: unknown;
}

/** 센서 메타 (com.arimsc.model.Sensor) — digit 은 "F1","F2" 형식 */
export interface Sensor {
  id: string;
  name?: string;
  unit?: string;
  digit?: string;
  [key: string]: unknown;
}

/** 보정 인자 (com.arimsc.model.CorrectionFactor) */
export interface CorrectionFactor {
  [key: string]: unknown;
}

/** 리포트 발행 이력 (com.arimsc.model.ReportHistory) */
export interface ReportHistory {
  no?: number;
  adminId?: string;
  deviceId?: string;
  reportMonth?: string;
  filename?: string;
  genYn?: string;
  mailYn?: string;
  regDate?: string;
  type?: string;
  [key: string]: unknown;
}

/** 시계열 한 행 — 서버가 HashMap 으로 내려주므로 키 구성이 조회 단위마다 다르다 */
export type DataRow = Record<string, unknown>;
