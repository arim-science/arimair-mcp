// 측정 데이터 시계열 조회 도구 — 응답이 커질 수 있어 maxRows 로 샘플링한다

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArimApiClient } from "../api-client.js";
import { handle, shrinkRows } from "./_shared.js";

const DATE_HINT = "yyyy-MM-dd HH:mm 또는 yyyy-MM-dd HH:mm:ss";

export function registerDataTools(server: McpServer, api: ArimApiClient): void {
  server.tool(
    "data_search",
    "측정 데이터를 기간으로 조회한다. 조회 기간에 따라 서버가 단위를 자동 전환한다 (1일 이하: 분단위 원시, 30일 이하: 시간평균, 초과: 일평균).",
    {
      deviceId: z.string().describe("측정기 ID"),
      startDate: z.string().describe(`시작일시 (${DATE_HINT})`),
      endDate: z.string().describe(`종료일시 (${DATE_HINT})`),
      maxRows: z.number().int().min(1).max(5000).optional().describe("반환 최대 행 수 (기본 500, 초과 시 균등 샘플링)"),
    },
    handle(async ({ deviceId, startDate, endDate, maxRows }) => {
      const rows = await api.searchData(deviceId, startDate, endDate);
      return { deviceId, startDate, endDate, ...shrinkRows(rows, maxRows ?? 500) };
    }),
  );

  server.tool(
    "data_raw_search",
    "기간과 무관하게 항상 분단위 원시 데이터를 조회한다. 통계 테이블을 거치지 않는다.",
    {
      deviceId: z.string().describe("측정기 ID"),
      startDate: z.string().describe(`시작일시 (${DATE_HINT})`),
      endDate: z.string().describe(`종료일시 (${DATE_HINT})`),
      maxRows: z.number().int().min(1).max(5000).optional().describe("반환 최대 행 수 (기본 500)"),
    },
    handle(async ({ deviceId, startDate, endDate, maxRows }) => {
      const rows = await api.searchRawData(deviceId, startDate, endDate);
      return { deviceId, startDate, endDate, ...shrinkRows(rows, maxRows ?? 500) };
    }),
  );

  server.tool(
    "data_recent",
    "측정기의 최근 수집 데이터를 조회한다.",
    {
      deviceId: z.string().describe("측정기 ID"),
      maxRows: z.number().int().min(1).max(5000).optional().describe("반환 최대 행 수 (기본 200)"),
    },
    handle(async ({ deviceId, maxRows }) => {
      const rows = await api.getRecentData(deviceId);
      return { deviceId, ...shrinkRows(rows, maxRows ?? 200) };
    }),
  );
}
