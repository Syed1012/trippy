import { NextResponse } from "next/server";
import { errorMessage, postToAiService, readJson } from "@/lib/server-ai-proxy";

export const runtime = "nodejs";

/**
 * Proxies the trip AI sidebar's recommendation request to the ai-service
 * (local Ollama). Kept isolated from the other AI routes and the Groq path.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const response = await postToAiService(request, "/ai/recommendations", body, 95_000);
  const data = await readJson(response);

  if (!response.ok) {
    return NextResponse.json(
      { error: errorMessage(data, `AI recommendations failed (${response.status})`) },
      { status: response.status },
    );
  }

  return NextResponse.json(data);
}
