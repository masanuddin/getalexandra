/**
 * Cloudflare Worker entry — routes HTTP + WebSocket traffic to per-room
 * Durable Objects. One DO instance per room code.
 *
 *   POST /api/rooms          → allocate a room code, reserve the owner seat
 *   GET  /api/turn           → short-lived TURN credentials (Cloudflare Calls)
 *   GET  /rooms/:code/ws     → WebSocket upgrade, forwarded to the room's DO
 *   GET  /                   → health check
 */

import { BoothRoom } from "./room";

export { BoothRoom };

export interface Env {
  ROOMS: DurableObjectNamespace;
  /**
   * Cloudflare Calls TURN credentials (optional — without them /api/turn
   * returns an empty list and clients fall back to STUN only).
   * Set with:  npx wrangler secret put TURN_KEY_ID --config worker/wrangler.toml
   *            npx wrangler secret put TURN_KEY_API_TOKEN --config worker/wrangler.toml
   */
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
}

/**
 * Ask Cloudflare Calls for short-lived TURN credentials.
 * `reason` explains an empty result so /api/turn is debuggable from a browser.
 */
async function generateTurnServers(
  env: Env,
): Promise<{ servers: unknown[]; reason?: string }> {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) {
    return { servers: [], reason: "turn secrets not configured on the worker" };
  }
  const base = `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials`;
  const init = {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ttl: 21_600 }), // 6h — a booth session is minutes
  };
  // the API has two generations of this endpoint; try new, fall back to old
  let res = await fetch(`${base}/generate-ice-servers`, init);
  if (!res.ok) res = await fetch(`${base}/generate`, init);
  if (!res.ok) {
    return { servers: [], reason: `cloudflare turn api responded ${res.status}` };
  }
  const data = await res.json<{ iceServers?: unknown }>();
  const servers = Array.isArray(data.iceServers)
    ? data.iceServers
    : data.iceServers
      ? [data.iceServers]
      : [];
  return { servers };
}

// no ambiguous chars (0/O, 1/I/L)
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method === "GET" && url.pathname === "/api/turn") {
      try {
        const { servers, reason } = await generateTurnServers(env);
        return Response.json(
          { iceServers: servers, ...(reason ? { reason } : {}) },
          { headers: CORS_HEADERS },
        );
      } catch (err) {
        // video still works on friendly networks via STUN
        return Response.json(
          { iceServers: [], reason: String(err) },
          { headers: CORS_HEADERS },
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      let body: { clientId?: string } = {};
      try {
        body = await request.json();
      } catch {
        // empty body is fine
      }
      // retry on the (astronomically unlikely) code collision
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const res = await stub.fetch("https://room/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clientId: body.clientId, code }),
        });
        if (res.status === 409) continue;
        return Response.json({ ok: true, code }, { headers: CORS_HEADERS });
      }
      return Response.json(
        { ok: false, error: "could not allocate a room code" },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    const wsMatch = url.pathname.match(/^\/rooms\/([A-Za-z0-9]{4,10})\/ws$/);
    if (wsMatch) {
      const code = wsMatch[1].toUpperCase();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const doUrl = new URL(request.url);
      doUrl.pathname = "/ws";
      return stub.fetch(new Request(doUrl, request));
    }

    return new Response("getalexandra photobooth realtime worker\n", {
      headers: { "content-type": "text/plain", ...CORS_HEADERS },
    });
  },
};
