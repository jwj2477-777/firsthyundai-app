#!/usr/bin/env python3
"""Build-time optional Firebase client configuration. No service-account secrets in APK.

GitHub Secret FHD_FIREBASE_ANDROID_JSON may contain either google-services.json
or the public Firebase app fields (app_id, api_key, project_id, sender_id).
If missing, the Android app retains safe periodic-check fallback and reports
push not configured rather than implying real-time delivery.
"""
import json
import os
import pathlib
import re
import sys

raw = os.environ.get("FHD_FIREBASE_ANDROID_JSON", "").strip()
target = pathlib.Path("app/src/main/assets/firebase_public_config.json")
if not raw:
    target.unlink(missing_ok=True)
    print("FCM client configuration absent; Firebase real-time push is inactive.")
    sys.exit(0)

try:
    cfg = json.loads(raw)
    if "project_info" in cfg and "client" in cfg:
        project = cfg["project_info"]
        clients = [
            c for c in cfg["client"]
            if c.get("client_info", {}).get("android_client_info", {}).get("package_name")
            == "kr.co.firsthyundai.app"
        ]
        if len(clients) != 1:
            raise ValueError("Firebase Android package kr.co.firsthyundai.app not found")
        c = clients[0]
        output = {
            "app_id": c["client_info"]["mobilesdk_app_id"],
            "api_key": c["api_key"][0]["current_key"],
            "project_id": project["project_id"],
            "sender_id": str(project["project_number"]),
        }
    else:
        output = {k: str(cfg[k]) for k in ("app_id", "api_key", "project_id", "sender_id")}
    if not re.fullmatch(r"1:[0-9]+:android:[0-9a-fA-F]+", output["app_id"]):
        raise ValueError("invalid Android Firebase app id")
    if not re.fullmatch(r"AIza[A-Za-z0-9_-]{20,}", output["api_key"]):
        raise ValueError("invalid Firebase public API key")
    if not re.fullmatch(r"[a-zA-Z0-9._-]{3,120}", output["project_id"]):
        raise ValueError("invalid Firebase project id")
    if not re.fullmatch(r"[0-9]{5,30}", output["sender_id"]):
        raise ValueError("invalid Firebase sender ID")
except (ValueError, KeyError, IndexError, TypeError) as exc:
    print("::error::Firebase Android configuration invalid; verify the JSON and package name.")
    sys.exit(1)

target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(output, separators=(",", ":")), encoding="utf-8")
print("FCM public client configuration generated for this APK; private service account stays on Cloudflare.")
