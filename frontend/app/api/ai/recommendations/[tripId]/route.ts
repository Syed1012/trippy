import { NextResponse } from "next/server";
import { errorMessage, getFromAiService, readJson } from "@/lib/server-ai-proxy";

export const runtime = "nodejs";

/**
 * Returns the stored itinerary recommendations for a trip so the AI sidebar can
 * show results that were generated in a previous session or are still finishing
 * in the background. Isolated from the other AI routes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const response = await getFromAiService(request, `/ai/recommendations/${tripId}`);
  const data = await readJson(response);

  if (!response.ok) {
    return NextResponse.json(
      { error: errorMessage(data, `Fetching recommendations failed (${response.status})`) },
      { status: response.status },
    );
  }

  return NextResponse.json(data);
}
