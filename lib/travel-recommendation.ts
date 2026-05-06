import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";
import type { DateResultRow } from "@/lib/schedule-results";

export type TravelRangeRow = {
  startDate: string;
  endDate: string;
  bestCount: number;
  canCount: number;
  canParticipantIds: string[];
  perfectMatch: boolean;
};

function participantSetKey(ids: string[]): string {
  return [...ids].sort().join("\0");
}

/** 양 끝 포함 구간이 날짜 한 칸이라도 겹치면 true (ISO yyyy-MM-dd 문자열 비교). */
function windowsOverlap(a: TravelRangeRow, b: TravelRangeRow): boolean {
  return !(a.endDate < b.startDate || b.endDate < a.startDate);
}

function mergeWindowsByOverlapChain(group: TravelRangeRow[]): TravelRangeRow[] {
  if (group.length <= 1) {
    return [...group];
  }
  const n = group.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    if (parent[i] !== i) {
      parent[i] = find(parent[i]);
    }
    return parent[i];
  }

  function union(i: number, j: number) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) {
      parent[ri] = rj;
    }
  }

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (windowsOverlap(group[i], group[j])) {
        union(i, j);
      }
    }
  }

  const clusters = new Map<number, TravelRangeRow[]>();
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    const arr = clusters.get(r);
    if (arr) {
      arr.push(group[i]);
    } else {
      clusters.set(r, [group[i]]);
    }
  }

  const out: TravelRangeRow[] = [];
  for (const part of clusters.values()) {
    part.sort((a, b) => a.startDate.localeCompare(b.startDate));
    out.push(part[0]);
    if (part.length > 1 && part[part.length - 1].startDate !== part[0].startDate) {
      out.push(part[part.length - 1]);
    }
  }
  return out;
}

/**
 * 방 범위 안에서 `nights+1`일 창을 모두 훑고, 창마다 날짜별 best/ok 교집합이 비지 않은 것만 남깁니다.
 * 같은 참가자 조합인 창이 여럿이면, **겹치는 창끼리** 연결 요소로 묶고, 각 요소 안에서는 **가장 이른·가장 늦은 시작일** 창만 둡니다.
 * (한 사람의 일정이 DB상 연속 10~17로만 잡혀 있어도, 슬라이딩 창들이 서로 겹쳐 한 덩어리로 이어지므로 10~13·14~17 두 줄로 정리됩니다. 날짜가 떨어진 두 구간은 서로 다른 요소로 나뉩니다.)
 */
export function buildTravelRecommendationRanges(
  ranked: DateResultRow[],
  nights: number,
): TravelRangeRow[] {
  const byDate = new Map(ranked.map((row) => [row.date, row]));
  const sortedDates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
  if (sortedDates.length === 0) {
    return [];
  }

  const roomStart = parseISO(sortedDates[0]);
  const roomEnd = parseISO(sortedDates[sortedDates.length - 1]);

  const raw: TravelRangeRow[] = [];

  const startDays = eachDayOfInterval({
    start: roomStart,
    end: addDays(roomEnd, -nights),
  });

  for (const day of startDays) {
    const startDate = format(day, "yyyy-MM-dd");
    const span: DateResultRow[] = [];
    let valid = true;
    for (let i = 0; i <= nights; i += 1) {
      const date = format(addDays(day, i), "yyyy-MM-dd");
      const row = byDate.get(date);
      if (!row || row.canCount === 0) {
        valid = false;
        break;
      }
      span.push(row);
    }
    if (!valid || span.length === 0) {
      continue;
    }

    let commonCanIds = [...span[0].canParticipantIds];
    for (let i = 1; i < span.length; i += 1) {
      const set = new Set(span[i].canParticipantIds);
      commonCanIds = commonCanIds.filter((id) => set.has(id));
    }
    if (commonCanIds.length === 0) {
      continue;
    }

    raw.push({
      startDate,
      endDate: format(addDays(day, nights), "yyyy-MM-dd"),
      bestCount: Math.min(...span.map((row) => row.bestCount)),
      canCount: Math.min(...span.map((row) => row.canCount)),
      canParticipantIds: commonCanIds,
      perfectMatch: span.every((row) => row.perfectMatch),
    });
  }

  const byKey = new Map<string, TravelRangeRow[]>();
  for (const row of raw) {
    const k = participantSetKey(row.canParticipantIds);
    const arr = byKey.get(k);
    if (arr) {
      arr.push(row);
    } else {
      byKey.set(k, [row]);
    }
  }

  const merged: TravelRangeRow[] = [];
  for (const group of byKey.values()) {
    merged.push(...mergeWindowsByOverlapChain(group));
  }

  return merged.sort((a, b) => {
    const diff = b.canParticipantIds.length - a.canParticipantIds.length;
    if (diff !== 0) {
      return diff;
    }
    return a.startDate.localeCompare(b.startDate);
  });
}
