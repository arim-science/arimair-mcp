// 로그인·로그인 컨텍스트 조회 도구

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArimApiClient } from "../api-client.js";
import { handle } from "./_shared.js";

export function registerAuthTools(server: McpServer, api: ArimApiClient): void {
  server.tool(
    "arim_login",
    "ARIM 모니터링 서버에 로그인해 세션을 만든다. 인자를 생략하면 ARIM_MCP_USER/ARIM_MCP_PASS 환경변수를 쓴다.",
    {
      userId: z.string().optional().describe("로그인 아이디"),
      password: z.string().optional().describe("비밀번호"),
      userType: z.enum(["admin", "user"]).optional().describe("계정 유형 (기본 admin)"),
    },
    handle(async ({ userId, password, userType }) => api.login(userId, password, userType)),
  );

  server.tool(
    "arim_whoami",
    "현재 로그인 상태와 조회 필터의 기준이 되는 monitorId, 시스템 설정을 조회한다.",
    {},
    handle(async () => api.me()),
  );

  server.tool(
    "arim_logout",
    "세션을 종료하고 쿠키를 폐기한다.",
    {},
    handle(async () => {
      await api.logout();
      return { success: true, message: "로그아웃했습니다." };
    }),
  );
}
