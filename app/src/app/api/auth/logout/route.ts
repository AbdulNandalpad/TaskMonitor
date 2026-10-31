import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AREA_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

async function out(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(AREA_COOKIE);
  const url = req.nextUrl.clone();
  const reason = url.searchParams.get("reason");
  const name = url.searchParams.get("name");
  url.pathname = "/login";
  url.search = reason ? `?reason=${encodeURIComponent(reason)}&name=${encodeURIComponent(name ?? "")}` : "";
  return NextResponse.redirect(url, 303);
}

export const GET = out;
export const POST = out;
