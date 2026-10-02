import { BOSS_MUL, BRIDGE_HALF_WIDTH, CRYSTAL_STATS, CSTAT_KEYS, statIcon, DTYPES, DTYPE_NAMES, ENEMIES, EQUIP_NAMES, MAX_ENCHANT, MAX_ITEM_LEVEL, MAX_WEAPON_LEVEL, RARITIES, TIERS, UPGRADES, WEAPONS, ZONES, crystalValue, enchantChance, enchantCost, fmtNum, itemUpgradeCost, itemValue, upgradeCost, weaponLevelCopies, } from './data.js';
import { VERSION } from './version.js';
import { audio } from './audio.js';
import { Ambient, drawBridge, drawGateArt, drawShore, drawVignette, shade } from './scenery.js';
import { N, T } from './i18n.js';
import { settings, vibrate } from './settings.js';
const HOF_KEY = 'cadi-ciragi-hof';
/** adaya özel görseller (bellekte yalnızca yüklü adaların görselleri tutulur) */
const BIOME_ART = /^(ground|tree|boss|rock|bld)_/;
/** Evimiz: doğduğumuz yer ve hızlı iyileşme alanı */
export const HOME = { x: 0, y: 40, r: 150 };
const HOME_HEAL = 0.28; // saniyede azami canın oranı
const SAVE_KEY = 'cadi-ciragi-v6'; // v6: 40 adalık yeni dünya
const TREE_RESPAWN = 120;
/** canavar: boss'a göre can ve hasar ×2 → güç ×2 */
const BEAST_MUL = 2;
const CAMP_WEIGHT = { easy: 1, medium: 2, hard: 3, elite: 5, knight: 5, boss: 15 };
const GATE_GAP = 160; // kapı, bölge kıyısından bu kadar ileride
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.px = 0;
        this.py = 0;
        this.region = 0;
        this.hp = 100;
        this.invuln = 0;
        this.time = 0;
        this.skew = 0; // test için: gerçek zaman kaydırma (ms)
        this.enemies = [];
        this.projs = [];
        this.orbs = [];
        this.floaters = [];
        this.paused = false;
        this.dead = 0;
        this.banner = '';
        this.bannerT = 0;
        this.keys = new Set();
        this.joy = null;
        this.onChange = () => { };
        // animasyon / efekt durumu
        this.face = 0; // bakış yönü (radyan): haritadaki ok bunu gösterir
        this.moving = false;
        this.mapOpen = false;
        this.castPulse = 0;
        /** kamera yakınlığı: nişan mesafesi arttıkça uzaklaşır (1 = normal) */
        this.zoom = 1;
        this.vw = 0;
        this.vh = 0;
        /** süpürge uçuşu: kalan saniye; havadayken düşman zarar veremez */
        this.flyT = 0;
        this.flyMark = new WeakMap();
        this.puffs = [];
        this.puffT = 0;
        this.ambient = new Ambient();
        this.bossHealAcc = 0;
        this.bossHealShow = 0;
        /** kapı açılış animasyonu (bölge numarası, kalan süre) */
        this.gateAnim = null;
        this.hurtFlash = 0;
        this.deathFx = [];
        this.gains = [];
        this.healAcc = 0;
        this.healShow = 0;
        this.nowMs = Date.now();
        this.mini = { x: 0, y: 0, r: 0 };
        this.world = null;
        this.treeHp = new Map();
        this.cast = new Map();
        this.saveT = 0;
        this.w = 0;
        this.h = 0;
        this.sprites = new Map();
        this.tinted = new Map();
        this.rests = null;
        // ---- dünya: yalnızca önceki, şimdiki ve sonraki ada yüklüdür ----
        this.zoneCache = new Map();
        this.loaded = [];
        this.spawnerMap = new Map();
        /** "Yükleniyor…" yazısının kalan süresi */
        this.loadT = 0;
        this.pendingLoads = 0;
        this.loadingNames = new Set();
        this.treeCells = new Map();
        this.campsOf = new Map();
        this.houseFlash = new Map();
        this.weightCache = new Map();
        // ---- kale / bina hedefleri: boss kadar canlı, zarar vermez, yıkılınca canın %2'sini verir ----
        this.bldHp = new Map();
        this.bldFlash = new Map();
        this.onMaster = () => { };
        this.ctx = canvas.getContext('2d');
        // sahne içi bütün yazılar seçili dile çevrilir
        const c2 = this.ctx;
        const ft = c2.fillText.bind(c2);
        const st = c2.strokeText.bind(c2);
        c2.fillText = (t, x, y, w) => ft(N(T(String(t))), x, y, w);
        c2.strokeText = (t, x, y, w) => st(N(T(String(t))), x, y, w);
        this.loadSprites();
        this.save = this.load();
        this.px = this.save.x;
        this.py = this.save.y;
        this.hp = this.maxHp();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    // ---- görseller ----
    loadSprites() {
        fetch('assets/manifest.json')
            .then((r) => (r.ok ? r.json() : []))
            .then((names) => {
            // çekirdek görseller hemen; adaya özel görseller ensureLoaded ile, kartlar panelde kendi <img> ile yüklenir
            for (const n of names)
                if (!BIOME_ART.test(n) && !n.startsWith('card_') && n !== 'logo_title')
                    this.loadSprite(n);
        })
            .catch(() => { });
    }
    loadSprite(n) {
        if (this.sprites.has(n) || this.loadingNames.has(n))
            return;
        this.loadingNames.add(n);
        this.pendingLoads++;
        const img = new Image();
        img.onload = () => { this.sprites.set(n, img); this.loadingNames.delete(n); this.pendingLoads--; };
        img.onerror = () => { this.loadingNames.delete(n); this.pendingLoads--; };
        img.src = 'assets/' + n + '.png';
    }
    /** 'ad' ya da 'ad@renk' (renk = ton döndürme derecesi; her çeşit ada farklı renkte görünür) */
    spr(name) {
        const at = name.indexOf('@');
        if (at < 0)
            return this.sprites.get(name) ?? null;
        const hit = this.tinted.get(name);
        if (hit)
            return hit;
        const base = this.sprites.get(name.slice(0, at));
        if (!base)
            return null;
        const cv = document.createElement('canvas');
        cv.width = base.width;
        cv.height = base.height;
        const cx = cv.getContext('2d');
        if (!cx)
            return base;
        cx.drawImage(base, 0, 0);
        const img = cx.getImageData(0, 0, cv.width, cv.height);
        const d = img.data;
        const a = (Number(name.slice(at + 1)) * Math.PI) / 180;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        // YIQ benzeri ton döndürme matrisi (tarayıcıdan bağımsız, ctx.filter gerekmez)
        const m = [
            0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
            0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
            0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072,
        ];
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            d[i] = Math.max(0, Math.min(255, r * m[0] + g * m[1] + b * m[2]));
            d[i + 1] = Math.max(0, Math.min(255, r * m[3] + g * m[4] + b * m[5]));
            d[i + 2] = Math.max(0, Math.min(255, r * m[6] + g * m[7] + b * m[8]));
        }
        cx.putImageData(img, 0, 0);
        this.tinted.set(name, cv);
        return cv;
    }
    drawSpr(name, x, y, size, rot = 0) {
        const img = this.spr(name);
        if (!img)
            return false;
        const c = this.ctx;
        c.save();
        c.translate(x, y);
        if (rot)
            c.rotate(rot);
        c.drawImage(img, -size / 2, -size / 2, size, size);
        c.restore();
        return true;
    }
    // ---- kayıt ----
    fresh() {
        return {
            essence: 0, upgrades: {}, weapons: [1, 0, 0, 0], copies: [0, 0, 0, 0], loadout: [0], x: HOME.x, y: HOME.y + 70,
            bossDown: ZONES.map(() => false), hero: { id: 'h' + Date.now().toString(36), name: 'Çırak', born: Date.now() }, playSec: 0, first: {}, gw: {}, kills: 0, deaths: 0, geodes: 1, dust: 20, crystals: [], equipped: [], nextCrystal: 1,
            chests: [], seen: {}, train: {}, chestBonus: {}, items: [], eq: { helmet: 0, shield: 0 }, extra: [], nextItem: 1, spawn: {}, perm: {},
        };
    }
    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                const s = { ...this.fresh(), ...JSON.parse(raw) };
                while (s.bossDown.length < ZONES.length)
                    s.bossDown.push(false);
                if (!Array.isArray(s.extra))
                    s.extra = [];
                return s;
            }
        }
        catch (e) {
            console.error('kayıt okunamadı', e);
        }
        return this.fresh();
    }
    /** kayıtlı bir oyun var mı (açılış sayfası "Devam et" için) */
    static hasSave() {
        try {
            return !!localStorage.getItem(SAVE_KEY);
        }
        catch (e) {
            console.error('kayıt okunamadı', e);
            return false;
        }
    }
    /** kayıt özeti (açılış sayfası için) */
    static peekSave() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw)
                return null;
            const s = JSON.parse(raw);
            return { name: s.hero?.name ?? 'Çırak', islands: (s.bossDown ?? []).filter(Boolean).length, kills: s.kills ?? 0 };
        }
        catch (e) {
            console.error('kayıt okunamadı', e);
            return null;
        }
    }
    // ---- Şeref Salonu (bu cihazdaki kahramanlar) ----
    static loadHof() {
        try {
            return JSON.parse(localStorage.getItem(HOF_KEY) ?? '[]');
        }
        catch (e) {
            console.error('şeref salonu okunamadı', e);
            return [];
        }
    }
    /** sıralama: önce aşılan ada, sonra güç, sonra öldürme */
    static hofRanking() {
        return Game.loadHof().sort((a, b) => b.islands - a.islands || b.power - a.power || b.kills - a.kills).slice(0, 20);
    }
    updateHof() {
        if (this.save.kills === 0 && this.bossesDown() === 0)
            return; // hiç oynamayan kayıt listeye girmez
        const list = Game.loadHof();
        const e = {
            id: this.save.hero.id, name: this.save.hero.name, power: Math.max(this.fullPower(), list.find((x) => x.id === this.save.hero.id)?.power ?? 0),
            islands: this.bossesDown(), kills: this.save.kills, deaths: this.save.deaths, maxHp: this.maxHp(), born: this.save.hero.born,
            updated: Date.now(), version: VERSION,
        };
        const at = list.findIndex((x) => x.id === e.id);
        if (at >= 0)
            list[at] = e;
        else
            list.push(e);
        try {
            localStorage.setItem(HOF_KEY, JSON.stringify(list.slice(-60)));
        }
        catch (err) {
            console.error('şeref salonu yazılamadı', err);
        }
    }
    persist() {
        try {
            this.save.x = this.px;
            this.save.y = this.py;
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
            this.updateHof();
        }
        catch (e) {
            console.error('kayıt yazılamadı', e);
        }
    }
    /** yeni oyun: eski kahraman Şeref Salonu'nda kalır */
    newGame(name) {
        this.persist();
        this.resetSave();
        this.save.hero.name = name.trim().slice(0, 16) || 'Çırak';
        this.persist();
    }
    setHeroName(name) { this.save.hero.name = name.trim().slice(0, 16) || 'Çırak'; this.persist(); }
    resetSave() {
        localStorage.removeItem(SAVE_KEY);
        this.save = this.fresh();
        this.enemies = [];
        this.projs = [];
        this.orbs = [];
        this.treeHp.clear();
        this.cast.clear();
        this.gains = [];
        this.deathFx = [];
        this.px = this.save.x;
        this.py = this.save.y;
        this.region = this.regionAt(this.px, this.py);
        this.ensureLoaded(this.region);
        this.hp = this.maxHp();
        this.onChange();
    }
    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = Math.floor(this.w * dpr);
        this.canvas.height = Math.floor(this.h * dpr);
        this.canvas.style.width = this.w + 'px';
        this.canvas.style.height = this.h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    now() { return this.nowMs + this.skew; }
    /** ganimet/kazanç yazısı: efektli, sıraya girerek oyuncunun üstünde belirir */
    gain(text, color = '#ffe36b', icon = '', merge) {
        text = N(T(text));
        audio.play('gain');
        if (merge) {
            // aynı türden kısa aralıklı kazançlar tek satırda toplanır (+7, +7, +7 → +21)
            const same = this.gains.find((g) => g.key === merge.key && g.t > 1.0);
            if (same) {
                same.amount = (same.amount ?? 0) + merge.amount;
                same.text = N(T(merge.fmt(same.amount)));
                same.t = 1.9;
                return;
            }
        }
        const pending = this.gains.filter((g) => g.delay > 0).length;
        if (this.gains.length > 10)
            this.gains.shift();
        this.gains.push({ text, color, icon, t: 1.9, delay: pending * 0.14, key: merge?.key, amount: merge?.amount, fmt: merge?.fmt });
    }
    // ---- dünya: bölgeler, köprüler, kapılar ----
    regionCenter(r) {
        const z = ZONES[r];
        return { x: z.cx, y: z.cy, r: z.radius };
    }
    /** köprü i, bölge i ile i+1 arasını bağlar */
    bridge(i) {
        const a = this.regionCenter(i);
        const b = this.regionCenter(i + 1);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        return { ax: a.x, ay: a.y, bx: b.x, by: b.y, len, tGate: (a.r + GATE_GAP) / len };
    }
    /** dinlenme noktaları: ada 0'da ev, diğer adalarda giriş kampı (hızlı iyileşme, güvenli bölge, ölünce burada uyanılır) */
    restPoints() {
        if (this.rests)
            return this.rests;
        this.rests = ZONES.map((z, i) => {
            if (i === 0)
                return { x: HOME.x, y: HOME.y, r: HOME.r, reg: 0 };
            const b = this.bridge(i - 1);
            const t = (b.len - z.radius + 300) / b.len;
            return { x: b.ax + (b.bx - b.ax) * t, y: b.ay + (b.by - b.ay) * t, r: HOME.r, reg: i };
        });
        return this.rests;
    }
    restAt() {
        for (const p of this.restPoints())
            if (Math.hypot(this.px - p.x, this.py - p.y) < p.r)
                return p;
        return null;
    }
    inHome() { return this.restAt() !== null; }
    gateLocked(i) { return !this.save.bossDown[i]; }
    gatePos(i) {
        const b = this.bridge(i);
        return { x: b.ax + (b.bx - b.ax) * b.tGate, y: b.ay + (b.by - b.ay) * b.tGate };
    }
    /** (x,y) yürünebilir mi (kilitli kapının ötesi hariç) */
    /** kaya/bina engeli mi (oyuncu ve düşmanlar üzerinden geçemez) */
    blocked(x, y, pad = 12) {
        if (!this.world)
            return false;
        for (const o of this.world.obstacles)
            if (Math.hypot(o.x - x, o.y - y) < o.r + pad && !this.bldDown(o))
                return true;
        return false;
    }
    walkable(x, y, ignoreGates = false) {
        if (this.blocked(x, y))
            return false;
        for (let i = 0; i < ZONES.length; i++) {
            const c = this.regionCenter(i);
            if (Math.hypot(x - c.x, y - c.y) <= c.r - 18)
                return true;
        }
        for (let i = 0; i < ZONES.length - 1; i++) {
            const b = this.bridge(i);
            const dx = b.bx - b.ax;
            const dy = b.by - b.ay;
            const t = ((x - b.ax) * dx + (y - b.ay) * dy) / (b.len * b.len);
            if (t < 0 || t > 1)
                continue;
            const d = Math.hypot(x - (b.ax + dx * t), y - (b.ay + dy * t));
            if (d > BRIDGE_HALF_WIDTH)
                continue;
            if (!ignoreGates && this.gateLocked(i) && t > b.tGate)
                continue;
            return true;
        }
        return false;
    }
    regionAt(x, y) {
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i < ZONES.length; i++) {
            const c = this.regionCenter(i);
            const d = Math.hypot(x - c.x, y - c.y) / c.r;
            if (d < bd) {
                bd = d;
                best = i;
            }
        }
        return best;
    }
    /** adadaki kamp sayısı toplamı: kamp kimlikleri ada sırasına göre sabittir (kayıtla uyumlu) */
    spawnOffset(reg) {
        let n = 0;
        for (let i = 0; i < reg; i++)
            n += Object.values(ZONES[i].layout).reduce((a, b) => a + b, 0);
        return n;
    }
    /** bir adanın dünyasını üretir: kamplar, ağaçlar, sandıklar, engeller (kaya/bina) ve köprü bossları. Kimlikler adadan bağımsızdır. */
    genZone(reg) {
        const zone = ZONES[reg];
        const spawners = [];
        const trees = [];
        const chests = [];
        const lvRange = {
            easy: [0.35, 1.8], medium: [0.5, 3.5], hard: [0.8, 6], elite: [1.2, 9], knight: [1.2, 5], boss: [3, 6],
        };
        const base = this.spawnOffset(reg);
        const R = zone.radius;
        const rnd = rng(reg * 7919 + 13);
        const placed = [];
        const rest = this.restPoints()[reg];
        const clearOfHome = (p) => Math.hypot(p.x - rest.x, p.y - rest.y) > 330;
        const place = (minD, maxD, sep) => {
            for (let tries = 0; tries < 60; tries++) {
                const a = rnd() * Math.PI * 2;
                const d = minD + rnd() * (maxD - minD);
                const p = { x: zone.cx + Math.cos(a) * d, y: zone.cy + Math.sin(a) * d };
                if (clearOfHome(p) && placed.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > sep)) {
                    placed.push(p);
                    return p;
                }
            }
            const a = rnd() * Math.PI * 2;
            const p = { x: zone.cx + Math.cos(a) * maxD, y: zone.cy + Math.sin(a) * maxD };
            placed.push(p);
            return p;
        };
        const band = {
            easy: [240, R * 0.5], medium: [R * 0.3, R * 0.65], hard: [R * 0.5, R * 0.78],
            elite: [R * 0.55, R - 160], knight: [R * 0.4, R - 140], boss: [R * 0.7, R * 0.8],
        };
        Object.keys(zone.layout).forEach((tier) => {
            for (let i = 0; i < zone.layout[tier]; i++) {
                const p = place(band[tier][0], band[tier][1], 190);
                const kind = zone.enemies[Math.floor(rnd() * zone.enemies.length)];
                const [lo, hi] = lvRange[tier];
                spawners.push({
                    id: base + spawners.length, reg, x: p.x, y: p.y, tier, kind, lv: lo * Math.pow(hi / lo, rnd()),
                    tag: tier === 'knight' ? (i % 2 === 0 ? 'helmet' : 'shield') : undefined,
                });
            }
        });
        for (let i = 0; i < zone.resTrees; i++) {
            const p = place(160, R - 100, 120);
            trees.push({ id: reg * 1000 + trees.length, reg, x: p.x, y: p.y, s: 1.4, big: true });
        }
        for (let i = 0; i < 6; i++) {
            const p = place(200, R - 80, 160);
            chests.push({ id: reg * 6 + chests.length, reg, x: p.x, y: p.y, mode: i < 2 ? 'visible' : i < 4 ? 'hidden' : 'drop' });
        }
        // 'drop' sandıkları güçlü bir kampın yerine konur; o kamp ilk kez temizlenince ortaya çıkar
        const guards = spawners.filter((s) => s.tier === 'hard' || s.tier === 'elite' || s.tier === 'knight');
        chests.filter((ch) => ch.mode === 'drop').forEach((ch, k) => {
            const g = guards[(k * 2 + reg) % Math.max(1, guards.length)];
            if (g) {
                ch.x = g.x + 40;
                ch.y = g.y + 30;
                ch.src = g.id;
            }
            else
                ch.mode = 'visible';
        });
        // diğer bütün ağaçlar da kesilebilir (küçük ödül)
        for (let i = 0; i < 80 + Math.min(reg, 10) * 6; i++) {
            const a = rnd() * Math.PI * 2;
            const d = 60 + rnd() * (R - 100);
            const p = { x: zone.cx + Math.cos(a) * d, y: zone.cy + Math.sin(a) * d };
            if (!clearOfHome(p))
                continue;
            trees.push({ id: reg * 1000 + trees.length, reg, x: p.x, y: p.y, s: 0.7 + rnd() * 0.7, big: false });
        }
        // köprü bossları: bu adanın boss'u gibi, köprüde 2–3 tane (bir kez yenilir)
        if (reg < ZONES.length - 1) {
            const b = this.bridge(reg);
            const ux = (b.bx - b.ax) / b.len;
            const uy = (b.by - b.ay) / b.len;
            const s0 = zone.radius + 260;
            const s1 = b.len - ZONES[reg + 1].radius - 260;
            const n = s1 - s0 < 2200 ? 2 : 3;
            for (let k = 0; k < n; k++) {
                const sd = s0 + ((s1 - s0) * (k + 1)) / (n + 1);
                spawners.push({
                    id: 100000 + reg * 3 + k, reg, x: b.ax + ux * sd, y: b.ay + uy * sd, tier: 'boss', kind: zone.enemies[k % zone.enemies.length],
                    lv: 3 + k * 0.4, bridge: reg,
                });
            }
        }
        // engeller: kayalar ve binalar (üzerinden geçilemez, etrafından dolaşılır)
        const orng = rng(reg * 104729 + 7);
        const obstacles = [];
        const segs = [];
        if (reg > 0)
            segs.push({ ax: zone.cx, ay: zone.cy, bx: ZONES[reg - 1].cx, by: ZONES[reg - 1].cy });
        if (reg < ZONES.length - 1)
            segs.push({ ax: zone.cx, ay: zone.cy, bx: ZONES[reg + 1].cx, by: ZONES[reg + 1].cy });
        const nearSeg = (x, y, w) => segs.some((sg) => {
            const dx = sg.bx - sg.ax;
            const dy = sg.by - sg.ay;
            const t = Math.max(0, Math.min(1, ((x - sg.ax) * dx + (y - sg.ay) * dy) / (dx * dx + dy * dy)));
            return Math.hypot(x - (sg.ax + dx * t), y - (sg.ay + dy * t)) < w;
        });
        const nRocks = 16 + Math.floor(reg / 6);
        const nBld = 4 + Math.floor(reg / 10);
        for (let k = 0; k < nRocks + nBld; k++) {
            const bld = k >= nRocks;
            const r = bld ? 58 : 30 + orng() * 14;
            for (let tries = 0; tries < 80; tries++) {
                const a = orng() * Math.PI * 2;
                const d = 120 + orng() * (R - 260);
                const x = zone.cx + Math.cos(a) * d;
                const y = zone.cy + Math.sin(a) * d;
                if (Math.hypot(x - rest.x, y - rest.y) < 380)
                    continue;
                if (nearSeg(x, y, 210))
                    continue;
                if (spawners.some((s) => Math.hypot(s.x - x, s.y - y) < (s.tier === 'boss' ? 300 : 230)))
                    continue;
                if (chests.some((c) => Math.hypot(c.x - x, c.y - y) < 110))
                    continue;
                if (trees.some((t) => t.big && Math.hypot(t.x - x, t.y - y) < 100))
                    continue;
                if (obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 70))
                    continue;
                obstacles.push({
                    id: reg * 100 + obstacles.length, div: bld ? (k - nRocks) % 5 === 0 ? 1 : 2 + ((k - nRocks) % 4) : 1, x, y, r, kind: bld ? 'bld' : 'rock', art: bld ? zone.art.bld[k % 3] : zone.art.rock, size: bld ? 170 : r * 3.6, flip: orng() < 0.5 ? 1 : -1,
                });
                break;
            }
        }
        // canavar: her 3 adada bir (3., 6., 9. …), boss'un 2 katı güçte; boss yenilmeden de çıkar
        if ((reg + 1) % 3 === 0) {
            const bossSp = spawners.find((s) => s.tier === 'boss' && s.bridge === undefined);
            const brng = rng(reg * 15485863 + 11);
            // en uygun noktayı seç: kamplardan, sandıklardan, engellerden ve köprü yollarından uzak; uygun nokta yoksa en az kötü olan
            let best = { x: zone.cx + R * 0.35, y: zone.cy, score: -1e9 };
            for (let tries = 0; tries < 400; tries++) {
                const a = brng() * Math.PI * 2;
                const d = R * (0.15 + brng() * 0.6);
                const x = zone.cx + Math.cos(a) * d;
                const y = zone.cy + Math.sin(a) * d;
                let score = Math.min(...spawners.map((s) => Math.hypot(s.x - x, s.y - y) - 320));
                score = Math.min(score, Math.hypot(x - rest.x, y - rest.y) - 400, ...chests.map((c) => Math.hypot(c.x - x, c.y - y) - 120), ...obstacles.map((o) => Math.hypot(o.x - x, o.y - y) - o.r - 140));
                if (nearSeg(x, y, 230))
                    score = Math.min(score, -1);
                if (score > best.score)
                    best = { x, y, score };
                if (score >= 0)
                    break;
            }
            spawners.push({ id: 200000 + reg, reg, x: best.x, y: best.y, tier: 'boss', kind: bossSp ? bossSp.kind : zone.enemies[0], lv: bossSp ? bossSp.lv : 4, bridge: reg, beast: true });
        }
        return { spawners, trees, chests, obstacles };
    }
    /** bir adanın dünyası (yüklü değilse geçici üretilir, saklanmaz) */
    zoneWorld(reg) { return this.zoneCache.get(reg) ?? this.genZone(reg); }
    /** merkez adayla birlikte önceki ve sonraki adayı yükler, diğerlerini boşaltır */
    ensureLoaded(center) {
        const want = [center - 1, center, center + 1].filter((r) => r >= 0 && r < ZONES.length);
        if (want.length === this.loaded.length && want.every((r, i) => r === this.loaded[i]))
            return;
        const first = this.loaded.length === 0;
        for (const r of want)
            if (!this.zoneCache.has(r))
                this.zoneCache.set(r, this.genZone(r));
        for (const r of [...this.zoneCache.keys()]) {
            if (!want.includes(r)) {
                this.zoneCache.delete(r);
                this.campsOf.delete(r);
            }
        }
        this.loaded = want;
        this.enemies = this.enemies.filter((e) => want.includes(e.reg));
        this.projs = [];
        const spawners = [];
        const trees = [];
        const chests = [];
        const obstacles = [];
        for (const r of want) {
            const z = this.zoneCache.get(r);
            spawners.push(...z.spawners);
            trees.push(...z.trees);
            chests.push(...z.chests);
            obstacles.push(...z.obstacles);
        }
        this.world = { spawners, trees, chests, obstacles };
        this.spawnerMap = new Map(spawners.map((s) => [s.id, s]));
        this.treeCells.clear();
        for (const t of trees) {
            const k = this.cellKey(t.x, t.y);
            const a = this.treeCells.get(k);
            if (a)
                a.push(t);
            else
                this.treeCells.set(k, [t]);
        }
        // görseller: yalnızca yüklü adaların biyom görselleri bellekte tutulur
        const needed = new Set();
        for (const r of want) {
            const art = ZONES[r].art;
            for (const n of [art.ground, art.tree, art.boss, art.rock, ...art.bld])
                needed.add(n.split('@')[0]);
        }
        for (const n of needed)
            this.loadSprite(n);
        for (const n of [...this.sprites.keys()])
            if (BIOME_ART.test(n) && !needed.has(n))
                this.sprites.delete(n);
        for (const n of [...this.tinted.keys()])
            if (!needed.has(n.split('@')[0]))
                this.tinted.delete(n);
        if (!first)
            this.loadT = 1.1;
    }
    getWorld() {
        if (!this.world)
            this.ensureLoaded(this.regionAt(this.px, this.py));
        return this.world;
    }
    cellKey(x, y) { return Math.floor(x / 300) * 4096 + Math.floor(y / 300); }
    /** (x,y) çevresindeki ağaçlar (ızgara ile hızlı arama; 40 adalık dünyada binlerce ağaç var) */
    treesNear(x, y, r) {
        this.getWorld();
        const out = [];
        const x0 = Math.floor((x - r) / 300);
        const x1 = Math.floor((x + r) / 300);
        const y0 = Math.floor((y - r) / 300);
        const y1 = Math.floor((y + r) / 300);
        for (let cx = x0; cx <= x1; cx++)
            for (let cy = y0; cy <= y1; cy++) {
                const a = this.treeCells.get(cx * 4096 + cy);
                if (a)
                    for (const t of a)
                        out.push(t);
            }
        return out;
    }
    isCleared(key) { return (this.save.spawn[key] ?? 0) > this.now(); }
    /** kamp temiz mi: yenilen boss bir daha çıkmaz */
    spCleared(sp) { return this.isCleared('s' + sp.id) || (sp.tier === 'boss' && sp.bridge === undefined && this.save.bossDown[sp.reg]); }
    // ---- statlar ----
    lv(id) { return this.save.upgrades[id] ?? 0; }
    perm(k) { return this.save.perm[k] ?? 0; }
    cb(stat) {
        let v = this.save.chestBonus[stat] ?? 0;
        for (const id of this.save.equipped) {
            const c = this.save.crystals.find((x) => x.id === id);
            if (c && c.stat === stat)
                v += crystalValue(c.stat, c.rarity, c.enchant);
        }
        return v;
    }
    item(type) {
        const id = this.save.eq[type];
        return id ? this.save.items.find((x) => x.id === id) : undefined;
    }
    /** takılı eşyalar: ana yuva + ek yuvalardaki aynı türden eşyalar */
    worn(type) {
        const out = [];
        const main = this.item(type);
        if (main)
            out.push(main);
        for (const id of this.save.extra) {
            const it = this.save.items.find((x) => x.id === id);
            if (it && it.type === type)
                out.push(it);
        }
        return out;
    }
    isWorn(id) { return this.save.eq.helmet === id || this.save.eq.shield === id || this.save.extra.includes(id); }
    /** ekipman ek yuvası: her 10 aşılan adada bir */
    extraSlots() { return Math.floor(this.bossesDown() / 10); }
    helmetHp() { return this.worn('helmet').reduce((a, h) => a + itemValue('helmet', h.rarity, h.level), 0); }
    helmetRegen() { return this.worn('helmet').reduce((a, h) => a + (h.rarity >= 3 ? 1.5 * (h.rarity - 2) : 0), 0); }
    blockChance() { return Math.min(0.6, this.worn('shield').reduce((a, s) => a + (s.rarity >= 3 ? 0.08 * (s.rarity - 2) : 0), 0)); }
    typedReduction(t) {
        let v = 0;
        for (const s of this.worn('shield'))
            v += s.dtype === t ? itemValue('shield', s.rarity, s.level) : itemValue('shield', s.rarity, s.level) * 0.5;
        return v;
    }
    maxHp() {
        return (100 + this.perm('normal.hp') + this.perm('elite.hp') + this.perm('tree.hp')) * (1 + 0.2 * this.lv('hp'))
            * (1 + (this.cb('hp') + this.helmetHp() + this.perm('elite.hpPct') + this.perm('train.hp')) / 100);
    }
    regen() { return 0.6 * this.lv('regen') + this.cb('regen') + this.helmetRegen() + this.perm('tree.regen') + this.perm('train.regen'); }
    armor() { return Math.max(0.2, 1 - 0.04 * this.lv('armor')); }
    dmgMul() { return (1 + 0.12 * this.lv('dmg')) * (1 + (this.cb('dmg') + this.perm('elite.dmgPct') + this.perm('train.dmg')) / 100); }
    castSpeed() { return 1 + 0.08 * this.lv('spin'); }
    reachMul() { return 1 + 0.06 * this.lv('reach'); }
    magnet() { return 70 + 25 * this.lv('magnet') + this.cb('magnet'); }
    yieldMul() { return (1 + 0.1 * this.lv('yield')) * (1 + this.cb('yield') / 100); }
    speed() { return 150 * (1 + 0.04 * this.lv('speed')) * (1 + this.cb('speed') / 100) * (this.flyT > 0 ? 1.35 : 1); }
    critChance() { return Math.min(0.75, this.cb('crit') / 100); }
    lifesteal() { return Math.min(0.5, this.cb('lifesteal') / 100); }
    evasion() { return Math.min(0.6, this.cb('evasion') / 100); }
    weaponDmg(i) {
        return (WEAPONS[i].baseDmg * (1 + 0.15 * (this.save.weapons[i] - 1)) + this.perm('normal.dmg') + this.perm('elite.dmg')) * this.dmgMul();
    }
    weaponCopies(i) { return 1 + Math.min(3, Math.floor((this.save.weapons[i] - 1) / 5)); }
    zone() { return ZONES[this.region]; }
    bossesDown() { return this.save.bossDown.filter(Boolean).length; }
    /** kristal yuvası: 2'den başlar, boss'larla 4'e çıkar, her 10 adada bir yenisi eklenir */
    slots() { return Math.min(4, 2 + this.bossesDown()) + Math.floor(this.bossesDown() / 10); }
    weaponSlots() { return Math.min(4, 1 + this.bossesDown() + (this.save.kills >= 25 ? 1 : 0)); }
    chestsOpened(reg = this.region) {
        return this.getWorld().chests.filter((c) => c.reg === reg && this.save.chests.includes(c.id)).length;
    }
    equippedWeapons() {
        return this.save.loadout.filter((i) => this.save.weapons[i] > 0).slice(0, this.weaponSlots());
    }
    toggleWeapon(i) {
        const at = this.save.loadout.indexOf(i);
        if (at >= 0) {
            if (this.save.loadout.length > 1)
                this.save.loadout.splice(at, 1);
            else
                return false;
        }
        else if (this.save.weapons[i] > 0 && this.save.loadout.length < this.weaponSlots())
            this.save.loadout.push(i);
        else
            return false;
        this.persist();
        this.onChange();
        return true;
    }
    autoEquip(i) {
        if (!this.save.loadout.includes(i) && this.save.loadout.length < this.weaponSlots())
            this.save.loadout.push(i);
    }
    /** Güç: kuşanılan büyülerin saniyelik hasarı ile savunma düzeltmeli canın geometrik ortalaması. */
    /** tam canla güç (sıralama için) */
    fullPower() { return this.power(this.maxHp()); }
    power(hpNow = this.hp) {
        let dps = 0;
        for (const i of this.equippedWeapons())
            dps += (this.weaponDmg(i) * this.weaponCopies(i) * this.castSpeed()) / WEAPONS[i].cooldown;
        const red = (this.typedReduction('cut') + this.typedReduction('pierce') + this.typedReduction('smash')) / 3 / 100;
        // can azaldıkça güç de azalır: mevcut can esas alınır
        const effHp = Math.max(1, Math.min(hpNow, this.maxHp())) / (this.armor() * (1 - Math.min(0.9, red)));
        return Math.floor(Math.sqrt(effHp * Math.max(1, dps)) * 10);
    }
    enemyDmg(e) { return e.def.dmg * TIERS[e.tier].dmg * ZONES[e.reg].dmgScale * Math.sqrt(e.lv) * (e.beast ? BEAST_MUL : 1); }
    enemyPower(e) { return Math.floor(Math.sqrt(Math.max(1, e.hp) * (this.enemyDmg(e) / 0.6)) * 10); }
    weakness(e) { return DTYPES.reduce((b, t) => (e.def.resist[t] > e.def.resist[b] ? t : b), DTYPES[0]); }
    statLines() {
        const f = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1));
        const out = [
            { label: 'Güç', value: this.fmt(this.power()) },
            { label: 'Azami can', value: f(this.maxHp()) },
            { label: T('Kritik / Can çalma / Kaçınma'), value: `%${(this.critChance() * 100).toFixed(1)} / %${(this.lifesteal() * 100).toFixed(1)} / %${(this.evasion() * 100).toFixed(1)}` },
            { label: 'Yenilenme', value: f(this.regen()) + '/sn' },
            { label: 'Hasar çarpanı', value: '×' + this.dmgMul().toFixed(2) },
            { label: 'Alınan hasar çarpanı', value: '×' + this.armor().toFixed(2) },
        ];
        for (const t of DTYPES)
            out.push({ label: T(DTYPE_NAMES[t]) + ' ' + T('savunması'), value: '%' + this.typedReduction(t).toFixed(1) });
        out.push({ label: 'map.normal_mob', value: `+${f(this.perm('normal.hp'))} ${T('can')}, +${f(this.perm('normal.dmg'))} ${T('hasar')}` });
        out.push({ label: 'map.elite', value: `+${f(this.perm('elite.hp'))} ${T('can')}, +${f(this.perm('elite.dmg'))} ${T('hasar')}` });
        out.push({ label: 'map.tree', value: `+${f(this.perm('tree.hp'))} ${T('can')}, +${f(this.perm('tree.regen'))} ${T('yenilenme')}` });
        return out;
    }
    // ---- satın alma / yükseltme ----
    buyUpgrade(id) {
        const def = UPGRADES.find((u) => u.id === id);
        if (!def)
            return false;
        const lvl = this.lv(id);
        if (lvl >= def.max)
            return false;
        if (def.requires && this.lv(def.requires) < 1)
            return false;
        const cost = upgradeCost(def, lvl);
        if (this.save.essence < cost)
            return false;
        this.save.essence -= cost;
        this.save.upgrades[id] = lvl + 1;
        this.persist();
        this.onChange();
        return true;
    }
    weaponNeed(i) {
        return this.save.weapons[i] === 0 ? WEAPONS[i].unlockCopies : weaponLevelCopies(this.save.weapons[i]);
    }
    upgradeWeapon(i) {
        const lvl = this.save.weapons[i];
        const need = this.weaponNeed(i);
        if (lvl >= MAX_WEAPON_LEVEL || this.save.copies[i] < need)
            return false;
        this.save.copies[i] -= need;
        this.save.weapons[i] = lvl + 1;
        if (lvl === 0)
            this.autoEquip(i);
        this.persist();
        this.onChange();
        return true;
    }
    /** hangi paneller için yapılabilecek bir geliştirme var (oyunu kesmeyen "buraya tıkla" uyarısı için) */
    upgradeHints() {
        const s = this.save;
        const tree = UPGRADES.some((u) => {
            const l = this.lv(u.id);
            return l < u.max && (!u.requires || this.lv(u.requires) >= 1) && s.essence >= upgradeCost(u, l);
        });
        // yalnızca kullanılan (takılı) eşyalar için öneri: takılı olmayan büyü/ekipman/kristal geliştirme ipucu vermez; yeni büyü açmak serbest
        const weapons = WEAPONS.some((_, i) => s.weapons[i] < MAX_WEAPON_LEVEL && s.copies[i] >= this.weaponNeed(i) && (s.weapons[i] === 0 || s.loadout.includes(i)));
        const gear = s.items.some((it) => this.isWorn(it.id) && it.level < MAX_ITEM_LEVEL && s.essence >= itemUpgradeCost(it.level, it.rarity));
        const crystals = s.geodes >= 1 || (s.crystals.length > s.equipped.length && s.equipped.length < this.slots())
            || s.crystals.some((c) => s.equipped.includes(c.id) && c.enchant < MAX_ENCHANT && s.dust >= enchantCost(c.enchant));
        return { tree, weapons, gear, crystals };
    }
    // ---- kristaller ----
    openGeode() {
        if (this.save.geodes < 1)
            return null;
        this.save.geodes--;
        const total = RARITIES.reduce((s, r) => s + r.w, 0);
        let roll = Math.random() * total;
        let rarity = 0;
        for (let i = 0; i < RARITIES.length; i++) {
            roll -= RARITIES[i].w;
            if (roll <= 0) {
                rarity = i;
                break;
            }
        }
        const c = {
            id: this.save.nextCrystal++, rarity, stat: CSTAT_KEYS[Math.floor(Math.random() * CSTAT_KEYS.length)], enchant: 0,
        };
        this.save.crystals.push(c);
        this.persist();
        this.onChange();
        return c;
    }
    toggleCrystal(id) {
        const eq = this.save.equipped;
        const at = eq.indexOf(id);
        if (at >= 0)
            eq.splice(at, 1);
        else if (eq.length < this.slots())
            eq.push(id);
        else
            return false;
        this.hp = Math.min(this.hp, this.maxHp());
        this.persist();
        this.onChange();
        return true;
    }
    enchantCrystal(id) {
        const c = this.save.crystals.find((x) => x.id === id);
        if (!c)
            return 'poor';
        if (c.enchant >= MAX_ENCHANT)
            return 'max';
        const cost = enchantCost(c.enchant);
        if (this.save.dust < cost)
            return 'poor';
        this.save.dust -= cost;
        const ok = Math.random() < enchantChance(c.enchant);
        if (ok)
            c.enchant++;
        this.persist();
        this.onChange();
        return ok ? 'ok' : 'fail';
    }
    sellCrystal(id) {
        const c = this.save.crystals.find((x) => x.id === id);
        if (!c)
            return;
        this.save.dust += 6 * (1 + c.rarity) * (1 + c.enchant);
        this.save.crystals = this.save.crystals.filter((x) => x.id !== id);
        this.save.equipped = this.save.equipped.filter((x) => x !== id);
        this.persist();
        this.onChange();
    }
    // ---- miğfer / kalkan ----
    gainItem(type, minRarity = 0) {
        const w = [60, 25, 10, 4, 1];
        const total = w.reduce((s, x) => s + x, 0);
        let roll = Math.random() * total;
        let r = 0;
        for (let i = 0; i < w.length; i++) {
            roll -= w[i];
            if (roll <= 0) {
                r = i;
                break;
            }
        }
        const it = {
            id: this.save.nextItem++, type, rarity: Math.max(minRarity, r), level: 1, dtype: DTYPES[Math.floor(Math.random() * 3)],
        };
        // aynı türden (tür + nadirlik + hasar türü) eşya otomatik birleştirilir: eldekinin seviyesi artar
        const twin = this.save.items.find((x) => x.type === type && x.rarity === it.rarity && x.dtype === it.dtype);
        if (twin) {
            if (twin.level < MAX_ITEM_LEVEL)
                twin.level++;
            else
                this.save.dust += 8 * (1 + twin.rarity) * twin.level;
            this.save.nextItem--;
            this.gain(RARITIES[twin.rarity].name + ' ' + EQUIP_NAMES[type][twin.rarity] + ' birleştirildi (sv.' + twin.level + ')', RARITIES[twin.rarity].color, 'icon_' + type);
            this.persist();
            this.onChange();
            return twin;
        }
        this.save.items.push(it);
        this.gain(RARITIES[it.rarity].name + ' ' + EQUIP_NAMES[type][it.rarity] + ' (' + DTYPE_NAMES[it.dtype] + ') bulundu!', RARITIES[it.rarity].color, 'icon_' + type);
        // hemen kullanılabilir: yuva boşsa ya da yeni eşya daha güçlüyse anında kuşanılır
        const cur = this.save.items.find((x) => x.id === this.save.eq[type]);
        const freeExtra = this.save.extra.length < this.extraSlots();
        if (!cur || it.rarity * 100 + it.level > cur.rarity * 100 + cur.level) {
            if (cur && freeExtra)
                this.save.extra.push(cur.id); // eski ana eşya ek yuvaya geçer
            this.save.eq[type] = it.id;
            this.gain(EQUIP_NAMES[type][it.rarity] + ' kuşanıldı', '#ffe36b', 'icon_' + type);
        }
        else if (freeExtra) {
            this.save.extra.push(it.id);
            this.gain(EQUIP_NAMES[type][it.rarity] + ' kuşanıldı (ek yuva)', '#ffe36b', 'icon_' + type);
        }
        this.persist();
        this.onChange();
        return it;
    }
    toggleItem(id) {
        const it = this.save.items.find((x) => x.id === id);
        if (!it)
            return;
        if (this.save.eq[it.type] === id)
            this.save.eq[it.type] = 0;
        else if (this.save.extra.includes(id))
            this.save.extra = this.save.extra.filter((x) => x !== id);
        else if (!this.save.eq[it.type])
            this.save.eq[it.type] = id;
        else if (this.save.extra.length < this.extraSlots())
            this.save.extra.push(id);
        else
            this.save.eq[it.type] = id;
        this.hp = Math.min(this.hp, this.maxHp());
        this.persist();
        this.onChange();
    }
    upgradeItem(id) {
        const it = this.save.items.find((x) => x.id === id);
        if (!it || it.level >= MAX_ITEM_LEVEL)
            return false;
        const cost = itemUpgradeCost(it.level, it.rarity);
        if (this.save.essence < cost)
            return false;
        this.save.essence -= cost;
        it.level++;
        this.persist();
        this.onChange();
        return true;
    }
    sellItem(id) {
        const it = this.save.items.find((x) => x.id === id);
        if (!it)
            return;
        this.save.dust += 8 * (1 + it.rarity) * it.level;
        this.save.items = this.save.items.filter((x) => x.id !== id);
        if (this.save.eq[it.type] === id)
            this.save.eq[it.type] = 0;
        this.save.extra = this.save.extra.filter((x) => x !== id);
        this.persist();
        this.onChange();
    }
    // ---- simülasyon ----
    update(dt) {
        if (this.paused || this.mapOpen)
            return;
        this.nowMs = Date.now();
        this.time += dt;
        this.bannerT = Math.max(0, this.bannerT - dt);
        this.castPulse = Math.max(0, this.castPulse - dt);
        this.hurtFlash = Math.max(0, this.hurtFlash - dt);
        this.loadT = Math.max(0, this.loadT - dt);
        for (const [k, v] of this.bldFlash) {
            if (v <= dt)
                this.bldFlash.delete(k);
            else
                this.bldFlash.set(k, v - dt);
        }
        for (const g of this.gains) {
            if (g.delay > 0)
                g.delay -= dt;
            else
                g.t -= dt;
        }
        this.gains = this.gains.filter((g) => g.t > 0);
        for (const d of this.deathFx)
            d.t -= dt;
        this.deathFx = this.deathFx.filter((d) => d.t > 0);
        if (this.dead > 0) {
            this.dead -= dt;
            if (this.dead <= 0)
                this.respawn();
            return;
        }
        this.save.playSec += dt;
        this.flyT = Math.max(0, this.flyT - dt);
        if (this.gateAnim) {
            this.gateAnim.t -= dt;
            if (this.gateAnim.t <= 0)
                this.gateAnim = null;
        }
        this.movePlayer(dt);
        if (!this.walkable(this.px, this.py))
            this.snapToLand();
        this.updatePuffs(dt);
        this.updateZoom(dt);
        const reg0 = this.region;
        this.region = this.regionAt(this.px, this.py);
        if (this.region !== reg0) {
            audio.setMood(this.region);
            this.ensureLoaded(this.region);
        }
        const calm = !this.enemies.some((e) => e.state === 'chase');
        const atHome = this.inHome();
        const before = this.hp;
        this.hp = Math.min(this.maxHp(), this.hp + (this.regen() + (calm ? 0.03 * this.maxHp() : 0) + (atHome ? HOME_HEAL * this.maxHp() : 0)) * dt);
        if (atHome && this.hp > before) {
            this.healAcc += this.hp - before;
            this.healShow -= dt;
            if (this.healShow <= 0 && this.healAcc >= 1) {
                this.gain('+' + this.fmt(this.healAcc) + ' Can iyileşti (ev)', '#7bff9a', 'ui_heart');
                this.healAcc = 0;
                this.healShow = 1.1;
            }
        }
        if (this.inBossHouse()) {
            // boss evinin içi: hızlı iyileşme
            const b4 = this.hp;
            this.hp = Math.min(this.maxHp(), this.hp + 0.12 * this.maxHp() * dt);
            this.bossHealAcc += this.hp - b4;
            this.bossHealShow -= dt;
            if (this.bossHealShow <= 0 && this.bossHealAcc >= 1) {
                this.gain('+' + this.fmt(this.bossHealAcc) + ' Can iyileşti (boss evi)', '#7bff9a', 'ui_heart');
                this.bossHealAcc = 0;
                this.bossHealShow = 1.1;
            }
        }
        for (const [k, v] of this.houseFlash) {
            if (v <= dt)
                this.houseFlash.delete(k);
            else
                this.houseFlash.set(k, v - dt);
        }
        this.invuln = Math.max(0, this.invuln - dt);
        this.syncSpawners();
        this.updateEnemies(dt);
        this.castSpells(dt);
        this.updateProjs(dt);
        this.removeDead();
        this.checkChests();
        for (const f of this.floaters) {
            f.t -= dt;
            f.y -= 28 * dt;
        }
        this.floaters = this.floaters.filter((f) => f.t > 0);
        this.saveT += dt;
        if (this.saveT > 5) {
            this.saveT = 0;
            this.persist();
        }
    }
    /** yürüyüş tozu / uçuş parıltısı izi */
    updatePuffs(dt) {
        for (const p of this.puffs)
            p.t -= dt;
        this.puffs = this.puffs.filter((p) => p.t > 0);
        this.puffT -= dt;
        if (this.moving && this.puffT <= 0 && this.puffs.length < 40) {
            const fly = this.flyT > 0;
            this.puffT = fly ? 0.05 : 0.13;
            const bx = -Math.cos(this.face);
            const by = -Math.sin(this.face);
            this.puffs.push({ x: this.px + bx * 12 + (Math.random() - 0.5) * 8, y: this.py + (fly ? 22 : 16) + by * 6 + (Math.random() - 0.5) * 4, t: fly ? 0.5 : 0.45, fly });
        }
    }
    /** karakter asla oyun alanının dışında kalmaz: denizde, kilitli kapının ötesinde ya da engelin içindeyse en yakın yürünebilir noktaya alınır */
    snapToLand() {
        for (let r = 20; r <= 1200; r += 20) {
            for (let k = 0; k < 16; k++) {
                const a = (k / 16) * Math.PI * 2;
                const x = this.px + Math.cos(a) * r;
                const y = this.py + Math.sin(a) * r;
                if (this.walkable(x, y)) {
                    this.px = x;
                    this.py = y;
                    return;
                }
            }
        }
        const rp = this.restPoints()[this.regionAt(this.px, this.py)];
        this.px = rp.x;
        this.py = rp.y + 70;
    }
    movePlayer(dt) {
        let mx = 0;
        let my = 0;
        if (this.keys.has('a') || this.keys.has('arrowleft'))
            mx -= 1;
        if (this.keys.has('d') || this.keys.has('arrowright'))
            mx += 1;
        if (this.keys.has('w') || this.keys.has('arrowup'))
            my -= 1;
        if (this.keys.has('s') || this.keys.has('arrowdown'))
            my += 1;
        if (this.joy) {
            const dx = this.joy.x - this.joy.ox;
            const dy = this.joy.y - this.joy.oy;
            const d = Math.hypot(dx, dy);
            if (d > 8) {
                mx = dx / Math.max(d, 50);
                my = dy / Math.max(d, 50);
            }
        }
        const len = Math.hypot(mx, my);
        if (len > 1) {
            mx /= len;
            my /= len;
        }
        this.moving = len > 0.05;
        if (this.moving)
            this.face = Math.atan2(my, mx);
        const nx = this.px + mx * this.speed() * dt;
        const ny = this.py + my * this.speed() * dt;
        if (this.walkable(nx, ny)) {
            this.px = nx;
            this.py = ny;
        }
        else if (this.walkable(nx, this.py))
            this.px = nx;
        else if (this.walkable(this.px, ny))
            this.py = ny;
    }
    /** Temizlenmemiş kampları sahada tutar. Dalga yok: kamp yalnızca temizlenip süresi dolunca yeniden dolar. */
    syncSpawners() {
        // 40 adalık dünyada yalnızca yakındaki kamplar sahada tutulur; uzaklaşılan (dokunulmamış) kamplar kaldırılıp tam canla yeniden doğar
        const NEAR = 2400;
        const FAR = 3400;
        this.enemies = this.enemies.filter((e) => e.state !== 'idle' || e.hp < e.maxHp || Math.hypot(e.x - this.px, e.y - this.py) < FAR);
        const live = new Set();
        for (const e of this.enemies)
            live.add(e.sp);
        for (const sp of this.getWorld().spawners) {
            if (live.has(sp.id) || this.spCleared(sp) || this.bossSealed(sp))
                continue;
            if (Math.abs(sp.x - this.px) > NEAR || Math.abs(sp.y - this.py) > NEAR || Math.hypot(sp.x - this.px, sp.y - this.py) > NEAR)
                continue;
            this.spawnGroup(sp);
        }
    }
    spawnGroup(sp) {
        const zone = ZONES[sp.reg];
        const tier = TIERS[sp.tier];
        const def = ENEMIES[sp.kind];
        for (let i = 0; i < tier.count; i++) {
            const a = (i / tier.count) * Math.PI * 2 + sp.id;
            const x = sp.x + (tier.count > 1 ? Math.cos(a) * 46 : 0);
            const y = sp.y + (tier.count > 1 ? Math.sin(a) * 46 : 0);
            const maxHp = def.hp * tier.hp * zone.scale * sp.lv * (sp.beast ? BEAST_MUL : 1);
            this.enemies.push({ beast: sp.beast,
                def, tier: sp.tier, lv: sp.lv, reg: sp.reg, sp: sp.id, x, y, hx: x, hy: y, hp: maxHp, maxHp, state: 'idle', hitCd: 0,
                phase: Math.random() * 6, dashT: 3, dvx: 0, dvy: 0, flip: Math.random() < 0.5 ? 1 : -1, flash: 0, lunge: 0, moving: false,
            });
        }
    }
    updateEnemies(dt) {
        for (const e of this.enemies) {
            const dx = this.px - e.x;
            const dy = this.py - e.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 1500 && e.state === 'idle')
                continue; // uzaktaki kamplar uyur
            e.hitCd = Math.max(0, e.hitCd - dt);
            e.flash = Math.max(0, e.flash - dt);
            e.lunge = Math.max(0, e.lunge - dt);
            e.phase += dt;
            const big = e.tier === 'boss';
            const aggro = big ? 400 : 250 + (e.tier === 'elite' || e.tier === 'knight' ? 40 : 0);
            const leash = big ? 1000 : 480;
            const home = Math.hypot(e.hx - e.x, e.hy - e.y);
            if (d < 320 && !this.save.seen[e.def.id + (big ? '_boss' + e.reg : '')]) {
                this.save.seen[e.def.id + (big ? '_boss' + e.reg : '')] = 1;
                this.onChange();
            }
            const safe = this.inHome(); // ev güvenli bölge: düşmanlar içeri girmez
            if (safe && e.state === 'chase')
                e.state = 'return';
            if (e.state === 'idle' && d < aggro && !safe)
                e.state = 'chase';
            else if (e.state === 'chase' && (home > leash || d > aggro * 2.2))
                e.state = 'return';
            else if (e.state === 'return' && home < 8) {
                e.state = 'idle';
                e.stuckN = 0;
                e.noHeal = false;
                e.stuckT = 0;
            }
            let sp = e.def.speed;
            if (e.def.id === 'bat')
                sp *= 1 + 0.5 * Math.sin(e.phase * 5);
            let vx = 0;
            let vy = 0;
            if (e.state === 'chase') {
                if (big) {
                    e.dashT -= dt;
                    if (e.dashT < 0) {
                        e.dashT = 3.2;
                        e.dvx = (dx / d) * 360;
                        e.dvy = (dy / d) * 360;
                    }
                    if (e.dashT > 2.6) {
                        vx = e.dvx;
                        vy = e.dvy;
                    }
                    else {
                        vx = (dx / d) * sp;
                        vy = (dy / d) * sp;
                    }
                }
                else {
                    vx = (dx / d) * sp;
                    vy = (dy / d) * sp;
                }
            }
            else if (e.state === 'return') {
                vx = ((e.hx - e.x) / home) * sp * 1.6;
                vy = ((e.hy - e.y) / home) * sp * 1.6;
            }
            else {
                vx = Math.cos(e.phase * 0.8 + e.sp) * 6;
                vy = Math.sin(e.phase * 0.7 + e.sp) * 6;
            }
            const nx = e.x + vx * dt;
            const ny = e.y + vy * dt;
            const ox0 = e.x;
            const oy0 = e.y;
            if (this.walkable(nx, ny, true)) {
                e.x = nx;
                e.y = ny;
            }
            else if (this.walkable(nx, e.y, true))
                e.x = nx;
            else if (this.walkable(e.x, ny, true))
                e.y = ny;
            // iyileşme yalnızca gerçekten eve doğru ilerlerken olur (takılıp iyileşme yok)
            if (e.state === 'return' && !e.noHeal && Math.hypot(e.x - ox0, e.y - oy0) > 0.05)
                e.hp = Math.min(e.maxHp, e.hp + e.maxHp * (big ? 0.03 : 0.25) * dt);
            if (e.state === 'return') {
                // engele takıldı mı? 1.2 sn ilerleyemezse eve ışınlanır; tekrar olursa iyileşmesi durdurulur
                e.stuckT = (e.stuckT ?? 0) + dt;
                if (e.stuckT > 1.2) {
                    const moved = Math.hypot(e.x - (e.chkX ?? e.x), e.y - (e.chkY ?? e.y));
                    e.stuckT = 0;
                    e.chkX = e.x;
                    e.chkY = e.y;
                    if (moved < 20) {
                        e.stuckN = (e.stuckN ?? 0) + 1;
                        if (e.stuckN >= 2)
                            e.noHeal = true;
                        if (this.walkable(e.hx, e.hy, true)) {
                            e.x = e.hx;
                            e.y = e.hy;
                        }
                    }
                }
            }
            else {
                e.stuckT = 0;
                e.chkX = e.x;
                e.chkY = e.y;
            }
            e.moving = Math.abs(vx) + Math.abs(vy) > 14;
            if (Math.abs(vx) > 4)
                e.flip = vx > 0 ? 1 : -1;
            if (d < e.def.r * TIERS[e.tier].size + 14 && this.invuln <= 0 && this.flyT <= 0) {
                e.lunge = 0.25;
                if (Math.random() < this.blockChance()) {
                    this.invuln = 0.6;
                    this.float(this.px, this.py - 20, 'ENGEL', '#9be7ff');
                    continue;
                }
                if (Math.random() < this.evasion()) {
                    this.invuln = 0.6;
                    this.float(this.px, this.py - 20, 'KAÇTI', '#c8b6ff');
                    continue;
                }
                const hit = this.enemyDmg(e) * this.armor() * (1 - Math.min(0.9, this.typedReduction(e.def.atk) / 100));
                this.hp -= hit;
                this.hurtFlash = 0.25;
                audio.play('hurt');
                vibrate(35);
                this.invuln = 0.6;
                this.float(this.px, this.py - 20, '-' + this.fmt(hit), '#ff6b6b');
                if (this.hp <= 0) {
                    this.die();
                    return;
                }
            }
        }
    }
    // ---- büyüler ----
    /** en uzak kuşanılan büyünün nişan mesafesi */
    aimRange() {
        let r = 0;
        for (const i of this.equippedWeapons())
            r = Math.max(r, WEAPONS[i].range * this.reachMul());
        return r;
    }
    /** nişan mesafesi ekrana sığacak kadar kamera uzaklaşır (en fazla 0.5) */
    updateZoom(dt) {
        const half = Math.min(this.w, this.h) / 2;
        const target = Math.max(0.5, Math.min(1, (half * 0.94) / (this.aimRange() + 40)));
        this.zoom += (target - this.zoom) * Math.min(1, dt * 3);
    }
    /** (x,y) şu an ekranda mı (atış yalnızca ekrandaki hedeflere) */
    visible(x, y) {
        const hw = this.w / this.zoom / 2 - 24;
        const hh = this.h / this.zoom / 2 - 24;
        return Math.abs(x - this.px) < hw && Math.abs(y - this.py) < hh;
    }
    /** yazı boyu telafisi: kamera uzaklaşınca etiketler küçülmesin */
    lk() { return 1 / Math.sqrt(this.zoom); }
    nearestTarget(range) {
        let best = null;
        let bd = range;
        for (const e of this.enemies) {
            const d = Math.hypot(e.x - this.px, e.y - this.py);
            if (d < bd && this.visible(e.x, e.y)) {
                bd = d;
                best = { x: e.x, y: e.y };
            }
        }
        for (const s of this.bossHouses()) {
            const d = Math.hypot(s.x - this.px, s.y - this.py);
            if (d < bd && this.visible(s.x, s.y)) {
                bd = d;
                best = { x: s.x, y: s.y };
            }
        }
        if (best)
            return best;
        for (const o of this.liveBlds()) {
            const d = Math.hypot(o.x - this.px, o.y - this.py);
            if (d < bd && this.visible(o.x, o.y)) {
                bd = d;
                best = { x: o.x, y: o.y };
            }
        }
        if (best)
            return best;
        for (const t of this.treesNear(this.px, this.py, range)) {
            if (this.isCleared('t' + t.id))
                continue;
            const d = Math.hypot(t.x - this.px, t.y - this.py);
            if (d < Math.min(bd, range * 0.8) && this.visible(t.x, t.y)) {
                bd = d;
                best = { x: t.x, y: t.y };
            }
        }
        return best;
    }
    newProj(kind, x, y, dmg, dtype) {
        return { kind, x, y, vx: 0, vy: 0, sx: x, sy: y, tx: x, ty: y, dmg, dtype, life: 0, max: 1, phase: 0, pierce: 0, r: 0, a: 0, hit: new Set() };
    }
    castSpells(dt) {
        for (const i of this.equippedWeapons()) {
            const cd = (this.cast.get(i) ?? 0) - dt;
            if (cd > 0) {
                this.cast.set(i, cd);
                continue;
            }
            const w = WEAPONS[i];
            const t = this.nearestTarget(w.range * this.reachMul());
            if (!t) {
                this.cast.set(i, 0.1);
                continue;
            }
            this.fire(i, t);
            this.cast.set(i, w.cooldown / this.castSpeed());
        }
    }
    fire(i, t) {
        const w = WEAPONS[i];
        const dmg = this.weaponDmg(i);
        const n = this.weaponCopies(i);
        const ang = Math.atan2(t.y - this.py, t.x - this.px);
        this.castPulse = 0.28;
        audio.play('cast');
        if (!this.moving)
            this.face = ang;
        const reach = this.reachMul();
        if (w.id === 'wand') {
            for (let k = 0; k < n; k++) {
                const a = ang + (k - (n - 1) / 2) * 0.2;
                const p = this.newProj('bolt', this.px, this.py - 10, dmg, w.dtype);
                p.vx = Math.cos(a) * 560;
                p.vy = Math.sin(a) * 560;
                p.max = (w.range * reach + 60) / 560;
                p.pierce = 3;
                p.a = a;
                this.projs.push(p);
            }
        }
        else if (w.id === 'broom') {
            for (let k = 0; k < n; k++) {
                const a = ang + (k - (n - 1) / 2) * 0.55;
                const p = this.newProj('broom', this.px, this.py - 6, dmg, w.dtype);
                p.vx = Math.cos(a) * 440;
                p.vy = Math.sin(a) * 440;
                p.max = 5;
                p.r = w.range * reach;
                p.a = a;
                this.projs.push(p);
            }
        }
        else if (w.id === 'potion') {
            for (let k = 0; k < n; k++) {
                const off = k === 0 ? { x: 0, y: 0 } : { x: Math.cos(k * 2.4) * 60, y: Math.sin(k * 2.4) * 60 };
                const p = this.newProj('potion', this.px, this.py - 10, dmg, w.dtype);
                p.tx = t.x + off.x;
                p.ty = t.y + off.y;
                p.max = 0.6;
                p.r = 82 * reach;
                this.projs.push(p);
            }
        }
        else {
            const p = this.newProj('slash', this.px, this.py, dmg * (1 + 0.25 * (n - 1)), w.dtype);
            p.a = ang;
            p.r = 112 * reach;
            p.max = 0.22;
            this.projs.push(p);
            this.areaHit(p, true);
        }
    }
    /** boss evinin mührü: o adadaki diğer kampların hepsi (ilk kez) temizlenmeden boss ortaya çıkmaz */
    sealProgress(reg) {
        let list = this.campsOf.get(reg);
        if (!list) {
            list = this.getWorld().spawners.filter((x) => x.reg === reg && x.tier !== 'boss');
            this.campsOf.set(reg, list);
        }
        return { done: list.filter((x) => this.save.first['s' + x.id]).length, need: list.length };
    }
    bossSealed(sp) {
        if (sp.tier !== 'boss' || sp.bridge !== undefined || this.save.bossDown[sp.reg])
            return false;
        const p = this.sealProgress(sp.reg);
        return p.done < p.need;
    }
    /** canlı boss'un evi (kampı): vurulabilir, vuruşlar boss'a zarar verir */
    bossHouses() {
        return this.getWorld().spawners.filter((s) => s.tier === 'boss' && s.bridge === undefined && !this.spCleared(s) && this.enemies.some((e) => e.sp === s.id));
    }
    hitHouse(sp, raw, dtype) {
        const boss = this.enemies.find((e) => e.sp === sp.id);
        if (!boss)
            return;
        this.houseFlash.set(sp.id, 0.15);
        this.hitEnemy(boss, raw * 0.6, dtype);
        this.float(sp.x, sp.y - 50, 'EV', '#ffb36b');
    }
    /** boss evinin içindeyken sağlık kazanılır */
    inBossHouse() {
        return this.bossHouses().some((s) => Math.hypot(s.x - this.px, s.y - this.py) < 130);
    }
    /** Alan hasarı: ring (iksir patlaması) ya da slash (kepçe, ön koni) */
    areaHit(p, cone) {
        const apply = (ex, ey, er) => {
            const d = Math.hypot(ex - p.x, ey - p.y);
            if (d > p.r + er)
                return false;
            if (!cone)
                return true;
            let da = Math.atan2(ey - p.y, ex - p.x) - p.a;
            while (da > Math.PI)
                da -= Math.PI * 2;
            while (da < -Math.PI)
                da += Math.PI * 2;
            return Math.abs(da) < 1.0;
        };
        for (const e of this.enemies) {
            if (apply(e.x, e.y, e.def.r * TIERS[e.tier].size))
                this.hitEnemy(e, p.dmg, p.dtype);
        }
        for (const t of this.treesNear(p.x, p.y, p.r + 40)) {
            if (!this.isCleared('t' + t.id) && apply(t.x, t.y, 24))
                this.hitTree(t, p.dmg);
        }
        for (const s of this.bossHouses())
            if (apply(s.x, s.y, 56))
                this.hitHouse(s, p.dmg, p.dtype);
        for (const o of this.liveBlds())
            if (apply(o.x, o.y, o.r))
                this.hitBld(o, p.dmg);
    }
    updateProjs(dt) {
        const keep = [];
        const enemies = this.enemies;
        const trees = this.getWorld().trees;
        for (const p of this.projs) {
            p.life += dt;
            if (p.kind === 'bolt') {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                this.projCollide(p, enemies, trees, 12);
                if (p.life < p.max && p.pierce >= 0)
                    keep.push(p);
            }
            else if (p.kind === 'broom') {
                const sp = 440;
                if (p.phase === 0) {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (Math.hypot(p.x - p.sx, p.y - p.sy) >= p.r) {
                        p.phase = 1;
                        p.hit.clear();
                    }
                }
                else {
                    const dx = this.px - p.x;
                    const dy = this.py - p.y;
                    const d = Math.hypot(dx, dy) || 1;
                    p.x += (dx / d) * sp * dt;
                    p.y += (dy / d) * sp * dt;
                    if (d < 22)
                        continue;
                }
                this.projCollide(p, enemies, trees, 18, true);
                if (p.life < p.max)
                    keep.push(p);
            }
            else if (p.kind === 'potion') {
                const k = Math.min(1, p.life / p.max);
                p.x = p.sx + (p.tx - p.sx) * k;
                p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 70;
                if (p.life >= p.max) {
                    const ring = this.newProj('ring', p.tx, p.ty, p.dmg, p.dtype);
                    ring.r = p.r;
                    ring.max = 0.35;
                    this.areaHit(ring, false);
                    keep.push(ring);
                }
                else
                    keep.push(p);
            }
            else if (p.life < p.max)
                keep.push(p); // ring / slash: yalnızca görsel
        }
        this.projs = keep;
    }
    projCollide(p, enemies, trees, r, once = false) {
        for (const e of enemies) {
            if (p.hit.has(e))
                continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) < e.def.r * TIERS[e.tier].size + r) {
                p.hit.add(e);
                this.hitEnemy(e, p.dmg, p.dtype);
                if (!once) {
                    p.pierce--;
                    if (p.pierce < 0)
                        return;
                }
            }
        }
        for (const t of this.treesNear(p.x, p.y, r + 40)) {
            if (p.hit.has(t) || this.isCleared('t' + t.id))
                continue;
            if (Math.hypot(t.x - p.x, t.y - p.y) < 26 + r) {
                p.hit.add(t);
                this.hitTree(t, p.dmg);
                if (!once) {
                    p.pierce--;
                    if (p.pierce < 0)
                        return;
                }
            }
        }
        for (const s of this.bossHouses()) {
            if (p.hit.has(s))
                continue;
            if (Math.hypot(s.x - p.x, s.y - p.y) < 56 + r) {
                p.hit.add(s);
                this.hitHouse(s, p.dmg, p.dtype);
                if (!once) {
                    p.pierce--;
                    if (p.pierce < 0)
                        return;
                }
            }
        }
        for (const o of this.liveBlds()) {
            if (p.hit.has(o))
                continue;
            if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + r) {
                p.hit.add(o);
                this.hitBld(o, p.dmg);
                if (!once) {
                    p.pierce--;
                    if (p.pierce < 0)
                        return;
                }
            }
        }
    }
    hitEnemy(e, raw, dtype) {
        const crit = Math.random() < this.critChance();
        const dmg = Math.max(1, raw * e.def.resist[dtype] * (crit ? 3 : 1));
        e.hp -= dmg;
        e.flash = 0.14;
        audio.play('hit');
        if (e.tier === 'boss' || e.tier === 'hard') {
            // her %10'luk zararda 5 sn süpürge uçuşu
            const bucket = Math.min(10, Math.floor((1 - Math.max(0, e.hp) / e.maxHp) * 10));
            const prev = this.flyMark.get(e) ?? 0;
            this.flyMark.set(e, bucket);
            if (bucket > prev) {
                this.flyT = 5;
                audio.play('fly');
                this.gain('Süpürge uçuşu! 5 sn dokunulmazsın', '#c8b6ff', 'icon_broom');
            }
        }
        if (this.lifesteal() > 0)
            this.hp = Math.min(this.maxHp(), this.hp + dmg * this.lifesteal());
        if (e.state === 'idle')
            e.state = 'chase';
        this.float(e.x, e.y - e.def.r * TIERS[e.tier].size - 22, (crit ? '!' : '') + this.fmt(dmg), crit ? '#ffd84a' : '#ffffff');
    }
    treeMaxHp(t) { return (t.big ? 30 : 9) * ZONES[t.reg].scale * t.s; }
    hitTree(t, raw) {
        const maxHp = this.treeMaxHp(t);
        const hp = (this.treeHp.get(t.id) ?? maxHp) - raw;
        this.float(t.x, t.y - 34 * t.s, this.fmt(raw), '#c8ffc8');
        audio.play('chop');
        if (hp <= 0)
            this.chopTree(t);
        else
            this.treeHp.set(t.id, hp);
    }
    removeDead() {
        const alive = [];
        const finished = new Set();
        for (const e of this.enemies) {
            if (e.hp > 0) {
                alive.push(e);
                continue;
            }
            this.killEnemy(e);
            finished.add(e.sp);
        }
        if (finished.size === 0)
            return;
        this.enemies = alive;
        for (const id of finished) {
            if (!this.enemies.some((e) => e.sp === id))
                this.completeSpawner(id);
        }
    }
    fmt(n) {
        return n < 1e4 ? String(Math.ceil(n)) : fmtNum(n);
    }
    addPerm(k, v) { this.save.perm[k] = (this.save.perm[k] ?? 0) + v; }
    /** can havuzu: yüzde kazançlar bunun üzerine eklenir */
    hpPool() { return 100 + this.perm('normal.hp') + this.perm('elite.hp') + this.perm('tree.hp'); }
    /** hasar havuzu: kuşanılan büyülerin (seviyeli) taban hasarı + kalıcı hasar ortalaması */
    dmgPool() {
        const eq = this.equippedWeapons();
        if (!eq.length)
            return 40;
        let t = 0;
        for (const i of eq)
            t += WEAPONS[i].baseDmg * (1 + 0.15 * (this.save.weapons[i] - 1)) + this.perm('normal.dmg') + this.perm('elite.dmg');
        return t / eq.length;
    }
    /** bir adadaki bütün kalıcı kazanç kaynaklarının (kamp + ağaç) toplam ağırlığı */
    regionWeight(reg) {
        const hit = this.weightCache.get(reg);
        if (hit !== undefined)
            return hit;
        const L = ZONES[reg].layout;
        const camps = Object.keys(L).reduce((a, t) => a + CAMP_WEIGHT[t] * L[t], 0);
        const total = camps + ZONES[reg].resTrees * 0.3 + (80 + Math.min(reg, 10) * 6) * 0.02;
        this.weightCache.set(reg, total);
        return total;
    }
    /** bir adanın boss'unun gücü (kalıcı kazancın hedefi bunun MARGIN katıdır) */
    bossPower(reg) {
        const sp = this.zoneWorld(reg).spawners.find((x) => x.reg === reg && x.tier === 'boss' && x.bridge === undefined);
        if (!sp)
            return 1e9;
        const def = ENEMIES[sp.kind];
        const maxHp = def.hp * TIERS.boss.hp * ZONES[reg].scale * sp.lv;
        const dmg = def.dmg * TIERS.boss.dmg * ZONES[reg].dmgScale * Math.sqrt(sp.lv);
        return (Math.sqrt(maxHp * (dmg / 0.6)) * 10) / BOSS_MUL; // kazanç hedefi eski boss gücüne göre: boss 2 kat zorlaşır, oyuncu onunla büyümez
    }
    /** bu adadaki boss'un azami canı: binalar da bu kadar candır */
    bldMaxHp(o) {
        const reg = Math.floor(o.id / 100);
        const sp = this.zoneWorld(reg).spawners.find((x) => x.reg === reg && x.tier === 'boss' && x.bridge === undefined);
        if (!sp)
            return 1e9;
        return (ENEMIES[sp.kind].hp * TIERS.boss.hp * ZONES[reg].scale * sp.lv) / (o.div * BOSS_MUL); // yapı canı değişmedi
    }
    bldDown(o) { return o.kind === 'bld' && this.isCleared('o' + o.id); }
    liveBlds() {
        return this.world ? this.world.obstacles.filter((o) => o.kind === 'bld' && !this.bldDown(o)) : [];
    }
    hitBld(o, raw) {
        const max = this.bldMaxHp(o);
        const hp = (this.bldHp.get(o.id) ?? max) - raw;
        this.bldFlash.set(o.id, 0.12);
        audio.play('hit');
        this.float(o.x, o.y - o.size * 0.7, this.fmt(raw), '#ffd9a0');
        if (hp > 0) {
            this.bldHp.set(o.id, hp);
            return;
        }
        this.bldHp.delete(o.id);
        this.save.spawn['o' + o.id] = this.now() + 600 * 1000; // 10 dk sonra yeniden kurulur
        const firstDown = !this.save.first['o' + o.id];
        this.save.first['o' + o.id] = 1;
        if (firstDown)
            this.addPerm('elite.hp', 0.02 * this.hpPool()); // ilk yıkışta kalıcı +%2 can
        const h = Math.min(this.maxHp() - this.hp, this.maxHp() * 0.02);
        this.hp += h;
        audio.play('kill');
        this.deathFx.push({ x: o.x, y: o.y, t: 0.45, name: o.art, size: o.size, flip: o.flip });
        this.gain('+' + this.fmt(this.maxHp() * 0.02) + (firstDown ? ' Can kazanıldı (kalıcı, yapı)' : ' Can iyileşti (yıkılan yapı)'), '#7bff9a', 'ui_heart');
        this.persist();
        this.onChange();
    }
    /**
     * Kalıcı harita kazancı: adadaki kalan kazanç kaynakları arasında, güç o adanın boss gücünün MARGIN katına ulaşacak
     * şekilde paylaştırılır. Oyuncu zaten güçlüyse (yetenek/silah/kristal yüzünden) kazanç 0'dır; bu yüzden hiçbir yol
     * oyuncuyu adanın zorluğundan fazla ileri taşımaz ve her ada 1.2–1.8 kat daha zordur.
     */
    grantFraction(reg, w) {
        const total = this.regionWeight(reg);
        const done = this.save.gw[reg] ?? 0;
        const rem = Math.max(w, total - done);
        this.save.gw[reg] = done + w;
        const cap = this.bossPower(reg) * Game.MARGIN;
        const P = Math.max(1, this.fullPower());
        if (P >= cap)
            return 0;
        return Math.pow(cap / P, Math.min(1, w / rem)) - 1;
    }
    chopTree(t) {
        this.save.spawn['t' + t.id] = this.now() + (t.big ? TREE_RESPAWN * 2 : TREE_RESPAWN) * 1000;
        this.treeHp.delete(t.id);
        const before = this.maxHp();
        const first = !this.save.first['t' + t.id];
        this.save.first['t' + t.id] = 1;
        // ağaç yalnızca can ve yenilenme verir: ilk kesim tam, tekrarlar çok az (sonsuz çiftlik yok)
        const f = first ? this.grantFraction(t.reg, t.big ? 0.3 : 0.02) : 0;
        this.addPerm('tree.hp', f * this.hpPool());
        this.addPerm('tree.regen', (t.big ? 0.0004 : 0.00008) * this.maxHp() * (first ? 1 : 0.2));
        const dh = this.maxHp() - before;
        if (dh > 0)
            this.gain('+' + this.fmt(dh) + ' Can kazanıldı', '#7bff9a', 'ui_heart', { key: 'hp', amount: dh, fmt: (n) => '+' + this.fmt(n) + ' Can kazanıldı' });
        this.persist();
        this.onChange();
    }
    killEnemy(e) {
        this.save.kills++;
        audio.play(e.tier === 'boss' ? 'boss' : 'kill');
        if (e.tier === 'boss')
            vibrate([60, 40, 120]);
        const value = Math.max(1, Math.round(e.def.drop * TIERS[e.tier].soul * Math.pow(ZONES[e.reg].scale, 0.7) * Math.sqrt(e.lv) * this.yieldMul() * Game.YIELD));
        // ganimet otomatik toplanır, etkisi yazıyla gösterilir
        this.save.essence += value;
        this.gain('+' + this.fmt(value) + ' Ruh', '#8fdcff', 'ui_soul', { key: 'soul', amount: value, fmt: (n) => '+' + this.fmt(n) + ' Ruh' });
        this.deathFx.push({ x: e.x, y: e.y, t: 0.45, name: e.tier === 'boss' ? ZONES[e.reg].art.boss : e.def.id,
            size: e.def.r * TIERS[e.tier].size * 3.3, flip: e.flip });
        this.onChange();
    }
    completeSpawner(id) {
        this.getWorld();
        const sp = this.spawnerMap.get(id);
        if (!sp)
            return;
        const tier = TIERS[sp.tier];
        this.save.spawn['s' + id] = this.now() + (sp.tier === 'boss' ? 1e12 : tier.respawn * 1000); // boss bir daha çıkmaz
        const lvK = Math.sqrt(sp.lv);
        const hp0 = this.maxHp();
        const eq0 = this.equippedWeapons();
        const dmg0 = eq0.length ? this.weaponDmg(eq0[0]) : 0;
        // kalıcı güç: bir adanın bütün kampları temizlenince güç, sonraki adanın zorluk artışını (×1.2–1.8) karşılayacak kadar artar.
        // İlk temizleme tam kazanç verir; kampın tekrar temizlenmesi çok az (çiftlik yapılamaz). Kazanç, mevcut canın/hasarın yüzdesidir.
        const first = !this.save.first['s' + id];
        const wasSealed = this.getWorld().spawners.some((x) => x.reg === sp.reg && this.bossSealed(x));
        this.save.first['s' + id] = 1;
        if (first && this.getWorld().chests.some((ch) => ch.mode === 'drop' && ch.src === id)) {
            this.say('Bir sandık belirdi!');
            audio.play('chest');
        }
        if (wasSealed && !this.getWorld().spawners.some((x) => x.reg === sp.reg && this.bossSealed(x))) {
            this.say('Boss evinin mührü kalktı!');
            audio.play('gate');
        }
        const f = first && sp.bridge === undefined ? this.grantFraction(sp.reg, CAMP_WEIGHT[sp.tier]) : 0;
        this.addPerm(sp.tier === 'boss' || tier.permanent === 'elite' ? 'elite.hp' : 'normal.hp', f * this.hpPool());
        this.addPerm(sp.tier === 'boss' || tier.permanent === 'elite' ? 'elite.dmg' : 'normal.dmg', f * this.dmgPool());
        if (this.maxHp() > hp0) {
            const dh = this.maxHp() - hp0;
            this.gain('+' + this.fmt(dh) + ' Can kazanıldı', '#7bff9a', 'ui_heart', { key: 'hp', amount: dh, fmt: (n) => '+' + this.fmt(n) + ' Can kazanıldı' });
        }
        if (eq0.length && this.weaponDmg(eq0[0]) > dmg0) {
            const dd = this.weaponDmg(eq0[0]) - dmg0;
            this.gain('+' + this.fmt(dd) + ' Hasar kazanıldı', '#ffb36b', 'ui_power', { key: 'dmg', amount: dd, fmt: (n) => '+' + this.fmt(n) + ' Hasar kazanıldı' });
        }
        const pool = sp.tier === 'easy' ? [0, 1] : sp.tier === 'medium' ? [1, 2] : sp.tier === 'hard' ? [2, 3] : [0, 1, 2, 3];
        const wi = pool[Math.floor(Math.random() * pool.length)];
        const n = Math.max(1, Math.round(tier.weaponCopies * (1 + sp.reg) * lvK));
        this.save.copies[wi] += n;
        if (this.save.weapons[wi] === 0 && this.save.copies[wi] >= WEAPONS[wi].unlockCopies) {
            this.save.copies[wi] -= WEAPONS[wi].unlockCopies;
            this.save.weapons[wi] = 1;
            this.autoEquip(wi);
            this.say(WEAPONS[wi].name + ' açıldı!');
        }
        this.gain(`+${n} ${WEAPONS[wi].name} kopyası`, '#ffd84a', 'icon_' + WEAPONS[wi].id);
        if (Math.random() < 0.12) {
            const h = Math.min(this.maxHp() - this.hp, this.maxHp() * 0.15);
            this.hp += h;
            if (h > 0)
                this.gain('+' + this.fmt(h) + ' Can iyileşti', '#7bff9a', 'ui_heart');
        }
        if (sp.tag)
            this.gainItem(sp.tag, Math.min(4, 1 + sp.reg));
        if (sp.tier === 'elite') {
            this.save.geodes++;
            this.gain('+1 Jeod', '#7dffb0', 'icon_geode');
        }
        if (sp.beast) {
            this.save.geodes += 3;
            this.gain('+3 Jeod', '#7dffb0', 'icon_geode');
            this.gainItem('helmet', Math.min(4, 3));
            this.gainItem('shield', Math.min(4, 3));
            this.say('Canavar yenildi!');
        }
        else if (sp.tier === 'boss' && sp.bridge !== undefined) {
            // köprü bossu: ganimet verir, kapıyı etkilemez
            this.save.geodes += 2;
            this.gain('+2 Jeod', '#7dffb0', 'icon_geode');
            this.gainItem(sp.reg % 2 === 0 ? 'helmet' : 'shield', Math.min(4, 2 + Math.floor(sp.reg / 12)));
            this.say('Köprü bekçisi yenildi!');
        }
        else if (sp.tier === 'boss') {
            this.save.geodes += 3;
            this.gain('+3 Jeod', '#7dffb0', 'icon_geode');
            this.gainItem('helmet', 2);
            this.gainItem('shield', 2);
            if (!this.save.bossDown[sp.reg]) {
                this.save.bossDown[sp.reg] = true;
                if (this.bossesDown() % 10 === 0) {
                    this.gain('Yeni kristal yuvası kazanıldı!', '#c8b6ff', 'ui_crystal');
                    this.gain('Yeni ekipman yuvası kazanıldı!', '#ffe36b', 'ui_gear');
                }
                if (sp.reg < ZONES.length - 1) {
                    this.gateAnim = { i: sp.reg, t: 3.6 };
                    audio.play('gate');
                    vibrate([80, 60, 200]);
                }
                this.say(ZONES[sp.reg].bossName + ' yenildi! ' + (sp.reg < ZONES.length - 1 ? 'Sonraki bölgenin kapısı açıldı.' : 'Dünyayı tamamladın!'));
            }
            else
                this.say(ZONES[sp.reg].bossName + ' yenildi!');
        }
        this.persist();
        this.onChange();
    }
    /** sandık şu an görünür mü (haritada ve sahnede) */
    chestShown(c, near = 170) {
        if (this.save.chests.includes(c.id))
            return true;
        if (c.mode === 'visible')
            return true;
        if (c.mode === 'drop')
            return !!(c.src !== undefined && this.save.first['s' + c.src]);
        return Math.hypot(c.x - this.px, c.y - this.py) < near; // hidden
    }
    checkChests() {
        for (const c of this.getWorld().chests) {
            if (this.save.chests.includes(c.id))
                continue;
            if (c.mode === 'drop' && !this.chestShown(c))
                continue;
            if (Math.hypot(c.x - this.px, c.y - this.py) < 28) {
                this.save.chests.push(c.id);
                audio.play('chest');
                vibrate(60);
                const stat = CSTAT_KEYS[Math.floor(Math.random() * CSTAT_KEYS.length)];
                const amt = CRYSTAL_STATS[stat].base * 0.6;
                this.save.chestBonus[stat] = (this.save.chestBonus[stat] ?? 0) + amt;
                const souls = Math.round(40 * Math.pow(ZONES[c.reg].scale, 0.7) * this.yieldMul());
                this.save.essence += souls;
                this.save.geodes += 1;
                this.say('Gizli sandık bulundu! (' + this.chestsOpened(c.reg) + '/6)');
                this.gain('+' + amt.toFixed(1) + CRYSTAL_STATS[stat].unit + ' ' + CRYSTAL_STATS[stat].name + ' kazanıldı (kalıcı)', '#ffd84a', statIcon(stat));
                this.gain('+' + this.fmt(souls) + ' Ruh', '#8fdcff', 'ui_soul');
                this.gain('+1 Jeod', '#7dffb0', 'icon_geode');
                this.persist();
                this.onChange();
            }
        }
    }
    die() {
        this.dead = 2.5;
        vibrate(250);
        this.save.deaths++;
        this.persist();
        this.say('Bayıldın… düşmanlar kamplarına döndü.');
    }
    respawn() {
        this.hp = this.maxHp();
        const rp = this.restPoints()[Math.min(this.region, this.restPoints().length - 1)]; // bulunduğumuz adanın dinlenme noktasında uyanırız
        this.px = rp.x;
        this.py = rp.y + 70;
        for (const e of this.enemies)
            e.state = 'return';
        this.projs = [];
        this.invuln = 2;
    }
    say(text) { this.banner = N(T(text)); this.bannerT = 4; }
    float(x, y, text, color) {
        if (this.floaters.length < 60)
            this.floaters.push({ x, y, t: 0.8, text, color });
    }
    campProgress(reg = this.region) {
        const sps = this.getWorld().spawners.filter((s) => s.reg === reg);
        return { done: sps.filter((s) => this.spCleared(s)).length, total: sps.length };
    }
    // ---- usta cadılar (kapı başında eğitim) ----
    masterPos(i) {
        const g = this.gatePos(i);
        const b = this.bridge(i);
        const ang = Math.atan2(b.by - b.ay, b.bx - b.ax);
        // kapının bu bölge tarafında, köprünün kenarında
        return { x: g.x - Math.cos(ang) * 150 - Math.sin(ang) * 150, y: g.y - Math.sin(ang) * 150 + Math.cos(ang) * 150 };
    }
    /** yakındaki usta cadının numarası, yoksa -1 */
    nearMaster() {
        for (let i = 0; i < ZONES.length - 1; i++) {
            if (!this.masterOpen(i))
                continue;
            const m = this.masterPos(i);
            if (Math.hypot(m.x - this.px, m.y - this.py) < 130)
                return i;
        }
        return -1;
    }
    /** usta cadı yalnızca o seviyenin boss'u yenilince ortaya çıkar */
    masterOpen(i) { return !!this.save.bossDown[i] && this.trainPlaysLeft(i) > 0; }
    dayNo() { return Math.floor((this.now() - new Date().getTimezoneOffset() * -60000) / 86400000); }
    /** bugün bu usta için kalan eğitim hakkı (her seviye için günde 2) */
    trainPlaysLeft(master) {
        const used = this.save.train['d' + master] === this.dayNo() ? (this.save.train['n' + master] ?? 0) : 0;
        return Math.max(0, Game.TRAIN_PER_DAY - used);
    }
    /** hakkı harcar; hak yoksa false */
    startTraining(master) {
        if (!this.masterOpen(master) || this.trainPlaysLeft(master) <= 0)
            return false;
        const n = Game.TRAIN_PER_DAY - this.trainPlaysLeft(master) + 1;
        this.save.train['d' + master] = this.dayNo();
        this.save.train['n' + master] = n;
        this.persist();
        return true;
    }
    /** mini oyun bitti: puana göre kalıcı güç kazanılır (0..1) */
    finishTraining(master, kind, score) {
        const k = Math.max(0, Math.min(1, score)) * (1 + master * 0.1);
        if (kind === 'timing') {
            const eq = this.equippedWeapons();
            const d0 = eq.length ? this.weaponDmg(eq[0]) : 0;
            this.addPerm('train.dmg', 4 * k);
            if (eq.length)
                this.gain('+' + this.fmt(this.weaponDmg(eq[0]) - d0) + ' Hasar kazanıldı (eğitim)', '#ffb36b', 'ui_power');
        }
        else if (kind === 'memory') {
            const h0 = this.maxHp();
            this.addPerm('train.hp', 5 * k);
            this.gain('+' + this.fmt(this.maxHp() - h0) + ' Can kazanıldı (eğitim)', '#7bff9a', 'ui_heart');
        }
        else {
            this.addPerm('train.regen', 0.4 * k);
            this.gain('+' + (0.4 * k).toFixed(2) + ' Yenilenme/sn kazanıldı (eğitim)', '#9be7ff', 'ui_regen');
        }
        this.persist();
        this.onChange();
    }
    /** Ekrana dokunma: minimap → büyük harita, büyük harita → kapat, usta cadı → eğitim */
    handleTap(x, y) {
        if (this.mapOpen) {
            this.mapOpen = false;
            return true;
        }
        if (Math.hypot(x - this.mini.x, y - this.mini.y) <= this.mini.r) {
            this.mapOpen = true;
            return true;
        }
        for (let i = 0; i < ZONES.length - 1; i++) {
            if (!this.masterOpen(i))
                continue;
            const m = this.masterPos(i);
            const sx = this.w / 2 + (m.x - this.px) * this.zoom;
            const sy = this.h / 2 + (m.y - this.py) * this.zoom;
            if (Math.hypot(x - sx, y - sy) < 60 && Math.hypot(m.x - this.px, m.y - this.py) < 220) {
                this.onMaster(i);
                return true;
            }
        }
        return false;
    }
    // ---- çizim ----
    render() {
        const c = this.ctx;
        this.vw = this.w / this.zoom;
        this.vh = this.h / this.zoom;
        const camX = this.px - this.vw / 2;
        const camY = this.py - this.vh / 2;
        c.save();
        c.scale(this.zoom, this.zoom); // sanal ekran (vw×vh) gerçek ekrana sığdırılır
        c.fillStyle = '#0c2742';
        c.fillRect(0, 0, this.vw, this.vh);
        this.drawSeaWaves(camX, camY);
        this.drawLand(camX, camY);
        c.save();
        c.translate(-camX, -camY);
        this.drawWorldObjects(camX, camY);
        this.drawHome(camX, camY);
        this.drawObstacles(camX, camY, false);
        for (let i = 0; i < ZONES.length - 1; i++)
            this.drawMaster(i, camX, camY);
        for (const d of this.deathFx)
            this.drawDeath(d);
        for (const e of this.enemies)
            if (this.inView(e.x, e.y, 140, camX, camY))
                this.drawEnemy(e);
        this.drawPlayer();
        this.drawObstacles(camX, camY, true);
        for (const p of this.projs)
            this.drawProj(p);
        c.font = `bold ${Math.round(13 * this.lk())}px sans-serif`;
        c.textAlign = 'center';
        for (const f of this.floaters) {
            c.globalAlpha = Math.min(1, f.t * 2);
            c.fillStyle = f.color;
            c.fillText(f.text, f.x, f.y);
        }
        c.globalAlpha = 1;
        c.restore();
        c.restore();
        this.ambient.update(0.016, this.w, this.h);
        this.ambient.draw(c, this.w, this.h, this.region, this.time);
        drawVignette(c, this.w, this.h);
        this.drawGains();
        this.drawGateBanner();
        this.drawHud();
        this.drawMinimap();
        this.drawGuide();
        this.drawLoading();
        if (this.mapOpen)
            this.drawFullMap();
    }
    inView(x, y, m, camX, camY) {
        return x > camX - m && x < camX + this.vw + m && y > camY - m && y < camY + this.vh + m;
    }
    /** animasyonlu sprite: ayak noktasından döner/ezilir, yön çevirir, vurulunca parlar */
    drawSprX(name, x, y, size, o = {}) {
        const img = this.spr(name);
        if (!img)
            return false;
        const c = this.ctx;
        c.save();
        c.translate(x, y + size * 0.32 + (o.bob ?? 0));
        if (o.rot)
            c.rotate(o.rot);
        c.scale((o.flip ?? 1) * (o.sx ?? 1), o.sy ?? 1);
        if (o.alpha !== undefined)
            c.globalAlpha = o.alpha;
        if (o.flash && 'filter' in c)
            c.filter = 'brightness(2.4) saturate(0.6)';
        c.drawImage(img, -size / 2, -size * 0.82, size, size);
        c.restore();
        return true;
    }
    drawSeaWaves(camX, camY) {
        const c = this.ctx;
        c.strokeStyle = 'rgba(120,180,255,0.10)';
        c.lineWidth = 2;
        const s = 120;
        for (let x = Math.floor(camX / s) * s; x < camX + this.vw + s; x += s) {
            for (let y = Math.floor(camY / s) * s; y < camY + this.vh + s; y += s) {
                const o = Math.sin(this.time * 1.2 + x * 0.05 + y * 0.03) * 6;
                c.beginPath();
                c.moveTo(x - camX, y - camY + o);
                c.quadraticCurveTo(x - camX + 20, y - camY + o - 8, x - camX + 40, y - camY + o);
                c.stroke();
            }
        }
    }
    drawLand(camX, camY) {
        const c = this.ctx;
        ZONES.forEach((zone) => {
            const cx = zone.cx - camX;
            const cy = zone.cy - camY;
            if (cx + zone.radius + 60 < 0 || cx - zone.radius - 60 > this.vw || cy + zone.radius + 60 < 0 || cy - zone.radius - 60 > this.vh)
                return;
            drawShore(c, cx, cy, zone.radius, this.time, shade(zone.dot, 1.45));
        });
        for (let i = 0; i < ZONES.length - 1; i++)
            drawBridge(c, this.bridge(i), i, camX, camY, this.vw, this.vh, this.time, this.gateLocked(i));
        ZONES.forEach((zone, reg) => {
            const cx = zone.cx - camX;
            const cy = zone.cy - camY;
            if (cx + zone.radius < 0 || cx - zone.radius > this.vw || cy + zone.radius < 0 || cy - zone.radius > this.vh)
                return;
            c.save();
            c.beginPath();
            c.arc(cx, cy, zone.radius, 0, Math.PI * 2);
            c.fillStyle = zone.bg;
            c.fill();
            c.clip();
            this.drawGround(camX, camY, zone.dot, reg);
            c.restore();
            c.strokeStyle = 'rgba(255,255,255,0.18)';
            c.lineWidth = 6;
            c.beginPath();
            c.arc(cx, cy, zone.radius, 0, Math.PI * 2);
            c.stroke();
        });
    }
    drawGround(camX, camY, dot, reg) {
        const c = this.ctx;
        const tile = this.spr(ZONES[reg].art.ground);
        if (tile) {
            const T = 256;
            for (let x = Math.floor(camX / T) * T; x < camX + this.vw + T; x += T) {
                for (let y = Math.floor(camY / T) * T; y < camY + this.vh + T; y += T)
                    c.drawImage(tile, x - camX, y - camY, T, T);
            }
            return;
        }
        const s = 70;
        c.fillStyle = dot;
        for (let x = Math.floor(camX / s) * s; x < camX + this.vw + s; x += s) {
            for (let y = Math.floor(camY / s) * s; y < camY + this.vh + s; y += s) {
                const hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
                const r = hsh - Math.floor(hsh);
                c.beginPath();
                c.arc(x - camX + r * s, y - camY + ((r * 7) % 1) * s, 2 + r * 3, 0, Math.PI * 2);
                c.fill();
            }
        }
    }
    drawTreeSprite(t, camTime) {
        const c = this.ctx;
        const size = (t.big ? 84 : 60) * t.s * (t.big ? 1 : 1);
        const sway = Math.sin(camTime * 1.3 + t.id) * 0.03;
        if (t.big) {
            const g = c.createRadialGradient(t.x, t.y, 4, t.x, t.y, 52);
            g.addColorStop(0, 'rgba(255,216,74,0.35)');
            g.addColorStop(1, 'rgba(255,216,74,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(t.x, t.y, 52, 0, Math.PI * 2);
            c.fill();
        }
        const name = ZONES[t.reg].art.tree;
        if (this.drawSprX(name, t.x, t.y - 10, size, { rot: sway }))
            return;
        const s = size / 64;
        c.fillStyle = '#4a3320';
        c.fillRect(t.x - 4 * s, t.y, 8 * s, 16 * s);
        c.fillStyle = t.reg === 2 ? '#a7d8e8' : t.reg === 1 ? '#3b5a52' : '#2f7a45';
        c.beginPath();
        c.arc(t.x, t.y - 4 * s, 20 * s, 0, Math.PI * 2);
        c.fill();
    }
    drawWorldObjects(camX, camY) {
        const c = this.ctx;
        const world = this.getWorld();
        for (const sp of world.spawners) {
            if (!this.inView(sp.x, sp.y, 90, camX, camY))
                continue;
            const cleared = this.spCleared(sp);
            if (!cleared) {
                // kamp çemberi: evin etrafı (düşmanların kampı) renkli halkayla işaretli
                const col = TIERS[sp.tier].color;
                c.save();
                c.strokeStyle = col;
                c.globalAlpha = 0.55;
                c.lineWidth = 3;
                c.beginPath();
                c.arc(sp.x, sp.y, sp.tier === 'boss' ? 130 : 76, 0, Math.PI * 2);
                c.stroke();
                c.globalAlpha = 0.18;
                c.setLineDash([10, 10]);
                c.beginPath();
                c.arc(sp.x, sp.y, sp.tier === 'boss' ? 400 : 250, 0, Math.PI * 2);
                c.stroke();
                c.restore();
                if (sp.tier === 'boss' && this.bossSealed(sp)) {
                    const pr = this.sealProgress(sp.reg);
                    c.fillStyle = 'rgba(255,80,80,0.18)';
                    c.beginPath();
                    c.arc(sp.x, sp.y, 130, 0, Math.PI * 2);
                    c.fill();
                    this.drawSpr('ui_lock', sp.x, sp.y - 46, 38);
                    c.font = 'bold 12px sans-serif';
                    c.textAlign = 'center';
                    c.fillStyle = '#ffb0b0';
                    c.fillText(`MÜHÜRLÜ · kamp ${pr.done}/${pr.need}`, sp.x, sp.y + 78);
                }
                else if (sp.tier === 'boss' && sp.bridge === undefined) {
                    // boss evi: içi iyileştirir (yeşil alan), vurulabilir
                    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.2);
                    const gr = c.createRadialGradient(sp.x, sp.y, 10, sp.x, sp.y, 130);
                    gr.addColorStop(0, `rgba(120,255,170,${0.2 + 0.1 * pulse})`);
                    gr.addColorStop(1, 'rgba(120,255,170,0)');
                    c.fillStyle = gr;
                    c.beginPath();
                    c.arc(sp.x, sp.y, 130, 0, Math.PI * 2);
                    c.fill();
                    c.font = 'bold 12px sans-serif';
                    c.textAlign = 'center';
                    c.fillStyle = '#c8ffd8';
                    c.fillText('BOSS EVİ · vur / iyileş', sp.x, sp.y + 78);
                }
            }
            c.globalAlpha = cleared ? 0.45 : 1;
            if (sp.bridge === undefined && !this.drawSpr('camp', sp.x, sp.y, 120)) {
                c.strokeStyle = 'rgba(0,0,0,0.4)';
                c.lineWidth = 5;
                c.beginPath();
                c.arc(sp.x, sp.y, 50, 0, Math.PI * 2);
                c.stroke();
            }
            c.globalAlpha = 1;
            const hf = this.houseFlash.get(sp.id);
            if (hf) {
                c.fillStyle = `rgba(255,255,255,${Math.min(0.6, hf * 4)})`;
                c.beginPath();
                c.arc(sp.x, sp.y, 52, 0, Math.PI * 2);
                c.fill();
            }
            if (cleared && sp.tier === 'boss') {
                c.fillStyle = '#b8ffcc';
                c.font = 'bold 13px sans-serif';
                c.textAlign = 'center';
                c.fillText('YENİLDİ', sp.x, sp.y + 5);
            }
            else if (cleared) {
                const left = Math.max(0, Math.ceil(((this.save.spawn['s' + sp.id] ?? 0) - this.now()) / 1000));
                c.fillStyle = '#fff';
                c.font = 'bold 14px sans-serif';
                c.textAlign = 'center';
                c.fillText(left >= 60 ? Math.floor(left / 60) + 'dk ' + (left % 60) + 'sn' : left + 'sn', sp.x, sp.y + 5);
            }
        }
        // ağaçlar: hepsi kesilebilir; y'ye göre sıralı çizmeye gerek yok, ayak izi küçük
        for (const t of world.trees) {
            if (!this.inView(t.x, t.y, 90, camX, camY))
                continue;
            if (this.isCleared('t' + t.id)) {
                c.fillStyle = '#4a3320';
                c.beginPath();
                c.ellipse(t.x, t.y + 4, 9 * t.s + 3, 5 * t.s + 2, 0, 0, Math.PI * 2);
                c.fill();
                continue;
            }
            this.drawTreeSprite(t, this.time);
            const maxHp = this.treeMaxHp(t);
            const hp = this.treeHp.get(t.id) ?? maxHp;
            if (hp < maxHp) {
                c.fillStyle = '#400';
                c.fillRect(t.x - 20, t.y - 56 * t.s, 40, 4);
                c.fillStyle = '#5f5';
                c.fillRect(t.x - 20, t.y - 56 * t.s, (40 * hp) / maxHp, 4);
            }
        }
        for (const ch of world.chests) {
            if (!this.inView(ch.x, ch.y, 40, camX, camY))
                continue;
            const open = this.save.chests.includes(ch.id);
            if (!this.chestShown(ch)) {
                // gizli sandık: yakında solgun bir parıltı ipucu
                if (ch.mode === 'hidden' && Math.hypot(ch.x - this.px, ch.y - this.py) < 330) {
                    const a = 0.25 + 0.2 * Math.sin(this.time * 4 + ch.id);
                    c.fillStyle = `rgba(255,230,140,${a})`;
                    c.beginPath();
                    c.arc(ch.x, ch.y, 5 + 2 * Math.sin(this.time * 3), 0, Math.PI * 2);
                    c.fill();
                }
                continue;
            }
            if (this.spr('chest')) {
                c.globalAlpha = open ? 0.4 : 1;
                this.drawSprX('chest', ch.x, ch.y, 44, { bob: open ? 0 : Math.sin(this.time * 3 + ch.id) * 1.5 });
                c.globalAlpha = 1;
                continue;
            }
            c.fillStyle = open ? '#555' : '#8a5a2b';
            c.fillRect(ch.x - 14, ch.y - 9, 28, 18);
            c.fillStyle = open ? '#777' : '#ffd84a';
            c.fillRect(ch.x - 14, ch.y - 9, 28, 5);
            if (!open)
                c.fillRect(ch.x - 3, ch.y - 4, 6, 7);
        }
        for (let i = 0; i < ZONES.length - 1; i++)
            this.drawGate(i, camX, camY);
    }
    /** Evimiz: doğduğumuz yer ve hızlı iyileşme alanı */
    /** kaya ve binalar; oyuncunun arkasında kalanlar önce, önünde kalanlar sonra çizilir */
    drawObstacles(camX, camY, front) {
        if (!this.world)
            return;
        const c = this.ctx;
        for (const o of this.world.obstacles) {
            if ((o.y > this.py) !== front)
                continue;
            if (!this.inView(o.x, o.y, o.size, camX, camY))
                continue;
            if (this.bldDown(o))
                continue;
            c.fillStyle = 'rgba(0,0,0,0.3)';
            c.beginPath();
            c.ellipse(o.x + 4, o.y + o.r * 0.5, o.r * 1.15, o.r * 0.42, 0, 0, Math.PI * 2);
            c.fill();
            const fl = o.kind === 'bld' && (this.bldFlash.get(o.id) ?? 0) > 0;
            if (!this.drawSprX(o.art, o.x, o.y - o.size * 0.3, o.size, { flip: o.flip, flash: fl })) {
                c.fillStyle = o.kind === 'bld' ? '#7a5a3a' : '#6e7480';
                c.beginPath();
                c.arc(o.x, o.y - o.r * 0.3, o.r, 0, Math.PI * 2);
                c.fill();
            }
            if (o.kind === 'bld') {
                const cur = this.bldHp.get(o.id);
                if (cur !== undefined) {
                    const f = Math.max(0, cur / this.bldMaxHp(o));
                    const bw = 70;
                    c.fillStyle = 'rgba(0,0,0,0.55)';
                    c.fillRect(o.x - bw / 2 - 1, o.y - o.size * 0.95 - 1, bw + 2, 8);
                    c.fillStyle = f <= 0.2 ? '#ff5a5a' : f <= 0.5 ? '#ffd84a' : '#5fe07a';
                    c.fillRect(o.x - bw / 2, o.y - o.size * 0.95, bw * f, 6);
                }
            }
        }
    }
    /** bir kampın düşman gücü (güç = √(can × hasar), ekrandaki ⚔ sayısıyla aynı formül) */
    spawnerPower(sp) {
        const def = ENEMIES[sp.kind];
        const t = TIERS[sp.tier];
        const z = ZONES[sp.reg];
        const maxHp = def.hp * t.hp * z.scale * sp.lv;
        const dmg = def.dmg * t.dmg * z.dmgScale * Math.sqrt(sp.lv);
        return Math.floor(Math.sqrt(maxHp * (dmg / 0.6)) * 10);
    }
    /** oyuncu bu adanın kapısını geçip köprüye girdi mi */
    passedGate(reg) {
        const b = this.bridge(reg);
        const t = ((this.px - b.ax) * (b.bx - b.ax) + (this.py - b.ay) * (b.by - b.ay)) / (b.len * b.len);
        return t > b.tGate;
    }
    /** oyuncuya sıradaki hedefi gösterir: boss açıldıysa boss evi, boss yenildiyse kapı, değilse en yakın temizlenmemiş kamp */
    guideTarget() {
        const reg = this.region;
        const last = ZONES.length - 1;
        const boss = this.getWorld().spawners.find((s) => s.reg === reg && s.tier === 'boss' && s.bridge === undefined);
        if (!this.save.bossDown[reg]) {
            if (boss && !this.bossSealed(boss) && !this.spCleared(boss))
                return { x: boss.x, y: boss.y, label: 'Boss evi', color: '#ff8a5a' };
            // sıradaki düşman: ilk kez temizlenmemiş kamplardan, gücüne göre rahatça yenilebilecek (≤ %60) en yakın olanı; yoksa en zayıfı
            const pw = Math.max(1, this.fullPower());
            let best = null;
            let bd = Infinity;
            let weak = null;
            let wp = Infinity;
            for (const s of this.getWorld().spawners) {
                if (s.reg !== reg || s.tier === 'boss' || this.save.first['s' + s.id] || this.spCleared(s))
                    continue;
                const sp = this.spawnerPower(s);
                if (sp < wp) {
                    wp = sp;
                    weak = s;
                }
                if (sp > pw * 0.6)
                    continue;
                const d = Math.hypot(s.x - this.px, s.y - this.py);
                if (d < bd) {
                    bd = d;
                    best = s;
                }
            }
            const pick = best ?? weak;
            return pick ? { x: pick.x, y: pick.y, label: 'Sıradaki düşman', color: best ? '#7bff9a' : '#ffb36b' } : null;
        }
        if (reg < last) {
            if (this.passedGate(reg))
                return null; // kapı geçildi: ok kalkar
            const g = this.gatePos(reg);
            // kapıya yaklaşan oyuncuya eğitim hakkı varsa usta cadı işaret edilir
            if (this.masterOpen(reg) && Math.hypot(g.x - this.px, g.y - this.py) < 900) {
                const m = this.masterPos(reg);
                return { x: m.x, y: m.y, label: 'Usta Cadı', color: '#9ff0ff' };
            }
            return { x: g.x, y: g.y, label: 'Kapı', color: '#7bff9a' };
        }
        return null;
    }
    /** hedef ekrandaysa üstünde zıplayan ok, ekran dışındaysa kenarda hedefe dönük ok + mesafe */
    drawGuide() {
        if (!settings.guide || this.dead > 0 || this.mapOpen)
            return;
        const t = this.guideTarget();
        if (!t)
            return;
        const c = this.ctx;
        const sx = this.w / 2 + (t.x - this.px) * this.zoom;
        const sy = this.h / 2 + (t.y - this.py) * this.zoom;
        const dist = Math.hypot(t.x - this.px, t.y - this.py);
        const bob = Math.sin(this.time * 6) * 5;
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 4);
        c.save();
        c.textAlign = 'center';
        c.font = 'bold 13px sans-serif';
        c.lineWidth = 4;
        c.strokeStyle = 'rgba(0,0,0,0.75)';
        const label = T(t.label) + ' · ' + Math.round(dist / 10) + ' m';
        const onScreen = sx > 40 && sx < this.w - 40 && sy > 130 && sy < this.h - 110;
        if (onScreen) {
            const ay = sy - 70 + bob;
            c.fillStyle = t.color;
            c.beginPath();
            c.moveTo(sx, ay + 22);
            c.lineTo(sx - 15, ay);
            c.lineTo(sx + 15, ay);
            c.closePath();
            c.fill();
            c.strokeStyle = 'rgba(0,0,0,0.6)';
            c.lineWidth = 2;
            c.stroke();
            c.lineWidth = 4;
            c.strokeStyle = 'rgba(0,0,0,0.75)';
            c.strokeText(label, sx, ay - 8);
            c.fillStyle = '#fff';
            c.fillText(label, sx, ay - 8);
        }
        else {
            // ekran kenarına yaslı ok
            const cx = this.w / 2;
            const cy = this.h / 2;
            const dx = sx - cx;
            const dy = sy - cy;
            const k = Math.min((cx - 44) / Math.max(1, Math.abs(dx)), (cy - 130) / Math.max(1, Math.abs(dy)), (cy - 110) / Math.max(1, Math.abs(dy)));
            const ex = cx + dx * k;
            const ey = cy + dy * k;
            const ang = Math.atan2(dy, dx);
            c.translate(ex, ey);
            c.rotate(ang);
            c.fillStyle = `rgba(0,0,0,${0.35 * pulse})`;
            c.beginPath();
            c.arc(0, 0, 26, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = t.color;
            c.beginPath();
            c.moveTo(20 + bob * 0.5, 0);
            c.lineTo(-10, -16);
            c.lineTo(-4, 0);
            c.lineTo(-10, 16);
            c.closePath();
            c.fill();
            c.strokeStyle = 'rgba(0,0,0,0.6)';
            c.lineWidth = 2;
            c.stroke();
            c.rotate(-ang);
            c.lineWidth = 4;
            c.strokeStyle = 'rgba(0,0,0,0.75)';
            const ty = ey < cy ? 44 : -34;
            c.strokeText(label, 0, ty);
            c.fillStyle = '#fff';
            c.fillText(label, 0, ty);
        }
        c.restore();
    }
    /** köprüde yeni ada yüklenirken küçük bir "Yükleniyor…" rozeti */
    drawLoading() {
        if (this.loadT <= 0 && this.pendingLoads <= 0)
            return;
        const c = this.ctx;
        const w = 150;
        const x = this.w / 2 - w / 2;
        const y = 58;
        c.fillStyle = 'rgba(10,6,30,0.78)';
        c.beginPath();
        c.roundRect(x, y, w, 30, 15);
        c.fill();
        c.strokeStyle = 'rgba(190,160,255,0.5)';
        c.lineWidth = 1.5;
        c.stroke();
        c.strokeStyle = '#ffe36b';
        c.lineWidth = 3;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(x + 20, y + 15, 7, this.time * 6, this.time * 6 + 4.2);
        c.stroke();
        c.font = 'bold 13px sans-serif';
        c.textAlign = 'left';
        c.fillStyle = '#fff';
        c.fillText('Yükleniyor…', x + 36, y + 20);
        c.textAlign = 'center';
    }
    drawHome(camX, camY) {
        const c = this.ctx;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 2);
        for (const rp of this.restPoints()) {
            if (!this.inView(rp.x, rp.y, rp.r + 120, camX, camY))
                continue;
            const g = c.createRadialGradient(rp.x, rp.y, 10, rp.x, rp.y, rp.r);
            g.addColorStop(0, `rgba(120,255,170,${0.22 + 0.1 * pulse})`);
            g.addColorStop(1, 'rgba(120,255,170,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            c.fill();
            const size = rp.reg === 0 ? 150 : 110;
            if (!this.drawSprX('home', rp.x, rp.y - size * 0.47, size)) {
                c.fillStyle = '#7a5a3a';
                c.fillRect(rp.x - 34, rp.y - 80, 68, 50);
                c.fillStyle = '#b04a4a';
                c.beginPath();
                c.moveTo(rp.x - 44, rp.y - 80);
                c.lineTo(rp.x, rp.y - 118);
                c.lineTo(rp.x + 44, rp.y - 80);
                c.fill();
            }
            c.font = 'bold 12px sans-serif';
            c.textAlign = 'center';
            c.fillStyle = '#c8ffd8';
            c.fillText(rp.reg === 0 ? 'EV · hızlı iyileşme' : 'KAMP · hızlı iyileşme', rp.x, rp.y + 34);
        }
        if (this.inHome()) {
            for (let k = 0; k < 6; k++) {
                const ph = (this.time * 0.7 + k / 6) % 1;
                c.fillStyle = `rgba(160,255,190,${1 - ph})`;
                c.font = 'bold 16px sans-serif';
                c.fillText('+', this.px + Math.sin(k * 2.1) * 40, this.py - 20 - ph * 50);
            }
        }
    }
    drawMaster(i, camX, camY) {
        if (!this.masterOpen(i))
            return;
        const m = this.masterPos(i);
        if (!this.inView(m.x, m.y, 120, camX, camY))
            return;
        const c = this.ctx;
        const near = Math.hypot(m.x - this.px, m.y - this.py) < 130;
        if (!this.drawSprX('master', m.x, m.y, 84, { bob: Math.sin(this.time * 2) * 2, flip: this.px < m.x ? -1 : 1, sy: 1 + 0.015 * Math.sin(this.time * 2.5) })) {
            c.fillStyle = '#2f8a8a';
            c.beginPath();
            c.arc(m.x, m.y, 18, 0, Math.PI * 2);
            c.fill();
        }
        c.font = 'bold 12px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = '#9ff0ff';
        c.fillText('Usta Cadı ' + ZONES[i].master, m.x, m.y - 64);
        if (near) {
            c.fillStyle = '#ffe36b';
            c.fillText('Eğitim için dokun!', m.x, m.y - 80 + Math.sin(this.time * 5) * 2);
        }
    }
    drawGate(i, camX, camY) {
        const c = this.ctx;
        const g = this.gatePos(i);
        if (!this.inView(g.x, g.y, 200, camX, camY))
            return;
        const b = this.bridge(i);
        const ang = Math.atan2(b.by - b.ay, b.bx - b.ax);
        const locked = this.gateLocked(i);
        const ga = this.gateAnim && this.gateAnim.i === i ? this.gateAnim : null;
        const open = locked ? 0 : ga ? Math.min(1, (3.6 - ga.t) / 1.4) : 1;
        drawGateArt(c, g.x, g.y, -Math.sin(ang), Math.cos(ang), locked, open, this.time, this.spr('ui_lock'));
        if (ga) {
            for (let r = 0; r < 3; r++) {
                const ph = ((3.6 - ga.t) * 0.9 + r / 3) % 1;
                c.strokeStyle = `rgba(150,255,190,${1 - ph})`;
                c.lineWidth = 5;
                c.beginPath();
                c.arc(g.x, g.y, 20 + ph * 130, 0, Math.PI * 2);
                c.stroke();
            }
        }
        c.font = 'bold 12px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = locked ? '#ffd0a0' : '#b8ffcc';
        c.fillText(locked ? 'KİLİTLİ — ' + ZONES[i].bossName + ' yenilmeli' : 'Kapı açık', g.x, g.y - 130);
    }
    drawPlayer() {
        const c = this.ctx;
        const blink = this.invuln > 0 && Math.floor(this.time * 20) % 2 === 0;
        const flip = Math.cos(this.face) < 0 ? -1 : 1;
        const t = this.time;
        const cast = this.castPulse > 0 ? this.castPulse / 0.28 : 0;
        const o = this.moving
            ? { bob: -Math.abs(Math.sin(t * 11)) * 5, rot: Math.sin(t * 11) * 0.06, sy: 1 + 0.04 * Math.sin(t * 22), sx: 1 }
            : { bob: Math.sin(t * 2) * 1.6, rot: 0, sy: 1 + 0.018 * Math.sin(t * 2.5), sx: 1 };
        const sc = 1 + 0.12 * cast;
        const helm = this.item('helmet');
        const shield = this.item('shield');
        c.globalAlpha = blink ? 0.5 : 1;
        const flying = this.flyT > 0;
        // yürüyüş tozu / uçuş parıltısı
        for (const p of this.puffs) {
            const k = p.t / (p.fly ? 0.5 : 0.45);
            c.fillStyle = p.fly ? `rgba(200,170,255,${0.7 * k})` : `rgba(215,200,170,${0.5 * k})`;
            c.beginPath();
            c.arc(p.x, p.y, (p.fly ? 3 : 4) + (1 - k) * (p.fly ? 6 : 8), 0, Math.PI * 2);
            c.fill();
        }
        // gölge (uçarken küçülür)
        c.fillStyle = flying ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.25)';
        c.beginPath();
        c.ellipse(this.px, this.py + 18, flying ? 14 : 20, flying ? 5 : 7, 0, 0, Math.PI * 2);
        c.fill();
        const lift = flying ? -30 + Math.sin(t * 4) * 3 : 0;
        // animasyon karesi: uçuş > büyü > yürüyüş (iki kare) > duruş
        let frame = 'witch';
        const has = (n) => !!this.spr(n);
        if (flying && has('witch_fly1') && has('witch_fly2'))
            frame = Math.floor(t * 4) % 2 === 0 ? 'witch_fly1' : 'witch_fly2';
        else if (flying && has('witch_fly'))
            frame = 'witch_fly';
        else if (cast > 0 && has('witch_cast1') && has('witch_cast2'))
            frame = cast > 0.5 ? 'witch_cast2' : 'witch_cast1';
        else if (cast > 0 && has('witch_cast'))
            frame = 'witch_cast';
        else if (this.moving && has('witch_walk4'))
            frame = 'witch_walk' + (1 + (Math.floor(t * 9) % 4));
        const drawn = this.drawSprX(frame, this.px, this.py - 8, flying ? 94.8 : 81.6, {
            flip, rot: o.rot + cast * 0.12 * flip, sx: o.sx * sc, sy: o.sy * sc, bob: o.bob + lift, flash: this.hurtFlash > 0,
        });
        if (!drawn) {
            c.fillStyle = '#6d3fc0';
            c.beginPath();
            c.arc(this.px, this.py + 4, 13, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#f2c9a0';
            c.beginPath();
            c.arc(this.px, this.py - 4, 9, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#2a1a55';
            c.beginPath();
            c.moveTo(this.px - 15, this.py - 8);
            c.lineTo(this.px + 15, this.py - 8);
            c.lineTo(this.px + 2, this.py - 32);
            c.closePath();
            c.fill();
        }
        if (helm) {
            c.fillStyle = RARITIES[helm.rarity].color;
            c.beginPath();
            c.arc(this.px + 2 * flip, this.py - 44 + o.bob, 3.5, 0, Math.PI * 2);
            c.fill();
        }
        if (shield) {
            c.fillStyle = RARITIES[shield.rarity].color;
            const sx = this.px - 30 * flip;
            c.beginPath();
            c.moveTo(sx - 6, this.py - 2);
            c.lineTo(sx + 6, this.py - 2);
            c.lineTo(sx + 6, this.py + 6);
            c.quadraticCurveTo(sx, this.py + 16, sx - 6, this.py + 6);
            c.closePath();
            c.fill();
        }
        c.globalAlpha = 1;
        // karakterin üstünde can ve güç
        const bw = 62;
        const by = this.py - 73 + (flying ? -30 : 0);
        if (flying) {
            c.fillStyle = 'rgba(0,0,0,0.55)';
            c.fillRect(this.px - bw / 2 - 1, by + 9, bw + 2, 6);
            c.fillStyle = '#c8b6ff';
            c.fillRect(this.px - bw / 2, by + 10, (bw * this.flyT) / 5, 4);
        }
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(this.px - bw / 2 - 1, by - 1, bw + 2, 8);
        const f = Math.max(0, Math.min(1, this.hp / this.maxHp()));
        c.fillStyle = f > 0.5 ? '#5fe07a' : f > 0.2 ? '#ffd84a' : '#ff5a5a';
        c.fillRect(this.px - bw / 2, by, bw * f, 6);
        c.font = `bold ${Math.round(12 * this.lk())}px sans-serif`;
        c.textAlign = 'center';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.strokeText('⚔ ' + this.fmt(this.power()), this.px, by - 4);
        c.fillStyle = '#ffe36b';
        c.fillText('⚔ ' + this.fmt(this.power()), this.px, by - 4);
    }
    drawDeath(d) {
        const k = 1 - d.t / 0.45;
        this.drawSprX(d.name, d.x, d.y, d.size * (1 - 0.5 * k), { flip: d.flip, alpha: 1 - k, rot: k * 0.8 * d.flip, sy: 1 - 0.4 * k, flash: k < 0.4 });
    }
    drawEnemy(e) {
        const c = this.ctx;
        const tier = TIERS[e.tier];
        const r = e.def.r * tier.size;
        const t = e.phase;
        const boss = e.tier === 'boss';
        const size = r * 3.3;
        const o = { flip: e.flip, rot: 0, sx: 1, sy: 1, alpha: 1, bob: 0, flash: e.flash > 0 };
        switch (e.def.id) {
            case 'ghost':
                o.bob = Math.sin(t * 3) * 6 - 6;
                o.alpha = 0.88 + 0.1 * Math.sin(t * 4);
                o.rot = Math.sin(t * 2) * 0.08 + (e.moving ? 0.1 * e.flip : 0);
                break;
            case 'mushroom':
                o.rot = e.moving ? Math.sin(t * 9) * 0.13 : Math.sin(t * 1.5) * 0.03;
                o.sy = 1 + (e.moving ? 0.05 * Math.sin(t * 18) : 0.02 * Math.sin(t * 2));
                break;
            case 'pumpkin':
                o.bob = e.moving ? -Math.abs(Math.sin(t * 7)) * 9 : Math.sin(t * 2) * 1.5;
                o.sy = e.moving ? 1 + 0.08 * Math.cos(t * 7) : 1;
                o.sx = 2 - o.sy;
                break;
            case 'bat':
                o.sx = 0.72 + 0.28 * Math.abs(Math.sin(t * 17));
                o.bob = Math.sin(t * 6) * 7 - 10;
                break;
        }
        if (boss) {
            o.sy = 1 + 0.03 * Math.sin(t * 2);
            o.bob = 0;
            o.rot = e.moving ? Math.sin(t * 6) * 0.04 : 0;
        }
        if (e.lunge > 0) {
            const k = e.lunge / 0.25;
            o.sx *= 1 + 0.18 * k;
            o.sy *= 1 - 0.1 * k;
        }
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.beginPath();
        c.ellipse(e.x, e.y + r * 0.7, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
        c.fill();
        const sprName = boss ? ZONES[e.reg].art.boss : e.def.id;
        if (e.beast) {
            const pr = 0.5 + 0.5 * Math.sin(this.time * 4);
            const gr = c.createRadialGradient(e.x, e.y, 10, e.x, e.y, r * 3);
            gr.addColorStop(0, `rgba(255,60,60,${0.35 + 0.2 * pr})`);
            gr.addColorStop(1, 'rgba(255,60,60,0)');
            c.fillStyle = gr;
            c.beginPath();
            c.arc(e.x, e.y, r * 3, 0, Math.PI * 2);
            c.fill();
        }
        if (!this.drawSprX(sprName, e.x, e.y, e.beast ? size * 1.25 : size, o)) {
            const fallback = { ghost: '#e8e8ff', mushroom: '#e0576a', pumpkin: '#ff9a3c', bat: '#8a6bd1', scorpion: '#d9a24a', golem: '#8a7a74', wisp: '#7be0ff' };
            c.fillStyle = boss ? '#7a4fd0' : fallback[e.def.id];
            c.beginPath();
            c.arc(e.x, e.y, r, 0, Math.PI * 2);
            c.fill();
        }
        if (e.beast) {
            c.font = `bold ${Math.round(12 * this.lk())}px sans-serif`;
            c.textAlign = 'center';
            c.fillStyle = '#ff7a7a';
            c.fillText('CANAVAR', e.x, e.y - r - 60);
        }
        const sp = this.spawnerMap.get(e.sp);
        if (sp && sp.tag)
            this.drawSpr('icon_' + sp.tag, e.x, e.y - r - 44, 22);
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(e.x - r - 1, e.y - r - 15, r * 2 + 2, 8);
        const hf = Math.max(0, e.hp) / e.maxHp;
        c.fillStyle = hf <= 0.2 ? '#ff5a5a' : hf <= 0.5 ? '#ffd84a' : '#5fe07a';
        c.fillRect(e.x - r, e.y - r - 14, r * 2 * hf, 6);
        const ratio = this.enemyPower(e) / Math.max(1, this.power());
        const col = ratio < 0.6 ? '#7bff9a' : ratio < 1.6 ? '#ffe36b' : '#ff6b6b';
        c.font = `bold ${Math.round(13 * this.lk())}px sans-serif`;
        c.textAlign = 'center';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.strokeText('⚔ ' + this.fmt(this.enemyPower(e)), e.x, e.y - r - 19);
        c.fillStyle = col;
        c.fillText('⚔ ' + this.fmt(this.enemyPower(e)), e.x, e.y - r - 19);
        if (Math.hypot(e.x - this.px, e.y - this.py) < 200) {
            const a = this.spr('ui_' + e.def.atk);
            const w = this.spr('ui_' + this.weakness(e));
            if (a && w) {
                c.drawImage(a, e.x - 26, e.y + r + 4, 18, 18);
                c.drawImage(w, e.x + 8, e.y + r + 4, 18, 18);
                c.fillStyle = '#e9e4ff';
                c.font = `${Math.round(11 * this.lk())}px sans-serif`;
                c.fillText('›', e.x, e.y + r + 17);
            }
            else {
                c.font = `${Math.round(11 * this.lk())}px sans-serif`;
                c.fillStyle = '#e9e4ff';
                c.fillText(DTYPE_NAMES[e.def.atk] + ' vurur · ' + DTYPE_NAMES[this.weakness(e)] + ' zayıf', e.x, e.y + r + 14);
            }
        }
    }
    drawProj(p) {
        const c = this.ctx;
        if (p.kind === 'bolt') {
            c.strokeStyle = 'rgba(255,216,74,0.45)';
            c.lineWidth = 5;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(p.x - Math.cos(p.a) * 26, p.y - Math.sin(p.a) * 26);
            c.lineTo(p.x, p.y);
            c.stroke();
            if (!this.drawSpr('icon_wand', p.x, p.y, 34, this.time * 12)) {
                c.fillStyle = '#ffd84a';
                c.beginPath();
                c.arc(p.x, p.y, 8, 0, Math.PI * 2);
                c.fill();
            }
        }
        else if (p.kind === 'broom') {
            if (!this.drawSpr('icon_broom', p.x, p.y, 58, this.time * 14)) {
                c.fillStyle = '#c98a4b';
                c.fillRect(p.x - 18, p.y - 3, 36, 6);
            }
        }
        else if (p.kind === 'potion') {
            if (!this.drawSpr('icon_potion', p.x, p.y, 36, this.time * 8)) {
                c.fillStyle = '#7bdcff';
                c.beginPath();
                c.arc(p.x, p.y, 9, 0, Math.PI * 2);
                c.fill();
            }
            c.fillStyle = 'rgba(0,0,0,0.25)';
            c.beginPath();
            c.ellipse(p.sx + (p.tx - p.sx) * Math.min(1, p.life / p.max), p.sy + (p.ty - p.sy) * Math.min(1, p.life / p.max), 10, 5, 0, 0, Math.PI * 2);
            c.fill();
        }
        else if (p.kind === 'ring') {
            const k = p.life / p.max;
            c.strokeStyle = `rgba(123,220,255,${1 - k})`;
            c.lineWidth = 6;
            c.beginPath();
            c.arc(p.x, p.y, p.r * (0.3 + 0.7 * k), 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = `rgba(123,220,255,${0.25 * (1 - k)})`;
            c.fill();
        }
        else {
            const k = p.life / p.max;
            c.strokeStyle = `rgba(210,180,255,${1 - k})`;
            c.lineWidth = 10;
            c.lineCap = 'round';
            c.beginPath();
            c.arc(p.x, p.y, p.r * 0.8, p.a - 1.0, p.a - 1.0 + 2.0 * Math.min(1, k * 1.6));
            c.stroke();
        }
    }
    /** ganimet / kazanç yazıları: karakterin üstünde, sıralı, efektli ("+30 Can kazanıldı") */
    /** kapı açılınca ekranda büyüyüp sönen yazı + ışık patlaması */
    drawGateBanner() {
        const ga = this.gateAnim;
        if (!ga)
            return;
        const c = this.ctx;
        const age = 3.6 - ga.t;
        const pop = 1 + 0.6 * Math.exp(-age * 5);
        const alpha = Math.min(1, ga.t / 0.8, age / 0.15);
        const cx = this.w / 2;
        const cy = this.h * 0.7;
        c.save();
        c.globalAlpha = alpha * 0.35;
        const g = c.createRadialGradient(cx, cy, 10, cx, cy, 220);
        g.addColorStop(0, 'rgba(150,255,190,0.9)');
        g.addColorStop(1, 'rgba(150,255,190,0)');
        c.fillStyle = g;
        c.fillRect(cx - 220, cy - 220, 440, 440);
        c.globalAlpha = alpha;
        c.translate(cx, cy);
        c.scale(pop, pop);
        c.font = 'bold 30px sans-serif';
        c.textAlign = 'center';
        c.lineWidth = 6;
        c.strokeStyle = 'rgba(0,40,20,0.85)';
        c.strokeText('KAPI AÇILDI!', 0, 0);
        c.fillStyle = '#b8ffcc';
        c.fillText('KAPI AÇILDI!', 0, 0);
        c.font = 'bold 15px sans-serif';
        const sub = ZONES[ga.i + 1].name + ' yolu açık';
        c.strokeText(sub, 0, 26);
        c.fillStyle = '#fff';
        c.fillText(sub, 0, 26);
        c.restore();
    }
    drawGains() {
        const c = this.ctx;
        const active = this.gains.filter((g) => g.delay <= 0);
        const baseY = this.h / 2 - 96;
        c.textAlign = 'left';
        active.forEach((g, i) => {
            const age = 1.9 - g.t;
            const slot = active.length - 1 - i; // en yeni altta
            const pop = 1 + 0.45 * Math.exp(-age * 9);
            const alpha = Math.min(1, g.t / 0.45, age / 0.08 + 0.2);
            const y = baseY - slot * 24 - Math.min(age, 0.6) * 14;
            c.save();
            c.globalAlpha = alpha;
            c.font = 'bold 17px sans-serif';
            const tw = c.measureText(g.text).width;
            const iw = g.icon && this.spr(g.icon) ? 24 : 0;
            const total = tw + iw;
            c.translate(this.w / 2, y);
            c.scale(pop, pop);
            c.shadowColor = g.color;
            c.shadowBlur = 10;
            c.lineWidth = 4;
            c.strokeStyle = 'rgba(0,0,0,0.75)';
            c.lineJoin = 'round';
            c.strokeText(g.text, -total / 2 + iw, 6);
            c.fillStyle = g.color;
            c.fillText(g.text, -total / 2 + iw, 6);
            c.shadowBlur = 0;
            if (iw)
                c.drawImage(this.spr(g.icon), -total / 2, -12, 22, 22);
            c.restore();
        });
    }
    drawHud() {
        const c = this.ctx;
        const zone = this.zone();
        const bw = Math.min(230, this.w - 150);
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(12, 12, bw, 16);
        c.fillStyle = '#e0445a';
        c.fillRect(12, 12, (bw * Math.max(0, this.hp)) / this.maxHp(), 16);
        c.fillStyle = '#fff';
        c.font = '12px sans-serif';
        c.textAlign = 'left';
        this.drawSpr('ui_heart', 24, 20, 20);
        c.fillText(this.fmt(Math.max(0, this.hp)) + ' / ' + this.fmt(this.maxHp()), 38, 25);
        if (!this.drawSpr('ui_power', 24, 46, 22)) {
            c.fillStyle = '#ffe36b';
            c.fillText('⚔', 14, 50);
        }
        c.font = 'bold 14px sans-serif';
        c.fillStyle = '#ffe36b';
        c.fillText(this.fmt(this.power()), 38, 51);
        c.font = '12px sans-serif';
        c.fillStyle = '#fff';
        const cp = this.campProgress();
        c.fillText(zone.name, 12, 72);
        this.drawSpr('ui_home', 20, 88, 18);
        c.fillText('kamp ' + cp.done + '/' + cp.total + ' · sandık ' + this.chestsOpened() + '/6', 32, 92);
        if (this.bannerT > 0) {
            c.textAlign = 'center';
            c.font = this.w < 700 ? 'bold 14px sans-serif' : 'bold 18px sans-serif';
            c.globalAlpha = Math.min(1, this.bannerT);
            c.lineWidth = 4;
            c.strokeStyle = 'rgba(0,0,0,0.7)';
            c.strokeText(this.banner, this.w / 2, this.h * 0.3);
            c.fillStyle = '#fff';
            c.fillText(this.banner, this.w / 2, this.h * 0.3);
            c.globalAlpha = 1;
        }
        if (this.joy) {
            c.strokeStyle = 'rgba(255,255,255,0.35)';
            c.lineWidth = 2;
            c.beginPath();
            c.arc(this.joy.ox, this.joy.oy, 50, 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.35)';
            const dx = this.joy.x - this.joy.ox;
            const dy = this.joy.y - this.joy.oy;
            const d = Math.min(50, Math.hypot(dx, dy));
            const a = Math.atan2(dy, dx);
            c.beginPath();
            c.arc(this.joy.ox + Math.cos(a) * d, this.joy.oy + Math.sin(a) * d, 20, 0, Math.PI * 2);
            c.fill();
        }
        if (this.dead > 0) {
            c.fillStyle = 'rgba(0,0,0,0.5)';
            c.fillRect(0, 0, this.w, this.h);
            c.fillStyle = '#fff';
            c.textAlign = 'center';
            c.font = 'bold 26px sans-serif';
            c.fillText('Bayıldın… evde uyanıyorsun', this.w / 2, this.h / 2);
        }
    }
    arrow(cx, cy, ang, s) {
        const c = this.ctx;
        c.save();
        c.translate(cx, cy);
        c.rotate(ang);
        c.beginPath();
        c.moveTo(s, 0);
        c.lineTo(-s * 0.8, s * 0.72);
        c.lineTo(-s * 0.35, 0);
        c.lineTo(-s * 0.8, -s * 0.72);
        c.closePath();
        c.fillStyle = '#fff';
        c.fill();
        c.lineWidth = 1.5;
        c.strokeStyle = '#3a2a8a';
        c.stroke();
        c.restore();
    }
    /** küçük harita: bulunduğumuz alan; dokununca büyük harita */
    drawMinimap() {
        const c = this.ctx;
        const rad = Math.min(64, this.w * 0.17);
        const cx = this.w - rad - 12;
        const cy = 58 + rad;
        this.mini = { x: cx, y: cy, r: rad };
        const view = 700; // dünya birimi: ekranda yarıçap
        const k = rad / view;
        const X = (x) => cx + (x - this.px) * k;
        const Y = (y) => cy + (y - this.py) * k;
        c.save();
        c.beginPath();
        c.arc(cx, cy, rad, 0, Math.PI * 2);
        c.clip();
        c.fillStyle = '#0c2742';
        c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        for (let i = 0; i < ZONES.length - 1; i++) {
            const b = this.bridge(i);
            c.strokeStyle = '#6b5436';
            c.lineWidth = BRIDGE_HALF_WIDTH * 2 * k;
            c.beginPath();
            c.moveTo(X(b.ax), Y(b.ay));
            c.lineTo(X(b.bx), Y(b.by));
            c.stroke();
        }
        ZONES.forEach((z) => { c.fillStyle = z.bg; c.beginPath(); c.arc(X(z.cx), Y(z.cy), z.radius * k, 0, Math.PI * 2); c.fill(); });
        for (const sp of this.getWorld().spawners) {
            if (Math.abs(sp.x - this.px) > view || Math.abs(sp.y - this.py) > view)
                continue;
            c.fillStyle = this.spCleared(sp) ? 'rgba(160,160,160,0.7)' : TIERS[sp.tier].color;
            const s = sp.tier === 'boss' ? 6 : sp.tier === 'elite' || sp.tier === 'knight' ? 4.5 : 3.2;
            c.fillRect(X(sp.x) - s / 2, Y(sp.y) - s / 2, s, s);
        }
        c.fillStyle = '#fff';
        for (const ch of this.getWorld().chests) {
            if (this.save.chests.includes(ch.id) || !this.chestShown(ch, 0) || Math.hypot(ch.x - this.px, ch.y - this.py) > 520)
                continue;
            c.fillRect(X(ch.x) - 2, Y(ch.y) - 2, 4, 4);
        }
        this.drawSpr('ui_home', X(HOME.x), Y(HOME.y), 16);
        for (let i = 0; i < ZONES.length - 1; i++) {
            const g = this.gatePos(i);
            c.fillStyle = this.gateLocked(i) ? '#ff8a5a' : '#7bff9a';
            c.fillRect(X(g.x) - 2, Y(g.y) - 4, 4, 8);
            const m = this.masterPos(i);
            if (!this.masterOpen(i))
                continue;
            c.fillStyle = '#9ff0ff';
            c.beginPath();
            c.arc(X(m.x), Y(m.y), 3, 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
        this.arrow(cx, cy, this.face, 7);
        c.strokeStyle = 'rgba(255,255,255,0.65)';
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(cx, cy, rad, 0, Math.PI * 2);
        c.stroke();
        c.font = '10px sans-serif';
        c.fillStyle = 'rgba(255,255,255,0.8)';
        c.textAlign = 'center';
        c.fillText('dokun: harita', cx, cy + rad + 12);
    }
    /** büyük harita: bütün dünya, ok bakış yönünü gösterir */
    drawFullMap() {
        const c = this.ctx;
        c.fillStyle = 'rgba(4,12,24,0.88)';
        c.fillRect(0, 0, this.w, this.h);
        const minX = Math.min(...ZONES.map((z) => z.cx - z.radius)) - 80;
        const maxX = Math.max(...ZONES.map((z) => z.cx + z.radius)) + 80;
        const minY = Math.min(...ZONES.map((z) => z.cy - z.radius)) - 80;
        const maxY = Math.max(...ZONES.map((z) => z.cy + z.radius)) + 80;
        const k = Math.min((this.w * 0.94) / (maxX - minX), (this.h * 0.6) / (maxY - minY));
        const mw = (maxX - minX) * k;
        const mh = (maxY - minY) * k;
        const mx = (this.w - mw) / 2;
        const my = (this.h - mh) / 2 - 10;
        const X = (x) => mx + (x - minX) * k;
        const Y = (y) => my + (y - minY) * k;
        c.fillStyle = '#0c2742';
        c.fillRect(mx, my, mw, mh);
        c.strokeStyle = 'rgba(255,255,255,0.5)';
        c.lineWidth = 2;
        c.strokeRect(mx, my, mw, mh);
        for (let i = 0; i < ZONES.length - 1; i++) {
            const b = this.bridge(i);
            c.strokeStyle = '#6b5436';
            c.lineWidth = Math.max(3, BRIDGE_HALF_WIDTH * 2 * k);
            c.beginPath();
            c.moveTo(X(b.ax), Y(b.ay));
            c.lineTo(X(b.bx), Y(b.by));
            c.stroke();
        }
        ZONES.forEach((z, zi) => {
            c.fillStyle = z.bg;
            c.beginPath();
            c.arc(X(z.cx), Y(z.cy), z.radius * k, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = zi === this.region ? '#ffe36b' : this.save.bossDown[zi] ? 'rgba(120,255,160,0.7)' : 'rgba(255,255,255,0.25)';
            c.lineWidth = zi === this.region ? 3 : 2;
            c.stroke();
            c.font = `bold ${Math.max(9, Math.min(15, z.radius * k * 0.6))}px sans-serif`;
            c.textAlign = 'center';
            c.fillStyle = '#fff';
            c.fillText(String(zi + 1), X(z.cx), Y(z.cy) + 4);
        });
        for (const sp of this.getWorld().spawners) {
            c.fillStyle = this.spCleared(sp) ? 'rgba(160,160,160,0.7)' : TIERS[sp.tier].color;
            const s = sp.tier === 'boss' ? 9 : sp.tier === 'elite' || sp.tier === 'knight' ? 6 : 4;
            c.fillRect(X(sp.x) - s / 2, Y(sp.y) - s / 2, s, s);
        }
        c.fillStyle = '#fff';
        for (const ch of this.getWorld().chests) {
            if (this.save.chests.includes(ch.id) || !this.chestShown(ch, 0))
                continue;
            if (Math.hypot(ch.x - this.px, ch.y - this.py) < 900)
                c.fillRect(X(ch.x) - 2.5, Y(ch.y) - 2.5, 5, 5);
        }
        this.drawSpr('ui_home', X(HOME.x), Y(HOME.y), 24);
        for (let i = 0; i < ZONES.length - 1; i++) {
            const g = this.gatePos(i);
            if (!this.drawSpr(this.gateLocked(i) ? 'ui_lock' : 'ui_skill', X(g.x), Y(g.y), 24)) {
                c.fillStyle = this.gateLocked(i) ? '#ff8a5a' : '#7bff9a';
                c.fillRect(X(g.x) - 3, Y(g.y) - 6, 6, 12);
            }
            const m = this.masterPos(i);
            if (!this.masterOpen(i))
                continue;
            c.fillStyle = '#9ff0ff';
            c.beginPath();
            c.arc(X(m.x), Y(m.y), 5, 0, Math.PI * 2);
            c.fill();
        }
        this.arrow(X(this.px), Y(this.py), this.face, 11);
        c.font = 'bold 16px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = '#ffe36b';
        c.fillText(`Ada ${this.region + 1}/${ZONES.length} · ${ZONES[this.region].name} · aşılan: ${this.bossesDown()}`, this.w / 2, 28);
        // açıklama
        const items = [['Kolay', TIERS.easy.color], ['Orta', TIERS.medium.color], ['Zor', TIERS.hard.color], ['Elit', TIERS.elite.color],
            ['Muhafız', TIERS.knight.color], ['Boss', TIERS.boss.color], ['Temiz', '#a0a0a0'], ['Usta', '#9ff0ff'], ['Sandık', '#ffffff']];
        c.font = '12px sans-serif';
        c.textAlign = 'left';
        let lx = mx;
        const ly = my + mh + 22;
        for (const [name, col] of items) {
            c.fillStyle = col;
            c.fillRect(lx, ly - 9, 10, 10);
            c.fillStyle = '#fff';
            c.fillText(name, lx + 14, ly);
            lx += 14 + c.measureText(name).width + 12;
            if (lx > mx + mw - 60) {
                lx = mx;
            }
        }
        c.textAlign = 'center';
        c.fillStyle = '#ffe36b';
        c.font = 'bold 14px sans-serif';
        c.fillText('Ok: bakış yönün · Kapatmak için dokun', this.w / 2, my + mh + 50);
    }
}
Game.TRAIN_PER_DAY = 2;
/** denge: kalıcı kazanç ve ruh çarpanları (tools/bot.js ile ölçülür) */
Game.YIELD = 1;
/** bir adayı bitirince oyuncunun gücü, o adanın boss gücünün kaç katı olsun */
Game.MARGIN = 1.3;
