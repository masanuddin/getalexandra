# getalexandra — online photobooth for long-distance couples 📸💗

Two partners in different places join the same virtual room, see each other
over live video, take **synchronized** photos together, decorate the resulting
인생네컷-style photo strip, and download/share it.

## How it works

- **WebRTC (peer-to-peer)** carries the live video so you can pose together —
  it is *only* the posing preview.
- **Socket.IO** handles room lifecycle, presence, WebRTC signaling, and the
  synchronized capture protocol on a single channel.
- On capture, the server broadcasts a shared **fire timestamp** (server
  clock). Both browsers run the same 3→2→1 countdown against a synced clock
  and each grabs a **full-resolution still from its own local camera**
  (`getUserMedia` → hidden canvas) — never from the compressed WebRTC feed.
- Stills travel over the socket; the final strip is composited client-side on
  an HTML5 canvas (~1080 px wide) with the chosen pattern frame, stickers,
  doodles, date stamp, and watermark, then exported as a PNG.

Rooms are ephemeral and held in server memory (swap in Redis to scale
horizontally). No database needed for MVP.

## Run locally

```bash
npm install
cp .env.example .env.local   # defaults work for localhost
npm run dev                  # web on :3000 + socket server on :3001
```

Open http://localhost:3000, create a room in one browser/tab, then join with
the code from a second browser (or your phone on the same network).

> **Testing on a phone:** browsers only allow camera access on `localhost` or
> HTTPS. For a quick phone test, tunnel both ports (e.g. `ngrok`,
> `cloudflared`, or `tailscale serve`) and set `NEXT_PUBLIC_SOCKET_URL` to the
> tunneled socket URL.

### Scripts

| script | what it does |
| --- | --- |
| `npm run dev` | Next.js dev server + Socket.IO server, concurrently |
| `npm run dev:web` / `npm run dev:server` | each half on its own |
| `npm run build` / `npm start` | production build + serve |
| `npm run typecheck` | strict TypeScript check across app + server |

## Configuration

See `.env.example`. For reliable connections across strict NATs in
production, fill in the TURN placeholders (`NEXT_PUBLIC_TURN_*`) with coturn /
Twilio NTS / Cloudflare Calls credentials.

## Architecture map

```
server/index.ts            Socket.IO server: rooms, presence, signaling relay,
                           synced-capture broadcast, still fan-out
src/lib/types.ts           shared client/server protocol types
src/lib/socket.ts          socket singleton + server-clock sync
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

- Upload the final strip to S3-compatible storage for a hosted shareable URL
- Live collaborative decorating (sticker/stroke sync over the same socket room)
- More frame packs, GIF strips, timer-based auto-capture
