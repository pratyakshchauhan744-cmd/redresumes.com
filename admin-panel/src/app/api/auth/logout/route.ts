import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await clearSessionCookie();
  
  // Resolve base redirect URL
  const origin = request.nextUrl.origin;
  const response = NextResponse.redirect(new URL("/login", origin));
  
  return response;
}
