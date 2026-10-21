#!/usr/bin/env python3
"""CI release integrity: compare Android package version against Gradle and release naming."""
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def main(apk_path):
    gradle = (ROOT / "app/build.gradle").read_text(encoding="utf-8")
    workflow = (ROOT / ".github/workflows/build-apk.yml").read_text(encoding="utf-8")
    code = re.search(r"\bversionCode\s+(\d+)", gradle)
    name = re.search(r"\bversionName\s+'([^']+)'", gradle)
    if not code or not name:
        raise RuntimeError("Missing Gradle release version metadata")
    expected_code, expected_name = int(code.group(1)), name.group(1)
    if not re.fullmatch(r"\d+(?:\.\d+){2,3}", expected_name) or expected_code <= 0:
        raise RuntimeError("Unexpected Gradle app version")
    release = "v" + expected_name
    if f"gh release create {release} " not in workflow or f"FirstHyundai-{release}.apk" not in workflow:
        raise RuntimeError("GitHub APK release tag and filename must match installed versionName")

    sdk_root = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    if not sdk_root:
        raise RuntimeError("Android SDK root missing; cannot independently inspect APK version")
    aapt = Path(sdk_root) / "build-tools" / "35.0.0" / "aapt"
    if not aapt.is_file():
        raise RuntimeError(f"aapt binary missing at Android SDK build-tools/35.0.0")
    output = subprocess.check_output([str(aapt), "dump", "badging", str(apk_path)], text=True)
    pkg = re.search(r"(?m)^package:\s+name='([^']+)'\s+versionCode='(\d+)'\s+versionName='([^']+)'", output)
    if not pkg:
        raise RuntimeError("Cannot read built APK AndroidManifest version metadata")
    package_name, apk_code, apk_name = pkg.groups()
    if package_name != "kr.co.firsthyundai.app":
        raise RuntimeError("Unexpected applicationId in APK")
    if (int(apk_code), apk_name) != (expected_code, expected_name):
        raise RuntimeError(f"APK metadata mismatch with Gradle: APK code={apk_code} version={apk_name} "
                           f"vs Gradle code={expected_code} version={expected_name}")
    print(f"Verified installed APK metadata: package={package_name}, version={apk_name}, "
          f"build={apk_code}, release={release}. Native UI reads this exact metadata.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/check_apk_version.py <APK path>")
    main(Path(sys.argv[1]).resolve())
