export const DTYPES = ['cut', 'pierce', 'smash'];
export const DTYPE_NAMES = { cut: 'Kesme', pierce: 'Delme', smash: 'Ezme' };
/** Çırağın büyüleri: hedefe kendiliğinden fırlatılır. */
export const WEAPONS = [
    { id: 'wand', name: 'Yıldız Değneği', spell: 'Yıldız Oku (delip geçer)', color: '#ffd84a', baseDmg: 40, range: 340, cooldown: 0.55, dtype: 'pierce', unlockCopies: 0 },
    { id: 'broom', name: 'Uçan Süpürge', spell: 'Bumerang Süpürge (gidip gelir)', color: '#c98a4b', baseDmg: 64, range: 280, cooldown: 1.4, dtype: 'cut', unlockCopies: 4 },
    { id: 'potion', name: 'Kaynar İksir', spell: 'Patlayan İksir (alan hasarı)', color: '#7bdcff', baseDmg: 100, range: 320, cooldown: 1.8, dtype: 'smash', unlockCopies: 10 },
    { id: 'ladle', name: 'Büyülü Kepçe', spell: 'Kepçe Darbesi (yakın menzil)', color: '#b58cff', baseDmg: 150, range: 120, cooldown: 1.1, dtype: 'smash', unlockCopies: 22 },
];
export const MAX_WEAPON_LEVEL = 50;
export function weaponLevelCopies(level) {
    return 3 + level; // hızlı gelişim: orijinalin çok altında
}
export const UPGRADES = [
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
export const ENEMIES = {
    ghost: { id: 'ghost', name: 'Hayalet Kedi', hp: 12, speed: 62, dmg: 4, r: 12, atk: 'cut', resist: { cut: 1, pierce: 0.15, smash: 4 }, drop: 3 },
    mushroom: { id: 'mushroom', name: 'Mantar Cücesi', hp: 28, speed: 36, dmg: 6, r: 16, atk: 'smash', resist: { cut: 4, pierce: 1, smash: 0.15 }, drop: 6 },
    pumpkin: { id: 'pumpkin', name: 'Balkabağı Cin', hp: 22, speed: 46, dmg: 5, r: 14, atk: 'pierce', resist: { cut: 0.15, pierce: 4, smash: 1 }, drop: 5 },
    bat: { id: 'bat', name: 'Gece Yarasası', hp: 8, speed: 85, dmg: 3, r: 10, atk: 'cut', resist: { cut: 1, pierce: 2.5, smash: 0.3 }, drop: 3 },
};
export const TIERS = {
    easy: { name: 'Kolay', hp: 1, dmg: 1, count: 3, respawn: 90, soul: 2, size: 1, color: '#7bd88f', permanent: 'normal', weaponCopies: 2 },
    medium: { name: 'Orta', hp: 4, dmg: 2, count: 3, respawn: 180, soul: 4, size: 1.1, color: '#ffd84a', permanent: 'normal', weaponCopies: 3 },
    hard: { name: 'Zor', hp: 14, dmg: 3.5, count: 3, respawn: 330, soul: 8, size: 1.2, color: '#ff9a3c', permanent: 'normal', weaponCopies: 4 },
    elite: { name: 'Elit', hp: 85, dmg: 6, count: 1, respawn: 660, soul: 30, size: 1.7, color: '#ff5d8f', permanent: 'elite', weaponCopies: 7 },
    knight: { name: 'Muhafız', hp: 55, dmg: 5, count: 1, respawn: 520, soul: 22, size: 1.5, color: '#4ea1ff', permanent: 'elite', weaponCopies: 5 },
    // boss gücü %45 azaltıldı: can ve hasar ×0.55 (güç = √(can×hasar) ≈ ×0.55)
    boss: { name: 'Boss', hp: 605, dmg: 6.6, count: 1, respawn: 1500, soul: 260, size: 2.7, color: '#b06cff', permanent: 'elite', weaponCopies: 16 },
};
/** Tek büyük dünya: bölgeler köprülerle bağlı, aralarında boss'la açılan kapılar var. */
export const ZONES = [
    {
        name: 'Mantar Ormanı', bg: '#14301f', dot: '#1f4a30', enemies: ['mushroom', 'ghost'], scale: 1, dmgScale: 1, cx: 0, cy: 0, radius: 1300,
        layout: { easy: 6, medium: 4, hard: 3, elite: 2, knight: 2, boss: 1 }, resTrees: 10, bossName: 'Dev Baykuş',
    },
    {
        name: 'Karanlık Bataklık', bg: '#1b1f3a', dot: '#2b3160', enemies: ['pumpkin', 'bat', 'ghost'], scale: 8, dmgScale: 3, cx: 3300, cy: -500, radius: 1500,
        layout: { easy: 6, medium: 5, hard: 4, elite: 3, knight: 2, boss: 1 }, resTrees: 12, bossName: 'Bataklık Kraliçesi',
    },
    {
        name: 'Buz Mağarası', bg: '#183347', dot: '#2a5875', enemies: ['bat', 'mushroom', 'pumpkin'], scale: 70, dmgScale: 9, cx: 6900, cy: 200, radius: 1700,
        layout: { easy: 6, medium: 5, hard: 5, elite: 3, knight: 3, boss: 1 }, resTrees: 14, bossName: 'Kış Cadısı',
    },
];
export const BRIDGE_HALF_WIDTH = 95;
export const CRYSTAL_STATS = {
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
export const CSTAT_KEYS = Object.keys(CRYSTAL_STATS);
export const RARITIES = [
    { name: 'Sıradan', color: '#bdbdbd', mul: 1, w: 60 },
    { name: 'Nadir', color: '#4ea1ff', mul: 1.8, w: 25 },
    { name: 'Destansı', color: '#b06cff', mul: 3, w: 10 },
    { name: 'Efsanevi', color: '#ffb347', mul: 5, w: 4 },
    { name: 'Mitik', color: '#ff5d8f', mul: 9, w: 1 },
];
export const MAX_ENCHANT = 10;
export const SLOT_NAMES = { helmet: 'Miğfer', shield: 'Kalkan' };
export const EQUIP_NAMES = {
    helmet: ['Sivri Şapka', 'Mantar Külahı', 'Yarasa Başlığı', 'Ay Tacı', 'Yıldız Taçlı Şapka'],
    shield: ['Tencere Kapağı', 'Büyü Kitabı', 'Tılsımlı Kalkan', 'Ay Kalkanı', 'Kozmik Kalkan'],
};
export const MAX_ITEM_LEVEL = 30;
/** helmet: azami can %, shield: kendi türünden gelen hasarı azaltma % (diğer türlerde yarısı) */
export function itemValue(type, rarity, level) {
    const base = type === 'helmet' ? 10 : 9;
    return base * RARITIES[rarity].mul * (1 + 0.12 * (level - 1));
}
export function itemUpgradeCost(level, rarity) {
    return Math.floor(12 * Math.pow(1.3, level - 1) * (1 + rarity * 0.5));
}
export function itemAbility(type, rarity) {
    if (rarity < 3)
        return '';
    const n = rarity - 2;
    return type === 'helmet' ? `+${(1.5 * n).toFixed(1)} can/sn` : `%${8 * n} ihtimalle darbeyi engeller`;
}
export function crystalValue(stat, rarity, enchant) {
    return CRYSTAL_STATS[stat].base * RARITIES[rarity].mul * (1 + 0.15 * enchant);
}
export function enchantCost(enchant) {
    return Math.floor(10 * Math.pow(enchant + 1, 1.3));
}
export function enchantChance(enchant) {
    return Math.max(0.35, 0.95 - 0.07 * enchant);
}
export function upgradeCost(def, level) {
    return Math.floor(def.cost * 0.7 * Math.pow(def.growth, level)); // orijinalden ucuz: hızlı gelişim
}
