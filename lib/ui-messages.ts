export const UI_MESSAGES = {
  toast: {
    roomDeleted: "방이 삭제되었습니다.",
    roomCreated: "방이 생성되었습니다.",
    scheduleSaved: "일정이 저장되었습니다.",
  },
  scheduleCalendar: {
    sessionRejoinRequired: "참여 세션이 없습니다. 닉네임으로 다시 참여해 주세요.",
    loadFailed: "일정 데이터를 불러오지 못했습니다.",
    reviewAndSave: "선택 내용을 확인한 뒤 저장 버튼을 눌러 주세요.",
    revertedToLastSaved: "마지막 저장 상태로 되돌렸습니다.",
    travelAlreadyIncluded: "이미 포함된 여행 일정이에요.",
    travelApplied: (days: number) => `여행 일정 ${days}일 구간을 반영했어요. 저장 버튼을 눌러 주세요.`,
    travelRemoved: (days: number) => `선택한 시작일의 여행 일정 ${days}일 구간을 해제했어요.`,
    travelStartDateOnly: (days: number) =>
      `여행 모임은 ${days}일 연속 선택이 가능한 시작일만 선택할 수 있어요.`,
  },
  roomPage: {
    manageClosed: "모집을 마감했어요.",
    manageFixed: "일정을 확정했어요.",
    manageFixCleared: "확정 일정을 삭제했어요.",
    joinedReconnected: "이미 이 방에 등록된 닉네임이에요.",
    joinedCompleted: "참여가 완료되었습니다. 일정을 등록해주세요.",
  },
} as const;
