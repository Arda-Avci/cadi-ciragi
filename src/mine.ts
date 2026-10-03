/**
 * Elmas madeni mini oyunu (yer tutucu: ayrı yapılıp bunun yerine bağlanacak).
 * Entegrasyon sözleşmesi: playMine() çağrılırken ana oyun duraklatılmış olmalıdır (main.ts game.paused = true);
 * oyun bitince done(kazılan elmas sayısı, gizli iksir bulundu mu) çağrılır, ödülü Game.finishMine verir (can yenilenir, kalıcı güç, eşya).
 */
const COLS = 5;
const ROWS = 6;
const DIAMONDS = 10;
const SECONDS = 30;

interface Tile { hp: number; dia: boolean; pot: boolean; broken: boolean; el: HTMLButtonElement }

export function playMine(L: (s: string) => string, done: (diamonds: number, potion: boolean) => void): void {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:260;background:linear-gradient(160deg,#10182b,#1d2a44 60%,#070a14);display:flex;flex-direction:column;align-items:center;gap:10px;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));color:#fff;font:600 16px system-ui';
  const banner = document.createElement('img');
  banner.src = 'assets/panel_mine.jpg';
  banner.alt = '';
  banner.style.cssText = 'width:min(100%,520px);max-height:22vh;object-fit:cover;border-radius:12px';
  banner.onerror = () => banner.remove();
  const info = document.createElement('div');
  info.style.cssText = 'display:flex;gap:18px;font-size:18px';
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${COLS},1fr);gap:6px;width:min(100%,420px)`;
  const tip = document.createElement('small');
  tip.style.opacity = '.75';
  tip.textContent = L('Kayalara dokunup kır: içlerinde elmas olabilir. Süre bitince ödül verilir.');
  const finish = document.createElement('button');
  finish.textContent = L('Bitir');
  finish.style.cssText = 'padding:10px 28px;border-radius:9px;border:0;font:bold 15px system-ui;background:#d9822b;color:#fff';
  // cadı madende de korunur: kalkan aurasıyla gösterilir, maden sırasında hiçbir şey ona zarar veremez
  const witch = document.createElement('div');
  witch.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:14px;opacity:.9';
  witch.innerHTML = '<span style="position:relative;display:inline-block;width:46px;height:46px"><img src="assets/card_witch.png" alt="" style="width:46px;height:46px;object-fit:cover;border-radius:50%;box-shadow:0 0 14px 4px #8fdcff" onerror="this.outerHTML=\'🧙‍♀️\'"><span style="position:absolute;right:-6px;bottom:-4px">🛡️</span></span><span>' + L('Cadı madende korunuyor') + '</span>';
  wrap.append(banner, witch, info, grid, tip, finish);
  document.body.append(wrap);

  const tiles: Tile[] = [];
  const pos = Array.from({ length: COLS * ROWS }, (_, i) => i).sort(() => Math.random() - 0.5);
  const diaAt = new Set(pos.slice(0, DIAMONDS));
  // gizli iksir: elmas olmayan bir kayanın içinde (%35): bulunursa 1 dk boyunca güç ×10
  const potAt = Math.random() < 0.35 ? pos[DIAMONDS] : -1;
  let potion = false;
  let got = 0;
  let left = SECONDS;
  let ended = false;
  const paint = (): void => { info.innerHTML = `<span>💎 ${got}/${DIAMONDS}</span><span>⏱ ${Math.max(0, Math.ceil(left))}</span>`; };
  for (let i = 0; i < COLS * ROWS; i++) {
    const el = document.createElement('button');
    el.style.cssText = 'aspect-ratio:1;border-radius:9px;border:0;font-size:26px;background:#5a6270;color:#fff;box-shadow:inset 0 -4px 0 rgba(0,0,0,.35)';
    el.textContent = '🪨';
    const t: Tile = { hp: 1 + Math.floor(Math.random() * 2), dia: diaAt.has(i), pot: i === potAt, broken: false, el };
    el.addEventListener('click', () => {
      if (ended || t.broken) return;
      t.hp--;
      el.style.transform = 'scale(.9)';
      setTimeout(() => { el.style.transform = ''; }, 90);
      if (t.hp > 0) { el.textContent = '⛏️'; return; }
      t.broken = true;
      el.style.background = t.dia ? '#1d4a63' : t.pot ? '#5a2a63' : '#2a3040';
      el.textContent = t.dia ? '💎' : t.pot ? '🧪' : '·';
      if (t.pot) { potion = true; tip.textContent = L('Gizli iksir buldun! Madenden çıkınca 1 dk güç ×10'); tip.style.color = '#ffe36b'; tip.style.opacity = '1'; }
      if (t.dia) { got++; if (got >= DIAMONDS) end(); }
      paint();
    });
    tiles.push(t);
    grid.append(el);
  }
  const timer = setInterval(() => { left -= 0.25; paint(); if (left <= 0) end(); }, 250);
  const end = (): void => {
    if (ended) return;
    ended = true;
    clearInterval(timer);
    wrap.remove();
    done(got, potion);
  };
  finish.addEventListener('click', end);
  paint();
}
