import { addDays, isAfter, isBefore, parseISO } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getParticipantCookieName } from "@/lib/participant-session";
import { getRoomUnlockCookieName } from "@/lib/room-unlock";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const actionSchema = z.enum(["close", "fix", "clear_fix", "delete_room"]);

function buildRedirect(request: NextRequest, roomId: string, params: Record<string, string>) {
  const url = new URL(`/rooms/${roomId}`, request.url);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return NextResponse.redirect(url, 303);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const formData = await request.formData();
  const action = actionSchema.safeParse(formData.get("action"));
  if (!action.success) {
    return buildRedirect(request, roomId, { manageError: "잘못된 요청입니다." });
  }

  const participantId = request.cookies.get(getParticipantCookieName(roomId))?.value;
  if (!participantId) {
    return buildRedirect(request, roomId, { manageError: "방장 세션이 필요합니다." });
  }

  const supabase = createSupabaseServerClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select(
      "id, type, nights, date_range_start, date_range_end, expected_participant_count, owner_participant_id, is_closed",
    )
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return buildRedirect(request, roomId, { manageError: "방 정보를 찾을 수 없습니다." });
  }
  if (room.owner_participant_id !== participantId) {
    return buildRedirect(request, roomId, { manageError: "방장만 실행할 수 있습니다." });
  }

  if (action.data === "close") {
    const expected = room.expected_participant_count ?? 0;
    if (expected <= 0) {
      return buildRedirect(request, roomId, {
        manageError: "예상 인원이 1명 이상일 때만 마감할 수 있습니다.",
      });
    }
    const { data: participants } = await supabase
      .from("participants")
      .select("id")
      .eq("room_id", roomId);
    const { data: schedules } = await supabase
      .from("schedules")
      .select("participant_id")
      .eq("room_id", roomId);
    const responded = new Set((schedules ?? []).map((s) => s.participant_id)).size;
    if ((participants?.length ?? 0) < expected || responded < expected) {
      return buildRedirect(request, roomId, {
        manageError: "예상 인원 전원이 일정 응답을 완료해야 마감할 수 있습니다.",
      });
    }

    const { error: updateError } = await supabase
      .from("rooms")
      .update({ is_closed: true, closed_at: new Date().toISOString() })
      .eq("id", roomId);
    if (updateError) {
      return buildRedirect(request, roomId, { manageError: "모집 마감 처리에 실패했습니다." });
    }
    return buildRedirect(request, roomId, { managed: "closed" });
  }

  if (action.data === "fix") {
    if (!room.is_closed) {
      return buildRedirect(request, roomId, {
        manageError: "모집 마감 후에만 일정을 확정할 수 있습니다.",
      });
    }
    const date = String(formData.get("date") ?? "");
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return buildRedirect(request, roomId, { manageError: "확정할 날짜를 선택해 주세요." });
    }
    const start = parseISO(date);
    const roomStart = parseISO(room.date_range_start);
    const roomEnd = parseISO(room.date_range_end);
    if (isBefore(start, roomStart) || isAfter(start, roomEnd)) {
      return buildRedirect(request, roomId, { manageError: "방 일정 범위 밖 날짜입니다." });
    }
    const fixedEnd =
      room.type === "travel" && room.nights != null
        ? formatDate(addDays(start, room.nights))
        : date;
    if (isAfter(parseISO(fixedEnd), roomEnd)) {
      return buildRedirect(request, roomId, { manageError: "선택한 날짜는 여행 범위를 넘습니다." });
    }
    const { error: updateError } = await supabase
      .from("rooms")
      .update({ fixed_start_date: date, fixed_end_date: fixedEnd })
      .eq("id", roomId);
    if (updateError) {
      return buildRedirect(request, roomId, { manageError: "일정 확정에 실패했습니다." });
    }
    return buildRedirect(request, roomId, { managed: "fixed" });
  }

  if (action.data === "clear_fix") {
    const { error: clearError } = await supabase
      .from("rooms")
      .update({ fixed_start_date: null, fixed_end_date: null })
      .eq("id", roomId);
    if (clearError) {
      return buildRedirect(request, roomId, { manageError: "확정 일정 삭제에 실패했습니다." });
    }
    return buildRedirect(request, roomId, { managed: "fixCleared" });
  }

  // delete_room: 스케줄 → 소유자 참조 해제 → 참가자 → 방 (FK 순서)
  const { error: delSchedError } = await supabase
    .from("schedules")
    .delete()
    .eq("room_id", roomId);
  if (delSchedError) {
    return buildRedirect(request, roomId, { manageError: "일정을 삭제하지 못했습니다." });
  }

  const { error: ownerClearError } = await supabase
    .from("rooms")
    .update({ owner_participant_id: null })
    .eq("id", roomId);
  if (ownerClearError) {
    return buildRedirect(request, roomId, { manageError: "방을 삭제할 수 없습니다." });
  }

  const { error: delParticipantsError } = await supabase
    .from("participants")
    .delete()
    .eq("room_id", roomId);
  if (delParticipantsError) {
    return buildRedirect(request, roomId, { manageError: "참가자를 삭제하지 못했습니다." });
  }

  const { error: delRoomError } = await supabase.from("rooms").delete().eq("id", roomId);
  if (delRoomError) {
    return buildRedirect(request, roomId, { manageError: "방을 삭제하지 못했습니다." });
  }

  const toRooms = new URL("/rooms?deleted=1", request.url);
  const res = NextResponse.redirect(toRooms, 303);
  const cookieBase = {
    path: "/" as const,
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  res.cookies.set(getParticipantCookieName(roomId), "", cookieBase);
  res.cookies.set(getRoomUnlockCookieName(roomId), "", cookieBase);
  return res;
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
