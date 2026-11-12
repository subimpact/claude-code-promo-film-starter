// render.mjs: renders every frame in headless Chromium and pipes the PNGs straight into ffmpeg.
//
//   npm run render                       full size, all frames -> out/film.mp4
//   npm run still -- 120                 one full-size frame   -> out/still-0120.png
//   node scripts/render.mjs --scale 0.5 --out out/half.mp4    half size, quicker check
//
// Environment: FFMPEG=/path/to/ffmpeg, CHROME_PATH=/path/to/chrome, CHROMIUM_ARGS="--flag --flag"
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as TL from '../src/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
// Software WebGL (SwiftShader) runs on machines without a GPU and gives the same image everywhere.
const CHROMIUM_ARGS = process.env.CHROMIUM_ARGS
  ? process.env.CHROMIUM_ARGS.split(' ').filter(Boolean)
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const STILL = opt('--still', '');
const SCALE = parseFloat(opt('--scale', '1'));
const OUT = opt('--out', 'out/film.mp4');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

// a tiny static server, so the page can load three.js, the fonts and your screenshot
function serve() {
  const server = http.createServer((req, res) => {
    const fp = path.resolve(path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function writeTo(stream, buf) {
  return new Promise((resolve, reject) => {
    if (stream.write(buf)) return resolve();
    stream.once('drain', resolve);
    stream.once('error', reject);
  });
}

async function main() {
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  const server = await serve();
  const launchOpts = { headless: true, args: CHROMIUM_ARGS };
  if (process.env.CHROME_PATH) launchOpts.executablePath = process.env.CHROME_PATH;
  let browser;
  try {
    browser = await chromium.launch(launchOpts);
  } catch (e) {
    console.error('Could not start Chromium. Run "npx playwright-core install chromium" (or set CHROME_PATH).');
    throw e;
  }
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/src/scene.html?scale=${SCALE}`);
  const webgl2 = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
  if (!webgl2) throw new Error('WebGL2 is not available in this Chromium build.');
  await page.waitForFunction(() => typeof window.__boot === 'function', null, { timeout: 60000 });
  await page.evaluate(() => window.__boot());
  await page.waitForFunction(() => window.__ready === true || !!window.__bootError, null, { timeout: 120000 });
  const bootError = await page.evaluate(() => window.__bootError || null);
  if (bootError) throw new Error('scene failed to start: ' + bootError);

  if (STILL) {
    const f = Math.min(TL.TOTAL_FRAMES - 1, parseInt(STILL, 10));
    const png = await page.evaluate((x) => window.renderFrame(x), f);
    const out = path.join(ROOT, 'out', `still-${String(f).padStart(4, '0')}.png`);
    fs.writeFileSync(out, Buffer.from(png, 'base64'));
    console.log(`wrote ${path.relative(ROOT, out)}`);
  } else {
    const outPath = path.resolve(ROOT, OUT);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const ff = spawn(FFMPEG, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(TL.FPS), '-i', '-',
      '-c:v', 'libx264', '-profile:v', 'high', '-crf', '18', '-preset', 'medium',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((resolve, reject) => {
      ff.on('error', (e) => reject(new Error(`could not start ${FFMPEG}: ${e.message}. Install ffmpeg or set FFMPEG.`)));
      ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
    });
    const t0 = Date.now();
    console.log(`rendering ${TL.TOTAL_FRAMES} frames (${TL.DUR.toFixed(2)} s at ${TL.FPS} fps, ${Math.round(TL.W * SCALE)}x${Math.round(TL.H * SCALE)})`);
    for (let f = 0; f < TL.TOTAL_FRAMES; f++) {
      const png = await page.evaluate((x) => window.renderFrame(x), f);
      await writeTo(ff.stdin, Buffer.from(png, 'base64'));
      if ((f + 1) % 30 === 0) console.log(`  frame ${f + 1}/${TL.TOTAL_FRAMES}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
    ff.stdin.end();
    await done;
    console.log(`wrote ${path.relative(ROOT, outPath)} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  await browser.close();
  server.close();
}

main().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
