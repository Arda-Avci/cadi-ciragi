/**
 * Bağlılık sistemleri: Gölge Kahramanlar (efsane listesi + paylaşılabilir gölge kodu), haftalık meydan okuma, gardırop renkleri.
 * Sunucu yok: efsaneler koda gömülü, gölge kodu oyuncular arasında elle (kopyala-yapıştır) paylaşılır.
 */
import { dayNumber } from './house.js';
/** rakip cadının rengi (yeşil) gardıropta verilmez */
export const RIVAL_HUE = 150;
/** gömülü efsane cadılar: level 0..1 = yapay zekâ ustalığı */
export const LEGENDS = [
    { name: 'Pelin', level: 0.15, hue: 40, tale: 'İlk çırak; hâlâ yumruk atmayı öğreniyor.' },
    { name: 'Ayça', level: 0.25, hue: 320, tale: 'Köy cadısı, sabırlı ve savunmacı.' },
    { name: 'Nehir', level: 0.35, hue: 190, tale: 'Büyülerini sudan alır, uzaktan saldırır.' },
    { name: 'Kuzgun', level: 0.45, hue: 230, tale: 'Gece cadısı; tekmeyi sever.' },
    { name: 'Zümra', level: 0.55, hue: 90, tale: 'Orman koruyucusu, blok ustası.' },
    { name: 'Alev', level: 0.65, hue: 350, tale: 'Volkan çırağı, saldırgan ve hızlı.' },
    { name: 'Sisli', level: 0.72, hue: 280, tale: 'Bulut Sarayı bekçisi; zıplayarak kaçar.' },
    { name: 'Gölge Nine', level: 0.8, hue: 20, tale: 'Gölge Diyarı\'nın yaşlı cadısı; hatalarını cezalandırır.' },
    { name: 'Ejder Anne', level: 0.87, hue: 10, tale: 'Magma Ejderi\'nin evlatlığı.' },
    { name: 'Kış Kraliçesi', level: 0.93, hue: 200, tale: 'Buz Mağarası\'nın hükümdarı; neredeyse kusursuz.' },
    { name: 'Elmira', level: 0.97, hue: 60, tale: 'Ustan. Seni en iyi o tanır.' },
    { name: 'Aynadaki', level: 1.0, hue: RIVAL_HUE, tale: 'Senin yarım kalmış gölgen.' },
];
export function ghostCode(g) {
    const body = JSON.stringify([g.name.slice(0, 16), Math.round(Math.max(0, Math.min(1, g.level)) * 100), Math.round(g.hue) % 360]);
    const b64 = btoa(unescape(encodeURIComponent(body)));
    return 'HEX-' + b64;
}
export function parseGhostCode(code) {
    try {
        const t = code.trim();
        if (!t.startsWith('HEX-'))
            return null;
        const arr = JSON.parse(decodeURIComponent(escape(atob(t.slice(4)))));
        if (!Array.isArray(arr) || arr.length !== 3)
            return null;
        const [name, lv, hue] = arr;
        if (typeof name !== 'string' || typeof lv !== 'number' || typeof hue !== 'number')
            return null;
        return { name: name.slice(0, 16) || 'Gölge', level: Math.max(0, Math.min(1, lv / 100)), hue: ((hue % 360) + 360) % 360 };
    }
    catch (e) {
        console.error('gölge kodu okunamadı', e);
        return null;
    }
}
/** kahramanın ustalığı: ada ilerlemesine göre 0.1–1 */
export const heroLevel = (islands, total) => Math.max(0.1, Math.min(1, islands / total));
const MODS = [
    { mod: 'noblock', title: 'Blok yasak', desc: 'Bu hafta kimse blok yapamaz: saldır ya da kaç.' },
    { mod: 'magic', title: 'Yalnız büyü', desc: 'Yumruk ve tekme yok; yalnız büyü topları.' },
    { mod: 'lowhp', title: 'Cam top', desc: 'İki taraf da %40 canla başlar.' },
    { mod: 'fast', title: 'Hızlı hafta', desc: 'Her şey %50 daha hızlı.' },
];
export const weekOf = (now) => Math.floor(dayNumber(now) / 7);
export function weekly(now) {
    const week = weekOf(now);
    const m = MODS[week % MODS.length];
    return { week, mod: m.mod, title: m.title, desc: m.desc, opp: LEGENDS[4 + (week % 6)] };
}
export const OUTFITS = [
    { hue: 0, name: 'Klasik mor', how: 'Başlangıç' },
    { hue: 40, name: 'Altın', how: '10. ada bossunu yen' },
    { hue: 90, name: 'Orman', how: '20. ada bossunu yen' },
    { hue: 190, name: 'Okyanus', how: '7 günlük seri' },
    { hue: 230, name: 'Gece mavisi', how: 'Haftalık meydan okumayı kazan' },
    { hue: 320, name: 'Gül', how: 'Gölge Arenası: Pelin ve Ayça\'yı yen' },
    { hue: 350, name: 'Kızıl', how: '30 günlük seri' },
];
