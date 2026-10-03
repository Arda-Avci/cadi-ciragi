/** Kullanıcı ayarları (müzik, efekt sesi, titreşim, dil) — cihazda saklanır. */
export type Lang = 'tr' | 'en';
export interface Settings { music: number; sfx: number; vibrate: boolean; lang: Lang; guide: boolean; /** yardımcı beyaz kaplan açık mı */ companion: boolean }

const KEY = 'cadi-ciragi-settings';

function defaultLang(): Lang {
  try { return (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en'; } catch (e) { console.error('dil okunamadı', e); return 'tr'; }
}

export const settings: Settings = { music: 0.5, sfx: 0.7, vibrate: true, lang: defaultLang(), guide: true, companion: true };

export function loadSettings(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(settings, JSON.parse(raw) as Partial<Settings>);
  } catch (e) { console.error('ayarlar okunamadı', e); }
}

export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { console.error('ayarlar yazılamadı', e); }
}

const listeners: (() => void)[] = [];
export function onSettingsChange(fn: () => void): void { listeners.push(fn); }
export function changed(): void { saveSettings(); for (const l of listeners) l(); }

/** titreşim: tarayıcı (Android) ya da Capacitor Haptics (iOS/Android uygulaması) */
export function vibrate(ms: number | number[]): void {
  if (!settings.vibrate) return;
  try {
    const cap = (window as unknown as { Capacitor?: { Plugins?: { Haptics?: { vibrate: (o: { duration: number }) => void } } } }).Capacitor;
    const h = cap?.Plugins?.Haptics;
    const dur = Array.isArray(ms) ? ms.reduce((a, b) => a + b, 0) : ms;
    if (h) { h.vibrate({ duration: Math.min(500, dur) }); return; }
    if ('vibrate' in navigator) navigator.vibrate(ms);
  } catch (e) { console.error('titreşim başarısız', e); }
}
