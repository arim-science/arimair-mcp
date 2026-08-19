#!/usr/bin/env node
// ARIM 모니터링 시스템 MCP 서버 진입점 — stdio 트랜스포트로 도구 그룹을 등록한다

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { ArimApiClient } from "./api-client.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerSiteTools } from "./tools/site.js";
import { registerDeviceTools } from "./tools/device.js";
import { registerDataTools } from "./tools/data.js";
import { registerStatisticsTools } from "./tools/statistics.js";
import { registerCorrectionTools } from "./tools/correction.js";
import { registerReportTools } from "./tools/report.js";
import { registerAlarmTools } from "./tools/alarm.js";
import { registerMonitorTools } from "./tools/monitor.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const apiClient = new ArimApiClient(config);

  const server = new McpServer({
    name: "arim-mcp",
    version: "0.1.0",
  });

  registerAuthTools(server, apiClient);
  registerSiteTools(server, apiClient);
  registerDeviceTools(server, apiClient);
  registerDataTools(server, apiClient);
  registerStatisticsTools(server, apiClient);
  registerCorrectionTools(server, apiClient);
  registerReportTools(server, apiClient);
  registerAlarmTools(server, apiClient);
  registerMonitorTools(server, apiClient);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`arim-mcp server started on stdio (base: ${config.baseUrl})`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
