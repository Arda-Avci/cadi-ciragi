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
/** kaplanı bir seviyede (adada) kullanmanın ruh tozu bedeli; ilk seviye ücretsizdir */
export const LEVEL_COST = 40;

export type TigerSlot = 'helm' | 'fang' | 'claw';
export interface TigerItem { id: number; type: TigerSlot; rarity: number; level: number }
export interface TigerSave {
  energy: number; // kalan saldırı enerjisi (sn)
  frac: number; // can oranı 0..1 (ana karakterle birlikte yenilenir)
  items: TigerItem[];
  eq: Record<TigerSlot, number>;
  nextItem: number;
  feeds: number;
  /** başlangıç sorusu soruldu mu */
  asked: boolean;
  /** bedeli ödenmiş (ya da ücretsiz) seviyeler (ada dizinleri) */
  paid: number[];
  level: number;
  kills: number; // bu seviyede yenilen düşman (12'de seviye atlar)
  hpBase: number; // seviyesine göre taban can (0 = henüz başlatılmadı: ana karakterin %80'i)
  dpsBase: number;
}

export const freshTiger = (): TigerSave => ({ energy: 600, frac: 1, items: [], eq: { helm: 0, fang: 0, claw: 0 }, nextItem: 1, feeds: 0, asked: false, paid: [], level: 1, kills: 0, hpBase: 0, dpsBase: 0 });

export const TIGER_SLOTS: Record<TigerSlot, { label: string; icon: string; stat: string; names: string[] }> = {
  helm: { label: 'Kask', icon: 'icon_tigerhelm', stat: 'azami can', names: ['Deri Kask', 'Demir Kask', 'Gümüş Kask', 'Altın Kask', 'Efsane Kask'] },
  fang: { label: 'Keskin Diş', icon: 'icon_fang', stat: 'hasar', names: ['Taş Diş', 'Çelik Diş', 'Gümüş Diş', 'Altın Diş', 'Efsane Diş'] },
  claw: { label: 'Pençe', icon: 'icon_claw', stat: 'saldırı hızı', names: ['Deri Bilezik', 'Demir Pençe', 'Gümüş Pençe', 'Altın Pençe', 'Efsane Pençe'] },
};
export const TIGER_SLOT_LIST: TigerSlot[] = ['helm', 'fang', 'claw'];

/** eşyanın yüzde bonusu: nadirlik ve seviye ile artar */
export const tigerItemPct = (it: TigerItem): number => (6 + 4 * it.rarity) * (1 + 0.12 * (it.level - 1));

/** üç yuvadaki toplam yüzde bonus */
export function tigerBonus(s: TigerSave, slot: TigerSlot): number {
  const it = s.items.find((x) => x.id === s.eq[slot]);
  return it ? tigerItemPct(it) : 0;
}
