"""Verified public Android APK release pointer (no network or credentials)."""
import base64
import importlib.util
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "release_pointer", ROOT / "scripts" / "publish_app_release_index.py"
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

TAG = "v2.0.33"
NAME = "FirstHyundai-v2.0.33.apk"
URL = "https://github.com/jwj2477-777/firsthyundai-app/releases/download/" + TAG + "/" + NAME

def release(tag=TAG, size=130000, url=URL):
    return {
        "tag_name": tag,
        "draft": False,
        "prerelease": False,
        "published_at": "2026-10-24T01:00:00Z",
        "assets": [{"name": NAME, "browser_download_url": url, "size": size}],
    }

class IndexTests(unittest.TestCase):
    def test_validate_exact_release(self):
        m = mod.build_manifest(TAG, release(), 130000)
        self.assertEqual(m["tag_name"], TAG)
        self.assertEqual(m["assets"][0]["browser_download_url"], URL)
        self.assertEqual(m["assets"][0]["size"], 130000)

    def test_reject_invalid_release(self):
        for bad in (
            release(tag="v2.0.32"),
            release(size=129999),
            release(url="https://elsewhere.example/app.apk"),
            dict(release(), draft=True),
            dict(release(), prerelease=True),
        ):
            with self.assertRaises(ValueError):
                mod.build_manifest(TAG, bad, 130000)
        with self.assertRaises(ValueError):
            mod.build_manifest("v2.0.33-dev", release(), 130000)
        with self.assertRaises(ValueError):
            mod.build_manifest(TAG, release(size=900), 900)

    def test_published_manifest_is_plain_public_json(self):
        with tempfile.TemporaryDirectory() as d:
            file = Path(d) / NAME
            file.write_bytes(b"a" * 130000)
            writes = []
            def fake(url, token, method="GET", payload=None):
                if url.endswith("/releases/tags/" + TAG):
                    return release()
                if method == "GET":
                    raise urllib.error.HTTPError(url, 404, "not found", None, None)
                writes.append(payload)
                return {"content": {"sha": "sha"}}
            index = mod.publish(TAG, file, "fake-token", request=fake)
            self.assertEqual(len(writes), 1)
            published = json.loads(base64.b64decode(writes[0]["content"]))
            self.assertEqual(index, published)
            self.assertEqual(writes[0]["branch"], "main")
            self.assertNotIn("fake-token", json.dumps(published))

    def test_prevent_version_rollback(self):
        with tempfile.TemporaryDirectory() as d:
            file = Path(d) / NAME
            file.write_bytes(b"b" * 130000)
            current = {
                "tag_name": "v2.0.34",
                "assets": [{"name": "FirstHyundai-v2.0.34.apk", "size": 130000}],
            }
            def fake(url, token, method="GET", payload=None):
                if url.endswith("/releases/tags/" + TAG):
                    return release()
                if method == "GET":
                    return {
                        "sha": "existing",
                        "content": base64.b64encode(json.dumps(current).encode()).decode(),
                    }
                raise AssertionError("Rollback must not publish a new pointer")
            with self.assertRaises(ValueError):
                mod.publish(TAG, file, "fake-token", request=fake)

if __name__ == "__main__":
    unittest.main()
