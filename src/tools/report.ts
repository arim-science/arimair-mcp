// 리포트 발행 이력·본문 조회 도구

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArimApiClient } from "../api-client.js";
import { handle } from "./_shared.js";

export function registerReportTools(server: McpServer, api: ArimApiClient): void {
  server.tool(
    "report_list",
    "리포트 발행 이력을 조회한다. (측정기, 대상월, 생성/메일 발송 여부, 파일명)",
    {},
    handle(async () => {
      const rows = await api.getReportList();
      return { count: rows?.length ?? 0, reports: rows };
    }),
  );

  server.tool(
    "report_get",
    "리포트 발행 이력 한 건의 상세를 조회한다.",
    { no: z.string().describe("리포트 이력 번호(no)") },
    handle(async ({ no }) => api.getReport(no)),
  );

  server.tool(
    "report_months",
    "리포트를 발행할 수 있는 대상 월 목록을 조회한다.",
    {},
    handle(async () => {
      const rows = await api.getReportMonths();
      return { count: rows?.length ?? 0, months: rows };
    }),
  );

  server.tool(
    "report_v2_html",
    "신규 리포트(V2)의 HTML 본문을 조회한다. 저장본이 없으면 서버가 생성하며 LLM 소견 생성 때문에 오래 걸릴 수 있다.",
    {
      deviceId: z.string().describe("측정기 ID"),
      yearMonth: z.string().describe("대상월 (yyyy-MM)"),
      maxChars: z.number().int().min(500).max(200000).optional().describe("반환 최대 글자 수 (기본 20000)"),
    },
    handle(async ({ deviceId, yearMonth, maxChars }) => {
      const html = await api.getReportV2Html(deviceId, yearMonth);
      const limit = maxChars ?? 20000;
      return {
        deviceId,
        yearMonth,
        totalChars: html.length,
        truncated: html.length > limit,
        html: html.length > limit ? html.slice(0, limit) : html,
      };
    }),
  );
}
