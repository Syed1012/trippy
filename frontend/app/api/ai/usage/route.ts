import { NextResponse } from "next/server";
import { getFromAiService, readJson } from "@/lib/server-ai-proxy";

export const runtime = "nodejs";

export async function GET(request: Request) {
    try {
        const response = await getFromAiService(request, "/ai/usage", 15_000);
        const data = await readJson(response);

        if (response.ok) {
            return NextResponse.json(data);
        }

        // Fallback response if service returns an error
        return NextResponse.json({
            totalRequests: 0,
            requestsByType: {},
            lastUsedAt: null,
            tokensConsumed: 0,
            fallbackUsed: true,
            error: data.message || "Failed to fetch AI usage stats",
        });
    } catch (err) {
        console.error("[AI Proxy] Usage fetch failed:", err);
        return NextResponse.json({
            totalRequests: 0,
            requestsByType: {},
            lastUsedAt: null,
            tokensConsumed: 0,
            fallbackUsed: true,
            error: "AI service unavailable",
        });
    }
}
