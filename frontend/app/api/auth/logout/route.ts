import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  `http://${process.env.BACKEND_HOST ?? "backend"}:${process.env.BACKEND_PORT ?? "8001"}`;

export async function POST(request: NextRequest) {
  // Best-effort call to backend to invalidate server-side session if any
  try {
    await fetch(`${BACKEND}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
  } catch {
    // Ignore backend errors — still clear the cookie locally
  }

  const response = NextResponse.json({ detail: "Logged out successfully" });
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  // Belt-and-suspenders: explicit raw header for Safari/Firefox which may ignore Max-Age=0 without Expires
  const secureFlag = isProd ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `auth_token=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secureFlag}`
  );
  return response;
}
