// scene.js: the three.js scene and the deterministic frame renderer.
// Loaded by src/scene.html inside headless Chromium. Exposes window.renderFrame(frame),
// which returns one PNG. Everything drawn is a pure function of the frame index.
import * as THREE from 'three';
import * as TL from './timeline.js';

const C = TL.CONFIG;
const COL = C.colours;

const qs = new URLSearchParams(location.search);
const SCALE = parseFloat(qs.get('scale') || '1');
const OUT_W = Math.round(TL.W * SCALE);
const OUT_H = Math.round(TL.H * SCALE);

// ---------- canvases: WebGL for the phone, 2D on top for the title and fades ----------
const glCanvas = document.createElement('canvas');
const canv = document.createElement('canvas');
canv.width = OUT_W; canv.height = OUT_H;
const ctx2d = canv.getContext('2d', { alpha: false });

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(OUT_W, OUT_H, false);
renderer.setClearColor(new THREE.Color(COL.background), 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.background);
const camera = new THREE.PerspectiveCamera(TL.CAM_FOV, OUT_W / OUT_H, 0.05, 100);
camera.setViewOffset(OUT_W, OUT_H, 0, -TL.VIEW_SHIFT * OUT_H, OUT_W, OUT_H);

// ---------- lighting: light strips baked into an environment map; the background stays dark ----------
function buildEnv() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x000000);
  const strip = (color, w, h, pos, rotX, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(pos); m.rotation.set(rotX, rotY, 0);
    env.add(m);
  };
  strip(new THREE.Color(1.0, 0.56, 0.27).multiplyScalar(9), 2.5, 7, new THREE.Vector3(-5.5, 1.2, -4.2), 0, Math.PI / 2 + 0.7);  // warm rim, behind left
  strip(new THREE.Color(0.42, 0.56, 0.84).multiplyScalar(9), 2.5, 7, new THREE.Vector3(5.5, -0.4, -4.2), 0, -Math.PI / 2 - 0.7); // cool rim, behind right
  strip(new THREE.Color(2.4, 2.4, 2.4), 12, 4, new THREE.Vector3(0, 6.5, 1.5), Math.PI / 2 + 0.25, 0);                           // soft top key
  strip(new THREE.Color(0.5, 0.5, 0.5), 10, 6, new THREE.Vector3(0, 0, 7), Math.PI, 0);                                           // faint front fill
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0, 0.1, 60).texture;
  pmrem.dispose();
}
buildEnv();
const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(-2, 3, 4);
scene.add(fill);

// ---------- procedural phone (built once the screenshot's aspect ratio is known) ----------
function roundedRectPath(w, h, r, cls = THREE.Path) {
  const x = -w / 2, y = -h / 2;
  const p = new cls();
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}
const shape = (w, h, r) => roundedRectPath(w, h, r, THREE.Shape);

function makePhone(img) {
  const SW = img.naturalWidth, SH = img.naturalHeight;
  const DISP_H = 2.5;
  const DISP_W = (DISP_H * SW) / SH;
  const BODY_W = DISP_W * 1.04, BODY_H = DISP_H * 1.02;
  const DEPTH = 0.15, BEVEL = 0.013;
  const radiusPx = Math.round(0.141 * SW); // display corner radius in screenshot pixels
  const dispR = radiusPx * (DISP_H / SH);
  const winW = DISP_W + 0.03, winH = DISP_H + 0.03, winR = dispR + 0.015, bodyR = dispR + 0.03;
  const frameColor = new THREE.Color(COL.frame);
  const frameMat = () => new THREE.MeshPhysicalMaterial({ color: frameColor, metalness: 1.0, roughness: 0.28 });

  const group = new THREE.Group();

  const body = shape(BODY_W, BODY_H, bodyR);
  body.holes.push(roundedRectPath(winW, winH, winR));
  const bodyGeo = new THREE.ExtrudeGeometry(body, {
    depth: DEPTH - BEVEL * 2, bevelEnabled: true, bevelThickness: BEVEL,
    bevelSize: BEVEL * 0.9, bevelSegments: 3, curveSegments: 10, steps: 1,
  });
  bodyGeo.center();
  group.add(new THREE.Mesh(bodyGeo, frameMat()));

  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.06, winH + 0.06),
    new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
  bezel.position.z = DEPTH / 2 - BEVEL + 0.001;
  group.add(bezel);

  // display: the screenshot with rounded corners on a CanvasTexture, never tone mapped
  const dc = document.createElement('canvas');
  dc.width = SW; dc.height = SH;
  const d = dc.getContext('2d');
  d.beginPath();
  d.roundRect(0, 0, SW, SH, radiusPx);
  d.clip();
  d.drawImage(img, 0, 0, SW, SH);
  const tex = new THREE.CanvasTexture(dc);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const display = new THREE.Mesh(new THREE.PlaneGeometry(DISP_W, DISP_H),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  display.position.z = DEPTH / 2 - BEVEL + 0.005;
  group.add(display);

  const glassGeo = new THREE.ExtrudeGeometry(shape(winW + 0.012, winH + 0.012, winR + 0.006), { depth: 0.004, bevelEnabled: false, curveSegments: 10 });
  glassGeo.center();
  const glass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({
    color: 0x050505, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.08,
    transparent: true, opacity: 0.13, envMapIntensity: 1.5, depthWrite: false,
  }));
  glass.position.z = DEPTH / 2 - BEVEL + 0.012;
  group.add(glass);

  const backGeo = new THREE.ExtrudeGeometry(shape(BODY_W - 0.004, BODY_H - 0.004, bodyR - 0.002), { depth: 0.006, bevelEnabled: false, curveSegments: 10 });
  backGeo.center();
  const back = new THREE.Mesh(backGeo, new THREE.MeshPhysicalMaterial({
    color: frameColor, metalness: 0.25, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.35, envMapIntensity: 0.8,
  }));
  back.rotation.y = Math.PI;
  back.position.z = -DEPTH / 2 + 0.002;
  group.add(back);

  // camera bump and lenses on the back, side buttons
  const bumpGeo = new THREE.ExtrudeGeometry(shape(0.52, 0.52, 0.15), { depth: 0.028, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 8 });
  bumpGeo.center();
  const bump = new THREE.Mesh(bumpGeo, frameMat());
  bump.position.set(-BODY_W / 2 + 0.36, BODY_H / 2 - 0.36, -DEPTH / 2 - 0.02);
  group.add(bump);
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, metalness: 0.9, roughness: 0.2 });
  const ringMat = new THREE.MeshPhysicalMaterial({ color: 0x35332f, metalness: 1, roughness: 0.35 });
  for (const [lx, ly] of [[-0.13, 0.13], [0.13, 0.15], [-0.04, -0.14]]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.03, 24), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bump.position.x + lx, bump.position.y + ly, -DEPTH / 2 - 0.045);
    group.add(ring);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.036, 24), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(bump.position.x + lx, bump.position.y + ly, -DEPTH / 2 - 0.052);
    group.add(lens);
  }
  for (const [x, y, len] of [[BODY_W / 2 + 0.004, 0.32, 0.42], [-BODY_W / 2 - 0.004, 0.45, 0.44], [-BODY_W / 2 - 0.004, 0.02, 0.44]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.022, len, DEPTH * 0.3), frameMat());
    b.position.set(x, y, 0);
    group.add(b);
  }
  return group;
}

let phone = null;
let titleLines = null;

// ---------- title card: measured once at full size, drawn scaled ----------
function layoutTitle() {
  const m = document.createElement('canvas').getContext('2d');
  const T = TL.TYPE;
  const lines = [
    { segments: TL.parseLine(C.title.line1), size: T.line1, family: 'FilmSemiBold', color: COL.title },
    { segments: TL.parseLine(C.title.line2), size: T.line2, family: 'FilmMedium', color: COL.subtitle },
  ].filter((ln) => ln.segments.length);
  for (const ln of lines) {
    const text = ln.segments.map((s) => s.t).join('');
    m.font = `${ln.size}px ${ln.family}`;
    let met = m.measureText(text);
    if (met.width > T.maxWidth) { // shrink long lines to fit instead of clipping
      ln.size = Math.max(ln === lines[0] ? T.minLine1 : 36, Math.floor(ln.size * T.maxWidth / met.width));
      m.font = `${ln.size}px ${ln.family}`;
      met = m.measureText(text);
    }
    ln.width = met.width;
    ln.height = met.actualBoundingBoxAscent + met.actualBoundingBoxDescent;
    ln.descent = met.actualBoundingBoxDescent;
    let x = 0;
    ln.segs = ln.segments.map((s) => { const seg = { t: s.t, accent: s.accent, x }; x += m.measureText(s.t).width; return seg; });
  }
  const total = lines.reduce((a, l, i) => a + l.height + (i < lines.length - 1 ? T.gap : 0), 0);
  let top = T.centerY - total / 2;
  for (const ln of lines) { ln.base = top + ln.height - ln.descent; top += ln.height + T.gap; }
  titleLines = lines;
}

function drawTitle(c, frame) {
  if (frame < TL.TITLE_IN) return;
  const e = TL.easeOutQuart((frame - TL.TITLE_IN) / TL.ENTER_FRAMES);
  if (e <= 0.002) return;
  const blur = 12 * (1 - e) * SCALE;
  const dy = 40 * (1 - e) * SCALE;
  c.save();
  c.globalAlpha = e;
  c.filter = blur > 0.4 ? `blur(${blur.toFixed(2)}px)` : 'none';
  for (const ln of titleLines) {
    c.font = `${Math.round(ln.size * SCALE)}px ${ln.family}`;
    const x0 = OUT_W / 2 - (ln.width * SCALE) / 2;
    for (const s of ln.segs) {
      c.fillStyle = s.accent ? COL.accent : ln.color;
      c.fillText(s.t, x0 + s.x * SCALE, ln.base * SCALE + dy);
    }
  }
  c.restore();
}

// ---------- frame driver ----------
function compose(frame) {
  const cam = TL.cameraPose(frame);
  camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
  camera.lookAt(cam.look.x, cam.look.y, cam.look.z);
  phone.rotation.set(TL.phonePitch(frame), TL.phoneYaw(frame), 0);
  phone.position.set(0, TL.phoneY(frame), 0);
  renderer.render(scene, camera);

  ctx2d.setTransform(1, 0, 0, 1, 0, 0);
  ctx2d.globalAlpha = 1; ctx2d.filter = 'none';
  ctx2d.drawImage(glCanvas, 0, 0, OUT_W, OUT_H);
  drawTitle(ctx2d, frame);
  const a = TL.fadeAlpha(frame);
  if (a > 0) { ctx2d.save(); ctx2d.globalAlpha = a; ctx2d.fillStyle = '#000'; ctx2d.fillRect(0, 0, OUT_W, OUT_H); ctx2d.restore(); }
}

window.renderFrame = async function (frame) {
  if (!phone) throw new Error('scene not ready');
  compose(frame);
  return canv.toDataURL('image/png').slice('data:image/png;base64,'.length);
};

// ---------- boot: fonts, screenshot, phone, title layout ----------
async function boot() {
  const fonts = { FilmSemiBold: '/assets/fonts/InterDisplay-SemiBold.woff2', FilmMedium: '/assets/fonts/InterDisplay-Medium.woff2' };
  for (const [fam, url] of Object.entries(fonts)) {
    const ff = new FontFace(fam, await (await fetch(url)).arrayBuffer());
    document.fonts.add(ff);
    await ff.load();
  }
  await document.fonts.ready;
  const res = await fetch('/' + C.screenshot.replace(/^\.?\//, ''));
  if (!res.ok) throw new Error(`screenshot not found: ${C.screenshot} (check film.config.js)`);
  const img = new Image();
  img.src = URL.createObjectURL(await res.blob());
  await img.decode();
  const aspect = img.naturalHeight / img.naturalWidth;
  if (aspect < 1.6 || aspect > 2.4) throw new Error(`screenshot is ${img.naturalWidth}x${img.naturalHeight}; use a portrait phone screenshot (height about 2.17 x width)`);
  phone = makePhone(img);
  scene.add(phone);
  layoutTitle();
  window.__ready = true;
}
window.__boot = () => boot().catch((e) => { window.__bootError = String((e && e.stack) || e); });
