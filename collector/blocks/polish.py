"""Post-editing for machine-translated project descriptions.

MyMemory output has recurring, fixable problems: "AI agent" becomes 代理/人工智能代理, a formal 您 and
应用程序 everywhere, spacing broken around brackets and between Chinese and Latin text, and product
names translated word by word. `polish` fixes the first three on any translation (cached ones too, so no
quota is spent); `split_name` keeps a leading product name in English before translating the rest.
"""
import re

CJK = r"㐀-䶿一-鿿"
# (pattern, replacement, only when the English mentions this) — order matters: longer phrases first
TERMS = [
    (r"(?:人工智能|AI)\s*代理", "AI 智能体", "agent"),
    (r"(?:编码|编程)代理", "编程智能体", "agent"),
    (r"代理(技能|工作流|框架|平台|系统|运行时|编排|记忆|工具)", r"智能体\1", "agent"),
    (r"多代理", "多智能体", "agent"),
    (r"代理(?=[，。、；：]|$)", "智能体", "agent"),
    # 其余位置的「代理」（子代理、代理应用、面向代理…）：原文说的是 agent 且没有提到网络代理时才改，
    # 「反向代理」「代理服务器」这类网络术语保留
    (r"(?<!反向)(?<!正向)代理(?!服务器|商|人|池|模式|地址|设置|规则)", "智能体", "agent-only"),
    (r"人工智能(?!体)", "AI", "ai"),
    (r"应用程序", "应用", ""),
    (r"您的", "你的", ""),
    (r"您", "你", ""),
    (r"开源源代码", "开源", ""),
]


NETWORK = re.compile(r"\b(proxy|proxies|vpn|socks|gateway|reverse|clash|v2ray|xray|shadowsocks|tunnel)", re.I)


def _has(en: str, word: str) -> bool:
    if word == "agent-only": return _has(en, "agent") and not NETWORK.search(en)
    return not word or re.search(rf"\b{word}", en, re.I) is not None


def polish(zh: str, en: str) -> str:
    """Terminology, register and typography fixes. Never changes meaning-bearing words otherwise."""
    out = zh
    for pattern, repl, needs in TERMS:
        if _has(en, needs) and not (needs == "agent" and NETWORK.search(en) and "代理" in pattern):
            out = re.sub(pattern, repl, out)
    # 全角括号、逗号两侧多出来的空格：「（ CUDA ， Vulkan ）」→「（CUDA，Vulkan）」
    out = re.sub(r"\s*([（），。、；：！？])\s*", r"\1", out)
    # 破折号统一成中文的「——」
    out = re.sub(r"\s*—+\s*", "——", out)
    # 中文与英文、数字之间加空格（盘古之白）
    out = re.sub(rf"([{CJK}])([A-Za-z0-9@#$%^&*+\-/\\(\[])", r"\1 \2", out)
    out = re.sub(rf"([A-Za-z0-9!%)\]+\-/\\])([{CJK}])", r"\1 \2", out)
    return re.sub(r" {2,}", " ", out).strip()


_NAME = re.compile(r"^((?:[A-Z0-9][\w.+-]*)(?:\s+(?:[A-Z0-9][\w.+-]*|for|of|and|the|to|in|on|with|&)){0,5})\s*(:|–|—| - )\s*(.+)$")


def split_name(en: str) -> tuple[str, str, str] | None:
    """「Render Anything Engine: tell your AI…」→ ("Render Anything Engine", "：", "tell your AI…").
    Only a short, capitalised head before a colon or dash counts as a product name."""
    m = _NAME.match(en.strip())
    if not m: return None
    name, sep, rest = m.group(1), m.group(2), m.group(3)
    if len(rest) < 8 or not any(c.isupper() for c in name): return None
    return name, "：" if sep == ":" else "——", rest
