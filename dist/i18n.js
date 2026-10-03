/** Dil desteği: Türkçe metin anahtardır; İngilizce çeviri sözlükten ya da kalıplardan gelir. */
import { settings } from './settings.js';
const EN = {
    // oyun adı ve açılış
    'Devam et': 'Continue', 'Yeni oyun': 'New game', 'Ayarlar': 'Settings', 'Şeref Salonu': 'Hall of Fame', 'Kahraman adı': 'Hero name',
    'Oyuna başla': 'Start playing', 'Çırak': 'Apprentice', 'Kırk Ada': 'Forty Isles', 'Sürüm': 'Version', 'Yapım': 'Build',
    'Hareket: ekrana basılı tutup sürükle. Büyüler kendiliğinden atılır.': 'Move: press and drag on the screen. Spells cast automatically.',
    'Henüz kayıt yok': 'No records yet', 'Kayıt': 'Save', 'ada': 'islands', 'öldürme': 'kills',
    // alt çubuk / paneller
    'Yetenek': 'Skills', 'Büyüler': 'Spells', 'Ekipman': 'Gear', 'Kristal': 'Crystals', 'Stat': 'Stats', 'Kartlar': 'Cards', 'Harita': 'Map',
    'Yetenek Ağacı': 'Skill Tree', 'Kristaller': 'Crystals', 'Statlar': 'Stats', 'Karakter Kartları': 'Character Cards',
    'Buraya tıkla!': 'Tap here!', 'Usta Cadı: Eğitim': 'Master Witch: Training', 'dokun: harita': 'tap: map',
    'Kuşan': 'Equip', 'Çıkar': 'Unequip', 'Tak': 'Wear', 'Sat': 'Sell', 'Aç': 'Unlock', '▲ Yükselt': '▲ Upgrade', 'Oyna': 'Play', 'Yarın': 'Tomorrow',
    'KUŞANILDI': 'EQUIPPED', 'Jeod aç': 'Open geode', 'boş': 'empty', 'Kapat': 'Close', 'Ödülü al': 'Claim reward',
    'Güç': 'Power', 'Azami can': 'Max health', 'Yenilenme': 'Regen', 'Hasar çarpanı': 'Damage multiplier', 'Alınan hasar çarpanı': 'Damage taken multiplier',
    'Eğitim (usta cadı)': 'Training (master witch)', 'Kesme': 'Cut', 'Delme': 'Pierce', 'Ezme': 'Smash',
    'Sağlam Pelerin': 'Sturdy Cloak', 'Şifalı Çay': 'Healing Tea', 'Tılsımlı Broş': 'Charm Brooch', 'Parlak Büyü': 'Bright Spell', 'Hızlı Büyü': 'Quick Cast',
    'Geniş Menzil': 'Wide Reach', 'Ruh Mıknatısı': 'Soul Magnet', 'Bereketli Kazan': 'Bountiful Cauldron', 'Çevik Ayaklar': 'Nimble Feet',
    'Dayanıklılık': 'Endurance', 'Toplayıcı': 'Gatherer',
    'Yıldız Değneği': 'Star Wand', 'Uçan Süpürge': 'Flying Broom', 'Kaynar İksir': 'Boiling Potion', 'Büyülü Kepçe': 'Enchanted Ladle',
    'Sıradan': 'Common', 'Nadir': 'Rare', 'Destansı': 'Epic', 'Efsanevi': 'Legendary', 'Mitik': 'Mythic',
    // ayarlar
    'Müzik': 'Music', 'Efekt sesi': 'Sound effects', 'Titreşim': 'Vibration', 'Dil': 'Language', 'Açık': 'On', 'Kapalı': 'Off', 'Türkçe': 'Turkish',
    'İngilizce': 'English', 'Titreşim yalnızca destekleyen cihazlarda çalışır.': 'Vibration only works on supported devices.',
    'Ana menü': 'Main menu', 'Oyuna dön': 'Back to game',
    // oyun içi metinler
    'Boss evinin mührü kalktı!': 'The boss house seal is broken!', 'KİLİTLİ': 'LOCKED', 'Kapı açık': 'Gate open', 'KAPI AÇILDI!': 'GATE OPENED!', 'yolu açık': 'path is open', 'YENİLDİ': 'DEFEATED',
    'BOSS EVİ · vur / iyileş': 'BOSS HOUSE · hit / heal', 'EV · hızlı iyileşme': 'HOME · fast healing', 'KAMP · hızlı iyileşme': 'CAMP · fast healing',
    'Eğitim için dokun!': 'Tap to train!', 'ENGEL': 'BLOCK', 'KAÇTI': 'DODGE', 'Süpürge uçuşu! 5 sn dokunulmazsın': 'Broom flight! Invulnerable for 5s',
    'Bayıldın… düşmanlar kamplarına döndü.': 'You fainted… the enemies returned to their camps.', 'Bayıldın… evde uyanıyorsun': 'You fainted… waking up at camp',
    'Sonraki bölgenin kapısı açıldı.': 'The next island\'s gate is open.', 'Dünyayı tamamladın!': 'You completed the world!', 'yenildi!': 'defeated!',
    '+3 Jeod': '+3 Geode', '+1 Jeod': '+1 Geode', 'Gizli sandık bulundu!': 'Secret chest found!',
    'Bugünlük hakkın bitti, yarın gel': 'No attempts left today, come back tomorrow',
    'Büyü Zamanlaması': 'Spell Timing', 'İksir Karışımı': 'Potion Mix', 'Yıldız Yakalama': 'Star Catch', 'Eğitim bitti': 'Training complete',
    'Harika!': 'Great!', 'İyi iş!': 'Nice work!', 'Biraz daha çalışmalısın.': 'You need a bit more practice.',
    'Sivri Şapka': 'Pointy Hat', 'Mantar Külahı': 'Mushroom Cap', 'Yarasa Başlığı': 'Bat Hood', 'Ay Tacı': 'Moon Crown', 'Yıldız Taçlı Şapka': 'Star-Crowned Hat',
    'Tencere Kapağı': 'Pot Lid', 'Büyü Kitabı': 'Spellbook', 'Tılsımlı Kalkan': 'Charmed Shield', 'Ay Kalkanı': 'Moon Shield', 'Kozmik Kalkan': 'Cosmic Shield',
    'Miğfer': 'Helmet', 'Kalkan': 'Shield', 'Can': 'Health', 'Hasar': 'Damage', 'Menzil': 'Reach', 'Hız': 'Speed', 'Ruh': 'Soul', 'Kritik': 'Crit',
    'Can Çalma': 'Life Steal', 'Kaçınma': 'Evasion', 'kopya': 'copies', 'hasarı': 'damage',
    'Yıldız Oku (delip geçer)': 'Star Bolt (pierces)', 'Bumerang Süpürge (gidip gelir)': 'Boomerang Broom (returns)',
    'Patlayan İksir (alan hasarı)': 'Exploding Potion (area damage)', 'Kepçe Darbesi (yakın menzil)': 'Ladle Strike (close range)',
    'Kolay': 'Easy', 'Orta': 'Medium', 'Zor': 'Hard', 'Elit': 'Elite', 'Muhafız': 'Guardian', 'Boss': 'Boss',
    'Kritik / Can çalma / Kaçınma': 'Crit / Life steal / Evasion', 'savunması': 'defense', 'can': 'health', 'hasar': 'damage', 'yenilenme': 'regen',
    'Yuva': 'Slots', 'yuva': 'slots', '(boss yendikçe artar).': '(grows as you defeat bosses).', 'Düşmanın zayıf olduğu türden büyü kuşan!': 'Equip spells of the type the enemy is weak to!',
    'Kopyalar kamplardan düşer.': 'Copies drop from camps.', 'Boş yuva yok.': 'No free slot.', 'Başarılı!': 'Success!', 'Başarısız, toz gitti.': 'Failed, dust lost.',
    'Yeni kristal yuvası kazanıldı!': 'New crystal slot unlocked!', 'Yeni ekipman yuvası kazanıldı!': 'New gear slot unlocked!',
    'Ek yuva': 'Extra slots', 'her 10 adada +1 ekipman ve +1 kristal yuvası': '+1 gear and +1 crystal slot every 10 islands',
    'Güç Paketleri': 'Power Packs', 'Güç paketleri kalıcıdır ve toplanır; ücretsiz ilerlemeyi etkilemez.': 'Power packs are permanent and stack; they do not affect free progression.', 'Şu anki çarpan': 'Current multiplier', 'Gücü ×': 'Power ×', 'artırır': 'boost', 'Mağaza yalnızca mobil uygulamada kullanılabilir.': 'The store is only available in the mobile app.', 'Satın alımları geri yükle': 'Restore purchases', 'Ücretsiz ödüller (reklam)': 'Free rewards (ads)', 'Reklam izle': 'Watch ad', 'Bekleme': 'Cooldown', 'Bugün kalan': 'Left today', 'Destansı Miğfer': 'Epic Helmet', 'Destansı Kalkan': 'Epic Shield', '2 Jeod': '2 Geodes', 'Ruh paketi': 'Soul pack',
    'Ruh tozu yetmiyor (40)': 'Not enough soul dust (40)', 'Ruh tozu yetmedi: kaplan kapatıldı': 'Not enough soul dust: the tiger was turned off', 'Kaplan için ruh tozu −40': 'Soul dust for the tiger −40', 'İlk seviye ücretsiz; sonraki her seviye geçişinde Kaplan için ruh tozu': 'The first level is free; every later level change costs soul dust for the tiger:', 'İlk seviye ücretsiz. Sonraki her seviye geçişinde Kaplan için ruh tozu': 'The first level is free. Every later level change costs soul dust for the tiger:', 'Bu seviye için ödendi.': 'Paid for this level.', 'Bu seviye için henüz ödenmedi.': 'Not paid for this level yet.', 'Beyaz Kaplan yardımcın seninle savaşsın mı?': 'Should your White Tiger companion fight with you?', 'Ruh tozu yetmezse kaplan kapatılır.': 'If you run out of soul dust the tiger is turned off.', 'Kaplan yardımcıyı kullan': 'Use the tiger companion',
    'Seviye': 'Level', 'Sağlık': 'Health', 'gücü': 'power', 'Yara bakımı': 'Wound care', 'Yaralı kaplan zayıflar: gücü en çok %60 düşer. Ruh tozuyla iyileştir.': 'A wounded tiger weakens: its power drops by up to 60%. Heal it with soul dust.', 'İyileştir': 'Heal', 'Kaplan sağlıklı': 'The tiger is healthy', 'Kaplan iyileşti': 'The tiger healed',
    'Kaplan': 'Tiger', 'Beyaz Kaplan': 'White Tiger', 'Yardımcı kaplan': 'Companion tiger', 'ana gücünün %80\'i': '80% of your power', 'yaralı': 'wounded', 'Düşman ekrandaysa kendiliğinden saldırır; saldırırken enerji harcar. Canı ana karakterle aynı hızda %75 oranına kadar yenilenir; fazlası için ruh tozu gerekir.': 'It attacks on its own when an enemy is on screen and spends energy while fighting. Its health regenerates at the same rate as yours up to 75%; soul dust restores the rest.', 'Enerji': 'Energy', 'Bir porsiyon: +10 dk': 'One portion: +10 min', 'Kaplan eşyaları': 'Tiger gear', 'Henüz eşya yok': 'No gear yet', 'Ganimetle kaplan için kask, keskin diş ve pençe düşer': 'Loot can drop a helmet, sharp fang and claw for the tiger', 'sv.': 'lv.', 'enerji yok': 'no energy',
    'Deri Kask': 'Leather Helm', 'Demir Kask': 'Iron Helm', 'Gümüş Kask': 'Silver Helm', 'Altın Kask': 'Golden Helm', 'Efsane Kask': 'Legendary Helm', 'Taş Diş': 'Stone Fang', 'Çelik Diş': 'Steel Fang', 'Gümüş Diş': 'Silver Fang', 'Altın Diş': 'Golden Fang', 'Efsane Diş': 'Legendary Fang', 'Deri Bilezik': 'Leather Bracer', 'Demir Pençe': 'Iron Claw', 'Gümüş Pençe': 'Silver Claw', 'Altın Pençe': 'Golden Claw', 'Efsane Pençe': 'Legendary Claw', 'azami can': 'max health', 'saldırı hızı': 'attack speed',
    'Enerji dolu': 'Energy is full', 'Ruh ya da toz yetmiyor': 'Not enough souls or dust', 'Kaplan beslendi: +10 dk enerji': 'Tiger fed: +10 min energy', 'Kaplan ayağa kalktı': 'The tiger got back up', 'Kaplanın enerjisi bitti: besle': 'The tiger is out of energy: feed it', 'Kaplan yaralandı: sen iyileştikçe kalkar': 'The tiger is wounded: it recovers as you heal',
    'Toz yetmiyor': 'Not enough dust', 'vurur': 'hits', 'zayıf': 'weak', '+3 toz': '+3 dust',
    'Görev': 'Quests', 'Başlangıç görevleri': 'Starter quests', 'Günlük görevler': 'Daily quests', 'Koleksiyon': 'Collection', 'tür görüldü': 'kinds seen', 'her 5 yeni türde +2 jeod, her 10\'da kalıcı +%1 can': 'every 5 new kinds +2 geodes, every 10 permanent +1% health', 'ödül hazır': 'reward ready', 'jeod': 'geode', 'Mama stoku': 'Food stock', 'Besleme': 'Feedings', 'Adlandır': 'Rename', 'Kedinin adı': 'Cat\'s name', 'Tamam': 'OK', 'Devam etmek için dokun': 'Tap to continue', 'Oyun özetini kopyala (geri bildirim için)': 'Copy game summary (for feedback)', 'ZOR BOSS': 'HARD BOSS',
    'Kedi maması al': 'Buy cat food', 'Kediyi besle': 'Feed the cat', 'Besle': 'Feed', 'Mama yok': 'No food', 'Satın al': 'Buy', 'Her kıyafet giyilirken küçük bir niş bonus verir; güç dengesini bozmaz. Kazanarak aç.': 'Each outfit gives a small niche bonus while worn; it does not break balance. Unlock by playing.',
    '+%6 ruh kazancı': '+6% soul gain', '+%4 hareket hızı': '+4% move speed', '+%5 büyü menzili': '+5% spell range', '+%3 kritik şansı': '+3% crit chance', '+%1 can çalma': '+1% lifesteal', '+%3 kaçınma': '+3% evasion',
    'Bir düşmana yaklaş: büyün otomatik atılır': 'Approach an enemy: your spell fires automatically', 'Bir kampı tamamen temizle': 'Clear a camp completely', 'Bir sandık aç': 'Open a chest', 'Yetenek ağacından bir geliştirme al': 'Buy an upgrade from the skill tree', 'Cadı Evi\'nde kediyi sev': 'Pet the cat in the Witch House', '5 kamp temizle': 'Clear 5 camps', 'İlk adanın bossunu yen': 'Defeat the first island boss', 'Günlüğü oku': 'Read the journal',
    'Parmağını sürükleyerek yürü; düşman yaklaşınca büyü kendiliğinden gider.': 'Drag your finger to walk; the spell fires on its own when an enemy is near.', 'Bir kamptaki bütün düşmanları yen. Kamplar bir süre sonra yeniden dolar.': 'Defeat every enemy in a camp. Camps refill after a while.', 'Sandıklara yaklaşman yeter. Bazıları gizli, bazıları bir kamp temizlenince çıkar.': 'Just walk up to chests. Some are hidden, some appear after a camp is cleared.', 'Alttaki "Yetenek" düğmesine bas, topladığın ruhla bir yetenek yükselt.': 'Press the "Skills" button below and upgrade a skill with your souls.', 'Sol üstteki 🏠 düğmesine bas ve kediyi sev: kalıcı +%1 can.': 'Press the 🏠 button at the top left and pet the cat: permanent +1% health.', 'Her kamp kalıcı güç ve kopya kazandırır.': 'Every camp gives permanent power and copies.', 'Bütün kampları temizleyince boss evinin mührü kalkar. Sonra bossa saldır.': 'Clearing all camps lifts the boss house seal. Then attack the boss.', '🏠 → Günlük sekmesinde kırık aynanın ilk sayfası seni bekliyor.': '🏠 → Journal tab: the first page of the broken mirror awaits you.',
    '40 düşman yen': 'Defeat 40 enemies', '3 kamp temizle': 'Clear 3 camps', '6 ağaç kes': 'Chop 6 trees', 'Evde 2 iş yap': 'Do 2 chores at home', '8 büyü kombosu yap': 'Do 8 spell combos', 'Arenada 1 düello kazan': 'Win 1 arena duel',
    'Günlük görev tamamlandı: +1 jeod, +3 toz': 'Daily quest complete: +1 geode, +3 dust', 'Zor boss yenildi! Yarın yine çıkar.': 'Hard boss defeated! It returns tomorrow.', 'Koleksiyon ödülü: +2 jeod': 'Collection reward: +2 geodes', 'Koleksiyon: kalıcı +%1 can': 'Collection: permanent +1% health',
    'Toplanan ruhla alınır:': 'Bought with collected souls:',
    'Cadı Evi': 'Witch House', 'Ev': 'Home', 'Günlük': 'Journal', 'Arena': 'Arena', 'Gardırop': 'Wardrobe', 'Evden kalıcı kazanç': 'Permanent home bonus', 'en çok': 'max', 'Biriken': 'Accumulated', 'Her ada bossu yeni bir sayfa açar': 'Every island boss unlocks a new page', 'Günlük boş': 'Journal empty', 'Haftalık meydan okuma': 'Weekly challenge', '✓ Kazanıldı': '✓ Won', 'Meydan oku': 'Challenge', 'Gölge Arenası: efsane cadılar': 'Shadow Arena: legendary witches', 'Önceki efsaneyi yen': 'Defeat the previous legend', '✓ Yine dövüş': '✓ Fight again', 'Dövüş': 'Fight',
    'Gölge kodu: arkadaşınla dövüştür': 'Ghost code: duel your friend', 'Kodunu arkadaşına gönder; o yapıştırıp senin gölgenle dövüşür.': 'Send your code to a friend; they paste it and fight your ghost.', 'Gölge kodumu kopyala': 'Copy my ghost code', 'Kopyalandı': 'Copied', 'Geçersiz gölge kodu': 'Invalid ghost code', 'Kodla dövüş': 'Fight by code', 'Bu cihazdaki diğer kahramanlar': 'Other heroes on this device', 'Kıyafetler yalnız görünümdür, güç vermez. Kazanarak aç.': 'Outfits are cosmetic only. Unlock them by playing.', 'Sahipsin': 'Owned', '✓ Giyili': '✓ Worn', 'Giy': 'Wear',
    'Günlük giriş': 'Daily login', 'Kediyi sev': 'Pet the cat', 'İksir demle': 'Brew potion', 'İksiri topla': 'Collect potion', 'Bahçeyi sula': 'Water the garden', 'Kazan çorbası': 'Cauldron stew', 'Henüz hazır değil': 'Not ready yet', 'Günlüğe yeni sayfa eklendi': 'New journal page added', 'Yanan Bumerang': 'Burning Boomerang', 'Yıldızlı Dilim': 'Starry Slice', 'Delici Patlama': 'Piercing Burst', 'Blok yasak': 'No blocking', 'Yalnız büyü': 'Magic only', 'Cam top': 'Glass cannon', 'Hızlı hafta': 'Fast week',
    'Kalıcı +%1 azami can. 4 saatte bir.': 'Permanent +1% max health. Every 4 hours.', 'Demle (30 dk), topla: kalıcı +%2 hasar/güç.': 'Brew (30 min), collect: permanent +2% damage/power.', 'Kalıcı +%1 azami can ve 1 jeod. 8 saatte bir.': 'Permanent +1% max health and 1 geode. Every 8 hours.', 'Sen yokken kazan ruh biriktirir (en çok 8 saat).': 'The cauldron collects souls while you are away (up to 8 hours).', 'Bugünkü ödül alındı': 'Today\'s reward claimed', 'Sev': 'Pet', 'Sula': 'Water', 'Topla': 'Collect', 'Hazır': 'Ready', 'Demleniyor': 'Brewing', 'Demlemeye başla': 'Start brewing', 'Sınıra ulaşıldı': 'Limit reached', 'Yeni kıyafet:': 'New outfit:',
    'Kedi mırıldadı: kalıcı +%1 azami can': 'The cat purred: permanent +1% max health', 'Bahçe sulandı: +%1 azami can, +1 jeod': 'Garden watered: +1% max health, +1 geode', 'İksir demlenmeye başladı (30 dk)': 'Potion started brewing (30 min)', 'İksir hazır: kalıcı +%2 hasar': 'Potion ready: permanent +2% damage', 'Kazan yeni kuruldu': 'The cauldron was just set up', 'Haftalık meydan okuma kazanıldı! +5 jeod': 'Weekly challenge won! +5 geodes', 'Bu haftanın ödülünü zaten aldın': 'You already claimed this week\'s reward',
    'Yeni adalar açıldı! Kapıdan geçebilirsin.': 'New islands unlocked! You can pass the gate.', 'Yolculuğa devam etmek için bir devam paketi gerekir.': 'You need a continuation pack to keep going.', 'Devam paketi gerekli': 'Continuation pack needed', 'Devam paketleri (40. adadan sonra)': 'Continuation packs (after island 40)', 'Açık ada sayısı': 'Unlocked islands', 'Alındı': 'Owned', 'Güç paketleri': 'Power packs',
    'Rakip Cadı': 'Rival Witch', 'TUR': 'ROUND', 'DÖVÜŞ!': 'FIGHT!', 'ZAFER!': 'VICTORY!', 'Yenildin': 'You lost', 'SÜRE DOLDU': 'TIME UP', 'Büyü': 'Spell', 'hazır': 'ready', 'Yumruk': 'Punch', 'Tekme': 'Kick', 'Blok': 'Block', 'Dokun: devam': 'Tap to continue', 'Dokun: çık (kaleye dönünce tekrar denersin)': 'Tap to exit (you can try again later)', 'Rakip cadıyı yendin! Hexling efsanesi oldun!': 'You beat the rival witch! You are a Hexling legend!',
    'CANAVAR': 'BEAST', 'Canavar yenildi!': 'Beast defeated!', 'Bir sandık belirdi!': 'A chest appeared!', 'Usta Cadı': 'Master Witch', 'Yönlendirme okları': 'Guide arrows', 'Boss evi': 'Boss house', 'Sıradaki düşman': 'Next enemy', 'Sıradaki kamp': 'Next camp', 'Kapı': 'Gate',
    'Yükleniyor…': 'Loading…', 'Köprü bekçisi yenildi!': 'Bridge guardian defeated!', 'Henüz karşılaşmadın': 'Not encountered yet',
    'Mevcut kahraman Şeref Salonu\'nda kalır. Yeni oyun başlatılsın mı?': 'Your current hero stays in the Hall of Fame. Start a new game?',
    'Mini oyunlarla eğitilip kalıcı güç kazan. Bu seviye için günde 2 eğitim hakkın var.': 'Train with mini-games to gain permanent power. You get 2 training sessions per island per day.',
    'Bugün': 'Today',
    'Henüz ekipmanın yok': 'You have no gear yet', 'Kristalin yok': 'You have no crystals',
};
/** değişken içeren metinler için kalıplar (Türkçe → İngilizce) */
const RULES = [
    [/^\+(.+) Can kazanıldı \(eğitim\)$/, '+$1 Health gained (training)'],
    [/^\+(.+) Hasar kazanıldı \(eğitim\)$/, '+$1 Damage gained (training)'],
    [/^\+(.+) Yenilenme\/sn kazanıldı \(eğitim\)$/, '+$1 Regen/s gained (training)'],
    [/^\+(.+) Can kazanıldı$/, '+$1 Health gained'],
    [/^\+(.+) Hasar kazanıldı$/, '+$1 Damage gained'],
    [/^\+(.+) Ruh$/, '+$1 Souls'],
    [/^\+(.+) Can iyileşti \((.+)\)$/, '+$1 Health restored ($2)'],
    [/^\+(.+) Can iyileşti$/, '+$1 Health restored'],
    [/^\+(\d+) (.+) kopyası$/, '+$1 $2 copy'],
    [/^(.+) kuşanıldı \(ek yuva\)$/, '$1 equipped (extra slot)'],
    [/^(.+) kuşanıldı$/, '$1 equipped'],
    [/^(.+) birleştirildi \(sv\.(.+)\)$/, '$1 merged (lv.$2)'],
    [/^\+(.+) Can iyileşti \(yıkılan yapı\)$/, '+$1 Health restored (destroyed structure)'],
    [/^\+(.+) Can kazanıldı \(kalıcı, yapı\)$/, '+$1 Health gained (permanent, structure)'],
    [/^(.+) bulundu!$/, '$1 found!'],
    [/^(.+) açıldı!$/, '$1 unlocked!'],
    [/^(.+) yenildi! Ama bir gölge seni bekliyor…$/, '$1 defeated! But a shadow awaits you…'],
    [/^(.+) yenildi! Yolculuğa devam etmek için bir devam paketi al\.$/, '$1 defeated! Get a continuation pack to keep going.'],
    [/^(.+) yenildi! (.+)$/, '$1 defeated! $2'],
    [/^(.+) yenildi!$/, '$1 defeated!'],
    [/^Gizli sandık bulundu! \((.+)\)$/, 'Secret chest found! ($1)'],
    [/^Bugün kalan: (.+)$/, 'Remaining today: $1'],
    [/^KİLİTLİ — (.+) yenilmeli$/, 'LOCKED — defeat $1'],
    [/^Usta Cadı (.+)$/, 'Master Witch $1'],
    [/^(.+) yolu açık$/, '$1 path is open'],
    [/^kamp (.+) · sandık (.+)$/, 'camps $1 · chests $2'],
    [/^MÜHÜRLÜ · kamp (.+)$/, 'SEALED · camps $1'],
    [/^\+(.+) can\/sn$/, '+$1 health/s'],
    [/^%(.+) ihtimalle darbeyi engeller$/, 'blocks hits with $1% chance'],
    [/^Ada (.+) · (.+) · aşılan: (.+)$/, 'Island $1 · $2 · cleared: $3'],
];
export function T(s) {
    if (settings.lang !== 'en')
        return s;
    const hit = EN[s];
    if (hit)
        return hit;
    for (const [re, to] of RULES)
        if (re.test(s))
            return s.replace(re, to).replace(/\$(\d)/g, '');
    return s;
}
/** sahne içi addan (ada, boss, düşman, usta) İngilizce karşılık: basit sözlük */
const NAMES_EN = {
    'Mantar Ormanı': 'Mushroom Forest', 'Karanlık Bataklık': 'Dark Swamp', 'Buz Mağarası': 'Ice Cave', 'Kızıl Çöl': 'Crimson Desert',
    'Kristal Vadisi': 'Crystal Valley', 'Volkan Adası': 'Volcano Isle', 'Bulut Sarayı': 'Cloud Palace', 'Gölge Diyarı': 'Shadow Realm',
    'Dev Baykuş': 'Giant Owl', 'Bataklık Kraliçesi': 'Swamp Queen', 'Kış Cadısı': 'Winter Witch', 'Çöl Akrep Kralı': 'Scorpion King',
    'Kristal Bekçi': 'Crystal Warden', 'Magma Ejderi': 'Magma Drake', 'Fırtına Kartalı': 'Storm Eagle', 'Gölge Kraliçe': 'Shadow Queen',
    'Hayalet Kedi': 'Ghost Cat', 'Mantar Cücesi': 'Mushroom Gnome', 'Balkabağı Cin': 'Pumpkin Imp', 'Gece Yarasası': 'Night Bat',
    'Çöl Akrebi': 'Desert Scorpion', 'Taş Golem': 'Stone Golem', 'Fırtına Cini': 'Storm Wisp',
    'Kadim ': 'Ancient ', 'Altın ': 'Golden ', 'Buzul ': 'Glacial ', 'Efsanevi ': 'Legendary ',
};
export function N(name) {
    if (settings.lang !== 'en')
        return name;
    let out = name;
    for (const [tr, en] of Object.entries(NAMES_EN))
        out = out.split(tr).join(en);
    return out;
}
