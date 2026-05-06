"use client";

import { useEffect, useMemo, useState } from "react";
import { ToastPopup } from "@/components/ui/ToastPopup";

type RoomsActionToastProps = {
  createdRoomId?: string;
  deleted: boolean;
};

export function RoomsActionToast({ createdRoomId, deleted }: RoomsActionToastProps) {
  const [toastMessage, setToastMessage] = useState("");
  const message = useMemo(() => {
    if (deleted) {
      return "방이 삭제되었습니다.";
    }
    if (createdRoomId) {
      return "방이 생성되었습니다.";
    }
    return "";
  }, [createdRoomId, deleted]);

  useEffect(() => {
    if (!message) {
      return;
    }
    // 브라우저 타이머 id로 관리 (rooms 목록 토스트는 클라이언트 전용 동작)
    let hideId: number | undefined;
    const showId = window.setTimeout(() => {
      setToastMessage(message);
      const url = new URL(window.location.href);
      if (deleted) {
        url.searchParams.delete("deleted");
      }
      if (createdRoomId) {
        url.searchParams.delete("created");
      }
      window.history.replaceState({}, "", url.toString());
      hideId = window.setTimeout(() => setToastMessage(""), 2500);
    }, 0);
    return () => {
      window.clearTimeout(showId);
      if (hideId !== undefined) {
        window.clearTimeout(hideId);
      }
    };
  }, [createdRoomId, deleted, message]);

  return toastMessage ? <ToastPopup message={toastMessage} /> : null;
}
