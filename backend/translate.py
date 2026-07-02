"""KO -> EN translation via the Gemini (Generative Language) REST API.

Uses only the standard library (urllib) so no extra dependency is needed.
The model is asked to return a JSON array of strings in the same order as the
input, preserving Markdown / code / URLs.
"""
import json
import urllib.error
import urllib.request

import config

ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)

LANG_NAMES = {"ko": "Korean", "en": "English"}


class TranslationError(Exception):
    """Raised when translation cannot be performed."""


def translate_texts(texts: list[str], source: str = "ko", target: str = "en") -> list[str]:
    if not config.GEMINI_API_KEY:
        raise TranslationError(
            "Gemini API key is not configured. Set GEMINI_API_KEY in .env."
        )
    if not texts:
        return []

    src = LANG_NAMES.get(source, source)
    tgt = LANG_NAMES.get(target, target)
    prompt = (
        f"You are a professional translator. Translate each string in the input "
        f"JSON array from {src} to {tgt}. Preserve all Markdown formatting, code "
        f"blocks, inline code, image syntax, and URLs exactly — never translate "
        f"text inside code fences or URLs. Return a JSON array of translated "
        f"strings with the same length and order as the input. If an element is "
        f"empty, return an empty string for it.\n\nInput:\n"
        f"{json.dumps(texts, ensure_ascii=False)}"
    )

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {"type": "ARRAY", "items": {"type": "STRING"}},
            "temperature": 0.2,
        },
    }

    url = ENDPOINT.format(model=config.GEMINI_MODEL, key=config.GEMINI_API_KEY)
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")[:300]
        raise TranslationError(f"Gemini API error ({e.code}): {detail}")
    except urllib.error.URLError as e:
        raise TranslationError(f"Could not reach Gemini API: {e.reason}")

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(text)
        if not isinstance(result, list):
            raise ValueError("not a list")
        result = [str(x) for x in result]
    except (KeyError, IndexError, ValueError, json.JSONDecodeError):
        raise TranslationError("Unexpected response from Gemini API.")

    # Guarantee the caller gets exactly len(texts) items back.
    if len(result) < len(texts):
        result += [""] * (len(texts) - len(result))
    return result[: len(texts)]
