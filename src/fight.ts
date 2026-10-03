/**
 * Arena / son düello: Street Fighter tarzı ayrı bir dövüş oyunu (yan görünüm, 3 turun 2'si).
 * - Savaşçılar kodla çizilen iskeletli çizgi film cadılardır: yumruk, tekme, büyü (asa), blok, darbe, yenilgi ve zafer animasyonları vardır.
 * - Yön tuşları yoktur: savaşçı rakibe kendiliğinden yaklaşır (menzil kurar); oyuncu yalnızca Yumruk / Tekme / Büyü / Blok'a basar.
 * - Arka plan seyirciyle dolu fantezi arenadır (assets/arena_bg.jpg); ön planda zıplayan seyirci siluetleri, vuruş kıvılcımları, ekran sarsıntısı,
 *   vuruş duraklaması, kombo sayacı ve K.O. ağır çekimi vardır.
 * Rakip yapay zekâ oyuncuyla aynı can ve hasara sahiptir; rengi farklıdır.
 */
import { audio } from './audio.js';
import { T } from './i18n.js';
import { vibrate } from './settings.js';
import { FightMod, RIVAL_HUE } from './meta.js';

const W = 960;
const H = 540;
const GROUND = 456;
const MAX_HP = 100;
const ROUND_TIME = 60;
const ENGAGE = 118;       // kendiliğinden yaklaşma menzili (merkezler arası)

type Move = 'punch' | 'kick' | 'special';
interface MoveDef { dur: number; from: number; to: number; reach: number; dmg: number; stun: number; knock: number; lunge: number; chain: number }
const MOVES: Record<Exclude<Move, 'special'>, MoveDef> = {
  punch: { dur: 0.32, from: 0.09, to: 0.2, reach: 100, dmg: 7, stun: 0.24, knock: 140, lunge: 150, chain: 0.6 },
  kick: { dur: 0.52, from: 0.17, to: 0.34, reach: 134, dmg: 12, stun: 0.38, knock: 260, lunge: 110, chain: 0.72 },
};
const SPECIAL = { dur: 0.6, spawn: 0.24, cooldown: 2.4, dmg: 14, speed: 560, stun: 0.42 };

interface Fighter {
  x: number; y: number; vx: number;
  hp: number; face: 1 | -1;
  move: Move | null; moveT: number; moveHit: boolean;
  stun: number; block: boolean; sp: number; ko: boolean; t: number; flash: number;
  hue: number; side: 0 | 1; walk: number; hurtT: number; win: boolean;
}
interface Bolt { x: number; y: number; vx: number; dmg: number; stun: number; owner: 0 | 1; t: number }
interface Spark { x: number; y: number; t: number; max: number; big: boolean }
interface Inp { block: boolean }

/** düello ayarları: rakip adı/rengi/ustalığı (0..1), haftalık kural ve oyuncunun cadı rengi */
export interface FightOpts { foeName: string; foeHue: number; level: number; mod: FightMod; playerHue: number; modTitle?: string }
const FINAL_OPTS: FightOpts = { foeName: 'Rakip Cadı', foeHue: RIVAL_HUE, level: 1, mod: 'none', playerHue: 0 };

type Phase = 'intro' | 'fight' | 'roundEnd' | 'over';

// ---- iskelet pozları ----
interface Pose {
  lean: number; bob: number; head: number; crouch: number;
  fa: [number, number]; ba: [number, number]; fl: [number, number]; bl: [number, number];
  staff: number; glow: number;
}
const ease = (k: number): number => k * k * (3 - 2 * k);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const mix2 = (a: [number, number], b: [number, number], k: number): [number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  lean: lerp(a.lean, b.lean, k), bob: lerp(a.bob, b.bob, k), head: lerp(a.head, b.head, k), crouch: lerp(a.crouch, b.crouch, k),
  fa: mix2(a.fa, b.fa, k), ba: mix2(a.ba, b.ba, k), fl: mix2(a.fl, b.fl, k), bl: mix2(a.bl, b.bl, k), staff: lerp(a.staff, b.staff, k), glow: lerp(a.glow, b.glow, k),
});
const GUARD: Pose = { lean: 0.04, bob: 0, head: 0, crouch: 0, fa: [0.55, 1.65], ba: [0.15, 1.9], fl: [0.25, -0.2], bl: [-0.28, 0.15], staff: -0.2, glow: 0 };

function poseOf(f: Fighter): Pose {
  const p: Pose = { ...GUARD, fa: [...GUARD.fa], ba: [...GUARD.ba], fl: [...GUARD.fl], bl: [...GUARD.bl] };
  const br = Math.sin(f.t * 3.2);
  if (f.ko) {
    const k = Math.min(1, f.t * 0.9);
    return { ...p, lean: -1.45 * ease(k), bob: 0, head: -0.4, crouch: 12 * k, fa: [-0.6, 0.6], ba: [-0.9, 0.4], fl: [0.5, 0.3], bl: [0.2, 0.5], staff: -1.2, glow: 0 };
  }
  if (f.win) {
    const j = Math.abs(Math.sin(f.t * 5));
    return { ...p, lean: -0.05, bob: -j * 12, head: 0.1, fa: [2.5, 0.2], ba: [-2.5, -0.2], fl: [0.15, 0], bl: [-0.15, 0], staff: 0.4, glow: 0.4 };
  }
  if (f.stun > 0 && f.hurtT > 0) {
    const k = Math.min(1, f.hurtT / 0.2);
    return { ...p, lean: -0.38 * k, head: -0.35 * k, bob: 2, crouch: 6 * k, fa: [-0.5, 1.2], ba: [-0.2, 1.4], fl: [0.35, 0.3], bl: [-0.45, 0.3], staff: -0.5, glow: 0 };
  }
  if (f.block) return { ...p, lean: -0.05, crouch: 10, fa: [1.0, 2.1], ba: [0.9, 2.3], fl: [0.25, 0.3], bl: [-0.3, 0.3], staff: -0.3, glow: 0 };
  if (f.move === 'punch') {
    const k = f.moveT / MOVES.punch.dur;
    const wind: Pose = { ...p, lean: -0.1, fa: [-0.9, 2.0], ba: [0.2, 1.9], fl: [0.35, 0.2], bl: [-0.35, 0.2] };
    const hit: Pose = { ...p, lean: 0.22, crouch: 3, fa: [1.52, 0.04], ba: [-0.2, 1.6], fl: [0.55, 0.1], bl: [-0.55, 0.3], head: 0.06 };
    if (k < 0.28) return mixPose(p, wind, ease(k / 0.28));
    if (k < 0.55) return mixPose(wind, hit, ease((k - 0.28) / 0.27));
    return mixPose(hit, p, ease(Math.min(1, (k - 0.55) / 0.45)));
  }
  if (f.move === 'kick') {
    const k = f.moveT / MOVES.kick.dur;
    const wind: Pose = { ...p, lean: -0.16, fa: [-0.5, 1.7], ba: [0.3, 1.8], fl: [-0.2, 1.6], bl: [-0.15, 0.2] };
    const hit: Pose = { ...p, lean: -0.34, crouch: 2, fa: [-0.9, 1.4], ba: [1.0, 1.3], fl: [1.52, 0.05], bl: [-0.1, 0.05] };
    if (k < 0.32) return mixPose(p, wind, ease(k / 0.32));
    if (k < 0.6) return mixPose(wind, hit, ease((k - 0.32) / 0.28));
    return mixPose(hit, p, ease(Math.min(1, (k - 0.6) / 0.4)));
  }
  if (f.move === 'special') {
    const k = Math.min(1, f.moveT / SPECIAL.dur);
    const cast: Pose = { ...p, lean: 0.12, crouch: 4, fa: [1.45, 0.2], ba: [1.3, 0.35], fl: [0.5, 0.1], bl: [-0.5, 0.2], staff: 1.45, glow: 1 };
    const wind: Pose = { ...p, lean: -0.12, fa: [-0.6, 1.9], ba: [-0.3, 1.9], staff: -0.2, glow: 0.3 };
    if (k < 0.3) return mixPose(p, wind, ease(k / 0.3));
    if (k < 0.5) return mixPose(wind, cast, ease((k - 0.3) / 0.2));
    return mixPose(cast, p, ease((k - 0.5) / 0.5));
  }
  if (Math.abs(f.vx) > 20) {
    const s = Math.sin(f.walk * 9);
    return { ...p, bob: -Math.abs(s) * 4, lean: 0.1, fl: [0.25 + s * 0.6, 0.2 + Math.max(0, -s) * 0.5], bl: [-0.25 - s * 0.6, 0.2 + Math.max(0, s) * 0.5], fa: [0.55 - s * 0.2, 1.65], ba: [0.15 + s * 0.2, 1.9] };
  }
  return { ...p, bob: br * 1.6, head: br * 0.03, fa: [0.55 + br * 0.03, 1.65], ba: [0.15, 1.9 + br * 0.04] };
}

const hsl = (h: number, s: number, l: number): string => `hsl(${((h % 360) + 360) % 360},${s}%,${l}%)`;

export class FightGame {
  private root: HTMLDivElement;
  private cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private running = false;
  private o: FightOpts = FINAL_OPTS;
  private f: [Fighter, Fighter] = [this.make(0), this.make(1)];
  private bolts: Bolt[] = [];
  private sparks: Spark[] = [];
  private inp: Inp = { block: false };
  private queued: Move | null = null;
  private queuedT = 0;
  private phase: Phase = 'intro';
  private phaseT = 0;
  private round = 1;
  private wins: [number, number] = [0, 0];
  private time = ROUND_TIME;
  private msg = '';
  private won = false;
  private freeze = 0;
  private slow = 0;
  private shake = 0;
  private combo = 0;
  private comboT = 0;
  private clock = 0;
  private bgImg: HTMLImageElement | null = null;
  // yapay zekâ
  private aiT = 0;
  private aiBlock = 0;
  private aiMove: 'approach' | 'back' | 'hold' = 'approach';
  private keys = new Set<string>();
  private onKey = (ev: KeyboardEvent, down: boolean): void => {
    const k = ev.key.toLowerCase();
    const map: Record<string, string> = { j: 'punch', k: 'kick', l: 'block', u: 'special', ' ': 'punch', z: 'punch', x: 'kick', c: 'special', v: 'block' };
    const a = map[k];
    if (!a) return;
    ev.preventDefault();
    if (down) {
      if (this.keys.has(a)) return;
      this.keys.add(a);
      if (a === 'block') this.inp.block = true;
      else this.press(a as Move);
    } else {
      this.keys.delete(a);
      if (a === 'block') this.inp.block = false;
    }
  };
  private kd = (e: KeyboardEvent): void => this.onKey(e, true);
  private ku = (e: KeyboardEvent): void => this.onKey(e, false);
  private onDone: ((won: boolean) => void) | null = null;

  constructor(_spr: (name: string) => CanvasImageSource | null, private bg: () => string, private heroName: () => string) {
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
    if (!window.matchMedia('(pointer: coarse)').matches) {
      const hint = document.createElement('div');
      hint.textContent = T('J: yumruk · K: tekme · U: büyü · L: blok');
      hint.style.cssText = 'position:absolute;left:50%;bottom:10px;transform:translateX(-50%);color:rgba(255,255,255,.65);font:13px sans-serif;pointer-events:none;white-space:nowrap;text-shadow:0 1px 3px #000';
      this.root.append(hint);
    }
    this.cv.addEventListener('pointerdown', () => { if (this.phase === 'over') this.finish(); });
    document.body.append(this.root);
    const img = new Image();
    img.onload = () => { this.bgImg = img; };
    img.onerror = () => { this.bgImg = null; };
    img.src = 'assets/arena_bg.jpg';
  }

  private make(side: 0 | 1): Fighter {
    return {
      x: side === 0 ? 300 : 660, y: GROUND, vx: 0, hp: this.o.mod === 'lowhp' ? MAX_HP * 0.4 : MAX_HP, face: side === 0 ? 1 : -1, move: null, moveT: 0, moveHit: false,
      stun: 0, block: false, sp: 0, ko: false, t: 0, flash: 0, hue: side === 0 ? this.o.playerHue : this.o.foeHue, side, walk: 0, hurtT: 0, win: false,
    };
  }

  /** dokunmatik düğmeler (yön tuşu yok): sağ altta saldırılar, sol altta blok */
  private buildPad(): void {
    const mk = (label: string, sub: string, css: string, size: number, down: () => void, up?: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.innerHTML = `<span style="font-size:${Math.round(size * 0.36)}px;line-height:1">${sub}</span><span style="font-size:${Math.round(size * 0.17)}px">${T(label)}</span>`;
      b.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,0.55);background:radial-gradient(circle at 35% 30%,rgba(150,100,255,0.85),rgba(50,20,100,0.85));color:#fff;font:bold 15px sans-serif;touch-action:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:0 4px 14px rgba(0,0,0,.55);` + css;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.style.filter = 'brightness(1.5)'; down(); });
      const rel = (): void => { b.style.filter = ''; up?.(); };
      b.addEventListener('pointerup', rel);
      b.addEventListener('pointercancel', rel);
      this.root.append(b);
      return b;
    };
    mk('Yumruk', '👊', 'right:120px;bottom:26px', 92, () => this.press('punch'));
    mk('Tekme', '🦵', 'right:18px;bottom:26px', 92, () => this.press('kick'));
    mk('Büyü', '✨', 'right:70px;bottom:128px', 74, () => this.press('special'));
    mk('Blok', '🛡️', 'left:24px;bottom:30px', 88, () => { this.inp.block = true; }, () => { this.inp.block = false; });
    const quit = document.createElement('button');
    quit.textContent = '✕';
    quit.style.cssText = 'position:absolute;right:10px;top:10px;width:40px;height:40px;border-radius:8px;border:1px solid rgba(255,255,255,0.4);background:rgba(0,0,0,0.5);color:#fff;font:bold 18px sans-serif';
    quit.addEventListener('click', () => { this.won = false; this.finish(); });
    this.root.append(quit);
  }

  private press(m: Move): void {
    this.queued = m;
    this.queuedT = 0.35;
  }

  /** düelloyu başlatır; bittiğinde onDone(kazandı mı) çağrılır */
  start(onDone: (won: boolean) => void, opts: FightOpts = FINAL_OPTS): void {
    if (this.running) return;
    this.onDone = onDone;
    this.o = opts;
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
    this.inp = { block: false };
    const cb = this.onDone;
    this.onDone = null;
    cb?.(this.won);
  }

  private newRound(): void {
    this.f = [this.make(0), this.make(1)];
    this.bolts = [];
    this.sparks = [];
    this.time = ROUND_TIME;
    this.phase = 'intro';
    this.phaseT = 1.8;
    this.msg = T('TUR') + ' ' + this.round + (this.round === 1 && this.o.modTitle ? ' · ' + T(this.o.modTitle) : '');
    this.queued = null;
    this.combo = 0;
    this.slow = 0;
    this.aiT = 0.7;
  }

  private loop(now: number): void {
    if (!this.running) return;
    const raw = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += raw;
    let dt = this.o.mod === 'fast' ? raw * 1.5 : raw;
    if (this.slow > 0) { this.slow -= raw; dt *= 0.3; }
    this.update(dt, raw);
    this.draw();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  // ---- savaşçı mantığı ----
  private canAct(f: Fighter): boolean { return !f.ko && f.stun <= 0 && f.move === null && !f.win; }

  private startMove(f: Fighter, m: Move): boolean {
    if (!this.canAct(f)) return false;
    if (this.o.mod === 'magic' && m !== 'special') return false;
    if (m === 'special' && f.sp > 0) return false;
    f.move = m; f.moveT = 0; f.moveHit = false; f.vx = 0;
    if (m === 'special') f.sp = this.o.mod === 'magic' ? 0.9 : SPECIAL.cooldown;
    audio.play(m === 'special' ? 'cast' : 'fly');
    return true;
  }

  private spark(x: number, y: number, big: boolean): void {
    this.sparks.push({ x, y, t: 0, max: big ? 0.38 : 0.26, big });
  }

  private hurt(target: Fighter, from: Fighter, dmg: number, stun: number, knock: number, sx: number, sy: number): void {
    const blocking = target.block && Math.sign(from.x - target.x) === target.face;
    if (blocking) {
      target.hp = Math.max(0, target.hp - dmg * 0.15);
      target.vx = -target.face * knock * 0.5;
      this.spark(sx, sy, false);
      this.freeze = 0.03;
      audio.play('click');
    } else {
      target.hp = Math.max(0, target.hp - dmg);
      target.stun = stun;
      target.hurtT = stun;
      target.move = null;
      target.vx = Math.sign(target.x - from.x || 1) * knock;
      target.flash = 0.16;
      this.spark(sx, sy, dmg >= 10);
      this.freeze = dmg >= 10 ? 0.09 : 0.06;
      this.shake = Math.max(this.shake, dmg >= 10 ? 9 : 5);
      audio.play(dmg >= 10 ? 'tigerhit' : 'hit');
      if (target === this.f[0]) vibrate(30);
      if (from === this.f[0]) { this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 1.2; }
    }
    if (target.hp <= 0) { target.ko = true; target.stun = 99; target.t = 0; this.slow = 1.1; this.shake = 14; }
  }

  private stepFighter(f: Fighter, other: Fighter, dt: number, dir: number, wantBlock: boolean): void {
    f.t += dt;
    f.flash = Math.max(0, f.flash - dt);
    f.sp = Math.max(0, f.sp - dt);
    f.hurtT = Math.max(0, f.hurtT - dt);
    if (f.stun > 0 && !f.ko) f.stun = Math.max(0, f.stun - dt);
    f.block = wantBlock && this.o.mod !== 'noblock' && this.canAct(f);
    if (this.canAct(f) && !f.block) { f.vx = dir * 240; if (dir !== 0) f.walk += dt; }
    else f.vx *= Math.pow(0.0008, dt); // sürtünme
    if (f.move === null && !f.ko && !f.win) f.face = other.x >= f.x ? 1 : -1;
    f.x = Math.max(70, Math.min(W - 70, f.x + f.vx * dt));
    if (f.move) {
      f.moveT += dt;
      if (f.move === 'special') {
        if (!f.moveHit && f.moveT >= SPECIAL.spawn) {
          f.moveHit = true;
          this.bolts.push({ x: f.x + f.face * 70, y: f.y - 100, vx: f.face * SPECIAL.speed, dmg: SPECIAL.dmg, stun: SPECIAL.stun, owner: f.side, t: 2 });
        }
        if (f.moveT >= SPECIAL.dur) f.move = null;
      } else {
        const md = MOVES[f.move];
        // saldırırken öne atılır
        if (f.moveT < md.to) f.x = Math.max(70, Math.min(W - 70, f.x + f.face * md.lunge * dt * (f.moveT > md.from * 0.5 ? 1 : 0.3)));
        if (!f.moveHit && f.moveT >= md.from && f.moveT <= md.to && !other.ko) {
          const dx = (other.x - f.x) * f.face;
          if (dx > -10 && dx < md.reach) {
            f.moveHit = true;
            const hy = f.y - (f.move === 'kick' ? 62 : 105);
            this.hurt(other, f, md.dmg, md.stun, md.knock, f.x + f.face * Math.min(dx, md.reach) * 0.95, hy);
          }
        }
        if (f.moveT >= md.dur) f.move = null;
      }
    }
  }

  private update(dt: number, raw: number): void {
    const [p, a] = this.f;
    this.phaseT -= raw;
    this.comboT = Math.max(0, this.comboT - raw);
    if (this.comboT <= 0) this.combo = 0;
    this.shake = Math.max(0, this.shake - raw * 40);
    this.queuedT = Math.max(0, this.queuedT - raw);
    for (const s of this.sparks) s.t += raw;
    this.sparks = this.sparks.filter((s) => s.t < s.max);
    if (this.phase === 'intro') {
      if (this.phaseT <= 0) { this.phase = 'fight'; this.msg = T('DÖVÜŞ!'); this.phaseT = 0.8; audio.play('roar'); }
      this.stepFighter(p, a, dt, 0, false); this.stepFighter(a, p, dt, 0, false);
      return;
    }
    if (this.freeze > 0) { this.freeze -= raw; return; }
    if (this.phase === 'fight') {
      if (this.phaseT <= 0) this.msg = '';
      // oyuncu: komut kuyruğu (toparlanma sırasında da zincirlenebilir)
      if (this.queued) {
        const md = p.move && p.move !== 'special' ? MOVES[p.move] : null;
        const chainOk = this.canAct(p) || (md !== null && p.moveT >= md.dur * md.chain && p.stun <= 0);
        if (chainOk) { if (p.move) p.move = null; if (this.startMove(p, this.queued)) this.queued = null; }
        else if (this.queuedT <= 0) this.queued = null;
      }
      // kendiliğinden yaklaşma: menzile girene kadar rakibe yürür (blok tutarken yürümez)
      const dist = Math.abs(a.x - p.x);
      const toward = Math.sign(a.x - p.x) || 1;
      const auto = this.inp.block ? 0 : dist > ENGAGE ? toward : dist < 70 ? -toward * 0.6 : 0;
      this.stepFighter(p, a, dt, auto, this.inp.block);
      // yapay zekâ
      const ai = this.think(a, p, dt);
      if (ai.move && this.o.mod === 'magic') ai.move = 'special';
      if (ai.move) this.startMove(a, ai.move);
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
    if (Math.abs(gap) >= min) return;
    const push = (min - Math.abs(gap)) / 2;
    const dir = gap >= 0 ? 1 : -1;
    p.x = Math.max(70, p.x - dir * push);
    a.x = Math.min(W - 70, a.x + dir * push);
  }

  private endRound(): void {
    const [p, a] = this.f;
    let w = -1;
    if (p.hp > a.hp) w = 0; else if (a.hp > p.hp) w = 1;
    if (w >= 0) this.wins[w as 0 | 1]++;
    else { this.wins[0]++; this.wins[1]++; }
    this.msg = p.ko || a.ko ? 'K.O.' : T('SÜRE DOLDU');
    if (w === 0) p.win = true; else if (w === 1) a.win = true;
    this.phase = 'roundEnd';
    this.phaseT = 2.6;
    audio.play(w === 0 ? 'boss' : 'kill');
  }

  private updateBolts(dt: number): void {
    for (const b of this.bolts) {
      b.t -= dt;
      b.x += b.vx * dt;
      const tgt = this.f[b.owner === 0 ? 1 : 0];
      const src = this.f[b.owner];
      if (tgt.ko) continue;
      if (Math.abs(b.x - tgt.x) < 42 && Math.abs(b.y - (tgt.y - 95)) < 95) {
        b.t = 0;
        this.hurt(tgt, src, b.dmg, b.stun, 220, b.x, b.y);
      }
    }
    for (const b of this.bolts) for (const o of this.bolts) if (b !== o && b.owner !== o.owner && Math.abs(b.x - o.x) < 30) { b.t = 0; o.t = 0; this.spark(b.x, b.y, true); }
    this.bolts = this.bolts.filter((b) => b.t > 0 && b.x > -40 && b.x < W + 40);
  }

  /** rakip cadının yapay zekâsı: oyuncuyla aynı can/hasar; kararları kısa tepki süresiyle verir */
  private think(a: Fighter, p: Fighter, dt: number): { dir: number; block: boolean; move: Move | null } {
    const out = { dir: 0, block: false, move: null as Move | null };
    if (!this.canAct(a)) { this.aiBlock = 0; return out; }
    const dx = p.x - a.x;
    const dist = Math.abs(dx);
    const toward = Math.sign(dx);
    this.aiBlock = Math.max(0, this.aiBlock - dt);
    if (this.aiBlock > 0) { out.block = true; return out; }
    this.aiT -= dt;
    const inc = this.bolts.find((b) => b.owner === 0 && Math.sign(a.x - b.x) === Math.sign(b.vx) && Math.abs(a.x - b.x) < 240);
    if (inc && this.aiT <= 0) {
      this.aiT = 0.25;
      if (Math.random() < 0.15 + 0.5 * this.o.level) { this.aiBlock = 0.5; out.block = true; return out; }
    }
    if (p.move && p.move !== 'special' && dist < 150 && this.aiT <= 0 && Math.random() < 0.1 + 0.35 * this.o.level) { this.aiT = 0.3; this.aiBlock = 0.45; out.block = true; return out; }
    if (this.aiT <= 0) {
      this.aiT = (0.22 + Math.random() * 0.3) * (1.5 - 0.5 * this.o.level);
      if (dist > 300 && a.sp <= 0 && Math.random() < 0.2 + 0.35 * this.o.level) { out.move = 'special'; return out; }
      if (dist > ENGAGE + 14) this.aiMove = 'approach';
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
  private limb(x0: number, y0: number, l1: number, a1: number, l2: number, a2: number, w: number, col: string, end?: { r: number; col: string }): void {
    const c = this.c;
    const x1 = x0 + Math.sin(a1) * l1;
    const y1 = y0 + Math.cos(a1) * l1;
    const x2 = x1 + Math.sin(a1 + a2) * l2;
    const y2 = y1 + Math.cos(a1 + a2) * l2;
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(20,10,40,0.9)'; c.lineWidth = w + 4;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.strokeStyle = col; c.lineWidth = w;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    if (end) { c.fillStyle = end.col; c.strokeStyle = 'rgba(20,10,40,0.9)'; c.lineWidth = 3; c.beginPath(); c.arc(x2, y2, end.r, 0, Math.PI * 2); c.fill(); c.stroke(); }
  }

  private drawFighter(f: Fighter): void {
    const c = this.c;
    const rival = f.side === 1;
    const hue = 265 + (f.hue || 0);
    const robe = hsl(hue, 55, rival ? 38 : 46);
    const robeD = hsl(hue, 55, 28);
    const hat = hsl(hue, 50, 34);
    const skin = rival ? '#a6d98c' : '#f3c9a5';
    const hair = rival ? '#2f4a2a' : '#5a3a28';
    const boot = '#3a2418';
    const pz = poseOf(f);
    // gölge
    c.fillStyle = 'rgba(0,0,0,0.38)';
    c.beginPath(); c.ellipse(f.x, GROUND + 5, 64, 13, 0, 0, Math.PI * 2); c.fill();
    c.save();
    c.translate(f.x, f.y);
    c.scale(f.face * 1.12, 1.12);
    const legLen = 24;
    const hipY = -(legLen * 2) + pz.crouch + pz.bob;
    const shY = hipY - 50;
    c.translate(0, hipY);
    c.rotate(pz.lean);
    c.translate(0, -hipY);
    if (f.flash > 0) c.filter = 'brightness(2.2) saturate(0.5)';
    // arka kol ve bacak
    this.limb(-8, shY + 6, 22, pz.ba[0], 22, pz.ba[1], 9, robeD, { r: 6, col: skin });
    this.limb(-8, hipY, legLen, pz.bl[0], legLen, pz.bl[1], 11, '#5a4a6a', { r: 8, col: boot });
    // asa (arka elde)
    const sx = -8 + Math.sin(pz.ba[0]) * 22 + Math.sin(pz.ba[0] + pz.ba[1]) * 22;
    const sy = shY + 6 + Math.cos(pz.ba[0]) * 22 + Math.cos(pz.ba[0] + pz.ba[1]) * 22;
    c.save();
    c.translate(sx, sy);
    c.rotate(pz.staff);
    c.strokeStyle = '#6b4423'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 24); c.lineTo(0, -62); c.stroke();
    c.fillStyle = '#6fe3ff'; c.beginPath(); c.arc(0, -68, 9 + pz.glow * 5, 0, Math.PI * 2); c.fill();
    if (pz.glow > 0.2) { const g = c.createRadialGradient(0, -68, 2, 0, -68, 36); g.addColorStop(0, 'rgba(180,240,255,0.9)'); g.addColorStop(1, 'rgba(180,240,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -68, 36, 0, Math.PI * 2); c.fill(); }
    c.restore();
    // cüppe
    c.fillStyle = robe; c.strokeStyle = 'rgba(20,10,40,0.9)'; c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-17, shY); c.lineTo(17, shY); c.lineTo(34, hipY + 22); c.lineTo(-34, hipY + 22); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = hsl(hue + 25, 70, 62);
    c.fillRect(-18, hipY - 3, 36, 6); // kemer
    c.fillStyle = '#ffd84a'; c.fillRect(-4, hipY - 5, 8, 10);
    // baş
    const hx = Math.sin(pz.head) * 6;
    const hy = shY - 26;
    c.fillStyle = hair; c.beginPath(); c.arc(hx - 5, hy + 4, 25, 0, Math.PI * 2); c.fill();
    c.fillStyle = skin; c.strokeStyle = 'rgba(20,10,40,0.9)'; c.lineWidth = 3;
    c.beginPath(); c.arc(hx, hy, 22, 0, Math.PI * 2); c.fill(); c.stroke();
    // yüz
    const hurtFace = f.hurtT > 0 || f.ko;
    c.fillStyle = '#2a1a3a';
    if (hurtFace) { c.lineWidth = 3; c.strokeStyle = '#2a1a3a'; c.beginPath(); c.moveTo(hx + 4, hy - 6); c.lineTo(hx + 12, hy); c.moveTo(hx + 12, hy - 6); c.lineTo(hx + 4, hy); c.stroke(); }
    else { c.beginPath(); c.ellipse(hx + 8, hy - 3, 3, f.move ? 4.5 : 3.6, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(255,120,120,0.45)'; c.beginPath(); c.arc(hx + 12, hy + 6, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#2a1a3a'; c.lineWidth = 2.5; c.beginPath();
    if (f.move === 'punch' || f.move === 'kick') c.ellipse(hx + 9, hy + 10, 4, 3.5, 0, 0, Math.PI * 2);
    else if (hurtFace) { c.moveTo(hx + 4, hy + 12); c.quadraticCurveTo(hx + 9, hy + 7, hx + 14, hy + 12); }
    else { c.moveTo(hx + 4, hy + 9); c.quadraticCurveTo(hx + 9, hy + 13, hx + 14, hy + 9); }
    c.stroke();
    // şapka
    c.fillStyle = hat; c.strokeStyle = 'rgba(20,10,40,0.9)'; c.lineWidth = 4;
    c.beginPath(); c.ellipse(hx, hy - 16, 36, 9, -0.05, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(hx - 22, hy - 18); c.quadraticCurveTo(hx - 4, hy - 56, hx + 16, hy - 80 + pz.head * 20); c.quadraticCurveTo(hx + 20, hy - 50, hx + 24, hy - 18); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd84a'; c.beginPath(); c.moveTo(hx - 21, hy - 21); c.lineTo(hx + 23, hy - 22); c.lineTo(hx + 22, hy - 29); c.lineTo(hx - 20, hy - 29); c.closePath(); c.fill();
    // ön bacak ve kol
    this.limb(8, hipY, legLen, pz.fl[0], legLen, pz.fl[1], 12, '#6b5a7a', { r: 9, col: boot });
    this.limb(10, shY + 6, 22, pz.fa[0], 22, pz.fa[1], 10, robe, { r: 8, col: '#f0f0f5' });
    c.restore();
    c.filter = 'none';
    // vuruş izi
    if (f.move && f.move !== 'special') {
      const md = MOVES[f.move];
      if (f.moveT >= md.from * 0.8 && f.moveT <= md.to + 0.08) {
        c.save();
        c.strokeStyle = f.move === 'kick' ? 'rgba(255,205,120,0.9)' : 'rgba(255,255,255,0.9)';
        c.lineWidth = f.move === 'kick' ? 10 : 6;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(f.x + f.face * md.reach * 0.5, f.y - (f.move === 'kick' ? 64 : 108), md.reach * 0.42, f.face > 0 ? -0.9 : Math.PI - 0.9, f.face > 0 ? 0.9 : Math.PI + 0.9);
        c.stroke();
        c.restore();
      }
    }
    if (f.block) {
      c.save();
      const gr = c.createRadialGradient(f.x + f.face * 44, f.y - 90, 8, f.x + f.face * 44, f.y - 90, 74);
      gr.addColorStop(0, 'rgba(160,230,255,0.05)'); gr.addColorStop(1, 'rgba(120,220,255,0.55)');
      c.fillStyle = gr; c.strokeStyle = 'rgba(160,235,255,0.85)'; c.lineWidth = 4;
      c.beginPath(); c.arc(f.x + f.face * 44, f.y - 90, 74, f.face > 0 ? -1.15 : Math.PI - 1.15, f.face > 0 ? 1.15 : Math.PI + 1.15); c.fill(); c.stroke();
      c.restore();
    }
  }

  private bar(x: number, w: number, hp: number, right: boolean, name: string, wins: number): void {
    const c = this.c;
    c.fillStyle = 'rgba(0,0,0,0.65)'; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3;
    c.beginPath(); c.roundRect(x - 4, 14, w + 8, 34, 8); c.fill(); c.stroke();
    const k = Math.max(0, hp) / MAX_HP;
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, k > 0.3 ? '#ffd84a' : '#ff5a5a'); g.addColorStop(1, k > 0.3 ? '#5fe07a' : '#ff9a5a');
    c.fillStyle = g;
    c.beginPath();
    if (right) c.roundRect(x + w * (1 - k), 18, w * k, 26, 6); else c.roundRect(x, 18, w * k, 26, 6);
    c.fill();
    c.font = 'bold 17px sans-serif'; c.textAlign = right ? 'right' : 'left';
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.fillStyle = '#fff';
    c.strokeText(name, right ? x + w : x, 68); c.fillText(name, right ? x + w : x, 68);
    for (let i = 0; i < 2; i++) {
      const sx = right ? x + w - 12 - i * 26 : x + 12 + i * 26;
      c.fillStyle = i < wins ? '#ffd84a' : 'rgba(255,255,255,0.28)';
      c.beginPath();
      for (let j = 0; j < 5; j++) { const ang = -Math.PI / 2 + (j * 2 * Math.PI) / 5; const ang2 = ang + Math.PI / 5; c.lineTo(sx + Math.cos(ang) * 9, 86 + Math.sin(ang) * 9); c.lineTo(sx + Math.cos(ang2) * 4, 86 + Math.sin(ang2) * 4); }
      c.closePath(); c.fill();
    }
  }

  /** ön plandaki seyirci siluetleri: ritimle zıplar, kollarını kaldırır */
  private drawCrowd(): void {
    const c = this.c;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 22; i++) {
        const x = (i * 46 + row * 23 + (row ? 8 : -6)) % (W + 40) - 10;
        const jump = Math.abs(Math.sin(this.clock * (3 + (i % 3)) + i)) * (row ? 7 : 11);
        const y = H - 8 + row * 12 - jump;
        const h = 34 + (i % 4) * 4 + row * 6;
        c.fillStyle = row ? 'rgba(14,8,28,0.97)' : 'rgba(26,14,48,0.95)';
        c.beginPath(); c.arc(x, y - h, 13, 0, Math.PI * 2); c.fill();
        c.fillRect(x - 14, y - h + 10, 28, h);
        if (i % 3 === 0) { c.fillRect(x - 21, y - h - 6 - jump * 0.3, 7, 24); c.fillRect(x + 14, y - h - 12 - jump * 0.3, 7, 28); } // kaldırılmış kollar
        if (i % 5 === 2) { c.beginPath(); c.moveTo(x - 12, y - h - 11); c.lineTo(x, y - h - 40); c.lineTo(x + 12, y - h - 11); c.closePath(); c.fill(); } // sivri şapka
      }
    }
  }

  private draw(): void {
    const c = this.c;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.filter = 'none';
    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    // arena: seyirciyle dolu arka plan görseli (yoksa renk geçişi)
    if (this.bgImg) c.drawImage(this.bgImg, 0, 0, W, H);
    else {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b0620'); g.addColorStop(0.7, this.bg()); g.addColorStop(1, '#05030c');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#1a1030'; c.fillRect(0, GROUND, W, H - GROUND);
    }
    // sahne ışığı
    const [p, a] = this.f;
    const sp = c.createRadialGradient((p.x + a.x) / 2, GROUND - 40, 20, (p.x + a.x) / 2, GROUND - 40, 330);
    sp.addColorStop(0, 'rgba(255,240,200,0.2)'); sp.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = sp; c.fillRect(0, 0, W, H);
    // vuran önde
    if (p.move && !a.move) { this.drawFighter(a); this.drawFighter(p); } else { this.drawFighter(p); this.drawFighter(a); }
    for (const b of this.bolts) {
      const col = b.owner === 0 ? '200,170,255' : '120,255,170';
      const gr = c.createRadialGradient(b.x, b.y, 4, b.x, b.y, 44);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.4, `rgba(${col},0.75)`); gr.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(b.x, b.y, 44, 0, Math.PI * 2); c.fill();
    }
    // kıvılcımlar
    for (const s of this.sparks) {
      const k = s.t / s.max;
      const r = (s.big ? 54 : 34) * (0.4 + k);
      c.save();
      c.translate(s.x, s.y);
      c.globalAlpha = 1 - k;
      c.fillStyle = s.big ? '#ffd84a' : '#ffffff';
      c.beginPath();
      for (let j = 0; j < 8; j++) { const ang = (j * Math.PI) / 4 + s.t * 3; c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); const ang2 = ang + Math.PI / 8; c.lineTo(Math.cos(ang2) * r * 0.35, Math.sin(ang2) * r * 0.35); }
      c.closePath(); c.fill();
      c.restore();
    }
    this.drawCrowd();
    // HUD
    this.bar(30, 380, p.hp, false, this.heroName(), this.wins[0]);
    this.bar(550, 380, a.hp, true, T(this.o.foeName), this.wins[1]);
    c.fillStyle = 'rgba(0,0,0,0.65)'; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 3;
    c.beginPath(); c.roundRect(W / 2 - 38, 10, 76, 50, 10); c.fill(); c.stroke();
    c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
    c.fillText(String(Math.max(0, Math.ceil(this.time))), W / 2, 48);
    // büyü bekleme çubuğu
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(30, 96, 140, 8);
    c.fillStyle = p.sp > 0 ? '#9b8bff' : '#6fe3ff'; c.fillRect(30, 96, 140 * (p.sp > 0 ? 1 - p.sp / SPECIAL.cooldown : 1), 8);
    c.font = 'bold 12px sans-serif'; c.textAlign = 'left'; c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillText(T('Büyü') + ' ' + (p.sp > 0 ? p.sp.toFixed(1) + ' sn' : T('hazır')), 178, 105);
    if (this.combo >= 2) {
      c.font = 'bold 40px sans-serif'; c.textAlign = 'left'; c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.strokeText(this.combo + ' HIT!', 40, 190); c.fillStyle = '#ffb347'; c.fillText(this.combo + ' HIT!', 40, 190);
    }
    if (this.msg) {
      c.font = 'bold 72px sans-serif'; c.textAlign = 'center'; c.lineWidth = 9; c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.strokeText(this.msg, W / 2, 260); c.fillStyle = '#ffd84a'; c.fillText(this.msg, W / 2, 260);
    }
    if (this.phase === 'over') {
      c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,0.85)';
      const t = this.won ? T('Dokun: devam') : T('Dokun: çık (kaleye dönünce tekrar denersin)');
      c.strokeText(t, W / 2, 320); c.fillStyle = '#fff'; c.fillText(t, W / 2, 320);
    }
    c.restore();
  }
}
