#!/usr/bin/env python3
"""Safe live provider probe: synthetic example values only; never log the API key or response body."""
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = "https://calcapi.fran.kr/v1/"
EXAMPLES = {
    "acquisition": {
        "amount": 850000000, "realEstateType": "house", "how": "buy",
        "areaType": "85", "own": "one", "conArea": "N", "firstOfLife": "N", "metro": "Y",
    },
    "transfer": {
        "buyAmt": 700000000, "sellAmt": 950000000,
        "buyDate": "20200115", "sellDate": "20260628", "realEstateType": "house",
        "own": "one", "baseDeduct": "Y", "conArea": "N", "liveYear": 2,
    },
}


def probe(kind: str, api_key: str) -> bool:
    body = json.dumps(EXAMPLES[kind]).encode("utf-8")
    request = urllib.request.Request(
        ROOT + kind,
        data=body,
        method="POST",
        headers={"Authorization": "Bearer " + api_key,
                 "Content-Type": "application/json", "Accept": "application/json"},
    )
    status = None
    raw = b""
    try:
        with urllib.request.urlopen(request, timeout=18) as response:
            status = response.status
            raw = response.read(32769)
    except urllib.error.HTTPError as exc:
        status = exc.code
        raw = exc.read(32769)
    except (TimeoutError, OSError) as exc:
        print(f"::warning::{kind}: network_error ({type(exc).__name__}); no key or private data logged")
        return False
    if len(raw) > 32768:
        print(f"::warning::{kind}: HTTP {status}, response_too_large")
        return False
    try:
        parsed = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        print(f"::warning::{kind}: HTTP {status}, non_json_response")
        return False
    # Only safe enum values. Do not emit provider-provided messages, numbers,
    # API keys, URLs, identifying data, response JSON, or service headers.
    code = str(parsed.get("code", "none")) if isinstance(parsed, dict) else "invalid"
    if code not in {"none", "invalid", "unauthorized", "invalid_api_key", "rate_limited",
                    "bad_request", "invalid_request", "forbidden", "validation_error",
                    "api_key_required", "server_error"}:
        code = "other"
    success = status == 200 and isinstance(parsed, dict) and parsed.get("success") is True
    rows = parsed.get("data") if isinstance(parsed, dict) else None
    if success and isinstance(rows, list) and len(rows) > 0:
        print(f"{kind}: HTTP 200, API success, valid result rows")
        return True
    print(f"::warning::{kind}: HTTP {status}, provider_code={code}, success={success}, rows_valid={isinstance(rows, list)}")
    return False


def main() -> int:
    secret = os.getenv("CALC_API_KEY", "")
    if not secret:
        print("::warning::CALC_API_KEY is missing in GitHub Actions Secrets")
        return 2
    passed = [probe(kind, secret) for kind in EXAMPLES]
    return 0 if all(passed) else 1


if __name__ == "__main__":
    sys.exit(main())
