// 사이트(모니터링 대상) 조회·전환 도구 — 서버 내부의 monitorId 를 사용자에게는 "사이트"로 보여준다

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ArimApiClient } from "../api-client.js";
import type { AdminSite } from "../types.js";
import { handle } from "./_shared.js";

/** 사이트 표시명 — 화면의 선택 콤보와 같이 company 를 쓰고, 비어 있으면 name / id 로 내려간다 */
const label = (s: AdminSite): string => s.company || s.name || s.adminId;

/** 이름 비교용 정규화 — 공백과 대소문자 차이는 무시한다 */
const norm = (v: string): string => v.replace(/\s+/g, "").toLowerCase();

/**
 * 검색 대상 문자열 — company 와 name 이 서로 다른 경우가 많아 둘 다 본다.
 * 예: bisco 는 company 가 "_부산시설공단 [혁신임차종료]", name 이 "부산시설공단_지하도상가" 다.
 */
const haystack = (s: AdminSite): string => norm(`${s.company ?? ""} ${s.name ?? ""} ${s.adminId}`);

export function registerSiteTools(server: McpServer, api: ArimApiClient): void {
  server.tool(
    "site_list",
    "조회 대상으로 선택할 수 있는 사이트 목록과 현재 선택된 사이트를 조회한다. 측정기·데이터·리포트 조회는 모두 현재 사이트를 기준으로 한다.",
    {},
    handle(async () => {
      const [sites, currentId] = await Promise.all([api.getSites(), api.getCurrentSiteId()]);
      const current = sites.find((s) => s.adminId === currentId);

      return {
        count: sites.length,
        currentSiteId: currentId ?? null,
        currentSiteName: current ? label(current) : null,
        // monitorId 가 'admin' 이면 특정 사이트가 아니라 전체 상태다 (화면도 이때 첫 사이트로 전환한다)
        note: current ? undefined : "선택된 사이트가 없습니다. site_select 로 사이트를 먼저 지정하세요.",
        sites: sites.map((s) => ({
          siteId: s.adminId,
          siteName: label(s),
          current: s.adminId === currentId,
        })),
      };
    }),
  );

  server.tool(
    "site_select",
    "조회 대상 사이트를 바꾼다. 사이트 이름의 일부(예: '부산시설공단')만 줘도 되고, 정확한 siteId 를 줘도 된다. 이후의 모든 조회가 이 사이트 기준으로 바뀐다.",
    {
      site: z.string().describe("사이트 이름 일부 또는 siteId"),
    },
    handle(async ({ site }) => {
      const sites = await api.getSites();
      const keyword = norm(site);

      if (!keyword) {
        throw new Error("사이트 이름이나 siteId 를 지정하세요.");
      }

      // siteId 정확 일치를 먼저 본다 — 이름이 우연히 겹쳐도 id 를 준 의도를 우선한다
      let matches = sites.filter((s) => norm(s.adminId) === keyword);

      if (matches.length === 0) {
        matches = sites.filter((s) => norm(s.company ?? "") === keyword || norm(s.name ?? "") === keyword);
      }

      // 사용자가 말하는 순서는 등록된 이름 순서와 다르다.
      // ("울산 환경보건센터" ↔ "[환경보건센터] 울산 울산대")
      // 그래서 통째로 포함되는지가 아니라 낱말이 모두 들어 있는지로 본다.
      if (matches.length === 0) {
        const words = site.split(/\s+/).map(norm).filter(Boolean);
        matches = sites.filter((s) => {
          const target = haystack(s);
          return words.every((w) => target.includes(w));
        });
      }

      if (matches.length === 0) {
        throw new Error(
          `'${site}' 와 일치하는 사이트가 없습니다. (선택 가능한 사이트 ${sites.length}개) ` +
            "site_list 도구로 목록을 확인하세요.",
        );
      }

      if (matches.length > 1) {
        throw new Error(
          `'${site}' 로는 사이트가 하나로 좁혀지지 않습니다. 후보: ` +
            matches.map((s) => `${label(s)}(${s.adminId})`).join(", "),
        );
      }

      const target = matches[0];
      await api.selectSite(target.adminId);

      return {
        success: true,
        siteId: target.adminId,
        siteName: label(target),
        message: `조회 대상 사이트를 '${label(target)}' 으로 변경했습니다.`,
      };
    }),
  );
}
