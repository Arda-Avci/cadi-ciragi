/**
 * Son düello: Street Fighter tarzı ayrı bir dövüş oyunu.
 * 69. adanın bossu yenilince oyuncu, kendisiyle aynı seviyedeki (aynı can, aynı hasar) yapay zekâ cadıyla yan görünümlü bir arenada dövüşür.
 * Rakibin rengi farklıdır (cadı görselleri ton döndürülerek yeşile çevrilir). 3 turun 2'sini alan kazanır.
 */
import { audio } from './audio.js';
import { T } from './i18n.js';
import { vibrate } from './settings.js';

const W = 960;
const H = 540;
const GROUND = 452;
const GRAVITY = 2000;
const RIVAL_HUE = 150;
const MAX_HP = 100;
const ROUND_TIME = 60;
const FIGHTER_SIZE = 200;

type Move = 'punch' | 'kick' | 'special';
interface MoveDef { dur: number; from: number; to: number; reach: number; dmg: number; stun: number; knock: number }
const MOVES: Record<Exclude<Move, 'special'>, MoveDef> = {
  punch: { dur: 0.3, from: 0.07, to: 0.2, reach: 92, dmg: 7, stun: 0.22, knock: 130 },
  kick: { dur: 0.5, from: 0.15, to: 0.32, reach: 124, dmg: 12, stun: 0.36, knock: 240 },
};
const SPECIAL = { dur: 0.55, spawn: 0.22, cooldown: 2.4, dmg: 14, speed: 540, stun: 0.4 };

interface Fighter {
  x: number; y: number; vx: number; vy: number;
  hp: number; face: 1 | -1;
  move: Move | null; moveT: number; moveHit: boolean;
  stun: number; block: boolean; sp: number; ko: boolean; t: number; flash: number;
  hue: number;
}
interface Bolt { x: number; y: number; vx: number; dmg: number; stun: number; owner: 0 | 1; t: number }
interface Inp { left: boolean; right: boolean; block: boolean }

type Phase = 'intro' | 'fight' | 'roundEnd' | 'over';

export class FightGame {
  private root: HTMLDivElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private running = false;
  private f: [Fighter, Fighter] = [this.make(0), this.make(1)];
  private bolts: Bolt[] = [];
  private inp: Inp = { left: false, right: false, block: false };
  private queued: Move | 'jump' | null = null;
  private phase: Phase = 'intro';
  private phaseT = 0;
  private round = 1;
  private wins: [number, number] = [0, 0];
  private time = ROUND_TIME;
  private msg = '';
  private won = false;
  // yapay zekâ
  private aiT = 0;
  private aiBlock = 0;
  private aiMove: 'approach' | 'back' | 'hold' = 'approach';
  private keys = new Set<string>();
  private onKey = (ev: KeyboardEvent, down: boolean): void => {
    const k = ev.key.toLowerCase();
    const map: Record<string, string> = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'jump', w: 'jump', j: 'punch', k: 'kick', l: 'block', u: 'special', ' ': 'jump' };
    const a = map[k];
    if (!a) return;
    ev.preventDefault();
    if (down) {
      if (this.keys.has(a)) return;
      this.keys.add(a);
      if (a === 'left') this.inp.left = true;
      else if (a === 'right') this.inp.right = true;
      else if (a === 'block') this.inp.block = true;
      else this.queued = a as Move | 'jump';
    } else {
      this.keys.delete(a);
      if (a === 'left') this.inp.left = false;
      else if (a === 'right') this.inp.right = false;
      else if (a === 'block') this.inp.block = false;
    }
  };
  private kd = (e: KeyboardEvent): void => this.onKey(e, true);
  private ku = (e: KeyboardEvent): void => this.onKey(e, false);
  private onDone: ((won: boolean) => void) | null = null;

  constructor(private spr: (name: string) => CanvasImageSource | null, private bg: () => string, private heroName: () => string) {
    this.root = document.createElement('div');
    this.root.style.cssText = 'position:fixed;inset:0;z-index:200;background:#07040f;display:none;touch-action:none;user-select:none;-webkit-user-select:none';
    this.cv = document.createElement('canvas');
    this.cv.width = W; this.cv.height = H;
    this.cv.style.cssText = 'position:absolute;left:50%;top:0;transform:translateX(-50%);height:100%;max-width:100%;object-fit:contain;image-rendering:auto';
    this.root.append(this.cv);
    const ctx = this.cv.getContext('2d');
    if (!ctx) throw new Error('canvas yok');
    this.c = ctx;
    this.buildPad();
    this.cv.addEventListener('pointerdown', () => { if (this.phase === 'over') this.finish(); });
    document.body.append(this.root);
  }

  private make(side: 0 | 1): Fighter {
    return {
      x: side === 0 ? 280 : 680, y: GROUND, vx: 0, vy: 0, hp: MAX_HP, face: side === 0 ? 1 : -1, move: null, moveT: 0, moveHit: false,
      stun: 0, block: false, sp: 0, ko: false, t: 0, flash: 0, hue: side === 0 ? 0 : RIVAL_HUE,
    };
  }

  /** dokunmatik düğmeler: sol altta yön/blok, sağ altta saldırılar */
  private buildPad(): void {
    const mk = (label: string, css: string, down: () => void, up?: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = T(label);
      b.style.cssText = 'position:absolute;width:72px;height:72px;border-radius:50%;border:2px solid rgba(255,255,255,0.4);background:rgba(40,20,80,0.7);color:#fff;font:bold 15px sans-serif;touch-action:none;' + css;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.style.background = 'rgba(140,90,255,0.85)'; down(); });
      const rel = (): void => { b.style.background = 'rgba(40,20,80,0.7)'; up?.(); };
      b.addEventListener('pointerup', rel);
      b.addEventListener('pointercancel', rel);
      this.root.append(b);
      return b;
    };
    mk('◀', 'left:14px;bottom:96px', () => { this.inp.left = true; }, () => { this.inp.left = false; });
    mk('▶', 'left:100px;bottom:96px', () => { this.inp.right = true; }, () => { this.inp.right = false; });
    mk('▲', 'left:57px;bottom:176px', () => { this.queued = 'jump'; });
    mk('Blok', 'left:57px;bottom:14px', () => { this.inp.block = true; }, () => { this.inp.block = false; });
    mk('Yumruk', 'right:100px;bottom:96px', () => { this.queued = 'punch'; });
    mk('Tekme', 'right:14px;bottom:96px', () => { this.queued = 'kick'; });
    mk('Büyü', 'right:57px;bottom:176px', () => { this.queued = 'special'; });
    const quit = document.createElement('button');
    quit.textContent = '✕';
    quit.style.cssText = 'position:absolute;right:10px;top:10px;width:40px;height:40px;border-radius:8px;border:1px solid rgba(255,255,255,0.4);background:rgba(0,0,0,0.5);color:#fff;font:bold 18px sans-serif';
    quit.addEventListener('click', () => { this.won = false; this.finish(); });
    this.root.append(quit);
  }

  /** düelloyu başlatır; bittiğinde onDone(kazandı mı) çağrılır */
  start(onDone: (won: boolean) => void): void {
    if (this.running) return;
    this.onDone = onDone;
    this.root.style.display = 'block';
    this.running = true;
    this.wins = [0, 0];
    this.round = 1;
    this.won = false;
    this.newRound();
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  get active(): boolean { return this.running; }

  private finish(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    this.root.style.display = 'none';
    this.keys.clear();
    this.inp = { left: false, right: false, block: false };
    const cb = this.onDone;
    this.onDone = null;
    cb?.(this.won);
  }

  private newRound(): void {
    this.f = [this.make(0), this.make(1)];
    this.bolts = [];
    this.time = ROUND_TIME;
    this.phase = 'intro';
    this.phaseT = 1.6;
    this.msg = T('TUR') + ' ' + this.round;
    this.queued = null;
    this.aiT = 0.6;
  }

  private loop(now: number): void {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  // ---- savaşçı mantığı ----
  private canAct(f: Fighter): boolean { return !f.ko && f.stun <= 0 && f.move === null; }
  private grounded(f: Fighter): boolean { return f.y >= GROUND; }

  private startMove(f: Fighter, m: Move): void {
    if (!this.canAct(f) || !this.grounded(f)) return;
    if (m === 'special' && f.sp > 0) return;
    f.move = m; f.moveT = 0; f.moveHit = false; f.vx = 0;
    if (m === 'special') f.sp = SPECIAL.cooldown;
    audio.play('cast');
  }

  private hurt(target: Fighter, from: Fighter, dmg: number, stun: number, knock: number): void {
    const blocking = target.block && this.canBlock(target) && Math.sign(from.x - target.x) === target.face;
    if (blocking) {
      target.hp = Math.max(0, target.hp - dmg * 0.15);
      target.vx = -target.face * knock * 0.5;
      audio.play('click');
    } else {
      target.hp = Math.max(0, target.hp - dmg);
      target.stun = stun;
      target.move = null;
      target.vx = Math.sign(target.x - from.x || 1) * knock;
      target.flash = 0.15;
      audio.play('hit');
      if (target === this.f[0]) vibrate(30);
    }
    if (target.hp <= 0) { target.ko = true; target.stun = 99; target.vy = -420; }
  }
  private canBlock(f: Fighter): boolean { return !f.ko && f.stun <= 0 && f.move === null && this.grounded(f); }

  private stepFighter(f: Fighter, other: Fighter, dt: number, dir: number, wantBlock: boolean): void {
    f.t += dt;
    f.flash = Math.max(0, f.flash - dt);
    f.sp = Math.max(0, f.sp - dt);
    if (f.stun > 0 && !f.ko) f.stun = Math.max(0, f.stun - dt);
    f.block = wantBlock && this.canBlock(f);
    if (this.canAct(f) && this.grounded(f) && !f.block) f.vx = dir * 230;
    else if (this.grounded(f)) f.vx *= Math.pow(0.0008, dt); // sürtünme
    if (f.move === null && !f.ko) f.face = other.x >= f.x ? 1 : -1;
    // fizik
    f.x = Math.max(60, Math.min(W - 60, f.x + f.vx * dt));
    f.vy += GRAVITY * dt;
    f.y += f.vy * dt;
    if (f.y >= GROUND) { f.y = GROUND; f.vy = 0; }
    // hamle
    if (f.move) {
      f.moveT += dt;
      if (f.move === 'special') {
        if (!f.moveHit && f.moveT >= SPECIAL.spawn) {
          f.moveHit = true;
          this.bolts.push({ x: f.x + f.face * 60, y: f.y - 95, vx: f.face * SPECIAL.speed, dmg: SPECIAL.dmg, stun: SPECIAL.stun, owner: f === this.f[0] ? 0 : 1, t: 2 });
        }
        if (f.moveT >= SPECIAL.dur) f.move = null;
      } else {
        const md = MOVES[f.move];
        if (!f.moveHit && f.moveT >= md.from && f.moveT <= md.to && !other.ko) {
          const dx = (other.x - f.x) * f.face;
          const dy = Math.abs(other.y - f.y);
          if (dx > -10 && dx < md.reach && dy < 90) { f.moveHit = true; this.hurt(other, f, md.dmg, md.stun, md.knock); }
        }
        if (f.moveT >= md.dur) f.move = null;
      }
    }
  }

  private update(dt: number): void {
    const [p, a] = this.f;
    this.phaseT -= dt;
    if (this.phase === 'intro') {
      if (this.phaseT <= 0) { this.phase = 'fight'; this.msg = T('DÖVÜŞ!'); this.phaseT = 0.8; audio.play('roar'); }
      this.stepFighter(p, a, dt, 0, false); this.stepFighter(a, p, dt, 0, false);
      return;
    }
    if (this.phase === 'fight') {
      if (this.phaseT <= 0) this.msg = '';
      // oyuncu girdisi
      const q = this.queued;
      this.queued = null;
      if (q === 'jump') { if (this.canAct(p) && this.grounded(p)) { p.vy = -760; audio.play('fly'); } }
      else if (q) this.startMove(p, q);
      this.stepFighter(p, a, dt, (this.inp.right ? 1 : 0) - (this.inp.left ? 1 : 0), this.inp.block);
      // yapay zekâ
      const ai = this.think(a, p, dt);
      if (ai.move) this.startMove(a, ai.move);
      if (ai.jump && this.canAct(a) && this.grounded(a)) a.vy = -760;
      this.stepFighter(a, p, dt, ai.dir, ai.block);
      this.separate(p, a);
      this.updateBolts(dt);
      this.time -= dt;
      if (p.ko || a.ko || this.time <= 0) this.endRound();
    } else if (this.phase === 'roundEnd') {
      this.stepFighter(p, a, dt, 0, false); this.stepFighter(a, p, dt, 0, false);
      this.updateBolts(dt);
      if (this.phaseT <= 0) {
        if (this.wins[0] >= 2 || this.wins[1] >= 2) {
          this.won = this.wins[0] >= 2;
          this.phase = 'over';
          this.msg = this.won ? T('ZAFER!') : T('Yenildin');
        } else { this.round++; this.newRound(); }
      }
    }
  }

  /** savaşçılar iç içe geçmesin */
  private separate(p: Fighter, a: Fighter): void {
    const gap = a.x - p.x;
    const min = 64;
    if (Math.abs(gap) >= min || Math.abs(p.y - a.y) > 70) return;
    const push = (min - Math.abs(gap)) / 2;
    const dir = gap >= 0 ? 1 : -1;
    p.x = Math.max(60, p.x - dir * push);
    a.x = Math.min(W - 60, a.x + dir * push);
  }

  private endRound(): void {
    const [p, a] = this.f;
    let w = -1;
    if (p.hp > a.hp) w = 0; else if (a.hp > p.hp) w = 1;
    if (w >= 0) this.wins[w as 0 | 1]++;
    else { this.wins[0]++; this.wins[1]++; }
    this.msg = p.ko || a.ko ? 'K.O.' : T('SÜRE DOLDU');
    this.phase = 'roundEnd';
    this.phaseT = 2.2;
    audio.play(w === 0 ? 'boss' : 'kill');
  }

  private updateBolts(dt: number): void {
    for (const b of this.bolts) {
      b.t -= dt;
      b.x += b.vx * dt;
      const tgt = this.f[b.owner === 0 ? 1 : 0];
      const src = this.f[b.owner];
      if (tgt.ko) continue;
      if (Math.abs(b.x - tgt.x) < 40 && Math.abs(b.y - (tgt.y - 90)) < 90) {
        b.t = 0;
        this.hurt(tgt, src, b.dmg, b.stun, 200);
      }
    }
    // iki büyü çarpışırsa birbirini yok eder
    for (const b of this.bolts) for (const o of this.bolts) if (b !== o && b.owner !== o.owner && Math.abs(b.x - o.x) < 30) { b.t = 0; o.t = 0; }
    this.bolts = this.bolts.filter((b) => b.t > 0 && b.x > -40 && b.x < W + 40);
  }

  /** rakip cadının yapay zekâsı: oyuncuyla aynı can/hasar; kararları kısa tepki süresiyle verir */
  private think(a: Fighter, p: Fighter, dt: number): { dir: number; block: boolean; move: Move | null; jump: boolean } {
    const out = { dir: 0, block: false, move: null as Move | null, jump: false };
    if (!this.canAct(a)) { this.aiBlock = 0; return out; }
    const dx = p.x - a.x;
    const dist = Math.abs(dx);
    const toward = Math.sign(dx);
    this.aiBlock = Math.max(0, this.aiBlock - dt);
    if (this.aiBlock > 0) { out.block = true; return out; }
    this.aiT -= dt;
    // gelen büyü: bazen blok, bazen zıpla
    const inc = this.bolts.find((b) => b.owner === 0 && Math.sign(a.x - b.x) === Math.sign(b.vx) && Math.abs(a.x - b.x) < 230);
    if (inc && this.aiT <= 0) {
      this.aiT = 0.25;
      if (Math.random() < 0.45) { this.aiBlock = 0.5; out.block = true; return out; }
      if (Math.random() < 0.35) { out.jump = true; return out; }
    }
    // oyuncu saldırıyorsa menzildeyken blokla
    if (p.move && p.move !== 'special' && dist < 150 && this.aiT <= 0 && Math.random() < 0.4) { this.aiT = 0.3; this.aiBlock = 0.45; out.block = true; return out; }
    if (this.aiT <= 0) {
      this.aiT = 0.22 + Math.random() * 0.3;
      if (dist > 300 && a.sp <= 0 && Math.random() < 0.55) { out.move = 'special'; return out; }
      if (dist > 125) this.aiMove = 'approach';
      else {
        const r = Math.random();
        if (r < 0.46) { out.move = 'punch'; this.aiT = 0.4 + Math.random() * 0.3; }
        else if (r < 0.74) { out.move = 'kick'; this.aiT = 0.55 + Math.random() * 0.3; }
        else if (r < 0.88) this.aiMove = 'back';
        else this.aiMove = 'hold';
      }
      if (out.move) return out;
    }
    out.dir = this.aiMove === 'approach' ? toward : this.aiMove === 'back' ? -toward : 0;
    if (this.aiMove === 'back' && dist > 220) this.aiMove = 'approach';
    return out;
  }

  // ---- çizim ----
  private drawFighter(f: Fighter): void {
    const c = this.c;
    let frame = 'witch';
    const has = (n: string): boolean => !!this.spr(n);
    if (f.ko || f.stun > 0) frame = has('witch_cast1') ? 'witch_cast1' : 'witch';
    else if (!this.grounded(f)) frame = has('witch_fly1') ? (Math.floor(f.t * 6) % 2 ? 'witch_fly2' : 'witch_fly1') : 'witch';
    else if (f.move) frame = has('witch_cast2') && has('witch_cast1') ? (f.moveT > 0.12 ? 'witch_cast2' : 'witch_cast1') : 'witch';
    else if (Math.abs(f.vx) > 20 && has('witch_walk4')) frame = 'witch_walk' + (1 + (Math.floor(f.t * 9) % 4));
    c.fillStyle = 'rgba(0,0,0,0.35)';
    const sh = 1 - Math.min(0.6, (GROUND - f.y) / 300);
    c.beginPath(); c.ellipse(f.x, GROUND + 4, 56 * sh, 12 * sh, 0, 0, Math.PI * 2); c.fill();
    const img = this.spr(f.hue ? frame + '@' + f.hue : frame);
    c.save();
    c.translate(f.x, f.y);
    if (f.ko) c.rotate(f.face * -1.3 * Math.min(1, f.t * 0.6));
    c.scale(f.face, 1);
    // saldırı hamlesi: öne eğilir
    if (f.move) c.rotate(0.12 * Math.sin(Math.min(1, f.moveT / 0.25) * Math.PI));
    if (f.flash > 0 && 'filter' in c) c.filter = 'brightness(2.4) saturate(0.6)';
    if (img) c.drawImage(img, -FIGHTER_SIZE / 2, -FIGHTER_SIZE * 0.9, FIGHTER_SIZE, FIGHTER_SIZE);
    else { c.fillStyle = f.hue ? '#2fbf6a' : '#7a4fd0'; c.fillRect(-30, -150, 60, 150); }
    c.restore();
    if (f.move && f.move !== 'special') {
      // vuruş izi
      const md = MOVES[f.move];
      if (f.moveT >= md.from && f.moveT <= md.to + 0.06) {
        c.strokeStyle = f.move === 'kick' ? 'rgba(255,200,120,0.85)' : 'rgba(255,255,255,0.85)';
        c.lineWidth = f.move === 'kick' ? 9 : 6;
        c.beginPath(); c.arc(f.x + f.face * md.reach * 0.55, f.y - (f.move === 'kick' ? 50 : 100), md.reach * 0.4, f.face > 0 ? -1 : Math.PI - 1, f.face > 0 ? 1 : Math.PI + 1); c.stroke();
      }
    }
    if (f.block) {
      c.strokeStyle = 'rgba(120,220,255,0.8)'; c.lineWidth = 5;
      c.beginPath(); c.arc(f.x + f.face * 36, f.y - 90, 70, f.face > 0 ? -1.2 : Math.PI - 1.2, f.face > 0 ? 1.2 : Math.PI + 1.2); c.stroke();
    }
  }

  private bar(x: number, w: number, hp: number, right: boolean, name: string, wins: number): void {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - 3, 17, w + 6, 30);
    const k = Math.max(0, hp) / MAX_HP;
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, k > 0.3 ? '#5fe07a' : '#ff5a5a'); g.addColorStop(1, k > 0.3 ? '#c8ff6b' : '#ff9a5a');
    c.fillStyle = g;
    if (right) c.fillRect(x + w * (1 - k), 20, w * k, 24); else c.fillRect(x, 20, w * k, 24);
    c.font = 'bold 16px sans-serif'; c.textAlign = right ? 'right' : 'left';
    c.fillStyle = '#fff'; c.fillText(name, right ? x + w : x, 66);
    for (let i = 0; i < 2; i++) {
      c.fillStyle = i < wins ? '#ffd84a' : 'rgba(255,255,255,0.25)';
      c.beginPath(); c.arc(right ? x + w - 10 - i * 22 : x + 10 + i * 22, 82, 7, 0, Math.PI * 2); c.fill();
    }
  }

  private draw(): void {
    const c = this.c;
    // arena
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0620'); g.addColorStop(0.7, this.bg()); g.addColorStop(1, '#05030c');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // uzaktaki ay ve siluet
    c.fillStyle = 'rgba(255,240,200,0.9)'; c.beginPath(); c.arc(780, 110, 46, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 9; i++) { const bx = i * 130 - 20; c.beginPath(); c.moveTo(bx, GROUND); c.lineTo(bx + 60, GROUND - 120 - ((i * 37) % 70)); c.lineTo(bx + 120, GROUND); c.fill(); }
    c.fillStyle = '#1a1030'; c.fillRect(0, GROUND, W, H - GROUND);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, GROUND, W, 3);
    const [p, a] = this.f;
    // arkadakini önce çiz: ayakta olan öne
    this.drawFighter(a); this.drawFighter(p);
    for (const b of this.bolts) {
      const col = b.owner === 0 ? '200,170,255' : '120,255,170';
      const gr = c.createRadialGradient(b.x, b.y, 4, b.x, b.y, 38);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.4, `rgba(${col},0.7)`); gr.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(b.x, b.y, 38, 0, Math.PI * 2); c.fill();
    }
    // HUD
    this.bar(30, 380, p.hp, false, this.heroName(), this.wins[0]);
    this.bar(550, 380, a.hp, true, T('Rakip Cadı'), this.wins[1]);
    c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
    c.fillText(String(Math.max(0, Math.ceil(this.time))), W / 2, 50);
    c.font = 'bold 13px sans-serif'; c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fillText(T('Büyü') + ' ' + (p.sp > 0 ? p.sp.toFixed(1) + ' sn' : T('hazır')), 220, 100);
    if (this.msg) {
      c.font = 'bold 64px sans-serif'; c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,0.8)';
      c.strokeText(this.msg, W / 2, 250); c.fillStyle = '#ffd84a'; c.fillText(this.msg, W / 2, 250);
    }
    if (this.phase === 'over') {
      c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff';
      c.fillText(this.won ? T('Dokun: devam') : T('Dokun: çık (kaleye dönünce tekrar denersin)'), W / 2, 310);
    }
  }
}
