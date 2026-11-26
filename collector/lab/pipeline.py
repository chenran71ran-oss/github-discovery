"""The collection pipeline: sources -> merged rankings -> features -> Chinese text -> classification.
Every external call goes through `Sources`, so tests and experiments can swap any block."""
import concurrent.futures
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable

from collector.blocks import llm, meta, models, polish, readme, search, trending, translate, upstream
from collector.blocks.classify import signals
from collector.blocks.classify.engine import Evidence, Strategy, classify
from collector.core import settings
from collector.core.settings import NO_DESCRIPTION, PERIODS, TZ
from collector.core.taxonomy import chinese, load
from collector.lab import strategies

log = logging.getLogger("collector.pipeline")


@dataclass
class Sources:
    trending: Callable = trending.fetch_trending  # (period, language="") -> rows
    search: Callable | None = None  # (period) -> rows; built from the token when None
    topics: Callable = meta.fetch_topics  # (names, token) -> {name: topics}
    readmes: Callable = readme.fetch_readmes  # (names) -> {name: cleaned text}
    upstream: Callable = upstream.fetch_upstream  # () -> {name: {summary, at}}
    translate: Callable = translate.machine_translate
    session: Callable | None = None  # HTTP session factory for translation
    models: Callable = models.enrich  # GitHub Models: batch Chinese descriptions + category suggestions
    models_session: Callable | None = None  # HTTP session factory for GitHub Models (tests)


@dataclass
class Options:
    token: str = ""
    llm: tuple[str, str, str] = ("", "", "")
    translation: bool = True
    mymemory_email: str = ""
    readme: bool = True
    # GitHub Models: (token, model, max requests per run); empty token turns it off
    models: tuple[str, str, int] = ("", models.DEFAULT_MODEL, models.MAX_REQUESTS)
    strategy: Strategy = field(default_factory=strategies.get)
    today: object = None


# ---------- rankings ----------
def merge_period(period: str, src: Sources, opt: Options):
    rows = src.trending(period)
    # An empty main page means the layout changed; refuse rather than publish only extras.
    if not rows: raise ValueError("Incomplete ranking")
    seen = {r["fullName"] for r in rows}
    picks, found = [], []
    for language in settings.LANGUAGE_POOLS:
        try: pool = src.trending(period, language)
        except Exception:
            log.warning("language pool %s/%s failed; skipped", language, period)
            continue
        for r in [r for r in pool if r["fullName"] not in seen][: settings.POOL_SIZE]:
            seen.add(r["fullName"])
            picks.append({**r, "origin": "language"})
    try: results = src.search(period) if src.search else search.fetch_search(period, opt.today or datetime.now(TZ).date(), opt.token)
    except Exception as error:
        log.warning("search for %s failed: %s; skipped", period, error)
        results = []
    for r in results:
        if r["fullName"] in seen: continue
        seen.add(r["fullName"])
        found.append(r)
    # Main ranking keeps its order; then language picks by growth; then search finds by stars.
    picks.sort(key=lambda r: -(r["periodStars"] or 0))
    found.sort(key=lambda r: -r["stars"])
    rows = rows + picks + found
    if len(rows) < 5: raise ValueError("Incomplete ranking")
    for i, r in enumerate(rows): r["rank"] = i + 1
    return rows


# ---------- features ----------
def fresh(stamp: str | None, days: int, now: datetime) -> bool:
    try: return bool(stamp) and now - datetime.fromisoformat(stamp) < timedelta(days=days)
    except ValueError: return False


def gather_features(unique: dict, cache: dict, src: Sources, opt: Options, now: datetime):
    """Topics and README digests per repository, cached in feature-cache.json."""
    tax = load()
    stamp = now.isoformat()
    for name, r in unique.items():
        entry = cache.setdefault(name, {})
        entry["seen"] = stamp[:10]
        if r.get("topics"): entry.update(topics=r["topics"][:20], topicsAt=stamp)
    need_topics = [n for n in unique if not fresh(cache[n].get("topicsAt"), settings.META_TTL_DAYS, now)]
    for name, value in src.topics(need_topics, opt.token).items():
        cache[name].update(topics=value[:20], topicsAt=stamp)
    if opt.readme:
        need = [n for n in unique if (cache[n].get("readme") or {}).get("v") != tax.version or not fresh(cache[n].get("readmeAt"), settings.README_TTL_DAYS, now)]
        texts = src.readmes(need) if need else {}
        for name in need:
            if name in texts: cache[name].update(readme=signals.readme_features(tax, texts[name]), readmeAt=stamp)
    # Forget repositories not seen for a month so the cache does not grow forever.
    cutoff = (now - timedelta(days=30)).isoformat()[:10]
    for name in [n for n, e in cache.items() if e.get("seen", "") < cutoff]: del cache[name]


# ---------- Chinese text ----------
def run_analysis(unique: dict, cache: dict, opt: Options):
    if not all(opt.llm): return False
    base, model, key = opt.llm
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(llm.analyze, r, cache, base, model, key): name for name, r in unique.items()}
        for future in concurrent.futures.as_completed(futures):
            try:
                value = future.result()
                if value: cache[futures[future]] = value
            except Exception: log.warning("AI analysis failed; preserved previous validated content")
    return True


def model_entry(name: str, r: dict, model_cache: dict | None):
    """A GitHub Models answer for this repo's current description, if any."""
    entry = (model_cache or {}).get(name)
    return entry if entry and entry.get("hash") == models.digest(r["description"]) else None


def chinese_text(name, r, analysis, upstream_map, editorial, translations, model_cache=None):
    """Pick the best honest Chinese text, in order of trust. Returns the fields to update."""
    h = translate.digest(r["description"])
    entry = analysis.get(name)
    if entry and llm.valid_analysis(entry.get("analysis")):
        a = entry["analysis"]
        return {**{k: a[k] for k in ("summary", "useCase", "techStack", "highlights")}, "summarySource": "ai-readme", "summaryAt": entry["at"]}
    # 上游中文速览也是英文转述来的，同样存在「代理」之类的术语问题，一并修订
    if name in upstream_map: return {"summary": polish.polish(upstream_map[name]["summary"], r["description"]), "summarySource": "upstream", "summaryAt": upstream_map[name]["at"]}
    if name in editorial and editorial[name].get("descriptionHash") == h:
        return {"summary": editorial[name]["summary"], "summarySource": "editorial", "summaryAt": editorial[name]["at"]}
    m = model_entry(name, r, model_cache)
    if m: return {"summary": m["summary"], "summarySource": "ai-translate", "summaryAt": m["at"]}
    if r.get("summary") and chinese(r["summary"]): return {k: r[k] for k in ("summary", "useCase", "techStack", "highlights", "summarySource", "summaryAt") if k in r}
    if name in translations and translations[name].get("hash") == h:
        # 缓存里较早的译文也过一遍后期修订，不消耗翻译额度
        return {"summary": polish.polish(translations[name]["summary"], r["description"]), "summarySource": "machine", "summaryAt": translations[name]["at"]}
    return {}


# ---------- classification ----------
def classify_row(name, r, features: dict, analysis: dict, strategy: Strategy, model_cache: dict | None = None) -> dict:
    entry = analysis.get(name)
    model_label, source = (entry["analysis"]["category"], "readme") if entry and llm.valid_analysis(entry.get("analysis")) else (None, "readme")
    if not model_label and (m := model_entry(name, r, model_cache)): model_label, source = m["category"], "brief"
    ev = Evidence(full_name=name, description=r["description"] if r["description"] != NO_DESCRIPTION else "", language=r.get("language", ""), summary=r.get("summary") or "", topics=tuple(features.get("topics") or r.get("topics") or ()), readme=features.get("readme"), model_label=model_label, model_source=source)
    out = classify(ev, strategy)
    # Model-provided stacks win; rule-detected stacks fill in only when the row has none.
    if r.get("techStack"): out.pop("techStack")
    out["topics"] = list(ev.topics)[:8]
    return out


MACHINE_SOURCES = {"machine", "upstream", "editorial", "ai-translate"}


def apply_corrections(name: str, row: dict, corrections: dict) -> dict:
    """Maintainer corrections (collector/corrections.json): a category override for this repo, and term fixes in non-AI summaries."""
    out = {}
    terms = [t for t in corrections.get("terms") or [] if isinstance(t, dict) and t.get("from") and t.get("to")]
    if row.get("summary") and row.get("summarySource") in MACHINE_SOURCES and terms:
        summary = row["summary"]
        for t in sorted(terms, key=lambda t: -len(t["from"])): summary = summary.replace(t["from"], t["to"])
        if summary != row["summary"]: out["summary"] = summary
    label = (corrections.get("categories") or {}).get(name)
    tax = load()
    if label in tax.labels:
        cat = tax.by_label(label)
        out["category"] = cat.label
        out["domain"] = cat.domain
        out["tags"] = [t for t in row.get("tags") or [] if t != cat.label]
        c = dict(row.get("classification") or {"by": "rules", "strategy": "", "confidence": 1.0, "reasons": []})
        c["reasons"] = ["人工修正", *[x for x in c.get("reasons", []) if x != "人工修正"]][:6]
        out["classification"] = c
    return out


def enrich(periods: dict, caches: dict, src: Sources, opt: Options, now: datetime):
    """Fills Chinese text and classification on every row. Returns (ready, total, ai_configured)."""
    unique = {r["fullName"]: r for rows in periods.values() for r in rows}
    try: upstream_map = src.upstream()
    except Exception: upstream_map = {}
    configured = run_analysis(unique, caches["analysis"], opt)
    try: gather_features(unique, caches["features"], src, opt, now)
    except Exception as error: log.warning("feature gathering failed: %s; classifying with what is cached", error)
    model_cache = caches.setdefault("models", {})
    stats = run_models(periods, unique, caches, upstream_map, src, opt, now)
    if opt.translation:
        def has_chinese(n, r): return bool(chinese_text(n, r, caches["analysis"], upstream_map, caches["editorial"], {}, model_cache))
        missing = {n: r["description"] for n, r in unique.items() if r["description"] != NO_DESCRIPTION and not chinese(r["description"]) and not has_chinese(n, r)}
        translate.translate_missing(missing, caches["translations"], now.isoformat(), opt.mymemory_email, src.translate, src.session)
    ready = 0
    for name, r in unique.items():
        update = chinese_text(name, r, caches["analysis"], upstream_map, caches["editorial"], caches["translations"], model_cache)
        if update: ready += 1
        merged = {**r, **update}
        update.update(classify_row(name, merged, caches["features"].get(name, {}), caches["analysis"], opt.strategy, model_cache))
        update.update(apply_corrections(name, {**merged, **update}, caches.get("corrections") or {}))
        for rows in periods.values():
            for item in rows:
                if item["fullName"] == name: item.update(update)
    log.info("github models: %s", stats)
    return ready, len(unique), configured


def run_models(periods: dict, unique: dict, caches: dict, upstream_map: dict, src: Sources, opt: Options, now: datetime) -> dict:
    """Ask GitHub Models for the rows that have no better Chinese text, in ranking order (daily first)."""
    token, model, max_requests = opt.models
    if not token: return {"requests": 0, "accepted": 0, "rejected": 0, "stopped": "off"}
    h = translate.digest
    def needs(r):
        name = r["fullName"]
        if r["description"] == NO_DESCRIPTION or chinese(r["description"]): return False
        if (caches["analysis"].get(name) or {}).get("analysis") and llm.valid_analysis(caches["analysis"][name]["analysis"]): return False
        if name in upstream_map: return False
        return (caches["editorial"].get(name) or {}).get("descriptionHash") != h(r["description"])
    ordered = [unique[r["fullName"]] for p in ("daily", "weekly", "monthly") for r in periods.get(p, []) if needs(r)]
    try:
        return src.models(ordered, caches["models"], token, model, max_requests, session_factory=src.models_session, now=now.isoformat())
    except Exception as error:  # never let the model step break a collection
        log.warning("GitHub Models step failed: %s", error)
        return {"requests": 0, "accepted": 0, "rejected": 0, "stopped": str(error)}


def reclassify(snapshot: dict, caches: dict, strategy: Strategy):
    """Re-run classification on an existing snapshot without fetching rankings again."""
    for rows in snapshot["periods"].values():
        for r in rows:
            r.update(classify_row(r["fullName"], r, caches["features"].get(r["fullName"], {}), caches["analysis"], strategy, caches.get("models")))
    snapshot["taxonomyVersion"] = load().version
    snapshot["classifier"] = strategy.name
    return snapshot


def assemble(periods, status, enrichment, strategy: Strategy, now: str) -> dict:
    return {"schemaVersion": 1, "date": now[:10], "generatedAt": now, "source": "https://github.com/trending", "periods": periods, "status": status, "enrichment": enrichment, "taxonomyVersion": load().version, "classifier": strategy.name}


def collect(previous: dict, baseline: dict, caches: dict, src: Sources, opt: Options, now: datetime | None = None) -> dict:
    """One full run. A failed period keeps its previous complete ranking; no data at all raises."""
    now = now or datetime.now(TZ)
    stamp = now.isoformat()
    periods, status = {}, {}
    for period in PERIODS:
        try:
            periods[period] = merge_period(period, src, opt)
            status[period] = {"ok": True, "capturedAt": stamp}
        except Exception as error:
            old = previous.get("periods", {}).get(period)
            if not old: raise RuntimeError(f"No valid {period} data; refusing an empty publish") from error
            log.warning("%s collection failed (%s); kept previous ranking", period, error)
            periods[period] = old
            status[period] = {"ok": False, "capturedAt": previous.get("status", {}).get(period, {}).get("capturedAt", previous.get("generatedAt", stamp)), "error": "采集失败，保留上次完整榜单"}
        ranks = {r["fullName"]: r["rank"] for r in baseline.get("periods", {}).get(period, [])}
        for r in periods[period]: r["previousRank"] = ranks.get(r["fullName"])
    ready, total, configured = enrich(periods, caches, src, opt, now)
    return assemble(periods, status, {"ready": ready, "total": total, "aiConfigured": configured}, opt.strategy, stamp)
