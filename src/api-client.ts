// ARIM 서버(Spring Boot)와 통신하는 HTTP 클라이언트 — JWT 가 아니라 JSESSIONID 세션 쿠키 기반

import type { AppConfig } from "./config.js";
import type {
  ApiResponse,
  AuthResult,
  CorrectionFactor,
  DataRow,
  DeviceInfo,
  MeResult,
  ReportHistory,
  Sensor,
} from "./types.js";

/** 리포트 생성·백필 등은 기본 타임아웃을 넘기는 경우가 있어 조회 계열만 기본값을 쓴다 */
const LONG_TIMEOUT_MS = 60_000;

export class ArimApiClient {
  private readonly config: AppConfig;
  private readonly cookies: Map<string, string> = new Map();
  private currentUserId?: string;
  private currentUserType?: string;
  /** 세션 만료로 재로그인하는 중인지 — 재귀 재시도를 막는다 */
  private reloggingIn = false;

  constructor(config: AppConfig) {
    this.config = config;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get loggedInAs(): { userId?: string; userType?: string } {
    return { userId: this.currentUserId, userType: this.currentUserType };
  }

  // ──────────────────────── Auth ────────────────────────

  async login(userId?: string, password?: string, userType?: string): Promise<AuthResult> {
    userId ??= this.config.defaultUserId;
    password ??= this.config.defaultPassword;
    userType ??= this.config.defaultUserType;

    if (!userId || !password) {
      throw new Error("자격증명이 없습니다. userId/password 를 넘기거나 ARIM_MCP_USER/ARIM_MCP_PASS 를 설정하세요.");
    }

    // 로그인 응답의 Set-Cookie 로 세션이 바뀌므로 기존 쿠키는 버린다
    this.cookies.clear();

    const resp = await this.rawRequest("POST", "/account/login", {
      userId,
      password,
      userType,
    });
    const text = await resp.text();

    if (!resp.ok) {
      throw new Error(`로그인 실패: HTTP ${resp.status} - ${trimForError(text)}`);
    }

    const body = parseJsonBody<ApiResponse>(text);
    if (!body?.success) {
      throw new Error(`로그인 실패: ${body?.message ?? "알 수 없는 오류"}`);
    }

    this.currentUserId = userId;
    this.currentUserType = userType;

    return { userId, userType, message: body.message ?? "로그인에 성공했습니다." };
  }

  async logout(): Promise<void> {
    try {
      await this.rawRequest("GET", "/account/logout");
    } finally {
      this.cookies.clear();
      this.currentUserId = undefined;
      this.currentUserType = undefined;
    }
  }

  async me(): Promise<MeResult> {
    return this.get<MeResult>("/account/me");
  }

  // ──────────────────────── Device ────────────────────────

  getDeviceList(): Promise<DeviceInfo[]> {
    return this.get<DeviceInfo[]>("/deviceinfo/list");
  }

  getDevice(id: string): Promise<DeviceInfo | null> {
    return this.get<DeviceInfo | null>(`/deviceinfo/get/${encodeURIComponent(id)}`);
  }

  getDeviceRealtime(): Promise<DataRow[]> {
    return this.get<DataRow[]>("/deviceinfo/realtime");
  }

  getDeviceRealtimeCorrection(): Promise<DataRow[]> {
    return this.get<DataRow[]>("/deviceinfo/realtime-correction");
  }

  getNearbyStations(deviceId: string): Promise<DataRow[]> {
    return this.get<DataRow[]>(`/deviceinfo/nearby-stations/${encodeURIComponent(deviceId)}`);
  }

  // ──────────────────────── Measurement data ────────────────────────

  /** 기간에 따라 원시(분)/시간평균/일평균이 서버에서 자동 전환된다 */
  searchData(deviceId: string, startDate: string, endDate: string): Promise<DataRow[]> {
    return this.get<DataRow[]>("/devicedata/dataSearch", { deviceId, startDate, endDate });
  }

  /** 기간과 무관하게 항상 분단위 원시 데이터 */
  searchRawData(deviceId: string, startDate: string, endDate: string): Promise<DataRow[]> {
    return this.get<DataRow[]>("/devicedata/rawDataSearch", { deviceId, startDate, endDate });
  }

  getRecentData(deviceId: string): Promise<DataRow[]> {
    return this.get<DataRow[]>(`/devicedata/list/${encodeURIComponent(deviceId)}`);
  }

  // ──────────────────────── Statistics ────────────────────────

  getDailyAvgData(deviceId: string, startDate: string, endDate: string): Promise<DataRow[]> {
    return this.get<DataRow[]>("/statistics/daily-avg/data", { deviceId, startDate, endDate });
  }

  getCollectionRate(start: string, end: string, deviceId?: string): Promise<DataRow[]> {
    return this.get<DataRow[]>("/statistics/collection/data", { start, end, deviceId: deviceId ?? "" });
  }

  getWeatherHistory(stnId: string, startDate: string, endDate: string, mode: string): Promise<DataRow[]> {
    return this.get<DataRow[]>("/statistics/weather/data", { stnId, startDate, endDate, mode });
  }

  getWeatherStations(): Promise<DataRow[]> {
    return this.get<DataRow[]>("/statistics/weather/stations");
  }

  getSensorList(): Promise<Sensor[]> {
    return this.get<Sensor[]>("/setting/sensorlist");
  }

  // ──────────────────────── Correction ────────────────────────

  getCorrectionDevices(): Promise<DataRow[]> {
    return this.get<DataRow[]>("/correction/devices");
  }

  getCorrectionTrend(deviceId: string, item?: string): Promise<CorrectionFactor[]> {
    return this.get<CorrectionFactor[]>("/correction/trend", { deviceId, item: item ?? "" });
  }

  getCorrectionCompare(deviceId: string, startDate: string, endDate: string): Promise<DataRow[]> {
    return this.get<DataRow[]>("/correction/compare", { deviceId, startDate, endDate });
  }

  getCorrectionFactors(deviceId: string, applyMonth: string): Promise<CorrectionFactor[]> {
    return this.get<CorrectionFactor[]>("/statistics/compare/factors", { deviceId, applyMonth });
  }

  getCorrectionVersions(deviceId: string, item?: string, periodType?: string, limit?: number): Promise<DataRow[]> {
    return this.get<DataRow[]>("/correction/versions", {
      deviceId,
      item: item ?? "",
      periodType: periodType ?? "monthly",
      limit: String(limit ?? 50),
    });
  }

  // ──────────────────────── Report ────────────────────────

  getReportList(): Promise<ReportHistory[]> {
    return this.get<ReportHistory[]>("/report/list");
  }

  getReport(no: string): Promise<ReportHistory | null> {
    return this.get<ReportHistory | null>(`/report/get/${encodeURIComponent(no)}`);
  }

  getReportMonths(): Promise<DataRow[]> {
    return this.get<DataRow[]>("/report/reportmonth");
  }

  /** 리포트 HTML 본문 — LLM 소견 생성이 붙어 있어 오래 걸릴 수 있다 */
  getReportV2Html(deviceId: string, yearMonth: string): Promise<string> {
    return this.getText(
      `/report/v2/preview/${encodeURIComponent(deviceId)}/${encodeURIComponent(yearMonth)}`,
      undefined,
      LONG_TIMEOUT_MS,
    );
  }

  // ──────────────────────── Alarm ────────────────────────

  getAlarmList(): Promise<DataRow[]> {
    return this.get<DataRow[]>("/alarm/list");
  }

  getAlarmConfigList(adminId: string): Promise<DataRow[]> {
    return this.get<DataRow[]>("/alarmconfig/list", { adminId });
  }

  // ──────────────────────── Monitoring summary ────────────────────────

  getDeviceState(): Promise<DataRow[]> {
    return this.get<DataRow[]>("/api/deviceState");
  }

  getDataCount(): Promise<DataRow[]> {
    return this.get<DataRow[]>("/api/dataCount");
  }

  getFaultDevices(): Promise<DeviceInfo[]> {
    return this.get<DeviceInfo[]>("/api/faultDeviceInfoList");
  }

  getWorkingDevicePercent(): Promise<DataRow[]> {
    return this.get<DataRow[]>("/api/workingDevicePercent");
  }

  getMonitoringSearch(deviceId: string, startDate: string, endDate: string): Promise<DataRow[]> {
    return this.get<DataRow[]>("/api/monitoringSearch", { deviceId, startDate, endDate });
  }

  getRose(period: "3hour" | "daily" | "weekly"): Promise<DataRow[]> {
    const path =
      period === "3hour" ? "/api/rose3Hour" : period === "daily" ? "/api/roseDaily" : "/api/roseWeekly";
    return this.get<DataRow[]>(path);
  }

  getRoseSearch(startDate: string, endDate: string): Promise<DataRow[]> {
    return this.get<DataRow[]>("/api/roseSearch", { startDate, endDate });
  }

  // ──────────────────────── Internal helpers ────────────────────────

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const text = await this.getText(path, params);
    return parseJsonBody<T>(text);
  }

  private async getText(path: string, params?: Record<string, string>, timeoutMs?: number): Promise<string> {
    const url = params ? `${path}?${new URLSearchParams(params).toString()}` : path;

    let resp = await this.rawRequest("GET", url, undefined, timeoutMs);

    // 세션이 없거나 만료된 경우 한 번만 재로그인하고 재시도한다
    if (isUnauthenticated(resp) && !this.reloggingIn) {
      this.reloggingIn = true;
      try {
        await this.login();
      } finally {
        this.reloggingIn = false;
      }
      resp = await this.rawRequest("GET", url, undefined, timeoutMs);
    }

    const text = await resp.text();

    if (isUnauthenticated(resp)) {
      throw new Error(`인증이 필요합니다. arim_login 도구로 먼저 로그인하세요. (GET ${path})`);
    }
    if (!resp.ok) {
      throw new Error(`GET ${path} 실패: HTTP ${resp.status} - ${trimForError(text)}`);
    }

    return text;
  }

  private async rawRequest(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs?: number,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      // 서버 AuthorizeInterceptor 가 이 헤더를 보고 리다이렉트 대신 401 JSON 을 돌려준다
      "X-Mcp-Client": "1",
      "X-Requested-With": "XMLHttpRequest",
    };

    const cookieStr = this.buildCookieHeader();
    if (cookieStr) headers["Cookie"] = cookieStr;

    const init: RequestInit = {
      method,
      headers,
      // 302 를 따라가면 로그인 페이지 HTML 을 200 으로 받게 되므로 직접 처리한다
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs ?? this.config.timeoutMs),
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const resp = await fetch(`${this.config.baseUrl}${path}`, init);
    this.captureCookies(resp);
    return resp;
  }

  private captureCookies(resp: Response): void {
    const setCookies = resp.headers.getSetCookie?.() ?? [];
    for (const raw of setCookies) {
      const firstSegment = raw.split(";", 2)[0];
      const idx = firstSegment.indexOf("=");
      if (idx <= 0) continue;
      const key = firstSegment.slice(0, idx).trim();
      const value = firstSegment.slice(idx + 1).trim();
      if (key) this.cookies.set(key, value);
    }
  }

  private buildCookieHeader(): string {
    if (this.cookies.size === 0) return "";
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

/**
 * 미인증 판정.
 * 서버 수정이 반영되면 401 JSON 이 오지만, 반영 전이거나 다른 경로로 걸리면
 * /login 으로의 302 리다이렉트가 온다. 둘 다 세션 없음으로 본다.
 */
function isUnauthenticated(resp: Response): boolean {
  if (resp.status === 401) return true;
  if (resp.status >= 300 && resp.status < 400) {
    const location = resp.headers.get("location") ?? "";
    return location.includes("/login");
  }
  return false;
}

/** 서버가 "결과 없음"을 빈 본문으로 내려주는 경우가 있어 JSON.parse 예외를 막는다 */
function parseJsonBody<T>(body: string): T {
  if (!body.trim()) return null as T;
  return JSON.parse(body) as T;
}

function trimForError(value: string): string {
  if (!value?.trim()) return "빈 응답";
  const trimmed = value.trim();
  return trimmed.length <= 220 ? trimmed : trimmed.slice(0, 220) + "...";
}
