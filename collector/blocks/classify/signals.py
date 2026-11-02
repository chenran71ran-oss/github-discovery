"""Classification signals. Each takes raw evidence and returns {category id: (score, [reason])}.
Signals know nothing about weights; strategies (lab layer) decide how much each one counts."""
import re

from collector.core.taxonomy import Taxonomy

Scores = dict[str, tuple[float, list[str]]]

# A few stacks imply a field strongly enough to count as weak evidence.
STACK_HINTS = {"React": "frontend", "Vue": "frontend", "Svelte": "frontend", "Next.js": "frontend", "Nuxt": "frontend", "Tailwind CSS": "frontend", "Flutter": "apps", "React Native": "apps", "SwiftUI": "apps", "Jetpack Compose": "apps", "Electron": "apps", "Tauri": "apps", "PyTorch": "ai", "TensorFlow": "ai", "Hugging Face": "ai", "LangChain": "ai", "Ollama": "ai", "Godot": "gamedev", "Unity": "gamedev", "Bevy": "gamedev", "Three.js": "gamedev", "ESP32": "smarthome", "Arduino": "smarthome", "FFmpeg": "media", "Kubernetes": "data", "PostgreSQL": "data", "GraphQL": "backend", "gRPC": "backend", "FastAPI": "backend", "Django": "backend", "Spring Boot": "backend", "NestJS": "backend"}


def normalise(text: str) -> str:
    text = text.lower().replace("user-agent", " ")
    # "machine learning" is AI, not a learning resource; "deep learning" likewise
    return re.sub(r"\b(?:machine|deep|reinforcement) learning\b", " ml ", text)


def hits(pattern, zh, text: str) -> set[str]:
    found = {m.group(0).strip() for m in pattern.finditer(text)} if pattern else set()
    return found | {w for w in zh if w in text}


def name_text(full_name: str) -> str:
    name = full_name.split("/")[-1]
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name).replace("-", " ").replace("_", " ").replace(".", " ")


def keywords(tax: Taxonomy, text: str) -> Scores:
    """Distinct keyword hits in the name, description and any Chinese summary."""
    text = normalise(text)
    out = {}
    for c in tax.categories:
        found = hits(c.pattern, c.zh, text)
        if found: out[c.id] = (float(len(found)), [f"关键词 {w}" for w in sorted(found)[:3]])
    return out


def topics(tax: Taxonomy, repo_topics) -> Scores:
    """GitHub topics chosen by the authors themselves: the most reliable signal."""
    mine = {t.lower() for t in repo_topics or []}
    out = {}
    for c in tax.categories:
        found = mine & c.topics
        if found: out[c.id] = (float(len(found)), [f"主题 {t}" for t in sorted(found)[:3]])
    return out


def readme(tax: Taxonomy, counts: dict[str, list[str]] | None, cap: int = 4) -> Scores:
    """README head hits, precomputed by readme_features. Capped: long READMEs mention everything."""
    out = {}
    for cid, words in (counts or {}).items():
        if words: out[cid] = (float(min(len(words), cap)), [f"README 提到 {w}" for w in words[:2]])
    return out


def readme_features(tax: Taxonomy, text: str) -> dict:
    """Compact, cacheable digest of a README: per-category hits, stacks and purposes."""
    text = normalise(text)
    return {
        "v": tax.version,
        "hits": {c.id: sorted(found)[:6] for c in tax.categories if (found := hits(c.pattern, c.zh, text))},
        "stacks": [label for label, pattern, zh in tax.stacks if hits(pattern, zh, text)],
        "purposes": [label for label, pattern, zh in tax.purposes if hits(pattern, zh, text)],
    }


def language(tax: Taxonomy, lang: str) -> Scores:
    cid = tax.language_hints.get(lang or "")
    return {cid: (1.0, [f"语言 {lang}"])} if cid else {}


def stacks(stack_labels) -> Scores:
    out: dict[str, tuple[float, list[str]]] = {}
    for label in stack_labels or []:
        cid = STACK_HINTS.get(label)
        if cid:
            score, why = out.get(cid, (0.0, []))
            out[cid] = (score + 1, why + [f"技术栈 {label}"])
    return out


def model(tax: Taxonomy, label: str | None) -> Scores:
    """Category picked by the README model analysis, when one was validated."""
    if not label: return {}
    c = tax.by_label(label)
    return {c.id: (1.0, ["模型阅读 README 后判断"])} if c is not tax.fallback else {}


def detect(entries, text: str, extra=()) -> list[str]:
    """Labels from the purposes/stacks lists found in the text, keeping list order."""
    text = normalise(text)
    found = [label for label, pattern, zh in entries if hits(pattern, zh, text)]
    return list(dict.fromkeys(found + [e for e in extra if e in {label for label, _, _ in entries}]))
