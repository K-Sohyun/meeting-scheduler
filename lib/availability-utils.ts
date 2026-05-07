export type AvailabilityStatus = "best" | "ok";

export function getIntersection<T>(items: T[][]): T[] {
  if (items.length === 0) {
    return [];
  }
  const [first, ...rest] = items;
  return first.filter((value) => rest.every((arr) => arr.includes(value)));
}

export function getAvailableParticipantsByDate(params: {
  participantIds: string[];
  byDateParticipant: Map<string, Map<string, AvailabilityStatus>>;
  date: string;
}): {
  canParticipantIds: string[];
  bestCount: number;
  okCount: number;
} {
  const { participantIds, byDateParticipant, date } = params;
  const m = byDateParticipant.get(date) ?? new Map<string, AvailabilityStatus>();
  let bestCount = 0;
  let okCount = 0;
  const canParticipantIds: string[] = [];
  for (const pid of participantIds) {
    const st = m.get(pid);
    if (st === "best") {
      bestCount += 1;
      canParticipantIds.push(pid);
      continue;
    }
    if (st === "ok") {
      okCount += 1;
      canParticipantIds.push(pid);
    }
  }
  return { canParticipantIds, bestCount, okCount };
}
