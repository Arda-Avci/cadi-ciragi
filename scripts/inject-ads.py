"""Capacitor projesine AdMob uygulama kimliğini ekler (cap add android/ios sonrası, CI'da çalışır).
Kimlikler ortam değişkeninden gelir; verilmezse Google'ın herkese açık TEST uygulama kimlikleri kullanılır (para kazandırmaz).
Kullanım: python3 scripts/inject-ads.py android|ios
"""
import os
import plistlib
import sys
from pathlib import Path

TEST_ANDROID = 'ca-app-pub-3940256099942544~3347511713'
TEST_IOS = 'ca-app-pub-3940256099942544~1458002511'


def android() -> None:
    app_id = os.environ.get('ADMOB_ANDROID_APP_ID') or TEST_ANDROID
    p = Path('android/app/src/main/AndroidManifest.xml')
    s = p.read_text(encoding='utf-8')
    if 'com.google.android.gms.ads.APPLICATION_ID' in s:
        print('zaten ekli')
        return
    meta = f'        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="{app_id}"/>\n'
    s = s.replace('</application>', meta + '    </application>', 1)
    p.write_text(s, encoding='utf-8')
    print('android: AdMob uygulama kimliği eklendi', 'TEST' if app_id == TEST_ANDROID else 'GERÇEK')


def ios() -> None:
    app_id = os.environ.get('ADMOB_IOS_APP_ID') or TEST_IOS
    p = Path('ios/App/App/Info.plist')
    d = plistlib.loads(p.read_bytes())
    d['GADApplicationIdentifier'] = app_id
    d['NSUserTrackingUsageDescription'] = 'Sana daha uygun reklamlar göstermek için kullanılır.'
    # Google'ın SKAdNetwork kimliği (tam liste için AdMob belgelerine bakın)
    d['SKAdNetworkItems'] = [{'SKAdNetworkIdentifier': 'cstr6suwn9.skadnetwork'}]
    p.write_bytes(plistlib.dumps(d))
    print('ios: AdMob uygulama kimliği eklendi', 'TEST' if app_id == TEST_IOS else 'GERÇEK')


if __name__ == '__main__':
    {'android': android, 'ios': ios}[sys.argv[1]]()
