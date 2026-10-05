/**
 * Arena / son düello: Street Fighter tarzı ayrı bir dövüş oyunu (yan görünüm, 3 turun 2'si).
 * - Savaşçılar kodla çizilen iskeletli cadılardır (konik uzuvlar, cüppe ve pelerin dalgalanması, saç, gölgeli yüz); yumruk, tekme, büyü, blok, darbe, K.O. ve zafer animasyonları vardır.
 * - Yön tuşları yoktur: savaşçı rakibe kendiliğinden yaklaşır; oyuncu yalnızca Yumruk / Tekme / Büyü / Blok'a basar.
 * - Efektler: vuruş patlaması (kıvılcım, şok halkası, hız çizgileri, taş kırıntısı), vuruş duraklaması, kamera yakınlaşması ve sarsıntısı, ekran parlaması,
 *   hareket izi (hayalet kopyalar), ışık süpürmeli saldırı yayları, kuyruklu büyü topu, blok kalkanı dalgası, ayak tozu, zemin yansıması,
 *   hasar sayıları, canı geriden izleyen kırmızı çubuk, kombo sayacı, tur/dövüş/K.O. yazıları, seyirci coşkusu ve flaşlar.
 * Rakip yapay zekâ oyuncuyla aynı can ve hasara sahiptir; rengi farklıdır.
 */
import { audio } from './audio.js';
import { T } from './i18n.js';
import { vibrate } from './settings.js';
import { RIVAL_HUE } from './meta.js';
const W = 960;
const H = 540;
const GROUND = 456;
const MAX_HP = 100;
const ROUND_TIME = 60;
const ENGAGE = 152; // kendiliğinden yaklaşma menzili (merkezler arası)
const MOVES = {
    punch: { dur: 0.32, from: 0.09, to: 0.2, reach: 128, dmg: 7, stun: 0.24, knock: 140, lunge: 120, chain: 0.6 },
    kick: { dur: 0.52, from: 0.17, to: 0.34, reach: 165, dmg: 12, stun: 0.38, knock: 260, lunge: 90, chain: 0.72 },
};
const SPECIAL = { dur: 0.6, spawn: 0.24, cooldown: 2.4, dmg: 14, speed: 560, stun: 0.42 };
const FINAL_OPTS = { foeName: 'Rakip Cadı', foeHue: RIVAL_HUE, level: 1, mod: 'none', playerHue: 0 };
// ---- iskelet pozları ----
const ease = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const mixPose = (a, b, k) => ({
    lean: lerp(a.lean, b.lean, k), bob: lerp(a.bob, b.bob, k), head: lerp(a.head, b.head, k), crouch: lerp(a.crouch, b.crouch, k),
    fa: mix2(a.fa, b.fa, k), ba: mix2(a.ba, b.ba, k), fl: mix2(a.fl, b.fl, k), bl: mix2(a.bl, b.bl, k), staff: lerp(a.staff, b.staff, k), glow: lerp(a.glow, b.glow, k),
});
const GUARD = { lean: 0.04, bob: 0, head: 0, crouch: 0, fa: [0.55, 1.65], ba: [0.15, 1.9], fl: [0.25, -0.2], bl: [-0.28, 0.15], staff: -0.2, glow: 0 };
function poseOf(f) {
    const p = { ...GUARD, fa: [...GUARD.fa], ba: [...GUARD.ba], fl: [...GUARD.fl], bl: [...GUARD.bl] };
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
    if (f.block)
        return { ...p, lean: -0.05, crouch: 10, fa: [1.0, 2.1], ba: [0.9, 2.3], fl: [0.25, 0.3], bl: [-0.3, 0.3], staff: -0.3, glow: 0 };
    if (f.move === 'punch') {
        const k = f.moveT / MOVES.punch.dur;
        const wind = { ...p, lean: -0.1, fa: [-0.9, 2.0], ba: [0.2, 1.9], fl: [0.35, 0.2], bl: [-0.35, 0.2] };
        const hit = { ...p, lean: 0.22, crouch: 3, fa: [1.52, 0.04], ba: [-0.2, 1.6], fl: [0.55, 0.1], bl: [-0.55, 0.3], head: 0.06 };
        if (k < 0.28)
            return mixPose(p, wind, ease(k / 0.28));
        if (k < 0.55)
            return mixPose(wind, hit, ease((k - 0.28) / 0.27));
        return mixPose(hit, p, ease(Math.min(1, (k - 0.55) / 0.45)));
    }
    if (f.move === 'kick') {
        const k = f.moveT / MOVES.kick.dur;
        const wind = { ...p, lean: -0.16, fa: [-0.5, 1.7], ba: [0.3, 1.8], fl: [-0.2, 1.6], bl: [-0.15, 0.2] };
        const hit = { ...p, lean: -0.34, crouch: 2, fa: [-0.9, 1.4], ba: [1.0, 1.3], fl: [1.52, 0.05], bl: [-0.1, 0.05] };
        if (k < 0.32)
            return mixPose(p, wind, ease(k / 0.32));
        if (k < 0.6)
            return mixPose(wind, hit, ease((k - 0.32) / 0.28));
        return mixPose(hit, p, ease(Math.min(1, (k - 0.6) / 0.4)));
    }
    if (f.move === 'special') {
        const k = Math.min(1, f.moveT / SPECIAL.dur);
        const cast = { ...p, lean: 0.12, crouch: 4, fa: [1.45, 0.2], ba: [1.3, 0.35], fl: [0.5, 0.1], bl: [-0.5, 0.2], staff: 1.45, glow: 1 };
        const wind = { ...p, lean: -0.12, fa: [-0.6, 1.9], ba: [-0.3, 1.9], staff: -0.2, glow: 0.3 };
        if (k < 0.3)
            return mixPose(p, wind, ease(k / 0.3));
        if (k < 0.5)
            return mixPose(wind, cast, ease((k - 0.3) / 0.2));
        return mixPose(cast, p, ease((k - 0.5) / 0.5));
    }
    if (Math.abs(f.vx) > 20) {
        const s = Math.sin(f.walk * 9);
        return { ...p, bob: -Math.abs(s) * 4, lean: 0.1, fl: [0.25 + s * 0.6, 0.2 + Math.max(0, -s) * 0.5], bl: [-0.25 - s * 0.6, 0.2 + Math.max(0, s) * 0.5], fa: [0.55 - s * 0.2, 1.65], ba: [0.15 + s * 0.2, 1.9] };
    }
    return { ...p, bob: br * 1.6, head: br * 0.03, fa: [0.55 + br * 0.03, 1.65], ba: [0.15, 1.9 + br * 0.04] };
}
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const OUTLINE = 'rgba(18,8,36,0.95)';
export class FightGame {
    constructor(spr, bg, heroName) {
        this.spr = spr;
        this.bg = bg;
        this.heroName = heroName;
        this.raf = 0;
        this.last = 0;
        this.running = false;
        this.o = FINAL_OPTS;
        this.f = [this.make(0), this.make(1)];
        this.bolts = [];
        this.parts = [];
        this.pops = [];
        this.inp = { block: false };
        this.queued = null;
        this.queuedT = 0;
        this.phase = 'intro';
        this.phaseT = 0;
        this.round = 1;
        this.wins = [0, 0];
        this.time = ROUND_TIME;
        this.msg = '';
        this.msgT = 0;
        this.won = false;
        this.freeze = 0;
        this.slow = 0;
        this.shake = 0;
        this.combo = 0;
        this.comboT = 0;
        this.comboDmg = 0;
        this.comboPop = 0;
        this.clock = 0;
        this.flashA = 0;
        this.flashCol = '255,255,255';
        this.punch = 0;
        this.excite = 0;
        this.koFocus = -1;
        this.camX = W / 2;
        this.camY = H / 2;
        this.camZ = 1;
        this.bgImg = null;
        // yapay zekâ
        this.aiT = 0;
        this.aiBlock = 0;
        this.aiMove = 'approach';
        this.keys = new Set();
        this.onKey = (ev, down) => {
            const k = ev.key.toLowerCase();
            const map = { j: 'punch', k: 'kick', l: 'block', u: 'special', ' ': 'punch', z: 'punch', x: 'kick', c: 'special', v: 'block' };
            const a = map[k];
            if (!a)
                return;
            ev.preventDefault();
            if (down) {
                if (this.keys.has(a))
                    return;
                this.keys.add(a);
                if (a === 'block')
                    this.inp.block = true;
                else
                    this.press(a);
            }
            else {
                this.keys.delete(a);
                if (a === 'block')
                    this.inp.block = false;
            }
        };
        this.kd = (e) => this.onKey(e, true);
        this.ku = (e) => this.onKey(e, false);
        this.onDone = null;
        this.root = document.createElement('div');
        this.root.style.cssText = 'position:fixed;inset:0;z-index:200;background:#07040f;display:none;touch-action:none;user-select:none;-webkit-user-select:none';
        this.cv = document.createElement('canvas');
        this.cv.width = W;
        this.cv.height = H;
        this.cv.style.cssText = 'position:absolute;left:50%;top:0;transform:translateX(-50%);height:100%;max-width:100%;object-fit:contain;image-rendering:auto';
        this.root.append(this.cv);
        const ctx = this.cv.getContext('2d');
        if (!ctx)
            throw new Error('canvas yok');
        this.c = ctx;
        this.buildPad();
        if (!window.matchMedia('(pointer: coarse)').matches) {
            const hint = document.createElement('div');
            hint.textContent = T('J: yumruk · K: tekme · U: büyü · L: blok');
            hint.style.cssText = 'position:absolute;left:50%;bottom:10px;transform:translateX(-50%);color:rgba(255,255,255,.65);font:13px sans-serif;pointer-events:none;white-space:nowrap;text-shadow:0 1px 3px #000';
            this.root.append(hint);
        }
        this.cv.addEventListener('pointerdown', () => { if (this.phase === 'over')
            this.finish(); });
        document.body.append(this.root);
        const img = new Image();
        img.onload = () => { this.bgImg = img; };
        img.onerror = () => { this.bgImg = null; };
        img.src = 'assets/arena_bg.jpg';
    }
    make(side) {
        const hp = this.o.mod === 'lowhp' ? MAX_HP * 0.4 : MAX_HP;
        return {
            x: side === 0 ? 300 : 660, y: GROUND, vx: 0, hp, hpTrail: hp, face: side === 0 ? 1 : -1, move: null, moveT: 0, moveHit: false,
            stun: 0, block: false, sp: 0, ko: false, t: 0, flash: 0, hue: side === 0 ? this.o.playerHue : this.o.foeHue, side, walk: 0, hurtT: 0, win: false,
            ghost: [], blockPulse: 0, dustT: 0,
        };
    }
    /** dokunmatik düğmeler (yön tuşu yok): sağ altta saldırılar, sol altta blok */
    buildPad() {
        const mk = (label, sub, css, size, down, up) => {
            const b = document.createElement('button');
            b.innerHTML = `<span style="font-size:${Math.round(size * 0.36)}px;line-height:1">${sub}</span><span style="font-size:${Math.round(size * 0.17)}px">${T(label)}</span>`;
            b.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,0.55);background:radial-gradient(circle at 35% 30%,rgba(150,100,255,0.85),rgba(50,20,100,0.85));color:#fff;font:bold 15px sans-serif;touch-action:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:0 4px 14px rgba(0,0,0,.55);` + css;
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.style.filter = 'brightness(1.5)'; down(); });
            const rel = () => { b.style.filter = ''; up?.(); };
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
    press(m) {
        this.queued = m;
        this.queuedT = 0.35;
    }
    /** düelloyu başlatır; bittiğinde onDone(kazandı mı) çağrılır */
    start(onDone, opts = FINAL_OPTS) {
        if (this.running)
            return;
        this.onDone = onDone;
        this.o = opts;
        this.root.style.display = 'block';
        this.running = true;
        this.wins = [0, 0];
        this.round = 1;
        this.won = false;
        this.parts = [];
        this.pops = [];
        this.excite = 0;
        this.newRound();
        window.addEventListener('keydown', this.kd);
        window.addEventListener('keyup', this.ku);
        this.last = performance.now();
        this.raf = requestAnimationFrame((t) => this.loop(t));
    }
    get active() { return this.running; }
    finish() {
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
    newRound() {
        this.f = [this.make(0), this.make(1)];
        this.bolts = [];
        this.parts = [];
        this.pops = [];
        this.time = ROUND_TIME;
        this.phase = 'intro';
        this.phaseT = 2.1;
        this.msg = T('TUR') + ' ' + this.round + (this.round === 1 && this.o.modTitle ? ' · ' + T(this.o.modTitle) : '');
        this.msgT = 0;
        this.queued = null;
        this.combo = 0;
        this.comboDmg = 0;
        this.slow = 0;
        this.koFocus = -1;
        this.aiT = 0.7;
        this.camZ = 1.18; // tur başında yakından başlar, geri çekilir
    }
    loop(now) {
        if (!this.running)
            return;
        const raw = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.clock += raw;
        let dt = this.o.mod === 'fast' ? raw * 1.5 : raw;
        if (this.slow > 0) {
            this.slow -= raw;
            dt *= 0.3;
        }
        this.update(dt, raw);
        this.draw();
        this.raf = requestAnimationFrame((t) => this.loop(t));
    }
    // ---- efektler ----
    addPart(p) {
        if (this.parts.length > 500)
            return;
        this.parts.push({ vx: 0, vy: 0, t: 0, max: 0.4, size: 4, col: '#fff', g: 0, rot: 0, ...p });
    }
    /** vuruş patlaması: kıvılcım, şok halkası, hız çizgileri ve taş kırıntısı */
    burst(x, y, power, col, dir) {
        const n = Math.round(10 + power * 12);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 160 + Math.random() * 520 * power;
            this.addPart({ x, y, vx: Math.cos(a) * sp + dir * 120, vy: Math.sin(a) * sp - 60, max: 0.25 + Math.random() * 0.35, size: 2 + Math.random() * 3.5, col: Math.random() < 0.4 ? '#ffffff' : col, kind: 'spark', g: 700 });
        }
        this.addPart({ x, y, kind: 'ring', max: 0.32, size: 14 + power * 52, col });
        this.addPart({ x, y, kind: 'glow', max: 0.18, size: 40 + power * 60, col: '#ffffff' });
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
            this.addPart({ x, y, kind: 'line', rot: a, size: 30 + Math.random() * 50 * power, max: 0.22, col });
        }
        if (power > 1.1)
            for (let i = 0; i < 7; i++)
                this.addPart({ x, y: GROUND - 6, vx: (Math.random() - 0.5) * 420, vy: -160 - Math.random() * 260, max: 0.7, size: 3 + Math.random() * 4, col: '#9a8fb0', kind: 'chip', g: 1100 });
    }
    dust(x, n = 4, dir = 0) {
        for (let i = 0; i < n; i++)
            this.addPart({ x: x + (Math.random() - 0.5) * 24, y: GROUND + 2, vx: dir * 60 + (Math.random() - 0.5) * 80, vy: -20 - Math.random() * 40, max: 0.45 + Math.random() * 0.3, size: 7 + Math.random() * 8, col: 'rgba(205,190,165,0.45)', kind: 'dust' });
    }
    pop(x, y, text, col, size) {
        this.pops.push({ x, y, t: 0, text, col, size });
    }
    // ---- savaşçı mantığı ----
    canAct(f) { return !f.ko && f.stun <= 0 && f.move === null && !f.win; }
    startMove(f, m) {
        if (!this.canAct(f))
            return false;
        if (this.o.mod === 'magic' && m !== 'special')
            return false;
        if (m === 'special' && f.sp > 0)
            return false;
        f.move = m;
        f.moveT = 0;
        f.moveHit = false;
        f.vx = 0;
        if (m === 'special')
            f.sp = this.o.mod === 'magic' ? 0.9 : SPECIAL.cooldown;
        if (m !== 'special')
            this.dust(f.x - f.face * 20, 3, -f.face);
        audio.play(m === 'special' ? 'cast' : 'fly');
        return true;
    }
    hurt(target, from, dmg, stun, knock, sx, sy) {
        const blocking = target.block && Math.sign(from.x - target.x) === target.face;
        const dir = Math.sign(target.x - from.x || 1);
        if (blocking) {
            target.hp = Math.max(0, target.hp - dmg * 0.15);
            target.vx = -target.face * knock * 0.5;
            target.blockPulse = 0.3;
            for (let i = 0; i < 10; i++) {
                const a = (Math.random() - 0.5) * 2.2 + (dir > 0 ? 0 : Math.PI);
                this.addPart({ x: sx, y: sy, vx: Math.cos(a) * (180 + Math.random() * 300), vy: Math.sin(a) * (180 + Math.random() * 200) - 40, max: 0.35, size: 3 + Math.random() * 3, col: '#9be7ff', kind: 'shard', g: 500, rot: Math.random() * 6 });
            }
            this.addPart({ x: sx, y: sy, kind: 'ring', max: 0.28, size: 36, col: '#9be7ff' });
            this.pop(target.x, target.y - 190, T('ENGEL'), '#9be7ff', 20);
            this.freeze = 0.03;
            audio.play('click');
        }
        else {
            target.hp = Math.max(0, target.hp - dmg);
            target.stun = stun;
            target.hurtT = stun;
            target.move = null;
            target.vx = dir * knock;
            target.flash = 0.16;
            const heavy = dmg >= 10;
            this.burst(sx, sy, heavy ? 1.4 : 0.85, from.side === 0 ? '#ffd84a' : '#8aff9a', dir);
            this.dust(target.x, heavy ? 6 : 3, dir);
            this.pop(target.x + (Math.random() - 0.5) * 30, target.y - 200, String(Math.round(dmg)), heavy ? '#ffb347' : '#ffffff', heavy ? 34 : 26);
            this.freeze = heavy ? 0.09 : 0.06;
            this.shake = Math.max(this.shake, heavy ? 10 : 5);
            this.punch = Math.max(this.punch, heavy ? 0.07 : 0.035);
            this.flashA = Math.max(this.flashA, heavy ? 0.28 : 0.1);
            this.excite = Math.min(1.5, this.excite + (heavy ? 0.45 : 0.25));
            audio.play(heavy ? 'tigerhit' : 'hit');
            if (target === this.f[0])
                vibrate(30);
            if (from === this.f[0]) {
                this.combo = this.comboT > 0 ? this.combo + 1 : 1;
                this.comboT = 1.3;
                this.comboDmg = this.combo === 1 ? dmg : this.comboDmg + dmg;
                this.comboPop = 0.25;
            }
        }
        if (target.hp <= 0) {
            target.ko = true;
            target.stun = 99;
            target.t = 0;
            this.slow = 1.2;
            this.shake = 16;
            this.punch = 0.16;
            this.flashA = 0.65;
            this.flashCol = '255,240,200';
            this.koFocus = target.side;
            this.excite = 1.5;
            this.burst(sx, sy, 2.4, '#ffe36b', dir);
            for (let i = 0; i < 40; i++)
                this.addPart({ x: target.x, y: target.y - 120, vx: (Math.random() - 0.5) * 900, vy: -300 - Math.random() * 500, max: 1.4, size: 4 + Math.random() * 5, col: ['#ffd84a', '#ff7ac8', '#7be0ff', '#a8ff7a'][i % 4], kind: 'confetti', g: 800, rot: Math.random() * 6 });
        }
    }
    stepFighter(f, other, dt, dir, wantBlock) {
        f.t += dt;
        f.flash = Math.max(0, f.flash - dt);
        f.sp = Math.max(0, f.sp - dt);
        f.hurtT = Math.max(0, f.hurtT - dt);
        f.blockPulse = Math.max(0, f.blockPulse - dt);
        // can çubuğunun geriden izleyen kırmızı kısmı
        f.hpTrail = f.hpTrail > f.hp ? Math.max(f.hp, f.hpTrail - 40 * dt) : f.hp;
        if (f.stun > 0 && !f.ko)
            f.stun = Math.max(0, f.stun - dt);
        f.block = wantBlock && this.o.mod !== 'noblock' && this.canAct(f);
        if (this.canAct(f) && !f.block) {
            f.vx = dir * 240;
            if (dir !== 0) {
                f.walk += dt;
                f.dustT -= dt;
                if (f.dustT <= 0) {
                    f.dustT = 0.16;
                    this.dust(f.x - dir * 14, 1, -dir);
                }
            }
        }
        else
            f.vx *= Math.pow(0.0008, dt); // sürtünme
        if (Math.abs(f.vx) > 220 && f.stun > 0) {
            f.dustT -= dt;
            if (f.dustT <= 0) {
                f.dustT = 0.05;
                this.dust(f.x, 1, Math.sign(f.vx));
            }
        }
        if (f.move === null && !f.ko && !f.win)
            f.face = other.x >= f.x ? 1 : -1;
        f.x = Math.max(70, Math.min(W - 70, f.x + f.vx * dt));
        // hareket izi: saldırı ve vuruş sırasında hayalet kopyalar
        for (const g of f.ghost)
            g.a -= dt * 4.5;
        f.ghost = f.ghost.filter((g) => g.a > 0);
        if (f.move && f.move !== 'special')
            f.ghost.push({ x: f.x, face: f.face, pose: poseOf(f), a: 1, fr: this.frameName(f) });
        if (f.ghost.length > 7)
            f.ghost.shift();
        if (f.move) {
            f.moveT += dt;
            if (f.move === 'special') {
                if (!f.moveHit && f.moveT >= SPECIAL.spawn) {
                    f.moveHit = true;
                    this.bolts.push({ x: f.x + f.face * 70, y: f.y - 100, vx: f.face * SPECIAL.speed, dmg: SPECIAL.dmg, stun: SPECIAL.stun, owner: f.side, t: 2, trail: [] });
                    this.addPart({ x: f.x + f.face * 66, y: f.y - 100, kind: 'ring', max: 0.3, size: 46, col: f.side === 0 ? '#c8aaff' : '#78ffaa' });
                }
                if (f.moveT >= SPECIAL.dur)
                    f.move = null;
            }
            else {
                const md = MOVES[f.move];
                // saldırırken öne atılır
                if (f.moveT < md.to)
                    f.x = Math.max(70, Math.min(W - 70, f.x + f.face * md.lunge * dt * (f.moveT > md.from * 0.5 ? 1 : 0.3)));
                if (!f.moveHit && f.moveT >= md.from && f.moveT <= md.to && !other.ko) {
                    const dx = (other.x - f.x) * f.face;
                    if (dx > -10 && dx < md.reach) {
                        f.moveHit = true;
                        const hy = f.y - (f.move === 'kick' ? 62 : 105);
                        this.hurt(other, f, md.dmg, md.stun, md.knock, f.x + f.face * Math.min(dx, md.reach) * 0.95, hy);
                    }
                }
                if (f.moveT >= md.dur)
                    f.move = null;
            }
        }
    }
    update(dt, raw) {
        const [p, a] = this.f;
        this.phaseT -= raw;
        this.msgT += raw;
        this.comboT = Math.max(0, this.comboT - raw);
        this.comboPop = Math.max(0, this.comboPop - raw);
        if (this.comboT <= 0) {
            this.combo = 0;
            this.comboDmg = 0;
        }
        this.shake = Math.max(0, this.shake - raw * 45);
        this.punch = Math.max(0, this.punch - raw * 0.35);
        this.flashA = Math.max(0, this.flashA - raw * 2.2);
        this.excite = Math.max(0, this.excite - raw * 0.35);
        this.queuedT = Math.max(0, this.queuedT - raw);
        this.updateFx(raw);
        this.updateCam(raw);
        if (this.phase === 'intro') {
            if (this.phaseT <= 0) {
                this.phase = 'fight';
                this.msg = T('DÖVÜŞ!');
                this.msgT = 0;
                this.phaseT = 0.9;
                this.flashA = 0.25;
                this.shake = 8;
                audio.play('roar');
            }
            this.stepFighter(p, a, dt, 0, false);
            this.stepFighter(a, p, dt, 0, false);
            return;
        }
        if (this.freeze > 0) {
            this.freeze -= raw;
            return;
        }
        if (this.phase === 'fight') {
            if (this.phaseT <= 0)
                this.msg = '';
            // oyuncu: komut kuyruğu (toparlanma sırasında da zincirlenebilir)
            if (this.queued) {
                const md = p.move && p.move !== 'special' ? MOVES[p.move] : null;
                const chainOk = this.canAct(p) || (md !== null && p.moveT >= md.dur * md.chain && p.stun <= 0);
                if (chainOk) {
                    if (p.move)
                        p.move = null;
                    if (this.startMove(p, this.queued))
                        this.queued = null;
                }
                else if (this.queuedT <= 0)
                    this.queued = null;
            }
            // kendiliğinden yaklaşma: menzile girene kadar rakibe yürür (blok tutarken yürümez)
            const dist = Math.abs(a.x - p.x);
            const toward = Math.sign(a.x - p.x) || 1;
            const auto = this.inp.block ? 0 : dist > ENGAGE ? toward : dist < 96 ? -toward * 0.6 : 0;
            this.stepFighter(p, a, dt, auto, this.inp.block);
            // yapay zekâ
            const ai = this.think(a, p, dt);
            if (ai.move && this.o.mod === 'magic')
                ai.move = 'special';
            if (ai.move)
                this.startMove(a, ai.move);
            this.stepFighter(a, p, dt, ai.dir, ai.block);
            this.separate(p, a);
            this.updateBolts(dt);
            this.time -= dt;
            if (p.ko || a.ko || this.time <= 0)
                this.endRound();
        }
        else if (this.phase === 'roundEnd') {
            this.stepFighter(p, a, dt, 0, false);
            this.stepFighter(a, p, dt, 0, false);
            this.updateBolts(dt);
            if (this.phaseT <= 0) {
                if (this.wins[0] >= 2 || this.wins[1] >= 2) {
                    this.won = this.wins[0] >= 2;
                    this.phase = 'over';
                    this.msg = this.won ? T('ZAFER!') : T('Yenildin');
                    this.msgT = 0;
                    this.excite = 1.5;
                    if (this.won)
                        for (let i = 0; i < 60; i++)
                            this.addPart({ x: Math.random() * W, y: -10 - Math.random() * 200, vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 200, max: 3, size: 5 + Math.random() * 5, col: ['#ffd84a', '#ff7ac8', '#7be0ff', '#a8ff7a'][i % 4], kind: 'confetti', g: 40, rot: Math.random() * 6 });
                }
                else {
                    this.round++;
                    this.newRound();
                }
            }
        }
    }
    updateFx(dt) {
        for (const q of this.parts) {
            q.t += dt;
            q.vy += q.g * dt;
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            q.rot += dt * (q.kind === 'confetti' ? 6 : 0);
            if ((q.kind === 'chip' || q.kind === 'spark') && q.y > GROUND + 4) {
                q.y = GROUND + 4;
                q.vy *= -0.3;
                q.vx *= 0.6;
            }
        }
        this.parts = this.parts.filter((q) => q.t < q.max);
        for (const pp of this.pops)
            pp.t += dt;
        this.pops = this.pops.filter((pp) => pp.t < 0.9);
        // büyü topu kuyruk izi
        for (const b of this.bolts) {
            b.trail.unshift({ x: b.x, y: b.y });
            if (b.trail.length > 14)
                b.trail.pop();
            if (Math.random() < 0.7)
                this.addPart({ x: b.x, y: b.y + (Math.random() - 0.5) * 20, vx: -b.vx * 0.1, vy: (Math.random() - 0.5) * 60, max: 0.3, size: 2 + Math.random() * 3, col: b.owner === 0 ? '#d7c0ff' : '#9dffbe', kind: 'spark' });
        }
    }
    updateCam(dt) {
        const [p, a] = this.f;
        const dist = Math.abs(p.x - a.x);
        let tz = 1.04 + Math.max(0, 420 - dist) / 1900 + this.punch;
        let tx = (p.x + a.x) / 2;
        if (this.koFocus >= 0 && this.phase !== 'intro') {
            tz = 1.38;
            tx = this.f[this.koFocus].x;
        }
        const k = 1 - Math.exp(-7 * dt);
        this.camZ = lerp(this.camZ, tz, k);
        this.camX = lerp(this.camX, tx, k);
        this.camY = lerp(this.camY, GROUND - 170, k);
    }
    /** savaşçılar iç içe geçmesin */
    separate(p, a) {
        const gap = a.x - p.x;
        const min = 92;
        if (Math.abs(gap) >= min)
            return;
        const push = (min - Math.abs(gap)) / 2;
        const dir = gap >= 0 ? 1 : -1;
        p.x = Math.max(70, p.x - dir * push);
        a.x = Math.min(W - 70, a.x + dir * push);
    }
    endRound() {
        const [p, a] = this.f;
        let w = -1;
        if (p.hp > a.hp)
            w = 0;
        else if (a.hp > p.hp)
            w = 1;
        if (w >= 0)
            this.wins[w]++;
        else {
            this.wins[0]++;
            this.wins[1]++;
        }
        this.msg = p.ko || a.ko ? 'K.O.' : T('SÜRE DOLDU');
        this.msgT = 0;
        if (w === 0)
            p.win = true;
        else if (w === 1)
            a.win = true;
        this.phase = 'roundEnd';
        this.phaseT = 2.8;
        audio.play(w === 0 ? 'boss' : 'kill');
    }
    updateBolts(dt) {
        for (const b of this.bolts) {
            b.t -= dt;
            b.x += b.vx * dt;
            const tgt = this.f[b.owner === 0 ? 1 : 0];
            const src = this.f[b.owner];
            if (tgt.ko)
                continue;
            if (Math.abs(b.x - tgt.x) < 42 && Math.abs(b.y - (tgt.y - 95)) < 95) {
                b.t = 0;
                this.hurt(tgt, src, b.dmg, b.stun, 220, b.x, b.y);
            }
        }
        for (const b of this.bolts)
            for (const o of this.bolts)
                if (b !== o && b.owner !== o.owner && Math.abs(b.x - o.x) < 30) {
                    b.t = 0;
                    o.t = 0;
                    this.burst(b.x, b.y, 1.2, '#ffffff', 0);
                }
        this.bolts = this.bolts.filter((b) => b.t > 0 && b.x > -40 && b.x < W + 40);
    }
    /** rakip cadının yapay zekâsı: oyuncuyla aynı can/hasar; kararları kısa tepki süresiyle verir */
    think(a, p, dt) {
        const out = { dir: 0, block: false, move: null };
        if (!this.canAct(a)) {
            this.aiBlock = 0;
            return out;
        }
        const dx = p.x - a.x;
        const dist = Math.abs(dx);
        const toward = Math.sign(dx);
        this.aiBlock = Math.max(0, this.aiBlock - dt);
        if (this.aiBlock > 0) {
            out.block = true;
            return out;
        }
        this.aiT -= dt;
        const inc = this.bolts.find((b) => b.owner === 0 && Math.sign(a.x - b.x) === Math.sign(b.vx) && Math.abs(a.x - b.x) < 240);
        if (inc && this.aiT <= 0) {
            this.aiT = 0.25;
            if (Math.random() < 0.15 + 0.5 * this.o.level) {
                this.aiBlock = 0.5;
                out.block = true;
                return out;
            }
        }
        if (p.move && p.move !== 'special' && dist < 150 && this.aiT <= 0 && Math.random() < 0.1 + 0.35 * this.o.level) {
            this.aiT = 0.3;
            this.aiBlock = 0.45;
            out.block = true;
            return out;
        }
        if (this.aiT <= 0) {
            this.aiT = (0.22 + Math.random() * 0.3) * (1.5 - 0.5 * this.o.level);
            if (dist > 300 && a.sp <= 0 && Math.random() < 0.2 + 0.35 * this.o.level) {
                out.move = 'special';
                return out;
            }
            if (dist > ENGAGE + 14)
                this.aiMove = 'approach';
            else {
                const r = Math.random();
                if (r < 0.46) {
                    out.move = 'punch';
                    this.aiT = 0.4 + Math.random() * 0.3;
                }
                else if (r < 0.74) {
                    out.move = 'kick';
                    this.aiT = 0.55 + Math.random() * 0.3;
                }
                else if (r < 0.88)
                    this.aiMove = 'back';
                else
                    this.aiMove = 'hold';
            }
            if (out.move)
                return out;
        }
        out.dir = this.aiMove === 'approach' ? toward : this.aiMove === 'back' ? -toward : 0;
        if (this.aiMove === 'back' && dist > 220)
            this.aiMove = 'approach';
        return out;
    }
    // ---- çizim: uzuvlar ----
    /** konik uzuv: başlangıç ve bitiş kalınlığı farklı, koyu dış çizgi + gradyan dolgu */
    seg(x0, y0, x1, y1, w0, w1, col0, col1) {
        const c = this.c;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L;
        const ny = dx / L;
        const g = c.createLinearGradient(x0 + nx * w0 / 2, y0 + ny * w0 / 2, x0 - nx * w0 / 2, y0 - ny * w0 / 2);
        g.addColorStop(0, col0);
        g.addColorStop(1, col1);
        c.beginPath();
        c.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
        c.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
        c.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
        c.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
        c.arc(x0, y0, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
        c.closePath();
        c.fillStyle = g;
        c.fill();
        c.lineJoin = 'round';
        c.lineWidth = 2.6;
        c.strokeStyle = OUTLINE;
        c.stroke();
    }
    limb2(x0, y0, l1, a1, l2, a2) {
        const x1 = x0 + Math.sin(a1) * l1;
        const y1 = y0 + Math.cos(a1) * l1;
        return { x1, y1, x2: x1 + Math.sin(a1 + a2) * l2, y2: y1 + Math.cos(a1 + a2) * l2 };
    }
    /** savaşçı gövdesi. opts: pose (hayalet), alpha, reflect (zemin yansıması: gölge/efekt yok) */
    /** boyalı kare takımı hazır mı (çırak: fgt_a_, rakip: fgt_r_); hazır değilse çizim kodla yapılır */
    charPrefix(f) { return f.side === 1 && this.o.foeHue === RIVAL_HUE ? 'fgt_r_' : 'fgt_a_'; }
    spritesReady(pre) {
        for (const n of ['idle1', 'idle2', 'punch1', 'punch2', 'punch3', 'kick1', 'kick2', 'kick3', 'def1', 'def2', 'def3'])
            if (!this.spr(pre + n))
                return false;
        return true;
    }
    /** durumdan boyalı kare adı */
    frameName(f) {
        const pre = this.charPrefix(f);
        const walk = pre === 'fgt_a_' ? 'witch_walk' : 'fgt_r_walk';
        const cast = pre === 'fgt_a_' ? 'witch_cast' : 'fgt_r_cast';
        if (f.ko)
            return pre + (f.t < 0.32 ? 'def2' : 'def3');
        if (f.win)
            return pre + 'win' + (1 + (Math.floor(f.t * 2.2) % 2));
        if (f.stun > 0 && f.hurtT > 0)
            return pre + 'def2';
        if (f.block)
            return pre + 'def1';
        if (f.move === 'punch') {
            const k = f.moveT / MOVES.punch.dur;
            return pre + (k < 0.3 ? 'punch1' : k < 0.62 ? 'punch2' : 'punch3');
        }
        if (f.move === 'kick') {
            const k = f.moveT / MOVES.kick.dur;
            return pre + (k < 0.34 ? 'kick1' : k < 0.64 ? 'kick2' : 'kick3');
        }
        if (f.move === 'special')
            return f.moveT < SPECIAL.dur * 0.32 ? cast + '1' : cast + '2';
        if (Math.abs(f.vx) > 20)
            return walk + (1 + (Math.floor(f.walk * 9) % 4));
        return pre + 'idle' + (1 + (Math.floor(f.t * 2.2) % 2));
    }
    /** boyalı karakteri çizer; kare takımı eksikse false döner (kodla çizilen karaktere düşülür) */
    drawSpriteBody(f, opts) {
        const pre = this.charPrefix(f);
        if (!this.spritesReady(pre))
            return false;
        let name = opts.frame ?? this.frameName(f);
        // rakip dışı savaşçılar çırak karelerini kendi tonlarıyla çizer
        const tint = pre === 'fgt_a_' && f.hue ? '@' + (((f.hue % 360) + 360) % 360) : '';
        const img = this.spr(name + tint) ?? this.spr(name);
        if (!img) {
            name = pre + 'idle1';
            return false;
        }
        const c = this.c;
        const fx = opts.x ?? f.x;
        const face = opts.face ?? f.face;
        const sc = 1.0;
        const dw = 256 * sc;
        if (opts.alpha !== undefined)
            c.globalAlpha = opts.alpha;
        if (!opts.reflect && !opts.ghost) {
            c.fillStyle = 'rgba(0,0,0,0.42)';
            c.beginPath();
            c.ellipse(fx, GROUND + 5, 62, 12, 0, 0, Math.PI * 2);
            c.fill();
        }
        c.save();
        c.translate(fx, f.y + 8);
        // yumuşak nefes / vuruş ezilmesi
        const idle = !f.move && !f.ko && !f.win && f.stun <= 0 && Math.abs(f.vx) < 20;
        const breath = idle ? 1 + Math.sin(f.t * 3.4) * 0.012 : 1;
        const hit = f.hurtT > 0 ? 1 - Math.min(0.08, f.hurtT * 0.3) : 1;
        const koFall = f.ko && f.t < 0.32 ? (1 - f.t / 0.32) * 0.2 : 0;
        c.scale(face * (1 + (1 - hit) * 0.6), breath * hit);
        c.rotate(-koFall * face);
        if (f.flash > 0 && !opts.ghost && 'filter' in c)
            c.filter = 'brightness(2.3) saturate(0.4)';
        c.drawImage(img, -dw / 2, -248 * sc, dw, 256 * sc);
        c.filter = 'none';
        c.restore();
        c.globalAlpha = 1;
        // büyü toplanırken elde parlayan küre
        if (f.move === 'special' && f.moveT < SPECIAL.spawn + 0.1 && !opts.reflect && !opts.ghost) {
            const k = Math.min(1, f.moveT / SPECIAL.spawn);
            const r = 10 + k * 28;
            const ox = f.x + f.face * 72;
            const oy = f.y - 112;
            c.save();
            c.globalCompositeOperation = 'lighter';
            const og = c.createRadialGradient(ox, oy, 2, ox, oy, r + 10);
            og.addColorStop(0, '#ffffff');
            og.addColorStop(0.35, f.side === 1 ? 'rgba(120,255,170,0.85)' : 'rgba(190,150,255,0.85)');
            og.addColorStop(1, 'rgba(120,80,255,0)');
            c.fillStyle = og;
            c.beginPath();
            c.arc(ox, oy, r + 10, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
        return true;
    }
    drawFighter(f, opts = {}) {
        const c = this.c;
        const rival = f.side === 1;
        const hue = 265 + (f.hue || 0);
        const pz = opts.pose ?? poseOf(f);
        const fx = opts.x ?? f.x;
        const face = opts.face ?? f.face;
        const robeL = hsl(hue, 58, rival ? 46 : 54);
        const robeD = hsl(hue, 60, rival ? 24 : 30);
        const robeBack = hsl(hue, 55, 20);
        const trim = rival ? '#8fffb0' : '#ffd86b';
        const hat0 = hsl(hue, 52, 40);
        const hat1 = hsl(hue, 55, 24);
        const skin = rival ? '#b9e8a0' : '#f6d0ae';
        const skinD = rival ? '#82c06c' : '#d9a982';
        const hair = rival ? '#264a2c' : '#5a3524';
        const boot = '#3b2418';
        const sway = clampSway(f.vx) + Math.sin(f.t * 3.4) * 1.6;
        if (opts.alpha !== undefined)
            c.globalAlpha = opts.alpha;
        const sprite = this.drawSpriteBody(f, opts);
        if (!sprite) {
            // gölge
            if (!opts.reflect && !opts.ghost) {
                c.fillStyle = 'rgba(0,0,0,0.42)';
                c.beginPath();
                c.ellipse(fx, GROUND + 5, 66 - pz.bob * 0.5, 13, 0, 0, Math.PI * 2);
                c.fill();
            }
            c.save();
            c.translate(fx, f.y);
            c.scale(face * 1.12, 1.12);
            const legLen = 24;
            const hipY = -(legLen * 2) + pz.crouch + pz.bob;
            const shY = hipY - 50;
            c.translate(0, hipY);
            c.rotate(pz.lean);
            c.translate(0, -hipY);
            if (f.flash > 0 && !opts.ghost && 'filter' in c)
                c.filter = 'brightness(2.3) saturate(0.4)';
            // pelerin (arkada, rüzgârda dalgalanır)
            const flutter = Math.sin(f.t * 6) * 3 + sway * 1.6 + (f.move ? -10 : 0);
            c.beginPath();
            c.moveTo(-14, shY + 4);
            c.quadraticCurveTo(-38 + flutter, shY + 30, -46 + flutter * 1.6, hipY + 34);
            c.lineTo(-16, hipY + 20);
            c.closePath();
            c.fillStyle = robeBack;
            c.fill();
            c.lineWidth = 2.4;
            c.strokeStyle = OUTLINE;
            c.stroke();
            // saç (at kuyruğu)
            c.beginPath();
            c.moveTo(-10, shY - 22);
            c.bezierCurveTo(-38 + flutter, shY - 22, -52 + flutter * 1.4, shY + 8, -36 + flutter * 2, shY + 40);
            c.lineWidth = 11;
            c.lineCap = 'round';
            c.strokeStyle = hair;
            c.stroke();
            c.lineWidth = 3;
            c.strokeStyle = 'rgba(255,255,255,0.18)';
            c.stroke();
            // arka kol + bacak
            const ba = this.limb2(-8, shY + 6, 22, pz.ba[0], 22, pz.ba[1]);
            this.seg(-8, shY + 6, ba.x1, ba.y1, 13, 11, robeD, robeBack);
            this.seg(ba.x1, ba.y1, ba.x2, ba.y2, 11, 14, robeD, robeBack);
            c.fillStyle = skinD;
            c.beginPath();
            c.arc(ba.x2, ba.y2, 6.5, 0, Math.PI * 2);
            c.fill();
            c.lineWidth = 2.2;
            c.strokeStyle = OUTLINE;
            c.stroke();
            const bl = this.limb2(-8, hipY, legLen, pz.bl[0], legLen, pz.bl[1]);
            this.seg(-8, hipY, bl.x1, bl.y1, 15, 12, '#6a5a82', '#3f3454');
            this.seg(bl.x1, bl.y1, bl.x2, bl.y2, 12, 9.5, '#5a4a72', '#2f2644');
            this.boot(bl.x2, bl.y2, boot);
            // asa (arka elde)
            c.save();
            c.translate(ba.x2 - 2, ba.y2);
            c.rotate(pz.staff);
            const wg = c.createLinearGradient(-4, 0, 4, 0);
            wg.addColorStop(0, '#8a5a30');
            wg.addColorStop(1, '#5a3a1c');
            c.strokeStyle = OUTLINE;
            c.lineWidth = 9;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(0, 26);
            c.lineTo(0, -64);
            c.stroke();
            c.strokeStyle = wg;
            c.lineWidth = 6;
            c.beginPath();
            c.moveTo(0, 26);
            c.lineTo(0, -64);
            c.stroke();
            const gemCol = rival ? '#7bffb0' : '#6fe3ff';
            c.fillStyle = gemCol;
            c.strokeStyle = OUTLINE;
            c.lineWidth = 2;
            c.beginPath();
            c.arc(0, -70, 9 + pz.glow * 4, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.7)';
            c.beginPath();
            c.arc(-3, -73, 3, 0, Math.PI * 2);
            c.fill();
            if (pz.glow > 0.15 && !opts.reflect) {
                c.globalCompositeOperation = 'lighter';
                const g = c.createRadialGradient(0, -70, 2, 0, -70, 44);
                g.addColorStop(0, rival ? 'rgba(160,255,190,0.9)' : 'rgba(170,235,255,0.9)');
                g.addColorStop(1, 'rgba(120,220,255,0)');
                c.fillStyle = g;
                c.beginPath();
                c.arc(0, -70, 44, 0, Math.PI * 2);
                c.fill();
                c.globalCompositeOperation = 'source-over';
            }
            c.restore();
            // cüppe
            const rg = c.createLinearGradient(0, shY, 0, hipY + 26);
            rg.addColorStop(0, robeL);
            rg.addColorStop(1, robeD);
            c.beginPath();
            c.moveTo(-17, shY);
            c.lineTo(17, shY);
            c.quadraticCurveTo(26 + sway * 0.4, hipY - 8, 36 + sway, hipY + 24);
            c.quadraticCurveTo(0, hipY + 32 + Math.sin(f.t * 5) * 1.5, -36 + sway, hipY + 24);
            c.quadraticCurveTo(-26 + sway * 0.4, hipY - 8, -17, shY);
            c.closePath();
            c.fillStyle = rg;
            c.fill();
            c.lineWidth = 3;
            c.strokeStyle = OUTLINE;
            c.stroke();
            // cüppe parlak kenar, kemer ve etek şeridi
            c.strokeStyle = 'rgba(255,255,255,0.18)';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(14, shY + 6);
            c.quadraticCurveTo(22, hipY - 6, 30 + sway, hipY + 18);
            c.stroke();
            c.fillStyle = trim;
            c.beginPath();
            c.moveTo(-36 + sway, hipY + 22);
            c.quadraticCurveTo(0, hipY + 30, 36 + sway, hipY + 22);
            c.lineTo(36 + sway, hipY + 26);
            c.quadraticCurveTo(0, hipY + 34, -36 + sway, hipY + 26);
            c.closePath();
            c.fill();
            c.fillStyle = hsl(hue + 25, 70, 62);
            c.fillRect(-19, hipY - 4, 38, 7);
            c.strokeStyle = OUTLINE;
            c.lineWidth = 1.8;
            c.strokeRect(-19, hipY - 4, 38, 7);
            c.fillStyle = trim;
            c.beginPath();
            c.arc(0, hipY - 0.5, 6, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            // baş
            const hx = Math.sin(pz.head) * 6;
            const hy = shY - 26;
            const attacking = f.move === 'punch' || f.move === 'kick';
            const hurtFace = f.hurtT > 0 || f.ko;
            c.fillStyle = hair;
            c.beginPath();
            c.arc(hx - 5, hy + 3, 25, 0, Math.PI * 2);
            c.fill();
            const hg = c.createRadialGradient(hx + 6, hy - 6, 3, hx, hy, 24);
            hg.addColorStop(0, skin);
            hg.addColorStop(1, skinD);
            c.fillStyle = hg;
            c.beginPath();
            c.arc(hx, hy, 22, 0, Math.PI * 2);
            c.fill();
            c.lineWidth = 3;
            c.strokeStyle = OUTLINE;
            c.stroke();
            // saç perçemi
            c.fillStyle = hair;
            c.beginPath();
            c.moveTo(hx - 21, hy - 6);
            c.quadraticCurveTo(hx - 2, hy - 30, hx + 20, hy - 12);
            c.quadraticCurveTo(hx + 4, hy - 12, hx - 8, hy - 2);
            c.closePath();
            c.fill();
            // yüz
            c.lineCap = 'round';
            if (hurtFace) {
                c.strokeStyle = '#2a1a3a';
                c.lineWidth = 3;
                c.beginPath();
                c.moveTo(hx + 4, hy - 5);
                c.lineTo(hx + 12, hy + 1);
                c.moveTo(hx + 12, hy - 5);
                c.lineTo(hx + 4, hy + 1);
                c.stroke();
            }
            else {
                c.fillStyle = '#fff';
                c.beginPath();
                c.ellipse(hx + 8, hy - 2, 5, attacking ? 5.5 : 5, 0, 0, Math.PI * 2);
                c.fill();
                c.lineWidth = 1.6;
                c.strokeStyle = OUTLINE;
                c.stroke();
                c.fillStyle = rival ? '#2cff72' : '#3a2a78';
                c.beginPath();
                c.arc(hx + 9.5, hy - 2, 2.9, 0, Math.PI * 2);
                c.fill();
                c.fillStyle = '#fff';
                c.beginPath();
                c.arc(hx + 10.5, hy - 3.2, 1, 0, Math.PI * 2);
                c.fill();
                if (rival && !opts.reflect && !opts.ghost) { // parlayan yeşil göz
                    c.globalCompositeOperation = 'lighter';
                    const eg = c.createRadialGradient(hx + 9.5, hy - 2, 1, hx + 9.5, hy - 2, 14);
                    eg.addColorStop(0, 'rgba(80,255,140,0.8)');
                    eg.addColorStop(1, 'rgba(80,255,140,0)');
                    c.fillStyle = eg;
                    c.beginPath();
                    c.arc(hx + 9.5, hy - 2, 14, 0, Math.PI * 2);
                    c.fill();
                    c.globalCompositeOperation = 'source-over';
                }
                c.strokeStyle = '#2a1a3a';
                c.lineWidth = 2.6;
                c.beginPath();
                c.moveTo(hx + 3, hy - 9 + (attacking ? 2 : 0));
                c.lineTo(hx + 13, hy - 8 - (attacking ? 3 : 0));
                c.stroke();
            }
            c.fillStyle = 'rgba(255,110,120,0.42)';
            c.beginPath();
            c.arc(hx + 13, hy + 6, 4.6, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#2a1a3a';
            c.lineWidth = 2.4;
            c.beginPath();
            if (attacking)
                c.ellipse(hx + 9, hy + 10, 4.5, 3.8, 0, 0, Math.PI * 2);
            else if (hurtFace) {
                c.moveTo(hx + 4, hy + 12);
                c.quadraticCurveTo(hx + 9, hy + 6, hx + 14, hy + 12);
            }
            else {
                c.moveTo(hx + 4, hy + 9);
                c.quadraticCurveTo(hx + 9, hy + 13, hx + 14, hy + 9);
            }
            c.stroke();
            // şapka
            const hatg = c.createLinearGradient(hx - 20, hy - 70, hx + 20, hy - 14);
            hatg.addColorStop(0, hat0);
            hatg.addColorStop(1, hat1);
            c.fillStyle = hat1;
            c.strokeStyle = OUTLINE;
            c.lineWidth = 4;
            c.beginPath();
            c.ellipse(hx, hy - 16, 38, 9.5, -0.05, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.fillStyle = hatg;
            const tip = Math.sin(f.t * 4) * 3 + pz.head * 20 + sway * 0.6;
            c.beginPath();
            c.moveTo(hx - 23, hy - 18);
            c.quadraticCurveTo(hx - 6, hy - 60, hx + 12 + tip, hy - 84);
            c.quadraticCurveTo(hx + 28 + tip, hy - 66, hx + 25, hy - 18);
            c.closePath();
            c.fill();
            c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.14)';
            c.beginPath();
            c.moveTo(hx - 14, hy - 22);
            c.quadraticCurveTo(hx - 4, hy - 52, hx + 8 + tip * 0.7, hy - 72);
            c.quadraticCurveTo(hx - 2, hy - 46, hx - 6, hy - 22);
            c.closePath();
            c.fill();
            c.fillStyle = trim;
            c.beginPath();
            c.moveTo(hx - 22, hy - 21);
            c.lineTo(hx + 24, hy - 22);
            c.lineTo(hx + 23, hy - 30);
            c.lineTo(hx - 21, hy - 29);
            c.closePath();
            c.fill();
            c.lineWidth = 2;
            c.stroke();
            c.fillStyle = '#fff';
            c.beginPath();
            c.arc(hx + 2, hy - 25.5, 3.4, 0, Math.PI * 2);
            c.fill();
            // ön bacak
            const fl = this.limb2(8, hipY, legLen, pz.fl[0], legLen, pz.fl[1]);
            this.seg(8, hipY, fl.x1, fl.y1, 16, 12.5, '#7a6a92', '#463a5e');
            this.seg(fl.x1, fl.y1, fl.x2, fl.y2, 12.5, 10, '#6a5a82', '#382e4e');
            this.boot(fl.x2, fl.y2, boot);
            // ön kol (kollu): yumruk eldiven gibi
            const fa = this.limb2(10, shY + 6, 22, pz.fa[0], 22, pz.fa[1]);
            this.seg(10, shY + 6, fa.x1, fa.y1, 14, 11.5, robeL, robeD);
            this.seg(fa.x1, fa.y1, fa.x2, fa.y2, 11.5, 15.5, robeL, robeD);
            c.fillStyle = trim;
            c.beginPath();
            c.arc(fa.x1, fa.y1, 4.5, 0, Math.PI * 2);
            c.fill();
            c.lineWidth = 2;
            c.strokeStyle = OUTLINE;
            c.stroke();
            const gl = c.createRadialGradient(fa.x2 - 2, fa.y2 - 2, 1, fa.x2, fa.y2, 9);
            gl.addColorStop(0, '#ffffff');
            gl.addColorStop(1, '#cfc8e6');
            c.fillStyle = gl;
            c.beginPath();
            c.arc(fa.x2, fa.y2, 8, 0, Math.PI * 2);
            c.fill();
            c.lineWidth = 2.4;
            c.strokeStyle = OUTLINE;
            c.stroke();
            // büyü toplanırken elde parlayan küre
            if (f.move === 'special' && f.moveT < SPECIAL.spawn + 0.1 && !opts.reflect && !opts.ghost) {
                const k = Math.min(1, f.moveT / SPECIAL.spawn);
                c.globalCompositeOperation = 'lighter';
                const r = 10 + k * 26;
                const og = c.createRadialGradient(fa.x2, fa.y2, 2, fa.x2, fa.y2, r + 8);
                og.addColorStop(0, '#ffffff');
                og.addColorStop(0.35, rival ? 'rgba(120,255,170,0.85)' : 'rgba(190,150,255,0.85)');
                og.addColorStop(1, 'rgba(120,80,255,0)');
                c.fillStyle = og;
                c.beginPath();
                c.arc(fa.x2, fa.y2, r + 8, 0, Math.PI * 2);
                c.fill();
                c.globalCompositeOperation = 'source-over';
            }
            c.filter = 'none';
            c.restore();
            c.globalAlpha = 1;
        }
        // saldırı yayı: ışık süpürmeli gradyan
        if (!opts.reflect && !opts.ghost && f.move && f.move !== 'special') {
            const md = MOVES[f.move];
            const k = (f.moveT - md.from * 0.7) / (md.to + 0.1 - md.from * 0.7);
            if (k > 0 && k < 1) {
                const cy = f.y - (f.move === 'kick' ? 64 : 108);
                const cx = f.x + f.face * md.reach * 0.45;
                const rad = md.reach * 0.5;
                c.save();
                c.globalCompositeOperation = 'lighter';
                const span = 1.7;
                const mid = f.face > 0 ? -0.1 + (f.move === 'kick' ? -0.5 + k * 1.0 : 0) : Math.PI + 0.1 - (f.move === 'kick' ? -0.5 + k * 1.0 : 0);
                for (let i = 0; i < 14; i++) {
                    const t0 = i / 14;
                    const a0 = mid - span / 2 * f.face + t0 * span * f.face;
                    const a1 = mid - span / 2 * f.face + (t0 + 1 / 14) * span * f.face;
                    c.strokeStyle = f.move === 'kick' ? `rgba(255,${190 + i * 4},120,${t0 * (1 - k) * 0.9})` : `rgba(255,255,255,${t0 * (1 - k) * 0.9})`;
                    c.lineWidth = (f.move === 'kick' ? 5 : 3) + t0 * (f.move === 'kick' ? 11 : 7);
                    c.beginPath();
                    c.arc(cx, cy, rad, a0, a1, f.face < 0);
                    c.stroke();
                }
                c.restore();
            }
        }
        // blok kalkanı: altıgen dalga
        if (!opts.reflect && !opts.ghost && (f.block || f.blockPulse > 0)) {
            const px = f.x + f.face * 48;
            const py = f.y - 92;
            const pulse = f.blockPulse > 0 ? f.blockPulse / 0.3 : 0;
            c.save();
            c.globalCompositeOperation = 'lighter';
            const gr = c.createRadialGradient(px - f.face * 20, py, 10, px, py, 76);
            gr.addColorStop(0, 'rgba(160,230,255,0.04)');
            gr.addColorStop(1, `rgba(120,220,255,${0.4 + pulse * 0.45})`);
            c.fillStyle = gr;
            c.strokeStyle = `rgba(190,245,255,${0.7 + pulse * 0.3})`;
            c.lineWidth = 3 + pulse * 4;
            c.beginPath();
            c.arc(px, py, 76, f.face > 0 ? -1.15 : Math.PI - 1.15, f.face > 0 ? 1.15 : Math.PI + 1.15);
            c.fill();
            c.stroke();
            // altıgen ağ çizgileri
            c.strokeStyle = `rgba(200,240,255,${0.18 + pulse * 0.3})`;
            c.lineWidth = 1.5;
            for (let i = -2; i <= 2; i++) {
                c.beginPath();
                c.arc(px, py, 76 - 16 * Math.abs(i), f.face > 0 ? -1.1 : Math.PI - 1.1, f.face > 0 ? 1.1 : Math.PI + 1.1);
                c.stroke();
            }
            c.restore();
        }
    }
    boot(x, y, col) {
        const c = this.c;
        const g = c.createLinearGradient(x, y - 8, x, y + 8);
        g.addColorStop(0, '#5a3a24');
        g.addColorStop(1, col);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x - 7, y - 6);
        c.lineTo(x + 6, y - 6);
        c.quadraticCurveTo(x + 22, y - 2, x + 20, y + 6);
        c.lineTo(x - 8, y + 7);
        c.closePath();
        c.fill();
        c.lineWidth = 2.4;
        c.strokeStyle = OUTLINE;
        c.stroke();
        c.fillStyle = '#1f130c';
        c.fillRect(x - 8, y + 4, 28, 3);
    }
    // ---- çizim: arayüz ----
    bar(x, w, f, right, name, wins) {
        const c = this.c;
        const k = Math.max(0, f.hp) / MAX_HP;
        const kt = Math.max(0, f.hpTrail) / MAX_HP;
        const skew = right ? -14 : 14;
        // çerçeve
        c.save();
        c.fillStyle = 'rgba(8,4,20,0.75)';
        c.strokeStyle = 'rgba(255,216,107,0.9)';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x + (right ? 0 : skew), 14);
        c.lineTo(x + w + (right ? skew * -1 : 0) + (right ? 0 : 0), 14);
        c.lineTo(x + w + (right ? 0 : -skew), 50);
        c.lineTo(x + (right ? skew * -1 : 0) + (right ? 0 : 0), 50);
        c.closePath();
        c.fill();
        c.stroke();
        c.clip();
        // geriden izleyen kırmızı hasar
        c.fillStyle = '#ff4a4a';
        if (right)
            c.fillRect(x + w * (1 - kt), 18, w * kt, 28);
        else
            c.fillRect(x, 18, w * kt, 28);
        // asıl can
        const g = c.createLinearGradient(0, 18, 0, 46);
        g.addColorStop(0, k > 0.3 ? '#fff29a' : '#ffb0b0');
        g.addColorStop(0.5, k > 0.3 ? '#5fe07a' : '#ff5a5a');
        g.addColorStop(1, k > 0.3 ? '#1f9a45' : '#a01818');
        c.fillStyle = g;
        if (right)
            c.fillRect(x + w * (1 - k), 18, w * k, 28);
        else
            c.fillRect(x, 18, w * k, 28);
        c.fillStyle = 'rgba(255,255,255,0.22)';
        if (right)
            c.fillRect(x + w * (1 - k), 18, w * k, 8);
        else
            c.fillRect(x, 18, w * k, 8);
        c.restore();
        c.font = 'bold 18px sans-serif';
        c.textAlign = right ? 'right' : 'left';
        c.lineWidth = 4;
        c.strokeStyle = 'rgba(0,0,0,0.85)';
        c.fillStyle = '#fff';
        c.strokeText(name, right ? x + w : x, 70);
        c.fillText(name, right ? x + w : x, 70);
        for (let i = 0; i < 2; i++) {
            const sx = right ? x + w - 12 - i * 28 : x + 12 + i * 28;
            const on = i < wins;
            c.fillStyle = on ? '#ffd84a' : 'rgba(255,255,255,0.22)';
            c.strokeStyle = on ? '#fff6c0' : 'rgba(255,255,255,0.35)';
            c.lineWidth = 2;
            c.beginPath();
            for (let j = 0; j < 5; j++) {
                const ang = -Math.PI / 2 + (j * 2 * Math.PI) / 5;
                const ang2 = ang + Math.PI / 5;
                c.lineTo(sx + Math.cos(ang) * 10, 90 + Math.sin(ang) * 10);
                c.lineTo(sx + Math.cos(ang2) * 4.4, 90 + Math.sin(ang2) * 4.4);
            }
            c.closePath();
            c.fill();
            c.stroke();
            if (on) {
                c.save();
                c.globalCompositeOperation = 'lighter';
                const sg = c.createRadialGradient(sx, 90, 2, sx, 90, 16);
                sg.addColorStop(0, 'rgba(255,230,120,0.6)');
                sg.addColorStop(1, 'rgba(255,230,120,0)');
                c.fillStyle = sg;
                c.beginPath();
                c.arc(sx, 90, 16, 0, Math.PI * 2);
                c.fill();
                c.restore();
            }
        }
    }
    /** seyirci siluetleri: ritimle zıplar, coşkuyla kollarını kaldırır; arada flaş patlar */
    drawCrowd() {
        const c = this.c;
        const hype = 1 + this.excite * 1.4;
        for (let row = 0; row < 2; row++) {
            for (let i = 0; i < 22; i++) {
                const x = (i * 46 + row * 23 + (row ? 8 : -6)) % (W + 40) - 10;
                const jump = Math.abs(Math.sin(this.clock * (3 + (i % 3)) * (0.8 + this.excite * 0.5) + i)) * (row ? 7 : 11) * hype;
                const y = H - 8 + row * 12 - jump;
                const h = 34 + (i % 4) * 4 + row * 6;
                c.fillStyle = row ? 'rgba(14,8,28,0.97)' : 'rgba(26,14,48,0.95)';
                c.beginPath();
                c.arc(x, y - h, 13, 0, Math.PI * 2);
                c.fill();
                c.fillRect(x - 14, y - h + 10, 28, h);
                if (i % 3 === 0 || this.excite > 0.6) {
                    c.fillRect(x - 21, y - h - 6 - jump * 0.3, 7, 24);
                    c.fillRect(x + 14, y - h - 12 - jump * 0.3, 7, 28);
                }
                if (i % 5 === 2) {
                    c.beginPath();
                    c.moveTo(x - 12, y - h - 11);
                    c.lineTo(x, y - h - 40);
                    c.lineTo(x + 12, y - h - 11);
                    c.closePath();
                    c.fill();
                }
            }
        }
    }
    drawFx() {
        const c = this.c;
        for (const q of this.parts) {
            const k = q.t / q.max;
            c.save();
            c.globalAlpha = Math.max(0, 1 - k);
            switch (q.kind) {
                case 'spark':
                    c.globalCompositeOperation = 'lighter';
                    c.strokeStyle = q.col;
                    c.lineWidth = q.size * (1 - k * 0.6);
                    c.lineCap = 'round';
                    c.beginPath();
                    c.moveTo(q.x, q.y);
                    c.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03);
                    c.stroke();
                    break;
                case 'ring':
                    c.globalCompositeOperation = 'lighter';
                    c.strokeStyle = q.col;
                    c.lineWidth = 6 * (1 - k) + 1;
                    c.beginPath();
                    c.arc(q.x, q.y, q.size * (0.25 + k), 0, Math.PI * 2);
                    c.stroke();
                    break;
                case 'glow': {
                    c.globalCompositeOperation = 'lighter';
                    const g = c.createRadialGradient(q.x, q.y, 1, q.x, q.y, q.size);
                    g.addColorStop(0, q.col);
                    g.addColorStop(1, 'rgba(255,255,255,0)');
                    c.fillStyle = g;
                    c.beginPath();
                    c.arc(q.x, q.y, q.size, 0, Math.PI * 2);
                    c.fill();
                    break;
                }
                case 'line':
                    c.globalCompositeOperation = 'lighter';
                    c.strokeStyle = q.col;
                    c.lineWidth = 3 * (1 - k) + 1;
                    c.lineCap = 'round';
                    c.beginPath();
                    c.moveTo(q.x + Math.cos(q.rot) * q.size * (0.3 + k), q.y + Math.sin(q.rot) * q.size * (0.3 + k));
                    c.lineTo(q.x + Math.cos(q.rot) * q.size * (0.9 + k * 1.2), q.y + Math.sin(q.rot) * q.size * (0.9 + k * 1.2));
                    c.stroke();
                    break;
                case 'dust':
                    c.fillStyle = q.col;
                    c.beginPath();
                    c.arc(q.x, q.y, q.size * (0.5 + k), 0, Math.PI * 2);
                    c.fill();
                    break;
                case 'chip':
                    c.fillStyle = q.col;
                    c.translate(q.x, q.y);
                    c.rotate(q.t * 12);
                    c.fillRect(-q.size / 2, -q.size / 2, q.size, q.size * 0.7);
                    break;
                case 'shard':
                    c.fillStyle = q.col;
                    c.translate(q.x, q.y);
                    c.rotate(q.rot + q.t * 8);
                    c.beginPath();
                    c.moveTo(0, -q.size * 1.4);
                    c.lineTo(q.size * 0.7, q.size * 0.8);
                    c.lineTo(-q.size * 0.7, q.size * 0.8);
                    c.closePath();
                    c.fill();
                    break;
                case 'confetti':
                    c.fillStyle = q.col;
                    c.translate(q.x, q.y);
                    c.rotate(q.rot);
                    c.fillRect(-q.size, -q.size * 0.3 * Math.abs(Math.sin(q.rot * 2)) - 1, q.size * 2, q.size * 0.6);
                    break;
            }
            c.restore();
        }
        // büyü topları: kuyruklu kuyruk + çekirdek
        for (const b of this.bolts) {
            const col = b.owner === 0 ? '200,170,255' : '120,255,170';
            c.save();
            c.globalCompositeOperation = 'lighter';
            for (let i = b.trail.length - 1; i >= 0; i--) {
                const t = b.trail[i];
                const r = 34 * (1 - i / b.trail.length) + 4;
                const g = c.createRadialGradient(t.x, t.y, 1, t.x, t.y, r);
                g.addColorStop(0, `rgba(${col},${0.55 * (1 - i / b.trail.length)})`);
                g.addColorStop(1, `rgba(${col},0)`);
                c.fillStyle = g;
                c.beginPath();
                c.arc(t.x, t.y, r, 0, Math.PI * 2);
                c.fill();
            }
            const gr = c.createRadialGradient(b.x, b.y, 2, b.x, b.y, 46);
            gr.addColorStop(0, 'rgba(255,255,255,1)');
            gr.addColorStop(0.35, `rgba(${col},0.85)`);
            gr.addColorStop(1, `rgba(${col},0)`);
            c.fillStyle = gr;
            c.beginPath();
            c.arc(b.x, b.y, 46, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }
    draw() {
        const c = this.c;
        const [p, a] = this.f;
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.filter = 'none';
        c.clearRect(0, 0, W, H);
        // kamera: iki savaşçının ortası, yakınlaştıkça sıkı çerçeve; görüntü alanı arka planın dışına çıkmaz
        const z = this.camZ;
        const cx = clamp(this.camX, W / (2 * z), W - W / (2 * z));
        const cy = clamp(this.camY, H / (2 * z), H - H / (2 * z));
        const sh = this.shake > 0 ? [(Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake] : [0, 0];
        c.translate(W / 2 + sh[0], H / 2 + sh[1]);
        c.scale(z, z);
        c.translate(-cx, -cy);
        // arena arka planı (görsel yoksa renk geçişi)
        if (this.bgImg)
            c.drawImage(this.bgImg, 0, 0, W, H);
        else {
            const g = c.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, '#0b0620');
            g.addColorStop(0.7, this.bg());
            g.addColorStop(1, '#05030c');
            c.fillStyle = g;
            c.fillRect(0, 0, W, H);
            c.fillStyle = '#1a1030';
            c.fillRect(0, GROUND, W, H - GROUND);
        }
        // seyirci flaşları (fotoğraf makineleri)
        for (let i = 0; i < 9; i++) {
            const seed = Math.sin(i * 91.7 + Math.floor(this.clock * 5) * 12.9898) * 43758.5453;
            if (seed - Math.floor(seed) > 0.12 + this.excite * 0.2)
                continue;
            const fx = ((i * 211 + 90) % 880) + 40;
            const fy = 150 + ((i * 53) % 140);
            c.save();
            c.globalCompositeOperation = 'lighter';
            const fg = c.createRadialGradient(fx, fy, 0, fx, fy, 22);
            fg.addColorStop(0, 'rgba(255,255,255,0.95)');
            fg.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = fg;
            c.beginPath();
            c.arc(fx, fy, 22, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
        // süzülen ışıltılar
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 26; i++) {
            const t = (this.clock * 0.05 + i * 0.137) % 1;
            const mx = ((i * 337) % W) + Math.sin(this.clock + i) * 20;
            const my = H * (1 - t);
            c.fillStyle = `rgba(190,170,255,${0.35 * Math.sin(t * Math.PI)})`;
            c.beginPath();
            c.arc(mx, my, 1.4 + (i % 3), 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
        // sahne ışığı
        const mid = (p.x + a.x) / 2;
        const sp = c.createRadialGradient(mid, GROUND - 40, 20, mid, GROUND - 40, 360);
        sp.addColorStop(0, 'rgba(255,240,200,0.24)');
        sp.addColorStop(1, 'rgba(255,240,200,0)');
        c.fillStyle = sp;
        c.fillRect(0, 0, W, H);
        // zemin yansıması
        for (const f of this.f) {
            c.save();
            c.beginPath();
            c.rect(0, GROUND + 4, W, H);
            c.clip();
            c.translate(0, GROUND * 2 + 8);
            c.scale(1, -1);
            c.globalAlpha = 0.16;
            this.drawFighter(f, { reflect: true });
            c.restore();
        }
        // hareket izi (hayalet kopyalar)
        for (const f of this.f)
            for (const g of f.ghost)
                this.drawFighter(f, { pose: g.pose, x: g.x, face: g.face, alpha: 0.08 + g.a * 0.2, ghost: true, frame: g.fr });
        // vuran önde
        if (p.move && !a.move) {
            this.drawFighter(a);
            this.drawFighter(p);
        }
        else {
            this.drawFighter(p);
            this.drawFighter(a);
        }
        this.drawFx();
        // hasar sayıları
        for (const pp of this.pops) {
            const k = pp.t / 0.9;
            const s = pp.size * (k < 0.15 ? 0.6 + k / 0.15 * 0.8 : 1.4 - k * 0.4);
            c.save();
            c.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
            c.font = `900 ${Math.round(s)}px sans-serif`;
            c.textAlign = 'center';
            c.lineWidth = 5;
            c.strokeStyle = 'rgba(0,0,0,0.9)';
            c.fillStyle = pp.col;
            const yy = pp.y - k * 60;
            c.strokeText(pp.text, pp.x, yy);
            c.fillText(pp.text, pp.x, yy);
            c.restore();
        }
        // seyirci ön planı
        this.drawCrowd();
        c.restore();
        // ---- arayüz (kameradan bağımsız) ----
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        // vignette
        const vg = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, `rgba(0,0,0,${0.45 + this.punch * 2})`);
        c.fillStyle = vg;
        c.fillRect(0, 0, W, H);
        if (this.flashA > 0.01) {
            c.fillStyle = `rgba(${this.flashCol},${this.flashA})`;
            c.fillRect(0, 0, W, H);
            if (this.flashA < 0.3)
                this.flashCol = '255,255,255';
        }
        this.bar(30, 380, p, false, this.heroName(), this.wins[0]);
        this.bar(550, 380, a, true, T(this.o.foeName), this.wins[1]);
        // süre
        c.fillStyle = 'rgba(8,4,20,0.8)';
        c.strokeStyle = 'rgba(255,216,107,0.95)';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(W / 2, 36, 30, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.font = '900 30px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = this.time < 10 ? '#ff7a7a' : '#fff';
        c.fillText(String(Math.max(0, Math.ceil(this.time))), W / 2, 47);
        // büyü bekleme çubuğu
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(30, 104, 150, 9);
        c.fillStyle = p.sp > 0 ? '#9b8bff' : '#6fe3ff';
        c.fillRect(30, 104, 150 * (p.sp > 0 ? 1 - p.sp / SPECIAL.cooldown : 1), 9);
        c.strokeStyle = 'rgba(255,255,255,0.5)';
        c.lineWidth = 1.5;
        c.strokeRect(30, 104, 150, 9);
        c.font = 'bold 12px sans-serif';
        c.textAlign = 'left';
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillText(T('Büyü') + ' ' + (p.sp > 0 ? p.sp.toFixed(1) + ' sn' : T('hazır')), 188, 113);
        // kombo sayacı
        if (this.combo >= 2) {
            const s = 1 + this.comboPop * 2.2;
            c.save();
            c.translate(40, 195);
            c.rotate(-0.05);
            c.scale(s, s);
            c.font = '900 44px sans-serif';
            c.textAlign = 'left';
            c.lineWidth = 7;
            c.strokeStyle = 'rgba(0,0,0,0.9)';
            const col = this.combo >= 6 ? '#ff5a5a' : this.combo >= 4 ? '#ff9a3c' : '#ffd84a';
            c.strokeText(this.combo + ' HIT!', 0, 0);
            c.fillStyle = col;
            c.fillText(this.combo + ' HIT!', 0, 0);
            c.font = 'bold 16px sans-serif';
            c.lineWidth = 4;
            c.strokeText(Math.round(this.comboDmg) + ' ' + T('hasar'), 2, 24);
            c.fillStyle = '#fff';
            c.fillText(Math.round(this.comboDmg) + ' ' + T('hasar'), 2, 24);
            c.restore();
        }
        // tur / dövüş / K.O. yazıları
        if (this.msg) {
            const k = clamp(this.msgT / 0.35, 0, 1);
            const big = this.msg === 'K.O.';
            const sc = big ? 1.5 - 0.5 * ease(k) + Math.sin(this.msgT * 3) * 0.02 : this.phase === 'fight' ? 1.8 - 0.8 * ease(k) : 0.5 + 0.5 * ease(k);
            const off = this.phase === 'intro' ? (1 - ease(k)) * -360 : 0;
            c.save();
            c.translate(W / 2 + off, 258);
            c.scale(sc, sc);
            c.globalAlpha = this.phase === 'intro' ? clamp(this.phaseT / 0.35, 0, 1) * k + (k >= 1 ? 0 : 0) : 1;
            if (this.phase === 'intro')
                c.globalAlpha = Math.min(1, k) * clamp(this.phaseT / 0.35, 0, 1);
            c.font = `900 ${big ? 120 : 76}px sans-serif`;
            c.textAlign = 'center';
            c.lineWidth = 11;
            c.strokeStyle = 'rgba(0,0,0,0.9)';
            c.strokeText(this.msg, 0, 0);
            const tg = c.createLinearGradient(0, -60, 0, 24);
            if (big) {
                tg.addColorStop(0, '#ffb0b0');
                tg.addColorStop(1, '#ff2a2a');
            }
            else {
                tg.addColorStop(0, '#fff6b0');
                tg.addColorStop(1, '#ffb02a');
            }
            c.fillStyle = tg;
            c.fillText(this.msg, 0, 0);
            c.restore();
        }
        if (this.phase === 'over') {
            c.font = 'bold 22px sans-serif';
            c.textAlign = 'center';
            c.lineWidth = 5;
            c.strokeStyle = 'rgba(0,0,0,0.85)';
            const t = this.won ? T('Dokun: devam') : T('Dokun: çık (kaleye dönünce tekrar denersin)');
            c.strokeText(t, W / 2, 330);
            c.fillStyle = '#fff';
            c.fillText(t, W / 2, 330);
        }
        c.restore();
    }
}
/** cüppe/etek dalgalanması: hıza göre geriye savrulur */
function clampSway(vx) { return clamp(-vx * 0.03, -6, 6); }
