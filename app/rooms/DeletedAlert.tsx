"use client";

import { useEffect } from "react";

type DeletedAlertProps = {
  deleted: boolean;
};

export function DeletedAlert({ deleted }: DeletedAlertProps) {
  useEffect(() => {
    const onceKey = "meeting_scheduler:rooms_deleted_alert_shown";

    if (!deleted) {
      try {
        sessionStorage.removeItem(onceKey);
      } catch {
        // noop
      }
      return;
    }

    try {
      if (sessionStorage.getItem(onceKey) === "1") {
        return;
      }
      sessionStorage.setItem(onceKey, "1");
    } catch {
      // storage 접근 불가 환경에서도 알림은 1회 시도
    }

    alert("모임이 삭제되었습니다.");

    const url = new URL(window.location.href);
    url.searchParams.delete("deleted");
    window.history.replaceState({}, "", url.toString());
  }, [deleted]);

  return null;
}
