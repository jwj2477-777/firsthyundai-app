#!/usr/bin/env python3
"""Append-only, source-validated K-apt monthly history for apartment fee trends.

Data contract stays compatible with the original maintenance_estimates.json.
The legacy top-level month/rate remain the latest month, while monthly_history
preserves months necessary for a 12-month rolling/seasonal view.
"""
from __future__ import annotations
import re

MIN_RATE, MAX_RATE = 300, 20000


def valid_month(value):
    return isinstance(value, str) and re.fullmatch(r"20\d{2}(0[1-9]|1[0-2])", value) is not None


def valid_month_row(record):
    if not isinstance(record, dict):
        return False
    if not valid_month(record.get("month")):
        return False
    rate = record.get("won_per_exclusive_m2")
    total = record.get("monthly_total_won")
    if type(rate) is not int or not MIN_RATE <= rate <= MAX_RATE:
        return False
    if type(total) is not int or not 100000 <= total <= 200000000000:
        return False
    source = record.get("source_url")
    if not isinstance(source, str) or not source.startswith("https://"):
        return False
    components = record.get("components_won")
    if components is not None:
        if (not isinstance(components, dict) or
                set(components) != {"common", "individual", "reserve"} or
                any(type(x) is not int or x < 0 for x in components.values()) or
                sum(components.values()) != total):
            return False
    return True


def merge_record(old, new=None, history_limit=24):
    """Retain only months with matching K-apt identity and validated money.

    A failed/partial newer read never deletes verified historical months.
    Values for the same month can be corrected by a verified newer API read.
    """
    if not isinstance(old, dict):
        old = {}
    if new is not None and (not valid_month_row(new) or (
            old.get("kapt_code") and old["kapt_code"] != new.get("kapt_code"))):
        raise ValueError("unverified K-apt fee update")
    base = new if new is not None else old
    if not valid_month_row(base):
        return old
    code = base.get("kapt_code")
    ident = base.get("complex_id")
    if not isinstance(code, str) or not re.fullmatch(r"A\d{8}", code) or not ident:
        return old
    months = {}
    for row in [*(old.get("monthly_history") or []), old, new]:
        if not valid_month_row(row):
            continue
        if row.get("kapt_code", code) != code or row.get("complex_id", ident) != ident:
            continue
        months[row["month"]] = {
            k: row[k] for k in (
                "month", "won_per_exclusive_m2", "monthly_total_won",
                "source_url", "method", "basis", "components_won"
            ) if k in row
        }
    if not months:
        return old
    order = sorted(months, reverse=True)[:history_limit]
    latest = months[order[0]]
    return {
        **old,
        **{k: v for k, v in (new or {}).items() if k not in (
            "month", "won_per_exclusive_m2", "monthly_total_won",
            "source_url", "method", "basis", "components_won", "monthly_history")},
        **latest,
        "complex_id": ident,
        "kapt_code": code,
        "monthly_history": [months[month] for month in order],
    }


def merge_records(prior_records, verified_rows, history_limit=24):
    prior = {row["complex_id"]: row for row in prior_records
             if isinstance(row, dict) and row.get("complex_id")}
    for row in verified_rows:
        ident = row["complex_id"]
        if ident in prior:
            prior[ident] = merge_record(prior[ident], row, history_limit)
        else:
            prior[ident] = merge_record(row, row, history_limit)
    return sorted(prior.values(), key=lambda row: row["complex_id"])
