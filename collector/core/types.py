"""Data shapes shared by every layer. Mirrors shared/discovery.ts; change both together."""
from typing import Literal, TypedDict

Period = Literal["daily", "weekly", "monthly"]
Origin = Literal["trending", "language", "search"]
SummarySource = Literal["ai-readme", "upstream", "editorial", "machine", "pending"]


class Classification(TypedDict):
    by: Literal["rules", "ai"]
    strategy: str
    confidence: float  # 0-1: share of the winning category in the total score
    reasons: list[str]  # human-readable evidence, e.g. "主题 self-hosted"


class Repo(TypedDict, total=False):
    fullName: str
    rank: int
    description: str
    language: str
    stars: int
    forks: int
    periodStars: int | None
    previousRank: int | None
    summary: str | None
    useCase: str | None
    techStack: list[str]
    highlights: list[str]
    category: str  # primary category label
    tags: list[str]  # secondary category labels
    domain: str  # domain id of the primary category
    purposes: list[str]
    topics: list[str]
    classification: Classification
    summarySource: SummarySource
    summaryAt: str | None
    origin: Origin
    stream: str  # search stream that found the row, e.g. "topic:self-hosted"
    createdAt: str


class Features(TypedDict, total=False):
    """What blocks extract about a repository beyond the ranking row."""
    topics: list[str]
    readme: str  # lower-cased README head, used only in memory and never published
