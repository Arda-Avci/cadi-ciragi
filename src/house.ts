/**
 * Cadı Evi: oyuncuyu geri getiren yaşayan ev. Gerçek zamanlı bekleme süreleri, kalıcı küçük kazançlar, günlük seri.
 * Saf mantık: kayıt (HouseState) üzerinde çalışır, Game yan etkileri (kalıcı kazanç, ödül) uygular.
 *
 * Kalıcı kazançlar sınırlıdır (HP_CAP, DMG_CAP): ev, ada ilerlemesini aşan bir güç kaynağı olamaz.
 */

export interface HouseState {
  pet: number; // kedi son sevilme zamanı (ms)
  garden: number; // bahçe son sulama
  brewAt: number; // iksir demlemeye başlanma zamanı (0 = boş)
  soupAt: number; // kazan son toplanma
  streakDay: number; // son giriş günü (gün numarası)
  streak: number; // art arda giriş günü
  hp: number; // evden kazanılan toplam can % (kalıcı)
  dmg: number; // evden kazanılan toplam hasar % (kalıcı)
  pets: number; // toplam kedi sevme
  brews: number;
  food: number; // kedi maması stoku (porsiyon)
  fed: number; // kedi son beslenme zamanı (ms)
  feeds: number; // toplam besleme
  fedStreak: number; // art arda düzenli besleme sayısı (36 saati aşan ara seriyi sıfırlar)
  catName: string;
}

export const HOUSE_HP_CAP = 100;
export const HOUSE_DMG_CAP = 200;
export const PET_CD = 4 * 3600 * 1000;
export const GARDEN_CD = 8 * 3600 * 1000;
export const BREW_TIME = 30 * 60 * 1000;
export const SOUP_CAP = 8 * 3600 * 1000;
export const FEED_CD = 12 * 3600 * 1000;
export const FEED_GAP = 36 * 3600 * 1000;

export function freshHouse(): HouseState {
  return { pet: 0, garden: 0, brewAt: 0, soupAt: 0, streakDay: 0, streak: 0, hp: 0, dmg: 0, pets: 0, brews: 0, food: 0, fed: 0, feeds: 0, fedStreak: 0, catName: 'Pamuk' };
}

export const dayNumber = (ms: number): number => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / 86400000);

export type TaskId = 'pet' | 'garden' | 'brew' | 'soup' | 'daily' | 'buyfood' | 'feed';
export interface TaskInfo { id: TaskId; name: string; desc: string; icon: string; ready: boolean; waitMs: number; state: string }
export interface TaskCtx { essence: number; foodPrice: number }

/** kedi şu an tok mu (son beslemeden 12 saat geçmediyse) */
export const catFull = (h: HouseState, now: number): boolean => h.fed > 0 && now - h.fed < FEED_CD;

export function tasks(h: HouseState, now: number, ctx: TaskCtx): TaskInfo[] {
  const wait = (since: number, cd: number): number => Math.max(0, since + cd - now);
  const brewing = h.brewAt > 0;
  const brewLeft = brewing ? Math.max(0, h.brewAt + BREW_TIME - now) : 0;
  const capped = h.hp >= HOUSE_HP_CAP;
  return [
    {
      id: 'daily', name: 'Günlük giriş', icon: '🎁', ready: h.streakDay !== dayNumber(now), waitMs: 0,
      desc: `Seri: ${h.streak} gün. Her gün gel, ödül büyür (7. günde büyük ödül).`, state: h.streakDay === dayNumber(now) ? 'Bugünkü ödül alındı' : 'Ödülü al',
    },
    {
      id: 'pet', name: 'Kediyi sev', icon: '🐈', ready: wait(h.pet, PET_CD) === 0 && !capped, waitMs: wait(h.pet, PET_CD),
      desc: 'Kalıcı +%1 azami can. 4 saatte bir.', state: capped ? 'Sınıra ulaşıldı' : 'Sev',
    },
    {
      id: 'buyfood', name: 'Kedi maması al', icon: '🥫', ready: ctx.essence >= ctx.foodPrice, waitMs: 0,
      desc: `Toplanan ruhla alınır: ${ctx.foodPrice} ruh / porsiyon. Stokta: ${h.food}.`, state: 'Satın al',
    },
    {
      id: 'feed', name: 'Kediyi besle', icon: '🍽️', ready: h.food > 0 && wait(h.fed, FEED_CD) === 0 && !capped, waitMs: wait(h.fed, FEED_CD),
      desc: `1 porsiyon mama: kalıcı +%0,5 azami can ve tok kedi. 12 saatte bir. Düzenli beslenme serisi: ${h.fedStreak} (her 5'te +2 jeod).`,
      state: capped ? 'Sınıra ulaşıldı' : h.food > 0 ? 'Besle' : 'Mama yok',
    },
    {
      id: 'brew', name: brewing ? 'İksiri topla' : 'İksir demle', icon: '⚗️', ready: brewing ? brewLeft === 0 : h.dmg < HOUSE_DMG_CAP, waitMs: brewLeft,
      desc: 'Demle (30 dk), topla: kalıcı +%2 hasar/güç.', state: h.dmg >= HOUSE_DMG_CAP && !brewing ? 'Sınıra ulaşıldı' : brewing ? (brewLeft === 0 ? 'Hazır' : 'Demleniyor') : 'Demlemeye başla',
    },
    {
      id: 'garden', name: 'Bahçeyi sula', icon: '🌿', ready: wait(h.garden, GARDEN_CD) === 0 && !capped, waitMs: wait(h.garden, GARDEN_CD),
      desc: 'Kalıcı +%1 azami can ve 1 jeod. 8 saatte bir.', state: 'Sula',
    },
    {
      id: 'soup', name: 'Kazan çorbası', icon: '🍲', ready: true, waitMs: 0,
      desc: 'Sen yokken kazan ruh biriktirir (en çok 8 saat).', state: 'Topla',
    },
  ];
}

/** kazandaki biriken süre (ms) */
export function soupMs(h: HouseState, now: number): number {
  if (!h.soupAt) return 0;
  return Math.max(0, Math.min(SOUP_CAP, now - h.soupAt));
}

export function fmtWait(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} sa ${m} dk` : m > 0 ? `${m} dk ${s % 60} sn` : `${s} sn`;
}
