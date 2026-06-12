import type { APIEvent } from "@solidjs/start/server";
import type { StoredAuth } from "~/lib/jellyfin";

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

  const redirectUrl = `${auth.serverUrl}/Audio/${id}/stream?static=true&api_key=${auth.accessToken}`;

  return new Response(null, {
    status: 307,
    headers: { Location: redirectUrl },
  });
}
