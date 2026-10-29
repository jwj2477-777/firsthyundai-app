"""Per-collector Gemini circuit breaker; never changes billing or providers.

The process exits after each scheduled collection. A quota/auth/model rejection
stops further Gemini requests in that run; the next scheduled run can try again.
Only counts and fixed error labels are retained, never keys or response bodies.
"""
import os

GEMINI_BLOCKED = "FIRSTHYUNDAI_GEMINI_BLOCKED"
GEMINI_HTTP_REQUESTS = 0


def blocked():
    return bool(os.environ.get(GEMINI_BLOCKED))


def record_request():
    global GEMINI_HTTP_REQUESTS
    GEMINI_HTTP_REQUESTS += 1


def reject(status):
    if status in (401, 402, 403, 404, 429):
        os.environ[GEMINI_BLOCKED] = "quota" if status == 429 else "unavailable"
        return True
    return False
