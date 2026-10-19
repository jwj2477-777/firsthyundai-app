#!/usr/bin/env python3
"""Expand Songdo apartment catalog with official K-apt public API data.

DATA_GO_KR_SERVICE_KEY is read ONLY from GitHub Actions secrets.
Do not scrape Naver or print any key. Strictly include 2818510600 Songdo-dong.
A failed or incomplete fetch never replaces existing curated information.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, unquote
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "complexes.json"
LIST_URL = "https://apis.data.go.kr/1613000/AptListService4/getSigunguAptList4"
BASIC_URL = "https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5"
DETAIL_URL = "https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusDtlInfoV5"
SONGDO_CODE = "2818510600"
KST = timezone(timedelta(hours=9))
BAD_CODES = {"03", "04", "05", "10", "11", "12", "20", "21", "22", "30", "31", "32", "99"}
MAX_LIST_PAGES = 20
MAX_SONGDO = 450


class PublicApiError(RuntimeError):
    pass


def cleaned(s):
    return str(s or "").strip()


def key_normalize(key):
    key = key.strip()
    return unquote(key) if re.search(r"%[a-fA-F0-9]{2}", key) else key


def call_api(url, params, service_key, *, session=None):
    if not service_key:
        raise PublicApiError("K-apt 호출 불가: GitHub DATA_GO_KR_SERVICE_KEY 미설정")
    q = {"serviceKey": key_normalize(service_key), **params}
    target = url + "?" + urlencode(q)
    req = Request(target, headers={"User-Agent": "FirstHyundai-Kapt/1.0",
                                    "Accept": "application/json, application/xml"})
    try:
        if session:
            payload = session(req)
        else:
            with urlopen(req, timeout=35) as response:
                payload = response.read(8_000_001)
        if len(payload) > 8_000_000:
            raise PublicApiError("K-apt 응답이 너무 큽니다")
    except HTTPError as err:
        # Never log full URL (contains secret) or raw server body.
        raise PublicApiError("K-apt API HTTP " + str(err.code) +
                             ": 단지목록/기본정보 별도 활용승인 여부 확인 필요") from None
    except (URLError, TimeoutError) as err:
        raise PublicApiError("K-apt 공개 API 연결 실패: 네트워크/서비스 점검") from None
    return parse_payload(payload)


def parse_payload(data):
    if isinstance(data, bytes):
        data = data.decode("utf-8-sig")
    data = str(data).strip()
    if data.startswith("{") or data.startswith("["):
        return json.loads(data)
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        raise PublicApiError("K-apt API 응답 형식 오류 (HTML/비정상 데이터)") from None
    def parse_el(node):
        if len(node) == 0:
            return (node.text or "").strip()
        obj = {}
        for child in node:
            v = parse_el(child)
            if child.tag in obj:
                if not isinstance(obj[child.tag], list):
                    obj[child.tag] = [obj[child.tag]]
                obj[child.tag].append(v)
            else:
                obj[child.tag] = v
        return obj
    return {root.tag: parse_el(root)}


def unpack(resp):
    if isinstance(resp, list):
        return resp, len(resp)
    if not isinstance(resp, dict):
        raise PublicApiError("K-apt 응답이 JSON 객체가 아닙니다")
    envelope = resp.get("response", resp)
    if not isinstance(envelope, dict):
        raise PublicApiError("K-apt 응답 본문 오류")
    header = envelope.get("header") or {}
    if not isinstance(header, dict):
        header = {}
    code = cleaned(header.get("resultCode") or resp.get("resultCode"))
    if code and code not in ("00", "000", "0"):
        raise PublicApiError("K-apt API resultCode=" + re.sub(r"[^0-9A-Z_]", "", code)[:40] +
                             " (단지목록·기본정보 서비스별 활용승인 확인)")
    body = envelope.get("body", envelope)
    if not isinstance(body, dict):
        return [], 0
    nested = body.get("items", body.get("item", body.get("data", {})))
    if isinstance(nested, dict):
        items = nested.get("item", nested.get("items", nested))
    else:
        items = nested
    if not items:
        items = []
    if isinstance(items, dict):
        items = [items]
    if not isinstance(items, list):
        raise PublicApiError("K-apt items 목록 구조 오류")
    count = body.get("totalCount", body.get("totalCnt"))
    try:
        count = int(count) if count is not None else None
    except (TypeError, ValueError):
        count = None
    return [x for x in items if isinstance(x, dict)], count


def list_complexes(key, *, session=None, wait=0.1):
    all_rows, seen = [], set()
    for page in range(1, MAX_LIST_PAGES + 1):
        data = call_api(LIST_URL, {"sigunguCode": "28185", "pageNo": page, "numOfRows": 500,
                                   "_type": "json"}, key, session=session)
        items, count = unpack(data)
        for x in items:
            code = cleaned(x.get("kaptCode") or x.get("KAPT_CODE"))
            if re.fullmatch(r"A\d{8}", code) and code not in seen:
                seen.add(code)
                all_rows.append(x)
        if count is not None and len(seen) >= count:
            return all_rows
        if not items:
            if page == 1:
                raise PublicApiError("K-apt 연수구 단지목록 0건: 응답 코드/인자 점검 필요")
            return all_rows
        if len(items) < 500 and count is None:
            return all_rows
        time.sleep(wait)
    raise PublicApiError("K-apt 단지목록 페이지 한도 초과: 미완료 목록은 게시하지 않습니다")


def base_item(key, code, *, session=None):
    result = call_api(BASIC_URL, {"kaptCode": code, "dataType": "JSON"}, key, session=session)
    rows, _ = unpack(result)
    return rows[0] if rows else None


def detail_item(key, code, *, session=None):
    result = call_api(DETAIL_URL, {"kaptCode": code, "dataType": "JSON"}, key, session=session)
    rows, _ = unpack(result)
    return rows[0] if rows else {}


def is_songdo(x):
    bjd = cleaned(x.get("bjdCode"))
    address = cleaned(x.get("kaptAddr"))
    if bjd:
        return bjd == SONGDO_CODE
    # Without legal-dong code, insist on district+dong text.
    return "연수구" in address and "송도동" in address


def to_positive_int(value, *, zero=False):
    # K-apt V5 may encode integral counts as 1114.0 or "1114.0".
    raw = cleaned(value).replace(",", "")
    if not re.fullmatch(r"[0-9]+(?:\.0+)?", raw):
        return None
    num = int(raw.split(".", 1)[0])
    return num if (0 <= num <= 100000 if zero else 1 <= num <= 100000) else None


def date_iso(value):
    v = cleaned(value).replace("-", "").replace(".", "")
    if not re.fullmatch(r"\d{8}", v):
        return None
    try:
        return datetime.strptime(v, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        return None


def valid_phone(s):
    digits = re.sub(r"[^0-9]", "", cleaned(s))
    if re.fullmatch(r"032\d{7,8}", digits):
        return "032-" + digits[3:-4] + "-" + digits[-4:]
    return None


def apt_profile(basic, detail, checked_at):
    code = cleaned(basic.get("kaptCode"))
    name = cleaned(basic.get("kaptName"))
    if not re.fullmatch(r"A\d{8}", code) or not name or not is_songdo(basic):
        return None
    # hoCnt reports total households; kaptdaCnt is another count which may differ.
    # Use the total from hoCnt first and retain a mismatch note when necessary.
    total_hh = to_positive_int(basic.get("hoCnt"))
    alternate_hh = to_positive_int(basic.get("kaptdaCnt"))
    hh = total_hh or alternate_hh
    hh_note = ("K-apt 공개 세대수 항목 차이: hoCnt " + str(total_hh) + "세대, kaptdaCnt " +
               str(alternate_hh) + "세대. 총세대수는 hoCnt 기준."
               if total_hh and alternate_hh and total_hh != alternate_hh else None)
    building = to_positive_int(basic.get("kaptDongCnt"))
    address = cleaned(basic.get("doroJuso"))
    if not hh or not building or not address or "연수구" not in address:
        # Do not publish misleading or partly unlocated apartment rows.
        return None
    heater = cleaned(basic.get("codeHeatNm"))
    if heater not in ("지역난방", "개별난방", "중앙난방"):
        heater = None
    # K-apt top-floor is confirmed; the basement count is NOT the lowest residential floor.
    top_floor = to_positive_int(basic.get("kaptTopFloor"))
    floors = "최고 " + str(top_floor) + "층" if top_floor else None
    # Charging units exist in official K-apt V5 detailed information.
    ev_ground = to_positive_int(detail.get("groundElChargerCnt"), zero=True)
    ev_underground = to_positive_int(detail.get("undergroundElChargerCnt"), zero=True)
    ev_chargers = ev_ground + ev_underground if ev_ground is not None and ev_underground is not None else None
    # K-apt detailed API parking field. Never substitute other metrics.
    pc_up = to_positive_int(detail.get("kaptdPcnt"), zero=True)
    pc_down = to_positive_int(detail.get("kaptdPcntu"), zero=True)
    park_total = pc_up + pc_down if pc_up is not None and pc_down is not None else None
    # Some versions include an explicit full count; only use when actually provided.
    for k in ("kaptdPcntAll", "kaptdPcntTotal"):
        direct = to_positive_int(detail.get(k))
        if direct is not None:
            park_total = direct
            break
    return {
        "id": "kapt-" + code.lower(),
        "label": name, "aliases": [name],
        "kapt_code": code,
        "catalog_source": "kapt",
        "households": hh, "buildings": building,
        "approved_date": date_iso(basic.get("kaptUsedate")),
        "heating": heater,
        "address": address,
        "builder": cleaned(basic.get("kaptBcompany")) or None,
        "management_phone": valid_phone(basic.get("kaptTel")),
        "parking_total": park_total, "floors": floors,
        "ev_chargers": ev_chargers,
        "floorplans": [], "area_types_m2": [], "supply_type_labels": [],
        "source_url": "https://www.k-apt.go.kr/",
        "detail_source": "국토교통부 K-apt 공동주택 기본정보 공개 API",
        "detail_note": hh_note,
        "detail_source_url": "https://www.k-apt.go.kr/",
        "last_verified": checked_at, "detail_checked_at": checked_at,
        "schools": [],
    }


def norm_name(text):
    return re.sub(r"[^A-Z0-9가-힣]", "", str(text or "").upper())


def join_curated(curated, newly):
    # Keep manually verified 13 complexes and user-supplied values unchanged.
    output = list(curated)
    codes = {p.get("kapt_code") for p in curated if p.get("kapt_code")}
    aliases = {norm_name(v) for p in curated for v in [p.get("label", ""), *p.get("aliases", [])]}
    addresses = {norm_name(p.get("address")) for p in curated if p.get("address")}
    ids = {p["id"] for p in curated}
    for obj in newly:
        if obj["kapt_code"] in codes or obj["id"] in ids or norm_name(obj["label"]) in aliases:
            continue
        if norm_name(obj.get("address")) in addresses:
            # Same address as a validated favorite => no duplicate.
            continue
        ids.add(obj["id"])
        output.append(obj)
    return output


def collect(existing, key, *, session=None, wait=0.1, max_count=MAX_SONGDO):
    listing = list_complexes(key, session=session, wait=wait)
    rows = []
    seen = set()
    failures = 0
    print("K-apt 연수구 단지목록:", len(listing))
    for info in listing:
        code = cleaned(info.get("kaptCode"))
        if code in seen:
            continue
        seen.add(code)
        # Very early filter if list row contains legal dong; don't infer from partial names.
        if info.get("bjdCode") and cleaned(info.get("bjdCode")) != SONGDO_CODE:
            continue
        try:
            basic = base_item(key, code, session=session)
            if not basic or not is_songdo(basic):
                continue
            detail = detail_item(key, code, session=session)
            p = apt_profile(basic, detail, datetime.now(KST).strftime("%Y-%m-%d"))
            if p:
                rows.append(p)
        except PublicApiError:
            failures += 1
            if failures > 5:
                raise PublicApiError("K-apt 개별 정보 요청 반복 실패. 미완성 카탈로그는 게시하지 않습니다") from None
        if len(rows) > max_count:
            raise PublicApiError("송도동 단지 수 한도 초과, 사전 확인 필요")
        time.sleep(wait)
    if not rows:
        raise PublicApiError("송도동 K-apt 기본정보 0건: 공인된 목록을 생성할 수 없습니다")
    merged = join_curated(existing, rows)
    if len(merged) > 500:
        raise PublicApiError("공개 단지정보 500개 제한 초과")
    return merged, len(rows), failures


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--key", default=os.environ.get("DATA_GO_KR_SERVICE_KEY", ""))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    with TARGET.open(encoding="utf-8") as stream:
        data = json.load(stream)
    if data.get("schema_version") != 1 or not isinstance(data.get("records"), list):
        raise PublicApiError("공개 단지 JSON 스키마가 잘못되었습니다")
    old = data["records"]
    curated = [r for r in old if r.get("catalog_source") != "kapt"]
    records, count, failures = collect(curated, args.key)
    print("송도동 K-apt 본문 확인:", count, "건, 기존 보존:", len(curated),
          "건, 게시 단지:", len(records), "건, 조회실패:", failures)
    if args.dry_run:
        return
    data["records"] = records
    data["updated_at"] = datetime.now(KST).strftime("%Y-%m-%d")
    data["state"] = "verified_partial"
    data["note"] = ("공공데이터포털 K-apt 공식 API로 송도동 공동주택 기초정보를 수집했습니다. "
                    "기존 13개 수동검증 단지는 보존. 용적률, 건폐율, 공급타입은 "
                    "해당 공공 API에서 검증하지 못했으므로 임의 기입하지 않았습니다. "
                    "등록 단지 전체가 송도 아파트의 완전한 목록이라는 뜻은 아닙니다.")
    tmp = TARGET.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(TARGET)


if __name__ == "__main__":
    try:
        main()
    except (PublicApiError, json.JSONDecodeError) as e:
        print("수집 중단: " + str(e), file=sys.stderr)
        sys.exit(2)
