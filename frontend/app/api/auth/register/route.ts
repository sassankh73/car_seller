import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  `http://${process.env.BACKEND_HOST ?? "backend"}:${process.env.BACKEND_PORT ?? "8001"}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const res = await fetch(`${BACKEND}/api/auth/register`, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
      body,
    });

    const data = await res.text();
    const response = new NextResponse(data, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }

    return response;
  } catch (err) {
    console.error("[/api/auth/register] proxy error:", err);
    return NextResponse.json({ detail: "Auth service unavailable" }, { status: 503 });
  }
}
