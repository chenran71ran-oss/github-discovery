"""HTTP session and number helpers shared by the fetchers."""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "vendor"))
from github_trending.app import create_http_session, parse_trending_html  # noqa: E402

__all__ = ["create_http_session", "parse_trending_html", "number", "github_headers"]


def number(s) -> int:
    s = str(s).replace(",", "").strip().lower()
    m = re.fullmatch(r"([\d.]+)([km]?)", s)
    return int(float(m[1]) * {"": 1, "k": 1000, "m": 1000000}[m[2]]) if m else 0


def github_headers(token: str = "") -> dict:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if token: headers["Authorization"] = f"Bearer {token}"
    return headers
