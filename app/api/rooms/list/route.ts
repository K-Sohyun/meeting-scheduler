import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id, name, type, date_range_start, date_range_end, created_at, password_hash, is_closed, fixed_start_date",
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: "방 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    rooms: data ?? [],
  });
}
