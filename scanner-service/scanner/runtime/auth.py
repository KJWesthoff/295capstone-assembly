
from typing import Dict, Optional
import base64

class AuthContext:
    def __init__(self, security_schemes: Dict[str, dict], fuzz_auth: bool=False):
        self.schemes = security_schemes
        self.fuzz_auth = fuzz_auth

    def apply(self, req_kwargs: dict, scheme_name: Optional[str], variant: str):
        if not scheme_name:
            return req_kwargs
        scheme = self.schemes.get(scheme_name)
        if not scheme:
            return req_kwargs

        typ = scheme.type
        if typ == "http" and scheme.scheme == "basic":
            if self.fuzz_auth and variant == "basic-default":
                token = base64.b64encode(b"admin:admin").decode()
                req_kwargs.setdefault("headers", {})["Authorization"] = f"Basic {token}"
        elif typ == "http" and scheme.scheme == "bearer":
            if variant == "bogus":
                req_kwargs.setdefault("headers", {})["Authorization"] = "Bearer eyJbogus.eyJbogus.sig"
        elif typ == "apiKey":
            if variant == "apikey-placeholder":
                if scheme.in_ == "header" and scheme.name:
                    req_kwargs.setdefault("headers", {})[scheme.name] = "PLACEHOLDER"
                elif scheme.in_ == "query" and scheme.name:
                    req_kwargs.setdefault("params", {})[scheme.name] = "PLACEHOLDER"
        return req_kwargs
