// Hexling Şeref Salonu API'si: SQLite (node:sqlite), tek dosya, bağımlılıksız.
// GET  /hof          -> ilk 50 kahraman (aşılan ada > güç > öldürme)
// POST /hof          -> kendi kaydını yazar/günceller (kahraman kimliği + cihaz anahtarı)
// GET  /health       -> ok
import http from 'node:http';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const DB_FILE = process.env.DB_FILE ?? '/var/lib/hexling-api/hof.db';
const MAX_ROWS = 5000;
const MAX_ISLANDS = 60;
const RATE_PER_MIN = 20;

mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
CREATE TABLE IF NOT EXISTS hof (
  id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, name TEXT NOT NULL,
  power REAL NOT NULL, islands INTEGER NOT NULL, kills INTEGER NOT NULL, deaths INTEGER NOT NULL,
  max_hp REAL NOT NULL, born INTEGER NOT NULL, updated INTEGER NOT NULL, version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hof_rank ON hof (islands DESC, power DESC, kills DESC);
`);
const qTop = db.prepare('SELECT id, name, power, islands, kills, deaths, max_hp AS maxHp, born, updated, version FROM hof ORDER BY islands DESC, power DESC, kills DESC LIMIT 50');
const qGet = db.prepare('SELECT key_hash, power FROM hof WHERE id = ?');
const qCount = db.prepare('SELECT COUNT(*) AS n FROM hof');
const qUpsert = db.prepare(`INSERT INTO hof (id, key_hash, name, power, islands, kills, deaths, max_hp, born, updated, version)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, power = MAX(hof.power, excluded.power), islands = MAX(hof.islands, excluded.islands),
    kills = MAX(hof.kills, excluded.kills), deaths = MAX(hof.deaths, excluded.deaths), max_hp = MAX(hof.max_hp, excluded.max_hp),
    updated = excluded.updated, version = excluded.version`);

const hits = new Map(); // ip -> [zaman damgaları]
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 60000) hits.delete(k);
  return arr.length > RATE_PER_MIN;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS });
  res.end(JSON.stringify(body));
}
const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);

function validate(b) {
  if (!b || typeof b !== 'object') return 'gövde yok';
  if (typeof b.id !== 'string' || !/^h[a-z0-9]{4,20}$/.test(b.id)) return 'kimlik';
  if (typeof b.key !== 'string' || b.key.length < 16 || b.key.length > 64) return 'anahtar';
  if (typeof b.name !== 'string') return 'ad';
  const name = b.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  if (!name) return 'ad';
  const islands = num(b.islands, MAX_ISLANDS);
  const power = num(b.power, 1e30);
  const kills = num(b.kills, 1e9);
  const deaths = num(b.deaths, 1e9);
  const maxHp = num(b.maxHp, 1e30);
  const born = num(b.born, 4e12);
  if ([islands, power, kills, deaths, maxHp, born].some((x) => x === null)) return 'sayı';
  if (!Number.isInteger(islands) || !Number.isInteger(kills) || !Number.isInteger(deaths)) return 'tamsayı';
  // hafif tutarlılık: hiç öldürmeden/ada geçmeden büyük güç olmaz; her ada için güç üst sınırı
  if (kills === 0 && islands === 0) return 'boş kayıt';
  if (islands === 0 && power > 1e12) return 'tutarsız güç';
  return { id: b.id, key: b.key, name, islands, power, kills, deaths, maxHp, born, version: String(b.version ?? '').slice(0, 12) };
}

const server = http.createServer((req, res) => {
  const ip = String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? '');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  const url = new URL(req.url ?? '/', 'http://x');
  if (req.method === 'GET' && url.pathname === '/health') { send(res, 200, { ok: true }); return; }
  if (limited(ip)) { send(res, 429, { error: 'çok sık' }); return; }
  if (req.method === 'GET' && url.pathname === '/hof') { send(res, 200, { list: qTop.all() }); return; }
  if (req.method === 'POST' && url.pathname === '/hof') {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 4096) { req.destroy(); } });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw); } catch (e) { send(res, 400, { error: 'json' }); return; }
      const v = validate(body);
      if (typeof v === 'string') { send(res, 400, { error: v }); return; }
      const keyHash = crypto.createHash('sha256').update(v.key).digest('hex');
      const cur = qGet.get(v.id);
      if (cur) {
        if (cur.key_hash !== keyHash) { send(res, 403, { error: 'anahtar uyuşmuyor' }); return; }
      } else if (qCount.get().n >= MAX_ROWS) { send(res, 503, { error: 'dolu' }); return; }
      qUpsert.run(v.id, keyHash, v.name, v.power, v.islands, v.kills, v.deaths, v.maxHp, v.born, Date.now(), v.version);
      send(res, 200, { ok: true });
    });
    return;
  }
  send(res, 404, { error: 'yok' });
});
server.listen(PORT, '127.0.0.1', () => console.log('hexling-hof dinliyor 127.0.0.1:' + PORT + ' db=' + DB_FILE));
