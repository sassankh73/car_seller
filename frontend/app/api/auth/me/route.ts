import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  `http://${process.env.BACKEND_HOST ?? "backend"}:${process.env.BACKEND_PORT ?? "8001"}`;

export async function GET(request: NextRequest) {
  try {
    const res = await fetch(`${BACKEND}/api/auth/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[/api/auth/me] proxy error:", err);
    return NextResponse.json({ detail: "Auth service unavailable" }, { status: 503 });
  }
}
