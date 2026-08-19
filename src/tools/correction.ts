// 보정(캘리브레이션) 인자·모델 버전·보정 전후 비교 조회 도구

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArimApiClient } from "../api-client.js";
import { handle, shrinkRows } from "./_shared.js";

export function registerCorrectionTools(server: McpServer, api: ArimApiClient): void {
  server.tool(
    "correction_devices",
    "보정 대상 측정기 목록과 보정 적용 현황을 조회한다.",
    {},
    handle(async () => {
      const rows = await api.getCorrectionDevices();
      return { count: rows?.length ?? 0, devices: rows };
    }),
  );

  server.tool(
    "correction_trend",
    "측정기의 보정 인자 변화 추이(최근 12개월)를 조회한다.",
    {
      deviceId: z.string().describe("측정기 ID"),
      item: z.string().optional().describe("측정 항목 (예: pm25, pm10, no2. 생략 시 전체)"),
    },
    handle(async ({ deviceId, item }) => {
      const rows = await api.getCorrectionTrend(deviceId, item);
      return { deviceId, item: item ?? "(전체)", count: rows?.length ?? 0, factors: rows };
    }),
  );

  server.tool(
    "correction_compare",
    "보정 전/후 시간별 시계열을 나란히 조회한다. 보정 효과 검증에 쓴다.",
    {
      deviceId: z.string().describe("측정기 ID"),
      startDate: z.string().describe("시작일시 (yyyy-MM-dd HH:mm:ss)"),
      endDate: z.string().describe("종료일시 (yyyy-MM-dd HH:mm:ss)"),
      maxRows: z.number().int().min(1).max(5000).optional().describe("반환 최대 행 수 (기본 500)"),
    },
    handle(async ({ deviceId, startDate, endDate, maxRows }) => {
      const rows = await api.getCorrectionCompare(deviceId, startDate, endDate);
      return { deviceId, startDate, endDate, ...shrinkRows(rows, maxRows ?? 500) };
    }),
  );

  server.tool(
    "correction_factors",
    "특정 적용월에 사용된 보정 인자를 조회한다.",
    {
      deviceId: z.string().describe("측정기 ID"),
      applyMonth: z.string().describe("적용월 (yyyy-MM)"),
    },
    handle(async ({ deviceId, applyMonth }) => {
      const rows = await api.getCorrectionFactors(deviceId, applyMonth);
      return { deviceId, applyMonth, count: rows?.length ?? 0, factors: rows };
    }),
  );

  server.tool(
    "correction_versions",
    "보정 모델의 버전 이력(성능 지표 포함)을 조회한다.",
    {
      deviceId: z.string().describe("측정기 ID"),
      item: z.string().optional().describe("측정 항목 (생략 시 전체 항목)"),
      periodType: z.enum(["monthly", "daily"]).optional().describe("주기 유형 (기본 monthly)"),
      limit: z.number().int().min(1).max(500).optional().describe("조회 건수 (기본 50)"),
    },
    handle(async ({ deviceId, item, periodType, limit }) => {
      const rows = await api.getCorrectionVersions(deviceId, item, periodType, limit);
      return { deviceId, item: item ?? "(전체)", count: rows?.length ?? 0, versions: rows };
    }),
  );
}
