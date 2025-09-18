
import httpx
from .throttle import TokenBucket

class HttpClient:
    def __init__(self, base_url: str, rps: float = 1.0, timeout: float=10.0, max_requests: int=500):
        self.base_url = base_url.rstrip("/")
        self.bucket = TokenBucket(rps)
        self.timeout = timeout
        self.max_requests = max_requests
        self._count = 0
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=timeout, follow_redirects=True)

    async def request(self, method: str, url: str, **kw) -> httpx.Response:
        if self._count >= self.max_requests:
            raise RuntimeError("request budget exhausted")
        self._count += 1
        await self.bucket.take()
        try:
            return await self._client.request(method, url, **kw)
        except httpx.HTTPError as e:
            return httpx.Response(599, request=httpx.Request(method, url), text=str(e))

    async def aclose(self):
        await self._client.aclose()
