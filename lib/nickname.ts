/** 앞뒤 공백 제거, 연속 공백을 한 칸으로 (모임 닉네임에 맞게) */
export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
