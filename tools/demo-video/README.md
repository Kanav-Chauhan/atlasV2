# Demo video

`record.js` records the ~30 s Atlas demo shown on the landing page ("Every answer shows its page")
and in the README, then builds every file from that one take:

| File | What |
|---|---|
| `apps/web/public/home/img/atlas-demo.mp4` | landing video (1280×800, H.264, muted loop) |
| `apps/web/public/home/img/demo-poster.webp` | its poster frame |
| `docs/media/atlas-demo.mp4` | same MP4, linked from the README |
| `docs/media/atlas-demo.gif` | README GIF (960 wide, ~12 fps, ≤ ~1 MB) |
| `docs/media/atlas-demo-frame.png` | still: answer + document viewer |

## Story

1. `/login?company=nimbus` → log in as **Ritika Menon** (HR manager).
2. Ask → types *"How many earned leave days do I get, and how many can I carry forward?"*.
3. The answer streams with numbered citations while *Matching documents* fills (this wait is sped up).
4. Click citation 1 → the side document viewer opens the Leave Policy PDF with the passage highlighted → Full.
5. Cut to `/demo-site/nimbus` → chat bubble → *"What is NimbusOps?"* → cited answer (wait sped up).

A blue dot is injected as the cursor (headless Chromium draws none), with a ring on each click.
Capture is a lossless CDP screencast (PNG frames + timestamps), not Playwright's `recordVideo`
(its VP8 noise blurs text and makes the GIF 2-3x bigger).

## Run

```sh
node tools/demo-video/record.js                # record + encode + overwrite the files above
node tools/demo-video/record.js --record-only  # raw take only ($OUT/frames/ + frames.txt + marks.json + poster.png)
node tools/demo-video/record.js --encode-only  # re-encode the last take
```

Env: `BASE` (default `https://p1.kanav.space`), `OUT` (work dir, default `~/.cache/atlas-demo-video`; a few hundred MB of PNG frames),
`FFMPEG` (any ffmpeg with libx264; the script also finds the imageio-ffmpeg binary in `~/.cache/uv`),
`PLAYWRIGHT` (path to the `playwright` package), `SHARP` (default `apps/web/node_modules/sharp`).

How the cut works: the script writes timestamps (`marks.json`) while recording. The encoder keeps
the take from `start` to `siteNav` and from `site` to `end` (the page navigation between them is cut),
and squeezes the two AI waits with `trim` + `setpts` to about 1.2 s (search) and 2 s (streaming).
Everything is cut into a lossless intermediate (`cut.mkv`); the MP4 CRF is raised until the file is ≤ 1 MB; the GIF uses palettegen/paletteuse.

## Before recording

- The demo allows 40 AI questions a day per visitor IP. If the server IP used them up, delete only
  its counters: `docker exec atlasv2-redis-1 redis-cli --scan --pattern 'plan:demo:*:<server-ip>:*'`, then `DEL` them.
- If the semantic answer cache already holds the question, the answer appears instantly ("From cache")
  instead of streaming. Bump Nimbus's cache generation first (same thing an upload or the nightly reset does):
  `docker exec atlasv2-redis-1 redis-cli INCR atlas:cache:gen:5` (5 = Nimbus org id).
- Answers come from free models: a take is retried (up to 4) when an answer times out or has no citation.
  Retries hit the cache, so bump the generation again if the streaming matters.

Then deploy the web app so the landing serves the new video.
