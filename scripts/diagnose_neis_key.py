#!/usr/bin/env python3
"""Run a privacy-safe NEIS credential diagnosis inside GitHub Actions.

NEVER print secret material, URLs, raw HTTP bodies or request exceptions:
they may contain the KEY query string.
"""
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

URL = "https://open.neis.go.kr/hub/schoolInfo"
# Force a NEW workflow queue event so the current NEIS_EDU_KEY secret is reloaded.
PARAMS = {"Type": "json", "pIndex": 1, "pSize": 5, "ATPT_OFCDC_SC_CODE": "E10"}
VALID = {"INFO-000", "INFO-100", "INFO-200"}
KEY_ERROR = {"ERROR-290", "INFO-300"}
THROTTLE = {"ERROR-337"}


def decode_code(raw):
    """Return public NEIS status code only; redact all other content."""
    data = None
    try:
        data = json.loads(raw.decode("utf-8-sig"))
    except (ValueError, UnicodeError, AttributeError):
        pass
    if isinstance(data, dict):
        root = data.get("RESULT")
        if isinstance(root, dict) and isinstance(root.get("CODE"), str):
            return root["CODE"].strip().upper()
        for value in data.values():
            if isinstance(value, list) and value:
                for h in value[0].get("head", []) if isinstance(value[0], dict) else []:
                    if isinstance(h, dict):
                        result = h.get("RESULT")
                        if isinstance(result, dict) and isinstance(result.get("CODE"), str):
                            return result["CODE"].strip().upper()
    # XML response or HTML with documented error-code formats.
    try:
        text = raw.decode("utf-8-sig", "ignore")[:8192]
    except AttributeError:
        return ""
    m = re.search(r"<CODE>\s*((?:ERROR|INFO)-\d{3})\s*</CODE>", text, flags=re.I)
    return m.group(1).upper() if m else ""


def check_format(secret):
    issues = []
    if not secret:
        return ["비밀키가 등록되지 않았거나 빈 값입니다."]
    if secret != secret.strip():
        issues.append("키 앞뒤에 공백 또는 줄바꿈이 포함되어 있습니다.")
    if any(c.isspace() for c in secret.strip()):
        issues.append("키 중간에 공백 또는 줄바꿈이 포함되어 있습니다.")
    if secret.strip().lower().startswith(("http://", "https://", "key=", "servicekey=", "bearer ")):
        issues.append("인증키 값 대신 URL 또는 KEY=/serviceKey= 등의 문자열을 붙여 넣은 것으로 보입니다.")
    if secret.strip()[:1] in "\"'" or secret.strip()[-1:] in "\"'":
        issues.append("인증키 양쪽에 불필요한 따옴표가 있을 수 있습니다.")
    if '%' in secret:
        issues.append("URL 인코딩된 문자열일 수 있습니다. 나이스 원본 인증키인지 확인하세요.")
    if len(secret.strip()) < 8:
        issues.append("인증키 길이가 비정상적으로 짧습니다.")
    if len(secret.strip()) > 256:
        issues.append("인증키 길이가 비정상적으로 깁니다.")
    if any(ord(c) > 127 for c in secret.strip()):
        issues.append("인증키에 비ASCII 문자가 포함되어 있습니다.")
    return issues


def probe(key=None, *, typ="json", opener=urlopen, endpoint=URL, params=None):
    args = dict(PARAMS if params is None else params, Type=typ)
    if key is not None:
        args["KEY"] = key
    req = Request(endpoint + "?" + urlencode(args), headers={
        "User-Agent": "FirstHyundai-NEIS-Diagnostic/1.0",
        "Accept": "application/json, application/xml",
    })
    try:
        response = opener(req, timeout=18)
        try:
            data = response.read(8192)
            status = getattr(response, "status", 200)
        finally:
            response.close()
        code = decode_code(data)
        return {"http": status, "code": code, "kind": "ok" if code in VALID else
                ("key_invalid" if code in KEY_ERROR else
                 ("rate_limit" if code in THROTTLE else
                  ("server" if code in ("ERROR-500", "ERROR-600", "ERROR-601") else "other")))}
    except HTTPError as error:
        code = ""
        try:
            code = decode_code(error.read(8192))
        except (OSError, ValueError):
            pass
        return {"http": error.code, "code": code, "kind":
                "key_invalid" if code in KEY_ERROR else
                ("server" if error.code >= 500 else "http_error")}
    except (URLError, TimeoutError, OSError):
        return {"http": None, "code": "", "kind": "network_error"}


def public(result):
    code = result["code"]
    http = result["http"]
    suffix = " / NEIS " + code if code else ""
    return "HTTP " + (str(http) if http is not None else "접속실패") + suffix


def run(secret, opener=urlopen):
    # Do not print length, prefixes, suffixes or fingerprint of the key.
    print("나이스 인증키 안전 진단 (키 원문 및 전체 요청 URL 비공개)")
    problems = check_format(secret)
    if problems:
        print("키 입력 형식 확인: " + " ".join(problems))
    else:
        print("키 입력 형식 확인: 눈에 띄는 공백·URL·따옴표·길이 문제 없음 (정상 인증을 보장하지는 않음)")
    if not secret.strip():
        print("결론: GitHub Secret NEIS_EDU_KEY가 비어 있습니다.")
        return "missing"

    # Same endpoint and public query settings, differing only in credential.
    # An intentionally invalid control distinguishes an API auth response
    # from a generic upstream 500.
    cases = [
        ("키 없는 공개 조회", None),
        ("일부러 잘못된 키", "firsthyundai-invalid-diagnostic-20261021"),
        ("저장된 나이스 키", secret.strip()),
    ]
    results = {}
    for label, key in cases:
        response = probe(key, opener=opener)
        results[label] = response
        print(label + ": " + public(response))

    real = results["저장된 나이스 키"]
    baseline = results["키 없는 공개 조회"]
    bad = results["일부러 잘못된 키"]
    if real["kind"] == "ok":
        print("결론: 등록된 키로 나이스 학교정보 API 응답 인증에 성공했습니다.")
        return "valid"
    if real["kind"] == "key_invalid":
        print("결론: 나이스에서 키 유효성 오류를 반환했습니다. NEIS_EDU_KEY를 다시 확인해야 합니다.")
        return "invalid"
    if real["kind"] == "rate_limit":
        print("결론: API 이용량 제한을 확인하세요. 키가 틀렸다고 판단할 수 없습니다.")
        return "limited"
    if any(x["kind"] == "ok" for x in (baseline, bad)):
        print("진단: 공개 조회가 동작하지만 등록된 키의 요청은 실패했습니다.")
        print("결론: 인증키 값·권한·요청 제한을 우선 점검해야 합니다. 원인 확정은 제공기관 오류코드가 필요합니다.")
        return "suspect"
    # Distinguish a schoolInfo gateway error from a service-wide credential failure.
    # Never print query URLs, secret data or returned school records.
    xml = probe(secret.strip(), typ="xml", opener=opener)
    print("저장된 키 · 학교정보 XML 호출: " + public(xml))
    if xml["kind"] == "ok":
        print("결론: 등록된 키로 나이스 학교정보(XML) 인증에 성공했습니다.")
        return "valid"
    if xml["kind"] == "key_invalid":
        print("결론: 나이스에서 등록된 키를 거부했습니다(XML). 비밀키를 대조하세요.")
        return "invalid"
    other_endpoint = "https://open.neis.go.kr/hub/SchoolSchedule"
    other_params = {"pIndex": 1, "pSize": 5, "ATPT_OFCDC_SC_CODE": "T10", "SD_SCHUL_CODE": "9296071"}
    other = probe(secret.strip(), typ="json", opener=opener, endpoint=other_endpoint, params=other_params)
    print("저장된 키 · 다른 나이스 서비스(학사일정): " + public(other))
    if other["kind"] == "ok":
        print("결론: 등록된 키가 다른 나이스 서비스에서 정상 동작합니다. 학교정보 API 오류 가능성이 높습니다.")
        return "valid"
    if other["kind"] == "key_invalid":
        print("결론: 다른 나이스 서비스에서 키 인증 오류가 확인됐습니다. 입력한 키를 대조하세요.")
        return "invalid"
    if all(x["http"] == 500 for x in (baseline, bad, real, xml, other)):
        print("결론: 정상 키·잘못된 키·무키·XML·별도 나이스 서비스가 모두 HTTP 500입니다.")
        print("API 서버 또는 GitHub에서 나이스로 가는 통신망이 공통으로 오류를 반환해 키의 실제 유효성을 판정할 수 없습니다.")
        return "indeterminate"
    print("결론: 여러 API 방식에서도 인증키 오입력 여부가 구별되지 않았습니다. NEIS 포털 발급키와 GitHub Secret을 직접 대조해야 합니다.")
    return "indeterminate"


if __name__ == "__main__":
    # Exiting with zero means "diagnostic completed", not "key valid".
    # The verdict is only the categorized text above.
    try:
        run(os.environ.get("NEIS_EDU_KEY", ""))
    except Exception:
        # Avoid printing exceptions or tracebacks which could include the key in a URL.
        print("진단 예외: 제공 API 응답을 분석하지 못했습니다. 인증키는 표시하지 않습니다.")
        sys.exit(1)
