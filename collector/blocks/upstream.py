"""Chinese summaries published by the GithubTrending project, accepted only when fresh."""
from datetime import datetime, timedelta

from collector.blocks.http import create_http_session
from collector.core.settings import TZ
from collector.core.taxonomy import chinese

URL = "https://ibook000.github.io/GithubTrending/data/latest.json"


def fetch_upstream(max_age_days: int = 7) -> dict:
    with create_http_session() as session:
        response = session.get(URL, timeout=20)
    response.raise_for_status()
    doc = response.json()
    age = datetime.now(TZ) - datetime.fromisoformat(doc["generated_at"])
    if not timedelta(0) <= age <= timedelta(days=max_age_days): return {}
    out = {}
    for rows in doc.get("periods", {}).values():
        for r in rows:
            summary = r.get("summary", "")
            # Imported translations only; reject the known generic fallback templates.
            if chinese(summary) and not summary.startswith(("一个聚焦", "一个使用")):
                out[r["title"]] = {"summary": summary[:600], "at": doc["generated_at"]}
    return out
