"""Regression test for independent, manually published administrator policy.
This uses throwaway secrets and never contacts GitHub.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

source=Path(__file__).with_name("publish_admin_policy.py")
with tempfile.TemporaryDirectory() as folder:
    root=Path(folder)
    (root/"scripts").mkdir()
    (root/"data").mkdir()
    script=root/"scripts/publish_admin_policy.py"
    shutil.copy2(source,script)
    dest=root/"data/admin_policy.json"
    dest.write_text(json.dumps({"state":"not_started","policy_version":0})+"\n",encoding="utf-8")
    env=dict(os.environ)
    env["FIRSTHYUNDAI_ACCESS_CODE"]="FamilyCodeExample!5298"
    env["FIRSTHYUNDAI_ADMIN_CODE"]="AdministratorCodeExample!8245"

    def invoke(must_succeed=True):
        proc=subprocess.run([sys.executable,str(script)],capture_output=True,text=True,env=env)
        if must_succeed:
            assert proc.returncode==0,proc.stderr
        else:
            assert proc.returncode!=0
        assert env["FIRSTHYUNDAI_ADMIN_CODE"] not in proc.stdout+proc.stderr
        return json.loads(dest.read_text(encoding="utf-8"))

    first=invoke()
    assert first["state"]=="ok" and first["policy_version"]==1
    assert first["iterations"]>=300_000
    assert len(first["salt"])==32 and len(first["verifier"])==64
    digest=hashlib.pbkdf2_hmac("sha256",env["FIRSTHYUNDAI_ADMIN_CODE"].encode("ascii"),
        bytes.fromhex(first["salt"]),first["iterations"]).hex()
    assert digest==first["verifier"]
    assert env["FIRSTHYUNDAI_ADMIN_CODE"] not in dest.read_text(encoding="utf-8")
    second=invoke()
    assert second["policy_version"]==1 and second["verifier"]==first["verifier"]
    env["FIRSTHYUNDAI_ADMIN_CODE"]="AnotherAdministratorCode!9514"
    updated=invoke()
    assert updated["policy_version"]==2 and updated["verifier"]!=first["verifier"]
    env["FIRSTHYUNDAI_ADMIN_CODE"]=env["FIRSTHYUNDAI_ACCESS_CODE"]
    unchanged=invoke(must_succeed=False)
    assert unchanged["policy_version"]==2
    env["FIRSTHYUNDAI_ADMIN_CODE"]="too-short"
    invoke(must_succeed=False)
    print("Admin policy tests passed: distinct code, strong minimum, initial, unchanged, rotation")
