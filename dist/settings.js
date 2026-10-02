const KEY = 'cadi-ciragi-settings';
function defaultLang() {
    try {
        return (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en';
    }
    catch (e) {
        console.error('dil okunamadı', e);
        return 'tr';
    }
}
export const settings = { music: 0.5, sfx: 0.7, vibrate: true, lang: defaultLang(), guide: true };
export function loadSettings() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw)
            Object.assign(settings, JSON.parse(raw));
    }
    catch (e) {
        console.error('ayarlar okunamadı', e);
    }
}
export function saveSettings() {
    try {
        localStorage.setItem(KEY, JSON.stringify(settings));
    }
    catch (e) {
        console.error('ayarlar yazılamadı', e);
    }
}
const listeners = [];
export function onSettingsChange(fn) { listeners.push(fn); }
export function changed() { saveSettings(); for (const l of listeners)
    l(); }
/** titreşim: tarayıcı (Android) ya da Capacitor Haptics (iOS/Android uygulaması) */
export function vibrate(ms) {
    if (!settings.vibrate)
        return;
    try {
        const cap = window.Capacitor;
        const h = cap?.Plugins?.Haptics;
        const dur = Array.isArray(ms) ? ms.reduce((a, b) => a + b, 0) : ms;
        if (h) {
            h.vibrate({ duration: Math.min(500, dur) });
            return;
        }
        if ('vibrate' in navigator)
            navigator.vibrate(ms);
    }
    catch (e) {
        console.error('titreşim başarısız', e);
    }
}
