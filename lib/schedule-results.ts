import { eachDayOfInterval, format, parseISO } from "date-fns";

export type ScheduleRow = {
  participant_id: string;
  date: string;
  status: "best" | "ok";
};

export type DateResultRow = {
  date: string;
  bestCount: number;
  okCount: number;
  score: number;
  canCount: number;
  /** 참여자 중 그날 best/ok 를 쓰지 않은 인원 (미기록=불가) */
  stragglerCount: number;
  perfectMatch: boolean;
  /** 예상 인원 - 그날 가능(응답) 인원, 음수는 0으로 표시 권장 */
  gapToExpected: number;
};

/**
 * 가이드: Perfect Match(전원 best/ok) → score 내림차순 → 가능 인원 많은 순
 */
export function buildDateResults(params: {
  dateRangeStart: string;
  dateRangeEnd: string;
  participantIds: string[];
  expectedParticipantCount: number;
  schedules: ScheduleRow[];
}): DateResultRow[] {
  const { dateRangeStart, dateRangeEnd, participantIds, expectedParticipantCount, schedules } =
    params;
  const n = participantIds.length;
  if (n === 0) {
    return [];
  }
  const pidSet = new Set(participantIds);
  const days = eachDayOfInterval({
    start: parseISO(dateRangeStart),
    end: parseISO(dateRangeEnd),
  });

  const byDateParticipant = new Map<string, Map<string, "best" | "ok">>();
  for (const s of schedules) {
    if (!pidSet.has(s.participant_id)) {
      continue;
    }
    if (!byDateParticipant.has(s.date)) {
      byDateParticipant.set(s.date, new Map());
    }
    byDateParticipant.get(s.date)!.set(s.participant_id, s.status);
  }

  const rows: DateResultRow[] = [];

  for (const d of days) {
    const dateKey = format(d, "yyyy-MM-dd");
    const m = byDateParticipant.get(dateKey) ?? new Map();
    let bestCount = 0;
    let okCount = 0;
    let withResponse = 0;
    for (const pid of participantIds) {
      const st = m.get(pid);
      if (st === "best") {
        bestCount += 1;
        withResponse += 1;
      } else if (st === "ok") {
        okCount += 1;
        withResponse += 1;
      }
    }
    const canCount = bestCount + okCount;
    const score = bestCount * 2 + okCount * 1;
    const stragglerCount = n - withResponse;
    const perfectMatch = n > 0 && stragglerCount === 0;
    const gapToExpected = Math.max(0, expectedParticipantCount - canCount);

    rows.push({
      date: dateKey,
      bestCount,
      okCount,
      score,
      canCount,
      stragglerCount,
      perfectMatch,
      gapToExpected,
    });
  }

  return rows.sort((a, b) => {
    if (a.perfectMatch !== b.perfectMatch) {
      return a.perfectMatch ? -1 : 1;
    }
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    if (a.canCount !== b.canCount) {
      return b.canCount - a.canCount;
    }
    return a.date.localeCompare(b.date);
  });
}
