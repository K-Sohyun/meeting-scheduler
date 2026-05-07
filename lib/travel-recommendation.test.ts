import { eachDayOfInterval, format, parseISO } from "date-fns";
import { describe, expect, it } from "vitest";
import type { DateResultRow, ScheduleRow } from "./schedule-results";
import { buildTravelOverlapNightRanges, buildTravelSoloSegments } from "./travel-recommendation";

function buildRankedRows(params: {
  start: string;
  end: string;
  participants: string[];
  bestDatesByParticipant: Record<string, Set<string>>;
}): DateResultRow[] {
  const { start, end, participants, bestDatesByParticipant } = params;
  const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
  return days.map((d) => {
    const date = format(d, "yyyy-MM-dd");
    const canParticipantIds = participants.filter((pid) => bestDatesByParticipant[pid]?.has(date));
    const bestCount = canParticipantIds.length;
    return {
      date,
      bestCount,
      okCount: 0,
      score: bestCount * 2,
      canCount: bestCount,
      canParticipantIds,
      stragglerCount: participants.length - bestCount,
      perfectMatch: bestCount === participants.length,
      gapToExpected: 0,
    };
  });
}

function schedulesFromBest(
  bestDatesByParticipant: Record<string, Set<string>>,
): ScheduleRow[] {
  const out: ScheduleRow[] = [];
  for (const [pid, dates] of Object.entries(bestDatesByParticipant)) {
    for (const date of dates) {
      out.push({ participant_id: pid, date, status: "best" });
    }
  }
  return out;
}

describe("buildTravelOverlapNightRanges", () => {
  it("응답자 best가 모두 한 연속 구간이면 공통 구간 전체를 한 줄로", () => {
    const bestDatesByParticipant = {
      a: new Set([
        "2026-05-01",
        "2026-05-02",
        "2026-05-03",
        "2026-05-04",
        "2026-05-05",
      ]),
      b: new Set([
        "2026-05-01",
        "2026-05-02",
        "2026-05-03",
        "2026-05-04",
        "2026-05-05",
      ]),
    };
    const ranked = buildRankedRows({
      start: "2026-05-01",
      end: "2026-05-07",
      participants: ["a", "b"],
      bestDatesByParticipant,
    });
    const nights = 2;
    const ranges = buildTravelOverlapNightRanges(
      ranked,
      nights,
      ["a", "b"],
      schedulesFromBest(bestDatesByParticipant),
    );
    expect(ranges.map((r) => `${r.startDate}~${r.endDate}`)).toEqual(["2026-05-01~2026-05-05"]);
    expect(ranges.every((r) => r.canParticipantIds.length === 2)).toBe(true);
  });

  it("누군가 best가 두 덩어리 이상이면 공통 run마다 n박 슬라이딩", () => {
    const bestDatesByParticipant = {
      a: new Set([
        "2026-05-01",
        "2026-05-02",
        "2026-05-03",
        "2026-05-04",
        "2026-05-05",
        "2026-05-06",
        "2026-05-07",
        "2026-05-08",
        "2026-05-09",
        "2026-05-10",
      ]),
      b: new Set([
        "2026-05-01",
        "2026-05-02",
        "2026-05-03",
        "2026-05-08",
        "2026-05-09",
        "2026-05-10",
      ]),
    };
    const ranked = buildRankedRows({
      start: "2026-05-01",
      end: "2026-05-10",
      participants: ["a", "b"],
      bestDatesByParticipant,
    });
    const nights = 2;
    const ranges = buildTravelOverlapNightRanges(
      ranked,
      nights,
      ["a", "b"],
      schedulesFromBest(bestDatesByParticipant),
    );
    expect(ranges.map((r) => `${r.startDate}~${r.endDate}`)).toEqual([
      "2026-05-01~2026-05-03",
      "2026-05-08~2026-05-10",
    ]);
  });

  it("응답자 1명이면 공통 구간 없음", () => {
    const ranked = buildRankedRows({
      start: "2026-05-01",
      end: "2026-05-05",
      participants: ["a"],
      bestDatesByParticipant: {
        a: new Set(["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05"]),
      },
    });
    expect(buildTravelOverlapNightRanges(ranked, 2, ["a"], [])).toEqual([]);
  });

  it("공통 가능일이 끊기면 구간마다 처리(둘 다 best 두 덩어리 → 슬라이딩 후 연속 창 병합)", () => {
    const bestDatesByParticipant = {
      a: new Set([
        "2026-05-01",
        "2026-05-02",
        "2026-05-03",
        "2026-05-04",
        "2026-05-08",
        "2026-05-09",
        "2026-05-10",
      ]),
      b: new Set([
        "2026-05-01",
        "2026-05-02",
        "2026-05-03",
        "2026-05-04",
        "2026-05-08",
        "2026-05-09",
        "2026-05-10",
      ]),
    };
    const ranked = buildRankedRows({
      start: "2026-05-01",
      end: "2026-05-10",
      participants: ["a", "b"],
      bestDatesByParticipant,
    });
    const nights = 1;
    const ranges = buildTravelOverlapNightRanges(
      ranked,
      nights,
      ["a", "b"],
      schedulesFromBest(bestDatesByParticipant),
    );
    expect(ranges.map((r) => `${r.startDate}~${r.endDate}`).sort()).toEqual([
      "2026-05-01~2026-05-04",
      "2026-05-08~2026-05-10",
    ]);
  });

  it("슬라이딩 줄이 하루씩만 밀리면 같은 응답으로 전체 기간 한 줄 병합", () => {
    const bestDatesByParticipant = {
      a: new Set([
        "2026-06-01",
        "2026-06-02",
        "2026-06-04",
        "2026-06-05",
        "2026-06-06",
        "2026-06-07",
        "2026-06-08",
        "2026-06-09",
      ]),
      b: new Set([
        "2026-06-04",
        "2026-06-05",
        "2026-06-06",
        "2026-06-07",
        "2026-06-08",
        "2026-06-09",
      ]),
    };
    const ranked = buildRankedRows({
      start: "2026-06-01",
      end: "2026-06-09",
      participants: ["a", "b"],
      bestDatesByParticipant,
    });
    const ranges = buildTravelOverlapNightRanges(
      ranked,
      2,
      ["a", "b"],
      schedulesFromBest(bestDatesByParticipant),
    );
    expect(ranges.map((r) => `${r.startDate}~${r.endDate}`)).toEqual(["2026-06-04~2026-06-09"]);
  });
});

describe("buildTravelSoloSegments", () => {
  it("best 일정을 공백으로 끊긴 연속 구간으로 묶음", () => {
    const p1 = "00000000-0000-0000-0000-0000000000a1";
    const schedules: ScheduleRow[] = [
      { participant_id: p1, date: "2026-05-01", status: "best" },
      { participant_id: p1, date: "2026-05-02", status: "best" },
      { participant_id: p1, date: "2026-05-10", status: "best" },
      { participant_id: p1, date: "2026-05-11", status: "best" },
    ];
    const segs = buildTravelSoloSegments(schedules, [p1]);
    expect(segs.map((s) => `${s.startDate}~${s.endDate}`)).toEqual([
      "2026-05-01~2026-05-02",
      "2026-05-10~2026-05-11",
    ]);
    expect(segs[0]!.participantId).toBe(p1);
  });
});
