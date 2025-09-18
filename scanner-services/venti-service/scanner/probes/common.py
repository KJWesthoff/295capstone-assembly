
from typing import Dict, Any

def summarize_response(resp) -> Dict[str, Any]:
    body_excerpt = None
    try:
        text = resp.text or ""
        body_excerpt = text[:200]
    except Exception:
        body_excerpt = None
    return {
        "status": resp.status_code,
        "headers": {k:v for k,v in resp.headers.items() if k.lower() in ("content-type","retry-after","x-ratelimit-remaining","x-ratelimit-limit")},
        "len": getattr(resp, "num_bytes_downloaded", None),
        "excerpt": body_excerpt,
    }
