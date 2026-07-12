# getalexandra — online photobooth for long-distance couples 📸💗

Two partners in different places join the same virtual room, see each other
over live video, take **synchronized** photos together, decorate the resulting
인생네컷-style photo strip, and download/share it.

## How it works

- **WebRTC (peer-to-peer)** carries the live video so you can pose together —
  it is *only* the posing preview.
- A **Cloudflare Worker + Durable Objects** backend handles room lifecycle,
  presence, WebRTC signaling, and the synchronized capture protocol. One
  Durable Object per room holds the room state and both WebSocket connections.
- On capture, the room broadcasts a shared **fire timestamp** (server clock).
  Both browsers run the same 3→2→1 countdown against a synced clock and each
  grabs a **full-resolution still from its own local camera**
  (`getUserMedia` → hidden canvas) — never from the compressed WebRTC feed.
- Stills travel over the WebSocket (auto-compressed to fit Cloudflare's 1 MiB
  message cap); the final strip is composited client-side on an HTML5 canvas
  (~1080 px wide) with the chosen pattern frame, stickers, doodles, date
  stamp, and watermark, then exported as a PNG.

Rooms are ephemeral: light metadata is persisted in Durable Object storage
(so reconnects survive restarts), captured stills live in memory for the
duration of the session. No database.

## Run locally

```bash
npm install
cp .env.example .env.local   # defaults work for localhost
npm run dev                  # web on :3000 + worker (wrangler dev) on :3001
```

Open http://localhost:3000, create a room in one browser/tab, then join with
the code from a second browser (or your phone on the same network).

> **Testing on a phone:** browsers only allow camera access on `localhost` or
> HTTPS. For a quick phone test, tunnel both ports (e.g. `ngrok`,
> `cloudflared`, or `tailscale serve`) and set `NEXT_PUBLIC_SOCKET_URL` to the
> tunneled worker URL.

### Scripts

| script | what it does |
| --- | --- |
| `npm run dev` | Next.js dev server + local worker, concurrently |
| `npm run dev:web` / `npm run dev:server` | each half on its own |
| `npm run build` / `npm start` | production build + serve (web only) |
| `npm run deploy:server` | deploy the worker to Cloudflare |
| `npm run typecheck` | strict TypeScript check across app + worker |

## Deploy

1. **Backend (Cloudflare, free plan — no card needed):**
   ```bash
   npx wrangler login        # opens the browser once
   npm run deploy:server     # prints your workers.dev URL
   ```
2. **Web (Vercel):** set the environment variable
   `NEXT_PUBLIC_SOCKET_URL=https://getalexandra-booth.<account>.workers.dev`
   and redeploy (`NEXT_PUBLIC_*` vars are baked in at build time).

For reliable video across strict NATs in production, also fill in the TURN
placeholders (`NEXT_PUBLIC_TURN_*`) with coturn / Twilio NTS / Cloudflare
Calls credentials — see `.env.example`.

## Architecture map

```
worker/src/index.ts        Cloudflare Worker: room allocation + WS routing
worker/src/room.ts         BoothRoom Durable Object: presence, signaling relay,
                           synced-capture broadcast, still fan-out
src/lib/types.ts           shared client/worker protocol types
src/lib/socket.ts          WebSocket adapter (emit/on/ack) + server-clock sync
src/lib/frames.ts          pattern themes (SVG tiles shared by DOM + canvas)
src/lib/stickers.ts        hand-drawn sticker set (SVG)
src/lib/compositor.ts      strip layout, still capture, canvas export
src/store/booth.ts         Zustand store (room, shots, editor state)
src/hooks/useRoom.ts       room join/rejoin + server snapshot mirroring
src/hooks/usePeerVideo.ts  getUserMedia + RTCPeerConnection (perfect negotiation)
src/hooks/useSyncedCapture.ts  synced countdown + full-res still capture
src/app/page.tsx           landing
src/app/room/page.tsx      create / join
src/app/booth/[code]/      booth flow: lobby → frames → session → edit → final
```

## Phase 2 ideas (out of MVP)

- Upload the final strip to R2/S3 for a hosted shareable URL
- Live collaborative decorating (sticker/stroke sync over the same room)
- More frame packs, GIF strips, timer-based auto-capture
