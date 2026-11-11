"""Facts that need more than one day of data: star growth for every row, and the first day a repo was listed.

Trending gives a period's new stars only for its own rows; rows found by search have none. Comparing a
repo's total stars with an earlier published snapshot gives every row a growth number. All functions are
pure: the caller loads the snapshots and the first-seen index.
"""
from datetime import date, timedelta

WINDOW = {"daily": 1, "weekly": 7, "monthly": 30}


def stars_by_repo(snapshot: dict) -> dict[str, int]:
    """Total stars per repo across every period of a snapshot."""
    out: dict[str, int] = {}
    for rows in (snapshot.get("periods") or {}).values():
        for r in rows or []:
            if isinstance(r.get("stars"), int): out[r["fullName"]] = r["stars"]
    return out


def pick_past(today: date, period: str, available: list[str]) -> tuple[str, int] | None:
    """The snapshot to compare with: exactly the period's window back if published, otherwise the oldest
    one inside the window (at least a day back). Returns (date, days back)."""
    window = WINDOW[period]
    exact = (today - timedelta(days=window)).isoformat()
    if exact in available: return exact, window
    inside = sorted(d for d in available if (today - timedelta(days=window)).isoformat() < d < today.isoformat())
    if not inside: return None
    return inside[0], (today - date.fromisoformat(inside[0])).days


def add_star_deltas(periods: dict, past_stars: dict[str, dict[str, int]], picks: dict[str, tuple[str, int] | None]):
    """Set starDelta / starDeltaDays on every row whose repo appears in the chosen earlier snapshot."""
    for period, rows in periods.items():
        pick = picks.get(period)
        stars = past_stars.get(pick[0], {}) if pick else {}
        for r in rows:
            before = stars.get(r["fullName"])
            if before is None:
                r.pop("starDelta", None)
                r.pop("starDeltaDays", None)
                continue
            r["starDelta"] = r["stars"] - before
            r["starDeltaDays"] = pick[1]


def update_first_seen(index: dict[str, str], periods: dict, today: str) -> dict[str, str]:
    """Record today for repos never listed before, and stamp firstSeen on every row."""
    for rows in periods.values():
        for r in rows:
            seen = index.setdefault(r["fullName"], today)
            r["firstSeen"] = seen
    return index


def build_first_seen(snapshots: dict[str, dict]) -> dict[str, str]:
    """Rebuild the index from published history (used once, when the index file does not exist yet)."""
    index: dict[str, str] = {}
    for day in sorted(snapshots):
        for name in stars_by_repo(snapshots[day]): index.setdefault(name, day)
    return index
