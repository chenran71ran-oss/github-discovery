"""README head, used as an extra (weaker) classification signal. Never published."""
import concurrent.futures
import re

from collector.blocks.http import create_http_session
from collector.core.settings import README_BYTES


def clean(markdown: str) -> str:
    text = re.sub(r"```.*?```", " ", markdown, flags=re.S)  # code blocks mention every tool under the sun
    text = re.sub(r"<[^>]+>|!\[[^\]]*\]\([^)]*\)|\]\([^)]*\)|https?://\S+", " ", text)
    text = re.sub(r"[#>*_`|\[\]]", " ", text)
    return " ".join(text.split()).lower()[:README_BYTES]


def fetch_readme(name: str) -> str | None:
    with create_http_session() as session:
        for filename in ("README.md", "readme.md", "README.rst", "README"):
            try:
                response = session.get(f"https://raw.githubusercontent.com/{name}/HEAD/{filename}", timeout=15)
            except Exception: continue
            if response.ok and response.text.strip(): return clean(response.text[:40000])
    return None


def fetch_readmes(names, workers: int = 8) -> dict[str, str]:
    out = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_readme, n): n for n in names}
        for future in concurrent.futures.as_completed(futures):
            try: value = future.result()
            except Exception: value = None
            if value: out[futures[future]] = value
    return out
