import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isParticipantInRoom } from "@/lib/assert-participant-in-room";
import { ERROR_MESSAGES } from "@/lib/error-messages";
import { getParticipantCookieName } from "@/lib/participant-session";
import { computeRoomResultsBundle } from "@/lib/room-results";
import type { ScheduleRow } from "@/lib/schedule-results";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const roomParamsSchema = z.object({
  roomId: z.string().uuid(),
});
const participantIdSchema = z.string().uuid();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const roomParams = roomParamsSchema.safeParse(await context.params);
  if (!roomParams.success) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.invalidRequest }, { status: 400 });
  }

  const roomId = roomParams.data.roomId;
  const participantId = request.cookies.get(getParticipantCookieName(roomId))?.value;
  const parsedParticipantId = participantIdSchema.safeParse(participantId);
  if (!parsedParticipantId.success) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.noParticipantSession }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const inRoom = await isParticipantInRoom(supabase, roomId, parsedParticipantId.data);
  if (!inRoom) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.notParticipantInRoom }, { status: 403 });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, type, nights, date_range_start, date_range_end, expected_participant_count")
    .eq("id", roomId)
    .single();
  if (!room) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.roomNotFound }, { status: 404 });
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("id, nickname")
    .eq("room_id", roomId);
  const participantsTyped = (participants ?? []) as { id: string; nickname: string }[];

  const { data: allSchedules } = await supabase
    .from("schedules")
    .select("participant_id, date, status")
    .eq("room_id", roomId);
  const schedules = (allSchedules ?? []) as ScheduleRow[];

  const bundle = computeRoomResultsBundle({
    room: {
      id: room.id,
      type: room.type === "travel" ? "travel" : "single",
      nights: room.nights,
      date_range_start: room.date_range_start,
      date_range_end: room.date_range_end,
      expected_participant_count: room.expected_participant_count,
    },
    participants: participantsTyped,
    schedules,
  });

  return NextResponse.json(bundle);
}
