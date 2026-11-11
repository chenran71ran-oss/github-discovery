"""Reads and atomically writes the published JSON files and caches."""
import json
from pathlib import Path


def read_json(path: Path, fallback):
    try: return json.loads(path.read_text())
    except (OSError, ValueError): return fallback


def atomic_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)


FIRST_SEEN = "first-seen.json"
CACHES = {"analysis": "analysis-cache.json", "translations": "translation-cache.json", "features": "feature-cache.json"}


def load_caches(data: Path, editorial_file: Path) -> dict:
    caches = {k: read_json(data / f, {}) for k, f in CACHES.items()}
    caches["editorial"] = read_json(editorial_file, {})
    return caches


def publish(data: Path, snapshot: dict, caches: dict, keep_dates: int = 90):
    atomic_json(data / "latest.json", snapshot)
    atomic_json(data / "history" / f"{snapshot['date']}.json", snapshot)
    for key, filename in CACHES.items(): atomic_json(data / filename, caches[key])
    dates = sorted((p.stem for p in (data / "history").glob("????-??-??.json")), reverse=True)
    atomic_json(data / "dates.json", dates[:keep_dates])
