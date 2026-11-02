"""Loads shared/taxonomy.json (also read by the frontend) and compiles its word lists."""
import json
import re
from dataclasses import dataclass
from functools import lru_cache

from collector.core.settings import TAXONOMY_FILE


@dataclass(frozen=True)
class Category:
    id: str
    label: str
    domain: str
    facet: str  # "purpose" (what it is for) or "tech" (what it is built with)
    topics: frozenset[str]
    pattern: re.Pattern | None  # English words with word boundaries
    zh: tuple[str, ...]  # Chinese words, matched as substrings
    stream_topics: tuple[str, ...]  # GitHub topics searched for new projects in this category


@dataclass(frozen=True)
class Taxonomy:
    version: int
    domains: dict[str, str]
    categories: tuple[Category, ...]
    fallback: Category
    legacy: dict[str, str]
    language_hints: dict[str, str]
    purposes: tuple[tuple[str, re.Pattern | None, tuple[str, ...]], ...]
    stacks: tuple[tuple[str, re.Pattern | None, tuple[str, ...]], ...]

    @property
    def labels(self) -> tuple[str, ...]:
        return tuple(c.label for c in self.categories) + (self.fallback.label,)

    def by_id(self, cid: str) -> Category:
        return next((c for c in self.categories if c.id == cid), self.fallback)

    def by_label(self, label: str) -> Category:
        label = label if label not in self.legacy else self.by_id(self.legacy[label]).label
        return next((c for c in self.categories if c.label == label), self.fallback)


def chinese(s) -> bool:
    return isinstance(s, str) and bool(re.search(r"[㐀-鿿]", s))


def word_pattern(words) -> re.Pattern | None:
    """English phrases with word boundaries; a phrase ending in a letter also matches a plural s/es."""
    parts = []
    for w in sorted({w.lower() for w in words if not chinese(w)}, key=len, reverse=True):
        p = re.escape(w).replace(r"\ ", r"[\s_-]+").replace(r"\-", r"[\s_-]?")
        parts.append(p + ("(?:e?s)?" if re.search(r"[a-z]$", w) else ""))
    return re.compile(rf"(?<![a-z0-9])(?:{'|'.join(parts)})(?![a-z0-9])") if parts else None


def split_words(words):
    return word_pattern(words), tuple(w for w in words if chinese(w))


@lru_cache(maxsize=1)
def load() -> Taxonomy:
    doc = json.loads(TAXONOMY_FILE.read_text())
    def cat(c):
        return Category(c["id"], c["label"], c["domain"], c.get("facet", "purpose"), frozenset(t.lower() for t in c.get("topics", [])), word_pattern(c.get("keywords", [])), tuple(c.get("zh", [])), tuple(c.get("streamTopics", [])))
    return Taxonomy(
        version=doc["version"],
        domains={d["id"]: d["label"] for d in doc["domains"]},
        categories=tuple(cat(c) for c in doc["categories"]),
        fallback=cat(doc["fallback"]),
        legacy=doc.get("legacy", {}),
        language_hints=doc.get("languageHints", {}),
        purposes=tuple((p["label"], *split_words(p["words"])) for p in doc.get("purposes", [])),
        stacks=tuple((s["label"], *split_words(s["words"])) for s in doc.get("stacks", [])),
    )
