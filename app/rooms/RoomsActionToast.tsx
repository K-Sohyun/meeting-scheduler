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
    setToastMessage(message);

    const url = new URL(window.location.href);
    if (deleted) {
      url.searchParams.delete("deleted");
    }
    if (createdRoomId) {
      url.searchParams.delete("created");
    }
    window.history.replaceState({}, "", url.toString());

    const timeoutId = window.setTimeout(() => setToastMessage(""), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [createdRoomId, deleted, message]);

  return toastMessage ? <ToastPopup message={toastMessage} /> : null;
}
