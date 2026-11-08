import { NextResponse } from "next/server";

/** A database error as an HTTP answer: not allowed, duplicate and bad input each get their own status. */
export function dbError(error: { message: string; code?: string }) {
  const status = error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
  return NextResponse.json({ error: error.message }, { status });
}
