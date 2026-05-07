import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isParticipantInRoom } from "@/lib/assert-participant-in-room";
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
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const roomId = roomParams.data.roomId;
  const participantId = request.cookies.get(getParticipantCookieName(roomId))?.value;
  const parsedParticipantId = participantIdSchema.safeParse(participantId);
  if (!parsedParticipantId.success) {
    return NextResponse.json({ error: "참여 세션이 없습니다." }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const inRoom = await isParticipantInRoom(supabase, roomId, parsedParticipantId.data);
  if (!inRoom) {
    return NextResponse.json({ error: "이 방의 참여자가 아닙니다." }, { status: 403 });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, type, nights, date_range_start, date_range_end, expected_participant_count")
    .eq("id", roomId)
    .single();
  if (!room) {
    return NextResponse.json({ error: "방 정보를 찾을 수 없습니다." }, { status: 404 });
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
