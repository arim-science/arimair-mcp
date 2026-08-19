// 알람 이력·임계치 알림 설정 조회 도구

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArimApiClient } from "../api-client.js";
import { handle, shrinkRows } from "./_shared.js";

export function registerAlarmTools(server: McpServer, api: ArimApiClient): void {
  server.tool(
    "alarm_list",
    "발생한 알람 이력을 조회한다.",
    { maxRows: z.number().int().min(1).max(5000).optional().describe("반환 최대 행 수 (기본 300)") },
    handle(async ({ maxRows }) => {
      const rows = await api.getAlarmList();
      return shrinkRows(rows, maxRows ?? 300);
    }),
  );

  server.tool(
    "alarm_config_list",
    "센서 임계치 문자 알림 설정을 조회한다. adminId 를 생략하면 arim_whoami 의 monitorId 를 쓴다.",
    { adminId: z.string().optional().describe("관리자 ID (생략 시 현재 세션의 monitorId)") },
    handle(async ({ adminId }) => {
      let target = adminId;
      if (!target) {
        const me = await api.me();
        target = me?.monitorId ?? me?.id ?? undefined;
        if (!target) throw new Error("monitorId 를 확인할 수 없습니다. adminId 를 직접 지정하세요.");
      }
      const rows = await api.getAlarmConfigList(target);
      return { adminId: target, count: rows?.length ?? 0, configs: rows };
    }),
  );
}
