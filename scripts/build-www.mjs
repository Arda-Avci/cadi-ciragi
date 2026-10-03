// Web dosyalarını Capacitor'un okuyacağı www/ klasörüne toplar (service worker native uygulamada gerekmez).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest']) cpSync(f, `www/${f}`);
for (const d of ['dist', 'assets', 'icons', 'vendor', 'mine']) {
  if (!existsSync(d)) throw new Error(`${d}/ bulunamadı`);
  cpSync(d, `www/${d}`, { recursive: true, filter: (src) => !src.includes('assets/raw') && !src.includes('assets\\raw') });
}
console.log('www hazır');
