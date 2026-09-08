"""
Shared HTTP integration helpers.

Home for outbound calls to external services that aren't tied to one
specific provider (Ideogram/Veo/Vercel/Telegram stay where they are for
now — see agents.py / main.py). Starts with basic URL-fetching, used by
site_audit_agent to pull down a page before analyzing it.
"""

import re
import requests

DEFAULT_TIMEOUT = 20
MAX_RESPONSE_BYTES = 3_000_000  # 3MB cap so a huge page can't blow up a request


class FetchError(Exception):
    pass


def fetch_url(url: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    """Fetches a URL and returns its response body as text.

    Raises FetchError with a human-readable message on any failure
    (bad URL, network error, non-2xx status, response too large).
    """
    if not url or not url.startswith(("http://", "https://")):
        raise FetchError(f"Invalid URL: {url!r}")

    try:
        response = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "AgenticCoreAgencyBot/1.0"},
            stream=True,
        )
    except requests.RequestException as e:
        raise FetchError(f"Request to {url} failed: {e}")

    if response.status_code >= 400:
        raise FetchError(f"{url} returned HTTP {response.status_code}")

    content = b""
    for chunk in response.iter_content(chunk_size=65536):
        content += chunk
        if len(content) > MAX_RESPONSE_BYTES:
            raise FetchError(f"{url} response exceeded {MAX_RESPONSE_BYTES} bytes")

    return content.decode(response.encoding or "utf-8", errors="replace")


def html_to_text(html: str, max_chars: int = 15000) -> str:
    """Strips an HTML document down to its readable text content.

    Uses BeautifulSoup when available; falls back to a regex-based strip
    so this module still works if bs4 isn't installed.
    """
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(separator="\n")
    except ImportError:
        text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)

    lines = [line.strip() for line in text.splitlines()]
    text = "\n".join(line for line in lines if line)
    return text[:max_chars]
