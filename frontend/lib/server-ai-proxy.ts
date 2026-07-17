const AI_API_BASE_URL =
  process.env.AI_SERVICE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8084";

export async function postToAiService(
  incoming: Request,
  path: string,
  body: unknown,
  timeoutMs = 65_000,
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const authorization = incoming.headers.get("authorization");
  if (authorization) headers.Authorization = authorization;

  const correlationId = incoming.headers.get("x-correlation-id");
  if (correlationId) headers["X-Correlation-Id"] = correlationId;

  return fetch(`${AI_API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function getFromAiService(
  incoming: Request,
  path: string,
  timeoutMs = 20_000,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const authorization = incoming.headers.get("authorization");
  if (authorization) headers.Authorization = authorization;

  const correlationId = incoming.headers.get("x-correlation-id");
  if (correlationId) headers["X-Correlation-Id"] = correlationId;

  return fetch(`${AI_API_BASE_URL}${path}`, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export function errorMessage(body: Record<string, unknown>, fallback: string): string {
  return (
    (typeof body.error === "string" && body.error) ||
    (typeof body.message === "string" && body.message) ||
    fallback
  );
}
