#!/usr/bin/env python3
"""Export a portable, self-contained, secret-free AI handoff MD + ZIP.

No API keys, customer notes, bank details, private credentials, Android keystores,
raw Git history or internal app databases are included. Source must be backed
up separately from the same public GitHub repository.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = (
    "AGENTS.md",
    "CLAUDE.md",
    "docs/AI_HANDOFF.md",
    "docs/PRODUCT_REQUIREMENTS.md",
    "docs/PROJECT_HISTORY.md",
    "docs/RECOVERY_PLAYBOOK.md",
    "docs/CHANGE_LOG_FOR_AI.md",
    "docs/API_APPLICATION_GUIDE.md",
    "docs/KAKAO_LIVE_NEARBY_SETUP.md",
)
EXTRAS = ("app/build.gradle", ".github/workflows/build-apk.yml")
SOURCE_FOLDERS = ("app", "scripts", "tests", "workers", ".github/workflows")
NAME = "FirstHyundai-AI-Handoff-Complete"
GRAVE = chr(96)

def current_version():
    gradle = (ROOT / "app/build.gradle").read_text(encoding="utf-8")
    name = re.search(r"\bversionName\s+'(\d+(?:\.\d+){2,3})'", gradle)
    number = re.search(r"\bversionCode\s+(\d+)", gradle)
    if not name or not number:
        raise RuntimeError("Cannot read version from app/build.gradle")
    return name.group(1), int(number.group(1))

def file_inventory():
    names = []
    for folder in SOURCE_FOLDERS:
        for p in sorted((ROOT / folder).rglob("*")):
            if not p.is_file() or ".git" in p.parts:
                continue
            if p.suffix not in (".java", ".xml", ".html", ".css", ".js", ".py",
                                ".yml", ".md", ".json", ".mjs"):
                continue
            names.append(str(p.relative_to(ROOT).as_posix()))
            if len(names) > 1500:
                raise RuntimeError("Unexpected source file count")
    return "\n".join("- " + GRAVE + name + GRAVE for name in names)

def build(output_dir):
    version, build_no = current_version()
    commit = os.getenv("GITHUB_SHA", "")[:12]
    if commit and not re.fullmatch(r"[0-9a-f]{12}", commit):
        commit = ""
    created = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    chunks = [
        "# 퍼스트현대 — 모든 AI를 위한 프로젝트 종합 인수인계 백업",
        "",
        "> ChatGPT / Gemini / Claude / Codex / 사람 개발자 공통.",
        f"> 생성: {created}; Android versionName={version}; versionCode={build_no}; git={commit or '로컬 출력'}",
        "> 작성 당시의 정보만 보존합니다. 현재 앱 버전과 릴리스는 GitHub에서 재검증하세요.",
        "> 공개용: 실제 고객자료·계좌·고객 연락처·키·비밀번호·휴대폰 내 메모는 포함하지 않습니다.",
        "",
        "## 언제든지 찾을 수 있는 원본",
        "- https://github.com/jwj2477-777/firsthyundai-app",
        "- https://github.com/jwj2477-777/firsthyundai-app/releases",
        "- https://github.com/jwj2477-777/firsthyundai-app/archive/refs/heads/main.zip",
        "- Git 커밋 전체 이력은 별도의 Git bundle 또는 mirror로 백업합니다.",
        "- 모든 과거 채팅의 원문을 100% 보존하는 것은 아닙니다.",
        "",
        "## 현재 소스 파일명 인벤토리",
        file_inventory(),
    ]
    included = {}
    for rel in DOCS + EXTRAS:
        path = ROOT / rel
        if not path.is_file():
            raise FileNotFoundError("Required AI handoff file missing: " + rel)
        value = path.read_text(encoding="utf-8")
        if not value.strip():
            raise ValueError("Empty required file: " + rel)
        included[rel] = value
        chunks.extend(["", "---", "", "# 원본 문서: " + rel, "", value])
    combined = "\n".join(chunks).rstrip() + "\n"
    for required in ("퍼스트현대", "14개", "갱신", "특약", "2026-10-21"):
        if required not in combined:
            raise ValueError("Required topic missing: " + required)
    output_dir.mkdir(parents=True, exist_ok=True)
    markdown = output_dir / (NAME + ".md")
    archive = output_dir / (NAME + ".zip")
    markdown.write_text(combined, encoding="utf-8")
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as out:
        out.write(markdown, arcname=markdown.name)
        for name, contents in included.items():
            out.writestr(name, contents)
    with zipfile.ZipFile(archive) as check:
        damaged = check.testzip()
        if damaged:
            raise RuntimeError("ZIP corruption at: " + damaged)
    print(json.dumps({
        "version": version, "build": build_no, "docs": len(DOCS),
        "markdown_bytes": markdown.stat().st_size,
        "zip_bytes": archive.stat().st_size,
        "zip": str(archive), "markdown": str(markdown),
    }, ensure_ascii=False))
    return markdown, archive

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="/tmp/firsthyundai-ai-backup")
    args = parser.parse_args()
    build(Path(args.out))
