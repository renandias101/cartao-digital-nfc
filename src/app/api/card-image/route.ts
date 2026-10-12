import { NextRequest, NextResponse } from "next/server";

import { CARD_IMAGES_BUCKET } from "@/lib/card/images";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PATH = /^[0-9a-f]{8}-[0-9a-f-]{27}\/(?:profile|banner|background|icon)-[0-9a-f-]{36}\.webp$/i;

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  if (!PATH.test(path)) return new NextResponse(null, { status: 404 });

  const session = await createSupabaseServerClient();
  const { data: allowed, error: accessError } = await session.rpc("can_read_card_image", { p_path: path });
  if (accessError || !allowed) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

  const { data, error } = await createSupabaseAdminClient().storage.from(CARD_IMAGES_BUCKET).download(path);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
