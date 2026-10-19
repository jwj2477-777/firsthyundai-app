"""Regression tests for GitHub-held remote family code rotation.
All tests use synthetic credentials and an isolated temporary directory.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

script = Path(__file__).with_name("publish_family_policy.py")
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / "scripts").mkdir()
    (root / "data").mkdir()
    copy = root / "scripts/publish_family_policy.py"
    shutil.copy2(script, copy)
    policy = root / "data/access_policy.json"
    policy.write_text('{"schema_version":1,"state":"not_started","policy_version":0}\n',encoding="utf-8")
    env = dict(os.environ)
    env["FIRSTHYUNDAI_ACCESS_CODE"] = "TestSecret!5972ABCdef"

    def run():
        result = subprocess.run([sys.executable, str(copy)], env=env,
                                capture_output=True, text=True, check=True)
        assert env["FIRSTHYUNDAI_ACCESS_CODE"] not in result.stdout
        return json.loads(policy.read_text(encoding="utf-8"))

    first = run()
    assert first["policy_version"] == 1 and first["state"] == "ok"
    assert "TestSecret" not in policy.read_text(encoding="utf-8")
    second = run()
    assert second["policy_version"] == 1 and second["verifier"] == first["verifier"]
    env["FIRSTHYUNDAI_ACCESS_CODE"] = "DifferentSecret!5972XYZabc"
    rotated = run()
    assert rotated["policy_version"] == 2
    assert rotated["verifier"] != first["verifier"]
    assert rotated["salt"] != first["salt"]
    print("Access policy test passed: bootstrap, unchanged, rotation")
