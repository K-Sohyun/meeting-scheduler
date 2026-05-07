"use client";

import { useEffect } from "react";
import useSWR from "swr";
import type { RoomResultsBundle } from "@/lib/room-results";

type RoomLiveCountsProps = {
  roomId: string;
  expectedCount: number;
  initialParticipantCount: number;
  initialRespondedCount: number;
};

const fetcher = async (url: string): Promise<RoomResultsBundle> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error("results fetch failed");
  }
  return (await response.json()) as RoomResultsBundle;
};

export function RoomLiveCounts({
  roomId,
  expectedCount,
  initialParticipantCount,
  initialRespondedCount,
}: RoomLiveCountsProps) {
  const { data, mutate } = useSWR<RoomResultsBundle>(`/api/rooms/${roomId}/results`, fetcher, {
    fallbackData: undefined,
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
  const participantCount = data?.participantCount ?? initialParticipantCount;
  const respondedCount = data?.respondedParticipantCount ?? initialRespondedCount;

  return (
    <p className="mt-1 text-sm text-app-muted">
      예상 인원: {expectedCount}명 / 참여: {participantCount}명 / 응답: {respondedCount}명
    </p>
  );
}
