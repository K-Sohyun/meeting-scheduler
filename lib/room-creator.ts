/** 방을 만든 브라우저(POST /rooms/new/create 응답)에만 발급되는 쿠키. join 시 DB의 creator_claim_token 과 일치하면 owner 로 기록. */
export function getRoomCreatorCookieName(roomId: string) {
  return `meeting_scheduler_room_creator_${roomId}`;
}
