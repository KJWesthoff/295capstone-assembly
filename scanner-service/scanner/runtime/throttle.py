
import anyio

class TokenBucket:
    def __init__(self, rate_per_sec: float, capacity: int|None=None):
        self.rate = rate_per_sec
        self.capacity = capacity or max(1, int(rate_per_sec*2))
        self.tokens = self.capacity
        self.last = anyio.current_time()
        self.lock = anyio.Lock()

    async def take(self, n=1):
        async with self.lock:
            now = anyio.current_time()
            elapsed = now - self.last
            self.last = now
            self.tokens = min(self.capacity, self.tokens + elapsed*self.rate)
            while self.tokens < n:
                need = n - self.tokens
                await anyio.sleep(need/self.rate)
                now = anyio.current_time()
                elapsed = now - self.last
                self.last = now
                self.tokens = min(self.capacity, self.tokens + elapsed*self.rate)
            self.tokens -= n
