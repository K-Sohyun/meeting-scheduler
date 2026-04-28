import { isAfter, isBefore, parseISO } from "date-fns";

/**
 * YYYY-MM-DD 가 방 일정 범위 안에 있는지 (끝 날짜 포함)
 */
export function isDateInRoomRange(dateStr: string, rangeStart: string, rangeEnd: string): boolean {
  const d = parseISO(dateStr);
  const start = parseISO(rangeStart);
  const end = parseISO(rangeEnd);
  if (isBefore(d, start) || isAfter(d, end)) {
    return false;
  }
  return true;
}
