"""Build-time verifier for FirstHyundai family Android app.
The passphrase is supplied only through a GitHub Actions Secret.
Never commit or print the passphrase, and never write this output back to git.
"""
import hashlib
import os
from pathlib import Path
import secrets
import sys

password = os.environ.get("FIRSTHYUNDAI_ACCESS_CODE", "").strip()
if not 8 <= len(password) <= 64 or not password.isascii() or not password.isprintable():
    sys.exit(
        "FIRSTHYUNDAI_ACCESS_CODE GitHub Secret을 등록하세요. "
        "영문·숫자·기호로 된 8~64자 코드를 입력해야 합니다."
    )
salt = secrets.token_bytes(16)
iterations = 240_000
verifier = hashlib.pbkdf2_hmac(
    "sha256", password.encode("ascii"), salt, iterations, dklen=32
)
target = Path(__file__).resolve().parents[1] / "app/src/main/assets/access-verifier.properties"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(
    f"iterations={iterations}\nsalt={salt.hex()}\nverifier={verifier.hex()}\n",
    encoding="ascii",
)
print("앱 잠금용 검증 데이터 생성 완료 (보안코드는 기록하지 않음)")
