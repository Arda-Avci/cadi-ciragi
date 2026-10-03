# Elmas Madeni — Godot projesi

Maden oyunu `godot_mine/` klasöründeki Godot 4.7 projesidir (GL Compatibility, tek iş parçacıklı web aktarımı).
Oyuna `mine/index.html` olarak aktarılıp tam ekran `iframe` ile gömülür (`src/main.ts` → `playMineGodot`).
Godot yüklenemezse sırasıyla Three.js (`src/mine3d.ts`) ve 2B yedek (`src/mine.ts`) devreye girer.

## İletişim sözleşmesi
- URL parametreleri: `seed` (harita tohumu), `lang` (`tr`/`en`); yalnız test için `auto=1` (otomatik oynama) ve `quota=0` (çıkış hemen açık).
- Godot → oyun (`window.parent.postMessage`):
  - `{type:'mine-ready'}` oyun yüklendi.
  - `{type:'mine-result', result:{diamonds, potion, chests, meter, reason}}` bitti (`reason`: `exit` / `dark` / `dead`).
- Oyun, sonucu `Game.finishMine(reg, elmas, iksir)` ile işler (can dolar, kalıcı güç, eşya; iksir madenden çıkınca başlar).

## Yeniden aktarma
1. Godot 4.7.2 (editör) ve web dışa aktarma şablonları (`web_nothreads_release.zip`) kurulu olmalı
   (şablonlar `%APPDATA%/Godot/export_templates/4.7.2.stable/` altında).
2. `godot --headless --path godot_mine --export-release "Web" ../mine/index.html`
3. Doku değiştirmek için `python tools/agy_mine_tex.py --force` (Gemini ile üretir, dikişsiz yapar, normal haritası türetir).

## Oynanış
Karanlık mağara labirenti; fener küçük bir alanı aydınlatır, ışık topu geçici olarak büyük bir alanı aydınlatır ve söner.
Joystick ile yürünür (sol yarı), sağ yarıya dokununca ışık topu atılır. Elmas toplanır (çıkış için 12 gerekir), sandık +4 elmas verir
ama yaratıklardan pusu çıkarır, çatlak ışık duvarlar 3 ışık topuyla yıkılır (gizli oda: iksir ya da sandık), raylı maden arabası
hızlı geçiş sağlar (ray üstündeki kayalar vurulmazsa çarpılır). Yaratıklar (örümcek, yarasa, kaya devi) kahramandan zayıftır.
Cadı korunur: yalnızca madenin kendi güç göstergesi düşer.
