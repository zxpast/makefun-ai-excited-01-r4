// The Whale Came for the Moon — a joyful whale leaping toward the moon.
// Pure Node standard library: a small software rasterizer draws the whole
// night scene into an RGBA buffer, then a hand-rolled PNG encoder writes it.
// No image assets, no dependencies, deterministic output.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const HORIZON = 700;
const MOON_X = 770;
const MOON_Y = 215;
const MOON_R = 105;

// ---------- deterministic random ----------
let seed = 20261117;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function rr(a: number, b: number): number {
  return a + rnd() * (b - a);
}

// ---------- framebuffer ----------
const fb = new Uint8Array(W * H * 4);

function blend(x: number, y: number, r: number, g: number, b: number, a: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H || a <= 0) return;
  if (a > 1) a = 1;
  const i = (yi * W + xi) * 4;
  const ia = 1 - a;
  fb[i] = r * a + fb[i] * ia;
  fb[i + 1] = g * a + fb[i + 1] * ia;
  fb[i + 2] = b * a + fb[i + 2] * ia;
  fb[i + 3] = 255;
}

type RGB = [number, number, number];

function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t,
  ];
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, r: number, g: number, b: number, a: number): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) blend(x, y, r, g, b, a);
    }
  }
}

function fillCircle(cx: number, cy: number, rad: number, r: number, g: number, b: number, a: number): void {
  fillEllipse(cx, cy, rad, rad, r, g, b, a);
}

function fillPoly(pts: Array<[number, number]>, r: number, g: number, b: number, a: number): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
        xs.push(p1[0] + ((y - p1[1]) * (p2[0] - p1[0])) / (p2[1] - p1[1]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]));
      const xb = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = xa; x <= xb; x++) blend(x, y, r, g, b, a);
    }
  }
}

function thickLine(x1: number, y1: number, x2: number, y2: number, w: number, r: number, g: number, b: number, a: number): void {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.ceil(d));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    fillEllipse(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, w, w, r, g, b, a);
  }
}

// ---------- sky ----------
const skyStops: Array<[number, RGB]> = [
  [0, [9, 13, 44]],
  [0.45, [22, 34, 79]],
  [0.68, [44, 42, 94]],
  [1, [76, 44, 94]],
];
for (let y = 0; y < HORIZON; y++) {
  const t = y / HORIZON;
  let c: RGB = skyStops[0][1];
  for (let s = 0; s < skyStops.length - 1; s++) {
    if (t >= skyStops[s][0] && t <= skyStops[s + 1][0]) {
      const lt = (t - skyStops[s][0]) / (skyStops[s + 1][0] - skyStops[s][0]);
      c = mix(skyStops[s][1], skyStops[s + 1][1], lt);
      break;
    }
  }
  for (let x = 0; x < W; x++) blend(x, y, c[0], c[1], c[2], 1);
}

// moon halo, painted before the disc so the disc stays crisp
for (let y = MOON_Y - 300; y <= MOON_Y + 300; y++) {
  for (let x = MOON_X - 300; x <= MOON_X + 300; x++) {
    const d = Math.hypot(x - MOON_X, y - MOON_Y);
    if (d > MOON_R && d < 300) {
      blend(x, y, 255, 232, 170, 0.26 * (1 - (d - MOON_R) / 195));
    }
  }
}

// ---------- stars ----------
for (let i = 0; i < 250; i++) {
  const x = rr(0, W);
  const y = rr(0, 660);
  const br = rr(0.3, 1);
  const rad = br > 0.92 ? 2.2 : 1.2;
  fillCircle(x, y, rad, 255, 250, 230, br);
}
// a few bright stars get a four-point sparkle
for (let i = 0; i < 9; i++) {
  const x = rr(40, 980);
  const y = rr(30, 480);
  const L = rr(5, 9);
  thickLine(x - L, y, x + L, y, 1, 255, 250, 225, 0.9);
  thickLine(x, y - L, x, y + L, 1, 255, 250, 225, 0.9);
  fillCircle(x, y, 2.4, 255, 252, 235, 1);
}

// shooting star, top left, heading down-right
for (let i = 0; i <= 14; i++) {
  const t = i / 14;
  const x = 150 + 150 * t;
  const y = 88 + 88 * t;
  fillCircle(x, y, 3.2 * (1 - t) + 0.8, 255, 246, 220, 0.9 * (1 - t * 0.8));
}
fillCircle(300, 176, 3.6, 255, 250, 230, 1);

// three small birds crossing the sky
const birds: Array<[number, number]> = [[205, 148], [262, 118], [322, 168]];
for (const b of birds) {
  thickLine(b[0] - 9, b[1] + 4, b[0], b[1], 1.6, 12, 14, 30, 0.85);
  thickLine(b[0], b[1], b[0] + 9, b[1] + 4, 1.6, 12, 14, 30, 0.85);
}

// ---------- the moon ----------
fillCircle(MOON_X, MOON_Y, MOON_R, 255, 248, 220, 1);
fillCircle(MOON_X - 26, MOON_Y - 18, 20, 232, 216, 178, 0.55);
fillCircle(MOON_X + 30, MOON_Y + 26, 14, 232, 216, 178, 0.5);
fillCircle(MOON_X + 8, MOON_Y - 42, 11, 235, 220, 182, 0.5);
fillCircle(MOON_X - 48, MOON_Y + 34, 9, 235, 220, 182, 0.45);
fillCircle(MOON_X + 52, MOON_Y - 30, 7, 235, 220, 182, 0.45);

// ---------- ocean ----------
const seaStops: Array<[number, RGB]> = [
  [0, [22, 41, 77]],
  [1, [7, 14, 34]],
];
for (let y = HORIZON; y < H; y++) {
  const t = (y - HORIZON) / (H - HORIZON);
  const c = mix(seaStops[0][1], seaStops[1][1], t);
  for (let x = 0; x < W; x++) blend(x, y, c[0], c[1], c[2], 1);
}

// moonlight path: shimmering gold dashes under the moon
for (let i = 0; i < 110; i++) {
  const x = MOON_X + rr(-85, 125);
  const y = HORIZON + rr(4, 300);
  const len = rr(18, 72);
  const a = rr(0.1, 0.34) * (1 - (y - HORIZON) / 420);
  thickLine(x - len / 2, y, x + len / 2, y, 2, 255, 214, 120, Math.max(0.03, a));
}

// gentle wave bands
for (let k = 0; k < 16; k++) {
  const y0 = HORIZON + 16 + k * 18;
  const a = 0.05 + 0.05 * rnd();
  for (let x = 0; x < W; x += 6) {
    const y = y0 + 4 * Math.sin(x * 0.012 + k * 1.7);
    fillCircle(x, y, 2.2, 140, 180, 220, a);
  }
}

// ---------- the whale ----------
// Local space: tail at x=0, head at x=510. Rotated -35 degrees so the head
// rises up-right toward the moon while the tail skims the water.
const WX = 430;
const WY = 560;
const ANG = (-35 * Math.PI) / 180;
const COS = Math.cos(ANG);
const SIN = Math.sin(ANG);
const PIVX = 260;
const PIVY = 0;

function X(lx: number, ly: number): [number, number] {
  const dx = lx - PIVX;
  const dy = ly - PIVY;
  return [WX + dx * COS - dy * SIN, WY + dx * SIN + dy * COS];
}
function xPoly(pts: Array<[number, number]>): Array<[number, number]> {
  return pts.map((p) => X(p[0], p[1]));
}

// tail flukes first (behind the body)
fillPoly(
  xPoly([
    [-6, -4],
    [-96, -72],
    [-72, 4],
  ]),
  40, 66, 96, 1,
);
fillPoly(
  xPoly([
    [-6, 4],
    [-96, 72],
    [-72, -4],
  ]),
  40, 66, 96, 1,
);

// body: upper outline tail -> head, then lower outline head -> tail
const bodyPts: Array<[number, number]> = [
  [0, -6], [60, -26], [160, -55], [280, -82], [390, -88], [470, -62], [498, -44], [510, -20],
  [510, 22], [500, 38], [460, 58], [360, 84], [250, 88], [150, 70], [60, 34], [0, 8],
];
fillPoly(xPoly(bodyPts), 46, 74, 107, 1);

// pale belly patch along the lower body
const bellyPts: Array<[number, number]> = [
  [150, 55], [260, 82], [380, 78], [470, 40],
  [480, 55], [380, 90], [250, 92], [150, 70],
];
fillPoly(xPoly(bellyPts), 207, 227, 238, 0.92);

// pectoral fin
fillPoly(
  xPoly([
    [300, 55],
    [350, 135],
    [395, 60],
  ]),
  40, 66, 96, 1,
);

// eye + highlight, near the head
const eye = X(455, -30);
fillCircle(eye[0], eye[1], 8, 8, 10, 18, 1);
fillCircle(eye[0] - 3, eye[1] - 3, 2.6, 255, 255, 255, 0.95);

// a happy little smile
const s1 = X(465, 8);
const s2 = X(488, 20);
const s3 = X(505, 26);
thickLine(s1[0], s1[1], s2[0], s2[1], 2.4, 10, 14, 26, 0.9);
thickLine(s2[0], s2[1], s3[0], s3[1], 2.4, 10, 14, 26, 0.9);

// blowhole
const bh = X(430, -78);
fillCircle(bh[0] - 4, bh[1], 3, 12, 18, 30, 1);
fillCircle(bh[0] + 4, bh[1], 3, 12, 18, 30, 1);

// spout: droplets arcing up from the blowhole
for (let k = 0; k <= 16; k++) {
  const t = k / 16;
  const sx = bh[0] - 52 * t + rr(-5, 5);
  const sy = bh[1] - 150 * Math.sin(t * Math.PI * 0.92) + rr(-4, 4);
  fillCircle(sx, sy, rr(2, 5.5), 223, 243, 255, 0.75);
}
thickLine(bh[0], bh[1] - 6, bh[0] - 18, bh[1] - 62, 2, 223, 243, 255, 0.5);
thickLine(bh[0], bh[1] - 6, bh[0] + 4, bh[1] - 74, 2, 223, 243, 255, 0.45);

// ---------- splash where the whale leaves the water ----------
fillEllipse(330, 706, 185, 13, 240, 248, 255, 0.32);
fillEllipse(430, 713, 120, 10, 240, 248, 255, 0.26);
fillEllipse(215, 716, 95, 9, 240, 248, 255, 0.3);
for (let i = 0; i < 46; i++) {
  const x = rr(190, 540);
  const y = rr(636, 700);
  fillCircle(x, y, rr(2, 6), 235, 244, 252, rr(0.5, 0.9));
}

// ---------- vignette ----------
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2);
    const dy = (y - H / 2) / (H / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    const dark = d > 0.72 ? (d - 0.72) * 0.5 : 0;
    const i = (y * W + x) * 4;
    fb[i] = Math.max(0, Math.min(255, fb[i] * (1 - dark)));
    fb[i + 1] = Math.max(0, Math.min(255, fb[i + 1] * (1 - dark)));
    fb[i + 2] = Math.max(0, Math.min(255, fb[i + 2] * (1 - dark)));
    fb[i + 3] = 255;
  }
}

// ---------- PNG encoder (pure stdlib) ----------
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

const raw = Buffer.alloc(H * (1 + W * 4));
const fbb = Buffer.from(fb.buffer, fb.byteOffset, fb.byteLength);
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  fbb.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', deflateSync(raw, { level: 9 })),
  pngChunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
console.log('wrote entry.png', png.length, 'bytes');
