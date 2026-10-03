/** Manzara çizimleri: ahşap köprüler, taş kapılar, kıyı köpüğü, ortam parçacıkları, vinyet. */
import { BRIDGE_HALF_WIDTH } from './data.js';

export interface BridgeGeo { ax: number; ay: number; bx: number; by: number; len: number; tGate: number; tExit?: number }

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** hex rengi f oranında açar (f>1) ya da koyulaştırır (f<1) */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

/** köprü: gölge, tahta döşeme, korkuluk, direkler ve fenerler (yalnızca ekrandaki kısım çizilir) */
export function drawBridge(c: CanvasRenderingContext2D, b: BridgeGeo, idx: number, camX: number, camY: number, vw: number, vh: number,
  time: number, locked: boolean, exitLocked = false): void {
  const dx = b.bx - b.ax;
  const dy = b.by - b.ay;
  const ux = dx / b.len;
  const uy = dy / b.len;
  const nx = -uy;
  const ny = ux;
  const half = BRIDGE_HALF_WIDTH;
  // kaba görünürlük: ekran merkezinin köprü doğrusuna uzaklığı
  const mx = camX + vw / 2;
  const my = camY + vh / 2;
  const tt = Math.max(0, Math.min(b.len, (mx - b.ax) * ux + (my - b.ay) * uy));
  if (Math.hypot(mx - (b.ax + ux * tt), my - (b.ay + uy * tt)) > Math.hypot(vw, vh) / 2 + 160) return;
  c.save();
  c.translate(-camX, -camY);
  const ang = Math.atan2(uy, ux);
  // su gölgesi
  c.strokeStyle = 'rgba(0,10,30,0.35)'; c.lineWidth = half * 2 + 26; c.lineCap = 'butt';
  c.beginPath(); c.moveTo(b.ax + 7, b.ay + 11); c.lineTo(b.bx + 7, b.by + 11); c.stroke();
  const PL = 24;
  const view = (x: number, y: number): boolean => x > camX - 80 && x < camX + vw + 80 && y > camY - 80 && y < camY + vh + 80;
  // tahtalar
  const count = Math.floor(b.len / PL);
  const gateLen = b.tGate * b.len;
  const exitLen = (b.tExit ?? 1) * b.len;
  for (let k = 0; k < count; k++) {
    const d = (k + 0.5) * PL;
    const px = b.ax + ux * d;
    const py = b.ay + uy * d;
    if (!view(px, py)) continue;
    const h = hash(k * 3 + idx * 1000);
    const base = 120 + h * 34;
    c.save();
    c.translate(px, py); c.rotate(ang);
    c.fillStyle = `rgb(${base + 18},${base - 18},${base - 62})`;
    c.fillRect(-PL / 2, -half, PL - 1.5, half * 2);
    c.fillStyle = 'rgba(255,225,170,0.10)';
    c.fillRect(-PL / 2, -half, PL - 1.5, 5);
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.fillRect(PL / 2 - 2, -half, 1.5, half * 2);
    // çivi
    c.fillStyle = 'rgba(40,24,12,0.7)';
    c.fillRect(-PL / 2 + 4, -half + 5, 2, 2); c.fillRect(-PL / 2 + 4, half - 7, 2, 2);
    if ((locked && d > gateLen) || (exitLocked && d > exitLen)) { c.fillStyle = 'rgba(25,10,50,0.42)'; c.fillRect(-PL / 2, -half, PL, half * 2); }
    c.restore();
  }
  // korkuluklar
  for (const side of [-1, 1]) {
    const ox = nx * (half - 3) * side;
    const oy = ny * (half - 3) * side;
    c.strokeStyle = '#3d2918'; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(b.ax + ox, b.ay + oy); c.lineTo(b.bx + ox, b.by + oy); c.stroke();
    c.strokeStyle = '#b88c58'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(b.ax + ox, b.ay + oy - 2); c.lineTo(b.bx + ox, b.by + oy - 2); c.stroke();
  }
  // direkler + fenerler
  const POST = 110;
  for (let d = POST / 2; d < b.len; d += POST) {
    const px = b.ax + ux * d;
    const py = b.ay + uy * d;
    if (!view(px, py)) continue;
    const k = Math.round(d / POST);
    for (const side of [-1, 1]) {
      const sx = px + nx * (half - 3) * side;
      const sy = py + ny * (half - 3) * side;
      c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(sx + 3, sy + 6, 8, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a3d22'; c.fillRect(sx - 4, sy - 22, 8, 24);
      c.fillStyle = '#8a6238'; c.fillRect(sx - 4, sy - 22, 3, 24);
      c.fillStyle = '#c9a46a'; c.beginPath(); c.arc(sx, sy - 23, 6, 0, Math.PI * 2); c.fill();
      if ((k + (side > 0 ? 1 : 0)) % 3 === 0) {
        const fl = 0.7 + 0.3 * Math.sin(time * 5 + k * 1.7 + side);
        const g = c.createRadialGradient(sx, sy - 34, 2, sx, sy - 34, 38);
        g.addColorStop(0, `rgba(255,200,110,${0.5 * fl})`); g.addColorStop(1, 'rgba(255,200,110,0)');
        c.fillStyle = g; c.beginPath(); c.arc(sx, sy - 34, 38, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffd98a'; c.beginPath(); c.arc(sx, sy - 34, 4.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#3d2918'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy - 29); c.lineTo(sx, sy - 24); c.stroke();
      }
    }
  }
  c.restore();
}

/** taş kapı: iki kule, kilitliyken demir parmaklık + kırmızı mühür, açılırken parmaklık iner, açıkken yeşil ışık halkası */
export function drawGateArt(c: CanvasRenderingContext2D, gx: number, gy: number, nx: number, ny: number, locked: boolean,
  open: number, time: number, lockIcon: CanvasImageSource | null): void {
  const half = BRIDGE_HALF_WIDTH + 6;
  const glow = locked ? '255,90,90' : '120,255,170';
  const p1 = { x: gx - nx * half, y: gy - ny * half };
  const p2 = { x: gx + nx * half, y: gy + ny * half };
  // zemin mührü
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
  const rg = c.createRadialGradient(gx, gy, 10, gx, gy, half * 1.1);
  rg.addColorStop(0, `rgba(${glow},${0.28 + 0.12 * pulse})`); rg.addColorStop(1, `rgba(${glow},0)`);
  c.fillStyle = rg; c.beginPath(); c.arc(gx, gy, half * 1.1, 0, Math.PI * 2); c.fill();
  // parmaklık (kulelerin arkasında kalacak şekilde önce çizilir)
  const bars = 9;
  const barH = 46 * (1 - open);
  if (barH > 1) {
    for (let k = 0; k < bars; k++) {
      const t = (k + 0.5) / bars;
      const bx = p1.x + (p2.x - p1.x) * t;
      const by = p1.y + (p2.y - p1.y) * t;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(bx - 3, by + 2, 6, 4);
      c.fillStyle = '#2f2f3c'; c.fillRect(bx - 3, by - barH, 6, barH + 4);
      c.fillStyle = '#6d6d86'; c.fillRect(bx - 3, by - barH, 2, barH + 4);
      c.fillStyle = '#9a9ab4'; c.beginPath(); c.moveTo(bx - 4, by - barH); c.lineTo(bx, by - barH - 8); c.lineTo(bx + 4, by - barH); c.fill();
    }
    c.strokeStyle = '#2f2f3c'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(p1.x, p1.y - barH * 0.7); c.lineTo(p2.x, p2.y - barH * 0.7); c.stroke();
    c.strokeStyle = '#6d6d86'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(p1.x, p1.y - barH * 0.7 - 2); c.lineTo(p2.x, p2.y - barH * 0.7 - 2); c.stroke();
    if (open < 0.5) {
      // mühür + kilit
      const lg = c.createRadialGradient(gx, gy - 24, 2, gx, gy - 24, 26);
      lg.addColorStop(0, `rgba(${glow},0.8)`); lg.addColorStop(1, `rgba(${glow},0)`);
      c.fillStyle = lg; c.beginPath(); c.arc(gx, gy - 24, 26, 0, Math.PI * 2); c.fill();
      if (lockIcon) c.drawImage(lockIcon, gx - 14, gy - 40, 28, 28);
      else { c.fillStyle = '#d9c25a'; c.fillRect(gx - 8, gy - 30, 16, 14); }
    }
  }
  // kuleler (y'ye göre sıralı)
  for (const p of [p1, p2].sort((a, b) => a.y - b.y)) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(p.x + 5, p.y + 8, 26, 9, 0, 0, Math.PI * 2); c.fill();
    const g = c.createLinearGradient(p.x - 20, 0, p.x + 20, 0);
    g.addColorStop(0, '#6b6d80'); g.addColorStop(0.45, '#a3a5b8'); g.addColorStop(1, '#52546a');
    c.fillStyle = g; c.fillRect(p.x - 20, p.y - 70, 40, 76);
    c.strokeStyle = 'rgba(30,30,50,0.45)'; c.lineWidth = 1.5;
    for (let r = 0; r < 6; r++) {
      const yy = p.y - 70 + r * 12.5;
      c.beginPath(); c.moveTo(p.x - 20, yy); c.lineTo(p.x + 20, yy); c.stroke();
      const off = r % 2 ? 8 : -2;
      c.beginPath(); c.moveTo(p.x + off, yy); c.lineTo(p.x + off, yy + 12.5); c.stroke();
    }
    c.fillStyle = '#7d7f94'; c.fillRect(p.x - 25, p.y - 80, 50, 12);
    c.fillStyle = '#9c9eb4'; c.fillRect(p.x - 25, p.y - 80, 50, 4);
    // tepe kristali
    const og = c.createRadialGradient(p.x, p.y - 94, 2, p.x, p.y - 94, 24);
    og.addColorStop(0, `rgba(${glow},${0.7 + 0.3 * pulse})`); og.addColorStop(1, `rgba(${glow},0)`);
    c.fillStyle = og; c.beginPath(); c.arc(p.x, p.y - 94, 24, 0, Math.PI * 2); c.fill();
    c.fillStyle = locked ? '#ff6a6a' : '#8bffb0';
    c.beginPath(); c.moveTo(p.x, p.y - 108); c.lineTo(p.x + 8, p.y - 94); c.lineTo(p.x, p.y - 80); c.lineTo(p.x - 8, p.y - 94); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.moveTo(p.x - 2, p.y - 104); c.lineTo(p.x + 3, p.y - 96); c.lineTo(p.x - 3, p.y - 94); c.closePath(); c.fill();
  }
  // açık kapıda yukarı süzülen ışık zerreleri
  if (!locked) {
    for (let k = 0; k < 8; k++) {
      const ph = (time * 0.5 + k / 8) % 1;
      c.fillStyle = `rgba(150,255,190,${0.8 * (1 - ph)})`;
      c.beginPath(); c.arc(gx + Math.sin(k * 2.3 + time) * half * 0.8, gy - ph * 70, 2.2, 0, Math.PI * 2); c.fill();
    }
  }
}

/** ada kıyısı: gölge, kaya/kum kenar, köpük */
export function drawShore(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, time: number, rim: string): void {
  c.fillStyle = 'rgba(0,10,30,0.32)';
  c.beginPath(); c.arc(cx + 10, cy + 16, R + 18, 0, Math.PI * 2); c.fill();
  c.fillStyle = rim;
  c.beginPath(); c.arc(cx, cy, R + 14, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, R + 14, 0, Math.PI * 2); c.stroke();
  // köpük: dalgalanan kesikli halka
  c.lineWidth = 5;
  for (let k = 0; k < 2; k++) {
    c.strokeStyle = `rgba(255,255,255,${0.2 + 0.1 * Math.sin(time * 1.6 + k * 2)})`;
    c.setLineDash([26 + k * 12, 18]);
    c.lineDashOffset = -time * (14 + k * 6) * (k ? -1 : 1);
    c.beginPath(); c.arc(cx, cy, R + 22 + k * 9 + Math.sin(time + k) * 2, 0, Math.PI * 2); c.stroke();
  }
  c.setLineDash([]); c.lineDashOffset = 0;
}

type Kind = 'leaf' | 'firefly' | 'snow' | 'dust' | 'spark' | 'ember' | 'cloud' | 'mist';
const KINDS: Kind[] = ['leaf', 'firefly', 'snow', 'dust', 'spark', 'ember', 'cloud', 'mist']; // biyom sırası

interface P { x: number; y: number; v: number; s: number; ph: number }
/** ortam parçacıkları: her biyomun kendine göre yaprak/ateş böceği/kar/kum/kıvılcım/kor/bulut/sis */
export class Ambient {
  private ps: P[] = [];
  update(dt: number, w: number, h: number): void {
    while (this.ps.length < 46) this.ps.push({ x: Math.random() * w, y: Math.random() * h, v: 0.4 + Math.random(), s: 1 + Math.random() * 3, ph: Math.random() * 6 });
    for (const p of this.ps) { p.ph += dt; }
    void h;
  }
  draw(c: CanvasRenderingContext2D, w: number, h: number, biome: number, time: number): void {
    const kind = KINDS[((biome % 8) + 8) % 8];
    for (const p of this.ps) {
      let x = p.x;
      let y = p.y;
      let col = 'rgba(255,255,255,0.5)';
      let r = p.s;
      switch (kind) {
        case 'leaf': y = (p.y + time * 26 * p.v) % h; x = (p.x + Math.sin(time + p.ph) * 40 - time * 10 * p.v + w * 4) % w; col = 'rgba(160,230,120,0.38)'; r = 1.2 + p.s * 0.45; break;
        case 'firefly': x = p.x + Math.sin(time * 0.6 + p.ph) * 30; y = p.y + Math.cos(time * 0.5 + p.ph) * 22; col = `rgba(255,240,130,${0.2 + 0.7 * Math.max(0, Math.sin(time * 2 + p.ph))})`; break;
        case 'snow': y = (p.y + time * 34 * p.v) % h; x = (p.x + Math.sin(time * 0.8 + p.ph) * 24 + w * 4) % w; col = 'rgba(255,255,255,0.75)'; break;
        case 'dust': x = (p.x + time * 90 * p.v) % w; y = p.y + Math.sin(time + p.ph) * 6; col = 'rgba(230,190,120,0.35)'; r = 1.2; break;
        case 'spark': y = (p.y - time * 22 * p.v + h * 4) % h; x = p.x + Math.sin(time + p.ph) * 12; col = `rgba(190,170,255,${0.3 + 0.6 * Math.max(0, Math.sin(time * 3 + p.ph))})`; break;
        case 'ember': y = (p.y - time * 48 * p.v + h * 4) % h; x = p.x + Math.sin(time * 1.5 + p.ph) * 16; col = 'rgba(255,140,60,0.8)'; r = 1.5 + p.s * 0.5; break;
        case 'cloud': x = (p.x + time * 20 * p.v) % w; y = p.y; col = 'rgba(255,255,255,0.10)'; r = 18 + p.s * 10; break;
        case 'mist': x = (p.x + time * 12 * p.v) % w; y = p.y + Math.sin(time * 0.4 + p.ph) * 14; col = 'rgba(170,90,220,0.10)'; r = 22 + p.s * 8; break;
      }
      c.fillStyle = col;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  }
}

/** ekran kenarlarını karartan vinyet */
export function drawVignette(c: CanvasRenderingContext2D, w: number, h: number): void {
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(5,5,20,0)'); g.addColorStop(1, 'rgba(5,5,20,0.5)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
