#!/usr/bin/env python3
"""Publish a compact signed-release *locator* after GitHub Release succeeds.

The Android application independently revalidates the exact release asset URL
and installs only a package with the same signing certificate and a higher build.
The locator is public metadata, never a signing key or an update APK.
"""
from __future__ import annotations
import argparse
import base64
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

OWNER = "jwj2477-777/firsthyundai-app"
PATH = "data/app_latest.json"
VERSION = re.compile(r"v[0-9]{1,3}(?:\.[0-9]{1,3}){2}\Z")


def version_tuple(tag):
    if not isinstance(tag, str) or not VERSION.fullmatch(tag):
        raise ValueError("Invalid release tag")
    return tuple(int(v) for v in tag[1:].split("."))


def build_manifest(tag, release, apk_size):
    version_tuple(tag)
    if not isinstance(release, dict) or release.get("tag_name") != tag:
        raise ValueError("GitHub release tag does not match build")
    if release.get("draft") or release.get("prerelease"):
        raise ValueError("Refusing drafts and prereleases")
    filename = f"FirstHyundai-{tag}.apk"
    url = f"https://github.com/{OWNER}/releases/download/{tag}/{filename}"
    verified = [
        a for a in release.get("assets", [])
        if isinstance(a, dict) and a.get("name") == filename
        and a.get("browser_download_url") == url
        and type(a.get("size")) is int and a["size"] == apk_size
    ]
    if len(verified) != 1 or not 100000 <= apk_size <= 80 * 1024 * 1024:
        raise ValueError("Published signed APK must exist with same exact size")
    return {
        "schema_version": 1,
        "tag_name": tag,
        "assets": [{
            "name": filename,
            "browser_download_url": url,
            "size": apk_size,
        }],
        "published_at": release.get("published_at"),
    }


def request_json(url, token, method="GET", payload=None):
    body = json.dumps(payload, separators=(",", ":")).encode() if payload is not None else None
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "FirstHyundaiReleaseIndex/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
        "Authorization": "Bearer " + token,
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=20) as response:
        if response.status not in (200, 201):
            raise RuntimeError("Release pointer request failed")
        return json.loads(response.read(256000).decode("utf-8"))


def publish(tag, apk, token, repo=OWNER, request=request_json):
    if repo != OWNER or not token or not isinstance(apk, Path):
        raise ValueError("Pinned repository and a GitHub Actions token required")
    version_tuple(tag)
    if apk.name != f"FirstHyundai-{tag}.apk":
        raise ValueError("APK name does not match release version")
    actual_size = apk.stat().st_size
    base = f"https://api.github.com/repos/{OWNER}"
    release = request(f"{base}/releases/tags/{tag}", token)
    index = build_manifest(tag, release, actual_size)
    content = json.dumps(index, ensure_ascii=False, indent=2) + "\n"
    endpoint = f"{base}/contents/{PATH}"
    for attempt in range(3):
        sha = None
        try:
            existing = request(endpoint, token)
            sha = existing.get("sha")
            previous_raw = base64.b64decode(existing.get("content", ""))
            previous = json.loads(previous_raw)
            current = previous.get("tag_name", "")
            if VERSION.fullmatch(current) and version_tuple(current) > version_tuple(tag):
                raise ValueError("Refusing to roll back published release index")
            if previous == index:
                return index
        except urllib.error.HTTPError as ex:
            if ex.code != 404:
                raise
        body = {
            "message": f"data: publish v{tag[1:]} verified Android release pointer [skip ci]",
            "content": base64.b64encode(content.encode()).decode(),
            "branch": "main",
        }
        if sha:
            body["sha"] = sha
        try:
            request(endpoint, token, method="PUT", payload=body)
            return index
        except urllib.error.HTTPError as ex:
            if ex.code not in (409, 422) or attempt == 2:
                raise
            time.sleep(1.5)
    raise RuntimeError("Release pointer publish did not complete")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", required=True)
    parser.add_argument("--apk", type=Path, required=True)
    args = parser.parse_args()
    publish(args.tag, args.apk, os.getenv("GH_TOKEN", ""), os.getenv("GITHUB_REPOSITORY", ""))
    print("Verified public APK release index published:", args.tag)
