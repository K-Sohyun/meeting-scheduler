import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { DateResultRow, ScheduleRow } from "@/lib/schedule-results";

export type TravelRangeRow = {
  startDate: string;
  endDate: string;
  bestCount: number;
  canCount: number;
  canParticipantIds: string[];
  perfectMatch: boolean;
};

export type TravelSoloSegmentRow = {
  startDate: string;
  endDate: string;
  participantId: string;
};

/** `YYYY-MM-DD` 두 달력 날짜의 차이 `a - b`(일). 로컬 TZ/DST에 의존하지 않음 */
function diffDaysIso(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const ua = Date.UTC(pa[0]!, pa[1]! - 1, pa[2]!);
  const ub = Date.UTC(pb[0]!, pb[1]! - 1, pb[2]!);
  return Math.round((ua - ub) / 86400000);
}

/** 응답 참가자 전원이 그날 best/ok 로 응답한 날인지 */
function isFullParticipationDay(
  row: DateResultRow,
  respondedParticipantIds: string[],
): boolean {
  if (respondedParticipantIds.length === 0) {
    return false;
  }
  const set = new Set(row.canParticipantIds);
  if (row.canParticipantIds.length !== respondedParticipantIds.length) {
    return false;
  }
  return respondedParticipantIds.every((id) => set.has(id));
}

/** 응답자마다 `best`가 날짜 공백 없이 **한 덩어리**인지 (n박 UI로 찍은 구간이 여러 번이면 false) */
function respondentsAllHaveSingleBestRun(
  schedules: ScheduleRow[],
  respondedParticipantIds: string[],
): boolean {
  for (const pid of respondedParticipantIds) {
    const dates = [
      ...new Set(
        schedules
          .filter((s) => s.participant_id === pid && s.status === "best")
          .map((s) => s.date),
      ),
    ].sort((a, b) => a.localeCompare(b));
    if (dates.length === 0) {
      return false;
    }
    let runs = 1;
    for (let i = 1; i < dates.length; i += 1) {
      if (diffDaysIso(dates[i]!, dates[i - 1]!) !== 1) {
        runs += 1;
      }
    }
    if (runs !== 1) {
      return false;
    }
  }
  return true;
}

function pushRangeRow(
  out: TravelRangeRow[],
  slice: string[],
  byDate: Map<string, DateResultRow>,
  respondedParticipantIds: string[],
) {
  const rows = slice.map((dt) => byDate.get(dt)!);
  out.push({
    startDate: slice[0]!,
    endDate: slice[slice.length - 1]!,
    bestCount: Math.min(...rows.map((r) => r.bestCount)),
    canCount: Math.min(...rows.map((r) => r.canCount)),
    canParticipantIds: [...respondedParticipantIds].sort(),
    perfectMatch:
      respondedParticipantIds.length >= 2 && rows.every((r) => r.perfectMatch),
  });
}

function overlapRowMergeKey(r: TravelRangeRow): string {
  return `${r.perfectMatch ? "1" : "0"}|${r.canParticipantIds.join(",")}`;
}

function travelRowForInclusiveSpan(
  startDate: string,
  endDate: string,
  byDate: Map<string, DateResultRow>,
  canParticipantIds: string[],
): TravelRangeRow {
  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map((d) => format(d, "yyyy-MM-dd"));
  const rows = days.map((dt) => byDate.get(dt)!);
  const n = canParticipantIds.length;
  return {
    startDate,
    endDate,
    bestCount: Math.min(...rows.map((r) => r.bestCount)),
    canCount: Math.min(...rows.map((r) => r.canCount)),
    canParticipantIds: [...canParticipantIds].sort(),
    perfectMatch: n >= 2 && rows.every((r) => r.perfectMatch),
  };
}

/** 슬라이딩으로 생긴 줄 중, 같은 참가자 조합·추천 여부이고 시작일이 하루씩만 밀린 연속 체인은 전체 가능 기간 한 줄로 병합 */
function mergeChainsOfSlidingOverlapRows(
  rows: TravelRangeRow[],
  byDate: Map<string, DateResultRow>,
): TravelRangeRow[] {
  if (rows.length <= 1) {
    return rows;
  }
  const sorted = [...rows].sort((a, b) => {
    const cmpK = overlapRowMergeKey(a).localeCompare(overlapRowMergeKey(b));
    if (cmpK !== 0) {
      return cmpK;
    }
    return a.startDate.localeCompare(b.startDate);
  });
  const merged: TravelRangeRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    const k = overlapRowMergeKey(sorted[i]!);
    let j = i;
    while (j + 1 < sorted.length) {
      const cur = sorted[j]!;
      const next = sorted[j + 1]!;
      if (overlapRowMergeKey(next) !== k) {
        break;
      }
      if (diffDaysIso(next.startDate, cur.startDate) !== 1) {
        break;
      }
      j += 1;
    }
    if (i === j) {
      merged.push(sorted[i]!);
    } else {
      const first = sorted[i]!;
      const last = sorted[j]!;
      merged.push(
        travelRowForInclusiveSpan(first.startDate, last.endDate, byDate, first.canParticipantIds),
      );
    }
    i = j + 1;
  }
  return merged;
}

/**
 * 스케줄만 기준: **모든 응답 참가자가 매일 같이 가능한 연속 날**만 공통 후보로 쓴다.
 * - 응답자 **전원**이 `best`를 **한 연속 구간**으로만 두었으면: 공통 연속 구간마다 **전체 기간** 한 줄.
 * - 누구라도 `best`가 **둘 이상의 연속 덩어리**면: 각 공통 run 안에서 `nights+1`일 창 슬라이딩.
 * - 슬라이딩 결과 중 **시작일이 하루씩만 밀리며** 같은 참가자·같은 추천 여부인 줄은 **전체 가능 기간** 한 줄로 병합.
 */
export function buildTravelOverlapNightRanges(
  ranked: DateResultRow[],
  nights: number,
  respondedParticipantIds: string[],
  schedules: ScheduleRow[],
): TravelRangeRow[] {
  if (respondedParticipantIds.length < 2) {
    return [];
  }

  const byDate = new Map(ranked.map((row) => [row.date, row]));
  const fullDates = ranked
    .filter((row) => isFullParticipationDay(row, respondedParticipantIds))
    .map((r) => r.date)
    .sort((a, b) => a.localeCompare(b));

  if (fullDates.length < nights + 1) {
    return [];
  }

  const runs: string[][] = [];
  let cur: string[] = [fullDates[0]!];
  for (let i = 1; i < fullDates.length; i += 1) {
    const d = fullDates[i]!;
    if (diffDaysIso(d, cur[cur.length - 1]!) === 1) {
      cur.push(d);
    } else {
      runs.push(cur);
      cur = [d];
    }
  }
  runs.push(cur);

  const useFullSpan = respondentsAllHaveSingleBestRun(schedules, respondedParticipantIds);
  const out: TravelRangeRow[] = [];
  for (const run of runs) {
    if (run.length < nights + 1) {
      continue;
    }
    if (useFullSpan) {
      pushRangeRow(out, run, byDate, respondedParticipantIds);
    } else {
      for (let i = 0; i <= run.length - (nights + 1); i += 1) {
        const slice = run.slice(i, i + nights + 1);
        pushRangeRow(out, slice, byDate, respondedParticipantIds);
      }
    }
  }

  const merged = mergeChainsOfSlidingOverlapRows(out, byDate);
  return merged.sort((a, b) => {
    if (a.perfectMatch !== b.perfectMatch) {
      return a.perfectMatch ? -1 : 1;
    }
    return a.startDate.localeCompare(b.startDate);
  });
}

/**
 * 참가자별 best 일정을 날짜 공백으로 끊긴 **연속 구간 전체**로 반환.
 */
export function buildTravelSoloSegments(
  schedules: ScheduleRow[],
  respondedParticipantIds: string[],
): TravelSoloSegmentRow[] {
  const out: TravelSoloSegmentRow[] = [];
  for (const pid of respondedParticipantIds) {
    const dates = [
      ...new Set(
        schedules
          .filter((s) => s.participant_id === pid && s.status === "best")
          .map((s) => s.date),
      ),
    ].sort((a, b) => a.localeCompare(b));
    if (dates.length === 0) {
      continue;
    }
    let runStart = 0;
    for (let i = 1; i <= dates.length; i += 1) {
      const endRun = i === dates.length || diffDaysIso(dates[i]!, dates[i - 1]!) !== 1;
      if (endRun) {
        out.push({
          startDate: dates[runStart]!,
          endDate: dates[i - 1]!,
          participantId: pid,
        });
        runStart = i;
      }
    }
  }
  return out.sort((a, b) => {
    const byStart = a.startDate.localeCompare(b.startDate);
    if (byStart !== 0) {
      return byStart;
    }
    return a.participantId.localeCompare(b.participantId);
  });
}
