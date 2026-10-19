"""Publish only a salted PBKDF2 verifier, never the family code.
Data is public: codes must be long and random to resist offline guessing.
Public policy enables existing Android installations to detect rotations online.
"""
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sys

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data/access_policy.json"
password = os.environ.get("FIRSTHYUNDAI_ACCESS_CODE", "").strip()
if not 8 <= len(password) <= 64 or not password.isascii() or not password.isprintable():
    sys.exit("Missing valid FIRSTHYUNDAI_ACCESS_CODE secret (8-64 printable ASCII characters)")
iterations = 360_000
old = {}
try:
    old = json.loads(DEST.read_text(encoding="utf-8"))
except (OSError, ValueError):
    pass
if old.get("state") == "ok":
    try:
        salt = bytes.fromhex(old["salt"])
        existing_iterations = int(old["iterations"])
        current = hashlib.pbkdf2_hmac("sha256", password.encode("ascii"), salt, existing_iterations)
        if hmac.compare_digest(current.hex(), old["verifier"]):
            print("Unchanged family code: keeping current policy/version")
            sys.exit(0)
    except (ValueError, KeyError, TypeError):
        pass

salt = secrets.token_bytes(16)
verifier = hashlib.pbkdf2_hmac("sha256", password.encode("ascii"), salt, iterations).hex()
new_version = int(old.get("policy_version", 0)) + 1
payload = {
    "schema_version": 1,
    "state": "ok",
    "policy_version": new_version,
    "iterations": iterations,
    "salt": salt.hex(),
    "verifier": verifier,
    "note": "Public offline PBKDF2 verifier. Never store the original passphrase here.",
}
DEST.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("Published changed access policy version", new_version)
