import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isParticipantInRoom } from "@/lib/assert-participant-in-room";
import { ERROR_MESSAGES } from "@/lib/error-messages";
import { getParticipantCookieName } from "@/lib/participant-session";
import { isDateInRoomRange } from "@/lib/schedule-validate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const roomParamsSchema = z.object({
  roomId: z.string().uuid(),
});
const participantIdSchema = z.string().uuid();

const saveSchema = z.object({
  entries: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.enum(["best", "ok"]),
    }),
  ),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const roomParams = roomParamsSchema.safeParse(await context.params);
  if (!roomParams.success) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.invalidRequest }, { status: 400 });
  }
  const participantId = request.cookies.get(getParticipantCookieName(roomParams.data.roomId))?.value;
  const parsedParticipantId = participantIdSchema.safeParse(participantId);
  if (!parsedParticipantId.success) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.noParticipantSession }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const inRoom = await isParticipantInRoom(
    supabase,
    roomParams.data.roomId,
    parsedParticipantId.data,
  );
  if (!inRoom) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.notParticipantInRoom }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("schedules")
    .select("date, status")
    .eq("room_id", roomParams.data.roomId)
    .eq("participant_id", parsedParticipantId.data);

  if (error) {
    return NextResponse.json({ error: ERROR_MESSAGES.schedules.loadFailed }, { status: 500 });
  }

  const entries = (data ?? []) as { date: string; status: "best" | "ok" }[];
  return NextResponse.json({ entries });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  const roomParams = roomParamsSchema.safeParse(await context.params);
  if (!roomParams.success) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.invalidRoomId }, { status: 400 });
  }

  const body = saveSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: ERROR_MESSAGES.schedules.invalidPayload }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const roomId = roomParams.data.roomId;
  const participantId = request.cookies.get(getParticipantCookieName(roomId))?.value;
  const parsedParticipantId = participantIdSchema.safeParse(participantId);
  if (!parsedParticipantId.success) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.noParticipantSession }, { status: 401 });
  }

  const inRoom = await isParticipantInRoom(supabase, roomId, parsedParticipantId.data);
  if (!inRoom) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.notParticipantInRoom }, { status: 403 });
  }

  const { data: roomRow, error: roomErr } = await supabase
    .from("rooms")
    .select("date_range_start, date_range_end, type, nights, is_closed")
    .eq("id", roomId)
    .single();

  if (roomErr || !roomRow) {
    return NextResponse.json({ error: ERROR_MESSAGES.common.roomNotFound }, { status: 400 });
  }

  if (roomRow.is_closed) {
    return NextResponse.json(
      { error: ERROR_MESSAGES.schedules.closedRoomReadonly },
      { status: 403 },
    );
  }

  const { entries: rawEntries } = body.data;
  const byDate = new Map<string, { date: string; status: "best" | "ok" }>();
  for (const e of rawEntries) {
    if (!isDateInRoomRange(e.date, roomRow.date_range_start, roomRow.date_range_end)) {
      return NextResponse.json(
        { error: `일정 범위 밖의 날짜가 포함됐습니다: ${e.date}` },
        { status: 400 },
      );
    }
    byDate.set(e.date, e);
  }
  const entries = [...byDate.values()];

  if (roomRow.type === "travel" && roomRow.nights != null && entries.length > 0) {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sorted.length; i += 1) {
      if (sorted[i]!.status !== "best") {
        return NextResponse.json(
          { error: ERROR_MESSAGES.schedules.travelBestOnly },
          { status: 400 },
        );
      }
    }
    let chunkLen = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = new Date(`${sorted[i - 1]!.date}T00:00:00`);
      const cur = new Date(`${sorted[i]!.date}T00:00:00`);
      const diff = (cur.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) {
        chunkLen += 1;
        continue;
      }
      if (chunkLen < roomRow.nights + 1) {
        return NextResponse.json(
          {
            error: `여행 모임은 ${roomRow.nights + 1}일 이상 연속된 구간만 저장할 수 있어요.`,
          },
          { status: 400 },
        );
      }
      chunkLen = 1;
    }
    if (chunkLen < roomRow.nights + 1) {
      return NextResponse.json(
        {
          error: `여행 모임은 ${roomRow.nights + 1}일 이상 연속된 구간만 저장할 수 있어요.`,
        },
        { status: 400 },
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("schedules")
    .delete()
    .eq("room_id", roomId)
    .eq("participant_id", parsedParticipantId.data);

  if (deleteError) {
    return NextResponse.json({ error: ERROR_MESSAGES.schedules.saveFailed }, { status: 500 });
  }

  if (entries.length > 0) {
    const { error: insertError } = await supabase.from("schedules").insert(
      entries.map((entry) => ({
        room_id: roomId,
        participant_id: parsedParticipantId.data,
        date: entry.date,
        status: entry.status,
      })),
    );

    if (insertError) {
      return NextResponse.json({ error: ERROR_MESSAGES.schedules.saveFailed }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
