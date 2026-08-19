// 측정기(디바이스) 목록·상세·실시간 상태 조회 도구

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArimApiClient } from "../api-client.js";
import { handle } from "./_shared.js";

export function registerDeviceTools(server: McpServer, api: ArimApiClient): void {
  server.tool(
    "device_list",
    "로그인 계정이 볼 수 있는 측정기 목록을 조회한다. (id, 이름, 주소, 경위도, 센서/네트워크 상태, 보정 적용 여부)",
    {},
    handle(async () => {
      const devices = await api.getDeviceList();
      return { count: devices?.length ?? 0, devices };
    }),
  );

  server.tool(
    "device_get",
    "측정기 한 대의 상세 정보를 조회한다.",
    { deviceId: z.string().describe("측정기 ID (예: D0517)") },
    handle(async ({ deviceId }) => api.getDevice(deviceId)),
  );

  server.tool(
    "device_realtime",
    "전체 측정기의 최신 측정값을 조회한다. (보정 미적용 원시값 기준)",
    {},
    handle(async () => {
      const rows = await api.getDeviceRealtime();
      return { count: rows?.length ?? 0, devices: rows };
    }),
  );

  server.tool(
    "device_realtime_correction",
    "전체 측정기의 최신 측정값을 보정 적용값으로 조회한다.",
    {},
    handle(async () => {
      const rows = await api.getDeviceRealtimeCorrection();
      return { count: rows?.length ?? 0, devices: rows };
    }),
  );

  server.tool(
    "device_nearby_stations",
    "측정기 인근의 에어코리아 측정소 목록을 거리순으로 조회한다. 보정 기준국 확인에 쓴다.",
    { deviceId: z.string().describe("측정기 ID") },
    handle(async ({ deviceId }) => {
      const rows = await api.getNearbyStations(deviceId);
      return { count: rows?.length ?? 0, stations: rows };
    }),
  );
}
