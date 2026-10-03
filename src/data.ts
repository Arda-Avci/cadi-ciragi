// ---- hasar türleri ----
export type DType = 'cut' | 'pierce' | 'smash';
export const DTYPES: DType[] = ['cut', 'pierce', 'smash'];
export const DTYPE_NAMES: Record<DType, string> = { cut: 'Kesme', pierce: 'Delme', smash: 'Ezme' };

// ---- silahlar (kopya ile açılır ve seviyelenir) ----
export type WeaponId = 'wand' | 'broom' | 'potion' | 'ladle';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  spell: string; // büyünün adı
  color: string;
  baseDmg: number;
  range: number; // hedef arama menzili
  cooldown: number; // saniye
  dtype: DType;
  unlockCopies: number;
}

/** Çırağın büyüleri: hedefe kendiliğinden fırlatılır. */
export const WEAPONS: WeaponDef[] = [
  { id: 'wand', name: 'Yıldız Değneği', spell: 'Yıldız Oku (delip geçer)', color: '#ffd84a', baseDmg: 40, range: 340, cooldown: 0.55, dtype: 'pierce', unlockCopies: 0 },
  { id: 'broom', name: 'Uçan Süpürge', spell: 'Bumerang Süpürge (gidip gelir)', color: '#c98a4b', baseDmg: 64, range: 280, cooldown: 1.4, dtype: 'cut', unlockCopies: 4 },
  { id: 'potion', name: 'Kaynar İksir', spell: 'Patlayan İksir (alan hasarı)', color: '#7bdcff', baseDmg: 100, range: 320, cooldown: 1.8, dtype: 'smash', unlockCopies: 10 },
  { id: 'ladle', name: 'Büyülü Kepçe', spell: 'Kepçe Darbesi (yakın menzil)', color: '#b58cff', baseDmg: 150, range: 120, cooldown: 1.1, dtype: 'smash', unlockCopies: 22 },
];
export const MAX_WEAPON_LEVEL = 50;
export function weaponLevelCopies(level: number): number {
  return 3 + level; // hızlı gelişim: orijinalin çok altında
}

// ---- yetenek ağacı (ruh ile) ----
export type Branch = 'Dayanıklılık' | 'Güç' | 'Toplayıcı';

export interface UpgradeDef {
  id: string;
  name: string;
  branch: Branch;
  max: number;
  cost: number;
  growth: number;
  requires?: string;
  desc: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'hp', name: 'Sağlam Pelerin', branch: 'Dayanıklılık', max: 20, cost: 25, growth: 1.45, desc: '+%20 azami can' },
  { id: 'regen', name: 'Şifalı Çay', branch: 'Dayanıklılık', max: 15, cost: 60, growth: 1.5, requires: 'hp', desc: '+0.6 can/sn yenilenme' },
  { id: 'armor', name: 'Tılsımlı Broş', branch: 'Dayanıklılık', max: 12, cost: 150, growth: 1.6, requires: 'regen', desc: '-%4 alınan hasar' },
  { id: 'dmg', name: 'Parlak Büyü', branch: 'Güç', max: 25, cost: 30, growth: 1.45, desc: '+%12 hasar' },
  { id: 'spin', name: 'Hızlı Büyü', branch: 'Güç', max: 15, cost: 80, growth: 1.5, requires: 'dmg', desc: '+%8 büyü hızı' },
  { id: 'reach', name: 'Geniş Menzil', branch: 'Güç', max: 12, cost: 200, growth: 1.6, requires: 'spin', desc: '+%6 büyü menzili ve alanı' },
  { id: 'magnet', name: 'Ruh Mıknatısı', branch: 'Toplayıcı', max: 15, cost: 20, growth: 1.4, desc: '+25 toplama menzili' },
  { id: 'yield', name: 'Bereketli Kazan', branch: 'Toplayıcı', max: 20, cost: 70, growth: 1.5, requires: 'magnet', desc: '+%10 ruh kazancı' },
  { id: 'speed', name: 'Çevik Ayaklar', branch: 'Toplayıcı', max: 10, cost: 180, growth: 1.55, requires: 'yield', desc: '+%4 hareket hızı' },
];

// ---- düşmanlar ----
export type EnemyId = 'ghost' | 'mushroom' | 'pumpkin' | 'bat' | 'scorpion' | 'golem' | 'wisp' | 'snake';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  dmg: number;
  r: number;
  atk: DType;
  resist: Record<DType, number>; // alınan hasar çarpanı
  drop: number;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  ghost: { id: 'ghost', name: 'Hayalet Kedi', hp: 12, speed: 62, dmg: 4, r: 12, atk: 'cut', resist: { cut: 1, pierce: 0.15, smash: 4 }, drop: 3 },
  mushroom: { id: 'mushroom', name: 'Mantar Cücesi', hp: 28, speed: 36, dmg: 6, r: 16, atk: 'smash', resist: { cut: 4, pierce: 1, smash: 0.15 }, drop: 6 },
  pumpkin: { id: 'pumpkin', name: 'Balkabağı Cin', hp: 22, speed: 46, dmg: 5, r: 14, atk: 'pierce', resist: { cut: 0.15, pierce: 4, smash: 1 }, drop: 5 },
  bat: { id: 'bat', name: 'Gece Yarasası', hp: 8, speed: 85, dmg: 3, r: 10, atk: 'cut', resist: { cut: 1, pierce: 2.5, smash: 0.3 }, drop: 3 },
  scorpion: { id: 'scorpion', name: 'Çöl Akrebi', hp: 20, speed: 54, dmg: 6, r: 13, atk: 'pierce', resist: { cut: 1, pierce: 0.2, smash: 3.5 }, drop: 5 },
  golem: { id: 'golem', name: 'Taş Golem', hp: 40, speed: 30, dmg: 8, r: 17, atk: 'smash', resist: { cut: 0.2, pierce: 3, smash: 1 }, drop: 8 },
  snake: { id: 'snake', name: 'Yılan', hp: 9, speed: 78, dmg: 3.5, r: 11, atk: 'pierce', resist: { cut: 3, pierce: 0.4, smash: 1 }, drop: 4 },
  wisp: { id: 'wisp', name: 'Fırtına Cini', hp: 10, speed: 90, dmg: 4, r: 10, atk: 'cut', resist: { cut: 3.5, pierce: 0.3, smash: 1 }, drop: 4 },
};

// ---- kamp (spawner) seviyeleri ----
export type Tier = 'easy' | 'medium' | 'hard' | 'elite' | 'knight' | 'boss';

export interface TierDef {
  name: string;
  hp: number;
  dmg: number;
  count: number;
  respawn: number; // saniye, gerçek zamanlı
  soul: number;
  size: number;
  color: string;
  permanent: 'normal' | 'elite';
  weaponCopies: number;
}

/** boss gücü çarpanı: can ve hasar ×2 → güç ×2 (güç = √(can × hasar)) */
export const BOSS_MUL = 2;

export const TIERS: Record<Tier, TierDef> = {
  easy: { name: 'Kolay', hp: 1, dmg: 1, count: 3, respawn: 90, soul: 2, size: 1, color: '#7bd88f', permanent: 'normal', weaponCopies: 2 },
  medium: { name: 'Orta', hp: 4, dmg: 2, count: 3, respawn: 180, soul: 4, size: 1.1, color: '#ffd84a', permanent: 'normal', weaponCopies: 3 },
  hard: { name: 'Zor', hp: 14, dmg: 3.5, count: 3, respawn: 330, soul: 8, size: 1.2, color: '#ff9a3c', permanent: 'normal', weaponCopies: 4 },
  elite: { name: 'Elit', hp: 85, dmg: 6, count: 1, respawn: 660, soul: 30, size: 1.7, color: '#ff5d8f', permanent: 'elite', weaponCopies: 7 },
  knight: { name: 'Muhafız', hp: 55, dmg: 5, count: 1, respawn: 520, soul: 22, size: 1.5, color: '#4ea1ff', permanent: 'elite', weaponCopies: 5 },
  // boss gücü %45 azaltıldı: can ve hasar ×0.55 (güç = √(can×hasar) ≈ ×0.55)
  boss: { name: 'Boss', hp: 605 * BOSS_MUL, dmg: 6.6 * BOSS_MUL, count: 1, respawn: 1500, soul: 260, size: 2.7, color: '#b06cff', permanent: 'elite', weaponCopies: 16 },
};

// ---- adalar ----
export interface ZoneDef {
  name: string;
  bg: string;
  dot: string;
  enemies: EnemyId[];
  scale: number; // can ve ödül ölçeği
  dmgScale: number; // düşman hasar ölçeği
  cx: number; // dünya üzerindeki merkez
  cy: number;
  radius: number;
  layout: Record<Tier, number>;
  resTrees: number;
  bossName: string;
  /** görsel adları (assets/<ad>.png) */
  art: { ground: string; tree: string; boss: string; beast: string; rock: string; bld: string[] };
  /** bu bölgenin kapısındaki usta cadı */
  master: string;
  /** güç çarpanı: önceki bölgeye göre 1.2–1.8 kat daha zor */
  step: number;
  /** kümülatif güç çarpanı (ilk ada = 1) */
  power: number;
}

/** ilk (ücretsiz) 40 ada; sonrasındaki 29 ada devam paketiyle açılır ve her biri öncekinden 3 kat zordur */
export const BASE_ISLANDS = 40;
export const ISLAND_COUNT = 69;
export const PAID_STEP = 3;

/** sayıyı okunur yazar: K, M, B, T, Q, Qi... */
export function fmtNum(n: number): string {
  if (!isFinite(n)) return '∞';
  const units = ['', 'K', 'M', 'B', 'T', 'Q', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd'];
  let u = 0;
  let v = Math.abs(n);
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  const s = u === 0 ? String(Math.ceil(v)) : (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + units[u];
  return n < 0 ? '-' + s : s;
}

// ---- 40 ada: 8 biyom × 5 çeşit; her yeni ada öncekinden 1.2–1.8 kat daha güçlü ----
interface Biome {
  name: string; bg: string; dot: string; enemies: EnemyId[]; boss: string; art: string; bossArt: string; trees: number;
}
const BIOMES: Biome[] = [
  { name: 'Mantar Ormanı', bg: '#14301f', dot: '#1f4a30', enemies: ['mushroom', 'ghost'], boss: 'Dev Baykuş', art: 'forest', bossArt: 'owl', trees: 10 },
  { name: 'Karanlık Bataklık', bg: '#1b1f3a', dot: '#2b3160', enemies: ['pumpkin', 'bat', 'ghost'], boss: 'Bataklık Kraliçesi', art: 'swamp', bossArt: 'swamp', trees: 12 },
  { name: 'Buz Mağarası', bg: '#183347', dot: '#2a5875', enemies: ['bat', 'mushroom', 'pumpkin'], boss: 'Kış Cadısı', art: 'ice', bossArt: 'frost', trees: 14 },
  { name: 'Kızıl Çöl', bg: '#3a2a14', dot: '#5a431f', enemies: ['scorpion', 'mushroom', 'bat'], boss: 'Çöl Akrep Kralı', art: 'desert', bossArt: 'desert', trees: 14 },
  { name: 'Kristal Vadisi', bg: '#1d1a38', dot: '#38306b', enemies: ['golem', 'wisp', 'pumpkin'], boss: 'Kristal Bekçi', art: 'crystal', bossArt: 'crystal', trees: 15 },
  { name: 'Volkan Adası', bg: '#2a1410', dot: '#4d221a', enemies: ['golem', 'bat', 'scorpion'], boss: 'Magma Ejderi', art: 'volcano', bossArt: 'volcano', trees: 16 },
  { name: 'Bulut Sarayı', bg: '#2b3f66', dot: '#4a6595', enemies: ['wisp', 'ghost', 'bat'], boss: 'Fırtına Kartalı', art: 'sky', bossArt: 'sky', trees: 16 },
  { name: 'Gölge Diyarı', bg: '#140f1f', dot: '#2b1d3d', enemies: ['wisp', 'golem', 'ghost', 'pumpkin'], boss: 'Gölge Kraliçe', art: 'shadow', bossArt: 'shadow', trees: 18 },
];
const VARIANTS = [
  { pre: '', hue: 0 }, { pre: 'Kadim ', hue: 55 }, { pre: 'Altın ', hue: 120 }, { pre: 'Buzul ', hue: 200 }, { pre: 'Efsanevi ', hue: 290 },
  { pre: 'Kızıl ', hue: 20 }, { pre: 'Zümrüt ', hue: 160 }, { pre: 'Gece ', hue: 245 }, { pre: 'Ebedi ', hue: 335 },
];
const MASTERS = ['Elmira', 'Zehra', 'Nilüfer', 'Melek', 'Sevgül', 'Aysel', 'Gülsüm', 'Esma', 'Fidan', 'Hümeyra', 'Perihan', 'Selma',
  'Nergis', 'Yıldız', 'Ayten', 'Gönül', 'Rana', 'Şule', 'Dilara', 'Filiz'];

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** hex ızgarada kendini kesmeyen bir yol: ardışık adalar komşudur ve yön sık değişir (farklı açılardan bağlanır) */
function islandPath(count: number, radius: number, seed: number, start?: { q: number; r: number }[]): { q: number; r: number }[] {
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const rnd = lcg(seed);
  const inside = (q: number, r: number): boolean => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius;
  const key = (q: number, r: number): string => q + ',' + r;
  const path: { q: number; r: number }[] = start ? start.map((c) => ({ ...c })) : [{ q: 0, r: 0 }];
  const seen = new Set(path.map((c) => key(c.q, c.r)));
  const lastDir: number[] = path.map(() => -1);
  let guard = 0;
  const go = (): boolean => {
    if (path.length === count) return true;
    if (++guard > 200000) return false;
    const cur = path[path.length - 1];
    const prev = lastDir[lastDir.length - 1];
    // tohumlu Fisher–Yates: sort(() => rnd() - 0.5) tutarsız karşılaştırıcıdır, tarayıcının JIT aşamasına göre farklı sonuç verir
    // (aynı tohumla her yüklemede farklı ada dizilimi, hatta 'ada yolu bulunamadı' hatası çıkıyordu)
    const shuffled = dirs.map((_, i) => i);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // dönmeyi tercih et: düz gitmek en sona kalır
    const order = [...shuffled.filter((d) => d !== prev), ...shuffled.filter((d) => d === prev)];
    for (const d of order) {
      const q = cur.q + dirs[d][0];
      const r = cur.r + dirs[d][1];
      if (!inside(q, r) || seen.has(key(q, r))) continue;
      // komşu adalara çok yakın sıkışmayı önle: yolun kendi geçmişine 2'den fazla komşuluk olmasın
      let adj = 0;
      for (const e of dirs) if (seen.has(key(q + e[0], r + e[1]))) adj++;
      if (adj > 2) continue;
      path.push({ q, r }); seen.add(key(q, r)); lastDir.push(d);
      if (go()) return true;
      path.pop(); seen.delete(key(q, r)); lastDir.pop();
    }
    return false;
  };
  if (!go()) throw new Error('ada yolu bulunamadı');
  return path;
}

const HARD_FROM = 3; // dizin: 4. ada
const HARD_MUL = 2;

function buildZones(): ZoneDef[] {
  // ilk 40 ada eski kayıtlarla aynı konumda kalır; sonraki 29 ada daha geniş ızgarada aynı yolun devamıdır
  const path = islandPath(ISLAND_COUNT, 6, 20261003, islandPath(BASE_ISLANDS, 4, 20261002));
  const rnd = lcg(7742);
  const D = 4400;
  let power = 1;
  const zones: ZoneDef[] = [];
  for (let i = 0; i < ISLAND_COUNT; i++) {
    const b = BIOMES[i % BIOMES.length];
    const v = VARIANTS[Math.floor(i / BIOMES.length)];
    const base = i === 0 ? 1 : i >= BASE_ISLANDS ? PAID_STEP : 1.2 + 0.6 * rnd(); // önceki adaya göre 1.2–1.8 kat; 41. adadan sonra tam 3 kat
    // 4. adadan itibaren bütün adalar 2 kat daha zor (güç ×2; sonraki adımlar yine 1.2–1.8 kat)
    const step = i === HARD_FROM ? base * HARD_MUL : base;
    power *= step;
    const { q, r } = path[i];
    const jx = (rnd() - 0.5) * 500;
    const jy = (rnd() - 0.5) * 500;
    const tint = v.hue ? '@' + v.hue : '';
    zones.push({
      name: v.pre + b.name, bg: b.bg, dot: b.dot, enemies: b.enemies,
      scale: Math.pow(power, 1.5), dmgScale: Math.sqrt(power), step, power,
      cx: Math.round(D * (q + r / 2) + (i === 0 ? 0 : jx)), cy: Math.round(D * r * 0.866 + (i === 0 ? 0 : jy)), radius: 1100 + 15 * i,
      layout: {
        easy: 6, medium: 4 + Math.floor(i / 10), hard: 3 + Math.floor(i / 8), elite: 2 + Math.floor(i / 14), knight: 2 + Math.floor(i / 14), boss: 1,
      },
      resTrees: b.trees + Math.floor(i / 4), bossName: v.pre + b.boss,
      art: {
        ground: 'ground_' + b.art + tint, tree: 'tree_' + b.art + tint, boss: 'boss_' + b.bossArt + tint, beast: 'beast_' + b.art + tint,
        rock: 'rock_' + ['mossy', 'mossy', 'ice', 'sand', 'ice', 'dark', 'ice', 'dark'][i % 8] + tint,
        bld: ['bld_hut', 'bld_ruin', 'bld_tower'].map((n) => n + tint),
      },
      master: MASTERS[i % MASTERS.length],
    });
  }
  return zones;
}

/** Tek büyük dünya: 40 ada köprülerle bağlı, aralarında boss'la açılan kapılar var. */
export const ZONES: ZoneDef[] = buildZones();
export const BRIDGE_HALF_WIDTH = 95;

// ---- kristaller ----
export type CStat = 'hp' | 'dmg' | 'regen' | 'magnet' | 'speed' | 'yield' | 'crit' | 'lifesteal' | 'evasion';

export const CRYSTAL_STATS: Record<CStat, { name: string; base: number; unit: string }> = {
  hp: { name: 'Can', base: 6, unit: '%' },
  dmg: { name: 'Hasar', base: 5, unit: '%' },
  regen: { name: 'Yenilenme', base: 0.4, unit: '/sn' },
  magnet: { name: 'Menzil', base: 12, unit: '' },
  speed: { name: 'Hız', base: 2, unit: '%' },
  yield: { name: 'Ruh', base: 5, unit: '%' },
  crit: { name: 'Kritik', base: 3, unit: '%' }, // vuruşun 3 katı vurma şansı
  lifesteal: { name: 'Can Çalma', base: 1.2, unit: '%' }, // verilen hasarın yüzdesi can
  evasion: { name: 'Kaçınma', base: 2, unit: '%' }, // darbeden kaçma şansı
};
/** kristal yeteneği simgesi (can ve hasar mevcut simgeleri kullanır) */
export const statIcon = (s: CStat): string => (s === 'hp' ? 'ui_heart' : s === 'dmg' ? 'ui_power' : 'ui_' + s);
export const CSTAT_KEYS = Object.keys(CRYSTAL_STATS) as CStat[];

export const RARITIES = [
  { name: 'Sıradan', color: '#bdbdbd', mul: 1, w: 60 },
  { name: 'Nadir', color: '#4ea1ff', mul: 1.8, w: 25 },
  { name: 'Destansı', color: '#b06cff', mul: 3, w: 10 },
  { name: 'Efsanevi', color: '#ffb347', mul: 5, w: 4 },
  { name: 'Mitik', color: '#ff5d8f', mul: 9, w: 1 },
];

export const MAX_ENCHANT = 10;

// ---- miğfer / kalkan ----
export type SlotType = 'helmet' | 'shield';
export const SLOT_NAMES: Record<SlotType, string> = { helmet: 'Miğfer', shield: 'Kalkan' };
export const EQUIP_NAMES: Record<SlotType, string[]> = {
  helmet: ['Sivri Şapka', 'Mantar Külahı', 'Yarasa Başlığı', 'Ay Tacı', 'Yıldız Taçlı Şapka'],
  shield: ['Tencere Kapağı', 'Büyü Kitabı', 'Tılsımlı Kalkan', 'Ay Kalkanı', 'Kozmik Kalkan'],
};
export const MAX_ITEM_LEVEL = 30;

/** helmet: azami can %, shield: kendi türünden gelen hasarı azaltma % (diğer türlerde yarısı) */
export function itemValue(type: SlotType, rarity: number, level: number): number {
  const base = type === 'helmet' ? 10 : 9;
  return base * RARITIES[rarity].mul * (1 + 0.12 * (level - 1));
}
export function itemUpgradeCost(level: number, rarity: number): number {
  return Math.floor(12 * Math.pow(1.3, level - 1) * (1 + rarity * 0.5));
}
export function itemAbility(type: SlotType, rarity: number): string {
  if (rarity < 3) return '';
  const n = rarity - 2;
  return type === 'helmet' ? `+${(1.5 * n).toFixed(1)} can/sn` : `%${8 * n} ihtimalle darbeyi engeller`;
}

export function crystalValue(stat: CStat, rarity: number, enchant: number): number {
  return CRYSTAL_STATS[stat].base * RARITIES[rarity].mul * (1 + 0.15 * enchant);
}
export function enchantCost(enchant: number): number {
  return Math.floor(10 * Math.pow(enchant + 1, 1.3));
}
export function enchantChance(enchant: number): number {
  return Math.max(0.35, 0.95 - 0.07 * enchant);
}

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.floor(def.cost * 0.7 * Math.pow(def.growth, level)); // orijinalden ucuz: hızlı gelişim
}
