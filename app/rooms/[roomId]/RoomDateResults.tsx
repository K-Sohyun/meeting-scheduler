import type { DateResultRow } from "@/lib/schedule-results";
import type { TravelRangeRow, TravelSoloSegmentRow } from "@/lib/travel-recommendation";

type RoomDateResultsProps = {
  ranked: DateResultRow[];
  participantCount: number;
  respondedCount: number;
  participantNameById: Record<string, string>;
  expectedCount: number;
  roomType?: "single" | "travel";
  nights?: number | null;
  travelOverlapRanges?: TravelRangeRow[];
  travelSoloSegments?: TravelSoloSegmentRow[];
  /** 방에 저장된 schedules 행 수 (0이면 아직 아무도 가능 일정을 제출하지 않음) */
  scheduleRowCount: number;
  /** 지정 시, 「모두 가능」목록만 최대 N줄(개인 선호는 연속 구간 전체를 모두 표시) */
  maxRows?: number;
};

export function RoomDateResults({
  ranked,
  participantCount,
  respondedCount,
  participantNameById,
  expectedCount,
  roomType = "single",
  nights = null,
  travelOverlapRanges = [],
  travelSoloSegments = [],
  scheduleRowCount,
  maxRows,
}: RoomDateResultsProps) {
  if (participantCount === 0) {
    return (
      <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">일정 추천</h2>
        <p className="mt-2 text-sm text-app-muted">참여자가 생기면 추천 일정이 보여요.</p>
      </section>
    );
  }

  if (scheduleRowCount === 0) {
    return (
      <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">일정 추천</h2>
        <p className="mt-2 text-sm text-app-muted">
          아직 응답이 없어요. 참여자가 일정을 저장하면 표시됩니다.
        </p>
      </section>
    );
  }

  const respondedOnly = ranked.filter((row) => row.canCount > 0);
  const show =
    maxRows !== undefined ? respondedOnly.slice(0, maxRows) : respondedOnly;

  const overlapShown =
    maxRows !== undefined
      ? travelOverlapRanges.slice(0, maxRows)
      : travelOverlapRanges;
  /** 개인 구간은 참가자별 연속 덩어리마다 한 줄이므로 maxRows로 자르면 같은 사람의 뒤쪽 구간이 사라짐 */
  const soloShown = travelSoloSegments;
  const soloGrouped = groupSoloSegmentsByRange(soloShown, participantNameById);
  const soloGroupedForDisplay = filterSoloGroupsDedupExactOverlap(
    soloGrouped,
    overlapShown,
  );

  const isTravel = roomType === "travel" && nights != null;

  return (
    <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">일정 추천</h2>
      {!isTravel ? (
        <p className="mt-1 text-sm text-app-muted">
          응답을 바탕으로 모이기 좋은 날부터 순서대로 보여요.
        </p>
      ) : null}
      {expectedCount > 0 ? (
        <p className="mt-1 text-sm text-app-muted">
          (현재 예상 인원 <b>{expectedCount}명</b> 중 <b>{respondedCount}명</b> 응답)
        </p>
      ) : null}
      {isTravel ? (
        <div className="mt-3 grid max-h-[320px] gap-4 overflow-y-auto pr-0.5">
          <div>
            <h3 className="text-sm font-semibold text-app-text">
              📌모두 가능 ({nights}박 {nights + 1}일)
            </h3>
            <p className="mt-0.5 text-xs text-app-muted">
              {nights}박 단위 또는, 연속으로 겹치는 전체 기간이 표시됩니다.
            </p>
            {overlapShown.length > 0 ? (
              <ul className="mt-2 grid gap-2">
                {overlapShown.map((row) => (
                  <li
                    key={`ov-${row.startDate}-${row.endDate}`}
                    className="rounded-xl border border-violet-100 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <span className="font-semibold text-app-text">
                        {row.startDate} ~ {row.endDate}
                      </span>
                      {row.perfectMatch ? (
                        <span className="rounded bg-green-100 px-1.5 text-xs font-medium text-green-800">
                          추천
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-800">
                          참고
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs flex">
                      <span className="text-app-muted flex-none pr-1">가능한 사람:</span>{" "}
                      <span className="min-w-0 break-words text-app-muted">
                        {formatNicknameList(row.canParticipantIds, participantNameById)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-3 py-4 text-center text-sm text-app-muted">
                아직 모두 가능한 날짜가 없어요.
              </p>
            )}
          </div>
          {soloGroupedForDisplay.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-app-text">🖐️개인 선호</h3>
              <p className="mt-0.5 text-xs text-app-muted">
                모두 가능한 날이 없다면? 참가자별 선호 일정을 확인해 보세요.
              </p>
              <ul className="mt-2 grid gap-2">
                {soloGroupedForDisplay.map((row) => (
                  <li
                    key={`solo-${row.startDate}-${row.endDate}`}
                    className="rounded-xl border border-violet-100 px-3 py-2 text-sm"
                  >
                    <div className="font-semibold text-app-text">
                      {row.startDate} ~ {row.endDate}
                    </div>
                    <p className="mt-1 text-xs flex">
                      <span className="text-app-muted flex-none pr-1">가능한 사람:</span>{" "}
                      <span className="min-w-0 break-words text-app-muted">
                        {formatNicknameList(row.participantIds, participantNameById)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : show.length === 0 ? (
        <p className="mt-3 text-sm text-app-muted">응답이 있는 날짜가 없어요.</p>
      ) : (
        <ul className="mt-3 grid max-h-[250px] gap-2 overflow-y-auto pr-0.5">
          {show.map((row) => (
            <li
              key={row.date}
              className="rounded-xl border border-violet-100 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-semibold text-app-text">{row.date}</span>
                {respondedCount >= 2 && row.perfectMatch ? (
                  <span className="rounded bg-green-100 px-1.5 text-xs font-medium text-green-800">
                    추천
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-800">
                    참고
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs">
                <span className="text-app-text">선호 </span>
                <span className="font-bold text-app-primary">{row.bestCount}</span>
                <span className="text-app-text"> · 가능 </span>
                <span className="font-bold text-app-primary">{row.okCount}</span>
              </p>
              <p className="mt-1 text-xs flex">
                <span className="text-app-muted flex-none pr-1">가능한 사람:</span>{" "}
                <span className="min-w-0 break-words text-app-muted">
                  {formatNicknameList(row.canParticipantIds, participantNameById)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatNicknameList(ids: string[], participantNameById: Record<string, string>) {
  if (ids.length === 0) {
    return "없음";
  }
  return ids.map((id) => participantNameById[id] ?? "알 수 없음").join(", ");
}

/** 동일 시작~끝 구간은 한 카드로 묶어 닉네임 나열 */
/** 「모두 가능」과 시작·끝 날짜가 완전히 같은 줄만 제외(한쪽 구간이 다른 쪽에 포함되는 경우는 유지) */
function filterSoloGroupsDedupExactOverlap(
  soloGrouped: { startDate: string; endDate: string; participantIds: string[] }[],
  travelOverlapRanges: TravelRangeRow[],
): { startDate: string; endDate: string; participantIds: string[] }[] {
  if (travelOverlapRanges.length === 0 || soloGrouped.length === 0) {
    return soloGrouped;
  }
  const overlapKeys = new Set(
    travelOverlapRanges.map((r) => `${r.startDate}\t${r.endDate}`),
  );
  return soloGrouped.filter(
    (row) => !overlapKeys.has(`${row.startDate}\t${row.endDate}`),
  );
}

function groupSoloSegmentsByRange(
  segments: TravelSoloSegmentRow[],
  participantNameById: Record<string, string>,
): { startDate: string; endDate: string; participantIds: string[] }[] {
  const byKey = new Map<string, Set<string>>();
  for (const row of segments) {
    const key = `${row.startDate}\t${row.endDate}`;
    let set = byKey.get(key);
    if (!set) {
      set = new Set();
      byKey.set(key, set);
    }
    set.add(row.participantId);
  }
  const rows = [...byKey.entries()].map(([key, idSet]) => {
    const [startDate, endDate] = key.split("\t");
    const participantIds = [...idSet].sort((a, b) => {
      const na = participantNameById[a] ?? a;
      const nb = participantNameById[b] ?? b;
      return na.localeCompare(nb, "ko");
    });
    return { startDate: startDate!, endDate: endDate!, participantIds };
  });
  return rows.sort((a, b) => {
    const byStart = a.startDate.localeCompare(b.startDate);
    if (byStart !== 0) {
      return byStart;
    }
    return a.endDate.localeCompare(b.endDate);
  });
}
