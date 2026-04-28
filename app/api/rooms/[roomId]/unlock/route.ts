import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRoomUnlockCookieName } from "@/lib/room-unlock";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramSchema = z.object({ roomId: z.string().uuid() });

function getSafeRedirect(
  request: Request,
  roomId: string,
  redirectPath: string | null | undefined,
) {
  const defaultUrl = new URL(`/rooms/${roomId}`, request.url);
  if (!redirectPath || typeof redirectPath !== "string" || !redirectPath.startsWith("/")) {
    return defaultUrl;
  }
  if (!redirectPath.startsWith(`/rooms/${roomId}`)) {
    return defaultUrl;
  }
  return new URL(redirectPath, request.url);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const roomParams = paramSchema.safeParse(await context.params);
  if (!roomParams.success) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }
  const roomId = roomParams.data.roomId;

  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "");

  const supabase = createSupabaseServerClient();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("password_hash")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  if (!room.password_hash) {
    return NextResponse.redirect(new URL(`/rooms/${roomId}`, request.url), 303);
  }

  const inputHash = createHash("sha256").update(password, "utf8").digest("hex");
  if (inputHash !== room.password_hash) {
    const fail = new URL(getSafeRedirect(request, roomId, redirectTo).toString());
    fail.searchParams.set("pw", "wrong");
    return NextResponse.redirect(fail, 303);
  }

  const nextUrl = getSafeRedirect(request, roomId, redirectTo);
  const response = NextResponse.redirect(nextUrl, 303);
  response.cookies.set(getRoomUnlockCookieName(roomId), "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
