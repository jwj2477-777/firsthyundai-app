"""Fail closed if release APK is unsigned or signed with an unknown key."""
import os,re,subprocess,sys,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def verify(path):
    expected=re.sub('[^0-9a-f]','', (ROOT/'docs/RELEASE_SIGNING_CERT_SHA256.txt').read_text().lower())
    if len(expected)!=64:raise RuntimeError('Release signing certificate fingerprint invalid')
    apksigner=shutil.which('apksigner')
    if not apksigner:
        sdk=os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT','')
        apksigner=str(Path(sdk)/'build-tools'/'35.0.0'/'apksigner')
    if not Path(apksigner).is_file():
        raise RuntimeError('Android SDK apksigner executable is unavailable')
    command=[apksigner,'verify','--print-certs',str(path)]
    result=subprocess.run(command,capture_output=True,text=True,check=True)
    m=re.search(r'Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]{64})',result.stdout)
    if not m or m.group(1).lower()!=expected:
        raise RuntimeError('APK signing certificate changed; refusing to publish an update-incompatible APK')
    print('Stable production APK signing fingerprint verified')
if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: check_release_signature.py <apk>')
    verify(Path(sys.argv[1]))
