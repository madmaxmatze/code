#!/usr/bin/env python3
"""
Export (run from anywhere):

    cd /Users/mathias/Documents/Projects/code/pc-background && python3 aw-buckets-export.py

Fetch ActivityWatch data and write aw-buckets-export.json for the dashboard.

Fetches the full AW export API, keeps only aw-watcher-window events that match the
kids-game title pattern (same rules as index.html), and writes aw-buckets-export.json
in slim {meta, events} form.

Configure INPUT_SOURCE and OUTPUT_PATH below.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Union
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

SCRIPT_DIR = Path(__file__).resolve().parent

# ActivityWatch export API (local or LAN).
INPUT_SOURCE = "http://192.168.178.10:5600/api/0/export"

# Dashboard default data file (optimized kids-only feed).
OUTPUT_PATH = SCRIPT_DIR / "aw-buckets-export.json"

# HTTP timeout for the full export (can be large).
FETCH_TIMEOUT_SECONDS = 120

# Minimum duration per event in seconds (10 minutes), matching the dashboard.
MIN_DURATION_SECONDS = 600

# Keep in sync with CONFIG.kidsPattern in index.html.
KIDS_PATTERN = re.compile(
    r"minecraft|takes|crashers|planet|fifa|cat|lego|goat|sackboy|fiction|sonic|"
    r"overcooked|brawlstars|brothers|gigabash|nba|rocket|fortnite|hypercharge|"
    r"nucleus|wreckfest",
    re.IGNORECASE,
)

WINDOW_BUCKET_SUBSTRING = "aw-watcher-window"


def load_json(source: Union[Path, str]) -> Any:
    """Load JSON from a local file or HTTP(S) URL."""
    if isinstance(source, str) and source.startswith(("http://", "https://")):
        try:
            with urlopen(source, timeout=FETCH_TIMEOUT_SECONDS) as resp:  # nosec
                text = resp.read().decode("utf-8")
        except (HTTPError, URLError) as e:
            raise RuntimeError(f"Failed to fetch JSON from {source}: {e}") from e
    else:
        text = Path(source).read_text(encoding="utf-8")

    return json.loads(text)


def extract_window_events(raw: Any) -> List[Dict[str, Any]]:
    """Return window-watcher events only (ignore AFK etc.)."""
    if not raw:
        return []

    if isinstance(raw, dict) and isinstance(raw.get("buckets"), dict):
        events: List[Dict[str, Any]] = []
        for bucket_id, bucket in raw["buckets"].items():
            if WINDOW_BUCKET_SUBSTRING not in str(bucket_id):
                continue
            evs = bucket.get("events")
            if isinstance(evs, list):
                events.extend(evs)
        return events

    if isinstance(raw, dict) and isinstance(raw.get("events"), list):
        return list(raw["events"])

    if isinstance(raw, list):
        if raw and isinstance(raw[0], dict) and isinstance(raw[0].get("events"), list):
            events = []
            for bucket in raw:
                bucket_id = bucket.get("id", "")
                if WINDOW_BUCKET_SUBSTRING not in str(bucket_id):
                    continue
                evs = bucket.get("events")
                if isinstance(evs, list):
                    events.extend(evs)
            return events
        return list(raw)

    return []


def is_kids_event(ev: Dict[str, Any]) -> bool:
    """Return True if the event should be included in the kids feed."""
    if not ev or "timestamp" not in ev:
        return False

    try:
        duration = float(ev.get("duration", 0))
    except (TypeError, ValueError):
        return False

    if duration < MIN_DURATION_SECONDS:
        return False

    data = ev.get("data") or {}
    title = str(data.get("title", "")).strip()
    if not title:
        return False

    return bool(KIDS_PATTERN.search(title))


def normalise_event(ev: Dict[str, Any]) -> Dict[str, Any]:
    """Slim event object with only the fields the dashboard needs."""
    data_in = ev.get("data") or {}
    return {
        "timestamp": ev["timestamp"],
        "duration": round(float(ev.get("duration", 0) or 0)),
        "data": {
            "app": str(data_in.get("app", "") or "Unbekannt").strip(),
            "title": str(data_in.get("title", "") or "").strip(),
        },
    }


def build_export(events: Iterable[Dict[str, Any]], source: str) -> Dict[str, Any]:
    """Build the optimized JSON document with meta + filtered events."""
    filtered = [normalise_event(ev) for ev in events if is_kids_event(ev)]
    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()

    return {
        "meta": {
            "generatedAt": generated_at.replace("+00:00", "Z"),
            "timezone": dt.datetime.now().astimezone().tzname() or "local",
            "source": source,
            "eventCount": len(filtered),
        },
        "events": filtered,
    }


def write_if_changed(path: Path, content: str) -> bool:
    """Write file only when content changed. Returns True if written."""
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


def main() -> None:
    print(f"Fetching {INPUT_SOURCE} ...")
    raw = load_json(INPUT_SOURCE)
    window_events = extract_window_events(raw)
    print(f"Window events in export: {len(window_events)}")

    export_doc = build_export(window_events, str(INPUT_SOURCE))
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
