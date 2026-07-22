import { NextResponse } from "next/server";
import { errorMessage, postToAiService, readJson } from "@/lib/server-ai-proxy";

export const runtime = "nodejs";

/** Proxies place review generation to ai-service (POST /ai/places/insights). */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const response = await postToAiService(request, "/ai/places/insights", body, 70_000);
    const data = await readJson(response);
    if (!response.ok) {
      return NextResponse.json(
        { error: errorMessage(data, `Place insights failed (${response.status})`) },
        { status: response.status },
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "AI service unreachable" }, { status: 502 });
  }
}
