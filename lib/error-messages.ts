export const ERROR_MESSAGES = {
  common: {
    invalidRequest: "잘못된 요청입니다.",
    invalidRoomId: "잘못된 방 주소입니다.",
    roomNotFound: "방 정보를 찾을 수 없습니다.",
    noParticipantSession: "참여 세션이 없습니다.",
    notParticipantInRoom: "이 방의 참여자가 아닙니다.",
    retryLater: "잠시 후 다시 시도해 주세요.",
  },
  roomCreate: {
    failed: "방 생성 실패: 잠시 후 다시 시도해 주세요.",
  },
  schedules: {
    loadFailed: "일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    saveFailed: "일정 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    invalidPayload: "잘못된 요청 형식입니다.",
    closedRoomReadonly: "모집이 마감된 방이라 일정을 수정할 수 없어요.",
    travelBestOnly: "여행 모임 일정은 모두 '선호(best)'만 저장돼요.",
  },
  holidays: {
    invalidQuery: "잘못된 요청입니다. year(2000~2100), month(1~12)이 필요합니다.",
    loadFailed: "공휴일 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  },
  join: {
    failed: "참여 처리 중 오류가 발생했어요.",
  },
  manage: {
    ownerSessionRequired: "방장 세션이 필요합니다.",
    ownerOnly: "방장만 실행할 수 있습니다.",
    closeNeedExpectedCount: "예상 인원이 1명 이상일 때만 마감할 수 있습니다.",
    closeNeedAllResponses: "예상 인원 전원이 일정 응답을 완료해야 마감할 수 있습니다.",
    closeFailed: "모집 마감 처리에 실패했습니다.",
    fixAfterCloseOnly: "모집 마감 후에만 일정을 확정할 수 있습니다.",
    fixDateRequired: "확정할 날짜를 선택해 주세요.",
    fixOutOfRange: "방 일정 범위 밖 날짜입니다.",
    fixTravelOverRange: "선택한 날짜는 여행 범위를 넘습니다.",
    fixFailed: "일정 확정에 실패했습니다.",
    clearFixFailed: "확정 일정 삭제에 실패했습니다.",
    deleteSchedulesFailed: "일정을 삭제하지 못했습니다.",
    deleteParticipantsFailed: "참가자를 삭제하지 못했습니다.",
    deleteRoomFailed: "방을 삭제하지 못했습니다.",
  },
} as const;
