/**
 * Elmas madeni — 3D (Three.js, yalnızca madene girilince tembel yüklenir: vendor/three.min.js).
 * Karanlık tüneller boyunca kendiliğinden ilerlenir (kazı yok): elmas ve sandık bulunur, düşmanlar ışıkla görünür/öldürülür,
 * bazı yerlerde maden arabasıyla hızlanılır, çatallarda süre dolmadan yön seçilmezse ortaya çarpılır (maden gücü azalır).
 * Atış ışık topudur: çarptığı yeri aydınlatır, etkisi geçince orası yeniden kararır.
 * Sözleşme: ana oyun duraklatılmış çağrılır; bitince done({ elmas, iksir }) çağrılır (ödülü Game.finishMine verir).
 * Cadı korunur: oyunun gerçek canı/gücü etkilenmez; yalnızca madenin kendi "güç" göstergesi düşer.
 */
export interface Mine3dResult { diamonds: number; potion: boolean; chests: number; meter: number }

const SEG_LEN = 22;
const FORK_LEN = 12;
const W = 4.2;
const H = 3.4;
const FORK_TIME = 4;
const WALK = 5.5;
const CART = 12;

type Kind = 'tunnel' | 'cart' | 'fork' | 'end';
interface Seg { kind: Kind; len: number; p0: any; dir: any; yaw: number; group: any; rich: boolean; cartSide: -1 | 1 }
interface Pick { mesh: any; kind: 'dia' | 'chest' | 'potion'; taken: boolean }
interface Foe { mesh: any; hp: number; awake: boolean; bat: boolean; ph: number }
interface Orb { mesh: any; vel: any; life: number; slot: number }
interface Slot { light: any; mode: 'off' | 'fly' | 'flash'; t: number }

export async function playMine3d(L: (s: string) => string, done: (r: Mine3dResult) => void): Promise<void> {
  const url = '../vendor/three.min.js';
  const T: any = await import(url);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:260;background:#000;touch-action:none;user-select:none;color:#fff;font:600 16px system-ui';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  wrap.append(canvas);
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  document.body.append(wrap);

  // ---- sahne ----
  const scene = new T.Scene();
  scene.background = new T.Color(0x000000);
  scene.fog = new T.FogExp2(0x000000, 0.05);
  const cam = new T.PerspectiveCamera(72, 1, 0.1, 90);
  cam.rotation.order = 'YXZ';
  scene.add(new T.AmbientLight(0x1b2436, 0.5));
  const slots: Slot[] = [];
  for (let i = 0; i < 3; i++) {
    const light = new T.PointLight(0xffe2a0, 0, 20, 2);
    scene.add(light);
    slots.push({ light, mode: 'off', t: 0 });
  }
  const forkLamp = new T.PointLight(0xffc870, 0, 16, 2); // çatalda yön işaretleri görünsün diye küçük fener
  scene.add(forkLamp);
  const rock = new T.MeshStandardMaterial({ color: 0x75685a, roughness: 1, metalness: 0 });
  const wood = new T.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
  const metal = new T.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.5, metalness: 0.6 });
  const diaMat = new T.MeshStandardMaterial({ color: 0x6fe3ff, emissive: 0x1b7a96, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 });
  const chestMat = new T.MeshStandardMaterial({ color: 0xa5702f, emissive: 0x2a1a05, roughness: 0.8 });
  const potMat = new T.MeshStandardMaterial({ color: 0xff7bf0, emissive: 0x7a1d70, emissiveIntensity: 0.9, roughness: 0.3 });
  const texCache = new Map<string, any>();
  const emojiMat = (ch: string): any => {
    let m = texCache.get(ch);
    if (!m) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const x = cv.getContext('2d') as CanvasRenderingContext2D;
      x.font = '92px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ch, 64, 70);
      m = new T.MeshStandardMaterial({ map: new T.CanvasTexture(cv), transparent: true, alphaTest: 0.3, emissive: 0x25252e, roughness: 1, side: T.DoubleSide });
      texCache.set(ch, m);
    }
    return m;
  };

  // ---- yol ----
  const segs: Seg[] = [];
  const picks: Pick[] = [];
  const foes: Foe[] = [];
  const orbs: Orb[] = [];
  let potionPlaced = false;
  let stage = 0;
  const STAGES: Kind[] = ['tunnel', 'tunnel', 'fork', 'tunnel', 'fork', 'tunnel', 'fork', 'tunnel', 'end'];
  let cursor = { p: new T.Vector3(0, 0, 0), yaw: 0 };
  let pendingFork = false;
  const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

  const plane = (w: number, h: number, mat: any, x: number, y: number, z: number, rx: number, ry: number, parent: any): any => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.x = rx; m.rotation.y = ry;
    parent.add(m);
    return m;
  };

  const buildSeg = (kind: Kind, rich: boolean): Seg => {
    const len = kind === 'fork' ? FORK_LEN : SEG_LEN;
    const g = new T.Group();
    g.position.copy(cursor.p);
    g.rotation.y = cursor.yaw;
    scene.add(g);
    plane(W, len, rock, 0, 0, -len / 2, -Math.PI / 2, 0, g); // zemin
    plane(W, len, rock, 0, H, -len / 2, Math.PI / 2, 0, g); // tavan
    const sideLen = kind === 'fork' ? len - 2 - W / 2 : len;
    plane(sideLen, H, rock, -W / 2, H / 2, -sideLen / 2, 0, Math.PI / 2, g);
    plane(sideLen, H, rock, W / 2, H / 2, -sideLen / 2, 0, -Math.PI / 2, g);
    if (kind === 'fork' || kind === 'end') plane(W + 0.2, H, rock, 0, H / 2, -len, 0, 0, g); // kapalı uç
    for (let z = 3; z < len; z += 5) { // ahşap destekler
      const top = new T.Mesh(new T.BoxGeometry(W, 0.22, 0.22), wood); top.position.set(0, H - 0.1, -z); g.add(top);
      for (const sx of [-1, 1]) { const post = new T.Mesh(new T.BoxGeometry(0.22, H, 0.22), wood); post.position.set(sx * (W / 2 - 0.12), H / 2, -z); g.add(post); }
    }
    if (kind === 'cart') { // raylar
      for (const sx of [-0.55, 0.55]) { const r = new T.Mesh(new T.BoxGeometry(0.08, 0.06, len), metal); r.position.set(sx, 0.04, -len / 2); g.add(r); }
      for (let z = 1; z < len; z += 1.4) { const s = new T.Mesh(new T.BoxGeometry(1.5, 0.05, 0.18), wood); s.position.set(0, 0.03, -z); g.add(s); }
    }
    const dir = new T.Vector3(0, 0, -1).applyAxisAngle(new T.Vector3(0, 1, 0), cursor.yaw);
    const seg: Seg = { kind, len, p0: cursor.p.clone(), dir, yaw: cursor.yaw, group: g, rich, cartSide: Math.random() < 0.5 ? -1 : 1 };
    if (kind === 'tunnel' || kind === 'cart') fill(seg);
    if (kind === 'fork') {
      // kapalı uçtaki levhalar: sol/sağ yolun ne olduğunu ipucu verir (🛤️ arabalı hızlı yol, 💎 zengin ama tehlikeli tünel)
      plane(1.3, 1.3, emojiMat(seg.cartSide === -1 ? '🛤️' : '💎'), -1.15, 2.1, -(len - 0.05), 0, 0, g);
      plane(1.3, 1.3, emojiMat(seg.cartSide === 1 ? '🛤️' : '💎'), 1.15, 2.1, -(len - 0.05), 0, 0, g);
      plane(0.8, 0.8, emojiMat('◀'), -1.15, 1.2, -(len - 0.05), 0, 0, g);
      plane(0.8, 0.8, emojiMat('▶'), 1.15, 1.2, -(len - 0.05), 0, 0, g);
    }
    if (kind === 'end') {
      const exit = new T.Mesh(new T.PlaneGeometry(2.4, 2.6), new T.MeshBasicMaterial({ color: 0xfff1c0 }));
      exit.position.set(0, 1.4, -len + 0.05); g.add(exit);
    }
    segs.push(seg);
    return seg;
  };

  const worldOf = (seg: Seg, x: number, y: number, z: number): any => seg.group.localToWorld(new T.Vector3(x, y, z));

  const fill = (seg: Seg): void => {
    const nDia = seg.rich ? 6 : 3;
    for (let i = 0; i < nDia; i++) {
      const m = new T.Mesh(new T.OctahedronGeometry(0.2), diaMat);
      const p = worldOf(seg, rnd(-1.4, 1.4), 0.9, -rnd(3, seg.len - 2));
      m.position.copy(p); scene.add(m);
      picks.push({ mesh: m, kind: 'dia', taken: false });
    }
    if (Math.random() < (seg.rich ? 0.8 : 0.45)) {
      const m = new T.Mesh(new T.BoxGeometry(0.7, 0.45, 0.45), chestMat);
      m.position.copy(worldOf(seg, rnd(-1.2, 1.2), 0.25, -rnd(5, seg.len - 3))); m.rotation.y = seg.yaw; scene.add(m);
      picks.push({ mesh: m, kind: 'chest', taken: false });
    }
    if (!potionPlaced && Math.random() < 0.3) { // gizli iksir: yan duvar dibinde
      potionPlaced = true;
      const m = new T.Mesh(new T.CylinderGeometry(0.1, 0.16, 0.34, 8), potMat);
      m.position.copy(worldOf(seg, Math.random() < 0.5 ? -1.55 : 1.55, 0.45, -rnd(6, seg.len - 4))); scene.add(m);
      picks.push({ mesh: m, kind: 'potion', taken: false });
    }
    const nFoe = seg.kind === 'cart' ? 1 : seg.rich ? 3 : 2;
    for (let i = 0; i < nFoe; i++) {
      const bat = Math.random() < 0.5;
      const m = new T.Mesh(new T.PlaneGeometry(1.1, 1.1), emojiMat(bat ? '🦇' : '🕷️'));
      m.position.copy(worldOf(seg, rnd(-1.2, 1.2), bat ? 1.6 : 0.55, -rnd(9, seg.len - 1)));
      scene.add(m);
      foes.push({ mesh: m, hp: bat ? 1 : 2, awake: false, bat, ph: Math.random() * 6 });
    }
  };

  const nextKind = (): Kind => {
    const k = STAGES[Math.min(stage, STAGES.length - 1)];
    stage++;
    return k === 'tunnel' && Math.random() < 0.3 ? 'cart' : k;
  };
  const ensureAhead = (activeIdx: number): void => {
    while (!pendingFork && segs.length - activeIdx < 3 && stage <= STAGES.length) {
      const k = nextKind();
      const prev = segs[segs.length - 1];
      if (prev) cursor = { p: prev.p0.clone().addScaledVector(prev.dir, prev.len), yaw: prev.yaw };
      const seg = buildSeg(k, false);
      if (k === 'fork') pendingFork = true;
      if (k === 'end') { stage = STAGES.length + 1; break; }
      void seg;
    }
  };

  // ---- HUD ----
  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;left:0;right:0;top:0;padding:max(10px,env(safe-area-inset-top)) 12px 0;display:flex;gap:14px;align-items:center;font-size:18px;pointer-events:none;text-shadow:0 2px 4px #000';
  const diaEl = document.createElement('span');
  const meterWrap = document.createElement('div');
  meterWrap.style.cssText = 'flex:1;height:12px;border-radius:7px;background:rgba(255,255,255,.15);overflow:hidden';
  const meterEl = document.createElement('div');
  meterEl.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#ff5a5a,#ffd84a,#5fe07a)';
  meterWrap.append(meterEl);
  const timeEl = document.createElement('span');
  hud.append(diaEl, meterWrap, timeEl);
  const tip = document.createElement('div');
  tip.style.cssText = 'position:absolute;left:0;right:0;bottom:max(18px,env(safe-area-inset-bottom));text-align:center;font-size:15px;opacity:.85;text-shadow:0 2px 4px #000;pointer-events:none;padding:0 14px';
  tip.textContent = L('Dokunarak ışık topu at: gördüğün yeri aydınlatır, düşmanları vurur. Çatalda yön seç.');
  const flash = document.createElement('div');
  flash.style.cssText = 'position:absolute;inset:0;background:#ff2020;opacity:0;pointer-events:none;transition:opacity .35s';
  const fork = document.createElement('div');
  fork.style.cssText = 'position:absolute;left:0;right:0;top:34%;display:none;pointer-events:none;text-align:center;font-size:22px;text-shadow:0 2px 6px #000';
  const forkBar = document.createElement('div');
  forkBar.style.cssText = 'margin:8px auto 0;width:50%;height:8px;border-radius:5px;background:rgba(255,255,255,.2);overflow:hidden';
  const forkFill = document.createElement('div');
  forkFill.style.cssText = 'height:100%;width:100%;background:#ffd84a';
  forkBar.append(forkFill);
  const forkTxt = document.createElement('div');
  forkTxt.textContent = L('Hangi yöne? (◀ sol  /  sağ ▶)');
  fork.append(forkTxt, forkBar);
  const mkArrow = (txt: string, left: boolean): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = `position:absolute;${left ? 'left' : 'right'}:10px;top:50%;width:84px;height:84px;margin-top:-10px;border-radius:50%;border:2px solid #ffe36b;background:rgba(0,0,0,.45);color:#ffe36b;font-size:38px;display:none`;
    return b;
  };
  const btnL = mkArrow('◀', true);
  const btnR = mkArrow('▶', false);
  wrap.append(hud, tip, flash, fork, btnL, btnR);

  // ---- durum ----
  let diamonds = 0;
  let chests = 0;
  let potion = false;
  let meter = 100;
  let elapsed = 0;
  let idx = 0;
  let s = 0;
  let yaw = 0;
  let shake = 0;
  let forkT = 0;
  let mode: 'run' | 'fork' | 'bump' = 'run';
  let bumpT = 0;
  let bumpSide: -1 | 1 = 1;
  let finishing = false;
  let blend: { x: number; z: number; t: number } | null = null; // çatal dönüşünde kamera yumuşak geçer
  let ended = false;
  let cd = 0;
  let raf = 0;
  let last = performance.now();
  const dummy = new T.Vector3();

  const paint = (): void => {
    diaEl.textContent = '💎 ' + diamonds;
    meterEl.style.width = Math.max(0, meter) + '%';
    timeEl.textContent = '⏱ ' + Math.floor(elapsed);
  };
  const hurt = (n: number, msg: string): void => {
    meter -= n;
    flash.style.opacity = '0.45';
    setTimeout(() => { flash.style.opacity = '0'; }, 160);
    shake = 0.5;
    tip.textContent = msg;
    if (navigator.vibrate) navigator.vibrate(60);
  };

  const finish = (): void => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKey);
    renderer.dispose();
    wrap.remove();
    done({ diamonds, potion, chests, meter: Math.max(0, meter) });
  };

  const goSide = (side: -1 | 1): void => {
    mode = 'run';
    pendingFork = false;
    fork.style.display = btnL.style.display = btnR.style.display = 'none';
    const f = segs[idx];
    const p = worldOf(f, 0, 0, -(f.len - 2));
    cursor = { p, yaw: f.yaw + side * (Math.PI / 2) };
    blend = { x: cam.position.x, z: cam.position.z, t: 0 };
    const cartSide = f.cartSide; // bir yön arabalı hızlı yol, diğeri zengin ama tehlikeli tünel
    const kind: Kind = side === cartSide ? 'cart' : 'tunnel';
    buildSeg(kind, side !== cartSide);
    stage++; // dallanan yol, çatal sonrası aşamanın yerini alır
    idx = segs.length - 1;
    s = 0;
    ensureAhead(idx);
    tip.textContent = kind === 'cart' ? L('Maden arabası! Hızlanıyorsun') : L('Zengin ama karanlık bir tünel');
  };
  const choose = (side: -1 | 1): void => { if (mode === 'fork' && !ended) goSide(side); };
  btnL.addEventListener('click', (e) => { e.stopPropagation(); choose(-1); });
  btnR.addEventListener('click', (e) => { e.stopPropagation(); choose(1); });
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') choose(-1);
    else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') choose(1);
  };
  window.addEventListener('keydown', onKey);

  // ---- atış ----
  const shoot = (cx: number, cy: number): void => {
    if (ended || finishing || cd > 0) return;
    cd = 0.3;
    const rect = canvas.getBoundingClientRect();
    const nx = ((cx - rect.left) / rect.width) * 2 - 1;
    const ny = -((cy - rect.top) / rect.height) * 2 + 1;
    const v = new T.Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize();
    const m = new T.Mesh(new T.SphereGeometry(0.1, 8, 8), new T.MeshBasicMaterial({ color: 0xffe9a0 }));
    m.position.copy(cam.position).addScaledVector(v, 0.6).add(dummy.set(0, -0.2, 0));
    scene.add(m);
    // en eski ışık yuvasını kullan
    let slot = 0;
    for (let i = 0; i < slots.length; i++) if (slots[i].mode === 'off') { slot = i; break; } else if (slots[i].t > slots[slot].t) slot = i;
    slots[slot].mode = 'fly'; slots[slot].t = 0;
    orbs.push({ mesh: m, vel: v.multiplyScalar(30), life: 1.1, slot });
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (mode === 'fork') { choose(e.clientX < window.innerWidth / 2 ? -1 : 1); return; }
    shoot(e.clientX, e.clientY);
  });

  const resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  // ---- başlangıç ----
  buildSeg('tunnel', false);
  stage = 1;
  ensureAhead(0);

  const tick = (now: number): void => {
    if (ended || finishing) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    cd = Math.max(0, cd - dt);
    const seg = segs[idx];
    // ilerleme
    if (mode === 'fork') {
      forkT -= dt;
      forkFill.style.width = Math.max(0, (forkT / FORK_TIME) * 100) + '%';
      if (forkT <= 0) { // karar verilmedi: ortaya çarp
        mode = 'bump';
        bumpT = 0.9;
        bumpSide = Math.random() < 0.5 ? -1 : 1;
        fork.style.display = btnL.style.display = btnR.style.display = 'none';
        hurt(25, L('Karar veremedin: duvara çarptın!'));
      }
    } else if (mode === 'bump') {
      bumpT -= dt;
      if (bumpT <= 0) goSide(bumpSide);
    } else {
      const sp = seg.kind === 'cart' ? CART : WALK;
      const stopAt = seg.kind === 'fork' ? seg.len - 5.5 : seg.len;
      s += sp * dt;
      if (s >= stopAt) {
        if (seg.kind === 'fork') { s = stopAt; mode = 'fork'; forkT = FORK_TIME; fork.style.display = 'block'; btnL.style.display = btnR.style.display = 'block'; }
        else if (seg.kind === 'end') { finish(); return; }
        else { idx++; s = 0; ensureAhead(idx); }
      }
    }
    const cur = segs[idx];
    const ss = mode === 'bump' ? Math.min(cur.len - 1.2, cur.len - 5.5 + ((0.9 - bumpT) / 0.9) * 4.3) : s;
    let px = cur.p0.x + cur.dir.x * ss;
    let pz = cur.p0.z + cur.dir.z * ss;
    if (blend) {
      blend.t += dt / 0.6;
      const k = Math.min(1, blend.t);
      px = blend.x + (px - blend.x) * k;
      pz = blend.z + (pz - blend.z) * k;
      if (k >= 1) blend = null;
    }
    yaw += (cur.yaw - yaw) * Math.min(1, dt * 5);
    shake = Math.max(0, shake - dt * 1.2);
    const bob = Math.sin(elapsed * (cur.kind === 'cart' ? 20 : 8)) * (cur.kind === 'cart' ? 0.03 : 0.04);
    cam.position.set(px + (Math.random() - 0.5) * shake * 0.2, (cur.kind === 'cart' ? 1.0 : 1.55) + bob, pz + (Math.random() - 0.5) * shake * 0.2);
    cam.rotation.y = yaw;
    cam.rotation.x = 0;
    // atışlar
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.life -= dt;
      o.mesh.position.addScaledVector(o.vel, dt);
      slots[o.slot].light.position.copy(o.mesh.position);
      slots[o.slot].light.intensity = 22;
      let hit: Foe | null = null;
      for (const f of foes) if (f.hp > 0 && f.mesh.position.distanceTo(o.mesh.position) < 0.9) { hit = f; break; }
      if (hit || o.life <= 0) {
        if (hit) {
          hit.hp--;
          if (hit.hp <= 0) { scene.remove(hit.mesh); if (Math.random() < 0.5) { diamonds++; tip.textContent = L('Düşman elmas düşürdü!'); } }
        }
        slots[o.slot].mode = 'flash'; slots[o.slot].t = 0;
        slots[o.slot].light.position.copy(o.mesh.position);
        scene.remove(o.mesh);
        orbs.splice(i, 1);
      }
    }
    // ışık yuvaları: atışın etkisi geçince karanlık geri gelir
    for (const sl of slots) {
      if (sl.mode === 'flash') {
        sl.t += dt;
        sl.light.intensity = 70 * Math.max(0, 1 - sl.t / 1.8) ** 2;
        if (sl.t >= 1.8) { sl.mode = 'off'; sl.light.intensity = 0; }
      } else if (sl.mode === 'fly') sl.t += dt;
    }
    // düşmanlar (madendeki düşmanlar zayıftır: 1-2 vuruşla ölür, az güç götürür)
    for (let i = foes.length - 1; i >= 0; i--) {
      const f = foes[i];
      if (f.hp <= 0) { foes.splice(i, 1); continue; }
      const dx = cam.position.x - f.mesh.position.x;
      const dz = cam.position.z - f.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (!f.awake && d < 16) f.awake = true;
      if (f.awake) {
        f.mesh.position.x += (dx / d) * 2 * dt;
        f.mesh.position.z += (dz / d) * 2 * dt;
        if (f.bat) f.mesh.position.y = 1.5 + Math.sin(elapsed * 5 + f.ph) * 0.4;
      }
      f.mesh.lookAt(cam.position.x, f.mesh.position.y, cam.position.z);
      if (d < 1) { f.hp = 0; scene.remove(f.mesh); hurt(6, L('Bir yaratık seni yakaladı!')); }
    }
    if (mode === 'fork') { forkLamp.position.copy(worldOf(segs[idx], 0, 2.6, -(segs[idx].len - 6))); forkLamp.intensity = 30; } else forkLamp.intensity = 0;
    // toplananlar
    for (const p of picks) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 2;
      if (p.mesh.position.distanceTo(cam.position) < 1.5) {
        p.taken = true;
        scene.remove(p.mesh);
        if (p.kind === 'dia') diamonds++;
        else if (p.kind === 'chest') { chests++; diamonds += 4; tip.textContent = L('Sandık! +4 elmas'); }
        else { potion = true; tip.textContent = L('Gizli iksir buldun! Madenden çıkınca 1 dk güç ×10'); }
        if (navigator.vibrate) navigator.vibrate(25);
      }
    }
    paint();
    if (meter <= 0) { tip.textContent = L('Gücün tükendi: maden bitti'); finishing = true; setTimeout(finish, 900); return; }
    renderer.render(scene, cam);
    raf = requestAnimationFrame(tick);
  };
  paint();
  raf = requestAnimationFrame(tick);
  // test/yedek: dışarıdan kapatma
  (wrap as unknown as { __end: () => void }).__end = finish;
}
