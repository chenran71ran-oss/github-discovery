"""GitHub Trending pages: the main ranking and each language's own ranking."""
import re
from urllib.parse import quote

from bs4 import BeautifulSoup

from collector.blocks.http import create_http_session, number, parse_trending_html
from collector.blocks.rows import new_row


def parse_rows(text: str):
    # Upstream defaults to ten; preserve every member of the original list.
    rows = parse_trending_html(text, limit=1000)
    counters = {}
    for article in BeautifulSoup(text, "html.parser").select("article.Box-row"):
        link = article.select_one("h2 a[href]")
        growth = re.search(r"([\d,.kmKM]+)\s+stars?\s+(?:today|this week|this month)", article.get_text(" ", strip=True))
        if link: counters[link["href"].strip("/")] = number(growth[1]) if growth else None
    return [new_row(r["title"], r["description"], r["language"], number(r["stars"]), number(r["forks"]), "trending", periodStars=counters.get(r["title"])) for r in rows]


def fetch_trending(period: str, language: str = ""):
    path = "https://github.com/trending" + (f"/{quote(language, safe='')}" if language else "")
    session = create_http_session()
    try:
        response = session.get(path, params={"since": period}, timeout=(10, 30))
        response.raise_for_status()
        return parse_rows(response.text)
    finally: session.close()
