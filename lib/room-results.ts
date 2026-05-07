import { buildDateResults, type DateResultRow, type ScheduleRow } from "@/lib/schedule-results";
import {
  buildTravelOverlapNightRanges,
  buildTravelSoloSegments,
  type TravelRangeRow,
  type TravelSoloSegmentRow,
} from "@/lib/travel-recommendation";

type RoomForResults = {
  id: string;
  type: "single" | "travel";
  nights: number | null;
  date_range_start: string;
  date_range_end: string;
  expected_participant_count: number | null;
};

export type RoomResultsBundle = {
  participantCount: number;
  participantNameById: Record<string, string>;
  ranked: DateResultRow[];
  scheduleRowCount: number;
  respondedParticipantIds: string[];
  respondedParticipantCount: number;
  travelOverlapRanges: TravelRangeRow[];
  travelSoloSegments: TravelSoloSegmentRow[];
  travelFixRanges: { startDate: string; endDate: string; canCount: number }[];
};

export function computeRoomResultsBundle(params: {
  room: RoomForResults;
  participants: { id: string; nickname: string }[];
  schedules: ScheduleRow[];
}): RoomResultsBundle {
  const { room, participants, schedules } = params;
  const participantIds = participants.map((p) => p.id);
  const participantNameById = Object.fromEntries(participants.map((p) => [p.id, p.nickname]));

  const scheduleRowCount = schedules.length;
  const respondedParticipantIds = [...new Set(schedules.map((row) => row.participant_id))];
  const respondedParticipantCount = respondedParticipantIds.length;

  const ranked =
    participantIds.length === 0
      ? []
      : buildDateResults({
          dateRangeStart: room.date_range_start,
          dateRangeEnd: room.date_range_end,
          participantIds: respondedParticipantIds,
          expectedParticipantCount: room.expected_participant_count ?? 0,
          schedules,
        });

  const travelOverlapRanges =
    room.type === "travel" && room.nights != null
      ? buildTravelOverlapNightRanges(ranked, room.nights, respondedParticipantIds, schedules)
      : [];

  const travelSoloSegments =
    room.type === "travel"
      ? buildTravelSoloSegments(schedules, respondedParticipantIds)
      : [];

  const travelFixRanges = travelOverlapRanges.map((r) => ({
    startDate: r.startDate,
    endDate: r.endDate,
    canCount: r.canCount,
  }));

  return {
    participantCount: participantIds.length,
    participantNameById,
    ranked,
    scheduleRowCount,
    respondedParticipantIds,
    respondedParticipantCount,
    travelOverlapRanges,
    travelSoloSegments,
    travelFixRanges,
  };
}
