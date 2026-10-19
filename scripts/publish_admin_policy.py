"""Generate a public salted administrator verifier from a private GitHub Actions Secret.
Never save or log the code itself. Public verifiers require long random secrets.
"""
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sys

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"data/admin_policy.json"
admin=os.environ.get("FIRSTHYUNDAI_ADMIN_CODE","").strip()
family=os.environ.get("FIRSTHYUNDAI_ACCESS_CODE","").strip()
if not 12 <= len(admin) <= 64 or not admin.isascii() or not admin.isprintable():
    sys.exit("FIRSTHYUNDAI_ADMIN_CODE must contain 12 to 64 printable ASCII characters.")
if family and hmac.compare_digest(admin,family):
    sys.exit("Administrator code MUST be different from the family code.")
old={}
try:
    old=json.loads(DEST.read_text(encoding="utf-8"))
except (OSError,ValueError):
    pass
if old.get("state")=="ok":
    try:
        check=hashlib.pbkdf2_hmac(
            "sha256",admin.encode("ascii"),bytes.fromhex(old["salt"]),int(old["iterations"])
        )
        if hmac.compare_digest(check.hex(),old["verifier"]):
            print("Administrator access policy unchanged.")
            sys.exit(0)
    except (KeyError,TypeError,ValueError):
        pass
iterations=450_000
salt=secrets.token_bytes(16)
payload={
    "schema_version":1,
    "state":"ok",
    "policy_version":int(old.get("policy_version",0))+1,
    "iterations":iterations,
    "salt":salt.hex(),
    "verifier":hashlib.pbkdf2_hmac(
        "sha256",admin.encode("ascii"),salt,iterations
    ).hex(),
    "note":"Public PBKDF2 verifier only; never store the real administrator code in Git.",
}
DEST.parent.mkdir(parents=True,exist_ok=True)
DEST.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Administrator policy published, version",payload["policy_version"])
