#!/usr/bin/env python3
"""
Export (run from anywhere):

    cd /Users/mathias/Documents/Projects/code/pc-background && python3 aw-buckets-export.py

Fetch kids gaming events from ActivityWatch via the query API and write
aw-buckets-export.json for offline/dev use in the dashboard.

Category filtering uses the same rules as the AW UI (categorize + filter on
$category). Only the 10-minute minimum is applied locally afterward.

Configure AW_SERVER, KIDS_CATEGORY, and OUTPUT_PATH below.
"""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SCRIPT_DIR = Path(__file__).resolve().parent

# ActivityWatch server (local or LAN).
AW_SERVER = "http://192.168.178.10:5600"

# Category path as configured in the ActivityWatch UI.
KIDS_CATEGORY = ["Media", "GamesKids"]

# Dashboard default data file (pre-filtered kids feed).
OUTPUT_PATH = SCRIPT_DIR / "aw-buckets-export.json"

# HTTP timeout (export query can take a few seconds).
FETCH_TIMEOUT_SECONDS = 120

# Minimum duration per event in seconds (10 minutes), matching the dashboard.
MIN_DURATION_SECONDS = 600

WINDOW_BUCKET_SUBSTRING = "aw-watcher-window"


def api_base(server: str) -> str:
    return server.rstrip("/") + "/api/0"


def fetch_json(url: str) -> Any:
    try:
        with urlopen(url, timeout=FETCH_TIMEOUT_SECONDS) as resp:  # nosec
            return json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError) as e:
        raise RuntimeError(f"Failed to fetch {url}: {e}") from e


def post_json(url: str, payload: Dict[str, Any]) -> Any:
    body = json.dumps(payload).encode("utf-8")
    req = Request(  # nosec
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(req, timeout=FETCH_TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError) as e:
        raise RuntimeError(f"Failed to post {url}: {e}") from e


def classes_for_query(api: str) -> List[List[Any]]:
    """Return [[name, rule], ...] for the query categorize() call."""
    classes = fetch_json(api + "/settings/classes")
    if not isinstance(classes, list):
        settings = fetch_json(api + "/settings")
        classes = settings.get("classes") if isinstance(settings, dict) else None
    if not isinstance(classes, list):
        raise RuntimeError("ActivityWatch settings contain no classes.")
    return [[entry["name"], entry["rule"]] for entry in classes]


def query_timeperiod(api: str) -> str:
    """Full history: earliest window-bucket creation → now (UTC)."""
    buckets = fetch_json(api + "/buckets/")
    if not isinstance(buckets, dict):
        raise RuntimeError("Unexpected buckets response from ActivityWatch.")

    created_values = [
        meta["created"]
        for bucket_id, meta in buckets.items()
        if WINDOW_BUCKET_SUBSTRING in str(bucket_id) and meta.get("created")
    ]
    if not created_values:
        raise RuntimeError("No aw-watcher-window bucket found on ActivityWatch server.")

    start = min(created_values)
    end = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    return f"{start}/{end}"


def build_kids_query(classes: List[List[Any]], category: List[str]) -> List[str]:
    """Query: window events → categorize → filter to kids category."""
    classes_json = json.dumps(classes)
    category_json = json.dumps([category])
    return [
        'events = flood(query_bucket(find_bucket("aw-watcher-window_")));',
        f"events = categorize(events, {classes_json});",
        f'events = filter_keyvals(events, "$category", {category_json});',
        "RETURN = events;",
    ]


def fetch_kids_events(api: str, category: List[str]) -> List[Dict[str, Any]]:
    classes = classes_for_query(api)
    query = build_kids_query(classes, category)
    timeperiod = query_timeperiod(api)
    result = post_json(
        api + "/query/",
        {"query": query, "timeperiods": [timeperiod]},
    )
    if not isinstance(result, list) or not result:
        return []
    events = result[0]
    if not isinstance(events, list):
        raise RuntimeError("Unexpected query result from ActivityWatch.")
    return events


def normalise_event(ev: Dict[str, Any]) -> Dict[str, Any]:
    data_in = ev.get("data") or {}
    return {
        "timestamp": ev["timestamp"],
        "duration": round(float(ev.get("duration", 0) or 0)),
        "data": {
            "app": str(data_in.get("app", "") or "Unbekannt").strip(),
            "title": str(data_in.get("title", "") or "").strip(),
        },
    }


def build_export(events: List[Dict[str, Any]], source: str) -> Dict[str, Any]:
    filtered = [
        normalise_event(ev)
        for ev in events
        if ev
        and ev.get("timestamp")
        and float(ev.get("duration", 0) or 0) >= MIN_DURATION_SECONDS
    ]
    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()

    return {
        "meta": {
            "generatedAt": generated_at.replace("+00:00", "Z"),
            "timezone": dt.datetime.now().astimezone().tzname() or "local",
            "source": source,
            "category": KIDS_CATEGORY,
            "eventCount": len(filtered),
        },
        "events": filtered,
    }


def write_if_changed(path: Path, content: str) -> bool:
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


def main() -> None:
    api = api_base(AW_SERVER)
    category_label = " > ".join(KIDS_CATEGORY)
    print(f"Querying {AW_SERVER} for category {category_label} ...")

    events = fetch_kids_events(api, KIDS_CATEGORY)
    print(f"Kids category events from query: {len(events)}")

    export_doc = build_export(events, AW_SERVER)
    content = json.dumps(export_doc, ensure_ascii=False, indent=2)

    written = write_if_changed(OUTPUT_PATH, content)
    kids_count = export_doc["meta"]["eventCount"]
    generated_at = export_doc["meta"]["generatedAt"]

    if written:
        size_kb = OUTPUT_PATH.stat().st_size / 1024
        print(
            f"Wrote {OUTPUT_PATH.name}: {kids_count} kids events, "
            f"{size_kb:.1f} KiB (generatedAt={generated_at})"
        )
    else:
        print(
            f"No changes: {OUTPUT_PATH.name} already up to date "
            f"({kids_count} kids events, generatedAt={generated_at})"
        )


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as err:
        print(err, file=sys.stderr)
        sys.exit(1)
