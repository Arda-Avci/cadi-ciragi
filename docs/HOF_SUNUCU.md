# Şeref Salonu sunucusu (dehost)

Kalıcı liste: dehost sunucusunda küçük bir Node servisi + SQLite. Oyun (`src/hof.ts`) bu adrese yazar ve okur; ağ yoksa yerel listeyle çalışır.

- Adres: `https://hexling-hof.ai-publisher.ai` (Cloudflare Tunnel `5999c2d6…`, kural `/etc/cloudflared/config.yml`; yedek `config.yml.bak-20261004-hexling-hof`)
- Servis: `systemctl status hexling-hof` · kod `/opt/hexling-hof/server.mjs` (+ kendi `node` kopyası) · kaynak `server/hof/`
- Veritabanı: `/var/lib/private/hexling-hof/hof.db` (SQLite, tablo `hof`). Yedek için bu dosyayı kopyalayın (`sqlite` açıkken `VACUUM INTO` ya da servis durdurup `cp`).
- API: `GET /hof` (ilk 50) · `POST /hof` (kendi kaydı) · `GET /health`
- Güvenlik (hafif): kahraman kimliği + cihaz anahtarı (ilk yazan sahibidir, anahtar sha256 olarak saklanır), IP başına dakikada 20 istek, sayı/ad doğrulaması, değerler yalnız artar (MAX), en çok 5000 kayıt. Hile tamamen engellenmez.
- Test modu (`?level=N`) kahramanları listeye yazılmaz.
- Servisi güncelleme: `scp server/hof/server.mjs root@…:/opt/hexling-hof/ && ssh root@… systemctl restart hexling-hof`
