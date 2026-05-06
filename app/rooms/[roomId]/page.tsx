import Link from "next/link";
import { cookies } from "next/headers";
import { z } from "zod";
import { getHolidaysInRange } from "@/lib/holidays";
import { getParticipantCookieName } from "@/lib/participant-session";
import { getRoomUnlockCookieName } from "@/lib/room-unlock";
import { buildDateResults, type ScheduleRow } from "@/lib/schedule-results";
import { buildTravelRecommendationRanges } from "@/lib/travel-recommendation";
import { buildTravelAllowedStartUnion } from "@/lib/travel-segment-starts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { JoinForm } from "./JoinForm";
import { RoomDateResults } from "./RoomDateResults";
import { RoomPasswordForm } from "./RoomPasswordForm";
import { RoomRealtimeListener } from "./RoomRealtimeListener";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { DeleteRoomForm } from "./DeleteRoomForm";

const roomIdSchema = z.string().uuid();

/** 일정·추천이 항상 DB 최신을 반영하도록(캐시된 RSC 페이로드 방지) */
export const dynamic = "force-dynamic";

function buildTravelFixRanges(
  ranked: ReturnType<typeof buildDateResults>,
  nights: number,
  allowedStarts: Set<string>,
) {
  return buildTravelRecommendationRanges(ranked, nights, allowedStarts).map((r) => ({
    startDate: r.startDate,
    endDate: r.endDate,
    canCount: r.canCount,
  }));
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{
    joined?: string;
    rejoin?: string;
    error?: string;
    view?: string;
    pw?: string;
    managed?: string;
    manageError?: string;
  }>;
}) {
  const { roomId } = await params;
  const { joined, rejoin, error, view, pw, managed, manageError } = await searchParams;
  const isCalendarView = view === "calendar";

  const parsedRoomId = roomIdSchema.safeParse(roomId);
  if (!parsedRoomId.success) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-6 pt-8">
        <section className="rounded-2xl bg-app-card p-5 shadow-sm">
          <h1 className="text-lg font-semibold">잘못된 방 주소입니다.</h1>
          <p className="mt-2 text-sm text-app-muted">링크를 다시 확인해 주세요.</p>
        </section>
      </main>
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: room } = await supabase
    .from("rooms")
    .select(
      "id, name, type, nights, date_range_start, date_range_end, expected_participant_count, password_hash, owner_participant_id, is_closed, closed_at, fixed_start_date, fixed_end_date",
    )
    .eq("id", parsedRoomId.data)
    .single();

  if (!room) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-6 pt-8">
        <section className="rounded-2xl bg-app-card p-5 shadow-sm">
          <h1 className="text-lg font-semibold">방을 찾을 수 없습니다.</h1>
          <p className="mt-2 text-sm text-app-muted">
            방이 삭제되었거나 접근 권한이 없을 수 있습니다.
          </p>
        </section>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-app-primary-soft text-sm font-medium text-app-primary"
          >
            홈
          </Link>
          <Link
            href="/rooms"
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-app-card text-sm font-medium text-app-text ring-1 ring-violet-100"
          >
            방 리스트
          </Link>
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  const hasRoomPassword = Boolean(room.password_hash);
  const isRoomUnlocked =
    !hasRoomPassword || cookieStore.get(getRoomUnlockCookieName(room.id))?.value === "1";

  if (hasRoomPassword && !isRoomUnlocked) {
    const backQuery = new URLSearchParams();
    if (isCalendarView) {
      backQuery.set("view", "calendar");
    }
    const redirectTo = `/rooms/${room.id}${backQuery.toString() ? `?${backQuery.toString()}` : ""}`;

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-6 pt-8">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="페이지 이동">
          <Link
            href="/"
            className="rounded-full bg-app-primary-soft px-3 py-1.5 font-medium text-app-primary"
          >
            홈
          </Link>
          <Link
            href="/rooms"
            className="rounded-full bg-app-card px-3 py-1.5 font-medium text-app-text shadow-sm ring-1 ring-violet-100"
          >
            방 리스트
          </Link>
        </nav>
        <section className="rounded-2xl bg-app-card p-5 shadow-sm">
          <p className="flex items-center gap-1 text-sm font-medium text-app-primary">
            {room.type === "travel" ? "여행 모임" : "일반 모임"}
            {room.password_hash ? (
              <span aria-label="비밀번호가 설정된 방" className="select-none text-xs" title="비밀번호가 설정된 방">
                🔒
              </span>
            ) : null}
          </p>
          <h1 className="mt-2 text-xl font-bold">{room.name}</h1>
        </section>
        <RoomPasswordForm
          roomId={room.id}
          roomName={room.name}
          redirectTo={redirectTo}
          wrongPassword={pw === "wrong"}
        />
      </main>
    );
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("id, nickname, created_at")
    .eq("room_id", parsedRoomId.data)
    .order("created_at", { ascending: true });

  const participantIdFromCookie = cookieStore.get(getParticipantCookieName(room.id))?.value;
  const participantNameById = Object.fromEntries(
    (participants ?? []).map((participant) => [participant.id, participant.nickname]),
  );
  const myParticipant = (participants ?? []).find(
    (participant) => participant.id === participantIdFromCookie,
  );
  const isOwner = Boolean(myParticipant && room.owner_participant_id === myParticipant.id);

  let holidays: { date: string; name: string }[] = [];
  if (isCalendarView) {
    try {
      holidays = await getHolidaysInRange(room.date_range_start, room.date_range_end);
    } catch {
      holidays = [];
    }
  }

  const participantIds = (participants ?? []).map((p) => p.id);
  let resultRanked: ReturnType<typeof buildDateResults> = [];
  let scheduleRowCount = 0;
  let respondedParticipantCount = 0;
  let schedulesTyped: ScheduleRow[] = [];
  let respondedParticipantIds: string[] = [];
  if (participantIds.length > 0) {
    const { data: allSchedules } = await supabase
      .from("schedules")
      .select("participant_id, date, status")
      .eq("room_id", room.id);
    schedulesTyped = (allSchedules ?? []) as ScheduleRow[];
    scheduleRowCount = schedulesTyped.length;
    respondedParticipantIds = [...new Set(schedulesTyped.map((row) => row.participant_id))];
    respondedParticipantCount = respondedParticipantIds.length;
    resultRanked = buildDateResults({
      dateRangeStart: room.date_range_start,
      dateRangeEnd: room.date_range_end,
      participantIds: respondedParticipantIds,
      expectedParticipantCount: room.expected_participant_count ?? 0,
      schedules: schedulesTyped,
    });
  }

  let travelSegRows: { participant_id: string; start_date: string }[] = [];
  if (room.type === "travel" && participantIds.length > 0) {
    const { data: seg } = await supabase
      .from("travel_segment_starts")
      .select("participant_id, start_date")
      .eq("room_id", room.id);
    travelSegRows = (seg ?? []) as { participant_id: string; start_date: string }[];
  }

  const travelAllowedStartUnion =
    room.type === "travel" && respondedParticipantIds.length > 0 && room.nights != null
      ? buildTravelAllowedStartUnion({
          respondedParticipantIds,
          segmentRows: travelSegRows,
          schedules: schedulesTyped,
          nights: room.nights,
        })
      : new Set<string>();
  const travelAllowedStartsSorted = [...travelAllowedStartUnion].sort((a, b) => a.localeCompare(b));

  const expectedCount = room.expected_participant_count ?? 0;
  const canClose =
    isOwner &&
    !room.is_closed &&
    expectedCount > 0 &&
    (participants?.length ?? 0) >= expectedCount &&
    respondedParticipantCount >= expectedCount;
  const showOwnerManage = isOwner;
  const travelFixRanges =
    room.type === "travel" && room.nights != null
      ? buildTravelFixRanges(resultRanked, room.nights, travelAllowedStartUnion)
      : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-6 pt-8">
      <nav
        className="mb-4 flex flex-wrap items-center gap-2 text-sm"
        aria-label="페이지 이동"
      >
        <Link
          href="/"
          className="rounded-full bg-app-primary-soft px-3 py-1.5 font-medium text-app-primary"
        >
          홈
        </Link>
        <Link
          href="/rooms"
          className="rounded-full bg-app-card px-3 py-1.5 font-medium text-app-text shadow-sm ring-1 ring-violet-100"
        >
          방 리스트
        </Link>
        {isCalendarView ? (
          <Link
            href={`/rooms/${room.id}`}
            className="rounded-full border border-violet-200 bg-white px-3 py-1.5 font-medium text-app-text"
          >
            참여 화면
          </Link>
        ) : myParticipant ? (
          <Link
            href={`/rooms/${room.id}?view=calendar`}
            className="rounded-full border border-violet-200 bg-white px-3 py-1.5 font-medium text-app-text"
          >
            내 캘린더
          </Link>
        ) : (
          <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 font-medium text-zinc-500">
            내 캘린더
          </span>
        )}
      </nav>

      <section className="rounded-2xl bg-app-card p-5 shadow-sm">
        <p className="flex items-center gap-1 text-sm font-medium text-app-primary">
          {room.type === "travel" ? "여행 모임" : "일반 모임"}
          {room.password_hash ? (
            <span aria-label="비밀번호가 설정된 방" className="select-none text-xs" title="비밀번호가 설정된 방">
              🔒
            </span>
          ) : null}
        </p>
        <h1 className="mt-2 text-xl font-bold">{room.name}</h1>
        <p className="mt-3 text-sm leading-6 text-app-muted">
          일정 범위: {room.date_range_start} ~ {room.date_range_end}
          {room.type === "travel" && room.nights
            ? ` (${room.nights}박 ${room.nights + 1}일)`
            : ""}
        </p>
        <p className="mt-1 text-sm text-app-muted">
          예상 인원: {expectedCount}명 / 참여: {participants?.length ?? 0}명 / 응답:{" "}
          {respondedParticipantCount}명
        </p>
        {room.password_hash ? (
          <p className="mt-1 text-xs text-app-muted">비밀번호가 설정된 방입니다.</p>
        ) : null}
        {room.is_closed ? (
          <InlineMessage tone="neutral" className="mt-2">
            모집 마감된 방입니다. (확인만 가능)
          </InlineMessage>
        ) : null}
        {room.fixed_start_date ? (
          <InlineMessage tone="success" className="mt-2">
            확정 일정: {room.fixed_start_date}
            {room.fixed_end_date && room.fixed_end_date !== room.fixed_start_date
              ? ` ~ ${room.fixed_end_date}`
              : ""}
          </InlineMessage>
        ) : null}
      </section>

      {showOwnerManage ? (
        <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">방장 관리</h2>
          {manageError ? (
            <InlineMessage tone="error" className="mt-2">
              {manageError}
            </InlineMessage>
          ) : null}
          {managed ? (
            <InlineMessage tone="success" className="mt-2">
              {managed === "closed"
                ? "모집을 마감했어요."
                : managed === "fixed"
                  ? "일정을 확정했어요."
                  : "확정 일정을 삭제했어요."}
            </InlineMessage>
          ) : null}
          {canClose ? (
            <form className="mt-3" method="post" action={`/api/rooms/${room.id}/manage`}>
              <input type="hidden" name="action" value="close" />
              <button
                type="submit"
                className="h-10 w-full rounded-xl bg-app-primary px-4 text-sm font-semibold text-white"
              >
                모집 마감
              </button>
            </form>
          ) : null}
          {room.is_closed ? (
            room.fixed_start_date ? (
              <div className="mt-3">
                <form method="post" action={`/api/rooms/${room.id}/manage`}>
                  <input type="hidden" name="action" value="clear_fix" />
                  <button
                    type="submit"
                    className="h-10 w-full rounded-xl border border-violet-200 bg-app-primary-soft px-4 text-sm font-medium text-app-primary"
                  >
                    확정 일정 삭제
                  </button>
                </form>
              </div>
            ) : (
              <form className="mt-3 grid gap-2" method="post" action={`/api/rooms/${room.id}/manage`}>
                <input type="hidden" name="action" value="fix" />
                <label className="grid gap-1">
                  <span className="text-sm text-app-muted">확정할 날짜</span>
                  <select
                    name="date"
                    required
                    className="h-10 rounded-xl border border-violet-100 px-3 text-sm outline-none"
                  >
                    <option value="">날짜 선택</option>
                    {room.type === "travel" && room.nights != null
                      ? travelFixRanges.slice(0, 12).map((row) => (
                          <option key={`${row.startDate}-${row.endDate}`} value={row.startDate}>
                            {row.startDate} ~ {row.endDate} (가능 {row.canCount}명)
                          </option>
                        ))
                      : resultRanked
                          .filter((row) => row.canCount > 0)
                          .slice(0, 12)
                          .map((row) => (
                            <option key={row.date} value={row.date}>
                              {row.date} (가능 {row.canCount}명)
                            </option>
                          ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="h-10 w-full rounded-xl bg-app-primary px-4 text-sm font-semibold text-white"
                >
                  일정 픽스
                </button>
              </form>
            )
          ) : null}
          <DeleteRoomForm roomId={room.id} />
        </section>
      ) : null}

      {isCalendarView ? (
        <>
          {myParticipant ? (
            <>
              <ScheduleCalendar
                room={{
                  id: room.id,
                  type: room.type === "travel" ? "travel" : "single",
                  nights: room.nights,
                  dateRangeStart: room.date_range_start,
                  dateRangeEnd: room.date_range_end,
                }}
                participant={{
                  id: myParticipant.id,
                  nickname: myParticipant.nickname,
                }}
                holidays={holidays}
                readOnly={room.is_closed}
              />
              <RoomDateResults
                ranked={resultRanked}
                participantCount={participants?.length ?? 0}
                respondedCount={respondedParticipantCount}
                participantNameById={participantNameById}
                expectedCount={expectedCount}
                roomType={room.type === "travel" ? "travel" : "single"}
                nights={room.nights}
                scheduleRowCount={scheduleRowCount}
                travelAllowedStarts={travelAllowedStartsSorted}
                maxRows={6}
              />
            </>
          ) : (
            <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">캘린더 접근 권한이 없습니다.</h2>
              <p className="mt-2 text-sm text-app-muted">
                일정 등록 참여 후 캘린더를 열 수 있습니다.
              </p>
            </section>
          )}
        </>
      ) : (
        <>
          {myParticipant ? (
            <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">참여 중</h2>
              <p className="mt-2 text-sm leading-6 text-app-muted">
                <span className="font-medium text-app-text">{myParticipant.nickname}</span>님으로
                참여 중이에요. <br />
                일정 입력/수정은 아래에서 내 캘린더 열기를 눌러 진행해 주세요.
              </p>
              {joined === "1" ? (
                <InlineMessage tone="success" className="mt-3">
                  {rejoin === "1"
                    ? "이미 이 방에 등록된 닉네임이에요."
                    : "참여가 완료되었습니다."}
                </InlineMessage>
              ) : null}
              <Link
                href={`/rooms/${room.id}?view=calendar`}
                className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-app-primary px-6 py-2.5 text-sm font-semibold text-white"
              >
                내 캘린더 열기
              </Link>
            </section>
          ) : (
            <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
              <h2 className="text-base font-semibold">닉네임으로 참여하기</h2>
              <p className="mt-1 text-sm text-app-muted">
                닉네임은 브라우저에 저장되어 다음 참여 시 자동 입력됩니다.
              </p>
              {error ? (
                <InlineMessage tone="error" className="mt-3">
                  {error}
                </InlineMessage>
              ) : null}
              {joined === "1" ? (
                <InlineMessage tone="success" className="mt-3">
                  {rejoin === "1"
                    ? "이미 이 방에 등록된 닉네임이에요."
                    : "참여가 완료되었습니다."}
                </InlineMessage>
              ) : null}
              <div className="mt-4">
                <JoinForm roomId={room.id} />
              </div>
            </section>
          )}

          <section className="mt-5 rounded-2xl bg-app-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">
              참여자 ({participants?.length ?? 0}명)
            </h2>
            {participants && participants.length > 0 ? (
              <ul className="mt-3 grid gap-2">
                {participants.map((participant) => (
                  <li
                    key={participant.id}
                    className="rounded-xl bg-app-primary-soft px-3 py-2"
                  >
                    <span className="text-sm text-app-primary">{participant.nickname}</span>
                    {room.owner_participant_id === participant.id ? (
                      <span className="ml-1 text-sm" aria-label="방장">
                        🚩
                      </span>
                    ) : null}
                    {myParticipant && participant.id === myParticipant.id ? (
                      <span className="ml-2 text-xs text-app-muted">(나)</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-app-muted">아직 참여한 친구가 없습니다.</p>
            )}
            {myParticipant ? null : (
              <button
                type="button"
                disabled
                className="mt-4 flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl bg-zinc-200 px-6 py-2.5 text-sm font-semibold text-zinc-500"
              >
                내 캘린더 열기 (참여 후 이용 가능)
              </button>
            )}
          </section>
          <RoomDateResults
            ranked={resultRanked}
            participantCount={participants?.length ?? 0}
            respondedCount={respondedParticipantCount}
            participantNameById={participantNameById}
            expectedCount={expectedCount}
            roomType={room.type === "travel" ? "travel" : "single"}
            nights={room.nights}
            scheduleRowCount={scheduleRowCount}
            travelAllowedStarts={travelAllowedStartsSorted}
            maxRows={3}
          />
        </>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Link
          href="/"
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-app-primary-soft text-sm font-medium text-app-primary"
        >
          홈
        </Link>
        <Link
          href="/rooms"
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-app-card text-sm font-medium text-app-text ring-1 ring-violet-100"
        >
          방 리스트
        </Link>
      </div>
      <RoomRealtimeListener roomId={room.id} />
    </main>
  );
}
