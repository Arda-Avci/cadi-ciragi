/**
 * Yardımcı karakter: beyaz kaplan yavrusu. Ana karakterin %80 gücünde, düşmanlara kendiliğinden saldırır, enerjisi ruh + tozla yenilenir.
 * Saf veri: eşya türleri (kask, keskin diş, pençe) ve katsayılar; davranış Game içindedir.
 */
/** ana karakter gücünün oranı (güç = √(can × hasar): can ve hasar ×0.8 → güç ×0.8) */
export const TIGER_POWER = 0.8;
/** en çok saklanabilen enerji (sn); yalnız saldırırken harcanır */
export const ENERGY_MAX = 1800;
/** bir beslemede kazanılan enerji (sn) */
export const FEED_SECONDS = 600;
export const MAX_TIGER_ITEM_LEVEL = 10;
/** kaplanın kendi seviyesi: her 12 yenilen düşmanda bir seviye, her seviyede güç ×1.07 */
export const LEVEL_KILLS = 12;
export const LEVEL_GROWTH = 1.07;
/** yaralıyken güç en çok bu orana kadar düşer (%40) */
export const WOUND_FLOOR = 0.4;
/** ana karakterle birlikte kendiliğinden yenilenme sınırı (can oranı); fazlası ruh tozuyla */
export const TIGER_REGEN_CAP = 0.75;
/** kaplanı bir seviyede (adada) kullanmanın ruh tozu bedeli; ilk seviye ücretsizdir */
export const LEVEL_COST = 40;
export const freshTiger = () => ({ energy: ENERGY_MAX, frac: 1, items: [], eq: { helm: 0, fang: 0, claw: 0 }, nextItem: 1, feeds: 0, asked: false, paid: [], level: 1, kills: 0, hpBase: 0, dpsBase: 0 });
export const TIGER_SLOTS = {
    helm: { label: 'Kask', icon: 'icon_tigerhelm', stat: 'azami can', names: ['Deri Kask', 'Demir Kask', 'Gümüş Kask', 'Altın Kask', 'Efsane Kask'] },
    fang: { label: 'Keskin Diş', icon: 'icon_fang', stat: 'hasar', names: ['Taş Diş', 'Çelik Diş', 'Gümüş Diş', 'Altın Diş', 'Efsane Diş'] },
    claw: { label: 'Pençe', icon: 'icon_claw', stat: 'saldırı hızı', names: ['Deri Bilezik', 'Demir Pençe', 'Gümüş Pençe', 'Altın Pençe', 'Efsane Pençe'] },
};
export const TIGER_SLOT_LIST = ['helm', 'fang', 'claw'];
/** eşyanın yüzde bonusu: nadirlik ve seviye ile artar */
export const tigerItemPct = (it) => (6 + 4 * it.rarity) * (1 + 0.12 * (it.level - 1));
/** üç yuvadaki toplam yüzde bonus */
export function tigerBonus(s, slot) {
    const it = s.items.find((x) => x.id === s.eq[slot]);
    return it ? tigerItemPct(it) : 0;
}
