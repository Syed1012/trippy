import { NextResponse } from "next/server";
import { errorMessage, postToAiService, readJson } from "@/lib/server-ai-proxy";

export const runtime = "nodejs";

/**
 * Proxies trip cover-image generation to the ai-service. Kept isolated from the
 * other AI routes; the generated URL is persisted onto the trip by the caller.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const response = await postToAiService(request, "/ai/trip-images", body, 40_000);
  const data = await readJson(response);

  if (!response.ok) {
    return NextResponse.json(
      { error: errorMessage(data, `Trip image generation failed (${response.status})`) },
      { status: response.status },
    );
  }

  return NextResponse.json(data);
}
