"""GitHub search streams: recently created repositories gaining stars fast, overall and per category."""
import logging
import re
import time
from datetime import timedelta

from collector.blocks.http import create_http_session, github_headers
from collector.blocks.rows import new_row
from collector.core import settings
from collector.core.taxonomy import load

FULL_NAME = re.compile(r"^[\w.-]+/[\w.-]+$")
log = logging.getLogger("collector.search")


def search_row(item: dict, stream: str = "general"):
    name = str(item.get("full_name") or "")
    if not FULL_NAME.fullmatch(name) or item.get("fork") or item.get("archived"): return None
    description = " ".join(str(item.get("description") or "").split())[:400]
    topics = [t for t in item.get("topics") or [] if isinstance(t, str)]
    return new_row(name, description, item.get("language") or "", int(item.get("stargazers_count") or 0), int(item.get("forks_count") or 0), "search", topics=topics, stream=stream, createdAt=item.get("created_at"))


def search_queries(period: str, today, authenticated: bool):
    """(query, page size, stream name). Unauthenticated search allows 10 requests a minute: general only."""
    days, stars = settings.SEARCH_WINDOWS[period]
    queries = [(f"created:>={(today - timedelta(days=days)).isoformat()} stars:>={stars} archived:false", settings.SEARCH_GENERAL, "general")]
    if authenticated:
        days, stars = settings.TOPIC_WINDOWS[period]
        since = (today - timedelta(days=days)).isoformat()
        queries += [(f"topic:{t} created:>={since} stars:>={stars} archived:false", settings.TOPIC_PER_STREAM, f"topic:{t}") for c in load().categories for t in c.stream_topics]
    return queries


def fetch_search(period: str, today, token: str = "", pause: float | None = None):
    rows = []
    session = create_http_session()
    try:
        for i, (query, size, stream) in enumerate(search_queries(period, today, bool(token))):
            if i: time.sleep(settings.SEARCH_PAUSE if pause is None else pause)
            try:
                response = session.get("https://api.github.com/search/repositories", params={"q": query, "sort": "stars", "order": "desc", "per_page": size}, headers=github_headers(token), timeout=(10, 30))
                response.raise_for_status()
                rows += [r for r in (search_row(item, stream) for item in response.json().get("items") or []) if r]
            except Exception as error:
                log.warning("search failed period=%s stream=%s error=%s; skipped", period, stream, error)
    finally: session.close()
    return rows
