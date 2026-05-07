import { addDays, isAfter, isBefore, parseISO } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ERROR_MESSAGES } from "@/lib/error-messages";
import { getParticipantCookieName } from "@/lib/participant-session";
import { getRoomCreatorCookieName } from "@/lib/room-creator";
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
    return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.common.invalidRequest });
  }

  const participantId = request.cookies.get(getParticipantCookieName(roomId))?.value;
  if (!participantId) {
    return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.ownerSessionRequired });
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
    return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.common.roomNotFound });
  }
  if (room.owner_participant_id !== participantId) {
    return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.ownerOnly });
  }

  if (action.data === "close") {
    const expected = room.expected_participant_count ?? 0;
    if (expected <= 0) {
      return buildRedirect(request, roomId, {
        manageError: ERROR_MESSAGES.manage.closeNeedExpectedCount,
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
        manageError: ERROR_MESSAGES.manage.closeNeedAllResponses,
      });
    }

    const { error: updateError } = await supabase
      .from("rooms")
      .update({ is_closed: true, closed_at: new Date().toISOString() })
      .eq("id", roomId);
    if (updateError) {
      return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.closeFailed });
    }
    return buildRedirect(request, roomId, { managed: "closed" });
  }

  if (action.data === "fix") {
    if (!room.is_closed) {
      return buildRedirect(request, roomId, {
        manageError: ERROR_MESSAGES.manage.fixAfterCloseOnly,
      });
    }
    const date = String(formData.get("date") ?? "");
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.fixDateRequired });
    }
    const start = parseISO(date);
    const roomStart = parseISO(room.date_range_start);
    const roomEnd = parseISO(room.date_range_end);
    if (isBefore(start, roomStart) || isAfter(start, roomEnd)) {
      return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.fixOutOfRange });
    }
    const fixedEnd =
      room.type === "travel" && room.nights != null
        ? formatDate(addDays(start, room.nights))
        : date;
    if (isAfter(parseISO(fixedEnd), roomEnd)) {
      return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.fixTravelOverRange });
    }
    const { error: updateError } = await supabase
      .from("rooms")
      .update({ fixed_start_date: date, fixed_end_date: fixedEnd })
      .eq("id", roomId);
    if (updateError) {
      return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.fixFailed });
    }
    return buildRedirect(request, roomId, { managed: "fixed" });
  }

  if (action.data === "clear_fix") {
    const { error: clearError } = await supabase
      .from("rooms")
      .update({ fixed_start_date: null, fixed_end_date: null })
      .eq("id", roomId);
    if (clearError) {
      return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.clearFixFailed });
    }
    return buildRedirect(request, roomId, { managed: "fixCleared" });
  }

  // delete_room: 스케줄 → 소유자 참조 해제 → 참가자 → 방 (FK 순서)
  const { error: delSchedError } = await supabase
    .from("schedules")
    .delete()
    .eq("room_id", roomId);
  if (delSchedError) {
    return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.deleteSchedulesFailed });
  }

  const { error: ownerClearError } = await supabase
    .from("rooms")
    .update({ owner_participant_id: null })
    .eq("id", roomId);
  if (ownerClearError) {
    return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.deleteRoomFailed });
  }

  const { error: delParticipantsError } = await supabase
    .from("participants")
    .delete()
    .eq("room_id", roomId);
  if (delParticipantsError) {
    return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.deleteParticipantsFailed });
  }

  const { error: delRoomError } = await supabase.from("rooms").delete().eq("id", roomId);
  if (delRoomError) {
    return buildRedirect(request, roomId, { manageError: ERROR_MESSAGES.manage.deleteRoomFailed });
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
  res.cookies.set(getRoomCreatorCookieName(roomId), "", cookieBase);
  res.cookies.set(getRoomUnlockCookieName(roomId), "", cookieBase);
  return res;
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
