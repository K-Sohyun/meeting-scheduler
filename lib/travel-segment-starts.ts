import { addDays, format, parseISO } from "date-fns";
import type { ScheduleRow } from "@/lib/schedule-results";

export type TravelSegmentStartRow = {
  participant_id: string;
  start_date: string;
};

/**
 * 연속 best 날짜(정렬됨)에서, 각 연속 구간마다 `nights+1`일 창이 구간 안에 완전히 들어가는
 * 모든 시작일을 모음 (DB 없을 때 추론용). 한 덩어리가 창보다 길면 첫날 하나로는 끝날이 덮이지 않아
 * 검증이 깨지므로 구간 내 가능한 모든 시작일을 넣는다.
 */
export function inferTravelStartsFromSortedBestDates(sortedDates: string[], nights: number): string[] {
  if (sortedDates.length === 0 || nights < 0) {
    return [];
  }
  const windowLen = nights + 1;
  const starts: string[] = [];
  const flushRun = (runStart: number, runEnd: number) => {
    const len = runEnd - runStart + 1;
    if (len < windowLen) {
      return;
    }
    for (let j = runStart; j <= runEnd - nights; j += 1) {
      starts.push(sortedDates[j]!);
    }
  };
  let runStart = 0;
  for (let i = 1; i < sortedDates.length; i += 1) {
    const prev = parseISO(`${sortedDates[i - 1]!}T00:00:00`);
    const cur = parseISO(`${sortedDates[i]!}T00:00:00`);
    if ((cur.getTime() - prev.getTime()) / 86400000 !== 1) {
      flushRun(runStart, i - 1);
      runStart = i;
    }
  }
  flushRun(runStart, sortedDates.length - 1);
  return starts;
}

function bestDatesForParticipant(schedules: ScheduleRow[], participantId: string): string[] {
  const dates = schedules
    .filter((s) => s.participant_id === participantId && s.status === "best")
    .map((s) => s.date);
  return [...new Set(dates)].sort((a, b) => a.localeCompare(b));
}

/** 참가자별 저장된 시작일이 있으면 그것만, 없으면 일정에서 추론한 뒤 합집합 */
export function buildTravelAllowedStartUnion(params: {
  respondedParticipantIds: string[];
  segmentRows: TravelSegmentStartRow[];
  schedules: ScheduleRow[];
  nights: number;
}): Set<string> {
  const { respondedParticipantIds, segmentRows, schedules, nights } = params;
  const byParticipant = new Map<string, string[]>();
  for (const row of segmentRows) {
    const arr = byParticipant.get(row.participant_id);
    if (arr) {
      arr.push(row.start_date);
    } else {
      byParticipant.set(row.participant_id, [row.start_date]);
    }
  }

  const union = new Set<string>();
  for (const pid of respondedParticipantIds) {
    const stored = byParticipant.get(pid);
    if (stored && stored.length > 0) {
      for (const d of stored) {
        union.add(d);
      }
    } else {
      for (const d of inferTravelStartsFromSortedBestDates(
        bestDatesForParticipant(schedules, pid),
        nights,
      )) {
        union.add(d);
      }
    }
  }
  return union;
}

/**
 * 여행 시작일 목록이 nights+1 창들로 저장된 날짜 집합과 정확히 일치하는지 검사.
 */
export function validateTravelStartsMatchEntries(
  travelStarts: string[],
  nights: number,
  entryDatesSorted: string[],
): string | null {
  if (entryDatesSorted.length === 0) {
    return travelStarts.length > 0 ? "일정이 비었는데 여행 시작일이 전달됐습니다." : null;
  }
  if (travelStarts.length === 0) {
    return "여행 모임에서는 여행 시작일(travelStarts)이 필요합니다.";
  }
  const set = new Set(entryDatesSorted);
  const covered = new Set<string>();
  const uniqStarts = [...new Set(travelStarts)].sort((a, b) => a.localeCompare(b));

  for (const s of uniqStarts) {
    for (let i = 0; i <= nights; i += 1) {
      const d = format(addDays(parseISO(`${s}T00:00:00`), i), "yyyy-MM-dd");
      if (!set.has(d)) {
        return `시작일 ${s}에 대한 연속 ${nights + 1}일이 저장된 날짜와 맞지 않습니다.`;
      }
      covered.add(d);
    }
  }
  for (const d of entryDatesSorted) {
    if (!covered.has(d)) {
      return "일부 선택 날짜가 어느 시작일 구간에도 속하지 않습니다. 여행 시작일을 모두 지정해 주세요.";
    }
  }
  return null;
}
