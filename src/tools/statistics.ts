// 통계·수집률·기상데이터·센서 메타 조회 도구

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArimApiClient } from "../api-client.js";
import { handle, shrinkRows } from "./_shared.js";

export function registerStatisticsTools(server: McpServer, api: ArimApiClient): void {
  server.tool(
    "stat_daily_avg",
    "평균 데이터를 기간으로 조회한다. 1일 이하는 원시, 30일 이하는 시간평균, 초과는 일평균으로 서버가 자동 전환한다.",
    {
      deviceId: z.string().describe("측정기 ID"),
      startDate: z.string().describe("시작일 (yyyy-MM-dd)"),
      endDate: z.string().describe("종료일 (yyyy-MM-dd)"),
      maxRows: z.number().int().min(1).max(5000).optional().describe("반환 최대 행 수 (기본 500)"),
    },
    handle(async ({ deviceId, startDate, endDate, maxRows }) => {
      const rows = await api.getDailyAvgData(deviceId, startDate, endDate);
      return { deviceId, startDate, endDate, ...shrinkRows(rows, maxRows ?? 500) };
    }),
  );

  server.tool(
    "stat_collection_rate",
    "측정기 × 일자별 데이터 수집률(결측률)을 조회한다. 결측 구간 파악에 쓴다.",
    {
      start: z.string().describe("시작일 (yyyy-MM-dd)"),
      end: z.string().describe("종료일 (yyyy-MM-dd)"),
      deviceId: z.string().optional().describe("측정기 ID (생략 시 전체)"),
      maxRows: z.number().int().min(1).max(5000).optional().describe("반환 최대 행 수 (기본 1000)"),
    },
    handle(async ({ start, end, deviceId, maxRows }) => {
      const rows = await api.getCollectionRate(start, end, deviceId);
      return { start, end, deviceId: deviceId ?? "(전체)", ...shrinkRows(rows, maxRows ?? 1000) };
    }),
  );

  server.tool(
    "stat_weather_stations",
    "기상청(KMA) 관측소 목록을 조회한다. stat_weather 의 stnId 를 찾을 때 쓴다.",
    {},
    handle(async () => {
      const rows = await api.getWeatherStations();
      return { count: rows?.length ?? 0, stations: rows };
    }),
  );

  server.tool(
    "stat_weather",
    "기상청 관측 이력(기온·풍향·풍속·습도 등)을 시간별 또는 일별로 조회한다.",
    {
      stnId: z.string().describe("KMA 관측소 번호 (예: 108)"),
      startDate: z.string().describe("시작일 (yyyy-MM-dd)"),
      endDate: z.string().describe("종료일 (yyyy-MM-dd)"),
      mode: z.enum(["hourly", "daily"]).optional().describe("조회 단위 (기본 hourly)"),
      maxRows: z.number().int().min(1).max(5000).optional().describe("반환 최대 행 수 (기본 500)"),
    },
    handle(async ({ stnId, startDate, endDate, mode, maxRows }) => {
      const rows = await api.getWeatherHistory(stnId, startDate, endDate, mode ?? "hourly");
      return { stnId, startDate, endDate, mode: mode ?? "hourly", ...shrinkRows(rows, maxRows ?? 500) };
    }),
  );

  server.tool(
    "sensor_list",
    "센서 메타 정보(항목 id, 이름, 단위, 소수점 자릿수)를 조회한다. 측정값 해석·표기에 쓴다. digit 은 'F1','F2' 형식이라 숫자만 뽑아 쓴다.",
    {},
    handle(async () => {
      const sensors = await api.getSensorList();
      return { count: sensors?.length ?? 0, sensors };
    }),
  );
}
