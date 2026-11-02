"""Repository metadata (topics) for rows that came from Trending pages, which show no topics."""
import concurrent.futures
import logging

from collector.blocks.http import create_http_session, github_headers

log = logging.getLogger("collector.meta")


def fetch_topics(names, token: str, workers: int = 6) -> dict[str, list[str]]:
    """name -> topics. Needs a token: the anonymous REST quota (60 an hour) is too small to be useful."""
    if not token or not names: return {}
    def one(name):
        with create_http_session() as session:
            response = session.get(f"https://api.github.com/repos/{name}", headers=github_headers(token), timeout=(10, 20))
            response.raise_for_status()
            return [t for t in response.json().get("topics") or [] if isinstance(t, str)]
    out = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(one, n): n for n in names}
        for future in concurrent.futures.as_completed(futures):
            try: out[futures[future]] = future.result()
            except Exception as error: log.debug("topics failed %s: %s", futures[future], error)
    return out
