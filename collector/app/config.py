"""Runtime configuration from the environment. Secrets are read here and nowhere else."""
import os
from dataclasses import dataclass
from pathlib import Path

from collector.core import settings


@dataclass(frozen=True)
class Config:
    data_dir: Path
    token: str
    llm: tuple[str, str, str]  # base url, model, key
    ai: tuple[str, str, str, int]  # AI API for batch translation: base url, key (empty = off), model, max requests per run
    translation: bool
    mymemory_email: str
    readme: bool
    strategy: str
    log_level: str

    @property
    def llm_configured(self) -> bool:
        return all(self.llm)


def from_env(env=None) -> Config:
    env = os.environ if env is None else env
    return Config(
        data_dir=Path(env.get("DISCOVERY_DATA_DIR") or settings.DATA),
        token=env.get("GITHUB_TOKEN", ""),
        llm=(env.get("LLM_BASE_URL", ""), env.get("LLM_MODEL", ""), env.get("LLM_API_KEY", "")),
        # 批量中文介绍：默认 Gemini 的 OpenAI 兼容接口，有 AI_API_KEY 才开启
        ai=(env.get("AI_BASE_URL") or "https://generativelanguage.googleapis.com/v1beta/openai", env.get("AI_API_KEY", ""), env.get("AI_MODEL") or "gemini-2.5-flash", int(env.get("AI_MAX_REQUESTS") or 12)),
        translation=env.get("MACHINE_TRANSLATION", "1") != "0",
        mymemory_email=env.get("MYMEMORY_EMAIL", ""),
        readme=env.get("README_SIGNALS", "1") != "0",
        strategy=env.get("CLASSIFIER_STRATEGY", ""),
        log_level=env.get("LOG_LEVEL", "INFO"),
    )
