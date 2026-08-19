// 모니터링 대시보드 집계(가동 현황·수집 건수·고장 측정기·오염장미도) 조회 도구

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArimApiClient } from "../api-client.js";
import { handle, shrinkRows } from "./_shared.js";

export function registerMonitorTools(server: McpServer, api: ArimApiClient): void {
  server.tool(
    "monitor_device_state",
    "측정기 가동/통신 상태 집계를 조회한다.",
    {},
    handle(async () => api.getDeviceState()),
  );

  server.tool(
    "monitor_working_percent",
    "측정기 정상 가동률을 조회한다.",
    {},
    handle(async () => api.getWorkingDevicePercent()),
  );

  server.tool(
    "monitor_data_count",
    "데이터 수집 건수 집계를 조회한다.",
    {},
    handle(async () => api.getDataCount()),
  );

  server.tool(
    "monitor_fault_devices",
    "고장·이상 상태로 판정된 측정기 목록을 조회한다.",
    {},
    handle(async () => {
      const rows = await api.getFaultDevices();
      return { count: rows?.length ?? 0, devices: rows };
    }),
  );

  server.tool(
    "monitor_search",
    "모니터링 화면과 동일한 기준으로 측정기의 기간별 데이터를 조회한다.",
    {
      deviceId: z.string().describe("측정기 ID"),
      startDate: z.string().describe("시작일시 (yyyy-MM-dd HH:mm:ss)"),
      endDate: z.string().describe("종료일시 (yyyy-MM-dd HH:mm:ss)"),
      maxRows: z.number().int().min(1).max(5000).optional().describe("반환 최대 행 수 (기본 500)"),
    },
    handle(async ({ deviceId, startDate, endDate, maxRows }) => {
      const rows = await api.getMonitoringSearch(deviceId, startDate, endDate);
      return { deviceId, startDate, endDate, ...shrinkRows(rows, maxRows ?? 500) };
    }),
  );

  server.tool(
    "monitor_rose",
    "오염장미도(풍향별 농도 분포) 데이터를 조회한다.",
    { period: z.enum(["3hour", "daily", "weekly"]).describe("집계 구간") },
    handle(async ({ period }) => {
      const rows = await api.getRose(period);
      return { period, count: rows?.length ?? 0, rose: rows };
    }),
  );

  server.tool(
    "monitor_rose_search",
    "지정 기간의 오염장미도 데이터를 조회한다.",
    {
      startDate: z.string().describe("시작일시 (yyyy-MM-dd HH:mm:ss)"),
      endDate: z.string().describe("종료일시 (yyyy-MM-dd HH:mm:ss)"),
    },
    handle(async ({ startDate, endDate }) => {
      const rows = await api.getRoseSearch(startDate, endDate);
      return { startDate, endDate, count: rows?.length ?? 0, rose: rows };
    }),
  );
}
