"""NLQ language detection, Hindi normalization, and Hinglish response support.

Phase 2 enhancement for the NLQ pipeline. Provides:
  - Language detection (english / hindi / hinglish)
  - Hindi-to-English normalization (time words, domain keywords)
  - Domain-relevant Hindi keyword lists
  - Hinglish response instruction for the AI prompt
"""

from __future__ import annotations

import re

_DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")

# ── Hindi-to-English time word map ────────────────────────────────────────
_HINDI_TIME_MAP: dict[str, str] = {
    "aaj": "today",
    "aaj ka": "today",
    "aaj ki": "today",
    "kal": "yesterday",        # "kal" can mean both yesterday/tomorrow;
    "pichle kal": "yesterday",  # disambiguate with pichle/agna:
    "pichala kal": "yesterday",
    "parson": "day before yesterday",
    "pichle mahine": "last month",
    "pichle hafte": "last week",
    "pichle saal": "last year",
    "pichla quarter": "last quarter",
    "is mahine": "this month",
    "is hafte": "this week",
    "is saal": "this year",
    "is quarter": "this quarter",
    "agle mahine": "next month",
    "pichle 7 din": "last 7 days",
    "pichle 14 din": "last 14 days",
    "pichle 30 din": "last 30 days",
    "pichle 7 dino": "last 7 days",
    "pichle 14 dino": "last 14 days",
    "pichle 30 dino": "last 30 days",
    "pichle 3 mahine": "last 3 months",
    "pichle 6 mahine": "last 6 months",
    "abhi": "today",
    "aaj raat": "today",
}

# ── Hindi/Hinglish question words ─────────────────────────────────────────
_HINGLISH_WORDS: set[str] = {
    "aaj", "kal", "pichle", "mahine", "hafte", "saal", "quarter",
    "kaun", "kya", "kab", "kahan", "kaise", "kitna", "kitne",
    "kis", "kiske", "kiska", "kise", "kuch", "koi",
    "hai", "hain", "ho", "the", "thi", "the",
    "nahi", "haan", "hmm",
    "aaya", "aaye", "aayi", "gaya", "gaye", "gayi",
    "rakha", "rakhi", "rakhe", "diya", "diye", "di",
    "kar", "karo", "kare", "karte", "kar raha", "kar rahe",
    "bataye", "batao", "bata",
    "dekh", "dekho", "dekhe",
    "paisa", "paise", "rupya", "rupyae",
    "kaam", "kam", "zyada",
    "andar", "bahar", "upar", "niche",
    "mera", "meri", "mere", "tera", "teri", "tere",
    "iska", "iski", "iske", "uska", "uski", "uske",
    "sab", "saare", "kuch", "thoda", "thode",
    "sahi", "galat", "theek",
    "achha", "achhi", "achhe",
    "chahiye", "hoga", "hogi", "honge",
    "waala", "waali", "waale",
    "vaala", "vaali", "vaale",
    "dikhhao", "dikhao",
}

# ── Hindi domain keywords (used in classifier) ────────────────────────────
HINDI_DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "attendance": [
        "aaya", "aaye", "aayi", "gaya", "gaye",
        "kaun aaya", "kaun nahi aaya",
        "haziri", "haaziri",
        "maujood", "ghair haazir",
        "late", "der se aaya",
        "overtime", "extra time",
        "kaam kiya", "worker", "mazdoor",
        "kitne log", "kitne aadmi",
    ],
    "dispatch": [
        "dispatch", "bheja", "bheji", "bheje",
        "truck", "truck mein", "laden",
        "challan", "gate pass",
        "maal bheja", "samaan bheja",
        "kab bheja", "kahan bheja",
        "load", "consignment",
    ],
    "theft_fraud": [
        "chor", "chori", "chori hua", "chori kiya",
        "fraud", "dhokha", "dhoka",
        "gum", "missing", "khoya",
        "leakage", "rasav",
        "suspicious", "shakspad",
        "mismatch", "bemisal",
        "duplicate", "nakli",
        "unauthorized", "bin ijazat",
        "anomaly", "asamaanya",
    ],
    "finance": [
        "paisa", "paise", "rupya", "rupyae", "rupaye",
        "revenue", "kamai", "aamdani",
        "kharcha", "kharch", "expense",
        "munafa", "profit", "loss",
        "invoice", "bill", "baki",
        "payment", "bhugtan", "diya",
        "outstanding", "baki hai",
        "overdue", "der se",
        "budget", "bajaat",
        "margin", "faraq",
        "kitna paisa", "kitna kharcha",
    ],
    "inventory": [
        "stock", "stocks",
        "material", "mal",
        "godaam", "warehouse",
        "kacha maal", "raw material",
        "stock mein kya", "kya bacha",
        "kam stock", "low stock",
        "reorder", "mangwana",
        "balance", "baki maal",
    ],
    "production": [
        "production", "utpadan",
        "machine", "mashin",
        "batch", "lot",
        "output", "kitna bana",
        "downtime", "stoppage", "band",
        "efficiency", "dakshata",
        "scrap", "katt", "rejection",
        "shift", "pali",
        "target", "lakshya",
        "kitna bana", "kitna hua",
    ],
    "owner_insights": [
        "health", "sehat",
        "summary", "sarakansh",
        "overview", "jhalak",
        "performance", "pradarshan",
        "top problem", "sabse badi samasya",
        "risk", "jokhim",
        "score", "ank",
        "compare", "tulna",
        "trend", "pravritti",
        "owner", "malik",
        "sab batao", "sab kuch batao",
        "factory ka haal",
    ],
    "ocr": [
        "ocr", "scan", "document",
        "invoice extract", "challan",
        "text", "image",
        "process", "sanskaran",
    ],
    "alerts": [
        "alert", "savdhani", "savdhan",
        "notification", "soochana",
        "warning", "chetavani",
        "critical", "gambhir",
        "trigger", "triggered",
    ],
}

# ── Hinglish response instruction for AI prompts ──────────────────────────
HINDI_RESPONSE_INSTRUCTION = """
The owner asked this question in Hindi/Hinglish.
Respond in simple Hinglish (mix of Hindi and English).
Use English for numbers, INR amounts, dates, percentages, and technical terms.
Use Hindi for explanatory sentences, greetings, and connectors.
Example style: "Aaj 47 workers aaye hain. 3 late hain — Rajesh, Vikas, aur Suresh. Overtime total: 84 minutes."
"""


def detect_language(question: str) -> str:
    """Detect whether a question is in english, hindi, or hinglish.

    Returns one of: "hindi", "hinglish", "english"

    Detection strategy:
      1. If the text contains Devanagari Unicode characters → "hindi"
      2. If the text contains known Hinglish words → "hinglish"
      3. Otherwise → "english"
    """
    text = question.strip().lower()
    if not text:
        return "english"

    # Check for Devanagari characters
    if _DEVANAGARI_RE.search(text):
        return "hindi"

    # Check for Hinglish words (in the first 80 chars to keep it fast)
    prefix = text[:80]
    for word in prefix.split():
        clean_word = word.strip("?.,!;:'\"()[]{}")
        if clean_word in _HINGLISH_WORDS:
            return "hinglish"

    return "english"


def _word_boundary_replacer(text: str, replacements: dict[str, str]) -> str:
    """Apply word-boundary-aware replacements to text.

    Uses regex with \\b anchors to prevent partial-word matches.
    Replacements are applied in order; multi-word phrases are checked
    before single words by sorting descending by length.
    """
    for old_word, new_word in sorted(replacements.items(), key=lambda x: -len(x[0])):
        pattern = re.compile(rf"\b{re.escape(old_word)}\b", re.IGNORECASE)
        text = pattern.sub(new_word, text)
    return text


def normalize_question(question: str, language: str) -> str:
    """Normalize a Hindi/Hinglish question to English for downstream processing.

    The original question is preserved for the AI prompt, but the normalized
    version is used for domain classification, time parsing, and entity extraction.

    For english input, returns the question unchanged.
    """
    if language == "english":
        return question

    text = question.lower().strip()

    # Step 1: Apply time word replacements with word boundaries
    text = _word_boundary_replacer(text, _HINDI_TIME_MAP)

    # Step 2: Replace common Hinglish question patterns
    _PATTERN_REPLACEMENTS: dict[str, str] = {
        "kaun": "who",
        "kya": "what",
        "kab": "when",
        "kahan": "where",
        "kaise": "how",
        "kitna": "how much",
        "kitne": "how many",
        "kis": "which",
        "kiska": "whose",
        "kise": "whom",
        "batao": "tell me",
        "dikhao": "show me",
        "bataye": "tell",
        "dekh": "see",
        "chahiye": "want",
        "hai": "is",
        "hain": "are",
        "the": "were",
        "thi": "was",
        "nahi": "not",
        "aaya": "came",
        "aaye": "came",
        "gaya": "went",
        "kiya": "did",
        "karo": "do",
        "rakha": "kept",
        "diya": "gave",
        "hoga": "will be",
    }
    text = _word_boundary_replacer(text, _PATTERN_REPLACEMENTS)

    # Collapse extra whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def get_hindi_keywords_for_domain(domain_value: str) -> list[str]:
    """Return Hindi/Hinglish keywords for a given domain value string.

    Returns an empty list if no Hindi keywords are defined for that domain.
    """
    return HINDI_DOMAIN_KEYWORDS.get(domain_value, [])
