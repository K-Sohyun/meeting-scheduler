"use client";

import { useEffect } from "react";
import useSWR from "swr";
import type { RoomResultsBundle } from "@/lib/room-results";
import { RoomDateResults } from "./RoomDateResults";

type RoomResultsLiveProps = {
  roomId: string;
  initial: RoomResultsBundle;
  expectedCount: number;
  roomType: "single" | "travel";
  nights?: number | null;
  maxRows?: number;
};

const fetcher = async (url: string): Promise<RoomResultsBundle> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error("results fetch failed");
  }
  return (await response.json()) as RoomResultsBundle;
};

export function RoomResultsLive({
  roomId,
  initial,
  expectedCount,
  roomType,
  nights,
  maxRows,
}: RoomResultsLiveProps) {
  const key = `/api/rooms/${roomId}/results`;
  const { data, mutate } = useSWR<RoomResultsBundle>(key, fetcher, {
    fallbackData: initial,
    revalidateOnFocus: true,
    refreshInterval: 0,
  });

  useEffect(() => {
    const onRequestedRevalidate = (event: Event) => {
      const e = event as CustomEvent<{ roomId?: string }>;
      if (e.detail?.roomId === roomId) {
        void mutate();
      }
    };
    window.addEventListener("room-results-revalidate", onRequestedRevalidate);
    return () => window.removeEventListener("room-results-revalidate", onRequestedRevalidate);
  }, [mutate, roomId]);

  const payload = data ?? initial;

  return (
    <RoomDateResults
      ranked={payload.ranked}
      participantCount={payload.participantCount}
      respondedCount={payload.respondedParticipantCount}
      participantNameById={payload.participantNameById}
      expectedCount={expectedCount}
      roomType={roomType}
      nights={nights}
      scheduleRowCount={payload.scheduleRowCount}
      travelOverlapRanges={payload.travelOverlapRanges}
      travelSoloSegments={payload.travelSoloSegments}
      maxRows={maxRows}
    />
  );
}
