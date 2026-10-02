import { Game } from './game.js';
import {
  CRYSTAL_STATS, DTYPE_NAMES, EQUIP_NAMES, MAX_ENCHANT, MAX_ITEM_LEVEL, MAX_WEAPON_LEVEL, RARITIES, SLOT_NAMES, TIERS, UPGRADES,
  WEAPONS, ZONES, crystalValue, enchantChance, enchantCost, itemAbility, itemUpgradeCost, itemValue, upgradeCost,
} from './data.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas);
const panel = document.getElementById('panel') as HTMLDivElement;
const essenceEl = document.getElementById('essence') as HTMLSpanElement;
let open: 'tree' | 'weapons' | 'zones' | 'crystals' | 'gear' | 'stats' | null = null;
let note = '';

const fmt = (n: number): string => {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.floor(n));
};

function row(title: string, sub: string, btnText: string, enabled: boolean, onClick: () => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'row';
  const txt = document.createElement('div');
  txt.innerHTML = `<b>${title}</b><br><small>${sub}</small>`;
  const btn = document.createElement('button');
  btn.textContent = btnText;
  btn.disabled = !enabled;
  btn.addEventListener('click', onClick);
  el.append(txt, btn);
  return el;
}

function renderPanel(): void {
  essenceEl.textContent = fmt(game.save.essence);
  if (!open) { panel.style.display = 'none'; game.paused = false; return; }
  game.paused = true;
  panel.style.display = 'block';
  panel.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'head';
  head.innerHTML = `<b>${open === 'tree' ? 'Yetenek Ağacı' : open === 'weapons' ? 'Silahlar' : open === 'crystals' ? 'Kristaller' : open === 'gear' ? 'Ekipman' : open === 'stats' ? 'Statlar' : 'Adalar'}</b>`;
  const close = document.createElement('button');
  close.textContent = 'Kapat';
  close.addEventListener('click', () => { open = null; renderPanel(); });
  head.append(close);
  panel.append(head);

  if (open === 'tree') {
    let last = '';
    for (const u of UPGRADES) {
      if (u.branch !== last) {
        last = u.branch;
        const h = document.createElement('h3');
        h.textContent = u.branch;
        panel.append(h);
      }
      const lvl = game.lv(u.id);
      const locked = !!u.requires && game.lv(u.requires) < 1;
      const maxed = lvl >= u.max;
      const cost = upgradeCost(u, lvl);
      panel.append(row(
        `${u.name} ${lvl}/${u.max}`, locked ? 'Kilitli: önceki yetenek gerekli' : u.desc,
        maxed ? 'MAX' : fmt(cost), !locked && !maxed && game.save.essence >= cost,
        () => game.buyUpgrade(u.id),
      ));
    }
  } else if (open === 'weapons') {
    const note2 = document.createElement('div');
    note2.className = 'row';
    note2.innerHTML = `<small>Büyü yuvası: ${game.equippedWeapons().length}/${game.weaponSlots()} (boss yendikçe artar). Düşmanın zayıf olduğu türden büyü kuşan! `
      + 'Kopyalar kamplardan düşer; biriktirince silah açılır ve seviye atlar.</small>';
    panel.append(note2);
    WEAPONS.forEach((w, i) => {
      const lvl = game.save.weapons[i];
      const need = game.weaponNeed(i);
      const have = game.save.copies[i];
      const maxed = lvl >= MAX_WEAPON_LEVEL;
      const dmg = lvl > 0 ? fmt(game.weaponDmg(i)) : '—';
      const on = game.save.loadout.includes(i);
      const el = document.createElement('div');
      el.className = 'row';
      const txt = document.createElement('div');
      txt.innerHTML = `<b>${w.name} ${lvl > 0 ? 'sv.' + lvl : '(kilitli)'} · ${DTYPE_NAMES[w.dtype]}</b>`
        + `<br><small>${w.spell}<br>Hasar ${dmg} · Kopya ${have}/${need}${on ? ' · KUŞANILDI' : ''}</small>`;
      const btns = document.createElement('div');
      btns.className = 'btns';
      const b1 = document.createElement('button');
      b1.textContent = on ? 'Çıkar' : 'Kuşan';
      b1.disabled = lvl === 0;
      b1.addEventListener('click', () => game.toggleWeapon(i));
      const b2 = document.createElement('button');
      b2.textContent = maxed ? 'MAX' : lvl === 0 ? 'Aç' : 'Yükselt';
      b2.disabled = maxed || have < need;
      b2.addEventListener('click', () => game.upgradeWeapon(i));
      btns.append(b1, b2);
      el.append(txt, btns);
      panel.append(el);
    });
  } else if (open === 'stats') {
    for (const l of game.statLines()) {
      const el = document.createElement('div');
      el.className = 'row';
      el.innerHTML = `<div><b>${l.label}</b></div><div>${l.value}</div>`;
      panel.append(el);
    }
    const n = document.createElement('div');
    n.className = 'row';
    n.innerHTML = '<small>map.* : haritadaki düşman kamplarını ve kaynak ağaçlarını temizledikçe kalıcı kazanılan statlar.</small>';
    panel.append(n);
  } else if (open === 'gear') {
    const top = document.createElement('div');
    top.className = 'row';
    const slotTxt = (t: 'helmet' | 'shield'): string => {
      const it = game.item(t);
      return it ? `${RARITIES[it.rarity].name} ${EQUIP_NAMES[t][it.rarity]} sv.${it.level} (${DTYPE_NAMES[it.dtype]})` : 'boş';
    };
    top.innerHTML = `<div><b>Miğfer:</b> ${slotTxt('helmet')}<br><b>Kalkan:</b> ${slotTxt('shield')}<br>`
      + `<small>Sihirli toz: ${Math.floor(game.save.dust)} · Mavi halkalı Muhafız kamplarından ve boss'lardan düşer.</small></div>`;
    panel.append(top);
    const list = [...game.save.items].sort((a, b) => b.rarity - a.rarity || b.level - a.level);
    for (const it of list.slice(0, 40)) {
      const eq = game.save.eq[it.type] === it.id;
      const val = itemValue(it.type, it.rarity, it.level);
      const ab = itemAbility(it.type, it.rarity);
      const el = document.createElement('div');
      el.className = 'row';
      const txt = document.createElement('div');
      txt.innerHTML = `<b style="color:${RARITIES[it.rarity].color}">${RARITIES[it.rarity].name} ${EQUIP_NAMES[it.type][it.rarity]} sv.${it.level}</b>`
        + `<br><small>${SLOT_NAMES[it.type]} (${DTYPE_NAMES[it.dtype]}): ${it.type === 'helmet' ? '+%' + val.toFixed(1) + ' can'
          : '-%' + val.toFixed(1) + ' ' + DTYPE_NAMES[it.dtype] + ' hasarı (diğer türlerde yarısı)'}`
        + `${ab ? ' · ' + ab : ''}</small>`;
      const btns = document.createElement('div');
      btns.className = 'btns';
      const b1 = document.createElement('button');
      b1.textContent = eq ? 'Çıkar' : 'Tak';
      b1.addEventListener('click', () => game.toggleItem(it.id));
      const cost = itemUpgradeCost(it.level, it.rarity);
      const b2 = document.createElement('button');
      b2.textContent = it.level >= MAX_ITEM_LEVEL ? 'MAX' : `Yükselt ${fmt(cost)}`;
      b2.disabled = it.level >= MAX_ITEM_LEVEL || game.save.essence < cost;
      b2.addEventListener('click', () => game.upgradeItem(it.id));
      const b3 = document.createElement('button');
      b3.textContent = 'Sat';
      b3.className = 'danger';
      b3.addEventListener('click', () => game.sellItem(it.id));
      btns.append(b1, b2, b3);
      el.append(txt, btns);
      panel.append(el);
    }
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'row';
      empty.textContent = 'Henüz ekipmanın yok. Düşmanlardan sarı miğfer ve kalkan simgeleri düşer.';
      panel.append(empty);
    }
  } else if (open === 'crystals') {
    const info = document.createElement('div');
    info.className = 'row';
    info.innerHTML = `<div><b>Jeod: ${game.save.geodes}</b> &nbsp; <b>Sihirli toz: ${Math.floor(game.save.dust)}</b><br>`
      + `<small>Yuva: ${game.save.equipped.length}/${game.slots()} (boss yendikçe yuva açılır) · ${note}</small></div>`;
    const geode = document.createElement('button');
    geode.textContent = 'Jeod aç';
    geode.disabled = game.save.geodes < 1;
    geode.addEventListener('click', () => {
      const c = game.openGeode();
      if (c) note = RARITIES[c.rarity].name + ' ' + CRYSTAL_STATS[c.stat].name + ' kristali!';
      renderPanel();
    });
    info.append(geode);
    panel.append(info);
    const list = [...game.save.crystals].sort((a, b) => b.rarity - a.rarity || b.enchant - a.enchant);
    for (const c of list.slice(0, 40)) {
      const eq = game.save.equipped.includes(c.id);
      const val = crystalValue(c.stat, c.rarity, c.enchant);
      const st = CRYSTAL_STATS[c.stat];
      const el = document.createElement('div');
      el.className = 'row';
      const txt = document.createElement('div');
      txt.innerHTML = `<b style="color:${RARITIES[c.rarity].color}">${RARITIES[c.rarity].name} ${st.name} Kristali +${c.enchant}</b>`
        + `<br><small>+${val.toFixed(st.unit === '/sn' ? 2 : 1)}${st.unit} ${st.name}</small>`;
      const btns = document.createElement('div');
      btns.className = 'btns';
      const b1 = document.createElement('button');
      b1.textContent = eq ? 'Çıkar' : 'Tak';
      b1.addEventListener('click', () => { if (!game.toggleCrystal(c.id)) note = 'Boş yuva yok.'; renderPanel(); });
      const cost = enchantCost(c.enchant);
      const b2 = document.createElement('button');
      b2.textContent = c.enchant >= MAX_ENCHANT ? 'MAX' : `Güçlendir ${cost} (%${Math.round(enchantChance(c.enchant) * 100)})`;
      b2.disabled = c.enchant >= MAX_ENCHANT || game.save.dust < cost;
      b2.addEventListener('click', () => {
        const r = game.enchantCrystal(c.id);
        note = r === 'ok' ? 'Güçlendirme başarılı!' : r === 'fail' ? 'Güçlendirme başarısız, toz kayboldu.' : '';
        renderPanel();
      });
      const b3 = document.createElement('button');
      b3.textContent = 'Sat';
      b3.className = 'danger';
      b3.addEventListener('click', () => { game.sellCrystal(c.id); renderPanel(); });
      btns.append(b1, b2, b3);
      el.append(txt, btns);
      panel.append(el);
    }
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'row';
      empty.textContent = 'Kristalin yok. Düşmanlardan ve sandıklardan jeod düşer; jeod açınca kristal çıkar.';
      panel.append(empty);
    }
  } else {
    ZONES.forEach((z, i) => {
      const reachable = i === 0 || game.save.bossDown[i - 1];
      const cp = game.campProgress(i);
      const status = game.save.bossDown[i] ? 'Boss yenildi' : reachable ? 'Boss: ' + z.bossName : 'Kapı kilitli (önceki bölgenin boss\'unu yen)';
      panel.append(row(
        z.name,
        `${Object.values(z.layout).reduce((a, b) => a + b, 0)} kamp (${cp.done} temiz) · ${z.layout.elite} ${TIERS.elite.name} · sandık ${game.chestsOpened(i)}/6 · ${status}`,
        i === game.region ? 'Buradasın' : reachable ? 'Açık' : 'Kilitli', false, () => undefined,
      ));
    });
    const n = document.createElement('div');
    n.className = 'row';
    n.innerHTML = '<small>Bölgeler tek bir dünyada köprülerle bağlı. Kapılar bir önceki bölgenin boss\'unu yenince açılır; haritada serbestçe gezebilirsin.</small>';
    panel.append(n);
  }
  const reset = document.createElement('button');
  reset.textContent = 'Kaydı sıfırla';
  reset.className = 'danger';
  reset.addEventListener('click', () => { if (confirm('Tüm ilerleme silinsin mi?')) game.resetSave(); });
  panel.append(reset);
}

game.onChange = renderPanel;
for (const [id, kind] of [['btn-tree', 'tree'], ['btn-weapons', 'weapons'], ['btn-gear', 'gear'], ['btn-crystals', 'crystals'], ['btn-stats', 'stats'], ['btn-zones', 'zones']] as const) {
  document.getElementById(id)?.addEventListener('click', () => { open = open === kind ? null : kind; renderPanel(); });
}

window.addEventListener('keydown', (e) => game.keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => game.keys.delete(e.key.toLowerCase()));
canvas.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  game.joy = { ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  const t = e.changedTouches[0];
  if (game.joy) { game.joy.x = t.clientX; game.joy.y = t.clientY; }
  e.preventDefault();
}, { passive: false });
const endTouch = (): void => { game.joy = null; };
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);
canvas.addEventListener('mousedown', (e) => { game.joy = { ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; });
window.addEventListener('mousemove', (e) => { if (game.joy) { game.joy.x = e.clientX; game.joy.y = e.clientY; } });
window.addEventListener('mouseup', endTouch);
window.addEventListener('beforeunload', () => game.persist());
document.addEventListener('visibilitychange', () => { if (document.hidden) game.persist(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// telefonda çevrimdışı çalışsın (?nosw=1 ile kapatılır)
if ('serviceWorker' in navigator && !location.search.includes('nosw')) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.error('service worker kaydedilemedi', e));
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
renderPanel();
requestAnimationFrame(frame);
(window as unknown as { game: Game }).game = game;
