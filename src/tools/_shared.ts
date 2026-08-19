// 도구 핸들러 공통 래퍼 — 결과 직렬화, 오류 응답, 대량 시계열 축약을 한 곳에서 처리

import type { DataRow } from "../types.js";

export const ok = (v: unknown) => ({
  content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v) }],
});

export const err = (e: unknown) => ({
  content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
  isError: true,
});

/** server.tool 핸들러를 감싸 try/catch 와 직렬화를 없앤다 */
export function handle<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return ok(await fn(args));
    } catch (e: unknown) {
      return err(e);
    }
  };
}

/**
 * 시계열 응답 축약.
 * 서버는 행 수 상한이 없어 1일치 분단위 조회만으로도 1,400행 이상이 나온다.
 * maxRows 를 넘으면 균등 간격으로 샘플링하고, 원본 행 수와 샘플링 여부를 함께 알린다.
 */
export function shrinkRows(rows: DataRow[], maxRows: number): {
  totalRows: number;
  returnedRows: number;
  sampled: boolean;
  rows: DataRow[];
} {
  const total = rows?.length ?? 0;

  if (total <= maxRows) {
    return { totalRows: total, returnedRows: total, sampled: false, rows: rows ?? [] };
  }

  const step = total / maxRows;
  const sampled: DataRow[] = [];
  for (let i = 0; i < maxRows; i++) {
    sampled.push(rows[Math.floor(i * step)]);
  }
  // 마지막 행은 최신값이라 잘리면 안 된다
  const last = rows[total - 1];
  if (sampled[sampled.length - 1] !== last) sampled[sampled.length - 1] = last;

  return { totalRows: total, returnedRows: sampled.length, sampled: true, rows: sampled };
}
