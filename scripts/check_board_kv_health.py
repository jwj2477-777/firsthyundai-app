"""Read-only check: Cloudflare KV LIST availability for private office memos.

No account, token, customer memo, phone number, or KV key is read or printed.
The endpoint exposes only the availability boolean, never data.
HTTP 503 is diagnostic; deployment should still succeed so the cron fix ships.
"""
import json
import urllib.error
import urllib.request

url = "https://firsthyundai-shared-settings.jwj2477.workers.dev/health?board=1"
try:
    request = urllib.request.Request(url, headers={
        "Cache-Control": "no-store",
        "Accept": "application/json",
        "User-Agent": "FirstHyundaiBoardReadiness/1.0",
    })
    try:
        response = urllib.request.urlopen(request, timeout=15)
    except urllib.error.HTTPError as error:
        if error.code != 503:
            print("BOARD_HEALTH_UNAVAILABLE_HTTP", error.code)
            raise SystemExit(0)
        response = error
    with response:
        content = response.read(1024)
        doc = json.loads(content)
    print("BOARD_KV_LIST_AVAILABLE" if doc.get("boardListAvailable") is True
          else "BOARD_KV_LIST_UNAVAILABLE")
except (OSError, ValueError, TypeError):
    print("BOARD_HEALTH_UNAVAILABLE_NETWORK")
