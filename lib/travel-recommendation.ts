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

function isStrictParticipantSuperset(superIds: string[], subIds: string[]): boolean {
  if (superIds.length <= subIds.length) {
    return false;
  }
  const set = new Set(superIds);
  return subIds.every((id) => set.has(id));
}

/** 양 끝 포함 구간이 날짜 한 칸이라도 겹치면 true (ISO yyyy-MM-dd 문자열 비교). */
function windowsOverlap(a: TravelRangeRow, b: TravelRangeRow): boolean {
  return !(a.endDate < b.startDate || b.endDate < a.startDate);
}

function representativeWindowsForCluster(
  cluster: TravelRangeRow[],
  nights: number,
  allWindows: TravelRangeRow[],
): TravelRangeRow[] {
  if (cluster.length === 0) {
    return [];
  }
  const step = nights + 1;
  const byStart = new Map(cluster.map((w) => [w.startDate, w]));
  const startsSorted = [...byStart.keys()].sort((a, b) => a.localeCompare(b));
  const minStart = startsSorted[0]!;
  const maxStart = startsSorted[startsSorted.length - 1]!;

  const stronger = allWindows.filter((w) =>
    isStrictParticipantSuperset(w.canParticipantIds, cluster[0]!.canParticipantIds),
  );

  const candidateBases = new Set<string>();
  for (let o = 0; o < step; o += 1) {
    const base = format(addDays(parseISO(`${minStart}T00:00:00`), o), "yyyy-MM-dd");
    if (base <= maxStart) {
      candidateBases.add(base);
    }
  }
  // 실제로 존재하는 시작일도 base 후보에 포함해, 중간 추천 구간이 껴도
  // 연속 단독 구간을 nights+1 블록으로 최대한 보존한다.
  for (const s of startsSorted) {
    candidateBases.add(s);
  }

  let best: TravelRangeRow[] = [];
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestCount = -1;
  let bestBase = "";

  for (const base of candidateBases) {
    const seq: TravelRangeRow[] = [];
    let cur = base;
    while (cur <= maxStart) {
      const w = byStart.get(cur);
      if (w) {
        seq.push(w);
      }
      cur = format(addDays(parseISO(`${cur}T00:00:00`), step), "yyyy-MM-dd");
    }
    if (seq.length === 0) {
      continue;
    }

    // 1순위: 대표 블록 개수 최대화, 2순위: 상위집합(더 강한) 창과의 겹침 최소화
    let penalty = 0;
    for (const w of seq) {
      for (const s of stronger) {
        if (windowsOverlap(w, s)) {
          penalty += 1;
        }
      }
    }

    if (
      seq.length > bestCount ||
      (seq.length === bestCount &&
        (penalty < bestPenalty || (penalty === bestPenalty && (bestBase === "" || base < bestBase))))
    ) {
      bestPenalty = penalty;
      bestCount = seq.length;
      best = seq;
      bestBase = base;
    }
  }

  return best;
}

function mergeWindowsByOverlapChain(
  group: TravelRangeRow[],
  nights: number,
  allWindows: TravelRangeRow[],
): TravelRangeRow[] {
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
    out.push(...representativeWindowsForCluster(part, nights, allWindows));
  }
  return out;
}

/**
 * 방 범위 안에서 `nights+1`일 창을 모두 훑고, 창마다 날짜별 best/ok 교집합이 비지 않은 것만 남깁니다.
 * 같은 참가자 조합인 창이 겹치며 이어지는 연속 덩어리는 `nights+1` 간격 대표 창으로 압축합니다.
 * (예: 1~12 연속 + 3박4일이면 1~4, 5~8, 9~12. 중간에 다른 조합의 추천 창이 있으면 별도 줄로 함께 노출)
 */
export function buildTravelRecommendationRanges(
  ranked: DateResultRow[],
  nights: number,
  /** 비어 있지 않으면 이 시작일만 슬라이딩 후보로 삼음(참가자별 저장·추론 시작일의 합집합) */
  allowedStartDates: Set<string> = new Set(),
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
    if (allowedStartDates.size > 0 && !allowedStartDates.has(startDate)) {
      continue;
    }
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
      // 일별 perfectMatch만 쓰면 응답자 1명일 때도 true → 여행 "추천"은 교집합 2인 이상일 때만
      perfectMatch:
        commonCanIds.length >= 2 && span.every((row) => row.perfectMatch),
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
    merged.push(...mergeWindowsByOverlapChain(group, nights, raw));
  }

  return merged.sort((a, b) => {
    const diff = b.canParticipantIds.length - a.canParticipantIds.length;
    if (diff !== 0) {
      return diff;
    }
    return a.startDate.localeCompare(b.startDate);
  });
}
