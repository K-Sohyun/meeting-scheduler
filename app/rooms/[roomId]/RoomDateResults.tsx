import type { DateResultRow } from "@/lib/schedule-results";
import { buildTravelRecommendationRanges } from "@/lib/travel-recommendation";

type RoomDateResultsProps = {
  ranked: DateResultRow[];
  participantCount: number;
  respondedCount: number;
  participantNameById: Record<string, string>;
  expectedCount: number;
  roomType?: "single" | "travel";
  nights?: number | null;
  /** 방에 저장된 schedules 행 수 (0이면 아직 아무도 가능 일정을 제출하지 않음) */
  scheduleRowCount: number;
  /** 지정 시, 응답이 있는 날짜만 골라 최대 N개까지 표시(응답 날이 N개보다 적으면 그만큼만) */
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
  scheduleRowCount,
  maxRows,
}: RoomDateResultsProps) {
  if (participantCount === 0) {
    return (
      <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">일정 추천</h2>
        <p className="mt-2 text-sm text-app-muted">참여자가 생기면 날짜별로 추천이 보여요.</p>
      </section>
    );
  }

  if (scheduleRowCount === 0) {
    return (
      <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">일정 추천</h2>
        <p className="mt-2 text-sm text-app-muted">
          아직 응답이 없어요. 참여자가 일정을 저장하면 순위가 표시됩니다.
        </p>
      </section>
    );
  }

  const respondedOnly = ranked.filter((row) => row.canCount > 0);
  const show =
    maxRows !== undefined ? respondedOnly.slice(0, maxRows) : respondedOnly;
  const travelRanges =
    roomType === "travel" && nights != null ? buildTravelRecommendationRanges(ranked, nights) : [];
  const showTravelRanges =
    maxRows !== undefined ? travelRanges.slice(0, maxRows) : travelRanges;

  return (
    <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">일정 추천</h2>
      <p className="mt-1 text-sm text-app-muted">
        응답을 바탕으로 모이기 좋은 날부터 순서대로 보여요.
      </p>
      {expectedCount > 0 ? (
        <p className="mt-1 text-sm text-app-muted">
          (현재 예상 인원 <b>{expectedCount}명</b> 중 <b>{respondedCount}명</b> 응답)
        </p>
      ) : null}
      {(roomType === "travel" ? showTravelRanges.length === 0 : show.length === 0) ? (
        <p className="mt-3 text-sm text-app-muted">응답이 있는 날짜가 없어요.</p>
      ) : roomType === "travel" && nights != null ? (
        <ul className="mt-3 grid max-h-[250px] gap-2 overflow-y-auto pr-0.5">
          {showTravelRanges.map((row) => (
            <li
              key={`${row.startDate}-${row.endDate}`}
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
                    보통
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs">
                <span className="text-app-text">선호 </span>
                <span className="font-bold text-app-primary">{row.bestCount}</span>
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
      ) : (
        <ul className="mt-3 grid max-h-[250px] gap-2 overflow-y-auto pr-0.5">
          {show.map((row) => (
            <li
              key={row.date}
              className="rounded-xl border border-violet-100 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-semibold text-app-text">{row.date}</span>
                {row.perfectMatch ? (
                  <span className="rounded bg-green-100 px-1.5 text-xs font-medium text-green-800">
                    추천
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-800">
                    보통
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
