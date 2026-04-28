import type { SupabaseClient } from "@supabase/supabase-js";

export async function isParticipantInRoom(
  supabase: SupabaseClient,
  roomId: string,
  participantId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  return true;
}
