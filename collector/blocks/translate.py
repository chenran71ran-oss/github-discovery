"""Labelled machine translation of a project's own English description (MyMemory free API)."""
import hashlib
import html
import logging

from collector.blocks.http import create_http_session
from collector.core.taxonomy import chinese

log = logging.getLogger("collector.translate")


def trim_bytes(text: str, limit: int = 480) -> str:
    text = " ".join(text.split())
    while len(text.encode()) > limit: text = text[:-1]
    return text


def digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def machine_translate(text: str, session, email: str = ""):
    """English description -> Simplified Chinese. None when it can't."""
    params = {"q": trim_bytes(text), "langpair": "en|zh-CN"}
    if email: params["de"] = email
    response = session.get("https://api.mymemory.translated.net/get", params=params, timeout=15)
    response.raise_for_status()
    doc = response.json()
    out = html.unescape(str((doc.get("responseData") or {}).get("translatedText") or "")).strip()
    # Quota and error notices come back as 'translations' too; only accept real Chinese text.
    if str(doc.get("responseStatus")) != "200" or "MYMEMORY" in out.upper() or not chinese(out): return None
    return out[:600]


def translate_missing(descriptions: dict[str, str], cache: dict, now: str, email: str = "", translate=None, session_factory=None):
    """Fill the cache for descriptions that have no Chinese yet. Cached by description hash,
    so each description is translated once. Stops at the daily budget or on the first outage."""
    translate = translate or machine_translate
    budget = 45000 if email else 4500
    todo = [n for n, d in descriptions.items() if cache.get(n, {}).get("hash") != digest(d)]
    if not todo: return 0
    try: session = (session_factory or create_http_session)()
    except Exception: return 0
    done = 0
    try:
        for name in todo:
            text = trim_bytes(descriptions[name])
            if len(text) > budget: break
            budget -= len(text)
            try: value = translate(text, session, email)
            except Exception:
                log.warning("machine translation unavailable; leaving the rest pending")
                break
            if value:
                cache[name] = {"hash": digest(descriptions[name]), "summary": value, "at": now}
                done += 1
    finally: session.close()
    return done
