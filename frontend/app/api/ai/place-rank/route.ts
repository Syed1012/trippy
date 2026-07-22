import { NextResponse } from "next/server";
import { errorMessage, postToAiService, readJson } from "@/lib/server-ai-proxy";

export const runtime = "nodejs";

/** Proxies the top-3 place ranking to ai-service (POST /ai/places/rank). */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const response = await postToAiService(request, "/ai/places/rank", body, 50_000);
    const data = await readJson(response);
    if (!response.ok) {
      return NextResponse.json(
        { error: errorMessage(data, `Place ranking failed (${response.status})`) },
        { status: response.status },
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "AI service unreachable" }, { status: 502 });
  }
}
