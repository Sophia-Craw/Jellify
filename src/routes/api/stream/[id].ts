import type { APIEvent } from "@solidjs/start/server";

interface StoredAuth {
  serverUrl: string;
  accessToken: string;
  userId: string;
}

function readAuthFromCookie(cookie: string): StoredAuth | null {
  try {
    const match = cookie.match(/jusic_auth=([^;]+)/);
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export async function GET({ params, request }: APIEvent) {
  const { id } = params;
  const cookie = request.headers.get("cookie") || "";
  const auth = readAuthFromCookie(cookie);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const upstreamUrl = `${auth.serverUrl}/Audio/${id}/stream?static=true&api_key=${auth.accessToken}`;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      "X-Emby-Token": auth.accessToken,
      ...(request.headers.has("range") ? { range: request.headers.get("range")! } : {}),
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };

  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength) headers["Content-Length"] = contentLength;

  const contentRange = upstream.headers.get("Content-Range");
  if (contentRange) headers["Content-Range"] = contentRange;

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
