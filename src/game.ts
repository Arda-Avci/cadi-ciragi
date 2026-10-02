import {
  BRIDGE_HALF_WIDTH, CRYSTAL_STATS, CSTAT_KEYS, CStat, DType, DTYPES, DTYPE_NAMES, ENEMIES, EnemyDef, EnemyId, EQUIP_NAMES,
  MAX_ENCHANT, MAX_ITEM_LEVEL, MAX_WEAPON_LEVEL, RARITIES, SlotType, TIERS, Tier, UPGRADES, WEAPONS, ZONES, crystalValue,
  enchantChance, enchantCost, itemUpgradeCost, itemValue, upgradeCost, weaponLevelCopies,
} from './data.js';

export interface Crystal { id: number; rarity: number; stat: CStat; enchant: number }
export interface Item { id: number; type: SlotType; rarity: number; level: number; dtype: DType }

export interface SaveData {
  essence: number;
  upgrades: Record<string, number>;
  weapons: number[];
  copies: number[];
  loadout: number[];
  x: number;
  y: number;
  bossDown: boolean[];
  kills: number;
  deaths: number;
  geodes: number;
  dust: number;
  crystals: Crystal[];
  equipped: number[];
  nextCrystal: number;
  chests: number[]; // açılan sandık kimlikleri
  seen: Record<string, number>; // karşılaşılan düşman türleri (kartlar için)
  train: Record<string, number>; // usta cadı eğitimi bekleme süreleri (ms)
  chestBonus: Record<string, number>;
  items: Item[];
  eq: { helmet: number; shield: number };
  nextItem: number;
  spawn: Record<string, number>; // 's<id>' / 't<id>' -> yeniden doğma zamanı (ms)
  perm: Record<string, number>; // haritadan kazanılan kalıcı statlar
}

interface Spawner { id: number; reg: number; x: number; y: number; tier: Tier; kind: EnemyId; tag?: SlotType; lv: number }
interface ResTree { id: number; reg: number; x: number; y: number; s: number; big: boolean }
interface Chest { id: number; reg: number; x: number; y: number }
interface World { spawners: Spawner[]; trees: ResTree[]; chests: Chest[] }

/** Evimiz: doğduğumuz yer ve hızlı iyileşme alanı */
export const HOME = { x: 0, y: 40, r: 150 };
const HOME_HEAL = 0.28; // saniyede azami canın oranı

interface DeathFx { x: number; y: number; t: number; name: string; size: number; flip: number }
interface Gain { text: string; color: string; icon: string; t: number; delay: number; key?: string; amount?: number; fmt?: (n: number) => string }

interface Enemy {
  def: EnemyDef;
  tier: Tier;
  lv: number;
  reg: number;
  sp: number;
  x: number; y: number; hx: number; hy: number;
  hp: number; maxHp: number;
  state: 'idle' | 'chase' | 'return';
  hitCd: number;
  phase: number;
  dashT: number;
  dvx: number; dvy: number;
  flip: number; // bakış yönü: 1 sağ, -1 sol
  flash: number; // vurulma parlaması
  lunge: number; // saldırı hamlesi
  moving: boolean;
}

interface Orb { x: number; y: number; v: number; kind: 'ess' | 'heal' | 'geode' }
interface Floater { x: number; y: number; t: number; text: string; color: string }

/** Büyü mermisi / efekti */
interface Proj {
  kind: 'bolt' | 'broom' | 'potion' | 'ring' | 'slash';
  x: number; y: number; vx: number; vy: number;
  sx: number; sy: number; tx: number; ty: number;
  dmg: number; dtype: DType;
  life: number; max: number;
  phase: number;
  pierce: number;
  r: number;
  a: number;
  hit: Set<object>;
}

const SAVE_KEY = 'cadi-ciragi-v5';
const TREE_RESPAWN = 120;
const GATE_GAP = 160; // kapı, bölge kıyısından bu kadar ileride

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  readonly ctx: CanvasRenderingContext2D;
  save: SaveData;
  px = 0; py = 0;
  region = 0;
  hp = 100;
  invuln = 0;
  time = 0;
  skew = 0; // test için: gerçek zaman kaydırma (ms)
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  orbs: Orb[] = [];
  floaters: Floater[] = [];
  paused = false;
  dead = 0;
  banner = '';
  bannerT = 0;
  keys = new Set<string>();
  joy: { ox: number; oy: number; x: number; y: number } | null = null;
  onChange: () => void = () => {};
  // animasyon / efekt durumu
  face = 0; // bakış yönü (radyan): haritadaki ok bunu gösterir
  moving = false;
  mapOpen = false;
  castPulse = 0;
  /** süpürge uçuşu: kalan saniye; havadayken düşman zarar veremez */
  flyT = 0;
  private flyMark = new WeakMap<Enemy, number>();
  private puffs: { x: number; y: number; t: number; fly: boolean }[] = [];
  private puffT = 0;
  /** kapı açılış animasyonu (bölge numarası, kalan süre) */
  gateAnim: { i: number; t: number } | null = null;
  hurtFlash = 0;
  deathFx: DeathFx[] = [];
  gains: Gain[] = [];
  private healAcc = 0;
  private healShow = 0;
  private nowMs = Date.now();
  private mini = { x: 0, y: 0, r: 0 };
  private world: World | null = null;
  private treeHp = new Map<number, number>();
  private cast = new Map<number, number>();
  private saveT = 0;
  private w = 0;
  private h = 0;
  private sprites = new Map<string, HTMLImageElement>();

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.loadSprites();
    this.save = this.load();
    this.px = this.save.x;
    this.py = this.save.y;
    this.hp = this.maxHp();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ---- görseller ----
  private loadSprites(): void {
    fetch('assets/manifest.json')
      .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
      .then((names) => {
        for (const n of names) {
          const img = new Image();
          img.onload = () => this.sprites.set(n, img);
          img.src = 'assets/' + n + '.png';
        }
      })
      .catch(() => { /* görsel yok: kodla çizilir */ });
  }
  private spr(name: string): HTMLImageElement | null { return this.sprites.get(name) ?? null; }
  private drawSpr(name: string, x: number, y: number, size: number, rot = 0): boolean {
    const img = this.spr(name);
    if (!img) return false;
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.drawImage(img, -size / 2, -size / 2, size, size);
    c.restore();
    return true;
  }

  // ---- kayıt ----
  private fresh(): SaveData {
    return {
      essence: 0, upgrades: {}, weapons: [1, 0, 0, 0], copies: [0, 0, 0, 0], loadout: [0], x: HOME.x, y: HOME.y + 70,
      bossDown: [false, false, false], kills: 0, deaths: 0, geodes: 1, dust: 20, crystals: [], equipped: [], nextCrystal: 1,
      chests: [], seen: {}, train: {}, chestBonus: {}, items: [], eq: { helmet: 0, shield: 0 }, nextItem: 1, spawn: {}, perm: {},
    };
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return { ...this.fresh(), ...(JSON.parse(raw) as Partial<SaveData>) };
    } catch (e) {
      console.error('kayıt okunamadı', e);
    }
    return this.fresh();
  }

  persist(): void {
    try {
      this.save.x = this.px;
      this.save.y = this.py;
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch (e) {
      console.error('kayıt yazılamadı', e);
    }
  }

  resetSave(): void {
    localStorage.removeItem(SAVE_KEY);
    this.save = this.fresh();
    this.enemies = [];
    this.projs = [];
    this.orbs = [];
    this.treeHp.clear();
    this.cast.clear();
    this.gains = [];
    this.deathFx = [];
    this.px = this.save.x; this.py = this.save.y;
    this.hp = this.maxHp();
    this.onChange();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  now(): number { return this.nowMs + this.skew; }

  /** ganimet/kazanç yazısı: efektli, sıraya girerek oyuncunun üstünde belirir */
  gain(text: string, color = '#ffe36b', icon = '', merge?: { key: string; amount: number; fmt: (n: number) => string }): void {
    if (merge) {
      // aynı türden kısa aralıklı kazançlar tek satırda toplanır (+7, +7, +7 → +21)
      const same = this.gains.find((g) => g.key === merge.key && g.t > 1.0);
      if (same) {
        same.amount = (same.amount ?? 0) + merge.amount;
        same.text = merge.fmt(same.amount);
        same.t = 1.9;
        return;
      }
    }
    const pending = this.gains.filter((g) => g.delay > 0).length;
    if (this.gains.length > 10) this.gains.shift();
    this.gains.push({ text, color, icon, t: 1.9, delay: pending * 0.14, key: merge?.key, amount: merge?.amount, fmt: merge?.fmt });
  }

  // ---- dünya: bölgeler, köprüler, kapılar ----
  private regionCenter(r: number): { x: number; y: number; r: number } {
    const z = ZONES[r];
    return { x: z.cx, y: z.cy, r: z.radius };
  }

  /** köprü i, bölge i ile i+1 arasını bağlar */
  private bridge(i: number): { ax: number; ay: number; bx: number; by: number; len: number; tGate: number } {
    const a = this.regionCenter(i);
    const b = this.regionCenter(i + 1);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y, len, tGate: (a.r + GATE_GAP) / len };
  }
  inHome(): boolean { return Math.hypot(this.px - HOME.x, this.py - HOME.y) < HOME.r; }
  gateLocked(i: number): boolean { return !this.save.bossDown[i]; }
  gatePos(i: number): { x: number; y: number } {
    const b = this.bridge(i);
    return { x: b.ax + (b.bx - b.ax) * b.tGate, y: b.ay + (b.by - b.ay) * b.tGate };
  }

  /** (x,y) yürünebilir mi (kilitli kapının ötesi hariç) */
  walkable(x: number, y: number, ignoreGates = false): boolean {
    for (let i = 0; i < ZONES.length; i++) {
      const c = this.regionCenter(i);
      if (Math.hypot(x - c.x, y - c.y) <= c.r - 18) return true;
    }
    for (let i = 0; i < ZONES.length - 1; i++) {
      const b = this.bridge(i);
      const dx = b.bx - b.ax;
      const dy = b.by - b.ay;
      const t = ((x - b.ax) * dx + (y - b.ay) * dy) / (b.len * b.len);
      if (t < 0 || t > 1) continue;
      const d = Math.hypot(x - (b.ax + dx * t), y - (b.ay + dy * t));
      if (d > BRIDGE_HALF_WIDTH) continue;
      if (!ignoreGates && this.gateLocked(i) && t > b.tGate) continue;
      return true;
    }
    return false;
  }

  private regionAt(x: number, y: number): number {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < ZONES.length; i++) {
      const c = this.regionCenter(i);
      const d = Math.hypot(x - c.x, y - c.y) / c.r;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  getWorld(): World {
    if (this.world) return this.world;
    const spawners: Spawner[] = [];
    const trees: ResTree[] = [];
    const chests: Chest[] = [];
    const lvRange: Record<Tier, [number, number]> = {
      easy: [0.35, 1.8], medium: [0.5, 3.5], hard: [0.8, 6], elite: [1.2, 9], knight: [1.2, 5], boss: [3, 6],
    };
    ZONES.forEach((zone, reg) => {
      const R = zone.radius;
      const rnd = rng(reg * 7919 + 13);
      const placed: { x: number; y: number }[] = [];
      const clearOfHome = (p: { x: number; y: number }): boolean => reg !== 0 || Math.hypot(p.x - HOME.x, p.y - HOME.y) > 330;
      const place = (minD: number, maxD: number, sep: number): { x: number; y: number } => {
        for (let tries = 0; tries < 60; tries++) {
          const a = rnd() * Math.PI * 2;
          const d = minD + rnd() * (maxD - minD);
          const p = { x: zone.cx + Math.cos(a) * d, y: zone.cy + Math.sin(a) * d };
          if (clearOfHome(p) && placed.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > sep)) { placed.push(p); return p; }
        }
        const a = rnd() * Math.PI * 2;
        const p = { x: zone.cx + Math.cos(a) * maxD, y: zone.cy + Math.sin(a) * maxD };
        placed.push(p);
        return p;
      };
      const band: Record<Tier, [number, number]> = {
        easy: [240, R * 0.5], medium: [R * 0.3, R * 0.65], hard: [R * 0.5, R * 0.78],
        elite: [R * 0.55, R - 160], knight: [R * 0.4, R - 140], boss: [R * 0.7, R * 0.8],
      };
      (Object.keys(zone.layout) as Tier[]).forEach((tier) => {
        for (let i = 0; i < zone.layout[tier]; i++) {
          const p = place(band[tier][0], band[tier][1], 190);
          const kind = zone.enemies[Math.floor(rnd() * zone.enemies.length)];
          const [lo, hi] = lvRange[tier];
          spawners.push({
            id: spawners.length, reg, x: p.x, y: p.y, tier, kind, lv: lo * Math.pow(hi / lo, rnd()),
            tag: tier === 'knight' ? (i % 2 === 0 ? 'helmet' : 'shield') : undefined,
          });
        }
      });
      for (let i = 0; i < zone.resTrees; i++) { const p = place(160, R - 100, 120); trees.push({ id: trees.length, reg, x: p.x, y: p.y, s: 1.4, big: true }); }
      for (let i = 0; i < 6; i++) { const p = place(200, R - 80, 160); chests.push({ id: chests.length, reg, x: p.x, y: p.y }); }
      // diğer bütün ağaçlar da kesilebilir (küçük ödül)
      for (let i = 0; i < 90 + reg * 20; i++) {
        const a = rnd() * Math.PI * 2;
        const d = 60 + rnd() * (R - 100);
        const p = { x: zone.cx + Math.cos(a) * d, y: zone.cy + Math.sin(a) * d };
        if (!clearOfHome(p)) continue;
        trees.push({ id: trees.length, reg, x: p.x, y: p.y, s: 0.7 + rnd() * 0.7, big: false });
      }
    });
    this.world = { spawners, trees, chests };
    return this.world;
  }

  isCleared(key: string): boolean { return (this.save.spawn[key] ?? 0) > this.now(); }
  /** kamp temiz mi: yenilen boss bir daha çıkmaz */
  spCleared(sp: Spawner): boolean { return this.isCleared('s' + sp.id) || (sp.tier === 'boss' && this.save.bossDown[sp.reg]); }

  // ---- statlar ----
  lv(id: string): number { return this.save.upgrades[id] ?? 0; }
  perm(k: string): number { return this.save.perm[k] ?? 0; }
  private cb(stat: CStat): number {
    let v = this.save.chestBonus[stat] ?? 0;
    for (const id of this.save.equipped) {
      const c = this.save.crystals.find((x) => x.id === id);
      if (c && c.stat === stat) v += crystalValue(c.stat, c.rarity, c.enchant);
    }
    return v;
  }
  item(type: SlotType): Item | undefined {
    const id = this.save.eq[type];
    return id ? this.save.items.find((x) => x.id === id) : undefined;
  }
  private helmetHp(): number { const h = this.item('helmet'); return h ? itemValue('helmet', h.rarity, h.level) : 0; }
  private helmetRegen(): number { const h = this.item('helmet'); return h && h.rarity >= 3 ? 1.5 * (h.rarity - 2) : 0; }
  private blockChance(): number { const s = this.item('shield'); return s && s.rarity >= 3 ? 0.08 * (s.rarity - 2) : 0; }
  typedReduction(t: DType): number {
    const s = this.item('shield');
    if (!s) return 0;
    const v = itemValue('shield', s.rarity, s.level);
    return s.dtype === t ? v : v * 0.5;
  }
  maxHp(): number {
    return (100 + this.perm('normal.hp') + this.perm('elite.hp') + this.perm('tree.hp')) * (1 + 0.2 * this.lv('hp'))
      * (1 + (this.cb('hp') + this.helmetHp() + this.perm('elite.hpPct') + this.perm('train.hp')) / 100);
  }
  regen(): number { return 0.6 * this.lv('regen') + this.cb('regen') + this.helmetRegen() + this.perm('tree.regen') + this.perm('train.regen'); }
  armor(): number { return Math.max(0.2, 1 - 0.04 * this.lv('armor')); }
  dmgMul(): number { return (1 + 0.12 * this.lv('dmg')) * (1 + (this.cb('dmg') + this.perm('elite.dmgPct') + this.perm('train.dmg')) / 100); }
  castSpeed(): number { return 1 + 0.08 * this.lv('spin'); }
  reachMul(): number { return 1 + 0.06 * this.lv('reach'); }
  magnet(): number { return 70 + 25 * this.lv('magnet') + this.cb('magnet'); }
  yieldMul(): number { return (1 + 0.1 * this.lv('yield')) * (1 + this.cb('yield') / 100); }
  speed(): number { return 150 * (1 + 0.04 * this.lv('speed')) * (1 + this.cb('speed') / 100) * (this.flyT > 0 ? 1.35 : 1); }
  critChance(): number { return Math.min(0.75, this.cb('crit') / 100); }
  lifesteal(): number { return Math.min(0.5, this.cb('lifesteal') / 100); }
  evasion(): number { return Math.min(0.6, this.cb('evasion') / 100); }
  weaponDmg(i: number): number {
    return (WEAPONS[i].baseDmg * (1 + 0.15 * (this.save.weapons[i] - 1)) + this.perm('normal.dmg')) * this.dmgMul();
  }
  weaponCopies(i: number): number { return 1 + Math.min(3, Math.floor((this.save.weapons[i] - 1) / 5)); }
  zone() { return ZONES[this.region]; }
  bossesDown(): number { return this.save.bossDown.filter(Boolean).length; }
  slots(): number { return Math.min(4, 2 + this.bossesDown()); }
  weaponSlots(): number { return Math.min(4, 1 + this.bossesDown() + (this.save.kills >= 25 ? 1 : 0)); }
  chestsOpened(reg: number = this.region): number {
    return this.getWorld().chests.filter((c) => c.reg === reg && this.save.chests.includes(c.id)).length;
  }

  equippedWeapons(): number[] {
    return this.save.loadout.filter((i) => this.save.weapons[i] > 0).slice(0, this.weaponSlots());
  }
  toggleWeapon(i: number): boolean {
    const at = this.save.loadout.indexOf(i);
    if (at >= 0) { if (this.save.loadout.length > 1) this.save.loadout.splice(at, 1); else return false; }
    else if (this.save.weapons[i] > 0 && this.save.loadout.length < this.weaponSlots()) this.save.loadout.push(i);
    else return false;
    this.persist();
    this.onChange();
    return true;
  }
  private autoEquip(i: number): void {
    if (!this.save.loadout.includes(i) && this.save.loadout.length < this.weaponSlots()) this.save.loadout.push(i);
  }

  /** Güç: kuşanılan büyülerin saniyelik hasarı ile savunma düzeltmeli canın geometrik ortalaması. */
  power(): number {
    let dps = 0;
    for (const i of this.equippedWeapons()) dps += (this.weaponDmg(i) * this.weaponCopies(i) * this.castSpeed()) / WEAPONS[i].cooldown;
    const red = (this.typedReduction('cut') + this.typedReduction('pierce') + this.typedReduction('smash')) / 3 / 100;
    // can azaldıkça güç de azalır: mevcut can esas alınır
    const effHp = Math.max(1, Math.min(this.hp, this.maxHp())) / (this.armor() * (1 - Math.min(0.9, red)));
    return Math.floor(Math.sqrt(effHp * Math.max(1, dps)) * 10);
  }
  enemyDmg(e: Enemy): number { return e.def.dmg * TIERS[e.tier].dmg * ZONES[e.reg].dmgScale * Math.sqrt(e.lv); }
  enemyPower(e: Enemy): number { return Math.floor(Math.sqrt(Math.max(1, e.hp) * (this.enemyDmg(e) / 0.6)) * 10); }
  weakness(e: Enemy): DType { return DTYPES.reduce((b, t) => (e.def.resist[t] > e.def.resist[b] ? t : b), DTYPES[0]); }

  statLines(): { label: string; value: string }[] {
    const f = (n: number): string => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1));
    const out: { label: string; value: string }[] = [
      { label: 'Güç', value: this.fmt(this.power()) },
      { label: 'Azami can', value: f(this.maxHp()) },
      { label: 'Kritik / Can çalma / Kaçınma', value: `%${(this.critChance() * 100).toFixed(1)} / %${(this.lifesteal() * 100).toFixed(1)} / %${(this.evasion() * 100).toFixed(1)}` },
      { label: 'Yenilenme', value: f(this.regen()) + '/sn' },
      { label: 'Hasar çarpanı', value: '×' + this.dmgMul().toFixed(2) },
      { label: 'Alınan hasar çarpanı', value: '×' + this.armor().toFixed(2) },
    ];
    for (const t of DTYPES) out.push({ label: DTYPE_NAMES[t] + ' savunması', value: '%' + this.typedReduction(t).toFixed(1) });
    out.push({ label: 'map.normal_mob', value: `+${f(this.perm('normal.hp'))} can, +${f(this.perm('normal.dmg'))} hasar` });
    out.push({ label: 'map.elite', value: `+${f(this.perm('elite.hp'))} can, +%${this.perm('elite.hpPct').toFixed(1)} can, +%${this.perm('elite.dmgPct').toFixed(1)} hasar` });
    out.push({ label: 'map.tree', value: `+${f(this.perm('tree.hp'))} can, +${this.perm('tree.regen').toFixed(2)} yenilenme` });
    return out;
  }

  // ---- satın alma / yükseltme ----
  buyUpgrade(id: string): boolean {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const lvl = this.lv(id);
    if (lvl >= def.max) return false;
    if (def.requires && this.lv(def.requires) < 1) return false;
    const cost = upgradeCost(def, lvl);
    if (this.save.essence < cost) return false;
    this.save.essence -= cost;
    this.save.upgrades[id] = lvl + 1;
    this.persist();
    this.onChange();
    return true;
  }

  weaponNeed(i: number): number {
    return this.save.weapons[i] === 0 ? WEAPONS[i].unlockCopies : weaponLevelCopies(this.save.weapons[i]);
  }
  upgradeWeapon(i: number): boolean {
    const lvl = this.save.weapons[i];
    const need = this.weaponNeed(i);
    if (lvl >= MAX_WEAPON_LEVEL || this.save.copies[i] < need) return false;
    this.save.copies[i] -= need;
    this.save.weapons[i] = lvl + 1;
    if (lvl === 0) this.autoEquip(i);
    this.persist();
    this.onChange();
    return true;
  }

  // ---- kristaller ----
  openGeode(): Crystal | null {
    if (this.save.geodes < 1) return null;
    this.save.geodes--;
    const total = RARITIES.reduce((s, r) => s + r.w, 0);
    let roll = Math.random() * total;
    let rarity = 0;
    for (let i = 0; i < RARITIES.length; i++) { roll -= RARITIES[i].w; if (roll <= 0) { rarity = i; break; } }
    const c: Crystal = {
      id: this.save.nextCrystal++, rarity, stat: CSTAT_KEYS[Math.floor(Math.random() * CSTAT_KEYS.length)], enchant: 0,
    };
    this.save.crystals.push(c);
    this.persist();
    this.onChange();
    return c;
  }

  toggleCrystal(id: number): boolean {
    const eq = this.save.equipped;
    const at = eq.indexOf(id);
    if (at >= 0) eq.splice(at, 1);
    else if (eq.length < this.slots()) eq.push(id);
    else return false;
    this.hp = Math.min(this.hp, this.maxHp());
    this.persist();
    this.onChange();
    return true;
  }

  enchantCrystal(id: number): 'ok' | 'fail' | 'poor' | 'max' {
    const c = this.save.crystals.find((x) => x.id === id);
    if (!c) return 'poor';
    if (c.enchant >= MAX_ENCHANT) return 'max';
    const cost = enchantCost(c.enchant);
    if (this.save.dust < cost) return 'poor';
    this.save.dust -= cost;
    const ok = Math.random() < enchantChance(c.enchant);
    if (ok) c.enchant++;
    this.persist();
    this.onChange();
    return ok ? 'ok' : 'fail';
  }

  sellCrystal(id: number): void {
    const c = this.save.crystals.find((x) => x.id === id);
    if (!c) return;
    this.save.dust += 6 * (1 + c.rarity) * (1 + c.enchant);
    this.save.crystals = this.save.crystals.filter((x) => x.id !== id);
    this.save.equipped = this.save.equipped.filter((x) => x !== id);
    this.persist();
    this.onChange();
  }

  // ---- miğfer / kalkan ----
  gainItem(type: SlotType, minRarity = 0): Item {
    const w = [60, 25, 10, 4, 1];
    const total = w.reduce((s, x) => s + x, 0);
    let roll = Math.random() * total;
    let r = 0;
    for (let i = 0; i < w.length; i++) { roll -= w[i]; if (roll <= 0) { r = i; break; } }
    const it: Item = {
      id: this.save.nextItem++, type, rarity: Math.max(minRarity, r), level: 1, dtype: DTYPES[Math.floor(Math.random() * 3)],
    };
    this.save.items.push(it);
    this.gain(RARITIES[it.rarity].name + ' ' + EQUIP_NAMES[type][it.rarity] + ' (' + DTYPE_NAMES[it.dtype] + ') bulundu!', RARITIES[it.rarity].color, 'icon_' + type);
    // hemen kullanılabilir: yuva boşsa ya da yeni eşya daha güçlüyse anında kuşanılır
    const cur = this.save.items.find((x) => x.id === this.save.eq[type]);
    if (!cur || it.rarity * 100 + it.level > cur.rarity * 100 + cur.level) {
      this.save.eq[type] = it.id;
      this.gain(EQUIP_NAMES[type][it.rarity] + ' kuşanıldı', '#ffe36b', 'icon_' + type);
    }
    this.persist();
    this.onChange();
    return it;
  }

  toggleItem(id: number): void {
    const it = this.save.items.find((x) => x.id === id);
    if (!it) return;
    this.save.eq[it.type] = this.save.eq[it.type] === id ? 0 : id;
    this.hp = Math.min(this.hp, this.maxHp());
    this.persist();
    this.onChange();
  }

  upgradeItem(id: number): boolean {
    const it = this.save.items.find((x) => x.id === id);
    if (!it || it.level >= MAX_ITEM_LEVEL) return false;
    const cost = itemUpgradeCost(it.level, it.rarity);
    if (this.save.essence < cost) return false;
    this.save.essence -= cost;
    it.level++;
    this.persist();
    this.onChange();
    return true;
  }

  sellItem(id: number): void {
    const it = this.save.items.find((x) => x.id === id);
    if (!it) return;
    this.save.dust += 8 * (1 + it.rarity) * it.level;
    this.save.items = this.save.items.filter((x) => x.id !== id);
    if (this.save.eq[it.type] === id) this.save.eq[it.type] = 0;
    this.persist();
    this.onChange();
  }

  // ---- simülasyon ----
  update(dt: number): void {
    if (this.paused || this.mapOpen) return;
    this.nowMs = Date.now();
    this.time += dt;
    this.bannerT = Math.max(0, this.bannerT - dt);
    this.castPulse = Math.max(0, this.castPulse - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    for (const g of this.gains) { if (g.delay > 0) g.delay -= dt; else g.t -= dt; }
    this.gains = this.gains.filter((g) => g.t > 0);
    for (const d of this.deathFx) d.t -= dt;
    this.deathFx = this.deathFx.filter((d) => d.t > 0);
    if (this.dead > 0) {
      this.dead -= dt;
      if (this.dead <= 0) this.respawn();
      return;
    }
    this.flyT = Math.max(0, this.flyT - dt);
    if (this.gateAnim) { this.gateAnim.t -= dt; if (this.gateAnim.t <= 0) this.gateAnim = null; }
    this.movePlayer(dt);
    this.updatePuffs(dt);
    this.region = this.regionAt(this.px, this.py);
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
    this.invuln = Math.max(0, this.invuln - dt);
    this.syncSpawners();
    this.updateEnemies(dt);
    this.castSpells(dt);
    this.updateProjs(dt);
    this.removeDead();
    this.checkChests();
    for (const f of this.floaters) { f.t -= dt; f.y -= 28 * dt; }
    this.floaters = this.floaters.filter((f) => f.t > 0);
    this.saveT += dt;
    if (this.saveT > 5) { this.saveT = 0; this.persist(); }
  }

  /** yürüyüş tozu / uçuş parıltısı izi */
  private updatePuffs(dt: number): void {
    for (const p of this.puffs) p.t -= dt;
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

  private movePlayer(dt: number): void {
    let mx = 0;
    let my = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.joy) {
      const dx = this.joy.x - this.joy.ox;
      const dy = this.joy.y - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > 8) { mx = dx / Math.max(d, 50); my = dy / Math.max(d, 50); }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.moving = len > 0.05;
    if (this.moving) this.face = Math.atan2(my, mx);
    const nx = this.px + mx * this.speed() * dt;
    const ny = this.py + my * this.speed() * dt;
    if (this.walkable(nx, ny)) { this.px = nx; this.py = ny; }
    else if (this.walkable(nx, this.py)) this.px = nx;
    else if (this.walkable(this.px, ny)) this.py = ny;
  }

  /** Temizlenmemiş kampları sahada tutar. Dalga yok: kamp yalnızca temizlenip süresi dolunca yeniden dolar. */
  private syncSpawners(): void {
    const live = new Set<number>();
    for (const e of this.enemies) live.add(e.sp);
    for (const sp of this.getWorld().spawners) {
      if (live.has(sp.id) || this.spCleared(sp)) continue;
      this.spawnGroup(sp);
    }
  }

  private spawnGroup(sp: Spawner): void {
    const zone = ZONES[sp.reg];
    const tier = TIERS[sp.tier];
    const def = ENEMIES[sp.kind];
    for (let i = 0; i < tier.count; i++) {
      const a = (i / tier.count) * Math.PI * 2 + sp.id;
      const x = sp.x + (tier.count > 1 ? Math.cos(a) * 46 : 0);
      const y = sp.y + (tier.count > 1 ? Math.sin(a) * 46 : 0);
      const maxHp = def.hp * tier.hp * zone.scale * sp.lv;
      this.enemies.push({
        def, tier: sp.tier, lv: sp.lv, reg: sp.reg, sp: sp.id, x, y, hx: x, hy: y, hp: maxHp, maxHp, state: 'idle', hitCd: 0,
        phase: Math.random() * 6, dashT: 3, dvx: 0, dvy: 0, flip: Math.random() < 0.5 ? 1 : -1, flash: 0, lunge: 0, moving: false,
      });
    }
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 1500 && e.state === 'idle') continue; // uzaktaki kamplar uyur
      e.hitCd = Math.max(0, e.hitCd - dt);
      e.flash = Math.max(0, e.flash - dt);
      e.lunge = Math.max(0, e.lunge - dt);
      e.phase += dt;
      const big = e.tier === 'boss';
      const aggro = big ? 400 : 250 + (e.tier === 'elite' || e.tier === 'knight' ? 40 : 0);
      const leash = big ? 700 : 480;
      const home = Math.hypot(e.hx - e.x, e.hy - e.y);
      if (d < 320 && !this.save.seen[e.def.id + (big ? '_boss' + e.reg : '')]) {
        this.save.seen[e.def.id + (big ? '_boss' + e.reg : '')] = 1;
        this.onChange();
      }
      const safe = this.inHome(); // ev güvenli bölge: düşmanlar içeri girmez
      if (safe && e.state === 'chase') e.state = 'return';
      if (e.state === 'idle' && d < aggro && !safe) e.state = 'chase';
      else if (e.state === 'chase' && (home > leash || d > aggro * 2.2)) e.state = 'return';
      else if (e.state === 'return' && home < 8) e.state = 'idle';
      let sp = e.def.speed;
      if (e.def.id === 'bat') sp *= 1 + 0.5 * Math.sin(e.phase * 5);
      let vx = 0;
      let vy = 0;
      if (e.state === 'chase') {
        if (big) {
          e.dashT -= dt;
          if (e.dashT < 0) { e.dashT = 3.2; e.dvx = (dx / d) * 360; e.dvy = (dy / d) * 360; }
          if (e.dashT > 2.6) { vx = e.dvx; vy = e.dvy; } else { vx = (dx / d) * sp; vy = (dy / d) * sp; }
        } else { vx = (dx / d) * sp; vy = (dy / d) * sp; }
      } else if (e.state === 'return') {
        vx = ((e.hx - e.x) / home) * sp * 1.6;
        vy = ((e.hy - e.y) / home) * sp * 1.6;
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
      } else {
        vx = Math.cos(e.phase * 0.8 + e.sp) * 6;
        vy = Math.sin(e.phase * 0.7 + e.sp) * 6;
      }
      const nx = e.x + vx * dt;
      const ny = e.y + vy * dt;
      if (this.walkable(nx, ny, true)) { e.x = nx; e.y = ny; }
      e.moving = Math.abs(vx) + Math.abs(vy) > 14;
      if (Math.abs(vx) > 4) e.flip = vx > 0 ? 1 : -1;
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
        this.invuln = 0.6;
        this.float(this.px, this.py - 20, '-' + this.fmt(hit), '#ff6b6b');
        if (this.hp <= 0) { this.die(); return; }
      }
    }
  }

  // ---- büyüler ----
  private nearestTarget(range: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bd = range;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d < bd) { bd = d; best = { x: e.x, y: e.y }; }
    }
    if (best) return best;
    for (const t of this.getWorld().trees) {
      if (this.isCleared('t' + t.id)) continue;
      const d = Math.hypot(t.x - this.px, t.y - this.py);
      if (d < Math.min(bd, range * 0.8)) { bd = d; best = { x: t.x, y: t.y }; }
    }
    return best;
  }

  private newProj(kind: Proj['kind'], x: number, y: number, dmg: number, dtype: DType): Proj {
    return { kind, x, y, vx: 0, vy: 0, sx: x, sy: y, tx: x, ty: y, dmg, dtype, life: 0, max: 1, phase: 0, pierce: 0, r: 0, a: 0, hit: new Set() };
  }

  private castSpells(dt: number): void {
    for (const i of this.equippedWeapons()) {
      const cd = (this.cast.get(i) ?? 0) - dt;
      if (cd > 0) { this.cast.set(i, cd); continue; }
      const w = WEAPONS[i];
      const t = this.nearestTarget(w.range * this.reachMul());
      if (!t) { this.cast.set(i, 0.1); continue; }
      this.fire(i, t);
      this.cast.set(i, w.cooldown / this.castSpeed());
    }
  }

  private fire(i: number, t: { x: number; y: number }): void {
    const w = WEAPONS[i];
    const dmg = this.weaponDmg(i);
    const n = this.weaponCopies(i);
    const ang = Math.atan2(t.y - this.py, t.x - this.px);
    this.castPulse = 0.28;
    if (!this.moving) this.face = ang;
    const reach = this.reachMul();
    if (w.id === 'wand') {
      for (let k = 0; k < n; k++) {
        const a = ang + (k - (n - 1) / 2) * 0.2;
        const p = this.newProj('bolt', this.px, this.py - 10, dmg, w.dtype);
        p.vx = Math.cos(a) * 560; p.vy = Math.sin(a) * 560; p.max = (w.range * reach + 60) / 560; p.pierce = 3; p.a = a;
        this.projs.push(p);
      }
    } else if (w.id === 'broom') {
      for (let k = 0; k < n; k++) {
        const a = ang + (k - (n - 1) / 2) * 0.55;
        const p = this.newProj('broom', this.px, this.py - 6, dmg, w.dtype);
        p.vx = Math.cos(a) * 440; p.vy = Math.sin(a) * 440; p.max = 5; p.r = w.range * reach; p.a = a;
        this.projs.push(p);
      }
    } else if (w.id === 'potion') {
      for (let k = 0; k < n; k++) {
        const off = k === 0 ? { x: 0, y: 0 } : { x: Math.cos(k * 2.4) * 60, y: Math.sin(k * 2.4) * 60 };
        const p = this.newProj('potion', this.px, this.py - 10, dmg, w.dtype);
        p.tx = t.x + off.x; p.ty = t.y + off.y; p.max = 0.6; p.r = 82 * reach;
        this.projs.push(p);
      }
    } else {
      const p = this.newProj('slash', this.px, this.py, dmg * (1 + 0.25 * (n - 1)), w.dtype);
      p.a = ang; p.r = 112 * reach; p.max = 0.22;
      this.projs.push(p);
      this.areaHit(p, true);
    }
  }

  /** Alan hasarı: ring (iksir patlaması) ya da slash (kepçe, ön koni) */
  private areaHit(p: Proj, cone: boolean): void {
    const apply = (ex: number, ey: number, er: number): boolean => {
      const d = Math.hypot(ex - p.x, ey - p.y);
      if (d > p.r + er) return false;
      if (!cone) return true;
      let da = Math.atan2(ey - p.y, ex - p.x) - p.a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      return Math.abs(da) < 1.0;
    };
    for (const e of this.enemies) {
      if (apply(e.x, e.y, e.def.r * TIERS[e.tier].size)) this.hitEnemy(e, p.dmg, p.dtype);
    }
    for (const t of this.getWorld().trees) {
      if (!this.isCleared('t' + t.id) && apply(t.x, t.y, 24)) this.hitTree(t, p.dmg);
    }
  }

  private updateProjs(dt: number): void {
    const keep: Proj[] = [];
    const enemies = this.enemies;
    const trees = this.getWorld().trees;
    for (const p of this.projs) {
      p.life += dt;
      if (p.kind === 'bolt') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        this.projCollide(p, enemies, trees, 12);
        if (p.life < p.max && p.pierce >= 0) keep.push(p);
      } else if (p.kind === 'broom') {
        const sp = 440;
        if (p.phase === 0) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (Math.hypot(p.x - p.sx, p.y - p.sy) >= p.r) { p.phase = 1; p.hit.clear(); }
        } else {
          const dx = this.px - p.x;
          const dy = this.py - p.y;
          const d = Math.hypot(dx, dy) || 1;
          p.x += (dx / d) * sp * dt; p.y += (dy / d) * sp * dt;
          if (d < 22) continue;
        }
        this.projCollide(p, enemies, trees, 18, true);
        if (p.life < p.max) keep.push(p);
      } else if (p.kind === 'potion') {
        const k = Math.min(1, p.life / p.max);
        p.x = p.sx + (p.tx - p.sx) * k;
        p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 70;
        if (p.life >= p.max) {
          const ring = this.newProj('ring', p.tx, p.ty, p.dmg, p.dtype);
          ring.r = p.r; ring.max = 0.35;
          this.areaHit(ring, false);
          keep.push(ring);
        } else keep.push(p);
      } else if (p.life < p.max) keep.push(p); // ring / slash: yalnızca görsel
    }
    this.projs = keep;
  }

  private projCollide(p: Proj, enemies: Enemy[], trees: ResTree[], r: number, once = false): void {
    for (const e of enemies) {
      if (p.hit.has(e)) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.def.r * TIERS[e.tier].size + r) {
        p.hit.add(e);
        this.hitEnemy(e, p.dmg, p.dtype);
        if (!once) { p.pierce--; if (p.pierce < 0) return; }
      }
    }
    for (const t of trees) {
      if (p.hit.has(t) || this.isCleared('t' + t.id)) continue;
      if (Math.hypot(t.x - p.x, t.y - p.y) < 26 + r) {
        p.hit.add(t);
        this.hitTree(t, p.dmg);
        if (!once) { p.pierce--; if (p.pierce < 0) return; }
      }
    }
  }

  private hitEnemy(e: Enemy, raw: number, dtype: DType): void {
    const crit = Math.random() < this.critChance();
    const dmg = Math.max(1, raw * e.def.resist[dtype] * (crit ? 3 : 1));
    e.hp -= dmg;
    e.flash = 0.14;
    if (e.tier === 'boss' || e.tier === 'hard') {
      // her %10'luk zararda 5 sn süpürge uçuşu
      const bucket = Math.min(10, Math.floor((1 - Math.max(0, e.hp) / e.maxHp) * 10));
      const prev = this.flyMark.get(e) ?? 0;
      this.flyMark.set(e, bucket);
      if (bucket > prev) {
        this.flyT = 5;
        this.gain('Süpürge uçuşu! 5 sn dokunulmazsın', '#c8b6ff', 'icon_broom');
      }
    }
    if (this.lifesteal() > 0) this.hp = Math.min(this.maxHp(), this.hp + dmg * this.lifesteal());
    if (e.state === 'idle') e.state = 'chase';
    this.float(e.x, e.y - e.def.r * TIERS[e.tier].size - 22, (crit ? '!' : '') + this.fmt(dmg), crit ? '#ffd84a' : '#ffffff');
  }

  treeMaxHp(t: ResTree): number { return (t.big ? 30 : 9) * ZONES[t.reg].scale * t.s; }

  private hitTree(t: ResTree, raw: number): void {
    const maxHp = this.treeMaxHp(t);
    const hp = (this.treeHp.get(t.id) ?? maxHp) - raw;
    this.float(t.x, t.y - 34 * t.s, this.fmt(raw), '#c8ffc8');
    if (hp <= 0) this.chopTree(t);
    else this.treeHp.set(t.id, hp);
  }

  private removeDead(): void {
    const alive: Enemy[] = [];
    const finished = new Set<number>();
    for (const e of this.enemies) {
      if (e.hp > 0) { alive.push(e); continue; }
      this.killEnemy(e);
      finished.add(e.sp);
    }
    if (finished.size === 0) return;
    this.enemies = alive;
    for (const id of finished) {
      if (!this.enemies.some((e) => e.sp === id)) this.completeSpawner(id);
    }
  }

  fmt(n: number): string {
    return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(Math.ceil(n));
  }

  private addPerm(k: string, v: number): void { this.save.perm[k] = (this.save.perm[k] ?? 0) + v; }

  private chopTree(t: ResTree): void {
    const z = ZONES[t.reg].scale;
    this.save.spawn['t' + t.id] = this.now() + (t.big ? TREE_RESPAWN * 2 : TREE_RESPAWN) * 1000;
    this.treeHp.delete(t.id);
    const k = t.big ? 2.5 : 0.5 * t.s;
    const before = this.maxHp();
    this.addPerm('tree.hp', k * z);
    this.addPerm('tree.regen', (t.big ? 0.02 : 0.004) * Math.sqrt(z));
    const dh = this.maxHp() - before;
    this.gain('+' + this.fmt(dh) + ' Can kazanıldı', '#7bff9a', 'ui_heart', { key: 'hp', amount: dh, fmt: (n) => '+' + this.fmt(n) + ' Can kazanıldı' });
    this.persist();
    this.onChange();
  }

  private killEnemy(e: Enemy): void {
    this.save.kills++;
    const value = Math.max(1, Math.round(e.def.drop * TIERS[e.tier].soul * Math.pow(ZONES[e.reg].scale, 0.7) * Math.sqrt(e.lv) * this.yieldMul()));
    // ganimet otomatik toplanır, etkisi yazıyla gösterilir
    this.save.essence += value;
    this.gain('+' + this.fmt(value) + ' Ruh', '#8fdcff', 'ui_soul', { key: 'soul', amount: value, fmt: (n) => '+' + this.fmt(n) + ' Ruh' });
    this.deathFx.push({ x: e.x, y: e.y, t: 0.45, name: e.tier === 'boss' ? ['boss_owl', 'boss_swamp', 'boss_frost'][e.reg] : e.def.id,
      size: e.def.r * TIERS[e.tier].size * 3.3, flip: e.flip });
    this.onChange();
  }

  private completeSpawner(id: number): void {
    const sp = this.getWorld().spawners[id];
    if (!sp) return;
    const tier = TIERS[sp.tier];
    const z = ZONES[sp.reg].scale;
    this.save.spawn['s' + id] = this.now() + (sp.tier === 'boss' ? 1e12 : tier.respawn * 1000); // boss bir daha çıkmaz
    const lvK = Math.sqrt(sp.lv);
    const FAST = 0.9; // kalıcı kazanç çarpanı (orijinale göre yine hızlı: haritada boss'a kadar ~10 dk)
    const hp0 = this.maxHp();
    const eq0 = this.equippedWeapons();
    const dmg0 = eq0.length ? this.weaponDmg(eq0[0]) : 0;
    if (tier.permanent === 'normal') {
      const rank = sp.tier === 'easy' ? 1 : sp.tier === 'medium' ? 2 : 3;
      this.addPerm('normal.hp', 4 * z * rank * lvK * FAST);
      this.addPerm('normal.dmg', 0.5 * z * rank * lvK * FAST);
    } else {
      const k = (sp.tier === 'boss' ? 5 : 1) * lvK * FAST;
      this.addPerm('elite.hp', 15 * z * k);
      this.addPerm('elite.hpPct', 0.4 * k);
      this.addPerm('elite.dmgPct', 0.4 * k);
    }
    if (this.maxHp() > hp0) {
      const dh = this.maxHp() - hp0;
      this.gain('+' + this.fmt(dh) + ' Can kazanıldı', '#7bff9a', 'ui_heart', { key: 'hp', amount: dh, fmt: (n) => '+' + this.fmt(n) + ' Can kazanıldı' });
    }
    if (eq0.length && this.weaponDmg(eq0[0]) > dmg0) {
      const dd = this.weaponDmg(eq0[0]) - dmg0;
      this.gain('+' + this.fmt(dd) + ' Hasar kazanıldı', '#ffb36b', 'ui_power', { key: 'dmg', amount: dd, fmt: (n) => '+' + this.fmt(n) + ' Hasar kazanıldı' });
    }
    const pool =sp.tier === 'easy' ? [0, 1] : sp.tier === 'medium' ? [1, 2] : sp.tier === 'hard' ? [2, 3] : [0, 1, 2, 3];
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
      if (h > 0) this.gain('+' + this.fmt(h) + ' Can iyileşti', '#7bff9a', 'ui_heart');
    }
    if (sp.tag) this.gainItem(sp.tag, Math.min(4, 1 + sp.reg));
    if (sp.tier === 'elite') { this.save.geodes++; this.gain('+1 Jeod', '#7dffb0', 'icon_geode'); }
    if (sp.tier === 'boss') {
      this.save.geodes += 3;
      this.gain('+3 Jeod', '#7dffb0', 'icon_geode');
      this.gainItem('helmet', 2);
      this.gainItem('shield', 2);
      if (!this.save.bossDown[sp.reg]) {
        this.save.bossDown[sp.reg] = true;
        if (sp.reg < ZONES.length - 1) this.gateAnim = { i: sp.reg, t: 3.6 };
        this.say(ZONES[sp.reg].bossName + ' yenildi! ' + (sp.reg < ZONES.length - 1 ? 'Sonraki bölgenin kapısı açıldı.' : 'Dünyayı tamamladın!'));
      } else this.say(ZONES[sp.reg].bossName + ' yenildi!');
    }
    this.persist();
    this.onChange();
  }

  private checkChests(): void {
    for (const c of this.getWorld().chests) {
      if (this.save.chests.includes(c.id)) continue;
      if (Math.hypot(c.x - this.px, c.y - this.py) < 28) {
        this.save.chests.push(c.id);
        const stat = CSTAT_KEYS[Math.floor(Math.random() * CSTAT_KEYS.length)];
        const amt = CRYSTAL_STATS[stat].base * 0.6;
        this.save.chestBonus[stat] = (this.save.chestBonus[stat] ?? 0) + amt;
        const souls = Math.round(40 * Math.pow(ZONES[c.reg].scale, 0.7) * this.yieldMul());
        this.save.essence += souls;
        this.save.geodes += 1;
        this.say('Gizli sandık bulundu! (' + this.chestsOpened(c.reg) + '/6)');
        this.gain('+' + amt.toFixed(1) + CRYSTAL_STATS[stat].unit + ' ' + CRYSTAL_STATS[stat].name + ' kazanıldı (kalıcı)', '#ffd84a', 'ui_' + stat);
        this.gain('+' + this.fmt(souls) + ' Ruh', '#8fdcff', 'ui_soul');
        this.gain('+1 Jeod', '#7dffb0', 'icon_geode');
        this.persist();
        this.onChange();
      }
    }
  }

  private die(): void {
    this.dead = 2.5;
    this.save.deaths++;
    this.persist();
    this.say('Bayıldın… düşmanlar kamplarına döndü.');
  }

  private respawn(): void {
    this.hp = this.maxHp();
    this.px = HOME.x; this.py = HOME.y + 70; // evimizde uyanırız
    for (const e of this.enemies) e.state = 'return';
    this.projs = [];
    this.invuln = 2;
  }

  private say(text: string): void { this.banner = text; this.bannerT = 4; }
  private float(x: number, y: number, text: string, color: string): void {
    if (this.floaters.length < 60) this.floaters.push({ x, y, t: 0.8, text, color });
  }

  campProgress(reg: number = this.region): { done: number; total: number } {
    const sps = this.getWorld().spawners.filter((s) => s.reg === reg);
    return { done: sps.filter((s) => this.spCleared(s)).length, total: sps.length };
  }

  // ---- usta cadılar (kapı başında eğitim) ----
  masterPos(i: number): { x: number; y: number } {
    const g = this.gatePos(i);
    const b = this.bridge(i);
    const ang = Math.atan2(b.by - b.ay, b.bx - b.ax);
    // kapının bu bölge tarafında, köprünün kenarında
    return { x: g.x - Math.cos(ang) * 150 - Math.sin(ang) * 150, y: g.y - Math.sin(ang) * 150 + Math.cos(ang) * 150 };
  }
  /** yakındaki usta cadının numarası, yoksa -1 */
  nearMaster(): number {
    for (let i = 0; i < ZONES.length - 1; i++) {
      if (!this.masterOpen(i)) continue;
      const m = this.masterPos(i);
      if (Math.hypot(m.x - this.px, m.y - this.py) < 130) return i;
    }
    return -1;
  }
  /** usta cadı yalnızca o seviyenin boss'u yenilince ortaya çıkar */
  masterOpen(i: number): boolean { return !!this.save.bossDown[i]; }
  static readonly TRAIN_PER_DAY = 2;
  private dayNo(): number { return Math.floor((this.now() - new Date().getTimezoneOffset() * -60000) / 86400000); }
  /** bugün bu usta için kalan eğitim hakkı (her seviye için günde 2) */
  trainPlaysLeft(master: number): number {
    const used = this.save.train['d' + master] === this.dayNo() ? (this.save.train['n' + master] ?? 0) : 0;
    return Math.max(0, Game.TRAIN_PER_DAY - used);
  }
  /** hakkı harcar; hak yoksa false */
  startTraining(master: number): boolean {
    if (!this.masterOpen(master) || this.trainPlaysLeft(master) <= 0) return false;
    const n = Game.TRAIN_PER_DAY - this.trainPlaysLeft(master) + 1;
    this.save.train['d' + master] = this.dayNo();
    this.save.train['n' + master] = n;
    this.persist();
    return true;
  }
  /** mini oyun bitti: puana göre kalıcı güç kazanılır (0..1) */
  finishTraining(master: number, kind: 'timing' | 'memory' | 'stars', score: number): void {
    const k = Math.max(0, Math.min(1, score)) * (1 + master * 0.8);
    if (kind === 'timing') {
      const eq = this.equippedWeapons();
      const d0 = eq.length ? this.weaponDmg(eq[0]) : 0;
      this.addPerm('train.dmg', 4 * k);
      if (eq.length) this.gain('+' + this.fmt(this.weaponDmg(eq[0]) - d0) + ' Hasar kazanıldı (eğitim)', '#ffb36b', 'ui_power');
    } else if (kind === 'memory') {
      const h0 = this.maxHp();
      this.addPerm('train.hp', 5 * k);
      this.gain('+' + this.fmt(this.maxHp() - h0) + ' Can kazanıldı (eğitim)', '#7bff9a', 'ui_heart');
    } else {
      this.addPerm('train.regen', 0.4 * k);
      this.gain('+' + (0.4 * k).toFixed(2) + ' Yenilenme/sn kazanıldı (eğitim)', '#9be7ff', 'ui_regen');
    }
    this.persist();
    this.onChange();
  }

  /** Ekrana dokunma: minimap → büyük harita, büyük harita → kapat, usta cadı → eğitim */
  handleTap(x: number, y: number): boolean {
    if (this.mapOpen) { this.mapOpen = false; return true; }
    if (Math.hypot(x - this.mini.x, y - this.mini.y) <= this.mini.r) { this.mapOpen = true; return true; }
    for (let i = 0; i < ZONES.length - 1; i++) {
      if (!this.masterOpen(i)) continue;
      const m = this.masterPos(i);
      const sx = this.w / 2 + (m.x - this.px);
      const sy = this.h / 2 + (m.y - this.py);
      if (Math.hypot(x - sx, y - sy) < 60 && Math.hypot(m.x - this.px, m.y - this.py) < 220) { this.onMaster(i); return true; }
    }
    return false;
  }
  onMaster: (i: number) => void = () => {};

  // ---- çizim ----
  render(): void {
    const c = this.ctx;
    const camX = this.px - this.w / 2;
    const camY = this.py - this.h / 2;
    c.fillStyle = '#0c2742';
    c.fillRect(0, 0, this.w, this.h);
    this.drawSeaWaves(camX, camY);
    this.drawLand(camX, camY);
    c.save();
    c.translate(-camX, -camY);
    this.drawWorldObjects(camX, camY);
    this.drawHome();
    for (let i = 0; i < ZONES.length - 1; i++) this.drawMaster(i, camX, camY);
    for (const d of this.deathFx) this.drawDeath(d);
    for (const e of this.enemies) if (this.inView(e.x, e.y, 140, camX, camY)) this.drawEnemy(e);
    this.drawPlayer();
    for (const p of this.projs) this.drawProj(p);
    c.font = 'bold 13px sans-serif';
    c.textAlign = 'center';
    for (const f of this.floaters) {
      c.globalAlpha = Math.min(1, f.t * 2);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;
    c.restore();
    this.drawGains();
    this.drawGateBanner();
    this.drawHud();
    this.drawMinimap();
    if (this.mapOpen) this.drawFullMap();
  }

  private inView(x: number, y: number, m: number, camX: number, camY: number): boolean {
    return x > camX - m && x < camX + this.w + m && y > camY - m && y < camY + this.h + m;
  }

  /** animasyonlu sprite: ayak noktasından döner/ezilir, yön çevirir, vurulunca parlar */
  private drawSprX(name: string, x: number, y: number, size: number, o: { flip?: number; rot?: number; sx?: number; sy?: number; alpha?: number; flash?: boolean; bob?: number } = {}): boolean {
    const img = this.spr(name);
    if (!img) return false;
    const c = this.ctx;
    c.save();
    c.translate(x, y + size * 0.32 + (o.bob ?? 0));
    if (o.rot) c.rotate(o.rot);
    c.scale((o.flip ?? 1) * (o.sx ?? 1), o.sy ?? 1);
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    if (o.flash && 'filter' in c) c.filter = 'brightness(2.4) saturate(0.6)';
    c.drawImage(img, -size / 2, -size * 0.82, size, size);
    c.restore();
    return true;
  }

  private drawSeaWaves(camX: number, camY: number): void {
    const c = this.ctx;
    c.strokeStyle = 'rgba(120,180,255,0.10)'; c.lineWidth = 2;
    const s = 120;
    for (let x = Math.floor(camX / s) * s; x < camX + this.w + s; x += s) {
      for (let y = Math.floor(camY / s) * s; y < camY + this.h + s; y += s) {
        const o = Math.sin(this.time * 1.2 + x * 0.05 + y * 0.03) * 6;
        c.beginPath(); c.moveTo(x - camX, y - camY + o); c.quadraticCurveTo(x - camX + 20, y - camY + o - 8, x - camX + 40, y - camY + o); c.stroke();
      }
    }
  }

  private drawLand(camX: number, camY: number): void {
    const c = this.ctx;
    for (let i = 0; i < ZONES.length - 1; i++) {
      const b = this.bridge(i);
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = BRIDGE_HALF_WIDTH * 2 + 10; c.lineCap = 'butt';
      c.beginPath(); c.moveTo(b.ax - camX, b.ay - camY); c.lineTo(b.bx - camX, b.by - camY); c.stroke();
      c.strokeStyle = '#6b5436'; c.lineWidth = BRIDGE_HALF_WIDTH * 2;
      c.beginPath(); c.moveTo(b.ax - camX, b.ay - camY); c.lineTo(b.bx - camX, b.by - camY); c.stroke();
      c.strokeStyle = 'rgba(255,230,180,0.18)'; c.lineWidth = 6; c.setLineDash([22, 18]);
      c.beginPath(); c.moveTo(b.ax - camX, b.ay - camY); c.lineTo(b.bx - camX, b.by - camY); c.stroke();
      c.setLineDash([]);
    }
    ZONES.forEach((zone, reg) => {
      const cx = zone.cx - camX;
      const cy = zone.cy - camY;
      if (cx + zone.radius < 0 || cx - zone.radius > this.w || cy + zone.radius < 0 || cy - zone.radius > this.h) return;
      c.save();
      c.beginPath();
      c.arc(cx, cy, zone.radius, 0, Math.PI * 2);
      c.fillStyle = zone.bg;
      c.fill();
      c.clip();
      this.drawGround(camX, camY, zone.dot, reg);
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 6;
      c.beginPath(); c.arc(cx, cy, zone.radius, 0, Math.PI * 2); c.stroke();
    });
  }

  private drawGround(camX: number, camY: number, dot: string, reg: number): void {
    const c = this.ctx;
    const tile = this.spr(['ground_forest', 'ground_swamp', 'ground_ice'][reg]);
    if (tile) {
      const T = 256;
      for (let x = Math.floor(camX / T) * T; x < camX + this.w + T; x += T) {
        for (let y = Math.floor(camY / T) * T; y < camY + this.h + T; y += T) c.drawImage(tile, x - camX, y - camY, T, T);
      }
      return;
    }
    const s = 70;
    c.fillStyle = dot;
    for (let x = Math.floor(camX / s) * s; x < camX + this.w + s; x += s) {
      for (let y = Math.floor(camY / s) * s; y < camY + this.h + s; y += s) {
        const hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const r = hsh - Math.floor(hsh);
        c.beginPath();
        c.arc(x - camX + r * s, y - camY + ((r * 7) % 1) * s, 2 + r * 3, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  private drawTreeSprite(t: ResTree, camTime: number): void {
    const c = this.ctx;
    const size = (t.big ? 84 : 60) * t.s * (t.big ? 1 : 1);
    const sway = Math.sin(camTime * 1.3 + t.id) * 0.03;
    if (t.big) {
      const g = c.createRadialGradient(t.x, t.y, 4, t.x, t.y, 52);
      g.addColorStop(0, 'rgba(255,216,74,0.35)'); g.addColorStop(1, 'rgba(255,216,74,0)');
      c.fillStyle = g; c.beginPath(); c.arc(t.x, t.y, 52, 0, Math.PI * 2); c.fill();
    }
    const name = ['tree_forest', 'tree_swamp', 'tree_ice'][t.reg];
    if (this.drawSprX(name, t.x, t.y - 10, size, { rot: sway })) return;
    const s = size / 64;
    c.fillStyle = '#4a3320'; c.fillRect(t.x - 4 * s, t.y, 8 * s, 16 * s);
    c.fillStyle = t.reg === 2 ? '#a7d8e8' : t.reg === 1 ? '#3b5a52' : '#2f7a45';
    c.beginPath(); c.arc(t.x, t.y - 4 * s, 20 * s, 0, Math.PI * 2); c.fill();
  }

  private drawWorldObjects(camX: number, camY: number): void {
    const c = this.ctx;
    const world = this.getWorld();
    for (const sp of world.spawners) {
      if (!this.inView(sp.x, sp.y, 90, camX, camY)) continue;
      const cleared = this.spCleared(sp);
      if (!cleared) {
        // kamp çemberi: evin etrafı (düşmanların kampı) renkli halkayla işaretli
        const col = TIERS[sp.tier].color;
        c.save();
        c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = 3;
        c.beginPath(); c.arc(sp.x, sp.y, sp.tier === 'boss' ? 130 : 76, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 0.18; c.setLineDash([10, 10]);
        c.beginPath(); c.arc(sp.x, sp.y, sp.tier === 'boss' ? 400 : 250, 0, Math.PI * 2); c.stroke();
        c.restore();
      }
      c.globalAlpha = cleared ? 0.45 : 1;
      if (!this.drawSpr('camp', sp.x, sp.y, 120)) {
        c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 5;
        c.beginPath(); c.arc(sp.x, sp.y, 50, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = 1;
      if (cleared && sp.tier === 'boss') {
        c.fillStyle = '#b8ffcc'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
        c.fillText('YENİLDİ', sp.x, sp.y + 5);
      } else if (cleared) {
        const left = Math.max(0, Math.ceil(((this.save.spawn['s' + sp.id] ?? 0) - this.now()) / 1000));
        c.fillStyle = '#fff'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
        c.fillText(left >= 60 ? Math.floor(left / 60) + 'dk ' + (left % 60) + 'sn' : left + 'sn', sp.x, sp.y + 5);
      }
    }
    // ağaçlar: hepsi kesilebilir; y'ye göre sıralı çizmeye gerek yok, ayak izi küçük
    for (const t of world.trees) {
      if (!this.inView(t.x, t.y, 90, camX, camY)) continue;
      if (this.isCleared('t' + t.id)) {
        c.fillStyle = '#4a3320'; c.beginPath(); c.ellipse(t.x, t.y + 4, 9 * t.s + 3, 5 * t.s + 2, 0, 0, Math.PI * 2); c.fill();
        continue;
      }
      this.drawTreeSprite(t, this.time);
      const maxHp = this.treeMaxHp(t);
      const hp = this.treeHp.get(t.id) ?? maxHp;
      if (hp < maxHp) {
        c.fillStyle = '#400'; c.fillRect(t.x - 20, t.y - 56 * t.s, 40, 4);
        c.fillStyle = '#5f5'; c.fillRect(t.x - 20, t.y - 56 * t.s, (40 * hp) / maxHp, 4);
      }
    }
    for (const ch of world.chests) {
      if (!this.inView(ch.x, ch.y, 40, camX, camY)) continue;
      const open = this.save.chests.includes(ch.id);
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
      if (!open) c.fillRect(ch.x - 3, ch.y - 4, 6, 7);
    }
    for (let i = 0; i < ZONES.length - 1; i++) this.drawGate(i, camX, camY);
  }

  /** Evimiz: doğduğumuz yer ve hızlı iyileşme alanı */
  private drawHome(): void {
    const c = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2);
    const g = c.createRadialGradient(HOME.x, HOME.y, 10, HOME.x, HOME.y, HOME.r);
    g.addColorStop(0, `rgba(120,255,170,${0.22 + 0.1 * pulse})`);
    g.addColorStop(1, 'rgba(120,255,170,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(HOME.x, HOME.y, HOME.r, 0, Math.PI * 2); c.fill();
    if (!this.drawSprX('home', HOME.x, HOME.y - 70, 150)) {
      c.fillStyle = '#7a5a3a'; c.fillRect(HOME.x - 34, HOME.y - 80, 68, 50);
      c.fillStyle = '#b04a4a'; c.beginPath(); c.moveTo(HOME.x - 44, HOME.y - 80); c.lineTo(HOME.x, HOME.y - 118); c.lineTo(HOME.x + 44, HOME.y - 80); c.fill();
    }
    c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#c8ffd8';
    c.fillText('EV · hızlı iyileşme', HOME.x, HOME.y + 34);
    if (this.inHome()) {
      for (let k = 0; k < 6; k++) {
        const ph = (this.time * 0.7 + k / 6) % 1;
        c.fillStyle = `rgba(160,255,190,${1 - ph})`;
        c.font = 'bold 16px sans-serif';
        c.fillText('+', this.px + Math.sin(k * 2.1) * 40, this.py - 20 - ph * 50);
      }
    }
  }

  private drawMaster(i: number, camX: number, camY: number): void {
    if (!this.masterOpen(i)) return;
    const m = this.masterPos(i);
    if (!this.inView(m.x, m.y, 120, camX, camY)) return;
    const c = this.ctx;
    const near = Math.hypot(m.x - this.px, m.y - this.py) < 130;
    if (!this.drawSprX('master', m.x, m.y, 84, { bob: Math.sin(this.time * 2) * 2, flip: this.px < m.x ? -1 : 1, sy: 1 + 0.015 * Math.sin(this.time * 2.5) })) {
      c.fillStyle = '#2f8a8a'; c.beginPath(); c.arc(m.x, m.y, 18, 0, Math.PI * 2); c.fill();
    }
    c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#9ff0ff';
    c.fillText(i === 0 ? 'Usta Cadı Elmira' : 'Usta Cadı Zehra', m.x, m.y - 64);
    if (near) {
      c.fillStyle = '#ffe36b';
      c.fillText('Eğitim için dokun!', m.x, m.y - 80 + Math.sin(this.time * 5) * 2);
    }
  }

  private drawGate(i: number, camX: number, camY: number): void {
    const c = this.ctx;
    const g = this.gatePos(i);
    if (!this.inView(g.x, g.y, 200, camX, camY)) return;
    const b = this.bridge(i);
    const ang = Math.atan2(b.by - b.ay, b.bx - b.ax);
    const locked = this.gateLocked(i);
    c.save();
    c.translate(g.x, g.y);
    c.rotate(ang);
    c.fillStyle = '#5a5a66';
    c.fillRect(-14, -BRIDGE_HALF_WIDTH - 16, 28, 34);
    c.fillRect(-14, BRIDGE_HALF_WIDTH - 18, 28, 34);
    const ga = this.gateAnim && this.gateAnim.i === i ? this.gateAnim : null;
    if (locked) {
      c.fillStyle = '#8a5a2b';
      c.fillRect(-10, -BRIDGE_HALF_WIDTH + 14, 20, BRIDGE_HALF_WIDTH * 2 - 28);
      c.fillStyle = '#d9c25a';
      c.fillRect(-6, -8, 12, 16);
    } else if (ga) {
      // kapı kanatları iki yana kayar, ışık halkaları yayılır
      const k = Math.min(1, (3.6 - ga.t) / 1.4);
      const half = (BRIDGE_HALF_WIDTH - 14) * (1 - k);
      c.fillStyle = '#8a5a2b';
      c.fillRect(-10, -BRIDGE_HALF_WIDTH + 14, 20, Math.max(0, half));
      c.fillRect(-10, BRIDGE_HALF_WIDTH - 14 - Math.max(0, half), 20, Math.max(0, half));
      for (let r = 0; r < 3; r++) {
        const ph = ((3.6 - ga.t) * 0.9 + r / 3) % 1;
        c.strokeStyle = `rgba(150,255,190,${1 - ph})`; c.lineWidth = 5;
        c.beginPath(); c.arc(0, 0, 20 + ph * 130, 0, Math.PI * 2); c.stroke();
      }
    } else {
      c.strokeStyle = 'rgba(120,255,160,0.55)'; c.lineWidth = 4; c.setLineDash([8, 8]);
      c.beginPath(); c.moveTo(0, -BRIDGE_HALF_WIDTH + 14); c.lineTo(0, BRIDGE_HALF_WIDTH - 14); c.stroke();
      c.setLineDash([]);
    }
    c.restore();
    c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillStyle = locked ? '#ffd0a0' : '#b8ffcc';
    c.fillText(locked ? 'KİLİTLİ — ' + ZONES[i].bossName + ' yenilmeli' : 'Kapı açık', g.x, g.y - BRIDGE_HALF_WIDTH - 24);
  }

  private drawPlayer(): void {
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
      c.beginPath(); c.arc(p.x, p.y, (p.fly ? 3 : 4) + (1 - k) * (p.fly ? 6 : 8), 0, Math.PI * 2); c.fill();
    }
    // gölge (uçarken küçülür)
    c.fillStyle = flying ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.25)';
    c.beginPath(); c.ellipse(this.px, this.py + 18, flying ? 14 : 20, flying ? 5 : 7, 0, 0, Math.PI * 2); c.fill();
    const lift = flying ? -30 + Math.sin(t * 4) * 3 : 0;
    // animasyon karesi: uçuş > büyü > yürüyüş (iki kare) > duruş
    let frame = 'witch';
    if (flying && this.spr('witch_fly')) frame = 'witch_fly';
    else if (cast > 0 && this.spr('witch_cast')) frame = 'witch_cast';
    else if (this.moving && this.spr('witch_walk1') && this.spr('witch_walk2')) frame = Math.floor(t * 8) % 2 === 0 ? 'witch_walk1' : 'witch_walk2';
    const drawn = this.drawSprX(frame, this.px, this.py - 8, flying ? 86 : 74, {
      flip, rot: o.rot + cast * 0.12 * flip, sx: o.sx * sc, sy: o.sy * sc, bob: o.bob + lift, flash: this.hurtFlash > 0,
    });
    if (!drawn) {
      c.fillStyle = '#6d3fc0';
      c.beginPath(); c.arc(this.px, this.py + 4, 13, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f2c9a0';
      c.beginPath(); c.arc(this.px, this.py - 4, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a1a55';
      c.beginPath(); c.moveTo(this.px - 15, this.py - 8); c.lineTo(this.px + 15, this.py - 8);
      c.lineTo(this.px + 2, this.py - 32); c.closePath(); c.fill();
    }
    if (helm) { c.fillStyle = RARITIES[helm.rarity].color; c.beginPath(); c.arc(this.px + 2 * flip, this.py - 44 + o.bob, 3.5, 0, Math.PI * 2); c.fill(); }
    if (shield) {
      c.fillStyle = RARITIES[shield.rarity].color;
      const sx = this.px - 30 * flip;
      c.beginPath();
      c.moveTo(sx - 6, this.py - 2); c.lineTo(sx + 6, this.py - 2); c.lineTo(sx + 6, this.py + 6);
      c.quadraticCurveTo(sx, this.py + 16, sx - 6, this.py + 6); c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
    // karakterin üstünde can ve güç
    const bw = 62;
    const by = this.py - 66 + (flying ? -30 : 0);
    if (flying) {
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(this.px - bw / 2 - 1, by + 9, bw + 2, 6);
      c.fillStyle = '#c8b6ff'; c.fillRect(this.px - bw / 2, by + 10, (bw * this.flyT) / 5, 4);
    }
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(this.px - bw / 2 - 1, by - 1, bw + 2, 8);
    const f = Math.max(0, Math.min(1, this.hp / this.maxHp()));
    c.fillStyle = f > 0.5 ? '#5fe07a' : f > 0.2 ? '#ffd84a' : '#ff5a5a';
    c.fillRect(this.px - bw / 2, by, bw * f, 6);
    c.font = 'bold 12px sans-serif'; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)';
    c.strokeText('⚔ ' + this.fmt(this.power()), this.px, by - 4);
    c.fillStyle = '#ffe36b'; c.fillText('⚔ ' + this.fmt(this.power()), this.px, by - 4);
  }

  private drawDeath(d: DeathFx): void {
    const k = 1 - d.t / 0.45;
    this.drawSprX(d.name, d.x, d.y, d.size * (1 - 0.5 * k), { flip: d.flip, alpha: 1 - k, rot: k * 0.8 * d.flip, sy: 1 - 0.4 * k, flash: k < 0.4 });
  }

  private drawEnemy(e: Enemy): void {
    const c = this.ctx;
    const tier = TIERS[e.tier];
    const r = e.def.r * tier.size;
    const t = e.phase;
    const boss = e.tier === 'boss';
    const size = r * 3.3;
    const o: { flip: number; rot: number; sx: number; sy: number; alpha: number; bob: number; flash: boolean } =
      { flip: e.flip, rot: 0, sx: 1, sy: 1, alpha: 1, bob: 0, flash: e.flash > 0 };
    switch (e.def.id) {
      case 'ghost': o.bob = Math.sin(t * 3) * 6 - 6; o.alpha = 0.88 + 0.1 * Math.sin(t * 4); o.rot = Math.sin(t * 2) * 0.08 + (e.moving ? 0.1 * e.flip : 0); break;
      case 'mushroom': o.rot = e.moving ? Math.sin(t * 9) * 0.13 : Math.sin(t * 1.5) * 0.03; o.sy = 1 + (e.moving ? 0.05 * Math.sin(t * 18) : 0.02 * Math.sin(t * 2)); break;
      case 'pumpkin': o.bob = e.moving ? -Math.abs(Math.sin(t * 7)) * 9 : Math.sin(t * 2) * 1.5; o.sy = e.moving ? 1 + 0.08 * Math.cos(t * 7) : 1; o.sx = 2 - o.sy; break;
      case 'bat': o.sx = 0.72 + 0.28 * Math.abs(Math.sin(t * 17)); o.bob = Math.sin(t * 6) * 7 - 10; break;
    }
    if (boss) { o.sy = 1 + 0.03 * Math.sin(t * 2); o.bob = 0; o.rot = e.moving ? Math.sin(t * 6) * 0.04 : 0; }
    if (e.lunge > 0) { const k = e.lunge / 0.25; o.sx *= 1 + 0.18 * k; o.sy *= 1 - 0.1 * k; }
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath(); c.ellipse(e.x, e.y + r * 0.7, r * 0.9, r * 0.32, 0, 0, Math.PI * 2); c.fill();
    const sprName = boss ? ['boss_owl', 'boss_swamp', 'boss_frost'][e.reg] : e.def.id;
    if (!this.drawSprX(sprName, e.x, e.y, size, o)) {
      const fallback: Record<EnemyId, string> = { ghost: '#e8e8ff', mushroom: '#e0576a', pumpkin: '#ff9a3c', bat: '#8a6bd1' };
      c.fillStyle = boss ? '#7a4fd0' : fallback[e.def.id];
      c.beginPath(); c.arc(e.x, e.y, r, 0, Math.PI * 2); c.fill();
    }
    const sp = this.getWorld().spawners[e.sp];
    if (sp && sp.tag) this.drawSpr('icon_' + sp.tag, e.x, e.y - r - 44, 22);
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(e.x - r - 1, e.y - r - 15, r * 2 + 2, 8);
    const hf = Math.max(0, e.hp) / e.maxHp;
    c.fillStyle = hf <= 0.2 ? '#ff5a5a' : hf <= 0.5 ? '#ffd84a' : '#5fe07a';
    c.fillRect(e.x - r, e.y - r - 14, r * 2 * hf, 6);
    const ratio = this.enemyPower(e) / Math.max(1, this.power());
    const col = ratio < 0.6 ? '#7bff9a' : ratio < 1.6 ? '#ffe36b' : '#ff6b6b';
    c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)';
    c.strokeText('⚔ ' + this.fmt(this.enemyPower(e)), e.x, e.y - r - 19);
    c.fillStyle = col; c.fillText('⚔ ' + this.fmt(this.enemyPower(e)), e.x, e.y - r - 19);
    if (Math.hypot(e.x - this.px, e.y - this.py) < 200) {
      const a = this.spr('ui_' + e.def.atk);
      const w = this.spr('ui_' + this.weakness(e));
      if (a && w) { c.drawImage(a, e.x - 26, e.y + r + 4, 18, 18); c.drawImage(w, e.x + 8, e.y + r + 4, 18, 18); c.fillStyle = '#e9e4ff'; c.font = '11px sans-serif'; c.fillText('›', e.x, e.y + r + 17); }
      else { c.font = '11px sans-serif'; c.fillStyle = '#e9e4ff'; c.fillText(DTYPE_NAMES[e.def.atk] + ' vurur · ' + DTYPE_NAMES[this.weakness(e)] + ' zayıf', e.x, e.y + r + 14); }
    }
  }

  private drawProj(p: Proj): void {
    const c = this.ctx;
    if (p.kind === 'bolt') {
      c.strokeStyle = 'rgba(255,216,74,0.45)'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x - Math.cos(p.a) * 26, p.y - Math.sin(p.a) * 26); c.lineTo(p.x, p.y); c.stroke();
      if (!this.drawSpr('icon_wand', p.x, p.y, 34, this.time * 12)) {
        c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(p.x, p.y, 8, 0, Math.PI * 2); c.fill();
      }
    } else if (p.kind === 'broom') {
      if (!this.drawSpr('icon_broom', p.x, p.y, 58, this.time * 14)) {
        c.fillStyle = '#c98a4b'; c.fillRect(p.x - 18, p.y - 3, 36, 6);
      }
    } else if (p.kind === 'potion') {
      if (!this.drawSpr('icon_potion', p.x, p.y, 36, this.time * 8)) {
        c.fillStyle = '#7bdcff'; c.beginPath(); c.arc(p.x, p.y, 9, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(p.sx + (p.tx - p.sx) * Math.min(1, p.life / p.max), p.sy + (p.ty - p.sy) * Math.min(1, p.life / p.max), 10, 5, 0, 0, Math.PI * 2); c.fill();
    } else if (p.kind === 'ring') {
      const k = p.life / p.max;
      c.strokeStyle = `rgba(123,220,255,${1 - k})`; c.lineWidth = 6;
      c.beginPath(); c.arc(p.x, p.y, p.r * (0.3 + 0.7 * k), 0, Math.PI * 2); c.stroke();
      c.fillStyle = `rgba(123,220,255,${0.25 * (1 - k)})`; c.fill();
    } else {
      const k = p.life / p.max;
      c.strokeStyle = `rgba(210,180,255,${1 - k})`; c.lineWidth = 10; c.lineCap = 'round';
      c.beginPath(); c.arc(p.x, p.y, p.r * 0.8, p.a - 1.0, p.a - 1.0 + 2.0 * Math.min(1, k * 1.6)); c.stroke();
    }
  }

  /** ganimet / kazanç yazıları: karakterin üstünde, sıralı, efektli ("+30 Can kazanıldı") */
  /** kapı açılınca ekranda büyüyüp sönen yazı + ışık patlaması */
  private drawGateBanner(): void {
    const ga = this.gateAnim;
    if (!ga) return;
    const c = this.ctx;
    const age = 3.6 - ga.t;
    const pop = 1 + 0.6 * Math.exp(-age * 5);
    const alpha = Math.min(1, ga.t / 0.8, age / 0.15);
    const cx = this.w / 2;
    const cy = this.h * 0.7;
    c.save();
    c.globalAlpha = alpha * 0.35;
    const g = c.createRadialGradient(cx, cy, 10, cx, cy, 220);
    g.addColorStop(0, 'rgba(150,255,190,0.9)'); g.addColorStop(1, 'rgba(150,255,190,0)');
    c.fillStyle = g; c.fillRect(cx - 220, cy - 220, 440, 440);
    c.globalAlpha = alpha;
    c.translate(cx, cy); c.scale(pop, pop);
    c.font = 'bold 30px sans-serif'; c.textAlign = 'center';
    c.lineWidth = 6; c.strokeStyle = 'rgba(0,40,20,0.85)';
    c.strokeText('KAPI AÇILDI!', 0, 0);
    c.fillStyle = '#b8ffcc'; c.fillText('KAPI AÇILDI!', 0, 0);
    c.font = 'bold 15px sans-serif';
    const sub = ZONES[ga.i + 1].name + ' yolu açık';
    c.strokeText(sub, 0, 26); c.fillStyle = '#fff'; c.fillText(sub, 0, 26);
    c.restore();
  }

  private drawGains(): void {
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
      c.shadowColor = g.color; c.shadowBlur = 10;
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineJoin = 'round';
      c.strokeText(g.text, -total / 2 + iw, 6);
      c.fillStyle = g.color;
      c.fillText(g.text, -total / 2 + iw, 6);
      c.shadowBlur = 0;
      if (iw) c.drawImage(this.spr(g.icon) as HTMLImageElement, -total / 2, -12, 22, 22);
      c.restore();
    });
  }

  private drawHud(): void {
    const c = this.ctx;
    const zone = this.zone();
    const bw = Math.min(230, this.w - 150);
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(12, 12, bw, 16);
    c.fillStyle = '#e0445a'; c.fillRect(12, 12, (bw * Math.max(0, this.hp)) / this.maxHp(), 16);
    c.fillStyle = '#fff'; c.font = '12px sans-serif'; c.textAlign = 'left';
    this.drawSpr('ui_heart', 24, 20, 20);
    c.fillText(this.fmt(Math.max(0, this.hp)) + ' / ' + this.fmt(this.maxHp()), 38, 25);
    if (!this.drawSpr('ui_power', 24, 46, 22)) { c.fillStyle = '#ffe36b'; c.fillText('⚔', 14, 50); }
    c.font = 'bold 14px sans-serif'; c.fillStyle = '#ffe36b';
    c.fillText(this.fmt(this.power()), 38, 51);
    c.font = '12px sans-serif'; c.fillStyle = '#fff';
    const cp = this.campProgress();
    c.fillText(zone.name, 12, 72);
    this.drawSpr('ui_home', 20, 88, 18);
    c.fillText('kamp ' + cp.done + '/' + cp.total + ' · sandık ' + this.chestsOpened() + '/6', 32, 92);
    if (this.bannerT > 0) {
      c.textAlign = 'center';
      c.font = this.w < 700 ? 'bold 14px sans-serif' : 'bold 18px sans-serif';
      c.globalAlpha = Math.min(1, this.bannerT);
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(this.banner, this.w / 2, this.h * 0.3);
      c.fillStyle = '#fff'; c.fillText(this.banner, this.w / 2, this.h * 0.3);
      c.globalAlpha = 1;
    }
    if (this.joy) {
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
      c.beginPath(); c.arc(this.joy.ox, this.joy.oy, 50, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      const dx = this.joy.x - this.joy.ox;
      const dy = this.joy.y - this.joy.oy;
      const d = Math.min(50, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      c.beginPath(); c.arc(this.joy.ox + Math.cos(a) * d, this.joy.oy + Math.sin(a) * d, 20, 0, Math.PI * 2); c.fill();
    }
    if (this.dead > 0) {
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, this.w, this.h);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 26px sans-serif';
      c.fillText('Bayıldın… evde uyanıyorsun', this.w / 2, this.h / 2);
    }
  }

  private arrow(cx: number, cy: number, ang: number, s: number): void {
    const c = this.ctx;
    c.save();
    c.translate(cx, cy);
    c.rotate(ang);
    c.beginPath();
    c.moveTo(s, 0); c.lineTo(-s * 0.8, s * 0.72); c.lineTo(-s * 0.35, 0); c.lineTo(-s * 0.8, -s * 0.72); c.closePath();
    c.fillStyle = '#fff'; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = '#3a2a8a'; c.stroke();
    c.restore();
  }

  /** küçük harita: bulunduğumuz alan; dokununca büyük harita */
  private drawMinimap(): void {
    const c = this.ctx;
    const rad = Math.min(64, this.w * 0.17);
    const cx = this.w - rad - 12;
    const cy = 58 + rad;
    this.mini = { x: cx, y: cy, r: rad };
    const view = 700; // dünya birimi: ekranda yarıçap
    const k = rad / view;
    const X = (x: number): number => cx + (x - this.px) * k;
    const Y = (y: number): number => cy + (y - this.py) * k;
    c.save();
    c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#0c2742'; c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    for (let i = 0; i < ZONES.length - 1; i++) {
      const b = this.bridge(i);
      c.strokeStyle = '#6b5436'; c.lineWidth = BRIDGE_HALF_WIDTH * 2 * k;
      c.beginPath(); c.moveTo(X(b.ax), Y(b.ay)); c.lineTo(X(b.bx), Y(b.by)); c.stroke();
    }
    ZONES.forEach((z) => { c.fillStyle = z.bg; c.beginPath(); c.arc(X(z.cx), Y(z.cy), z.radius * k, 0, Math.PI * 2); c.fill(); });
    for (const sp of this.getWorld().spawners) {
      if (Math.abs(sp.x - this.px) > view || Math.abs(sp.y - this.py) > view) continue;
      c.fillStyle = this.spCleared(sp) ? 'rgba(160,160,160,0.7)' : TIERS[sp.tier].color;
      const s = sp.tier === 'boss' ? 6 : sp.tier === 'elite' || sp.tier === 'knight' ? 4.5 : 3.2;
      c.fillRect(X(sp.x) - s / 2, Y(sp.y) - s / 2, s, s);
    }
    c.fillStyle = '#fff';
    for (const ch of this.getWorld().chests) {
      if (this.save.chests.includes(ch.id) || Math.hypot(ch.x - this.px, ch.y - this.py) > 520) continue;
      c.fillRect(X(ch.x) - 2, Y(ch.y) - 2, 4, 4);
    }
    this.drawSpr('ui_home', X(HOME.x), Y(HOME.y), 16);
    for (let i = 0; i < ZONES.length - 1; i++) {
      const g = this.gatePos(i);
      c.fillStyle = this.gateLocked(i) ? '#ff8a5a' : '#7bff9a';
      c.fillRect(X(g.x) - 2, Y(g.y) - 4, 4, 8);
      const m = this.masterPos(i);
      if (!this.masterOpen(i)) continue;
      c.fillStyle = '#9ff0ff'; c.beginPath(); c.arc(X(m.x), Y(m.y), 3, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    this.arrow(cx, cy, this.face, 7);
    c.strokeStyle = 'rgba(255,255,255,0.65)'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.stroke();
    c.font = '10px sans-serif'; c.fillStyle = 'rgba(255,255,255,0.8)'; c.textAlign = 'center';
    c.fillText('dokun: harita', cx, cy + rad + 12);
  }

  /** büyük harita: bütün dünya, ok bakış yönünü gösterir */
  private drawFullMap(): void {
    const c = this.ctx;
    c.fillStyle = 'rgba(4,12,24,0.88)'; c.fillRect(0, 0, this.w, this.h);
    const minX = ZONES[0].cx - ZONES[0].radius - 80;
    const maxX = ZONES[ZONES.length - 1].cx + ZONES[ZONES.length - 1].radius + 80;
    const minY = Math.min(...ZONES.map((z) => z.cy - z.radius)) - 80;
    const maxY = Math.max(...ZONES.map((z) => z.cy + z.radius)) + 80;
    const k = Math.min((this.w * 0.94) / (maxX - minX), (this.h * 0.6) / (maxY - minY));
    const mw = (maxX - minX) * k;
    const mh = (maxY - minY) * k;
    const mx = (this.w - mw) / 2;
    const my = (this.h - mh) / 2 - 10;
    const X = (x: number): number => mx + (x - minX) * k;
    const Y = (y: number): number => my + (y - minY) * k;
    c.fillStyle = '#0c2742'; c.fillRect(mx, my, mw, mh);
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.strokeRect(mx, my, mw, mh);
    for (let i = 0; i < ZONES.length - 1; i++) {
      const b = this.bridge(i);
      c.strokeStyle = '#6b5436'; c.lineWidth = BRIDGE_HALF_WIDTH * 2 * k;
      c.beginPath(); c.moveTo(X(b.ax), Y(b.ay)); c.lineTo(X(b.bx), Y(b.by)); c.stroke();
    }
    ZONES.forEach((z) => {
      c.fillStyle = z.bg; c.beginPath(); c.arc(X(z.cx), Y(z.cy), z.radius * k, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2; c.stroke();
      c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff';
      c.fillText(z.name, X(z.cx), Y(z.cy - z.radius) + 20);
    });
    for (const sp of this.getWorld().spawners) {
      c.fillStyle = this.spCleared(sp) ? 'rgba(160,160,160,0.7)' : TIERS[sp.tier].color;
      const s = sp.tier === 'boss' ? 9 : sp.tier === 'elite' || sp.tier === 'knight' ? 6 : 4;
      c.fillRect(X(sp.x) - s / 2, Y(sp.y) - s / 2, s, s);
    }
    c.fillStyle = '#fff';
    for (const ch of this.getWorld().chests) {
      if (this.save.chests.includes(ch.id)) continue;
      if (Math.hypot(ch.x - this.px, ch.y - this.py) < 900) c.fillRect(X(ch.x) - 2.5, Y(ch.y) - 2.5, 5, 5);
    }
    this.drawSpr('ui_home', X(HOME.x), Y(HOME.y), 24);
    for (let i = 0; i < ZONES.length - 1; i++) {
      const g = this.gatePos(i);
      if (!this.drawSpr(this.gateLocked(i) ? 'ui_lock' : 'ui_skill', X(g.x), Y(g.y), 24)) {
        c.fillStyle = this.gateLocked(i) ? '#ff8a5a' : '#7bff9a'; c.fillRect(X(g.x) - 3, Y(g.y) - 6, 6, 12);
      }
      const m = this.masterPos(i);
      if (!this.masterOpen(i)) continue;
      c.fillStyle = '#9ff0ff'; c.beginPath(); c.arc(X(m.x), Y(m.y), 5, 0, Math.PI * 2); c.fill();
    }
    this.arrow(X(this.px), Y(this.py), this.face, 11);
    // açıklama
    const items: [string, string][] = [['Kolay', TIERS.easy.color], ['Orta', TIERS.medium.color], ['Zor', TIERS.hard.color], ['Elit', TIERS.elite.color],
      ['Muhafız', TIERS.knight.color], ['Boss', TIERS.boss.color], ['Temiz', '#a0a0a0'], ['Usta', '#9ff0ff'], ['Sandık', '#ffffff']];
    c.font = '12px sans-serif'; c.textAlign = 'left';
    let lx = mx;
    const ly = my + mh + 22;
    for (const [name, col] of items) {
      c.fillStyle = col; c.fillRect(lx, ly - 9, 10, 10);
      c.fillStyle = '#fff'; c.fillText(name, lx + 14, ly);
      lx += 14 + c.measureText(name).width + 12;
      if (lx > mx + mw - 60) { lx = mx; }
    }
    c.textAlign = 'center'; c.fillStyle = '#ffe36b'; c.font = 'bold 14px sans-serif';
    c.fillText('Ok: bakış yönün · Kapatmak için dokun', this.w / 2, my + mh + 50);
  }
}
