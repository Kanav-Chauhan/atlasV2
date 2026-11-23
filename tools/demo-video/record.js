#!/usr/bin/env node
// Records the Atlas landing-page demo video and builds every derived file.
// See README.md in this folder. Usage:
//   node tools/demo-video/record.js                 # record + encode + write files
//   node tools/demo-video/record.js --record-only   # just the raw take (frames/ + frames.txt + marks.json)
//   node tools/demo-video/record.js --encode-only   # re-encode the last take
// Env: BASE (default https://p1.kanav.space), OUT (work dir), FFMPEG (ffmpeg with libx264),
//      PLAYWRIGHT (path to the playwright package), SHARP (path to sharp).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '../..');
const BASE = process.env.BASE || 'https://p1.kanav.space';
const OUT = process.env.OUT || path.join(os.homedir(), '.cache/atlas-demo-video'); // on disk: PNG frames are a few hundred MB
const PLAYWRIGHT = process.env.PLAYWRIGHT || '/home/north/Projects/study-hub/node_modules/playwright';
const SHARP = process.env.SHARP || path.join(REPO, 'apps/web/node_modules/sharp');
const W = 1280, H = 800;

const QUESTION = 'How many earned leave days do I get, and how many can I carry forward?';
const SITE_QUESTION = 'What is NimbusOps?';

const TARGETS = {
  mp4: [path.join(REPO, 'apps/web/public/home/img/atlas-demo.mp4'), path.join(REPO, 'docs/media/atlas-demo.mp4')],
  gif: path.join(REPO, 'docs/media/atlas-demo.gif'),
  frame: path.join(REPO, 'docs/media/atlas-demo-frame.png'),
  poster: path.join(REPO, 'apps/web/public/home/img/demo-poster.webp'),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- cursor
// A visible cursor dot drawn in the top document only (it sits above the
// chat iframe too). It is driven from the script, not from mouse events,
// and remembers its position across page loads via sessionStorage.
const CURSOR_JS = `(() => {
  if (window.top !== window) return;
  const KEY = '__demo_cursor_pos';
  const pos = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || [${W / 2}, ${H / 2}]; } catch { return [${W / 2}, ${H / 2}]; } };
  const el = () => {
    let d = document.getElementById('__demo_cursor');
    if (d || !document.documentElement) return d;
    d = document.createElement('div');
    d.id = '__demo_cursor';
    Object.assign(d.style, {
      position: 'fixed', left: '0', top: '0', width: '20px', height: '20px', margin: '-10px 0 0 -10px',
      borderRadius: '50%', background: 'rgba(37,99,235,.28)', border: '2px solid rgba(29,78,216,.95)',
      boxShadow: '0 1px 6px rgba(15,23,42,.25)', zIndex: '2147483647', pointerEvents: 'none',
    });
    const [x, y] = pos();
    d.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    document.documentElement.appendChild(d);
    return d;
  };
  window.__dcMove = (x, y, ms) => {
    const d = el();
    d.style.transition = 'transform ' + ms + 'ms cubic-bezier(.45,0,.2,1)';
    d.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    sessionStorage.setItem(KEY, JSON.stringify([x, y]));
  };
  window.__dcClick = () => {
    const [x, y] = pos();
    const r = document.createElement('div');
    Object.assign(r.style, {
      position: 'fixed', left: x - 18 + 'px', top: y - 18 + 'px', width: '36px', height: '36px',
      borderRadius: '50%', border: '3px solid rgba(37,99,235,.8)', zIndex: '2147483646', pointerEvents: 'none',
    });
    document.documentElement.appendChild(r);
    r.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 500, easing: 'ease-out' })
      .onfinish = () => r.remove();
    const d = el();
    d.animate([{ transform: d.style.transform + ' scale(1)' }, { transform: d.style.transform + ' scale(.7)' }, { transform: d.style.transform + ' scale(1)' }], { duration: 220 });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', el); else el();
})();`;

// ---------------------------------------------------------------- record
async function takeOnce(attempt) {
  const { chromium } = require(PLAYWRIGHT);
  // Capture: a lossless CDP screencast (PNG frames + timestamps). Playwright's recordVideo is
  // VP8 at ~1 Mbit/s; its noise blurs text and makes the GIF 2-3x bigger.
  const fdir = path.join(OUT, 'frames-tmp');
  fs.rmSync(fdir, { recursive: true, force: true });
  fs.mkdirSync(fdir, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'light',
  });
  await context.addInitScript(CURSOR_JS);
  const page = await context.newPage();
  const t0 = Date.now();
  const frames = [];
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = path.join(fdir, `f${String(frames.length).padStart(5, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: Math.max(0, metadata.timestamp - t0 / 1000) });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const marks = {};
  const mark = (name) => { marks[name] = (Date.now() - t0) / 1000; console.log(`  ${name.padEnd(12)} ${marks[name].toFixed(2)}s`); };

  const centre = async (target) => {
    if (Array.isArray(target)) return target;
    await target.scrollIntoViewIfNeeded();
    const b = await target.boundingBox();
    if (!b) throw new Error('target not visible');
    return [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)];
  };
  const moveTo = async (target, ms = 650) => {
    const [x, y] = await centre(target);
    await page.evaluate(([x, y, ms]) => window.__dcMove(x, y, ms), [x, y, ms]);
    await page.mouse.move(x, y, { steps: 6 });
    await sleep(ms + 80);
    return [x, y];
  };
  const click = async (target, ms) => {
    const [x, y] = await moveTo(target, ms);
    await page.evaluate(() => window.__dcClick());
    await sleep(120);
    await page.mouse.click(x, y);
  };
  const type = async (text) => page.keyboard.type(text, { delay: 32 });

  try {
    // 1. Demo login, pick Ritika Menon (HR manager).
    await page.goto(`${BASE}/login?company=nimbus`, { waitUntil: 'load' });
    const ritika = page.locator('button, a, [role=button]').filter({ hasText: 'Ritika Menon' }).first();
    await ritika.waitFor();
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await sleep(400);
    mark('start');
    await sleep(600);
    await click(ritika, 700);
    await page.waitForURL('**/app', { timeout: 30000 });
    await page.getByRole('link', { name: 'Ask', exact: true }).first().waitFor();
    await sleep(800);

    // 2. Ask page.
    await click(page.getByRole('link', { name: 'Ask', exact: true }).first());
    await page.waitForURL('**/app/ask**');
    const box = page.locator('textarea').first();
    await box.waitFor();
    await sleep(300);
    await click(box);
    await type(QUESTION);
    await sleep(350);
    mark('submit');
    await page.keyboard.press('Enter');

    // 3. Wait for the streamed answer (this part is sped up later).
    let first = false;
    let doneSeen = 0;
    const until = Date.now() + 90000;
    for (;;) {
      if (Date.now() > until) throw new Error('answer timed out');
      const s = await page.evaluate(() => {
        const a = document.querySelector('.thread .a');
        return {
          text: a ? a.innerText.trim() : '',
          done: !!(a && a.querySelector('.actions')),
          cites: a ? a.querySelectorAll('button.cite').length : 0,
        };
      });
      if (!first && s.text.length > 25 && !/^(Reading|Checking|Searching|Finding)/i.test(s.text)) { first = true; mark('firstText'); }
      if (s.done && !s.cites && Date.now() < (doneSeen ||= Date.now()) + 4000) { await sleep(100); continue; } // citations render a beat after the text
      if (s.done) {
        if (!first) mark('firstText');
        if (/From cache/.test(s.text)) {
          const e = new Error('answer came from the semantic cache (no streaming): bump atlas:cache:gen:<org id> first, see README');
          e.fatal = true;
          throw e;
        }
        if (s.cites < 1 || !/18/.test(s.text)) throw new Error('answer has no citation / unexpected: ' + s.text.slice(0, 120));
        break;
      }
      await sleep(100);
    }
    mark('answerDone');
    await sleep(1300);

    // 4. Click citation 1 -> side document viewer with the passage highlighted.
    await click(page.locator('.thread .a button.cite').first(), 750);
    await page.locator('.dv-sizes').waitFor({ timeout: 20000 });
    await sleep(900); // PDF page renders + scrolls to the highlight
    mark('viewer');
    await sleep(1300);
    mark('poster');
    // Lossless still for the poster / README frame (cursor hidden).
    await page.screenshot({ path: path.join(OUT, 'poster.png'), style: '#__demo_cursor{display:none}' });
    await sleep(300);
    await click(page.locator('.dv-sizes button', { hasText: 'Full' }));
    await sleep(1900);
    mark('siteNav');

    // 5. The company website + chat bubble (the navigation itself is cut out).
    await page.goto(`${BASE}/demo-site/nimbus`, { waitUntil: 'load' });
    const bubble = page.locator('button[aria-label="Open chat"]');
    await bubble.waitFor();
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await sleep(500);
    mark('site');
    await sleep(500);
    await click(bubble, 750);
    const frame = page.frameLocator('iframe[src*="/embed/"]');
    const input = frame.locator('textarea#embed-q');
    await input.waitFor({ timeout: 20000 });
    await sleep(500);
    await click(input, 600);
    await type(SITE_QUESTION);
    await sleep(300);
    mark('chatSubmit');
    await page.keyboard.press('Enter');
    const until2 = Date.now() + 90000;
    for (;;) {
      if (Date.now() > until2) throw new Error('site answer timed out');
      const done = await frame.locator('.embed-sources').count();
      if (done) break;
      await sleep(100);
    }
    const siteText = await frame.locator('.embed-thread').innerText();
    if (!/NimbusOps/.test(siteText.split(SITE_QUESTION).pop() || '')) throw new Error('site answer unexpected');
    mark('chatDone');
    await sleep(2800);
    mark('end');
  } catch (e) {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    throw e;
  }
  await cdp.send('Page.stopScreencast').catch(() => {});
  await sleep(300);
  await context.close();
  await browser.close();
  // ffmpeg concat list: each frame lasts until the next one arrives.
  const final = path.join(OUT, 'frames');
  fs.rmSync(final, { recursive: true, force: true });
  fs.renameSync(fdir, final);
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t : marks.end + 0.5;
    lines.push(`file '${path.join(final, path.basename(f.file))}'`, `duration ${Math.max(0.001, next - (i ? f.t : 0)).toFixed(4)}`);
  });
  lines.push(`file '${path.join(final, path.basename(frames[frames.length - 1].file))}'`);
  const raw = path.join(OUT, 'frames.txt');
  fs.writeFileSync(raw, lines.join('\n') + '\n');
  console.log(`  ${frames.length} frames`);
  fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(marks, null, 2));
  console.log(`take ${attempt} ok -> ${raw}`);
}

async function record() {
  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 1; i <= 4; i++) {
    console.log(`take ${i}`);
    try { return await takeOnce(i); } catch (e) {
      console.log(`  take ${i} failed: ${e.message}`);
      if (e.fatal) throw e;
      await sleep(3000);
    }
  }
  throw new Error('all takes failed');
}

// ---------------------------------------------------------------- encode
function findFfmpeg() {
  const cands = [process.env.FFMPEG, 'ffmpeg'];
  try {
    const uv = path.join(os.homedir(), '.cache/uv/archive-v0');
    for (const d of fs.readdirSync(uv)) {
      const b = path.join(uv, d, 'imageio_ffmpeg/binaries');
      if (fs.existsSync(b)) for (const f of fs.readdirSync(b)) if (f.startsWith('ffmpeg')) cands.push(path.join(b, f));
    }
  } catch {}
  for (const c of cands.filter(Boolean)) {
    try { if (execFileSync(c, ['-hide_banner', '-encoders'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().includes('libx264')) return c; } catch {}
  }
  throw new Error('no ffmpeg with libx264 found; set FFMPEG=/path/to/ffmpeg');
}

// Segments of the raw take: [from, to, outputSeconds|null]. null = real speed.
function plan(m) {
  return [
    [m.start, m.submit, null],
    [m.submit, m.firstText, 1.2],    // "Reading / Checking sources" + matching documents filling
    [m.firstText, m.answerDone, 2.0], // streaming answer
    [m.answerDone, m.siteNav, null],
    [m.site, m.chatSubmit, null],
    [m.chatSubmit, m.chatDone, 1.4],
    [m.chatDone, m.end, null],
  ].map(([a, b, out]) => ({ a, b, speed: out ? Math.max(1, (b - a) / out) : 1 }));
}
function rawToOut(segs, t) {
  let acc = 0;
  for (const s of segs) {
    if (t >= s.a && t <= s.b) return acc + (t - s.a) / s.speed;
    acc += (s.b - s.a) / s.speed;
  }
  throw new Error('time not inside a kept segment: ' + t);
}

function encode() {
  const ff = findFfmpeg();
  const input = ['-f', 'concat', '-safe', '0', '-i', path.join(OUT, 'frames.txt')];
  const m = JSON.parse(fs.readFileSync(path.join(OUT, 'marks.json'), 'utf8'));
  const segs = plan(m);
  const total = segs.reduce((n, s) => n + (s.b - s.a) / s.speed, 0);
  console.log(`ffmpeg: ${ff}\noutput length ≈ ${total.toFixed(1)}s`);
  segs.forEach((s, i) => console.log(`  seg${i} ${s.a.toFixed(2)}-${s.b.toFixed(2)} x${s.speed.toFixed(2)}`));

  // 1. Cut + speed up into a lossless 30 fps intermediate.
  const f = `[0:v]fps=60,split=${segs.length}` + segs.map((_, i) => `[s${i}]`).join('') + ';'
    + segs.map((s, i) => `[s${i}]trim=start=${s.a.toFixed(3)}:end=${s.b.toFixed(3)},setpts=(PTS-STARTPTS)/${s.speed.toFixed(4)}[v${i}]`).join(';')
    + ';' + segs.map((_, i) => `[v${i}]`).join('') + `concat=n=${segs.length}:v=1:a=0,fps=30,scale=${W}:${H}[out]`;
  const cut = path.join(OUT, 'cut.mkv');
  execFileSync(ff, ['-y', '-loglevel', 'error', ...input, '-filter_complex', f, '-map', '[out]', '-an',
    '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', cut]);

  // 2. MP4: lowest CRF that keeps the file ≤ ~1 MB.
  const mp4 = path.join(OUT, 'atlas-demo.mp4');
  for (const crf of [24, 26, 28, 30, 32]) {
    execFileSync(ff, ['-y', '-loglevel', 'error', '-i', cut, '-an', '-c:v', 'libx264', '-preset', 'veryslow',
      '-tune', 'animation', '-crf', String(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    const size = fs.statSync(mp4).size;
    console.log(`  mp4 crf ${crf}: ${(size / 1e6).toFixed(2)} MB`);
    if (size <= 1.0e6) break;
  }

  // 3. GIF from the lossless cut (unchanged pixels stay identical, so frames diff small).
  const gif = path.join(OUT, 'atlas-demo.gif');
  for (const [fps, colors] of [[12, 128], [12, 64], [10, 64]]) {
    execFileSync(ff, ['-y', '-loglevel', 'error', '-i', cut, '-filter_complex',
      `fps=${fps},scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`, gif]);
    const size = fs.statSync(gif).size;
    console.log(`  gif ${fps}fps ${colors}c: ${(size / 1e6).toFixed(2)} MB`);
    if (size <= 1.05e6) break;
  }

  // Poster / README frame: the lossless screenshot taken at the 'poster' mark.
  const tPoster = rawToOut(segs, m.poster);
  const frame = path.join(OUT, 'atlas-demo-frame.png');
  fs.copyFileSync(path.join(OUT, 'poster.png'), frame);
  return { mp4, gif, frame, tPoster };
}

async function writeFiles({ mp4, gif, frame }) {
  const sharp = require(SHARP);
  const poster = path.join(OUT, 'demo-poster.webp');
  await sharp(frame).webp({ quality: 82 }).toFile(poster);
  for (const t of TARGETS.mp4) fs.copyFileSync(mp4, t);
  fs.copyFileSync(gif, TARGETS.gif);
  fs.copyFileSync(frame, TARGETS.frame);
  fs.copyFileSync(poster, TARGETS.poster);
  for (const t of [...TARGETS.mp4, TARGETS.gif, TARGETS.frame, TARGETS.poster])
    console.log(`  wrote ${path.relative(REPO, t)} (${(fs.statSync(t).size / 1e3).toFixed(0)} KB)`);
}

(async () => {
  const args = process.argv.slice(2);
  if (!args.includes('--encode-only')) await record();
  if (args.includes('--record-only')) return;
  const out = encode();
  await writeFiles(out);
})().catch((e) => { console.error(e); process.exit(1); });
